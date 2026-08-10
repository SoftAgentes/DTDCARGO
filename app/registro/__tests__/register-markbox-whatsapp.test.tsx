/**
 * SDD-0254 · el Shipping Mark se puede guardar en el WhatsApp del cliente.
 *
 * Existe por dos casos reales: DTD-9048 (rebote 14 h después) y DTD-1010
 * (rebote instantáneo). En los dos, el cliente quedó sin su código Y sin puerta
 * —la clave del registro es aleatoria, así que la única entrada es un enlace al
 * correo—, y nadie se enteró hasta mucho después.
 *
 * Se prueba `StepDone` directo y no el wizard entero: llegar al paso 5 exige
 * pasar 4 pasos de validación, y `fireEvent.submit` no dispara el
 * `useActionState` de React 19 en jsdom (medido).
 *
 * PRUEBA DE MUTACIÓN — si borras el bloque del botón de WhatsApp en `StepDone`
 * (RegisterForm.tsx), este archivo se pone rojo.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("../actions", () => ({ registerClientAction: vi.fn(async () => ({})) }));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { StepDone } from "../RegisterForm";

const MARKBOX = "DTD-9048";

beforeEach(() => cleanup());

function pintar(firstName = "Jessilen") {
  render(
    <StepDone markbox={MARKBOX} firstName={firstName} email="cliente@ejemplo.test" />,
  );
}

const botonWa = () =>
  screen.getByRole("link", { name: /gu[áa]rdalo en mi whatsapp/i });

describe("registro · guardar el Shipping Mark en WhatsApp", () => {
  it("ofrece el botón en la pantalla de éxito", () => {
    pintar();
    expect(botonWa()).toBeTruthy();
  });

  it("apunta a wa.me con el Shipping Mark dentro del mensaje", () => {
    pintar();
    const href = botonWa().getAttribute("href") ?? "";

    expect(href.startsWith("https://wa.me/")).toBe(true);
    // El texto viaja URL-encoded; lo que importa es que el código llegue.
    const texto = decodeURIComponent(href);
    expect(texto).toContain(MARKBOX);
    expect(texto).toContain("Acabo de registrarme en DTD Cargo");
    expect(texto).toContain("Jessilen");
  });

  it("no filtra el correo del cliente en la URL", () => {
    // El correo se le pasa a StepDone para pintarlo en pantalla; NO tiene por
    // qué viajar en el query string de un tercero.
    pintar();
    expect(decodeURIComponent(botonWa().getAttribute("href") ?? "")).not.toContain(
      "cliente@ejemplo.test",
    );
  });

  it("abre en pestaña nueva sin regalar la referencia de la ventana", () => {
    pintar();
    expect(botonWa().getAttribute("target")).toBe("_blank");
    expect(botonWa().getAttribute("rel")).toContain("noopener");
  });

  it("NO desplaza a 'Ir al portal' como acción principal", () => {
    // Regla 1 de botones: un solo primario por contexto. El camino feliz sigue
    // siendo el portal; WhatsApp es la red debajo.
    pintar();
    expect(botonWa().className).toContain("btn-ghost");
    expect(
      screen.getByRole("link", { name: /ir al portal/i }).className,
    ).toContain("btn-primary");
  });

  it("sin nombre el mensaje sigue siendo mandable", () => {
    pintar("");
    const texto = decodeURIComponent(botonWa().getAttribute("href") ?? "");
    expect(texto).toContain(MARKBOX);
    expect(texto).not.toContain("soy .");
  });
});
