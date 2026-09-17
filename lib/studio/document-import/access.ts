import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClientPrincipal, type PortalClientPrincipal } from "@/lib/portal/portal-queries";
import { getPrealertaIdsByToken } from "@/lib/studio/prealertas/queries";
import { resolveRequestIp } from "@/lib/http/request-ip";

export class ImportHttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type ImportActor = { kind: "client" | "supplier" | "anonymous"; id: string; principal?: PortalClientPrincipal };
export type WorkspaceRow = {
  id: string; tenant_id: string | null; client_id: string | null; prealerta_id: string | null;
  anonymous_hash: string | null; expires_at: string | null; draft: unknown; revision: number;
  confirmed_revision: number | null; confirmed_submission_id: string | null;
};
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const anonymousToken = () => randomBytes(32).toString("hex");
export function enabled() {
  if (process.env.DOCUMENT_IMPORT_ENABLED !== "true") throw new ImportHttpError(503,"not_configured","La lectura de documentos todavía no está disponible. Puedes completar los datos manualmente.");
}
export function notFound(): never { throw new ImportHttpError(404,"not_found","Documento no disponible."); }

export async function requirePortal(db: SupabaseClient): Promise<PortalClientPrincipal> {
  const principal = await getPortalClientPrincipal(db);
  if (!principal) throw new ImportHttpError(401,"login_required","Inicia sesión para acceder a tus compras o guardar el estimado.");
  return principal;
}

export async function purchaseForClient(db: SupabaseClient, principal: PortalClientPrincipal, purchaseId: string) {
  if (!UUID.test(purchaseId)) return notFound();
  const { data, error } = await db.from("prealertas").select("id,tenant_id,client_markbox,code,supplier_id,status")
    .eq("id",purchaseId).eq("tenant_id",principal.tenantId).eq("client_markbox",principal.client.markbox)
    .is("deleted_at",null).neq("status","cancelada").maybeSingle();
  if (error || !data) return notFound();
  return data as {id:string;tenant_id:string;client_markbox:string;code:string;supplier_id:string|null;status:string};
}

/** Never authorize by a supplied tenant/client/markbox. Re-resolve the live principal/capability. */
export async function authorizeWorkspace(admin: SupabaseClient, session: SupabaseClient, workspace: WorkspaceRow, headers: Headers): Promise<ImportActor> {
  if (workspace.expires_at && Date.parse(workspace.expires_at) <= Date.now()) return notFound();
  if (workspace.anonymous_hash) {
    const token = headers.get("x-document-token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token) || hashToken(token) !== workspace.anonymous_hash) return notFound();
    return {kind:"anonymous",id:workspace.id};
  }
  const shareToken = headers.get("x-supplier-token");
  if (shareToken) {
    if (!UUID.test(shareToken)) return notFound();
    const ids = await getPrealertaIdsByToken(admin,shareToken);
    if (!ids || ids.prealertaId !== workspace.prealerta_id || ids.tenantId !== workspace.tenant_id) return notFound();
    const {data:owner,error} = await admin.from("clients").select("id").eq("id",workspace.client_id)
      .eq("tenant_id",ids.tenantId).eq("markbox",ids.markbox).is("deleted_at",null).maybeSingle();
    if (error || !owner) return notFound();
    return {kind:"supplier",id:`supplier:${hashToken(shareToken).slice(0,24)}`};
  }
  const principal = await requirePortal(session);
  if (workspace.tenant_id !== principal.tenantId || workspace.client_id !== principal.client.id) return notFound();
  if (workspace.prealerta_id) await purchaseForClient(session,principal,workspace.prealerta_id);
  return {kind:"client",id:principal.userId,principal};
}

/** Bounded server-persisted quotas. Failure is never converted into allow. */
export async function reserveLimit(db: SupabaseClient, scope: string, units: number, limit: number, windowMs = 3600000) {
  const window = new Date(Math.floor(Date.now()/windowMs)*windowMs).toISOString();
  const {data,error} = await db.rpc("reserve_document_import_limit",{p_scope:scope,p_window:window,p_units:units,p_limit:limit});
  if (error) throw new ImportHttpError(503,"quota_unavailable","No pudimos verificar la capacidad de lectura. Intenta más tarde.");
  if (data !== true) throw new ImportHttpError(429,"quota_exceeded","Alcanzaste el límite de lectura. Conserva tus archivos e intenta más tarde.");
}
export async function reserveRequest(db: SupabaseClient, headers: Headers) {
  const salt = process.env.DOCUMENT_IMPORT_RATE_SECRET;
  if (!salt || salt.length < 32) throw new ImportHttpError(503,"not_configured","La lectura de documentos todavía no está disponible.");
  const key = createHmac("sha256",salt).update(resolveRequestIp(headers)).digest("hex");
  await reserveLimit(db,`http:${key}`,1,120);
}
