/**
 * SDD-0558 · El saldo del cliente: reglas puras (`client-account.ts`) y su
 * lectura (`client-queries.ts`).
 *
 * La regla del saldo vive en SQL (0492) y la prueba su contrato en PGlite. Acá
 * se prueba lo que TypeScript hace con las filas: no mezclar monedas, no
 * recalcular «hoy», fallar cerrado ante una fila inválida, decidir quién ve
 * qué, y degradar sin inventar un 0 cuando la lectura falla.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coerceClientOutstandingRows,
  cuentaParaSaldo,
  diasEntre,
  fechaCorta,
  puedeVerEstadoDeCuenta,
  puedeVerSaldoCliente,
  resumirCuentaCliente,
  SaldoClienteError,
  tieneSaldoAbierto,
  type ClientOutstandingRow,
} from "../client-account";
import {
  countShipmentsInProgress,
  getClientAccountState,
  listClientOutstanding,
} from "../client-queries";
import { dobleListados, todoVivo } from "./listados-double";

function fila(over: Partial<ClientOutstandingRow> = {}): ClientOutstandingRow {
  return {
    client_id: "c1",
    markboxes: ["DTD-0001"],
    currency: "USD",
    open_amount: 0,
    overdue_amount: 0,
    open_invoices: 0,
    overdue_invoices: 0,
    oldest_overdue_due_date: null,
    last_payment_on: null,
    as_of: "2026-10-19",
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resumirCuentaCliente", () => {
  it("no suma USD con VES y ordena USD, VES, USDT, CNY", () => {
    const cuenta = resumirCuentaCliente(
      [
        fila({ currency: "CNY", open_amount: 5 }),
        fila({ currency: "VES", open_amount: 900 }),
        fila({ currency: "USD", open_amount: 320 }),
        fila({ currency: "USDT", open_amount: 7 }),
      ],
      "c1",
    );
    expect(cuenta?.saldos.map((s) => [s.currency, s.abierto])).toEqual([
      ["USD", 320],
      ["VES", 900],
      ["USDT", 7],
      ["CNY", 5],
    ]);
  });

  it("ignora las filas de otro cliente y devuelve null sin fila propia", () => {
    expect(resumirCuentaCliente([fila({ client_id: "otro", open_amount: 99 })], "c1")).toBeNull();
    const cuenta = resumirCuentaCliente(
      [fila({ open_amount: 10 }), fila({ client_id: "otro", open_amount: 99 })],
      "c1",
    );
    expect(cuenta?.saldos).toHaveLength(1);
    expect(cuenta?.saldos[0].abierto).toBe(10);
  });

  it("la fila semilla (currency null) no es un saldo, pero conserva los códigos", () => {
    const cuenta = resumirCuentaCliente(
      [fila({ currency: null, markboxes: ["DTD-0001", "DTD-0100"] })],
      "c1",
    );
    expect(cuenta?.saldos).toEqual([]);
    expect(cuenta?.markboxes).toEqual(["DTD-0001", "DTD-0100"]);
    expect(cuenta?.asOf).toBe("2026-10-19");
  });

  it("el último pago es el más reciente entre monedas", () => {
    const cuenta = resumirCuentaCliente(
      [
        fila({ currency: "USD", last_payment_on: "2026-09-30" }),
        fila({ currency: "VES", last_payment_on: "2026-10-05" }),
        fila({ currency: "USDT", last_payment_on: null }),
      ],
      "c1",
    );
    expect(cuenta?.ultimoPago).toBe("2026-10-05");
  });

  it("los días vencidos se cuentan contra as_of, no contra el reloj, y el tramo es el de Reportes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    try {
      const cuenta = resumirCuentaCliente(
        [fila({ overdue_amount: 50, oldest_overdue_due_date: "2026-09-09", as_of: "2026-10-19" })],
        "c1",
      );
      expect(cuenta?.saldos[0].diasVencido).toBe(40);
      expect(cuenta?.saldos[0].tramo).toBe("b31_60");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sin vencido no hay días ni tramo", () => {
    const cuenta = resumirCuentaCliente([fila({ open_amount: 10 })], "c1");
    expect(cuenta?.saldos[0].diasVencido).toBeNull();
    expect(cuenta?.saldos[0].tramo).toBeNull();
  });
});

describe("coerceClientOutstandingRows · falla cerrado", () => {
  const cruda = {
    client_id: "c1",
    markboxes: ["DTD-0001"],
    currency: "USD",
    open_amount: "320.00",
    overdue_amount: 270,
    open_invoices: 3,
    overdue_invoices: 2,
    oldest_overdue_due_date: "2026-09-09",
    last_payment_on: null,
    as_of: "2026-10-19",
  };

  it("acepta números como texto (numeric de PostgREST) y null", () => {
    expect(coerceClientOutstandingRows([cruda])[0].open_amount).toBe(320);
    expect(coerceClientOutstandingRows(null)).toEqual([]);
  });

  it.each([
    ["NaN", { open_amount: "NaN" }],
    ["un negativo", { overdue_amount: -1 }],
    ["un conteo fraccionario", { open_invoices: 1.5 }],
    ["una moneda desconocida", { currency: "EUR" }],
    ["una fecha de corte inválida", { as_of: "2026-02-30" }],
    ["un vencimiento que no es fecha", { oldest_overdue_due_date: "ayer" }],
    ["códigos que no son texto", { markboxes: [1] }],
    ["sin cliente", { client_id: "" }],
  ])("rechaza %s", (_nombre, cambio) => {
    expect(() => coerceClientOutstandingRows([{ ...cruda, ...cambio }])).toThrow(SaldoClienteError);
  });

  it("rechaza una respuesta que no es lista", () => {
    expect(() => coerceClientOutstandingRows({ client_id: "c1" })).toThrow(SaldoClienteError);
  });
});

describe("tieneSaldoAbierto · el Sí/No de Kommo", () => {
  it("abierto 0 en todas las monedas es No; algo abierto en VES es Sí; la semilla no cuenta", () => {
    expect(tieneSaldoAbierto([fila({ open_amount: 0 }), fila({ currency: "VES", open_amount: 0 })])).toBe(false);
    expect(tieneSaldoAbierto([fila({ open_amount: 0 }), fila({ currency: "VES", open_amount: 0.01 })])).toBe(true);
    expect(tieneSaldoAbierto([fila({ currency: null, open_amount: 5 })])).toBe(false);
  });
});

describe("quién ve qué (decisión 14 de Sam)", () => {
  it("el saldo lo ve todo el que ve clientes; con override revocado, solo finanzas", () => {
    for (const rol of ["admin", "accounting", "commercial", "operations", "support"] as const) {
      expect(puedeVerSaldoCliente(rol, {})).toBe(true);
    }
    expect(puedeVerSaldoCliente("warehouse", {})).toBe(false);
    expect(puedeVerSaldoCliente("marketing", {})).toBe(false);
    expect(puedeVerSaldoCliente(null, {})).toBe(false);
    expect(puedeVerSaldoCliente("support", { "support:clients": { view: false, edit: false } })).toBe(false);
    expect(puedeVerSaldoCliente("warehouse", { "warehouse:clients": { view: true, edit: false } })).toBe(true);
    expect(puedeVerSaldoCliente("accounting", { "accounting:clients": { view: false, edit: false } })).toBe(true);
  });

  it("el estado de cuenta, solo con el módulo invoices: commercial no, accounting sí", () => {
    expect(puedeVerEstadoDeCuenta("commercial")).toBe(false);
    expect(puedeVerEstadoDeCuenta("operations")).toBe(false);
    expect(puedeVerEstadoDeCuenta("support")).toBe(false);
    expect(puedeVerEstadoDeCuenta("accounting")).toBe(true);
    expect(puedeVerEstadoDeCuenta("admin")).toBe(true);
    expect(puedeVerEstadoDeCuenta(null)).toBe(false);
  });
});

describe("fechas sin hora", () => {
  it("fechaCorta formatea sin Date: 2026-10-15 → 15 oct 2026", () => {
    expect(fechaCorta("2026-10-15")).toBe("15 oct 2026");
    expect(fechaCorta("2026-01-01")).toBe("1 ene 2026");
    expect(fechaCorta("2026-12-31")).toBe("31 dic 2026");
  });

  it("fechaCorta no corre el día aunque Date local estuviera en una zona negativa", () => {
    const toLocale = vi.spyOn(Date.prototype, "toLocaleDateString");
    expect(fechaCorta("2026-10-01")).toBe("1 oct 2026");
    expect(toLocale).not.toHaveBeenCalled();
  });

  it("diasEntre y cuentaParaSaldo", () => {
    expect(diasEntre("2026-10-01", "2026-10-19")).toBe(18);
    expect(cuentaParaSaldo("borrador")).toBe(false);
    expect(cuentaParaSaldo("anulada")).toBe(false);
    expect(cuentaParaSaldo("vencida")).toBe(true);
  });
});

describe("countShipmentsInProgress · con el doble que aplica filtros", () => {
  // Fixture INFELIZ: el eliminado en tránsito es del mismo código y estado
  // activo; solo el `deleted_at` lo deja afuera.
  const tablas = {
    shipments: [
      { id: "s1", client_markbox: "DTD-0001", status: "in_transit", deleted_at: null },
      { id: "s2", client_markbox: "DTD-0001", status: "in_transit", deleted_at: "2026-10-10T00:00:00Z" },
      { id: "s3", client_markbox: "DTD-0001", status: "delivered", deleted_at: null },
      { id: "s4", client_markbox: "DTD-0001", status: "draft", deleted_at: null },
      { id: "s5", client_markbox: "DTD-0001", status: "cancelled", deleted_at: null },
      { id: "s6", client_markbox: "DTD-0100", status: "exception", deleted_at: null },
      { id: "s7", client_markbox: "DTD-0999", status: "in_transit", deleted_at: null },
    ],
  };

  it("cuenta los vivos en curso de TODOS los códigos y nada de otro cliente", async () => {
    const { client, filtros } = dobleListados(tablas);
    expect(await countShipmentsInProgress(client, ["DTD-0001", "DTD-0100"])).toBe(2);
    expect(filtros).toContainEqual({ table: "shipments", op: "is", col: "deleted_at", val: null });
    expect(filtros).toContainEqual({
      table: "shipments", op: "not.in", col: "status", val: "(delivered,cancelled,draft)",
    });
  });

  it("sin el filtro de borrados contaría 3 (control del doble)", async () => {
    const { client } = dobleListados(todoVivo(tablas));
    expect(await countShipmentsInProgress(client, ["DTD-0001", "DTD-0100"])).toBe(3);
  });

  it("sin códigos no consulta", async () => {
    const from = vi.fn();
    expect(await countShipmentsInProgress({ from } as unknown as SupabaseClient, [" "])).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
});

function rpcCliente(
  respuesta: (args: { p_client_ids: string[] }) => { data: unknown; error: { message: string; code?: string } | null },
) {
  const rpc = vi.fn(async (_fn: string, args: { p_client_ids: string[] }) => respuesta(args));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("listClientOutstanding", () => {
  it("parte 450 ids en lotes de 200, 200 y 50, sin repetir", async () => {
    const { client, rpc } = rpcCliente(() => ({ data: [], error: null }));
    const ids = Array.from({ length: 450 }, (_, i) => `c${i}`);
    await listClientOutstanding(client, [...ids, "c0", ""]);
    expect(rpc.mock.calls.map(([fn, a]) => [fn, a.p_client_ids.length])).toEqual([
      ["client_outstanding", 200],
      ["client_outstanding", 200],
      ["client_outstanding", 50],
    ]);
  });

  it("un error lleva su código y el mensaje empieza con «saldo:»", async () => {
    const { client } = rpcCliente(() => ({ data: null, error: { message: "permiso", code: "42501" } }));
    const error = await listClientOutstanding(client, ["c1"]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SaldoClienteError);
    expect((error as SaldoClienteError).code).toBe("42501");
    expect((error as SaldoClienteError).message).toBe("saldo: permiso");
  });
});

describe("getClientAccountState · nunca lanza ni inventa un 0", () => {
  const CLIENTE = { id: "c1", markbox: "DTD-0001" };

  function cliente(opts: {
    rpc?: () => { data: unknown; error: { message: string; code?: string } | null };
    embarques?: { count: number | null; error: { message: string } | null };
  }) {
    const rpc = vi.fn(async () => (opts.rpc ? opts.rpc() : { data: [], error: null }));
    const inCol = vi.fn();
    const chain: Record<string, unknown> = {
      select: () => chain,
      in: (col: string, vals: string[]) => {
        inCol(col, vals);
        return chain;
      },
      is: () => chain,
      not: async () => opts.embarques ?? { count: 0, error: null },
    };
    const from = vi.fn(() => chain);
    return { client: { rpc, from } as unknown as SupabaseClient, rpc, inCol };
  }

  it("sin permiso no pide el saldo y cuenta embarques con los códigos conocidos", async () => {
    const { client, rpc, inCol } = cliente({ embarques: { count: 2, error: null } });
    const estado = await getClientAccountState(client, CLIENTE, {
      puedeVerSaldo: false,
      codigosConocidos: ["DTD-0100"],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(estado).toEqual({ tipo: "sin-permiso", markboxes: ["DTD-0001", "DTD-0100"], embarquesEnCurso: 2 });
    expect(inCol).toHaveBeenCalledWith("client_markbox", ["DTD-0001", "DTD-0100"]);
  });

  it("un 42501 de la base tampoco pinta dinero", async () => {
    const { client } = cliente({ rpc: () => ({ data: null, error: { message: "no", code: "42501" } }) });
    const estado = await getClientAccountState(client, CLIENTE, { puedeVerSaldo: true, codigosConocidos: [] });
    expect(estado.tipo).toBe("sin-permiso");
  });

  it("otro error da «no se pudo calcular» con una referencia que queda en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = cliente({ rpc: () => ({ data: null, error: { message: "timeout", code: "57014" } }) });
    const estado = await getClientAccountState(client, CLIENTE, { puedeVerSaldo: true, codigosConocidos: [] });
    expect(estado.tipo).toBe("error");
    const referencia = estado.tipo === "error" ? estado.referencia : "";
    expect(referencia).toMatch(/^[0-9a-f]{8}$/);
    expect(log.mock.calls.some((c) => String(c[0]).includes(`ref=${referencia}`))).toBe(true);
  });

  it("una fila inválida es un error, no un saldo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = cliente({ rpc: () => ({ data: [{ client_id: "c1", open_amount: "NaN" }], error: null }) });
    const estado = await getClientAccountState(client, CLIENTE, { puedeVerSaldo: true, codigosConocidos: [] });
    expect(estado.tipo).toBe("error");
  });

  it("con saldo, cuenta los embarques con TODOS los códigos que trajo la 0492", async () => {
    const { client, inCol } = cliente({
      rpc: () => ({
        data: [{ ...fila({ open_amount: 320, markboxes: ["DTD-0001", "DTD-0002", "DTD-0100"] }) }],
        error: null,
      }),
      embarques: { count: 4, error: null },
    });
    const estado = await getClientAccountState(client, CLIENTE, { puedeVerSaldo: true, codigosConocidos: [] });
    expect(estado.tipo).toBe("ok");
    expect(estado.tipo === "ok" && estado.cuenta.embarquesEnCurso).toBe(4);
    expect(inCol).toHaveBeenCalledWith("client_markbox", ["DTD-0001", "DTD-0002", "DTD-0100"]);
  });

  it("si el conteo de embarques falla, el saldo sale igual y el conteo en null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = cliente({
      rpc: () => ({ data: [fila({ open_amount: 5 })], error: null }),
      embarques: { count: null, error: { message: "caído" } },
    });
    const estado = await getClientAccountState(client, CLIENTE, { puedeVerSaldo: true, codigosConocidos: [] });
    expect(estado.tipo === "ok" && estado.cuenta.saldos[0].abierto).toBe(5);
    expect(estado.tipo === "ok" && estado.cuenta.embarquesEnCurso).toBeNull();
  });
});
