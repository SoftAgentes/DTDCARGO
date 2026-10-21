/**
 * Contabilidad (SDD-0040) — plan de cuentas + libro diario + libro mayor +
 * reportes + por contabilizar + conciliación bancaria + activos fijos (SDD-0105).
 *
 * Server component: fetchea cuentas, saldos (con rollup), asientos y el libro
 * mayor de la cuenta seleccionada, y delega la UI a ContabilidadClient. Las
 * pestañas que necesitan más que eso leen su data de forma condicional (no se
 * paga el costo si no estás en esa pestaña):
 *
 *  - Libro diario: los totales REALES del diario (`countEntries`), porque la
 *    lista tiene un tope declarado de 500 (SDD-0557).
 *  - Reportes: P&L del período `?desde=&hasta=` (por defecto, el mes en curso),
 *    balance general y de comprobación al corte y la cifra oficial de ingreso.
 *    Una fecha inválida o un rango al revés NO cae al mes en curso: se muestra
 *    el error junto al formulario (DAT-01).
 *  - Por contabilizar (`?tab=subdiario`): documentos sin asiento y subdiario
 *    contra mayor, sobre los saldos vivos.
 */

import { createClient } from "@/lib/db/server";
import {
  accountBalances,
  listAccounts,
} from "@/lib/studio/account-queries";
import { countEntries, listEntries } from "@/lib/studio/journal-queries";
import { ledgerForAccount } from "@/lib/studio/journal-queries";
import { getAccountingSettings } from "@/lib/studio/accounting/period-queries";
import type { EventoDelCierre, ExcepcionAlCierre } from "@/lib/studio/accounting/cierre-excepciones";
import {
  getEstadoCierre,
  listExcepcionesAlCierre,
  listHistorialDelCierre,
  nombresDeUsuarios,
} from "@/lib/studio/accounting/cierre-queries";
import { listTenantAdvisors } from "@/lib/studio/user-queries";
import { createAdminClient } from "@/lib/db/admin";
import {
  cuadreDelLibro,
  reportesDelLibro,
} from "@/lib/studio/accounting/libro-control-queries";
import {
  pedidoDeReportes,
  type CuadreDelLibro,
  type FiltroReportes,
  type ReportesDelLibro,
} from "@/lib/studio/accounting/libro-control";
import {
  listStatements,
  statementWithLines,
  listEntryCandidates,
} from "@/lib/studio/accounting/bank-statement-queries";
import { listAssets } from "@/lib/studio/accounting/fixed-asset-queries";
import type { BankStatement } from "@/lib/studio/accounting/bank-statement-types";
import type { EntryCandidate } from "@/lib/studio/accounting/bank-statement-queries";
import type { FixedAsset } from "@/lib/studio/accounting/fixed-asset-types";
import { ContabilidadClient } from "./_components/ContabilidadClient";
import { getExchangeRatesOverview } from "@/lib/studio/exchange-rates-queries";
import type { ExchangeRatesOverview } from "@/lib/studio/exchange-rates-types";

export const metadata = { title: "Contabilidad" };

