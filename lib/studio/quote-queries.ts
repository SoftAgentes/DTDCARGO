/**
 * Helpers de query reutilizables para el módulo Cotizador (SDD-0011).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote, QuoteSource, QuoteStatus } from "./quote-types";
import { findRateForDestination } from "./destination-change";
import { normalizeEmail, prospectMatches } from "./estimado-linking";
import type { Rate } from "./rate-types";
import type { ShipmentService } from "./shipment-types";

export type QuoteFilters = {
  status?: QuoteStatus | "all";
  q?: string;
  clientMarkbox?: string;
  /**
   * SDD-0061: filtro por origen. `web_review` = estimados web SIN vincular
   * (cola "web · por revisar"); `web`/`studio` = por origen; default = todos.
   */
  source?: QuoteSource | "web_review" | "all";
};

const QUOTE_COLUMNS =
  "id, tenant_id, quote_code, client_markbox, client_name, service, origin, destination, cbm, weight_kg, boxes, packaging, rate_per_cbm, flat_rate, rate_used_id, subtotal_usd, packaging_cost, total_usd, status, valid_until, sent_at, accepted_at, converted_to_shipment_id, notes, prospect_name, prospect_email, prospect_whatsapp, nota, source, created_at, updated_at, deleted_at";

export async function listQuotes(
  supabase: SupabaseClient,
  filters: QuoteFilters = {},
): Promise<Quote[]> {
  let query = supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.clientMarkbox) {
    query = query.eq("client_markbox", filters.clientMarkbox);
  }

  // SDD-0061: cola de estimados web. `web_review` = web + sin vincular.
  if (filters.source && filters.source !== "all") {
    if (filters.source === "web_review") {
      query = query.eq("source", "web").is("client_markbox", null);
    } else {
      query = query.eq("source", filters.source);
    }
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `quote_code.ilike.%${q}%`,
        `client_name.ilike.%${q}%`,
        `client_markbox.ilike.%${q}%`,
        `origin.ilike.%${q}%`,
        `destination.ilike.%${q}%`,
        // SDD-0061: buscar estimados web por los datos del prospecto.
        `prospect_name.ilike.%${q}%`,
        `prospect_email.ilike.%${q}%`,
        `prospect_whatsapp.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Quote[] | null) ?? [];
}

export async function getQuoteByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("quote_code", code)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Quote | null) ?? null;
}

/**
 * Sugiere una rate del catálogo para (servicio, destino).
 * Wrapper sobre findRateForDestination — para que el QuoteDrawer
 * pueda llamar via server action sin importar Supabase client-side.
 */
export async function suggestRateForQuote(
  supabase: SupabaseClient,
  service: ShipmentService,
  destination: string,
): Promise<Rate | null> {
  if (!destination?.trim()) return null;
  return findRateForDestination(supabase, service, destination);
}

export function parseQuoteFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): QuoteFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const statusRaw = single("status");
  const status: QuoteFilters["status"] =
    statusRaw === "draft" ||
    statusRaw === "sent" ||
    statusRaw === "accepted" ||
    statusRaw === "rejected" ||
    statusRaw === "expired"
      ? statusRaw
      : "all";

  const sourceRaw = single("source");
  const source: QuoteFilters["source"] =
    sourceRaw === "web" || sourceRaw === "studio" || sourceRaw === "web_review"
      ? sourceRaw
      : "all";

  return {
    status,
    q: single("q") || undefined,
    clientMarkbox: single("client") || undefined,
    source,
  };
}

// ── SDD-0061 Fase B2 · vínculo estimado web ↔ cliente ────────────────────────
// Tres caminos al mismo objetivo (poblar quotes.client_markbox de un estimado
// `source='web'` sin vincular): por código EST- (Slice 1), por datos exactos
// (Slice 2) y manual desde el módulo (Slice 3). Idempotentes: solo tocan filas
// web sin markbox y vivas → re-correr no pisa un estimado ya vinculado.

/** Una fila mínima de estimado web sin vincular (para el matcheo por datos). */
type UnlinkedWebEstimateRow = {
  id: string;
  prospect_email: string | null;
  prospect_whatsapp: string | null;
};

/**
 * Slice 1 — vínculo por código `EST-XXXX`. Puebla client_markbox (y opcionalmente
 * el nombre real) del estimado web con ese código, solo si sigue sin vincular.
 * Devuelve true si vinculó algo. Pensado para el admin client del registro.
 */
export async function linkEstimateByCode(
  supabase: SupabaseClient,
  tenantId: string,
  estCode: string | null | undefined,
  markbox: string,
  clientName?: string | null,
): Promise<boolean> {
  const code = (estCode ?? "").trim();
  if (!code) return false;
  const { data, error } = await supabase
    .from("quotes")
    .update({
      client_markbox: markbox,
      ...(clientName ? { client_name: clientName } : {}),
    })
    .eq("tenant_id", tenantId)
    .eq("quote_code", code)
    .eq("source", "web")
    .is("client_markbox", null)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Slice 2 — vínculo automático por datos. Vincula los estimados web sin markbox
 * cuyo teléfono Y email calcen exacto con el contacto del registro. Devuelve los
 * códigos vinculados. Narrow por email en la DB (índice barato) + re-chequeo del
 * predicado completo en JS (teléfono por sufijo de dígitos).
 */
export async function linkEstimatesByContact(
  supabase: SupabaseClient,
  tenantId: string,
  contact: { email?: string | null; phone?: string | null },
  markbox: string,
  clientName?: string | null,
): Promise<string[]> {
  const email = normalizeEmail(contact.email);
  // Slice 2 exige ambos; sin email o sin teléfono no hay match por datos.
  if (!email || !(contact.phone ?? "").trim()) return [];

  const { data, error } = await supabase
    .from("quotes")
    .select("id, prospect_email, prospect_whatsapp")
    .eq("tenant_id", tenantId)
    .eq("source", "web")
    .is("client_markbox", null)
    .is("deleted_at", null)
    .ilike("prospect_email", email) // sin comodines = igualdad case-insensitive
    .limit(50);
  if (error) throw error;

  const matches = ((data as UnlinkedWebEstimateRow[] | null) ?? []).filter((q) =>
    prospectMatches(q, contact),
  );
  if (matches.length === 0) return [];

  const ids = matches.map((m) => m.id);
  const { data: updated, error: upErr } = await supabase
    .from("quotes")
    .update({
      client_markbox: markbox,
      ...(clientName ? { client_name: clientName } : {}),
    })
    .in("id", ids)
    .is("client_markbox", null) // backstop anti-race: no pisar uno ya vinculado
    .select("quote_code");
  if (upErr) throw upErr;
  return ((updated as { quote_code: string }[] | null) ?? []).map(
    (r) => r.quote_code,
  );
}

/**
 * Slice 3 — vínculo manual. El asesor ata un estimado web (por id) a un cliente
 * por MARKBOX. Valida que el cliente exista en el tenant y que el estimado siga
 * siendo web-sin-vincular; snapshotea el nombre real del cliente. Corre con el
 * client RLS del Studio (el asesor autenticado).
 */
export async function linkEstimateToClient(
  supabase: SupabaseClient,
  quoteId: string,
  markboxRaw: string,
): Promise<{ ok?: true; error?: string }> {
  const markbox = (markboxRaw ?? "").trim().toUpperCase();
  if (!markbox) return { error: "Indicá el MARKBOX del cliente." };

  // 1. El cliente debe existir (RLS filtra por tenant).
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("markbox, name")
    .eq("markbox", markbox)
    .is("deleted_at", null)
    .maybeSingle<{ markbox: string; name: string }>();
  if (cErr) return { error: "No pudimos validar el cliente." };
  if (!client) return { error: `No existe un cliente con MARKBOX ${markbox}.` };

  // 2. El estimado debe ser web y seguir sin vincular (defensa server-side).
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, source, client_markbox")
    .eq("id", quoteId)
    .maybeSingle<{ id: string; source: string; client_markbox: string | null }>();
  if (qErr || !quote) return { error: "Estimado no encontrado." };
  if (quote.source !== "web") {
    return { error: "Solo los estimados web se vinculan a un cliente." };
  }
  if (quote.client_markbox) {
    return { error: "Este estimado ya está vinculado a un cliente." };
  }

  // 3. Vincular + snapshot del nombre real.
  const { error: upErr } = await supabase
    .from("quotes")
    .update({ client_markbox: client.markbox, client_name: client.name })
    .eq("id", quoteId)
    .is("client_markbox", null);
  if (upErr) return { error: `No se pudo vincular: ${upErr.message}` };

  return { ok: true };
}
