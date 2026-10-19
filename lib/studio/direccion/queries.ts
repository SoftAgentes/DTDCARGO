/**
 * Dirección · Tablero ejecutivo (SDD-0048) — la "cabina del dueño".
 *
 * Read-only, admin-only. NO genera dato nuevo: COMPONE agregados que los
 * módulos de finanzas / operación / comercial ya producen y testean. No hay
 * tablas nuevas ni migración (decisión §4.1). Toda la lógica vive acá como
 * funciones puras + una función de composición que recibe el SupabaseClient.
 *
 * Agregados reusados (NO se recalcula cálculo financiero):
 *  - P&L: profitAndLoss(accounts, balances)  (accounting/reports.ts) — del mayor
 *  - Ingreso del período: ingresoDelPeriodo (accounting/libro-control-queries)
 *    — la cifra OFICIAL (SDD-0557), la misma de Contabilidad, Reportes y el
 *    Dashboard; el mayor queda al lado como control
 *  - Caja consolidada USD: suma de balances de cuentas isCashAccount (payment-queries)
 *  - CxC: collectionKpis (payment-queries · módulo Cobranzas)
 *  - CxP + caja: treasuryKpis (treasury/bill-queries) + listBills para el forecast
 *  - Naviera: navieraKpis (naviera/queries) + listSailings para el próximo cut-off
 *  - Operación: getOperationalCounts (dashboard-queries · RPC)
 *  - Pipeline comercial: listKommoLeads (kommo-queries · etapas abiertas)
 *
 * Las alertas se DERIVAN en composición (no se persisten, §4.4): cada una con
 * su href de deep-link al módulo de origen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { accountBalances, listAccounts } from "../account-queries";
import { profitAndLoss } from "../accounting/reports";
import {
  controlDelMayor,
  type IngresoPeriodo,
} from "../accounting/ingreso-periodo";
import { ingresoDelPeriodo } from "../accounting/libro-control-queries";
import { isCashAccount } from "../payment-queries";
import { collectionKpis } from "../payment-queries";
import { listBills, treasuryKpis } from "../treasury/bill-queries";
import { billBalance } from "../treasury/types";
import { navieraKpis, listSailings } from "../naviera/queries";
import { getOperationalCounts } from "../dashboard-queries";
import { listKommoLeads } from "../kommo-queries";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un monto USD entero corto ($12,345). Negativos usan el minus
 * tipográfico U+2212 (−), no el guion ASCII. Fuente única del módulo: la usan
 * el page y las cards (no duplicar el helper · SDD-0048 §9).
 */

// ── Tipos de salida ────────────────────────────────────────────

/** KPIs financieros (4 cards superiores). */
export type FinanceKpis = {
  /**
   * Ingreso facturado del mes (cifra oficial, ingreso-periodo.ts), con su
   * rango, el desglose propio/terceros y el control contra la 4.5 del mayor.
   */
  ingreso: IngresoPeriodo;
  /** Utilidad neta del mes, del LIBRO (P&L del mayor). */
  utilidad: number;
  /**
   * Margen neto % del LIBRO: utilidad del mayor / ingresos del mayor. No se
   * divide por el facturado: mezclar fuentes da un margen falso mientras el
   * mayor no cuadre. 0 si el mayor no tiene ingresos.
   */
  margenPct: number;
  /** Caja + bancos consolidado (USD funcional). */
  caja: number;
  /** Posición neta = caja + CxC − CxP. */
  posicionNeta: number;
};

/** Salud financiera (CxC / CxP / vencido + cobertura). */
export type FinanceHealth = {
  /** Cuentas por cobrar (saldo de facturas vivas con saldo). */
  cxc: number;
  /** Cuentas por pagar (saldo de CxP vivas). */
  cxp: number;
  /** Vencido (CxC vencida + CxP vencida). */
  vencido: number;
  /** Cobertura de pagos con caja: caja / CxP * 100 (100 si no hay CxP). */
  coberturaPct: number;
};

