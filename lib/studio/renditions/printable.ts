/**
 * Hoja imprimible de la Rendición de cuentas a la Operadora (SDD-0069 ·
 * decisión #8) — builder PURO (sin Supabase, sin React: testeable string-exacto).
 *
 * Produce la estructura tipada + el texto plano de la rendición. La página
 * imprimible (`app/studio/(app)/rendiciones/[code]/page.tsx`) renderiza estas
 * mismas líneas; los tests fijan el copy.
 *
 * REGLA ABSOLUTA del mandato (handoff §1): el documento nombra SIEMPRE "la
 * Operadora" — NUNCA "Canopy". El pie identifica a "Inversiones DTD Services,
 * C.A., en su condición de agente de cobranza de la Operadora." PROHIBIDO en
 * cualquier salida: "DoorTuDoor Trading" y el RIF J-50220185 (otra empresa del
 * grupo, no es esta). Los tests aseguran las aserciones negativas.
 *
 * Cada total declara SU base (decisión #3): el recaudado de terceros es CAJA;
 * los servicios locales facturados son DEVENGADO. El handoff los mezcla a
 * propósito; acá es explícito, no oculto.
 */

import type { Rendition, RenditionLine } from "./types";
import { fmtAmount } from "@/lib/money";

export { fmtAmount };

// ── Literales del documento (NO mezclar con Canopy / DoorTuDoor Trading) ──

export const RENDITION_TITLE = "RENDICIÓN DE CUENTAS A LA OPERADORA";
export const RENDITION_SUBTITLE =
  "Inversiones DTD Services, C.A. · agente de cobranza de la Operadora";

/** Etiquetas de los 3 totales, con su BASE explícita (decisión #3). */
export const LABEL_THIRD_PARTY =
  "Recaudado de terceros (flete internacional cobrado por cuenta de la Operadora) — base caja";
export const LABEL_LOCAL_REVENUE =
  "Servicios locales facturados por DTD Services — base devengado";
export const LABEL_NET =
  "Saldo a favor de la Operadora (recaudado de terceros − servicios locales)";

/** Pie probatorio (literal). La razón social SÍ va en este documento legal. */
export const RENDITION_FOOTER =
  "Inversiones DTD Services, C.A., en su condición de agente de cobranza de la Operadora.";

// ── Helpers puros ─────────────────────────────────────────────

/** Formato de monto USD (en-US, 2 decimales). Exportado para la página. */

// ── Tipos de salida ───────────────────────────────────────────

/** Un total con su etiqueta (incluye la base) y su valor USD formateado. */
export type RenditionTotal = {
  label: string;
  amountUsd: number;
  formatted: string;
};

/** La rendición armada para imprimir, campo a campo + texto plano. */
export type RenditionPrintable = {
  title: string;
  subtitle: string;
  code: string;
  periodLine: string; // "Período: {from} a {to}"
  status: string; // "Emitida" | "Anulada"
  /** Los 3 totales con su base (terceros, local, neto). */
  totals: RenditionTotal[];
  /** Detalle: un row por recibo incluido. */
  lines: RenditionLine[];
  footer: string;
  /** Aviso de anulación (solo si status='anulada'), o null. */
  voidNotice: string | null;
  /** El documento completo, línea a línea (string-exacto vs copy). */
  textLines: string[];
  text: string;
};

// ── Builder ───────────────────────────────────────────────────

/**
 * Arma la hoja imprimible de la rendición. PURA: recibe la fila + las líneas ya
 * leídas (las queries viven en queries.ts).
 */
export function buildRenditionPrintable(args: {
  rendition: Rendition;
  lines: RenditionLine[];
}): RenditionPrintable {
  const { rendition } = args;
  const lines = args.lines ?? [];

  const periodLine = `Período: ${rendition.period_from} a ${rendition.period_to}`;
  const statusLabel = rendition.status === "anulada" ? "Anulada" : "Emitida";

  const totals: RenditionTotal[] = [
    {
      label: LABEL_THIRD_PARTY,
      amountUsd: rendition.third_party_usd,
      formatted: fmtAmount(rendition.third_party_usd),
    },
    {
      label: LABEL_LOCAL_REVENUE,
      amountUsd: rendition.local_revenue_usd,
      formatted: fmtAmount(rendition.local_revenue_usd),
    },
    {
      label: LABEL_NET,
      amountUsd: rendition.net_to_operadora_usd,
      formatted: fmtAmount(rendition.net_to_operadora_usd),
    },
  ];

  const voidNotice =
    rendition.status === "anulada"
      ? `Rendición ANULADA${rendition.void_reason ? ` — Motivo: ${rendition.void_reason}` : ""}.`
      : null;

  const textLines: string[] = [
    RENDITION_TITLE,
    RENDITION_SUBTITLE,
    "",
    `Rendición: ${rendition.rendition_code}`,
    periodLine,
    `Estado: ${statusLabel}`,
  ];
  if (voidNotice) textLines.push(voidNotice);
  textLines.push("");
  for (const t of totals) {
    textLines.push(`${t.label}: USD ${t.formatted}`);
  }
  textLines.push("");
  textLines.push(`Recibos incluidos: ${lines.length}`);
  for (const l of lines) {
    const ref = l.reference ?? "—";
    const mark = l.clientMarkbox ?? "—";
    const name = l.clientName ?? "—";
    textLines.push(
      `· ${l.receiptCode} · ${name} · ${mark} · Ref. ${ref} · ${l.receivedAt} · USD ${fmtAmount(l.amountUsd)}`,
    );
  }
  textLines.push("");
  textLines.push(RENDITION_FOOTER);

  return {
    title: RENDITION_TITLE,
    subtitle: RENDITION_SUBTITLE,
    code: rendition.rendition_code,
    periodLine,
    status: statusLabel,
    totals,
    lines,
    footer: RENDITION_FOOTER,
    voidNotice,
    textLines,
    text: textLines.join("\n"),
  };
}
