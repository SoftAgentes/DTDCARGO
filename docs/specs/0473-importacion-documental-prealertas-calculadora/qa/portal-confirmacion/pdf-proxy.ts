import type { IncomingMessage, ServerResponse } from "node:http";
import type { DocumentWorkspace } from "@/components/document-import/document-client";
import type { ConfirmedPdfInput, PdfSurface } from "@/lib/studio/document-import/pdf";

type Gate = Pick<ConfirmedPdfInput, "folio" | "versionNo" | "labels"> & { revision: number };
type Render = (input: ConfirmedPdfInput, surface: PdfSurface) => Promise<{ bytes: Uint8Array }>;
class ProxyError extends Error { constructor(public status: number, public code: string) { super(code); } }
const messages: Record<string,string> = {
  pdf_font_unavailable: "El PDF no está disponible: falta una fuente compatible en el servidor. Puedes usar la impresión existente.",
  revision_conflict: "El documento cambió. Carga la revisión vigente antes de descargar el PDF.",
  confirmation_required: "Confirma la revisión vigente antes de descargar el PDF.",
  labels_need_operations: "Las cajas físicas no coinciden con el documento. Contacta a DTD.",
};

/** Demo only: read the existing local authority; never reset its PostgreSQL or invent codes. */
export function createPdfProxy({ backend, markbox, render, request = fetch }: { backend: string; markbox: string; render: Render; request?: typeof fetch }) {
  const origin = new URL(backend);
  if (origin.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("PDF demo backend must be loopback");
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method !== "GET" || url.pathname !== "/api/document-import" || url.searchParams.get("action") !== "pdf") return false;
    const headers: Record<string,string> = {};
    for (const name of ["x-supplier-token", "x-document-token", "cookie"]) if (typeof req.headers[name] === "string") headers[name] = req.headers[name];
    res.setHeader("Cache-Control", "private, no-store");res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const id = url.searchParams.get("workspaceId") ?? "";
      const revision = Number(url.searchParams.get("expectedRevision") ?? NaN);
      const surface = url.searchParams.get("surface");
      if (!/^[a-f0-9-]{36}$/i.test(id) || !Number.isInteger(revision) || revision < 0 || (surface !== "labels" && surface !== "packing-list")) throw new ProxyError(400, "invalid_pdf_request");
      async function get<T>(action: string): Promise<T> {
        const target = new URL("/api/document-import", origin);
        target.search = new URLSearchParams({ action, workspaceId: id, expectedRevision: String(revision) }).toString();
        const response = await request(target.href, { headers, cache: "no-store" });
        if (!response.ok) { const error = await response.json().catch(() => ({})); throw new ProxyError(response.status, String(error.code ?? "unavailable")); }
        return await response.json() as T;
      }
      function check(w: DocumentWorkspace, gate: Gate) {
        if (w.id !== id || w.revision !== revision || w.confirmedRevision !== revision || gate.revision !== revision) throw new ProxyError(409, "revision_conflict");
      }
      const { workspace } = await get<{workspace:DocumentWorkspace}>("workspace");
      const gate = await get<Gate>("labels");check(workspace, gate);
      if (!gate.labels.length) throw new ProxyError(409, "confirmation_required");
      const code = gate.labels[0].code;
      const { bytes } = await render({ draft: workspace.draft, markbox, code, revision, folio: gate.folio, versionNo: gate.versionNo, labels: gate.labels }, surface);
      const latest = await get<{workspace:DocumentWorkspace}>("workspace");
      const current = await get<Gate>("labels");check(latest.workspace, current);
      if (current.folio !== gate.folio || current.versionNo !== gate.versionNo || JSON.stringify(current.labels) !== JSON.stringify(gate.labels)) throw new ProxyError(409, "revision_conflict");
      const file = `${surface === "labels" ? "Etiquetas" : "PackingList"}-${code.replace(/[^a-z0-9-]/gi,"_")}-Rev${revision}.pdf`;
      res.statusCode = 200;res.setHeader("Content-Type", "application/pdf");res.setHeader("Content-Disposition", `attachment; filename="${file}"`);res.end(Buffer.from(bytes));
    } catch (error) {
      const known = error as { status?: number; code?: string };
      const code = known.code && (messages[known.code] || known.code === "invalid_pdf_request") ? known.code : "unavailable";
      res.statusCode = code === "unavailable" ? 503 : known.status ?? 503;
      res.setHeader("Content-Type", "application/json");res.end(JSON.stringify({ code, error: messages[code] ?? "No pudimos generar el PDF. Conserva tus datos e intenta otra vez." }));
    }
    return true;
  };
}
