/**
 * Tarifas de transporte terrestre Venezuela — data canónica DTD.
 *
 * Fuentes:
 * - Fletes GAG (PDFs 2026): 4 orígenes (Maracay, Caracas, Pto Ordaz, Coro)
 * - Valencia DTD: mapa propio validado por el equipo DTD (2026-05-22)
 *
 * Vigencia: 01-Mayo-2026
 * Próxima revisión: Agosto 2026
 *
 * Para actualizar: editar este archivo y correr tests + typecheck.
 * NO importar en client components que excedan el bundle — son ~5KB de JSON.
 *
 * Ver `docs/specs/0002-calculadora-flete-terrestre/spec.md` para metodología.
 */

export const ORIGENES_DISPONIBLES = [
  "Valencia",
  "Maracay",
  "Caracas",
  "Puerto Ordaz",
  "Coro",
] as const;

export type Origen = (typeof ORIGENES_DISPONIBLES)[number];

/**
 * Mapa Valencia → destino → zona (1-11).
 * Validado por equipo operaciones DTD. Esta es la fuente de verdad para
 * cotizaciones DTD desde Valencia (sede), donde llega la carga via Pto Cabello.
 */
export const VALENCIA_ZONAS: Record<string, number> = {
  // Zona 1 — Valencia + corredor inmediato (0-80km)
  Valencia: 1, Guacara: 1, "San Joaquin": 1, Naguanagua: 1,
  "Ciudad Alianza": 1, Mariara: 1, "Puerto Cabello": 1, Maracay: 1,
  // Zona 2 — Carabobo + Aragua + Falcon sur (80-150km)
  Tucacas: 2, Cagua: 2, Turmero: 2, "Villa de Cura": 2,
  "San Felipe": 2, Yaritagua: 2, Mamo: 2, "Santa Cruz": 2, "La Victoria": 2,
  // Zona 3 — Capital + Falcon + Lara (150-300km)
  Chivacoa: 3, Caracas: 3, "La Guaira": 3, Maiquetia: 3,
  "Catia La Mar": 3, Caraballeda: 3, "San Antonio de Los Altos": 3,
  "Los Teques": 3, Guarenas: 3, Guatire: 3,
  Barquisimeto: 3, Cabudare: 3, Acarigua: 3, Araure: 3,
  Coro: 3, "Punta Cardon": 3, "Punto Fijo": 3,
  // Zona 4 — Llanos centrales (300-500km)
  "Valles del Tuy": 4, Carora: 4, Turen: 4, Ospino: 4, Guanare: 4,
  // Zona 5 — Oriente + Andes baja + Zulia este (500-800km)
  Barcelona: 5, "Puerto La Cruz": 5, Lecherias: 5, Guanta: 5,
  Barinas: 5, Trujillo: 5, Valera: 5,
  Cabimas: 5, "Ciudad Ojeda": 5, Maracaibo: 5,
  // Zona 6 — Andes + Oriente medio (800-1100km)
  Merida: 6, Ejido: 6, "El Vigia": 6, "Caja Seca": 6,
  "Sabana de Mendoza": 6, "Agua Viva": 6, Barinitas: 6,
  Maturin: 6, Anaco: 6, "El Tigre": 6, "El Tigrito": 6,
  "San Mateo (Anzoategui)": 6, Cantaura: 6, "San Tome": 6,
  "Santa Barbara del Zulia": 6,
  // Zona 7 — Periferia (1100-1400km)
  "San Cristobal": 7, "La Fria": 7, Tariba: 7, Colon: 7,
  Coloncito: 7, Capacho: 7,
  "Puerto Ordaz": 7, "San Felix": 7, "Ciudad Bolivar": 7,
  "Buena Vista": 7, Unare: 7,
  // Zona 8 — Frontera (>1400km)
  Urena: 8, Rubio: 8,
  // Zona 11 — Isla
  Porlamar: 11,
};

/**
 * Mapas de Fletes GAG (4 orígenes oficiales).
 * Para futuro: cuando DTD quiera cotizar desde otra ciudad que no sea Valencia.
 */
