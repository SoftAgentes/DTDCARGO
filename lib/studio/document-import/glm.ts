import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  EXTRACTION_LIMITS, EXTRACTION_SYSTEM, ExtractionFailure, fail, isRecord, parseBoundedJson,
  parseIntermediate, safeInteger, spreadsheetEvidence, validateOptions,
  type Evidence, type ExtractionInput, type ExtractionOptions, type RequestOutcome,
} from "./extraction-contract";
import { requireGlmConfiguration, type GlmConfiguration } from "./provider";

const OCR_URL = "https://api.z.ai/api/paas/v4/layout_parsing";
const CHAT_URL = "https://api.z.ai/api/paas/v4/chat/completions";
export type PdfInspection = Readonly<{ sha256: string; pageCount: number; encrypted: false; complete: true }>;
export type UsageRequest = Readonly<{
  attemptId: string; sourceId: string; sha256: string; ocrPages: number; model: string;
  maxInputTokens: number; maxOutputTokens: number; maxOcrPagesPerDay: number;
}>;
export type UsageReservation = Readonly<{
  confirmed: true; attemptId: string; sha256: string; ocrPages: number; textTokens: number;
}>;
type PageSize = Readonly<{ width: number; height: number }>;
export type GlmDependencies = {
  fetch?: typeof fetch;
  /** Must persist quotas atomically before resolving. No in-memory production implementation in S1. */
  reserveUsage?: (request: UsageRequest, signal: AbortSignal) => Promise<UsageReservation>;
  /** A model-specific LOCAL counter/bound for this exact serialized request, not an unbudgeted API call. */
  countInputTokens?: (request: Readonly<{ model: string; body: string }>, signal: AbortSignal) => Promise<{
    model: string; inputTokens: number; method: "exact" | "upper_bound";
  }>;
  /** The future worker must stop parsing on abort; a flag/test double does not implement that guarantee. */
  pdfInspector?: {
    abortStopsWork: true;
    inspect: (bytes: Uint8Array, limits: Readonly<{ maxPages: number; signal: AbortSignal }>) => Promise<PdfInspection>;
  };
  /** Required reviewed protocol mapping: array position is NOT silently treated as a page number. */
  mapOcrPages?: (pages: readonly PageSize[], inspection: PdfInspection) => readonly number[];
  signal?: AbortSignal;
};
type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };

function usage(value: unknown): Usage {
  if (!isRecord(value) || !safeInteger(value.prompt_tokens) || !safeInteger(value.completion_tokens)
    || !safeInteger(value.total_tokens) || value.total_tokens < value.prompt_tokens + value.completion_tokens) {
    return fail("extraction_invalid", "received");
  }
  return { inputTokens: value.prompt_tokens, outputTokens: value.completion_tokens, totalTokens: value.total_tokens };
}

