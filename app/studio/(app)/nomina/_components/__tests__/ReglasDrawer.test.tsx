/**
 * SDD-0653 A2b · El panel de reglas con y sin la migración 0556.
 * Sin ella los campos nuevos salen deshabilitados y con un aviso; con ella se muestran, marcan como
 * «propuesto» lo que la versión no configuró y conservan la moneda de la versión que se edita.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReglasDrawer } from "../ReglasDrawer";
import { hoyCaracas, type PayrollRules } from "@/lib/studio/nomina/payroll-rules-types";

const mocks = vi.hoisted(() => ({ accion: vi.fn() }));
vi.mock("../../actions", () => ({ savePayrollRulesAction: (...args: unknown[]) => mocks.accion(...args) }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

beforeEach(() => {
  mocks.accion.mockReset();
  mocks.accion.mockResolvedValue({ error: "No se pudo guardar." });
});
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

/** Los ocho campos con propuesta de la norma (M1): nacen vacíos y no viajan como confirmados. */
const CAMPOS_PROPUESTA: Record<string, string> = {
  sso_patronal_pct: "9",
  rpe_patronal_pct: "2",
  faov_patronal_pct: "2",
  inces_patronal_pct: "2",
  inces_utilidades_pct: "0.5",
  pension_contrib_pct: "9",
  vacaciones_extra_max: "15",
  bono_vacacional_max_days: "30",
};

/** El texto de ayuda enlazado con aria-describedby de un campo (null si no tiene). */
function ayudaDe(name: string): string | null {
  const ids = (campo(name).getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  const textos = ids.map((id) => document.getElementById(id)?.textContent ?? "").filter((t) => t.startsWith("Sin configurar"));
  return textos.length ? textos[0] : null;
}

/** Envía el formulario y devuelve el FormData que recibió la acción. */
async function enviar(): Promise<FormData> {
  fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);
  await waitFor(() => expect(mocks.accion).toHaveBeenCalledOnce());
  return mocks.accion.mock.calls[0].at(-1) as FormData;
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
  });

  it("sin la 0556 no hay texto «Sin configurar»: los campos están deshabilitados", () => {
    render(<ReglasDrawer rules={reglas()} ampliada={false} onClose={cerrar} />);
    expect(screen.queryByText(/^Sin configurar/)).toBeNull();
  });

  it("los botones «Usar la propuesta» también quedan deshabilitados", () => {
    render(<ReglasDrawer rules={reglas()} ampliada={false} onClose={cerrar} />);
    for (const b of screen.getAllByRole("button", { name: /^Usar la propuesta/ })) expect(b).toBeDisabled();
  });
});

