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
// Adenda 2026-11-23: los pedidos van por `fetch` a rutas propias (`pedidos.ts`), no por server actions.
vi.mock("../_components/pedidos", () => ({
  pedirEnlaceSso: (c?: number, signal?: AbortSignal) => pedirEnlaceSso(c, signal),
  reconciliarBandeja: () => reconciliar(),
}));

const { BandejaClient, reiniciarFrenoEnMemoria } = await import("../_components/BandejaClient");

const PANEL = "https://chat.dtdcargo.com/app/accounts/1/dashboard";
const SSO = "https://chat.dtdcargo.com/app/login?email=ana%40example.test&sso_auth_token=t";
const marco = () => document.querySelector("iframe");

beforeEach(() => {
  pedirEnlaceSso.mockReset();
  reconciliar.mockClear();
  window.localStorage.clear();
  reiniciarFrenoEnMemoria();
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
    expect(marco()?.getAttribute("allow")).toBe("microphone; autoplay");
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
    expect(screen.queryByRole("link", { name: "Agentes" })).toBeNull();
    rerender(
      <BandejaClient estado="sin_vinculo" panelUrl={PANEL} inicioUrl={null} admin={{ agentesHref: "/studio/usuarios?tab=bandeja" }} />,
    );
    // SDD-0680: en la fila, con icono y «Agentes»; el nombre largo va en el título.
    const enlace = screen.getByRole("link", { name: "Agentes" });
    expect(enlace.getAttribute("href")).toBe("/studio/usuarios?tab=bandeja");
    expect(enlace.getAttribute("title")).toBe("Agentes vinculados");
    // Ni el formulario de vincular ni el de alta: viven en Usuarios › Bandeja.
    expect(screen.queryByRole("button", { name: "Vincular" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dar de alta" })).toBeNull();
  });

  it("SDD-0680: un solo título, «CRM», en la fila; la Bandeja no repite el suyo", () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos.map((h) => h.textContent)).toEqual(["CRM"]);
  });

  it("con vínculo reconcilia UNA vez, cuando el marco ya cargó; sin vínculo no", async () => {
    const { rerender } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    // Adenda 2026-11-23: no sale mientras el panel abre; tarda decenas de segundos.
    await act(async () => undefined);
    expect(reconciliar).not.toHaveBeenCalled();
    fireEvent.load(marco()!);
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

const region = () => document.querySelector("section[data-bandeja]") as HTMLElement | null;
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

describe("BandejaClient · la fila y el panel (SDD-0680, variante C)", () => {
  it("una sola fila: «CRM», las pestañas que trae la página, el estado y las acciones; sin «Reducir» ni ayuda fija", async () => {
    render(
      <BandejaClient
        estado="listo"
        panelUrl={PANEL}
        inicioUrl={PANEL}
        pestanas={<div role="tablist" aria-label="Tablero CRM" />}
        admin={{ agentesHref: "/studio/usuarios?tab=bandeja" }}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Tablero CRM" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Abriendo la bandeja…");
    fireEvent.load(marco()!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Conectada"));
    expect(screen.getByRole("button", { name: "Abrir de nuevo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir en pestaña aparte" }).getAttribute("href")).toBe(PANEL);
    expect(screen.getByRole("link", { name: "Agentes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reducir|Pantalla completa/ })).toBeNull();
    expect(screen.queryByText(AYUDA)).toBeNull();
  });

  it("el estado de la fila está montado desde el principio y sigue montado sin texto con un aviso", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "denied" });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    const estado = screen.getByRole("status");
    expect(estado.textContent).toBe("Abriendo la bandeja…");
    expect(await screen.findByText("La bandeja no abrió")).toBeTruthy();
    // El mismo nodo, ahora vacío: lo explica el aviso.
    expect(screen.getByRole("status")).toBe(estado);
    expect(estado.textContent).toBe("");
  });

  it("el panel va sin marco, de borde a borde y con todo el ancho", () => {
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    expect(marco()?.style.borderRadius).toBe("");
    expect(marco()?.style.borderWidth || marco()?.style.border).toMatch(/^0(px)?$/);
    expect(region()?.hasAttribute("data-ancho-completo")).toBe(true);
    // Ya no hay capa fija sobre el shell ni se bloquea el desplazamiento.
    expect(region()?.style.position).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("el panel llega hasta el borde de abajo de la ventana, con un mínimo", async () => {
    const alto = window.innerHeight;
    const caja = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);
    try {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
      await waitFor(() => expect(marco()?.parentElement?.style.height).toBe("780px"));
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
      fireEvent(window, new Event("resize"));
      await waitFor(() => expect(marco()?.parentElement?.style.height).toBe("480px"));
    } finally {
      caja.mockRestore();
      Object.defineProperty(window, "innerHeight", { configurable: true, value: alto });
    }
  });

  it("«Abrir de nuevo» conserva el ancho (BTN-01 §5): las dos etiquetas en la misma celda, la de espera oculta", async () => {
    let soltar: (v: unknown) => void = () => undefined;
    pedirEnlaceSso.mockReturnValue(new Promise((r) => (soltar = r)));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    const boton = screen.getByRole("button", { name: "Abrir de nuevo" }) as HTMLButtonElement;
    const [reposo, espera] = Array.from(boton.children) as HTMLElement[];
    expect(reposo.style.gridArea).toBe(espera.style.gridArea);
    expect(espera.style.visibility).toBe("hidden");
    fireEvent.click(boton);
    await waitFor(() => expect(boton.getAttribute("aria-busy")).toBe("true"));
    expect(boton.disabled).toBe(true);
    expect(reposo.style.visibility).toBe("hidden");
    expect(espera.style.visibility).toBe("visible");
    expect(espera.textContent).toBe("Abriendo…");
    soltar({ ok: true, url: SSO });
    await waitFor(() => expect(boton.getAttribute("aria-busy")).toBe("false"));
  });

  it("sin vínculo la fila sigue (pestañas y «Agentes» del admin), sin acciones del panel ni marco", () => {
    render(
      <BandejaClient
        estado="sin_vinculo"
        panelUrl={PANEL}
        inicioUrl={null}
        pestanas={<div role="tablist" aria-label="Tablero CRM" />}
        admin={{ agentesHref: "/studio/usuarios?tab=bandeja" }}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Tablero CRM" })).toBeTruthy();
    expect(screen.getByText("Tu usuario no tiene un agente de la bandeja")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Agentes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir de nuevo" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(marco()).toBeNull();
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

  it("SDD-0680: sin ayuda fija; si el marco carga después de «lento», el aviso se va y queda «Conectada»", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
    await drenar(20_000);
    expect(screen.getByText(/tardando más de lo normal/)).toBeTruthy();
    expect(screen.queryByText(AYUDA)).toBeNull();
    fireEvent.load(marco()!);
    await drenar();
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    expect(screen.queryByText(AYUDA)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Conectada");
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

  it("una marca futura (reloj atrasado) cuenta para el freno", async () => {
    const ahora = Date.now();
    window.localStorage.setItem("dtd.bandeja.sso", JSON.stringify([ahora + 60_000, ahora + 30_000, ahora - 1000]));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).not.toHaveBeenCalled();
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
  });

  it("con navigator.locks la reserva corre dentro del candado del freno", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    const nombres: string[] = [];
    const request = vi.fn(async (nombre: string, fn: () => unknown) => {
      nombres.push(nombre);
      return fn();
    });
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });
    try {
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
      await drenar();
      expect(request).toHaveBeenCalledTimes(1);
      expect(nombres).toEqual(["dtd.bandeja.sso"]);
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("si el candado falla, reserva igual sin exclusión", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    vi.stubGlobal("navigator", { ...navigator, locks: { request: vi.fn(async () => Promise.reject(new Error("sin locks"))) } });
    try {
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
      await drenar();
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
      expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("con setItem roto y getItem sano el freno no queda en cero: manda la memoria", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cuota");
    });
    try {
      pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
      await drenar();
      for (let i = 0; i < 4; i++) {
        fireEvent.click(reabrirFranja());
        await drenar();
      }
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    } finally {
      setItem.mockRestore();
    }
  });

  it("con getItem roto y setItem sano el freno tampoco queda en cero", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    try {
      pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
      render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={PANEL} admin={null} />);
      await drenar();
      for (let i = 0; i < 4; i++) {
        fireEvent.click(reabrirFranja());
        await drenar();
      }
      expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    } finally {
      getItem.mockRestore();
    }
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
  it("cuenta lo de los últimos 5 min y las futuras cercanas; descarta lo vencido, lo lejano y la basura", async () => {
    const { marcasVigentes, VENTANA_SSO_MS } = await import("../_components/BandejaClient");
    const ahora = 10_000_000;
    expect(
      marcasVigentes(
        [ahora - VENTANA_SSO_MS, ahora - VENTANA_SSO_MS + 1, ahora, ahora + 1, ahora + VENTANA_SSO_MS - 1, ahora + VENTANA_SSO_MS, Number.NaN],
        ahora,
      ),
    ).toEqual([ahora - VENTANA_SSO_MS + 1, ahora, ahora + 1, ahora + VENTANA_SSO_MS - 1]);
  });
});

/**
 * SDD-0680 · la Bandeja abre sola. El 2026-11-19 la primera carga quedó en
 * «Abriendo la bandeja…» con el POST de la action en `net::ERR_ABORTED`: la
 * llamada a la server action RECHAZA (o no vuelve) y antes de 0680 nada lo
 * atajaba. La fase quedaba en `pidiendo` para siempre, sin vigilante, y «Abrir
 * de nuevo» seguía deshabilitado. Además, cada intento fallido gastaba cupo del
 * freno aunque no hubiera login, y al tercero «Abrir de nuevo» ya no abría.
 */
describe("BandejaClient · abre sola (SDD-0680)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("si la llamada a la action rechaza (ERR_ABORTED), reintenta y abre: no se queda en «Abriendo la bandeja…»", async () => {
    pedirEnlaceSso.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    await drenar(1500);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    expect(marco()?.getAttribute("src")).toBe(SSO);
  });

  it("si la action rechaza las tres veces, muestra el aviso y «Abrir de nuevo» queda habilitado y abre", async () => {
    pedirEnlaceSso.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(6000);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(screen.getByText("La bandeja no abrió")).toBeTruthy();
    expect(screen.queryByText("Abriendo la bandeja…")).toBeNull();
    pedirEnlaceSso.mockReset();
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    expect(reabrirAviso().disabled).toBe(false);
    fireEvent.click(reabrirAviso());
    await drenar();
    expect(marco()?.getAttribute("src")).toBe(SSO);
  });

  it("si el pedido no vuelve, al vencer el plazo lo corta y reintenta en silencio: abre sin aviso (adenda 2026-11-23)", async () => {
    const { PLAZO_ENLACE_MS } = await import("../_components/BandejaClient");
    let senal: AbortSignal | undefined;
    pedirEnlaceSso
      .mockImplementationOnce((_c?: number, s?: AbortSignal) => {
        senal = s;
        return new Promise(() => undefined);
      })
      .mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(PLAZO_ENLACE_MS - 1);
    expect(senal?.aborted).toBe(false);
    await drenar(1);
    // El pedido colgado se cortó: no queda nada trabado detrás.
    expect(senal?.aborted).toBe(true);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
    await drenar(1500);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(2);
    expect(marco()?.getAttribute("src")).toBe(SSO);
    expect(screen.queryByText("La bandeja no abrió")).toBeNull();
  });

  it("si ningún intento vuelve a tiempo, muestra el aviso y «Abrir de nuevo» pide otra vez sin recargar la página", async () => {
    const { PLAZO_ENLACE_MS } = await import("../_components/BandejaClient");
    pedirEnlaceSso.mockReturnValue(new Promise(() => undefined));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(3 * PLAZO_ENLACE_MS + 1500 + 4000);
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(3);
    expect(screen.getByText("La bandeja no abrió")).toBeTruthy();
    expect(screen.getByText(/no respondió a tiempo después de 3 intentos/)).toBeTruthy();
    expect(screen.queryByText(/se vuelve a cargar/)).toBeNull();
    expect(screen.queryByText("Abriendo la bandeja…")).toBeNull();
    pedirEnlaceSso.mockReset();
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    fireEvent.click(reabrirAviso());
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    expect(marco()?.getAttribute("src")).toBe(SSO);
  });

  it("una respuesta que llega después del plazo no pisa el reintento ni gasta el freno (B2)", async () => {
    const { PLAZO_ENLACE_MS } = await import("../_components/BandejaClient");
    const OTRO = "https://chat.dtdcargo.com/app/login?email=ana%40example.test&sso_auth_token=tarde";
    let soltar: (v: unknown) => void = () => undefined;
    pedirEnlaceSso.mockReturnValueOnce(new Promise((r) => (soltar = r))).mockReturnValue(new Promise(() => undefined));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(PLAZO_ENLACE_MS);
    soltar({ ok: true, url: OTRO });
    await drenar();
    expect(marco()).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(0);
  });

  it("si llega el enlace pero otra pestaña llenó el cupo entretanto, no lo carga y explica el freno (B2)", async () => {
    pedirEnlaceSso.mockImplementation(async () => {
      const ahora = Date.now();
      window.localStorage.setItem("dtd.bandeja.sso", JSON.stringify([ahora - 3000, ahora - 2000, ahora - 1000]));
      return { ok: true, url: SSO };
    });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/frena los ingresos repetidos/)).toBeTruthy();
    expect(marco()).toBeNull();
    // No suma una cuarta marca.
    expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(3);
  });

  it("un intento que no llegó a abrir nada no gasta el freno: tras tres fallos, «Abrir de nuevo» abre", async () => {
    pedirEnlaceSso.mockResolvedValue({ ok: false, error: "service" });
    const { unmount } = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar(6000);
    unmount();
    // Dos recargas más que también fallan.
    for (let i = 0; i < 2; i++) {
      const r = render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
      await drenar(6000);
      r.unmount();
    }
    expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(0);
    pedirEnlaceSso.mockResolvedValue({ ok: true, url: SSO });
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(screen.queryByText(/frena los ingresos repetidos/)).toBeNull();
    expect(marco()?.getAttribute("src")).toBe(SSO);
    // El enlace que sí se cargó es el login: ese cuenta.
    expect(JSON.parse(window.localStorage.getItem("dtd.bandeja.sso") ?? "[]")).toHaveLength(1);
  });

  it("el enlace se pide antes que la reconciliación: la reconciliación espera a que termine el SSO", async () => {
    let soltar: (v: unknown) => void = () => undefined;
    pedirEnlaceSso.mockReturnValue(new Promise((r) => (soltar = r)));
    render(<BandejaClient estado="listo" panelUrl={PANEL} inicioUrl={null} admin={null} />);
    await drenar();
    expect(pedirEnlaceSso).toHaveBeenCalledTimes(1);
    // Next pone las server actions en una sola cola: si la reconciliación saliera
    // primero, el SSO esperaría detrás de ella.
    expect(reconciliar).not.toHaveBeenCalled();
    soltar({ ok: true, url: SSO });
    await drenar();
    // Adenda 2026-11-23: tampoco mientras el marco abre; sale al cargar.
    expect(reconciliar).not.toHaveBeenCalled();
    fireEvent.load(marco()!);
    await drenar();
    expect(reconciliar).toHaveBeenCalledTimes(1);
  });
});
