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
import { cerrarGuia, GuiaMotor, iniciarGuia } from "./GuiaMotor";
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

  // Pedido del Director General (2026-11-05): no había prueba de que, sin `?guia=`
  // ni `iniciarGuia()`, la guía no se abre sola. Con 9.3 sigue igual mientras no se
  // encienda `autoArranque`, que solo enciende `GuiaStudio` con estado de la base;
  // los casos con arranque automático están en «9.3 · estado por usuario».
  it("sin ?guia= ni iniciarGuia() no abre, aunque esté en su ruta con todas las anclas", () => {
    vi.useFakeTimers();
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D2", terminado: false });
    montar({ almacen });
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
    expect(screen.queryByTestId("guia-contorno")).toBeNull();
    // Tampoco tocó el progreso guardado: no se abrió ni en silencio.
    expect(almacen.leer("dashboard")).toEqual({ pasoId: "D2", terminado: false });
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

describe("9.3 · estado por usuario", () => {
  const OTRO: GuiaRecorrido = {
    id: "clientes",
    ruta: "/studio/clientes",
    pasos: [{ id: "C1", ancla: "dashboard.bienvenida", clave: "guide.dashboard.welcome" }],
  };

  function montarAuto(
    almacen: ReturnType<typeof crearAlmacenMemoria>,
    extra: Partial<Parameters<typeof GuiaMotor>[0]> = {},
  ) {
    return render(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO]} almacen={almacen} autoArranque {...extra} />
      </>,
    );
  }

  it("la primera vez en la pantalla arranca sola en el primer paso, ofrece «No volver a mostrar» y lo anota", () => {
    const almacen = crearAlmacenMemoria();
    montarAuto(almacen);
    expect(tarjeta()).not.toBeNull();
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    expect(within(tarjeta()!).getByRole("button", { name: "No volver a mostrar" })).toBeInTheDocument();
    expect(within(tarjeta()!).queryByRole("button", { name: "Ver la guía desde el principio" })).toBeNull();
    expect(almacen.leer("dashboard")?.vistoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("«No volver a mostrar» solo está en el primer paso del arranque automático", () => {
    montarAuto(crearAlmacenMemoria());
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.queryByRole("button", { name: "No volver a mostrar" })).toBeNull();
  });

  it("ya vista, no arranca sola: recargar no la repite", () => {
    const almacen = crearAlmacenMemoria();
    const primera = montarAuto(almacen);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la guía" }));
    primera.unmount();
    vi.useFakeTimers();
    montarAuto(almacen);
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
  });

  it("«No volver a mostrar» la apaga, y el botón la sigue abriendo", () => {
    const almacen = crearAlmacenMemoria();
    const primera = montarAuto(almacen);
    fireEvent.click(screen.getByRole("button", { name: "No volver a mostrar" }));
    expect(tarjeta()).toBeNull();
    expect(almacen.leer("dashboard")).toMatchObject({ noMostrar: true });
    primera.unmount();
    montarAuto(almacen);
    expect(tarjeta()).toBeNull();
    act(() => iniciarGuia("dashboard", { origen: "boton" }));
    expect(tarjeta()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "No volver a mostrar" })).toBeNull();
  });

  it("sin anclas no abre, y no la da por vista", () => {
    vi.useFakeTimers();
    const almacen = crearAlmacenMemoria();
    render(
      <>
        <Pantalla sin={RECORRIDO.pasos.map((p) => p.ancla)} />
        <GuiaMotor catalogo={[RECORRIDO]} almacen={almacen} autoArranque />
      </>,
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
    expect(almacen.leer("dashboard")).toBeNull();
  });

  it("con `una_vez`, otra pantalla ya vista basta para no arrancar", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("clientes", { vistoEn: "2026-11-06T04:00:00.000Z" });
    render(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO, OTRO]} almacen={almacen} autoArranque modoArranque="una_vez" />
      </>,
    );
    expect(tarjeta()).toBeNull();
  });

  it("con `por_pantalla`, otra pantalla vista no cuenta", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("clientes", { vistoEn: "2026-11-06T04:00:00.000Z" });
    render(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[RECORRIDO, OTRO]} almacen={almacen} autoArranque modoArranque="por_pantalla" />
      </>,
    );
    expect(tarjeta()).not.toBeNull();
  });

  it("?guia= gana al arranque automático y siempre empieza por el primer paso", () => {
    nav.query = "guia=dashboard";
    // Nunca vista: sin ?guia= arrancaría sola. Con ?guia=, abre la URL y no la da por vista.
    const almacen = crearAlmacenMemoria();
    montarAuto(almacen);
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No volver a mostrar" })).toBeNull();
    expect(almacen.leer("dashboard")?.vistoEn).toBeUndefined();
  });

  it("?guia= no sigue el progreso guardado", () => {
    nav.query = "guia=dashboard";
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D3", terminado: false });
    montar({ almacen });
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
  });

  it("el botón sigue donde quedó una guía a medias, y «desde el principio» vuelve al primero", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D3", terminado: false, vistoEn: "2026-11-06T04:00:00.000Z" });
    montar({ almacen });
    act(() => iniciarGuia("dashboard", { origen: "boton" }));
    expect(within(tarjeta()!).getByText(/3 de 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver la guía desde el principio" }));
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver la guía desde el principio" })).toBeNull();
  });

  it("terminada, el botón empieza por el primer paso", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D4", terminado: true });
    montar({ almacen });
    act(() => iniciarGuia("dashboard", { origen: "boton" }));
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver la guía desde el principio" })).toBeNull();
  });

  it("si el paso guardado ya no está en pantalla, el botón empieza por el primero", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D3", terminado: false });
    montar({ almacen, sin: ["dashboard.configurar"] });
    act(() => iniciarGuia("dashboard", { origen: "boton" }));
    expect(within(tarjeta()!).getByRole("heading", { name: "Tu inicio en Studio" })).toBeInTheDocument();
  });

  it("cerrarGuia() la cierra y guarda el paso", () => {
    const almacen = crearAlmacenMemoria();
    montar({ almacen });
    act(() => iniciarGuia("dashboard"));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    act(() => cerrarGuia());
    expect(tarjeta()).toBeNull();
    expect(almacen.leer("dashboard")).toMatchObject({ pasoId: "D2", terminado: false });
  });
});

