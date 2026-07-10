/**
 * Tests de las primitivas de tabla accionable (rediseño ERP · Fase A).
 *
 * El corazón es el hallazgo #1 de `/ui-pro`: la fila debía volverse operable
 * por teclado (WCAG 2.1.1). Cubre: foco por Tab, activación con Enter y
 * Espacio, activación con click, que un control interactivo anidado NO
 * dispare la fila, nombre accesible, y que <TableFrame> exponga su scroll
 * horizontal propio (reflow).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableFrame, ActionableRow } from "./DataTable";

afterEach(cleanup);

function Row({
  onSelect,
  withButton,
}: {
  onSelect: () => void;
  withButton?: boolean;
}) {
  return (
    <TableFrame data-testid="frame">
      <table>
        <tbody>
          <ActionableRow onSelect={onSelect} label="Ver reclamo RC-0001">
            <td>RC-0001</td>
            <td>
              {withButton ? (
                <button type="button" onClick={vi.fn()}>
                  Borrar
                </button>
              ) : (
                "Ana"
              )}
            </td>
          </ActionableRow>
        </tbody>
      </table>
    </TableFrame>
  );
}

describe("ActionableRow", () => {
  it("expone la fila con nombre accesible y es enfocable por teclado", async () => {
    const user = userEvent.setup();
    render(<Row onSelect={vi.fn()} />);
    const row = screen.getByRole("row", { name: "Ver reclamo RC-0001" });
    expect(row).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(row).toHaveFocus();
  });

  it("activa con Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Row onSelect={onSelect} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("activa con Espacio", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Row onSelect={onSelect} />);
    await user.tab();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("activa con click en la fila", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Row onSelect={onSelect} />);
    await user.click(screen.getByText("RC-0001"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("un botón anidado NO dispara la selección de la fila", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Row onSelect={onSelect} withButton />);
    await user.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("TableFrame", () => {
  it("da a la tabla su propio scroll horizontal (reflow-safe)", () => {
    render(<Row onSelect={vi.fn()} />);
    const frame = screen.getByTestId("frame");
    expect(frame.style.overflowX).toBe("auto");
  });
});
