import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { configureGlm } from "@/lib/studio/document-import/provider";
import { extractWithGlm } from "@/lib/studio/document-import/glm";
import type { GlmStage } from "@/lib/studio/document-import/glm";
import { draftFromExtraction } from "@/lib/studio/document-import/draft-from-extraction";
import { extractDocument, type ExtractionOptions } from "@/lib/studio/document-import/extract";
import { createTestLedger, TestCacheConflict, TestLedgerBlocked, type TestLedgerAdmission } from "./glm-test-ledger";
import { GLM_TEST_CANONICAL_LEDGER_ROOT } from "./extraction-config";
import { parseDocumentDraft } from "@/lib/shared/document-import";
import { isRecord } from "@/lib/studio/document-import/extraction-contract";
import type { WorkspaceRow } from "@/lib/studio/document-import/access";
type TestOrigin=Pick<WorkspaceRow,"id"|"tenant_id"|"client_id"|"prealerta_id"|"anonymous_hash"|"revision">;

const PRIVATE_FILE = "C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test.env";
export const TEST_INPUTS = Object.freeze({
  pdf: Object.freeze({ bytes: 4855, sha256: "7fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e" }),
  xlsx: Object.freeze({ bytes: 8178, sha256: "f1867b0f4b2bdc7024700e502436a55e672e0276360a630e0b1e0db85e42c825" }),
});
export class GlmTestConfigurationError extends Error {
  readonly code = "qa_glm_configuration";
  constructor() { super("La conexión GLM de prueba requiere su configuración y autorización explícitas."); }
}
const invalid = (): never => { throw new GlmTestConfigurationError(); };
export function admitTestInput(bytes: Uint8Array, fileName: string) {
  const kind = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : invalid();
  const sha256 = createHash("sha256").update(bytes).digest("hex"), pin = TEST_INPUTS[kind];
  if (bytes.length !== pin.bytes || sha256 !== pin.sha256) invalid();
  return kind;
}

/** Called only by an explicitly admitted backend startup. Never loads process.env. */
export async function loadTestGlmConfiguration(reader: (file: string) => Promise<Uint8Array> = readFile) {
  try {
    const bytes = await reader(PRIVATE_FILE);
    if (bytes.byteLength > 16384) invalid();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const values: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = /^(DOCUMENT_IMPORT_GLM_API_KEY|DOCUMENT_IMPORT_GLM_MODEL)=(.*)$/.exec(line.trim());
      if (!match) continue;
      if (Object.hasOwn(values, match[1])) invalid();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[match[1]] = value;
    }
    const model = values.DOCUMENT_IMPORT_GLM_MODEL || "glm-4.6";
    if (model !== "glm-4.6") invalid();
    return configureGlm({ DOCUMENT_IMPORT_PROVIDER: "glm", DOCUMENT_IMPORT_GLM_PLATFORM: "zai-standard",
      DOCUMENT_IMPORT_GLM_API_KEY: values.DOCUMENT_IMPORT_GLM_API_KEY, DOCUMENT_IMPORT_GLM_MODEL: model,
      DOCUMENT_IMPORT_GLM_OCR_MODEL: "glm-ocr", DOCUMENT_IMPORT_GLM_PDF_MODE: "ocr_then_text",
      DOCUMENT_IMPORT_GLM_MAX_PAGES: "2", DOCUMENT_IMPORT_GLM_TIMEOUT_MS: "90000",
      DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS: "16384", DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS: "8192",
      DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY: "2" });
  } catch { return invalid(); }
}

