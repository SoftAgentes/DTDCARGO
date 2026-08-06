/**
 * Salud del correo saliente — detección de correos que NO llegaron.
 *
 * ── El agujero que tapa ────────────────────────────────────────────────────
 * `sendEmail` (lib/studio/mail/send-email.ts) es best-effort por diseño: si
 * Resend no está configurado devuelve `{ok:true, queued:true}` y el `mail_log`
 * queda en `queued` PARA SIEMPRE. Nadie reintenta esa fila —`/api/cron/
 * mail-scheduled` drena `mail_scheduled`, que es otra tabla— y nadie mira el
 * status. El caller ve `ok:true` y le dice al cliente que todo salió bien.
 *
 * Medido en producción el 2026-08-05: 8 correos en `queued` (el más viejo del
 * 2026-05-29) y 4 rebotados. Entre ellos, 3 correos de bienvenida de clientes
 * que se registraron el 7 de junio y nunca supieron su Shipping Mark. Dos meses
 * sin que nadie se enterara.
 *
 * ── Qué hace ───────────────────────────────────────────────────────────────
 * Clasifica cada `mail_log` sospechoso en uno de dos modos de falla, que se
 * arreglan distinto:
 *
 *   · `nunca_salio` — sigue en `queued` pasada la ventana. El correo NO se
 *     entregó a Resend. Se arregla reenviando.
 *   · `no_llego`    — Resend lo aceptó y rebotó / falló / lo marcaron spam. El
 *     correo salió pero la dirección no sirve. Reenviar NO arregla: hay que
 *     contactar al cliente por otro canal y corregirle el correo.
 *
 * ── Por qué la clasificación vive acá y no en el cron ──────────────────────
 * Para poder probarla sin DB ni red. El cron (`app/api/cron/mail-health`) solo
 * orquesta: lee, clasifica con esto, avisa y marca.
 *
 * ⚠️ **Bucle infinito**: el aviso se manda POR CORREO (además de Telegram). Si
 * ese correo de aviso se queda en `queued`, la siguiente corrida lo vería como
 * un fallo nuevo y avisaría de él, y así para siempre. Por eso
 * `classifyMailFailure` ignora explícitamente todo lo que salga de este módulo
 * (`metadata.source = 'mail-health'`). No lo quites.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** `metadata.source` de los correos que manda el propio aviso de salud. */
export const MAIL_HEALTH_SOURCE = "mail-health";

/** Marca de "ya avisé de esta fila", dentro de `metadata`. Sin migración. */
export const ALERTED_KEY = "health_alerted_at";

/**
 * Minutos que puede estar un correo en `queued` antes de considerarlo perdido.
 *
 * `sendEmail` llama a Resend de forma SÍNCRONA dentro del mismo request: si la
 * llamada sale bien, la fila pasa a `sent` en el mismo tick. Una fila que sigue
 * en `queued` 15 minutos después no está "esperando turno" — no hay cola que la
 * procese. Está perdida.
 */
export const STUCK_MINUTES = 15;

/** Statuses que significan "Resend lo aceptó pero no llegó a destino". */
const UNDELIVERED_STATUSES = new Set(["bounced", "failed", "complained"]);

export type MailHealthRow = {
  id: string;
  to_email: string;
  subject: string | null;
  status: string;
  template_slug: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type MailFailureKind = "nunca_salio" | "no_llego";

export type MailFailure = {
  row: MailHealthRow;
  kind: MailFailureKind;
};

/**
 * ¿Esta fila es un fallo del que hay que avisar? `null` = no avisar.
 *
 * Pura y determinista: recibe el "ahora" en vez de leer el reloj, para que el
 * test pueda fijar la ventana sin esperar 15 minutos.
 *
 * @param nowMs         epoch ms del momento de la evaluación
 * @param stuckMinutes  ventana de `queued` (default {@link STUCK_MINUTES})
 */
export function classifyMailFailure(
  row: MailHealthRow,
  nowMs: number,
  stuckMinutes: number = STUCK_MINUTES,
): MailFailureKind | null {
  const meta = row.metadata ?? {};

  // Nunca avisar de los correos que manda este mismo módulo → sin bucle.
  if (meta.source === MAIL_HEALTH_SOURCE) return null;

  // Ya avisado: no repetir. El aviso es una vez por fila, no un recordatorio.
  if (meta[ALERTED_KEY]) return null;

  if (UNDELIVERED_STATUSES.has(row.status)) return "no_llego";

  if (row.status === "queued") {
    const createdMs = Date.parse(row.created_at);
    // Una fecha ilegible no debe disparar un aviso falso.
    if (Number.isNaN(createdMs)) return null;
    const ageMinutes = (nowMs - createdMs) / 60_000;
    if (ageMinutes >= stuckMinutes) return "nunca_salio";
  }

  return null;
}

/** Aplica {@link classifyMailFailure} a un lote y devuelve solo los fallos. */
export function collectFailures(
  rows: MailHealthRow[],
  nowMs: number,
  stuckMinutes: number = STUCK_MINUTES,
): MailFailure[] {
  const out: MailFailure[] = [];
  for (const row of rows) {
    const kind = classifyMailFailure(row, nowMs, stuckMinutes);
    if (kind) out.push({ row, kind });
  }
  return out;
}

// ── Acceso a datos ──────────────────────────────────────────────────────────

/**
 * Candidatos a fallo de un tenant: `queued` + los no entregados.
 *
 * Trae de más a propósito (los `queued` recientes que todavía pueden estar en
 * vuelo entran igual) y deja que {@link classifyMailFailure} decida. La regla
 * vive en un solo lugar y es la que está testeada.
 *
 * @param sinceIso  piso de `created_at` — evita rebarrer el histórico entero en
 *                  cada corrida. Los fallos viejos ya se avisaron una vez.
 */
export async function listMailHealthCandidates(
  admin: SupabaseClient,
  tenantId: string,
  sinceIso: string,
  cap: number,
): Promise<MailHealthRow[]> {
  const { data, error } = await admin
    .from("mail_logs")
    .select("id, to_email, subject, status, template_slug, created_at, metadata")
    .eq("tenant_id", tenantId)
    .in("status", ["queued", "bounced", "failed", "complained"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(cap);

  if (error || !data) return [];
  return data as MailHealthRow[];
}

/**
 * Marca la fila como avisada dentro de `metadata` (sin migración).
 *
 * Lee-modifica-escribe: `metadata` es un jsonb entero, no un set de campos.
 * Aceptable acá porque el cron es el único escritor de esta clave y corre de a
 * una fila; no hay carrera real.
 */
export async function markMailAlerted(
  admin: SupabaseClient,
  row: MailHealthRow,
  nowIso: string,
): Promise<void> {
  const next = { ...(row.metadata ?? {}), [ALERTED_KEY]: nowIso };
  await admin.from("mail_logs").update({ metadata: next }).eq("id", row.id);
}
