/**
 * SDD-0522 · Almacén CN:
 *
 *  1. `deleteReceiptsAction`: sólo admin (`delete_warehouse_receipts`), lote y
 *     motivo antes de la base, y códigos de error bilingües con el porqué de
 *     cada recepción bloqueada. Nunca escribe `warehouse_receipts_cn`.
 *  2. El rollback de `createReceiptAction` borra la recepción recién creada con
 *     el cliente ADMIN, acotado a ese id y a ese tenant: la 0476 le quitó el
 *     DELETE físico a `authenticated`, así que con el cliente de sesión el
 *     rollback fallaría en silencio y dejaría una recepción sin items.
 *
 * El doble (`user-tenants-double.ts`) aplica `.eq`/`.is` y devuelve copias.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { supabaseDouble, type DoubleHandle, type MembershipRow, type Reply } from "@/lib/studio/__tests__/user-tenants-double";

const RPC = "soft_delete_warehouse_receipts_cn_with_audit_reason";
const SCOPE_RPC = "client_consolidation_scope";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));
vi.mock("@/lib/studio/sales-orders/actions", () => ({ autoInvoiceForReceipt: vi.fn() }));
vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({
  notaSinAviso: vi.fn(),
  scheduleReceiptInWarehouse: vi.fn(),
}));
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  findOrCreateConsolidationShipment: vi.fn(),
  ensureActiveAlert: vi.fn(),
  revertAlertIfShipmentEmpty: vi.fn(),
}));

/** Operaciones del cliente admin, con sus filtros: la evidencia del rollback. */
const adminOps: { table: string; op: string; filters: [string, unknown][] }[] = [];
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      delete: () => {
        const filters: [string, unknown][] = [];
        const b = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return b;
          },
          then: (res: (v: { error: null }) => unknown) => {
            adminOps.push({ table, op: "delete", filters: [...filters] });
            return Promise.resolve({ error: null }).then(res);
          },
        };
        return b;
      },
    }),
  }),
}));

let doble: DoubleHandle;
let userId: string | null = "user-1";
let memberships: MembershipRow[] = [];
let rpcReply: Reply | ((args: Record<string, unknown>) => Reply) = { data: [], error: null };
let scopeReply: Reply = { data: null, error: null };
/** Si se fija, el insert de items de la sesión falla con este mensaje. */
let itemsError: string | null = null;

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    doble = supabaseDouble({ userId, memberships, rpc: {
      [RPC]: rpcReply, [SCOPE_RPC]: scopeReply,
      client_consolidation_intake: { data: { availability: "off" }, error: null },
    } });
    const client = doble.client as { from: (t: string) => unknown };
    const from = client.from;
    client.from = (t: string) =>
      t === "warehouse_receipt_items" && itemsError
        ? { insert: async () => ({ error: { message: itemsError } }) }
        : from(t);
    return client;
  },
}));

const { deleteReceiptsAction, createReceiptAction } = await import("../actions");

const membresia = (role: StudioUserRole, disabled_at: string | null = null): MembershipRow => ({
  user_id: "user-1",
  tenant_id: "tn-1",
  role,
  disabled_at,
});
const fila = (id: string, code: string, outcome: string, blockers: Record<string, number> = {}) => ({
  receipt_id: id,
  code,
  outcome,
  blockers,
});

beforeEach(() => {
  vi.clearAllMocks();
  adminOps.length = 0;
  userId = "user-1";
  memberships = [membresia("admin")];
  itemsError = null;
  rpcReply = { data: [fila(A, "WR-2026-0001", "deleted"), fila(B, "WR-2026-0002", "deleted")], error: null };
  scopeReply = { data: { available: true, receiptIds: [], shipmentIds: [], containerIds: [], boxIds: [] }, error: null };
});

