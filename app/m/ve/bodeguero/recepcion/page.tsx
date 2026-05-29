/**
 * /m/ve/bodeguero/recepcion — Lista de receipts VE pendientes (Sprint E).
 *
 * El bodeguero ve contenedores en muelle / recibiendo / con incidencia.
 * Click → entra a la pantalla de scan del receipt.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { listReceiptsVe } from "@/lib/studio/warehouse-receipt-ve-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  RECEIPT_VE_STATUS_LABELS,
  RECEIPT_VE_STATUS_TONES,
  type WarehouseReceiptVeStatus,
} from "@/lib/studio/warehouse-receipt-ve-types";

export const metadata = { title: "Recepción VE · Bodeguero" };
export const dynamic = "force-dynamic";

export default async function ReceptionListPage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");

  // Multi-rol guard
  if (operario.roles.length > 1 && !operario.current_mode) {
    redirect("/m/ve/modos");
  }
  const activeMode = operario.current_mode ?? operario.role;
  if (activeMode !== "bodeguero" && activeMode !== "supervisor") {
    redirect("/m/ve/bodeguero");
  }

  const admin = createAdminClient();
  const receipts = await listReceiptsVe(admin, operario.tenant_id);
  // Filtro: ocultar sellados > 7 días (mantener lista limpia).
  // Server component server-side · OK usar Date.now() · cada request es nuevo render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const filtered = receipts.filter((r) => {
    if (r.status !== "sellado" && r.status !== "con_incidencia") return true;
    if (!r.sealed_at) return true;
    const sealedTs = new Date(r.sealed_at).getTime();
    return now - sealedTs < 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--bg-base)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          padding: "env(safe-area-inset-top) 16px 12px",
          paddingTop: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                font: "700 9.5px/1 var(--f-sans)",
                color: "var(--wine)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Recepción VE · DTD
            </div>
            <div
              style={{
                font: "900 18px/1.1 var(--f-display)",
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                marginTop: 3,
              }}
            >
              Contenedores en muelle
            </div>
          </div>
          <Link
            href="/m/ve/bodeguero"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ color: "var(--ink-soft)" }}
          >
            ← Despacho
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
              {filtered.length} contenedor{filtered.length === 1 ? "" : "es"}
            </div>
            {filtered.map((r) => (
              <ReceiptCard key={r.id} receipt={r} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function ReceiptCard({
  receipt,
}: {
  receipt: {
    id: string;
    receipt_code: string;
    container_code: string | null;
    vessel: string | null;
    port: string | null;
    eta: string | null;
    expected_cbm: number | null;
    expected_boxes: number;
    status: WarehouseReceiptVeStatus;
    scanned_count: number;
    expected_count: number;
  };
}) {
  const tone = RECEIPT_VE_STATUS_TONES[receipt.status];
  const label = RECEIPT_VE_STATUS_LABELS[receipt.status];
  const pct =
    receipt.expected_count === 0
      ? 0
      : Math.round((receipt.scanned_count / receipt.expected_count) * 100);
  const isActive =
    receipt.status === "en_muelle" || receipt.status === "recibiendo";

  return (
    <Link
      href={`/m/ve/bodeguero/recepcion/${receipt.id}`}
      style={{
        padding: 14,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${
          isActive ? "var(--wine)" : "var(--border-strong)"
        }`,
        borderRadius: "var(--r-md)",
        textDecoration: "none",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <code style={{ font: "800 13px/1 var(--f-mono)", color: "var(--wine)" }}>
          {receipt.receipt_code}
        </code>
        <Badge tone={tone} size="sm">
          {label}
        </Badge>
      </div>

      <div
        style={{
          font: "700 14px/1.3 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {receipt.vessel ? `${receipt.vessel}` : "Sin vessel"}
        {receipt.container_code && (
          <code
            style={{
              font: "500 11.5px/1 var(--f-mono)",
              color: "var(--ink-soft)",
              marginLeft: 8,
            }}
          >
            {receipt.container_code}
          </code>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          font: "500 11.5px/1.3 var(--f-mono)",
          color: "var(--ink-mute)",
          flexWrap: "wrap",
        }}
      >
        {receipt.port && <span>📍 {receipt.port}</span>}
        {receipt.eta && <span>ETA {receipt.eta}</span>}
        <span>{receipt.expected_boxes} cj</span>
        {receipt.expected_cbm != null && <span>{Number(receipt.expected_cbm).toFixed(1)} cbm</span>}
      </div>

      {/* Progress bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            font: "600 11px/1 var(--f-mono)",
            color: "var(--ink-soft)",
            marginBottom: 4,
          }}
        >
          <span>
            {receipt.scanned_count} / {receipt.expected_count} recibidas
          </span>
          <span>{pct}%</span>
        </div>
        <div
          style={{
            width: "100%",
            height: 6,
            background: "var(--bg-elevated)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct === 100 ? "var(--success)" : "var(--wine)",
              transition: "width var(--dur) var(--ease)",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div style={{ font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}>
        Sin contenedores en muelle
      </div>
      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: "32ch",
          margin: 0,
        }}
      >
        Cuando el admin anuncie un nuevo contenedor (ETA + manifest), aparece
        acá listo para que arranques el scan.
      </p>
    </div>
  );
}
