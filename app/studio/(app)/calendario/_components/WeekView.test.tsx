/**
 * SDD-0686 (revisión de la #741): la vista semana marca el feriado crítico de
 * China como el mes. Barra en peligro, ícono y la palabra «crítico», y el
 * estado en el nombre accesible del botón del día, que con `aria-label` tapa
 * el texto de adentro.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Holiday } from "@/lib/studio/calendar-data";
import { dayCellLabel } from "@/lib/studio/calendar-helpers";
import { WeekView } from "./WeekView";

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
    <WeekView
      cursor={{ year: 2027, month: 2 }}
      events={[]}
      holidays={holidays}
      fairs={[]}
      todayIso="2027-02-08"
      onDayClick={() => {}}
    />,
  );
}

describe("WeekView · feriado crítico de China", () => {
  it("el día con feriado crítico lo dice en su nombre accesible", () => {
    pintar([feriado(true)]);
    expect(screen.getByRole("button", { name: /feriado crítico/ })).toHaveAccessibleName(
      "Ver eventos del 2027-02-08, feriado crítico en China",
    );
  });

  it("el chip del crítico va en peligro y dice «crítico»; el común, en atención", () => {
    pintar([feriado(true)]);
    const critico = screen.getByText(/Feriado CN · CNY/);
    expect(critico.textContent).toContain("· crítico");
    expect(critico.getAttribute("style")).toContain("3px solid var(--danger)");
    cleanup();
    pintar([feriado(false)]);
    const comun = screen.getByText(/Feriado CN · QM/);
    expect(comun.textContent).not.toContain("crítico");
    expect(comun.getAttribute("style")).toContain("3px solid var(--warning)");
  });
});

describe("dayCellLabel", () => {
  it("anuncia feriados, ferias y eventos que el aria-label taparía", () => {
    const ve: Holiday = { id: "ve", country: "VE", startDate: "2027-02-08", endDate: "2027-02-08", name: "Carnaval", shortName: "Carnaval" };
    expect(dayCellLabel("2027-02-08", [feriado(true), ve], 1, 3)).toBe(
      "Ver eventos del 2027-02-08, feriado crítico en China, feriado en Venezuela, 1 feria, 3 eventos",
    );
    expect(dayCellLabel("2027-02-09", [], 0, 1)).toBe("Ver eventos del 2027-02-09, 1 evento");
    expect(dayCellLabel("2027-02-10", [], 2, 0)).toBe("Ver eventos del 2027-02-10, 2 ferias");
  });

  it("con muchos feriados y eventos el nombre tiene tope: dos feriados, «y N más», y los eventos contados", () => {
    const comun = (id: string, country: "CN" | "VE"): Holiday => ({
      id, country, startDate: "2027-02-08", endDate: "2027-02-08", name: id, shortName: id,
    });
    const muchos = [comun("a", "VE"), comun("b", "CN"), feriado(true), comun("c", "VE"), comun("d", "CN")];
    const nombre = dayCellLabel("2027-02-08", muchos, 4, 37);
    // El crítico va primero aunque llegue de tercero.
    expect(nombre).toBe(
      "Ver eventos del 2027-02-08, feriado crítico en China, feriado en Venezuela, y 3 feriados más, 4 ferias, 37 eventos",
    );
    expect(nombre.split(", ").length).toBeLessThanOrEqual(6);
    expect(dayCellLabel("2027-02-08", [comun("a", "VE"), comun("b", "CN"), comun("c", "VE")], 0, 0)).toBe(
      "Ver eventos del 2027-02-08, feriado en Venezuela, feriado en China, y 1 feriado más",
    );
  });
});
