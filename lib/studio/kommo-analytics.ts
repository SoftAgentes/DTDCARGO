/**
 * Analítica read-only del espejo Kommo para el Tablero CRM (SDD-0078).
 *
 * Dos capas:
 *  - **Funciones PURAS** (testeadas): reciben arrays planos y devuelven objetos
 *    serializables (pasan server→client sin cruzar la frontera RSC). Hacen el
 *    diagnóstico de SDD-0062 (embudo, cementerio, cartera, conversión, email,
 *    contraste de valor) en vivo.
 *  - **Capa de queries** (`getKommoAnalytics`): orquesta las lecturas del espejo
 *    + el cruce con la plata real del ERP (`invoices` vía `clientAnnualBilling`).
 *
 * SOLO LECTURA: nunca muta Kommo ni el mirror. Sin migración.
 */

import { BILLING_UNAVAILABLE, BILLING_ZERO, billingNumber, sumAnnualBilling, type AnnualBilling, type AnnualBillingRead } from "@/lib/shared/annual-billing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnnualBilling } from "./fidelizacion/queries";
import { parseContactFields } from "./kommo-convert";
import {
  listKommoPipelines,
  listKommoStatuses,
  listKommoUsers,
} from "./kommo-queries";
import type { KommoPipelineRow, KommoStatusRow } from "./kommo-types";

/**
 * Estados de SISTEMA de Kommo (universales por cuenta, no por embudo):
 * 142 = "Logrado con éxito" (won), 143 = "Cerrado y no logrado" (lost).
 * Documentados por Kommo; el espejo los trae con esos IDs.
 */
export const KOMMO_WON_STATUS_ID = 142;
export const KOMMO_LOST_STATUS_ID = 143;

const DAY_MS = 86_400_000;

/** Lead liviano para analítica (subset de kommo_leads). */
export type AnalyticsLead = {
  id: number;
  status_id: number | null;
  pipeline_id: number | null;
  price: number;
  responsible_user_id: number | null;
  kommo_updated_at: string | null;
};

// ── Cementerio: antigüedad sin movimiento ──────────────────────
export type AgingBucket = {
  key: string;
  label: string;
  count: number;
  pct: number;
  tone: string;
};
export type AgingResult = {
  /** Leads con fecha de actualización válida (base del % y la mediana). */
  withDate: number;
  medianDays: number;
  buckets: AgingBucket[];
};

/**
 * Reparte los leads en buckets de antigüedad (días desde `kommo_updated_at`) y
 * calcula la mediana. Leads sin fecha válida se excluyen del cómputo. PURA.
 */
