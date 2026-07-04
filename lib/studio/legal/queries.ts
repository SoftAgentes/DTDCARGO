/**
 * Queries de la Capa Legal (SDD-0054 · Slices A/B + SDD-0067 · evidencia v2).
 *
 * Funciones que reciben un SupabaseClient y confían en RLS por tenant. Cubren:
 *   · currentClientDocs            = los docs vigentes de cara al cliente (gate).
 *   · listLegalDocs                = TODOS los docs (vigente + archivada), para el
 *                                    repositorio del admin (Slice B).
 *   · listAcceptances              = la bitácora de aceptaciones (orden desc).
 *   · hasValidAcceptance           = el GATE AUT-04 por client_id + quote_code.
 *   · hasValidAcceptanceForMarkbox = el MISMO gate, pero matcheando por
 *                                    client_markbox (Slice B: la factura no tiene
 *                                    client_id ni quote_code, solo el markbox).
 *   · getAcceptanceEvidence /      = expediente de UNA aceptación (fila completa
 *     listAcceptanceEvidenceByQuote  + hash recomputado + cliente) y de TODA una
 *                                    orden — para el export JSON + la vista
 *                                    imprimible (SDD-0067).
 *
 * Slice B (round-2 preservado): la validación de una FILA de aceptación
 * (tenant + hash load-bearing + docs vigentes + medida) vive en un único helper
 * privado `acceptanceRowValid`, usado por AMBOS gates → cero drift entre ellos.
 * v2: la canonización fila→evidencia + el recompute del hash viven en
 * `rowHashVerified`, compartido por los gates Y el export → una sola verdad.
 *
 * `numeric` de Supabase llega como string → se coerce a number en cada lectura.
 * `body`/`docs` (jsonb) pueden llegar como objeto ya parseado o como string.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  measureMatches,
  type DocRef,
  type LegalAcceptance,
  type LegalDoc,
  type LegalSection,
  type Measure,
} from "./types";
import { hashEvidence } from "./seal";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parsea un jsonb que puede venir como objeto ya parseado o como string. */
function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

const DOC_COLUMNS =
  "id, tenant_id, key, name, audience, version, effective_date, status, sections, change_note, body, created_at";

function coerceDoc(row: Record<string, unknown>): LegalDoc {
  return {
    ...(row as unknown as LegalDoc),
    sections: num(row.sections),
    body: parseJson<LegalSection[]>(row.body, []),
  };
}

/**
 * Documentos vigentes de cara al cliente (status=vigente · audience=cliente).
 * Son los que el cliente acepta en el estimado y los que entran al gate.
 *
 * `tenantId` (round-3 · m-6): REQUERIDO. Se filtra explícitamente por tenant — no
 * se confía solo en RLS (el gate corre como service_role, que la apaga). Si fuera
 * opcional, un caller que lo olvide corriendo con admin client recibiría las docs
 * vigentes de TODOS los tenants → `requiredVersions` envenenado (cross-tenant). El
 * typechecker fuerza pasarlo en cada call-site.
 */
export async function currentClientDocs(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<LegalDoc[]> {
  const tid = String(tenantId ?? "").trim();
  // Sin tenant no se puede acotar el set vigente → fail-closed (lista vacía).
  if (!tid) return [];

  const { data, error } = await supabase
    .from("legal_docs")
    .select(DOC_COLUMNS)
    .eq("status", "vigente")
    .eq("audience", "cliente")
    .eq("tenant_id", tid)
    .order("key", { ascending: true });

  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceDoc);
}

/**
 * TODOS los documentos legales del tenant — vigentes Y archivadas — para el
 * repositorio del admin (Slice B). Orden: `key` asc, luego `version` desc, así
 * cada doc agrupa sus versiones con la última arriba. NO filtra por audience ni
 * por status: el admin ve el histórico completo.
 *
 * `tenantId` (round-2): si se pasa, se filtra explícitamente por tenant.
 */
export async function listLegalDocs(
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<LegalDoc[]> {
  let q = supabase
    .from("legal_docs")
    .select(DOC_COLUMNS)
    .order("key", { ascending: true })
    .order("version", { ascending: false });

  const tid = String(tenantId ?? "").trim();
  if (tid) q = q.eq("tenant_id", tid);

  const { data, error } = await q;

  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceDoc);
}