export const FLETES_GAG_ZONAS: Record<Exclude<Origen, "Valencia">, Record<string, number>> = {
  Maracay: {
    Acarigua: 4, "Agua Viva": 6, Anaco: 6, Araure: 4, Barcelona: 5,
    Barinas: 5, Barinitas: 5, Barquisimeto: 4, "Buena Vista": 6, Cabimas: 6,
    Cabudare: 4, Cagua: 2, "Caja Seca": 6, Cantaura: 6, Capacho: 7,
    Caraballeda: 3, Caracas: 2, "Catia La Mar": 3, "Ciudad Alianza": 2,
    "Ciudad Bolivar": 7, "Ciudad Ojeda": 6, Colon: 5, Coloncito: 5,
    Coro: 4, Chivacoa: 3, Ejido: 5, "El Tigre": 6, "El Tigrito": 6,
    "El Vigia": 5, Guacara: 2, Guanare: 5, Guanta: 5, Guarenas: 3,
    Guatire: 3, "La Fria": 5, "La Guaira": 3, "La Victoria": 2, Lecherias: 5,
    "Los Teques": 3, Maiquetia: 3, Mamo: 3, Maracaibo: 5, Maracay: 1,
    Maturin: 8, Merida: 6, Naguanagua: 2, Porlamar: 11, "Puerto Cabello": 2,
    "Puerto Ordaz": 8, "Puerto La Cruz": 5, "Punta Cardon": 4, "Punto Fijo": 4, Rubio: 7,
    "Sabana de Mendoza": 6, "San Antonio de Los Altos": 3, "San Cristobal": 6,
    "San Felix": 8, "San Felipe": 3, "San Joaquin": 2, "San Mateo (Anzoategui)": 6, "San Tome": 6,
    "Santa Barbara del Zulia": 6, "Santa Cruz": 2, Tariba: 6, Tucacas: 4,
    Turmero: 2, Trujillo: 6, Unare: 8, Valencia: 2, Valera: 6,
    "Valles del Tuy": 3, "Villa de Cura": 2, Yaritagua: 3, Mariara: 2, Urena: 7,
  },
  Caracas: {
    Acarigua: 5, "Agua Viva": 7, Anaco: 5, Araure: 5, Barcelona: 4,
    Barinas: 6, Barinitas: 6, Barquisimeto: 4, "Buena Vista": 7, Cabimas: 7,
    Cabudare: 4, Cagua: 3, "Caja Seca": 7, Cantaura: 5, Capacho: 8,
    Caraballeda: 2, Caracas: 1, "Catia La Mar": 2, "Ciudad Alianza": 3,
    "Ciudad Bolivar": 7, "Ciudad Ojeda": 7, Colon: 8, Coloncito: 8,
    Coro: 5, Chivacoa: 4, Ejido: 6, "El Tigre": 5, "El Tigrito": 5,
    "El Vigia": 6, Guacara: 3, Guanare: 6, Guanta: 4, Guarenas: 2,
    Guatire: 2, "La Fria": 7, "La Guaira": 2, "La Victoria": 3, Lecherias: 4,
    "Los Teques": 1, Maiquetia: 2, Mamo: 2, Maracaibo: 7, Maracay: 2,
    Maturin: 6, Merida: 7, Naguanagua: 3, Porlamar: 11, "Puerto Cabello": 3,
    "Puerto Ordaz": 7, "Puerto La Cruz": 4, "Punta Cardon": 5, "Punto Fijo": 5, Rubio: 8,
    "Sabana de Mendoza": 7, "San Antonio de Los Altos": 1, "San Cristobal": 8,
    "San Felix": 7, "San Felipe": 4, "San Joaquin": 3, "San Mateo (Anzoategui)": 5, "San Tome": 5,
    "Santa Barbara del Zulia": 7, "Santa Cruz": 3, Tariba: 8, Tucacas: 5,
    Turmero: 3, Trujillo: 7, Unare: 7, Valencia: 3, Valera: 7,
    "Valles del Tuy": 2, "Villa de Cura": 3, Yaritagua: 4, Mariara: 3, Urena: 8,
  },
  "Puerto Ordaz": {
    Acarigua: 9, "Agua Viva": 10, Anaco: 3, Araure: 9, Barcelona: 4,
    Barinas: 9, Barinitas: 9, Barquisimeto: 9, "Buena Vista": 10, Cabimas: 10,
    Cabudare: 9, Cagua: 8, "Caja Seca": 10, Cantaura: 2, Capacho: 10,
    Caraballeda: 8, Caracas: 7, "Catia La Mar": 7, "Ciudad Alianza": 8,
    "Ciudad Bolivar": 2, "Ciudad Ojeda": 10, Colon: 9, Coloncito: 9,
    Coro: 9, Chivacoa: 9, Ejido: 9, "El Tigre": 3, "El Tigrito": 3,
    "El Vigia": 9, Guacara: 8, Guanare: 9, Guanta: 4, Guarenas: 7,
    Guatire: 7, "La Fria": 10, "La Guaira": 7, "La Victoria": 8, Lecherias: 4,
    "Los Teques": 7, Maiquetia: 7, Mamo: 7, Maracaibo: 10, Maracay: 8,
    Maturin: 3, Merida: 10, Naguanagua: 8, Porlamar: 11, "Puerto Cabello": 8,
    "Puerto Ordaz": 1, "Puerto La Cruz": 4, "Punta Cardon": 9, "Punto Fijo": 9, Rubio: 10,
    "Sabana de Mendoza": 10, "San Antonio de Los Altos": 7, "San Cristobal": 10,
    "San Felix": 1, "San Felipe": 9, "San Joaquin": 8, "San Mateo (Anzoategui)": 3, "San Tome": 3,
    "Santa Barbara del Zulia": 10, "Santa Cruz": 8, Tariba: 10, Tucacas: 9,
    Turmero: 8, Trujillo: 10, Unare: 1, Valencia: 8, Valera: 10,
    "Valles del Tuy": 8, "Villa de Cura": 8, Yaritagua: 9, Mariara: 8, Urena: 10,
  },
  Coro: {
    Acarigua: 5, "Agua Viva": 7, Anaco: 8, Araure: 5, Barcelona: 7,
    Barinas: 6, Barinitas: 6, Barquisimeto: 4, "Buena Vista": 7, Cabimas: 4,
    Cabudare: 4, Cagua: 4, "Caja Seca": 7, Cantaura: 8, Capacho: 8,
    Caraballeda: 5, Caracas: 5, "Catia La Mar": 5, "Ciudad Alianza": 4,
    "Ciudad Bolivar": 9, "Ciudad Ojeda": 4, Colon: 8, Coloncito: 8,
    Coro: 1, Chivacoa: 5, Ejido: 7, "El Tigre": 8, "El Tigrito": 8,
    "El Vigia": 7, Guacara: 5, Guanare: 6, Guanta: 7, Guarenas: 5,
    Guatire: 5, "La Fria": 8, "La Guaira": 5, "La Victoria": 4, Lecherias: 7,
    "Los Teques": 5, Maiquetia: 5, Mamo: 5, Maracaibo: 3, Maracay: 4,
    Maturin: 9, Merida: 7, Naguanagua: 4, Porlamar: 11, "Puerto Cabello": 4,
    "Puerto Ordaz": 9, "Puerto La Cruz": 7, "Punta Cardon": 1, "Punto Fijo": 1, Rubio: 8,
    "Sabana de Mendoza": 7, "San Antonio de Los Altos": 5, "San Cristobal": 8,
    "San Felix": 9, "San Felipe": 5, "San Joaquin": 4, "San Mateo (Anzoategui)": 8, "San Tome": 8,
    "Santa Barbara del Zulia": 7, "Santa Cruz": 4, Tariba: 9, Tucacas: 1,
    Turmero: 4, Trujillo: 7, Unare: 9, Valencia: 4, Valera: 7,
    "Valles del Tuy": 6, "Villa de Cura": 4, Yaritagua: 5, Mariara: 4, Urena: 8,
  },
};

