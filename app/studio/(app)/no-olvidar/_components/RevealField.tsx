"use client";

/**
 * <RevealField> — el campo más sensible del No-Olvidar (SDD-0025 §4.16).
 *
 * Muestra un secreto (password, CVC, TOTP secret…) con las 6 mitigaciones
 * anti-screenshot best-effort. **Ninguna bloquea una captura real** — en web es
 * imposible; suben la barrera contra capturas casuales y habilitan forensics.
 * El copy es honesto: "asumí que tu pantalla puede ser fotografiada".
 *
 * El plaintext se busca LAZY (onReveal → server action revealItemAction) y vive
 * SOLO en useState local; nunca en URL, storage ni props del server.
 *
 * Mitigaciones (configurables desde no_olvidar_config):
 *   1. hold-to-reveal          (holdToReveal)
 *   2. auto-hide agresivo       (autoHideSeconds)
 *   3. blur al perder foco      (blurOnWindowBlur)
 *   4. watermark forense        (forensicWatermark)
 *   5. bloqueo copy/contextmenu (blockCopyEvent) — el copy va por el botón
 *   6. char-by-char opt-in      (charByChar)
 *
 * Solo tokens var(--*). Secreto en var(--font-mono).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ForensicWatermark } from "./ForensicWatermark";

interface RevealFieldProps {
  /** Etiqueta del campo (ej. "Contraseña"). */
  label?: string;
  /** Busca el plaintext (llama a revealItemAction). Se cachea tras el 1er reveal. */
  onReveal: () => Promise<string | null>;
  /** Audita el copy (llama a copyItemFieldAction). El copy real lo hace este componente. */
  onCopyAudit?: () => void;
  /** Marca forense: `email · ip · timestamp`. Requerida si forensicWatermark. */
  watermarkLabel?: string;
  holdToReveal?: boolean;
  autoHideSeconds?: number;
  blurOnWindowBlur?: boolean;
  forensicWatermark?: boolean;
  blockCopyEvent?: boolean;
  charByChar?: boolean;
  clipboardClearSeconds?: number;
}

const MAX_DOTS = 24;

export function RevealField({
  label,
  onReveal,
  onCopyAudit,
  watermarkLabel,
  holdToReveal = true,
  autoHideSeconds = 3,
  blurOnWindowBlur = true,
  forensicWatermark = true,
  blockCopyEvent = true,
  charByChar = false,
  clipboardClearSeconds = 30,
}: RevealFieldProps) {
  const [value, setValue] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };

  const hide = useCallback(() => {
    clearHideTimer();
    setRevealed(false);
    setHoverIndex(null);
  }, []);

  /** Trae el plaintext si aún no está cacheado. Devuelve el valor o null. */
  const ensureValue = useCallback(async (): Promise<string | null> => {
    if (value != null) return value;
    setLoading(true);
    setError(null);
    try {
      const v = await onReveal();
      if (v == null) {
        setError("No se pudo revelar.");
        return null;
      }
      setValue(v);
      return v;
    } catch {
      setError("No se pudo revelar.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [value, onReveal]);

  const reveal = useCallback(async () => {
    const v = await ensureValue();
    if (v == null) return;
    setRevealed(true);
    clearHideTimer();
    hideTimer.current = setTimeout(hide, autoHideSeconds * 1000);
  }, [ensureValue, hide, autoHideSeconds]);

  const copy = useCallback(async () => {
    const v = await ensureValue();
    if (v == null) return;
    try {
      await navigator.clipboard.writeText(v);
      onCopyAudit?.();
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      // auto-clear del clipboard
      if (clipTimer.current) clearTimeout(clipTimer.current);
      clipTimer.current = setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, clipboardClearSeconds * 1000);
    } catch {
      setError("El navegador bloqueó el portapapeles.");
    }
  }, [ensureValue, onCopyAudit, clipboardClearSeconds]);

  // Mitigación #3: ocultar al perder foco / cambiar de pestaña.
  useEffect(() => {
    if (!blurOnWindowBlur) return;
    const onBlur = () => hide();
    const onVis = () => {
      if (document.visibilityState === "hidden") hide();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [blurOnWindowBlur, hide]);

  // Limpieza de timers al desmontar.
  useEffect(
    () => () => {
      clearHideTimer();
      if (clipTimer.current) clearTimeout(clipTimer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  // Handlers del disparador según hold-to-reveal vs toggle.
  const triggerProps = holdToReveal
    ? {
        onMouseDown: reveal,
        onMouseUp: hide,
        onMouseLeave: hide,
        onTouchStart: reveal,
        onTouchEnd: hide,
        onTouchCancel: hide,
      }
    : {
        onClick: () => (revealed ? hide() : reveal()),
      };

  // Bloqueo copy/contextmenu mientras está revelado (mit. #5).
  const guarded = blockCopyEvent && revealed;
  const guardProps = guarded
    ? {
        onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {};

  const dots = "•".repeat(Math.min(value?.length ?? 8, MAX_DOTS));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>{label}</span>
      )}

      <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
        {/* Zona del secreto */}
        <div
          {...guardProps}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-sel)",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            color: "var(--ink)",
            overflow: "hidden",
            wordBreak: "break-all",
            userSelect: guarded ? "none" : "auto",
          }}
          onMouseMove={
            revealed && charByChar && value
              ? (e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  setHoverIndex(Math.floor(ratio * value.length));
                }
              : undefined
          }
        >
          {revealed && value ? (
            <>
              {charByChar ? (
                <span aria-label="secreto (char-by-char)">
                  {value.split("").map((ch, i) => (
                    <span key={i}>{i === hoverIndex ? ch : "•"}</span>
                  ))}
                </span>
              ) : (
                <span>{value}</span>
              )}
              {forensicWatermark && watermarkLabel && (
                <ForensicWatermark label={watermarkLabel} />
              )}
            </>
          ) : (
            <span style={{ color: "var(--ink-mute)", letterSpacing: 2 }}>
              {loading ? "…" : dots}
            </span>
          )}
        </div>

        {/* Botón revelar */}
        <button
          type="button"
          aria-label={revealed ? "Ocultar" : "Mostrar"}
          aria-pressed={revealed}
          disabled={loading}
          {...triggerProps}
          style={iconBtnStyle}
        >
          <span style={{ color: "var(--ink-soft)", display: "inline-flex" }}>
            {revealed ? Icon.eyeOff(18) : Icon.eye(18)}
          </span>
        </button>

        {/* Botón copiar */}
        <button
          type="button"
          aria-label="Copiar"
          onClick={copy}
          disabled={loading}
          style={iconBtnStyle}
        >
          <span
            style={{ color: copied ? "var(--success)" : "var(--ink-soft)", display: "inline-flex" }}
          >
            {copied ? Icon.check(18) : Icon.copy(18)}
          </span>
        </button>
      </div>

      {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}

      {/* Aviso honesto (§4.16): nunca prometer "screenshots bloqueados". */}
      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
        {holdToReveal ? "Mantené presionado para ver. " : ""}
        Defensas best-effort — asumí que tu pantalla puede ser fotografiada.
      </span>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  minWidth: 40,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-inv)",
  cursor: "pointer",
};
