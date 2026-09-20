// @vitest-environment node
/**
 * Tests de reportes contables (SDD-0040) — `profitAndLoss` / `balanceSheet`.
 *
 * Cubre criterio de aceptación §6: "profitAndLoss/balanceSheet dan números
 * coherentes sobre un set de prueba (balance cuadra)". Reusa el mismo escenario
 * que el test de saldos (aporte de capital + factura + COGS + gasto).
 */

import { describe, it, expect } from "vitest";
import { computeBalances } from "../account-queries";
import { profitAndLoss, balanceSheet } from "../accounting/reports";
import { ACCOUNTS, POSTINGS } from "./account-balances.test";

const balances = computeBalances(ACCOUNTS, POSTINGS);

describe("profitAndLoss", () => {
  const pnl = profitAndLoss(ACCOUNTS, balances);

  it("ingresos = 1000", () => {
    expect(pnl.income).toBe(1000);
  });
  it("costo de ventas = 400", () => {
    expect(pnl.cogs).toBe(400);
  });
  it("utilidad bruta = ingresos − cogs = 600", () => {
    expect(pnl.grossProfit).toBe(600);
  });
  it("gastos = 100", () => {
    expect(pnl.expenses).toBe(100);
  });
  it("utilidad neta = bruta − gastos = 500", () => {
    expect(pnl.netIncome).toBe(500);
  });
});

describe("balanceSheet", () => {
  const bs = balanceSheet(ACCOUNTS, balances);

  it("activo = 10660", () => {
    expect(bs.assets).toBe(10660);
  });
  it("pasivo = 160", () => {
    expect(bs.liabilities).toBe(160);
  });
  it("patrimonio = 10000", () => {
    expect(bs.equity).toBe(10000);
  });
  it("resultado del ejercicio = netIncome del P&L = 500", () => {
    expect(bs.netIncome).toBe(500);
  });

  it("balance CUADRA: activo = pasivo + patrimonio + resultado", () => {
    // 10660 = 160 + 10000 + 500
    expect(bs.ok).toBe(true);
    expect(bs.difference).toBe(0);
  });
});

describe("reports · sin movimientos", () => {
  const empty = computeBalances(ACCOUNTS, []);
  it("P&L en cero", () => {
    expect(profitAndLoss(ACCOUNTS, empty)).toEqual({
      income: 0,
      cogs: 0,
      grossProfit: 0,
      expenses: 0,
      netIncome: 0,
    });
  });
  it("balance cuadra en cero (0 = 0 + 0 + 0)", () => {
    const bs = balanceSheet(ACCOUNTS, empty);
    expect(bs.ok).toBe(true);
    expect(bs.assets).toBe(0);
  });
});
