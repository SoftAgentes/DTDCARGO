// @vitest-environment node
/**
 * SDD-0652 fase 2 (N2) · `getRegistrationReviewAction`: lo que ve quien revisa
 * una solicitud de registro.
 *
 * La bandeja ya no trae la cédula ni la cuenta (`ficha-empleado-f2.test.ts`).
 * Aquí se mide la única vía por la que esos datos llegan al navegador: solo
 * rol admin o accounting activo, solo una solicitud del tenant de la membresía,
 * solo si está pendiente, y con la cuenta enmascarada. Datos sintéticos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "accounting" as string | null,
  viewDenial: null as string | null,
  fila: null as Record<string, unknown> | null,
  lecturas: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("../../usuarios/actions", () => ({ inviteUserAction: async () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  moduleViewDenial: async () => state.viewDenial,
  capabilityDenial: async () => null,
  getStudioAccess: async () => ({ role: state.role, tenantId: "t1", userId: "u-mira", warehouseScope: "all", overrides: {}, grants: {} }),
}));
vi.mock("@/lib/studio/nomina/registration-queries", () => ({
  getRegistration: async (_s: unknown, id: string) => {
    state.lecturas.push(id);
    return state.fila;
  },
}));

import { getRegistrationReviewAction } from "../actions";

const ID = "11111111-1111-1111-1111-111111111111";
const CUENTA = "0102 0000 00 0000009876";

beforeEach(() => {
  state.role = "accounting";
  state.viewDenial = null;
  state.lecturas = [];
  state.fila = {
    id: ID,
    tenant_id: "t1",
    invite_id: "i1",
    full_name: "Candidata Sintética",
    national_id: "V00000000",
    birth_date: "1990-05-05",
    phone: "0000-0000000",
    email: "candidata@example.test",
    cargo: "Analista",
    start_date: "2026-12-01",
    bank_name: "Banco de prueba",
    bank_account_type: "corriente",
    bank_account: CUENTA,
    status: "pendiente",
    reviewed_by: null,
    reviewed_at: null,
    employee_id: null,
    rejection_reason: null,
    created_at: "2026-11-17T00:00:00Z",
    updated_at: "2026-11-17T00:00:00Z",
  };
});

describe("getRegistrationReviewAction (SDD-0652 N2)", () => {
  it.each(["admin", "accounting"])("%s recibe la cédula y la cuenta enmascarada, nunca el número completo", async (role) => {
    state.role = role;
    const r = await getRegistrationReviewAction(ID);
    expect("ok" in r && r.registration).toEqual({
      id: ID,
      full_name: "Candidata Sintética",
      email: "candidata@example.test",
      status: "pendiente",
      created_at: "2026-11-17T00:00:00Z",
      national_id: "V00000000",
      phone: "0000-0000000",
      cargo: "Analista",
      start_date: "2026-12-01",
      bank_name: "Banco de prueba",
      bank_account_type: "corriente",
      bank_account_masked: "•••• 9876",
    });
    expect(JSON.stringify(r)).not.toContain("0000009876");
    expect(JSON.stringify(r)).not.toContain("1990-05-05");
  });

  it("si el módulo niega la vista, no se lee la solicitud", async () => {
    state.viewDenial = "No tienes acceso a Nómina.";
    expect(await getRegistrationReviewAction(ID)).toEqual({ error: "No tienes acceso a Nómina." });
    expect(state.lecturas).toEqual([]);
  });

  it.each(["commercial", "support", "operations", null])(
    "con rol %s (por ejemplo, un acceso extra a nomina) no se lee la solicitud",
    async (role) => {
      state.role = role;
      expect(await getRegistrationReviewAction(ID)).toEqual({ error: "No tienes permiso para revisar solicitudes." });
      expect(state.lecturas).toEqual([]);
    },
  );

  it("un id que no es uuid no llega a la base", async () => {
    expect(await getRegistrationReviewAction("1 or 1=1")).toEqual({ error: "Solicitud inválida." });
    expect(state.lecturas).toEqual([]);
  });

  it("una solicitud de otro tenant no devuelve nada", async () => {
    state.fila = { ...state.fila!, tenant_id: "t2" };
    const r = await getRegistrationReviewAction(ID);
    expect(r).toEqual({ error: "No se pudo cargar la solicitud. Intenta de nuevo." });
    expect(JSON.stringify(r)).not.toContain("V00000000");
  });

  it.each(["aprobada", "rechazada"])("una solicitud ya %s no vuelve a mostrar sus datos", async (status) => {
    state.fila = { ...state.fila!, status };
    const r = await getRegistrationReviewAction(ID);
    expect(r).toEqual({ error: "La solicitud ya fue revisada." });
    expect(JSON.stringify(r)).not.toContain("V00000000");
    expect(JSON.stringify(r)).not.toContain("9876");
  });

  it("si la solicitud no existe o no se pudo leer, se dice", async () => {
    state.fila = null;
    expect(await getRegistrationReviewAction(ID)).toEqual({ error: "No se pudo cargar la solicitud. Intenta de nuevo." });
  });
});
