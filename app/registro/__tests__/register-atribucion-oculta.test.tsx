/**
 * SDD-0587 (6.4) · los UTM viajan en el formulario sin que quien se registra vea
 * nada distinto: campos ocultos y solo los que llegaron.
 *
 * Se prueba aquí y no a mano porque `/registro` no arranca sin credenciales de
 * Supabase, y este worktree no las tiene a propósito.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("../actions", () => ({ registerClientAction: vi.fn(async () => ({})) }));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

const campo = (c: HTMLElement, nombre: string) => c.querySelector<HTMLInputElement>(`input[name="${nombre}"]`);

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("registro · atribución oculta (SDD-0587)", () => {
  it("cada UTM que llegó viaja en un campo oculto", () => {
    const { container } = render(<RegisterForm atribucion={{ utm_source: "facebook", utm_term: "carga china" }} />);
    expect(campo(container, "utm_source")?.type).toBe("hidden");
    expect(campo(container, "utm_source")?.value).toBe("facebook");
    expect(campo(container, "utm_term")?.type).toBe("hidden");
    expect(campo(container, "utm_term")?.value).toBe("carga china");
  });

  it("el que no llegó no se pinta", () => {
    const { container } = render(<RegisterForm atribucion={{ utm_source: "facebook" }} />);
    expect(campo(container, "utm_medium")).toBeNull();
  });

  it("sin atribución el formulario es el de siempre: el mismo texto y ningún campo de más", () => {
    const sin = render(<RegisterForm />);
    const textoSin = sin.container.textContent;
    const camposSin = sin.container.querySelectorAll("input").length;
    expect(sin.container.querySelector('input[name^="utm_"]')).toBeNull();
    cleanup();

    const con = render(<RegisterForm atribucion={{ utm_source: "facebook", utm_campaign: "lanzamiento" }} />);
    expect(con.container.textContent).toBe(textoSin);
    expect(con.container.querySelectorAll('input:not([type="hidden"])').length).toBe(
      con.container.querySelectorAll("input").length - con.container.querySelectorAll('input[type="hidden"]').length,
    );
    expect(con.container.querySelectorAll("input").length).toBe(camposSin + 2);
  });
});
