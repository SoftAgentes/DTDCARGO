/**
 * Dashboard / Resumen del Studio.
 *
 * SDD-0005 + refactor visual post-audit (técnico + gráfico):
 *   - Tipografía estandarizada (h1 30px, KPI 30px/11.5px ratio balanceado)
 *   - Wine reservado para CTAs (KPI "En tránsito" pasó de wine a ink)
 *   - Wine-soft activado como identity asset: top indicator en KPI cards con valor > 0
 *   - Spacing rítmico 8/12/32 (eyebrow → h1 → sub → contenido)
 *   - Sistema de botones documentado en studio.css
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

export const metadata = {
  title: "Resumen",
};

type TenantRow = { display_name: string; base_currency: string };
type UserTenantWithTenant = { role: string; tenants: TenantRow | null };

const IN_TRANSIT_STATES: ShipmentStatus[] = [
  "shipped",
  "in_transit",
  "last_mile",
  "out_for_delivery",
];

export default async function ResumenPage() {
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

  // Wine reservado solo para CTAs — "En tránsito" pasa a ink (estado en curso, no acción)
  const kpis = [
    { label: "En tránsito", value: counts.en_transito, color: "#0F1E3D" },
    { label: "En aduana", value: counts.en_aduana, color: "#B8893A" },
    { label: "Entregados", value: counts.entregados, color: "#1F8A5B" },
    { label: "Con alerta", value: counts.con_alerta, color: "#C2353F" },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header con spacing rítmico 8/12/32 */}
      <span className="studio-eyebrow">Dashboard</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 12px", color: "#0F1E3D" }}
      >
        Hola, <span style={{ color: "#7F0F1A" }}>DoorTuDoor</span>.
      </h1>
      <p
        style={{
          font: "400 14px/1.5 Archivo, sans-serif",
          color: "#6B6B6B",
          margin: "0 0 32px",
        }}
      >
        Bienvenido al Studio. Operando como{" "}
        <strong style={{ color: "#0F1E3D" }}>{tenant?.display_name ?? "DTD·CARGO"}</strong>
        {" · "}
        Moneda base:{" "}
        <strong style={{ color: "#0F1E3D" }}>{tenant?.base_currency ?? "USD"}</strong>.
      </p>

      {/* KPI cards con wine-soft top indicator cuando valor > 0 */}
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
                background: "#FFFFFF",
                border: "1px solid #E8E6E2",
                borderTop: hasValue ? "2px solid #C2747F" : "1px solid #E8E6E2",
                borderRadius: 10,
                padding: "18px 20px 16px",
              }}
            >
              <div
                style={{
                  font: '900 30px/1 "Archivo Black", sans-serif',
                  color: kpi.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {kpi.value}
              </div>
              <div
                style={{
                  font: "600 11.5px/1 Archivo, sans-serif",
                  color: "#6B6B6B",
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

      {/* Empty state vs banner operación activa */}
      {counts.total === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "2px dashed #C9C5BE",
            borderRadius: 12,
            padding: "48px 28px",
            textAlign: "center",
          }}
        >
          <div
            className="studio-display"
            style={{ fontSize: 22, color: "#0F1E3D", marginBottom: 10 }}
          >
            Todavía no hay envíos.
          </div>
          <p
            style={{
              font: "400 14px/1.55 Archivo, sans-serif",
              color: "#6B6B6B",
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
            background: "#FFFFFF",
            border: "1px solid #E8E6E2",
            borderRadius: 10,
            padding: "18px 22px",
          }}
        >
          <div>
            <div
              style={{
                font: "700 11px/1 Archivo, sans-serif",
                color: "#6B6B6B",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Operación activa
            </div>
            <div style={{ font: "500 14px/1.4 Archivo, sans-serif", color: "#0F1E3D" }}>
              <strong style={{ color: "#0F1E3D" }}>{counts.total}</strong>{" "}
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
