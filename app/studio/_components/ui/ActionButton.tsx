"use client";

/**
 * <ActionButton> · Anti-double-submit + feedback visual.
 *
 * Patrón estándar del Studio para CUALQUIER acción que no debe ejecutarse
 * dos veces (enviar email, crear asiento contable, convertir estado,
 * transferir dinero, etc.). Resuelve 3 problemas en uno:
 *
 *   1. Doble click humano · el botón queda disabled apenas se dispara
 *      la acción, durante todo el loading Y durante el success flash.
 *   2. Falta de feedback visual · spinner inline durante loading +
 *      flash verde 2.5s post-éxito.
 *   3. UI inconsistente · un solo componente para todo el Studio →
 *      todos los botones críticos se ven y se comportan igual.
 *
 * Uso típico:
 *
 *   <ActionButton
 *     variant="primary"
 *     idleLabel="Enviar cotización"
 *     loadingLabel="Enviando…"
 *     successLabel="Enviado al cliente"
 *     idleIcon={Icon.mail(14)}
 *     successIcon={Icon.check(14)}
 *     onAction={async () => {
 *       const r = await markQuoteSent(quote.id);
 *       if (r.error) throw new Error(r.error);
 *     }}
 *     onError={setError}
 *   />
 *
 * Convención: `onAction` THROWS en caso de error. El componente captura
 * la excepción, llama `onError(message)` si está provisto, y vuelve al
 * estado idle. Esto fuerza al caller a manejar errores explícitamente
 * — no se silencian.
 *
 * Cuándo usar este componente:
 *   - Mandar emails (welcome, factura, cotización, invitación)
 *   - Convertir estados que disparan side-effects (draft→sent dispara
 *     mail-rule-engine, sent→accepted, etc.)
 *   - Crear asientos contables, facturas SENIAT, DIM
 *   - Transferencias, payments, link de pago
 *   - Convertir cotización a embarque
 *   - Marcar despachos / entregas (cambian timeline + cobros)
 *
 * Cuándo NO usarlo:
 *   - Filtros, búsquedas, navegación
 *   - Toggle de UI (collapse, dark mode)
 *   - Editar (form drawer normal con submit estándar)
 */

import { useState, useTransition, type ReactNode } from "react";

const DEFAULT_SUCCESS_MS = 2500;

type Variant = "primary" | "dark" | "danger" | "ghost" | "warning";
type Size = "default" | "sm" | "xs";

export interface ActionButtonProps {
  /** Variant en estado idle. Success siempre fuerza verde. Default: primary. */
  variant?: Variant;
  /** Tamaño match con `.studio-btn-sm` / `.studio-btn-xs`. Default: sm. */
  size?: Size;
  /** Texto idle. */
  idleLabel: string;
  /** Texto durante loading. Default: "Procesando…". */
  loadingLabel?: string;
  /**
   * Texto en estado success. Si es null, se salta el flash de éxito
   * (la acción se ejecuta pero el botón vuelve directo a idle).
   */
  successLabel?: string | null;
  /** Icono en estado idle. */
  idleIcon?: ReactNode;
  /** Icono en estado success. */
  successIcon?: ReactNode;
  /** Duración del flash verde en ms. Default 2500. */
  successMs?: number;
  /**
   * Disabled externo (form inválido, otra acción en curso, etc.).
   * El componente además añade disabled automático durante loading y success.
   */
  disabled?: boolean;
  /**
   * Tooltip HTML. Puede ser string fijo, o función que recibe el estado
   * actual y devuelve el texto contextual.
   */
  title?: string | ((state: "idle" | "loading" | "success") => string);
  /**
   * Acción a ejecutar. Soporta 2 estilos:
   *  - throw en error (idiomatic JS) → `onError(err.message)` se llama.
   *  - retornar `{ error: string }` (idiomatic server actions del Studio)
   *    → el componente lo trata equivalente a un throw.
   *  - retornar `void` o `undefined` → success.
   * Esto evita el boilerplate `if (r.error) throw new Error(r.error)`
   * que repetiríamos en cada caller.
   */
  onAction: () => Promise<void | { error?: string | null }>;
  /** Callback cuando `onAction` throwea o devuelve error. */
  onError?: (message: string) => void;
  /** Callback cuando la acción terminó OK, antes del flash de success. */
  onSuccess?: () => void;
}

export function ActionButton({
  variant = "primary",
  size = "sm",
  idleLabel,
  loadingLabel = "Procesando…",
  successLabel = null,
  idleIcon,
  successIcon,
  successMs = DEFAULT_SUCCESS_MS,
  disabled = false,
  title,
  onAction,
  onError,
  onSuccess,
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const handleClick = () => {
    if (isPending || success || disabled) return;
    startTransition(async () => {
      try {
        const result = await onAction();
        // Soporta el patrón server-action `{ error }` además de throw.
        if (result && typeof result === "object" && result.error) {
          onError?.(result.error);
          return;
        }
        onSuccess?.();
        if (successLabel != null) {
          setSuccess(true);
          setTimeout(() => setSuccess(false), successMs);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onError?.(msg);
      }
    });
  };

  const state: "idle" | "loading" | "success" = success
    ? "success"
    : isPending
      ? "loading"
      : "idle";

  const variantClass = success
    ? "studio-btn-success"
    : variant === "primary"
      ? "studio-btn-primary"
      : variant === "dark"
        ? "studio-btn-dark"
        : variant === "danger"
          ? "studio-btn-danger"
          : variant === "warning"
            ? "studio-btn-warning"
            : "studio-btn-ghost";

  const sizeClass = size === "default" ? "" : `studio-btn-${size}`;
  const className = ["studio-btn", variantClass, sizeClass]
    .filter(Boolean)
    .join(" ");

  const computedTitle =
    typeof title === "function" ? title(state) : title;

  // Anuncio para screen readers · `aria-live="polite"` no interrumpe,
  // espera al próximo break para anunciar el cambio. Solo emite contenido
  // cuando NO está idle (sino spamearía "Enviar cotización" cada mount).
  const liveAnnouncement =
    state === "loading"
      ? loadingLabel
      : state === "success"
        ? successLabel ?? ""
        : "";

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={disabled || isPending || success}
        aria-busy={isPending}
        title={computedTitle}
        style={{ minWidth: "max-content" }}
      >
        {success ? (
          <>
            {successIcon && <span style={iconWrap}>{successIcon}</span>}
            {successLabel}
          </>
        ) : isPending ? (
          <>
            <span className="studio-spin" style={iconWrap}>
              <DefaultSpinner />
            </span>
            {loadingLabel}
          </>
        ) : (
          <>
            {idleIcon && <span style={iconWrap}>{idleIcon}</span>}
            {idleLabel}
          </>
        )}
      </button>
      <span
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        {liveAnnouncement}
      </span>
    </span>
  );
}

const iconWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  flexShrink: 0,
};

function DefaultSpinner() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
      <path
        d="M20 11.5A8 8 0 1 1 12 4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
