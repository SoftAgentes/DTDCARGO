/**
 * Calendario operativo — Slice 1 al Norte (SDD-0015).
 *
 * Server component: lee `?month=YYYY-MM` (sin param → mes actual), calcula
 * el rango visible del grid y fetcha los eventos operativos de embarques
 * (zarpe/arribo/entrega) del tenant en ese rango. Pasa eventos + feriados +
 * ferias al orquestador client `CalendarClient`, que maneja tabs, vistas
 * (Mes/Semana/Agenda), filtros y el drawer del día.
 *
 * Todo lectura — sin mutaciones. La RLS por tenant filtra los embarques.
 */

import { createClient } from "@/lib/db/server";
import {
  buildMonthGrid,
  parseMonthParam,
  toIso,
} from "@/lib/studio/calendar-helpers";
import { ALL_FAIRS_2026, ALL_HOLIDAYS_2026 } from "@/lib/studio/calendar-data";
import {
  listCalendarEvents,
} from "@/lib/studio/calendar-events-queries";
import type { CalendarEvent } from "@/lib/studio/calendar-events-types";
import { CalendarClient } from "./_components/CalendarClient";

export const metadata = { title: "Calendario" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawMonth = typeof sp.month === "string" ? sp.month : null;
  const cursor = parseMonthParam(rawMonth);

  // Rango visible del grid del mes (incluye relleno de mes anterior/siguiente).
  const cells = buildMonthGrid(cursor);
  const from = cells[0].isoDate;
  const to = cells[cells.length - 1].isoDate;
  const todayIso = toIso(new Date());

  let events: CalendarEvent[] = [];
  try {
    const supabase = await createClient();
    events = await listCalendarEvents(supabase, { from, to });
  } catch {
    // Calendario advisory: si la query falla (sesión/tenant), degradá a
    // solo feriados + ferias en vez de tumbar la página.
    events = [];
  }

  return (
    <div style={{ maxWidth: 1280 }}>
      <PageHeader />
      <CalendarClient
        cursor={cursor}
        events={events}
        holidays={ALL_HOLIDAYS_2026}
        fairs={ALL_FAIRS_2026}
        todayIso={todayIso}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div style={{ marginBottom: "var(--s-6)" }}>
      <span className="studio-eyebrow">Operación</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 12px", color: "var(--ink)" }}
      >
        Calendario operativo.
      </h1>
      <p
        style={{
          font: "400 13px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
          maxWidth: "60ch",
        }}
      >
        Zarpes, arribos y entregas de tus embarques, junto a los feriados y
        ferias de China y Venezuela. Haz clic en un día para ver el detalle.
      </p>
    </div>
  );
}
