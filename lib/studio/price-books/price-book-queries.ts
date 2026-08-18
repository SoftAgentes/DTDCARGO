/**
 * Queries de las listas de precios (SDD-0269).
 *
 * RLS filtra por tenant automáticamente — no se pasa tenant_id como parámetro.
 *
 * El punto de todo esto es `resolveRateForClient()`: dado un cliente, un
 * servicio y un destino, devuelve el precio que le toca A ÉL — su tarifa propia
 * si su aliado pactó una, la de la casa con su descuento si pactó un %, o la de
 * la casa a secas si es cliente directo. Un solo lugar decide; el cotizador
 * pregunta y muestra.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Rate } from "../rate-types";
import type { ShipmentService } from "../shipment-types";
import {
  aplicarDescuento,
  type PriceBook,
  type PriceBookOption,
  type TarifaResuelta,
} from "./price-book-types";

const BOOK_COLUMNS =
  "id, tenant_id, aliado_id, name, is_house, discount_pct, base_per_cbm, notes, created_at, updated_at, deleted_at";

// Mismas columnas que usa el módulo Tarifas, más la lista. Ver el comentario de
// lib/studio/rate-queries.ts sobre por qué las columnas del cron NO van acá.
const RATE_COLUMNS =
  "id, tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_from, valid_until, is_public, status, notes, price_book_id, created_at, updated_at, deleted_at";

/** Todas las listas vivas del tenant, con su conteo de tarifas y su insignia. */
export async function listPriceBooks(
  supabase: SupabaseClient,
): Promise<PriceBookOption[]> {
  const { data, error } = await supabase
    .from("price_books")
    .select(`${BOOK_COLUMNS}, aliados(prefix), rates(count)`)
    .is("deleted_at", null)
    // ⚠️ El `deleted_at` del embed va EXPLÍCITO, no se hereda del de arriba.
    // La RLS de `rates` ya excluye las borradas para un usuario del Studio, así
    // que sin esta línea el conteo *parece* correcto — hasta que lo lee un
    // camino con service_role, que salta RLS y devuelve las borradas también.
    // Medido contra prod el 2026-08-18: 8 sin el filtro, 4 con él. El número
    // que se muestra en la ficha del aliado no puede depender de qué rol lo pida.
    .is("rates.deleted_at", null)
    .order("is_house", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;

  type Fila = PriceBook & {
    aliados: { prefix: string } | { prefix: string }[] | null;
    rates: { count: number }[] | null;
  };

  return ((data as Fila[] | null) ?? []).map((b) => {
    const aliado = Array.isArray(b.aliados) ? b.aliados[0] : b.aliados;
    return {
      id: b.id,
      name: b.name,
      isHouse: b.is_house,
      discountPct: b.discount_pct != null ? Number(b.discount_pct) : null,
      basePerCbm: b.base_per_cbm != null ? Number(b.base_per_cbm) : null,
      aliadoId: b.aliado_id,
      aliadoPrefix: aliado?.prefix ?? null,
      tarifas: b.rates?.[0]?.count ?? 0,
    };
  });
}

/** La lista de la casa: el fallback de todo el sistema. */
export async function getHousePriceBook(
  supabase: SupabaseClient,
): Promise<PriceBook | null> {
  const { data, error } = await supabase
    .from("price_books")
    .select(BOOK_COLUMNS)
    .eq("is_house", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as PriceBook | null) ?? null;
}

/** La lista de un aliado, si tiene una propia. */
export async function getPriceBookByAliado(
  supabase: SupabaseClient,
  aliadoId: string,
): Promise<PriceBook | null> {
  const { data, error } = await supabase
    .from("price_books")
    .select(BOOK_COLUMNS)
    .eq("aliado_id", aliadoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as PriceBook | null) ?? null;
}

export async function getPriceBookById(
  supabase: SupabaseClient,
  id: string,
): Promise<PriceBook | null> {
  const { data, error } = await supabase
    .from("price_books")
    .select(BOOK_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as PriceBook | null) ?? null;
}

/**
 * La lista que le toca a un cliente. La decisión vive en SQL
 * (`resolve_price_book`, migr 0382) porque sube la jerarquía de aliados hasta la
 * raíz — replicar ese recorrido acá sería tener dos copias de la misma regla,
 * y de esas ya se desincronizó una en este repo.
 */
export async function resolvePriceBookForClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_price_book", {
    p_client_id: clientId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Shipping Mark → id del cliente. El cotizador trabaja con el código, no con el id. */
export async function clientIdByMarkbox(
  supabase: SupabaseClient,
  markbox: string,
): Promise<string | null> {
  const codigo = markbox.trim();
  if (!codigo) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("markbox", codigo)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data?.id ?? null;
}

/**
 * Busca una tarifa viva de una lista concreta que matchee el destino.
 *
 * Semántica IDÉNTICA a `findRateForDestination` (lib/studio/destination-change.ts)
 * — mismo ILIKE tolerante al typeo, mismo filtro de vigencia, mismo orden — más
 * el filtro de lista. Se mantiene igual a propósito: si la búsqueda de la casa
 * y la del aliado divergen, dos clientes con el mismo destino escrito distinto
 * cotizan distinto y nadie entiende por qué.
 */
async function findRateInBook(
  supabase: SupabaseClient,
  bookId: string,
  service: ShipmentService,
  destination: string,
): Promise<Rate | null> {
  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("rates")
    .select(RATE_COLUMNS)
    .eq("price_book_id", bookId)
    .eq("service", service)
    .ilike("destination", `%${destination.trim()}%`)
    .or(`valid_until.gte.${hoy},valid_until.is.null`)
    .order("valid_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Rate | null) ?? null;
}

/**
 * ⭐ El precio que le toca a ESTE cliente.
 *
 * Orden de resolución, de lo más específico a lo más general:
 *   1. Tarifa propia   — una fila suya en `rates` para esa ruta.
 *   2. Precio pactado  — el $/CBM acordado con el aliado (`base_per_cbm`).
 *   3. Descuento       — la de la casa menos su %.
 *   4. La casa         — tal cual.
 *
 * El precio pactado sólo entra donde el tramo se cobra POR CBM. Se decide
 * mirando la forma de la tarifa de la casa (`per_cbm is not null`), no el
 * `service`: el FCL va por contenedor y un $/CBM no tiene dónde aplicarse ahí.
 *
 * Devuelve también de dónde salió: el cotizador tiene que poder decir por qué
 * el número es ése. `rateId` siempre apunta a la fila REAL de `rates` que se
 * usó —la de la casa cuando hubo descuento—, que es lo que se guarda en
 * `quotes.rate_used_id`; el importe ya descontado va en `rate`.
 */
export async function resolveRateForClient(
  supabase: SupabaseClient,
  params: {
    service: ShipmentService;
    destination: string;
    /** null = prospecto sin ficha todavía → tarifa de la casa. */
    clientId: string | null;
  },
): Promise<TarifaResuelta | null> {
  const { service, destination, clientId } = params;
  if (!destination?.trim()) return null;

  const casa = await getHousePriceBook(supabase);
  const bookId = clientId ? await resolvePriceBookForClient(supabase, clientId) : null;
  const book =
    bookId && bookId !== casa?.id ? await getPriceBookById(supabase, bookId) : null;

  // Cliente directo, o aliado sin lista propia: la de la casa, tal cual.
  if (!book) {
    if (!casa) return null;
    const rate = await findRateInBook(supabase, casa.id, service, destination);
    return rate
      ? { rate, rateId: rate.id, origen: "casa", descuentoPct: null, bookName: casa.name }
      : null;
  }

  // 1. Su tarifa propia manda.
  const propia = await findRateInBook(supabase, book.id, service, destination);
  if (propia) {
    return {
      rate: propia,
      rateId: propia.id,
      origen: "propia",
      descuentoPct: null,
      bookName: book.name,
    };
  }

  // Sin tarifa propia, todo lo demás se apoya en la de la casa: de ahí salen la
  // ruta, los días de tránsito y el piso. Sin ella no hay precio que dar.
  if (!casa) return null;
  const deLaCasa = await findRateInBook(supabase, casa.id, service, destination);
  if (!deLaCasa) return null;

  // 2. El número pactado. Manda sobre el descuento por ser más específico, y
  //    sólo aplica donde la casa cobra por CBM.
  const pactado = book.base_per_cbm != null ? Number(book.base_per_cbm) : null;
  if (pactado != null && pactado > 0 && deLaCasa.per_cbm != null) {
    return {
      // El piso sigue siendo el de la casa, igual que con el descuento.
      rate: { ...deLaCasa, per_cbm: pactado },
      rateId: deLaCasa.id,
      origen: "pactada",
      descuentoPct: null,
      bookName: book.name,
    };
  }

  // 3/4. El descuento sobre la de la casa, o la de la casa a secas.
  const pct = book.discount_pct != null ? Number(book.discount_pct) : null;
  if (pct == null) {
    return {
      rate: deLaCasa,
      rateId: deLaCasa.id,
      origen: "casa",
      descuentoPct: null,
      bookName: book.name,
    };
  }

  return {
    rate: aplicarDescuento(deLaCasa, pct),
    rateId: deLaCasa.id,
    origen: "descuento",
    descuentoPct: pct,
    bookName: book.name,
  };
}
