/**
 * Composición del Shipping Mark cuando el cliente cuelga de un aliado (SDD-0255).
 *
 * Vive en `lib/shared/` —y no en `lib/studio/`— porque la superficie pública del
 * aliado también lo necesita, y la frontera del repo prohíbe que `app/` público
 * importe `@/lib/studio`, `@/lib/db` o `@supabase/*`.
 *
 * ── LAS DOS FORMAS ───────────────────────────────────────────────────────────
 * La insignia es jerárquica: un aliado puede tener sub-aliados. Dynasty Cargo
 * (DC) le revende a otro puerta a puerta (FA) que ella captó, y el cliente de FA
 * queda `DC-FA-1232`. Ese mismo código se muestra distinto según quién mire:
 *
 *   forma GUARDADA / en pantalla → `DC-FA-1232`
 *     Es lo que hay en `clients.markbox` y lo que ve el equipo de DTD en el
 *     Studio: la cadena completa dice que ese cliente cuelga de Alexandra.
 *
 *   forma IMPRESA / en documentos → `FA-1232`
 *     Sólo el último segmento. El cliente de FA no debe ver `DC`.
 *
 * Un cliente directo de DTD (`DTD-9058`) o de un aliado raíz (`HR-0001`) tiene
 * un solo segmento, así que las dos formas coinciden.
 *
 * ── POR QUÉ EL PREFIJO ES ÚNICO GLOBAL ───────────────────────────────────────
 * Justamente porque la forma impresa omite la raíz: si `FA` existiera bajo DC y
 * bajo HR, `FA-1232` sería ambiguo en el papel. El índice
 * `aliados_prefix_uq (tenant_id, upper(prefix))` de la migr 0362 lo garantiza.
 */

/**
 * Uno o más segmentos de 2 a 4 letras mayúsculas separados por guion, y al final
 * el correlativo. Los segmentos coinciden con `aliados_prefix_fmt`.
 *
 * Ojo con los códigos de VENDEDOR del legado (`DTD-A101`, `DTD-J044`): no
 * matchean —`A101` no es ni un prefijo válido ni un correlativo— y eso es
 * correcto, no son cadenas de aliado. `parseMarkbox` devuelve `null` para ellos.
 */
const CHAIN_REGEX = /^([A-Z]{2,4}(?:-[A-Z]{2,4})*)-(\d{3,6})$/;

export type MarkboxChain = {
  /** Segmentos de raíz a hoja. `DC-FA-1232` → `["DC", "FA"]`. */
  prefixes: string[];
  /** El correlativo como número. `DC-FA-1232` → `1232`. */
  seq: number;
  /** El correlativo tal cual venía, con sus ceros. `DC-FA-0008` → `"0008"`. */
  padded: string;
};

/**
 * Descompone un Shipping Mark en cadena de prefijos + correlativo.
 * Devuelve `null` si no tiene la forma de una cadena (por ejemplo los códigos de
 * vendedor del legado, o basura como `bncvcc`).
 */
export function parseMarkbox(code: string | null | undefined): MarkboxChain | null {
  if (!code) return null;
  const match = code.trim().toUpperCase().match(CHAIN_REGEX);
  if (!match) return null;
  return {
    prefixes: match[1].split("-"),
    seq: Number.parseInt(match[2], 10),
    padded: match[2],
  };
}

/**
 * Arma la forma GUARDADA a partir de la cadena de prefijos y el correlativo.
 * Es el espejo en TypeScript de `next_markbox_aliado()`; la fuente canónica de
 * generación sigue siendo el RPC, esto sirve para previsualizar y para tests.
 */
export function buildMarkbox(prefixes: string[], seq: number): string {
  const chain = prefixes.map((p) => p.trim().toUpperCase()).join("-");
  return `${chain}-${String(seq).padStart(4, "0")}`;
}

/**
 * La forma IMPRESA: último segmento + correlativo. Es la que va en etiquetas,
 * packing lists, recibos y cualquier documento que llegue al cliente final.
 *
 * `DC-FA-1232` → `FA-1232` · `HR-0001` → `HR-0001` · `DTD-9058` → `DTD-9058`
 *
 * Si el código no es una cadena reconocible se devuelve tal cual: es lo que
 * corresponde para los códigos de vendedor del legado, que se imprimen como
 * siempre se imprimieron.
 */
export function printMarkbox(code: string | null | undefined): string {
  if (!code) return "";
  const parsed = parseMarkbox(code);
  if (!parsed) return code;
  const last = parsed.prefixes[parsed.prefixes.length - 1];
  return `${last}-${parsed.padded}`;
}

/**
 * La forma GUARDADA, normalizada. Es lo que se muestra dentro del Studio.
 * Se devuelve el código tal cual salvo espacios y minúsculas.
 */
export function displayMarkbox(code: string | null | undefined): string {
  if (!code) return "";
  return code.trim().toUpperCase();
}

/**
 * ¿Este código pierde información al imprimirse? Cierto sólo para clientes de
 * sub-aliado. Sirve para avisar en la UI que lo que ve el operador y lo que sale
 * en el papel no son iguales.
 */
export function hidesRootPrefix(code: string | null | undefined): boolean {
  const parsed = parseMarkbox(code);
  return parsed !== null && parsed.prefixes.length > 1;
}
