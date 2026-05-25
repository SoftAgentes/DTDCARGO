"use client";

/**
 * /m/cn/login — Login del operario CN (sketch sin backend).
 *
 * Numpad PIN 4 dígitos. Bilingüe ES/CN. Fondo navy gradient (único
 * gradient brand-aprobado: var(--ink) → #1F3055).
 *
 * V1 stub: cualquier PIN de 4 dígitos navega a /m/cn (home).
 * V2 (SDD-0027 pendiente): server action `signInOperario(warehouse, pin)`
 * valida contra tabla `operario_pins` y setea cookie HTTP-only.
 *
 * Iconografía: Icon set del Studio (`@/app/studio/_components/icons`).
 * Cero emojis decorativos (regla BRAND.md).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";

type Lang = "es" | "cn";

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);

export default function OperarioLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [lang, setLang] = useState<Lang>("es");
  const [submitting, setSubmitting] = useState(false);

  const handleDigit = (d: string) => {
    if (submitting) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setSubmitting(true);
      // V1 stub — cualquier PIN entra. SDD-0027 reemplaza por server action.
      setTimeout(() => router.push("/m/cn"), 280);
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
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
        padding: "calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px)",
        color: "var(--ink-inv, #FFFFFF)",
      }}
    >
      {/* Top row: brand + lang switch */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--s-8)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 4,
            font: "900 18px/1 var(--f-display)",
            letterSpacing: "-0.01em",
          }}
        >
          <span>DTD</span>
          <span style={{ color: "var(--wine-soft, #C2747F)" }}>OPERARIO</span>
        </div>
        <LangSwitch lang={lang} setLang={setLang} />
      </div>

      {/* Centro: eyebrow + título + PIN dots + numpad */}
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
              color: "var(--wine-soft, #C2747F)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            DTD·CARGO · 操作员
          </div>
          <h1
            style={{
              font: "900 32px/1.05 var(--f-display)",
              margin: "12px 0 8px",
              letterSpacing: "-0.025em",
            }}
          >
            {t(lang, "Almacén Yiwu", "义乌仓库")}
          </h1>
          <p
            style={{
              font: "500 14px/1.4 var(--f-sans)",
              color: "rgba(255,255,255,0.7)",
              margin: 0,
            }}
          >
            {t(
              lang,
              "Ingresá tu PIN de 4 dígitos",
              "请输入4位PIN密码",
            )}
          </p>
        </div>

        {/* PIN dots */}
        <div
          style={{
            display: "flex",
            gap: 14,
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
                background:
                  i < pin.length ? "var(--wine-soft, #C2747F)" : "transparent",
                border: "2px solid rgba(255,255,255,0.4)",
                transition: "background var(--dur-fast) var(--ease)",
              }}
            />
          ))}
        </div>

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
              disabled={submitting}
            >
              {n}
            </NumpadButton>
          ))}
          <span aria-hidden />
          <NumpadButton onClick={() => handleDigit("0")} disabled={submitting}>
            0
          </NumpadButton>
          <NumpadButton
            onClick={handleBackspace}
            disabled={submitting || pin.length === 0}
            ariaLabel={t(lang, "Borrar último dígito", "删除")}
            ghost
          >
            {Icon.close(22)}
          </NumpadButton>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          font: "500 11px/1.4 var(--f-sans)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {t(lang, "Wang Hua · 王华 · YIW-A1", "Wang Hua · 王华 · YIW-A1")}
        <br />
        v1.0 · DTD·CARGO 2026
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────

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
        color: ghost ? "rgba(255,255,255,0.6)" : "#FFFFFF",
        font: "900 28px/1 var(--f-display)",
        border: ghost ? 0 : "1px solid rgba(255,255,255,0.12)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition:
          "background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease)",
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

function LangSwitch({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const opts: { v: Lang; l: string; cn?: boolean }[] = [
    { v: "es", l: "ES" },
    { v: "cn", l: "中文", cn: true },
  ];
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        padding: 3,
        background: "rgba(255,255,255,0.08)",
        borderRadius: "var(--r-md)",
      }}
    >
      {opts.map((o) => {
        const active = lang === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setLang(o.v)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-sm)",
              background: active ? "var(--wine, #7F0F1A)" : "transparent",
              color: active ? "#FFFFFF" : "rgba(255,255,255,0.6)",
              border: 0,
              font: `700 12px/1 ${o.cn ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
              cursor: "pointer",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
