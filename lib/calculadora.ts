/**
 * Calculadora LCL DDP — China → Venezuela
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ⚠️ TODO LO EDITABLE ESTÁ EN ESTE ARCHIVO, ARRIBA DEL CÓDIGO.
 *     Cambiá los números y la calculadora completa se ajusta.
 *     (Fase 3: estos valores pasarán a configurarse desde el Studio.)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Lógica (resumen para no-devs):
 *  1. El cliente ingresa el CBM total (m³) directo y el peso total (kg).
 *  2. Densidad: peso / CBM.
 *  3. Si densidad ≤ pesoIncluidoKg/CBM → precio = CBM × tarifaBase.
 *  4. Si densidad > pesoIncluidoKg/CBM y ≤ pesoMaxKg/CBM →
 *     precio = (CBM × tarifaBase) + (kg excedentes × recargoExcedenteKg).
 *  5. Si densidad > pesoMaxKg/CBM → alerta "contactanos para FCL".
 *  6. Recargos: embalaje especial (madera/paleta) + ciudad fuera del casco central.
 *  7. Baterías: multiplican el flete (×recargoBateriaMult).
 *  8. Carga especial / peligrosa → no cotiza, deriva al asesor.
 *  9. Descuento sede: -$ si la ciudad de destino es Valencia.
 *  Orden: (base + excedente + ciudad + embalaje) × batería − descuento, luego piso.
 */

// ────────────────────────────────────────────────────────────────────
// 1) CONFIG GENERAL — TARIFAS Y UMBRALES
//    👉 Editá estos números para ajustar precios y reglas.
// ────────────────────────────────────────────────────────────────────

export const CONFIG = {
  /** Tarifa base por metro cúbico en USD (precio limpio sin excedente). */
  tarifaBaseCBM: 800,

  /** Peso máximo por CBM incluido en la tarifa base. Sobre esto = excedente. */
  pesoIncluidoKg: 500,

  /** Peso máximo absoluto por CBM. Sobre esto, la calculadora alerta. */
  pesoMaxKg: 600,

  /**
   * Tarifa por kg que excede `pesoIncluidoKg` (zona 500-600 kg/CBM).
   * Ej: si la carga pesa 600 kg en 1 CBM, el excedente es 100 kg × $1 = +$100.
   */
  recargoExcedenteKg: 1,

  /**
   * Descuento si el destino es Valencia (la sede DTD). USD.
   * 0 = sin descuento (regla vigente desde 2026-06-04; el -$50 quedó obsoleto).
   * Configurable desde /studio/tarifas › Parámetros.
   */
  descuentoValencia: 0,

  /**
   * Recargo por embalaje especial (madera o paleta) en USD.
   * Aplica una sola vez, no por caja.
   */
  recargoEmbalajeEspecial: 50,

  /**
   * Multiplicador del flete cuando la carga lleva baterías (riesgo/manejo).
   * 1.5 = +50% sobre el flete (antes del descuento de sede).
   */
  recargoBateriaMult: 1.5,

  /**
   * Distancia (km) hasta donde se considera "casco central" — entrega
   * flat sin recargo extra por km. Sobre esto se cobra por km.
   */
  thresholdCascoKm: 200,

  /**
   * Tarifa por km cuando el destino está fuera del casco central.
   * Ej: ciudad a 350 km → 150 km fuera del casco → recargo 150 × $1 = $150.
   */
  tarifaKmFueraCasco: 1,

  /** Precio mínimo facturable. Si la carga es muy chica, este es el piso. */
  minimoFacturable: 50,
} as const;

// ────────────────────────────────────────────────────────────────────
// 1b) PARÁMETROS CONFIGURABLES DESDE EL STUDIO (Fase 3 Slice A)
//     Las reglas escalares del calculador pueden venir de la DB
//     (/studio/tarifas › Parámetros → tabla calculator_settings). El cálculo
//     recibe un `CalcParams`; si no se provee, usa DEFAULT_PARAMS (= CONFIG),
//     así nada se rompe cuando no hay config en la DB (cero regresión).
//
//     OJO: la tarifa base por CBM y el piso mínimo NO están acá — viajan por
//     `EnvioInput.tarifaCBMOverride` / `minChargeOverride` (los alimenta
//     rates.is_public, Fase 2). CalcParams son solo las REGLAS.
// ────────────────────────────────────────────────────────────────────

