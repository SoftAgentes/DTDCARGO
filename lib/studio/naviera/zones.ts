/**
 * SDD-0152 · Modelo de zonas del contenedor + proyección isométrica.
 *
 * Lógica PURA (sin React, sin Supabase) → testeable. La consume tanto el visor
 * isométrico del Studio como la grilla plana del operario.
 *
 * El contenedor se modela como una grilla gruesa, NO como geometría real:
 *   · nx = tramos a lo largo   (0 = fondo … n-1 = puerta)
 *   · ny = niveles de altura   (0 = piso … n-1 = arriba)
 *   · nz = tramos a lo ancho   (0 = izquierda … n-1 = derecha)
 *
 * Por eso no se miden los bultos (largo/ancho/alto) ni hace falta bin-packing:
 * el operario escanea y tapea una zona. Espejo de `container_types.zone_layout`
 * (migración 0241).
 */

export type ZoneLayout = { nx: number; ny: number; nz: number };

/**
 * 3 × 1 × 3 = 9 áreas. Espejo de lo que deja la migración 0294 para los 40'.
 *
 * SDD-0184: la altura NO se usa. 0241 había sembrado ny=2, pero el modelo por
 * lotes de SDD-0155 solo deja elegir izquierda/centro/derecha y la interfaz nunca
 * muestra niveles. Planificar sobre una dimensión que nadie ve es ruido.
 */
export const DEFAULT_ZONE_LAYOUT: ZoneLayout = { nx: 3, ny: 1, nz: 3 };

export type ZoneCoord = { zx: number; zy: number; zz: number };

/** Una caja en su zona, tal como la devuelve `getConsolidationStuffing`. */
export type StuffedBox = ZoneCoord & {
  boxId: string;
  code: string;
  markbox: string | null;
  clientName: string | null;
  seq: number;
};

// ─────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────

export function isZoneLayout(v: unknown): v is ZoneLayout {
  if (!v || typeof v !== "object") return false;
  const l = v as Partial<ZoneLayout>;
  return (
    Number.isInteger(l.nx) &&
    Number.isInteger(l.ny) &&
    Number.isInteger(l.nz) &&
    (l.nx as number) >= 1 &&
    (l.ny as number) >= 1 &&
    (l.nz as number) >= 1
  );
}

/** Tolera jsonb crudo de la DB; cae al default si viene raro. */
export function parseZoneLayout(v: unknown): ZoneLayout {
  if (isZoneLayout(v)) return { nx: v.nx, ny: v.ny, nz: v.nz };
  return DEFAULT_ZONE_LAYOUT;
}

export function zoneCount(layout: ZoneLayout): number {
  return layout.nx * layout.ny * layout.nz;
}

// ─────────────────────────────────────────────────────────────
// SDD-0155 · Modelo por LOTES (reemplaza la grilla fija de 0152)
// ─────────────────────────────────────────────────────────────
// En el modelo por lotes la profundidad NO es fija: la da el orden de carga
// (load_order = zx), y crece con cada lote montado. El ancho es 3 (izq/centro/
// der = zz) y no hay altura (zy = 0). El layout se DERIVA de los datos, no de
// container_types — así el visor nunca asume un máximo de profundidad (el bug
// que el review adversarial marcó: `zx < nx` con nx fijo en 3).

/** Ancho fijo del modelo por lotes: izquierda · centro · derecha. */
export const LOT_WIDTH = 3;

/**
 * Layout derivado de lo que ya está montado. `nx` = cuántas cargas en profundidad
 * hay (mínimo `minDepth`, para que el contenedor vacío no colapse a 0). `ny` = 1
 * (una capa). `nz` = 3.
 */
export function layoutFromStuffing(
  boxes: readonly ZoneCoord[],
  minDepth = 1,
): ZoneLayout {
  let maxZx = -1;
  for (const b of boxes) if (b.zx > maxZx) maxZx = b.zx;
  return { nx: Math.max(minDepth, maxZx + 1), ny: 1, nz: LOT_WIDTH };
}

