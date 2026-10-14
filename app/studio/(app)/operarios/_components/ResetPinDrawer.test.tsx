/**
 * SDD-0513 · SDD-0515 · ResetPinDrawer: el PIN nuevo se muestra en la
 * respuesta y desaparece al cerrar; el motivo es obligatorio; y el mismo cajón
 * reactiva a un operario de baja con un PIN nuevo.
 *
 * El cajón corre con el DrawerShell REAL (botón Cerrar, Escape) dentro de un
 * arnés que hace lo mismo que OperariosClient: al cerrar lo desmonta y al
 * reabrir lo monta de cero. Las server actions son dobles: acá se prueba la
 * UI, el servidor tiene su propia suite (__tests__/reset-pin-actions.test.ts).
 *
 * Lo que se afirma:
 *  - por defecto el PIN lo genera el servidor: el formulario no manda `pin` y
 *    el cliente no sortea nada (Math.random no se llama);
 *  - sin un motivo de la lista no se puede enviar; «Otro» pide su texto (4 a
 *    200 caracteres, sin el PIN); el código, y el texto sólo con «Otro», viajan
 *    en el formulario;
 *  - el PIN devuelto se muestra con el aviso de que volver a verlo queda en la
 *    auditoría, se puede copiar y dice por qué app entra el operario según su
 *    región (/m/ve/login o /m/cn/login), también copiable;
 *  - al cerrar (Listo, Cerrar o Escape) el PIN sale del DOM y al reabrir no
 *    vuelve;
 *  - nunca se escribe en localStorage, sessionStorage, la URL ni el historial;
 *  - el camino manual sigue: campo vacío, rechazo en vivo de los comunes y
 *    envío con el PIN escrito;
 *  - con `reactivar`, el cajón se llama «Reactivar», manda `reactivar=1` y el
 *    revelado dice que el operario quedó reactivado.
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

/** El código de «Se le olvidó». */
const MOTIVO = "olvido";

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
function Harness({ reactivar = false, operario = OPERARIO }: { reactivar?: boolean; operario?: OperarioRow }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir restablecer
      </button>
      {open && (
        <ResetPinDrawer operario={operario} onClose={() => setOpen(false)} reactivar={reactivar} />
      )}
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
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function expectNothingPersisted(pin: string) {
  expect(setItem).not.toHaveBeenCalled();
  expect(window.location.href).toBe(hrefBefore);
  expect(window.location.href).not.toContain(pin);
  expect(JSON.stringify(pushState.mock.calls)).not.toContain(pin);
  expect(JSON.stringify(replaceState.mock.calls)).not.toContain(pin);
}

const motivoSelect = () => screen.getByRole("combobox", { name: /^Motivo/ });
const motivoTexto = () => screen.getByRole("textbox", { name: /^Escribe el motivo/ });

/** Elige el motivo por su rótulo, como lo ve el admin. */
async function elegirMotivo(user: ReturnType<typeof userEvent.setup>, label = "Se le olvidó") {
  await user.selectOptions(motivoSelect(), label);
}

async function restablecerGenerado(user: ReturnType<typeof userEvent.setup>) {
  await elegirMotivo(user);
  await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
  await screen.findByText("4827");
}

describe("ResetPinDrawer · generar PIN nuevo (por defecto)", () => {
  it("el cliente no sortea nada y el formulario no manda pin", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("radio", { name: /Generar PIN nuevo/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("textbox", { name: /PIN nuevo/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);

    await restablecerGenerado(user);

    expect(mathRandom).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(resetMock).not.toHaveBeenCalled();
    expect(sentFields(generateMock)).toEqual({ operario_id: OPERARIO.id, pin_mode: "generar", motivo: MOTIVO });
  });

  it("muestra el PIN con el aviso de la auditoría y lo copia", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness />);
    await restablecerGenerado(user);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("PIN restablecido")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Pásaselo al operario. Volver a verlo con «Ver PIN» queda en la auditoría."),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("4827")).toHaveLength(1);

    await user.click(within(dialog).getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("4827");
    expect(within(dialog).getByText("PIN copiado.")).toHaveAttribute("role", "status");
    expect(within(dialog).getByRole("button", { name: "Copiado" })).toBeInTheDocument();
    expectNothingPersisted("4827");
  });

  it("si el portapapeles falla, pide anotarlo a mano", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denegado"));
    render(<Harness />);
    await restablecerGenerado(user);

    await user.click(screen.getByRole("button", { name: "Copiar PIN" }));
    expect(screen.getByText("No se pudo copiar. Anótalo a mano.")).toHaveAttribute("role", "status");
    expect(screen.getByText("4827")).toBeInTheDocument();
  });

  it("si el servidor niega, muestra el error y ningún PIN", async () => {
    const user = userEvent.setup();
    generateMock.mockResolvedValue({ error: "No tienes permiso para realizar esta acción." });
    render(<Harness />);

    await elegirMotivo(user);
    await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    expect(screen.queryByText("PIN restablecido")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });
});

describe("ResetPinDrawer · motivo obligatorio (SDD-0515)", () => {
  it("la lista es la de la base, en este orden, y arranca sin elegir", () => {
    render(<Harness />);
    const options = within(motivoSelect()).getAllByRole("option");

    expect(options.map((o) => o.textContent)).toEqual([
      "Elige un motivo", "Se le olvidó", "Empleado nuevo", "Revisión de seguridad", "Otro",
    ]);
    expect(motivoSelect()).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: /^Escribe el motivo/ })).not.toBeInTheDocument();
  });

  it("sin motivo no se puede enviar; con uno de la lista, sí", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const submit = screen.getByRole("button", { name: "Restablecer PIN" });

    expect(submit).toBeDisabled();
    await elegirMotivo(user, "Revisión de seguridad");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await screen.findByText("4827");
    expect(sentFields(generateMock)).toEqual({
      operario_id: OPERARIO.id, pin_mode: "generar", motivo: "revision_seguridad",
    });
  });

  it("«Otro» pide su texto: con menos de 4 caracteres o sólo espacios no deja enviar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const submit = screen.getByRole("button", { name: "Restablecer PIN" });
    await elegirMotivo(user, "Otro");

    expect(submit).toBeDisabled();
    expect(motivoTexto()).toHaveAttribute("maxLength", "200");
    await user.type(motivoTexto(), "abc");
    expect(submit).toBeDisabled();
    await user.type(motivoTexto(), "d");
    expect(submit).toBeEnabled();
    await user.clear(motivoTexto());
    await user.type(motivoTexto(), "     ");
    expect(submit).toBeDisabled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("«Otro» manda el código y su texto", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await elegirMotivo(user, "Otro");
    await user.type(motivoTexto(), "Cambio de turno");
    await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
    await screen.findByText("4827");

    expect(sentFields(generateMock)).toEqual({
      operario_id: OPERARIO.id, pin_mode: "generar", motivo: "otro", motivo_texto: "Cambio de turno",
    });
  });

  it("el error de motivo que devuelve el servidor se ve en el campo", async () => {
    const user = userEvent.setup();
    generateMock.mockResolvedValue({ fieldErrors: { motivo: "Elige un motivo de la lista." } });
    render(<Harness />);

    await elegirMotivo(user);
    await user.click(screen.getByRole("button", { name: "Restablecer PIN" }));
    expect(await screen.findByText("Elige un motivo de la lista.")).toBeInTheDocument();
    expect(motivoSelect()).toHaveAttribute("aria-invalid", "true");
  });

  it("escrito a mano: un texto de «Otro» con el PIN avisa en vivo y no deja enviar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    await user.type(screen.getByRole("textbox", { name: /^PIN nuevo/ }), "7310");
    await elegirMotivo(user, "Otro");
    await user.type(motivoTexto(), "Le puse 7310");

    expect(screen.getByRole("alert")).toHaveTextContent("No escribas el PIN en el motivo: queda en la auditoría.");
    expect(motivoTexto()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Restablecer PIN" })).toBeDisabled();
  });
});