export type CalcParams = {
  pesoIncluidoKg: number;
  pesoMaxKg: number;
  recargoExcedenteKg: number;
  descuentoValencia: number;
  recargoEmbalajeEspecial: number;
  recargoBateriaMult: number;
  thresholdCascoKm: number;
  tarifaKmFueraCasco: number;
};

/** Defaults = los valores históricos de CONFIG. Fallback cuando no hay config en DB. */
export const DEFAULT_PARAMS: CalcParams = {
  pesoIncluidoKg: CONFIG.pesoIncluidoKg,
  pesoMaxKg: CONFIG.pesoMaxKg,
  recargoExcedenteKg: CONFIG.recargoExcedenteKg,
  descuentoValencia: CONFIG.descuentoValencia,
  recargoEmbalajeEspecial: CONFIG.recargoEmbalajeEspecial,
  recargoBateriaMult: CONFIG.recargoBateriaMult,
  thresholdCascoKm: CONFIG.thresholdCascoKm,
  tarifaKmFueraCasco: CONFIG.tarifaKmFueraCasco,
};

// ────────────────────────────────────────────────────────────────────
// 2) CIUDADES DE VENEZUELA — KM DESDE VALENCIA CENTRO
//    👉 Editá / agregá ciudades acá. Los `km` se usan para calcular el
//       recargo por distancia. `casco: true` = entrega flat sin recargo
//       extra por km (Valencia, Maracay, Caracas son casco por default).
// ────────────────────────────────────────────────────────────────────

export type Ciudad = {
  /** Slug interno (sin espacios). */
  id: string;
  /** Nombre visible en el form. */
  label: string;
  /** Km desde Valencia centro (referencia para recargo por distancia). */
  km: number;
  /** Si es true, entra en el flat del casco central sin recargo extra. */
  casco: boolean;
};

export const CIUDADES: Ciudad[] = [
  // Opción agrupada por default — cualquier punto del casco central, sin recargo
  { id: "casco-central", label: "Casco central (Valencia · Maracay · Caracas)", km: 0, casco: true },
  // Casco central — flat tarifa base
  { id: "valencia",     label: "Valencia (sede)",  km: 0,   casco: true },
  { id: "maracay",      label: "Maracay",          km: 70,  casco: true },
  { id: "caracas",      label: "Caracas",          km: 150, casco: true },
  // Fuera del casco — recargo por km
  { id: "barquisimeto", label: "Barquisimeto",     km: 220, casco: false },
  { id: "maracaibo",    label: "Maracaibo",        km: 410, casco: false },
  { id: "puerto-la-cruz", label: "Puerto La Cruz", km: 430, casco: false },
  { id: "san-cristobal", label: "San Cristóbal",   km: 580, casco: false },
  { id: "merida",       label: "Mérida",           km: 520, casco: false },
  { id: "ciudad-bolivar", label: "Ciudad Bolívar", km: 700, casco: false },
  { id: "puerto-ordaz", label: "Puerto Ordaz",     km: 770, casco: false },
  { id: "punto-fijo",   label: "Punto Fijo",       km: 290, casco: false },
  { id: "coro",         label: "Coro",             km: 260, casco: false },
  // Margarita (isla) — caso especial: mismo cálculo por km pero advertir
  // que cruza ferry. Editá el km si querés que pague más por la travesía.
  { id: "margarita",    label: "Isla Margarita",   km: 540, casco: false },
];

// ────────────────────────────────────────────────────────────────────
// 3) EMBALAJES — RECARGOS POR TIPO
// ────────────────────────────────────────────────────────────────────

export type TipoEmbalaje = "estandar" | "especial";

