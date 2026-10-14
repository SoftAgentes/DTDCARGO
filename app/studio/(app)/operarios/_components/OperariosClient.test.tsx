/**
 * SDD-0515 · OperariosClient: cada fila dice por qué app entra el operario y
 * nombra su rol de verdad.
 *
 * El hallazgo del 2026-10-14: un operario de China intentaba entrar por la app
 * de Venezuela, donde su PIN no existe (verify_operario_pin compara dentro de
 * tenant + región), y la columna «Rol» mostraba «Operario» a un camionero y a
 * un bodeguero. Lo que se afirma:
 *  - la fila de un operario de China dice «Entra por dtdcargo.com/m/cn/login» y
 *    la de uno de Venezuela «…/m/ve/login», cada una sólo la suya;
 *  - la columna «Rol» muestra Operario, Supervisor, Bodeguero o Camionero.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";

vi.mock("../actions", () => ({
  createOperarioAction: vi.fn(),
  generateOperarioPinAction: vi.fn(),
  resetOperarioPinAction: vi.fn(),
  viewOperarioPinAction: vi.fn(),
  setOperarioActiveAction: vi.fn(),
  updateOperarioAction: vi.fn(),
}));

import { OperariosClient } from "./OperariosClient";

function operario(over: Partial<OperarioRow> & Pick<OperarioRow, "id" | "display_name" | "region" | "role">): OperarioRow {
  return {
    tenant_id: "10000000-0000-4000-8000-000000000001",
    warehouse_id: over.region === "cn" ? "30000000-0000-4000-8000-000000000001" : null,
    display_name_cn: null,
    active: true,
    last_login_at: null,
    created_at: "2026-05-26T00:00:00Z",
    warehouse_code: over.region === "cn" ? "YIW-A1" : null,
    warehouse_name_es: over.region === "cn" ? "Yiwu" : null,
    ...over,
  };
}

const ROWS: OperarioRow[] = [
  operario({ id: "50000000-0000-4000-8000-000000000001", display_name: "Ana China", region: "cn", role: "operario" }),
  operario({ id: "50000000-0000-4000-8000-000000000002", display_name: "Bruno Supervisor", region: "cn", role: "supervisor" }),
  operario({ id: "50000000-0000-4000-8000-000000000003", display_name: "Carla Bodega", region: "ve", role: "bodeguero" }),
  operario({ id: "50000000-0000-4000-8000-000000000004", display_name: "Diego Ruta", region: "ve", role: "camionero" }),
];

/** La fila de un operario: el contenedor de la grilla que tiene su nombre. */
function rowOf(name: string): HTMLElement {
  const nameCell = screen.getByText(name);
  const row = nameCell.closest<HTMLElement>("div[style*='grid']");
  if (!row) throw new Error(`sin fila para ${name}`);
  return row;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("OperariosClient · por qué app entra cada operario", () => {
  it.each([
    ["Ana China", "dtdcargo.com/m/cn/login", "/m/ve/login"],
    ["Bruno Supervisor", "dtdcargo.com/m/cn/login", "/m/ve/login"],
    ["Carla Bodega", "dtdcargo.com/m/ve/login", "/m/cn/login"],
    ["Diego Ruta", "dtdcargo.com/m/ve/login", "/m/cn/login"],
  ])("%s: «Entra por %s» y no la otra", (name, label, other) => {
    render(<OperariosClient operarios={ROWS} warehouses={[]} />);
    const row = rowOf(name);

    expect(within(row).getByText(label).parentElement).toHaveTextContent(`Entra por ${label}`);
    expect(row.textContent).not.toContain(other);
  });
});

describe("OperariosClient · columna «Rol»", () => {
  it.each([
    ["Ana China", "Operario"],
    ["Bruno Supervisor", "Supervisor"],
    ["Carla Bodega", "Bodeguero"],
    ["Diego Ruta", "Camionero"],
  ])("%s se muestra como %s", (name, label) => {
    render(<OperariosClient operarios={ROWS} warehouses={[]} />);
    const row = rowOf(name);

    expect(within(row).getByText(label)).toBeInTheDocument();
    if (label !== "Operario") expect(within(row).queryByText("Operario")).not.toBeInTheDocument();
  });
});
