/**
 * Reglas puras de los atributos del ERP en el contacto de Chatwoot (SDD-0649).
 * Sin red ni base.
 *
 * Studio escribe dos atributos personalizados del contacto:
 *   - `dtd_segmento`: `cliente`, `lead_registrado` o `lead_nuevo`, con la regla
 *     de la 0505;
 *   - `dtd_shipping_mark`: el Shipping Mark vigente de la ficha única, o vacío.
 * El ERP manda (SDD-0587). Si la persona deja de tener ficha única, el código se
 * borra para que no quede pegado a otra persona.
 */
import type { Segmento } from "./segmento";

export const ATRIBUTO_SEGMENTO = "dtd_segmento";
export const ATRIBUTO_SHIPPING_MARK = "dtd_shipping_mark";

export interface FichaErp {
  segmento: Segmento;
  shippingMark: string | null;
}

export const SIN_FICHA: FichaErp = { segmento: "lead_nuevo", shippingMark: null };

/** El Shipping Mark que se muestra: el de la ficha, sin espacios a los lados; vacío o raro → null. */
export function shippingMarkVisible(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const codigo = v.trim();
  return codigo.length > 0 && codigo.length <= 40 && !/\s/.test(codigo) ? codigo : null;
}

/**
 * Lo que hay que escribir en el contacto, o `null` si ya está así. Un texto vacío
 * en Chatwoot cuenta como «sin código».
 */
export function atributosPorEscribir(
  actuales: Readonly<Record<string, unknown>>,
  ficha: FichaErp,
): Record<string, string | null> | null {
  const codigoActual = typeof actuales[ATRIBUTO_SHIPPING_MARK] === "string" && actuales[ATRIBUTO_SHIPPING_MARK] !== ""
    ? actuales[ATRIBUTO_SHIPPING_MARK]
    : null;
  if (actuales[ATRIBUTO_SEGMENTO] === ficha.segmento && codigoActual === ficha.shippingMark) return null;
  return { [ATRIBUTO_SEGMENTO]: ficha.segmento, [ATRIBUTO_SHIPPING_MARK]: ficha.shippingMark };
}