/** These controls are backend launch inputs fixed by a later GO, never HTTP/client fields. */
export type GlmTestAdmission = TestLedgerAdmission & Readonly<{ workspaceIds: Readonly<{ pdf: string; xlsx: string }> }>;
export async function createGlmTestRuntime(admission: GlmTestAdmission, dependencies: {
  readCredential?: (file: string) => Promise<Uint8Array>; fetch?: typeof fetch;
} = {}) {
  if (admission.canonicalRoot !== GLM_TEST_CANONICAL_LEDGER_ROOT || !admission.workspaceIds.pdf || !admission.workspaceIds.xlsx || admission.workspaceIds.pdf === admission.workspaceIds.xlsx) invalid();
  const ledger = await createTestLedger(admission);
  // Native XLSX and known completed cache never require reading a credential.
  let configuration: ReturnType<typeof loadTestGlmConfiguration> | undefined;
  const configured=()=>configuration??(configuration=loadTestGlmConfiguration(dependencies.readCredential));
  const profile=createHash("sha256").update(JSON.stringify({goId:admission.goId,provider:"glm",platform:"zai-standard",model:"glm-4.6",ocr:"glm-ocr",input:16384,output:8192,pages:2})).digest("hex");
  const running = new Set<string>();
  const contextId=(source:ExtractionOptions,origin:TestOrigin)=>createHash("sha256").update(JSON.stringify({profile,origin:{id:origin.id,tenant:origin.tenant_id,client:origin.client_id,purchase:origin.prealerta_id,anonymous:origin.anonymous_hash,revision:origin.revision},kind:source.kind,fileName:source.fileName})).digest("hex");
  const receipts = new Map<string, Pick<Awaited<ReturnType<typeof extractWithGlm>>, "provider" | "usage"> & { attemptId: string }>();
  const extract = async (bytes: Uint8Array, options: ExtractionOptions, origin:TestOrigin, stage?: (stage: GlmStage) => void) => {
    const workspaceId=origin.id,revision=origin.revision;
    const kind = admitTestInput(bytes, options.fileName);
    if (workspaceId !== admission.workspaceIds[kind] || running.has(workspaceId) || !Number.isInteger(revision) || revision<0) invalid();
    running.add(workspaceId);
    try {
      return await extractDocument(bytes, options, { nativeOnly: true, pdf: async (pdf, source) => {
        const signal=new AbortController().signal;
        const key={sha256:TEST_INPUTS.pdf.sha256,profile,context:contextId(source,origin)};
        const known=await ledger.readCompleted(key,signal);
        if(known!==null){
          if(!isRecord(known)||!isRecord(known.receipt)||typeof known.receipt.attemptId!=="string"||!/^[a-f0-9-]{36}$/i.test(known.receipt.attemptId)||!isRecord(known.receipt.usage))return invalid();
          const u=known.receipt.usage;
          const counter=(value:unknown):number=>{if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)return invalid();return value;};
          const usage=(value:unknown)=>{if(!isRecord(value))return invalid();return{inputTokens:counter(value.inputTokens),outputTokens:counter(value.outputTokens),totalTokens:counter(value.totalTokens)};};
          const tokenizer=counter(u.tokenizerInputTokens),chat=usage(u.chat),ocr=u.ocr===null?null:usage(u.ocr);
          if(tokenizer<1||tokenizer>16384||chat.inputTokens>16384||chat.outputTokens>8192||u.ocrPages!==2||u.reservedTextTokens!==24576||u.tokenizerChatDifference!==chat.inputTokens-tokenizer)invalid();
          const draft=parseDocumentDraft(known.draft);
          if(draft.sources.length!==1||draft.sources[0].fileName!==source.fileName||draft.sources[0].kind!==source.kind)invalid();
          receipts.set(workspaceId,{attemptId:known.receipt.attemptId,provider:{name:"glm",platform:"zai-standard",model:"glm-4.6"},usage:{ocr,chat,ocrPages:2,reservedTextTokens:24576,tokenizerInputTokens:tokenizer,tokenizerChatDifference:chat.inputTokens-tokenizer}});
          return draft;
        }
        const result = await extractWithGlm({ type: "pdf", bytes: pdf }, source, await configured(), {
          fetch: dependencies.fetch, reserveUsage: ledger.reserveUsage, tokenization: { ...ledger.tokenization, async beforeDispatch(request, signal) {
            await ledger.tokenization.beforeDispatch(request, signal); if (!signal.aborted) stage?.(request.stage);
          } },
          pdfInspector: { abortStopsWork: true, async inspect(candidate, limits) {
            // Exact admitted fictitious document metadata, not a generic PDF parser/coverage claim.
            if (limits.signal.aborted || candidate.length !== TEST_INPUTS.pdf.bytes
              || createHash("sha256").update(candidate).digest("hex") !== TEST_INPUTS.pdf.sha256) invalid();
            return { sha256: TEST_INPUTS.pdf.sha256, pageCount: 2, encrypted: false, complete: true };
          } },
          // Reviewed protocol: outer layout_details/data_info.pages are pages in request order;
          // readOcr validates both lengths, num_pages and every block; block.index is not a page.
          mapOcrPages(pages, inspection) {
            if (inspection.sha256 !== TEST_INPUTS.pdf.sha256 || inspection.pageCount !== 2 || pages.length !== 2) invalid();
            return Object.freeze([1, 2]);
          },
        });
        receipts.set(workspaceId, { attemptId: result.attemptId, provider: result.provider, usage: result.usage });
        const draft=draftFromExtraction(result.extraction, source);
        await ledger.writeCompleted(key,{draft,receipt:receipts.get(workspaceId)},signal);
        return draft;
      } });
    } finally { running.delete(workspaceId); }
  };
  const failureCode=(error:unknown)=>error instanceof TestCacheConflict||error instanceof TestLedgerBlocked||error instanceof GlmTestConfigurationError?error.code:null;
  return Object.freeze({ extract, contextId, failureCode, receipt: (workspaceId: string) => receipts.get(workspaceId) ?? null, close: ledger.close, disclosure: Object.freeze({ provider: "GLM · Z.AI Standard", pdf: "OCR y lectura asistida", spreadsheet: "Lectura nativa sin IA", maxHttp: 3 }) });
}