export const EMBALAJES: { id: TipoEmbalaje; label: string; recargo: number }[] = [
  { id: "estandar", label: "Caja estándar",                recargo: 0 },
  { id: "especial", label: "Caja especial (madera o paleta)", recargo: CONFIG.recargoEmbalajeEspecial },
];

// ────────────────────────────────────────────────────────────────────
// 4) TYPES DEL INPUT/OUTPUT DE LA CALCULADORA
// ────────────────────────────────────────────────────────────────────

export type EnvioInput = {
  /** Volumen total del envío en m³ (CBM). El cliente ya lo conoce. */
  cbmTotal: number;
  /** Peso total de toda la carga en kg. */
  pesoKg: number;
  /** Tipo de embalaje (afecta recargo). */
  embalaje: TipoEmbalaje;
  /** Ciudad de destino en Venezuela (slug de CIUDADES). */
  ciudadId: string;
  /** La carga lleva baterías (multiplica el flete por `recargoBateriaMult`). */
  bateria?: boolean;
  /** Carga peligrosa / que requiere permisos especiales → no cotiza, deriva al asesor. */
  cargaEspecial?: boolean;
  /**
   * Override de la tarifa base por CBM (USD).
   * Si no se provee, se usa `CONFIG.tarifaBaseCBM` (default $800).
   * Útil cuando el cliente tiene una cotización negociada distinta a la pública.
   */
  tarifaCBMOverride?: number;
  /**
   * Override del piso mínimo cobrable (USD). Lo alimenta la tarifa pública
   * real (`rates.min_charge` = mínimo LCL comercial) desde el server.
   * Si no se provee (o es <= 0), se usa `CONFIG.minimoFacturable` (piso trivial).
   */
  minChargeOverride?: number;
};

export type EnvioCotizacion = {
  /** Volumen total en m³ (CBM). */
  cbm: number;
  /** Densidad calculada (peso/CBM). */
  densidadKgM3: number;

  /** Cargos individuales (todos en USD, para mostrar desglose). */
  precioBase: number;       // CBM × tarifaBase
  recargoExcedente: number; // kg sobre pesoIncluido × recargoExcedenteKg
  recargoCiudad: number;    // km fuera del casco × tarifaKm
  recargoEmbalaje: number;  // 0 o recargoEmbalajeEspecial
  recargoBateria: number;   // extra por el multiplicador de baterías (0 si no)
  descuentoSede: number;    // siempre negativo o 0
  ajusteMinimo: number;     // ≥0 · cuánto sumó el piso mínimo (para que el desglose reconcilie)
  total: number;            // suma final, piso = min_charge real o CONFIG.minimoFacturable

  /** Si hay algún problema/alerta para mostrar al usuario. */
  alerta?: {
    tipo: "peso_excedido" | "carga_invalida" | "ciudad_invalida" | "carga_especial";
    mensaje: string;
  };

  /** Datos derivados para mostrar al usuario. */
  ciudad: Ciudad | null;
  embalaje: TipoEmbalaje;
};

// ────────────────────────────────────────────────────────────────────
// 5) FUNCIÓN PRINCIPAL DEL CÁLCULO (pura, sin side effects)
// ────────────────────────────────────────────────────────────────────

/**
 * Calcula la cotización de un envío LCL DDP de China a Venezuela.
 *
 * Toda la lógica de pricing vive en CONFIG + CIUDADES. Esta función
 * solo aplica las reglas; no hace fetch, no toca DOM, no muta estado.
 * 100% testeable.
 *
 * `params` (reglas escalares) y `ciudades` (lista de destinos) llegan como
 * args con default (DEFAULT_PARAMS / CIUDADES): el sitio público les inyecta
 * lo de la DB (calculator_settings / calculator_cities) o cae a los defaults
 * hardcodeados — cero regresión cuando no hay config.
 */
