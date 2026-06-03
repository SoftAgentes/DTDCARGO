/**
 * Tipos + loader del informe del Radar (SDD-0050 Slice C).
 *
 * El Radar es la skill `/radar` de Claude Code: corre SOLO en local (necesita el
 * runtime de Claude + el filesystem del repo). En la web no se ejecuta; lo único
 * que se puede mostrar es su ÚLTIMO informe guardado, versionado en git como
 * `public/api/radar-report.json`. La skill, al correr, además de imprimir el
 * markdown en chat, escribe/actualiza ese JSON (instrucción en `.claude/commands/radar.md`).
 *
 * Estos types describen la forma del artefacto. El loader (`loadRadarReport`) lo
 * lee del filesystem en el server component padre (consistente con cómo `page.tsx`
 * pasa data viva a los demás tabs como props). Si el archivo no existe o está
 * corrupto → devuelve `null` y la pestaña Radar muestra solo el banner + cómo
 * generarlo (no rompe).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Severidad de un hallazgo de workspace (Parte A del Radar). */
export type RadarSeverity = "alta" | "media" | "baja";

/** Un hallazgo de auditoría del workspace (Parte A · config/tokens/harness). */
export type RadarFinding = {
  id: string;
  title: string;
  severity: RadarSeverity;
  /** Acción concreta recomendada (o ya aplicada). */
  action: string;
  /** `true` si la recomendación #1 (la marcada con ⭐ en el informe en chat). */
  top?: boolean;
};

/** Parte A · auditoría de workspace. */
export type RadarPartA = {
  findings: RadarFinding[];
  /** Ahorro estimado de tokens, como porcentaje aprox (ej. "~8%"). */
  estimatedTokenSavings: string;
};

/** Conteo de reconciliación del modelo de datos (Parte B). */
export type RadarReconCounts = {
  built: number;
  partial: number;
  missing: number;
  total: number;
};

/** Un bloque del roadmap (opcional · Parte B). */
export type RadarBlock = {
  name: string;
  /** % faltante documentado del bloque (ej. "60%"). */
  remaining: string;
  note?: string;
};

/** Parte B · reconciliación del Norte (modelo de datos + roadmap). */
export type RadarPartB = {
  counts: RadarReconCounts;
  blocks?: RadarBlock[];
};

/** El informe completo del Radar (artefacto `public/api/radar-report.json`). */
export type RadarReport = {
  /** Fecha ISO en que se generó el informe en local (ej. "2026-06-03"). */
  generatedAt: string;
  /** Versión del Norte vigente al momento de generar (ej. "v2.4"). */
  norteVersion: string;
  partA: RadarPartA;
  partB: RadarPartB;
};

/** Tono de Badge del sistema para una severidad. */
export function severityBadgeTone(
  s: RadarSeverity,
): "danger" | "warning" | "neutral" {
  if (s === "alta") return "danger";
  if (s === "media") return "warning";
  return "neutral";
}

/** % completitud del modelo de datos = built / total (entero, sin decimales). */
export function reconCompletionPct(c: RadarReconCounts): number {
  if (!c.total) return 0;
  return Math.round((c.built / c.total) * 100);
}

/**
 * Valida (de forma defensiva, sin Zod) que un objeto desconocido tenga la forma
 * mínima de un `RadarReport`. El artefacto lo escribe la skill `/radar`, pero
 * podría venir viejo/corrupto → si no calza, tratamos como "no hay informe".
 */
export function isRadarReport(v: unknown): v is RadarReport {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.generatedAt !== "string") return false;
  if (typeof r.norteVersion !== "string") return false;
  const a = r.partA as Record<string, unknown> | undefined;
  if (!a || !Array.isArray(a.findings)) return false;
  const b = r.partB as Record<string, unknown> | undefined;
  if (!b || typeof b.counts !== "object" || b.counts === null) return false;
  const counts = b.counts as Record<string, unknown>;
  return (
    typeof counts.built === "number" &&
    typeof counts.partial === "number" &&
    typeof counts.missing === "number" &&
    typeof counts.total === "number"
  );
}

/** Ruta del artefacto en disco (servido también como estático en `/api/radar-report.json`). */
export const RADAR_REPORT_PATH = path.join(
  process.cwd(),
  "public",
  "api",
  "radar-report.json",
);

/**
 * Lee el informe del Radar del filesystem (server-only).
 *
 * Devuelve `null` si el archivo no existe o no es un informe válido — la pestaña
 * Radar maneja ese caso mostrando solo el banner + cómo generarlo (no rompe).
 */
export async function loadRadarReport(): Promise<RadarReport | null> {
  try {
    const raw = await readFile(RADAR_REPORT_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isRadarReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
