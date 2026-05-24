/**
 * Dashboard del Studio.
 *
 * SDD-0005 + refactor visual post-audit. Movido desde /resumen a /dashboard
 * en SDD-0007 (Sprint 0.1 — Shell v1) para matchear naming del handoff v1.
 *
 * NOTA: este page contiene hex literales heredados de antes del Sprint 0.
 * Quedan documentados como deuda — se refactorizan a tokens en Sprint 0.3
 * o cuando se implemente el Dashboard real (SDD-0014).
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

export const metadata = {
  title: "Dashboard",
};

type TenantRow = { display_name: string; base_currency: string };
type UserTenantWithTenant = { role: string; tenants: TenantRow | null };

const IN_TRANSIT_STATES: ShipmentStatus[] = [
  "shipped",
  "in_transit",
  "last_mile",
  "out_for_delivery",
];

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1) Tenant del usuario (RLS via user_tenants)
  const { data: link } = await supabase
    .from("user_tenants")
    .select("role, tenants(display_name, base_currency)")
    .maybeSingle<UserTenantWithTenant>();
  const tenant = link?.tenants ?? null;

  // 2) Conteos de shipments
  const { data: rows } = await supabase.from("shipments").select("status");

  const counts = {
    en_transito: 0,
    en_aduana: 0,
    entregados: 0,
    con_alerta: 0,
    total: 0,
  };

  for (const row of rows ?? []) {
    counts.total++;
    const status = row.status as ShipmentStatus;
    if (IN_TRANSIT_STATES.includes(status)) counts.en_transito++;
    else if (status === "in_customs") counts.en_aduana++;
    else if (status === "delivered") counts.entregados++;
    else if (status === "exception" || status === "delayed_warehouse") counts.con_alerta++;
  }

  const kpis = [
    { label: "En tránsito", value: counts.en_transito, color: "var(--ink)" },
    { label: "En aduana", value: counts.en_aduana, color: "var(--warning)" },
    { label: "Entregados", value: counts.entregados, color: "var(--success)" },
    { label: "Con alerta", value: counts.con_alerta, color: "var(--danger)" },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <span className="studio-eyebrow">Dashboard</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 12px", color: "var(--ink)" }}
      >
        Hola, <span style={{ color: "var(--wine)" }}>DoorTuDoor</span>.
      </h1>
      <p
        style={{
          font: "400 14px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 32px",
        }}
      >
        Bienvenido al Studio. Operando como{" "}
        <strong style={{ color: "var(--ink)" }}>{tenant?.display_name ?? "DTD·CARGO"}</strong>
        {" · "}
        Moneda base:{" "}
        <strong style={{ color: "var(--ink)" }}>{tenant?.base_currency ?? "USD"}</strong>.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {kpis.map((kpi) => {
          const hasValue = kpi.value > 0;
          return (
            <div
              key={kpi.label}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderTop: hasValue ? "2px solid var(--wine-soft)" : "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "18px 20px 16px",
              }}
            >
              <div
                style={{
                  font: '900 30px/1 var(--f-display)',
                  color: kpi.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {kpi.value}
              </div>
              <div
                style={{
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {kpi.label}
              </div>
            </div>
          );
        })}
      </div>

      {counts.total === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "2px dashed var(--border-strong)",
            borderRadius: "var(--r-xl)",
            padding: "48px 28px",
            textAlign: "center",
          }}
        >
          <div
            className="studio-display"
            style={{ fontSize: 22, color: "var(--ink)", marginBottom: 10 }}
          >
            Todavía no hay envíos.
          </div>
          <p
            style={{
              font: "400 14px/1.55 var(--f-sans)",
              color: "var(--ink-soft)",
              maxWidth: "56ch",
              margin: "0 auto 22px",
            }}
          >
            Empezá creando el primer envío para que los conteos arriba se llenen con
            datos reales.
          </p>
          <Link href="/studio/tracking/nuevo" className="studio-btn studio-btn-primary">
            + CREAR ENVÍO
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "18px 22px",
          }}
        >
          <div>
            <div
              style={{
                font: "700 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Operación activa
            </div>
            <div style={{ font: "500 14px/1.4 var(--f-sans)", color: "var(--ink)" }}>
              <strong style={{ color: "var(--ink)" }}>{counts.total}</strong>{" "}
              {counts.total === 1 ? "envío activo" : "envíos activos"} en el tenant
              DTD·CARGO.
            </div>
          </div>
          <Link
            href="/studio/tracking"
            className="studio-btn studio-btn-dark studio-btn-sm"
          >
            VER TRACKING →
          </Link>
        </div>
      )}
    </div>
  );
}
