/**
 * Dashboard del Studio · CONFIGURABLE por usuario (SDD-0114).
 *
 * Server component: resuelve rol + tenant, lee la config del usuario de
 * `user_dashboard_prefs` (o el default filtrado por RBAC), y fetchea EN PARALELO
 * solo los bundles de datos de los módulos accesibles. El render configurable +
 * editor vive en `DashboardClient` (cliente), que maneja el estado optimista y el
 * autosave a DB.
 *
 * RBAC (SDD-0085): el catálogo se filtra por los módulos que el usuario ve — un
 * usuario sin Nómina no recibe ni valores ni widget de nómina.
 */

import { createClient } from "@/lib/db/server";
import { canAccessModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  getClientCount,
  getOperationalCounts,
  getQuoteStatsThisMonth,
  getRecentActivity,
  navieraKpis,
} from "@/lib/studio/dashboard-queries";
import { getDashboardConfig } from "@/lib/studio/dashboard/dashboard-prefs-queries";
import {
  accessibleCatalog,
  defaultConfigForAccess,
  isEmptyConfig,
  validateDashboardConfigInput,
} from "@/lib/studio/dashboard/dashboard-types";
import { KPI_CATALOG } from "@/lib/studio/dashboard/dashboard-catalog";
import {
  financeInvoiceKpis,
  leadsKpi,
  marginKpi,
  nominaKpis,
  type KpiValue,
} from "@/lib/studio/dashboard/dashboard-kpi-queries";
import {
  getActiveShipmentsPreview,
  getMonthlyVolume,
} from "@/lib/studio/dashboard/dashboard-widget-queries";
import { DashboardClient, type DashboardWidgetData } from "./_components/DashboardClient";
import type { AlertItem } from "./_components/DashboardWidgets";

export const metadata = { title: "Dashboard" };

const VE_TZ = "America/Caracas";

