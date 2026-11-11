/**
 * Una respuesta con errores no borra lo que la persona escribió en un panel de Nómina.
 *
 * React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la acción,
 * aunque esta devuelva un error. Cada panel llena todos sus campos, recibe un error y debe
 * conservarlos: es lo que pide FRM-01 («Cambios sin guardar se conservan»).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AmonestacionDrawer } from "../AmonestacionDrawer";
import { AsistenciaDrawer } from "../AsistenciaDrawer";
import { CuotaPrestamoDrawer } from "../CuotaPrestamoDrawer";
import { EmpleadoDrawer } from "../EmpleadoDrawer";
import { EnviarComunicacionDrawer } from "../EnviarComunicacionDrawer";
import { FeriadoDrawer } from "../FeriadoDrawer";
import { GenerarCorteDrawer } from "../GenerarCorteDrawer";
import { GenerarFiniquitoDrawer } from "../GenerarFiniquitoDrawer";
import { GenerarInvitacionDrawer } from "../GenerarInvitacionDrawer";
import { PagoPrestadorDrawer } from "../PagoPrestadorDrawer";
import { PrestadorDrawer } from "../PrestadorDrawer";
import { PrestamoDrawer } from "../PrestamoDrawer";
import { PuestoDrawer } from "../PuestoDrawer";
import { ReglasDrawer } from "../ReglasDrawer";
import { RevisarSolicitudDrawer } from "../RevisarSolicitudDrawer";

const mocks = vi.hoisted(() => ({ accion: vi.fn() }));
vi.mock("../../actions", () => {
  // `bind` de los paneles de edición antepone el id: la acción sólo mira el FormData.
  const a = (...args: unknown[]) => mocks.accion(...args);
  return {
    emitirAmonestacionAction: a,
    createAttendanceAction: a,
    updateAttendanceAction: a,
    softDeleteAttendanceAction: a,
    registerLoanInstallmentAction: a,
    cancelLoanAction: a,
    createEmployeeAction: a,
    updateEmployeeAction: a,
    softDeleteEmployeeAction: a,
    sendCommAction: a,
    createHolidayAction: a,
    generatePayrollRunAction: a,
    generarFiniquitoAction: a,
    createInviteAction: a,
    createContractorPaymentAction: a,
    createContractorAction: a,
    updateContractorAction: a,
    softDeleteContractorAction: a,
    createLoanAction: a,
    createPositionAction: a,
    updatePositionAction: a,
    softDeletePositionAction: a,
    savePayrollRulesAction: a,
    approveRegistrationAction: a,
    rejectRegistrationAction: a,
  };
});
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

const MSG = "No se pudo guardar.";
const cerrar = () => {};
const EMPLEADOS = [{ id: "e1", full_name: "Ana Pérez", employee_code: "E-1" }] as never;
const PRESTADORES = [{ id: "c1", full_name: "Luis Díaz", contractor_code: "P-1" }] as never;
const PRESTAMO = { id: "l1", employee_name: "Ana Pérez", employee_code: "E-1", installment_usd: 25, balance_usd: 300 } as never;
const SOLICITUD = { id: "s1", full_name: "Eva Ruiz", email: "eva@example.test", phone: "0", national_id: "V-1", cargo: "Operario", bank_name: "B", bank_account: "1" } as never;

const PANELES: [string, ReactElement][] = [
  ["AsistenciaDrawer", <AsistenciaDrawer key="a" record={null} employees={EMPLEADOS} employeeName={null} onClose={cerrar} />],
  ["CuotaPrestamoDrawer", <CuotaPrestamoDrawer key="b" loan={PRESTAMO} onClose={cerrar} />],
  ["EmpleadoDrawer", <EmpleadoDrawer key="c" employee={null} positions={[]} canManageUsers={false} onClose={cerrar} />],
  ["EnviarComunicacionDrawer", <EnviarComunicacionDrawer key="d" employees={EMPLEADOS} onClose={cerrar} />],
  ["FeriadoDrawer", <FeriadoDrawer key="e" onClose={cerrar} />],
  ["GenerarCorteDrawer", <GenerarCorteDrawer key="f" rules={null} onClose={cerrar} />],
  ["GenerarFiniquitoDrawer", <GenerarFiniquitoDrawer key="g" employees={EMPLEADOS} rules={null} onClose={cerrar} />],
  ["GenerarInvitacionDrawer", <GenerarInvitacionDrawer key="h" onClose={cerrar} />],
  ["PagoPrestadorDrawer", <PagoPrestadorDrawer key="i" contractors={PRESTADORES} onClose={cerrar} />],
  ["PrestadorDrawer", <PrestadorDrawer key="j" contractor={null} onClose={cerrar} />],
  ["PrestamoDrawer", <PrestamoDrawer key="k" employees={EMPLEADOS} onClose={cerrar} />],
  ["PuestoDrawer", <PuestoDrawer key="l" position={null} onClose={cerrar} />],
  ["ReglasDrawer", <ReglasDrawer key="m" rules={null} onClose={cerrar} />],
  ["RevisarSolicitudDrawer, al aprobar", <RevisarSolicitudDrawer key="n" registration={SOLICITUD} onClose={cerrar} />],
];

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const formulario = () => screen.getByRole("dialog").querySelector("form") as HTMLFormElement;

function campos(form: HTMLFormElement): Campo[] {
  return (Array.from(form.elements) as Campo[]).filter((el) => {
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || el.disabled || !el.name) return false;
    return !["hidden", "radio", "file"].includes(el.type);
  });
}

const valorDe = (el: Campo) => (el.type === "checkbox" ? (el as HTMLInputElement).checked : el.value);

/** Le escribe a cada campo un valor distinto del inicial. */
function llenar(form: HTMLFormElement) {
  for (const el of campos(form)) {
    if (el.type === "checkbox") fireEvent.click(el);
    else if (el.tagName === "SELECT") {
      const opciones = Array.from((el as HTMLSelectElement).options).filter((o) => !o.disabled && o.value !== el.value);
      if (opciones.length) fireEvent.change(el, { target: { value: opciones[opciones.length - 1].value } });
    } else if (el.type === "number") fireEvent.change(el, { target: { value: "123" } });
    else if (el.type === "date") fireEvent.change(el, { target: { value: "2026-03-15" } });
    else if (el.type === "time") fireEvent.change(el, { target: { value: "08:30" } });
    else if (el.type === "email") fireEvent.change(el, { target: { value: "ana@example.test" } });
    else fireEvent.change(el, { target: { value: "Texto de prueba" } });
  }
}

