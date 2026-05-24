"use client";

/**
 * FilingDetailDrawer — drawer 6 secciones del trámite SENIAT.
 *
 * 1. Alert banner (si filing.alert)
 * 2. Cost breakdown card ink
 * 3. Checklist documental (7 docs con toggle uploaded)
 * 4. HS codes
 * 5. Agente aduanal
 * 6. Timeline SENIAT (derivada del status + flags)
 *
 * Acciones footer: "Contactar agente" (mailto/tel) + "Marcar liberado"
 * (primary, solo si required docs OK).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import {
  CUSTOMS_DOC_LABELS,
  CUSTOMS_DOC_ORDER,
  CUSTOMS_DOC_REQUIRED,
  computeFilingDocsProgress,
  filingTotal,
  vePortLabel,
  type CustomsAgent,
  type CustomsDocument,
  type CustomsFiling,
} from "@/lib/studio/customs-types";
import {
  markDocumentUploadedAction,
  markFilingClearedAction,
} from "../actions";
import { CustomsStatusBadge } from "./CustomsStatusBadge";

interface Props {
  filing: CustomsFiling;
  documents: CustomsDocument[];
  agent: CustomsAgent | null;
  shipment: {
    id: string;
    code: string;
    client_name: string | null;
    client_markbox: string | null;
    destination: string | null;
  } | null;
  onClose: () => void;
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function FilingDetailDrawer({
  filing,
  documents,
  agent,
  shipment,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Index docs por type para acceso rápido
  const docsByType = new Map(documents.map((d) => [d.doc_type, d]));
  const progress = computeFilingDocsProgress(documents);
  const total = filingTotal(filing);

  const isCleared = filing.status === "liberado";
  const canClear = progress.missingRequired.length === 0 && !isCleared;

  const handleToggleDoc = (documentId: string, currentUploaded: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await markDocumentUploadedAction(
        documentId,
        !currentUploaded,
      );
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleMarkCleared = () => {
    setError(null);
    startTransition(async () => {
      const res = await markFilingClearedAction(filing.id);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  };

  // Timeline 6 pasos derivados
  const paymentDoc = docsByType.get("payment");
  const timeline = [
    {
      date: formatDate(filing.arrived_at),
      label: "Arribo a puerto",
      meta: `${filing.port_code} · contenedor descargado`,
      done: true,
    },
    {
      date: "—",
      label: "DUA presentada",
      meta: `${filing.dua_code}${agent ? ` · ${agent.name}` : ""}`,
      done: true,
    },
    {
      date: "—",
      label: "Revisión documental",
      meta:
        filing.status === "observacion"
          ? "En observación"
          : "OK",
      done: filing.status !== "observacion",
    },
    {
      date: "—",
      label: "Inspección física",
      meta:
        filing.status === "observacion"
          ? "Solicitada por SENIAT"
          : "No requerida o aprobada",
      done:
        filing.status === "liberacion" ||
        filing.status === "pagado" ||
        filing.status === "liberado",
    },
    {
      date: paymentDoc?.uploaded_at
        ? formatDate(paymentDoc.uploaded_at)
        : "—",
      label: "Pago de aranceles",
      meta: paymentDoc?.uploaded
        ? `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "Pendiente",
      done: paymentDoc?.uploaded ?? false,
    },
    {
      date: formatDate(filing.cleared_at),
      label: "Liberación SENIAT",
      meta: isCleared ? "Liberado · listo retiro" : "Esperando",
      done: isCleared,
    },
  ];

  return (
    <div
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filing-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <h2
                id="filing-detail-title"
                className="studio-display"
                style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
              >
                {shipment?.code ?? "—"}
              </h2>
              <CustomsStatusBadge status={filing.status} size="md" />
            </div>
            <div
              style={{
                font: "600 11.5px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                marginBottom: 4,
              }}
            >
              DUA {filing.dua_code} · {vePortLabel(filing.port_code)}
            </div>
            {shipment?.client_name && (
              <div
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {shipment.client_name}
                {shipment.client_markbox && (
                  <>
                    {" · "}
                    <code style={{ color: "var(--wine)" }}>
                      {shipment.client_markbox}
                    </code>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: pending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* 1. Alert banner */}
          {filing.alert && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--danger-bg)",
                borderLeft: "3px solid var(--danger)",
                borderRadius: "var(--r-md)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span style={{ color: "var(--danger)", marginTop: 2 }}>
                {Icon.warn(15)}
              </span>
              <div>
                <div
                  className="studio-display"
                  style={{ fontSize: 13, color: "var(--ink)" }}
                >
                  Alerta SENIAT
                </div>
                <div
                  style={{
                    font: "500 12.5px/1.4 var(--f-sans)",
                    color: "var(--ink)",
                    marginTop: 3,
                  }}
                >
                  {filing.alert}
                </div>
              </div>
            </div>
          )}

          {/* 2. Cost breakdown */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
              Desglose de costos aduanales
            </div>
            <div
              style={{
                padding: "16px 18px",
                background: "var(--ink)",
                color: "var(--ink-inv)",
                borderRadius: "var(--r-lg)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <CostMini label="Arancel" value={Number(filing.total_duty)} />
                <CostMini label="IGTF 3%" value={Number(filing.igtf)} />
                <CostMini label="IVA 16%" value={Number(filing.iva)} />
                <CostMini label="Agente" value={Number(filing.agent_fee)} />
              </div>
              <div
                style={{
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    font: "700 11px/1 var(--f-sans)",
                    color: "var(--wine-soft)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Total a pagar SENIAT
                </span>
                <code
                  style={{
                    font: "900 22px/1 var(--f-mono)",
                    color: "var(--ink-inv)",
                  }}
                >
                  ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </code>
              </div>
            </div>
          </div>

          {/* 3. Checklist documental */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div className="studio-eyebrow">Checklist documental</div>
              <div
                style={{
                  font: "600 11.5px/1 var(--f-mono)",
                  color:
                    progress.requiredDone === progress.requiredTotal
                      ? "var(--success)"
                      : "var(--warning)",
                }}
              >
                {progress.requiredDone}/{progress.requiredTotal} req · {progress.done}/{progress.total} total
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {CUSTOMS_DOC_ORDER.map((type) => {
                const doc = docsByType.get(type);
                if (!doc) return null;
                const ok = doc.uploaded;
                const required = CUSTOMS_DOC_REQUIRED[type];
                const bg = ok
                  ? "var(--success-bg)"
                  : required
                    ? "var(--danger-bg)"
                    : "var(--bg-elevated)";
                const borderColor = ok
                  ? "var(--success)"
                  : required
                    ? "var(--danger)"
                    : "var(--border-strong)";
                const iconColor = ok
                  ? "var(--success)"
                  : required
                    ? "var(--danger)"
                    : "var(--ink-mute)";

                return (
                  <div
                    key={type}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr 80px 80px",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      background: bg,
                      borderRadius: "var(--r-md)",
                      borderLeft: `3px solid ${borderColor}`,
                    }}
                  >
                    <span style={{ color: iconColor }}>
                      {ok ? Icon.check(14) : Icon.close(14)}
                    </span>
                    <span
                      style={{
                        font: "600 12.5px/1.2 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {CUSTOMS_DOC_LABELS[type]}
                    </span>
                    {required ? (
                      <Badge tone={ok ? "success" : "danger"} size="sm">
                        {ok ? "OK" : "falta"}
                      </Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        opcional
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleDoc(doc.id, ok)}
                      disabled={pending}
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      style={{
                        height: 28,
                        padding: "0 10px",
                      }}
                    >
                      {ok ? "Desmarcar" : "Marcar OK"}
                    </button>
                  </div>
                );
              })}
            </div>

            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "8px 0 0",
              }}
            >
              V1 sin upload real · marcá OK cuando el documento físico/escaneado
              existe en otro sistema. Upload directo a Storage llega en SDD-0018.1.
            </p>
          </div>

          {/* 4. HS codes */}
          {filing.hs_codes.length > 0 && (
            <div>
              <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
                HS codes declarados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {filing.hs_codes.map((code) => (
                  <Badge key={code} tone="wine" size="md">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 5. Agente */}
          {agent && (
            <div>
              <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
                Agente aduanal asignado
              </div>
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <Avatar
                  initials={initialsFrom(agent.contact_name ?? agent.name)}
                  size={44}
                  color="wine"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="studio-display"
                    style={{ fontSize: 14, color: "var(--ink)" }}
                  >
                    {agent.name}
                  </div>
                  <div
                    style={{
                      font: "500 11.5px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 4,
                    }}
                  >
                    {agent.contact_name ?? "—"}
                    {agent.rating != null && ` · ★ ${agent.rating.toFixed(1)}`}
                  </div>
                  <code
                    style={{
                      font: "600 11px/1.2 var(--f-mono)",
                      color: "var(--ink-soft)",
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {agent.phone ?? "—"}
                    {agent.rif && ` · RIF ${agent.rif}`}
                  </code>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {agent.phone && (
                    <a
                      href={`tel:${agent.phone.replace(/\s/g, "")}`}
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      style={{ height: 32 }}
                    >
                      Llamar
                    </a>
                  )}
                  {agent.email && (
                    <a
                      href={`mailto:${agent.email}`}
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      style={{ height: 32 }}
                    >
                      Email
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. Timeline */}
          <div>
            <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
              Timeline SENIAT
            </div>
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              {timeline.map((t, i) => (
                <div
                  key={t.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 22px 1fr",
                    gap: 12,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      font: "600 11px/1 var(--f-mono)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {t.date}
                  </span>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: t.done
                        ? "var(--success)"
                        : "var(--bg-elevated)",
                      color: t.done ? "var(--ink-inv)" : "var(--ink-mute)",
                      border: `2px solid ${t.done ? "var(--success)" : "var(--border-strong)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      font: "700 10px/1 var(--f-sans)",
                    }}
                  >
                    {t.done ? Icon.check(10) : ""}
                  </span>
                  <div>
                    <div
                      style={{
                        font: `${t.done ? "700" : "500"} 12.5px/1.2 var(--f-sans)`,
                        color: t.done ? "var(--ink)" : "var(--ink-soft)",
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-mute)",
                        marginTop: 2,
                      }}
                    >
                      {t.meta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observations */}
          {filing.observations && (
            <div>
              <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
                Observaciones
              </div>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 14px",
                  font: "500 12.5px/1.5 var(--f-sans)",
                  color: "var(--ink)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {filing.observations}
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          {agent?.phone && (
            <a
              href={`tel:${agent.phone.replace(/\s/g, "")}`}
              className="studio-btn studio-btn-ghost"
            >
              Contactar agente
            </a>
          )}
          {!isCleared && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={handleMarkCleared}
              disabled={pending || !canClear}
              title={
                !canClear && progress.missingRequired.length > 0
                  ? `Faltan: ${progress.missingRequired.map((t) => CUSTOMS_DOC_LABELS[t]).join(", ")}`
                  : undefined
              }
            >
              {pending ? "Procesando…" : "Marcar liberado"}
            </button>
          )}
          {isCleared && (
            <span
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--success)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {Icon.check(13)} Trámite liberado el {formatDate(filing.cleared_at)}
            </span>
          )}
        </footer>
      </aside>
    </div>
  );
}

function CostMini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-inv-mute)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <code
        style={{
          font: "800 14px/1 var(--f-mono)",
          color: "var(--ink-inv)",
          display: "block",
          marginTop: 6,
        }}
      >
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </code>
    </div>
  );
}
