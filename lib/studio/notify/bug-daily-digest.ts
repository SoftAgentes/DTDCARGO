/**
 * Resumen diario de reportes a Discord `#bugs` · SDD-0036 §11 (enmienda D-13).
 *
 * Decisión de Sam (2026-11-16, D-13 de la SDD-0637): los errores de gravedad
 * alta y crítica siguen llegando al momento (`notifyBugCreatedToAdmin`); todo
 * lo demás —mejoras, sugerencias, preguntas y errores leves— llega UNA vez al
 * día, en un resumen sin datos de clientes.
 *
 * ── Privacidad ───────────────────────────────────────────────────────────────
 * Discord es un tercero. El resumen lleva sólo:
 *   - conteos por tipo y por módulo (números con etiqueta fija),
 *   - los folios `BUG-XXXXX`,
 *   - el enlace a la bandeja del Studio.
 * Nunca el título, la descripción, la URL del reporte ni el nombre de quien
 * reportó. Tres barreras:
 *   1. La consulta pide sólo `folio, category, severity, module`.
 *   2. `buildBugDailyDigest` lee sólo esos cuatro campos, aunque reciba más.
 *   3. El módulo se nombra sólo si está en la lista cerrada de módulos; si no,
 *      cuenta como «Otro módulo» (el slug crudo sale de la URL del reporte).
 *      Y un folio sin forma de folio no pasa el filtro de `MinimalAlert`.
 *
 * Va por `sendDiscordCategoryAlert` (categoría `bugs`): si Discord no lo
 * guarda, entra a la cola durable `studio_alert_outbox` (0515) y el drenado de
 * `/api/cron/bug-notifications-drain` lo reintenta. Telegram está retirado
 * (SDD-0606): este resumen no tiene camino de Telegram.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendDiscordCategoryAlert,
  type DiscordAlertOutcome,
} from "@/lib/studio/alerts/dispatch-alert";
import { resolveDiscordTarget } from "@/lib/studio/discord/channels";
import type { EnvSource } from "@/lib/runtime/app-env";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";
import { isKnownModuleSlug, moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import type { BugCategory, BugSeverity } from "@/lib/studio/bug-types";

/** Lo único que el resumen lee de un reporte. */
export interface BugDigestRow {
  folio: string;
  category: BugCategory;
  severity: BugSeverity | null;
  module: string;
}

/** Estas gravedades ya avisaron al momento: no entran al resumen. */
const GRAVEDAD_AL_MOMENTO: ReadonlySet<string> = new Set(["alta", "critica"]);

/** Orden fijo de los tipos en el resumen. */
const TIPOS: ReadonlyArray<{ category: BugCategory; etiqueta: string }> = [
  { category: "error", etiqueta: "Errores leves" },
  { category: "improve", etiqueta: "Mejoras" },
  { category: "suggest", etiqueta: "Sugerencias" },
  { category: "question", etiqueta: "Preguntas" },
];

/** Tope de líneas de conteo de `MinimalAlert` (`MAX_CONTEOS`). */
const MAX_LINEAS = 12;
const OTRO_MODULO = "Otro módulo";

/** Caracas es UTC-4 todo el año (sin horario de verano). */
const OFFSET_CARACAS_MS = 4 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** ¿Este reporte va al resumen (y no salió ya al momento)? */
export function entraAlResumen(row: Pick<BugDigestRow, "severity">): boolean {
  return !row.severity || !GRAVEDAD_AL_MOMENTO.has(row.severity);
}

/**
 * La ventana del resumen: el día ANTERIOR completo en hora de Caracas.
 * Con `now` = 2026-11-16 12:05Z (08:05 en Caracas) → 2026-11-15, de
 * 2026-11-15T04:00Z a 2026-11-16T04:00Z.
 */
export function ventanaDelResumen(now: Date): { fecha: string; desde: string; hasta: string } {
  const localMs = now.getTime() - OFFSET_CARACAS_MS;
  const inicioHoyLocal = Math.floor(localMs / DIA_MS) * DIA_MS;
  const hasta = inicioHoyLocal + OFFSET_CARACAS_MS;
  const desde = hasta - DIA_MS;
  return {
    fecha: new Date(inicioHoyLocal - DIA_MS).toISOString().slice(0, 10),
    desde: new Date(desde).toISOString(),
    hasta: new Date(hasta).toISOString(),
  };
}

/**
 * Arma el resumen. PURA. `null` si no hay nada que contar (no se manda un
 * resumen vacío). Lee sólo `folio`, `category`, `severity` y `module`.
 */
