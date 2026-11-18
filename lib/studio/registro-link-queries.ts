/**
 * «Registros por link» (SDD-0646): los links ya usados, con lo que el cliente
 * escribió al lado de lo que tenía la ficha. Lee con la sesión del equipo: la
 * RLS de `client_registration_links` deja ver sólo el tenant propio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorreoEstado } from "@/lib/portal/correo-comprobacion";
import type { RegistroLinkReviewRow } from "@/lib/portal/registro-link-types";

type EstadoRow = {
  client_id: string;
  link_id: string | null;
  estado: string;
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
  /** SDD-0672 · columnas de la 0562; ausentes antes de aplicarla. */
  link_origin?: "equipo" | "autoservicio" | null;
  issued_to_email?: string | null;
};

const COLUMNAS =
  "id, client_id, used_at, prev_data, submitted_data, duplicate_client_id, duplicate_matched_by, rif_skipped, access_error, reviewed_at";

export async function listRegistrosPorLink(
  supabase: SupabaseClient,
  opts: { soloPendientes: boolean },
): Promise<RegistroLinkReviewRow[] | null> {
  const consulta = (columnas: string) => {
    let q = supabase
      .from("client_registration_links")
      .select(columnas)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(200);
    if (opts.soloPendientes) q = q.is("reviewed_at", null);
    return q;
  };

  // SDD-0672 · con la 0562 se lee también el origen del link. Sin ella la columna
  // no existe (42703): se vuelve a pedir lo de siempre, y la lista no se rompe.
  let { data, error } = await consulta(`${COLUMNAS}, link_origin, issued_to_email`);
  if (error?.code === "42703") ({ data, error } = await consulta(COLUMNAS));
  if (error) {
    // Sin la migración 0552 la tabla no existe: la pantalla lo dice en vez de
    // mostrar una lista vacía que parezca «nada pendiente».
    console.error("[listRegistrosPorLink]", error.code);
    return null;
  }
  const rows = (data ?? []) as unknown as Row[];

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

  // D-1 (opción C): el estado REAL del correo. El equipo no lee la tabla
  // `client_email_checks` (ahí están el hash del token y el correo por
  // comprobar): la función devuelve sólo el estado y la fecha del último envío.
  // Si la función no está (falta la 0559), se muestra «no se sabe».
  const estados = new Map<string, EstadoRow>();
  let estadoConocido = false;
  if (rows.length > 0) {
    const { data: es, error: estadoErr } = await supabase.rpc("portal_email_check_estado", {
      p_client_ids: Array.from(new Set(rows.map((r) => r.client_id))),
    });
    if (!estadoErr) {
      estadoConocido = true;
      for (const e of (es ?? []) as EstadoRow[]) estados.set(e.client_id, e);
    }
  }

  const ESTADOS: readonly CorreoEstado[] = [
    "comprobado",
    "sin_comprobar",
    "choque",
    "revisar",
    "nunca_comprobado",
  ];
  /** El estado es del registro vigente del cliente; un link más viejo no lo hereda. */
  const estadoDe = (r: Row): CorreoEstado | null => {
    if (!estadoConocido) return null;
    const e = estados.get(r.client_id);
    // SDD-0672 · autoservicio con el mismo correo al que llegó el enlace: abrirlo
    // probó el correo, y por eso no deja fila de comprobación. Sin acceso
    // fallido, ese correo está comprobado.
    if (
      (!e || e.link_id !== r.id) &&
      r.link_origin === "autoservicio" &&
      !r.access_error &&
      typeof r.issued_to_email === "string" &&
      r.issued_to_email === String(r.submitted_data?.email ?? "").toLowerCase()
    ) {
      return "comprobado";
    }
    if (!e || e.link_id !== r.id) return "no_aplica";
    return ESTADOS.includes(e.estado as CorreoEstado) ? (e.estado as CorreoEstado) : "no_aplica";
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
    origen: r.link_origin === "autoservicio" ? "autoservicio" : "equipo",
    correoEstado: estadoDe(r),
    correoEnviadoAt: estados.get(r.client_id)?.link_id === r.id ? (estados.get(r.client_id)?.sent_at ?? null) : null,
  }));
}
