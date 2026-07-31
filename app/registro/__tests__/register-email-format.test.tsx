/**
 * SDD-0225 · el registro no deja avanzar con un correo mal escrito.
 *
 * Este test existe por un caso real: un visitante llegó al paso 4 con el correo
 * `adggs`, con los tres pasos anteriores en verde, y sólo reventó al apretar
 * "Crear cuenta" — en una pantalla donde el mensaje del campo ni siquiera se
 * pintaba. El formulario validaba `!email.trim()` (no vacío) mientras el
 * servidor sí validaba formato.
 *
 * PRUEBA DE MUTACIÓN — si cambias `isValidEmail(data.email)` por
 * `!!data.email.trim()` en `step0Valid` (RegisterForm.tsx), este archivo se pone
 * rojo en "no deja pasar del paso 1". Si lo tocas y sigue verde, el test dejó de
 * servir: arréglalo, no lo silencies.
 *
 * Contrato: FRM-01 (validación de formato al enviar) y ERR-01 (mensaje de campo
 * debajo del campo, con relación accesible).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// La server action toca la DB: se sustituye por una que nunca resuelve, porque
// este test NO llega al submit — el punto es justamente que no debería llegar.
vi.mock("../actions", () => ({
  registerClientAction: vi.fn(async () => ({})),
}));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

/** El input del correo. Por placeholder: el label va en un <span> hermano. */
function campoEmail(): HTMLElement {
  return screen.getByPlaceholderText("cperez@empresa.com");
}

/**
 * En qué paso estamos. OJO: el rail lateral lista SIEMPRE los cinco pasos con
 * sus títulos, así que buscar "Cómo te ubicamos" da positivo desde el paso 1.
 * Lo único que distingue el paso es qué campos están montados.
 */
function enPaso1(): boolean {
  return screen.queryByPlaceholderText("cperez@empresa.com") !== null;
}
function enPaso2(): boolean {
  return screen.queryByPlaceholderText("412 1668021") !== null;
}

/** Llena Identidad con datos válidos salvo el correo, que viene por parámetro. */
async function llenarIdentidad(correo: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Carlos Pérez"), "Carlos Pérez");
  await user.type(screen.getByPlaceholderText("18456321"), "18456321");
  if (correo) await user.type(campoEmail(), correo);
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  return user;
}

describe("registro · formato del correo (SDD-0225)", () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ exists: false }))) as never;
  });

  it("no deja pasar del paso 1 con un correo sin arroba", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("adggs");

    expect(enPaso1()).toBe(true);
    expect(enPaso2()).toBe(false);
    expect(screen.getByText(/no parece válido/i)).toBeInTheDocument();
  });

  it("tampoco con un correo sin dominio", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("carlos@");

    expect(enPaso1()).toBe(true);
    expect(enPaso2()).toBe(false);
    expect(screen.getByText(/no parece válido/i)).toBeInTheDocument();
  });

  it("distingue vacío de mal escrito: no dice 'campo obligatorio' a quien ya escribió", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("adggs");

    expect(screen.getByText(/no parece válido/i)).toBeInTheDocument();
    expect(screen.queryByText(/campo obligatorio/i)).not.toBeInTheDocument();
  });

  it("con el correo vacío sí dice que es obligatorio", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("");

    expect(screen.getByText(/campo obligatorio/i)).toBeInTheDocument();
    expect(screen.queryByText(/no parece válido/i)).not.toBeInTheDocument();
  });

  it("con un correo bien escrito sí avanza al paso 2", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("carlos@empresa.com");

    expect(await screen.findByPlaceholderText("412 1668021")).toBeInTheDocument();
    expect(enPaso1()).toBe(false);
  });

  it("el mensaje de error queda atado al input por aria-describedby (ERR-01)", async () => {
    render(<RegisterForm />);
    await llenarIdentidad("adggs");

    const input = campoEmail();
    expect(input).toHaveAttribute("aria-invalid", "true");
    const descrito = input.getAttribute("aria-describedby");
    expect(descrito).toBeTruthy();
    expect(document.getElementById(descrito!)).toHaveTextContent(/no parece válido/i);
  });
});
