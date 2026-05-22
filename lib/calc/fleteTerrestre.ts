/**
 * Cálculo de flete terrestre Venezuela — función pura.
 *
 * Implementa la metodología DTD documentada en
 * `docs/specs/0002-calculadora-flete-terrestre/spec.md`.
 *
 * Uso:
 * ```ts
 * import { calcularFleteTerrestre } from "@/lib/calc/fleteTerrestre";
 * const r = calcularFleteTerrestre({
 *   origen: "Valencia",
 *   destino: "Caracas",
 *   pesoRealKg: 100,
 *   volumenM3: 0.5,
 * });
 * // r.totalUsd, r.zona, r.pesoFacturable, etc.
 * ```
 */

import {
  type Origen,
  type ModoCotizacionTerrestre,
  getMapaZonasParaOrigen,
  destinoEsCasco,
  TARIFA_USD_KG,
  FACTOR_VOLUMETRICO_KG_M3,
  MULTIPLICADOR_DTD_DEFAULT,
  PRECIO_SOBRE_HASTA_1KG_USD,
  FPO_PORCENTAJE,
  SEGURO_PORCENTAJE,
  IVA_PORCENTAJE,
} from "@/lib/data/tarifas-terrestres-vzla";

export interface FleteTerrestreInput {
  origen: Origen;
  destino: string;
  pesoRealKg: number;
  /** Volumen en m³ (opcional). Si > 0, se compara peso real vs peso volumétrico. */
  volumenM3?: number;
  /** Valor declarado USD (opcional). Si > 0, suma seguro 3%. */
  valorDeclaradoUsd?: number;
  /** Multiplicador DTD sobre tarifa Fletes GAG. Default 1.15 (margen 15%). */
  multiplicadorDtd?: number;
  /**
   * Modo de cotización según situación del cliente:
   * - `solo-terrestre` (default): sin envío CBM, cobra todo
   * - `cbm-casco`: tiene CBM + destino dentro del casco central → $0
   * - `cbm-lejos`: tiene CBM + destino fuera del casco → descuento parcial
   */
  modoCotizacion?: ModoCotizacionTerrestre;
}

export interface FleteTerrestreOutput {
  /** Zona asignada al destino según origen. null si destino no está en el mapa. */
  zona: number | null;
  /** Peso volumétrico calculado (volumen × factor). 0 si no hay volumen. */
  pesoVolumetricoKg: number;
  /** Peso facturable = MAX(peso real, peso volumétrico). */
  pesoFacturableKg: number;
  /** True si peso facturable ≤ 1 kg (aplica tarifa sobre fija). */
  esSobre: boolean;
  /** Descripción del tramo de tarifa aplicado (ej. "100.01 a 200"). */
  tramoAplicado: string | null;
  /** Tarifa USD/kg de Fletes GAG sin multiplicador. */
  tarifaBaseUsdKg: number;
  /** Tarifa USD/kg con multiplicador DTD aplicado. */
  tarifaDtdUsdKg: number;
  /** Flete base USD = peso facturable × tarifa DTD (o $6 si sobre). */
  fleteBaseUsd: number;
  /**
   * Descuento aplicado por casco central CBM (modo `cbm-lejos`).
   * USD que el cliente NO paga porque el casco ya está cubierto por su CBM.
   * 0 en modos `solo-terrestre` y `cbm-casco`.
   */
  descuentoCascoUsd: number;
  /** Franqueo Postal Obligatorio = 6% del flete neto. */
  fpoUsd: number;
  /** Seguro = 3% del valor declarado. 0 si no se declaró valor. */
  seguroUsd: number;
  /** Subtotal = flete + FPO + seguro. */
  subtotalUsd: number;
  /** IVA = 16% del subtotal. */
  ivaUsd: number;
  /** Total final USD al cliente. */
  totalUsd: number;
  /**
   * Modo aplicado finalmente (puede diferir del solicitado si hubo override
   * por incompatibilidad entre modo elegido y destino).
   */
  modoAplicado: ModoCotizacionTerrestre;
  /** Mensaje contextual sobre el modo aplicado (informativo, no es error). */
  notaCasco?: string;
  /** Warning si el modo elegido no coincide con el destino (informativo). */
  warning?: string;
  /** Si hay error duro en input (destino no existe, peso negativo, etc.). */
  error?: string;
}

/**
 * Encuentra el tramo de tarifa para un peso dado.
 * @returns índice en TARIFA_USD_KG, o -1 si fuera de rango.
 */