/**
 * Etiquetas de profundidad por orden de carga: la 0 es el Fondo, la última la
 * Puerta, las del medio "Carga N". Con una sola carga es "Fondo".
 */
export function lotDepthLabels(depth: number): string[] {
  if (depth <= 1) return ["Fondo"];
  return Array.from({ length: depth }, (_, i) => {
    if (i === 0) return "Fondo";
    if (i === depth - 1) return "Puerta";
    return `Carga ${i + 1}`;
  });
}

/** Izquierda / Centro / Derecha — lo único que elige el operario. */
export const LOT_WIDTH_LABELS = ["Izquierda", "Centro", "Derecha"] as const;

export function isZoneInLayout(layout: ZoneLayout, z: ZoneCoord): boolean {
  return (
    Number.isInteger(z.zx) &&
    Number.isInteger(z.zy) &&
    Number.isInteger(z.zz) &&
    z.zx >= 0 &&
    z.zx < layout.nx &&
    z.zy >= 0 &&
    z.zy < layout.ny &&
    z.zz >= 0 &&
    z.zz < layout.nz
  );
}

/** Espejo EXACTO de la columna generada `zone_code` de 0241. */
export function zoneCodeOf(z: ZoneCoord): string {
  return `L${z.zx}-H${z.zy}-W${z.zz}`;
}

// ─────────────────────────────────────────────────────────────
// Etiquetas · español VE
// ─────────────────────────────────────────────────────────────

/** Fondo/Medio/Puerta cuando son 3; si no, "Tramo N". */
export function lengthLabels(nx: number): string[] {
  if (nx === 3) return ["Fondo", "Medio", "Puerta"];
  if (nx === 2) return ["Fondo", "Puerta"];
  return Array.from({ length: nx }, (_, i) => `Tramo ${i + 1}`);
}

/** Izquierda/Centro/Derecha cuando son 3; si no, "Fila N". */
export function widthLabels(nz: number): string[] {
  if (nz === 3) return ["Izquierda", "Centro", "Derecha"];
  if (nz === 2) return ["Izquierda", "Derecha"];
  return Array.from({ length: nz }, (_, i) => `Fila ${i + 1}`);
}

/** Piso/Arriba cuando son 2; si no, "Nivel N". */
export function heightLabels(ny: number): string[] {
  if (ny === 2) return ["Piso", "Arriba"];
  if (ny === 3) return ["Piso", "Medio", "Arriba"];
  return Array.from({ length: ny }, (_, i) => `Nivel ${i + 1}`);
}

/** "Fondo · Izquierda · Piso" — para leyendas, aria-label y toasts. */
export function zoneLabel(layout: ZoneLayout, z: ZoneCoord): string {
  const l = lengthLabels(layout.nx)[z.zx] ?? `Tramo ${z.zx + 1}`;
  const w = widthLabels(layout.nz)[z.zz] ?? `Fila ${z.zz + 1}`;
  const h = heightLabels(layout.ny)[z.zy] ?? `Nivel ${z.zy + 1}`;
  return `${l} · ${w} · ${h}`;
}

