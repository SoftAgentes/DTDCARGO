/**
 * SDD-0585 · BandejaClient: cuándo pide el SSO, qué pone en el iframe y qué
 * muestra en cada estado.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pedirEnlaceSso = vi.fn();
const reconciliar = vi.fn(async () => ({ ok: true, aplicadas: 0 }));
const desvincular = vi.fn<(prev: unknown, fd: FormData) => Promise<{ ok: boolean; error: null }>>(async () => ({ ok: true, error: null }));
vi.mock("../actions", () => ({
  pedirEnlaceSso: (c?: number) => pedirEnlaceSso(c),
  reconciliarBandeja: () => reconciliar(),
  vincularAgente: vi.fn(async () => ({ ok: false, error: null })),
  desvincularAgente: (prev: unknown, fd: FormData) => desvincular(prev, fd),
}));

const { BandejaClient } = await import("../_components/BandejaClient");

const PANEL = "https://chat.dtdcargo.com/app/accounts/1/dashboard";
const SSO = "https://chat.dtdcargo.com/app/login?email=ana%40example.test&sso_auth_token=t";
const marco = () => document.querySelector("iframe");

beforeEach(() => {
  pedirEnlaceSso.mockReset();
  reconciliar.mockClear();
});
afterEach(cleanup);

describe("BandejaClient (SDD-0585)", () => {
  it("con la marca de este usuario: abre el panel directo, sin pedir SSO", () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    expect(marco()?.getAttribute("allow")).toBe("microphone");
    expect(marco()?.hasAttribute("sandbox")).toBe(false);
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
  });

  it("sin marca: pide UN enlace al montar y lo pone en el iframe", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("«Volver a entrar» pide un enlace nuevo aunque ya haya panel", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Volver a entrar" }));
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("si el SSO falla: muestra el error, «Reintentar» y la pestaña aparte; sin iframe", async () => {
    pedirEnlaceSso.mockResolvedValueOnce({ ok: false, error: "service" }).mockResolvedValueOnce({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(await screen.findByText("No pudimos abrir la bandeja")).toBeTruthy();
    expect(screen.getByText(/El servidor de mensajes no respondió/)).toBeTruthy();
    expect(marco()).toBeNull();
    const pestana = screen.getByRole("link", { name: "Abrir en pestaña aparte" });
    expect(pestana.getAttribute("href")).toBe(PANEL);
    expect(pestana.getAttribute("rel")).toContain("noopener");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
  });

  it.each([
    ["sin_configurar", "La bandeja todavía no está conectada"],
    ["sin_vinculo", "Tu usuario no tiene un agente de la bandeja"],
  ] as const)("%s: muestra su estado y no pide SSO", (estado, titulo) => {
    render(<BandejaClient estado={estado} panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(screen.getByText(titulo)).toBeTruthy();
    expect(marco()).toBeNull();
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
  });

  it("los vínculos solo se muestran si la página los manda (admin)", () => {
    const { rerender } = render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(screen.queryByText("Agentes vinculados")).toBeNull();
    rerender(
      <BandejaClient
        estado="sin_vinculo"
        panelUrl={PANEL}
        inicioUrl={null}
        admin={{ vinculos: [{ userId: "u1", nombre: "Ana", chatwootUserId: 7 }], miembros: [{ userId: "u2", nombre: "Luis" }] }}
      />,
    );
    expect(screen.getByText("Agentes vinculados")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Luis" })).toBeTruthy();
  });

  it("desvincular pide confirmación y solo borra al confirmar", async () => {
    render(
      <BandejaClient
        estado="sin_vinculo"
        panelUrl={PANEL}
        inicioUrl={null}
        admin={{ vinculos: [{ userId: "u1", nombre: "Ana", chatwootUserId: 7 }], miembros: [] }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Desvincular" }));
    expect(desvincular).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("Ana ya no podrá abrir la bandeja");
    const botones = Array.from(dialogo.querySelectorAll("button")).filter((b) => b.textContent === "Desvincular");
    await userEvent.click(botones[botones.length - 1]);
    await waitFor(() => expect(desvincular).toHaveBeenCalledTimes(1));
    expect((desvincular.mock.calls[0][1] as FormData).get("user_id")).toBe("u1");
  });

  it("con vínculo reconcilia UNA vez al montar; sin vínculo no", async () => {
    const { rerender } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await waitFor(() => expect(reconciliar).toHaveBeenCalledTimes(1));
    rerender(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    expect(reconciliar).toHaveBeenCalledTimes(1);
    cleanup();
    reconciliar.mockClear();
    render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(reconciliar).not.toHaveBeenCalled();
  });

  it("con ?c=N pide el SSO de esa conversación", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} conversacion={12} admin={null} />);
    await waitFor(() => expect(pedirEnlaceSso).toHaveBeenCalledWith(12));
  });

  it("el admin ve los eventos descartados (v3), sin texto de mensajes", () => {
    render(
      <BandejaClient
        estado="sin_vinculo"
        panelUrl={PANEL}
        inicioUrl={null}
        admin={{
          vinculos: [],
          miembros: [],
          descartados: [{ event_key: "message_created:101", event: "message_created", conversation_id: 12, attempts: 5, updated_at: "2026-10-30T03:00:00.000Z" }],
        }}
      />,
    );
    expect(screen.getByText("Eventos que no se pudieron procesar")).toBeTruthy();
    expect(screen.getByText("Mensaje nuevo · conversación #12 · 5 intentos")).toBeTruthy();
  });

  it("sin descartados no pinta la sección", () => {
    render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={{ vinculos: [], miembros: [], descartados: [] }} />);
    expect(screen.queryByText("Eventos que no se pudieron procesar")).toBeNull();
  });
});
