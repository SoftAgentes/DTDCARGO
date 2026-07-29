import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { DrawerShell } from "./drawer/DrawerShell";

const originalOffsetParent = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetParent",
);

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});

afterAll(() => {
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
  }
});

afterEach(() => cleanup());

describe("ConfirmDialog · AVS-01", () => {
  it("en un diálogo destructivo enfoca Cancelar", () => {
    render(
      <ConfirmDialog
        open
        danger
        title="Eliminar registro"
        message="No se puede deshacer."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("permite configurar el foco inicial no destructivo", () => {
    render(
      <ConfirmDialog
        open
        title="Continuar"
        message="Revisa los datos."
        initialFocus="confirm"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
  });

  it("mantiene Tab dentro del diálogo", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        danger
        title="Eliminar"
        message="Confirma."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("Escape cierra cuando no procesa y pending bloquea cierre y confirmación", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="Confirmar"
        message="Mensaje"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    rerender(
      <ConfirmDialog
        open
        pending
        title="Confirmar"
        message="Mensaje"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.submit(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
  });

  it("en un drawer, Escape y Tab pertenecen solo a la confirmación superior", async () => {
    const user = userEvent.setup();
    const onDrawerClose = vi.fn();
    const onConfirmClose = vi.fn();
    render(
      <DrawerShell title="Editar ruta" pending={false} onClose={onDrawerClose}>
        <button type="button">Control del drawer</button>
        <ConfirmDialog
          open
          danger
          title="Eliminar ruta"
          message="Confirma la operación."
          onCancel={onConfirmClose}
          onConfirm={() => {}}
        />
      </DrawerShell>,
    );

    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onConfirmClose).toHaveBeenCalledTimes(1);
    expect(onDrawerClose).not.toHaveBeenCalled();
  });

  it("restaura el foco al control que abrió el diálogo", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Abrir</button>
          <ConfirmDialog
            open={open}
            danger
            title="Eliminar"
            message="Mensaje"
            onCancel={() => setOpen(false)}
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(opener).toHaveFocus();
  });

  it("impide confirmar un motivo requerido vacío", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        reason
        reasonRequired
        title="Anular"
        message="Indica el motivo."
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const input = screen.getByRole("textbox", { name: /motivo/i });
    fireEvent.submit(screen.getByRole("dialog"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "Duplicado" } });
    fireEvent.submit(screen.getByRole("dialog"));
    expect(onConfirm).toHaveBeenCalledWith("Duplicado");
  });

  it("genera IDs accesibles únicos con varios diálogos montados", () => {
    render(
      <>
        <ConfirmDialog open title="Primero" message="Descripción uno" onCancel={() => {}} onConfirm={() => {}} />
        <ConfirmDialog open title="Segundo" message="Descripción dos" onCancel={() => {}} onConfirm={() => {}} />
      </>,
    );
    const dialogs = screen.getAllByRole("dialog");
    const labelledBy = dialogs.map((dialog) => dialog.getAttribute("aria-labelledby"));
    const describedBy = dialogs.map((dialog) => dialog.getAttribute("aria-describedby"));
    expect(new Set(labelledBy).size).toBe(2);
    expect(new Set(describedBy).size).toBe(2);
    for (const dialog of dialogs) {
      expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)).not.toBeNull();
      expect(document.getElementById(dialog.getAttribute("aria-describedby")!)).not.toBeNull();
    }
  });
});
