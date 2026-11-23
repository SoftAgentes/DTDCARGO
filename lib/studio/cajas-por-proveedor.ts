/**
 * Cajas de un embarque por proveedor (panel «Detalle del envío», Embarques).
 *
 * Lógica pura: recibe las recepciones consolidadas de un embarque y devuelve el
 * total y el desglose por proveedor, con cajas y CBM (m³) de cada uno. Cada
 * recepción trae su propio `total_cbm`; el de un proveedor es la suma de las suyas.
 *
 * Sin recepción no hay cifra: `cajasDeEnvio` devuelve `null`, y la pantalla dice
 * «Sin recepción» (nunca 0, decisión de Sam en la SDD-0661).
 */

export type RecepcionDeEnvio = {
  shipmentId: string;
  proveedor: string | null;
  cajas: number;
  cbm: number;
};

export type CajasDeProveedor = {
  /** `null` = la recepción no trae proveedor («Sin proveedor» en pantalla). */
  proveedor: string | null;
  cajas: number;
  cbm: number;
};

export type CajasDeEnvio = {
  totalCajas: number;
  totalCbm: number;
  proveedores: CajasDeProveedor[];
};

/** Lo que el panel sabe de las cajas de un embarque. */
export type EstadoCajas =
  | { estado: "listo"; datos: CajasDeEnvio }
  | { estado: "sin_recepcion" }
  | { estado: "no_disponible" };

/**
 * `mapa` `null` = la lectura falló (no se dice «Sin recepción», sería falso);
 * `undefined` = la página no la pidió.
 */
export function estadoDeCajas(
  mapa: Record<string, CajasDeEnvio> | null | undefined,
  shipmentId: string,
): EstadoCajas {
  if (!mapa) return { estado: "no_disponible" };
  const datos = mapa[shipmentId];
  return datos ? { estado: "listo", datos } : { estado: "sin_recepcion" };
}

function entero(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

function decimal(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Agrupa por nombre sin distinguir mayúsculas ni espacios sobrantes. */
function claveDeProveedor(nombre: string | null): string {
  return nombre === null ? "" : nombre.trim().toLowerCase();
}

/** Mapa envío → cajas; los envíos sin recepciones no aparecen. */
export function agruparCajasPorEnvio(
  recepciones: readonly RecepcionDeEnvio[],
): Record<string, CajasDeEnvio> {
  const porEnvio = new Map<string, Map<string, CajasDeProveedor>>();
  for (const r of recepciones) {
    const nombre = r.proveedor?.trim() ? r.proveedor.trim() : null;
    const lista = porEnvio.get(r.shipmentId) ?? new Map<string, CajasDeProveedor>();
    const clave = claveDeProveedor(nombre);
    const previo = lista.get(clave) ?? { proveedor: nombre, cajas: 0, cbm: 0 };
    previo.cajas += entero(r.cajas);
    previo.cbm += decimal(r.cbm);
    lista.set(clave, previo);
    porEnvio.set(r.shipmentId, lista);
  }

  const out: Record<string, CajasDeEnvio> = {};
  for (const [id, lista] of porEnvio) {
    const proveedores = [...lista.values()].sort(
      (a, b) =>
        b.cajas - a.cajas ||
        (a.proveedor ?? "￿").localeCompare(b.proveedor ?? "￿", "es"),
    );
    out[id] = {
      totalCajas: proveedores.reduce((s, p) => s + p.cajas, 0),
      totalCbm: proveedores.reduce((s, p) => s + p.cbm, 0),
      proveedores,
    };
  }
  return out;
}
