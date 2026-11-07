/**
 * GuiaBoton (SDD-0589, 9.3): alterna la guía de la pantalla y sigue donde quedó.
 * Todavía no está montado en la barra; se prueba con el motor al lado.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearAlmacenMemoria } from "@/lib/studio/guia/almacen";
import type { GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { GuiaBoton } from "./GuiaBoton";
import { GuiaMotor } from "./GuiaMotor";

const nav = vi.hoisted(() => ({ pathname: "/studio/dashboard", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.query),
  // El motor cambia la pestaña con replace (P-13); estos recorridos no tienen consulta.
  useRouter: () => ({ replace: () => undefined }),
}));

const RECORRIDO: GuiaRecorrido = {
  id: "dashboard",
  ruta: "/studio/dashboard",
  pasos: [
    { id: "D1", ancla: "dashboard.bienvenida", clave: "guide.dashboard.welcome" },
    { id: "D2", ancla: "dashboard.kpis", clave: "guide.dashboard.kpis" },
  ],
};

function montar(almacen = crearAlmacenMemoria()) {
  render(
    <>
      <div data-guia="dashboard.bienvenida">a</div>
      <div data-guia="dashboard.kpis">b</div>
      <GuiaBoton catalogo={[RECORRIDO]} />
      <GuiaMotor catalogo={[RECORRIDO]} almacen={almacen} />
    </>,
  );
  return almacen;
}

const boton = () => screen.getByRole("button", { name: "Guía" });

beforeEach(() => {
  nav.pathname = "/studio/dashboard";
  nav.query = "";
});

describe("GuiaBoton", () => {
  it("en una pantalla sin recorrido no se muestra", () => {
    nav.pathname = "/studio/clientes";
    montar();
    expect(screen.queryByRole("button", { name: "Guía" })).toBeNull();
  });

  it("abre y cierra la guía; el nombre no cambia y el estado va en aria-pressed", () => {
    montar();
    expect(boton()).toHaveAttribute("aria-pressed", "false");
    expect(boton()).toHaveAttribute("title", "Mostrar la guía de esta pantalla");
    fireEvent.click(boton());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(boton()).toHaveAttribute("aria-pressed", "true");
    expect(boton()).toHaveAttribute("title", "Ocultar la guía");
    fireEvent.click(boton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(boton()).toHaveAttribute("aria-pressed", "false");
  });

  it("con la guía a medias, sigue donde quedó", () => {
    const almacen = crearAlmacenMemoria();
    almacen.guardar("dashboard", { pasoId: "D2", terminado: false });
    montar(almacen);
    fireEvent.click(boton());
    expect(screen.getByRole("heading", { name: "Los números del día" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver la guía desde el principio" })).toBeInTheDocument();
  });

  it("al cerrar con la tarjeta, el foco vuelve al botón", () => {
    montar();
    boton().focus();
    fireEvent.click(boton());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la guía" }));
    expect(boton()).toHaveFocus();
  });
});
