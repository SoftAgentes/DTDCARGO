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
    await waitFor(() => expect(document.querySelector("section[data-modo='completa']")).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Abrir de nuevo" }));
    await waitFor(() => expect(marco()?.getAttribute("src")).toBe(SSO));
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("un error que no es pasajero (denied) no se reintenta: aviso con «Abrir de nuevo» y la pestaña aparte; sin iframe", async () => {
    pedirEnlaceSso.mockResolvedValueOnce({ ok: false, error: "denied" }).mockResolvedValueOnce({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(await screen.findByText("La bandeja no abrió")).toBeTruthy();
    // Los roles se consultan cuando la capa ya eligió su modo (antes está oculta).
    await waitFor(() => expect(document.querySelector("section[data-modo='pendiente']")).toBeNull());
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

const region = () => document.querySelector("section[aria-labelledby='bandeja-titulo']") as HTMLElement | null;
const modo = () => region()?.dataset.modo;
const AYUDA = /Oprime «Abrir de nuevo» una vez/;
/** El de la franja; con aviso hay un segundo, el principal, al final. */
const reabrirFranja = () => screen.getAllByRole("button", { name: "Abrir de nuevo" })[0] as HTMLButtonElement;
const reabrirAviso = () => {
  const b = screen.getAllByRole("button", { name: "Abrir de nuevo" });
  return b[b.length - 1] as HTMLButtonElement;
};
/** Deja que corran las promesas y los temporizadores de 0 ms con relojes falsos. */
const drenar = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("BandejaClient · pantalla completa (SDD-0677)", () => {
  it("antes de leer la preferencia no pinta ningún modo (sin destello en la hidratación)", () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    expect(modo()).toBe("pendiente");
    expect(region()?.style.visibility).toBe("hidden");
    // El marco ya está montado y cargando.
    expect(marco()?.getAttribute("src")).toBe(PANEL);
  });

  it("lista, abre a pantalla completa; Reducir y Esc vuelven a la vista compacta sin volver a montar el marco", async () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await waitFor(() => expect(modo()).toBe("completa"));
    const antes = marco();
    expect(region()?.style.position).toBe("fixed");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(screen.getByRole("button", { name: /Reducir/ }));
    expect(modo()).toBe("compacta");
    expect(document.body.style.overflow).toBe("");
    // Mismo elemento y mismo src: no hay recarga ni login nuevo.
    expect(marco()).toBe(antes);
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    // El foco vuelve al botón que amplía.
    const ampliar = screen.getByRole("button", { name: "Pantalla completa" });
    expect(document.activeElement).toBe(ampliar);

    await userEvent.click(ampliar);
    expect(modo()).toBe("completa");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Bandeja" }));
    expect(marco()).toBe(antes);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(modo()).toBe("compacta");
    expect(marco()).toBe(antes);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pantalla completa" }));
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
  });

  it("Esc reduce solo con Escape, y no si hay un diálogo de Studio abierto encima", async () => {
    const vista = (conDialogo: boolean) => (
      <>
        <BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />
        {conDialogo ? <div role="dialog" aria-modal="true" /> : null}
      </>
    );
    const { rerender } = render(vista(true));
    await waitFor(() => expect(modo()).toBe("completa"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(modo()).toBe("completa");
    rerender(vista(false));
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });
    expect(modo()).toBe("completa");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(modo()).toBe("compacta");
  });

  it("en pantalla completa el fondo queda inert (Tab no cae detrás); al reducir se devuelve", async () => {
    render(
      <div data-testid="shell">
        <nav data-testid="menu">
          <a href="/studio">Inicio</a>
        </nav>
        <main>
          <header data-testid="cabecera">CRM</header>
          <BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />
        </main>
        <div data-testid="ya-inerte" inert />
      </div>,
    );
    await waitFor(() => expect(modo()).toBe("completa"));
    expect(screen.getByTestId("menu").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("cabecera").hasAttribute("inert")).toBe(true);
    // La propia capa y sus ancestros no.
    expect(region()?.closest("[inert]")).toBeNull();
    // Los portales (hijos de body) siguen vivos.
    expect(screen.getByTestId("shell").hasAttribute("inert")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /Reducir/ }));
    expect(screen.getByTestId("menu").hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("cabecera").hasAttribute("inert")).toBe(false);
    // Lo que ya estaba inert antes no se toca.
    expect(screen.getByTestId("ya-inerte").hasAttribute("inert")).toBe(true);
  });

  it("recuerda en el navegador que la persona la redujo", async () => {
    const { unmount } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await waitFor(() => expect(modo()).toBe("completa"));
    await userEvent.click(screen.getByRole("button", { name: /Reducir/ }));
    unmount();
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await waitFor(() => expect(modo()).toBe("compacta"));
  });

  it("sin vínculo no hay capa a pantalla completa", () => {
    render(<BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    expect(region()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("BandejaClient · recuperación (SDD-0677)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("con `service` reintenta el enlace dos veces y abre sin mostrar el error ni la ayuda", async () => {
    pedirEnlaceSso
      .mockResolvedValueOnce({ ok: false, error: "service" })
      .mockResolvedValueOnce({ ok: false, error: "service" })
      .mockResolvedValueOnce({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Conectando con la bandeja… (intento 2 de 3)")).toBeTruthy();
    await drenar(1500);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    await drenar(4000);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(marco()?.getAttribute("src")).toBe(SSO);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    expect(screen.queryByText(AYUDA)).toBeNull();
  });

  it("con `service` tres veces muestra el aviso claro, sin decir que Chatwoot se reinicia", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "service" });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(6000);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(screen.getByText("La bandeja no abrió")).toBeTruthy();
    expect(screen.getByText(/no respondió después de 3 intentos/)).toBeTruthy();
    expect(screen.queryByText(/reinici/)).toBeNull();
    // Con error el marco se desmonta: no hay enlace válido.
    expect(marco()).toBeNull();
  });

  it("con `error` el marco se desmonta aunque antes hubiera panel", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "denied" });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar();
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(screen.getByText("No tienes permiso para hacer esto.")).toBeTruthy();
    expect(marco()).toBeNull();
  });

  it("si el marco no carga en 20 s, ofrece abrirlo de nuevo y eso pide un SSO nuevo", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar(19_000);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    await drenar(1_000);
    expect(screen.getByText(/tardando más de lo normal/)).toBeTruthy();
    // El marco sigue montado por si termina de cargar.
    expect(marco()?.getAttribute("src")).toBe(PANEL);
    fireEvent.click(reabrirAviso());
    await drenar();
    expect(marco()?.getAttribute("src")).toBe(SSO);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
  });

  it("si el marco carga a tiempo no hay aviso ni ayuda", async () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    fireEvent.load(marco()!);
    await drenar(25_000);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    expect(screen.queryByText(AYUDA)).toBeNull();
  });

  it("la ayuda aparece solo después de un fallo, y no junto al aviso", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar();
    expect(screen.queryByText(AYUDA)).toBeNull();
    await drenar(20_000);
    // Con el aviso de «lento» a la vista, la ayuda no se repite.
    expect(screen.getByText(/tardando más de lo normal/)).toBeTruthy();
    expect(screen.queryByText(AYUDA)).toBeNull();
    fireEvent.load(marco()!);
    await drenar();
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    expect(screen.getByText(AYUDA)).toBeTruthy();
  });

  it("tope de 3 aperturas cada 5 min: la cuarta no pide SSO y explica el freno", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar();
    for (let i = 1; i <= 3; i++) {
      fireEvent.click(reabrirFranja());
      await drenar();
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(i);
    }
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
  });

  it("el freno sobrevive al remonte y cuenta la apertura automática", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    // Una apertura automática (sin marca de SSO) y la página se recarga.
    const { unmount } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    unmount();
    // Con 1 marca guardada, al remontar quedan 2.
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
  });

  it("al remontar con el tope lleno, la apertura automática tampoco pide SSO", async () => {
    const ahora = Date.now();
    window.localStorage.setItem("dtd.bandeja.sso", JSON.stringify([ahora - 3000, ahora - 2000, ahora - 1000]));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Abrir en pestaña aparte" }).length).toBeGreaterThan(0);
  });

  it("una apertura que termina en `service` cuenta para el freno (una vez, no por reintento)", async () => {
    pedirEnlaceSso.mockResolvedValueOnce({ ok: false, error: "service" }).mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(1500);
    // Dos llamadas (un reintento) pero una sola marca.
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(1);
    fireEvent.click(reabrirFranja());
    await drenar();
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(4);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
  });

  it("la ventana de 5 min expira: pasado el plazo se puede abrir otra vez", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(reabrirFranja());
      await drenar();
    }
    // Un milisegundo antes de que venza la primera marca, sigue frenado.
    await drenar(5 * 60_000 - 1);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    await drenar(1);
    fireEvent.click(reabrirFranja());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(4);
  });

  it("si el marco carga estando en freno, el aviso se va", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar();
    for (let i = 0; i < 4; i++) {
      fireEvent.click(reabrirFranja());
      await drenar();
    }
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    fireEvent.load(marco()!);
    await drenar();
    expect(screen.queryByText(/frena los ingresos repetidos/)).toBeNull();
  });

  it("sin almacenamiento el freno sigue valiendo en la página", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    try {
      pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
      await drenar();
      // Sin preferencia legible abre a pantalla completa.
      expect(modo()).toBe("completa");
      for (let i = 0; i < 4; i++) {
        fireEvent.click(reabrirFranja());
        await drenar();
      }
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("marcasVigentes (SDD-0677)", () => {
  it("cuenta lo de los últimos 5 min, sin futuras ni basura", async () => {
    const { marcasVigentes, VENTANA_SSO_MS } = await import("../_components/BandejaClient");
    const ahora = 10_000_000;
    expect(marcasVigentes([ahora - VENTANA_SSO_MS, ahora - VENTANA_SSO_MS + 1, ahora, ahora + 1, Number.NaN], ahora)).toEqual([
      ahora - VENTANA_SSO_MS + 1,
      ahora,
    ]);
  });
});
