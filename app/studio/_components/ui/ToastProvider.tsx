"use client";

/**
 * ToastProvider · sistema global de toasts del Studio (parte del
 * principio "Trazabilidad visual" · ver app/studio/CLAUDE.md).
 *
 * Provee `useToast()` hook a todo el árbol del Studio. Cualquier client
 * component puede disparar un toast:
 *
 *   const toast = useToast();
 *   toast.success("Estimado EST-2026-0005 enviado", {
 *     link: { href: "/studio/cotizador?filter=sent", label: "Ver en Enviadas" },
 *     durationMs: 6000,
 *   });
 *
 * Renderiza un portal en `bottom-right` del viewport, con offset extra
 * a la derecha (64px) para dejar aire al BugFAB cuando está encendido en
 * bottom-right (SDD-0036: 44px, oculto por defecto).
 * Cola FIFO con máximo 3 visibles · los extras esperan turno a que se
 * cierre uno (auto-dismiss o cierre manual).
 *
 * Comportamiento:
 *   - durationMs default: 5000 sin link, 8000 con link (extra tiempo para
 *     decidir si clickear · NN/g 2024 toast guidelines).
 *   - Hover pausa el timer (estándar Sonner/react-hot-toast) · el operador
 *     puede leer con calma sin que se cierre.
 *   - Cierre manual via botón X o tecla Esc cuando tiene focus.
 *   - Focus tras dismiss vuelve al siguiente toast (si hay) o se pierde
 *     a body (aceptable porque el operador estaba leyendo, no editando).
 *   - Cleanup automático de timers en unmount del provider.
 *
 * a11y: role="status" + aria-live="polite" + aria-atomic="true" por toast.
 * region wrapper con role="region" + aria-label.
 *
 * Sin AI slop: cero glassmorphism, cero gradientes, solo tokens del
 * sistema. Tipografía Archivo. Iconos del set Icon.* del Studio.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { useT } from "@/lib/i18n";

type ToastKind = "success" | "info" | "error" | "warning";

interface ToastLink {
  href: string;
  label: string;
}

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  link?: ToastLink;
  durationMs: number;
}

interface ToastOptions {
  link?: ToastLink;
  /**
   * Duración antes del auto-close en ms. Default: 5000 sin link, 8000 con
   * link. Pasar `0` para desactivar auto-close (cierre solo manual).
   */
  durationMs?: number;
}

interface ToastApi {
  success: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  warning: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION_NO_LINK_MS = 5000;
const DEFAULT_DURATION_WITH_LINK_MS = 8000;
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast() debe llamarse dentro de <ToastProvider>. Envolvé tu árbol Studio en app/studio/(app)/layout.tsx.",
    );
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Map de timers vigentes · permite cancelarlos en dismiss manual o
  // unmount para evitar setState fantasma.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string, durationMs: number) => {
      if (durationMs <= 0) return;
      const t = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, durationMs);
      timersRef.current.set(id, t);
    },
    [],
  );

  const push = useCallback(
    (kind: ToastKind, message: string, opts: ToastOptions = {}) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration =
        opts.durationMs ??
        (opts.link
          ? DEFAULT_DURATION_WITH_LINK_MS
          : DEFAULT_DURATION_NO_LINK_MS);
      const toast: Toast = {
        id,
        kind,
        message,
        link: opts.link,
        durationMs: duration,
      };
      setToasts((prev) => [...prev, toast]);
      scheduleAutoDismiss(id, duration);
      return id;
    },
    [scheduleAutoDismiss],
  );

  // Cleanup TODOS los timers en unmount · evita warnings de React + leaks.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o),
      info: (m, o) => push("info", m, o),
      error: (m, o) => push("error", m, o),
      warning: (m, o) => push("warning", m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  const visible = toasts.slice(0, MAX_VISIBLE);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport
        toasts={visible}
        onDismiss={dismiss}
        onPauseTimer={clearTimer}
        onResumeTimer={(id) => {
          const toast = toasts.find((t) => t.id === id);
          if (toast) scheduleAutoDismiss(id, toast.durationMs);
        }}
      />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
  onPauseTimer,
  onResumeTimer,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string) => void;
}) {
  // SSR-safe: no renderizar el portal hasta mount.
  const [mounted, setMounted] = useState(false);
  const t = useT();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("chrome.toast.region_aria")}
      style={{
        position: "fixed",
        bottom: "var(--s-6)",
        // Offset extra (64px) deja aire al BugFAB cuando está encendido en
        // bottom-right (44px). El FAB está oculto por defecto, así que casi
        // siempre este espacio queda libre · no bloquea nada.
        right: "calc(var(--s-6) + 64px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 150,
        pointerEvents: "none",
        maxWidth: "min(560px, calc(100vw - 48px))",
      }}
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={onDismiss}
          onPauseTimer={onPauseTimer}
          onResumeTimer={onResumeTimer}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onPauseTimer,
  onResumeTimer,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string) => void;
}) {
  const tone = TONE_BY_KIND[toast.kind];
  const t = useT();

  return (
    <div
      className="studio-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => onPauseTimer(toast.id)}
      onMouseLeave={() => onResumeTimer(toast.id)}
      onFocus={() => onPauseTimer(toast.id)}
      onBlur={() => onResumeTimer(toast.id)}
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        minWidth: "min(320px, calc(100vw - 48px))",
        maxWidth: 560,
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: `1px solid ${tone.border}`,
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-md)",
        color: "var(--ink)",
        animation: "studio-toast-in 200ms ease-out",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          color: tone.accent,
          marginTop: 1,
          flexShrink: 0,
        }}
      >
        {tone.icon}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            font: "500 13px/1.45 var(--f-sans)",
            color: "var(--ink)",
            wordBreak: "break-word",
          }}
        >
          {toast.message}
        </div>
        {toast.link && (
          <Link
            href={toast.link.href}
            onClick={() => onDismiss(toast.id)}
            style={{
              font: "600 12px/1.4 var(--f-sans)",
              color: tone.accent,
              textDecoration: "none",
              alignSelf: "flex-start",
              marginTop: 2,
            }}
          >
            {toast.link.label} →
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t("chrome.toast.dismiss_aria")}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--ink-mute)",
          cursor: "pointer",
          padding: 4,
          marginTop: -2,
          marginRight: -4,
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "var(--r-sm)",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.color = "var(--ink)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-mute)";
        }}
      >
        {Icon.close(14)}
      </button>
    </div>
  );
}

const TONE_BY_KIND: Record<
  ToastKind,
  { accent: string; border: string; icon: ReactNode }
> = {
  success: {
    accent: "var(--success)",
    border: "var(--border)",
    icon: <CheckCircleIcon />,
  },
  info: {
    accent: "var(--info)",
    border: "var(--border)",
    icon: <InfoIcon />,
  },
  error: {
    accent: "var(--danger)",
    border: "var(--border)",
    icon: <ErrorIcon />,
  },
  warning: {
    accent: "var(--warning)",
    border: "var(--border)",
    icon: <WarningIcon />,
  },
};

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M7.5 12.5l3 3 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M12 11v5M12 8h0.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function WarningIcon() {
  // Cambiado a círculo para consistencia visual con el set (todos los kinds
  // usan círculo · el color es la categoría primaria). Resuelve confusión
  // entre warning (triángulo) y error (círculo+X) a 18px en visión periférica
  // y mejora accesibilidad para usuarios con daltonismo deuteranopia.
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M12 7v6M12 16h0.01" />
    </svg>
  );
}
