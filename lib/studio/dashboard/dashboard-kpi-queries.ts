/**
 * Cableado de KPIs financieros / nómina del dashboard (SDD-0114 · Slice C).
 *
 * Conecta los KPIs que ya tenían query en `lib/studio/` pero que el dashboard de
 * prod nunca llegó a mostrar: `monthRevenue`, `invoicesDue`, `pendingCollect`,
 * `avgTicket`, `marginYTD` (finanzas) y los cuatro de nómina.
 *
 * Cada "bundle" hace UNA pasada sobre su fuente (invoices / shipments+costing /
 * empleados+préstamos+asistencia) y devuelve varios KPIs → así el page fetchea
 * en paralelo solo los bundles de los módulos accesibles (RBAC), y nunca corre
 * una query de nómina para un usuario que no ve nómina.
 *
 * Los KPIs `wip` del catálogo (`onTime`, `avgTransit`) NO tienen bundle: el page
 * les pone "—" (D-7).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import { isOverdue, type InvoiceStatus } from "@/lib/studio/invoice-types";
import {
  mesEnCurso,
  resumirIngreso,
  type FacturaDeIngreso,
} from "@/lib/studio/accounting/ingreso-periodo";
import { costingRows, costingTotals } from "@/lib/studio/costing/queries";
import { listEmployees } from "@/lib/studio/nomina/employee-queries";
import { listLoansWithBalance } from "@/lib/studio/nomina/loan-queries";
import { listPayrollRuns } from "@/lib/studio/nomina/payroll-run-queries";
import type { KpiTone } from "./dashboard-catalog";

export type KpiValue = { value: string; sub?: string; tone?: KpiTone };

/** "$12.3K" para miles, "$840" para chico. Compacto para el KpiCard. */
export function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

// ── Finanzas · invoices (monthRevenue / invoicesDue / pendingCollect / avgTicket) ──
export type FinanceInvoiceKpis = {
  monthRevenue: KpiValue;
  invoicesDue: KpiValue;
  pendingCollect: KpiValue;
  avgTicket: KpiValue;
};

/**
 * `hoy` (YYYY-MM-DD, UTC como se graban `issued_at`) fija el mes y el año:
 * por defecto, hoy. «Ingresos del mes» y «Ticket promedio» usan la cifra
 * oficial de ingreso (SDD-0557, `resumirIngreso`): base sin IVA en USD, por
 * fecha de emisión. Antes sumaban `total_amount` crudo (con IVA y sin
 * convertir moneda) por `issued_at ?? created_at` y mes local.
 */
export async function financeInvoiceKpis(
  supabase: SupabaseClient,
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<FinanceInvoiceKpis> {
  // Paginado: KPI financiero del tablero — suma montos y cuenta estados.
  // Sin las borradas (SDD-0465): mismo universo que `invoiceKpis`.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("invoices")
        .select(
          "status, due_date, issued_at, total_amount, paid_amount, created_at, base_amount, currency, fx_rate, fund_class, deleted_at",
        )
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Las facturas superan el tope de lectura para el KPI del tablero.");
  }

  const empty = "$0";
  if (data.length === 0) {
    return {
      monthRevenue: { value: empty, sub: "sin facturas", tone: "neutral" },
      invoicesDue: { value: "0", sub: "ninguna vencida", tone: "success" },
      pendingCollect: { value: empty, sub: "nada por cobrar", tone: "success" },
      avgTicket: { value: empty, sub: "—", tone: "neutral" },
    };
  }

  // La regla oficial, sobre la misma lectura: sin otra consulta ni el mayor.
  const facturas = data as unknown as FacturaDeIngreso[];
  const delMes = resumirIngreso(facturas, mesEnCurso(hoy), null);
  const delAnio = resumirIngreso(facturas, { from: `${hoy.slice(0, 4)}-01-01`, to: hoy }, null);
  const monthRevenue = delMes.facturado.total;

  let dueCount = 0;
  let pending = 0;

  for (const raw of data as Record<string, unknown>[]) {
    const status = raw.status as InvoiceStatus;
    if (status === "anulada") continue;
    const total = Number(raw.total_amount) || 0;
    const paid = Number(raw.paid_amount) || 0;
    const balance = total - paid;
    const due = (raw.due_date as string | null) ?? null;

    if (status !== "borrador") {
      if (balance > 0) {
        pending += balance;
        if (isOverdue({ due_date: due, status })) dueCount += 1;
      }
    }
  }

  const ytdCount = delAnio.facturas;
  const avgTicket = ytdCount > 0 ? delAnio.facturado.total / ytdCount : 0;
  // La cifra INCLUYE los fondos de terceros (fund_class ≠ local_revenue, B10):
  // cada pantalla lo dice cuando los hay (SDD-0557).
  const deTerceros = (terceros: number) =>
    terceros > 0 ? ` · incluye ${money(terceros)} de terceros` : "";

  return {
    monthRevenue: {
      value: money(monthRevenue),
      sub:
        (delMes.sinConvertir > 0
          ? `facturado del mes sin IVA · ${delMes.sinConvertir} sin convertir`
          : "facturado del mes sin IVA") + deTerceros(delMes.facturado.terceros),
      tone: monthRevenue > 0 ? "success" : "neutral",
    },
    invoicesDue: {
      value: String(dueCount),
      sub: dueCount > 0 ? "requieren cobro" : "ninguna vencida",
      tone: dueCount > 0 ? "warning" : "success",
    },
    pendingCollect: {
      value: money(pending),
      sub: "saldo por cobrar",
      tone: pending > 0 ? "info" : "success",
    },
    avgTicket: {
      value: money(avgTicket),
      sub: `${ytdCount} factura(s) en el año · sin IVA${deTerceros(delAnio.facturado.terceros)}`,
      tone: "wine",
    },
  };
}