type Tab =
  | "plan"
  | "diario"
  | "mayor"
  | "reportes"
  | "subdiario"
  | "conciliacion"
  | "activos"
  | "excepciones"
  | "tasas";

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tabRaw = single("tab");
  const tab: Tab =
    tabRaw === "diario" ||
    tabRaw === "mayor" ||
    tabRaw === "reportes" ||
    tabRaw === "subdiario" ||
    tabRaw === "conciliacion" ||
    tabRaw === "activos" ||
    tabRaw === "excepciones" ||
    tabRaw === "tasas"
      ? tabRaw
      : "plan";
  const ledgerAccountId = single("cuenta") ?? null;
  const statementId = single("extracto") ?? null;
  // Las fechas se graban en UTC (issued_at, entry_date): el «hoy» va igual.
  const hoy = new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const [accounts, balances, entries, accSettings, conteoDiario] = await Promise.all([
    listAccounts(supabase),
    accountBalances(supabase),
    listEntries(supabase, {}),
    getAccountingSettings(supabase),
    tab === "diario" ? countEntries(supabase) : Promise.resolve(null),
  ]);

  // ¿El usuario es admin? (puede fijar el cierre de período · SDD-0080).
  let canEditClosing = false;
  let tenantId: string | null = null;
  if (auth.user) {
    const { data: roleRow } = await supabase
      .from("user_tenants")
      .select("tenant_id, role")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ tenant_id: string; role: string }>();
    canEditClosing = roleRow?.role === "admin";
    tenantId = roleRow?.tenant_id ?? null;
  }

  // ── Cierre con superclave (SDD-0566): el estado, sin el hash. Sin la 0493 la
  // RPC no existe: la pantalla vuelve a la de antes (sin excepción ni reporte).
  const estadoCierre = await getEstadoCierre(supabase).catch((e: unknown) => {
    console.error("[cierre-contable] estado no disponible:", e instanceof Error ? e.message : e);
    return null;
  });
  let excepciones: ExcepcionAlCierre[] = [];
  let historialCierre: EventoDelCierre[] = [];
  if (tab === "excepciones" && estadoCierre && tenantId) {
    const nombreDe = nombresDeUsuarios(await listTenantAdvisors(createAdminClient(), tenantId));
    [excepciones, historialCierre] = await Promise.all([
      listExcepcionesAlCierre(supabase, nombreDe),
      listHistorialDelCierre(supabase, nombreDe),
    ]);
  }

  // Libro mayor de la cuenta seleccionada (si hay una y existe).
  const ledger =
    tab === "mayor" && ledgerAccountId
      ? await ledgerForAccount(supabase, ledgerAccountId)
      : null;

  // ── Reportes (SDD-0557): período explícito; sin rango válido no se calcula ──
  // La decisión es pura (`pedidoDeReportes`, con prueba): acá solo se cablea.
  let reportes: ReportesDelLibro | null = null;
  let filtroReportes: FiltroReportes | null = null;
  if (tab === "reportes") {
    const pedido = pedidoDeReportes(single("desde"), single("hasta"), hoy);
    filtroReportes = pedido.filtro;
    if (pedido.rango) reportes = await reportesDelLibro(supabase, pedido.rango);
  }

  // ── Por contabilizar (SDD-0557): sobre los saldos vivos ya leídos ──
  let cuadre: CuadreDelLibro | null = null;
  if (tab === "subdiario") {
    cuadre = await cuadreDelLibro(supabase, { accounts, saldos: balances, hoy });
  }

  // ── Conciliación (SDD-0105): solo si estamos en esa pestaña ──
  let statements: BankStatement[] = [];
  let activeStatement: BankStatement | null = null;
  let candidates: EntryCandidate[] = [];
  if (tab === "conciliacion") {
    statements = await listStatements(supabase);
    if (statementId) {
      activeStatement = await statementWithLines(supabase, statementId);
    }
    // Candidatos del diario para la cuenta-banco del extracto activo.
    if (activeStatement && tenantId) {
      candidates = await listEntryCandidates(supabase, {
        accountId: activeStatement.account_id,
        tenantId,
      });
    }
  }

  // ── Activos fijos (SDD-0105): solo si estamos en esa pestaña ──
  let assets: FixedAsset[] = [];
  if (tab === "activos") {
    assets = await listAssets(supabase);
  }

  // ── Tasas de cambio (SDD-0569): la contadora las carga desde aquí ──
  let tasas: ExchangeRatesOverview | null = null;
  if (tab === "tasas") {
    tasas = await getExchangeRatesOverview(supabase);
  }

  return (
    <ContabilidadClient
      tab={tab}
      tasas={tasas}
      accounts={accounts}
      balances={balances}
      entries={entries}
      conteoDiario={conteoDiario}
      ledger={ledger}
      ledgerAccountId={ledgerAccountId}
      reportes={reportes}
      filtroReportes={filtroReportes}
      cuadre={cuadre}
      closingDate={accSettings.closing_date}
      canEditClosing={canEditClosing}
      estadoCierre={estadoCierre}
      excepciones={excepciones}
      historialCierre={historialCierre}
      statements={statements}
      activeStatement={activeStatement}
      candidates={candidates}
      assets={assets}
    />
  );
}