/** Operación (embarques + naviera). */
export type OpsSummary = {
  /** Embarques activos (en tránsito + en aduana). */
  activos: number;
  /** Contenedores consolidando. */
  consolidando: number;
  /** Carga suelta CN por consolidar (CBM). */
  looseCbm: number;
  /** Itinerarios con espacio (abiertos / cutoff). */
  openSailings: number;
  /** Días hasta el próximo cut-off (null si no hay salidas abiertas). */
  cutoffDays: number | null;
  /** Nave del próximo cut-off (label corto para el sub). */
  cutoffVessel: string | null;
};

/** Comercial (pipeline CRM). */
export type CommercialSummary = {
  /** Suma de price de leads en etapas abiertas (sin closed_at). */
  pipeline: number;
  /** Cantidad de leads activos (abiertos). */
  leadsActivos: number;
};

/** Una barra del forecast de salidas (CxP venciendo en una semana). */
export type ForecastWeek = {
  /** Etiqueta de la semana ("Esta semana", "Sem. 2", …). */
  label: string;
  /** Inicio de la ventana (YYYY-MM-DD, inclusive). */
  from: string;
  /** Fin de la ventana (YYYY-MM-DD, exclusive). */
  to: string;
  /** Saldo de CxP que vence en la ventana (USD). */
  usd: number;
};

/** Tono semántico de una alerta. */
export type AlertTone = "danger" | "warning" | "info" | "success";

/** Una alerta derivada con deep-link al módulo de origen. */
export type DireccionAlert = {
  tone: AlertTone;
  /** Nombre de icono del set window/Icon (string libre, lo resuelve la UI). */
  icon: string;
  /** Texto de la alerta. */
  text: string;
  /** Ruta del Studio a la que deep-linkea (null = informativa, sin link). */
  href: string | null;
};

/** El payload completo del tablero. */
export type DireccionData = {
  finance: FinanceKpis;
  health: FinanceHealth;
  ops: OpsSummary;
  commercial: CommercialSummary;
  forecast: ForecastWeek[];
  alerts: DireccionAlert[];
};

// ── Helpers puros (testeables sin DB) ──────────────────────────

/** Margen neto % = utilidad / ingresos * 100. 0 si no hay ingresos. */
export function netMarginPct(ingresos: number, utilidad: number): number {
  if (!ingresos) return 0;
  return round2((utilidad / ingresos) * 100);
}

/** Posición neta = caja + CxC − CxP. */
export function netPosition(caja: number, cxc: number, cxp: number): number {
  return round2(caja + cxc - cxp);
}

/**
 * Cobertura de pagos con caja = caja / CxP * 100. Si no hay CxP → 100
 * (no hay nada que cubrir). No clampea (la UI clampea el ancho de la barra).
 */
export function paymentCoveragePct(caja: number, cxp: number): number {
  if (cxp <= 0) return 100;
  return round2((caja / cxp) * 100);
}

/** Días entre `dateIso` (YYYY-MM-DD) y `today`. Positivo = futuro. */
export function daysUntil(
  dateIso: string,
  today: string = new Date().toISOString().slice(0, 10),
): number {
  const target = new Date(dateIso + "T00:00:00Z").getTime();
  const now = new Date(today + "T00:00:00Z").getTime();
  return Math.round((target - now) / 86400000);
}

/** Mínimo que el forecast necesita de una CxP: saldo + vencimiento + estado. */
export type ForecastBill = {
  status: string;
  total_amount: number;
  paid_amount: number;
  due_date: string | null;
};

/**
 * Forecast simple de salidas · 4 semanas (decisión founder §3 / §7.1).
 *
 * Agrupa el SALDO de las CxP vivas por la semana en que vencen (`due_date`),
 * en 4 ventanas de 7 días desde `today`. PURA — testeable sin DB.
 *
 *  - Semana 0 ("Esta semana"): incluye lo YA vencido y lo que vence en [today, +7).
 *  - Semanas 1..3: ventanas de 7 días consecutivas.
 *  - CxP anuladas / sin saldo / sin due_date se ignoran.
 *  - CxP que vencen después de las 4 semanas no entran (V1 = horizonte 4 sem).
 */
