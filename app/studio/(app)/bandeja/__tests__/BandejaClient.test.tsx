/**
 * SDD-0585 · BandejaClient: cuándo pide el SSO, qué pone en el iframe y qué
 * muestra en cada estado.
 * SDD-0677 · pantalla completa sin volver a montar el marco, y recuperación:
 * reintentos del enlace, vigilante de carga y freno de reaperturas.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pedirEnlaceSso = vi.fn();
const reconciliar = vi.fn(async () => ({ ok: true, aplicadas: 0 }));
vi.mock("../actions", () => ({
  pedirEnlaceSso: (c?: number) => pedirEnlaceSso(c),
  reconciliarBandeja: () => reconciliar(),
}));

const { BandejaClient } = await import("../_components/BandejaClient");

const PANEL = "https://chat.dtdcargo.com/app/accounts/1/dashboard";
const SSO = "https://chat.dtdcargo.com/app/login?email=ana%40example.test&sso_auth_token=t";
const marco = () => document.querySelector("iframe");

beforeEach(() => {
  pedirEnlaceSso.mockReset();
  reconciliar.mockClear();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.style.overflow = "";
});

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

  it("«Abrir de nuevo» pide un enlace nuevo aunque ya haya panel", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir de nuevo" }));
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("un error que no es pasajero (denied) no se reintenta: aviso con «Abrir de nuevo» y la pestaña aparte; sin iframe", async () => {
    pedirEnlaceSso.mockResolvedValueOnce({ ok: false, error: "denied" }).mockResolvedValueOnce({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(await screen.findByText("La bandeja no abrió")).toBeTruthy();
    expect(screen.getByText("No tienes permiso para hacer esto.")).toBeTruthy();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    expect(marco()).toBeNull();
    const pestanas = screen.getAllByRole("link", { name: "Abrir en pestaña aparte" });
    expect(pestanas[0].getAttribute("href")).toBe(PANEL);
    expect(pestanas[0].getAttribute("rel")).toContain("noopener");
    const botones = screen.getAllByRole("button", { name: "Abrir de nuevo" });
    await userEvent.click(botones[botones.length - 1]);
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

  it("SDD-0655: los vínculos ya no están en la Bandeja; el admin tiene el enlace a Usuarios", () => {
    const { rerender } = render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(screen.queryByRole("link", { name: "Agentes vinculados" })).toBeNull();
    rerender(
      <BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={{ agentesHref: "/studio/usuarios?tab=bandeja" }} />,
    );
    expect(screen.getByRole("link", { name: "Agentes vinculados" }).getAttribute("href")).toBe("/studio/usuarios?tab=bandeja");
    // Ni el formulario de vincular ni el de alta: viven en Usuarios › Bandeja.
    expect(screen.queryByRole("button", { name: "Vincular" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dar de alta" })).toBeNull();
  });

  it("SDD-0655: la Bandeja no repite su propio título; la cabecera es la del CRM", () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
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
          descartados: [{ event_key: "message_created:101", event: "message_created", conversation_id: 12, attempts: 5, updated_at: "2026-10-30T03:00:00.000Z" }],
        }}
      />,
    );
    expect(screen.getByText("Eventos que no se pudieron procesar")).toBeTruthy();
    expect(screen.getByText("Mensaje nuevo · conversación #12 · 5 intentos")).toBeTruthy();
  });

  it("sin descartados no pinta la sección", () => {
    render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={{ descartados: [] }} />);
    expect(screen.queryByText("Eventos que no se pudieron procesar")).toBeNull();
  });
});

describe("BandejaClient · pantalla completa (SDD-0677)", () => {
  const region = () => document.querySelector("section[aria-labelledby='bandeja-titulo']") as HTMLElement | null;

  it("lista, abre a pantalla completa; Reducir y Esc vuelven a la vista compacta sin volver a montar el marco", async () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    const antes = marco();
    expect(region()?.dataset.modo).toBe("completa");
    expect(region()?.style.position).toBe("fixed");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(screen.getByRole("button", { name: /Reducir/ }));
    expect(region()?.dataset.modo).toBe("compacta");
    expect(document.body.style.overflow).toBe("");
    // Mismo elemento y mismo src: no hay recarga ni login nuevo.
    expect(marco()).toBe(antes);
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    // El foco vuelve al botón que amplía.
    const ampliar = screen.getByRole("button", { name: "Pantalla completa" });
    expect(document.activeElement).toBe(ampliar);

    await userEvent.click(ampliar);
    expect(region()?.dataset.modo).toBe("completa");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Bandeja" }));
    expect(marco()).toBe(antes);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(region()?.dataset.modo).toBe("compacta");
    expect(marco()).toBe(antes);
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
  });

  it("Esc no reduce si hay un diálogo de Studio abierto encima", () => {
    render(
      <>
        <BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />
        <div role="dialog" aria-modal="true" />
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(region()?.dataset.modo).toBe("completa");
  });

  it("recuerda en el navegador que la persona la redujo", async () => {
    const { unmount } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await userEvent.click(screen.getByRole("button", { name: /Reducir/ }));
    unmount();
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await waitFor(() => expect(region()?.dataset.modo).toBe("compacta"));
  });

  it("sin vínculo no hay capa a pantalla completa", () => {
    render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(region()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("BandejaClient · recuperación (SDD-0677)", () => {
  it("con `service` reintenta el enlace dos veces y abre sin mostrar el error", async () => {
    vi.useFakeTimers();
    pedirEnlaceSso
      .mockResolvedValueOnce({ ok: false, error: "service" })
      .mockResolvedValueOnce({ ok: false, error: "service" })
      .mockResolvedValueOnce({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await act(async () => {});
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Conectando con la bandeja… (intento 2 de 3)")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(marco()?.getAttribute("src")).toBe(SSO);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
  });

  it("con `service` tres veces muestra el aviso claro, no el error crudo", async () => {
    vi.useFakeTimers();
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "service" });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(screen.getByText("La bandeja no abrió")).toBeTruthy();
    expect(screen.getByText(/no respondió después de 3 intentos/)).toBeTruthy();
    expect(marco()).toBeNull();
  });

  it("si el marco no carga en 20 s, ofrece abrirlo de nuevo y eso pide un SSO nuevo", async () => {
    vi.useFakeTimers();
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(19_000);
    });
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/tardando más de lo normal/)).toBeTruthy();
    // El marco sigue montado por si termina de cargar.
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    vi.useRealTimers();
    const botones = screen.getAllByRole("button", { name: "Abrir de nuevo" });
    await userEvent.click(botones[botones.length - 1]);
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("si el marco carga a tiempo no hay aviso", async () => {
    vi.useFakeTimers();
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    fireEvent.load(marco()!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
  });

  it("el tercer «Abrir de nuevo» en 5 minutos no pide SSO y explica el freno", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    const boton = () => screen.getAllByRole("button", { name: "Abrir de nuevo" })[0] as HTMLButtonElement;
    await userEvent.click(boton());
    await waitFor(() => expect(pedirEnlaceSso).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(boton().disabled).toBe(false));
    await userEvent.click(boton());
    await waitFor(() => expect(pedirEnlaceSso).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(boton().disabled).toBe(false));
    await userEvent.click(boton());
    expect(await screen.findByText(/frena los ingresos repetidos/)).toBeTruthy();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
  });
});