/**
 * Tabla USD/kg por zona (1-11) × tramo de peso (33 tramos).
 * Idéntica en los 4 PDFs Fletes GAG vigentes 01-May-2026.
 */
export interface TramoTarifa {
  /** Descripción human-readable: "1.01 a 2", "100.01 a 200", etc. */
  tramo: string;
  /** Límite inferior numérico (inclusive). Para encontrar el tramo de un peso dado. */
  limiteInferiorKg: number;
  /** Tarifa USD/kg para cada zona (índice 0 = zona 1, índice 10 = zona 11). */
  tarifaPorZona: readonly number[];
}

export const TARIFA_USD_KG: readonly TramoTarifa[] = [
  { tramo: "1.01 a 2",       limiteInferiorKg: 1.01,    tarifaPorZona: [3.21, 3.34, 3.45, 3.57, 3.70, 3.81, 3.93, 4.05, 4.17, 4.28, 4.41] },
  { tramo: "2.01 a 3",       limiteInferiorKg: 2.01,    tarifaPorZona: [3.10, 2.98, 3.10, 3.21, 3.34, 3.45, 3.57, 3.70, 3.81, 3.93, 4.05] },
  { tramo: "3.01 a 4",       limiteInferiorKg: 3.01,    tarifaPorZona: [2.98, 3.10, 3.21, 3.34, 3.45, 3.57, 3.70, 3.81, 3.93, 4.05, 4.17] },
  { tramo: "4.01 a 5",       limiteInferiorKg: 4.01,    tarifaPorZona: [2.38, 2.50, 2.61, 2.74, 2.86, 2.98, 3.10, 3.21, 3.34, 3.45, 3.57] },
  { tramo: "5.01 a 6",       limiteInferiorKg: 5.01,    tarifaPorZona: [2.26, 2.38, 2.50, 2.61, 2.74, 2.86, 2.98, 3.10, 3.21, 3.34, 3.45] },
  { tramo: "6.01 a 7",       limiteInferiorKg: 6.01,    tarifaPorZona: [2.03, 2.14, 2.26, 2.38, 2.50, 2.61, 2.74, 2.86, 2.98, 3.10, 3.21] },
  { tramo: "7.01 a 8",       limiteInferiorKg: 7.01,    tarifaPorZona: [1.67, 1.79, 1.90, 2.03, 2.14, 2.26, 2.38, 2.50, 2.61, 2.74, 2.86] },
  { tramo: "8.01 a 9",       limiteInferiorKg: 8.01,    tarifaPorZona: [1.43, 1.54, 1.67, 1.79, 1.90, 2.03, 2.14, 2.26, 2.38, 2.50, 2.61] },
  { tramo: "9.01 a 10",      limiteInferiorKg: 9.01,    tarifaPorZona: [1.31, 1.43, 1.54, 1.67, 1.79, 1.90, 2.03, 2.14, 2.26, 2.38, 2.52] },
  { tramo: "10.01 a 11",     limiteInferiorKg: 10.01,   tarifaPorZona: [1.19, 1.31, 1.43, 1.54, 1.67, 1.79, 1.90, 2.03, 2.14, 2.26, 2.38] },
  { tramo: "11.01 a 20",     limiteInferiorKg: 11.01,   tarifaPorZona: [1.07, 1.18, 1.28, 1.40, 1.50, 1.61, 1.71, 1.83, 1.93, 2.04, 2.14] },
  { tramo: "20.01 a 30",     limiteInferiorKg: 20.01,   tarifaPorZona: [1.01, 1.11, 1.22, 1.31, 1.42, 1.52, 1.62, 1.72, 1.83, 1.92, 2.03] },
  { tramo: "30.01 a 60",     limiteInferiorKg: 30.01,   tarifaPorZona: [0.89, 0.99, 1.07, 1.17, 1.25, 1.34, 1.43, 1.52, 1.61, 1.70, 1.79] },
  { tramo: "60.01 a 100",    limiteInferiorKg: 60.01,   tarifaPorZona: [0.83, 0.91, 1.00, 1.08, 1.17, 1.25, 1.33, 1.42, 1.50, 1.59, 1.67] },
  { tramo: "100.01 a 200",   limiteInferiorKg: 100.01,  tarifaPorZona: [0.69, 0.76, 0.83, 0.90, 0.97, 1.04, 1.10, 1.18, 1.24, 1.31, 1.39] },
  { tramo: "200.01 a 300",   limiteInferiorKg: 200.01,  tarifaPorZona: [0.65, 0.72, 0.79, 0.85, 0.91, 0.99, 1.05, 1.11, 1.18, 1.25, 1.31] },
  { tramo: "300.01 a 400",   limiteInferiorKg: 300.01,  tarifaPorZona: [0.60, 0.65, 0.71, 0.78, 0.83, 0.89, 0.96, 1.01, 1.07, 1.13, 1.19] },
  { tramo: "400.01 a 500",   limiteInferiorKg: 400.01,  tarifaPorZona: [0.54, 0.59, 0.64, 0.69, 0.75, 0.81, 0.86, 0.91, 0.97, 1.02, 1.07] },
  { tramo: "500.01 a 600",   limiteInferiorKg: 500.01,  tarifaPorZona: [0.42, 0.46, 0.50, 0.55, 0.59, 0.63, 0.67, 0.70, 0.75, 0.79, 0.83] },
  { tramo: "600.01 a 700",   limiteInferiorKg: 600.01,  tarifaPorZona: [0.38, 0.42, 0.46, 0.49, 0.54, 0.57, 0.61, 0.65, 0.68, 0.72, 0.77] },
  { tramo: "700.01 a 800",   limiteInferiorKg: 700.01,  tarifaPorZona: [0.37, 0.41, 0.44, 0.48, 0.51, 0.56, 0.59, 0.63, 0.66, 0.70, 0.74] },
  { tramo: "800.01 a 900",   limiteInferiorKg: 800.01,  tarifaPorZona: [0.36, 0.39, 0.43, 0.46, 0.50, 0.54, 0.57, 0.61, 0.64, 0.68, 0.71] },
  { tramo: "900.01 a 1000",  limiteInferiorKg: 900.01,  tarifaPorZona: [0.29, 0.33, 0.36, 0.39, 0.42, 0.45, 0.47, 0.50, 0.54, 0.57, 0.60] },
  { tramo: "1000.01 a 1100", limiteInferiorKg: 1000.01, tarifaPorZona: [0.27, 0.30, 0.33, 0.36, 0.39, 0.41, 0.44, 0.46, 0.49, 0.53, 0.55] },
  { tramo: "1100.01 a 1200", limiteInferiorKg: 1100.01, tarifaPorZona: [0.26, 0.28, 0.32, 0.34, 0.37, 0.39, 0.42, 0.44, 0.47, 0.49, 0.53] },
  { tramo: "1200.01 a 1300", limiteInferiorKg: 1200.01, tarifaPorZona: [0.24, 0.26, 0.28, 0.30, 0.34, 0.36, 0.38, 0.41, 0.43, 0.45, 0.47] },
  { tramo: "1300.01 a 1400", limiteInferiorKg: 1300.01, tarifaPorZona: [0.23, 0.25, 0.27, 0.29, 0.32, 0.34, 0.36, 0.39, 0.41, 0.43, 0.45] },
  { tramo: "1400.01 a 1500", limiteInferiorKg: 1400.01, tarifaPorZona: [0.21, 0.23, 0.25, 0.28, 0.30, 0.33, 0.35, 0.37, 0.39, 0.41, 0.43] },
  { tramo: "1500.01 a 1750", limiteInferiorKg: 1500.01, tarifaPorZona: [0.20, 0.22, 0.24, 0.26, 0.28, 0.30, 0.33, 0.35, 0.37, 0.39, 0.41] },
  { tramo: "1750.01 a 2000", limiteInferiorKg: 1750.01, tarifaPorZona: [0.19, 0.21, 0.23, 0.25, 0.26, 0.28, 0.30, 0.33, 0.35, 0.36, 0.38] },
  { tramo: "2000.01 a 2500", limiteInferiorKg: 2000.01, tarifaPorZona: [0.18, 0.20, 0.21, 0.23, 0.25, 0.27, 0.28, 0.30, 0.33, 0.34, 0.36] },
  { tramo: "2500.01 a 3000", limiteInferiorKg: 2500.01, tarifaPorZona: [0.17, 0.18, 0.20, 0.22, 0.23, 0.25, 0.26, 0.28, 0.30, 0.32, 0.34] },
  { tramo: "3000.01 a 3500", limiteInferiorKg: 3000.01, tarifaPorZona: [0.16, 0.17, 0.19, 0.20, 0.22, 0.23, 0.25, 0.28, 0.28, 0.29, 0.30] },
];

