import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientDetailPanel } from "../ClientDetailPanel";
import ErrorClientes from "../../@ficha/error";
import ErrorEmbarques from "../../../embarques/@ficha/error";
import NoDisponibleClientes from "../../@ficha/not-found";
import NoDisponibleEmbarques from "../../../embarques/@ficha/not-found";

const mocks = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: mocks.back }) }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Ficha lateral SDD-0715", () => {
  it("presenta diálogo, cierra con Escape y restaura foco", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const view = render(<ClientDetailPanel><p>Cliente ficticio</p></ClientDetailPanel>);
    expect(screen.getByRole("dialog", { name: "Ficha del cliente" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.back).toHaveBeenCalledOnce();
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
  it("volver al listado usa el historial de la lista", () => {
    render(<ClientDetailPanel><p>Nota ficticia autorizada</p></ClientDetailPanel>);
    fireEvent.click(screen.getByRole("link", { name: "Volver al listado" }));
    expect(mocks.back).toHaveBeenCalledOnce();
  });
  it("el botón cerrar vuelve y el fondo no descarta la ficha", () => {
    render(<ClientDetailPanel><p>Ficha ficticia</p></ClientDetailPanel>);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(mocks.back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.back).toHaveBeenCalledOnce();
  });
});

describe.each([
  { modulo: "Clientes", ErrorFicha: ErrorClientes, NoDisponible: NoDisponibleClientes, listado: "/studio/clientes" },
  { modulo: "Embarques", ErrorFicha: ErrorEmbarques, NoDisponible: NoDisponibleEmbarques, listado: "/studio/embarques" },
])("Recuperación local de $modulo · SDD-0715", ({ ErrorFicha, NoDisponible, listado }) => {
  it("error usa texto genérico, permite reintentar y conserva la salida al listado", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("DETALLE_INTERNO_FICTICIO"), { digest: "DIGEST_FICTICIO", stack: "STACK_FICTICIO" });
    const { container } = render(<ErrorFicha error={error} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar la ficha");
    expect(container).not.toHaveTextContent(/DETALLE_INTERNO_FICTICIO|DIGEST_FICTICIO|STACK_FICTICIO/);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
    const volver = screen.getByRole("link", { name: "Volver al listado" });
    expect(volver).toHaveAttribute("href", listado);
    fireEvent.click(volver);
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it("ficha no disponible no ofrece reintentar ni expone un cuerpo de datos", () => {
    render(<NoDisponible />);
    expect(screen.getByRole("status")).toHaveTextContent("Ficha no disponible");
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.getByRole("link", { name: "Volver al listado" })).toHaveAttribute("href", listado);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it("tras cerrar recuperación, vuelve el foco al filtro que quedó montado", () => {
    render(<input aria-label="Filtro ficticio de la lista" defaultValue="pendientes ficticios" />);
    const filtro = screen.getByRole("textbox", { name: "Filtro ficticio de la lista" });
    filtro.focus();
    const panel = render(<NoDisponible />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    panel.unmount();
    expect(filtro).toHaveFocus();
    expect(filtro).toHaveValue("pendientes ficticios");
  });
});