describe("deleteReceiptsAction · sólo admin", () => {
  it.each(STUDIO_USER_ROLES.filter((r) => r !== "admin"))("rol %s: nada llega a la base", async (r) => {
    memberships = [membresia(r)];
    const res = await deleteReceiptsAction([A], "Recepciones de prueba");
    expect(res).toMatchObject({ errorCode: "permission_denied" });
    expect(doble.rpcCalls).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("admin desactivado: tampoco (el doble filtra disabled_at)", async () => {
    memberships = [membresia("admin", "2026-10-01T00:00:00Z")];
    expect(await deleteReceiptsAction([A], "Recepciones de prueba")).toMatchObject({ errorCode: "permission_denied" });
    expect(doble.rpcCalls).toEqual([]);
  });
});

describe("deleteReceiptsAction · entrada antes de la base", () => {
  it("lote vacío o inválido, y más de 100", async () => {
    expect(await deleteReceiptsAction([], "Recepciones de prueba")).toEqual({ errorCode: "invalid_input" });
    expect(await deleteReceiptsAction(["WR-2026-0001"], "Recepciones de prueba")).toEqual({ errorCode: "invalid_input" });
    const ids = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(await deleteReceiptsAction(ids, "Recepciones de prueba")).toEqual({ errorCode: "cn_bulk_max_exceeded" });
    expect(doble.rpcCalls).toEqual([]);
  });

  it("motivo corto o largo, con su código", async () => {
    expect(await deleteReceiptsAction([A], " abc ")).toEqual({ errorCode: "cn_delete_reason_short" });
    expect(await deleteReceiptsAction([A], "x".repeat(1001))).toEqual({ errorCode: "cn_delete_reason_long" });
    expect(doble.rpcCalls).toEqual([]);
  });
});

describe("deleteReceiptsAction · la RPC decide", () => {
  it("borrado: un llamado, ids sin duplicar, motivo recortado, revalida CN y despacho", async () => {
    const r = await deleteReceiptsAction([A, B, B], "  Recepciones de prueba  ");
    expect(r).toEqual({ ok: true, deleted: 2, codes: ["WR-2026-0001", "WR-2026-0002"] });
    expect(doble.rpcCalls).toEqual([
      { name: SCOPE_RPC, args: { p_receipt_ids: [A, B], p_shipment_ids: [], p_container_ids: [], p_box_ids: [] } },
      { name: RPC, args: { p_ids: [A, B], p_reason: "Recepciones de prueba" } },
    ]);
    expect(doble.rpcCalls.filter((call) => call.name === RPC)).toHaveLength(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/cn");
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/despacho");
    expect(doble.writes).toEqual([]);
  });

  it("bloqueadas: código bilingüe y el porqué de cada una, sin revalidar", async () => {
    rpcReply = {
      data: [fila(A, "WR-2026-0001", "held"), fila(B, "WR-2026-0002", "blocked", { consolidated: 1, stowed_boxes: 2 })],
      error: null,
    };
    expect(await deleteReceiptsAction([A, B], "Recepciones de prueba")).toEqual({
      errorCode: "cn_delete_blocked",
      errorParams: { count: 1 },
      blocked: [
        {
          id: B,
          code: "WR-2026-0002",
          blockers: [
            { kind: "consolidated", count: 1 },
            { kind: "stowed_boxes", count: 2 },
          ],
        },
      ],
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("errores de la base: permiso, falla y respuesta que no cuadra", async () => {
    rpcReply = { data: null, error: { code: "42501", message: "x" } };
    expect(await deleteReceiptsAction([A], "Recepciones de prueba")).toEqual({ errorCode: "permission_denied" });
    rpcReply = { data: null, error: { code: "PGRST202", message: "x" } };
    expect(await deleteReceiptsAction([A], "Recepciones de prueba")).toEqual({ errorCode: "cn_delete_failed" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    rpcReply = { data: [], error: null };
    expect(await deleteReceiptsAction([A], "Recepciones de prueba")).toEqual({ errorCode: "cn_delete_unconfirmed" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/cn");
  });
  it.each([
    { data: null, error: { code: "PGRST202", message: "missing scope" } },
    { data: null, error: null },
    { data: { available: true, receiptIds: [] }, error: null },
  ])("metadata fallida/incompleta corta antes de la RPC de borrado", async (reply) => {
    scopeReply = reply;
    expect(await deleteReceiptsAction([A], "Recepciones de prueba")).toMatchObject({ errorCode: "cn_delete_failed" });
    expect(doble.rpcCalls.map((call) => call.name)).toEqual([SCOPE_RPC]);
    expect(doble.writes).toEqual([]); expect(revalidatePathMock).not.toHaveBeenCalled();
  });
  it("un lote mixto con cohorte no borra el subconjunto legacy", async () => {
    scopeReply = { data: { available: true, receiptIds: [A], shipmentIds: [], containerIds: [], boxIds: [] }, error: null };
    expect(await deleteReceiptsAction([A, B], "Recepciones de prueba")).toMatchObject({ errorCode: "cn_delete_blocked" });
    expect(doble.rpcCalls.map((call) => call.name)).toEqual([SCOPE_RPC]); expect(doble.writes).toEqual([]);
  });
});

describe("createReceiptAction · el rollback va por el cliente admin", () => {
  function formulario() {
    const fd = new FormData();
    fd.set("warehouse_id", "wh-1");
    fd.set("is_orphan", "true");
    fd.set("boxes", "1");
    fd.set("received_at", "2026-10-15");
    fd.set("items_json", JSON.stringify([{ description: "Caja de prueba" }]));
    return fd;
  }

  it("si fallan los items, borra la recepción creada con el admin, por id y tenant", async () => {
    itemsError = "items boom";

    const res = await createReceiptAction({}, formulario());

    expect(res).toEqual({ error: "No se pudieron registrar los items: items boom" });
    const recepcion = doble.writes.find((w) => w.table === "warehouse_receipts_cn" && w.op === "insert");
    expect(recepcion).toBeTruthy();
    // La sesión ya no borra físicamente (la 0476 se lo quitó).
    expect(doble.writes.filter((w) => w.op === "delete")).toEqual([]);
    expect(adminOps).toEqual([
      { table: "warehouse_receipts_cn", op: "delete", filters: [["id", "row-1"], ["tenant_id", "tn-1"]] },
    ]);
  });

  it("sin falla de items no hay rollback", async () => {
    await createReceiptAction({}, formulario());
    expect(adminOps).toEqual([]);
  });
});