function encontrarTramo(pesoKg: number): number {
  if (pesoKg <= 1) return -1; // sobre, manejo aparte
  if (pesoKg > 3500) {
    // Excede tarifa de paquetería — se cotiza como camión completo (FCL).
    // Retornamos el último tramo como aproximación, con flag de aviso.
    return TARIFA_USD_KG.length - 1;
  }
  // Buscar el último tramo cuyo límiteInferiorKg sea ≤ pesoKg
  for (let i = TARIFA_USD_KG.length - 1; i >= 0; i--) {
    if (TARIFA_USD_KG[i].limiteInferiorKg <= pesoKg) return i;
  }
  return -1;
}

/**
 * Calcula el flete terrestre completo para un envío.
 *
 * Aplica la metodología DTD:
 * 1. Peso facturable = MAX(peso real, volumen × 200)
 * 2. Buscar zona del destino según origen
 * 3. Buscar tarifa USD/kg en tabla por zona × tramo de peso
 * 4. Aplicar multiplicador DTD (default 1.15x)
 * 5. Flete = peso × tarifa
 * 6. Sumar FPO 6% + seguro 3% (si valor declarado)
 * 7. IVA 16% sobre subtotal
 *
 * Casos especiales:
 * - Peso ≤ 1 kg → flete fijo USD 6.00 (sobre)
 * - Destino no encontrado → output con error, totales en 0
 * - Peso > 3500 kg → usa último tramo como aproximación
 */
