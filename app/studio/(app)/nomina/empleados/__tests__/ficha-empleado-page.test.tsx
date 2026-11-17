/**
 * SDD-0652 F1 · la página de la ficha del empleado.
 *
 * Se monta la página real con las lecturas dobladas. El control de rol es el
 * real (`getFichaEmpleadoAccess`), con `getStudioAccess` doblado, y `accesoDe`
 * también es real, con un cliente admin falso. Lo que se mide:
 *   - sin rol admin/accounting en el tenant → 404 **sin leer la ficha**;
 *   - la ficha se busca en el tenant de la membresía;
 *   - no existe → 404; error de lectura → «No se pudo cargar», no 404;
 *   - Contabilidad no recibe correo de acceso, rol ni la pestaña Acceso;
 *   - la cuenta llega enmascarada;
 *   - un bloque con error lo dice, y uno vacío dice su causa.
 * Datos sintéticos.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin" as string | null,
  tenantId: "t1" as string | null,
  lookup: { kind: "found" } as { kind: "found" | "not_found" | "error" },
  authUserId: "22222222-2222-2222-2222-222222222222" as string | null,
  prestamosFalla: false,
  lookups: [] as { tenantId: string; code: string }[],
  refreshes: 0,
  refresh: () => {},
}));
const { nada } = vi.hoisted(() => ({ nada: () => null }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ refresh: state.refresh }),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { role: "support", disabled_at: null, last_login_at: null }, error: null }),
    };
    return {
      from: () => chain,
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: "acceso-sintetico@example.test", last_sign_in_at: "2026-11-10T10:00:00Z" } },
            error: null,
          }),
        },
      },
    };
  },
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: async () => state.role,
  getStudioAccess: async () => ({
    role: state.role,
    tenantId: state.tenantId,
    userId: "u-mira",
    warehouseScope: "all",
    overrides: {},
    grants: {},
  }),
}));
vi.mock("@/lib/studio/rbac", () => ({ canEditModule: () => false }));
vi.mock("@/lib/studio/nomina/position-queries", () => ({ listPositions: async () => [] }));
vi.mock("@/lib/studio/nomina/employee-queries", () => ({
  getEmployeeByCode: async (_s: unknown, tenantId: string, code: string) => {
    state.lookups.push({ tenantId, code });
    if (state.lookup.kind !== "found") return state.lookup;
    return {
      kind: "found",
      employee: {
        id: "e1",
        tenant_id: "t1",
        employee_code: "EMP-0007",
        full_name: "Persona Sintética",
        national_id: "V-00000000",
        position_label: "Analista",
        department: "Operaciones",
        position_id: null,
        phone: null,
        email: "contacto-sintetico@example.test",
        salary_usd: 321,
        hire_date: "2026-01-15",
        birth_date: null,
        bank_name: "Banco de prueba",
        bank_account_type: "corriente",
        bank_account: "0102 0000 00 0000004321",
        status: "activo",
        notes: null,
        created_by: null,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        deleted_at: null,
        auth_user_id: state.authUserId,
      },
    };
  },
}));
vi.mock("@/lib/studio/nomina/ficha-empleado-queries", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/studio/nomina/ficha-empleado-queries")>();
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  return {
    ...orig,
    prestamosDe: async () => (state.prestamosFalla ? { ok: false as const } : ok([])),
    asistenciaDelMes: async () => ok([]),
    amonestacionesDe: async () => ok([]),
    recibosDe: async () => ok([]),
    finiquitosDe: async () =>
      ok([{ id: "s1", settlement_code: "LIQ-0001", termination_date: "2026-06-30", status: "anulado", created_at: "2026-07-02T00:00:00Z" }]),
    comunicacionesDe: async () => ok([]),
    cambioBancoPendiente: async () => ok(false),
  };
});
vi.mock("@/app/studio/(app)/usuarios/_components/acceso/ActividadAcceso", () => ({ ActividadAcceso: nada }));
vi.mock("@/app/studio/(app)/nomina/_components/EmpleadoDrawer", () => ({ EmpleadoDrawer: nada }));

import FichaEmpleadoPage from "../[codigo]/page";

beforeEach(() => {
  state.role = "admin";
  state.tenantId = "t1";
  state.lookup = { kind: "found" };
  state.authUserId = "22222222-2222-2222-2222-222222222222";
  state.prestamosFalla = false;
  state.lookups = [];
  state.refreshes = 0;
  state.refresh = () => {
    state.refreshes += 1;
  };
});
afterEach(cleanup);

async function montar(codigo = "EMP-0007") {
  const ui = await FichaEmpleadoPage({ params: Promise.resolve({ codigo }) });
  return render(ui);
}

describe("Ficha del empleado · quién entra (SDD-0652 F1)", () => {
  it.each([
    ["un acceso extra sin rol de Nómina", "commercial"],
    ["soporte (lectura propia de 0181)", "support"],
    ["sin membresía activa", null],
  ])("con %s responde 404 sin leer la ficha", async (_caso, role) => {
    state.role = role;
    await expect(montar()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.lookups).toEqual([]);
  });

  it("busca la ficha en el tenant de la membresía", async () => {
    await montar("emp-0007");
    expect(state.lookups).toEqual([{ tenantId: "t1", code: "emp-0007" }]);
  });

  it("si no existe, 404", async () => {
    state.lookup = { kind: "not_found" };
    await expect(montar()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("si la lectura falla, dice «No se pudo cargar» y no 404", async () => {
    state.lookup = { kind: "error" };
    await montar();
    expect(screen.getByText("No se pudo cargar la ficha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.refreshes).toBe(1);
  });
});

describe("Ficha del empleado · qué ve cada rol (SDD-0652 F1, D10)", () => {
  it("admin ve el correo de acceso, el rol y la pestaña Acceso", async () => {
    const { container } = await montar();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Persona Sintética");
    expect(container.textContent).toContain("acceso-sintetico@example.test");
    expect(container.textContent).toContain("contacto-sintetico@example.test");
    expect(screen.getByRole("tab", { name: "Acceso" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver ficha de usuario" }).getAttribute("href")).toBe(
      "/studio/usuarios?persona=22222222-2222-2222-2222-222222222222",
    );
  });

  it("Contabilidad no recibe correo de acceso, rol, último ingreso ni la pestaña Acceso", async () => {
    state.role = "accounting";
    const { container } = await montar();
    const html = container.innerHTML;
    expect(html).not.toContain("acceso-sintetico@example.test");
    expect(html).not.toContain("22222222-2222-2222-2222-222222222222");
    expect(html).not.toContain("Último ingreso");
    expect(screen.queryByRole("tab", { name: "Acceso" })).toBeNull();
    expect(container.textContent).toContain("Con acceso al Studio");
    expect(container.textContent).toContain("contacto-sintetico@example.test");
  });

  it("la cuenta bancaria llega enmascarada", async () => {
    const { container } = await montar();
    expect(container.innerHTML).not.toContain("0000004321");
    expect(container.textContent).toContain("•••• 4321");
  });

  it("sin cuenta enlazada dice «Sin cuenta» y no hay pestaña Acceso", async () => {
    state.authUserId = null;
    const { container } = await montar();
    expect(container.textContent).toContain("Sin cuenta");
    expect(screen.queryByRole("tab", { name: "Acceso" })).toBeNull();
  });
});

describe("Ficha del empleado · estados de los bloques (§5.3)", () => {
  it("un bloque vacío dice su causa y uno con error lo dice", async () => {
    let r = await montar();
    expect(r.container.textContent).toContain("No tiene préstamos.");
    cleanup();
    state.prestamosFalla = true;
    r = await montar();
    expect(r.container.textContent).toContain("No se pudo cargar este bloque.");
    expect(r.container.textContent).not.toContain("No tiene préstamos.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(state.refreshes).toBe(1);
  });

  it("la línea de tiempo muestra el finiquito anulado", async () => {
    await montar();
    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    expect(screen.getByText("Finiquito LIQ-0001 (anulado)")).toBeTruthy();
  });

  it("las pestañas se mueven con las flechas", async () => {
    await montar();
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    fireEvent.keyDown(resumen, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Línea de tiempo" }).getAttribute("aria-selected")).toBe("true");
  });
});
