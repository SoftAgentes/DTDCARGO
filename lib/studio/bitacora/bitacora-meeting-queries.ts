/**
 * Lecturas de actas/reuniones de Bitácora (SDD-0146 · Fase 2).
 *
 * Funciones puras que reciben SupabaseClient (patrón de la casa). Degradan a
 * []/null si la tabla aún no existe (0213/0214 las aplica el founder). La RLS
 * filtra: los borradores sólo los ve su creador (o admin); las confirmadas son
 * tenant-wide (salvo visibilidad='gestores').
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActaData,
  MeetingEstado,
  MeetingTipo,
  MeetingVisibilidad,
} from "./bitacora-types";

export interface BitacoraMeeting {
  id: string;
  tenant_id: string;
  titulo: string;
  fecha: string; // date YYYY-MM-DD
  tipo: MeetingTipo;
  client_id: string | null;
  contacto_libre: string | null;
  resumen: string | null;
  acta: ActaData | null;
  transcript: string | null;
  audio_path: string | null;
  estado: MeetingEstado;
  visibilidad: MeetingVisibilidad;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BitacoraMeetingListItem {
  id: string;
  titulo: string;
  fecha: string;
  tipo: MeetingTipo;
  resumen: string | null;
  acta: ActaData | null;
  client_id: string | null;
  clientName: string | null;
  clientMarkbox: string | null;
  contacto_libre: string | null;
  taskCount: number;
  confirmed_at: string | null;
}

const MEETING_SELECT =
  "id, tenant_id, titulo, fecha, tipo, client_id, contacto_libre, resumen, acta, transcript, audio_path, estado, visibilidad, created_by, confirmed_by, confirmed_at, created_at, updated_at";

const MEETING_LIST_SELECT =
  "id, titulo, fecha, tipo, resumen, acta, client_id, contacto_libre, confirmed_at, client:clients(name, markbox), tasks:bitacora_tasks(count)";

/** Una reunión con acta completa (o null si no existe / sin permiso / sin tabla). */
export async function getMeeting(
  supabase: SupabaseClient,
  id: string,
): Promise<BitacoraMeeting | null> {
  const { data, error } = await supabase
    .from("bitacora_meetings")
    .select(MEETING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as BitacoraMeeting;
}

interface MeetingListRow {
  id: string;
  titulo: string;
  fecha: string;
  tipo: MeetingTipo;
  resumen: string | null;
  acta: ActaData | null;
  client_id: string | null;
  contacto_libre: string | null;
  confirmed_at: string | null;
  client: { name: string | null; markbox: string | null } | null;
  tasks: { count: number }[] | null;
}

/**
 * Actas CONFIRMADAS del tenant (memoria institucional · tab "Actas"), más
 * recientes primero. Trae nombre del cliente y nº de tareas embebidos.
 */
export async function listMeetings(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<BitacoraMeetingListItem[]> {
  const { data, error } = await supabase
    .from("bitacora_meetings")
    .select(MEETING_LIST_SELECT)
    .eq("estado", "confirmada")
    .order("fecha", { ascending: false })
    .order("confirmed_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 200);

  if (error || !data) return [];

  return (data as unknown as MeetingListRow[]).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    fecha: row.fecha,
    tipo: row.tipo,
    resumen: row.resumen,
    acta: row.acta ?? null,
    client_id: row.client_id,
    clientName: row.client?.name ?? null,
    clientMarkbox: row.client?.markbox ?? null,
    contacto_libre: row.contacto_libre,
    taskCount: row.tasks?.[0]?.count ?? 0,
    confirmed_at: row.confirmed_at,
  }));
}