function readOcr(value: unknown, inspection: PdfInspection, mapPages: NonNullable<GlmDependencies["mapOcrPages"]>) {
  if (!isRecord(value) || Object.hasOwn(value, "error") || value.model !== "GLM-OCR" && value.model !== "glm-ocr"
    || typeof value.md_results !== "string" || value.md_results.length > EXTRACTION_LIMITS.textCharacters
    || !isRecord(value.data_info) || value.data_info.num_pages !== inspection.pageCount
    || !Array.isArray(value.data_info.pages) || value.data_info.pages.length !== inspection.pageCount
    || !Array.isArray(value.layout_details) || value.layout_details.length !== inspection.pageCount) {
    return fail("extraction_incomplete", "received");
  }
  const pages: PageSize[] = value.data_info.pages.map((page: unknown) => {
    if (!isRecord(page) || !safeInteger(page.width, 1, 100_000) || !safeInteger(page.height, 1, 100_000)) {
      return fail("extraction_invalid", "received");
    }
    return Object.freeze({ width: page.width, height: page.height });
  });
  const mapping = mapPages(Object.freeze(pages), inspection);
  if (!Array.isArray(mapping) || mapping.length !== inspection.pageCount || new Set(mapping).size !== inspection.pageCount
    || mapping.some(page => !safeInteger(page, 1, inspection.pageCount))) fail("extraction_incomplete", "received");
  const evidence: Evidence[] = [];
  let characters = value.md_results.length;
  for (const [pageIndex, blocks] of value.layout_details.entries()) {
    if (!Array.isArray(blocks) || !blocks.length || blocks.length > EXTRACTION_LIMITS.evidence) fail("extraction_incomplete", "received");
    const indexes = new Set<number>();
    let readable = false;
    for (const raw of blocks as unknown[]) {
      if (!isRecord(raw) || !safeInteger(raw.index, 0, 100_000) || indexes.has(raw.index)
        || !["text", "table", "formula", "image"].includes(raw.label as string)
        || typeof raw.content !== "string" || !Array.isArray(raw.bbox_2d) || raw.bbox_2d.length !== 4
        || raw.bbox_2d.some((n: unknown) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
        || raw.width !== pages[pageIndex].width || raw.height !== pages[pageIndex].height) fail("extraction_invalid", "received");
      const bbox = raw.bbox_2d as number[];
      if (bbox[0] > bbox[2] || bbox[1] > bbox[3]) fail("extraction_invalid", "received");
      indexes.add(raw.index);
      characters += raw.content.length;
      if (characters > EXTRACTION_LIMITS.textCharacters || evidence.length >= EXTRACTION_LIMITS.evidence) fail("extraction_invalid", "received");
      if (raw.label !== "image" && raw.content.trim()) readable = true;
      evidence.push({ id: `p${mapping[pageIndex]}b${raw.index}`, kind: "pdf", page: mapping[pageIndex],
        blockIndex: raw.index, label: raw.label as "text" | "table" | "formula" | "image",
        content: raw.content, bbox: [...bbox], width: pages[pageIndex].width, height: pages[pageIndex].height });
    }
    // An image URL or empty page is not proof of OCR coverage. No fetching or silent omission.
    if (!readable) fail("extraction_incomplete", "received");
  }
  return { evidence, markdown: value.md_results, usage: usage(value.usage) };
}

function readChat(value: unknown, model: string, maxInput: number, maxOutput: number) {
  if (!isRecord(value) || Object.hasOwn(value, "error") || value.model !== model
    || !Array.isArray(value.choices) || value.choices.length !== 1
    || (value.web_search !== undefined && (!Array.isArray(value.web_search) || value.web_search.length))) {
    return fail("extraction_invalid", "received");
  }
  const choice: unknown = value.choices[0];
  if (!isRecord(choice) || choice.index !== 0 || choice.finish_reason !== "stop") return fail("extraction_incomplete", "received");
  const message = choice.message;
  if (!isRecord(message) || message.role !== "assistant" || typeof message.content !== "string"
    || (message.tool_calls !== undefined && (!Array.isArray(message.tool_calls) || message.tool_calls.length))
    || message.function_call != null || (message.refusal != null && message.refusal !== "")) return fail("extraction_invalid", "received");
  const consumed = usage(value.usage);
  if (consumed.inputTokens > maxInput || consumed.outputTokens > maxOutput) return fail("token_limits", "received");
  return { value: parseBoundedJson(message.content, EXTRACTION_LIMITS.structuredBytes), usage: consumed };
}

/** Disconnected S1 transport. It has no env loader, job runner, persistence, UI or automatic retry. */
export async function extractWithGlm(input: ExtractionInput, options: ExtractionOptions,
  configuration: GlmConfiguration, dependencies: GlmDependencies) {
  requireGlmConfiguration(configuration);
  const settings = configuration.settings, source = validateOptions(options);
  if (!dependencies || typeof dependencies.reserveUsage !== "function" || typeof dependencies.countInputTokens !== "function") {
    return fail("configuration_missing");
  }
  if (!input || !["pdf", "spreadsheet"].includes(input.type)) return fail("invalid_metadata");
  if (input.type === "pdf" && (dependencies.pdfInspector?.abortStopsWork !== true
    || typeof dependencies.pdfInspector.inspect !== "function" || typeof dependencies.mapOcrPages !== "function")) {
    return fail("configuration_missing");
  }
  // Own snapshot prevents caller changes during inspector/quota awaits from changing submitted data.
  let bytes: Uint8Array | undefined, evidence: Evidence[] = [];
  if (input.type === "pdf") {
    if (!(input.bytes instanceof Uint8Array) || !input.bytes.length || input.bytes.length > EXTRACTION_LIMITS.fileBytes) return fail("file_size");
    bytes = new Uint8Array(input.bytes);
  } else evidence = spreadsheetEvidence(input);
  const sha256 = createHash("sha256").update(bytes ?? JSON.stringify(evidence)).digest("hex");
  const attemptId = randomUUID(); // Correlation only, never an assertion of billing idempotence.
  const controller = new AbortController();
  let sent = false, inFlight = false;
  const outcome = (): RequestOutcome => inFlight ? "uncertain" : sent ? "received" : "not_sent";
  const onExternalAbort = () => controller.abort();
  dependencies.signal?.addEventListener("abort", onExternalAbort, { once: true });
  if (dependencies.signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const signal = controller.signal;
  const ensureActive = () => { if (signal.aborted) fail("extraction_unavailable", outcome()); };
  const bounded = async <T>(operation: () => Promise<T>): Promise<T> => {
    ensureActive();
    let listener: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      listener = () => reject(new ExtractionFailure("extraction_unavailable", outcome()));
      signal.addEventListener("abort", listener, { once: true });
    });
    try {
      const result = await Promise.race([Promise.resolve().then(() => { ensureActive(); return operation(); }), aborted]);
      ensureActive();
      return result;
    } finally { if (listener) signal.removeEventListener("abort", listener); }
  };
  const discardBody = (response: Response) => { void response.body?.cancel().catch(() => undefined); };
  const post = async (url: typeof OCR_URL | typeof CHAT_URL, body: string): Promise<unknown> => {
    ensureActive();
    sent = true; inFlight = true;
    const pending = (dependencies.fetch ?? fetch)(url, {
      method: "POST", headers: { Authorization: configuration.authorization(), "Content-Type": "application/json", Accept: "application/json" },
      body, signal, redirect: "error", credentials: "omit", cache: "no-store",
    });
    void pending.then(response => { if (signal.aborted) discardBody(response); }, () => undefined);
    const response = await bounded(() => pending);
    if (response.status !== 200 || response.redirected) {
      discardBody(response);
      inFlight = false;
      if (response.status === 401 || response.status === 403) fail("configuration_invalid", "received");
      if (response.status === 429) fail("extraction_unavailable", "received");
      fail("extraction_unavailable", response.status >= 500 ? "uncertain" : "received");
    }
    const contentLength = response.headers.get("content-length");
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")
      || (contentLength !== null && (!/^[0-9]{1,10}$/.test(contentLength) || Number(contentLength) > EXTRACTION_LIMITS.responseBytes))
      || !response.body) {
      discardBody(response); inFlight = false;
      return fail("extraction_invalid", "received");
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await bounded(() => reader.read());
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > EXTRACTION_LIMITS.responseBytes) fail("extraction_invalid", "received");
        chunks.push(chunk.value);
      }
      inFlight = false;
      const all = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(all); }
      catch { return fail("extraction_invalid", "received"); }
      return parseBoundedJson(text, EXTRACTION_LIMITS.responseBytes);
    } finally {
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  };

  try {
    ensureActive();
    let inspection: PdfInspection | undefined;
    if (bytes) {
      const pdfBytes = bytes;
      const result = await bounded(() => dependencies.pdfInspector!.inspect(new Uint8Array(pdfBytes), { maxPages: settings.maxPages, signal }));
      if (!result || result.sha256 !== sha256 || result.encrypted !== false || result.complete !== true
        || !safeInteger(result.pageCount, 1, settings.maxPages)) fail("invalid_pdf");
      inspection = Object.freeze({ sha256, pageCount: result.pageCount, encrypted: false, complete: true });
    }
    const request: UsageRequest = Object.freeze({ attemptId, sourceId: source.sourceId, sha256,
      ocrPages: inspection?.pageCount ?? 0, model: settings.model, maxInputTokens: settings.maxInputTokens,
      maxOutputTokens: settings.maxOutputTokens, maxOcrPagesPerDay: settings.maxOcrPagesPerDay });
    const reservation = await bounded(() => dependencies.reserveUsage!(request, signal));
    if (!reservation || reservation.confirmed !== true || reservation.attemptId !== attemptId || reservation.sha256 !== sha256
      || reservation.ocrPages !== request.ocrPages || !safeInteger(reservation.textTokens, settings.maxInputTokens + settings.maxOutputTokens)) {
      return fail("token_limits");
    }
    let ocr: ReturnType<typeof readOcr> | undefined;
    if (bytes && inspection) {
      // Bare base64 follows the documented input type. Exact account behavior still needs a separate real acceptance.
      const response = await post(OCR_URL, JSON.stringify({ model: settings.ocrModel, file: Buffer.from(bytes).toString("base64"),
        return_crop_images: false, need_layout_visualization: false, start_page_id: 1, end_page_id: inspection.pageCount,
        request_id: `${attemptId}-ocr` }));
      ocr = readOcr(response, inspection, dependencies.mapOcrPages!);
      evidence = ocr.evidence;
    }
    const chatBody = JSON.stringify({ model: settings.model, stream: false, max_tokens: settings.maxOutputTokens,
      response_format: { type: "json_object" }, request_id: `${attemptId}-chat`, messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: JSON.stringify({ untrustedMetadata: { fileName: source.fileName, kind: source.kind },
          untrustedEvidence: evidence }) },
      ] });
    if (new TextEncoder().encode(chatBody).length > EXTRACTION_LIMITS.responseBytes) fail("token_limits", outcome());
    const count = await bounded(() => dependencies.countInputTokens!(Object.freeze({ model: settings.model, body: chatBody }), signal));
    if (!count || count.model !== settings.model || !["exact", "upper_bound"].includes(count.method)
      || !safeInteger(count.inputTokens, 1, settings.maxInputTokens)) fail("token_limits", outcome());
    const chat = readChat(await post(CHAT_URL, chatBody), settings.model, count.inputTokens, settings.maxOutputTokens);
    const extraction = parseIntermediate(chat.value, source, evidence);
    return { extraction, attemptId, provider: { name: "glm" as const, platform: settings.platform, model: settings.model },
      usage: { ocr: ocr?.usage ?? null, chat: chat.usage, reservedTextTokens: reservation.textTokens, ocrPages: request.ocrPages },
      ocr: ocr ? { markdown: ocr.markdown, pageCount: inspection!.pageCount } : null };
  } catch (error) {
    if (error instanceof ExtractionFailure) throw error;
    // Never propagate provider/dependency exception text, cause, body, request or key.
    throw new ExtractionFailure("extraction_unavailable", outcome());
  } finally {
    clearTimeout(timer);
    dependencies.signal?.removeEventListener("abort", onExternalAbort);
    controller.abort();
  }
}
