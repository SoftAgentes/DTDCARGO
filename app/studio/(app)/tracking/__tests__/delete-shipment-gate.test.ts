/**
 * `deleteShipment` de Tracking (SDD-0497 → SDD-0522).
 *
 * SDD-0497 le puso gate de edición y le quitó el fallo mudo. SDD-0522 cambia
 * QUIÉN y CÓMO: borrar es de admin (`delete_shipments`), con motivo, y por la
 * RPC `soft_delete_shipments_with_audit_reason` (migr 0476), que es la que
 * decide si algo lo bloquea. La acción ya no escribe `shipments`: desde la 0476
 * la base rechaza ese UPDATE directo.
 *
 * Lo que se conserva de SDD-0497: el redirect ocurre SÓLO cuando el borrado
 * ocurrió, y cada fallo devuelve su motivo.
 *
 * El doble (`user-tenants-double.ts`) APLICA `.eq`/`.is` y devuelve copias: un
 * admin desactivado no pasa, porque `getStudioAccess` filtra `disabled_at`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { shipmentDeleteBlockReason } from "@/lib/studio/borrado/reglas";
import { supabaseDouble, type DoubleHandle, type MembershipRow, type Reply } from "@/lib/studio/__tests__/user-tenants-double";

const TENANT = "tn-1";
const SHIPMENT = "11111111-1111-4111-8111-111111111111";
const DENIAL = "No tienes permiso para realizar esta acción.";
const RPC = "soft_delete_shipments_with_audit_reason";

/** Marcador del `redirect()` de Next, que en producción también lanza. */
const REDIRECT = Symbol("NEXT_REDIRECT");
const redirectMock = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: REDIRECT, url });
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirectMock(u) }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({
  getUser: async () => ({ id: "user-1" }),
  getUserTenantId: async () => TENANT,
}));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

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

const { deleteShipment } = await import("../[id]/actions");

const fila = (outcome: string, blockers: Record<string, number> = {}, id = SHIPMENT) => ({
  shipment_id: id,
  code: "S-2026-0042",
  outcome,
  blockers,
});

async function correr(id = SHIPMENT, reason = "Embarque de prueba"): Promise<
  { value: Awaited<ReturnType<typeof deleteShipment>> } | { redirectedTo: string }
> {
  try {
    return { value: await deleteShipment(id, reason) };
  } catch (e) {
    if ((e as { digest?: symbol }).digest === REDIRECT) {
      return { redirectedTo: (e as { url: string }).url };
    }
    throw e;
  }
}

const membresia = (role: StudioUserRole, disabled_at: string | null = null): MembershipRow => ({
  user_id: "user-1",
  tenant_id: TENANT,
  role,
  disabled_at,
});

beforeEach(() => {
  vi.clearAllMocks();
  userId = "user-1";
  memberships = [membresia("admin")];
  rpcReply = { data: [fila("deleted")], error: null };
});

describe("deleteShipment · sólo admin", () => {
  it.each(STUDIO_USER_ROLES.filter((r) => r !== "admin"))(
    "rol %s: no llama a la RPC y recibe el motivo",
    async (r) => {
      memberships = [membresia(r)];

      const res = await correr();

      expect(res).toEqual({ value: { error: DENIAL } });
      expect(doble.rpcCalls).toEqual([]);
      expect(redirectMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    },
  );

  it("un admin DESACTIVADO tampoco (el doble filtra disabled_at)", async () => {
    memberships = [membresia("admin", "2026-10-01T00:00:00Z")];

    expect(await correr()).toEqual({ value: { error: DENIAL } });
    expect(doble.rpcCalls).toEqual([]);
  });

  it("sin sesión tampoco", async () => {
    userId = null;

    expect(await correr()).toEqual({ value: { error: DENIAL } });
    expect(doble.rpcCalls).toEqual([]);
  });
});

describe("deleteShipment · entrada antes de la base", () => {
  it("un código en vez de un id no llega a la RPC", async () => {
    const res = await correr("S-2026-0042");

    expect(res).toEqual({ value: { error: "Este envío no es válido. Recarga la página." } });
    expect(doble.rpcCalls).toEqual([]);
  });

  it.each(["", "   ", "abc", "x".repeat(1001)])("motivo %j: no llega a la RPC", async (motivo) => {
    const res = await correr(SHIPMENT, motivo);

    expect(res).toHaveProperty("value.error");
    expect(doble.rpcCalls).toEqual([]);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("deleteShipment · la RPC decide", () => {
  it("borrado: llama con el id y el motivo recortado, revalida y recién ahí redirige", async () => {
    const res = await correr(SHIPMENT, "  Embarque de prueba  ");

    expect(res).toEqual({ redirectedTo: "/studio/tracking" });
    expect(doble.rpcCalls).toEqual([{ name: RPC, args: { p_ids: [SHIPMENT], p_reason: "Embarque de prueba" } }]);
    for (const ruta of ["/studio/embarques", "/studio/tracking", "/studio/resumen", "/studio/calendario"]) {
      expect(revalidatePathMock).toHaveBeenCalledWith(ruta);
    }
    // Nunca escribe `shipments` directo: la base lo rechazaría.
    expect(doble.writes).toEqual([]);
  });

  it("bloqueado: devuelve el mismo motivo que la casilla y NO redirige", async () => {
    rpcReply = { data: [fila("blocked", { invoices: 1, expenses: 2 })], error: null };

    const res = await correr();

    expect(res).toEqual({
      value: { error: shipmentDeleteBlockReason({ bloqueos: { invoices: 1, expenses: 2 }, avisos: {} }) },
    });
    expect(res).toHaveProperty("value.error", expect.stringContaining("1 factura sin anular"));
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("entregado: lo dice con su propio motivo", async () => {
    rpcReply = { data: [fila("blocked", { delivered: 1 })], error: null };

    expect(await correr()).toEqual({
      value: { error: "No se puede eliminar: ya se entregó, y la entrega no se borra." },
    });
  });

  it("no encontrado (otro tenant, inexistente): no redirige", async () => {
    rpcReply = { data: [fila("not_found")], error: null };

    expect(await correr()).toEqual({
      value: { error: "Este envío ya no existe o ya se eliminó. Recarga la página." },
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("la base niega el permiso: el mensaje es de permiso, no de falla", async () => {
    rpcReply = { data: null, error: { code: "42501", message: "borrado: solo un administrador…" } };

    expect(await correr()).toEqual({
      value: { error: "No tienes permiso para eliminar embarques. Solo un administrador puede hacerlo." },
    });
  });

  it("una falla de la base no promete nada y no redirige", async () => {
    rpcReply = { data: null, error: { code: "PGRST202", message: "function not found" } };

    expect(await correr()).toEqual({
      value: { error: "No se pudo eliminar. No se borró ningún embarque; intenta de nuevo." },
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("una respuesta que no cuadra con lo pedido: no confirma, revalida y no redirige", async () => {
    rpcReply = { data: [fila("deleted", {}, "22222222-2222-4222-8222-222222222222")], error: null };

    expect(await correr()).toEqual({
      value: { error: "No se pudo confirmar el borrado. Recarga la lista para ver cómo quedó." },
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/tracking");
  });
});