const ACCEPTANCE_COLUMNS =
  "id, tenant_id, acceptance_code, client_id, client_markbox, quote_code, docs, cbm, weight_kg, total_usd, accepted_at, ip, user_agent, merchant_declaration, invoice_id, hash, idempotency_key, created_at";

function coerceAcceptance(row: Record<string, unknown>): LegalAcceptance {
  return {
    ...(row as unknown as LegalAcceptance),
    docs: parseJson<DocRef[]>(row.docs, []),
    cbm: numOrNull(row.cbm),
    weight_kg: numOrNull(row.weight_kg),
    total_usd: numOrNull(row.total_usd),
    user_agent: row.user_agent == null ? null : String(row.user_agent),
    merchant_declaration: row.merchant_declaration === true,
    invoice_id: row.invoice_id == null ? null : String(row.invoice_id),
  };
}

export type AcceptanceFilter = {
  /** client_id exacto. */
  client?: string;
  /** key de documento (ej 'tyc'): la aceptación debe incluirlo. */
  doc?: string;
  /** version exacta (ej 'v2.1'): combinada con `doc` o suelta. */
  version?: string;
};

/**
 * Bitácora de aceptaciones del tenant (orden desc por accepted_at). Filtra por
 * cliente en la query (indexado) y por doc/version en memoria (docs es jsonb).
 */
export async function listAcceptances(
  supabase: SupabaseClient,
  filter: AcceptanceFilter = {},
): Promise<LegalAcceptance[]> {
  let q = supabase
    .from("legal_acceptances")
    .select(ACCEPTANCE_COLUMNS)
    .order("accepted_at", { ascending: false })
    .limit(2000);

  if (filter.client) q = q.eq("client_id", filter.client);

  const { data, error } = await q;
  if (error) throw error;

  let rows = ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceAcceptance,
  );

  if (filter.doc || filter.version) {
    rows = rows.filter((a) =>
      a.docs.some(
        (d) =>
          (!filter.doc || d.key === filter.doc) &&
          (!filter.version || d.version === filter.version),
      ),
    );
  }

  return rows;
}

/**
 * Overview de la capa legal para las secciones de Administración (parity Norte):
 * versiones vigentes de cara al cliente (para marcar "stale") + KPIs de la
 * bitácora. Puro salvo la lectura del reloj para el KPI "este mes" (UTC).
 */
export function legalOverview(
  docs: LegalDoc[],
  acceptances: LegalAcceptance[],
): {
  currentVersions: Record<string, string>;
  kpis: { total: number; thisMonth: number; onCurrent: number };
} {
  const currentVersions: Record<string, string> = {};
  for (const d of docs) {
    if (d.status === "vigente" && d.audience === "cliente") {
      currentVersions[d.key] = d.version;
    }
  }

  const onCurrent = (refs: DocRef[]): boolean =>
    refs.length > 0 && refs.every((r) => currentVersions[r.key] === r.version);

  const now = new Date();
  const thisMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    currentVersions,
    kpis: {
      total: acceptances.length,
      thisMonth: acceptances.filter((a) =>
        (a.accepted_at ?? "").startsWith(thisMonthPrefix),
      ).length,
      onCurrent: acceptances.filter((a) => onCurrent(a.docs)).length,
    },
  };
}

export type GateQuery = {
  /**
   * Tenant explícito (round-2). NO se confía solo en RLS: el caller server-side
   * (Facturación, Slice B) corre como service_role, y `service_role using(true)`
   * apaga el aislamiento → sin este filtro, una aceptación de OTRO tenant con el
   * mismo `quote_code` evadiría el gate.
   */
  tenantId: string;
  clientId: string;
  quoteCode: string;
  cbm: number;
  weight: number;
  total: number;
  /** Tolerancia relativa de la medida (default 0 = exacta). Clamp server-side ≤ 0.02. */
  tol?: number;
};

