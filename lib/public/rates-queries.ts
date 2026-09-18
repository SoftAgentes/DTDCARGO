/**
 * Queries públicas de tarifas para la calculadora del sitio (Fase 2).
 *
 * Llama a la RPC `public_cbm_rate` (SECURITY DEFINER, grant anon) que nació
 * en `supabase/migrations/0101_rates_valid_from_is_public.sql`. Devuelve solo
 * la tarifa per_cbm marcada `is_public` del tenant dtd, con retorno MÍNIMO
 * (per_cbm + min_charge + valid_until) — sin filtrar info comercial.
 *
 * Si no hay tarifa pública servible (o Supabase caído), devuelve null y el
 * calculador cae al default hardcodeado de `lib/calculadora.ts` (cero
 * regresión).
 *
 * ⚠️ QUÉ CUENTA COMO «NO SERVIBLE» depende de si la migración 0458 (SDD-0476)
 * ya se aplicó en producción. Mientras `0458_tarifa_lectura_sin_vigencia`
 * figure en `supabase/migrations-baseline.json › pendingBelowCutoff`, NO se
 * aplicó (el gate `migrations-applied`, corrido con credenciales, se pone rojo
 * si alguien retira esa entrada sin aplicarla):
 *
 *  · Sin la 0458 (cuerpo de la 0255): una tarifa VENCIDA deja de devolverse y
 *    el sitio cotiza con `CONFIG.tarifaBaseCBM` sin avisar. Que el cliente no
 *    vea el salto depende de que esa constante y la tarifa del ERP valgan lo
 *    mismo — es coincidencia, no mecanismo.
 *  · Con la 0458: la vigencia deja de ser filtro de LECTURA. Una tarifa vencida
 *    se sigue sirviendo, porque es el último precio que el founder puso.
 *    Renovarla es trabajo del ERP (badge de /studio/tarifas + cron
 *    `rate-expiry-alert`), y el respaldo del código queda para lo que de verdad
 *    es no tener tarifa: Supabase inalcanzable, borrador, `is_public` sin marcar
 *    o `valid_from` a futuro.
 *
 * `valid_until` viaja en los dos casos: quien necesite distinguir vigente de
 * vencida lo deriva de ahí (`valid_until != null && valid_until < hoy`). La
 * firma de la RPC es la misma con y sin la 0458, así que este módulo no cambia
 * al aplicarla.
 */

import { getAnonClient } from "./supabase-anon";
import { CIUDADES, DEFAULT_PARAMS } from "@/lib/calculadora";
import type { CalcParams, Ciudad } from "@/lib/calculadora";
import { DESTINO_POR_SLUG } from "@/lib/data/destinos-nacionales";

/** Una ruta FCL pública (contenedor completo) para la calculadora FCL del sitio. */
export type PublicFclRoute = {
  origin: string;
  destination: string;
  /** Tarifa flat por contenedor en USD. */
  flatRate: number;
  /** Piso comercial USD, o null. */
  minCharge: number | null;
  /** Días de tránsito estimados, o null. */
  transitDays: number | null;
  /** Vigencia (ISO date), o null. */
  validUntil: string | null;
};

export type PublicCbmRate = {
  /** Tarifa por CBM en USD (la base editable del calculador). */
  per_cbm: number;
  /** Mínimo cobrable LCL en USD (piso del calculador). null = sin piso comercial. */
  min_charge: number | null;
  /** Vigencia (ISO date YYYY-MM-DD). null = sin fecha de corte. */
  valid_until: string | null;
};

/**
 * Resuelve la tarifa pública del calculador (la marcada `is_public`).
 * @returns la tarifa, o `null` si la RPC no devolvió ninguna / hubo error.
 *   Qué filtra la RPC está en el bloque de arriba: con la 0458 aplicada, una
 *   tarifa vencida SÍ se devuelve.
 */
