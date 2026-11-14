/** QA only: never return credentials or load .env files into a demo. */
export type QaExtractionConfig = { readonly pdfEnabled: boolean; readonly glmTest?: Readonly<{ canonicalRoot: string; goId: string }> };
export const DISABLED_QA_EXTRACTION: QaExtractionConfig = Object.freeze({ pdfEnabled: false });
/** Candidate authority root: must be explicitly admitted/provisioned by the later GO. */
export const GLM_TEST_CANONICAL_LEDGER_ROOT = "C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test-ledger";
export const QA_CASE_LINKS = Object.freeze({
  pdf: Object.freeze({ code: "DTD-DEMO-1-1", token: "55555555-5555-4555-8555-555555555555" }),
  xlsx: Object.freeze({ code: "DTD-DEMO-1-2", token: "77777777-7777-4777-8777-777777777777" }),
});
/** Closed fictitious identities, shared by redirects and database; no ordinal inference. */
export function qaCaseRoute(pathname: string) {
  for (const [kind, identity] of Object.entries(QA_CASE_LINKS)) {
    if (pathname === `/p/${identity.token}`) return { kind, page: "supplier" };
    if (pathname === `/portal/compras/${identity.code}/etiquetas`) return { kind, page: "labels" };
    if ([`/portal/compras/${identity.code}`, `/portal/compras/${identity.code}/documento`].includes(pathname)) return { kind, page: "client" };
  }
  return null;
}

export class QaExtractionConfigurationError extends Error {
  readonly code = "qa_extraction_configuration";
  constructor() {
    super("La lectura PDF de prueba requiere un proceso independiente y configuración explícita.");
    this.name = "QaExtractionConfigurationError";
  }
}

export function configureQaExtraction(
  env: Record<string, string | undefined>,
  options: { port: number; backend?: string },
): QaExtractionConfig {
  if (env.QA_GLM_TEST_ENABLED === "true") {
    if (options.port !== 4323 || options.backend !== undefined || env.QA_PDF_EXTRACTION_ENABLED === "true"
      || env.QA_GLM_TEST_LEDGER_ROOT !== GLM_TEST_CANONICAL_LEDGER_ROOT || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{5,100}$/.test(env.QA_GLM_TEST_GO ?? "")) throw new QaExtractionConfigurationError();
    delete env.ANTHROPIC_API_KEY; delete env.DOCUMENT_IMPORT_MODEL;
    return Object.freeze({ pdfEnabled: true, glmTest: Object.freeze({ canonicalRoot: env.QA_GLM_TEST_LEDGER_ROOT, goId: env.QA_GLM_TEST_GO! }) });
  }
  if (env.QA_PDF_EXTRACTION_ENABLED !== "true") {
    delete env.ANTHROPIC_API_KEY;
    delete env.DOCUMENT_IMPORT_MODEL;
    return DISABLED_QA_EXTRACTION;
  }
  if (!Number.isInteger(options.port) || options.port < 4322 || options.port > 65535 ||
    options.backend !== undefined || !env.ANTHROPIC_API_KEY?.trim() || !env.DOCUMENT_IMPORT_MODEL?.trim()) {
    throw new QaExtractionConfigurationError();
  }
  return Object.freeze({ pdfEnabled: true });
}

/** The constructor must come from the SAME SSR module as extractDocument. */
export function qaExtractionErrorCode(
  error: unknown,
  DocumentImportError: typeof import("@/lib/studio/document-import/extract").DocumentImportError,
): string {
  return error instanceof DocumentImportError ? error.code : "extraction_unavailable";
}
