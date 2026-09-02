// @vitest-environment node

/**
 * SDD-0299: error de la RPC -> adaptador D1 real -> action real -> estado UI.
 * Sólo se sustituyen las fronteras DB, guard y caché; no se simula el traductor.
 * Las cuentas y direcciones son sintéticas y nunca se envían por red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  rpc: vi.fn(),
  denial: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: boundaries.rpc }) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: boundaries.denial }));
vi.mock("next/cache", () => ({ revalidatePath: boundaries.revalidate }));

import {
  updateCompanyIdentityAction, saveOfficeAction, deleteOfficeAction,
  saveBankAccountAction, deleteBankAccountAction,
} from "../company-actions";

const cases = [
  {
    name: "identidad", action: updateCompanyIdentityAction,
    input: { legal_name: "Empresa de prueba", iva_rate: "0", islr_rate: "0", igtf_rate: "0" },
    generic: "No se pudo guardar la identidad de la empresa.",
  },
  {
    name: "guardar oficina", action: saveOfficeAction,
    input: { country: "VE", name: "Oficina sintética", address: "Dirección de prueba" },
    generic: "No se pudo guardar la oficina.",
  },
  {
    name: "eliminar oficina", action: deleteOfficeAction,
    input: { id: "00000000-0000-4000-8000-000000000001" },
    generic: "No se pudo eliminar la oficina.",
  },
  {
    name: "guardar cuenta", action: saveBankAccountAction,
    input: { bank_name: "Banco sintético", account_type: "Prueba", currency: "USD", account_number: "TEST-ONLY" },
    generic: "No se pudo guardar la cuenta.",
  },
  {
    name: "eliminar cuenta", action: deleteBankAccountAction,
    input: { id: "00000000-0000-4000-8000-000000000002" },
    generic: "No se pudo eliminar la cuenta.",
  },
];

function form(input: Record<string, string | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  boundaries.denial.mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Red no permitida en este fixture"); }));
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe.each(cases)("SDD-0299: $name", ({ action, input, generic }) => {
  it("explica el rechazo 42501 sin marcar éxito ni revalidar", async () => {
    boundaries.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission_denied" } });
    const state = await action({}, form(input));
    expect(state.error).toContain("rol de administrador");
    expect(state.error).not.toBe(generic);
    expect(state.error).not.toContain("permission_denied");
    expect(state.ok).toBeUndefined();
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });

  it("distingue un registro inexistente del error genérico", async () => {
    boundaries.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "invalid_state" } });
    expect(await action({}, form(input))).toEqual({ error: "Ese registro ya no existe o lo borraron. Refresca la pantalla." });
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });

  it("mantiene el genérico de la operación para errores desconocidos", async () => {
    boundaries.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "internal_fixture_detail" } });
    expect(await action({}, form(input))).toEqual({ error: generic });
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });

  it("no filtra excepciones no tipadas ni las convierte en éxito", async () => {
    boundaries.rpc.mockRejectedValue(new Error("private_fixture_detail"));
    expect(await action({}, form(input))).toEqual({ error: generic });
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });

  it("conserva el rechazo del primer gate sin llamar a la RPC", async () => {
    boundaries.denial.mockResolvedValue("Acceso rechazado por el módulo.");
    expect(await action({}, form(input))).toEqual({ error: "Acceso rechazado por el módulo." });
    expect(boundaries.rpc).not.toHaveBeenCalled();
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });

  it("sólo marca éxito y revalida después de una operación aceptada", async () => {
    boundaries.rpc.mockResolvedValue({ data: { entity_id: "synthetic-entity" }, error: null });
    expect(await action({}, form(input))).toEqual({ ok: true });
    expect(boundaries.revalidate).toHaveBeenCalledExactlyOnceWith("/studio/admin");
  });
});
