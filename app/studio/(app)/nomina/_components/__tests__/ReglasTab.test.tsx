import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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

  it("la barra cuenta solo obligaciones: los anuncios y las referencias quedan fuera", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    const barra = screen.getByRole("progressbar");
    expect(barra.getAttribute("aria-valuenow")).toBe("12");
    expect(barra.getAttribute("aria-valuemax")).toBe("20");
    expect(screen.getByText("Obligaciones al día")).toBeTruthy();
    expect(screen.getAllByText("Referencia").length).toBe(3);
  });

  it("pone un asterisco en cada regla no verificada y ninguno en las verificadas", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    const asteriscos = screen.getAllByRole("button", { name: /no verificado\. Ver por qué/ });
    expect(asteriscos.length).toBe(PARAMETROS_LEY.filter((p) => !estaVerificado(p)).length);
    expect(asteriscos.length).toBe(13);
    expect(screen.queryByRole("button", { name: /^Salario mínimo: no verificado/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Utilidades: no verificado/ })).toBeNull();
  });

  it("el asterisco abre la ficha legal con la nota de consultar a un abogado", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Bono de guerra económica: no verificado/ }));
    const ficha = screen.getByRole("dialog", { name: "Bono de guerra económica" });
    expect(within(ficha).getByText(NOTA_NO_VERIFICADO)).toBeTruthy();
    expect(within(ficha).getByText("Solo anuncio")).toBeTruthy();
    expect(within(ficha).getByText(/No consta que obligue al sector privado/)).toBeTruthy();
    fireEvent.click(within(ficha).getByRole("button", { name: "Cerrar ficha legal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el cestaticket se explica como beneficio de ley con monto anunciado", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Cestaticket" }));
    const ficha = screen.getByRole("dialog", { name: "Cestaticket" });
    expect(within(ficha).getByText(/el beneficio es de ley/)).toBeTruthy();
    expect(within(ficha).getByText("Vigencia: por confirmar")).toBeTruthy();
    expect(within(ficha).getByText("Anuncio del Ejecutivo Nacional")).toBeTruthy();
  });

  it("una regla verificada abre su ficha sin la nota y dice dónde se leyó", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Salario mínimo" }));
    const ficha = screen.getByRole("dialog", { name: "Salario mínimo" });
    expect(within(ficha).queryByText(NOTA_NO_VERIFICADO)).toBeNull();
    expect(within(ficha).getByText(/G\.O\. N° 6\.691 Extraordinario/)).toBeTruthy();
    expect(within(ficha).getByText(/PDF de la Imprenta Nacional/)).toBeTruthy();
  });

  it("el filtro «No están en tus reglas» deja solo las obligaciones que faltan", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /No están en tus reglas \(8\)/ }));
    expect(screen.getByRole("button", { name: "Contribución para las pensiones" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salario mínimo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ingreso mínimo integral" })).toBeNull();
  });

  it("el filtro «Referencias» deja los anuncios y lo que no obliga", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Referencias \(3\)/ }));
    expect(screen.getByRole("button", { name: "Ingreso mínimo integral" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bono de guerra económica" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cestaticket" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salario mínimo" })).toBeNull();
  });

  it("muestra desde cuándo rige la versión y su fuente (migración 0556)", () => {
    render(<ReglasTab rules={{ ...rules, vigente_desde: "2026-11-01", fuente_legal: "Decreto de prueba" }} onEdit={() => {}} />);
    expect(screen.getByText("1 de noviembre de 2026")).toBeTruthy();
    expect(screen.getByText("Decreto de prueba")).toBeTruthy();
  });

  it("una versión anterior a la 0556 dice que no tiene fecha de vigencia", () => {
    render(<ReglasTab rules={{ ...rules, vigente_desde: null, fuente_legal: null }} onEdit={() => {}} />);
    expect(screen.getByText(/Sin fecha de vigencia registrada/)).toBeTruthy();
  });

  it("sin la 0556 (campos sin definir) no muestra ninguna línea de vigencia", () => {
    render(<ReglasTab rules={rules} onEdit={() => {}} />);
    expect(screen.queryByText(/Rige desde/)).toBeNull();
    expect(screen.queryByText(/Sin fecha de vigencia registrada/)).toBeNull();
  });

  it("sin reglas ofrece definirlas y sigue mostrando la ley", () => {
    const onEdit = vi.fn();
    render(<ReglasTab rules={null} onEdit={onEdit} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Definir reglas" })[0]);
    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salario mínimo" })).toBeTruthy();
  });

  it("MOT-01: el movimiento usa solo los tokens de duración y nada se repite sin fin", () => {
    const src = readFileSync("app/studio/(app)/nomina/_components/ReglasTab.tsx", "utf8");
    const css = src.slice(src.indexOf("const CSS = `"), src.indexOf("`;", src.indexOf("const CSS = `")));
    expect(css).not.toMatch(/infinite/);
    expect(css).not.toMatch(/(^|[\s:,])\d*\.?\d+m?s\b/m);
    expect(css).not.toMatch(/cubic-bezier/);
    expect(css).toMatch(/var\(--dur-fast\)/);
    expect(css).toMatch(/var\(--dur-slow\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(src.replace(css, "")).not.toMatch(/animation:\s*"/);
  });
});
