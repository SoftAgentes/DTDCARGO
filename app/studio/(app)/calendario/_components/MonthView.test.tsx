/**
 * SDD-0686 · grupo 5 (revisión de la #741): el feriado crítico de China no se
 * dice solo con color. El botón del día lleva `aria-label`, que tapa el texto
 * de adentro, así que los feriados (y si es crítico) tienen que estar en ese
 * nombre accesible (`dayCellLabel`).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Holiday } from "@/lib/studio/calendar-data";
import { MonthView } from "./MonthView";

afterEach(cleanup);

const feriado = (critical: boolean): Holiday => ({
  id: critical ? "cny" : "qingming",
  country: "CN",
  startDate: "2027-02-08",
  endDate: "2027-02-08",
  name: critical ? "Año Nuevo Chino" : "Qingming",
  shortName: critical ? "CNY" : "QM",
  critical,
});

function pintar(holidays: Holiday[]) {
  render(
    <MonthView
      cursor={{ year: 2027, month: 2 }}
      events={[]}
      holidays={holidays}
      fairs={[]}
      todayIso="2027-02-01"
      onDayClick={() => {}}
    />,
  );
}

describe("MonthView · feriado crítico de China", () => {
  it("el día con feriado crítico lo dice en su nombre accesible", () => {
    pintar([feriado(true)]);
    const dia = screen.getByRole("button", { name: /feriado crítico/ });
    expect(dia).toHaveAccessibleName("Ver eventos del 2027-02-08, feriado crítico en China");
  });

  it("un feriado común se anuncia, pero no como crítico", () => {
    pintar([feriado(false)]);
    expect(screen.queryByRole("button", { name: /feriado crítico/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ver eventos del 2027-02-08, feriado en China" })).toBeInTheDocument();
  });

  it("el crítico lleva la barra en peligro, no en atención", () => {
    pintar([feriado(true)]);
    const dia = screen.getByRole("button", { name: /feriado crítico/ });
    expect(dia.getAttribute("style")).toContain("inset 3px 0 0 var(--danger)");
  });
});
