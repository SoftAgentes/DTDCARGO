/**
 * SDD-0515 · PinViewDialog: «Ver PIN» con motivo de la lista y la contraseña
 * del Studio.
 *
 * Lo que se afirma:
 *  - sin motivo no se puede pedir el PIN; con motivo y contraseña se llama a la
 *    action con el operario, el código (y el texto sólo con «Otro») y la
 *    contraseña tal cual;
 *  - la contraseña no queda en el campo después de la respuesta (ni con éxito
 *    ni con error), no se escribe en el navegador y no sale en el DOM;
 *  - el error de contraseña va a su campo; el de motivo, al suyo;
 *  - el PIN se muestra con «Copiar PIN» y la app de la región del operario,
 *    copiable, y sale del DOM al cerrar (Cerrar o Escape);
 *  - un PIN anterior a 0475 muestra el aviso de restablecerlo;
 *  - un rechazo general se queda en el diálogo y no muestra PIN.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import {
  OPERARIO_PASSWORD_FAILURE_MESSAGE,
  OPERARIO_PASSWORD_MESSAGE,
  type ViewPinResult,
} from "@/lib/studio/operario-pin";

const viewMock = vi.fn<(fields: Record<string, string>) => Promise<ViewPinResult>>();

vi.mock("../actions", () => ({
  // El doble copia los campos en el momento de la llamada: después el diálogo
  // borra la contraseña del FormData y del campo.
  viewOperarioPinAction: (fd: FormData) =>
    viewMock(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))),
}));

import { PinViewDialog } from "./PinViewDialog";

const OPERARIO: OperarioRow = {
  id: "50000000-0000-4000-8000-000000000001",
  tenant_id: "10000000-0000-4000-8000-000000000001",
  warehouse_id: null,
  region: "ve",
  display_name: "Yusneidy Pérez",
  display_name_cn: null,
  role: "bodeguero",
  active: true,
  last_login_at: null,
  created_at: "2026-05-26T00:00:00Z",
  warehouse_code: null,
  warehouse_name_es: null,
};

/** Con espacios: viaja tal cual. */
const PASSWORD = " clave del Studio ";

function Harness({ operario = OPERARIO }: { operario?: OperarioRow }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      {open && <PinViewDialog operario={operario} onClose={() => setOpen(false)} />}
    </>
  );
}

let setItem: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  viewMock.mockReset();
  viewMock.mockResolvedValue({ ok: true, pin: "6083" });
  setItem = vi.spyOn(Storage.prototype, "setItem");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const motivoSelect = () => screen.getByRole("combobox", { name: /^Motivo/ });
const passwordInput = () => screen.getByLabelText(/^Tu contraseña del Studio/) as HTMLInputElement;
const verButton = () => screen.getByRole("button", { name: "Ver PIN" });

async function pedirPin(
  user: ReturnType<typeof userEvent.setup>,
  { motivo = "Se le olvidó", password = PASSWORD }: { motivo?: string | null; password?: string } = {},
) {
  if (motivo) await user.selectOptions(motivoSelect(), motivo);
  if (password) await user.type(passwordInput(), password);
  await user.click(verButton());
}