export function buildForecast(
  bills: ForecastBill[],
  today: string = new Date().toISOString().slice(0, 10),
): ForecastWeek[] {
  const labels = ["Esta semana", "Sem. 2", "Sem. 3", "Sem. 4"];
  const weeks: ForecastWeek[] = labels.map((label, i) => {
    const fromDays = i === 0 ? -36500 : i * 7; // sem 0 atrapa lo vencido
    const toDays = (i + 1) * 7;
    return {
      label,
      from: isoPlusDays(today, fromDays),
      to: isoPlusDays(today, toDays),
      usd: 0,
    };
  });

  for (const bill of bills) {
    if (bill.status === "anulada") continue;
    if (!bill.due_date) continue;
    const balance = billBalance(bill);
    if (balance <= 0) continue;

    const d = daysUntil(bill.due_date, today);
    // Asignar a una ventana: vencido o <7d → sem0; <14 → sem1; <21 → sem2; <28 → sem3.
    let idx: number;
    if (d < 7) idx = 0;
    else if (d < 14) idx = 1;
    else if (d < 21) idx = 2;
    else if (d < 28) idx = 3;
    else continue; // fuera del horizonte de 4 semanas

    weeks[idx].usd = round2(weeks[idx].usd + balance);
  }

  return weeks;
}

