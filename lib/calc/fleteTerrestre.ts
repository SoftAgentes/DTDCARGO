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
  getMapaZonasParaOrigen,
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
  /** Franqueo Postal Obligatorio = 6% del flete. */
  fpoUsd: number;
  /** Seguro = 3% del valor declarado. 0 si no se declaró valor. */
  seguroUsd: number;
  /** Subtotal = flete + FPO + seguro. */
  subtotalUsd: number;
  /** IVA = 16% del subtotal. */
  ivaUsd: number;
  /** Total final USD al cliente. */
  totalUsd: number;
  /** Si hay error en input (destino no existe, peso negativo, etc.). */
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

  // 2. Buscar zona
  const mapaZonas = getMapaZonasParaOrigen(origen);
  const zona = mapaZonas[destino] ?? null;
  if (zona === null) {
    return {
      ...emptyOutput(`Destino "${destino}" no está en el mapa para origen "${origen}"`),
      pesoVolumetricoKg,
      pesoFacturableKg,
      esSobre,
    };
  }

  // 3. Si es sobre, precio fijo
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
      fpoUsd,
      seguroUsd,
      subtotalUsd,
      ivaUsd,
      totalUsd: subtotalUsd + ivaUsd,
    };
  }

  // 4. Tramo de peso + tarifa por zona
  const tramoIdx = encontrarTramo(pesoFacturableKg);
  if (tramoIdx === -1) {
    return {
      ...emptyOutput("Peso fuera de rango"),
      zona,
      pesoVolumetricoKg,
      pesoFacturableKg,
    };
  }
  const tramo = TARIFA_USD_KG[tramoIdx];
  // Zona 1-11 → índice 0-10
  const tarifaBaseUsdKg = tramo.tarifaPorZona[zona - 1] ?? 0;
  const tarifaDtdUsdKg = tarifaBaseUsdKg * multiplicadorDtd;

  // 5. Flete
  const fleteBaseUsd = pesoFacturableKg * tarifaDtdUsdKg;

  // 6. Cargos extra
  const fpoUsd = fleteBaseUsd * FPO_PORCENTAJE;
  const seguroUsd = valorDeclaradoUsd * SEGURO_PORCENTAJE;
  const subtotalUsd = fleteBaseUsd + fpoUsd + seguroUsd;

  // 7. IVA
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
    fpoUsd,
    seguroUsd,
    subtotalUsd,
    ivaUsd,
    totalUsd,
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
    fpoUsd: 0,
    seguroUsd: 0,
    subtotalUsd: 0,
    ivaUsd: 0,
    totalUsd: 0,
    error,
  };
}