export function calcularEnvioLCL(
  input: EnvioInput,
  params: CalcParams = DEFAULT_PARAMS,
  ciudades: Ciudad[] = CIUDADES,
): EnvioCotizacion {
  // 5.1 — Carga especial / peligrosa → no cotiza, deriva al asesor
  if (input.cargaEspecial) {
    return cotizacionVacia({
      tipo: "carga_especial",
      mensaje:
        "Para carga especial, peligrosa o que requiere permisos de exportación, " +
        "consultá con tu asesor — la cotizamos a medida.",
    }, input);
  }

  // 5.2 — Validar destino. La lista de ciudades llega como 3er arg (Fase 3
  // Slice B): el sitio le inyecta las de la DB (calculator_cities) o, si no hay,
  // el array CIUDADES por default → cero regresión y función pura testeable.
  const ciudad = ciudades.find((c) => c.id === input.ciudadId) ?? null;
  if (!ciudad) {
    return cotizacionVacia({
      tipo: "ciudad_invalida",
      mensaje: "Selecciona una ciudad válida de destino en Venezuela.",
    }, input);
  }

  // 5.3 — Validar carga
  if (input.cbmTotal <= 0 || input.pesoKg <= 0) {
    return cotizacionVacia({
      tipo: "carga_invalida",
      mensaje: "El CBM total y el peso deben ser mayores a cero.",
    }, input);
  }

  // 5.4 — Volumen (CBM) y densidad
  const cbm = roundCBM(input.cbmTotal);
  const densidadKgM3 = input.pesoKg / cbm;

  // 5.5 — Precio base por volumen
  // Si el usuario provee `tarifaCBMOverride`, se usa ese valor (debe ser >0).
  // Si no, fallback a CONFIG.tarifaBaseCBM.
  const tarifaCBM =
    input.tarifaCBMOverride && input.tarifaCBMOverride > 0
      ? input.tarifaCBMOverride
      : CONFIG.tarifaBaseCBM;
  const precioBase = cbm * tarifaCBM;

  // 5.6 — Recargo por excedente de peso (si aplica)
  // Solo se cobra si la densidad supera pesoIncluidoKg.
  // Si supera pesoMaxKg, marcamos alerta para FCL/cotización personal.
  let recargoExcedente = 0;
  let alerta: EnvioCotizacion["alerta"] | undefined;

  if (densidadKgM3 > params.pesoMaxKg) {
    // Carga ultra densa — alerta + estimación del peso máximo aceptable
    alerta = {
      tipo: "peso_excedido",
      mensaje: `Tu carga tiene ${densidadKgM3.toFixed(0)} kg/CBM, supera el máximo de ${params.pesoMaxKg} kg/CBM. Necesitás FCL o cotización personalizada — escribinos por WhatsApp.`,
    };
    // Igual calculamos un estimado para que vea el rango
    const kgIncluidos = cbm * params.pesoIncluidoKg;
    const kgExcedente = Math.max(0, input.pesoKg - kgIncluidos);
    recargoExcedente = kgExcedente * params.recargoExcedenteKg;
  } else if (densidadKgM3 > params.pesoIncluidoKg) {
    // Zona normal de excedente (500-600 kg/CBM)
    const kgIncluidos = cbm * params.pesoIncluidoKg;
    const kgExcedente = input.pesoKg - kgIncluidos;
    recargoExcedente = roundUSD(kgExcedente * params.recargoExcedenteKg);
  }

  // 5.7 — Recargo por ciudad fuera del casco central
  let recargoCiudad = 0;
  if (!ciudad.casco) {
    const kmFueraCasco = Math.max(0, ciudad.km - params.thresholdCascoKm);
    recargoCiudad = roundUSD(kmFueraCasco * params.tarifaKmFueraCasco);
  }

  // 5.8 — Recargo por embalaje (especial = madera/paleta). Se computa desde
  // params (configurable), no desde EMBALAJES (que solo aporta labels al form).
  const recargoEmbalaje =
    input.embalaje === "especial" ? params.recargoEmbalajeEspecial : 0;

  // 5.9 — Flete antes de baterías (base + recargos)
  const fleteAntesBateria =
    precioBase + recargoExcedente + recargoCiudad + recargoEmbalaje;

  // 5.10 — Multiplicador por baterías (sobre el flete, antes del descuento)
  const fleteConBateria = input.bateria
    ? fleteAntesBateria * params.recargoBateriaMult
    : fleteAntesBateria;
  const recargoBateria = roundUSD(fleteConBateria - fleteAntesBateria);

  // 5.11 — Descuento si es Valencia (solo si hay descuento configurado > 0;
  // el guard evita -0 cuando descuentoValencia es 0).
  const descuentoSede =
    ciudad.id === "valencia" && params.descuentoValencia > 0
      ? -params.descuentoValencia
      : 0;

  // 5.12 — Total antes del piso (Σ de los ítems del desglose)
  const totalSinPiso = fleteConBateria + descuentoSede;

  // Piso mínimo. Si la tarifa pública trae un min_charge real (mínimo LCL
  // comercial, ej. $380), ese es el piso; si no, el piso trivial de CONFIG.
  const piso =
    input.minChargeOverride != null && input.minChargeOverride > 0
      ? input.minChargeOverride
      : CONFIG.minimoFacturable;
  const total = Math.max(totalSinPiso, piso);
  // Cuánto sumó el piso → el desglose reconcilia: Σ ítems + ajusteMinimo = total.
  const ajusteMinimo = roundUSD(Math.max(0, total - totalSinPiso));

  return {
    cbm,
    densidadKgM3: round(densidadKgM3),
    precioBase: roundUSD(precioBase),
    recargoExcedente: roundUSD(recargoExcedente),
    recargoCiudad: roundUSD(recargoCiudad),
    recargoEmbalaje: roundUSD(recargoEmbalaje),
    recargoBateria,
    descuentoSede: roundUSD(descuentoSede),
    ajusteMinimo,
    total: roundUSD(total),
    alerta,
    ciudad,
    embalaje: input.embalaje,
  };
}