export function buildBugDailyDigest(
  rows: ReadonlyArray<BugDigestRow>,
  opts: { fecha: string; url: string },
): MinimalAlert | null {
  const del = rows.filter(entraAlResumen);
  if (del.length === 0) return null;

  const porTipo = new Map<BugCategory, number>();
  const porModulo = new Map<string, number>();
  for (const r of del) {
    porTipo.set(r.category, (porTipo.get(r.category) ?? 0) + 1);
    const modulo = isKnownModuleSlug(r.module) ? moduleLabelFromSlug(r.module) : OTRO_MODULO;
    porModulo.set(modulo, (porModulo.get(modulo) ?? 0) + 1);
  }

  const conteos: Array<{ etiqueta: string; valor: number }> = [];
  for (const t of TIPOS) {
    const n = porTipo.get(t.category);
    if (n) conteos.push({ etiqueta: t.etiqueta, valor: n });
  }

  // Módulos de más a menos reportes; «Otro módulo» al final. Si no caben todos,
  // los últimos se juntan en una línea.
  const conocidos = [...porModulo.entries()]
    .filter(([m]) => m !== OTRO_MODULO)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  let otros = porModulo.get(OTRO_MODULO) ?? 0;
  const libres = MAX_LINEAS - conteos.length;
  const caben = conocidos.length + (otros ? 1 : 0) <= libres ? conocidos.length : libres - 1;
  for (const [m, n] of conocidos.slice(0, caben)) {
    conteos.push({ etiqueta: `Módulo · ${m}`, valor: n });
  }
  for (const [, n] of conocidos.slice(caben)) otros += n;
  if (otros) {
    conteos.push({
      etiqueta: caben < conocidos.length ? "Módulo · otros" : `Módulo · ${OTRO_MODULO}`,
      valor: otros,
    });
  }

  const folios = [...del.map((r) => r.folio)].sort();
  const n = del.length;
  return {
    titulo: `Resumen diario de reportes · ${opts.fecha} · ${n} ${n === 1 ? "nuevo" : "nuevos"}`,
    url: opts.url,
    conteos,
    codigos: folios,
  };
}

/** Tope de filas que lee el resumen; un día real está muy por debajo. */
const MAX_FILAS = 500;

/**
 * Los reportes del día que van al resumen. Pide SÓLO las cuatro columnas que
 * usa el resumen: ni título ni descripción ni quién reportó.
 */
export async function fetchBugDigestRows(
  admin: SupabaseClient,
  tenantId: string,
  desde: string,
  hasta: string,
): Promise<BugDigestRow[]> {
  const { data, error } = await admin
    .from("bug_reports")
    .select("folio, category, severity, module")
    .eq("tenant_id", tenantId)
    .gte("created_at", desde)
    .lt("created_at", hasta)
    .or("severity.is.null,severity.in.(baja,media)")
    .order("created_at", { ascending: true })
    .limit(MAX_FILAS);
  if (error) throw new Error(`bug_reports: ${error.message}`);
  return (data ?? []) as BugDigestRow[];
}

export interface BugDailyDigestResult {
  /**
   * `discord-apagado`: el tenant no tiene canal PROPIO de `#bugs` (falla
   * cerrado). Si sólo hay el canal de respaldo (`#avisos-equipo`), el resumen
   * tampoco sale: es de `#bugs` y no se manda a otro canal.
   */
  estado: "enviado" | "sin-reportes" | "discord-apagado" | "error";
  fecha: string;
  reportes: number;
  outcome?: DiscordAlertOutcome;
  error?: string;
}

/**
 * Corre el resumen de un tenant: lee el día anterior y lo manda a `#bugs`.
 * Sin canal propio de `#bugs` para el tenant —ni Discord, ni sólo el canal de
 * respaldo— no toca la base. Nunca lanza.
 */
export async function runBugDailyDigest(
  admin: SupabaseClient,
  tenantId: string,
  opts: { now?: Date; siteUrl: string; env?: EnvSource },
): Promise<BugDailyDigestResult> {
  const { fecha, desde, hasta } = ventanaDelResumen(opts.now ?? new Date());
  const target = resolveDiscordTarget("bugs", tenantId, opts.env);
  if (!target || target.esRespaldo) {
    return { estado: "discord-apagado", fecha, reportes: 0 };
  }
  try {
    const rows = await fetchBugDigestRows(admin, tenantId, desde, hasta);
    const aviso = buildBugDailyDigest(rows, { fecha, url: `${opts.siteUrl}/studio/bugs` });
    if (!aviso) return { estado: "sin-reportes", fecha, reportes: 0 };
    const res = await sendDiscordCategoryAlert(admin, tenantId, "bugs", aviso, {
      logTag: "bug-resumen-diario",
    });
    return {
      estado: res.handled ? "enviado" : "error",
      fecha,
      reportes: rows.filter(entraAlResumen).length,
      outcome: res.outcome,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bug-daily-digest] falló:", msg);
    return { estado: "error", fecha, reportes: 0, error: msg };
  }
}
