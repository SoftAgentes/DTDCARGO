"use client";

/**
 * OAuthFlowModal — flow OAuth en 3 steps mock (SDD-0034).
 *
 * Step 1: "Vamos a redirigirte" + botón "Continuar con {provider}".
 * Step 2: spinner 1.8s "Autorizando…".
 * Step 3: check verde "Conectado correctamente".
 *
 * V1: mock total. SDD futuro con OAuth client real del provider.
 */

import { useEffect, useState } from "react";
import { ModalShell } from "./ProfileModal";

export type OAuthProvider = "gmail" | "outlook";

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  gmail: "Google · Gmail",
  outlook: "Microsoft · Outlook",
};

const PROVIDER_COLORS: Record<OAuthProvider, string> = {
  gmail: "#4285F4",
  outlook: "#0078D4",
};

export function OAuthFlowModal({
  provider,
  onClose,
}: {
  provider: OAuthProvider;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(() => setStep(3), 1800);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <ModalShell title="Conectar cuenta de email" onClose={onClose} width={480}>
      <div
        style={{
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {step === 1 && (
          <>
            <div
              style={{
                font: "800 16px/1.2 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              Vamos a conectarte con {PROVIDER_LABELS[provider]}
            </div>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                maxWidth: "32ch",
              }}
            >
              Te vamos a redirigir al sitio del proveedor para que autorices a
              DTD·Studio a mandar emails desde tu cuenta.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                marginTop: 8,
                padding: "12px 24px",
                background: PROVIDER_COLORS[provider],
                color: "var(--ink-inv)",
                border: 0,
                borderRadius: "var(--r-sm)",
                font: "700 14px/1 var(--f-sans)",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              Continuar con {PROVIDER_LABELS[provider].split(" · ")[0]}
            </button>
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: 0,
                maxWidth: "36ch",
              }}
            >
              V1: mock · no se redirige. SDD futuro implementa OAuth real.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                border: "3px solid var(--border)",
                borderTopColor: "var(--wine)",
                borderRadius: "50%",
                animation: "dtd-spin 0.7s linear infinite",
              }}
            />
            <style>{`
              @keyframes dtd-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div
              style={{
                font: "700 14px/1.2 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              Autorizando…
            </div>
            <p
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              Esperando confirmación de {PROVIDER_LABELS[provider]}.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--success-bg)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "900 32px/1 var(--f-display)",
              }}
            >
              ✓
            </div>
            <div
              style={{
                font: "900 18px/1.2 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              Conectado correctamente
            </div>
            <p
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                maxWidth: "32ch",
              }}
            >
              {PROVIDER_LABELS[provider]} quedó vinculado a tu cuenta. Ahora
              puedes mandar emails desde el módulo Mailing.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="studio-btn studio-btn-primary"
              style={{ marginTop: 4 }}
            >
              Listo
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}