describe("ResetPinDrawer · por qué app entra el operario (región)", () => {
  it.each([
    ["ve", "https://dtdcargo.com/m/ve/login"],
    ["cn", "https://dtdcargo.com/m/cn/login"],
  ] as const)("región %s: dice «Entra por %s» y copia el enlace", async (region, url) => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness operario={{ ...OPERARIO, region }} />);
    await restablecerGenerado(user);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(url)).toBeInTheDocument();
    expect(within(dialog).getByText(url).parentElement).toHaveTextContent(`Entra por ${url}`);
    const other = region === "ve" ? "/m/cn/login" : "/m/ve/login";
    expect(dialog.textContent).not.toContain(other);

    await user.click(within(dialog).getByRole("button", { name: "Copiar enlace" }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(within(dialog).getByText("Enlace copiado.")).toBeInTheDocument();
    // El enlace no lleva el PIN.
    expect(url).not.toContain("4827");
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
    await elegirMotivo(user);

    await user.type(input, "1234");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese PIN es muy fácil de adivinar. Usa otro o genera uno nuevo.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Restablecer PIN" })).toBeDisabled();
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("envía el PIN escrito y el motivo por el camino manual y lo muestra", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Escribirlo yo/ }));
    await user.type(screen.getByRole("textbox", { name: /^PIN nuevo/ }), "7310");
    await elegirMotivo(user);

    const submit = screen.getByRole("button", { name: "Restablecer PIN" });
    expect(submit).toBeEnabled();
    await act(async () => {
      await user.click(submit);
    });

    expect(await screen.findByText("7310")).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
    expect(sentFields(resetMock)).toEqual({
      operario_id: OPERARIO.id, pin_mode: "manual", pin: "7310", motivo: MOTIVO,
    });
    expectNothingPersisted("7310");
  });
});

describe("ResetPinDrawer · reactivar a un operario de baja (SDD-0515)", () => {
  it("se llama «Reactivar», manda reactivar=1 y el revelado dice que quedó reactivado", async () => {
    const user = userEvent.setup();
    render(<Harness reactivar />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(`Reactivar a ${OPERARIO.display_name}`)).toBeInTheDocument();
    await elegirMotivo(user, "Otro");
    await user.type(motivoTexto(), "Vuelve de vacaciones");
    await user.click(screen.getByRole("button", { name: "Reactivar con PIN nuevo" }));
    await screen.findByText("4827");

    expect(sentFields(generateMock)).toEqual({
      operario_id: OPERARIO.id, pin_mode: "generar", reactivar: "1", motivo: "otro", motivo_texto: "Vuelve de vacaciones",
    });
    expect(screen.getByText("Operario reactivado")).toBeInTheDocument();
    expect(screen.getByText("Ya puede volver a entrar a la app del teléfono con este PIN.")).toBeInTheDocument();
  });

  it("sin reactivar no manda el campo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await restablecerGenerado(user);
    expect(sentFields(generateMock)).not.toHaveProperty("reactivar");
  });
});