function firstNameFromUser(
  meta: Record<string, unknown> | undefined,
  email: string | undefined,
): string | null {
  const fromMeta =
    (meta?.first_name as string | undefined) ??
    (meta?.given_name as string | undefined) ??
    (typeof meta?.full_name === "string" ? (meta.full_name as string).split(" ")[0] : undefined) ??
    (typeof meta?.name === "string" ? (meta.name as string).split(" ")[0] : undefined);
  if (fromMeta && fromMeta.trim().length > 0) return fromMeta.trim();
  if (email) {
    const local = email.split("@")[0]?.split(/[.+_-]/)[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}

function greetingForHourVE(now: Date): string {
  const hourStr = new Intl.DateTimeFormat("es-VE", { timeZone: VE_TZ, hour: "numeric", hour12: false }).format(now);
  const hour = parseInt(hourStr, 10);
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function eyebrowDateVE(now: Date): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
  return fmt.replace(/\./g, "").toUpperCase();
}

type TenantRow = { display_name: string; base_currency: string };
type UserTenantWithTenant = { role: string | null; tenants: TenantRow | null };

export default async function DashboardPage() {
  const supabase = await createClient();

  const [userResp, link] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("user_tenants")
      .select("role, tenants(display_name, base_currency)")
      .maybeSingle<UserTenantWithTenant>()
      .then((r) => r.data ?? null),
  ]);

  const userId = userResp.data.user?.id ?? "";
  const role = (link?.role as StudioUserRole | null) ?? null;
  const tenant = link?.tenants ?? null;
  const canAccess = (moduleId: string | null) => (moduleId === null ? true : canAccessModule(role, moduleId));

  // Config del usuario (DB manda) → filtrada por RBAC. Vacía / usuario nuevo → default.
  const rawConfig = userId ? await getDashboardConfig(supabase, userId) : null;
  let config = validateDashboardConfigInput(rawConfig, canAccess);
  const defaultConfig = defaultConfigForAccess(canAccess);
  if (isEmptyConfig(config)) config = defaultConfig;

  // Catálogo accesible (para el editor) + qué fuentes de datos hacen falta.
  const { kpis: accessibleKpis, widgets: accessibleWidgets } = accessibleCatalog(canAccess);
  const accessibleSources = new Set(accessibleKpis.map((k) => k.source));
  const accessibleKpiIds = new Set(accessibleKpis.map((k) => k.id));
  const accessibleWidgetIds = new Set(accessibleWidgets.map((w) => w.id));

  const needOperational = accessibleSources.has("operational");
  const needNaviera = accessibleSources.has("naviera");
  const needFinanceInvoice = ["monthRevenue", "invoicesDue", "pendingCollect", "avgTicket"].some((id) =>
    accessibleKpiIds.has(id),
  );
  const needMargin = accessibleKpiIds.has("marginYTD");
  const needQuotes = accessibleSources.has("quotes");
  const needClients = accessibleSources.has("clients");
  const needLeads = accessibleSources.has("leads");
  const needNomina = accessibleSources.has("nomina");

  const needActiveShipments = accessibleWidgetIds.has("activeShipments") || accessibleWidgetIds.has("upcomingEta");
  const needChart = accessibleWidgetIds.has("chart");

  // Fetch en paralelo: SOLO lo accesible (RBAC gatea nómina/finanzas/etc.).
  const [
    operational,
    naviera,
    finance,
    margin,
    quoteStats,
    clientCount,
    leads,
    nomina,
    activeShipments,
    monthlyVolume,
    recentActivity,
  ] = await Promise.all([
    needOperational ? getOperationalCounts(supabase) : Promise.resolve(null),
    needNaviera ? navieraKpis(supabase) : Promise.resolve(null),
    needFinanceInvoice ? financeInvoiceKpis(supabase) : Promise.resolve(null),
    needMargin ? marginKpi(supabase) : Promise.resolve(null),
    needQuotes ? getQuoteStatsThisMonth(supabase) : Promise.resolve(null),
    needClients ? getClientCount(supabase) : Promise.resolve(null),
    needLeads ? leadsKpi(supabase) : Promise.resolve(null),
    needNomina ? nominaKpis(supabase) : Promise.resolve(null),
    needActiveShipments ? getActiveShipmentsPreview(supabase, 6) : Promise.resolve([]),
    needChart ? getMonthlyVolume(supabase) : Promise.resolve([]),
    getRecentActivity(supabase, 6),
  ]);

  // ── Ensamblar los valores de KPI para TODO el catálogo accesible ──
  const kpiValues: Record<string, KpiValue> = {};
  const neutral = (value: string): KpiValue => ({ value, tone: "neutral" });

  for (const k of KPI_CATALOG) {
    if (!accessibleKpiIds.has(k.id)) continue;
    switch (k.id) {
      case "shipmentsActive":
        if (operational) kpiValues[k.id] = { value: String(operational.total), sub: "en curso", tone: "wine" };
        break;
      case "openIncidents":
        if (operational)
          kpiValues[k.id] = {
            value: String(operational.conAlerta),
            sub: operational.conAlerta > 0 ? "requieren atención" : "sin alertas",
            tone: operational.conAlerta > 0 ? "warning" : "success",
          };
        break;
      case "cbmInTransit":
        if (naviera) kpiValues[k.id] = { value: `${naviera.looseCbm.toFixed(1)} CBM`, sub: "carga en almacén CN", tone: "neutral" };
        break;
      case "cnStock":
        if (naviera) kpiValues[k.id] = { value: String(naviera.looseCount), sub: "embarques en almacén CN", tone: "neutral" };
        break;
      case "monthRevenue":
        if (finance) kpiValues[k.id] = finance.monthRevenue;
        break;
      case "invoicesDue":
        if (finance) kpiValues[k.id] = finance.invoicesDue;
        break;
      case "pendingCollect":
        if (finance) kpiValues[k.id] = finance.pendingCollect;
        break;
      case "avgTicket":
        if (finance) kpiValues[k.id] = finance.avgTicket;
        break;
      case "marginYTD":
        if (margin) kpiValues[k.id] = margin;
        break;
      case "newLeads":
        if (leads) kpiValues[k.id] = leads;
        break;
      case "wonEstimados":
        if (quoteStats)
          kpiValues[k.id] = {
            value: String(quoteStats.countAccepted),
            sub: `${quoteStats.countSent} enviados este mes`,
            tone: quoteStats.countAccepted > 0 ? "success" : "neutral",
          };
        break;
      case "activeClients":
        if (clientCount != null) kpiValues[k.id] = { value: String(clientCount), sub: "en el catálogo", tone: "neutral" };
        break;
      case "nominaNeto":
        if (nomina) kpiValues[k.id] = nomina.nominaNeto;
        break;
      case "nominaPrestamos":
        if (nomina) kpiValues[k.id] = nomina.nominaPrestamos;
        break;
      case "nominaAusencias":
        if (nomina) kpiValues[k.id] = nomina.nominaAusencias;
        break;
      case "nominaEmpleados":
        if (nomina) kpiValues[k.id] = nomina.nominaEmpleados;
        break;
      default:
        // wip (onTime, avgTransit) → sin valor: el cliente muestra "—".
        break;
    }
    if (k.status === "ready" && !kpiValues[k.id]) kpiValues[k.id] = neutral("—");
  }

  // ── Alertas del widget "atención requerida" ──
  const alerts: AlertItem[] = [];
  if (operational && operational.conAlerta > 0)
    alerts.push({
      tone: "warning",
      title: `${operational.conAlerta} envío(s) con alerta`,
      meta: "Revisar en tracking",
      href: "/studio/tracking",
    });
  if (finance) {
    const due = Number(finance.invoicesDue.value) || 0;
    if (due > 0)
      alerts.push({ tone: "danger", title: `${due} factura(s) vencida(s)`, meta: "Gestionar cobranza", href: "/studio/invoices" });
  }
  if (naviera && naviera.looseCount > 0)
    alerts.push({
      tone: "info",
      title: `${naviera.looseCount} embarque(s) por consolidar`,
      meta: `${naviera.looseCbm.toFixed(1)} CBM sueltos en CN`,
      href: "/studio/naviera",
    });

  const widgetData: DashboardWidgetData = {
    activeShipments,
    monthlyVolume,
    recentActivity,
    alerts,
    nomina: nomina
      ? {
          neto: nomina.nominaNeto,
          prestamos: nomina.nominaPrestamos,
          ausencias: nomina.nominaAusencias,
          empleados: nomina.nominaEmpleados,
        }
      : null,
  };

  const now = new Date();
  const firstName = firstNameFromUser(userResp.data.user?.user_metadata, userResp.data.user?.email);
  const greeting = greetingForHourVE(now);
  const subject = firstName ?? tenant?.display_name ?? "equipo";

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header · banda de bienvenida con degradado vino + marca de agua "D" (BD-034).
          Texto en --ink-inv (cream) sobre el vino oscuro → AA. La "D" (isotipo
          mono-light, .055) es decorativa y va detrás del texto (el contenido va en
          un wrapper relative/zIndex:1). */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--r-lg)",
          background: "var(--grad-wine-panel)",
          padding: "26px 30px",
          marginBottom: 28,
          boxShadow: "0 14px 40px -18px rgba(127,15,26,0.6)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "-4%",
            bottom: "-66%",
            width: "32%",
            height: "200%",
            background:
              "url('/brand/dtdcargo-isologo-mono-light.png') right bottom / contain no-repeat",
            opacity: 0.08,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="studio-eyebrow" style={{ marginBottom: 10, color: "var(--ink-inv-soft)" }}>
            {`OPERACIÓN · ${eyebrowDateVE(now)}`}
          </div>
          <h1 className="studio-display" style={{ fontSize: 30, margin: "0 0 var(--s-2)", color: "var(--ink-inv)" }}>
            {greeting}, {subject}.
          </h1>
          <p style={{ font: "400 14px/1.5 var(--f-sans)", color: "var(--ink-inv-soft)", margin: 0 }}>
            Operando como <strong style={{ color: "var(--ink-inv)" }}>{tenant?.display_name ?? "DTD Cargo"}</strong>
            {" · "}Moneda base: <strong style={{ color: "var(--ink-inv)" }}>{tenant?.base_currency ?? "USD"}</strong>.
          </p>
        </div>
      </div>

      <DashboardClient
        initialConfig={config}
        defaultConfig={defaultConfig}
        kpiValues={kpiValues}
        accessibleKpis={accessibleKpis}
        accessibleWidgets={accessibleWidgets}
        widgetData={widgetData}
        userId={userId}
      />
    </div>
  );
}
