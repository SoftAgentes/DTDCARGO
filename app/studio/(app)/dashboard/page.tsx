/**
 * Dashboard del Studio (SDD-0014 — KPIs reales).
 *
 * Layout:
 *  - Header con saludo + tenant
 *  - Sección "Operativo": 4 KPIs (En tránsito / En aduana / Entregados / Con alerta)
 *  - Sección "Comercial · este mes": 4 KPIs (Clientes / Cotizaciones / Total $ / Tarifas)
 *  - Grid 2 cols: Card "Operación activa" + Card "Cotizaciones recientes"
 *
 * Todo server-fetched en paralelo. RLS filtra por tenant automáticamente.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  getActiveRateCount,
  getClientCount,
  getOperationalCounts,
  getQuoteStatsThisMonth,
  getRecentQuotes,
} from "@/lib/studio/dashboard-queries";
import { computeAgentKpis } from "@/lib/studio/agent-queries";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { RecentQuotesCard } from "./_components/RecentQuotesCard";
import { AgenticHealthCard } from "./_components/AgenticHealthCard";

export const metadata = { title: "Dashboard" };

type TenantRow = { display_name: string; base_currency: string };
type UserTenantWithTenant = { role: string; tenants: TenantRow | null };

const VE_TZ = "America/Caracas";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function firstNameFromUser(
  meta: Record<string, unknown> | undefined,
  email: string | undefined,
): string | null {
  const fromMeta =
    (meta?.first_name as string | undefined) ??
    (meta?.given_name as string | undefined) ??
    (typeof meta?.full_name === "string"
      ? (meta.full_name as string).split(" ")[0]
      : undefined) ??
    (typeof meta?.name === "string" ? (meta.name as string).split(" ")[0] : undefined);
  if (fromMeta && fromMeta.trim().length > 0) return fromMeta.trim();
  if (email) {
    const local = email.split("@")[0]?.split(/[.+_-]/)[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}

function greetingForHourVE(now: Date): string {
  const hourStr = new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TZ,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function eyebrowDateVE(now: Date): string {
  // "OPERACIÓN · 24 MAY 2026"
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
  // es-VE puede devolver "24 may 2026" o "24 may. 2026" según ICU — limpiamos punto y uppercase
  return fmt.replace(/\./g, "").toUpperCase();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch en paralelo
  const [
    userResp,
    tenantLink,
    operational,
    clientCount,
    rateCount,
    quoteStats,
    recentQuotes,
    agentKpis,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("user_tenants")
      .select("role, tenants(display_name, base_currency)")
      .maybeSingle<UserTenantWithTenant>()
      .then((r) => r.data?.tenants ?? null),
    getOperationalCounts(supabase),
    getClientCount(supabase),
    getActiveRateCount(supabase),
    getQuoteStatsThisMonth(supabase),
    getRecentQuotes(supabase, 5),
    computeAgentKpis(supabase),
  ]);

  const tenant = tenantLink;
  const now = new Date();
  const firstName = firstNameFromUser(
    userResp.data.user?.user_metadata,
    userResp.data.user?.email,
  );
  const greeting = greetingForHourVE(now);
  const eyebrow = `OPERACIÓN · ${eyebrowDateVE(now)}`;
  const subject = firstName ?? tenant?.display_name ?? "DoorTuDoor";

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine)" }}
        >
          {eyebrow}
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 8px", color: "var(--ink)" }}
        >
          {greeting}, <span style={{ color: "var(--wine)" }}>{subject}</span>.
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Operando como{" "}
          <strong style={{ color: "var(--ink)" }}>
            {tenant?.display_name ?? "DTD·CARGO"}
          </strong>
          {" · "}
          Moneda base:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {tenant?.base_currency ?? "USD"}
          </strong>
          .
        </p>
      </div>

      {/* OPERATIVO */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Operativo
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          <KpiCard
            value={operational.enTransito}
            label="En tránsito"
            valueColor="var(--ink)"
          />
          <KpiCard
            value={operational.enAduana}
            label="En aduana"
            valueColor="var(--warning)"
          />
          <KpiCard
            value={operational.entregados}
            label="Entregados"
            valueColor="var(--success)"
          />
          <KpiCard
            value={operational.conAlerta}
            label="Con alerta"
            valueColor="var(--danger)"
          />
        </div>
      </section>

      {/* COMERCIAL · ESTE MES */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Comercial · este mes
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          <KpiCard
            value={clientCount}
            label="Clientes"
            sub={
              <Link
                href="/studio/clientes"
                style={{ color: "var(--wine)", textDecoration: "none", fontWeight: 600 }}
              >
                Ver catálogo →
              </Link>
            }
          />
          <KpiCard
            value={quoteStats.countSent + quoteStats.countAccepted}
            label="Cotizaciones del mes"
            sub={`${quoteStats.countSent} enviadas · ${quoteStats.countAccepted} aceptadas`}
          />
          <KpiCard
            value={`$${formatMoney(quoteStats.totalSentAndAccepted)}`}
            label="Total cotizado"
            valueColor="var(--wine)"
            sub={
              quoteStats.countAccepted > 0
                ? `de las cuales $${formatMoney(quoteStats.totalAccepted)} aceptado`
                : "ninguna aceptada todavía"
            }
          />
          <KpiCard
            value={rateCount}
            label="Tarifas vigentes"
            sub={
              <Link
                href="/studio/tarifas"
                style={{ color: "var(--wine)", textDecoration: "none", fontWeight: 600 }}
              >
                Ver catálogo →
              </Link>
            }
          />
        </div>
      </section>

      {/* Grid inferior 2 cols */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: 14,
        }}
      >
        {/* Operación activa */}
        {operational.total === 0 ? (
          <EmptyOperationalCard />
        ) : (
          <ActiveOperationCard total={operational.total} />
        )}

        {/* Cotizaciones recientes */}
        <RecentQuotesCard quotes={recentQuotes} />
      </section>

      {/* INTELIGENCIA · SDD-0020 Fase 2A */}
      <section style={{ marginTop: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Inteligencia
        </div>
        <AgenticHealthCard kpis={agentKpis} />
      </section>
    </div>
  );
}

function ActiveOperationCard({ total }: { total: number }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 14,
        minHeight: 160,
      }}
    >
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
          Operación activa
        </div>
        <div
          style={{
            font: "500 14px/1.5 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>{total}</strong>{" "}
          {total === 1 ? "envío activo" : "envíos activos"} en el tenant
          DTD·CARGO.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="/studio/tracking"
          className="studio-btn studio-btn-dark studio-btn-sm"
        >
          VER TRACKING →
        </Link>
      </div>
    </section>
  );
}

function EmptyOperationalCard() {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "2px dashed var(--border-strong)",
        borderRadius: "var(--r-lg)",
        padding: "28px 22px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
        minHeight: 160,
      }}
    >
      <div
        className="studio-display"
        style={{ fontSize: 18, color: "var(--ink)" }}
      >
        Todavía no hay envíos.
      </div>
      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "44ch",
          margin: "0 auto",
        }}
      >
        Empezá creando el primer envío para que los conteos arriba se
        llenen con datos reales.
      </p>
      <div>
        <Link
          href="/studio/tracking/nuevo"
          className="studio-btn studio-btn-primary studio-btn-sm"
        >
          + Crear envío
        </Link>
      </div>
    </section>
  );
}
