import { createHash } from "node:crypto";
import { parseBcvHtml } from "./bcv-parser";
import { BCV_MAX_BYTES, BCV_SOURCE_TIMEOUT_MS, BCV_URL, BcvError, type BcvObservation } from "./bcv-types";

/** Espera cooperativa hasta la señal del presupuesto, sin extenderlo por cleanup. */
async function cancellationWithinBudget(cancellation: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) { await Promise.race([cancellation, Promise.resolve()]); return; }
  await new Promise<void>(resolve => {
    const finish = () => { signal.removeEventListener("abort", finish); resolve(); };
    signal.addEventListener("abort", finish, { once: true });
    // Se observa también el productor si confirma después del aborto. La señal
    // no certifica terminación física de su cancel ni del servidor remoto.
    void cancellation.then(finish, finish);
  });
}

export async function cancelBcvBody(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<void> {
  if (body) await cancellationWithinBudget(body.cancel().catch(() => undefined), signal);
}

/** Cancela el reader también en streams de fixture que no están ligados a fetch. */
export async function readBcvBody(response: Response, signal: AbortSignal, maxBytes = BCV_MAX_BYTES): Promise<Uint8Array> {
  if (signal.aborted) { await cancelBcvBody(response.body, signal); throw new BcvError("DEADLINE"); }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || BigInt(length) > BigInt(maxBytes))) {
    await cancelBcvBody(response.body, signal);
    throw new BcvError("SOURCE_TOO_LARGE");
  }
  if (!response.body) throw new BcvError("SOURCE_INVALID");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let cancellation: Promise<void> | undefined;
  const cancel = () => { cancellation ??= reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw new BcvError("DEADLINE");
      const next = await reader.read();
      if (signal.aborted) throw new BcvError("DEADLINE");
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw new BcvError("SOURCE_TOO_LARGE");
      chunks.push(next.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return body;
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    await cancellationWithinBudget(cancellation!, signal);
    reader.releaseLock();
  }
}

function canonicalRedirect(location: string | null): string {
  if (!location) throw new BcvError("SOURCE_REDIRECT_REJECTED");
  let target: URL;
  try { target = new URL(location, BCV_URL); } catch { throw new BcvError("SOURCE_REDIRECT_REJECTED"); }
  if (target.protocol !== "https:" || target.hostname !== "www.bcv.org.ve" || target.port
    || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
    throw new BcvError("SOURCE_REDIRECT_REJECTED");
  }
  return target.href;
}

/** Una obtención, sin retries. Los redirects cuentan dentro de20s y del deadline padre. */
export async function fetchBcvObservation(options: {
  signal: AbortSignal;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}): Promise<BcvObservation> {
  const request = options.fetch ?? globalThis.fetch;
  const clock = options.now ?? (() => new Date());
  const controller = new AbortController();
  const sourceStopAt = performance.now() + BCV_SOURCE_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, BCV_SOURCE_TIMEOUT_MS);
  const signal = AbortSignal.any([options.signal, controller.signal]);
  const checkTime = () => {
    if (performance.now() >= sourceStopAt) { timedOut = true; controller.abort(); }
    if (signal.aborted) throw new BcvError("DEADLINE");
  };
  try {
    let url = BCV_URL;
    let redirects = 0;
    for (;;) {
      checkTime();
      const response = await request(url, { method: "GET", redirect: "manual", cache: "no-store",
        credentials: "omit", referrerPolicy: "no-referrer", signal,
        headers: { Accept: "text/html", "Cache-Control": "no-cache", Pragma: "no-cache" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        try {
          if (redirects >= 2) throw new BcvError("SOURCE_REDIRECT_REJECTED");
          url = canonicalRedirect(response.headers.get("location"));
          redirects++;
        } finally { await cancelBcvBody(response.body, signal); }
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      if (response.status !== 200 || !/^text\/html(?:\s*;|\s*$)/i.test(type)) {
        await cancelBcvBody(response.body, signal);
        throw new BcvError("SOURCE_UNAVAILABLE");
      }
      const body = await readBcvBody(response, signal);
      checkTime();
      let html: string;
      try { html = new TextDecoder("utf-8", { fatal: true }).decode(body); }
      catch { throw new BcvError("SOURCE_INVALID"); }
      const quote = parseBcvHtml(html);
      checkTime();
      return Object.freeze({ quote, retrievedAt: clock().toISOString(), bytes: body.byteLength,
        sha256: createHash("sha256").update(body).digest("hex") });
    }
  } catch (error) {
    if (options.signal.aborted) throw new BcvError("DEADLINE");
    if (timedOut) throw new BcvError("SOURCE_TIMEOUT");
    if (error instanceof BcvError) throw error;
    throw new BcvError("SOURCE_UNAVAILABLE");
  } finally { clearTimeout(timer); }
}
