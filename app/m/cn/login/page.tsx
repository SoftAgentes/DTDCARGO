"use client";

/**
 * /m/cn/login — Login del operario CN (SDD-0027).
 *
 * Numpad PIN 4 dígitos. Bilingüe ES/CN. Fondo navy gradient (único
 * gradient brand-aprobado: var(--ink) → #1F3055).
 *
 * Conecta con `signInOperarioAction` server action que valida contra
 * tabla `operario_pins` via RPC y setea cookie HTTP-only `dtd_op`.
 *
 * Iconografía: Icon set del Studio. Cero emojis decorativos (BRAND.md).
 * Texto sobre fondo navy: usa `--ink-inv-soft` y `--ink-inv-mute` del
 * tokens.css del Studio (regla CLAUDE.md raíz §tokens).
 */

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "@/app/studio/_components/icons";
import {
  LANG_COOKIE_NAME,
  setOperarioLangClient,
  type Lang,
} from "@/lib/lang";
import { signInOperarioAction } from "./actions";
import type { SignInOperarioState } from "@/lib/studio/operario-types";

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);
const initialState: SignInOperarioState = {};
const LANG_EVENT = "dtd-operario-lang";

/** Lee la cookie de lang del client (no SSR). Fallback "es". */
function readLangCookie(): Lang {
  if (typeof document === "undefined") return "es";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LANG_COOKIE_NAME}=([^;]+)`),
  );
  return match?.[1] === "cn" ? "cn" : "es";
}

function subscribeLang(onChange: () => void): () => void {
  window.addEventListener(LANG_EVENT, onChange);
  return () => window.removeEventListener(LANG_EVENT, onChange);
}

export default function OperarioLoginPage() {
  const [state, formAction, isPending] = useActionState(
    signInOperarioAction,
    initialState,
  );
  const [pin, setPin] = useState("");
  const lang = useSyncExternalStore<Lang>(
    subscribeLang,
    readLangCookie,
    () => "es",
  );
  const [shake, setShake] = useState(false);
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.error && pin.length === 4) setShake(true);
  }

  const setLang = (next: Lang) => {
    setOperarioLangClient(next);
    window.dispatchEvent(new Event(LANG_EVENT));
  };

  // Cuando server retorna error, sacudir + limpiar PIN
  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => {
      setShake(false);
      setPin("");
    }, 350);
    return () => clearTimeout(timer);
  }, [shake]);

  const submitPin = (full: string) => {
    const fd = new FormData();
    fd.set("pin", full);
    // React 19 exige startTransition al invocar useActionState fuera de <form>
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
          "linear-gradient(160deg, #0F1E3D 0%, #1F3055 100%)",
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px)",
        color: "var(--ink-inv)",
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
          <span style={{ color: "var(--wine-soft)" }}>OPERARIO</span>
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
              color: "var(--wine-soft)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            DTD Cargo · 操作员
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
              color: "var(--ink-inv-soft)",
              margin: 0,
            }}
          >
            {t(lang, "Ingresa tu PIN de 4 dígitos", "请输入4位PIN密码")}
          </p>
        </div>

        {/* PIN dots con shake en error (respeta prefers-reduced-motion) */}
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

        {/* Error message (cuando PIN incorrecto) */}
        {state.error && (
          <p
            role="alert"
            style={{
              font: "600 12.5px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "var(--s-2) var(--s-3)",
              background: "var(--danger-bg-strong)",
              border: "1px solid var(--danger-border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {state.error}
          </p>
        )}

        {/* Reduced-motion safe: shake solo cuando el OS lo permite */}
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
            ariaLabel={t(lang, "Borrar último dígito", "删除")}
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
            {t(lang, "Verificando…", "验证中…")}
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
        {t(lang, "Wang Hua · 王华 · YIW-A1", "Wang Hua · 王华 · YIW-A1")}
        <br />
        v1.0 · DTD Cargo 2026
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
        background: ghost ? "transparent" : "var(--surface-inv)",
        color: ghost ? "var(--ink-inv-mute)" : "var(--ink-inv)",
        font: "900 28px/1 var(--f-display)",
        border: ghost ? 0 : "1px solid var(--border-inv)",
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
        background: "var(--surface-inv)",
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
              background: active ? "var(--wine)" : "transparent",
              color: active ? "var(--ink-inv)" : "var(--ink-inv-mute)",
              border: 0,
              font: `700 12px/1 ${
                o.cn ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"
              }`,
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
