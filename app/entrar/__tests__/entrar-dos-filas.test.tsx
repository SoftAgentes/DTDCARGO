/**
 * SDD-0276 · `/entrar` ofrece DOS filas, y la de crear cuenta no es un enlace.
 *
 * Existe por un caso real medido el 2026-08-20. El login comprueba si el correo
 * existe (`actions.ts`) pero responde **igual** exista o no —anti-enumeración
 * deliberada— y `shouldCreateUser: false` significa que nunca crea usuarios. O
 * sea: quien no tiene cuenta escribía su correo, leía "Te enviamos un enlace a
 * tu@correo", esperaba, y no le llegaba nada. La única salida hacia el registro
 * era un enlace de 12,5 px que además **desaparecía** en esa pantalla, que es
 * justo donde la persona se traba.
 *
 * Lo que este archivo protege, y por qué cada aserción:
 *  1. Las dos filas existen y se llaman como se acordó.
 *  2. Crear cuenta es un `.btn` de ancho completo, NO un enlace suelto — si
 *     vuelve a ser un link chiquito, esto se pone rojo.
 *  3. La salida está TAMBIÉN en el estado de pedido recibido. Sin esta tercera, el
 *     callejón sin salida vuelve en el próximo refactor sin que nadie se entere.
 *
 * PRUEBA DE MUTACIÓN — borrar `<CrearCuentaBoton />` de `MagicRequested` deja verde
 * a (1) y (2) y rojo sólo a (3): esa es la aserción que de verdad cubre el bug.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("../actions", () => ({
  requestMagicLink: vi.fn(async () => ({})),
}));
vi.mock("@/app/portal/actions", () => ({
  signOutAction: vi.fn(async () => {}),
}));

import { EntrarForm, MagicRequested } from "../EntrarForm";

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

describe("/entrar · el pedido recibido NO es un callejón sin salida", () => {
  const sent = {
    email: "sam@ejemplo.com",
    action: vi.fn(),
    pending: false,
  };

  it("sigue ofreciendo crear cuenta después de pedir el enlace", () => {
    render(<MagicRequested {...sent} />);

    const boton = crearCuenta();
    expect(boton.getAttribute("href")).toBe("/registro");
    expect(boton.className).toContain("btn");
    expect(boton.className).toContain("w-full");
  });

  it("explica por qué puede no llegar el correo", () => {
    render(<MagicRequested {...sent} />);

    expect(screen.getByText(/no te llega nada/i)).toBeTruthy();
  });

  it("el aviso se muestra SIEMPRE, así que no revela si el correo existe", () => {
    // Mismo componente, sin email: la salida no depende de ningún dato del
    // servidor. Si algún día se condicionara a "la cuenta no existe", estaría
    // filtrando justo lo que `actions.ts` se cuida de no decir.
    render(<MagicRequested {...sent} email="" />);

    expect(screen.getByText(/no te llega nada/i)).toBeTruthy();
    expect(crearCuenta()).toBeTruthy();
  });
});
