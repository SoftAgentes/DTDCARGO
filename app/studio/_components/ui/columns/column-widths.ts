/**
 * Anchos de columna ajustables · lógica pura (SDD-0520).
 *
 * Sin React ni DOM: el hook `useColumnWidths` y el asa `ColumnResizeHandle`
 * (`ColumnResize.tsx`) la usan, y se prueba aparte (`column-widths.test.ts`).
 *
 * Contrato:
 *  - Cada tabla declara sus columnas con ancho por defecto, mínimo y máximo en
 *    px. El arreglo vive en el módulo y NO se persiste; el `key` es el contrato.
 *  - El estado (`ColumnWidths`) guarda SOLO los anchos que el usuario fijó. Una
 *    columna sin entrada usa su default, así que si mañana cambia un default,
 *    quien nunca tocó esa columna lo recibe. Eso mismo es lo que se persiste,
 *    bajo una clave versionada del módulo (`dtd-<modulo>-col-widths-v1`).
 *  - Al leer, lo guardado que no sirve se ignora sin romper nada: JSON corrupto,
 *    algo que no sea un objeto, columnas desconocidas o no ajustables, valores
 *    que no son número y valores fuera de [mínimo, máximo]. Ignorar, no recortar:
 *    un valor fuera de rango no lo escribió esta versión de la tabla.
 *  - Lo que escribe el usuario (arrastre o teclado) SÍ se recorta al rango.
 *  - Columnas `grow`: la PRIMERA que el usuario no fijó toma
 *    `minmax(<ancho>px, 1fr)` y absorbe el espacio que sobra; su ancho es el
 *    piso por debajo del cual la tabla hace scroll en vez de aplastarla. Si el
 *    usuario la fija, queda exacta y el espacio libre pasa a la siguiente `grow`
 *    (típicamente la de acciones, al final). Nunca crecen dos a la vez.
 */

export type ColumnWidthSpec = {
  /** Identificador estable; es la llave de lo guardado. */
  key: string;
  /** Nombre visible de la columna; el asa se llama «Ajustar ancho de <label>». */
  label: string;
  /** Ancho sin ajustar. En una columna `grow` es el piso mientras crece. */
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** `false` = ancho fijo, sin asa; lo guardado para ella se ignora. Por defecto `true`. */
  resizable?: boolean;
  /** Puede absorber el espacio sobrante (ver el contrato arriba). */
  grow?: boolean;
};

/** Anchos que el usuario fijó, por `key`. Sin entrada = default. */
export type ColumnWidths = Readonly<Record<string, number>>;

/** Paso de ArrowLeft / ArrowRight sobre el asa: múltiplo de la escala de 4 px. */
export const COLUMN_WIDTH_STEP = 16;

export const NO_COLUMN_WIDTHS: ColumnWidths = Object.freeze({});

export function isResizable(spec: ColumnWidthSpec): boolean {
  return spec.resizable !== false;
}

function specFor(
  specs: readonly ColumnWidthSpec[],
  key: string,
): ColumnWidthSpec | undefined {
  return specs.find((s) => s.key === key);
}

function hasOverride(widths: ColumnWidths, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(widths, key);
}

/** Recorta al rango de la columna y redondea a px enteros. Lo no numérico vuelve al default. */
export function clampColumnWidth(spec: ColumnWidthSpec, value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return spec.defaultWidth;
  return Math.min(spec.maxWidth, Math.max(spec.minWidth, Math.round(value)));
}

/** Ancho en uso: el que fijó el usuario o el default. */
export function effectiveColumnWidth(spec: ColumnWidthSpec, widths: ColumnWidths): number {
  if (isResizable(spec) && hasOverride(widths, spec.key)) return widths[spec.key];
  return spec.defaultWidth;
}

/** La columna que absorbe el espacio libre ahora, o `null` si ninguna. */
export function flexColumnKey(
  specs: readonly ColumnWidthSpec[],
  widths: ColumnWidths,
): string | null {
  const s = specs.find(
    (c) => c.grow && !(isResizable(c) && hasOverride(widths, c.key)),
  );
  return s ? s.key : null;
}

