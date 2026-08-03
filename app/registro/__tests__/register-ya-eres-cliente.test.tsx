/**
 * SDD-0244 · la bifurcación "¿ya eres cliente?" se ve en el primer paso.
 *
 * Existe por un caso real: clientes que YA tienen Shipping Mark llegan a
 * /registro, se dan de alta creyendo que es lo que toca, y salen con un código
 * NUEVO. Desde ese momento tienen dos, y el que anotan —y le pasan a su
 * proveedor en Yiwu— es el equivocado.
 *
 * Esta banda es la capa BLANDA (la dura es el dedup del servidor por documento,
 * correo y teléfono). Pero tiene que estar VISIBLE en el primer paso: si queda
 * en un paso posterior, para cuando el cliente la vea ya escribió todo y va a
 * seguir de largo. Mismo aprendizaje de SDD-0225 — un mensaje dibujado donde
 * nadie lo ve es un mensaje que no existe.
 *
 * PRUEBA DE MUTACIÓN — si borras `<YaEresCliente />` de `StepIdentidad`
 * (RegisterForm.tsx), este archivo se pone rojo.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("../actions", () => ({
  registerClientAction: vi.fn(async () => ({})),
}));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

beforeEach(() => cleanup());

describe("registro · bifurcación ¿ya eres cliente?", () => {
  it("se ve desde el primer paso, sin tener que avanzar", () => {
    render(<RegisterForm />);

    // El paso 1 es el que está montado al abrir: lo confirma su campo propio.
    // (El rail lateral lista SIEMPRE los 5 títulos, así que buscar el título del
    // paso no prueba en qué paso estás — hay que mirar los campos.)
    expect(screen.getByPlaceholderText("Carlos Pérez")).toBeTruthy();

    expect(screen.getByText(/¿Ya eres cliente de DTD Cargo\?/i)).toBeTruthy();
  });

  it("ofrece entrar a la cuenta existente en vez de crear otra", () => {
    render(<RegisterForm />);

    const entrar = screen.getByRole("link", { name: /entrar a mi cuenta/i });
    expect(entrar.getAttribute("href")).toBe("/portal/login");
  });

  it("explica el porqué: seguiría usando su Shipping Mark de siempre", () => {
    render(<RegisterForm />);

    expect(screen.getByText(/seguirías usando tu Shipping Mark de siempre/i)).toBeTruthy();
  });
});
