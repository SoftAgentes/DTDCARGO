/**
 * SDD-0276 · `/entrar` ofrece DOS filas, y la de crear cuenta no es un enlace.
 *
 * Existe por un caso real medido el 2026-08-20. El login comprobaba si el correo
 * existía (`actions.ts`) pero respondía **igual** existiera o no —anti-enumeración
 * deliberada hasta la SDD-0672— y `shouldCreateUser: false` significa que nunca crea usuarios. O
 * sea: quien no tiene cuenta escribía su correo, leía "Te enviamos un enlace a
 * tu@correo", esperaba, y no le llegaba nada. La única salida hacia el registro
 * era un enlace de 12,5 px que además **desaparecía** en esa pantalla, que es
 * justo donde la persona se traba.
 *
 * Lo que este archivo protege, y por qué cada aserción:
 *  1. Las dos filas existen y se llaman como se acordó.
 *  2. Crear cuenta es un `.btn` de ancho completo, NO un enlace suelto — si
 *     vuelve a ser un link chiquito, esto se pone rojo.
 *  3. Ningún resultado de pedir el enlace es un callejón sin salida. Desde la
 *     SDD-0672 la pantalla dice qué pasó: quien no tiene cuenta ve «No encontramos
 *     una cuenta con este correo» con el botón de crear cuenta, y todos tienen
 *     «Probar con otro correo» y WhatsApp.
 *
 * PRUEBA DE MUTACIÓN — borrar `<CrearCuentaBoton primario />` de `ResultadoEntrar`
 * deja verde a (1) y (2) y rojo a (3): esa es la aserción que de verdad cubre el bug.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("../actions", () => ({
  requestMagicLink: vi.fn(async () => ({})),
}));
vi.mock("@/app/portal/actions", () => ({
  signOutAction: vi.fn(async () => {}),
}));

import { EntrarForm, ResultadoEntrar } from "../EntrarForm";

const props = { notice: null, authedNotBound: false };

/** El botón de crear cuenta, buscado por su rol y su nombre accesible. */
const crearCuenta = () =>
  screen.getByRole("link", { name: /crear mi cuenta/i });

beforeEach(() => cleanup());

describe("/entrar · las dos filas", () => {
  it("titula las dos puertas con las palabras acordadas", () => {
    render(<EntrarForm {...props} />);

    expect(
      screen.getByRole("heading", { name: /ingresar a mi portal/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /crear mi cuenta y shipping mark/i }),
    ).toBeTruthy();
  });

  it("mantiene el acceso por correo, sin contraseña (contrato SDD-0094)", () => {
    const { container } = render(<EntrarForm {...props} />);

    expect(container.querySelector('input[name="email"]')).toBeTruthy();
    expect(container.querySelectorAll('input[type="password"]').length).toBe(0);
  });

  it("ofrece crear cuenta como BOTÓN de ancho completo, no como enlace suelto", () => {
    render(<EntrarForm {...props} />);

    const boton = crearCuenta();
    expect(boton.getAttribute("href")).toBe("/registro");
    // `.btn` es la clase del sistema (48 px de alto); `w-full` es lo que lo
    // separa de un link inline. Las dos juntas son el pedido del founder:
    // "que no sea un botón pequeño".
    expect(boton.className).toContain("btn");
    expect(boton.className).toContain("w-full");
  });

  it("dice qué gana quien todavía no tiene cuenta", () => {
    render(<EntrarForm {...props} />);

    const fila = screen
      .getByRole("heading", { name: /crear mi cuenta y shipping mark/i })
      .closest("section");
    expect(fila).toBeTruthy();
    const items = within(fila!).getAllByRole("listitem");
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain("cajas");
  });

  it("una sola acción primaria en pantalla (BTN-01 §2)", () => {
    const { container } = render(<EntrarForm {...props} />);

    // "Envíame el enlace" es la primaria. Crear cuenta va en `btn-ghost`: su
    // peso sale del tamaño y del ancho, no de un segundo relleno vino.
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
    expect(crearCuenta().className).toContain("btn-ghost");
  });
});

describe("/entrar · ningún resultado es un callejón sin salida (SDD-0672)", () => {
  const base = {
    email: "sam@ejemplo.com",
    action: vi.fn(),
    pending: false,
    onOtroCorreo: vi.fn(),
  };

  it("«no encontramos una cuenta» ofrece crear cuenta como botón de ancho completo", () => {
    render(<ResultadoEntrar {...base} resultado="sin_cuenta" />);

    const boton = crearCuenta();
    expect(boton.getAttribute("href")).toBe("/registro");
    expect(boton.className).toContain("btn");
    expect(boton.className).toContain("w-full");
  });

  it("«no encontramos una cuenta» tiene una sola acción primaria (BTN-01 §2), y es crear la cuenta", () => {
    const { container } = render(<ResultadoEntrar {...base} resultado="sin_cuenta" />);

    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
    expect(crearCuenta().className).toContain("btn-primary");
  });

  it.each(["enlace", "crear_portal", "sin_portal", "sin_comprobar", "sin_cuenta"] as const)(
    "%s · deja siempre una salida: otro correo y WhatsApp",
    (resultado) => {
      render(<ResultadoEntrar {...base} resultado={resultado} />);

      expect(screen.getByRole("button", { name: /probar con otro correo/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /whatsapp/i })).toBeTruthy();
    },
  );

  it.each(["enlace", "crear_portal", "sin_portal", "sin_comprobar"] as const)(
    "%s · quien ya tiene cuenta no recibe la invitación a crear otra",
    (resultado) => {
      // Crear otra cuenta le daría un Shipping Mark nuevo y le partiría el
      // historial (SDD-0279): sólo se ofrece cuando no encontramos el correo.
      render(<ResultadoEntrar {...base} resultado={resultado} />);

      expect(screen.queryByRole("link", { name: /crear mi cuenta/i })).toBeNull();
    },
  );

  it("⭐ «crear_portal» (SDD-0672 entrega 2) dice sólo que salió el enlace, sin nada de la ficha", () => {
    const { container } = render(<ResultadoEntrar {...base} resultado="crear_portal" />);

    expect(screen.getByRole("heading", { name: /ya eres cliente/i })).toBeTruthy();
    expect(container.textContent).toMatch(/te mandamos un enlace/i);
    expect(container.textContent).toMatch(/24 horas/);
    // Ni el código ni qué datos se van a comprobar: eso lo dice la página del enlace.
    expect(container.textContent).not.toMatch(/DTD-\d|cédula|RIF/i);
  });
});
