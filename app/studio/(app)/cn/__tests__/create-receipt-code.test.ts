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
// SDD-0524 · la nota es la REAL (notaSinAvisoBodega); el fan-out, un doble.
const fanout = vi.hoisted(() => ({
  resultado: { scheduled: 0, sinDestino: [] as string[], detalle: [] as unknown[] },
}));
vi.mock("@/lib/studio/notifications/schedule-fanout", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/notifications/schedule-fanout")>();
  return {
    notaSinAviso: vi.fn(() => null),
    notaSinAvisoBodega: real.notaSinAvisoBodega,
    scheduleReceiptInWarehouse: vi.fn(async () => fanout.resultado),
  };
});
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  findOrCreateConsolidationShipment: vi.fn(async () => null),
  ensureActiveAlert: vi.fn(async () => null),
  revertAlertIfShipmentEmpty: vi.fn(async () => null),
}));

type Insert = { tabla: string; valores: Record<string, unknown> };
let rpcs: string[] = [];
let inserts: Insert[] = [];
let actualizaciones: Insert[] = [];
let compras: { id: string; sales_order_id: string; invoice_id: null }[] = [];
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
  if (tabla === "prealertas" && !unica) return { data: compras, error: null };
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
  c.update = (valores: Record<string, unknown>) => {
    actualizaciones.push({ tabla, valores });
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
  actualizaciones = [];
  compras = [];
  vi.clearAllMocks();
  codigoDeLaBase = "WR-2026-0007";
  fanout.resultado = { scheduled: 0, sinDestino: [], detalle: [] };
});

// Caracterización del alta de Studio para SDD-0713. Revisar este contrato si cambia
// la regla financiera: el vínculo con una OV existente no demuestra crear una preorden.
describe("SDD-0713 · documento que se crea al recibir en China", () => {
  it.each(["identificada", "con orden de venta", "huérfana"])("%s antes de consolidar", async (caso) => {
    if (caso === "con orden de venta") {
      compras = [{ id: "compra-inventada", sales_order_id: "orden-inventada", invoice_id: null }];
    }
    const resultado = await createReceiptAction({}, formulario(caso === "huérfana"));
    expect(resultado.ok).toBe(true);
    expect(recepcion()?.valores.status).toBe("pendiente_consolidacion");
    expect(inserts.filter(({ tabla }) => tabla === "warehouse_receipts_cn")).toHaveLength(1);
    expect(inserts.some(({ tabla }) => tabla === "warehouse_receipt_items")).toBe(true);
    expect(inserts.some(({ tabla, valores }) => tabla === "warehouse_receipt_events" && valores.event_type === "received")).toBe(true);
    if (caso === "con orden de venta") {
      expect(actualizaciones).toContainEqual({ tabla: "warehouse_receipts_cn", valores: {
        prealerta_id: "compra-inventada", sales_order_id: "orden-inventada",
      } });
    }
    expect(inserts.filter(({ tabla }) => tabla === "invoices" || tabla === "sales_orders")).toHaveLength(0);
    expect(rpcs).toEqual([]);
    const { autoInvoiceForReceipt } = await import("@/lib/studio/sales-orders/actions");
    expect(autoInvoiceForReceipt).not.toHaveBeenCalled();
  });
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

describe("createReceiptAction · la nota del aviso dice el motivo real (SDD-0524)", () => {
  it("un aviso descartado por duplicado se anota como tal, no como «sin envío abierto»", async () => {
    fanout.resultado = {
      scheduled: 0,
      sinDestino: ["DTD-1001"],
      detalle: [{ markbox: "DTD-1001", motivo: "ya_avisado", ancla: "ENV-7" }],
    };
    await createReceiptAction({}, formulario(false));

    const notas = inserts.filter(
      (i) => i.tabla === "warehouse_receipt_events" && i.valores.event_type === "note",
    );
    expect(notas).toHaveLength(1);
    expect(String(notas[0].valores.description)).toContain("ENV-7");
    expect(String(notas[0].valores.description)).not.toContain("no tiene un envío abierto");
  });

  it("si nadie se quedó sin aviso, no hay nota", async () => {
    await createReceiptAction({}, formulario(false));
    expect(inserts.filter((i) => i.valores.event_type === "note")).toEqual([]);
  });
});
