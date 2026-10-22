import { open, realpath, lstat, readFile, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { GlmDependencies, GlmDispatch, UsageRequest } from "@/lib/studio/document-import/glm";

export type TestLedgerAdmission = Readonly<{ canonicalRoot: string; goId: string }>;
export type CompletedCacheKey = Readonly<{ sha256: string; profile: string; context: string }>;
export class TestLedgerBlocked extends Error {
  readonly code = "qa_glm_dispatch_blocked";
  constructor() { super("El envío de prueba requiere revisión del registro persistente."); }
}
const blocked = (): never => { throw new TestLedgerBlocked(); };
export class TestCacheConflict extends Error {
  readonly code = "qa_glm_context_conflict";
  constructor(){super("La lectura conocida pertenece a otro contexto. Conserva el documento y solicita revisión; no se envió de nuevo.");}
}
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");

/** One GO, one durable pipeline. Guard files are NEVER deleted/reclaimed by this code.
 * The future GO must pin this canonical root for every process/rerun/profile. A different
 * root is a different authorization, never an automatic fallback. No secret/prompt in log.
 */
export async function createTestLedger(admission: TestLedgerAdmission) {
  if (!admission || !path.isAbsolute(admission.canonicalRoot) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{5,100}$/.test(admission.goId)) blocked();
  const root = await realpath(admission.canonicalRoot);
  if (path.resolve(root) !== path.resolve(admission.canonicalRoot) || !(await lstat(root)).isDirectory()) blocked();
  let global: FileHandle | undefined, input: FileHandle | undefined, log: FileHandle | undefined;
  let request: UsageRequest | undefined, inFlight: GlmDispatch | undefined, consumed = 0, closed = false, transitioning = false, usageObserved = false, completed = false;
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
      if (completed || usageObserved || consumed !== 3 || inFlight || !Number.isInteger(counts.tokenizer) || !Number.isInteger(counts.chat)
        || counts.tokenizer <= 0 || counts.chat < 0 || !Number.isSafeInteger(counts.outputTokens) || counts.outputTokens < 0
        || counts.tokenizer > 16384 || !Number.isSafeInteger(counts.chat)
        || counts.difference !== counts.chat - counts.tokenizer) blocked();
      usageObserved = true;
      try{await append({ state: "usage_observed", ...counts, consumed }, signal);}catch{closed=true;return blocked();}
    },
  };
  const cacheId=(key:CompletedCacheKey)=>{
    if(!key||![key.sha256,key.profile,key.context].every(value=>/^[a-f0-9]{64}$/.test(value)))blocked();
    return digest(JSON.stringify(key));
  };
  async function jsonFile(name:string){
    const file=path.join(root,name),metadata=await lstat(file);
    if(!metadata.isFile()||metadata.isSymbolicLink()||metadata.size>4*1024*1024)blocked();
    return JSON.parse(await readFile(file,"utf8")) as Record<string,unknown>;
  }
  /** Cache never grants a send. Missing/incompatible/partial evidence behind a guard fails closed. */
  async function readCompleted(key:CompletedCacheKey,signal:AbortSignal):Promise<unknown|null>{
    assertActive(signal);const id=cacheId(key);
    try{
      let guard:Record<string,unknown>|undefined;
      try{guard=await jsonFile("global-pipeline.guard");}
      catch(error){
        if((error as NodeJS.ErrnoException).code!=="ENOENT")return blocked();
        for(const name of ["global-dispatches.jsonl",`${key.sha256}.guard`]){
          try{await lstat(path.join(root,name));return blocked();}catch(found){if((found as NodeJS.ErrnoException).code!=="ENOENT")return blocked();}
        }
        assertActive(signal);return null;
      }
      if(!guard)blocked();
      const journalMeta=await lstat(path.join(root,"global-dispatches.jsonl"));
      if(!journalMeta.isFile()||journalMeta.isSymbolicLink()||journalMeta.size>1024*1024)blocked();
      const raw=await readFile(path.join(root,"global-dispatches.jsonl"),"utf8");
      if(!raw.endsWith("\n"))blocked();
      const events=raw.trimEnd().split("\n").map(line=>JSON.parse(line) as Record<string,unknown>);
      const last=events.at(-1),expected=["reserved","possibly_sent","received","possibly_sent","received","possibly_sent","received","usage_observed","completed"];
      if(events.length!==expected.length||events.some((event,index)=>event.state!==expected[index]||event.fence!==guard.fence||event.goId!==guard.goId||event.version!==1)
        ||last?.consumed!==3||guard.sha256!==key.sha256)blocked();
      for(const [index,stage] of (["ocr","tokenizer","chat"] as const).entries()){
        for(const position of [1+index*2,2+index*2]){const event=events[position];if(event.stage!==stage||event.consumed!==index+1||event.sha256!==key.sha256||event.attemptId!==guard.attemptId||event.correlationId!==`${guard.attemptId}-${stage}`)blocked();}
      }
      if(last.cacheId!==id||last.profile!==key.profile||last.context!==key.context)throw new TestCacheConflict();
      const cache=await jsonFile(`${key.sha256}.completed-${id}.json`);
      const dataText=JSON.stringify(cache.value);if(typeof dataText!=="string")blocked();
      if(cache.version!==1||cache.fence!==guard.fence||cache.cacheId!==id||cache.sha256!==key.sha256
        ||cache.profile!==key.profile||cache.context!==key.context||cache.dataSha256!==last.dataSha256
        ||digest(dataText)!==last.dataSha256)blocked();
      assertActive(signal);return cache.value;
    }catch(error){if(error instanceof TestCacheConflict)throw error;return blocked();}
  }
  async function writeCompleted(key:CompletedCacheKey,value:unknown,signal:AbortSignal){
    assertActive(signal);const id=cacheId(key);
    if(completed||!usageObserved||!request||key.sha256!==request.sha256||consumed!==3||inFlight||transitioning)blocked();
    completed=true;
    const serialized=JSON.stringify(value);if(typeof serialized!=="string"||Buffer.byteLength(serialized)>3*1024*1024)blocked();
    const dataSha256=digest(serialized);
    const file=await open(path.join(root,`${key.sha256}.completed-${id}.json`),"wx",0o600);
    try{await file.writeFile(JSON.stringify({version:1,fence,cacheId:id,...key,dataSha256,value}));await file.sync();assertActive(signal);}
    finally{await file.close();}
    await append({state:"completed",sha256:key.sha256,profile:key.profile,context:key.context,cacheId:id,dataSha256,consumed},signal);
  }
  return Object.freeze({ reserveUsage, tokenization, readCompleted, writeCompleted, close });
}
