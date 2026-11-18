/**
 * SDD-0603 · tramo 5b: la cuenta postable se abre con un control real,
 * «Abrir», que es la única parada de teclado de la fila y dice qué abre. El
 * nombre sigue abriendo con el ratón. Las cuentas de grupo no se abren.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/studio/account-types";

vi.mock("../_components/AccountDrawer", () => ({
  AccountDrawer: ({ account }: { account?: Account }) => (
    <div role="dialog" aria-label={`Cuenta ${account?.code ?? "nueva"}`} />
  ),
}));

import { PlanCuentasTab } from "../_components/PlanCuentasTab";

const cuenta = (id: string, code: string, name: string, parent_id: string | null, is_postable: boolean): Account => ({
  id, tenant_id: "t", code, name, type: "A", parent_id, qbo_type: null, subtype: null,
  is_postable, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const CUENTAS = [
  cuenta("g", "1", "Activo", null, false),
  cuenta("a", "1.1", "Caja de prueba", "g", true),
  cuenta("b", "1.2", "Banco de prueba", "g", true),
];

const pintar = () =>
  render(
    <PlanCuentasTab accounts={CUENTAS} balances={{}} showCreate={false} onOpenCreate={() => {}} onCloseCreate={() => {}} />,
  );

afterEach(cleanup);

describe("PlanCuentasTab · «Abrir» en la cuenta (SDD-0603, tramo 5b)", () => {
  it("cada cuenta postable trae «Abrir» como secundario de tabla; el grupo no", () => {
    pintar();
    const botones = screen.getAllByRole("button", { name: /^Abrir cuenta / });
    expect(botones.map((b) => b.getAttribute("aria-label"))).toEqual(["Abrir cuenta 1.1", "Abrir cuenta 1.2"]);
    for (const b of botones) {
      expect(b.textContent).toBe("Abrir");
      expect(b.className.split(" ")).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]),
      );
      expect(b.tabIndex).toBe(0);
    }
    expect(screen.queryByRole("button", { name: "Abrir cuenta 1" })).toBeNull();
  });

  it("el nombre sigue abriendo con el ratón, pero sale del Tab", () => {
    pintar();
    const nombre = screen.getByRole("button", { name: "Caja de prueba" });
    expect(nombre.tabIndex).toBe(-1);
    fireEvent.click(nombre);
    expect(screen.getByRole("dialog", { name: "Cuenta 1.1" })).toBeTruthy();
  });

  it("«Abrir» abre la misma cuenta que el nombre", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: "Abrir cuenta 1.2" }));
    expect(screen.getByRole("dialog", { name: "Cuenta 1.2" })).toBeTruthy();
  });

  it("el encabezado y las filas tienen las mismas columnas", () => {
    const { container } = pintar();
    const fila = container.querySelector('[data-row-id="1.1"]') as HTMLElement;
    const cabecera = screen.getByText("Cuenta").parentElement as HTMLElement;
    expect(fila.style.gridTemplateColumns).toBe(cabecera.style.gridTemplateColumns);
    expect(cabecera.style.gridTemplateColumns.endsWith(" 92px")).toBe(true);
    expect(cabecera.children).toHaveLength(fila.children.length);
  });

  it("colapsar mide 32 px de blanco (nada pulsable por debajo de 32 px)", () => {
    pintar();
    const colapsar = screen.getByRole("button", { name: "Colapsar" });
    expect(colapsar.style.width).toBe("32px");
    expect(colapsar.style.height).toBe("32px");
  });
});