describe("ReglasDrawer · con la 0556 (ampliada = true)", () => {
  it("habilita los campos nuevos y no muestra el aviso", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    for (const name of CAMPOS_0556) expect(campo(name), name).toBeEnabled();
    expect(screen.queryByText("Campos nuevos en espera")).toBeNull();
  });

  it("M1: lo que la versión no configuró (null) nace VACÍO, y un texto visible dice «Sin configurar · propuesta: N»", () => {
    render(
      <ReglasDrawer
        rules={reglas({
          sso_patronal_pct: null,
          rpe_patronal_pct: null,
          faov_patronal_pct: null,
          inces_patronal_pct: null,
          inces_utilidades_pct: null,
          pension_contrib_pct: null,
          vacaciones_extra_max: null,
          bono_vacacional_max_days: null,
        })}
        ampliada
        onClose={cerrar}
      />,
    );
    for (const [name, propuesta] of Object.entries(CAMPOS_PROPUESTA)) {
      const el = campo(name) as HTMLInputElement;
      expect(el.value, name).toBe("");
      // Texto visible (no el gris de un placeholder), enlazado con aria-describedby.
      expect(ayudaDe(name), name).toBe(`Sin configurar · propuesta: ${propuesta}`);
      expect(el.placeholder, name).toBe("");
    }
    expect(screen.queryByText(/· propuesto/)).toBeNull();
    expect(screen.getAllByText(/^Sin configurar · propuesta:/)).toHaveLength(8);
  });

  it("A11Y: el texto «Sin configurar» desaparece con un valor y vuelve al vaciar el campo", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    const el = campo("sso_patronal_pct") as HTMLInputElement;
    expect(ayudaDe("sso_patronal_pct")).toBe("Sin configurar · propuesta: 9");
    fireEvent.input(el, { target: { value: "10" } });
    expect(ayudaDe("sso_patronal_pct")).toBeNull();
    expect(el.hasAttribute("aria-describedby")).toBe(false);
    fireEvent.input(el, { target: { value: "" } });
    expect(ayudaDe("sso_patronal_pct")).toBe("Sin configurar · propuesta: 9");
  });

  it("A11Y: «Usar la propuesta» también quita el texto «Sin configurar» de los campos que llena", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar la propuesta: escalas por antigüedad" }));
    expect(ayudaDe("vacaciones_extra_max")).toBeNull();
    expect(ayudaDe("bono_vacacional_max_days")).toBeNull();
    // Los de otros grupos siguen sin configurar.
    expect(ayudaDe("sso_patronal_pct")).toBe("Sin configurar · propuesta: 9");
  });

  it("A11Y: una versión que ya tenía el valor no muestra «Sin configurar» (ni siquiera cero)", () => {
    render(<ReglasDrawer rules={reglas({ sso_patronal_pct: 10, rpe_patronal_pct: 0 })} ampliada onClose={cerrar} />);
    expect(ayudaDe("sso_patronal_pct")).toBeNull();
    expect(ayudaDe("rpe_patronal_pct")).toBeNull();
    expect(screen.getAllByText(/^Sin configurar · propuesta:/)).toHaveLength(6);
  });

  it("A11Y: las notas no dicen «el valor gris» ni afirman que el campo siempre nace vacío", () => {
    render(<ReglasDrawer rules={reglas({ inces_utilidades_pct: 0.5 })} ampliada onClose={cerrar} />);
    const texto = screen.getByRole("dialog").textContent ?? "";
    expect(texto).not.toMatch(/valor gris/);
    expect(texto).not.toMatch(/El campo nace vacío/);
    expect(texto).toMatch(/Si esta versión no lo tenía configurado/);
  });

  it("M1: una versión anterior a la 0556 (campos que no trae) también nace vacía", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    for (const name of Object.keys(CAMPOS_PROPUESTA)) expect((campo(name) as HTMLInputElement).value, name).toBe("");
  });

  it("M1: guardar sin tocar nada envía vacío (null = sin configurar) en esos ocho campos", async () => {
    render(<ReglasDrawer rules={reglas({ min_salary: 130 })} ampliada onClose={cerrar} />);
    // Cambia otra cosa, que es lo que haría quien abre la versión para ajustar el salario.
    fireEvent.change(campo("min_salary"), { target: { value: "150" } });
    const datos = await enviar();
    expect(datos.get("min_salary")).toBe("150");
    for (const name of Object.keys(CAMPOS_PROPUESTA)) expect(datos.get(name), name).toBe("");
  });

  it("M1: tras «Usar la propuesta» el campo envía el valor, y solo los de ese grupo", async () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar la propuesta: aportes del patrono" }));
    expect((campo("sso_patronal_pct") as HTMLInputElement).value).toBe("9");
    expect((campo("pension_contrib_pct") as HTMLInputElement).value).toBe("9");
    // Los otros grupos no se tocan.
    expect((campo("inces_utilidades_pct") as HTMLInputElement).value).toBe("");
    expect((campo("vacaciones_extra_max") as HTMLInputElement).value).toBe("");
    const datos = await enviar();
    expect(datos.get("sso_patronal_pct")).toBe("9");
    expect(datos.get("rpe_patronal_pct")).toBe("2");
    expect(datos.get("faov_patronal_pct")).toBe("2");
    expect(datos.get("inces_patronal_pct")).toBe("2");
    expect(datos.get("pension_contrib_pct")).toBe("9");
    expect(datos.get("inces_utilidades_pct")).toBe("");
    expect(datos.get("vacaciones_extra_max")).toBe("");
  });

  it("M1: hay un botón por grupo (aportes, INCES sobre utilidades y escalas) y cada uno llena lo suyo", () => {
    render(<ReglasDrawer rules={reglas()} ampliada onClose={cerrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar la propuesta: INCES sobre utilidades" }));
    expect((campo("inces_utilidades_pct") as HTMLInputElement).value).toBe("0.5");
    fireEvent.click(screen.getByRole("button", { name: "Usar la propuesta: escalas por antigüedad" }));
    expect((campo("vacaciones_extra_max") as HTMLInputElement).value).toBe("15");
    expect((campo("bono_vacacional_max_days") as HTMLInputElement).value).toBe("30");
    expect((campo("sso_patronal_pct") as HTMLInputElement).value).toBe("");
  });

  it("M1: «Usar la propuesta» no pisa lo que ya hay: ni lo guardado ni lo que la persona escribió", () => {
    render(<ReglasDrawer rules={reglas({ sso_patronal_pct: 10 })} ampliada onClose={cerrar} />);
    fireEvent.change(campo("rpe_patronal_pct"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar la propuesta: aportes del patrono" }));
    expect((campo("sso_patronal_pct") as HTMLInputElement).value).toBe("10");
    expect((campo("rpe_patronal_pct") as HTMLInputElement).value).toBe("3");
    expect((campo("faov_patronal_pct") as HTMLInputElement).value).toBe("2");
  });

  it("un valor ya configurado se muestra tal cual", () => {
    render(<ReglasDrawer rules={reglas({ sso_patronal_pct: 10, rpe_patronal_pct: 0 })} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("IVSS del patrono")).toHaveValue(10);
    // El cero es un valor, no «sin configurar».
    expect(screen.getByLabelText("RPE del patrono")).toHaveValue(0);
  });

  it("el ingreso mínimo integral no tiene propuesta: queda vacío y sin texto de ayuda", () => {
    render(<ReglasDrawer rules={reglas({ ingreso_minimo_integral_usd: null })} ampliada onClose={cerrar} />);
    const el = screen.getByLabelText("Ingreso mínimo integral (USD)");
    expect(el).toHaveValue(null);
    expect(el).not.toHaveAttribute("placeholder");
    expect(ayudaDe("ingreso_minimo_integral_usd")).toBeNull();
  });

  it("sin versión previa, los campos también nacen vacíos y las monedas de los bonos arrancan en USD", () => {
    render(<ReglasDrawer rules={null} ampliada onClose={cerrar} />);
    expect(screen.getByLabelText("IVSS del patrono")).toHaveValue(null);
    expect(ayudaDe("sso_patronal_pct")).toBe("Sin configurar · propuesta: 9");
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
    expect(fecha.min).toBe("2000-01-01");
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
