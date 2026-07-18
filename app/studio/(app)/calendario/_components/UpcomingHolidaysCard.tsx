/**
 * UpcomingHolidaysCard — sidebar con próximos N feriados (SDD-0015).
 *
 * Lista compact: badge CN/VE · short name · fecha corta.
 */

import {
  formatShortDate,
  toIso,
  upcomingHolidays,
} from "@/lib/studio/calendar-helpers";
import type { Holiday } from "@/lib/studio/calendar-data";

type Props = {
  holidays: Holiday[];
  limit?: number;
};

function countryBadge(country: Holiday["country"]) {
  if (country === "CN") {
    return {
      label: "CN",
      bg: "var(--cal-cn-soft)",
      color: "var(--wine-text)",
      border: "var(--wine-soft)",
    };
  }
  return {
    label: "VE",
    bg: "var(--cal-ve-soft)",
    color: "var(--success)",
    border: "var(--success)",
  };
}

export function UpcomingHolidaysCard({ holidays, limit = 8 }: Props) {
  const todayIso = toIso(new Date());
  const next = upcomingHolidays(todayIso, holidays, limit);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "var(--s-5)",
      }}
    >
      <div
        className="studio-eyebrow"
        style={{ color: "var(--wine-text)", marginBottom: 14 }}
      >
        Próximos feriados
      </div>

      {next.length === 0 ? (
        <div
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            padding: "12px 0",
          }}
        >
          Sin feriados restantes en el calendario cargado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {next.map((h) => {
            const badge = countryBadge(h.country);
            const isRange = h.startDate !== h.endDate;
            return (
              <div
                key={h.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 10,
                  padding: "8px 10px",
                  background: "var(--bg-elevated)",
                  borderRadius: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "3px 7px",
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                    borderRadius: 4,
                    font: "700 10px/1 var(--f-sans)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {badge.label}
                </span>
                <div>
                  <div
                    style={{
                      font: "600 12px/1.2 var(--f-sans)",
                      fontFamily: "var(--f-sans), var(--f-cn)",
                      color: "var(--ink)",
                    }}
                  >
                    {h.shortName}
                    {h.critical && (
                      <span
                        style={{
                          marginLeft: 6,
                          font: "700 9px/1 var(--f-sans)",
                          color: "var(--warning)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        crítico
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    font: "700 10.5px/1.2 var(--f-mono)",
                    color: "var(--ink-soft)",
                    textAlign: "right",
                    letterSpacing: "0.02em",
                  }}
                >
                  {formatShortDate(h.startDate)}
                  {isRange && (
                    <>
                      <span style={{ color: "var(--ink-mute)" }}>→</span>
                      {formatShortDate(h.endDate)}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
