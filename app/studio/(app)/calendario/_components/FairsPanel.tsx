"use client";

/**
 * FairsPanel — contenido de las tabs "Ferias CN" / "Ferias VE": lista de
 * ferias comerciales + feriados oficiales del país (Slice 1 · Norte).
 * Solo lectura, datos estáticos de `calendar-data`.
 */

import { formatShortDate } from "@/lib/studio/calendar-helpers";
import type { Fair, Holiday, HolidayCountry } from "@/lib/studio/calendar-data";
import { Badge } from "@/app/studio/_components/ui/Badge";

type Props = {
  country: HolidayCountry;
  fairs: Fair[];
  holidays: Holiday[];
};

function dateRange(start: string, end: string): string {
  return start === end
    ? formatShortDate(start)
    : `${formatShortDate(start)} → ${formatShortDate(end)}`;
}

export function FairsPanel({ country, fairs, holidays }: Props) {
  const sortedFairs = [...fairs].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const sortedHolidays = [...holidays].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const label = country === "CN" ? "China" : "Venezuela";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 12 }}>
          Ferias y expos · {label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedFairs.map((f) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                padding: "12px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--info)",
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    font: "700 13px/1.3 var(--f-sans)",
                    fontFamily: "var(--f-sans), var(--f-cn)",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {f.name}
                  {f.critical && (
                    <Badge tone="warning" size="sm">
                      Ancla
                    </Badge>
                  )}
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 3,
                  }}
                >
                  {f.city} · {f.sector}
                </div>
              </div>
              <div
                style={{
                  font: "700 11px/1.2 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {dateRange(f.startDate, f.endDate)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 12 }}>
          Feriados oficiales · {label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedHolidays.map((h) => (
            <div
              key={h.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                padding: "12px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${
                  country === "CN" ? "var(--wine)" : "var(--success)"
                }`,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  font: "700 13px/1.3 var(--f-sans)",
                  fontFamily: "var(--f-sans), var(--f-cn)",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {h.name}
                {h.critical && (
                  <Badge tone="warning" size="sm">
                    Crítico
                  </Badge>
                )}
              </div>
              <div
                style={{
                  font: "700 11px/1.2 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {dateRange(h.startDate, h.endDate)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
