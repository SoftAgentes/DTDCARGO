import type { DocumentDraft } from "@/lib/shared/document-import";

export type DocumentLocale = "zh" | "es" | "en";
export const documentText = (locale: DocumentLocale, zh: string, es: string, en: string) => locale === "zh" ? zh : locale === "en" ? en : es;
export type DocumentWorkspace = { id: string; revision: number; draft: DocumentDraft; confirmedRevision: number | null; expiresAt: string | null };
export type DocumentReceipt = { revision: number; confirmed: boolean; folio?: string; versionNo?: number; submissionId?: string };
export type DocumentDownloadOptions = { format:"pdf"; surface:"packing-list"|"labels"; expectedRevision:number };
export class DocumentRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = "DocumentRequestError"; }
}
export type DocumentClient = {
  get<T>(action: string, params?: Record<string, string>): Promise<T>;
  post<T>(action: string, body?: Record<string, unknown>): Promise<T>;
  upload(url: string, file: File, contentType: string): Promise<void>;
  download(workspaceId: string, options?: DocumentDownloadOptions): Promise<Blob>;
  setAnonymousToken(token: string): void;
  id(): string;
};
/** Explicit transport injection is for tests/fixtures only. Runtime never substitutes fake data. */
export function createDocumentClient({ baseUrl = "", supplierToken, request = fetch }: { baseUrl?: string; supplierToken?: string; request?: typeof fetch } = {}): DocumentClient {
  let anonymousToken = "";
  const endpoint = baseUrl.replace(/\/$/, "") + "/api/document-import";
  const headers = () => ({ ...(supplierToken ? { "x-supplier-token": supplierToken } : {}), ...(anonymousToken ? { "x-document-token": anonymousToken } : {}) });
  async function response(action: string, params: Record<string, string> = {}, body?: Record<string, unknown>) {
    let result: Response;
    try { result = await request(endpoint + (body ? "" : "?" + new URLSearchParams({ action, ...params })), { method: body ? "POST" : "GET", credentials: "include", cache: "no-store", headers: { ...headers(), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify({ ...body, action }) } : {}) }); }
    catch { throw new DocumentRequestError(0, "network", "No se pudo confirmar la respuesta. Tus cambios siguen en pantalla."); }
    if (!result.ok) {
      const error = await result.json().catch(() => ({}));
      throw new DocumentRequestError(result.status, error.code ?? "unavailable", error.error ?? "No pudimos completar la operación.");
    }
    return result;
  }
  const json = async <T,>(result: Response): Promise<T> => { try { return await result.json() as T; } catch { throw new DocumentRequestError(0, "unconfirmed", "La respuesta no se pudo confirmar. Conserva tus cambios."); } };
  return {
    get: async <T,>(action: string, params?: Record<string, string>) => json<T>(await response(action, params)),
    post: async <T,>(action: string, body: Record<string, unknown> = {}) => json<T>(await response(action, {}, body)),
    upload: async (url, file, contentType) => {
      let result: Response;
      try { result = await request(url, { method: "PUT", credentials: "omit", headers: { "Content-Type": contentType }, body: file }); }
      catch { throw new DocumentRequestError(0, "upload_unconfirmed", "La recepción del archivo no está confirmada."); }
      if (!result.ok) throw new DocumentRequestError(result.status, "upload_failed", "No pudimos recibir el archivo.");
    },
    download: async (workspaceId,options) => {
      const result=await response(options?"pdf":"export",options?{workspaceId,surface:options.surface,expectedRevision:String(options.expectedRevision)}:{workspaceId});
      if(options && result.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/pdf")throw new DocumentRequestError(0,"invalid_pdf_response","No pudimos comprobar el PDF. Conserva tus datos y vuelve a intentarlo.");
      const blob=await result.blob();
      if(options && await blob.slice(0,5).text()!=="%PDF-")throw new DocumentRequestError(0,"invalid_pdf_response","No pudimos comprobar el PDF. Conserva tus datos y vuelve a intentarlo.");
      return blob;
    },
    setAnonymousToken: token => { anonymousToken = token; },
    id: () => crypto.randomUUID(),
  };
}
