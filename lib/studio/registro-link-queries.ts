/**
 * «Registros por link» (SDD-0646): los links ya usados, con lo que el cliente
 * escribió al lado de lo que tenía la ficha. Lee con la sesión del equipo: la
 * RLS de `client_registration_links` deja ver sólo el tenant propio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroLinkReviewRow } from "@/lib/portal/registro-link-types";

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
  }));
}
