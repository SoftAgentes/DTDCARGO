/**
 * SDD-0674 · regla transitoria EXC-0674 — Botón «Facturar» en Embarques.
 *
 * En los contenedores de la lista transitoria (hoy solo el 64), `accounting` y `admin` teclean el monto
 * de cada cliente (el TOTAL CON IVA, en USD) y emiten la factura real con la RPC `exc0674_facturar`
 * (migr 0564). Son los mismos roles que ya ven montos (0414, frontera SDD-0357): no se amplía quién ve
 * dinero. Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.»
 * `operations`, `commercial`, `warehouse`, `support` y `marketing` no ven nada de esto.
 *
 * Este módulo es puro (sin base): roles, parseo del monto y textos de error.
 */

import type { StudioUserRole } from "./user-types";

/** Roles que facturan por esta regla. La RLS y la RPC de la 0564 dicen lo mismo. */
export const ROLES_EXC0674: ReadonlySet<StudioUserRole> = new Set<StudioUserRole>([
  "accounting",
  "admin",
]);

export function rolFacturaExc0674(role: StudioUserRole | null | undefined): boolean {
  return !!role && ROLES_EXC0674.has(role);
}

/** Lo ya facturado de un cliente del contenedor, desde `exc0674_facturas`. */
export type FacturadoExc0674 = {
  invoiceCode: string;
  totalUsd: number;
  /** A quién se facturó (el aliado raíz si el cliente tiene uno). */
  billedMarkbox: string;
};

/**
 * Qué puede facturar quien mira. Solo llega si el rol es de la EXC-0674 (lo decide la página en el
 * servidor). `no_disponible` = no se pudo leer (por ejemplo, sin la 0564): no se pinta el botón.
 */
export type FacturacionExc0674 =
  | {
      estado: "lista";
      /** ids de `consolidations` en la lista transitoria. */
      contenedores: string[];
      /** contenedor → Shipping Mark (MAYÚSCULAS) → lo facturado. */
      facturados: Record<string, Record<string, FacturadoExc0674>>;
    }
  | { estado: "no_disponible" };

export function claveMarkbox(markbox: string | null | undefined): string {
  return (markbox ?? "").trim().toUpperCase();
}

/**
 * El monto que teclea la persona: el total con IVA, en dólares. Se acepta `1234`, `1234.5`,
 * `1234,56` y `1.234,56` / `1,234.56` (con separador de miles). Tiene que ser mayor que 0 y tener
 * dos decimales como máximo. Devuelve los centavos (entero exacto) o el motivo del rechazo.
 */
export function parsearMontoUsd(
  texto: string,
): { ok: true; centavos: number } | { ok: false; error: string } {
  const t = texto.replace(/\s|\$|USD/gi, "");
  if (t === "") return { ok: false, error: "Escribe el total con IVA, en dólares." };
  let entero: string;
  let decimales = "";
  const m = /^(\d{1,3}(?:([.,])\d{3})*|\d+)(?:([.,])(\d{1,2}))?$/.exec(t);
  if (!m) return { ok: false, error: "El monto tiene que ser un número con dos decimales como máximo." };
  const sepMiles = m[2];
  const sepDecimal = m[3];
  if (sepMiles && sepDecimal && sepMiles === sepDecimal) {
    return { ok: false, error: "El monto tiene que ser un número con dos decimales como máximo." };
  }
  entero = m[1];
  if (sepMiles) entero = entero.split(sepMiles).join("");
  if (m[4] !== undefined) decimales = m[4];
  // «1.234» sin otro separador es ambiguo (mil doscientos o uno con dos); se lee como miles solo si
  // el grupo final tiene tres cifras, que es lo que dice la expresión.
  const centavos = Number(entero) * 100 + Number(decimales.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) return { ok: false, error: "El monto es demasiado grande." };
  if (centavos <= 0) return { ok: false, error: "El monto tiene que ser mayor que 0." };
  if (centavos >= 100_000_000_000_000) return { ok: false, error: "El monto es demasiado grande." };
  return { ok: true, centavos };
}

/** Texto para la persona a partir del error de la RPC (`exc0674:<motivo>[:<markbox>]`). */
export function mensajeErrorExc0674(mensaje: string | null | undefined): string {
  const m = /exc0674:([a-z_]+)(?::(.+))?/.exec(mensaje ?? "");
  if (!m) return "No se pudo facturar. No se emitió ninguna factura; intenta de nuevo o avisa a Contabilidad.";
  const quien = m[2] ? ` (${m[2]})` : "";
  switch (m[1]) {
    case "rol":
    case "sin_sesion":
      return "Tu rol no puede facturar desde Embarques.";
    case "contenedor_fuera_de_lista":
      return "Este contenedor no está en la lista de la regla transitoria.";
    case "ya_facturado":
      return `Ese cliente ya está facturado en este contenedor${quien}. No se emitió ninguna factura.`;
    case "monto":
      return `El monto no es válido${quien}: mayor que 0 y con dos decimales como máximo.`;
    case "cliente_sin_embarques":
      return `Ese cliente no tiene embarques en este contenedor${quien}.`;
    case "cliente_ambiguo":
      return `Hay más de una ficha de cliente con ese Shipping Mark${quien}. Avisa a Contabilidad para corregirla; no se emitió ninguna factura.`;
    case "aliado_ciclo":
      return `La cadena de aliados de ese cliente está mal armada${quien}. Avisa a Contabilidad; no se emitió ninguna factura.`;
    case "cliente_inexistente":
    case "titular_inexistente":
      return `No se encontró la ficha del cliente a facturar${quien}.`;
    case "asiento":
      return "No se pudo hacer el asiento contable, así que no se emitió ninguna factura. Avisa a Contabilidad.";
    case "sin_confirmacion":
      return "Falta la confirmación. No se emitió ninguna factura.";
    // SDD-0690 · errores de la 0569 (emitir la pre-orden) y de la guarda del camino tecleado.
    case "tiene_preorden":
      return `Ese cliente tiene una pre-orden en este contenedor${quien}: se factura desde la pre-orden, no con un monto escrito. No se emitió ninguna factura.`;
    case "no_borrador":
      return `Esa pre-orden ya no está pendiente${quien}: alguien la emitió o la anuló. Recarga la página; no se emitió ninguna factura.`;
    case "moneda":
      return `Esa pre-orden no está en dólares${quien}. Corrígela en Facturación; no se emitió ninguna factura.`;
    case "borrador_alterado":
      return `La pre-orden cambió mientras se emitía${quien}. Recarga la página y revísala; no se emitió ninguna factura.`;
    case "factura_inexistente":
      return `No se encontró la pre-orden${quien}. Recarga la página; no se emitió ninguna factura.`;
    case "envio_fuera_del_contenedor":
      return `La pre-orden incluye envíos que no son de este contenedor${quien}. Corrígela en Facturación; no se emitió ninguna factura.`;
    default:
      return "No se pudo facturar. No se emitió ninguna factura.";
  }
}
