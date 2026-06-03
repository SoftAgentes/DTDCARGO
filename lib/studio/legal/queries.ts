/**
 * Queries de la Capa Legal (SDD-0054 · Slice A).
 *
 * Funciones que reciben un SupabaseClient y confían en RLS por tenant. Cubren:
 *   · currentClientDocs   = los docs vigentes de cara al cliente (entran al gate).
 *   · listAcceptances     = la bitácora de aceptaciones (orden desc), filtrable.
 *   · hasValidAcceptance  = el GATE AUT-04: ¿existe una aceptación de este cliente
 *                           para esta cotización cuya MEDIDA matchee la vigente?
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
  "id, tenant_id, key, name, audience, version, effective_date, status, sections, body, created_at";

function coerceDoc(row: Record<string, unknown>): LegalDoc {
  return {
    ...(row as unknown as LegalDoc),
    sections: num(row.sections),
    body: parseJson<LegalSection[]>(row.body, []),
  };
}

/**
 * Documentos vigentes de cara al cliente (status=vigente · audience=cliente).
 * Son los que el cliente acepta en la cotización y los que entran al gate.
 *
 * `tenantId` (round-2): si se pasa, se filtra explícitamente por tenant — no se
 * confía solo en RLS (el gate corre como service_role, que la apaga; sin esto el
 * mapa de versiones vigentes mezclaría tenants).
 */
export async function currentClientDocs(
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<LegalDoc[]> {
  let q = supabase
    .from("legal_docs")
    .select(DOC_COLUMNS)
    .eq("status", "vigente")
    .eq("audience", "cliente")
    .order("key", { ascending: true });

  const tid = String(tenantId ?? "").trim();
  if (tid) q = q.eq("tenant_id", tid);

  const { data, error } = await q;

  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceDoc);
}

const ACCEPTANCE_COLUMNS =
  "id, tenant_id, acceptance_code, client_id, client_markbox, quote_code, docs, cbm, weight_kg, total_usd, accepted_at, ip, hash, idempotency_key, created_at";

function coerceAcceptance(row: Record<string, unknown>): LegalAcceptance {
  return {
    ...(row as unknown as LegalAcceptance),
    docs: parseJson<DocRef[]>(row.docs, []),
    cbm: numOrNull(row.cbm),
    weight_kg: numOrNull(row.weight_kg),
    total_usd: numOrNull(row.total_usd),
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

/** Columnas que el gate necesita para recomputar el hash desde la fila. */
const GATE_COLUMNS =
  "client_markbox, quote_code, docs, cbm, weight_kg, total_usd, ip, accepted_at, hash";

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
  const tol = Math.min(
    Math.max(Number.isFinite(query.tol) ? (query.tol as number) : 0, 0),
    MAX_GATE_TOL,
  );

  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    const docs = parseJson<DocRef[]>(raw.docs, []);
    const ip = raw.ip == null ? null : String(raw.ip);
    // accepted_at: la DB (timestamptz) lo devuelve como `…+00:00`; el sello lo hasheó
    // con `toISOString()` (`…000Z`). Canonizamos a la forma del sello para que el hash
    // recompute matchee — sin esto TODA fila real fallaría el match (el gate verde no
    // cubre la frontera con la DB real: el stub usaba el mismo formato a ambos lados).
    const acceptedAtRaw = raw.accepted_at == null ? "" : String(raw.accepted_at);
    const acceptedAtDate = acceptedAtRaw ? new Date(acceptedAtRaw) : null;
    const acceptedAt =
      acceptedAtDate && !Number.isNaN(acceptedAtDate.getTime())
        ? acceptedAtDate.toISOString()
        : acceptedAtRaw;
    const measure: Measure = {
      cbm: num(raw.cbm),
      weight_kg: num(raw.weight_kg),
      total_usd: num(raw.total_usd),
    };

    // (2) Hash load-bearing: recomputar desde la propia fila y comparar.
    const recomputed = hashEvidence({
      client_markbox: String(raw.client_markbox ?? ""),
      quote_code: String(raw.quote_code ?? ""),
      docs,
      cbm: measure.cbm,
      weight_kg: measure.weight_kg,
      total_usd: measure.total_usd,
      ip,
      accepted_at: acceptedAt,
    });
    if (recomputed !== String(raw.hash ?? "")) continue; // evidencia forjada/corrupta

    // (3) Docs vigentes: cubrir TODAS las keys de cliente en su versión vigente.
    if (!coversCurrentDocs(docs, requiredVersions)) continue;

    // (4) Medida: la aceptada coincide con la vigente.
    if (measureMatches(measure, current, tol)) return true;
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