beforeEach(() => {
  mocks.accion.mockReset();
  mocks.accion.mockResolvedValue({ error: MSG });
});

describe("una respuesta con errores conserva lo escrito", () => {
  it.each(PANELES)("%s", async (_nombre, panel) => {
    render(panel);
    const form = formulario();
    llenar(form);
    const escrito = campos(form).map((el) => [el.name, valorDe(el)]);
    expect(escrito.length).toBeGreaterThan(0);

    fireEvent.submit(form);
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    await act(async () => {});

    expect(mocks.accion).toHaveBeenCalledOnce();
    expect(campos(formulario()).map((el) => [el.name, valorDe(el)])).toEqual(escrito);
  });

  it("RevisarSolicitudDrawer, al rechazar", async () => {
    render(<RevisarSolicitudDrawer registration={SOLICITUD} onClose={cerrar} />);
    fireEvent.click(screen.getByRole("button", { name: /^Rechazar/ }));
    const form = screen.getByRole("dialog").querySelector("#rechazar-solicitud-form") as HTMLFormElement;
    llenar(form);
    const escrito = campos(form).map((el) => [el.name, valorDe(el)]);
    expect(escrito.length).toBeGreaterThan(0);

    fireEvent.submit(form);
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    await act(async () => {});

    expect(campos(form).map((el) => [el.name, valorDe(el)])).toEqual(escrito);
  });

  it("AmonestacionDrawer, que sólo envía campos ocultos con estado, sigue enviándolos", async () => {
    render(<AmonestacionDrawer employees={EMPLEADOS} onClose={cerrar} />);
    fireEvent.submit(formulario());
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    const datos = mocks.accion.mock.calls[0].at(-1) as FormData;
    expect(datos.get("employee_id")).toBe("e1");
    expect(datos.has("narrative")).toBe(true);
  });

  it("envía lo escrito en el FormData de la acción", async () => {
    render(<PrestamoDrawer employees={EMPLEADOS} onClose={cerrar} />);
    llenar(formulario());
    fireEvent.submit(formulario());
    await waitFor(() => expect(mocks.accion).toHaveBeenCalledOnce());
    const datos = mocks.accion.mock.calls[0].at(-1) as FormData;
    expect(datos.get("employee_id")).toBe("e1");
    expect(datos.get("principal_usd")).toBe("123");
    expect(datos.get("concept")).toBe("Texto de prueba");
  });

  // Sin `action`, jsdom no nota la diferencia; el navegador sí mandaría los campos por la URL.
  it("evita el envío nativo del navegador", async () => {
    render(<PrestamoDrawer employees={EMPLEADOS} onClose={cerrar} />);
    expect(fireEvent.submit(formulario())).toBe(false);
    await waitFor(() => expect(mocks.accion).toHaveBeenCalledOnce());
  });

  it("no envía dos veces mientras la primera sigue en curso", async () => {
    let responder!: (v: unknown) => void;
    mocks.accion.mockImplementationOnce(() => new Promise((r) => { responder = r; }));
    render(<PrestamoDrawer employees={EMPLEADOS} onClose={cerrar} />);
    fireEvent.submit(formulario());
    await waitFor(() => expect(screen.getByRole("button", { name: "chrome.drawer.submitting" })).toBeDisabled());
    fireEvent.submit(formulario());
    await act(async () => responder({ error: MSG }));
    expect(mocks.accion).toHaveBeenCalledOnce();
  });
});

describe("regla para los paneles de Nómina", () => {
  it("ninguno usa <form action={...}>: los campos sin estado se vaciarían", () => {
    const carpeta = join(process.cwd(), "app/studio/(app)/nomina/_components");
    const conAction = readdirSync(carpeta)
      .filter((f) => f.endsWith("Drawer.tsx"))
      .filter((f) => /<form\b[^>]*\baction=\{/s.test(readFileSync(join(carpeta, f), "utf8")));
    expect(conAction).toEqual([]);
  });
});
