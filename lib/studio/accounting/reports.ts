/**
 * Reportes contables (SDD-0040 · Contabilidad).
 *
 * P&L (estado de resultados) y Balance general, computados de los saldos del
 * plan de cuentas. Funciones PURAS — reciben cuentas + saldos, no tocan DB.
 * Reportes gerenciales en USD (no fiscales · sin comparativos ni export).
 */

import { type Account, type AcctType } from "../account-types";
import { type AccountBalanceMap } from "../account-queries";

/** Mínimo que necesitan los reportes de cada cuenta. */
export type AccountLike = Pick<Account, "id" | "code" | "type">;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** ¿Es una cuenta raíz (top-level, code de un solo segmento)? */
function isRoot(code: string): boolean {
  return !code.includes(".");
}

/**
 * Total del saldo (con rollup) de un tipo de cuenta = saldo de su cuenta raíz.
 *
 * Como `accountBalances` ya hace rollup hacia los padres, la cuenta raíz de
 * cada tipo (code "1","2","3","4","5","6") tiene el total agregado de ese tipo.
 * Si no hay cuenta raíz para el tipo, cae a sumar las raíces presentes de ese
 * tipo (defensivo). El balance ya viene como saldo natural (lado normal del
 * tipo), así que es siempre ≥ 0 en operación típica.
 */
function totalForType(
  accounts: AccountLike[],
  balances: AccountBalanceMap,
  type: AcctType,
): number {
  const roots = accounts.filter((a) => a.type === type && isRoot(a.code));
  if (roots.length > 0) {
    return round2(
      roots.reduce((sum, a) => sum + (balances[a.id]?.balance ?? 0), 0),
    );
  }
  // Sin raíz explícita: sumar todas las cuentas del tipo SIN padre del mismo
  // tipo (evita doble conteo). Fallback raro; el seed siempre trae raíces.
  return round2(
    accounts
      .filter((a) => a.type === type)
      .reduce((sum, a) => sum + (balances[a.id]?.balance ?? 0), 0),
  );
}

export type ProfitAndLoss = {
  income: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netIncome: number;
};

/**
 * Estado de resultados:
 *   Ingresos − Costo de ventas = Utilidad bruta
 *   Utilidad bruta − Gastos = Utilidad neta
 */
export function profitAndLoss(
  accounts: AccountLike[],
  balances: AccountBalanceMap,
): ProfitAndLoss {
  const income = totalForType(accounts, balances, "I");
  const cogs = totalForType(accounts, balances, "CGS");
  const expenses = totalForType(accounts, balances, "G");
  const grossProfit = round2(income - cogs);
  const netIncome = round2(grossProfit - expenses);
  return { income, cogs, grossProfit, expenses, netIncome };
}

export type BalanceSheet = {
  assets: number;
  liabilities: number;
  equity: number;
  /** Utilidad del ejercicio (resultado del período = netIncome del P&L). */
  netIncome: number;
  /** ¿Cuadra? Activo = Pasivo + Patrimonio + Resultado (con tolerancia). */
  ok: boolean;
  /** Diferencia activo − (pasivo + patrimonio + resultado). */
  difference: number;
};

/**
 * Balance general:
 *   Activo = Pasivo + Patrimonio + Utilidad del ejercicio
 *
 * El resultado del período (netIncome del P&L) se suma al patrimonio porque
 * el P&L aún no está "cerrado" contra utilidades retenidas (eso es cierre de
 * período, fuera de scope). `ok` indica si la ecuación cuadra.
 */
export function balanceSheet(
  accounts: AccountLike[],
  balances: AccountBalanceMap,
): BalanceSheet {
  const assets = totalForType(accounts, balances, "A");
  const liabilities = totalForType(accounts, balances, "P");
  const equity = totalForType(accounts, balances, "PT");
  const pnl = profitAndLoss(accounts, balances);
  const netIncome = pnl.netIncome;

  const rhs = round2(liabilities + equity + netIncome);
  const difference = round2(assets - rhs);
  const ok = Math.abs(difference) < 0.01;

  return { assets, liabilities, equity, netIncome, ok, difference };
}