// ── Finanzas · costing (marginYTD) ────────────────────────────
export async function marginKpi(supabase: SupabaseClient): Promise<KpiValue> {
  try {
    const rows = await costingRows(supabase);
    const totals = costingTotals(rows);
    return {
      value: `${totals.avgMarginPct.toFixed(1)}%`,
      sub: `${totals.profitable} rentable(s) · ${totals.losing} en pérdida`,
      tone: totals.avgMarginPct >= 0 ? "wine" : "danger",
    };
  } catch (e) {
    console.error("[marginKpi]", (e as Error).message);
    return { value: "—", sub: "sin datos de costeo", tone: "neutral" };
  }
}

// ── Nómina (neto / préstamos / ausencias / empleados) ─────────
export type NominaKpis = {
  nominaNeto: KpiValue;
  nominaPrestamos: KpiValue;
  nominaAusencias: KpiValue;
  nominaEmpleados: KpiValue;
};

export async function nominaKpis(supabase: SupabaseClient): Promise<NominaKpis> {
  const empty: NominaKpis = {
    nominaNeto: { value: "$0", sub: "sin corte", tone: "neutral" },
    nominaPrestamos: { value: "$0", sub: "sin préstamos activos", tone: "success" },
    nominaAusencias: { value: "0", sub: "este mes", tone: "success" },
    nominaEmpleados: { value: "0", sub: "activos", tone: "info" },
  };

  const employees = await listEmployees(supabase);
  const active = employees.filter((e) => e.status === "activo");
  if (employees.length === 0) return empty;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  const [loans, runs, absencesRes] = await Promise.all([
    listLoansWithBalance(
      supabase,
      active.map((e) => ({
        id: e.id,
        full_name: e.full_name,
        employee_code: e.employee_code,
      })),
    ),
    listPayrollRuns(supabase),
    supabase
      .from("nomina_attendance")
      .select("id", { count: "exact", head: true })
      .eq("status", "ausente")
      .is("deleted_at", null)
      .gte("work_date", monthStart)
      .lte("work_date", monthEnd),
  ]);

  const loanBalance = loans
    .filter((l) => l.status === "activo" && l.balance_usd > 0)
    .reduce((s, l) => s + l.balance_usd, 0);
  const activeLoans = loans.filter((l) => l.status === "activo" && l.balance_usd > 0).length;

  const liveRun = runs.find((r) => r.status !== "anulado") ?? null;
  const neto = liveRun?.total_net_usd ?? 0;
  const absences = absencesRes.count ?? 0;

  return {
    nominaNeto: {
      value: money(neto),
      sub: liveRun ? liveRun.period_label : "sin corte vivo",
      tone: neto > 0 ? "success" : "neutral",
    },
    nominaPrestamos: {
      value: money(loanBalance),
      sub: `${activeLoans} activo(s)`,
      tone: loanBalance > 0 ? "warning" : "success",
    },
    nominaAusencias: {
      value: String(absences),
      sub: "este mes",
      tone: absences > 0 ? "danger" : "success",
    },
    nominaEmpleados: {
      value: String(active.length),
      sub: `${employees.length} en total`,
      tone: "info",
    },
  };
}

// ── Leads (Kommo) ─────────────────────────────────────────────
export async function leadsKpi(supabase: SupabaseClient): Promise<KpiValue> {
  const { count, error } = await supabase
    .from("kommo_leads")
    .select("id", { count: "exact", head: true });
  if (error) return { value: "—", sub: "CRM no sincronizado", tone: "neutral" };
  return {
    value: String(count ?? 0),
    sub: "en pipeline",
    tone: (count ?? 0) > 0 ? "info" : "neutral",
  };
}
