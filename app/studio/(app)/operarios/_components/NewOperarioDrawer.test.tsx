/**
 * SDD-0515 · NewOperarioDrawer: el alta ya no sortea el PIN en el navegador.
 *
 * Lo que se afirma:
 *  - por defecto el PIN lo genera el servidor: el cliente no llama a
 *    Math.random y el formulario no manda `pin`;
 *  - «Escribirlo yo» arranca vacío, rechaza en vivo los comunes y manda el PIN
 *    escrito;
 *  - sin un motivo de la lista no se puede crear; «Empleado nuevo» viaja como
 *    su código y «Otro» con su texto;
 *  - el PIN devuelto se muestra con «Copiar PIN» y «Entra por
 *    https://dtdcargo.com/m/cn/login» (el alta del Studio es de China), y no se
 *    persiste en el navegador.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; pinReveal?: string; region?: "cn" | "ve" };

const createMock = vi.fn<(prev: State, fd: FormData) => Promise<State>>();

vi.mock("../actions", () => ({
  createOperarioAction: (prev: State, fd: FormData) => createMock(prev, fd),
}));

import { NewOperarioDrawer } from "./NewOperarioDrawer";

const WAREHOUSE = {
  id: "30000000-0000-4000-8000-000000000001",
  code: "YIW-A1",
  hub_name_es: "Yiwu",
  warehouse_name: null,
} as unknown as WarehouseCN;

/** El código de «Empleado nuevo». */
const MOTIVO = "empleado_nuevo";

function sent(): Record<string, string> {
  const fd = createMock.mock.calls[0][1];
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}

let setItem: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createMock.mockReset();
  createMock.mockImplementation(async (_prev, fd) => ({
    ok: true,
    pinReveal: fd.get("pin_mode") === "manual" ? String(fd.get("pin")) : "4827",
    region: "cn",
  }));
  setItem = vi.spyOn(Storage.prototype, "setItem");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const motivoSelect = () => screen.getByRole("combobox", { name: /^Motivo/ });

/** Nombre y motivo (por su rótulo); sin rótulo, deja el motivo sin elegir. */
async function llenar(user: ReturnType<typeof userEvent.setup>, motivo: string | null = "Empleado nuevo") {
  await user.type(screen.getByRole("textbox", { name: "Nombre *" }), "Li Wei");
  if (motivo) await user.selectOptions(motivoSelect(), motivo);
}

describe("NewOperarioDrawer · PIN generado en el servidor (por defecto)", () => {
  it("no sortea en el navegador ni manda pin, y manda el motivo", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    const user = userEvent.setup();
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);

    expect(mathRandom).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /Generar PIN/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("textbox", { name: /^PIN/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);

    await llenar(user);
    await user.click(screen.getByRole("button", { name: "Crear operario" }));
    await screen.findByText("4827");

    expect(mathRandom).not.toHaveBeenCalled();
    expect(sent()).toEqual({
      pin_mode: "generar",
      warehouse_id: WAREHOUSE.id,
      display_name: "Li Wei",
      display_name_cn: "",
      role: "operario",
      motivo: MOTIVO,
    });
  });

  it("muestra el PIN del operario nuevo con «Copiar PIN» y no lo guarda en el navegador", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);
    await llenar(user);
    await user.click(screen.getByRole("button", { name: "Crear operario" }));

    // Primero la vista de éxito y después su diálogo: buscar el diálogo antes
    // puede devolver el del formulario, que se desmonta al llegar la respuesta.
    const title = await screen.findByText("Operario creado");
    const dialog = title.closest<HTMLElement>("[role='dialog']")!;
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByText("4827")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("4827");
    expect(within(dialog).getByText("https://dtdcargo.com/m/cn/login").parentElement).toHaveTextContent(
      "Entra por https://dtdcargo.com/m/cn/login",
    );
    await user.click(within(dialog).getByRole("button", { name: "Copiar enlace" }));
    expect(writeText).toHaveBeenLastCalledWith("https://dtdcargo.com/m/cn/login");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("4827");
  });
});

describe("NewOperarioDrawer · motivo obligatorio", () => {
  it("sin motivo no deja crear; «Otro» pide al menos 4 caracteres", async () => {
    const user = userEvent.setup();
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);
    await llenar(user, null);

    expect(screen.getByRole("button", { name: "Crear operario" })).toBeDisabled();
    await user.selectOptions(motivoSelect(), "Otro");
    const texto = screen.getByRole("textbox", { name: /^Escribe el motivo/ });
    await user.type(texto, "abc");
    expect(screen.getByRole("button", { name: "Crear operario" })).toBeDisabled();
    await user.type(texto, "d");
    expect(screen.getByRole("button", { name: "Crear operario" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Crear operario" }));
    await screen.findByText("4827");
    expect(sent()).toMatchObject({ motivo: "otro", motivo_texto: "abcd" });
  });

  it("el error de PIN repetido del servidor se ve en el formulario", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue({
      fieldErrors: { pin: "Ese PIN ya lo usa otro operario activo de la misma región. Usa otro o genera uno nuevo." },
    });
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    await user.type(screen.getByRole("textbox", { name: /^PIN/ }), "7310");
    await llenar(user);
    await user.click(screen.getByRole("button", { name: "Crear operario" }));

    expect(
      await screen.findByText("Ese PIN ya lo usa otro operario activo de la misma región. Usa otro o genera uno nuevo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Operario creado")).not.toBeInTheDocument();
  });
});

describe("NewOperarioDrawer · escribirlo a mano", () => {
  it("arranca vacío, rechaza en vivo los comunes y manda el PIN escrito", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    const user = userEvent.setup();
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    const input = screen.getByRole("textbox", { name: /^PIN/ });
    expect(input).toHaveValue("");
    await llenar(user);

    await user.type(input, "1234");
    expect(screen.getByRole("alert")).toHaveTextContent("Ese PIN es muy fácil de adivinar. Usa otro o genera uno nuevo.");
    expect(screen.getByRole("button", { name: "Crear operario" })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "7310");
    await user.click(screen.getByRole("button", { name: "Crear operario" }));
    await screen.findByText("7310");
    expect(sent()).toMatchObject({ pin_mode: "manual", pin: "7310", motivo: MOTIVO });
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
