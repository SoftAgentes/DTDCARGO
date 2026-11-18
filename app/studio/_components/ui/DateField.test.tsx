import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateField } from "./DateField";

/**
 * Interacción de <DateField> (SDD-0660): escribir dígitos, barras solas, T, + y −,
 * Alt+↓, pegar, borrar, fecha imposible y sincronía con el calendario.
 */

function hidden(container: HTMLElement, name: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  if (!el) throw new Error(`sin campo oculto ${name}`);
  return el;
}

function setup(props: Partial<React.ComponentProps<typeof DateField>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <form data-testid="form">
      <label htmlFor="f">Fecha de pago</label>
      <DateField id="f" name="paid_at" onChange={onChange} {...props} />
    </form>,
  );
  const input = screen.getByLabelText("Fecha de pago") as HTMLInputElement;
  return { ...utils, input, onChange, user: userEvent.setup() };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 11:00 del 18 de noviembre en Caracas, sea cual sea la zona del equipo que corre la prueba.
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("<DateField> · escribir", () => {
  it("los números seguidos se llenan con barras y viajan en ISO", async () => {
    const { input, container, onChange, user } = setup();
    await user.type(input, "18112026");
    expect(input).toHaveValue("18/11/2026");
    expect(hidden(container, "paid_at")).toHaveValue("2026-11-18");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-18");
  });

  it("el formato se ve en gris y se va llenando", async () => {
    const { input, container, user } = setup();
    const ghost = container.querySelector(".studio-date-field__ghost")!;
    expect(ghost.textContent).toBe("dd/mm/aaaa");
    await user.type(input, "18");
    expect(ghost.textContent).toBe("18/mm/aaaa");
    await user.type(input, "1");
    expect(input).toHaveValue("18/1");
    expect(ghost.textContent).toBe("18/1m/aaaa");
  });

  it("mientras está incompleta no viaja nada", async () => {
    const { input, container, onChange, user } = setup();
    await user.type(input, "1811");
    expect(hidden(container, "paid_at")).toHaveValue("");
    // Como el nativo, solo avisa cuando el valor cambia: a medio escribir no hay aviso por tecla.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("de una fecha válida a una incompleta avisa una sola vez con vacío", async () => {
    const { input, onChange, user } = setup({ defaultValue: "2026-11-18" });
    await user.type(input, "{Backspace}{Backspace}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("las letras que no son atajo no se escriben", async () => {
    const { input, user } = setup();
    await user.type(input, "1x8");
    expect(input).toHaveValue("18");
  });

  it("borrar deja el campo vacío y el valor en blanco", async () => {
    const { input, container, user } = setup({ defaultValue: "2026-11-18" });
    expect(input).toHaveValue("18/11/2026");
    await user.clear(input);
    expect(input).toHaveValue("");
    expect(hidden(container, "paid_at")).toHaveValue("");
  });

  it("pegar una fecha en ISO o con barras la normaliza", async () => {
    const { input, container, user } = setup();
    await user.click(input);
    await user.paste("2026-11-18");
    expect(input).toHaveValue("18/11/2026");
    expect(hidden(container, "paid_at")).toHaveValue("2026-11-18");
    await user.clear(input);
    await user.paste("1/2/2026");
    expect(input).toHaveValue("01/02/2026");
  });
});

describe("<DateField> · fecha inválida", () => {
  it("31/02 no se corrige: se explica y bloquea el envío", async () => {
    const { input, container, user } = setup();
    await user.type(input, "31022026");
    expect(input).toHaveValue("31/02/2026");
    expect(hidden(container, "paid_at")).toHaveValue("");
    expect(input.checkValidity()).toBe(false);
    await user.tab();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ese día no existe: febrero de 2026 tiene 28 días.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("incompleta al salir pide completarla", async () => {
    const { input, user } = setup();
    await user.type(input, "1811");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Completa la fecha: dd/mm/aaaa.");
  });

  it("al corregirla el error se va", async () => {
    const { input, user } = setup();
    await user.type(input, "31022026");
    await user.tab();
    await user.clear(input);
    await user.type(input, "28022026");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.checkValidity()).toBe(true);
  });
});

describe("<DateField> · atajos", () => {
  it("T pone hoy", async () => {
    const { input, container, user } = setup();
    await user.type(input, "t");
    expect(input).toHaveValue("18/11/2026");
    expect(hidden(container, "paid_at")).toHaveValue("2026-11-18");
  });

  it("+ y − mueven un día, cruzando el mes", async () => {
    const { input, user } = setup({ defaultValue: "2026-11-30" });
    await user.type(input, "+");
    expect(input).toHaveValue("01/12/2026");
    await user.type(input, "--");
    expect(input).toHaveValue("29/11/2026");
  });

  it("+ sin fecha arranca en hoy", async () => {
    const { input, user } = setup();
    await user.type(input, "+");
    expect(input).toHaveValue("18/11/2026");
  });

  it("+ no se sale del máximo", async () => {
    const { input, user } = setup({ defaultValue: "2026-11-18", max: "2026-11-18" });
    await user.type(input, "+");
    expect(input).toHaveValue("18/11/2026");
  });

  it("en meses, + y − mueven un mes", async () => {
    const { input, container, user } = setup({ mode: "month", defaultValue: "2026-12" });
    await user.type(input, "+");
    expect(input).toHaveValue("01/2027");
    expect(hidden(container, "paid_at")).toHaveValue("2027-01");
  });
});

describe("<DateField> · calendario", () => {
  it("Alt+↓ abre el calendario en la fecha escrita, con el foco en ese día", async () => {
    const { input, user } = setup({ defaultValue: "2026-11-18" });
    await user.click(input);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("noviembre de 2026");
    const day = within(dialog).getByRole("button", { name: /18 de noviembre de 2026/ });
    expect(day).toHaveFocus();
    expect(day.closest("td")).toHaveAttribute("aria-selected", "true");
  });

  it("flechas e Intro eligen y el foco vuelve al campo", async () => {
    const { input, container, user } = setup({ defaultValue: "2026-11-18" });
    await user.click(input);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await user.keyboard("{ArrowRight}");
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(input).toHaveValue("26/11/2026");
    expect(hidden(container, "paid_at")).toHaveValue("2026-11-26");
    expect(input).toHaveFocus();
  });

  it("RePág cambia de mes", async () => {
    const { input, user } = setup({ defaultValue: "2026-01-31" });
    await user.click(input);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("heading")).toHaveTextContent("febrero de 2026");
  });

  it("Escape cierra sin cambiar y devuelve el foco", async () => {
    const { input, user } = setup({ defaultValue: "2026-11-18" });
    await user.click(input);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await user.keyboard("{ArrowRight}{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(input).toHaveValue("18/11/2026");
    expect(input).toHaveFocus();
  });

  it("el botón del campo lo abre y un clic en un día lo elige", async () => {
    const { input, user } = setup();
    await user.click(screen.getByRole("button", { name: "Abrir calendario" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^5 de noviembre de 2026/ }));
    expect(input).toHaveValue("05/11/2026");
  });

  it("los días fuera de rango no se eligen", async () => {
    const { input, user } = setup({ min: "2026-11-10" });
    await user.click(screen.getByRole("button", { name: "Abrir calendario" }));
    const day = screen.getByRole("button", { name: /^5 de noviembre de 2026/ });
    expect(day).toHaveAttribute("aria-disabled", "true");
    await user.click(day);
    expect(input).toHaveValue("");
  });

  it("selector de mes: elegir un mes lo escribe", async () => {
    const { input, container, user } = setup({ mode: "month" });
    await user.click(screen.getByRole("button", { name: "Abrir selector de mes" }));
    expect(screen.getByRole("heading")).toHaveTextContent("2026");
    await user.click(screen.getByRole("button", { name: /^marzo de 2026/ }));
    expect(input).toHaveValue("03/2026");
    expect(hidden(container, "paid_at")).toHaveValue("2026-03");
  });

  it("el doble clic NO abre el calendario (queda para seleccionar texto)", async () => {
    const { input, user } = setup({ defaultValue: "2026-11-18" });
    await user.dblClick(input);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("<DateField> · accesibilidad y control", () => {
  it("el formato se anuncia con aria-describedby y se suma a la ayuda propia", () => {
    render(
      <>
        <span id="ayuda">Día en que llegó el pago</span>
        <DateField aria-label="Fecha" aria-describedby="ayuda" />
      </>,
    );
    const input = screen.getByLabelText("Fecha");
    expect(input).toHaveAccessibleDescription(/Día en que llegó el pago Formato día, mes y año: dd\/mm\/aaaa/);
  });

  it("required vacío bloquea el envío", () => {
    const { input } = setup({ required: true });
    expect(input.checkValidity()).toBe(false);
    fireEvent.invalid(input);
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe una fecha.");
  });

  it("controlado: el padre cambia la fecha y el campo la muestra", async () => {
    function Padre() {
      const [v, setV] = useState("2026-11-18");
      return (
        <>
          <DateField aria-label="Desde" value={v} onChange={setV} />
          <button type="button" onClick={() => setV("2026-01-05")}>
            Enero
          </button>
          <output>{v || "vacío"}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Padre />);
    const input = screen.getByLabelText("Desde");
    await user.click(screen.getByRole("button", { name: "Enero" }));
    expect(input).toHaveValue("05/01/2026");
    // Mientras se escribe, el "" que devuelve el padre no borra lo escrito.
    await user.clear(input);
    await user.type(input, "0102");
    expect(input).toHaveValue("01/02");
    expect(screen.getByRole("status")).toHaveTextContent("vacío");
    await user.type(input, "2026");
    expect(screen.getByRole("status")).toHaveTextContent("2026-02-01");
  });
});