function isoPlusDays(today: string, days: number): string {
  const t = new Date(today + "T00:00:00Z").getTime();
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/** Inputs mínimos para derivar las alertas del tablero. */
export type AlertInputs = {
  /** CxC + CxP vencido (USD). */
  vencido: number;
  /** Días hasta el próximo cut-off (null si no hay). */
  cutoffDays: number | null;
  /** Nave del próximo cut-off (para el texto). */
  cutoffVessel: string | null;
  /** Carga suelta CN (CBM). */
  looseCbm: number;
};

/**
 * Deriva las alertas accionables del tablero (§3 / §4.4). PURA — testeable sin DB.
 *
 *  - Pagos/cobros vencidos > 0       → danger  → /studio/tesoreria
 *  - Próximo cut-off ≤ 3 días        → warning → /studio/naviera
 *  - Carga suelta > 20 CBM           → info    → /studio/naviera
 *  - Si no hay ninguna               → "Todo en orden" (success, sin link)
 *
 * Servicio al cliente (Conversaciones) y reclamos quedan FUERA de V1 (§8): los
 * módulos no existen aún, así que esas alertas se omiten (no placeholder muerto).
 */
export function deriveAlerts(input: AlertInputs): DireccionAlert[] {
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  const alerts: DireccionAlert[] = [];

  if (input.vencido > 0) {
    alerts.push({
      tone: "danger",
      icon: "invoice",
      text: `Saldo vencido · ${fmt(input.vencido)} requieren gestión`,
      href: "/studio/tesoreria",
    });
  }

  if (input.cutoffDays != null && input.cutoffDays <= 3) {
    const nave = input.cutoffVessel ? ` · ${input.cutoffVessel}` : "";
    const dLabel =
      input.cutoffDays <= 0
        ? "hoy"
        : `en ${input.cutoffDays}${input.cutoffDays === 1 ? " día" : " días"}`;
    alerts.push({
      tone: "warning",
      icon: "ship",
      text: `Cut-off ${dLabel}${nave}`,
      href: "/studio/naviera",
    });
  }

  if (input.looseCbm > 20) {
    alerts.push({
      tone: "info",
      icon: "warehouse",
      text: `${input.looseCbm.toFixed(1)} CBM de carga suelta para consolidar en CN`,
      href: "/studio/naviera",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "success",
      icon: "check",
      text: "Todo en orden · sin alertas críticas",
      href: null,
    });
  }

  return alerts;
}

/** Primer día del mes en curso (YYYY-MM-DD) a partir de `today`. */
export function firstOfMonth(
  today: string = new Date().toISOString().slice(0, 10),
): string {
  return today.slice(0, 7) + "-01";
}

// ── Composición (fetch + cruce) ────────────────────────────────

/**
 * Arma el payload del tablero ejecutivo cruzando los agregados existentes.
 * RLS filtra por tenant en cada query. Read-only (no muta nada).
 *
 * El P&L del período usa el mes en curso (decisión §7.3 · selector = V2): la
 * utilidad y el margen salen de los asientos `asentado` desde el 1° del mes.
 * El INGRESO es el facturado del mismo mes (SDD-0557), con el mayor como
 * control: hoy el mayor está incompleto y daría 0.
 * Caja / CxC / CxP son saldos vivos (no se filtran por período).
 */
export async function getDireccionData(
  supabase: SupabaseClient,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<DireccionData> {
  const monthStart = firstOfMonth(today);

  const [
    accounts,
    monthBalances,
    liveBalances,
    cobranzas,
    tesoreria,
    bills,
    naviera,
    openSailingsList,
    opsCounts,
    leads,
  ] = await Promise.all([
    listAccounts(supabase),
    accountBalances(supabase, { fromDate: monthStart, upToDate: today }),
    accountBalances(supabase),
    collectionKpis(supabase, today),
    treasuryKpis(supabase, today),
    listBills(supabase),
    navieraKpis(supabase),
    listSailings(supabase, { status: "abierto" }),
    getOperationalCounts(supabase),
    listKommoLeads(supabase),
  ]);

  // P&L del mes (ingresos + utilidad) — reusa el cálculo de Contabilidad.
  const pl = profitAndLoss(accounts, monthBalances);
  const utilidad = pl.netIncome;
  const ingreso = await ingresoDelPeriodo(
    supabase,
    { from: monthStart, to: today },
    { mayor: controlDelMayor(accounts, monthBalances) },
  );

  // Caja consolidada = suma de saldos VIVOS de las cuentas de caja/banco.
  const caja = round2(
    accounts
      .filter((a) => isCashAccount(a))
      .reduce((s, a) => s + (liveBalances[a.id]?.balance ?? 0), 0),
  );

  // CxC/CxP/vencido en USD REAL (decisión SDD-0052 r2): los saldos se normalizan
  // a USD por documento (`*Usd`), NO la suma multi-moneda nativa que sería falsa
  // (5.000.000 Bs + $5.000 ≠ $5.005.000). Mismo criterio que Reportes (aging) →
  // Dirección y Reportes muestran el MISMO CxC/CxP/aging en USD.
  const cxc = cobranzas.porCobrarUsd;
  const cxp = tesoreria.porPagarUsd;
  const vencido = round2(cobranzas.vencidoUsd + tesoreria.vencidoUsd);

  const finance: FinanceKpis = {
    ingreso,
    utilidad,
    margenPct: netMarginPct(pl.income, utilidad),
    caja,
    posicionNeta: netPosition(caja, cxc, cxp),
  };

  const health: FinanceHealth = {
    cxc,
    cxp,
    vencido,
    coberturaPct: paymentCoveragePct(caja, cxp),
  };

  // Próximo cut-off: el sailing abierto con cutoff más cercano (futuro o hoy).
  const upcoming = openSailingsList
    .filter((s) => !!s.cutoff)
    .map((s) => ({ vessel: s.vessel, cutoff: s.cutoff as string }))
    .filter((s) => daysUntil(s.cutoff, today) >= 0)
    .sort((a, b) => a.cutoff.localeCompare(b.cutoff))[0];

  const cutoffDays = upcoming ? daysUntil(upcoming.cutoff, today) : null;
  const cutoffVessel = upcoming?.vessel ?? null;

  const ops: OpsSummary = {
    activos: opsCounts.enTransito + opsCounts.enAduana,
    consolidando: naviera.consolidating,
    looseCbm: naviera.looseCbm,
    openSailings: naviera.openSailings,
    cutoffDays,
    cutoffVessel,
  };

  // Pipeline comercial = leads abiertos (sin closed_at).
  const openLeads = leads.filter((l) => !l.closed_at);
  const commercial: CommercialSummary = {
    pipeline: round2(openLeads.reduce((s, l) => s + (Number(l.price) || 0), 0)),
    leadsActivos: openLeads.length,
  };

  const forecast = buildForecast(
    bills.map((b) => ({
      status: b.status,
      total_amount: b.total_amount,
      paid_amount: b.paid_amount,
      due_date: b.due_date,
    })),
    today,
  );

  const alerts = deriveAlerts({
    vencido,
    cutoffDays,
    cutoffVessel,
    looseCbm: naviera.looseCbm,
  });

  return { finance, health, ops, commercial, forecast, alerts };
}
