/**
 * SDD-0585 · paso 2.4 · FichaDtdClient: escucha el contexto de Chatwoot y pide
 * la ficha. Lo que se prueba es la frontera del navegador (E2-D30): a la
 * acción llegan solo los dos ids, y un mensaje de otro origen o de otra ventana
 * no hace nada.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pedirFichaDtd = vi.fn();
vi.mock("@/app/studio/(app)/bandeja/actions", () => ({
  pedirFichaDtd: (...args: unknown[]) => pedirFichaDtd(...args),
}));

const { FichaDtdClient } = await import("../_components/FichaDtdClient");

const CHAT = "https://chat.ejemplo.test";
const padre = { postMessage: vi.fn() };
const FICHA = {
  markbox: "DTD-0001",
  segmento: null,
  enlace: "/studio/clientes/DTD-0001",
  cuenta: { tipo: "sin-permiso", markboxes: ["DTD-0001"], embarquesEnCurso: 2 },
};

function contexto(conversacion = 42, agente = 3, theme = "light") {
  return JSON.stringify({
    event: "appContext",
    data: {
      conversation: { id: conversacion, meta: { sender: { phone_number: "+584125550101" } } },
      contact: { name: "Contacto Sintético", phone_number: "+584125550101", email: "contacto@example.test" },
      currentAgent: { id: agente, name: "Agente Sintética", email: "agente@example.test" },
      theme,
    },
  });
}

function mandar(data: unknown, origin = CHAT, source: unknown = padre) {
  const ev = new MessageEvent("message", { data, origin });
  Object.defineProperty(ev, "source", { value: source });
  act(() => {
    window.dispatchEvent(ev);
  });
}

beforeEach(() => {
  pedirFichaDtd.mockReset();
  pedirFichaDtd.mockResolvedValue({ ok: true, ficha: FICHA });
  padre.postMessage.mockClear();
  Object.defineProperty(window, "parent", { value: padre, configurable: true });
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "parent", { value: window, configurable: true });
});

describe("FichaDtdClient (SDD-0585, 2.4)", () => {
  it("al montar le pide el contexto al chat, con su origen y no con «*»", () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    expect(padre.postMessage).toHaveBeenCalledWith("chatwoot-dashboard-app:fetch-info", CHAT);
  });

  it("con el contexto del chat: pide la ficha con los dos ids y nada más", async () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto());
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    expect(pedirFichaDtd).toHaveBeenCalledWith(42, 3);
    const enviado = JSON.stringify(pedirFichaDtd.mock.calls);
    for (const dato of ["Sintético", "Sintética", "4125550101", "example.test"]) expect(enviado).not.toContain(dato);
  });

  it("un mensaje de otro origen o de otra ventana no pide nada", () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(), "https://otro.ejemplo.test");
    mandar(contexto(), CHAT, { otra: "ventana" });
    expect(pedirFichaDtd).not.toHaveBeenCalled();
    expect(screen.getByText("Abre una conversación")).toBeTruthy();
  });

  it("toma el tema del chat", async () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42, 3, "dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    mandar(contexto(42, 3, "light"));
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("el mismo contexto otra vez no vuelve a pedir; otra conversación sí", async () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42));
    await waitFor(() => expect(pedirFichaDtd).toHaveBeenCalledTimes(1));
    mandar(contexto(42));
    mandar(contexto(43));
    await waitFor(() => expect(pedirFichaDtd).toHaveBeenCalledTimes(2));
    expect(pedirFichaDtd).toHaveBeenLastCalledWith(43, 3);
  });

  it("una respuesta vieja no pisa la de la conversación nueva", async () => {
    let soltarVieja: (v: unknown) => void = () => undefined;
    pedirFichaDtd.mockImplementationOnce(() => new Promise((r) => (soltarVieja = r)));
    pedirFichaDtd.mockResolvedValueOnce({ ok: true, ficha: null });
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42));
    mandar(contexto(43));
    await waitFor(() => expect(screen.getByText("Sin ficha")).toBeTruthy());
    await act(async () => soltarVieja({ ok: true, ficha: FICHA }));
    expect(screen.queryByText("DTD-0001")).toBeNull();
    expect(screen.getByText("Sin ficha")).toBeTruthy();
  });

  it("2.8 · pasa el costo del chat a la vista, con ficha y sin ficha", async () => {
    const costo = {
      enviados: 3,
      completo: true,
      mercado: "Rest of Latin America",
      tarifa: 0.0113,
      total: 0.0339,
      vigenteDesde: "2026-10-01",
      fuente: "https://developers.facebook.com/docs/whatsapp/pricing",
    };
    pedirFichaDtd.mockResolvedValueOnce({ ok: true, ficha: FICHA, costo }).mockResolvedValueOnce({ ok: true, ficha: null, costo });
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42));
    await waitFor(() => expect(screen.getByText(/3 mensajes enviados/)).toBeTruthy());
    mandar(contexto(43));
    await waitFor(() => expect(screen.getByText("Sin ficha")).toBeTruthy());
    expect(screen.getByText(/3 mensajes enviados/)).toBeTruthy();
  });

  it("error de la acción: lo muestra y reintenta con el mismo contexto", async () => {
    pedirFichaDtd.mockResolvedValueOnce({ ok: false, error: "service" });
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    expect(pedirFichaDtd).toHaveBeenCalledTimes(2);
    expect(pedirFichaDtd).toHaveBeenLastCalledWith(42, 3);
  });

  it("si la acción lanza (red caída): error de servicio, no se queda cargando", async () => {
    pedirFichaDtd.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    mandar(contexto(42));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos cargar la ficha."));
  });

  it("sin sesión: no pide contexto ni ficha, y ofrece abrir Studio", () => {
    render(<FichaDtdClient origenChat={CHAT} conSesion={false} loginUrl="/studio/login" />);
    mandar(contexto());
    expect(padre.postMessage).not.toHaveBeenCalled();
    expect(pedirFichaDtd).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Abrir Studio" })).toBeTruthy();
  });

  it("abierta suelta (sin marco): espera, sin pedir contexto", () => {
    Object.defineProperty(window, "parent", { value: window, configurable: true });
    render(<FichaDtdClient origenChat={CHAT} conSesion loginUrl="/studio/login" />);
    expect(padre.postMessage).not.toHaveBeenCalled();
    expect(screen.getByText("Abre una conversación")).toBeTruthy();
  });
});
