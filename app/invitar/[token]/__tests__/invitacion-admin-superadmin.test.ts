// @vitest-environment node
/**
 * SDD-0636 · Política de roles: una invitación de administrador vale solo si la
 * emitió un superadministrador.
 *
 * QUÉ DEFIENDE. La base lo exige al aceptar (migr 0545), pero la cuenta se crea
 * antes de llamar a la RPC. Así que la acción lo mira primero:
 *   1. invitación de admin que no emitió un superadmin → aviso y no se crea la
 *      cuenta;
 *   2. emitida por un superadmin → sigue el flujo;
 *   3. si no se pudo preguntar → sigue: decide la base;
 *   4. las invitaciones de otros roles no preguntan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rol: "admin",
  emisorEsSuperadmin: false as boolean,
  fallaConsulta: false,
  tablas: [] as string[],
  createUser: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: (...a: unknown[]) => mocks.createUser(...a) } },
    from(tabla: string) {
      mocks.tablas.push(tabla);
      if (tabla === "user_invitations") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: {
              id: "inv-1",
              email: "nueva@prueba.test",
              role: mocks.rol,
              accepted_at: null,
              revoked_at: null,
              expires_at: new Date(Date.now() + 86_400_000).toISOString(),
              invited_by: "emisor-1",
              tenant_id: "tenant-1",
            },
          }),
        };
        return chain;
      }
      if (tabla === "platform_admins") {
        let id: unknown = null;
        const chain = {
          select: () => chain,
          eq: (_col: string, valor: unknown) => {
            id = valor;
            return chain;
          },
          maybeSingle: async () =>
            mocks.fallaConsulta
              ? { data: null, error: { message: "boom" } }
              : { data: mocks.emisorEsSuperadmin && id === "emisor-1" ? { user_id: id } : null, error: null },
        };
        return chain;
      }
      if (tabla === "nomina_employees") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          ilike: () => chain,
          in: () => chain,
          update: () => chain,
          then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
        };
        return chain;
      }
      throw new Error(`tabla sin doble: ${tabla}`);
    },
  }),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: null }) },
    rpc: async () => ({ error: null }),
  }),
}));

import { acceptInvitationFormAction } from "../actions";

function formulario() {
  const fd = new FormData();
  fd.set("token", "t".repeat(32));
  fd.set("password", "clave-de-prueba-larga");
  return fd;
}

beforeEach(() => {
  mocks.rol = "admin";
  mocks.emisorEsSuperadmin = false;
  mocks.fallaConsulta = false;
  mocks.tablas = [];
  mocks.createUser.mockReset();
  mocks.createUser.mockResolvedValue({ data: { user: { id: "usuario-nuevo" } }, error: null });
});

describe("aceptar una invitación de administrador", () => {
  it("si no la emitió un superadmin: aviso y no se crea la cuenta", async () => {
    const r = await acceptInvitationFormAction({}, formulario());
    expect(r.error).toMatch(/^Esta invitación de administrador no se puede aceptar: invitar a un administrador lo hace solo el superadministrador/);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("si la emitió un superadmin: sigue el flujo", async () => {
    mocks.emisorEsSuperadmin = true;
    const r = await acceptInvitationFormAction({}, formulario());
    expect(r.error).toBeUndefined();
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });

  it("si no se pudo preguntar: sigue, decide la base", async () => {
    mocks.fallaConsulta = true;
    await acceptInvitationFormAction({}, formulario());
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });

  it("las invitaciones de otros roles no preguntan", async () => {
    mocks.rol = "commercial";
    await acceptInvitationFormAction({}, formulario());
    expect(mocks.tablas).not.toContain("platform_admins");
    expect(mocks.createUser).toHaveBeenCalledTimes(1);
  });
});
