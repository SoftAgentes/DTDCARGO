/**
 * Calculadora LCL DDP — China → Venezuela
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ⚠️ TODO LO EDITABLE ESTÁ EN ESTE ARCHIVO, ARRIBA DEL CÓDIGO.
 *     Cambiá los números y la calculadora completa se ajusta.
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Lógica (resumen para no-devs):
 *  1. Volumen de la carga: largo × ancho × alto × cantidad cajas → CBM
 *  2. Densidad: peso / CBM
 *  3. Si densidad ≤ pesoIncluidoKg/CBM → precio = CBM × tarifaBase
 *  4. Si densidad > pesoIncluidoKg/CBM y ≤ pesoMaxKg/CBM →
 *     precio = (CBM × tarifaBase) + (kg excedentes × recargoExcedenteKg)
 *  5. Si densidad > pesoMaxKg/CBM → alerta "contactanos para FCL"
 *  6. Recargos: embalaje madera/paleta + ciudad fuera del casco central
 *  7. Descuento sede: -$ si la ciudad de destino es Valencia
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

  /** Descuento si el destino es Valencia (la sede DTD). USD. */
  descuentoValencia: 50,

  /**
   * Recargo por embalaje pesado/no estándar (madera o paleta) en USD.
   * Aplica una sola vez, no por caja.
   */
  recargoEmbalajeMadera: 60,

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
  minimoFacturable: 100,
} as const;

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

export type TipoEmbalaje = "carton" | "madera" | "paleta";

export const EMBALAJES: { id: TipoEmbalaje; label: string; recargo: number }[] = [
  { id: "carton",  label: "Cartón (estándar)",     recargo: 0 },
  { id: "paleta",  label: "Sobre paleta (palet)",  recargo: CONFIG.recargoEmbalajeMadera },
  { id: "madera",  label: "Caja de madera",        recargo: CONFIG.recargoEmbalajeMadera },
];

// ────────────────────────────────────────────────────────────────────
// 4) TYPES DEL INPUT/OUTPUT DE LA CALCULADORA
// ────────────────────────────────────────────────────────────────────

