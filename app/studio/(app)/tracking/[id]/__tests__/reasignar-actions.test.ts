// @vitest-environment node
/**
 * SDD-0645 · «Pasar a otro cliente»: las dos server actions.
 *
 * LADO NEGATIVO: quien no tiene `reassign_shipment_owner` no llega a la RPC
 * (ni a la vista previa). La base repite el candado (0551), pero la action no
 * le delega la primera puerta.
 * LADO POSITIVO: operations, commercial y admin llegan con los argumentos exactos, el
 * motivo recortado y validado, y los errores salen en texto llano.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseDouble, type DoubleHandle, type Reply } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SHIPMENT = "44444444-4444-4444-8444-444444444444";
const CLIENT = "55555555-5555-4555-8555-555555555555";
const SUSPENDIDO = "2026-09-01T12:00:00Z";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => true }));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { previewReassignShipmentClient, reassignShipmentClient } = await import("../actions");

const RESPUESTA = (outcome: string, extra: Record<string, unknown> = {}) => ({
  outcome,
  shipment_id: SHIPMENT,
  shipment_code: "S-2026-0064",
  old_markbox: "DTD-0000",
  new_markbox: "DTD-1001",
  blockers: {},
  moved: { shipments: 1, warehouse_receipts_cn: 1, warehouse_boxes: 5 },
  ...extra,
});

function conRol(role: string | null, reply?: Reply, disabled_at: string | null = null, userId: string | null = USER) {
  db = supabaseDouble({
    userId,
    memberships:
      role === null ? [] : [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
    rpc: { reassign_shipment_client: reply ?? { data: RESPUESTA("preview"), error: null } },
  });
}

const llamadas = () => db.rpcCalls.filter((c) => c.name === "reassign_shipment_client");

beforeEach(() => {
  vi.clearAllMocks();
  conRol("operations");
});

describe("candado: sólo operations, commercial y admin llegan a la RPC", () => {
  const SIN_PERMISO: [string, () => void][] = [
    ["accounting", () => conRol("accounting")],
    ["warehouse", () => conRol("warehouse")],
    ["support", () => conRol("support")],
    ["marketing", () => conRol("marketing")],
    ["admin suspendido", () => conRol("admin", undefined, SUSPENDIDO)],
    ["sin membresía", () => conRol(null)],
    ["sin sesión", () => conRol("admin", undefined, null, null)],
  ];
  for (const [quien, montar] of SIN_PERMISO) {
    it(`${quien}: ni vista previa ni cambio`, async () => {
      montar();
      const previa = await previewReassignShipmentClient(SHIPMENT, CLIENT);
      const cambio = await reassignShipmentClient(SHIPMENT, CLIENT, "Dueño real confirmado");
      expect(previa.ok).toBe(false);
      expect(cambio.ok).toBe(false);
      expect(llamadas()).toHaveLength(0);
      expect(db.writes).toHaveLength(0);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  }

  // D2 de Sam (2026-11-16): commercial también.
  for (const role of ["operations", "commercial", "admin"]) {
    it(`${role}: la vista previa llega con p_dry_run y sin motivo`, async () => {
      conRol(role);
      const res = await previewReassignShipmentClient(SHIPMENT, CLIENT);
      expect(res).toMatchObject({ ok: true, resultado: { outcome: "preview", newMarkbox: "DTD-1001" } });
      expect(llamadas()).toEqual([
        {
          name: "reassign_shipment_client",
          args: { p_shipment_id: SHIPMENT, p_client_id: CLIENT, p_reason: null, p_dry_run: true },
        },
      ]);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  }
});

describe("reassignShipmentClient", () => {
  it("manda el motivo recortado y revalida el detalle y los listados", async () => {
    conRol("operations", { data: RESPUESTA("reassigned"), error: null });
    const res = await reassignShipmentClient(SHIPMENT, CLIENT, "  Dueño real confirmado  ");
    expect(res).toMatchObject({ ok: true, resultado: { outcome: "reassigned" } });
    expect(llamadas()[0].args).toEqual({
      p_shipment_id: SHIPMENT,
      p_client_id: CLIENT,
      p_reason: "Dueño real confirmado",
      p_dry_run: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/studio/tracking/${SHIPMENT}`);
    expect(revalidatePath).toHaveBeenCalledWith("/studio/embarques");
  });

  it("sin motivo válido no llama a la RPC", async () => {
    expect(await reassignShipmentClient(SHIPMENT, CLIENT, "abc")).toMatchObject({ ok: false });
    expect(await reassignShipmentClient(SHIPMENT, CLIENT, "x".repeat(1001))).toMatchObject({ ok: false });
    expect(llamadas()).toHaveLength(0);
  });

  it("ids que no son uuid no llegan a la RPC", async () => {
    expect(await reassignShipmentClient("no-es-uuid", CLIENT, "Motivo válido")).toMatchObject({ ok: false });
    expect(await previewReassignShipmentClient(SHIPMENT, "")).toMatchObject({ ok: false });
    expect(llamadas()).toHaveLength(0);
  });

  it("bloqueado: devuelve los bloqueos y no revalida", async () => {
    conRol("operations", { data: RESPUESTA("blocked", { blockers: { factura_emitida: 1 } }), error: null });
    const res = await reassignShipmentClient(SHIPMENT, CLIENT, "Dueño real confirmado");
    expect(res).toMatchObject({ ok: true, resultado: { outcome: "blocked", blockers: { factura_emitida: 1 } } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin la migración: dice que no está disponible, sin el error crudo", async () => {
    conRol("operations", {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.reassign_shipment_client" },
    });
    const res = await previewReassignShipmentClient(SHIPMENT, CLIENT);
    expect(res).toEqual({ ok: false, error: "Esta acción todavía no está disponible.", noDisponible: true });
  });

  it("los errores de la base salen en texto llano", async () => {
    conRol("operations", { data: null, error: { code: "22023", message: "pasar embarque: el cliente no tiene Shipping Mark" } });
    const res = await reassignShipmentClient(SHIPMENT, CLIENT, "Dueño real confirmado");
    expect(res).toEqual({ ok: false, error: "Ese cliente no tiene Shipping Mark: el Portal no se lo mostraría." });
  });

  it("una respuesta con otra forma no se da por buena", async () => {
    conRol("operations", { data: { ok: true }, error: null });
    const res = await reassignShipmentClient(SHIPMENT, CLIENT, "Dueño real confirmado");
    expect(res.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
