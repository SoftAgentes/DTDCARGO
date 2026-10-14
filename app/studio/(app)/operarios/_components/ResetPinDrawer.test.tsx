/**
 * SDD-0513 · ResetPinDrawer: el PIN se ve una vez y desaparece al cerrar.
 *
 * El cajón corre con el DrawerShell REAL (botón Cerrar, Escape) dentro de un
 * arnés que hace lo mismo que OperariosClient: al cerrar lo desmonta y al
 * reabrir lo monta de cero. Las server actions son dobles: acá se prueba la
 * UI, el servidor tiene su propia suite (__tests__/reset-pin-actions.test.ts).
 *
 * Lo que se afirma:
 *  - por defecto el PIN lo genera el servidor: el formulario no manda `pin` y
 *    el cliente no sortea nada (Math.random no se llama);
 *  - el PIN devuelto se muestra con el aviso «Anótalo ahora: no se vuelve a
 *    mostrar.» y se puede copiar;
 *  - al cerrar (Listo, Cerrar o Escape) el PIN sale del DOM y al reabrir no
 *    vuelve;
 *  - nunca se escribe en localStorage, sessionStorage, la URL ni el historial;
 *  - el camino manual sigue: campo vacío, rechazo en vivo de los comunes y
 *    envío con el PIN escrito.
 */
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; pinReveal?: string };

const generateMock = vi.fn<(prev: State, fd: FormData) => Promise<State>>();
const resetMock = vi.fn<(prev: State, fd: FormData) => Promise<State>>();

vi.mock("../actions", () => ({
  generateOperarioPinAction: (prev: State, fd: FormData) => generateMock(prev, fd),
  resetOperarioPinAction: (prev: State, fd: FormData) => resetMock(prev, fd),
}));

import { ResetPinDrawer } from "./ResetPinDrawer";

const OPERARIO: OperarioRow = {
  id: "50000000-0000-4000-8000-000000000001",
  tenant_id: "10000000-0000-4000-8000-000000000001",
  warehouse_id: null,
  region: "ve",
  display_name: "Yusneidy Pérez",
  display_name_cn: null,
  role: "operario",
  active: true,
  last_login_at: null,
  created_at: "2026-05-26T00:00:00Z",
  warehouse_code: null,
  warehouse_name_es: null,
};

/** Igual que OperariosClient: cerrar = desmontar; reabrir = montar de cero. */
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir restablecer
      </button>
      {open && <ResetPinDrawer operario={OPERARIO} onClose={() => setOpen(false)} />}
    </>
  );
}

function sentFields(mock: typeof generateMock): Record<string, string> {
  const fd = mock.mock.calls[0][1];
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}

let setItem: ReturnType<typeof vi.spyOn>;
let pushState: ReturnType<typeof vi.spyOn>;
let replaceState: ReturnType<typeof vi.spyOn>;
let hrefBefore: string;

beforeEach(() => {
  generateMock.mockReset();
  resetMock.mockReset();
  generateMock.mockResolvedValue({ ok: true, pinReveal: "4827" });
  resetMock.mockImplementation(async (_prev, fd) => ({
    ok: true,
    pinReveal: String(fd.get("pin")),
  }));
  setItem = vi.spyOn(Storage.prototype, "setItem");
  pushState = vi.spyOn(window.history, "pushState");
  replaceState = vi.spyOn(window.history, "replaceState");
  hrefBefore = window.location.href;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function expectNothingPersisted(pin: string) {
  expect(setItem).not.toHaveBeenCalled();
  expect(window.location.href).toBe(hrefBefore);
  expect(window.location.href).not.toContain(pin);
  expect(JSON.stringify(pushState.mock.calls)).not.toContain(pin);
  expect(JSON.stringify(replaceState.mock.calls)).not.toContain(pin);
}

async function restablecerGenerado(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
  await screen.findByText("4827");
}

describe("ResetPinDrawer · generar PIN nuevo (por defecto)", () => {
  it("el cliente no sortea nada y el formulario no manda pin", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("radio", { name: /Generar PIN nuevo/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);

    await restablecerGenerado(user);

    expect(mathRandom).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(resetMock).not.toHaveBeenCalled();
    expect(sentFields(generateMock)).toEqual({ operario_id: OPERARIO.id, pin_mode: "generar" });
  });

  it("muestra el PIN una vez con el aviso y lo copia", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness />);
    await restablecerGenerado(user);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("PIN restablecido")).toBeInTheDocument();
    expect(within(dialog).getByText("Anótalo ahora: no se vuelve a mostrar.")).toBeInTheDocument();
    expect(within(dialog).getAllByText("4827")).toHaveLength(1);

    await user.click(within(dialog).getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("4827");
    expect(within(dialog).getByRole("status")).toHaveTextContent("PIN copiado.");
    expect(within(dialog).getByRole("button", { name: "Copiado" })).toBeInTheDocument();
    expectNothingPersisted("4827");
  });

  it("si el portapapeles falla, pide anotarlo a mano", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denegado"));
    render(<Harness />);
    await restablecerGenerado(user);

    await user.click(screen.getByRole("button", { name: "Copiar PIN" }));
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar. Anótalo a mano.");
    expect(screen.getByText("4827")).toBeInTheDocument();
  });

  it("si el servidor niega, muestra el error y ningún PIN", async () => {
    const user = userEvent.setup();
    generateMock.mockResolvedValue({ error: "No tienes permiso para realizar esta acción." });
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    expect(screen.queryByText("PIN restablecido")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });
});

describe("ResetPinDrawer · al cerrar, el PIN desaparece", () => {
  it.each([
    ["Listo", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Listo" }))],
    ["Cerrar", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Cerrar" }))],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
  ])("con %s sale del DOM y al reabrir no vuelve", async (_label, close) => {
    const user = userEvent.setup();
    render(<Harness />);
    await restablecerGenerado(user);

    await close(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("4827");

    await user.click(screen.getByRole("button", { name: "Abrir restablecer" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("PIN restablecido")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("4827");
    expect(generateMock).toHaveBeenCalledTimes(1);
    expectNothingPersisted("4827");
  });
});

describe("ResetPinDrawer · escribirlo a mano", () => {
  it("el campo arranca vacío y no se rellena con un PIN del cliente", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    const input = screen.getByRole("textbox", { name: /^PIN nuevo/ });
    expect(input).toHaveValue("");
    expect(mathRandom).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Restablecer PIN" })).toBeDisabled();
  });

  it("avisa en vivo si el PIN es común y no deja enviarlo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    const input = screen.getByRole("textbox", { name: /^PIN nuevo/ });

    await user.type(input, "1234");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese PIN es muy fácil de adivinar. Usa otro o genera uno nuevo.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Restablecer PIN" })).toBeDisabled();
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("envía el PIN escrito por el camino manual y lo muestra una vez", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    await user.type(screen.getByRole("textbox", { name: /^PIN nuevo/ }), "7310");

    const submit = screen.getByRole("button", { name: "Restablecer PIN" });
    expect(submit).toBeEnabled();
    await act(async () => {
      await user.click(submit);
    });

    expect(await screen.findByText("7310")).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
    expect(sentFields(resetMock)).toEqual({ operario_id: OPERARIO.id, pin_mode: "manual", pin: "7310" });
    expectNothingPersisted("7310");
  });
});
