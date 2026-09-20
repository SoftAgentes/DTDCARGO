/**
 * SDD-0225 · el error del servidor dice QUÉ campo y lleva hasta él.
 *
 * El caso real: el servidor devuelve `fieldErrors.email`, pero ese campo vive en
 * el paso 1 y quien aprieta "Crear cuenta" está en el paso 4. El mensaje se
 * pintaba en un paso que no estaba en pantalla, así que la persona sólo veía
 * que "algo" falló, sin saber qué ni dónde.
 *
 * PRUEBA DE MUTACIÓN — borra el bloque `fieldErrors.length > 0` de StepConfirmar
 * (RegisterForm.tsx) y este archivo se pone rojo. Si lo borras y sigue verde, el
 * test dejó de servir.
 *
 * Contrato: ERR-01 (nivel formulario = resumen + campos marcados; el mensaje
 * dice qué pasó, qué se conservó y qué puede hacer la persona) · FRM-01 y
 * A11Y-01 §9 (el primer error bloqueante recibe foco).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// El servidor rechaza el correo. Es exactamente lo que devuelve
// `validateRegisterInput` cuando el formato no pasa.
vi.mock("../actions", () => ({
  registerClientAction: vi.fn(async () => ({
    fieldErrors: { email: "Email inválido." },
  })),
}));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

/** Recorre los 4 pasos con datos válidos y manda el formulario. */
async function llegarAConfirmarYEnviar() {
  const user = userEvent.setup({ delay: null });
  await user.type(screen.getByPlaceholderText("Carlos Pérez"), "Carlos Pérez");
  await user.type(screen.getByPlaceholderText("18456321"), "18456321");
  await user.type(screen.getByPlaceholderText("cperez@empresa.com"), "carlos@empresa.com");
  await user.click(screen.getByRole("button", { name: /continuar/i }));

  await user.type(await screen.findByPlaceholderText("412 1668021"), "4121668021");
  // Ciudad + estado de entrega (migr 0348). Sin catálogo el campo cae a texto
  // libre, que es como se renderiza acá: <RegisterForm /> va sin `cities`.
  await user.type(await screen.findByPlaceholderText("Escribe tu ciudad"), "Valencia");
  await user.type(screen.getByPlaceholderText("Carabobo"), "Carabobo");
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  await user.click(await screen.findByRole("button", { name: /continuar/i }));

  await user.click(await screen.findByRole("button", { name: /crear cuenta/i }));
  return user;
}

describe("registro · resumen de errores del servidor (SDD-0225)", () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ exists: false }))) as never;
  });

  it("nombra el campo que falló, no sólo que hubo un error", async () => {
    render(<RegisterForm />);
    await llegarAConfirmarYEnviar();

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(/falta corregir un dato/i);
    // El nombre humano del campo, no la clave de la tabla.
    expect(aviso).toHaveTextContent(/correo/i);
    expect(aviso).toHaveTextContent(/email inválido/i);
  });

  it("le dice a la persona que no perdió lo que escribió (ERR-01)", async () => {
    render(<RegisterForm />);
    await llegarAConfirmarYEnviar();

    expect(await screen.findByText(/no perdiste nada de lo que escribiste/i)).toBeInTheDocument();
  });

  it("«Corregir» devuelve al paso del campo y le da el foco", async () => {
    render(<RegisterForm />);
    const user = await llegarAConfirmarYEnviar();

    await user.click(await screen.findByRole("button", { name: /corregir/i }));

    // Volvimos al paso 1: el campo de correo está montado otra vez…
    const email = await screen.findByPlaceholderText("cperez@empresa.com");
    expect(email).toBeInTheDocument();
    // …y es el que tiene el foco (A11Y-01 §9).
    expect(document.activeElement).toBe(email);
  });
});
