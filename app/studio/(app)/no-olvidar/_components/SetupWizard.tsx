"use client";

/**
 * <SetupWizard> — wizard obligatorio de primer uso del No-Olvidar (SDD-0025 §4.12).
 *
 * 4 pasos: (1) intro + términos · (2) master password opcional · (3) TOTP con QR ·
 * (4) recovery kit de 24 palabras (post-submit) para imprimir. El submit llama a
 * setupNoOlvidarAction, que devuelve el recovery kit UNA vez.
 *
 * El secret TOTP y su QR se generan en el server (page) y llegan por props; el
 * form los reenvía en un hidden para que el server cifre el mismo secret que se
 * mostró. Solo tokens var(--*).
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { setupNoOlvidarAction, type SetupResult } from "../actions";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";

interface SetupWizardProps {
  totpSecret: string;
  totpUri: string;
}

type Step = 1 | 2 | 3;

export function SetupWizard({ totpSecret, totpUri }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [terms, setTerms] = useState(false);
  const [wantMasterPw, setWantMasterPw] = useState(false);
  const [savedKit, setSavedKit] = useState(false);
  const [state, formAction, isPending] = useActionState<SetupResult, FormData>(
    setupNoOlvidarAction,
    {},
  );

  // Post-submit: si el server devolvió el recovery kit, mostramos el paso final.
  if (state.ok && state.recoveryKit) {
    const words = state.recoveryKit.split(" ");
    return (
      <Shell title="Guarda tu recovery kit" step={4}>
        <p style={pStyle}>
          Estas 24 palabras son tu última vía de recuperación si pierdes la master password Y
          quedas fuera. <strong>Escríbelas en papel y guárdalas en un lugar físico seguro.</strong>{" "}
          No las guardes en la nube ni les saques screenshot.
        </p>
        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            listStyle: "none",
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface-sel)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          {words.map((w, i) => (
            <li key={i} style={{ color: "var(--ink)" }}>
              <span style={{ color: "var(--ink-mute)" }}>{i + 1}.</span> {w}
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => window.print()} style={ghostBtn}>
          Imprimir
        </button>
        <label style={checkRow}>
          <input type="checkbox" checked={savedKit} onChange={(e) => setSavedKit(e.target.checked)} />
          <span style={{ fontSize: 13, color: "var(--ink)" }}>
            Guardé el recovery kit en un lugar físico seguro.
          </span>
        </label>
        <button
          type="button"
          disabled={!savedKit}
          onClick={() => router.replace("/studio/no-olvidar")}
          style={primaryBtn(!savedKit)}
        >
          Entrar al No-Olvidar
        </button>
      </Shell>
    );
  }

  return (
    <form action={formAction}>
      {/* Hidden: se envían en todos los pasos, el server valida al final. */}
      <input type="hidden" name="totp_secret" value={totpSecret} />
      <input type="hidden" name="terms" value={terms ? "on" : ""} />

      {step === 1 && (
        <Shell title="Bienvenido al No-Olvidar" step={1}>
          <p style={pStyle}>
            Es la caja fuerte interna de DTD para contraseñas y secretos. Tus items se cifran y solo
            vos los ves. En caso necesario, dos admins pueden ayudarte a recuperar el acceso
            (recovery M-of-N).
          </p>
          <p style={{ ...pStyle, color: "var(--ink-mute)" }}>
            Nota honesta: en web no se pueden bloquear los screenshots. Asume siempre que lo que
            revelas en pantalla puede ser fotografiado.
          </p>
          <label style={checkRow}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span style={{ fontSize: 13, color: "var(--ink)" }}>
              Entiendo cómo funciona y acepto usarlo con responsabilidad.
            </span>
          </label>
          <button type="button" disabled={!terms} onClick={() => setStep(2)} style={primaryBtn(!terms)}>
            Continuar
          </button>
        </Shell>
      )}

      {step === 2 && (
        <Shell title="Master password (opcional)" step={2}>
          <p style={pStyle}>
            Una capa extra: si la configuras, hará falta además del 2FA para desbloquear. Si la
            dejas vacía, tus items se protegen igual con la llave del servidor y el recovery es más
            simple.
          </p>
          <label style={checkRow}>
            <input
              type="checkbox"
              checked={wantMasterPw}
              onChange={(e) => setWantMasterPw(e.target.checked)}
            />
            <span style={{ fontSize: 13, color: "var(--ink)" }}>Quiero configurar master password</span>
          </label>
          {wantMasterPw && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                Master password (mín. 12 caracteres, 3 de 4 tipos)
              </span>
              <input name="master_password" type="password" minLength={12} style={inputStyle} />
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setStep(1)} style={ghostBtn}>
              Atrás
            </button>
            <button type="button" onClick={() => setStep(3)} style={primaryBtn(false)}>
              Continuar
            </button>
          </div>
        </Shell>
      )}

      {step === 3 && (
        <Shell title="Configurá tu 2FA" step={3}>
          <p style={pStyle}>
            Escanea este código con tu app de autenticación (Google Authenticator, Authy…) y escribe
            el código de 6 dígitos para confirmar.
          </p>
          <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "var(--surface-inv)", borderRadius: 8 }}>
            <QRCodeSVG value={totpUri} size={168} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>Código 2FA</span>
            <input
              name="totp_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              required
              placeholder="000000"
              style={{ ...inputStyle, letterSpacing: 6, textAlign: "center", fontFamily: "var(--font-mono)" }}
            />
          </label>
          <ErrorAlert state={state} compact />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setStep(2)} style={ghostBtn}>
              Atrás
            </button>
            <button type="submit" disabled={isPending} style={primaryBtn(isPending)}>
              {isPending ? "Finalizando…" : "Finalizar setup"}
            </button>
          </div>
        </Shell>
      )}
    </form>
  );
}

// ─── Sub-componentes / estilos ───────────────────────────────

function Shell({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>Paso {step} de 4</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}

const pStyle: React.CSSProperties = { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 };

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-sel)",
  color: "var(--ink)",
  fontSize: 15,
};

const checkRow: React.CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start" };

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: disabled ? "var(--wine-soft)" : "var(--wine)",
    color: "var(--color-on-accent)",
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? "default" : "pointer",
    flex: 1,
  };
}

const ghostBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-inv)",
  color: "var(--ink)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