/** Devuelve el mapa destino→zona para un origen dado. */
export function getMapaZonasParaOrigen(origen: Origen): Record<string, number> {
  if (origen === "Valencia") return VALENCIA_ZONAS;
  return FLETES_GAG_ZONAS[origen];
}

/** Lista de destinos disponibles para un origen. */
export function getDestinosDisponibles(origen: Origen): string[] {
  return Object.keys(getMapaZonasParaOrigen(origen)).sort();
}

// ─── Constantes metodología DTD ─────────────────────────────────────
/** Factor para convertir m³ a kg equivalente. 200 = estándar Fletes GAG. */
export const FACTOR_VOLUMETRICO_KG_M3 = 200;
/** Multiplicador DTD sobre tarifa Fletes GAG. 1.15 = +15% margen comercial. */
export const MULTIPLICADOR_DTD_DEFAULT = 1.15;
/** Precio fijo para sobres/paquetes hasta 1 kg. */
export const PRECIO_SOBRE_HASTA_1KG_USD = 6.0;
/** % Franqueo Postal Obligatorio sobre flete. */
export const FPO_PORCENTAJE = 0.06;
/** % Seguro sobre valor declarado (opcional). */
export const SEGURO_PORCENTAJE = 0.03;
/** % IVA Venezuela. */
export const IVA_PORCENTAJE = 0.16;
