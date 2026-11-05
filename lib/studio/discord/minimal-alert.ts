/**
 * Discord · el aviso MÍNIMO · SDD-0606.
 *
 * Discord es un tercero que recibe datos. Por decisión de Sam (2026-11-05) un
 * aviso lleva lo mínimo: qué pasó, el código del registro y el enlace al Studio,
 * donde se ve el detalle detrás del inicio de sesión. Nunca nombre, teléfono,
 * correo ni montos.
 *
 * La forma del tipo es la primera barrera: `MinimalAlert` no tiene dónde poner
 * un cuerpo libre. El texto completo de siempre (`telegramText`) viaja por otro
 * parámetro y este módulo no lo recibe nunca.
 */

import { isDiscordUserId } from "./send-webhook";

export interface MinimalAlert {
  /** Qué pasó, en pocas palabras y SIN datos de personas: «Cliente nuevo». */
  titulo: string;
  /** Código del registro: Shipping Mark, folio, referencia. Opcional. */
  codigo?: string | null;
  /** Enlace al Studio. Opcional. */
  url?: string | null;
  /**
   * Conteos operativos: etiqueta fija y un NÚMERO. Existe para el reporte
   * diario. El valor es numérico a propósito —no cabe un nombre ni un
   * teléfono— y por regla no se usa para montos de dinero.
   */
  conteos?: ReadonlyArray<{ etiqueta: string; valor: number }>;
}

/** Largo máximo de un código en el aviso; un código real es mucho más corto. */
const MAX_CODIGO = 60;
const MAX_TITULO = 160;
const MAX_ETIQUETA = 60;
const MAX_CONTEOS = 12;

/** Una línea: sin saltos, sin espacios repetidos, sin marcas que rompan el formato. */
function unaLinea(text: string, max: number): string {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/`/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

/** Sólo http(s). Va entre `<>` para que Discord no arme vista previa. */
function enlace(url: string | null | undefined): string | null {
  const limpio = url?.trim();
  if (!limpio || !/^https?:\/\/[^\s<>]+$/.test(limpio)) return null;
  return `<${limpio}>`;
}

export interface BuildDiscordContentOptions {
  /** IDs de Discord a mencionar. Los inválidos se descartan. */
  mentionUserIds?: ReadonlyArray<string>;
  /**
   * Etiqueta de la categoría cuando el aviso cayó al canal de respaldo, para
   * que quien lo lea sepa que no es un aviso «de equipo» sino uno sin canal.
   */
  respaldoDe?: string | null;
}

/**
 * Arma el texto del aviso. Ejemplo:
 *
 *     <@123456789012345678>
 *     **Cliente nuevo** · `DTD-0123`
 *     <https://dtdcargo.com/studio/clientes/…>
 */
export function buildDiscordContent(
  aviso: MinimalAlert,
  opts: BuildDiscordContentOptions = {},
): string {
  const lines: string[] = [];

  const menciones = [...new Set((opts.mentionUserIds ?? []).filter(isDiscordUserId))];
  if (menciones.length > 0) lines.push(menciones.map((id) => `<@${id}>`).join(" "));

  if (opts.respaldoDe) {
    lines.push(`_Sin canal propio · ${unaLinea(opts.respaldoDe, MAX_TITULO)}_`);
  }

  const titulo = unaLinea(aviso.titulo, MAX_TITULO) || "Aviso del Studio";
  const codigo = aviso.codigo ? unaLinea(aviso.codigo, MAX_CODIGO) : "";
  lines.push(codigo ? `**${titulo}** · \`${codigo}\`` : `**${titulo}**`);

  for (const c of (aviso.conteos ?? []).slice(0, MAX_CONTEOS)) {
    if (!Number.isFinite(c.valor)) continue;
    lines.push(`• ${unaLinea(c.etiqueta, MAX_ETIQUETA)}: ${c.valor}`);
  }

  const link = enlace(aviso.url);
  if (link) lines.push(link);

  return lines.join("\n");
}
