"use client";

/**
 * Drawer de detalle de un referido (SDD-0051, Slice B).
 *
 * Timeline de estados (REFERRAL_STEPS) + datos + tarjetas de crédito/descuento +
 * acciones manuales: avanzar estado (updateReferralStatus) y acreditar el
 * crédito al referidor (accreditReferral · ADVISORY, no postea a Facturación).
 *
 * Solo lectura/acciones; el alta vive en RegisterReferralDrawer.
 */

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  REFERRAL_RULES,
  REFERRAL_STATUS,
  REFERRAL_STEPS,
  referralShareCode,
  type Referral,
  type ReferralStatus,
} from "@/lib/studio/fidelizacion/types";
import type { ReferralCreditMode } from "@/lib/studio/accounting/referral-credit-posting";
import type { ApplicableInvoice } from "@/lib/studio/fidelizacion/referral-credit-queries";
import { fmtUsd } from "../format";
import {
  accreditReferral,
  applyReferralCredit,
  listApplicableInvoices,
  updateReferralStatus,
} from "../actions";

/** Etiqueta legible del modo de reflejo contable (es-VE). */
function creditModeLabel(mode: ReferralCreditMode): string {
  return mode === "marketing_expense"
    ? "gasto de marketing (DR 6.11 / CR 1.1.2 CxC)"
    : "descuento sobre ventas (DR 4.9 / CR 1.1.2 CxC)";
}

