/**
 * Derivados de un artículo: extracto y tiempo de lectura.
 *
 * Salieron de `app/studio/(app)/marketing/noticias-web/actions.ts` (SDD-0611)
 * para que la vía manual y la automática deriven lo mismo del mismo texto.
 */

/** Primer párrafo (no título, cita, código ni lista) del markdown, sin formato. */
export function extraerExtracto(markdown: string, maxLen = 200): string {
  const lines = markdown.split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.startsWith("```")) continue;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) continue;
    // Strip básico de inline markdown (bold/italic/links)
    const clean = trimmed
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/\[(.+?)\]\([^)]+\)/g, "$1");
    if (clean.length > maxLen) return clean.slice(0, maxLen - 1) + "…";
    return clean;
  }
  return "";
}

/** Minutos de lectura a 200 palabras por minuto. */
export function tiempoDeLectura(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
