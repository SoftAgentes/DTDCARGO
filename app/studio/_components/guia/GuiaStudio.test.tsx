/**
 * GuiaStudio (SDD-0589, 9.3): el servidor manda, ningún render lee `localStorage`,
 * y sin estado de la base la guía no arranca sola.
 */
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estadoGuiaVacio } from "@/lib/studio/guia/estado-types";
import { GuiaStudio } from "./GuiaStudio";

const nav = vi.hoisted(() => ({ pathname: "/studio/dashboard", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.query),
  // El motor cambia la pestaña con replace (P-13); estos recorridos no tienen consulta.
  useRouter: () => ({ replace: () => undefined }),
}));

const accion = vi.hoisted(() => ({
  guardar: vi.fn(async (entrada: string) => {
    void entrada;
    return { ok: true as const };
  }),
}));
vi.mock("@/app/studio/(app)/_actions/guia-actions", () => ({
  guardarEstadoGuiaAction: accion.guardar,
}));

function Anclas() {
  return (
    <>
      {["dashboard.bienvenida", "dashboard.kpis", "dashboard.configurar", "dashboard.paneles"].map((a) => (
        <div key={a} data-guia={a}>
          {a}
        </div>
      ))}
    </>
  );
}

beforeEach(() => {
  nav.pathname = "/studio/dashboard";
  nav.query = "";
  accion.guardar.mockClear();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GuiaStudio", () => {
  it("el render del servidor no lee localStorage, aunque tenga otro estado", () => {
    window.localStorage.setItem("dtd.guia.v1.dashboard", JSON.stringify({ pasoId: "D3", terminado: false, noMostrar: true }));
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    renderToString(<GuiaStudio estadoInicial={estadoGuiaVacio()} />);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("decide con el estado de la base, no con el del navegador", () => {
    // El navegador dice «no volver a mostrar»; la base dice que nunca la vio.
    window.localStorage.setItem("dtd.guia.v1.dashboard", JSON.stringify({ pasoId: "D3", terminado: false, noMostrar: true }));
    render(
      <>
        <Anclas />
        <GuiaStudio estadoInicial={estadoGuiaVacio()} />
      </>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No volver a mostrar" })).toBeInTheDocument();
  });

  it("guarda en la base 650 ms después, con el estado validado", async () => {
    vi.useFakeTimers();
    render(
      <>
        <Anclas />
        <GuiaStudio estadoInicial={estadoGuiaVacio()} />
      </>,
    );
    act(() => vi.advanceTimersByTime(700));
    expect(accion.guardar).toHaveBeenCalled();
    const ultimo = JSON.parse(accion.guardar.mock.calls.at(-1)![0]);
    expect(ultimo).toMatchObject({ v: 1, recorridos: { dashboard: { pasoId: "D1", terminado: false } } });
    expect(ultimo.recorridos.dashboard.vistoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sin estado de la base no arranca sola ni llama al servidor", () => {
    vi.useFakeTimers();
    render(
      <>
        <Anclas />
        <GuiaStudio estadoInicial={null} />
      </>,
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(accion.guardar).not.toHaveBeenCalled();
  });

  it("con la guía ya vista en la base, no arranca sola", () => {
    vi.useFakeTimers();
    render(
      <>
        <Anclas />
        <GuiaStudio
          estadoInicial={{ v: 1, recorridos: { dashboard: { pasoId: "D4", terminado: true, noMostrar: false } } }}
        />
      </>,
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Y la copia del navegador queda con el estado de la base.
    expect(JSON.parse(window.localStorage.getItem("dtd.guia.v1.dashboard") ?? "null")).toMatchObject({
      pasoId: "D4",
      terminado: true,
    });
  });
});

describe("GuiaStudio · 9.5, el rol del layout", () => {
  function Actualizaciones() {
    return (
      <>
        <dl data-guia="actualizaciones.version" />
        <span data-guia="actualizaciones.pedir" />
      </>
    );
  }

  it("con rol admin abre el recorrido de Actualizaciones", () => {
    nav.pathname = "/studio/admin/actualizaciones";
    nav.query = "guia=actualizaciones";
    render(
      <>
        <Actualizaciones />
        <GuiaStudio estadoInicial={estadoGuiaVacio()} rol="admin" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Qué versión tienes" })).toBeInTheDocument();
  });

  it("con otro rol, o sin rol, ese recorrido no existe para el motor", () => {
    vi.useFakeTimers();
    nav.pathname = "/studio/admin/actualizaciones";
    nav.query = "guia=actualizaciones";
    for (const rol of ["support", null] as const) {
      const r = render(
        <>
          <Actualizaciones />
          <GuiaStudio estadoInicial={estadoGuiaVacio()} rol={rol} />
        </>,
      );
      act(() => vi.advanceTimersByTime(3_000));
      expect(screen.queryByRole("dialog")).toBeNull();
      r.unmount();
    }
  });

  it("los recorridos nuevos no arrancan solos, ni con estado de la base y nunca vistos", () => {
    vi.useFakeTimers();
    nav.pathname = "/studio/admin/actualizaciones";
    render(
      <>
        <Actualizaciones />
        <GuiaStudio estadoInicial={estadoGuiaVacio()} rol="admin" />
      </>,
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
