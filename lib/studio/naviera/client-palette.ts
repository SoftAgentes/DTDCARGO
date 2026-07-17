/**
 * SDD-0152 · Paleta categórica por cliente (identidad, NO estado).
 *
 * Por qué una paleta nueva y no los tonos que ya existen:
 *   · Los tokens semánticos ya tienen dueño. `--wine` significa "sobre
 *     capacidad" en `utilizationTone()` (UtilizationBar.tsx) — y esa barra vive
 *     en LA MISMA tarjeta que el visor. Pintar "Importadora Vega" de wine ahí
 *     sería decir dos cosas con el mismo color.
 *   · La única paleta categórica del repo (ReportesClient.tsx, `palette`) tiene
 *     4 colores y dos son grises de texto (`--ink`, `--ink-soft`): no alcanza
 *     para N clientes en un contenedor y no es reusable.
 *
 * Los valores viven en `app/studio/tokens.css` con par light/dark (--cat-1..6).
 * Acá solo se elige CUÁL le toca a cada cliente.
 */

export const CLIENT_PALETTE_SIZE = 6;

/** Los tokens, en orden. Espejo de tokens.css. */
export const CLIENT_PALETTE_VARS = [
  "--cat-1",
  "--cat-2",
  "--cat-3",
  "--cat-4",
  "--cat-5",
  "--cat-6",
] as const;

export type ClientPaletteVar = (typeof CLIENT_PALETTE_VARS)[number];

/**
 * Hash FNV-1a de 32 bits. Determinista y estable entre sesiones, servidor y
 * cliente: el mismo MARKBOX siempre da el mismo color, que es lo que hace que
 * el operador pueda aprenderse "el verde es Textiles Andrade".
 * No se usa para nada criptográfico.
 */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // h * 16777619 en aritmética de 32 bits sin desbordar
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** El token que le toca a un MARKBOX. `null`/vacío → gris de "sin dueño". */
export function paletteVarForMarkbox(markbox: string | null | undefined): ClientPaletteVar | null {
  const key = (markbox ?? "").trim().toUpperCase();
  if (!key) return null;
  return CLIENT_PALETTE_VARS[hash32(key) % CLIENT_PALETTE_SIZE];
}

/** Listo para meter en un `fill`/`background`. Sin dueño → superficie neutra. */
export function colorForMarkbox(markbox: string | null | undefined): string {
  const v = paletteVarForMarkbox(markbox);
  return v ? `var(${v})` : "var(--bg-elevated)";
}

/**
 * Asigna colores a un set de clientes EVITANDO choques dentro del mismo
 * contenedor. El hash puro puede darle el mismo token a dos clientes; en un
 * contenedor con 4 markboxes eso los haría indistinguibles, que es justo lo que
 * el visor tiene que evitar. Determinista: mismo set → mismo reparto.
 */
export function assignClientColors(
  markboxes: readonly (string | null)[],
): Map<string, string> {
  const keys = [...new Set(markboxes.map((m) => (m ?? "").trim().toUpperCase()))]
    .filter(Boolean)
    .sort();

  const out = new Map<string, string>();
  const used = new Set<ClientPaletteVar>();

  // 1ª pasada: el color del hash, si está libre.
  for (const k of keys) {
    const want = paletteVarForMarkbox(k);
    if (want && !used.has(want)) {
      used.add(want);
      out.set(k, `var(${want})`);
    }
  }
  // 2ª pasada: a los que chocaron, el primer token libre. Si hay más clientes
  // que colores (>6 en un contenedor), se recicla — el color deja de ser único
  // y la leyenda textual pasa a ser la que desambigua.
  for (const k of keys) {
    if (out.has(k)) continue;
    const free = CLIENT_PALETTE_VARS.find((v) => !used.has(v));
    if (free) {
      used.add(free);
      out.set(k, `var(${free})`);
    } else {
      out.set(k, colorForMarkbox(k));
    }
  }
  return out;
}

/** Lookup con el mismo normalizado que usó `assignClientColors`. */
export function lookupClientColor(
  colors: Map<string, string>,
  markbox: string | null | undefined,
): string {
  const key = (markbox ?? "").trim().toUpperCase();
  return colors.get(key) ?? "var(--bg-elevated)";
}
