/**
 * SDD-0648, D8 (Sam, 2026-11-17: «Sí, que no se cierre»): la ficha del CRM no
 * se cierra con un clic fuera; solo con su botón «Cerrar» o con Escape, y el
 * foco vuelve a lo que la abrió.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";

vi.mock("../tarjeta-actions", () => ({
  cargarFichaTarjetaAction: vi.fn(async () => ({ error: "Ficha de prueba sin datos." })),
  agregarNotaTarjetaAction: vi.fn(),
  agregarTareaTarjetaAction: vi.fn(),
  cambiarDuenoTarjetaAction: vi.fn(),
  completarTareaTarjetaAction: vi.fn(),
}));

const { TarjetaFichaDrawer } = await import("./TarjetaFichaDrawer");

afterEach(cleanup);

function ConFicha() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)}>
        Abrir ficha de Lead
      </button>
      {abierta && (
        <TarjetaFichaDrawer
          tarjetaId="t-1"
          etapas={[]}
          canEdit={false}
          onClose={() => setAbierta(false)}
          onCambio={vi.fn()}
        />
      )}
    </>
  );
}

const fondo = () => screen.getByRole("dialog").parentElement as HTMLElement;

describe("TarjetaFichaDrawer · D8: no se cierra con un clic fuera (SDD-0648)", () => {
  it("un clic en el fondo no la cierra", async () => {
    const user = userEvent.setup();
    render(<ConFicha />);
    await user.click(screen.getByRole("button", { name: "Abrir ficha de Lead" }));
    await user.click(fondo());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("Escape la cierra y el foco vuelve al disparador", async () => {
    const user = userEvent.setup();
    render(<ConFicha />);
    const disparador = screen.getByRole("button", { name: "Abrir ficha de Lead" });
    await user.click(disparador);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(disparador);
  });

  it("el botón «Cerrar» la cierra y el foco vuelve al disparador", async () => {
    const user = userEvent.setup();
    render(<ConFicha />);
    const disparador = screen.getByRole("button", { name: "Abrir ficha de Lead" });
    await user.click(disparador);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(disparador);
  });
});

describe("DrawerShell · closeOnBackdrop", () => {
  it("por defecto un clic en el fondo cierra, como siempre (los demás drawers no cambian)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DrawerShell title="Otro drawer" onClose={onClose} pending={false}>
        contenido
      </DrawerShell>,
    );
    await user.click(fondo());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con closeOnBackdrop={false} el fondo no cierra, pero Escape sí", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DrawerShell title="Ficha" onClose={onClose} pending={false} closeOnBackdrop={false}>
        contenido
      </DrawerShell>,
    );
    await user.click(fondo());
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