/**
 * Lee lo guardado. Nunca lanza: devuelve sólo las entradas válidas (o ninguna
 * si el contenido entero es inválido).
 */
export function parseStoredColumnWidths(
  raw: string | null | undefined,
  specs: readonly ColumnWidthSpec[],
): ColumnWidths {
  if (!raw) return NO_COLUMN_WIDTHS;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return NO_COLUMN_WIDTHS;
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return NO_COLUMN_WIDTHS;
  const record = saved as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const s of specs) {
    if (!isResizable(s)) continue;
    if (!Object.prototype.hasOwnProperty.call(record, s.key)) continue;
    const v = record[s.key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const px = Math.round(v);
    if (px < s.minWidth || px > s.maxWidth) continue;
    out[s.key] = px;
  }
  return out;
}

/** Lo que se guarda: los anchos fijados y válidos. `null` = no hay nada que guardar. */
export function serializeColumnWidths(
  widths: ColumnWidths,
  specs: readonly ColumnWidthSpec[],
): string | null {
  const out: Record<string, number> = {};
  let any = false;
  for (const s of specs) {
    if (!isResizable(s) || !hasOverride(widths, s.key)) continue;
    out[s.key] = clampColumnWidth(s, widths[s.key]);
    any = true;
  }
  return any ? JSON.stringify(out) : null;
}

export function isCustomized(
  widths: ColumnWidths,
  specs: readonly ColumnWidthSpec[],
): boolean {
  return serializeColumnWidths(widths, specs) !== null;
}

/** Fija el ancho de una columna, recortado a su rango. Columna desconocida o fija: sin cambio. */
export function setColumnWidth(
  widths: ColumnWidths,
  specs: readonly ColumnWidthSpec[],
  key: string,
  value: number,
): ColumnWidths {
  const spec = specFor(specs, key);
  if (!spec || !isResizable(spec)) return widths;
  const px = clampColumnWidth(spec, value);
  if (hasOverride(widths, key) && widths[key] === px) return widths;
  return { ...widths, [key]: px };
}

/** La columna vuelve a su default (y, si es `grow`, a absorber el espacio libre). */
export function resetColumnWidth(widths: ColumnWidths, key: string): ColumnWidths {
  if (!hasOverride(widths, key)) return widths;
  const next: Record<string, number> = { ...widths };
  delete next[key];
  return next;
}

/**
 * Ancho que deja una tecla sobre el asa (patrón «window splitter» del APG):
 * ArrowLeft/ArrowRight un paso, Home el mínimo, End el máximo. `null` = la
 * tecla no es del asa y se deja pasar.
 */
export function widthForKey(
  spec: ColumnWidthSpec,
  current: number,
  key: string,
  step: number = COLUMN_WIDTH_STEP,
): number | null {
  switch (key) {
    case "ArrowLeft":
      return clampColumnWidth(spec, current - step);
    case "ArrowRight":
      return clampColumnWidth(spec, current + step);
    case "Home":
      return spec.minWidth;
    case "End":
      return spec.maxWidth;
    default:
      return null;
  }
}

/** Valor de `grid-template-columns`: un solo template para encabezado y filas. */
export function columnGridTemplate(
  specs: readonly ColumnWidthSpec[],
  widths: ColumnWidths,
): string {
  const flex = flexColumnKey(specs, widths);
  return specs
    .map((s) => {
      const w = effectiveColumnWidth(s, widths);
      return s.key === flex ? `minmax(${w}px, 1fr)` : `${w}px`;
    })
    .join(" ");
}

/** Suma de los anchos en uso (sin gaps ni padding): el piso desde el que la tabla hace scroll. */
export function columnsTotalWidth(
  specs: readonly ColumnWidthSpec[],
  widths: ColumnWidths,
): number {
  return specs.reduce((sum, s) => sum + effectiveColumnWidth(s, widths), 0);
}
