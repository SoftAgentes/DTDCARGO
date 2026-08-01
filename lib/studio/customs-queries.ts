/**
 * Queries del módulo Aduana SENIAT (SDD-0018).
 *
 * RLS filtra por tenant_id en filings y documents. Agents es catálogo
 * abierto a authenticated (active = true).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomsAgent,
  CustomsDocument,
  CustomsFiling,
  CustomsFilingRow,
  CustomsStatus,
} from "./customs-types";
import { filingTotal } from "./customs-types";

// ─────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────

export type CustomsFilters = {
  q?: string;
  port?: string;
  status?: CustomsStatus | "all";
  agentId?: string;
  /** Cuando tab=cleared, mostramos solo liberado; cuando tab=queue, todo lo demás. */
  bucket?: "queue" | "cleared" | "all";
};

const FILING_LIST_SELECT = `
  id, tenant_id, shipment_id, dua_code, port_code, agent_id, status,
  hs_codes, total_duty, igtf, iva, agent_fee, observations, alert,
  arrived_at, cleared_at, deleted_at, created_at, updated_at,
  agent:customs_agents!agent_id ( id, code, name, rating ),
  shipment:shipments!shipment_id ( id, code, client_name, client_markbox ),
  docs_uploaded:customs_documents!filing_id(count),
  docs_total:customs_documents!filing_id(count)
`;

const FILING_DETAIL_SELECT = `
  id, tenant_id, shipment_id, dua_code, port_code, agent_id, status,
  hs_codes, total_duty, igtf, iva, agent_fee, observations, alert,
  arrived_at, cleared_at, deleted_at, created_at, updated_at
`;

const DOC_COLUMNS =
  "id, tenant_id, filing_id, doc_type, uploaded, uploaded_at, uploaded_by, file_url, notes, created_at, updated_at";

const AGENT_COLUMNS =
  "id, code, name, rif, port_code, contact_name, phone, email, rating, shipments_count, active, notes, created_at";

const VALID_STATUSES: CustomsStatus[] = [
  "en_revision",
  "observacion",
  "liberacion",
  "pagado",
  "liberado",
];

// ─────────────────────────────────────────────────────────────
// Agents
// ─────────────────────────────────────────────────────────────

export async function listAgents(
  supabase: SupabaseClient,
): Promise<CustomsAgent[]> {
  const { data, error } = await supabase
    .from("customs_agents")
    .select(AGENT_COLUMNS)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as CustomsAgent[] | null) ?? [];
}

// ─────────────────────────────────────────────────────────────
// Filings list
// ─────────────────────────────────────────────────────────────

