/**
 * SDD-0676 · «Vincular a cliente» en la Ficha DTD (componente de navegador).
 *
 * Lo que se prueba es lo que ve y hace el agente: busca, elige, confirma con el código y
 * el nombre a la vista, y un chat unido a otra ficha solo se mueve con un motivo escrito.
 * A las acciones llegan solo ids y lo que el agente escribió; nunca un dato del contacto.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buscar = vi.fn();
const vincular = vi.fn();
vi.mock("@/app/studio/(app)/bandeja/vincular-actions", () => ({
  buscarClientesParaVincular: (...args: unknown[]) => buscar(...args),
  vincularContactoDeConversacion: (...args: unknown[]) => vincular(...args),
}));

const { VincularCliente } = await import("../_components/VincularCliente");

const UNO = { id: "30000000-0000-4000-8000-000000000001", markbox: "DTD-0001", nombre: "SINT Uno", telefonoFinal: "0142", codigoAnterior: "VIEJO-01" };
const DOS = { id: "30000000-0000-4000-8000-000000000002", markbox: "DTD-0002", nombre: "SINT Dos", telefonoFinal: null, codigoAnterior: null };

function montar(onVinculado = vi.fn()) {
  render(<VincularCliente conversacionId={42} agenteId={3} onVinculado={onVinculado} />);
  return onVinculado;
}

async function abrirYBuscar(texto: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Vincular a cliente" }));
  await user.type(screen.getByLabelText("Buscar cliente"), texto);
  return user;
}

beforeEach(() => {
  buscar.mockReset().mockResolvedValue({ ok: true, clientes: [UNO, DOS] });
  vincular.mockReset().mockResolvedValue({ ok: true, resultado: "unido", tarjetaAbsorbida: true });
});
afterEach(cleanup);

describe("VincularCliente", () => {
  it("cerrado: solo el botón; no busca nada hasta que el agente escribe", () => {
    montar();
    expect(screen.getByRole("button", { name: "Vincular a cliente" })).toBeTruthy();
    expect(screen.queryByLabelText("Buscar cliente")).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });

  it("con menos de 3 caracteres no busca y lo dice", async () => {
    montar();
    await abrirYBuscar("DT");
    expect(screen.getByRole("status").textContent).toBe("Escribe al menos 3 caracteres.");
    await new Promise((r) => setTimeout(r, 400));
    expect(buscar).not.toHaveBeenCalled();
  });

  it("busca lo escrito (una vez, no por tecla) y pinta código, nombre y los últimos 4 dígitos", async () => {
    montar();
    await abrirYBuscar("DTD-00");
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("DTD-00");
    expect(screen.getByText("SINT Uno")).toBeTruthy();
    expect(screen.getByText("Teléfono termina en 0142 · Antes VIEJO-01")).toBeTruthy();
    expect(screen.getByText("Sin teléfono en la ficha")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("2 resultado(s). Elige uno.");
  });

  it("sin resultados y con error, lo dice", async () => {
    buscar.mockResolvedValueOnce({ ok: true, clientes: [] });
    montar();
    const user = await abrirYBuscar("nadie");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("No hay clientes con ese dato."));
    buscar.mockResolvedValueOnce({ ok: false, error: "denied" });
    await user.type(screen.getByLabelText("Buscar cliente"), "x");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Tu rol no puede vincular chats a clientes."));
  });

  it("elegir y confirmar: vincula con la conversación, el agente y la ficha, y avisa al terminar", async () => {
    const onVinculado = montar();
    const user = await abrirYBuscar("SINT");
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /DTD-0001/ }));

    // La confirmación dice a quién, y todavía no se vinculó nada.
    expect(screen.getByText("¿Vincular este chat a este cliente?")).toBeTruthy();
    expect(screen.getByText("DTD-0001")).toBeTruthy();
    expect(screen.getByText("SINT Uno")).toBeTruthy();
    expect(vincular).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(onVinculado).toHaveBeenCalledTimes(1));
    expect(vincular).toHaveBeenCalledTimes(1);
    expect(vincular).toHaveBeenCalledWith(42, 3, UNO.id, undefined);
  });

  it("«Elegir otro» vuelve a la lista sin vincular", async () => {
    montar();
    const user = await abrirYBuscar("SINT");
    await waitFor(() => expect(screen.getByText("DTD-0002")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /DTD-0002/ }));
    await user.click(screen.getByRole("button", { name: "Elegir otro" }));
    expect(screen.getByLabelText("Buscar cliente")).toBeTruthy();
    expect(vincular).not.toHaveBeenCalled();
  });

  it("chat unido a otra ficha: dice a cuál y solo mueve con un motivo escrito", async () => {
    vincular.mockResolvedValueOnce({ ok: false, error: "otra_ficha", otra: { markbox: "DTD-0900", nombre: "SINT Otra" } });
    const onVinculado = montar();
    const user = await abrirYBuscar("SINT");
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /DTD-0001/ }));
    await user.click(screen.getByRole("button", { name: "Vincular" }));

    await waitFor(() => expect(screen.getByText(/Este chat ya está unido a DTD-0900 · SINT Otra/)).toBeTruthy());
    expect(onVinculado).not.toHaveBeenCalled();
    const mover = screen.getByRole("button", { name: "Mover aquí" }) as HTMLButtonElement;
    expect(mover.disabled).toBe(true);

    await user.type(screen.getByLabelText("Motivo del cambio"), "Era de esta ficha");
    expect(mover.disabled).toBe(false);
    await user.click(mover);
    await waitFor(() => expect(onVinculado).toHaveBeenCalledTimes(1));
    expect(vincular).toHaveBeenLastCalledWith(42, 3, UNO.id, { mover: true, motivo: "Era de esta ficha" });
  });

  it("unido a una ficha que esta persona no ve: avisa sin decir a quién", async () => {
    vincular.mockResolvedValueOnce({ ok: false, error: "otra_ficha", otra: null });
    montar();
    const user = await abrirYBuscar("SINT");
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /DTD-0001/ }));
    await user.click(screen.getByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(screen.getByText(/Este chat ya está unido a otra ficha\. Si es un error/)).toBeTruthy());
  });

  it("un error del servidor se explica y no avisa que vinculó", async () => {
    vincular.mockResolvedValueOnce({ ok: false, error: "sin_acceso" });
    const onVinculado = montar();
    const user = await abrirYBuscar("SINT");
    await waitFor(() => expect(screen.getByText("DTD-0001")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /DTD-0001/ }));
    await user.click(screen.getByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(screen.getByText("No tienes acceso a esta conversación.")).toBeTruthy());
    expect(onVinculado).not.toHaveBeenCalled();
  });

  it("una respuesta vieja no pisa la de la búsqueda más nueva", async () => {
    let soltarVieja: (v: unknown) => void = () => undefined;
    buscar
      .mockImplementationOnce(() => new Promise((r) => (soltarVieja = r)))
      .mockResolvedValueOnce({ ok: true, clientes: [DOS] });
    montar();
    const user = await abrirYBuscar("SIN");
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Buscar cliente"), "T Dos");
    await waitFor(() => expect(screen.getByText("DTD-0002")).toBeTruthy());
    soltarVieja({ ok: true, clientes: [UNO] });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("DTD-0001")).toBeNull();
    expect(screen.getByText("DTD-0002")).toBeTruthy();
  });
});
