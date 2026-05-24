/**
 * Calendario operativo — vista mes con feriados CN/VE (SDD-0015).
 *
 * Server component lee `?month=YYYY-MM` (sin param → mes actual).
 * Renderiza header con navegación, grid del mes con feriados pintados,
 * y sidebar con próximos feriados + warning permanente CN.
 *
 * Vistas Semana y Agenda son placeholders disabled hasta SDD futuro.
 */

import {
  parseMonthParam,
} from "@/lib/studio/calendar-helpers";
import { ALL_HOLIDAYS_2026 } from "@/lib/studio/calendar-data";
import { CalendarHeader } from "./_components/CalendarHeader";
import { MonthGrid } from "./_components/MonthGrid";
import { UpcomingHolidaysCard } from "./_components/UpcomingHolidaysCard";
import { CNHolidayWarning } from "./_components/CNHolidayWarning";
import { CalendarLegend } from "./_components/CalendarLegend";

export const metadata = { title: "Calendario" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawMonth = typeof sp.month === "string" ? sp.month : null;
  const cursor = parseMonthParam(rawMonth);

  return (
    <div style={{ maxWidth: 1280 }}>
      <PageHeader />

      <div className="studio-calendar-grid">
        {/* Izquierda · Header de navegación + grid + leyenda */}
        <div>
          <CalendarHeader cursor={cursor} />
          <MonthGrid cursor={cursor} holidays={ALL_HOLIDAYS_2026} />
          <CalendarLegend />
        </div>

        {/* Derecha · próximos feriados + warning CN */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <UpcomingHolidaysCard holidays={ALL_HOLIDAYS_2026} />
          <CNHolidayWarning />
        </aside>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div
      style={{
        marginBottom: 24,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">Operación</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "8px 0 12px",
            color: "var(--ink)",
          }}
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
          Feriados CN y VE 2026. Planificá zarpes alrededor de las
          paradas de operación en Yiwu y Shenzhen.
        </p>
      </div>
    </div>
  );
}
