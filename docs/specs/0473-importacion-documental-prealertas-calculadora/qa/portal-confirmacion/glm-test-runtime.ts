import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { configureGlm } from "@/lib/studio/document-import/provider";
import { extractWithGlm } from "@/lib/studio/document-import/glm";
import type { GlmStage } from "@/lib/studio/document-import/glm";
import { draftFromExtraction } from "@/lib/studio/document-import/draft-from-extraction";
import { extractDocument, type ExtractionOptions } from "@/lib/studio/document-import/extract";
import { createTestLedger, type TestLedgerAdmission } from "./glm-test-ledger";
import { GLM_TEST_CANONICAL_LEDGER_ROOT } from "./extraction-config";

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
  // No top-level read. The caller must first validate the explicit GO and launch boundary.
  const configuration = await loadTestGlmConfiguration(dependencies.readCredential);
  const running = new Set<string>();
  const receipts = new Map<string, Pick<Awaited<ReturnType<typeof extractWithGlm>>, "attemptId" | "provider" | "usage">>();
  const extract = async (bytes: Uint8Array, options: ExtractionOptions, workspaceId: string, stage?: (stage: GlmStage) => void) => {
    const kind = admitTestInput(bytes, options.fileName);
    if (workspaceId !== admission.workspaceIds[kind] || running.has(workspaceId)) invalid();
    running.add(workspaceId);
    try {
      return await extractDocument(bytes, options, { nativeOnly: true, pdf: async (pdf, source) => {
        const result = await extractWithGlm({ type: "pdf", bytes: pdf }, source, configuration, {
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
        return draftFromExtraction(result.extraction, source);
      } });
    } finally { running.delete(workspaceId); }
  };
  return Object.freeze({ extract, receipt: (workspaceId: string) => receipts.get(workspaceId) ?? null, close: ledger.close, disclosure: Object.freeze({ provider: "GLM · Z.AI Standard", pdf: "OCR y lectura asistida", spreadsheet: "Lectura nativa sin IA", maxHttp: 3 }) });
}