describe("9.4 · anclas dentro de Chatwoot", () => {
  // Recorrido como el de la Bandeja: dos pasos de Chatwoot con respaldo al marco y uno de Studio.
  const BANDEJA: GuiaRecorrido = {
    id: "bandeja",
    ruta: "/studio/bandeja",
    pasos: [
      { id: "B1", ancla: "bandeja.composer", clave: "guide.inbox.reply", respaldo: "bandeja.marco" },
      { id: "B6", ancla: "bandeja.nota-privada", clave: "guide.inbox.note", respaldo: "bandeja.marco" },
      { id: "X", ancla: "bandeja.otra", clave: "guide.dashboard.kpis" },
    ],
  };
  const MARCO = { top: 200, left: 100, width: 900, height: 600 };

  function Marco({ con = true }: { con?: boolean }) {
    return con ? (
      <div
        data-guia="bandeja.marco"
        ref={(el) => {
          if (el) el.getBoundingClientRect = () => ({ ...MARCO, x: 0, y: 0, right: 1000, bottom: 800, toJSON() {} }) as DOMRect;
        }}
      />
    ) : null;
  }
  const contorno = () => screen.getByTestId("guia-contorno").style;
  const quitar: Array<() => void> = [];

  beforeEach(() => {
    nav.pathname = "/studio/bandeja";
  });
  afterEach(() => {
    while (quitar.length) quitar.pop()!();
  });

  it("sin el script del panel, los pasos de Chatwoot se anclan al marco y el de Studio sin ancla se salta", () => {
    render(
      <>
        <Marco />
        <GuiaMotor catalogo={[BANDEJA]} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    expect(within(tarjeta()!).getByRole("heading", { name: "Contestar un WhatsApp" })).toBeInTheDocument();
    expect(within(tarjeta()!).getByText(/1 de 2/)).toBeInTheDocument();
    expect(contorno().top).toBe(`${MARCO.top - 4}px`);
    expect(contorno().width).toBe(`${MARCO.width + 8}px`);
    // No es «esta parte cambió de lugar»: el texto sigue valiendo para el marco.
    expect(screen.queryByText(/cambió de lugar/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(within(tarjeta()!).getByRole("heading", { name: "Dejar una nota" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminar" })).toBeInTheDocument();
  });

  it("el botón retoma un paso de Chatwoot que solo está por su respaldo (sin el script del panel)", () => {
    const almacen = crearAlmacenMemoria();
    render(
      <>
        <Marco />
        <GuiaMotor catalogo={[BANDEJA]} almacen={almacen} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    act(() => cerrarGuia());
    expect(almacen.leer("bandeja")).toMatchObject({ pasoId: "B6", terminado: false });
    act(() => iniciarGuia("bandeja", { origen: "boton" }));
    expect(within(tarjeta()!).getByRole("heading", { name: "Dejar una nota" })).toBeInTheDocument();
    expect(within(tarjeta()!).getByText(/2 de 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver la guía desde el principio" })).toBeInTheDocument();
  });

  it("sin marco (la Bandeja sin configurar) no abre", () => {
    vi.useFakeTimers();
    render(
      <>
        <Marco con={false} />
        <GuiaMotor catalogo={[BANDEJA]} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
  });

  it("cuando el ubicador trae la caja, el contorno pasa del marco al elemento y la sigue", async () => {
    const { registrarUbicador, avisarCambioUbicadores } = await import("@/lib/studio/guia/ubicadores");
    let caja: { top: number; left: number; width: number; height: number } | null | undefined;
    const mostrar = vi.fn();
    quitar.push(registrarUbicador({ caja: (a) => (a === "bandeja.composer" ? caja : undefined), mostrar }));
    render(
      <>
        <Marco />
        <GuiaMotor catalogo={[BANDEJA]} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    expect(contorno().top).toBe(`${MARCO.top - 4}px`);

    // Llega la medida del panel: el contorno va al composer.
    caja = { top: 600, left: 300, width: 500, height: 120 };
    await act(async () => {
      avisarCambioUbicadores();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(contorno().top).toBe("596px");
    expect(contorno().left).toBe("296px");

    // El composer se va fuera de la vista del marco: vuelve al marco.
    caja = null;
    await act(async () => {
      avisarCambioUbicadores();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(contorno().top).toBe(`${MARCO.top - 4}px`);
  });

  it("al entrar a un paso de Chatwoot, le pide al ubicador que lo traiga a la vista", async () => {
    const { registrarUbicador } = await import("@/lib/studio/guia/ubicadores");
    const mostrar = vi.fn();
    quitar.push(
      registrarUbicador({
        caja: (a) => (a === "bandeja.nota-privada" ? null : undefined),
        mostrar,
      }),
    );
    render(
      <>
        <Marco />
        <GuiaMotor catalogo={[BANDEJA]} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    // B1: el ubicador no lo tiene; no se le pide nada.
    expect(mostrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mostrar).toHaveBeenCalledWith("bandeja.nota-privada", { suave: true });
  });

  it("un ubicador que lanza no rompe la guía", async () => {
    const { registrarUbicador } = await import("@/lib/studio/guia/ubicadores");
    quitar.push(
      registrarUbicador({
        caja: () => {
          throw new Error("roto");
        },
      }),
    );
    render(
      <>
        <Marco />
        <GuiaMotor catalogo={[BANDEJA]} />
      </>,
    );
    act(() => iniciarGuia("bandeja"));
    expect(tarjeta()).not.toBeNull();
  });
});

describe("9.5 · recorridos que no arrancan solos", () => {
  it("con arranqueAutomatico: false no abre sola, aunque nunca la haya visto; ?guia= sí la abre", () => {
    vi.useFakeTimers();
    const almacen = crearAlmacenMemoria();
    const SIN_AUTO: GuiaRecorrido = { ...RECORRIDO, arranqueAutomatico: false };
    const primera = render(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[SIN_AUTO]} almacen={almacen} autoArranque />
      </>,
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(tarjeta()).toBeNull();
    expect(almacen.leer("dashboard")).toBeNull();
    primera.unmount();
    nav.query = "guia=dashboard";
    render(
      <>
        <Pantalla />
        <GuiaMotor catalogo={[SIN_AUTO]} almacen={almacen} autoArranque />
      </>,
    );
    expect(tarjeta()).not.toBeNull();
  });
});
