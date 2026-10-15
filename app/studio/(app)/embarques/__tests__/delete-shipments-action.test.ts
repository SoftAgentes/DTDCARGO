/**
 * SDD-0522 · `deleteShipmentsAction`: permiso, lote y motivo ANTES de la base;
 * después, la RPC decide y la acción sólo traduce. Nunca escribe `shipments`.
 *
 * El doble (`user-tenants-double.ts`) aplica `.eq`/`.is` y devuelve copias: un
 * admin desactivado no pasa, porque `getStudioAccess` filtra `disabled_at`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { supabaseDouble, type DoubleHandle, type MembershipRow, type Reply } from "@/lib/studio/__tests__/user-tenants-double";

const RPC = "soft_delete_shipments_with_audit_reason";
const DENIAL = "No tienes permiso para realizar esta acción.";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));

let doble: DoubleHandle;
let userId: string | null = "user-1";
let memberships: MembershipRow[] = [];
let rpcReply: Reply | ((args: Record<string, unknown>) => Reply) = { data: [], error: null };

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    doble = supabaseDouble({ userId, memberships, rpc: { [RPC]: rpcReply } });
    return doble.client;
  },
}));

const { deleteShipmentsAction } = await import("../actions");

const membresia = (role: StudioUserRole, disabled_at: string | null = null): MembershipRow => ({
  user_id: "user-1",
  tenant_id: "tn-1",
  role,
  disabled_at,
});
const fila = (id: string, code: string, outcome: string, blockers: Record<string, number> = {}) => ({
  shipment_id: id,
  code,
  outcome,
  blockers,
});

beforeEach(() => {
  vi.clearAllMocks();
  userId = "user-1";
  memberships = [membresia("admin")];
  rpcReply = { data: [fila(A, "S-2026-0001", "deleted"), fila(B, "S-2026-0002", "deleted")], error: null };
});

describe("deleteShipmentsAction · permiso primero", () => {
  it.each(STUDIO_USER_ROLES.filter((r) => r !== "admin"))("rol %s: nada llega a la base", async (r) => {
    memberships = [membresia(r)];
    expect(await deleteShipmentsAction([A], "Embarques de prueba")).toEqual({ error: DENIAL });
    expect(doble.rpcCalls).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("admin desactivado y sin sesión: tampoco", async () => {
    memberships = [membresia("admin", "2026-10-01T00:00:00Z")];
    expect(await deleteShipmentsAction([A], "Embarques de prueba")).toEqual({ error: DENIAL });
    userId = null;
    expect(await deleteShipmentsAction([A], "Embarques de prueba")).toEqual({ error: DENIAL });
    expect(doble.rpcCalls).toEqual([]);
  });

  it("el permiso va antes que validar la entrada", async () => {
    memberships = [membresia("operations")];
    expect(await deleteShipmentsAction([], "")).toEqual({ error: DENIAL });
  });
});

describe("deleteShipmentsAction · lote y motivo antes de la base", () => {
  it.each([
    [[], "Elige al menos un embarque."],
    [["S-2026-0001"], "La selección no es válida. Recarga la lista y vuelve a elegir."],
  ])("lote %j", async (ids, mensaje) => {
    expect(await deleteShipmentsAction(ids as string[], "Embarques de prueba")).toEqual({ error: mensaje });
    expect(doble.rpcCalls).toEqual([]);
  });

  it("más de 100 distintos no llega a la base", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(await deleteShipmentsAction(ids, "Embarques de prueba")).toEqual({
      error: "Elige hasta 100 embarques por vez.",
    });
    expect(doble.rpcCalls).toEqual([]);
  });

  it.each(["", "   ", "abc", "x".repeat(1001)])("motivo %j no llega a la base", async (motivo) => {
    const r = await deleteShipmentsAction([A], motivo);
    expect(r).toHaveProperty("error");
    expect(doble.rpcCalls).toEqual([]);
  });

  it("los límites 4 y 1000 sí llegan, recortados", async () => {
    rpcReply = { data: [fila(A, "S-2026-0001", "deleted")], error: null };
    // Cada llamada arma su propio cliente: se mira el de cada una.
    await deleteShipmentsAction([A], "  abcd  ");
    expect(doble.rpcCalls).toEqual([{ name: RPC, args: { p_ids: [A], p_reason: "abcd" } }]);
    await deleteShipmentsAction([A], "m".repeat(1000));
    expect(doble.rpcCalls).toEqual([{ name: RPC, args: { p_ids: [A], p_reason: "m".repeat(1000) } }]);
  });
});

describe("deleteShipmentsAction · la RPC decide", () => {
  it("borrado: un solo llamado con ids sin duplicar, revalida las cuatro pantallas", async () => {
    const r = await deleteShipmentsAction([A, B, A], "  Embarques de prueba  ");

    expect(r).toEqual({ ok: true, deleted: 2, codes: ["S-2026-0001", "S-2026-0002"] });
    expect(doble.rpcCalls).toEqual([{ name: RPC, args: { p_ids: [A, B], p_reason: "Embarques de prueba" } }]);
    for (const ruta of ["/studio/embarques", "/studio/tracking", "/studio/resumen", "/studio/calendario"]) {
      expect(revalidatePathMock).toHaveBeenCalledWith(ruta);
    }
    expect(doble.writes).toEqual([]);
  });

  it("rechazado: no revalida y dice por qué cada uno, sin prometer un borrado a medias", async () => {
    rpcReply = {
      data: [fila(A, "S-2026-0001", "held"), fila(B, "S-2026-0002", "blocked", { customs_filings: 1 })],
      error: null,
    };

    const r = await deleteShipmentsAction([A, B], "Embarques de prueba");

    expect(r).toEqual({
      error:
        "No se eliminó ningún embarque. S-2026-0002: No se puede eliminar: tiene 1 expediente de Aduana. Primero anula, elimina o desvincula eso en su módulo.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("la base niega el permiso (rol cambiado en el medio): mensaje de permiso", async () => {
    rpcReply = { data: null, error: { code: "42501", message: "borrado: solo un administrador" } };
    expect(await deleteShipmentsAction([A], "Embarques de prueba")).toEqual({
      error: "No tienes permiso para eliminar embarques. Solo un administrador puede hacerlo.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("sin la 0476 (la RPC no existe): falla sin borrar y sin revalidar", async () => {
    rpcReply = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    expect(await deleteShipmentsAction([A], "Embarques de prueba")).toEqual({
      error: "No se pudo eliminar. No se borró ningún embarque; intenta de nuevo.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("una respuesta que no cuadra: no confirma, pero revalida para mostrar la verdad", async () => {
    rpcReply = { data: [fila(A, "S-2026-0001", "deleted")], error: null };
    expect(await deleteShipmentsAction([A, B], "Embarques de prueba")).toEqual({
      error: "No se pudo confirmar el borrado. Recarga la lista para ver cómo quedó.",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/embarques");
  });
});