export async function getPublicCbmRate(): Promise<PublicCbmRate | null> {
  // Nunca debe tirar: es una página pública de marketing. Cualquier falla
  // (env faltante, Supabase caído, RPC ausente) → null → fallback a CONFIG.
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_cbm_rate");

    if (error) {
      console.error("[getPublicCbmRate] RPC error:", error.message);
      return null;
    }

    // RPC retorna setof → array de 0 o 1 elemento.
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || row.per_cbm == null) return null;

    return {
      per_cbm: Number(row.per_cbm),
      min_charge: row.min_charge == null ? null : Number(row.min_charge),
      valid_until: row.valid_until ?? null,
    };
  } catch (e) {
    console.error(
      "[getPublicCbmRate] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * Resuelve las REGLAS escalares del calculador (Fase 3 Slice A) que el admin
 * configura en /studio/tarifas › Parámetros (tabla calculator_settings).
 *
 * Llama a la RPC `public_calculator_config` (anon, security definer, grant anon)
 * de `supabase/migrations/0103_calculator_settings.sql`. Retorno MÍNIMO: solo
 * las 8 reglas, sin tenant_id ni timestamps.
 *
 * Si no hay fila configurada (o Supabase caído / RPC ausente) devuelve null y
 * el calculador cae a `DEFAULT_PARAMS` de `lib/calculadora.ts` (cero regresión).
 *
 * @returns las reglas como `CalcParams`, o `null` si no hay config / hubo error.
 */
export async function getPublicCalculatorConfig(): Promise<CalcParams | null> {
  // Nunca debe tirar: página pública de marketing. Cualquier falla → null.
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_calculator_config");

    if (error) {
      console.error("[getPublicCalculatorConfig] RPC error:", error.message);
      return null;
    }

    // RPC retorna setof → array de 0 o 1 elemento.
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;

    // Mapeo snake_case (DB) → camelCase (CalcParams). Cualquier campo CORE no
    // numérico/ausente invalida la config entera → null (fallback seguro).
    const core = {
      pesoIncluidoKg: Number(row.peso_incluido_kg),
      recargoExcedenteKg: Number(row.recargo_excedente_kg),
      descuentoValencia: Number(row.descuento_valencia),
      recargoEmbalajeEspecial: Number(row.recargo_embalaje_especial),
      recargoBateriaMult: Number(row.recargo_bateria_mult),
      thresholdCascoKm: Number(row.threshold_casco_km),
      tarifaKmFueraCasco: Number(row.tarifa_km_fuera_casco),
      cbmMaxContenedor: Number(row.cbm_max_contenedor),
      pesoMaxContenedorKg: Number(row.peso_max_contenedor_kg),
    };
    if (Object.values(core).some((v) => !Number.isFinite(v))) return null;

    // pesoMaxEnvioKg se agregó después (migración 0223). Es RESILIENTE al rollout:
    // si el RPC viejo no lo trae (deploy antes de la migración), cae al default
    // (9.000) en vez de invalidar toda la config → cero regresión de pricing.
    const pmev = Number(row.peso_max_envio_kg);
    const params: CalcParams = {
      ...core,
      pesoMaxEnvioKg: Number.isFinite(pmev) ? pmev : DEFAULT_PARAMS.pesoMaxEnvioKg,
    };

    return params;
  } catch (e) {
    console.error(
      "[getPublicCalculatorConfig] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * Resuelve las CIUDADES de destino del calculador (Fase 3 Slice B) que el admin
 * configura en /studio/tarifas › Ciudades (tabla calculator_cities).
 *
 * Llama a la RPC `public_calculator_cities` (anon, security definer, grant anon)
 * de `supabase/migrations/0104_calculator_cities_rate_status.sql`. Retorno
 * MÍNIMO: slug + label + km + casco, sin tenant_id ni columnas internas.
 *
 * Si no hay filas (o Supabase caído / RPC ausente) devuelve `[]` y el caller cae
 * al array `CIUDADES` de `lib/calculadora.ts` (cero regresión).
 *
 * @returns la lista como `Ciudad[]`, o `[]` si no hay config / hubo error.
 */
export async function getPublicCalculatorCities(): Promise<Ciudad[]> {
  // Nunca debe tirar: página pública de marketing. Cualquier falla → [].
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_calculator_cities");

    if (error) {
      console.error("[getPublicCalculatorCities] RPC error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const ciudades: Ciudad[] = [];
    for (const row of rows) {
      // slug (DB) → id (Ciudad). Descartamos filas con slug/label vacíos o km
      // no numérico (defensa: una fila corrupta no debe romper el form).
      const id = typeof row?.slug === "string" ? row.slug.trim() : "";
      const label = typeof row?.label === "string" ? row.label.trim() : "";
      const km = Number(row?.km);
      if (!id || !label || !Number.isFinite(km)) continue;
      ciudades.push({ id, label, km, casco: Boolean(row?.casco) });
    }
    return ciudades;
  } catch (e) {
    console.error(
      "[getPublicCalculatorCities] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

/** Una tarifa de entrega nacional, tal como la suelta la RPC pública. */
export type PublicCarrierTariff = {
  citySlug: string;
  /** USD por m³ que paga el cliente. La RPC NUNCA devuelve el costo. */
  priceUsdCbm: number;
  minChargeUsd: number | null;
  dispatchFrequencyDays: number | null;
  transitDays: string | null;
};

/**
 * Resuelve el TARIFARIO TERRESTRE del transportista predeterminado (SDD-0237).
 *
 * Llama a la RPC `public_carrier_tariffs` (anon, security definer) de
 * `supabase/migrations/0330_freight_carriers_tariffs.sql`. Devuelve sólo
 * `city_slug + precio de VENTA + mínimo + frecuencia + tránsito`: el sitio
 * nunca sabe quién es el transportista, cuánto nos cuesta, ni qué ofrecieron
 * los demás proveedores.
 *
 * Sin filas (tabla vacía, migración sin aplicar, Supabase caído) devuelve `[]`
 * y el caller cae al respaldo de `lib/data/destinos-nacionales.ts` — cero
 * regresión, la calculadora sigue cobrando bien.
 */
export async function getPublicCarrierTariffs(): Promise<PublicCarrierTariff[]> {
  // Nunca debe tirar: página pública de marketing. Cualquier falla → [].
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_carrier_tariffs");

    if (error) {
      console.error("[getPublicCarrierTariffs] RPC error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const tarifas: PublicCarrierTariff[] = [];
    for (const row of rows) {
      const citySlug = typeof row?.city_slug === "string" ? row.city_slug.trim() : "";
      const priceUsdCbm = Number(row?.price_usd_cbm);
      // Defensa: una fila sin ciudad o sin precio válido no debe cobrar $0 por
      // omisión — se descarta y esa ciudad cae al respaldo o deriva al asesor.
      if (!citySlug || !Number.isFinite(priceUsdCbm) || priceUsdCbm <= 0) continue;
      tarifas.push({
        citySlug,
        priceUsdCbm,
        minChargeUsd: row?.min_charge_usd == null ? null : Number(row.min_charge_usd),
        dispatchFrequencyDays:
          row?.dispatch_frequency_days == null ? null : Number(row.dispatch_frequency_days),
        transitDays: row?.transit_days ?? null,
      });
    }
    return tarifas;
  } catch (e) {
    console.error(
      "[getPublicCarrierTariffs] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

/**
 * Arma la lista de destinos que consume el calculador, cruzando tres fuentes.
 *
 * QUIÉN MANDA EN QUÉ, y por qué:
 *
 *  · **La DB manda en el precio.** Si `carrier_tariffs` tiene una fila para esa
 *    ciudad, ese es el precio. Es lo que permite que el founder suba una tarifa
 *    desde el ERP y la web la cobre sin deploy.
 *  · **El código manda en la semántica de cobertura.** `calculator_cities` no
 *    tiene columna de "no llegamos hasta ahí": esa distinción vive en
 *    `DESTINOS_NACIONALES`. Sin ella no podríamos diferenciar "no hay tarifa
 *    todavía" de "el transportista confirmó que no llega", que le dicen cosas
 *    MUY distintas al cliente.
 *  · **La DB manda en la lista.** Si el admin agrega o borra una ciudad, eso se
 *    respeta; sólo si la RPC no devuelve nada se usa la lista del código.
 *
 * Una ciudad de la DB que el código no conoce entra igual: se asume cubierta y
 * cobra lo que diga su tarifa. Si no tiene tarifa, deriva al asesor.
 */
export function combinarDestinos(
  ciudadesDb: Ciudad[],
  tarifas: PublicCarrierTariff[],
): Ciudad[] {
  const base = ciudadesDb.length > 0 ? ciudadesDb : CIUDADES;
  const porSlug = new Map(tarifas.map((t) => [t.citySlug, t]));

  return base.map((ciudad) => {
    const estatico = DESTINO_POR_SLUG.get(ciudad.id);
    const tarifa = porSlug.get(ciudad.id);

    // Cobertura: manda el catálogo del código. Si no lo conoce, se asume que sí
    // llegamos (una ciudad que el admin agregó a mano no debería desaparecer).
    const cubierta = estatico ? estatico.cubierta : true;

    // La ZONA SIN COSTO es una decisión del founder, no un dato editable: si el
    // catálogo del código dice que ahí el cliente no paga entrega, manda el
    // código aunque la fila de la DB todavía diga que sí.
    //
    // ⚠️ Esto NO es defensa teórica. Entre que se despliega el código y que se
    // aplica la migración que voltea el flag, `calculator_cities` sigue con
    // `casco = false` en Barquisimeto y Acarigua — y sin este OR el cliente
    // pagaba $529,70 y $618 por 5 m³ donde el founder decidió cobrar $0.
    const casco = ciudad.casco || estatico?.casco === true;

    return {
      ...ciudad,
      casco,
      cubierta,
      cercana: estatico?.cercana ?? null,
      estado: estatico?.estado ?? ciudad.estado,
      // El precio: DB primero, respaldo después. `null` → deriva al asesor.
      // En la zona sin costo el precio viaja igual (el ERP lo necesita), pero
      // el motor lo ignora por el flag `casco`.
      ventaCbm: cubierta ? (tarifa?.priceUsdCbm ?? estatico?.ventaCbm ?? null) : null,
      minCharge: tarifa?.minChargeUsd ?? null,
      frecuenciaDias: tarifa?.dispatchFrequencyDays ?? estatico?.frecuenciaDias ?? null,
    };
  });
}

/**
 * Resuelve las RUTAS FCL públicas (contenedor completo) para `/calculadora-fcl`.
 *
 * Llama a la RPC `public_fcl_rates` (anon, security definer, grant anon) de
 * `supabase/migrations/0157_public_fcl_rates.sql`. Retorno MÍNIMO: origin +
 * destination + flat_rate + min_charge + transit_days + valid_until, solo de las
 * rutas fcl_directo marcadas is_public del tenant dtd.
 *
 * Si no hay rutas públicas (o Supabase caído / RPC ausente) devuelve `[]` y la
 * calculadora muestra su estado vacío ("pídela por WhatsApp"). Nunca tira: es una
 * página pública de marketing.
 */
export async function getPublicFclRoutes(): Promise<PublicFclRoute[]> {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.rpc("public_fcl_rates");

    if (error) {
      console.error("[getPublicFclRoutes] RPC error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const routes: PublicFclRoute[] = [];
    for (const row of rows) {
      const origin = typeof row?.origin === "string" ? row.origin.trim() : "";
      const destination =
        typeof row?.destination === "string" ? row.destination.trim() : "";
      const flatRate = Number(row?.flat_rate);
      // Defensa: una fila sin ruta o sin tarifa válida no debe romper el form.
      if (!origin || !destination || !Number.isFinite(flatRate) || flatRate <= 0) {
        continue;
      }
      routes.push({
        origin,
        destination,
        flatRate,
        minCharge: row?.min_charge == null ? null : Number(row.min_charge),
        transitDays: row?.transit_days == null ? null : Number(row.transit_days),
        validUntil: row?.valid_until ?? null,
      });
    }
    return routes;
  } catch (e) {
    console.error(
      "[getPublicFclRoutes] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}
