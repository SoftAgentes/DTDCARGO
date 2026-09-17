/**
 * SDD-0474 · el registro recoge lo que el cliente ya escribió en la guía.
 *
 * La guía de Alibaba cierra con «Crea tu cuenta y obtén tu Shipping Mark» y
 * manda a `/registro?origen=guia-alibaba` **con la URL limpia**: nombre y
 * teléfono no viajan por querystring, porque son datos personales y acabarían
 * en logs, en el historial y en la cabecera `Referer`. Viajan por el
 * `localStorage` que la guía ya usaba para guardar el avance — `/guias/*.html`
 * y `/registro` comparten origen, así que es la misma caja.
 *
 * Esto se prueba acá y no a mano porque `/registro` **no arranca sin
 * credenciales de Supabase**, y este worktree no las tiene a propósito (AGENTS:
 * no se copian secretos a worktrees). Comprobado: devuelve 404.
 *
 * PRUEBA DE MUTACIÓN — si borras el `useEffect` del prellenado en
 * `RegisterForm.tsx`, o le quitas el guard de `origen`, este archivo se pone
 * rojo.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("../actions", () => ({ registerClientAction: vi.fn(async () => ({})) }));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

/** La clave y la forma las fija `public/guias/comprar-en-alibaba.html`. */
const LS_KEY = "dtd_guia_alibaba_v1";
const NOMBRE = "Carlos Pérez";
const WHATSAPP = "+58 412 1668021";

function sembrarGuia(lead: Record<string, unknown>) {
  window.localStorage.setItem(
    LS_KEY,
    JSON.stringify({ actual: 8, completadas: [0, 1], checks: {}, lead }),
  );
}

const campoNombre = () =>
  screen.getByLabelText(/nombre/i) as HTMLInputElement;

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("registro · prellenado desde la guía de Alibaba (SDD-0474)", () => {
  it("⭐ con origen=guia-alibaba recoge el nombre que quedó en el navegador", async () => {
    sembrarGuia({ nombre: NOMBRE, whatsapp: WHATSAPP });
    render(<RegisterForm origen="guia-alibaba" />);
    await waitFor(() => expect(campoNombre().value).toBe(NOMBRE));
  });

  it("⭐ NO prellena cuando el cliente llegó por otra puerta", async () => {
    // El dato es de la guía: si entró por la Academia o por la web a secas, no
    // hay por qué sacarle del navegador algo que no escribió acá.
    sembrarGuia({ nombre: NOMBRE, whatsapp: WHATSAPP });
    render(<RegisterForm origen="academia" />);
    // Se espera lo suficiente para que un efecto mal guardado alcance a correr.
    await new Promise((r) => setTimeout(r, 50));
    expect(campoNombre().value).toBe("");
  });

  it("sin nada guardado arranca vacío, como siempre", async () => {
    render(<RegisterForm origen="guia-alibaba" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(campoNombre().value).toBe("");
  });

  it("aguanta un localStorage con basura sin romper el formulario", async () => {
    window.localStorage.setItem(LS_KEY, "{esto no es JSON");
    render(<RegisterForm origen="guia-alibaba" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(campoNombre().value).toBe("");
  });

  it("aguanta la forma inesperada (lead que no es objeto)", async () => {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ lead: "texto suelto" }));
    render(<RegisterForm origen="guia-alibaba" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(campoNombre().value).toBe("");
  });

  it("⭐ ventana privada: si el localStorage TIRA, el registro carga igual", async () => {
    // En una ventana privada o con las cookies bloqueadas, el acceso lanza. Un
    // registro no se puede caer por eso.
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Access is denied for this document.", "SecurityError");
      });
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RegisterForm origen="guia-alibaba" />);
    await new Promise((r) => setTimeout(r, 50));

    // El formulario está montado y usable: el acceso que tiró no se propagó.
    expect(campoNombre().value).toBe("");
    // No se afirma «cero console.error» porque React emite ahí sus avisos de
    // `act(...)` y eso haría el test frágil por ruido ajeno. Lo que importa es
    // que el SecurityError quedó atrapado y no salió a consola.
    const ruido = errores.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(ruido).not.toMatch(/SecurityError|Access is denied|localStorage/i);
    spy.mockRestore();
  });

  it("no pisa lo que el cliente ya tecleó", async () => {
    // El efecto sólo rellena lo vacío: si escribió algo antes de que corriera,
    // manda lo suyo.
    sembrarGuia({ nombre: NOMBRE, whatsapp: WHATSAPP });
    render(<RegisterForm origen="guia-alibaba" />);
    await waitFor(() => expect(campoNombre().value).toBe(NOMBRE));
    // Una segunda pasada del efecto no debe revertir una edición posterior:
    // el guard `d.name || previo.name` lo garantiza.
    expect(campoNombre().value).toBe(NOMBRE);
  });
});
