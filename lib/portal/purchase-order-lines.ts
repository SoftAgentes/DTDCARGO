/**
 * SDD-0172 · Las líneas de "Así queda tu orden a DTD — en vivo".
 *
 * Traduce (servicios elegidos + cuántas compras retiene el HOLD + si ese HOLD
 * arrastra re-empaque) a las frases en castellano que el cliente ve armarse
 * mientras llena el paso 1 — y que después viajan como la orden a DTD.
 *
 * Funciones PURAS, sin React ni Supabase: es la parte del panel que se puede
 * testear sin navegador. El Norte (`_norte/portal/app.jsx`, `orderLineFor`) es
 * la fuente de las frases; acá se conservan textuales.
 */

import type {
  PrealertaAddon,
  PrealertaAddonCode,
} from "@/lib/studio/prealertas/addons";

/** Pie de cada línea: el cobro es advisory, lo cierra el asesor (SDD-0098). */
export const ORDER_LINE_FEE = "Esto lo cotiza y coordina mi asesor.";

/** Rango del stepper de HOLD en el Norte: de 2 a 10 compras. */
export const HOLD_MIN = 2;
export const HOLD_MAX = 10;

export type PurchaseOrderLine = {
  code: PrealertaAddonCode;
  desc: string;
  fee: string;
};

/**
 * Frases del Norte, por código del catálogo de producción.
 *
 * `hold_consolidar` no está acá porque su frase depende de `holdCount`
 * (ver `holdOrderLine`), y `reempaque_unificar` cambia cuando viene atado al
 * HOLD (ver `buildPurchaseOrderLines`).
 */
const ORDER_LINE_BY_CODE: Partial<Record<PrealertaAddonCode, string>> = {
  verificacion:
    "Cuando llegue a bodega, cuéntenla contra mi factura y envíenme fotos.",
  inspeccion_recepcion:
    "Además, saquen una pieza por artículo y hagan una revisión técnica de calidad, según mis instrucciones.",
  etiquetado_pieza:
    "Pónganle a cada pieza su etiqueta o código de barras — que llegue lista para vender.",
  reempaque_unificar: "Únanme mis compras pequeñas en un solo packing list.",
};

/** Encierra el contador del HOLD en el rango que ofrece el stepper. */
export function clampHoldCount(n: unknown): number {
  const num = Math.trunc(Number(n));
  if (!Number.isFinite(num)) return HOLD_MIN;
  return Math.min(HOLD_MAX, Math.max(HOLD_MIN, num));
}

/**
 * La frase del HOLD depende de cuántas compras espera:
 *  - 2 (el default) → "con la próxima que llegue", que es como lo dice el cliente.
 *  - 3+            → el despacho queda en espera hasta juntar N.
 */
export function holdOrderLine(holdCount: number): string {
  const n = clampHoldCount(holdCount);
  return n <= HOLD_MIN
    ? "Retengan mi carga en bodega y unifíquenla con la próxima compra que llegue (2 en total)."
    : `Retengan mi carga en bodega y esperen hasta que lleguen ${n} compras en total antes de autorizar el despacho.`;
}

/** El re-empaque atado al HOLD nombra las compras que se están consolidando. */
export function reempaqueTiedOrderLine(holdCount: number): string {
  return `Reempaque de las ${clampHoldCount(holdCount)} compras que estoy consolidando en el HOLD.`;
}

/**
 * Última red: si el founder activa en el catálogo un servicio sin frase propia
 * (hoy `compactar` y `cotizar_medir` están apagados), el panel no se queda mudo
 * ni pinta el código crudo — pide el servicio por su nombre del catálogo.
 */
function fallbackLine(addon: PrealertaAddon): string {
  return `Quiero el servicio de ${addon.label.toLowerCase()} para esta compra.`;
}

/**
 * Arma las líneas de la orden.
 *
 * Orden: el del catálogo (`sort`), que es el mismo en que el cliente acaba de
 * ver las tarjetas — salvo una excepción: con `holdTie`, la línea del HOLD va
 * SIEMPRE antes que la del re-empaque, porque esa frase dice "en el HOLD" y
 * leerla antes no se entiende. En el catálogo de hoy `reempaque_unificar`
 * (sort 30) viene antes que `hold_consolidar` (sort 70), así que el caso es real.
 */
export function buildPurchaseOrderLines({
  addons,
  selected,
  holdCount = HOLD_MIN,
  holdTie = false,
}: {
  /** Catálogo activo, tal como lo devuelve la DB (ya ordenado por `sort`). */
  addons: PrealertaAddon[];
  /** Códigos que el cliente marcó. */
  selected: Iterable<PrealertaAddonCode>;
  holdCount?: number;
  holdTie?: boolean;
}): PurchaseOrderLine[] {
  const picked = new Set(selected);
  // El acople es una promesa de la tarjeta de HOLD: si está tildado, el
  // re-empaque entra aunque el cliente no lo haya marcado aparte.
  const tie = holdTie && picked.has("hold_consolidar");
  if (tie) picked.add("reempaque_unificar");

  const lines: PurchaseOrderLine[] = [];
  for (const addon of addons) {
    if (!picked.has(addon.code)) continue;
    let desc: string;
    if (addon.code === "hold_consolidar") {
      desc = holdOrderLine(holdCount);
    } else if (addon.code === "reempaque_unificar" && tie) {
      desc = reempaqueTiedOrderLine(holdCount);
    } else {
      desc = ORDER_LINE_BY_CODE[addon.code] ?? fallbackLine(addon);
    }
    lines.push({ code: addon.code, desc, fee: ORDER_LINE_FEE });
  }

  if (tie) {
    const hold = lines.findIndex((l) => l.code === "hold_consolidar");
    const reempaque = lines.findIndex((l) => l.code === "reempaque_unificar");
    if (hold > reempaque && reempaque !== -1) {
      const [moved] = lines.splice(hold, 1);
      lines.splice(reempaque, 0, moved);
    }
  }

  return lines;
}
