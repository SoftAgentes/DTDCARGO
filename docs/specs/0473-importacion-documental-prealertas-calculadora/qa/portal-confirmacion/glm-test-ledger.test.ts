// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTestLedger } from "./glm-test-ledger";
import type { GlmDispatch, GlmStage, UsageRequest } from "@/lib/studio/document-import/glm";

const roots: string[] = [], ledgers: Awaited<ReturnType<typeof createTestLedger>>[] = [];
const signal = () => new AbortController().signal;
const usage = (attemptId = "synthetic-attempt"): UsageRequest => ({ attemptId, sourceId: "synthetic-source", sha256: "a".repeat(64), ocrPages: 2, model: "glm-4.6", maxInputTokens: 16384, maxOutputTokens: 8192, maxOcrPagesPerDay: 2 });
const dispatch = (stage: GlmStage, attemptId = "synthetic-attempt"): GlmDispatch => ({ attemptId, sha256: "a".repeat(64), stage, correlationId: `${attemptId}-${stage}`, bodySha256: "b".repeat(64) });
async function ledger(root?: string, goId = "synthetic-go-01") {
  const directory = root ?? await mkdtemp(path.join(os.tmpdir(), "sdd0473-ledger-unit-")); if (!root) roots.push(directory);
  const instance = await createTestLedger({ canonicalRoot: directory, goId }); ledgers.push(instance); return { instance, root: directory };
}
afterEach(async () => { for (const l of ledgers.splice(0)) await l.close(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("S3 durable global ledger with fictitious isolated roots", () => {
  it("persists possibly_sent before releasing every stage, caps global dispatches at three", async () => {
    const { instance, root } = await ledger(); await instance.reserveUsage(usage(), signal());
    for (const stage of ["ocr", "tokenizer", "chat"] as const) {
      await instance.tokenization.beforeDispatch(dispatch(stage), signal());
      const lines = (await readFile(path.join(root, "global-dispatches.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(lines.at(-1)).toMatchObject({ state: "possibly_sent", stage, sha256: usage().sha256 });
      await instance.tokenization.received(dispatch(stage), signal());
    }
    await expect(instance.tokenization.beforeDispatch(dispatch("ocr"), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
    await instance.tokenization.observeUsage({ tokenizer: 1000, chat: 1200, difference: 200, outputTokens: 100, ocr: null }, signal());
    const raw = await readFile(path.join(root, "global-dispatches.jsonl"), "utf8"); expect(raw).not.toMatch(/Authorization|api.key|messages|supplier|filename/i);
  });
  it.each(["ocr", "tokenizer", "chat"] as const)("restart after possibly_sent %s cannot acquire another attempt, job or GO", async stop => {
    const first = await ledger(); await first.instance.reserveUsage(usage(), signal());
    for (const stage of ["ocr", "tokenizer", "chat"] as const) { await first.instance.tokenization.beforeDispatch(dispatch(stage), signal()); if (stage === stop) break; await first.instance.tokenization.received(dispatch(stage), signal()); }
    await first.instance.close();
    const second = await ledger(first.root, "synthetic-new-go");
    await expect(second.instance.reserveUsage({ ...usage("new-job-profile"), sourceId: "different-workspace-source" }, signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
  });
  it.each(["ocr", "tokenizer", "chat"] as const)("restart after received %s still cannot reset the global guard", async stop => {
    const first = await ledger(); await first.instance.reserveUsage(usage(), signal());
    for (const stage of ["ocr", "tokenizer", "chat"] as const) { await first.instance.tokenization.beforeDispatch(dispatch(stage), signal()); await first.instance.tokenization.received(dispatch(stage), signal()); if (stage === stop) break; }
    await first.instance.close(); const second = await ledger(first.root);
    await expect(second.instance.reserveUsage(usage("new-attempt"), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
  });
  it("truncated journal and elapsed time cannot clear the global or SHA guards", async () => {
    const first = await ledger(); await first.instance.reserveUsage(usage(), signal()); await first.instance.tokenization.beforeDispatch(dispatch("ocr"), signal()); await first.instance.close();
    await writeFile(path.join(first.root, "global-dispatches.jsonl"), '{"truncated":');
    const second = await ledger(first.root); await expect(second.instance.reserveUsage(usage(), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
    expect(await readFile(path.join(first.root, `${usage().sha256}.guard`), "utf8")).toContain("synthetic-attempt");
  });
  it("exclusive global reservation allows at most one concurrent pipeline for different SHA inputs", async () => {
    const first = await ledger(), second = await ledger(first.root);
    const outcomes = await Promise.allSettled([first.instance.reserveUsage(usage(), signal()), second.instance.reserveUsage({ ...usage("other"), sha256: "c".repeat(64) }, signal())]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  });
  it("late callbacks and competing stages are fenced after abort", async () => {
    const { instance } = await ledger(); const controller = new AbortController(); await instance.reserveUsage(usage(), controller.signal);
    await instance.tokenization.beforeDispatch(dispatch("ocr"), controller.signal);
    await expect(instance.tokenization.beforeDispatch(dispatch("tokenizer"), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
    controller.abort(); await expect(instance.tokenization.received(dispatch("ocr"), controller.signal)).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
    await expect(instance.tokenization.received(dispatch("ocr", "wrong-fence"), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
  });
  it("an existing journal or persistence failure prevents any dispatch reservation", async () => {
    const { instance, root } = await ledger(); await mkdir(path.join(root, "global-dispatches.jsonl"));
    await expect(instance.reserveUsage(usage(), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
    await expect(instance.tokenization.beforeDispatch(dispatch("ocr"), signal())).rejects.toMatchObject({ code: "qa_glm_dispatch_blocked" });
  });
});
