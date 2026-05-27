"use client";

/**
 * /m/ve/login — Login del operario VE (SDD-0030).
 *
 * Numpad PIN 4 dígitos. Sin selector de idioma (operarios VE son
 * hispanohablantes; el CN sí necesita ES/中文).
 *
 * Conecta con `signInOperarioVeAction` que valida + redirige según role
 * (bodeguero → /m/ve/bodeguero · camionero → /m/ve/camionero).
 */

import { startTransition, useActionState, useEffect, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { signInOperarioVeAction } from "./actions";
import type { SignInOperarioState } from "@/lib/studio/operario-types";

const initialState: SignInOperarioState = {};

export default function OperarioVeLoginPage() {
  const [state, formAction, isPending] = useActionState(
    signInOperarioVeAction,
    initialState,
  );
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (state.error && pin.length === 4) {
      setShake(true);
      const timer = setTimeout(() => {
        setShake(false);
        setPin("");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [state.error, pin.length]);

  const submitPin = (full: string) => {
    const fd = new FormData();
    fd.set("pin", full);
    startTransition(() => formAction(fd));
  };

  const handleDigit = (d: string) => {
    if (isPending) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submitPin(next);
  };

  const handleBackspace = () => {
    if (isPending) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)",
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px)",
        color: "var(--ink-inv)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 4,
          font: "900 18px/1 var(--f-display)",
          letterSpacing: "-0.01em",
          marginBottom: "var(--s-8)",
        }}
      >
        <span>DTD</span>
        <span style={{ color: "var(--wine-soft)" }}>DESPACHO VE</span>
      </div>

      {/* Centro */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--s-6)",
        }}
      >
        <div>
          <div
            style={{
              font: "700 11px/1 var(--f-sans)",
              color: "var(--wine-soft)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            DTD Cargo · Venezuela
          </div>
          <h1
            style={{
              font: "900 32px/1.05 var(--f-display)",
              margin: "12px 0 8px",
              letterSpacing: "-0.025em",
            }}
          >
            Bodeguero o camionero
          </h1>
          <p
            style={{
              font: "500 14px/1.4 var(--f-sans)",
              color: "var(--ink-inv-soft)",
              margin: 0,
            }}
          >
            Ingresá tu PIN de 4 dígitos
          </p>
        </div>

        {/* PIN dots */}
        <div
          style={{
            display: "flex",
            gap: 14,
            animation: shake ? "pin-shake 0.35s linear" : undefined,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden
              style={{
                display: "block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: shake
                  ? "var(--danger)"
                  : i < pin.length
                    ? "var(--wine-soft)"
                    : "transparent",
                border: `2px solid ${shake ? "var(--danger)" : "rgba(255,255,255,0.4)"}`,
                transition: "background var(--dur-fast) var(--ease)",
              }}
            />
          ))}
        </div>

        {/* Error */}
        {state.error && (
          <p
            role="alert"
            style={{
              font: "600 12.5px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "var(--s-2) var(--s-3)",
              background: "rgba(168, 50, 62, 0.18)",
              border: "1px solid rgba(168, 50, 62, 0.35)",
              borderRadius: "var(--r-sm)",
              maxWidth: "32ch",
            }}
          >
            {state.error}
          </p>
        )}

        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            @keyframes pin-shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-8px); }
              75% { transform: translateX(8px); }
            }
          }
        `}</style>

        {/* Numpad */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 72px)",
            gap: 14,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <NumpadButton
              key={n}
              onClick={() => handleDigit(String(n))}
              disabled={isPending}
            >
              {n}
            </NumpadButton>
          ))}
          <span aria-hidden />
          <NumpadButton onClick={() => handleDigit("0")} disabled={isPending}>
            0
          </NumpadButton>
          <NumpadButton
            onClick={handleBackspace}
            disabled={isPending || pin.length === 0}
            ariaLabel="Borrar último dígito"
            ghost
          >
            {Icon.close(22)}
          </NumpadButton>
        </div>

        {isPending && (
          <div
            style={{
              font: "500 12px/1 var(--f-sans)",
              color: "var(--ink-inv-mute)",
            }}
          >
            Verificando…
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-inv-mute)",
        }}
      >
        DTD Cargo 2026 · Despacho VE
      </div>
    </div>
  );
}

function NumpadButton({
  children,
  onClick,
  disabled,
  ghost,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ghost?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: ghost ? "transparent" : "rgba(255,255,255,0.08)",
        color: ghost ? "var(--ink-inv-mute)" : "var(--ink-inv)",
        font: "900 28px/1 var(--f-display)",
        border: ghost ? 0 : "1px solid rgba(255,255,255,0.12)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
      onTouchStart={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "scale(0.94)";
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}
