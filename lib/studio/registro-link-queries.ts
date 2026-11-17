/**
 * «Registros por link» (SDD-0646): los links ya usados, con lo que el cliente
 * escribió al lado de lo que tenía la ficha. Lee con la sesión del equipo: la
 * RLS de `client_registration_links` deja ver sólo el tenant propio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorreoEstado } from "@/lib/portal/correo-comprobacion";
import type { RegistroLinkReviewRow } from "@/lib/portal/registro-link-types";

type CheckRow = {
  link_id: string | null;
  client_id: string;
  auth_user_id: string;
  verified_at: string | null;
  conflict_at: string | null;
  sent_at: string | null;
};

type Row = {
  id: string;
  client_id: string;
  used_at: string;
  prev_data: Record<string, unknown> | null;
  submitted_data: Record<string, unknown> | null;
  duplicate_client_id: string | null;
  duplicate_matched_by: string | null;
  rif_skipped: boolean;
  access_error: string | null;
  reviewed_at: string | null;
};

export async function listRegistrosPorLink(
  supabase: SupabaseClient,
  opts: { soloPendientes: boolean },
): Promise<RegistroLinkReviewRow[] | null> {
  let q = supabase
    .from("client_registration_links")
    .select(
      "id, client_id, used_at, prev_data, submitted_data, duplicate_client_id, duplicate_matched_by, rif_skipped, access_error, reviewed_at",
    )
    .not("used_at", "is", null)
    .order("used_at", { ascending: false })
    .limit(200);
  if (opts.soloPendientes) q = q.is("reviewed_at", null);

  const { data, error } = await q;
  if (error) {
    // Sin la migración 0552 la tabla no existe: la pantalla lo dice en vez de
    // mostrar una lista vacía que parezca «nada pendiente».
    console.error("[listRegistrosPorLink]", error.code);
    return null;
  }
  const rows = (data ?? []) as Row[];

  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.client_id, r.duplicate_client_id].filter(Boolean) as string[])),
  );
  const fichas = new Map<string, { markbox: string; name: string | null }>();
  if (ids.length > 0) {
    const { data: cs } = await supabase.from("clients").select("id, markbox, name").in("id", ids);
    for (const c of (cs ?? []) as { id: string; markbox: string; name: string | null }[]) {
      fichas.set(c.id, { markbox: c.markbox, name: c.name });
    }
  }

  // D-1 (opción C): el estado REAL del correo, de `client_email_checks`. Si la
  // tabla no está (falta la 0559), se muestra «no se sabe» en vez de afirmar algo.
  const checks = new Map<string, CheckRow>();
  const cuentaVigente = new Set<string>();
  let estadoConocido = false;
  if (rows.length > 0) {
    const { data: cs, error: checkErr } = await supabase
      .from("client_email_checks")
      .select("link_id, client_id, auth_user_id, verified_at, conflict_at, sent_at")
      .in("link_id", rows.map((r) => r.id));
    if (!checkErr) {
      estadoConocido = true;
      const filas = (cs ?? []) as CheckRow[];
      for (const c of filas) if (c.link_id) checks.set(c.link_id, c);
      // La regla sólo aplica mientras el acceso activo siga siendo de la cuenta
      // que nació del link (si el equipo revocó y volvió a invitar, ya no).
      if (filas.length > 0) {
        const { data: accesos } = await supabase
          .from("client_users")
          .select("client_id, auth_user_id, status")
          .in("client_id", filas.map((c) => c.client_id));
        for (const a of (accesos ?? []) as {
          client_id: string;
          auth_user_id: string | null;
          status: string;
        }[]) {
          if (a.status === "active" && a.auth_user_id) {
            cuentaVigente.add(`${a.client_id}:${a.auth_user_id}`);
          }
        }
      }
    }
  }

  const estadoDe = (linkId: string): CorreoEstado | null => {
    if (!estadoConocido) return null;
    const c = checks.get(linkId);
    if (!c || !cuentaVigente.has(`${c.client_id}:${c.auth_user_id}`)) return "no_aplica";
    if (c.verified_at) return "comprobado";
    return c.conflict_at ? "choque" : "sin_comprobar";
  };

  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    markbox: fichas.get(r.client_id)?.markbox ?? "—",
    clientName: fichas.get(r.client_id)?.name ?? null,
    usedAt: r.used_at,
    prev: r.prev_data ?? {},
    submitted: r.submitted_data ?? {},
    duplicateClientId: r.duplicate_client_id,
    duplicateMarkbox: r.duplicate_client_id ? (fichas.get(r.duplicate_client_id)?.markbox ?? null) : null,
    duplicateMatchedBy: r.duplicate_matched_by,
    rifSkipped: r.rif_skipped,
    accessError: r.access_error,
    reviewedAt: r.reviewed_at,
    correoEstado: estadoDe(r.id),
    correoEnviadoAt: checks.get(r.id)?.sent_at ?? null,
  }));
}
