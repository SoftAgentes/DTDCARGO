/**
 * SDD-0585 · paso 2.7 (E2-D13) · la salida de Studio cierra la sesión del chat
 * en este navegador. Le pide el cierre al marco oculto SOLO al origen del chat,
 * acepta la respuesta SOLO de ese marco y, si no llega, sigue al login igual.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({ useT: () => (k: string) => k }));

import { CerrarChatClient, ESPERA_MS, PEDIR_CIERRE } from "../_components/CerrarChatClient";

const CHAT = "https://chat.ejemplo.test";

function montar() {
  const irA = vi.fn();
  render(<CerrarChatClient origenChat={CHAT} destino="/studio/login" irA={irA} />);
  const marco = screen.getByTitle("bandeja.salir.marco") as HTMLIFrameElement;
  return { irA, marco };
}

const responder = (origin: string, source: unknown, data: unknown) =>
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin, source: source as Window, data }));
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CerrarChatClient (2.7)", () => {
  it("abre /app/login del chat en un marco oculto y avisa con role=status", () => {
    const { marco } = montar();
    expect(marco.getAttribute("src")).toBe(`${CHAT}/app/login`);
    expect(marco.hidden).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("bandeja.salir.cerrando");
  });

  it("al cargar el marco le pide el cierre al origen del chat, no a «*»", () => {
    const { marco } = montar();
    const post = vi.spyOn(marco.contentWindow!, "postMessage");
    act(() => {
      marco.dispatchEvent(new Event("load"));
    });
    expect(post).toHaveBeenCalledWith(PEDIR_CIERRE, CHAT);
  });

  it("con la respuesta del marco sigue al login, una sola vez", () => {
    const { irA, marco } = montar();
    responder(CHAT, marco.contentWindow, JSON.stringify({ evento: "dtd:sesion-cerrada" }));
    expect(irA).toHaveBeenCalledWith("/studio/login");
    act(() => {
      vi.advanceTimersByTime(ESPERA_MS);
    });
    expect(irA).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["otro origen", "https://malo.example.test", true, JSON.stringify({ evento: "dtd:sesion-cerrada" })],
    ["otra ventana del chat", CHAT, false, JSON.stringify({ evento: "dtd:sesion-cerrada" })],
    ["otro evento", CHAT, true, JSON.stringify({ evento: "otra-cosa" })],
    ["JSON roto", CHAT, true, "{no"],
  ])("ignora %s", (_n, origen, delMarco, datos) => {
    const { irA, marco } = montar();
    responder(origen, delMarco ? marco.contentWindow : window, datos);
    expect(irA).not.toHaveBeenCalled();
  });

  it("si no responde en 4 s (script sin desplegar, chat caído), sigue al login igual", () => {
    const { irA } = montar();
    act(() => {
      vi.advanceTimersByTime(ESPERA_MS - 1);
    });
    expect(irA).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(irA).toHaveBeenCalledWith("/studio/login");
  });
});