describe("PinViewDialog · motivo y contraseña", () => {
  it("avisa que queda en la auditoría y, sin motivo, no deja pedir el PIN", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("dialog", { name: `Ver PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    expect(screen.getByText(/Cada consulta queda en la auditoría con tu nombre y el motivo/)).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(passwordInput()).toHaveAttribute("autocomplete", "current-password");
    expect(verButton()).toBeDisabled();
    await pedirPin(user, { motivo: null });
    expect(viewMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });

  it("manda el operario, el código y la contraseña tal cual, y borra la contraseña del campo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pedirPin(user);
    await screen.findByText("6083");

    expect(viewMock).toHaveBeenCalledTimes(1);
    expect(viewMock.mock.calls[0][0]).toEqual({ operario_id: OPERARIO.id, motivo: "olvido", password: PASSWORD });
    expect(document.body.textContent).not.toContain(PASSWORD.trim());
    expect(setItem).not.toHaveBeenCalled();
  });

  it("«Otro» manda su texto", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(motivoSelect(), "Otro");
    await user.type(screen.getByRole("textbox", { name: /^Escribe el motivo/ }), "Lo pidió el supervisor");
    await pedirPin(user, { motivo: null });
    await screen.findByText("6083");

    expect(viewMock.mock.calls[0][0]).toEqual({
      operario_id: OPERARIO.id, motivo: "otro", motivo_texto: "Lo pidió el supervisor", password: PASSWORD,
    });
  });

  it.each([
    ["la contraseña no es la suya", OPERARIO_PASSWORD_FAILURE_MESSAGE.invalid],
    ["la base pide confirmarla (P0022)", OPERARIO_PASSWORD_MESSAGE],
  ])("si %s: el error va al campo, el campo queda vacío y no hay PIN", async (_label, message) => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ error: message, fieldError: "password" });
    render(<Harness />);
    await pedirPin(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(passwordInput()).toHaveValue("");
    expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput()).toHaveFocus();
    // El motivo elegido se conserva; la contraseña hay que escribirla de nuevo.
    expect(motivoSelect()).toHaveValue("olvido");
    expect(screen.getByRole("dialog", { name: `Ver PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
    expect(document.body.textContent).not.toContain(PASSWORD.trim());

    // Al volver a escribirla, el error se va.
    await user.type(passwordInput(), "x");
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("el error de motivo del servidor va al motivo", async () => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ error: "Elige un motivo de la lista.", fieldError: "motivo" });
    render(<Harness />);
    await pedirPin(user);

    expect(await screen.findByText("Elige un motivo de la lista.")).toBeInTheDocument();
    expect(motivoSelect()).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput()).toHaveValue("");
  });

  it("si la llamada falla por la red, lo dice y borra la contraseña", async () => {
    const user = userEvent.setup();
    viewMock.mockRejectedValue(new Error("Failed to fetch"));
    render(<Harness />);
    await pedirPin(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo mostrar el PIN. Revisa tu conexión e inténtalo otra vez.",
    );
    expect(passwordInput()).toHaveValue("");
  });

  it("si el servidor rechaza, el error queda en el diálogo y no hay PIN", async () => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ error: "No tienes permiso para realizar esta acción." });
    render(<Harness />);
    await pedirPin(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    expect(screen.getByRole("dialog", { name: `Ver PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });
});

describe("PinViewDialog · el PIN", () => {
  it("se muestra, se copia, dice por qué app entra y al cerrar se borra", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness />);
    await pedirPin(user);

    expect(await screen.findByText("6083")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: `PIN de ${OPERARIO.display_name}` });
    await user.click(within(dialog).getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("6083");
    expect(within(dialog).getByText("https://dtdcargo.com/m/ve/login").parentElement).toHaveTextContent(
      "Entra por https://dtdcargo.com/m/ve/login",
    );
    await user.click(within(dialog).getByRole("button", { name: "Copiar enlace" }));
    expect(writeText).toHaveBeenLastCalledWith("https://dtdcargo.com/m/ve/login");

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("6083");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("6083");

    // Al reabrir arranca de cero: vuelve a pedir motivo y contraseña.
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(motivoSelect()).toHaveValue("");
    expect(passwordInput()).toHaveValue("");
    expect(document.body.textContent).not.toContain("6083");
    expect(viewMock).toHaveBeenCalledTimes(1);
  });

  it("un operario de China entra por /m/cn/login", async () => {
    const user = userEvent.setup();
    render(<Harness operario={{ ...OPERARIO, region: "cn", role: "operario" }} />);
    await pedirPin(user);

    const dialog = await screen.findByRole("dialog", { name: `PIN de ${OPERARIO.display_name}` });
    expect(within(dialog).getByText("https://dtdcargo.com/m/cn/login")).toBeInTheDocument();
    expect(dialog.textContent).not.toContain("/m/ve/login");
  });

  it("Escape también cierra y borra el PIN", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pedirPin(user);
    await screen.findByText("6083");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("6083");
  });

  it("un PIN anterior al cambio pide restablecerlo", async () => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ ok: true, pin: null });
    render(<Harness />);
    await pedirPin(user);

    expect(
      await screen.findByText("Este PIN es anterior al cambio: restablécelo una vez para poder verlo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar PIN" })).not.toBeInTheDocument();
  });
});