export function agingBuckets(
  leads: Pick<AnalyticsLead, "kommo_updated_at">[],
  nowMs: number,
): AgingResult {
  const days: number[] = [];
  const counts = { fresh: 0, d30: 0, d90: 0, d180: 0, d365: 0 };
  for (const l of leads) {
    if (!l.kommo_updated_at) continue;
    const t = Date.parse(l.kommo_updated_at);
    if (!Number.isFinite(t)) continue;
    const d = Math.max(0, Math.floor((nowMs - t) / DAY_MS));
    days.push(d);
    if (d < 30) counts.fresh++;
    else if (d < 90) counts.d30++;
    else if (d < 180) counts.d90++;
    else if (d < 365) counts.d180++;
    else counts.d365++;
  }
  const withDate = days.length;
  const pct = (n: number) => (withDate ? (n / withDate) * 100 : 0);

  let medianDays = 0;
  if (days.length) {
    const s = [...days].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    medianDays =
      s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  return {
    withDate,
    medianDays,
    buckets: [
      { key: "fresh", label: "< 30 días", count: counts.fresh, pct: pct(counts.fresh), tone: "var(--success)" },
      { key: "d30", label: "30–90 días", count: counts.d30, pct: pct(counts.d30), tone: "var(--info)" },
      { key: "d90", label: "90–180 días", count: counts.d90, pct: pct(counts.d90), tone: "var(--warning)" },
      { key: "d180", label: "180–365 días", count: counts.d180, pct: pct(counts.d180), tone: "var(--danger)" },
      { key: "d365", label: "> 365 días", count: counts.d365, pct: pct(counts.d365), tone: "var(--danger)" },
    ],
  };
}

// ── Salud del embudo principal ─────────────────────────────────
const STAGE_PALETTE = [
  "var(--wine)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--wine-soft)",
  "var(--ink-soft)",
];

export type FunnelStage = {
  id: number;
  name: string;
  count: number;
  pct: number;
  isBottleneck: boolean;
  tone: string;
};
export type FunnelResult = {
  pipelineId: number | null;
  pipelineName: string;
  total: number;
  stages: FunnelStage[];
};

/**
 * Distribución de leads por etapa del embudo PRINCIPAL (is_main; fallback al
 * primero). Marca el cuello (la etapa con más leads). PURA.
 */
export function funnelHealth(
  leads: AnalyticsLead[],
  pipelines: KommoPipelineRow[],
  statuses: KommoStatusRow[],
): FunnelResult {
  const main = pipelines.find((p) => p.is_main) ?? pipelines[0] ?? null;
  const pid = main?.id ?? null;
  if (pid == null) {
    return { pipelineId: null, pipelineName: "—", total: 0, stages: [] };
  }

  const stageRows = statuses
    .filter((s) => s.pipeline_id === pid)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const inPipe = leads.filter((l) => l.pipeline_id === pid);
  const total = inPipe.length;

  const countByStatus = new Map<number, number>();
  for (const l of inPipe) {
    if (l.status_id != null) {
      countByStatus.set(l.status_id, (countByStatus.get(l.status_id) ?? 0) + 1);
    }
  }

  let maxCount = 0;
  for (const s of stageRows) {
    const c = countByStatus.get(s.id) ?? 0;
    if (c > maxCount) maxCount = c;
  }

  const stages: FunnelStage[] = stageRows.map((s, i) => {
    const count = countByStatus.get(s.id) ?? 0;
    const isBottleneck = count === maxCount && count > 0;
    return {
      id: s.id,
      name: s.name ?? `Etapa #${s.id}`,
      count,
      pct: total ? (count / total) * 100 : 0,
      isBottleneck,
      tone: isBottleneck ? "var(--danger)" : STAGE_PALETTE[i % STAGE_PALETTE.length],
    };
  });

  return {
    pipelineId: pid,
    pipelineName: main?.name ?? `Embudo #${pid}`,
    total,
    stages,
  };
}

// ── Concentración de cartera por asesor ────────────────────────
export type OwnerSlice = {
  id: number | null;
  label: string;
  count: number;
  pct: number;
};
export type OwnershipResult = {
  total: number;
  /** Lista completa ordenada desc por cantidad de leads. */
  owners: OwnerSlice[];
  dominant: OwnerSlice | null;
};

/**
 * Reparto de leads por `responsible_user_id` (null → "Sin asignar"). Usa el mapa
 * `nameById` (espejo kommo_users, SDD-0087) para el nombre real del asesor;
 * fallback a "Asesor #id" si no está en el mapa (o el espejo está vacío). PURA.
 */
export function ownershipDistribution(
  leads: AnalyticsLead[],
  nameById: Map<number, string> = new Map(),
): OwnershipResult {
  const total = leads.length;
  const byOwner = new Map<number | null, number>();
  for (const l of leads) {
    byOwner.set(l.responsible_user_id, (byOwner.get(l.responsible_user_id) ?? 0) + 1);
  }
  const owners: OwnerSlice[] = [...byOwner.entries()]
    .map(([id, count]) => ({
      id,
      label:
        id == null ? "Sin asignar" : nameById.get(id) ?? `Asesor #${id}`,
      count,
      pct: total ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { total, owners, dominant: owners[0] ?? null };
}

// ── Conversión (estados de cierre de Kommo) ────────────────────
export type ConversionResult = {
  total: number;
  won: number;
  lost: number;
  closed: number;
  open: number;
  /** % del embudo que ya llegó a un estado final. Higiene, NO conversión. */
  closedRatePct: number;
  /** Ganados sobre el total, abiertos incluidos. Piso: aún puede subir. */
  wonRatePct: number;
  /**
   * ⭐ La conversión de verdad: ganados sobre los que **ya se decidieron**.
   *
   * Es la única de las tres que responde "de los que cerraron, ¿cuántos
   * ganamos?". Las otras dos meten en el denominador leads que todavía no
   * decidieron nada, así que se mueven solas cuando entran leads nuevos.
   *
   * 🔴 Existe porque el tablero mostraba `closedRatePct` con la etiqueta
   * "Conversión del CRM": el 2026-08-13 decía **96%** cuando la real era
   * **8,0%** (244 ganados de 3.040 cerrados). Un 96% de "conversión" en un
   * embudo con 2.796 perdidos es una cifra que se lee de lejos y es mentira.
   */
  wonOfClosedPct: number;
};

/** Conversión a partir de los estados de sistema (won 142 / lost 143). PURA. */
export function conversionStats(leads: AnalyticsLead[]): ConversionResult {
  const total = leads.length;
  let won = 0;
  let lost = 0;
  for (const l of leads) {
    if (l.status_id === KOMMO_WON_STATUS_ID) won++;
    else if (l.status_id === KOMMO_LOST_STATUS_ID) lost++;
  }
  const closed = won + lost;
  return {
    total,
    won,
    lost,
    closed,
    open: total - closed,
    closedRatePct: total ? (closed / total) * 100 : 0,
    wonRatePct: total ? (won / total) * 100 : 0,
    wonOfClosedPct: closed ? (won / closed) * 100 : 0,
  };
}

// ── Cobertura de email (contactos) ─────────────────────────────
export type EmailCoverageResult = { total: number; withEmail: number; pct: number };

/** % de contactos con email (parseado de custom_fields). PURA. */
export function emailCoverage(
  contacts: { custom_fields: unknown }[],
): EmailCoverageResult {
  const total = contacts.length;
  let withEmail = 0;
  for (const c of contacts) {
    if (parseContactFields(c.custom_fields).email) withEmail++;
  }
  return { total, withEmail, pct: total ? (withEmail / total) * 100 : 0 };
}

// ── Contraste de valor: Kommo ($0) vs ERP (facturado real) ─────
export type ValueContrastResult = {
  /** Suma de `price` de los leads en Kommo (≈$0 hoy: la ceguera de SDD-0062). */
  kommoPipelineValueUsd: number;
  /** Suma facturada trailing-12m (USD) de los leads ya convertidos a cliente. */
  erpBilledUsd: number | null;
  billing: AnnualBillingRead;
  convertedCount: number | null;
  convertedWithBilling: number | null;
};

/**
 * Contrasta el valor que ve Kommo (Σ price) contra la plata REAL del ERP de los
 * leads convertidos (cruce kommo_lead_id → markbox → facturación). PURA.
 */
export function valueContrast(
  leads: AnalyticsLead[],
  convertedMarkboxByLead: Record<number, string> | null,
  billingMap: Map<string, AnnualBilling> | null,
): ValueContrastResult {
  const kommo = leads.reduce((total, lead) => total + (lead.price || 0), 0);
  const keys = Object.values(convertedMarkboxByLead ?? {});
  const billing = convertedMarkboxByLead === null || billingMap === null ? BILLING_UNAVAILABLE
    : sumAnnualBilling(keys.map((key) => ({ key, billing: billingMap.get(key) ?? BILLING_ZERO })));
  return {
    kommoPipelineValueUsd: kommo,
    billing,
    erpBilledUsd: billingNumber(billing),
    convertedCount: convertedMarkboxByLead === null ? null : keys.length,
    convertedWithBilling: convertedMarkboxByLead === null || billingMap === null ? null : keys.filter((key) => {
      const value = billingMap.get(key) ?? BILLING_ZERO;
      return value.state === "completo" && value.subtotalUsd !== null && !value.subtotalUsd.startsWith("-") && value.subtotalUsd !== "0.00";
    }).length,
  };
}

// ── Capa de queries (impura) ───────────────────────────────────

const ANALYTICS_LEAD_COLUMNS =
  "id, status_id, pipeline_id, price, responsible_user_id, kommo_updated_at";

/** Tamaño de página. PostgREST no devuelve más de `db-max-rows` por request. */
const ANALYTICS_PAGE = 1000;
/** Tope de seguridad: 60 páginas = 60.000 filas. Hoy hay ~3.100. */
const ANALYTICS_MAX_PAGES = 60;

/** Resultado de una lectura paginada: las filas + si se pudo leer TODO. */
export type PagedRows<T> = { rows: T[]; complete: boolean };

/**
 * Lee una tabla del espejo COMPLETA, paginando con `.range()`.
 *
 * Por qué existe: PostgREST corta la respuesta en `db-max-rows` (1000 en
 * Supabase) y **un `.limit(5000)` no lo sortea** — devuelve 1000 y no avisa.
 * Como este módulo agrega en JS, una lectura corta no produce un error sino
 * algo peor: un tablero que miente con cara de verdad. El 2026-08-11 mostraba
 * "1.000 leads" de 3.145 reales, y el embudo, el cementerio de antigüedad, la
 * cartera por asesor y la conversión salían todos del 32% de los datos.
 *
 * Corte: **sólo** cuando una página vuelve VACÍA, y el avance es por la
 * cantidad realmente recibida — no por el tamaño pedido. Esto lo hace inmune
 * al tope del servidor: si `db-max-rows` fuera 500, pedir 1000 devolvería 500 y
 * un corte del tipo "vino menos de lo que pedí ⇒ terminé" volvería a truncar en
 * silencio, que es exactamente el bug que este helper existe para matar.
 * Cuesta un request extra (el último, vacío); es barato al lado de subcontar.
 *
 * Si se agotan las páginas antes de la vacía, devuelve `complete: false` en vez
 * de un número plausible — preferimos decir "no sé" a repetir el mismo error
 * con otro tope. El orden por `id` es estable (es parte de la PK); sin él la
 * paginación podría repetir o saltear filas.
 */
async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<PagedRows<T>> {
  const rows: T[] = [];
  let from = 0;
  for (let page = 0; page < ANALYTICS_MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + ANALYTICS_PAGE - 1);
    if (error) throw error;
    const batch = (data as T[] | null) ?? [];
    if (batch.length === 0) return { rows, complete: true };
    rows.push(...batch);
    from += batch.length;
  }
  return { rows, complete: false };
}

/** TODOS los leads del espejo (lean) para agregación en JS. RLS por tenant. */
export async function getAnalyticsLeads(
  supabase: SupabaseClient,
): Promise<PagedRows<AnalyticsLead>> {
  const { rows, complete } = await fetchAllRows<Record<string, unknown>>(
    supabase,
    "kommo_leads",
    ANALYTICS_LEAD_COLUMNS,
  );
  return {
    complete,
    rows: rows.map((r) => ({
      id: Number(r.id),
      status_id: r.status_id == null ? null : Number(r.status_id),
      pipeline_id: r.pipeline_id == null ? null : Number(r.pipeline_id),
      price: Number(r.price) || 0,
      responsible_user_id:
        r.responsible_user_id == null ? null : Number(r.responsible_user_id),
      kommo_updated_at: (r.kommo_updated_at as string | null) ?? null,
    })),
  };
}

/** custom_fields de TODOS los contactos (para la cobertura de email). */
export async function getContactEmailFlags(
  supabase: SupabaseClient,
): Promise<PagedRows<{ custom_fields: unknown }>> {
  return fetchAllRows<{ custom_fields: unknown }>(
    supabase,
    "kommo_contacts",
    "id, custom_fields",
  );
}

/**
 * `leadId → markbox` de TODOS los leads convertidos a cliente vivo. RLS por tenant.
 *
 * Pagina igual que `fetchAllRows` y por el mismo motivo — no puede reusarlo
 * porque lleva filtros. ⚠️ Este quedó con `.limit(5000)` cuando se paginaron
 * los otros dos: hoy no se nota porque hay 1 solo cliente convertido, pero es
 * el mismo bug esperando a que pasen de 1.000. Un tope que sólo miente cuando
 * el negocio crece es el peor de todos.
 */
export async function allConvertedLeads(
  supabase: SupabaseClient,
): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  let from = 0;
  for (let page = 0; page < ANALYTICS_MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("clients")
      .select("kommo_lead_id, markbox")
      .not("kommo_lead_id", "is", null)
      .is("deleted_at", null)
      .order("kommo_lead_id", { ascending: true })
      .range(from, from + ANALYTICS_PAGE - 1);
    if (error) throw new Error("Cruce de clientes no disponible");
    if (!Array.isArray(data)) throw new Error("Cruce de clientes no disponible");
    const batch = data as { kommo_lead_id: number; markbox: string }[];
    if (batch.length === 0) return map;
    for (const r of batch) {
      if (!Number.isSafeInteger(r.kommo_lead_id) || !r.markbox || typeof r.markbox !== "string" || Object.hasOwn(map, r.kommo_lead_id)) throw new Error("Cruce de clientes no disponible");
      map[r.kommo_lead_id] = r.markbox;
    }
    from += batch.length;
  }
  throw new Error("Cruce de clientes no disponible: lectura incompleta");
}

export type KommoDireccionData = {
  totals: { leads: number; contacts: number };
  conversion: ConversionResult;
  convertedCount: number | null;
  email: EmailCoverageResult;
  funnel: FunnelResult;
  aging: AgingResult;
  ownership: OwnershipResult;
  value: ValueContrastResult;
  /** leadId → markbox de TODOS los leads convertidos (para el worklist del asesor). */
  convertedMarkboxByLead: Record<number, string>;
  /** Incluye cero, subtotal parcial y error; nunca reemplaza ERP por precio Kommo. */
  valueByLead: Record<number, AnnualBillingRead>;
  /** Cruce completo: permite distinguir un no convertido de una identidad desconocida. */
  convertedAvailable: boolean;
  /** Lectura anual independiente del cruce de identidad. */
  billingAvailable: boolean;
  /**
   * `false` si la lectura del espejo se quedó corta (tope de páginas). Todo lo
   * de arriba sería entonces una MUESTRA, no el total — la UI tiene que decirlo
   * en vez de mostrar porcentajes que parecen ciertos.
   */
  complete: boolean;
};

/**
 * Orquestador del tablero Dirección: lee el espejo + cruza la plata del ERP y
 * corre las funciones puras. Una sola pasada de fetches (compartida con el
 * worklist del asesor vía `convertedMarkboxByLead` / `valueByLead`).
 *
 * Las funciones puras siempre estuvieron bien; lo que mentía era la LECTURA
 * (ver `fetchAllRows`). Ahora reciben el espejo completo, así que el embudo, el
 * cementerio, la cartera y la conversión son sobre el total, no sobre las
 * primeras 1000 filas.
 */
export async function getKommoAnalytics(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<KommoDireccionData> {
  const [leadsPage, contactsPage, pipelines, statuses, billing, converted, users] =
    await Promise.all([
      getAnalyticsLeads(supabase),
      getContactEmailFlags(supabase),
      listKommoPipelines(supabase),
      listKommoStatuses(supabase),
      clientAnnualBilling(supabase, now).catch(() => null),
      allConvertedLeads(supabase).catch(() => null),
      // Resiliente: si kommo_users no existe aún (gap deploy↔migración), cae a [].
      listKommoUsers(supabase).catch(() => []),
    ]);

  const leads = leadsPage.rows;
  const contacts = contactsPage.rows;

  // id→nombre del asesor (espejo kommo_users, SDD-0087). Vacío → "Asesor #id".
  const nameById = new Map<number, string>();
  for (const u of users) {
    const n = (u.name ?? "").trim();
    if (n) nameById.set(u.id, n);
  }

  const valueByLead: Record<number, AnnualBillingRead> = {};
  for (const [idStr, mb] of Object.entries(converted ?? {})) {
    valueByLead[Number(idStr)] = billing === null ? BILLING_UNAVAILABLE : billing.get(mb) ?? BILLING_ZERO;
  }

  return {
    totals: { leads: leads.length, contacts: contacts.length },
    conversion: conversionStats(leads),
    convertedCount: converted === null ? null : Object.keys(converted).length,
    email: emailCoverage(contacts),
    funnel: funnelHealth(leads, pipelines, statuses),
    aging: agingBuckets(leads, now.getTime()),
    ownership: ownershipDistribution(leads, nameById),
    value: valueContrast(leads, converted, leadsPage.complete ? billing : null),
    convertedMarkboxByLead: converted ?? {},
    valueByLead,
    convertedAvailable: converted !== null,
    billingAvailable: billing !== null,
    complete: leadsPage.complete && contactsPage.complete,
  };
}