// ────────────────────────────────────────────────────────────────────
// 6) HELPERS PRIVADOS
// ────────────────────────────────────────────────────────────────────

/** Redondea a 3 decimales (estándar industria para CBM). */
function roundCBM(n: number): number {
  return Math.ceil(n * 1000) / 1000;
}

/** Redondea USD a 2 decimales. */
function roundUSD(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Redondea a 2 decimales. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Devuelve una cotización en estado de error (con alerta). */
function cotizacionVacia(
  alerta: NonNullable<EnvioCotizacion["alerta"]>,
  input: EnvioInput,
): EnvioCotizacion {
  return {
    cbm: 0,
    densidadKgM3: 0,
    precioBase: 0,
    recargoExcedente: 0,
    recargoCiudad: 0,
    recargoEmbalaje: 0,
    recargoBateria: 0,
    descuentoSede: 0,
    ajusteMinimo: 0,
    total: 0,
    alerta,
    ciudad: null,
    embalaje: input.embalaje,
  };
}

// ────────────────────────────────────────────────────────────────────
// 7) MENSAJE WHATSAPP PRECONFIGURADO
//    Genera el texto que el cliente envía al hacer click en "Cotizar
//    por WhatsApp" con todos los datos del cálculo ya completos.
// ────────────────────────────────────────────────────────────────────

export function whatsappTextFromCotizacion(
  cot: EnvioCotizacion,
  input: EnvioInput,
): string {
  const ciudad = cot.ciudad?.label ?? "destino";
  const lines = [
    "Hola DTD Cargo, vi en la calculadora un estimado para mi envío:",
    "",
    `• CBM total: ${input.cbmTotal} m³`,
    `• Peso total: ${input.pesoKg} kg`,
    `• Embalaje: ${EMBALAJES.find((e) => e.id === cot.embalaje)?.label}`,
    `• Baterías: ${input.bateria ? "Sí" : "No"}`,
    `• Destino: ${ciudad}`,
    `• Estimado web: US$${cot.total.toFixed(2)}`,
    "",
    "¿Me confirman tarifa final y tiempos? (Financiamiento 100%, pago al llegar)",
  ];
  return lines.join("\n");
}