/** Tope de tolerancia que el gate acepta del caller (round-2: no se confía en él). */
const MAX_GATE_TOL = 0.02;

/** Columnas que el gate necesita para recomputar el hash desde la fila (v2). */
const GATE_COLUMNS =
  "client_markbox, quote_code, docs, cbm, weight_kg, total_usd, ip, user_agent, merchant_declaration, accepted_at, hash";

/** Clampea la tolerancia que el caller pide a [0, MAX_GATE_TOL]. */
function clampGateTol(tol: number | undefined): number {
  return Math.min(
    Math.max(Number.isFinite(tol) ? (tol as number) : 0, 0),
    MAX_GATE_TOL,
  );
}

/**
 * Recompute del hash v2 desde una fila de `legal_acceptances` — ÚNICA
 * canonización fila→evidencia. La usan los gates (vía `acceptanceRowValid`) y
 * el export de evidencia (`getAcceptanceEvidence`/`listAcceptanceEvidenceByQuote`)
 * → la verificación que ve el abogado es EXACTAMENTE la que aplica el gate.
 *
 * - accepted_at: la DB (timestamptz) lo devuelve como `…+00:00`; el sello lo
 *   hasheó con `toISOString()` (`…000Z`). Canonizamos a la forma del sello para
 *   que el recompute matchee — sin esto TODA fila real fallaría el match.
 *   INVARIANTE (M-2 · round-3): `new Date(raw).toISOString()` produce
 *   MILISEGUNDOS. Esto SOLO reproduce el hash sellado si la fila guardó
 *   `accepted_at` en ms — lo que pasa si se selló EXPLÍCITO (ver seal.ts). Una
 *   fila con MICROsegundos (p.ej. por `default now()` en un seed/import) se
 *   truncaría a ms acá y NO matchearía → falso-negativo silencioso. Toda
 *   inserción debe sellar accepted_at vía el seal.
 * - user_agent (v2): se toma AS-IS de la fila (sin re-sanear) — el sello
 *   persiste exactamente lo que hasheó, así CUALQUIER tamper post-hoc del
 *   user_agent cambia el recompute y la fila se descarta (fail-closed).
 * - merchant_declaration (v2): boolean estricto (`=== true`); cualquier
 *   corrupción recomputa false → hash distinto → descartada.
 * - invoice_id NO participa (metadato forense fuera del hash).
 */
function rowHashVerified(raw: Record<string, unknown>): boolean {
  const docs = parseJson<DocRef[]>(raw.docs, []);
  const ip = raw.ip == null ? null : String(raw.ip);
  const userAgent = raw.user_agent == null ? null : String(raw.user_agent);
  const acceptedAtRaw = raw.accepted_at == null ? "" : String(raw.accepted_at);
  const acceptedAtDate = acceptedAtRaw ? new Date(acceptedAtRaw) : null;
  const acceptedAt =
    acceptedAtDate && !Number.isNaN(acceptedAtDate.getTime())
      ? acceptedAtDate.toISOString()
      : acceptedAtRaw;

  const recomputed = hashEvidence({
    client_markbox: String(raw.client_markbox ?? ""),
    quote_code: String(raw.quote_code ?? ""),
    docs,
    cbm: num(raw.cbm),
    weight_kg: num(raw.weight_kg),
    total_usd: num(raw.total_usd),
    ip,
    user_agent: userAgent,
    merchant_declaration: raw.merchant_declaration === true,
    accepted_at: acceptedAt,
  });
  return recomputed === String(raw.hash ?? "");
}

/**
 * ÚNICA validación de una fila de aceptación — la usan AMBOS gates
 * (`hasValidAcceptance` por client_id+quote_code y `hasValidAcceptanceForMarkbox`
 * por client_markbox), así no hay drift entre ellos. Round-2 íntegro:
 *
 *  (2) hash LOAD-BEARING — recomputa `hashEvidence` desde los campos de la PROPIA
 *      fila (`rowHashVerified`, v2: incluye user_agent + merchant_declaration) y
 *      lo compara con `row.hash`. Si no matchea ⇒ evidencia forjada/corrupta ⇒
 *      no vale.
 *  (3) docs vigentes — la aceptación debe cubrir TODAS las keys de cara al cliente
 *      en su versión vigente (`requiredVersions`). Re-versión ⇒ re-aceptación.
 *  (4) medida — la aceptada coincide con la vigente (`measureMatches`, `tol` ya
 *      clampeada por el caller).
 *
 * El filtro (1) tenant + el filtro por identidad (client_id / client_markbox +
 * quote_code) los aplica la query de cada gate ANTES de llegar acá.
 */
