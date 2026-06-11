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

import { Fragment, useState } from "react";
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
import { fmtUsd } from "../format";
import { accreditReferral, updateReferralStatus } from "../actions";

export function ReferralDrawer({
  referral,
  onClose,
}: {
  referral: Referral;
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
                        color: done ? "var(--ink-inv)" : "var(--ink-mute)",
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
              {referral.status === "acreditado"
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

        {/* Acciones manuales */}
        {referral.status !== "acreditado" && (
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
