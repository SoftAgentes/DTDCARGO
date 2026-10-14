/**
 * SDD-0515 · NewOperarioDrawer: el alta ya no sortea el PIN en el navegador.
 *
 * Lo que se afirma:
 *  - por defecto el PIN lo genera el servidor: el cliente no llama a
 *    Math.random y el formulario no manda `pin`;
 *  - «Escribirlo yo» arranca vacío, rechaza en vivo los comunes y manda el PIN
 *    escrito;
 *  - sin un motivo válido no se puede crear, y el motivo viaja en el formulario;
 *  - el PIN devuelto se muestra con «Copiar PIN» y no se persiste en el
 *    navegador.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; pinReveal?: string };

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

const MOTIVO = "Entra al turno de la mañana";

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
  }));
  setItem = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function llenar(user: ReturnType<typeof userEvent.setup>, motivo = MOTIVO) {
  await user.type(screen.getByRole("textbox", { name: "Nombre *" }), "Li Wei");
  if (motivo) await user.type(screen.getByRole("textbox", { name: /^Motivo/ }), motivo);
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

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Operario creado")).toBeInTheDocument();
    expect(within(dialog).getAllByText("4827")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("4827");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("4827");
  });
});

describe("NewOperarioDrawer · motivo obligatorio", () => {
  it("sin motivo no deja crear", async () => {
    const user = userEvent.setup();
    render(<NewOperarioDrawer warehouses={[WAREHOUSE]} onClose={() => {}} />);
    await llenar(user, "");

    expect(screen.getByRole("button", { name: "Crear operario" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /^Motivo/ }), "abc");
    expect(screen.getByRole("button", { name: "Crear operario" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /^Motivo/ }), "d");
    expect(screen.getByRole("button", { name: "Crear operario" })).toBeEnabled();
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
