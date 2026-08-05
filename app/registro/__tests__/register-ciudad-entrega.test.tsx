/**
 * migr 0348 · el registro pregunta A DÓNDE hay que entregar.
 *
 * El caso real (2026-08-05): un cliente se registró, nunca se le preguntó la
 * ciudad, y terminó trancado en Portal › Mi perfil › Direcciones cargándola a
 * mano — donde además tecleó el estado incompleto ("Carabo"). Por eso la ciudad
 * se pide al registrarse y el estado NO se escribe: sale del catálogo.
 *
 * PRUEBAS DE MUTACIÓN (hacer a mano sobre RegisterForm.tsx; cada una tiene que
 * poner ESTE archivo en rojo — si no, el test es decorado):
 *   · quitar `city`/`state` de `step1Valid`        → "no deja avanzar sin ciudad"
 *   · en `elegir()`, no copiar `hit.state`         → "el estado se completa solo"
 *   · borrar la opción "Mi ciudad no aparece aquí" → "acepta una ciudad de fuera"
 *
 * Contrato: FRM-01 (lo obligatorio se marca antes de fallar, no después).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../actions", () => ({ registerClientAction: vi.fn(async () => ({})) }));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

const CIUDADES = [
  { city: "Valencia", state: "Carabobo" },
  { city: "Maracay", state: "Aragua" },
];

/** Deja el paso 1 completo y salta al paso 2 (Contacto). */
async function irAContacto() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Carlos Pérez"), "Carlos Pérez");
  await user.type(screen.getByPlaceholderText("18456321"), "18456321");
  await user.type(screen.getByPlaceholderText("cperez@empresa.com"), "carlos@empresa.com");
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  // El paso 2 se reconoce por SUS campos montados: el rail lateral lista los
  // cinco títulos desde el paso 1, así que buscar el texto "Contacto" da
  // positivo aunque no hayas avanzado.
  await screen.findByPlaceholderText("412 1668021");
  return user;
}

describe("registro · ciudad de entrega (migr 0348)", () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ exists: false }))) as never;
  });

  it("el estado se completa solo al elegir la ciudad — nadie lo teclea", async () => {
    render(<RegisterForm cities={CIUDADES} />);
    const user = await irAContacto();

    await user.selectOptions(screen.getByRole("combobox", { name: /ciudad/i }), "Maracay");

    // El estado aparece resuelto y NO como campo escribible.
    expect(await screen.findByText("Aragua")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Carabobo")).not.toBeInTheDocument();
  });

  it("no deja avanzar sin ciudad, y lo dice en el campo", async () => {
    render(<RegisterForm cities={CIUDADES} />);
    const user = await irAContacto();

    await user.type(screen.getByPlaceholderText("412 1668021"), "4121668021");
    await user.click(screen.getByRole("button", { name: /continuar/i }));

    // Sigue en el paso 2 (su campo sigue montado) y el error señala la ciudad.
    expect(screen.getByPlaceholderText("412 1668021")).toBeInTheDocument();
    expect(screen.getAllByText(/campo obligatorio/i).length).toBeGreaterThan(0);
  });

  it("acepta una ciudad de fuera del catálogo y ahí sí pide el estado", async () => {
    render(<RegisterForm cities={CIUDADES} />);
    const user = await irAContacto();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /ciudad/i }),
      "__otra__",
    );

    // Ahora ambos son texto libre: perder el lead de un pueblo que no está en la
    // lista sería peor que guardar un texto sin normalizar.
    await user.type(await screen.findByPlaceholderText("Escribe tu ciudad"), "Punta de Mata");
    await user.type(screen.getByPlaceholderText("Carabobo"), "Monagas");

    // Se mira el campo VISIBLE por su placeholder: el valor también viaja en el
    // espejo oculto del <form>, así que buscar por valor encuentra dos.
    expect(screen.getByPlaceholderText("Escribe tu ciudad")).toHaveValue("Punta de Mata");
    expect(screen.getByPlaceholderText("Carabobo")).toHaveValue("Monagas");
  });

  it("sin catálogo degrada a texto libre en vez de bloquear el alta", async () => {
    render(<RegisterForm />);
    await irAContacto();

    // `listRegisterCities` falla blando devolviendo []: un fallo leyendo una
    // lista de ciudades no puede costarnos un cliente.
    expect(await screen.findByPlaceholderText("Escribe tu ciudad")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /ciudad/i })).not.toBeInTheDocument();
  });
});
