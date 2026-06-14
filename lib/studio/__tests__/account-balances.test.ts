/**
 * Tests de saldos con rollup (SDD-0040) — `computeBalances` (pura).
 *
 * Cubre criterio de aceptación §6: "accountBalances suma solo asentado y hace
 * rollup a padres". `computeBalances` es la parte pura (sin DB) de
 * `accountBalances`; el filtro asentado lo aplica el caller, acá probamos que
 * el rollup y el saldo natural por tipo son correctos sobre un set de prueba.
 */

import { describe, it, expect } from "vitest";
import { computeBalances } from "../account-queries";
import type { Account } from "../account-types";

function acct(code: string, type: Account["type"], postable: boolean): Account {
  return {
    id: code, // usamos el code como id para legibilidad del test
    tenant_id: "t1",
    code,
    name: `Cuenta ${code}`,
    type,
    parent_id: null,
    qbo_type: null,
    subtype: null,
    is_postable: postable,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

/** CoA reducido con la cadena de grupos necesaria para el rollup. */
const ACCOUNTS: Account[] = [
  acct("1", "A", false),
  acct("1.1", "A", false),
  acct("1.1.1", "A", false),
  acct("1.1.1.2", "A", true), // Banco
  acct("1.1.2", "A", true), // Clientes
  acct("2", "P", false),
  acct("2.1", "P", false),
  acct("2.1.5", "P", true), // IVA por pagar
  acct("3", "PT", false),
  acct("3.1", "PT", true), // Capital
  acct("4", "I", false),
  acct("4.5", "I", true), // Ingresos
  acct("5", "CGS", false),
  acct("5.1", "CGS", true), // Flete comprado
  acct("6", "G", false),
  acct("6.1", "G", true), // Combustible
];

/** Postings (ya filtrados a asientos asentados por el caller). */
const POSTINGS = [
  // Aporte de capital: DR Banco 10000 / CR Capital 10000
  { account_id: "1.1.1.2", debit: 10000, credit: 0 },
  { account_id: "3.1", debit: 0, credit: 10000 },
  // Factura: DR Clientes 1160 / CR Ingresos 1000 / CR IVA 160
  { account_id: "1.1.2", debit: 1160, credit: 0 },
  { account_id: "4.5", debit: 0, credit: 1000 },
  { account_id: "2.1.5", debit: 0, credit: 160 },
  // Compra de flete (COGS): DR Flete 400 / CR Banco 400
  { account_id: "5.1", debit: 400, credit: 0 },
  { account_id: "1.1.1.2", debit: 0, credit: 400 },
  // Gasto combustible: DR Combustible 100 / CR Banco 100
  { account_id: "6.1", debit: 100, credit: 0 },
  { account_id: "1.1.1.2", debit: 0, credit: 100 },
];

describe("computeBalances · saldo natural de las hojas", () => {
  const balances = computeBalances(ACCOUNTS, POSTINGS);

  it("Banco (activo, debe-normal): 10000 − 500 = 9500", () => {
    expect(balances["1.1.1.2"]).toEqual({
      debit: 10000,
      credit: 500,
      balance: 9500,
    });
  });

  it("Clientes (activo): saldo 1160", () => {
    expect(balances["1.1.2"].balance).toBe(1160);
  });

  it("IVA por pagar (pasivo, haber-normal): saldo 160", () => {
    expect(balances["2.1.5"].balance).toBe(160);
  });

  it("Capital (patrimonio, haber-normal): saldo 10000", () => {
    expect(balances["3.1"].balance).toBe(10000);
  });

  it("Ingresos (haber-normal): saldo 1000", () => {
    expect(balances["4.5"].balance).toBe(1000);
  });

  it("Flete comprado (CGS, debe-normal): saldo 400", () => {
    expect(balances["5.1"].balance).toBe(400);
  });
});

describe("computeBalances · rollup a los padres", () => {
  const balances = computeBalances(ACCOUNTS, POSTINGS);

  it("1.1.1 acumula el saldo de Banco", () => {
    expect(balances["1.1.1"].balance).toBe(9500);
  });

  it("1.1 acumula Banco + Clientes", () => {
    expect(balances["1.1"].debit).toBe(11160); // 10000 + 1160
    expect(balances["1.1"].credit).toBe(500);
    expect(balances["1.1"].balance).toBe(10660);
  });

  it("Activo (raíz 1) = 9500 + 1160 = 10660", () => {
    expect(balances["1"].balance).toBe(10660);
  });

  it("Pasivo (raíz 2) = 160", () => {
    expect(balances["2"].balance).toBe(160);
  });

  it("Patrimonio (raíz 3) = 10000", () => {
    expect(balances["3"].balance).toBe(10000);
  });

  it("Ingresos (raíz 4) = 1000, COGS (5) = 400, Gastos (6) = 100", () => {
    expect(balances["4"].balance).toBe(1000);
    expect(balances["5"].balance).toBe(400);
    expect(balances["6"].balance).toBe(100);
  });
});

describe("computeBalances · edge cases", () => {
  it("set vacío de postings → todas las cuentas en cero", () => {
    const b = computeBalances(ACCOUNTS, []);
    expect(b["1"].balance).toBe(0);
    expect(b["1.1.1.2"]).toEqual({ debit: 0, credit: 0, balance: 0 });
  });

  it("ignora postings a cuentas inexistentes (otro tenant)", () => {
    const b = computeBalances(ACCOUNTS, [
      { account_id: "999", debit: 500, credit: 0 },
    ]);
    expect(b["1"].balance).toBe(0);
    expect(b["999"]).toBeUndefined();
  });
});

// Exponemos los fixtures para el test de reports (mismo escenario coherente).
export { ACCOUNTS, POSTINGS };
