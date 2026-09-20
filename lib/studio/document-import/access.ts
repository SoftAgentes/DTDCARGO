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
/**
 * Segundo interruptor: los documentos LIGADOS A UNA COMPRA (portal del cliente,
 * enlace del proveedor, estimados guardados). `DOCUMENT_IMPORT_ENABLED` sólo
 * enciende el cotizador anónimo; esto exige además `DOCUMENT_IMPORT_PORTAL_ENABLED`.
 *
 * Por qué van separados: en cuanto una compra tiene documento compartido, el
 * POST de `/p/[token]/packlist` responde 409 y el proveedor tiene que confirmar
 * desde el documento — y esa pantalla del proveedor todavía no existe. Encender
 * el portal hoy dejaría al proveedor sin ninguna vía para mandar su packing list.
 * El cotizador no toca compras, así que puede salir sin arrastrar ese riesgo.
 */
export function portalEnabled() {
  return process.env.DOCUMENT_IMPORT_ENABLED === "true" && process.env.DOCUMENT_IMPORT_PORTAL_ENABLED === "true";
}
export function requirePortalScope() {
  if (!portalEnabled()) throw new ImportHttpError(503,"portal_not_enabled","Cargar documentos en tus compras todavía no está disponible. Puedes completar los datos manualmente.");
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

/**
 * El documento dejó de estar vigente: venció, o su vencimiento no se puede leer.
 * Sólo un `null` explícito significa «no vence»; cualquier otro valor tiene que
 * poder interpretarse como fecha. `Date.parse` devuelve NaN ante basura y
 * `NaN <= Date.now()` es false, así que comparar sin comprobar convertiría lo
 * ilegible en «sin vencer» — al revés de la regla del módulo: lo que no se
 * entiende, se niega. Recibe `unknown` a propósito: una fila que ni siquiera
 * trajo la columna tampoco acredita vigencia.
 */
function noVigente(expiresAt: unknown): boolean {
  if (expiresAt === null) return false;
  const instante = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  return !Number.isFinite(instante) || instante <= Date.now();
}

/** Never authorize by a supplied tenant/client/markbox. Re-resolve the live principal/capability. */
export async function authorizeWorkspace(admin: SupabaseClient, session: SupabaseClient, workspace: WorkspaceRow, headers: Headers): Promise<ImportActor> {
  if (noVigente(workspace.expires_at)) return notFound();
  if (workspace.anonymous_hash) {
    const token = headers.get("x-document-token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token) || hashToken(token) !== workspace.anonymous_hash) return notFound();
    return {kind:"anonymous",id:workspace.id};
  }
  // Todo lo que no es anónimo es documento de compra: cliente o proveedor.
  requirePortalScope();
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
/** Peticiones por hora que puede gastar una identidad de red. */
const REQUEST_LIMIT = 120;
/**
 * Techo de la clase «sin IP resoluble». Es un pozo compartido, no el cupo de una
 * persona, y por eso es más alto: dimensionarlo como el de un solo visitante es
 * lo que deja que uno solo agote el de todos los demás irresolubles.
 */
const UNRESOLVED_LIMIT = REQUEST_LIMIT * 5;
/** Literal con el que `resolveRequestIp` dice que el borde no dejó IP confiable. */
const SIN_IP = "unknown";

export async function reserveRequest(db: SupabaseClient, headers: Headers) {
  const salt = process.env.DOCUMENT_IMPORT_RATE_SECRET;
  if (!salt || salt.length < 32) throw new ImportHttpError(503,"not_configured","La lectura de documentos todavía no está disponible.");
  const seudonimo = (valor: string) => createHmac("sha256",salt).update(valor).digest("hex");
  const ip = resolveRequestIp(headers);
  if (ip.trim().toLowerCase() !== SIN_IP) { await reserveLimit(db,`http:${seudonimo(ip)}`,1,REQUEST_LIMIT); return; }
  // Sin IP no hay identidad de red que aislar. La cadena de reenvío separa a los
  // que SÍ traen una distinta —dos proxies raros dejan de pisarse el cupo— pero
  // la escribe el visitante: una cadena nueva por petición sería cuota infinita.
  // Por eso, encima del cupo propio, toda la clase paga un techo común, y ese
  // techo es el tope del daño que puede hacer quien rota su cadena a propósito.
  const cadena = [headers.get("x-forwarded-for"),headers.get("x-real-ip")].map(v=>v?.trim()??"").filter(Boolean).join("|");
  if (cadena) await reserveLimit(db,`http:sin-ip:${seudonimo(cadena)}`,1,REQUEST_LIMIT);
  await reserveLimit(db,"http:sin-ip",1,UNRESOLVED_LIMIT);
}