export function calcularFleteTerrestre(
  input: FleteTerrestreInput,
): FleteTerrestreOutput {
  const {
    origen,
    destino,
    pesoRealKg,
    volumenM3 = 0,
    valorDeclaradoUsd = 0,
    multiplicadorDtd = MULTIPLICADOR_DTD_DEFAULT,
    modoCotizacion = "solo-terrestre",
  } = input;

  // Validación básica
  if (pesoRealKg < 0 || volumenM3 < 0 || valorDeclaradoUsd < 0) {
    return emptyOutput("Valores negativos no permitidos");
  }
  if (pesoRealKg === 0 && volumenM3 === 0) {
    return emptyOutput("Especifica peso o volumen");
  }

  // 1. Peso facturable
  const pesoVolumetricoKg = volumenM3 * FACTOR_VOLUMETRICO_KG_M3;
  const pesoFacturableKg = Math.max(pesoRealKg, pesoVolumetricoKg);
  const esSobre = pesoFacturableKg <= 1;

  // 2. Buscar zona del destino
  const mapaZonas = getMapaZonasParaOrigen(origen);
  const zona = mapaZonas[destino] ?? null;
  if (zona === null) {
    return {
      ...emptyOutput(`Destino "${destino}" no está en el mapa para origen "${origen}"`),
      pesoVolumetricoKg,
      pesoFacturableKg,
      esSobre,
      modoAplicado: modoCotizacion,
    };
  }

  // 3. Validar coherencia modo ↔ destino
  const esCasco = destinoEsCasco(destino);
  let modoAplicado: ModoCotizacionTerrestre = modoCotizacion;
  let warning: string | undefined;
  if (modoCotizacion === "cbm-casco" && !esCasco) {
    // Cliente dice "incluido en casco" pero destino NO es casco. Fallback a cbm-lejos.
    modoAplicado = "cbm-lejos";
    warning = `"${destino}" no está en el casco central. Aplicamos cotización CBM + lejos (con descuento parcial).`;
  } else if (modoCotizacion === "cbm-lejos" && esCasco) {
    // Cliente dice "lejos" pero destino SÍ es casco. Fallback a cbm-casco.
    modoAplicado = "cbm-casco";
    warning = `"${destino}" está en el casco central. Aplicamos cotización CBM + casco (sin costo).`;
  }

  // 4. Caso especial: CBM + destino en casco → todo gratis
  if (modoAplicado === "cbm-casco" && esCasco) {
    return {
      zona,
      pesoVolumetricoKg,
      pesoFacturableKg,
      esSobre,
      tramoAplicado: "Casco central CBM",
      tarifaBaseUsdKg: 0,
      tarifaDtdUsdKg: 0,
      fleteBaseUsd: 0,
      descuentoCascoUsd: 0,
      fpoUsd: 0,
      seguroUsd: 0,
      subtotalUsd: 0,
      ivaUsd: 0,
      totalUsd: 0,
      modoAplicado,
      notaCasco: `${destino} está incluido en tu flete CBM China-VZLA. Sin costo adicional.`,
      warning,
    };
  }

  // 5. Caso especial: sobre ≤ 1 kg → precio fijo (mismo en todos los modos)
  if (esSobre) {
    const fleteBaseUsd = PRECIO_SOBRE_HASTA_1KG_USD;
    const fpoUsd = fleteBaseUsd * FPO_PORCENTAJE;
    const seguroUsd = valorDeclaradoUsd * SEGURO_PORCENTAJE;
    const subtotalUsd = fleteBaseUsd + fpoUsd + seguroUsd;
    const ivaUsd = subtotalUsd * IVA_PORCENTAJE;
    return {
      zona,
      pesoVolumetricoKg,
      pesoFacturableKg,
      esSobre: true,
      tramoAplicado: "Sobre/paquete hasta 1 kg",
      tarifaBaseUsdKg: 0,
      tarifaDtdUsdKg: 0,
      fleteBaseUsd,
      descuentoCascoUsd: 0,
      fpoUsd,
      seguroUsd,
      subtotalUsd,
      ivaUsd,
      totalUsd: subtotalUsd + ivaUsd,
      modoAplicado,
      warning,
    };
  }

  // 6. Tramo de peso + tarifa por zona
  const tramoIdx = encontrarTramo(pesoFacturableKg);
  if (tramoIdx === -1) {
    return {
      ...emptyOutput("Peso fuera de rango"),
      zona,
      pesoVolumetricoKg,
      pesoFacturableKg,
      modoAplicado,
    };
  }
  const tramo = TARIFA_USD_KG[tramoIdx];
  const tarifaBaseUsdKg = tramo.tarifaPorZona[zona - 1] ?? 0;
  const tarifaDtdUsdKg = tarifaBaseUsdKg * multiplicadorDtd;

  // 7. Flete base
  let fleteBaseUsd = pesoFacturableKg * tarifaDtdUsdKg;

  // 8. Descuento por casco (solo en modo cbm-lejos)
  let descuentoCascoUsd = 0;
  if (modoAplicado === "cbm-lejos") {
    // Restar el equivalente al tramo casco (zona 1) — ese tramo ya está pagado por el CBM.
    const tarifaZona1UsdKg = tramo.tarifaPorZona[0]; // zona 1 = índice 0
    const tarifaZona1DtdUsdKg = tarifaZona1UsdKg * multiplicadorDtd;
    descuentoCascoUsd = pesoFacturableKg * tarifaZona1DtdUsdKg;
    // El flete neto no puede ser negativo
    fleteBaseUsd = Math.max(0, fleteBaseUsd - descuentoCascoUsd);
  }

  // 9. Cargos extra sobre flete neto
  const fpoUsd = fleteBaseUsd * FPO_PORCENTAJE;
  const seguroUsd = valorDeclaradoUsd * SEGURO_PORCENTAJE;
  const subtotalUsd = fleteBaseUsd + fpoUsd + seguroUsd;

  // 10. IVA
  const ivaUsd = subtotalUsd * IVA_PORCENTAJE;
  const totalUsd = subtotalUsd + ivaUsd;

  return {
    zona,
    pesoVolumetricoKg,
    pesoFacturableKg,
    esSobre: false,
    tramoAplicado: tramo.tramo,
    tarifaBaseUsdKg,
    tarifaDtdUsdKg,
    fleteBaseUsd,
    descuentoCascoUsd,
    fpoUsd,
    seguroUsd,
    subtotalUsd,
    ivaUsd,
    totalUsd,
    modoAplicado,
    notaCasco:
      modoAplicado === "cbm-lejos"
        ? `Descuento aplicado: el casco central (Valencia → Pto Cabello) ya está cubierto por tu CBM. Solo pagas el diferencial.`
        : undefined,
    warning,
  };
}

function emptyOutput(error: string): FleteTerrestreOutput {
  return {
    zona: null,
    pesoVolumetricoKg: 0,
    pesoFacturableKg: 0,
    esSobre: false,
    tramoAplicado: null,
    tarifaBaseUsdKg: 0,
    tarifaDtdUsdKg: 0,
    fleteBaseUsd: 0,
    descuentoCascoUsd: 0,
    fpoUsd: 0,
    seguroUsd: 0,
    subtotalUsd: 0,
    ivaUsd: 0,
    totalUsd: 0,
    modoAplicado: "solo-terrestre",
    error,
  };
}
