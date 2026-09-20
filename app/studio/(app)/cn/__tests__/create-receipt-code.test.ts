// @vitest-environment node
/**
 * SDD-0491 · el código de la recepción creada en el Studio lo asigna la base.
 *
 * createReceiptAction pedía el código a next_receipt_code, que desde la
 * migración 0079 es la serie R- de los cobros, y el de la huérfana a
 * next_orphan_code, que el Studio no puede ejecutar desde la 0211. Ahora inserta
 * sin receipt_code y lee el que asigna el trigger de la 0469 (WR-YYYY-NNNN o
 * SIN-CODIGO-NNNN). El doble de Supabase registra las RPC y los INSERT, y
 * devuelve copias, como PostgREST.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/studio/sales-orders/actions", () => ({
  autoInvoiceForReceipt: vi.fn(async () => ({ notApplicable: true })),
}));
vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({
  notaSinAviso: vi.fn(() => null),
  scheduleReceiptInWarehouse: vi.fn(async () => ({ scheduled: 0 })),
}));
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  findOrCreateConsolidationShipment: vi.fn(async () => null),
  ensureActiveAlert: vi.fn(async () => null),
  revertAlertIfShipmentEmpty: vi.fn(async () => null),
}));

type Insert = { tabla: string; valores: Record<string, unknown> };
let rpcs: string[] = [];
let inserts: Insert[] = [];
/** El código que asigna el trigger de la 0469 en el escenario. */
let codigoDeLaBase = "WR-2026-0007";

/** Sólo las columnas pedidas en `.select(...)`, como PostgREST. */
function columnas(fila: Record<string, unknown>, pedidas: string | null) {
  if (!pedidas || pedidas.trim() === "*") return { ...fila };
  return Object.fromEntries(
    pedidas.split(",").map((c) => c.trim()).filter((c) => c in fila).map((c) => [c, fila[c]]),
  );
}

function respuesta(tabla: string, op: string, unica: boolean, pedidas: string | null) {
  if (tabla === "user_tenants") return { data: columnas({ tenant_id: "tenant-1" }, pedidas), error: null };
  if (tabla === "warehouse_receipts_cn" && op === "insert") {
    return { data: columnas({ id: "rec-1", receipt_code: codigoDeLaBase }, pedidas), error: null };
  }
  return { data: unica ? null : [], error: null };
}

function cadena(tabla: string) {
  let op = "select";
  let pedidas: string | null = null;
  const c: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "is", "in", "order", "limit", "gte", "lte", "not", "or", "filter", "match"]) {
    c[m] = () => c;
  }
  c.select = (cols?: string) => {
    pedidas = cols ?? null;
    return c;
  };
  c.insert = (valores: Record<string, unknown> | Record<string, unknown>[]) => {
    op = "insert";
    for (const v of Array.isArray(valores) ? valores : [valores]) inserts.push({ tabla, valores: { ...v } });
    return c;
  };
  c.update = () => {
    op = "update";
    return c;
  };
  c.delete = () => {
    op = "delete";
    return c;
  };
  c.maybeSingle = () => Promise.resolve(respuesta(tabla, op, true, pedidas));
  c.single = () => Promise.resolve(respuesta(tabla, op, true, pedidas));
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(respuesta(tabla, op, false, pedidas)).then(resolve, reject);
  return c;
}

const cliente = {
  from: (tabla: string) => cadena(tabla),
  rpc: (nombre: string) => {
    rpcs.push(nombre);
    // Lo que devolvía next_receipt_code desde la 0079: la serie de los cobros.
    return Promise.resolve({ data: "R-2026-0042", error: null });
  },
};

vi.mock("@/lib/db/server", () => ({ createClient: async () => cliente }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => cliente }));

const { createReceiptAction } = await import("../actions");

function formulario(huerfana: boolean): FormData {
  const f = new FormData();
  f.set("warehouse_id", "almacen-1");
  if (huerfana) {
    f.set("is_orphan", "true");
    f.set("orphan_marks", "Marca roja");
  } else {
    f.set("client_markbox", "DTD-1001");
    f.set("client_name", "Cliente de prueba");
  }
  f.set("supplier_name", "Proveedor de prueba");
  f.set("boxes", "2");
  f.set("received_at", "2026-09-19");
  f.set("items_json", JSON.stringify([{ description: "Zapatos", quantity: 10 }]));
  return f;
}

const recepcion = () => inserts.find((i) => i.tabla === "warehouse_receipts_cn");

beforeEach(() => {
  rpcs = [];
  inserts = [];
  codigoDeLaBase = "WR-2026-0007";
});

describe("createReceiptAction · SDD-0491, el código lo asigna la base", () => {
  it("no pide el código por RPC: ni next_receipt_code (la serie R- de los cobros) ni next_orphan_code", async () => {
    const res = await createReceiptAction({}, formulario(false));

    expect(res.ok).toBe(true);
    expect(rpcs).not.toContain("next_receipt_code");
    expect(rpcs).not.toContain("next_orphan_code");
  });

  it("inserta la recepción sin receipt_code y devuelve el que asignó la base", async () => {
    const res = await createReceiptAction({}, formulario(false));

    expect(recepcion()).toBeDefined();
    expect(recepcion()!.valores).not.toHaveProperty("receipt_code");
    expect(res.createdReceiptCode).toBe("WR-2026-0007");
  });

  it("la huérfana tampoco pide código y usa el SIN-CODIGO- que asigna la base", async () => {
    codigoDeLaBase = "SIN-CODIGO-0003";
    const res = await createReceiptAction({}, formulario(true));

    expect(rpcs).toHaveLength(0);
    expect(recepcion()!.valores).toMatchObject({ is_orphan: true });
    expect(recepcion()!.valores).not.toHaveProperty("receipt_code");
    expect(res.createdReceiptCode).toBe("SIN-CODIGO-0003");
  });

  it("el evento 'received' nombra el código que asignó la base", async () => {
    await createReceiptAction({}, formulario(false));

    const evento = inserts.find((i) => i.tabla === "warehouse_receipt_events");
    expect(evento?.valores.description).toContain("Recepción WR-2026-0007 registrada");
  });
});
