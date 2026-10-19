/**
 * Dirección · Tablero ejecutivo (SDD-0048) — la "cabina del dueño".
 *
 * Server component, READ-ONLY, ADMIN-ONLY:
 *   1. Auth + verifica rol `admin` (no-admin → redirect /studio/dashboard),
 *      mismo patrón que /studio/usuarios.
 *   2. Compone los agregados existentes vía getDireccionData (no recalcula).
 *      «Ingresos · mes» es la cifra oficial (facturado sin IVA, SDD-0557) con
 *      el mayor al lado; utilidad y margen son del libro.
 *   3. Render: KPIs financieros · salud financiera + forecast · operación +
 *      comercial · alertas. Solo lectura, sin mutaciones.
 *
 * Diseño de referencia: docs/design/studio/_norte/erp/modules/direccion.jsx
 * (adaptado a primitivas reales + a los datos que existen tras Bloques 1-2-4).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { getDireccionData, textosFinancieros } from "@/lib/studio/direccion/queries";
import { fmtUsd } from "@/lib/money";
import { FinanceHealthCard } from "./_components/FinanceHealthCard";
import { ForecastCard } from "./_components/ForecastCard";
import { OpsCard } from "./_components/OpsCard";
import { CommercialCard } from "./_components/CommercialCard";
import { AlertsCard } from "./_components/AlertsCard";

export const metadata = { title: "Dirección · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function DireccionPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pídeles a un admin que te agregue al equipo."
      />
    );
  }

  // Admin-only (decisión §4.2): la cabina es del dueño.
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const data = await getDireccionData(supabase);
  const { finance, health, ops, commercial, forecast, alerts } = data;
  // Los textos de los dos KPI salen de una función pura, con prueba.
  const textos = textosFinancieros(finance);

  const today = new Date().toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Dirección · Vista consolidada
        </span>
        <h1
          style={{
            font: "900 26px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Tablero ejecutivo
        </h1>
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Estado integral del negocio al {today}. Finanzas, operación y comercial
          en una vista.
        </p>
      </header>

      {/* KPIs financieros */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        <KpiCard
          value={textos.ingreso.valor}
          label={textos.ingreso.label}
          sub={
            <>
              {textos.ingreso.periodo}
              {textos.ingreso.detalle && (
                <>
                  <br />
                  {textos.ingreso.detalle}
                </>
              )}
            </>
          }
          valueColor="var(--success)"
        />
        <KpiCard
          value={textos.utilidad.valor}
          label={textos.utilidad.label}
          sub={textos.utilidad.sub}
          valueColor={finance.utilidad >= 0 ? "var(--ink)" : "var(--danger)"}
        />
        <KpiCard
          value={fmtUsd(finance.caja)}
          label="Caja + bancos"
          sub="Consolidado USD"
          valueColor="var(--wine-text)"
        />
        <KpiCard
          value={fmtUsd(finance.posicionNeta)}
          label="Posición neta"
          sub="caja + CxC − CxP"
          valueColor={
            finance.posicionNeta >= 0 ? "var(--success)" : "var(--danger)"
          }
        />
      </section>

      {/* Salud financiera + proyección de caja */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.4fr)",
          gap: "var(--s-4)",
        }}
      >
        <FinanceHealthCard health={health} />
        <ForecastCard forecast={forecast} />
      </section>

      {/* Operación + comercial */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        <OpsCard ops={ops} />
        <CommercialCard commercial={commercial} />
      </section>

      {/* Alertas */}
      <section>
        <AlertsCard alerts={alerts} />
      </section>
    </div>
  );
}
