import { open, realpath, lstat, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { GlmDependencies, GlmDispatch, UsageRequest } from "@/lib/studio/document-import/glm";

export type TestLedgerAdmission = Readonly<{ canonicalRoot: string; goId: string }>;
export class TestLedgerBlocked extends Error {
  readonly code = "qa_glm_dispatch_blocked";
  constructor() { super("El envío de prueba requiere revisión del registro persistente."); }
}
const blocked = (): never => { throw new TestLedgerBlocked(); };

/** One GO, one durable pipeline. Guard files are NEVER deleted/reclaimed by this code.
 * The future GO must pin this canonical root for every process/rerun/profile. A different
 * root is a different authorization, never an automatic fallback. No secret/prompt in log.
 */
export async function createTestLedger(admission: TestLedgerAdmission) {
  if (!admission || !path.isAbsolute(admission.canonicalRoot) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{5,100}$/.test(admission.goId)) blocked();
  const root = await realpath(admission.canonicalRoot);
  if (path.resolve(root) !== path.resolve(admission.canonicalRoot) || !(await lstat(root)).isDirectory()) blocked();
  let global: FileHandle | undefined, input: FileHandle | undefined, log: FileHandle | undefined;
  let request: UsageRequest | undefined, inFlight: GlmDispatch | undefined, consumed = 0, closed = false, transitioning = false;
  const fence = randomUUID();
  const assertActive = (signal: AbortSignal) => { if (closed || signal.aborted) blocked(); };
  const append = async (event: Record<string, unknown>, signal: AbortSignal) => {
    assertActive(signal);
    if (!log) blocked();
    await log.appendFile(JSON.stringify({ version: 1, goId: admission.goId, fence, atUtc: new Date().toISOString(), ...event }) + "\n", "utf8");
    await log.sync();
    assertActive(signal);
  };
  const close = async () => {
    closed = true;
    await Promise.allSettled([global?.close(), input?.close(), log?.close()]);
    // Persisted guards remain even on success, timeout, malformed response or process crash.
  };
  const reserveUsage: NonNullable<GlmDependencies["reserveUsage"]> = async (r, signal) => {
    assertActive(signal);
    if (request || !/^[a-f0-9]{64}$/.test(r.sha256) || r.model !== "glm-4.6" || r.ocrPages !== 2
      || r.maxInputTokens !== 16384 || r.maxOutputTokens !== 8192) blocked();
    request = Object.freeze({ ...r });
    try {
      // Global lock also survives crash/truncation. No lease expiry, RAM quota or directory scan.
      global = await open(path.join(root, "global-pipeline.guard"), "wx", 0o600);
      await global.writeFile(JSON.stringify({ goId: admission.goId, fence, attemptId: r.attemptId, sha256: r.sha256 }));
      await global.sync();
      input = await open(path.join(root, `${r.sha256}.guard`), "wx", 0o600);
      await input.writeFile(JSON.stringify({ goId: admission.goId, fence, attemptId: r.attemptId }));
      await input.sync();
      log = await open(path.join(root, "global-dispatches.jsonl"), "wx", 0o600);
      await append({ state: "reserved", sha256: r.sha256, attemptId: r.attemptId, consumed: 0 }, signal);
      return { confirmed: true, attemptId: r.attemptId, sha256: r.sha256, ocrPages: 2, textTokens: 24576 };
    } catch { await close(); return blocked(); }
  };
  const matches = (r: GlmDispatch) => {
    if (!request || r.attemptId !== request.attemptId || r.sha256 !== request.sha256
      || r.correlationId !== `${request.attemptId}-${r.stage}` || !/^[a-f0-9]{64}$/.test(r.bodySha256)) blocked();
  };
  const tokenization: NonNullable<GlmDependencies["tokenization"]> = {
    mode: "remote_standard",
    async beforeDispatch(r, signal) {
      assertActive(signal); matches(r);
      if (transitioning || inFlight || consumed >= 3 || r.stage !== (["ocr", "tokenizer", "chat"] as const)[consumed]) blocked();
      // Synchronously fence competing callbacks before awaiting the durable write.
      inFlight = Object.freeze({ ...r }); consumed++;
      try { await append({ ...r, state: "possibly_sent", consumed }, signal); }
      catch { closed = true; return blocked(); }
    },
    async received(r, signal) {
      assertActive(signal); matches(r);
      if (transitioning || !inFlight || inFlight.stage !== r.stage || inFlight.bodySha256 !== r.bodySha256) blocked();
      transitioning = true;
      try { await append({ ...r, state: "received", consumed }, signal); inFlight = undefined; }
      finally { transitioning = false; }
    },
    async observeUsage(counts, signal) {
      assertActive(signal);
      if (consumed !== 3 || inFlight || !Number.isInteger(counts.tokenizer) || !Number.isInteger(counts.chat)
        || counts.tokenizer <= 0 || counts.chat < 0 || !Number.isSafeInteger(counts.outputTokens) || counts.outputTokens < 0
        || counts.tokenizer > 16384 || !Number.isSafeInteger(counts.chat)
        || counts.difference !== counts.chat - counts.tokenizer) blocked();
      await append({ state: "usage_observed", ...counts, consumed }, signal);
    },
  };
  return Object.freeze({ reserveUsage, tokenization, close });
}