export async function listFilings(
  supabase: SupabaseClient,
  filters: CustomsFilters = {},
): Promise<CustomsFilingRow[]> {
  let query = supabase
    .from("customs_filings")
    .select(FILING_LIST_SELECT)
    .order("arrived_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.bucket === "queue") {
    query = query.neq("status", "liberado");
  } else if (filters.bucket === "cleared") {
    query = query.eq("status", "liberado");
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.port && filters.port.trim()) {
    query = query.eq("port_code", filters.port.trim());
  }

  if (filters.agentId && filters.agentId.trim()) {
    query = query.eq("agent_id", filters.agentId.trim());
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q
      .trim()
      .replace(/[,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    query = query.or(
      [`dua_code.ilike.%${q}%`, `observations.ilike.%${q}%`].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  // Normalizar joins de Supabase (agent + shipment vienen como arrays/objetos,
  // docs_uploaded como [{count}]).
  type RawRow = Omit<
    CustomsFilingRow,
    "agent" | "shipment" | "docs_uploaded" | "docs_total" | "total"
  > & {
    agent:
      | Pick<CustomsAgent, "id" | "code" | "name" | "rating">
      | Pick<CustomsAgent, "id" | "code" | "name" | "rating">[]
      | null;
    shipment:
      | { id: string; code: string; client_name: string | null; client_markbox: string | null }
      | { id: string; code: string; client_name: string | null; client_markbox: string | null }[]
      | null;
    docs_uploaded?: { count: number }[] | number;
    docs_total?: { count: number }[] | number;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  // Para docs_uploaded (count de uploaded=true) y docs_total (count total),
  // hicimos 2 selects sobre la misma relación pero PostgREST devuelve solo
  // 1 count (no filtra). Fallback: fetcheamos los docs en una sola query
  // adicional para todos los filings y agregamos en memoria.
  const filingIds = rows.map((r) => r.id);
  const docCounts = new Map<string, { uploaded: number; total: number }>();
  if (filingIds.length > 0) {
    const { data: docsAgg, error: docsErr } = await supabase
      .from("customs_documents")
      .select("filing_id, uploaded")
      .in("filing_id", filingIds);
    if (!docsErr && docsAgg) {
      for (const d of docsAgg as { filing_id: string; uploaded: boolean }[]) {
        const cur = docCounts.get(d.filing_id) ?? { uploaded: 0, total: 0 };
        cur.total += 1;
        if (d.uploaded) cur.uploaded += 1;
        docCounts.set(d.filing_id, cur);
      }
    }
  }

  return rows.map((r) => {
    const agent = Array.isArray(r.agent) ? r.agent[0] ?? null : r.agent;
    const shipment = Array.isArray(r.shipment)
      ? r.shipment[0] ?? null
      : r.shipment;
    const counts = docCounts.get(r.id) ?? { uploaded: 0, total: 0 };
    return {
      ...r,
      agent,
      shipment,
      docs_uploaded: counts.uploaded,
      docs_total: counts.total,
      total: filingTotal(r),
    } satisfies CustomsFilingRow;
  });
}

// ─────────────────────────────────────────────────────────────
// Filing detail (con documents)
// ─────────────────────────────────────────────────────────────

export async function getFilingDetailById(
  supabase: SupabaseClient,
  id: string,
): Promise<{
  filing: CustomsFiling;
  documents: CustomsDocument[];
  agent: CustomsAgent | null;
  shipment: {
    id: string;
    code: string;
    client_name: string | null;
    client_markbox: string | null;
    destination: string | null;
  } | null;
} | null> {
  const { data: filing, error: filingErr } = await supabase
    .from("customs_filings")
    .select(FILING_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (filingErr) {
    if (filingErr.code === "PGRST116") return null;
    throw filingErr;
  }
  if (!filing) return null;
  const f = filing as CustomsFiling;

  // Fetch documents + agent + shipment en paralelo
  const [docsResult, agentResult, shipmentResult] = await Promise.all([
    supabase
      .from("customs_documents")
      .select(DOC_COLUMNS)
      .eq("filing_id", id),
    f.agent_id
      ? supabase
          .from("customs_agents")
          .select(AGENT_COLUMNS)
          .eq("id", f.agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("shipments")
      .select("id, code, client_name, client_markbox, destination")
      .eq("id", f.shipment_id)
      .maybeSingle(),
  ]);

  if (docsResult.error) throw docsResult.error;

  return {
    filing: f,
    documents: (docsResult.data as CustomsDocument[] | null) ?? [],
    agent: (agentResult.data as CustomsAgent | null) ?? null,
    shipment:
      (shipmentResult.data as {
        id: string;
        code: string;
        client_name: string | null;
        client_markbox: string | null;
        destination: string | null;
      } | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Shipments elegibles para crear filing
// (in_customs + no tienen filing aún)
// ─────────────────────────────────────────────────────────────

export type EligibleShipment = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  destination: string | null;
  arrived_destination_at: string | null;
};

export async function listShipmentsEligibleForFiling(
  supabase: SupabaseClient,
): Promise<EligibleShipment[]> {
  // Shipments en estados aduanales sin filing
  const { data: shipments, error: shipErr } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, client_markbox, destination, arrived_destination_at",
    )
    .in("status", ["in_customs", "arrived_destination"])
    .order("arrived_destination_at", { ascending: false })
    .limit(100);

  if (shipErr) throw shipErr;
  const all = (shipments as EligibleShipment[] | null) ?? [];

  if (all.length === 0) return [];

  // Excluir los que ya tienen filing
  const { data: existingFilings } = await supabase
    .from("customs_filings")
    .select("shipment_id")
    .in(
      "shipment_id",
      all.map((s) => s.id),
    );

  const withFiling = new Set(
    ((existingFilings as { shipment_id: string }[] | null) ?? []).map(
      (f) => f.shipment_id,
    ),
  );

  return all.filter((s) => !withFiling.has(s.id));
}

// ─────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────

export type CustomsKpis = {
  inProcess: number;
  clearedYtd: number;
  totalPaidUsd: number;
  withAlert: number;
};

export async function computeCustomsKpis(
  supabase: SupabaseClient,
): Promise<CustomsKpis> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const [inProcessResult, clearedResult, alertResult, totalsResult] =
    await Promise.all([
      supabase
        .from("customs_filings")
        .select("id", { count: "exact", head: true })
        .neq("status", "liberado"),
      supabase
        .from("customs_filings")
        .select("id", { count: "exact", head: true })
        .eq("status", "liberado")
        .gte("cleared_at", yearStart.slice(0, 10)),
      supabase
        .from("customs_filings")
        .select("id", { count: "exact", head: true })
        .not("alert", "is", null),
      supabase
        .from("customs_filings")
        .select("total_duty, igtf, iva, agent_fee")
        .gte("created_at", yearStart)
        .limit(2000),
    ]);

  const totalPaidUsd = ((totalsResult.data as {
    total_duty: number | string;
    igtf: number | string;
    iva: number | string;
    agent_fee: number | string;
  }[] | null) ?? []).reduce(
    (sum, f) =>
      sum +
      Number(f.total_duty || 0) +
      Number(f.igtf || 0) +
      Number(f.iva || 0) +
      Number(f.agent_fee || 0),
    0,
  );

  return {
    inProcess: inProcessResult.count ?? 0,
    clearedYtd: clearedResult.count ?? 0,
    totalPaidUsd: Math.round(totalPaidUsd * 100) / 100,
    withAlert: alertResult.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Tax breakdown YTD
// ─────────────────────────────────────────────────────────────

export type TaxBreakdown = {
  duty: number;
  igtf: number;
  iva: number;
  agentFee: number;
  total: number;
};

export async function computeTaxBreakdownYtd(
  supabase: SupabaseClient,
): Promise<TaxBreakdown> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const { data, error } = await supabase
    .from("customs_filings")
    .select("total_duty, igtf, iva, agent_fee")
    .gte("created_at", yearStart)
    .limit(2000);

  if (error) throw error;

  const rows = (data as
    | { total_duty: number | string; igtf: number | string; iva: number | string; agent_fee: number | string }[]
    | null) ?? [];

  const duty = rows.reduce((s, r) => s + Number(r.total_duty || 0), 0);
  const igtf = rows.reduce((s, r) => s + Number(r.igtf || 0), 0);
  const iva = rows.reduce((s, r) => s + Number(r.iva || 0), 0);
  const agentFee = rows.reduce((s, r) => s + Number(r.agent_fee || 0), 0);

  return {
    duty: Math.round(duty * 100) / 100,
    igtf: Math.round(igtf * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    agentFee: Math.round(agentFee * 100) / 100,
    total: Math.round((duty + igtf + iva + agentFee) * 100) / 100,
  };
}

/** Ejecuta la liberación R3 gobernada de SDD-0228. */
export async function clearCustomsFilingGoverned(
  supabase: SupabaseClient,
  input: {
    filingId: string;
    effectiveDate: string;
    reason: string;
    requestRef: string;
  },
): Promise<"transitioned" | "replayed"> {
  const { data, error } = await supabase.rpc(
    "clear_customs_filing_governed",
    {
      p_filing_id: input.filingId,
      p_effective_date: input.effectiveDate,
      p_reason: input.reason,
      p_request_ref: input.requestRef,
    },
  );
  if (error) throw error;
  if (data !== "transitioned" && data !== "replayed") {
    throw new Error("Respuesta inválida de la liberación gobernada.");
  }
  return data;
}

// ─────────────────────────────────────────────────────────────
// parseFiltersFromSearchParams
// ─────────────────────────────────────────────────────────────

export function parseCustomsFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): CustomsFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const statusRaw = single("status");
  const status: CustomsFilters["status"] =
    statusRaw && VALID_STATUSES.includes(statusRaw as CustomsStatus)
      ? (statusRaw as CustomsStatus)
      : "all";

  const tabRaw = single("tab");
  const bucket: CustomsFilters["bucket"] =
    tabRaw === "cleared"
      ? "cleared"
      : tabRaw === "agents" || tabRaw === "tax"
        ? "all" // ignored, otros tabs no usan lista
        : "queue";

  return {
    q: single("q") || undefined,
    port: single("port") || undefined,
    status,
    agentId: single("agent") || undefined,
    bucket,
  };
}
