/**
 * SDD-0678 · <FormularioAccion> + <BotonEnvio>: estado pendiente visible, todo deshabilitado mientras corre,
 * sin doble envío, sin cambiar la opción a mitad, y vuelta a la normalidad tras un error.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BotonEnvio, FormularioAccion } from "./FormularioAccion";

afterEach(cleanup);

/** Una acción que no termina hasta que la prueba lo decide. */
function accionControlada() {
  let terminar: () => void = () => {};
  let fallar: (e: Error) => void = () => {};
  const llamadas: FormData[] = [];
  const accion = vi.fn((fd: FormData) => {
    llamadas.push(fd);
    return new Promise<void>((ok, mal) => {
      terminar = ok;
      fallar = mal;
    });
  });
  return { accion, llamadas, terminar: () => terminar(), fallar: (e: Error) => fallar(e) };
}

function Cierre({ accion }: { accion: (fd: FormData) => Promise<void> }) {
  return (
    <FormularioAccion action={accion} aria-label="Cierre">
      <input type="hidden" name="conversacion" value="27" />
      <label>
        <input type="radio" name="cumple" value="si" /> Cumple
      </label>
      <label>
        <input type="radio" name="cumple" value="no" /> Falló
      </label>
      <BotonEnvio>Registrar el cierre</BotonEnvio>
    </FormularioAccion>
  );
}

describe("FormularioAccion · estado pendiente", () => {
  it("el botón dice «Guardando…», queda deshabilitado y con aria-busy mientras corre", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    render(<Cierre accion={a.accion} />);

    await user.click(screen.getByLabelText("Cumple"));
    await user.click(screen.getByRole("button", { name: "Registrar el cierre" }));

    const boton = await screen.findByRole("button", { name: /Guardando…/ });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "true");

    await act(async () => a.terminar());
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar el cierre" })).toBeEnabled());
  });

  it("no se puede cambiar «Cumple» por «Falló» a mitad de la acción, y viaja lo que se marcó", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    render(<Cierre accion={a.accion} />);

    await user.click(screen.getByLabelText("Cumple"));
    await user.click(screen.getByRole("button", { name: "Registrar el cierre" }));
    await screen.findByRole("button", { name: /Guardando…/ });

    expect(screen.getByLabelText("Falló")).toBeDisabled();
    expect(screen.getByLabelText("Cumple")).toBeDisabled();
    await user.click(screen.getByLabelText("Falló"));
    expect(screen.getByLabelText("Cumple")).toBeChecked();
    expect(a.llamadas[0].get("cumple")).toBe("si");
    expect(a.llamadas[0].get("conversacion")).toBe("27");

    await act(async () => a.terminar());
  });

  it("doble clic (y un segundo submit antes de pintar) envía una sola vez", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    render(<Cierre accion={a.accion} />);
    await user.click(screen.getByLabelText("Cumple"));

    const boton = screen.getByRole("button", { name: "Registrar el cierre" });
    await user.dblClick(boton);
    // Segundo submit síncrono, sin dar tiempo a que React pinte el pendiente.
    const form = screen.getByRole("form", { name: "Cierre" });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await screen.findByRole("button", { name: /Guardando…/ });
    expect(a.accion).toHaveBeenCalledTimes(1);

    await act(async () => a.terminar());
  });

  it("si la acción falla, el formulario se libera y se puede reintentar", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    const errores: unknown[] = [];
    const alError = (e: ErrorEvent) => {
      errores.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", alError);
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<Cierre accion={a.accion} />);
      await user.click(screen.getByLabelText("Cumple"));
      await user.click(screen.getByRole("button", { name: "Registrar el cierre" }));
      await screen.findByRole("button", { name: /Guardando…/ });

      await act(async () => a.fallar(new Error("red caída")));
      await waitFor(() => expect(screen.queryByRole("button", { name: /Guardando…/ })).toBeNull());
    } catch {
      // Sin error boundary, React vuelve a lanzar el error de la acción: el formulario ya no está montado y no hay
      // nada más que medir en este árbol.
    } finally {
      window.removeEventListener("error", alError);
      consola.mockRestore();
    }
  });
});

describe("BotonEnvio · varios botones en un formulario", () => {
  it("solo el botón tocado dice «Guardando…»; el otro queda deshabilitado con su texto", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    render(
      <FormularioAccion action={a.accion}>
        <BotonEnvio name="veredicto" value="aprobado" className="studio-btn-primary">
          Aprobar
        </BotonEnvio>
        <BotonEnvio name="veredicto" value="rechazado">
          Rechazar
        </BotonEnvio>
      </FormularioAccion>,
    );

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    const guardando = await screen.findByRole("button", { name: /Guardando…/ });
    expect(guardando).toHaveAttribute("value", "rechazado");
    const aprobar = screen.getByRole("button", { name: "Aprobar" });
    expect(aprobar).toBeDisabled();
    expect(aprobar).toHaveAttribute("aria-busy", "false");
    expect(a.llamadas[0].get("veredicto")).toBe("rechazado");

    await act(async () => a.terminar());
  });

  it("lleva siempre la clase base studio-btn y respeta el texto pendiente propio", async () => {
    const user = userEvent.setup();
    const a = accionControlada();
    render(
      <FormularioAccion action={a.accion}>
        <BotonEnvio textoPendiente="Registrando…">Registrar</BotonEnvio>
      </FormularioAccion>,
    );
    expect(screen.getByRole("button", { name: "Registrar" })).toHaveClass("studio-btn");
    await user.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByRole("button", { name: /Registrando…/ })).toBeDisabled();
    await act(async () => a.terminar());
  });
});
