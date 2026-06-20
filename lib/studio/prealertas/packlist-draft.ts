/**
 * SDD-0097 (extiende SDD-0096) · Lógica PURA del borrador/historial del packing
 * list v4.4 que el proveedor edita en /p/{token}.
 *
 * El autoguardado + el historial viven en localStorage POR TOKEN (no global):
 * así dos órdenes distintas no se pisan el borrador. Acá van solo las funciones
 * puras (derivación de claves + recorte del historial) — sin React ni Web APIs,
 * para testearlas sin DOM. El componente cliente las usa y agrega el efecto de
 * persistir / restaurar.
 */

/** Tope de snapshots por orden (mismo cap que el prototipo del Norte). */
export const PACKLIST_HISTORY_CAP = 12;

/** Clave del borrador actual de una orden. POR TOKEN, nunca global. */
export function packlistDraftKey(token: string): string {
  return `dtd-packlist-${token}`;
}

/** Clave del historial (snapshots) de una orden. POR TOKEN. */
export function packlistHistoryKey(token: string): string {
  return `dtd-packlist-${token}-history`;
}

/** Una versión guardada: marca de tiempo + etiqueta + payload serializado. */
export type PacklistHistEntry = { t: number; label: string; data: string };

/**
 * Inserta un snapshot al frente del historial, deduplica contra el último
 * (si el payload no cambió, no agrega ruido) y recorta al cap. PURA: recibe el
 * historial previo y devuelve el nuevo (no muta la entrada).
 */
export function pushHistory(
  prev: PacklistHistEntry[],
  entry: PacklistHistEntry,
): PacklistHistEntry[] {
  if (prev.length > 0 && prev[0].data === entry.data) return prev;
  return [entry, ...prev].slice(0, PACKLIST_HISTORY_CAP);
}
