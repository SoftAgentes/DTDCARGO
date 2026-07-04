/**
 * writeInAppNotification — fila del outbox in-app (la campanita `bug_notifications`).
 *
 * Extraída de `bug-email-notify.ts` (SDD-0036) y generalizada para SDD-0146
 * (Bitácora) SIN cambiar el comportamiento para bugs:
 *   - `bugId` ahora es OPCIONAL (los eventos de Bitácora no cuelgan de un bug →
 *     la columna `bug_notifications.bug_id` ya es nullable en 0028).
 *   - `actorId` OPCIONAL: si el destinatario ES el actor, NO se escribe la fila
 *     (nadie se auto-notifica — gotcha Rumbo). Para bugs el actor-exclusion vive
 *     upstream en cada notify* → no pasan actorId → comportamiento idéntico.
 *
 * Idempotencia razonable (protege contra doble-dispatch del mismo evento):
 *   - con `bugId` (bugs): si ya hay una fila NO leída del mismo (user, bug, type)
 *     en los últimos 60s, reusa su id (EXACTO al original SDD-0036).
 *   - sin `bugId` (Bitácora): dedup por (user, type, payload.tag) NO leída en los
 *     últimos 60s — porque dos tareas distintas asignadas en <60s comparten
 *     (user, type, bug_id=null) y NO deben deduparse entre sí; el `tag`
 *     (`task-{id}` / `recordatorio-bitacora-{fecha}`) las separa.
 *
 * SIEMPRE con service_role (la RLS de bug_notifications solo deja INSERT a
 * service_role). Best-effort: loguea pero nunca throwea. Devuelve el id de la
 * fila (para estampar delivered_*_at) o null si se saltó/falló.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BugNotifType } from "@/lib/studio/bug-types";

export interface WriteInAppArgs {
  userId: string;
  type: BugNotifType;
  payload: Record<string, unknown>;
  /** Bug asociado (bugs). null/undefined para eventos sin bug (Bitácora). */
  bugId?: string | null;
  /** Quién disparó el evento: si === userId no se escribe (no auto-notif). */
  actorId?: string | null;
}

export async function writeInAppNotification(
  supabaseAdmin: SupabaseClient,
  args: WriteInAppArgs,
): Promise<string | null> {
  // No auto-notificación: el actor no se avisa a sí mismo (gotcha Rumbo).
  if (args.actorId != null && args.actorId === args.userId) return null;

  const bugId = args.bugId ?? null;
  const tag =
    typeof args.payload?.tag === "string" && args.payload.tag.length > 0
      ? (args.payload.tag as string)
      : null;

  try {
    const since = new Date(Date.now() - 60_000).toISOString();

    // Dedup: mismo (user, type) NO leído reciente. Con bugId matcheamos el bug
    // (comportamiento original de bugs); sin bugId matcheamos el tag del payload
    // (Bitácora) para no colapsar dos tareas distintas del mismo tipo.
    let dupQuery = supabaseAdmin
      .from("bug_notifications")
      .select("id")
      .eq("user_id", args.userId)
      .eq("type", args.type)
      .is("read_at", null)
      .gte("created_at", since);

    if (bugId != null) {
      dupQuery = dupQuery.eq("bug_id", bugId);
    } else {
      dupQuery = dupQuery.is("bug_id", null);
      if (tag != null) dupQuery = dupQuery.eq("payload->>tag", tag);
    }

    const { data: dup } = await dupQuery
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (dup) return dup.id;

    const { data, error } = await supabaseAdmin
      .from("bug_notifications")
      .insert({
        user_id: args.userId,
        bug_id: bugId,
        type: args.type,
        payload: args.payload,
        delivered_inapp_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      console.error("[write-inapp] insert failed:", error);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error("[write-inapp] threw:", err);
    return null;
  }
}
