/**
 * SDD-0653 A2b · El panel de reglas con y sin la migración 0556.
 * Sin ella los campos nuevos salen deshabilitados y con un aviso; con ella se muestran, marcan como
 * «propuesto» lo que la versión no configuró y conservan la moneda de la versión que se edita.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReglasDrawer } from "../ReglasDrawer";
import { hoyCaracas, type PayrollRules } from "@/lib/studio/nomina/payroll-rules-types";

vi.mock("../../actions", () => ({ savePayrollRulesAction: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

afterEach(() => cleanup());

const cerrar = () => {};

const CAMPOS_0556 = [
  "vigente_desde",
  "fuente_legal",
  "cestaticket_moneda",
  "bono_guerra_moneda",
  "ingreso_minimo_integral_usd",
  "sso_patronal_pct",
  "rpe_patronal_pct",
  "faov_patronal_pct",
  "inces_patronal_pct",
  "inces_utilidades_pct",
  "pension_contrib_pct",
  "vacaciones_extra_max",
  "bono_vacacional_max_days",
];

function reglas(over: Partial<PayrollRules> = {}): PayrollRules {
  return {
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
    ...over,
  };
}

const campo = (name: string) => screen.getByRole("dialog").querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;

describe("ReglasDrawer · sin la 0556 (ampliada = false)", () => {
  it("deshabilita todos los campos nuevos y lo avisa", () => {
    render(<ReglasDrawer rules={reglas()} ampliada={false} onClose={cerrar} />);
    for (const name of CAMPOS_0556) expect(campo(name), name).toBeDisabled();
    expect(screen.getByText("Campos nuevos en espera")).toBeInTheDocument();
    expect(screen.getByText(/migración 0556/)).toBeInTheDocument();
  });

  it("los campos de siempre siguen habilitados y con su valor", () => {
    render(<ReglasDrawer rules={reglas()} ampliada={false} onClose={cerrar} />);
    expect(campo("min_salary")).toBeEnabled();
    expect((campo("min_salary") as HTMLInputElement).value).toBe("130");
    expect(campo("sso_pct")).toBeEnabled();
  });

  it("no muestra propuestas en los campos en espera: vacíos y sin «propuesto»", () => {
    render(<ReglasDrawer rules={reglas()} ampliada={false} onClose={cerrar} />);
    expect((campo("sso_patronal_pct") as HTMLInputElement).value).toBe("");
    // Ninguna etiqueta de campo lleva la marca (la nota explicativa del grupo sí nombra la palabra).
    expect(screen.queryByText(/· propuesto/)).toBeNull();
  });
});

describe("ReglasDrawer · con la 0556 (ampliada = true)", () => {
  it("habilita los campos nuevos y no muestra el aviso", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    for (const name of CAMPOS_0556) expect(campo(name), name).toBeEnabled();
    expect(screen.queryByText("Campos nuevos en espera")).toBeNull();
  });

  it("lo que la versión no configuró (null) sale como propuesta marcada «propuesto»", () => {
    render(<ReglasDrawer rules={reglas({ sso_patronal_pct: null, pension_contrib_pct: null })} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("IVSS del patrono · propuesto")).toHaveValue(9);
    expect(screen.getByLabelText("Contribución de pensiones · propuesto")).toHaveValue(9);
  });

  it("un valor ya configurado se muestra tal cual y sin «propuesto»", () => {
    render(<ReglasDrawer rules={reglas({ sso_patronal_pct: 10, rpe_patronal_pct: 0 })} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("IVSS del patrono")).toHaveValue(10);
    // El cero es un valor, no «sin configurar».
    expect(screen.getByLabelText("RPE del patrono")).toHaveValue(0);
  });

  it("el ingreso mínimo integral no tiene propuesta: queda vacío y sin marca", () => {
    render(<ReglasDrawer rules={reglas({ ingreso_minimo_integral_usd: null })} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("Ingreso mínimo integral (USD)")).toHaveValue(null);
  });

  it("sin versión previa, los aportes se proponen y las monedas de los bonos arrancan en USD", () => {
    render(<ReglasDrawer rules={null} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("IVSS del patrono · propuesto")).toHaveValue(9);
    expect(campo("cestaticket_moneda").value).toBe("USD");
    expect(campo("bono_guerra_moneda").value).toBe("USD");
  });

  it("editar una versión guardada en bolívares conserva VES en la moneda de los bonos", () => {
    render(<ReglasDrawer rules={reglas({ cestaticket_moneda: "VES", bono_guerra_moneda: "USD" })} ampliada onClose={cerrar} />);
    expect(campo("cestaticket_moneda").value).toBe("VES");
    expect(campo("bono_guerra_moneda").value).toBe("USD");
  });

  it("«Rige desde» es informativa: arranca hoy en Caracas y no admite una fecha posterior", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    const hoy = hoyCaracas();
    const fecha = campo("vigente_desde") as HTMLInputElement;
    expect(fecha.max).toBe(hoy);
    expect(fecha.value).toBe(hoy);
    expect(screen.getByText(/Es informativa/)).toBeInTheDocument();
  });

  it("el INCES sobre utilidades va entre las deducciones del empleado, no entre los aportes del patrono", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    const deducciones = screen.getByText("Deducciones del empleado (%)");
    const aportes = screen.getByText("Aportes del patrono (%)");
    const inces = campo("inces_utilidades_pct");
    expect(deducciones.compareDocumentPosition(inces) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inces.compareDocumentPosition(aportes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/es una retención, no un aporte del patrono/)).toBeInTheDocument();
  });

  it("la contribución de pensiones no deja pasar de 15 % (Art. 7)", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    expect((campo("pension_contrib_pct") as HTMLInputElement).max).toBe("15");
  });
});