/** Todas las zonas de la grilla, en orden estable. */
export function allZones(layout: ZoneLayout): ZoneCoord[] {
  const out: ZoneCoord[] = [];
  for (let zy = 0; zy < layout.ny; zy++) {
    for (let zx = 0; zx < layout.nx; zx++) {
      for (let zz = 0; zz < layout.nz; zz++) {
        out.push({ zx, zy, zz });
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Proyección isométrica
// ─────────────────────────────────────────────────────────────
// Sin motor 3D: 18 zonas ≈ 54 polígonos. three.js/Konva resuelven cargas ~400×
// mayores (sus benchmarks miden 8.000 cajas). Esto son 6 líneas de trigonometría
// y el visor renderiza en el servidor → 0 KB de JS al cliente.

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

export type Point = readonly [number, number];

/**
 * Proyecta un punto de la grilla (x, y, z) a coordenadas de pantalla.
 * +x va abajo-derecha · +z va abajo-izquierda · +y va hacia arriba.
 */
export function isoProject(
  x: number,
  y: number,
  z: number,
  cw: number,
  ch: number,
): Point {
  return [(x - z) * COS30 * cw, (x + z) * SIN30 * cw - y * ch];
}

export type CubeFaces = { top: Point[]; right: Point[]; left: Point[] };

/**
 * Las 3 caras visibles del cubo unitario en (x, y, z).
 * Desde este punto de vista se ven: la tapa, la cara +x (frontal-derecha) y la
 * cara +z (frontal-izquierda).
 */
export function cubeFaces(
  z: ZoneCoord,
  cw: number,
  ch: number,
): CubeFaces {
  const P = (a: number, b: number, c: number) => isoProject(a, b, c, cw, ch);
  const { zx: x, zy: y, zz: zz0 } = z;
  return {
    top: [
      P(x, y + 1, zz0),
      P(x + 1, y + 1, zz0),
      P(x + 1, y + 1, zz0 + 1),
      P(x, y + 1, zz0 + 1),
    ],
    right: [
      P(x + 1, y, zz0),
      P(x + 1, y + 1, zz0),
      P(x + 1, y + 1, zz0 + 1),
      P(x + 1, y, zz0 + 1),
    ],
    left: [
      P(x, y, zz0 + 1),
      P(x, y + 1, zz0 + 1),
      P(x + 1, y + 1, zz0 + 1),
      P(x + 1, y, zz0 + 1),
    ],
  };
}

/**
 * Algoritmo del pintor: de atrás-abajo hacia adelante-arriba. Sin esto, las
 * cajas del fondo se dibujan encima de las de la puerta y el volumen se rompe.
 */
export function painterSort<T extends ZoneCoord>(zones: readonly T[]): T[] {
  return [...zones].sort(
    (a, b) => a.zx + a.zy + a.zz - (b.zx + b.zy + b.zz),
  );
}

/** Encuadre del viewBox a partir de la geometría real de la grilla. */
export function isoViewBox(
  layout: ZoneLayout,
  cw: number,
  ch: number,
  pad: number,
): { minX: number; minY: number; width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const a of [0, layout.nx]) {
    for (const c of [0, layout.nz]) {
      for (const b of [0, layout.ny]) {
        const [sx, sy] = isoProject(a, b, c, cw, ch);
        xs.push(sx);
        ys.push(sy);
      }
    }
  }
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** `points` de un <polygon> SVG. */
export function svgPoints(pts: readonly Point[]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

// ─────────────────────────────────────────────────────────────
// Ocupación
// ─────────────────────────────────────────────────────────────

export type ZoneOccupancy = {
  filled: number;
  total: number;
  pct: number;
  /** MARKBOX → cuántas zonas ocupa. Orden estable (desc por cantidad). */
  byMarkbox: { markbox: string; clientName: string | null; zones: number }[];
};

export function zoneOccupancy(
  layout: ZoneLayout,
  boxes: readonly StuffedBox[],
): ZoneOccupancy {
  const total = zoneCount(layout);
  // Una zona puede recibir varias cajas; para "ocupación" cuenta la zona, no la caja.
  const cells = new Set(boxes.map((b) => zoneCodeOf(b)));
  const counts = new Map<string, { clientName: string | null; zones: Set<string> }>();

  for (const b of boxes) {
    const mb = b.markbox ?? "—";
    const entry = counts.get(mb) ?? { clientName: b.clientName, zones: new Set() };
    entry.zones.add(zoneCodeOf(b));
    counts.set(mb, entry);
  }

  const byMarkbox = [...counts.entries()]
    .map(([markbox, v]) => ({
      markbox,
      clientName: v.clientName,
      zones: v.zones.size,
    }))
    .sort((a, b) => b.zones - a.zones || a.markbox.localeCompare(b.markbox));

  return {
    filled: cells.size,
    total,
    pct: total > 0 ? (cells.size / total) * 100 : 0,
    byMarkbox,
  };
}