function acceptanceRowValid(
  raw: Record<string, unknown>,
  requiredVersions: Map<string, string>,
  current: Measure,
  tol: number,
): boolean {
  // (2) Hash load-bearing: recomputar desde la propia fila y comparar.
  if (!rowHashVerified(raw)) return false; // forjada/corrupta

  // (3) Docs vigentes: cubrir TODAS las keys de cliente en su versión vigente.
  const docs = parseJson<DocRef[]>(raw.docs, []);
  if (!coversCurrentDocs(docs, requiredVersions)) return false;

  // (4) Medida: la aceptada coincide con la vigente.
  const measure: Measure = {
    cbm: num(raw.cbm),
    weight_kg: num(raw.weight_kg),
    total_usd: num(raw.total_usd),
  };
  return measureMatches(measure, current, tol);
}

/**
 * GATE AUT-04 (bloqueo duro de Facturación, Slice B). Round-2: el hash es
 * LOAD-BEARING y el gate es ÍNTEGRO. Para que una aceptación cuente, TODO esto:
 *
 *  1. tenant explícito — `.eq("tenant_id", tenantId)` (no se confía en RLS:
 *     service_role la apaga). Sin esto, una aceptación de otro tenant con el
 *     mismo quote_code evadiría el gate.
 *  2. hash verificado — se recomputa `hashEvidence` desde los campos de la
 *     PROPIA fila y se compara con `row.hash`. Si no matchea ⇒ evidencia
 *     forjada/corrupta ⇒ se descarta (no cuenta).
 *  3. docs vigentes — la aceptación debe cubrir TODAS las keys de cara al
 *     cliente (`audience='cliente'`) en su VERSIÓN VIGENTE actual. Si se
 *     re-versionó un T&C (la versión aceptada ya no es la vigente) ⇒ se
 *     descarta: re-versión ⇒ re-aceptación.
 *  4. medida — la medida aceptada coincide con la vigente (`measureMatches`,
 *     `tol` clampeada server-side ≤ 0.02). Si difiere ⇒ re-aceptación.
 *
 * - true  → hay evidencia íntegra, vigente y atada a la medida real → la factura
 *           DDP puede emitirse.
 * - false → no hay aceptación, o es corrupta / de otro tenant / de una versión
 *           ya no vigente / con medida distinta → bloqueado.
 *
 * Sin tenantId, clientId o quoteCode ⇒ false (fail-closed).
 */
export async function hasValidAcceptance(
  supabase: SupabaseClient,
  query: GateQuery,
): Promise<boolean> {
  const tenantId = String(query.tenantId ?? "").trim();
  const clientId = String(query.clientId ?? "").trim();
  const quoteCode = String(query.quoteCode ?? "").trim();
  if (!tenantId || !clientId || !quoteCode) return false;

  // Versiones vigentes de cara al cliente que la aceptación DEBE cubrir.
  const vigentes = await currentClientDocs(supabase, tenantId);
  // Sin docs vigentes configuradas no hay nada que el cliente pudiera aceptar
  // de forma vinculante → fail-closed (no se puede acreditar evidencia válida).
  if (vigentes.length === 0) return false;
  const requiredVersions = new Map<string, string>(
    vigentes.map((d) => [d.key, d.version]),
  );

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(GATE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("quote_code", quoteCode)
    .order("accepted_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const current: Measure = {
    cbm: num(query.cbm),
    weight_kg: num(query.weight),
    total_usd: num(query.total),
  };
  const tol = clampGateTol(query.tol);

  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    if (acceptanceRowValid(raw, requiredVersions, current, tol)) return true;
  }

  return false;
}

