/**
 * Salud del alta de cliente — "tiene Shipping Mark pero la puerta no abre".
 *
 * ── El agujero que tapa ────────────────────────────────────────────────────
 * `registerClientAction` crea el cliente, le emite el MARKBOX, le manda el
 * correo de bienvenida invitándolo al portal… y RECIÉN DESPUÉS inserta la fila
 * de `client_users` que le da acceso. Ese insert es best-effort: si falla, se
 * escribe un `console.error` y el alta devuelve éxito igual.
 *
 * El cliente queda con `portal_approved_at` puesto —o sea, "activo" en toda la
 * UI— y sin cuenta con la cual entrar. Nadie se entera: ni él (le dijimos que
 * entre), ni el equipo (la ficha se ve normal).
 *
 * Medido en producción el 2026-08-05: **DTD-9017**, alta del 15 de julio,
 * recibió su correo de bienvenida (1 entregado) y no tenía `client_users`.
 * Uno solo entre 432 — o sea, es raro. Pero estuvo 3 semanas invisible, y lo
 * que hace visible a un fallo raro no es la suerte, es un check.
 *
 * ── Por qué no lleva estado de "ya avisé" ──────────────────────────────────
 * Un cliente sin acceso SIGUE roto hasta que alguien lo arregla, así que
 * repetir el aviso es lo correcto — no es ruido, es un pendiente abierto. La
 * ventana de días acota el nagging: lo viejo sin resolver deja de sonar y queda
 * para la revisión manual, lo reciente insiste.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Días hacia atrás que se vigilan. Más viejo que esto ya no dispara aviso. */
export const ALTA_LOOKBACK_DAYS = 30;

export type AltaSinAcceso = {
  markbox: string;
  name: string | null;
  created_at: string;
};

/**
 * Altas del portal que quedaron marcadas como activas y NO tienen acceso.
 *
 * La condición `portal_approved_at is not null` es deliberada: sin ella
 * entrarían también las fichas que a propósito todavía no se activaron, y el
 * aviso perdería sentido. Lo que se busca es la **contradicción**: el sistema
 * dice "activo" y no hay con qué entrar.
 */
export async function listAltasSinAcceso(
  admin: SupabaseClient,
  tenantId: string,
  sinceIso: string,
  cap: number,
): Promise<AltaSinAcceso[]> {
  // Dos consultas y un diff en memoria, a propósito: NO se usa el embed de
  // PostgREST (`select("...,client_users(id)")`) porque depende de que la
  // relación se resuelva sola, y si no se resuelve la respuesta viene vacía sin
  // error. Un check de salud que devuelve [] en silencio dice "todo bien" para
  // siempre — sería el mismo bug que vino a cazar.
  const { data: altas, error } = await admin
    .from("clients")
    .select("id, markbox, name, created_at")
    .eq("tenant_id", tenantId)
    .eq("registration_channel", "portal")
    .is("deleted_at", null)
    .not("portal_approved_at", "is", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(cap);

  if (error || !altas || altas.length === 0) return [];

  const rows = altas as Array<AltaSinAcceso & { id: string }>;

  const { data: usuarios, error: uErr } = await admin
    .from("client_users")
    .select("client_id")
    .in(
      "client_id",
      rows.map((r) => r.id),
    );

  // Ante un error leyendo los accesos NO se reporta "todos rotos": se calla.
  // Un aviso falso de 50 clientes sin puerta quema la confianza en el aviso.
  if (uErr) {
    console.error("[alta-health] no pude leer client_users:", uErr);
    return [];
  }

  const conAcceso = new Set(
    ((usuarios ?? []) as Array<{ client_id: string }>).map((u) => u.client_id),
  );

  return rows
    .filter((r) => !conAcceso.has(r.id))
    .map(({ markbox, name, created_at }) => ({ markbox, name, created_at }));
}

/**
 * Texto del aviso. Puro y testeable: recibe las filas, devuelve el mensaje.
 *
 * Dice qué hacer, no sólo qué pasó. Un aviso que no trae la acción se lee una
 * vez y se archiva.
 */
export function buildAltaHealthMessage(rows: AltaSinAcceso[], siteUrl: string): string {
  const lines = rows.map(
    (r) => `· ${r.markbox} — ${r.name ?? "(sin nombre)"} · alta ${r.created_at.slice(0, 10)}`,
  );

  return [
    `⚠️ ${rows.length} cliente(s) con Shipping Mark y SIN acceso al portal`,
    ``,
    ...lines,
    ``,
    `Se registraron solos, se les dijo que entraran al portal y la cuenta de`,
    `acceso nunca se creó. Hay que crearsela desde Studio › Clientes.`,
    ``,
    `${siteUrl}/studio/clientes`,
  ].join("\n");
}
