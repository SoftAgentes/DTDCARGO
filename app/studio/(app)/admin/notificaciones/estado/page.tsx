/**
 * /studio/admin/notificaciones/estado · Estado del motor de avisos
 * (Motor de Crecimiento · F2-T04).
 *
 * Dos manómetros de S3 (Entrega) para el ritual del viernes:
 *   · FUND-S3-01 — adopción del pipeline de captura CN: % recepciones que
 *     entraron por escaneo (`prealerta_id`) vs tipeadas a mano.
 *   · FUND-S3-02 — la cola de avisos SDD-0156 por estado (programado / enviado /
 *     saltado / fallido / cancelado) + los últimos avisos.
 *
 * Read-only. Admin-only (gate heredado del layout de notificaciones). RLS por
 * tenant en `warehouse_receipts_cn`; la cola es service_role → admin client
 * scopeado explícito por tenant.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { getPipelineAdoption } from "@/lib/studio/notifications/pipeline-adoption-queries";
import {
  getNotificationStatusCounts,
  listRecentStaffNotifications,
  NOTIFICATION_STATUSES,
  NOTIFICATION_STATUS_LABELS,
  type NotificationStatus,
  type StaffNotificationItem,
} from "@/lib/studio/notifications/notification-staff-queries";

export const metadata = { title: "Estado del motor de avisos · DTD Studio" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<NotificationStatus, BadgeTone> = {
  scheduled: "info",
  sent: "success",
  skipped: "neutral",
  failed: "danger",
  canceled: "neutral",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EstadoAvisosPage() {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) redirect("/studio/dashboard");
  if (link.role !== "admin") redirect("/studio/admin");

  const admin = createAdminClient();
  const [adoption, statusCounts, recent] = await Promise.all([
    getPipelineAdoption(supabase, link.tenant_id),
    getNotificationStatusCounts(admin, link.tenant_id),
    listRecentStaffNotifications(admin, link.tenant_id),
  ]);

  const totalNotifs = NOTIFICATION_STATUSES.reduce(
    (acc, s) => acc + statusCounts[s],
    0,
  );

  return (
    <div style={{ maxWidth: 1040 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-6)",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/studio/admin/notificaciones"
          style={{
            font: "500 12px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Configuración de avisos
        </Link>
      </div>

      <header style={{ marginBottom: "var(--s-5)" }}>
        <span className="studio-eyebrow">Entrega · motor de avisos</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 28,
            margin: "var(--s-2) 0 var(--s-3)",
            color: "var(--ink)",
          }}
        >
          Estado del motor de avisos.
        </h1>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "64ch",
          }}
        >
          Qué tan adoptado está el pipeline de captura en China y cuántos avisos
          está moviendo el motor. Números para la Revisión del Motor (viernes).
        </p>
      </header>

      {/* ── FUND-S3-01 · Adopción del pipeline ── */}
      <SectionTitle>Adopción del pipeline de captura (China)</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--s-3)",
          marginBottom: "var(--s-6)",
        }}
      >
        <KpiCard
          value={`${adoption.adoptionPct}%`}
          label="Escaneadas vs tipeadas"
          valueColor={
            adoption.adoptionPct >= 60
              ? "var(--success)"
              : adoption.total === 0
                ? "var(--ink-mute)"
                : "var(--warning)"
          }
          sub={
            adoption.total === 0
              ? "Aún no hay recepciones en China."
              : `${adoption.scanned} por escaneo · ${adoption.typed} tipeadas`
          }
        />
        <KpiCard
          value={adoption.scanned}
          label="Recepciones por escaneo"
          sub="Pre-declaradas y recibidas con el lector."
        />
        <KpiCard
          value={adoption.typed}
          label="Recepciones tipeadas"
          sub="Cargadas a mano, fuera del pipeline."
        />
      </div>

      {/* ── FUND-S3-02 · Cola de avisos ── */}
      <SectionTitle>Avisos al cliente (cola SDD-0156)</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--s-3)",
          marginBottom: "var(--s-5)",
        }}
      >
        {NOTIFICATION_STATUSES.map((s) => (
          <KpiCard
            key={s}
            value={statusCounts[s]}
            label={NOTIFICATION_STATUS_LABELS[s]}
            valueColor={
              s === "failed" && statusCounts[s] > 0
                ? "var(--danger)"
                : s === "sent" && statusCounts[s] > 0
                  ? "var(--success)"
                  : "var(--ink)"
            }
            highlightWhenPositive={s === "sent"}
          />
        ))}
      </div>

      {totalNotifs === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "24px 20px",
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          El motor de avisos todavía no ha programado ningún aviso. Al correr el
          primer embarque piloto por el pipeline empezarán a aparecer acá.
        </div>
      ) : (
        <RecentTable rows={recent} />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="studio-eyebrow"
      style={{
        color: "var(--ink-soft)",
        margin: "0 0 var(--s-3)",
      }}
    >
      {children}
    </h2>
  );
}

function RecentTable({ rows }: { rows: StaffNotificationItem[] }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Evento", "Estado", "Canal", "Shipping Mark", "Envío", "Programado", "Enviado"].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    font: "600 10.5px/1 var(--f-sans)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--ink-mute)",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={cellStyle}>{r.eventLabel}</td>
              <td style={cellStyle}>
                <Badge tone={STATUS_TONE[r.status]} size="sm">
                  {NOTIFICATION_STATUS_LABELS[r.status]}
                </Badge>
                {r.status === "failed" && r.error ? (
                  <span
                    style={{
                      display: "block",
                      font: "400 11px/1.4 var(--f-sans)",
                      color: "var(--danger)",
                      marginTop: 4,
                      maxWidth: "28ch",
                    }}
                    title={r.error}
                  >
                    {r.error}
                  </span>
                ) : null}
              </td>
              <td style={cellStyle}>{r.channel}</td>
              <td style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>
                {r.clientMarkbox}
              </td>
              <td style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>
                {r.shipmentCode ?? "—"}
              </td>
              <td style={{ ...cellStyle, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                {formatDateTime(r.scheduledFor)}
              </td>
              <td style={{ ...cellStyle, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                {formatDateTime(r.sentAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  font: "400 12.5px/1.4 var(--f-sans)",
  color: "var(--ink)",
  padding: "12px 14px",
  borderBottom: "1px solid var(--border-soft, var(--border))",
  verticalAlign: "top" as const,
};