export type GateByMarkboxQuery = {
  /** Tenant explícito (round-2). Mismo motivo que en GateQuery. */
  tenantId: string;
  /** MARKBOX denormalizado del cliente — lo que la factura SÍ tiene. */
  clientMarkbox: string;
  cbm: number;
  weight: number;
  total: number;
  /**
   * Referencia de la ORDEN puntual (round-3 · M-1). Cuando llega no-vacío, EXIGE
   * que la aceptación tenga `quote_code === orderRef` — así la aceptación queda
   * atada a ESTA orden, no solo a la terna (markbox, medida, total). Sin esto,
   * una aceptación es FUNGIBLE entre facturas distintas del mismo cliente que
   * casualmente compartan cbm+weight+base_amount (debilita "aceptó ESTA orden").
   *
   * Granularidad = la ORDEN (shipment_code), NO el invoice_id: dos facturas del
   * MISMO shipment (re-emisión) comparten aceptación (misma orden); facturas de
   * shipments DISTINTOS no. La action de Slice C sella `quote_code = shipment_code`
   * (o el invoice_code si no hubiera shipment). Para DDP el shipment SIEMPRE existe,
   * así que el caller de Facturación pasa `orderRef = invoice.shipment_code`.
   *
   * Si se omite (undefined/vacío) ⇒ comportamiento previo (match por terna): no
   * rompe la emisión non-DDP / sin shipment / sin shipment_code.
   */
  orderRef?: string;
  /** Tolerancia relativa de la medida (default 0). Clamp server-side ≤ 0.02. */
  tol?: number;
};

/**
 * GATE AUT-04 por MARKBOX (Slice B). Espeja TODA la seguridad de
 * `hasValidAcceptance` (round-2) pero matchea la aceptación por `client_markbox`
 * en vez de `client_id` + `quote_code` — porque la factura DDP NO tiene ni el
 * client_id ni el quote_code, solo el MARKBOX denormalizado + la medida (que
 * sale del shipment) + el total (base_amount, pre-IVA, comparable al total_usd
 * aceptado).
 *
 * Garantías preservadas (vía el helper compartido `acceptanceRowValid`):
 *   (1) tenant explícito `.eq("tenant_id", tenantId)` — no se confía solo en RLS.
 *   (2) hash LOAD-BEARING (recomputado desde la fila).
 *   (3) docs vigentes (cubre TODAS las keys de cliente en su versión vigente).
 *   (4) medida con `measureMatches` + `tol` clampeada ≤ 0.02.
 *   (5) ORDEN puntual (round-3 · M-1): si `query.orderRef` llega no-vacío, la
 *       aceptación DEBE tener ese `quote_code` (= shipment_code sellado). Cierra
 *       la fungibilidad cross-factura de una aceptación con la misma terna.
 *
 * Sin tenantId o clientMarkbox ⇒ false (fail-closed, sin tocar la DB).
 */
export async function hasValidAcceptanceForMarkbox(
  supabase: SupabaseClient,
  query: GateByMarkboxQuery,
): Promise<boolean> {
  const tenantId = String(query.tenantId ?? "").trim();
  const clientMarkbox = String(query.clientMarkbox ?? "").trim();
  if (!tenantId || !clientMarkbox) return false;

  const vigentes = await currentClientDocs(supabase, tenantId);
  if (vigentes.length === 0) return false; // fail-closed
  const requiredVersions = new Map<string, string>(
    vigentes.map((d) => [d.key, d.version]),
  );

  let q = supabase
    .from("legal_acceptances")
    .select(GATE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", clientMarkbox);

  // M-1: si el caller pasa la referencia de la ORDEN puntual, la aceptación DEBE
  // tener ese `quote_code` (sellado = shipment_code) — así no es fungible entre
  // facturas del mismo cliente con la misma terna. Vacío ⇒ match por terna (legacy).
  const orderRef = String(query.orderRef ?? "").trim();
  if (orderRef) q = q.eq("quote_code", orderRef);

  const { data, error } = await q
    .order("accepted_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const current: Measure = {
    cbm: num(query.cbm),
    weight_kg: num(query.weight),
    total_usd: num(query.total),
  };
  const tol = clampGateTol(query.tol);

  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    if (acceptanceRowValid(raw, requiredVersions, current, tol)) return true;
  }

  return false;
}

