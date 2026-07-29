import { describe, it, expect } from "vitest";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";

function inv(over: Partial<PortalInvoiceRow> = {}): PortalInvoiceRow {
  return {
    id: "i1",
    code: "F-2026-0001",
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 0,
    issuedAt: "2026-07-01",
    dueDate: "2026-07-31",
    shipmentCode: "DTD-2026-0311",
    ...over,
  };
}

describe("buildStatementLedger · movimientos", () => {
  it("una factura sin pagos deja UN cargo y el saldo es el total", () => {
    const led = buildStatementLedger([inv()]);
    expect(led.moves).toHaveLength(1);
    expect(led.moves[0]).toMatchObject({
      date: "2026-07-01",
      kind: "cargo",
      concept: "Factura F-2026-0001",
      reference: "DTD-2026-0311",
      amount: 1000,
      balance: 1000,
    });
    expect(led.balance).toBe(1000);
  });

  it("un pago parcial agrega un abono y baja el saldo corrido", () => {
    const led = buildStatementLedger([inv({ paid: 400 })]);
    expect(led.moves.map((m) => m.kind)).toEqual(["cargo", "abono"]);
    expect(led.moves[1]).toMatchObject({
      date: "2026-07-31",
      concept: "Abono · F-2026-0001",
      amount: 400,
      balance: 600,
    });
    expect(led.totalCargo).toBe(1000);
    expect(led.totalAbono).toBe(400);
    expect(led.balance).toBe(600);
  });

  it("una factura pagada entera deja el saldo en 0", () => {
    const led = buildStatementLedger([inv({ paid: 1000 })]);
    expect(led.moves.at(-1)?.balance).toBe(0);
    expect(led.balance).toBe(0);
  });

  it("un sobrepago da saldo NEGATIVO (no se recorta a 0)", () => {
    // Los KPIs de Finanzas clampean el saldo a 0 porque muestran "lo que debes".
    // El ledger NO: es un libro, y un saldo a favor tiene que verse.
    const led = buildStatementLedger([inv({ total: 1000, paid: 1200 })]);
    expect(led.balance).toBe(-200);
    expect(led.moves.at(-1)?.balance).toBe(-200);
  });

  it("el abono NO se emite cuando paid es 0", () => {
    const led = buildStatementLedger([inv({ paid: 0 })]);
    expect(led.moves.every((m) => m.kind === "cargo")).toBe(true);
  });

  it("lista vacía → ledger vacío en USD", () => {
    const led = buildStatementLedger([]);
    expect(led.moves).toEqual([]);
    expect(led.balance).toBe(0);
    expect(led.currency).toBe("USD");
    expect(led.mixedCurrencies).toBe(false);
  });
});

describe("buildStatementLedger · orden", () => {
  it("ordena por fecha aunque las facturas vengan al revés", () => {
    // listMyInvoices ordena por issued_at DESCENDENTE — el ledger tiene que
    // invertirlo o el saldo corrido se lee al revés.
    const led = buildStatementLedger([
      inv({ id: "b", code: "F-2026-0002", issuedAt: "2026-07-10", total: 500 }),
      inv({ id: "a", code: "F-2026-0001", issuedAt: "2026-07-01", total: 1000 }),
    ]);
    expect(led.moves.map((m) => m.date)).toEqual(["2026-07-01", "2026-07-10"]);
    expect(led.moves.map((m) => m.balance)).toEqual([1000, 1500]);
  });

  it("a igual fecha el cargo va ANTES que su abono", () => {
    // Sin el desempate por tipo, el abono saldría primero y el saldo corrido
    // pasaría por un negativo que después "se arregla".
    const led = buildStatementLedger([
      inv({ total: 800, paid: 800, issuedAt: "2026-07-05", dueDate: "2026-07-05" }),
    ]);
    expect(led.moves.map((m) => m.kind)).toEqual(["cargo", "abono"]);
    expect(led.moves.map((m) => m.balance)).toEqual([800, 0]);
  });

  it("las fechas nulas se van al FINAL y no rompen el orden", () => {
    const led = buildStatementLedger([
      inv({ id: "sin", code: "F-2026-0009", issuedAt: null, total: 300 }),
      inv({ id: "con", code: "F-2026-0001", issuedAt: "2026-07-01", total: 1000 }),
    ]);
    expect(led.moves.map((m) => m.date)).toEqual(["2026-07-01", null]);
    expect(led.moves.map((m) => m.balance)).toEqual([1000, 1300]);
  });
});

describe("buildStatementLedger · monedas", () => {
  it("se queda con la moneda DOMINANTE y avisa que hay otras", () => {
    const led = buildStatementLedger([
      inv({ id: "u1", code: "F-2026-0001", currency: "USD", total: 1000 }),
      inv({ id: "u2", code: "F-2026-0002", currency: "USD", total: 500 }),
      inv({ id: "e1", code: "F-2026-0003", currency: "VES", total: 900 }),
    ]);
    expect(led.currency).toBe("USD");
    expect(led.mixedCurrencies).toBe(true);
    expect(led.moves).toHaveLength(2);
    expect(led.totalCargo).toBe(1500);
  });

  it("dominante es la de MAYOR total facturado, no la más frecuente", () => {
    const led = buildStatementLedger([
      inv({ id: "u1", code: "F-2026-0001", currency: "USD", total: 100 }),
      inv({ id: "u2", code: "F-2026-0002", currency: "USD", total: 100 }),
      inv({ id: "e1", code: "F-2026-0003", currency: "VES", total: 5000 }),
    ]);
    expect(led.currency).toBe("VES");
    expect(led.moves).toHaveLength(1);
  });

  it("una sola moneda NO marca mixedCurrencies", () => {
    const led = buildStatementLedger([inv(), inv({ id: "2", code: "F-2026-0002" })]);
    expect(led.mixedCurrencies).toBe(false);
  });
});

describe("buildStatementLedger · invariante", () => {
  it("el saldo final CUADRA con Σ(total) − Σ(paid) de esa moneda", () => {
    const rows = [
      inv({ id: "a", code: "F-2026-0001", total: 1200.5, paid: 300.25, issuedAt: "2026-06-02" }),
      inv({ id: "b", code: "F-2026-0002", total: 880, paid: 880, issuedAt: "2026-06-20" }),
      inv({ id: "c", code: "F-2026-0003", total: 415.75, paid: 0, issuedAt: "2026-07-11" }),
      inv({ id: "d", code: "F-2026-0004", currency: "VES", total: 90, paid: 1 }),
    ];
    const led = buildStatementLedger(rows);
    // Contra la moneda que el ledger eligió, no contra una hardcodeada: si la
    // regla de dominancia cambia, este test sigue midiendo el invariante real.
    const scoped = rows.filter((r) => r.currency === led.currency);
    const esperado =
      scoped.reduce((s, r) => s + r.total, 0) - scoped.reduce((s, r) => s + r.paid, 0);

    expect(led.balance).toBeCloseTo(esperado, 6);
    // El último movimiento del saldo corrido ES el saldo final.
    expect(led.moves.at(-1)?.balance).toBeCloseTo(esperado, 6);
  });
});