export type EnvioInput = {
  /** Largo de la caja en cm. */
  largoCm: number;
  /** Ancho de la caja en cm. */
  anchoCm: number;
  /** Alto de la caja en cm. */
  altoCm: number;
  /** Peso total de TODAS las cajas en kg. */
  pesoKg: number;
  /** Cantidad de cajas con las mismas dimensiones. */
  cantidadCajas: number;
  /** Tipo de embalaje (afecta recargo). */
  embalaje: TipoEmbalaje;
  /** Ciudad de destino en Venezuela (slug de CIUDADES). */
  ciudadId: string;
  /**
   * Override de la tarifa base por CBM (USD).
   * Si no se provee, se usa `CONFIG.tarifaBaseCBM` (default $800).
   * Útil cuando el cliente tiene una cotización negociada distinta a la pública.
   */
  tarifaCBMOverride?: number;
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
  recargoEmbalaje: number;  // 0 o $60
  descuentoSede: number;    // siempre negativo o 0
  total: number;            // suma final, mínimo CONFIG.minimoFacturable

  /** Si hay algún problema/alerta para mostrar al usuario. */
  alerta?: {
    tipo: "peso_excedido" | "carga_invalida" | "ciudad_invalida";
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
 */
export function calcularEnvioLCL(input: EnvioInput): EnvioCotizacion {
  // 5.1 — Validar entradas básicas
  const ciudad = CIUDADES.find((c) => c.id === input.ciudadId) ?? null;
  if (!ciudad) {
    return cotizacionVacia({
      tipo: "ciudad_invalida",
      mensaje: "Selecciona una ciudad válida de destino en Venezuela.",
    }, input);
  }

  if (
    input.largoCm <= 0 ||
    input.anchoCm <= 0 ||
    input.altoCm <= 0 ||
    input.pesoKg <= 0 ||
    input.cantidadCajas <= 0
  ) {
    return cotizacionVacia({
      tipo: "carga_invalida",
      mensaje: "Las dimensiones, peso y cantidad deben ser mayores a cero.",
    }, input);
  }

  // 5.2 — Calcular volumen (CBM) y densidad
  const cbmPorCaja = (input.largoCm * input.anchoCm * input.altoCm) / 1_000_000;
  const cbm = roundCBM(cbmPorCaja * input.cantidadCajas);
  const densidadKgM3 = input.pesoKg / cbm;

  // 5.3 — Precio base por volumen
  // Si el usuario provee `tarifaCBMOverride`, se usa ese valor (debe ser >0).
  // Si no, fallback a CONFIG.tarifaBaseCBM.
  const tarifaCBM =
    input.tarifaCBMOverride && input.tarifaCBMOverride > 0
      ? input.tarifaCBMOverride
      : CONFIG.tarifaBaseCBM;
  const precioBase = cbm * tarifaCBM;

  // 5.4 — Recargo por excedente de peso (si aplica)
  // Solo se cobra si la densidad supera pesoIncluidoKg.
  // Si supera pesoMaxKg, marcamos alerta para FCL/cotización personal.
  let recargoExcedente = 0;
  let alerta: EnvioCotizacion["alerta"] | undefined;

  if (densidadKgM3 > CONFIG.pesoMaxKg) {
    // Carga ultra densa — alerta + estimación del peso máximo aceptable
    alerta = {
      tipo: "peso_excedido",
      mensaje: `Tu carga tiene ${densidadKgM3.toFixed(0)} kg/CBM, supera el máximo de ${CONFIG.pesoMaxKg} kg/CBM. Necesitás FCL o cotización personalizada — escribinos por WhatsApp.`,
    };
    // Igual calculamos un estimado para que vea el rango
    const kgIncluidos = cbm * CONFIG.pesoIncluidoKg;
    const kgExcedente = Math.max(0, input.pesoKg - kgIncluidos);
    recargoExcedente = kgExcedente * CONFIG.recargoExcedenteKg;
  } else if (densidadKgM3 > CONFIG.pesoIncluidoKg) {
    // Zona normal de excedente (500-600 kg/CBM)
    const kgIncluidos = cbm * CONFIG.pesoIncluidoKg;
    const kgExcedente = input.pesoKg - kgIncluidos;
    recargoExcedente = roundUSD(kgExcedente * CONFIG.recargoExcedenteKg);
  }

  // 5.5 — Recargo por ciudad fuera del casco central
  let recargoCiudad = 0;
  if (!ciudad.casco) {
    const kmFueraCasco = Math.max(0, ciudad.km - CONFIG.thresholdCascoKm);
    recargoCiudad = roundUSD(kmFueraCasco * CONFIG.tarifaKmFueraCasco);
  }

  // 5.6 — Recargo por embalaje
  const embalajeData = EMBALAJES.find((e) => e.id === input.embalaje);
  const recargoEmbalaje = embalajeData?.recargo ?? 0;

  // 5.7 — Descuento si es Valencia
  const descuentoSede =
    ciudad.id === "valencia" ? -CONFIG.descuentoValencia : 0;

  // 5.8 — Total
  let total =
    precioBase +
    recargoExcedente +
    recargoCiudad +
    recargoEmbalaje +
    descuentoSede;

  // Aplicar piso mínimo
  if (total < CONFIG.minimoFacturable) {
    total = CONFIG.minimoFacturable;
  }

  return {
    cbm,
    densidadKgM3: round(densidadKgM3),
    precioBase: roundUSD(precioBase),
    recargoExcedente: roundUSD(recargoExcedente),
    recargoCiudad: roundUSD(recargoCiudad),
    recargoEmbalaje: roundUSD(recargoEmbalaje),
    descuentoSede: roundUSD(descuentoSede),
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
    descuentoSede: 0,
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
    `• Dimensiones: ${input.largoCm}×${input.anchoCm}×${input.altoCm} cm`,
    `• Cantidad de cajas: ${input.cantidadCajas}`,
    `• Peso total: ${input.pesoKg} kg`,
    `• CBM calculado: ${cot.cbm} m³`,
    `• Embalaje: ${EMBALAJES.find((e) => e.id === cot.embalaje)?.label}`,
    `• Destino: ${ciudad}`,
    `• Estimado web: US$${cot.total.toFixed(2)}`,
    "",
    "¿Me confirman tarifa final y tiempos?",
  ];
  return lines.join("\n");
}
