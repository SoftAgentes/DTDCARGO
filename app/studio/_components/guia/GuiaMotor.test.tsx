/**
 * GuiaMotor + GuiaTarjeta (SDD-0589, 9.2): arranque por URL y por evento,
 * navegación, anclas faltantes, teclado, foco, anuncios y no-bloqueo.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearAlmacenMemoria } from "@/lib/studio/guia/almacen";
import type { GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { LocaleProvider } from "@/lib/i18n";
import { GuiaMotor, iniciarGuia } from "./GuiaMotor";
import { GuiaTarjeta } from "./GuiaTarjeta";

const nav = vi.hoisted(() => ({ pathname: "/studio/dashboard", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.query),
}));

const RECORRIDO: GuiaRecorrido = {
  id: "dashboard",
  ruta: "/studio/dashboard",
  pasos: [
    { id: "D1", ancla: "dashboard.bienvenida", clave: "guide.dashboard.welcome" },
    { id: "D2", ancla: "dashboard.kpis", clave: "guide.dashboard.kpis" },
    { id: "D3", ancla: "dashboard.configurar", clave: "guide.dashboard.configure" },
    { id: "D4", ancla: "dashboard.paneles", clave: "guide.dashboard.panels" },
  ],
};

function Pantalla({ sin = [] as string[] }: { sin?: string[] }) {
  const anclas = ["dashboard.bienvenida", "dashboard.kpis", "dashboard.configurar", "dashboard.paneles"];
  return (
    <div>
      <button type="button">Antes</button>
      {anclas
        .filter((a) => !sin.includes(a))
        .map((a) => (
          <div key={a} data-guia={a}>
            {a}
          </div>
        ))}
    </div>
  );
}

function montar(opts: { sin?: string[]; almacen?: ReturnType<typeof crearAlmacenMemoria> } = {}) {
  return render(
    <>
      <Pantalla sin={opts.sin} />
      <GuiaMotor catalogo={[RECORRIDO]} almacen={opts.almacen} />
    </>,
  );
}

const tarjeta = () => screen.queryByRole("dialog");
const estado = () => screen.getByRole("status");

beforeEach(() => {
  nav.pathname = "/studio/dashboard";
  nav.query = "";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("arranque", () => {
  it("?guia=<id> abre la tarjeta en el primer paso, con foco en ella", () => {
    nav.query = "guia=dashboard";
    montar();
    const d = tarjeta();
    expect(d).not.toBeNull();
    expect(d).toHaveAttribute("aria-modal", "false");
    expect(within(d!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    expect(within(d!).getByText(/1 de 4/)).toBeInTheDocument();
    expect(d).toHaveFocus();
    expect(estado()).toHaveTextContent("Guía, paso 1 de 4: Tu inicio en Studio");
    expect(screen.getByTestId("guia-contorno")).toBeInTheDocument();
  });

  it("iniciarGuia() abre desde cualquier componente", () => {
    montar();
    expect(tarjeta()).toBeNull();
    act(() => iniciarGuia("dashboard"));
    expect(tarjeta()).not.toBeNull();
  });

  it("no abre fuera de su ruta ni con un id desconocido", () => {
    nav.pathname = "/studio/clientes";
    nav.query = "guia=dashboard";
    montar();
    expect(tarjeta()).toBeNull();
    act(() => iniciarGuia("no-existe"));
    expect(tarjeta()).toBeNull();
  });

  it("sin ninguna ancla en pantalla no abre ni rompe", () => {
    vi.useFakeTimers();
    nav.query = "guia=dashboard";
    montar({ sin: RECORRIDO.pasos.map((p) => p.ancla) });
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
  });

  it("espera un ancla que se pinta después del motor", () => {
    vi.useFakeTimers();
    nav.query = "guia=dashboard";
    const { rerender } = render(
      <>
        <Pantalla sin={RECORRIDO.pasos.map((p) => p.ancla)} />
        <GuiaMotor catalogo={[RECORRIDO]} />
      </>,
    );
    expect(tarjeta()).toBeNull();
    rerender(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO]} />
      </>,
    );
    act(() => vi.advanceTimersByTime(300));
    expect(tarjeta()).not.toBeNull();
  });
});

describe("navegación", () => {
  it("siguiente / anterior / terminar, guardando el progreso", async () => {
    const user = userEvent.setup();
    const almacen = crearAlmacenMemoria();
    nav.query = "guia=dashboard";
    montar({ almacen });

    const anterior = screen.getByRole("button", { name: "Anterior" });
    expect(anterior).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Los números del día" })).toBeInTheDocument();
    expect(almacen.leer("dashboard")).toEqual({ pasoId: "D2", terminado: false });

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(within(tarjeta()!).getByText(/4 de 4/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terminar" }));
    expect(tarjeta()).toBeNull();
    expect(almacen.leer("dashboard")).toEqual({ pasoId: "D4", terminado: true });
    expect(estado()).toHaveTextContent("Guía cerrada");
  });

  it("salta el paso cuya ancla no está y ajusta el contador", async () => {
    const user = userEvent.setup();
    nav.query = "guia=dashboard";
    montar({ sin: ["dashboard.kpis"] });
    expect(within(tarjeta()!).getByText(/1 de 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Elige qué ver" })).toBeInTheDocument();
    expect(within(tarjeta()!).getByText(/2 de 3/)).toBeInTheDocument();
  });

  it("si el ancla se va con la tarjeta abierta, avisa sin romperse", async () => {
    nav.query = "guia=dashboard";
    montar();
    await act(async () => {
      document.querySelector('[data-guia="dashboard.bienvenida"]')?.remove();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(screen.getByText("Esta parte cambió de lugar. Sigue con el próximo paso.")).toBeInTheDocument();
    expect(screen.queryByTestId("guia-contorno")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Los números del día" })).toBeInTheDocument();
  });
});

describe("teclado, foco y no-bloqueo", () => {
  it("flechas navegan y Escape cierra devolviendo el foco", async () => {
    const user = userEvent.setup();
    montar();
    const antes = screen.getByRole("button", { name: "Antes" });
    antes.focus();
    act(() => iniciarGuia("dashboard"));
    expect(tarjeta()).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("heading", { name: "Los números del día" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(tarjeta()).toBeNull();
    expect(antes).toHaveFocus();
  });

  it("el botón Cerrar tiene nombre accesible", async () => {
    const user = userEvent.setup();
    nav.query = "guia=dashboard";
    montar();
    await user.click(screen.getByRole("button", { name: "Cerrar la guía" }));
    expect(tarjeta()).toBeNull();
  });

  it("no hay fondo ni trampa de foco: la pantalla sigue operable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <button type="button" onClick={onClick}>
          Acción de la pantalla
        </button>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO]} />
      </>,
    );
    act(() => iniciarGuia("dashboard"));
    await user.click(screen.getByRole("button", { name: "Acción de la pantalla" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(tarjeta()).not.toBeNull();
    expect(screen.getByTestId("guia-contorno").style.pointerEvents).toBe("none");
  });

  it("cambiar de ruta cierra la guía", () => {
    nav.query = "guia=dashboard";
    const { rerender } = montar();
    expect(tarjeta()).not.toBeNull();
    nav.pathname = "/studio/clientes";
    nav.query = "";
    rerender(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO]} />
      </>,
    );
    expect(tarjeta()).toBeNull();
  });
});

describe("movimiento reducido e idioma", () => {
  it("con prefers-reduced-motion la tarjeta no se desplaza", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    try {
      nav.query = "guia=dashboard";
      montar();
      const d = tarjeta()!;
      expect(d.style.transform).toBe("none");
      expect(d.style.transition).not.toMatch(/transform|top|left/);
      expect(screen.getByTestId("guia-contorno").style.transition).toBe("none");
    } finally {
      window.matchMedia = original;
    }
  });

  it("muestra «Antes en Kommo» sólo si la tarjeta lo trae", () => {
    nav.query = "guia=dashboard";
    montar();
    expect(screen.queryByText("Antes en Kommo")).toBeNull();
    expect(screen.getByText("Ahora aquí")).toBeInTheDocument();
  });

  it("con texto de Kommo muestra las dos secciones rotuladas", () => {
    render(
      <GuiaTarjeta
        titulo="Contestar un WhatsApp"
        que="Aquí llegan juntos los canales."
        antes="Abrías el chat del lead en Kommo."
        ahora="Entra a Bandeja y contesta abajo."
        n={1}
        total={6}
        esUltimo={false}
        puedeAtras={false}
        faltaAncla={false}
        top={0}
        left={0}
        reducido
        onSiguiente={() => {}}
        onAnterior={() => {}}
        onCerrar={() => {}}
      />,
    );
    expect(screen.getByText("Antes en Kommo")).toBeInTheDocument();
    expect(screen.getByText("Abrías el chat del lead en Kommo.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/Antes en Kommo/);
  });

  it("en zh-CN usa los textos chinos", () => {
    nav.query = "guia=dashboard";
    render(
      <LocaleProvider locale="zh-CN" region={null}>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO]} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "你在 Studio 的首页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一步" })).toBeInTheDocument();
    expect(within(tarjeta()!).getByText(/第 1 步,共 4 步/)).toBeInTheDocument();
  });
});