/**
 * ¿La aceptación cubre TODAS las keys de cara al cliente en su versión VIGENTE?
 * - cada key requerida (vigente) debe estar en `docs` con su versión vigente
 *   exacta. Versión aceptada ≠ vigente ⇒ false (re-versión ⇒ re-aceptación).
 * - keys extra en `docs` no molestan (puede haber docs históricas).
 */
function coversCurrentDocs(
  docs: DocRef[],
  required: Map<string, string>,
): boolean {
  const accepted = new Map<string, string>(
    docs.map((d) => [String(d.key), String(d.version)]),
  );
  for (const [key, version] of required) {
    if (accepted.get(key) !== version) return false;
  }
  return true;
}

// ════════════════════════════════════════════════════════════
// Export de evidencia (SDD-0067) · expediente para el abogado
// ════════════════════════════════════════════════════════════

/** Datos mínimos del cliente para el expediente (nombre + Shipping Mark). */
export type EvidenceClient = {
  id: string;
  name: string | null;
  markbox: string | null;
};

/**
 * Una aceptación lista para exportar: fila completa + verificación de
 * integridad recomputada server-side + datos del cliente.
 *
 * `hash_verified` usa el MISMO recompute que el gate (`rowHashVerified` →
 * `hashEvidence`): si acá dice true, el gate también la aceptaría como íntegra
 * (faltarían solo docs-vigentes + medida, que son vigencia, no integridad).
 */
export type AcceptanceEvidenceExport = {
  acceptance: LegalAcceptance;
  hash_verified: boolean;
  client: EvidenceClient | null;
};

/** Lookup best-effort del cliente (la evidencia se exporta aunque falte). */
async function evidenceClientFor(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string | null,
): Promise<EvidenceClient | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, name, markbox")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .maybeSingle<EvidenceClient>();
  return data ?? null;
}

/** Mapea una fila cruda a su export (coerce + recompute + cliente). */
async function toEvidenceExport(
  supabase: SupabaseClient,
  tenantId: string,
  raw: Record<string, unknown>,
): Promise<AcceptanceEvidenceExport> {
  const acceptance = coerceAcceptance(raw);
  return {
    acceptance,
    hash_verified: rowHashVerified(raw),
    client: await evidenceClientFor(supabase, tenantId, acceptance.client_id),
  };
}

/**
 * Expediente de UNA aceptación por su `acceptance_code` (AC-YYYY-NNNN), para el
 * export JSON y la vista imprimible. Tenant EXPLÍCITO (el caller admin corre con
 * sesión + RLS, pero no se confía solo en eso — mismo criterio round-2 de los
 * gates). null si no existe / vacíos (fail-closed).
 */
export async function getAcceptanceEvidence(
  supabase: SupabaseClient,
  args: { tenantId: string; code: string },
): Promise<AcceptanceEvidenceExport | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const code = String(args.code ?? "").trim();
  if (!tenantId || !code) return null;

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(ACCEPTANCE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("acceptance_code", code)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toEvidenceExport(supabase, tenantId, data as Record<string, unknown>);
}

/**
 * Expediente de TODA una orden: TODAS las aceptaciones cuyo `quote_code` es la
 * ref de la orden (= shipment_code que sella el Portal), orden desc. Para el
 * export por OPERACIÓN (`?quote=` del route handler). [] si vacíos (fail-closed).
 */
export async function listAcceptanceEvidenceByQuote(
  supabase: SupabaseClient,
  args: { tenantId: string; quoteCode: string },
): Promise<AcceptanceEvidenceExport[]> {
  const tenantId = String(args.tenantId ?? "").trim();
  const quoteCode = String(args.quoteCode ?? "").trim();
  if (!tenantId || !quoteCode) return [];

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(ACCEPTANCE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("quote_code", quoteCode)
    .order("accepted_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const out: AcceptanceEvidenceExport[] = [];
  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    out.push(await toEvidenceExport(supabase, tenantId, raw));
  }
  return out;
}
