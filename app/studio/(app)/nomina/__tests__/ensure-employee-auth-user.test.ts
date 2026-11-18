// @vitest-environment node
/**
 * SDD-0652 §4 punto 6 (D2) · aprobar una solicitud nunca reutiliza una cuenta.
 *
 *   - `ensureEmployeeAuthUser`: crea, o dice «ya existe», o falla. No busca de
 *     quién es la cuenta existente: no hay `listUsers` ni lecturas de tablas, así
 *     que ni un cliente del portal, ni un usuario del Studio, ni la página 2 de
 *     usuarios, ni un error en una comprobación pueden terminar en un enlace.
 *   - `approveRegistrationAction`: con «ya existe» crea la ficha SIN acceso y
 *     avisa; con error no crea nada; si la ficha no nace, descarta la cuenta
 *     recién creada.
 * Datos sintéticos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discardCreatedAuthUser, ensureEmployeeAuthUser } from "@/lib/studio/nomina/employee-auth-user";

type CreateResp = { data: { user: { id?: string } | null } | null; error: Record<string, unknown> | null };

function adminFalso(resp: CreateResp | (() => never)) {
  const llamadas: { fn: string; args: unknown }[] = [];
  const admin = {
    auth: {
      admin: {
        createUser: async (args: unknown) => {
          llamadas.push({ fn: "createUser", args });
          return typeof resp === "function" ? resp() : resp;
        },
        // Si alguien vuelve a buscar la cuenta existente, estas pruebas lo ven.
        listUsers: async () => {
          llamadas.push({ fn: "listUsers", args: null });
          return { data: { users: [{ id: "u-ajeno", email: "persona@example.test" }] }, error: null };
        },
        getUserById: async () => {
          llamadas.push({ fn: "getUserById", args: null });
          return { data: { user: { id: "u-ajeno" } }, error: null };
        },
        deleteUser: async (id: string) => {
          llamadas.push({ fn: "deleteUser", args: id });
          return { data: null, error: null };
        },
      },
    },
    from: () => {
      llamadas.push({ fn: "from", args: null });
      throw new Error("no debe leer tablas");
    },
  };
  return { admin: admin as unknown as SupabaseClient, llamadas };
}

describe("ensureEmployeeAuthUser", () => {
  it("si el correo no existe, crea la cuenta confirmada con el correo normalizado", async () => {
    const { admin, llamadas } = adminFalso({ data: { user: { id: "u-nuevo" } }, error: null });
    expect(await ensureEmployeeAuthUser(admin, "  Persona@Example.TEST ")).toEqual({ kind: "created", userId: "u-nuevo" });
    expect(llamadas).toEqual([
      {
        fn: "createUser",
        args: { email: "persona@example.test", email_confirm: true, user_metadata: { role: "employee", app: "m-emp" } },
      },
    ]);
  });

  it.each([
    ["código email_exists", { code: "email_exists", status: 422, message: "x" }],
    ["422 sin código, con el texto de GoTrue", { status: 422, message: "A user with this email address has already been registered" }],
  ])("si el correo ya tiene cuenta (%s) dice «existe» y NO devuelve ningún id", async (_caso, error) => {
    const { admin, llamadas } = adminFalso({ data: { user: null }, error });
    const r = await ensureEmployeeAuthUser(admin, "persona@example.test");
    expect(r).toEqual({ kind: "exists" });
    expect(JSON.stringify(r)).not.toContain("u-ajeno");
    // No busca de quién es: ni la primera página de usuarios ni ninguna tabla.
    expect(llamadas.map((l) => l.fn)).toEqual(["createUser"]);
  });

  it.each([
    ["un 500 de Auth", { status: 500, message: "boom" }],
    ["un 422 con otro código", { code: "weak_password", status: 422, message: "already registered" }],
    ["un 429", { code: "over_request_rate_limit", status: 429, message: "x" }],
    ["un error sin estado", { message: "fetch failed" }],
  ])("ante %s falla cerrado: ni crea ni reutiliza", async (_caso, error) => {
    const { admin, llamadas } = adminFalso({ data: { user: null }, error });
    expect(await ensureEmployeeAuthUser(admin, "persona@example.test")).toEqual({ kind: "error" });
    expect(llamadas.map((l) => l.fn)).toEqual(["createUser"]);
  });

  it("si Auth lanza, falla cerrado", async () => {
    const { admin } = adminFalso(() => {
      throw new Error("red caída");
    });
    expect(await ensureEmployeeAuthUser(admin, "persona@example.test")).toEqual({ kind: "error" });
  });

  it("sin error pero sin id de usuario, falla cerrado", async () => {
    expect(await ensureEmployeeAuthUser(adminFalso({ data: { user: {} }, error: null }).admin, "p@example.test")).toEqual({ kind: "error" });
    expect(await ensureEmployeeAuthUser(adminFalso({ data: null, error: null }).admin, "p@example.test")).toEqual({ kind: "error" });
  });

  it("un correo vacío no llega a Auth", async () => {
    const { admin, llamadas } = adminFalso({ data: { user: { id: "u" } }, error: null });
    expect(await ensureEmployeeAuthUser(admin, "   ")).toEqual({ kind: "error" });
    expect(llamadas).toEqual([]);
  });

  it("discardCreatedAuthUser borra solo el id que se le da y no lanza si falla", async () => {
    const { admin, llamadas } = adminFalso({ data: null, error: null });
    await discardCreatedAuthUser(admin, "u-nuevo");
    expect(llamadas).toEqual([{ fn: "deleteUser", args: "u-nuevo" }]);
    const roto = { auth: { admin: { deleteUser: async () => { throw new Error("x"); } } } } as unknown as SupabaseClient;
    await expect(discardCreatedAuthUser(roto, "u-nuevo")).resolves.toBeUndefined();
  });
});

// ── La aprobación entera ─────────────────────────────────────────────────────
const state = vi.hoisted(() => ({
  cuenta: { kind: "created", userId: "u-nuevo" } as { kind: "created"; userId: string } | { kind: "exists" } | { kind: "error" },
  inserts: [] as Record<string, unknown>[],
  insertError: null as { code?: string; message: string } | null,
  updates: [] as Record<string, unknown>[],
  descartadas: [] as string[],
  rpcs: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ marca: "admin" }) }));
vi.mock("../../usuarios/actions", () => ({ inviteUserAction: async () => ({}) }));
vi.mock("@/lib/studio/nomina/employee-auth-user", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/studio/nomina/employee-auth-user")>();
  return {
    ...orig,
    // En el bloque de arriba se prueba la real; aquí se dobla para medir la acción.
    ensureEmployeeAuthUser: async (admin: SupabaseClient, email: string) =>
      "marca" in (admin as object) ? state.cuenta : orig.ensureEmployeeAuthUser(admin, email),
    discardCreatedAuthUser: async (admin: SupabaseClient, id: string) => {
      if ("marca" in (admin as object)) state.descartadas.push(id);
      else await orig.discardCreatedAuthUser(admin, id);
    },
  };
});
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  moduleViewDenial: async () => null,
  capabilityDenial: async () => null,
  getStudioAccess: async () => ({ role: "admin", tenantId: "t1", userId: "u-admin", warehouseScope: "all", overrides: {}, grants: {} }),
}));
vi.mock("@/lib/studio/nomina/registration-queries", () => ({
  getRegistration: async () => ({
    id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "t1",
    full_name: "Candidata Sintética",
    national_id: "V00000000",
    email: "candidata@example.test",
    cargo: "Analista",
    phone: null,
    birth_date: null,
    start_date: "2026-12-01",
    bank_name: null,
    bank_account_type: null,
    bank_account: null,
    status: "pendiente",
  }),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-admin" } } }) },
    rpc: async (fn: string) => {
      state.rpcs.push(fn);
      return { data: "EMP-0042", error: null };
    },
    from: (tabla: string) => {
      if (tabla === "user_tenants") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: { tenant_id: "t1" }, error: null }),
        };
        return chain;
      }
      if (tabla === "nomina_employees") {
        return {
          insert: (fila: Record<string, unknown>) => {
            state.inserts.push(fila);
            return {
              select: () => ({
                single: async () =>
                  state.insertError ? { data: null, error: state.insertError } : { data: { id: "e-nueva" }, error: null },
              }),
            };
          },
        };
      }
      // nomina_employee_registrations
      return {
        update: (fila: Record<string, unknown>) => {
          state.updates.push(fila);
          const fin = { eq: () => fin, then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok) };
          return fin;
        },
      };
    },
  }),
}));

import { approveRegistrationAction } from "../actions";

const REG = "11111111-1111-1111-1111-111111111111";
function form(): FormData {
  const fd = new FormData();
  fd.set("salary_usd", "100");
  return fd;
}

beforeEach(() => {
  state.cuenta = { kind: "created", userId: "u-nuevo" };
  state.inserts = [];
  state.insertError = null;
  state.updates = [];
  state.descartadas = [];
  state.rpcs = [];
});

describe("approveRegistrationAction · acceso del empleado (SDD-0652 §4 punto 6)", () => {
  it("correo nuevo: crea la ficha enlazada a la cuenta recién creada, sin aviso", async () => {
    const r = await approveRegistrationAction(REG, {}, form());
    expect(r).toEqual({ ok: true, createdCode: "EMP-0042" });
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.auth_user_id).toBe("u-nuevo");
    expect(state.updates[0]).toMatchObject({ status: "aprobada", employee_id: "e-nueva" });
  });

  it("el correo ya tiene cuenta: la ficha nace SIN acceso y se avisa", async () => {
    state.cuenta = { kind: "exists" };
    const r = await approveRegistrationAction(REG, {}, form());
    expect(r.ok).toBe(true);
    expect(r.accessWarning).toBe(
      "Ese correo ya tiene una cuenta. La ficha se creó sin acceso. Si esa cuenta es de un usuario del Studio y es la misma persona, enlázala desde la ficha. Si es solo de la app del empleado, todavía no se puede enlazar desde la ficha: pídeselo a quien administra el sistema.",
    );
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.auth_user_id).toBeNull();
    expect(state.descartadas).toEqual([]);
  });

  it("si no se pudo comprobar el acceso, no crea la ficha ni cierra la solicitud", async () => {
    state.cuenta = { kind: "error" };
    const r = await approveRegistrationAction(REG, {}, form());
    expect(r.ok).toBeUndefined();
    expect(r.error).toBe("No se pudo comprobar el acceso del empleado. No se creó nada: intenta de nuevo.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("si la ficha no nace, la cuenta recién creada se descarta", async () => {
    state.insertError = { code: "23505", message: "duplicate key value violates unique constraint national_id" };
    const r = await approveRegistrationAction(REG, {}, form());
    expect(r.error).toBe("Ya existe un empleado con esa cédula. Revisa antes de aprobar.");
    expect(state.descartadas).toEqual(["u-nuevo"]);
    expect(state.updates).toEqual([]);
  });

  it("si la ficha no nace y la cuenta ya existía, no se borra la cuenta de nadie", async () => {
    state.cuenta = { kind: "exists" };
    state.insertError = { code: "23505", message: "duplicate key value violates unique constraint national_id" };
    await approveRegistrationAction(REG, {}, form());
    expect(state.descartadas).toEqual([]);
  });
});
