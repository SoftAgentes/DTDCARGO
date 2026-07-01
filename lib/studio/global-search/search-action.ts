/**
 * searchGlobalAction — buscador global ⌘K del Studio (SDD-0135).
 *
 * Flujo (spec §4):
 *   1. Resolver rol del user (`getStudioRole`).
 *   2. Clasificar el término (monto / fecha / cédula-RIF / código / texto).
 *   3. Armar el set de facetas en scope según la clasificación.
 *   4. Filtrar por permiso derivado de la matriz RBAC (`canRunFacet`) →
 *      SOLO se ejecutan las queries permitidas. Fail-closed.
 *   5. Fan-out `Promise.all` reusando las `list*` queries con ilike + LIMIT 5.
 *   6. `locked` = facetas de dinero en scope que el rol NO puede correr
 *      (candado con nota) — derivado de la matriz, JAMÁS de tablas financieras.
 *
 * SEGURIDAD: la RLS filtra por tenant, no por rol → este gate es la única
 * defensa. Un rol sin módulo de dinero NUNCA invoca `listInvoices` /
 * `searchReceipts` (verificado con spy en el test).
 *
 * Reusa el patrón probado de `lib/studio/client-search-action.ts`.
 */

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";
import { getStudioRole } from "@/lib/studio/rbac-guard";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { normalizeCedula } from "@/lib/studio/person-types";
import { getClientByCedula, listClients } from "@/lib/studio/client-queries";
import { listShipments } from "@/lib/studio/shipment-queries";
import { listQuotes } from "@/lib/studio/quote-queries";
import { listInvoices } from "@/lib/studio/invoice-queries";
import { searchReceipts } from "@/lib/studio/payment-queries";

import { classifyTerm, facetForCode, parseAmount } from "./classify";
import {
  FACETS,
  MONEY_FACETS,
  canRunFacet,
  getFacet,
} from "./facets";
import type {
  GlobalSearchFacetId,
  GlobalSearchGroup,
  GlobalSearchHit,
  GlobalSearchResult,
  LockedFacet,
  SearchTermKind,
} from "./types";

/** Tope por faceta (anti-scraping + UX del ⌘K). */
const LIMIT = 5;

const ALL_FACETS: GlobalSearchFacetId[] = FACETS.map((f) => f.id);

/**
 * Facetas en scope según la clasificación del término. Determina QUÉ facetas
 * son relevantes (antes de filtrar por permiso). NO decide permiso.
 */
function facetsInScope(kind: SearchTermKind, term: string): GlobalSearchFacetId[] {
  switch (kind) {
    case "amount":
      // Monto → solo dinero (facturas y pagos).
      return [...MONEY_FACETS];
    case "date":
      // Fecha → entidades con fecha operativa/comercial.
      return ["shipments", "quotes", "invoices"];
    case "cedula":
      // Cédula/RIF → identidad del cliente.
      return ["clients"];
    case "code": {
      const target = facetForCode(term);
      return target ? [target] : ALL_FACETS;
    }
    case "text":
    default:
      return ALL_FACETS;
  }
}

// ── Runners por faceta ─────────────────────────────────────────
// Cada runner recibe (supabase, term, kind) y devuelve hits ya mapeados.
// La `href` es el deep-link a la página de detalle del módulo dueño.

async function runClients(
  supabase: SupabaseClient,
  term: string,
  kind: SearchTermKind,
): Promise<GlobalSearchHit[]> {
  const hits: GlobalSearchHit[] = [];
  const seen = new Set<string>();
  const push = (c: { id: string; markbox: string; name: string; rif: string | null }) => {
    if (seen.has(c.id) || hits.length >= LIMIT) return;
    seen.add(c.id);
    hits.push({
      facet: "clients",
      id: c.id,
      code: c.markbox,
      title: c.name,
      subtitle: c.rif ?? undefined,
      href: `/studio/clientes/${encodeURIComponent(c.markbox)}`,
    });
  };

  // Cédula-first: match exacto tolerante a formato al tope.
  if (kind === "cedula" && looksLikeCedula(normalizeCedula(term))) {
    const exact = await getClientByCedula(supabase, term);
    if (exact) push(exact);
  }
  const matches = await listClients(supabase, { q: term });
  for (const c of matches) push(c);
  return hits;
}

async function runShipments(
  supabase: SupabaseClient,
  term: string,
  kind: SearchTermKind,
): Promise<GlobalSearchHit[]> {
  const filters =
    kind === "date"
      ? { createdFrom: isoDate(term), createdTo: isoDate(term) }
      : { q: term };
  const rows = await listShipments(supabase, filters);
  return rows.slice(0, LIMIT).map((r) => {
    const s = r as {
      id: string;
      code: string;
      client_name: string | null;
      origin: string | null;
      destination: string | null;
    };
    return {
      facet: "shipments",
      id: s.id,
      code: s.code,
      title: s.client_name ?? s.code,
      subtitle: joinRoute(s.origin, s.destination),
      href: `/studio/tracking/${encodeURIComponent(s.id)}`,
    } satisfies GlobalSearchHit;
  });
}

async function runQuotes(
  supabase: SupabaseClient,
  term: string,
): Promise<GlobalSearchHit[]> {
  const rows = await listQuotes(supabase, { q: term });
  return rows.slice(0, LIMIT).map((q) => ({
    facet: "quotes",
    id: q.id,
    code: q.quote_code,
    title: q.client_name || q.prospect_name || q.quote_code,
    subtitle: joinRoute(q.origin, q.destination),
    href: `/studio/cotizador/${encodeURIComponent(q.quote_code)}`,
  }));
}

