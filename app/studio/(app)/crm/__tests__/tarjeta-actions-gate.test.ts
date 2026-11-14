/**
 * Candados de los verbos de la tarjeta del CRM propio (SDD-0587 · 6.3).
 *
 * Una server action es un endpoint: cada verbo resuelve el módulo `kommo` Y el
 * rol de la RLS de la 0506 (admin o commercial). Un desvío por usuario que le
 * abra el módulo a otro rol (por ejemplo `operations`) no abre las tablas, así que la acción tiene que
 * decir que no antes de llegar a la base. Y el movimiento va SIEMPRE por la RPC
 * `crm_mover_etapa`, nunca por un UPDATE de la etapa.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const USER = "00000000-0000-4000-8000-0000000000aa";
const TARJETA = "00000000-0000-4000-8000-000000000001";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ client: "service_role" }) }));
vi.mock("@/lib/studio/user-queries", () => ({ listTenantAdvisors: async () => [] }));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));
// Accesos adicionales de la persona (SDD-0622).
let grants: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/user-module-grants-queries", () => ({
  getMyModuleGrants: async () => grants,
  getTenantGrantsByUser: async () => new Map(),
}));

let role: StudioUserRole | null = "commercial";
let rpcRespuesta: { data: unknown; error: { code?: string; message?: string } | null } = {
  data: true,
  error: null,
};
const rpcMock = vi.fn();
const inserts: { tabla: string; fila: unknown }[] = [];
const tablasTocadas: string[] = [];
let createClientLlamado = 0;

function sesion() {
  createClientLlamado += 1;
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
    from(tabla: string) {
      tablasTocadas.push(tabla);
      const fila = tabla === "user_tenants" && role ? { tenant_id: TENANT, role } : null;
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: fila, error: null }),
        insert: async (f: unknown) => {
          inserts.push({ tabla, fila: f });
          return { error: null };
        },
      };
      return q;
    },
    async rpc(nombre: string, args: unknown) {
      rpcMock(nombre, args);
      return rpcRespuesta;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => sesion() }));

const { moverTarjetaAction, agregarNotaTarjetaAction, cargarFichaTarjetaAction } = await import(
  "../tarjeta-actions"
);

beforeEach(() => {
  grants = {};
  vi.clearAllMocks();
  overrides = {};
  role = "commercial";
  rpcRespuesta = { data: true, error: null };
  inserts.length = 0;
  tablasTocadas.length = 0;
  createClientLlamado = 0;
});

const ROLES_SIN_CRM = STUDIO_USER_ROLES.filter((r) => !["admin", "commercial"].includes(r));

describe("moverTarjetaAction", () => {
  it.each(ROLES_SIN_CRM)("rol %s: no mueve ni llama a la RPC", async (r) => {
    role = r;
    const res = await moverTarjetaAction(TARJETA, "leads", "contactado");
    expect(res).toHaveProperty("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // SDD-0622 (migr 0539): la RLS y `crm_mover_etapa` deciden con
  // user_has_module('kommo'), así que el desvío por rol y el acceso adicional
  // valen igual en la pantalla y en la base.
  it("operations con el módulo abierto por desvío mueve: la base decide igual (0539)", async () => {
    role = "operations" as StudioUserRole;
    overrides = { "operations:kommo": { view: true, edit: true } };
    const res = await moverTarjetaAction(TARJETA, "leads", "contactado");
    expect(res).toEqual({ ok: true, movida: true });
    expect(rpcMock).toHaveBeenCalled();
  });

  it("contabilidad con el CRM concedido para editar mueve (caso Alejandro)", async () => {
    role = "accounting" as StudioUserRole;
    grants = { kommo: { view: true, edit: true } };
    expect(await moverTarjetaAction(TARJETA, "leads", "contactado")).toEqual({ ok: true, movida: true });
  });

  it("contabilidad con el CRM solo para ver no mueve", async () => {
    role = "accounting" as StudioUserRole;
    grants = { kommo: { view: true, edit: false } };
    expect(await moverTarjetaAction(TARJETA, "leads", "contactado")).toHaveProperty("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(["admin", "commercial"] as const)("rol %s: mueve por crm_mover_etapa con el motivo limpio", async (r) => {
    role = r;
    const res = await moverTarjetaAction(TARJETA, "leads", "perdido", "  No le sirve el tiempo  ");
    expect(res).toEqual({ ok: true, movida: true });
    expect(rpcMock).toHaveBeenCalledWith("crm_mover_etapa", {
      p_tarjeta_id: TARJETA,
      p_tablero: "leads",
      p_etapa: "perdido",
      p_motivo: "No le sirve el tiempo",
    });
    // Nunca un UPDATE directo de la etapa.
    expect(tablasTocadas).not.toContain("crm_tarjetas");
  });

  it("ya estaba en esa etapa: ok sin movimiento", async () => {
    rpcRespuesta = { data: false, error: null };
    expect(await moverTarjetaAction(TARJETA, "clientes", "activo")).toEqual({ ok: true, movida: false });
  });

  it("traduce el «pide motivo» de la RPC", async () => {
    rpcRespuesta = { data: null, error: { code: "22023", message: "crm_mover_etapa: una etapa de cierre pide motivo" } };
    expect(await moverTarjetaAction(TARJETA, "leads", "perdido")).toEqual({
      error: "Para cerrar la tarjeta en esa etapa escribe el motivo.",
    });
  });

  it.each([
    ["tarjeta", "no-es-uuid", "leads", "nuevo"],
    ["tablero", TARJETA, "otro", "nuevo"],
    ["etapa", TARJETA, "leads", "Nuevo; drop"],
  ])("entrada inválida (%s): responde sin abrir sesión", async (_c, id, tablero, etapa) => {
    const res = await moverTarjetaAction(id, tablero as "leads", etapa);
    expect(res).toHaveProperty("error");
    expect(createClientLlamado).toBe(0);
  });
});

describe("agregarNotaTarjetaAction", () => {
  it("escribe con el tenant y el autor del gate, no con lo que mande el cliente", async () => {
    expect(await agregarNotaTarjetaAction(TARJETA, "  Pidió el estimado por correo  ")).toEqual({ ok: true });
    expect(inserts).toEqual([
      {
        tabla: "crm_notas",
        fila: { tenant_id: TENANT, tarjeta_id: TARJETA, texto: "Pidió el estimado por correo", autor_id: USER },
      },
    ]);
  });

  it.each(ROLES_SIN_CRM)("rol %s: no escribe", async (r) => {
    role = r;
    expect(await agregarNotaTarjetaAction(TARJETA, "Nota")).toHaveProperty("error");
    expect(inserts).toEqual([]);
  });
});

describe("cargarFichaTarjetaAction", () => {
  it.each(ROLES_SIN_CRM)("rol %s: no lee la tarjeta", async (r) => {
    role = r;
    expect(await cargarFichaTarjetaAction(TARJETA)).toHaveProperty("error");
    expect(tablasTocadas).not.toContain("crm_tarjetas");
  });
});
