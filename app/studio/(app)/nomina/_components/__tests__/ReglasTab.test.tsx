import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReglasTab } from "../ReglasTab";
import type { PayrollRules } from "@/lib/studio/nomina/payroll-rules-types";
import { NOTA_NO_VERIFICADO, PARAMETROS_LEY, estaVerificado } from "@/lib/studio/nomina/ley/parametros";

afterEach(() => cleanup());

const rules: PayrollRules = {
  id: "r1",
  tenant_id: "t1",
  version: 2,
  status: "vigente",
  pay_frequency: "mensual",
  day_method: "30",
  min_salary: 130,
  cestaticket: 40,
  bono_guerra: 90,
  sso_pct: 4,
  rpe_pct: 0.5,
  faov_pct: 1,
  sso_cap_sm: 5,
  rpe_cap_sm: 10,
  overtime_pct: 50,
  night_pct: 30,
  holiday_pct: 50,
  utilidades_days: 30,
  bono_vacacional_days: 15,
  vacaciones_days: 15,
  salarial_bonuses: [],
  notes: null,
  created_by: null,
  created_at: "2026-11-16T12:00:00Z",
  updated_at: "2026-11-16T12:00:00Z",
  deleted_at: null,
};

describe("ReglasTab (SDD-0653)", () => {
  it("muestra la versión y la fecha de actualización", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    expect(screen.getByRole("heading", { name: "Versión 2" })).toBeTruthy();
    expect(screen.getByText("16 de noviembre de 2026")).toBeTruthy();
  });

  it("pone un asterisco en cada regla no verificada y ninguno en las verificadas", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    const asteriscos = screen.getAllByRole("button", { name: /no verificado\. Ver por qué/ });
    expect(asteriscos.length).toBe(PARAMETROS_LEY.filter((p) => !estaVerificado(p)).length);
    expect(screen.queryByRole("button", { name: /^Salario mínimo: no verificado/ })).toBeNull();
  });

  it("el asterisco abre la ficha legal con la nota de consultar a un abogado", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Bono de guerra económica: no verificado/ }));
    const ficha = screen.getByRole("dialog", { name: "Bono de guerra económica" });
    expect(within(ficha).getByText(NOTA_NO_VERIFICADO)).toBeTruthy();
    expect(within(ficha).getByText("Solo anuncio")).toBeTruthy();
    fireEvent.click(within(ficha).getByRole("button", { name: "Cerrar ficha legal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("una regla verificada abre su ficha sin la nota", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Salario mínimo" }));
    const ficha = screen.getByRole("dialog", { name: "Salario mínimo" });
    expect(within(ficha).queryByText(NOTA_NO_VERIFICADO)).toBeNull();
    expect(within(ficha).getByText(/G\.O\. N° 6\.691 Extraordinario/)).toBeTruthy();
    expect(within(ficha).getByText(/PDF de la Imprenta Nacional/)).toBeTruthy();
  });

  it("el filtro «No están en tus reglas» deja solo lo que falta", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /No están en tus reglas/ }));
    expect(screen.getByRole("button", { name: "Contribución para las pensiones" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salario mínimo" })).toBeNull();
  });

  it("sin reglas ofrece definirlas y sigue mostrando la ley", () => {
    const onEdit = vi.fn();
    render(<ReglasTab rules={null} onEdit={onEdit} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Definir reglas" })[0]);
    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salario mínimo" })).toBeTruthy();
  });
});