async function runInvoices(
  supabase: SupabaseClient,
  term: string,
  kind: SearchTermKind,
): Promise<GlobalSearchHit[]> {
  if (kind === "amount") {
    const amount = parseAmount(term);
    const rows = await listInvoices(supabase, {});
    const matched =
      amount == null
        ? []
        : rows.filter((i) => Math.abs(i.total_amount - amount) < 0.5);
    return matched.slice(0, LIMIT).map(invoiceHit);
  }
  const rows = await listInvoices(supabase, { q: term });
  return rows.slice(0, LIMIT).map(invoiceHit);
}

function invoiceHit(i: {
  id: string;
  invoice_code: string;
  client_name: string | null;
  total_amount: number;
  currency: string;
}): GlobalSearchHit {
  return {
    facet: "invoices",
    id: i.id,
    code: i.invoice_code,
    title: i.client_name ?? i.invoice_code,
    subtitle: `${i.currency} ${i.total_amount.toLocaleString("es-VE")}`,
    href: `/studio/facturacion/${encodeURIComponent(i.invoice_code)}`,
  };
}

async function runPayments(
  supabase: SupabaseClient,
  term: string,
  kind: SearchTermKind,
): Promise<GlobalSearchHit[]> {
  const opts =
    kind === "amount"
      ? { amount: parseAmount(term) ?? undefined, limit: LIMIT }
      : { q: term, limit: LIMIT };
  const rows = await searchReceipts(supabase, opts);
  return rows.map((r) => ({
    facet: "payments",
    id: r.id,
    code: r.receipt_code,
    title: r.client_name ?? r.receipt_code,
    subtitle: `${r.currency} ${r.amount.toLocaleString("es-VE")}`,
    href: `/studio/cobranzas/recibo/${encodeURIComponent(r.receipt_code)}`,
  }));
}

async function runFacet(
  supabase: SupabaseClient,
  facet: GlobalSearchFacetId,
  term: string,
  kind: SearchTermKind,
): Promise<GlobalSearchHit[]> {
  switch (facet) {
    case "clients":
      return runClients(supabase, term, kind);
    case "shipments":
      return runShipments(supabase, term, kind);
    case "quotes":
      return runQuotes(supabase, term);
    case "invoices":
      return runInvoices(supabase, term, kind);
    case "payments":
      return runPayments(supabase, term, kind);
    default:
      return [];
  }
}

/**
 * Buscador global. `scope` opcional restringe a una sola faceta (chip del modal);
 * si el rol no puede correrla, se ignora y cae al fan-out permitido.
 */
export async function searchGlobalAction(
  q: string,
  scope?: GlobalSearchFacetId,
): Promise<GlobalSearchResult> {
  const term = (q ?? "").trim();
  const kind = classifyTerm(term);
  if (term.length < 2) return { term, kind, groups: [], locked: [] };

  const supabase = await createClient();
  const role: StudioUserRole | null = await getStudioRole(supabase);

  // Scope del término → facetas relevantes; el chip lo estrecha a una.
  let scopeIds = facetsInScope(kind, term);
  if (scope && scopeIds.includes(scope)) scopeIds = [scope];

  // Candado: facetas de dinero en scope que el rol NO puede correr. Derivado
  // SOLO de la matriz (canRunFacet) — nunca se consulta una tabla financiera.
  const locked: LockedFacet[] = MONEY_FACETS.filter(
    (id) => scopeIds.includes(id) && !canRunFacet(role, getFacet(id)),
  ).map((facet) => ({ facet }));

  // Facetas que efectivamente se ejecutan: en scope Y permitidas.
  const toRun = scopeIds.filter((id) => canRunFacet(role, getFacet(id)));

  try {
    const results = await Promise.all(
      toRun.map(async (id) => ({
        facet: id,
        group: getFacet(id).group,
        hits: await runFacet(supabase, id, term, kind),
      })),
    );
    // Ordenar operativo → dinero (orden del registro FACETS), sin vacías.
    const order = new Map(FACETS.map((f, i) => [f.id, i]));
    const groups: GlobalSearchGroup[] = results
      .filter((g) => g.hits.length > 0)
      .sort((a, b) => (order.get(a.facet)! - order.get(b.facet)!));
    return { term, kind, groups, locked };
  } catch {
    return { term, kind, groups: [], locked, error: "No se pudo completar la búsqueda." };
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Igual heurística que client-search-action: dígitos suficientes para cédula/RIF. */
function looksLikeCedula(normalized: string): boolean {
  if (normalized.length < 5) return false;
  return normalized.replace(/[^0-9]/g, "").length >= 5;
}

/** dd/mm(/aaaa) → ISO YYYY-MM-DD (año actual si falta). Best-effort para filtros. */
function isoDate(term: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(term.trim());
  if (!m) return term;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  let yyyy = m[3];
  if (!yyyy) yyyy = String(new Date().getFullYear());
  else if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/** "origen → destino", o el que exista. undefined si ninguno. */
function joinRoute(origin?: string | null, destination?: string | null): string | undefined {
  if (origin && destination) return `${origin} → ${destination}`;
  return origin || destination || undefined;
}
