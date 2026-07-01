/**
 * Feriados & ferias (SDD-0127) — queries server-side.
 *
 * `getOperationalCalendar(supabase)` lista los eventos vivos del tenant
 * ordenados por fecha. RLS filtra por tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalCountry, CalKind, CalendarEvent } from "./op-calendar-types";

interface CalRow {
  id: string;
  country: string;
  kind: string;
  name: string;
  start_date: string;
  end_date: string | null;
  note: string | null;
}

export async function getOperationalCalendar(
  supabase: SupabaseClient,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("operational_calendar")
    .select("id, country, kind, name, start_date, end_date, note")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error || !data) return [];

  return data.map((r: CalRow) => ({
    id: r.id,
    country: (r.country === "CN" ? "CN" : "VE") as CalCountry,
    kind: (r.kind === "fair" ? "fair" : "holiday") as CalKind,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    note: r.note ?? "",
  }));
}