export function ReferralDrawer({
  referral,
  canApplyCredit,
  creditMode,
  onClose,
}: {
  referral: Referral;
  canApplyCredit: boolean;
  creditMode: ReferralCreditMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const stt = REFERRAL_STATUS[referral.status];
  const shareCode = referralShareCode(referral.referrer_markbox);

  // Próximo estado en el pipeline (para "avanzar estado" manual).
  const stepIdx = REFERRAL_STEPS.indexOf(referral.status);
  const nextStatus: ReferralStatus | null =
    stepIdx >= 0 && stepIdx < REFERRAL_STEPS.length - 1
      ? REFERRAL_STEPS[stepIdx + 1]
      : null;

  const afterMutation = (msg: string) => {
    toast.success(msg);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={referral.referral_code}
      subtitle={`${referral.referred_name} · referido por ${referral.referrer_markbox}`}
      onClose={onClose}
      pending={false}
      width={620}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
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

        {/* Timeline */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {REFERRAL_STEPS.map((s, i) => {
              const done = i <= stt.step;
              const meta = REFERRAL_STATUS[s];
              const isCurrent = i === stt.step;
              return (
                <Fragment key={s}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 7,
                      flexShrink: 0,
                      width: 70,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: done ? "var(--wine)" : "var(--bg-elevated)",
                        color: done ? "var(--ink-inv)" : "var(--ink-soft)",
                        border: done ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {done ? (
                        Icon.check(14)
                      ) : (
                        <span style={{ font: "700 11px/1 var(--f-sans)" }}>
                          {i + 1}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        font: `${isCurrent ? "700" : "500"} 10px/1.2 var(--f-sans)`,
                        color: isCurrent
                          ? "var(--wine)"
                          : done
                            ? "var(--ink)"
                            : "var(--ink-mute)",
                        textAlign: "center",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {i < REFERRAL_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        background:
                          i < stt.step ? "var(--wine)" : "var(--border)",
                        marginBottom: 18,
                      }}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Datos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <DataField label="Quien refiere" value={referral.referrer_markbox} mono />
          <DataField label="Código para compartir" value={shareCode} mono />
          <DataField label="Nuevo cliente" value={referral.referred_name} />
          <DataField label="Empresa" value={referral.referred_company ?? "—"} />
          <DataField label="Correo" value={referral.referred_email ?? "—"} />
          <DataField label="Teléfono" value={referral.referred_phone ?? "—"} />
          <DataField
            label="Estado"
            value={
              <Badge tone={stt.tone} dot>
                {stt.label}
              </Badge>
            }
          />
          <DataField
            label="Registrado"
            value={referral.created_at?.slice(0, 10) ?? "—"}
            mono
          />
        </div>

        {referral.notes && (
          <DataField label="Notas" value={referral.notes} />
        )}

        {/* Tarjetas crédito / descuento */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              background: "var(--success-bg)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--success)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Crédito a quien refiere
            </div>
            <div
              style={{
                font: "900 20px/1 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {fmtUsd(REFERRAL_RULES.referrerReward)}
            </div>
            <div
              style={{
                font: "500 10.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              {referral.status === "aplicado"
                ? `Aplicado${referral.applied_at ? ` el ${referral.applied_at.slice(0, 10)}` : ""} a la próxima factura del referidor`
                : referral.status === "acreditado"
                  ? "Acreditado · pendiente de aplicar a la próxima factura"
                  : "Se acredita al primer embarque del referido"}
            </div>
          </div>
          <div
            style={{
              padding: "14px 16px",
              background: "var(--info-bg)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--info)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Descuento al referido
            </div>
            <div
              style={{
                font: "900 20px/1 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {fmtUsd(REFERRAL_RULES.referredReward)}
            </div>
            <div
              style={{
                font: "500 10.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              En su primer embarque DDP
            </div>
          </div>
        </div>

        {/* SDD-0137 · Aplicar el crédito acreditado a una factura (mueve plata) */}
        {referral.status === "acreditado" && canApplyCredit && (
          <ApplyCreditPanel
            referral={referral}
            creditMode={creditMode}
            onError={setError}
            onApplied={(msg) => afterMutation(msg)}
          />
        )}

        {/* Crédito ya aplicado: resumen (todos los roles lo ven) */}
        {referral.status === "aplicado" && (
          <div
            style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--wine-text)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Crédito aplicado
            </div>
            <div
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {fmtUsd(referral.reward_usd)} aplicados a la CxC del referidor
              {referral.applied_at
                ? ` el ${referral.applied_at.slice(0, 10)}`
                : ""}
              . Reflejo contable: {creditModeLabel(creditMode)}. La factura fiscal
              queda intacta (no toca base ni IVA).
            </div>
          </div>
        )}

        {/* Acciones manuales */}
        {referral.status !== "acreditado" && referral.status !== "aplicado" && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {nextStatus && nextStatus !== "acreditado" && (
              <ActionButton
                variant="dark"
                size="sm"
                idleLabel={`Marcar ${REFERRAL_STATUS[nextStatus].label}`}
                loadingLabel="Actualizando…"
                successLabel="Actualizado"
                onAction={() =>
                  updateReferralStatus(referral.id, nextStatus)
                }
                onSuccess={() =>
                  afterMutation(
                    `Referido ${referral.referral_code} → ${REFERRAL_STATUS[nextStatus].label}`,
                  )
                }
                onError={setError}
              />
            )}
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel={`Acreditar ${fmtUsd(REFERRAL_RULES.referrerReward)}`}
              loadingLabel="Acreditando…"
              successLabel="Acreditado"
              idleIcon={Icon.check(13)}
              onAction={() => accreditReferral(referral.id)}
              onSuccess={() =>
                afterMutation(
                  `Crédito de ${fmtUsd(REFERRAL_RULES.referrerReward)} acreditado a ${referral.referrer_markbox} · aplícalo a mano en la próxima factura`,
                )
              }
              onError={setError}
            />
          </div>
        )}
      </div>

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
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
        >
          Cerrar
        </button>
      </footer>
    </DrawerShell>
  );
}

/**
 * Panel de aplicación del crédito (SDD-0137). Solo lo ve rol dinero
 * (accounting/admin) sobre un crédito 'acreditado'. Carga las facturas del
 * referidor a las que se puede aplicar (billable · USD/USDT · total ≥ crédito)
 * y aplica el crédito a la elegida. El gate REAL fail-closed vive en la server
 * action; este panel solo es la UX de la propuesta.
 */
function ApplyCreditPanel({
  referral,
  creditMode,
  onError,
  onApplied,
}: {
  referral: Referral;
  creditMode: ReferralCreditMode;
  onError: (msg: string) => void;
  onApplied: (msg: string) => void;
}) {
  const [invoices, setInvoices] = useState<ApplicableInvoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await listApplicableInvoices(referral.id);
      if (!alive) return;
      if (r.error) {
        onError(r.error);
        setInvoices([]);
      } else {
        setInvoices(r.invoices ?? []);
        if (r.invoices && r.invoices.length > 0) {
          setSelected(r.invoices[0].id);
        }
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [referral.id, onError]);

  return (
    <div
      style={{
        padding: "16px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--wine)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Aplicar {fmtUsd(referral.reward_usd)} a una factura
        </div>
        <div
          style={{
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          El crédito baja la CxC del referidor {referral.referrer_markbox} en su
          próxima factura. Reflejo contable: {creditModeLabel(creditMode)}. No
          toca la base imponible ni el IVA.
        </div>
      </div>

      {loading ? (
        <div
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Buscando facturas del referidor…
        </div>
      ) : invoices && invoices.length > 0 ? (
        <>
          <select
            className="studio-input"
            aria-label="Factura a la que aplicar el crédito"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_code} · {fmtUsd(inv.total_amount)} {inv.currency}
                {inv.issued_at ? ` · ${inv.issued_at.slice(0, 10)}` : ""}
              </option>
            ))}
          </select>
          <div>
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel={`Aplicar ${fmtUsd(referral.reward_usd)}`}
              loadingLabel="Aplicando…"
              successLabel="Aplicado"
              idleIcon={Icon.check(13)}
              disabled={!selected}
              onAction={() => applyReferralCredit(referral.id, selected)}
              onSuccess={() =>
                onApplied(
                  `Crédito de ${fmtUsd(referral.reward_usd)} aplicado a la factura de ${referral.referrer_markbox}`,
                )
              }
              onError={onError}
            />
          </div>
        </>
      ) : (
        <div
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          El referidor {referral.referrer_markbox} no tiene una factura elegible
          todavía (emitida/parcial/vencida, en USD/USDT y con total ≥{" "}
          {fmtUsd(referral.reward_usd)}). El crédito espera a una factura
          suficiente.
        </div>
      )}
    </div>
  );
}

function DataField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono
            ? "600 12.5px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
