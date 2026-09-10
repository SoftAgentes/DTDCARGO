"use client";

/**
 * ToastProvider · AVS-01.
 *
 * Mantiene la API histórica (`success/info/warning/error`) y añade `show()`
 * para avisos gobernados. La cola no consume tiempo: el reloj comienza cuando
 * la tarjeta entra realmente al viewport y conserva el tiempo restante al
 * pausar por hover, foco, pestaña oculta o cambio de breakpoint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { useT } from "@/lib/i18n";

export type ToastTone = "neutral" | "info" | "success" | "warning" | "error";
export type ToastPriority = "low" | "normal" | "high";
export type ToastScope = "page" | "module" | "system";
export type ToastDuration =
  | "default"
  | "action"
  | "undo"
  | "persistent"
  | number;

export type ToastAction =
  | {
      label: string;
      href: string;
      onSelect?: never;
      failureMessage?: never;
    }
  | {
      label: string;
      href?: never;
      onSelect: () => void | Promise<void>;
      failureMessage?: string;
    };

export interface GovernedToastInput {
  /** Clave estable del evento de producto, por ejemplo `invoice:issued`. */
  eventKey: string;
  tone: ToastTone;
  message: string;
  priority: ToastPriority;
  scope: ToastScope;
  /** Evita avisos equivalentes visibles o pendientes. */
  dedupeKey: string;
  action?: ToastAction;
  duration?: ToastDuration;
  /** Referencia a un evento ya auditado; el toast nunca escribe auditoría. */
  correlationId?: string;
  /**
   * Deadline absoluto emitido por el servidor para una acción temporal.
   * A diferencia de la duración visual, no se pausa por hover, foco ni pestaña
   * oculta.
   */
  actionExpiresAt?: string;
  /**
   * Duración restante calculada por el servidor. Evita que un reloj local
   * desajustado invalide de inmediato una acción todavía vigente.
   */
  actionDurationMs?: number;
  actionExpiredMessage?: string;
  /** Solo para errores que impiden continuar la tarea actual. */
  urgent?: boolean;
}

export interface ToastLink {
  href: string;
  label: string;
}

export interface ToastOptions {
  /** Alias histórico de una acción de navegación. */
  link?: ToastLink;
  /** 0 mantiene el aviso hasta cierre manual. */
  durationMs?: number;
}

export interface ToastApi {
  show: (input: GovernedToastInput) => string;
  /** @deprecated Para avisos nuevos, usar `show()` con contrato AVS-01. */
  success: (message: string, opts?: ToastOptions) => string;
  /** @deprecated Para avisos nuevos, usar `show()` con contrato AVS-01. */
  info: (message: string, opts?: ToastOptions) => string;
  /** @deprecated Para avisos nuevos, usar `show()` con contrato AVS-01. */
  error: (message: string, opts?: ToastOptions) => string;
  /** @deprecated Para avisos nuevos, usar `show()` con contrato AVS-01. */
  warning: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

type ActionState = "idle" | "acting" | "failed";
type PauseReason = "hover" | "focus" | "document-hidden" | "action-failed";

interface ToastRecord {
  id: string;
  eventKey: string;
  tone: ToastTone;
  message: string;
  priority: ToastPriority;
  scope: ToastScope;
  dedupeKey?: string;
  action?: ToastAction;
  durationMs: number;
  remainingMs: number;
  correlationId?: string;
  urgent: boolean;
  sequence: number;
  actionState: ActionState;
  actionError?: string;
  actionExpiresAtMs?: number;
  actionExpired: boolean;
  actionExpiredMessage?: string;
}

interface RunningTimer {
  handle: ReturnType<typeof setTimeout>;
  startedAt: number;
}

const DEFAULT_DURATION_MS = 5_000;
const ACTION_DURATION_MS = 8_000;
const UNDO_DURATION_MS = 10_000;
const DESKTOP_MAX_VISIBLE = 3;
const MOBILE_MAX_VISIBLE = 1;
const MOBILE_QUERY = "(max-width: 767px)";

function resolveActionDeadline(input: GovernedToastInput): {
  expiresAtMs?: number;
  invalid: boolean;
} {
  if (input.actionDurationMs !== undefined) {
    const valid =
      Number.isFinite(input.actionDurationMs) &&
      input.actionDurationMs > 0;
    return {
      expiresAtMs: valid ? Date.now() + input.actionDurationMs : undefined,
      invalid: !valid,
    };
  }

  if (input.actionExpiresAt === undefined) {
    return { invalid: false };
  }

  const parsed = Date.parse(input.actionExpiresAt);
  return {
    expiresAtMs: Number.isFinite(parsed) ? parsed : undefined,
    invalid: !Number.isFinite(parsed),
  };
}

const PRIORITY_WEIGHT: Record<ToastPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast() debe llamarse dentro de <ToastProvider>. Envuelve el árbol con el provider del Studio.",
    );
  }
  return ctx;
}

function durationToMs(
  duration: ToastDuration | undefined,
  hasAction: boolean,
): number {
  if (typeof duration === "number") return Math.max(0, duration);
  if (duration === "persistent") return 0;
  if (duration === "undo") return UNDO_DURATION_MS;
  if (duration === "action") return ACTION_DURATION_MS;
  return hasAction ? ACTION_DURATION_MS : DEFAULT_DURATION_MS;
}

function insertPendingByPriority(
  visible: ToastRecord[],
  pending: ToastRecord[],
  next: ToastRecord,
): ToastRecord[] {
  const sortedPending = [...pending, next].sort((a, b) => {
    const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    return priority || a.sequence - b.sequence;
  });
  return [...visible, ...sortedPending];
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [maxVisible, setMaxVisible] = useState(DESKTOP_MAX_VISIBLE);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [pausedIds, setPausedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toastsRef = useRef<ToastRecord[]>([]);
  const maxVisibleRef = useRef(DESKTOP_MAX_VISIBLE);
  const sequenceRef = useRef(0);
  const timersRef = useRef<Map<string, RunningTimer>>(new Map());
  const actionExpiryTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const pauseReasonsRef = useRef<Map<string, Set<PauseReason>>>(new Map());
  const dedupeIdsRef = useRef<Map<string, string>>(new Map());
  const returnFocusRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  useEffect(() => {
    maxVisibleRef.current = maxVisible;
  }, [maxVisible]);

  const clearRecordRefs = useCallback((toast: ToastRecord) => {
    const running = timersRef.current.get(toast.id);
    if (running) clearTimeout(running.handle);
    timersRef.current.delete(toast.id);
    const actionExpiryTimer = actionExpiryTimersRef.current.get(toast.id);
    if (actionExpiryTimer) clearTimeout(actionExpiryTimer);
    actionExpiryTimersRef.current.delete(toast.id);
    pauseReasonsRef.current.delete(toast.id);
    setPausedIds((previous) => {
      if (!previous.has(toast.id)) return previous;
      const next = new Set(previous);
      next.delete(toast.id);
      return next;
    });
    returnFocusRef.current.delete(toast.id);
    if (toast.dedupeKey) dedupeIdsRef.current.delete(toast.dedupeKey);
  }, []);

  const dismiss = useCallback(
    (id: string, restoreFocus = false) => {
      const current = toastsRef.current.find((toast) => toast.id === id);
      const returnTarget = returnFocusRef.current.get(id);
      const activeToastId =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>("[data-toast-id]")?.dataset
              .toastId
          : undefined;
      const shouldRestoreFocus = restoreFocus || activeToastId === id;
      if (current) {
        clearRecordRefs(current);
      } else {
        const running = timersRef.current.get(id);
        if (running) clearTimeout(running.handle);
        timersRef.current.delete(id);
        pauseReasonsRef.current.delete(id);
        returnFocusRef.current.delete(id);
        for (const [dedupeKey, toastId] of dedupeIdsRef.current) {
          if (toastId === id) dedupeIdsRef.current.delete(dedupeKey);
        }
      }
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
      if (shouldRestoreFocus && returnTarget?.isConnected) {
        queueMicrotask(() => returnTarget.focus());
      }
    },
    [clearRecordRefs],
  );

  const stopTimer = useCallback((id: string, consumeElapsed: boolean) => {
    const running = timersRef.current.get(id);
    if (!running) return;
    clearTimeout(running.handle);
    timersRef.current.delete(id);
    if (!consumeElapsed) return;
    const elapsed = Math.max(0, Date.now() - running.startedAt);
    setToasts((previous) =>
      previous.map((toast) =>
        toast.id === id
          ? { ...toast, remainingMs: Math.max(0, toast.remainingMs - elapsed) }
          : toast,
      ),
    );
  }, []);

  const pause = useCallback(
    (id: string, reason: PauseReason) => {
      const reasons = pauseReasonsRef.current.get(id) ?? new Set<PauseReason>();
      if (reasons.has(reason)) return;
      reasons.add(reason);
      pauseReasonsRef.current.set(id, reasons);
      setPausedIds((previous) => {
        if (previous.has(id)) return previous;
        return new Set(previous).add(id);
      });
      stopTimer(id, true);
      setToasts((previous) => [...previous]);
    },
    [stopTimer],
  );

  const resume = useCallback((id: string, reason: PauseReason) => {
    const reasons = pauseReasonsRef.current.get(id);
    if (!reasons?.has(reason)) return;
    reasons.delete(reason);
    if (reasons.size === 0) {
      pauseReasonsRef.current.delete(id);
      setPausedIds((previous) => {
        if (!previous.has(id)) return previous;
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
    setToasts((previous) => [...previous]);
  }, []);

  const show = useCallback(
    (input: GovernedToastInput) => {
      const existingId = dedupeIdsRef.current.get(input.dedupeKey);
      if (existingId) {
        const existingExpiryTimer = actionExpiryTimersRef.current.get(existingId);
        if (existingExpiryTimer) clearTimeout(existingExpiryTimer);
        actionExpiryTimersRef.current.delete(existingId);
        // Puede llegar justo después del rechazo, antes de que `toastsRef`
        // refleje el nuevo render. Limpiar el motivo directamente evita dejar
        // el aviso actualizado pausado para siempre; si sigue `acting`, el
        // updater inferior rechaza igualmente la sustitución.
        resume(existingId, "action-failed");
        setToasts((previous) => {
          const index = previous.findIndex((toast) => toast.id === existingId);
          if (index < 0) return previous;
          const existing = previous[index];
          if (existing.actionState === "acting") return previous;
          const isVisible = index < maxVisibleRef.current;
          const durationMs = durationToMs(input.duration, Boolean(input.action));
          const {
            expiresAtMs: actionExpiresAtMs,
            invalid: hasInvalidActionDeadline,
          } = resolveActionDeadline(input);
          const updated: ToastRecord = {
            ...existing,
            eventKey: input.eventKey,
            tone: input.tone,
            message: input.message,
            priority: input.priority,
            scope: input.scope,
            action: input.action,
            correlationId: input.correlationId,
            urgent: input.tone === "error" && input.urgent === true,
            actionState: "idle",
            actionError: undefined,
            actionExpiresAtMs:
              actionExpiresAtMs !== undefined && Number.isFinite(actionExpiresAtMs)
                ? actionExpiresAtMs
                : undefined,
            actionExpired:
              hasInvalidActionDeadline ||
              (actionExpiresAtMs !== undefined &&
                Number.isFinite(actionExpiresAtMs) &&
                actionExpiresAtMs <= Date.now()),
            actionExpiredMessage: input.actionExpiredMessage,
            ...(isVisible
              ? {}
              : { durationMs, remainingMs: durationMs }),
          };
          const copy = [...previous];
          copy[index] = updated;
          if (!isVisible) {
            const visible = copy.slice(0, maxVisibleRef.current);
            const pending = copy.slice(maxVisibleRef.current).sort((a, b) => {
              const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
              return priority || a.sequence - b.sequence;
            });
            return [...visible, ...pending];
          }
          return copy;
        });
        return existingId;
      }

      const id = `toast-${Date.now()}-${++sequenceRef.current}`;
      const durationMs = durationToMs(input.duration, Boolean(input.action));
      const {
        expiresAtMs: actionExpiresAtMs,
        invalid: hasInvalidActionDeadline,
      } = resolveActionDeadline(input);
      const record: ToastRecord = {
        id,
        eventKey: input.eventKey,
        tone: input.tone,
        message: input.message,
        priority: input.priority,
        scope: input.scope,
        dedupeKey: input.dedupeKey,
        action: input.action,
        durationMs,
        remainingMs: durationMs,
        correlationId: input.correlationId,
        urgent: input.tone === "error" && input.urgent === true,
        sequence: sequenceRef.current,
        actionState: "idle",
        actionExpiresAtMs,
        actionExpired:
          hasInvalidActionDeadline ||
          (actionExpiresAtMs !== undefined && actionExpiresAtMs <= Date.now()),
        actionExpiredMessage: input.actionExpiredMessage,
      };
      if (document.hidden) {
        pauseReasonsRef.current.set(id, new Set(["document-hidden"]));
        setPausedIds((previous) => new Set(previous).add(id));
      }
      dedupeIdsRef.current.set(input.dedupeKey, id);
      setToasts((previous) => {
        const visible = previous.slice(0, maxVisibleRef.current);
        const pending = previous.slice(maxVisibleRef.current);
        return insertPendingByPriority(visible, pending, record);
      });
      return id;
    },
    [resume],
  );

  const legacyPush = useCallback(
    (tone: Exclude<ToastTone, "neutral">, message: string, opts: ToastOptions = {}) => {
      const id = `toast-${Date.now()}-${++sequenceRef.current}`;
      const action: ToastAction | undefined = opts.link
        ? { href: opts.link.href, label: opts.link.label }
        : undefined;
      const durationMs =
        opts.durationMs ?? (action ? ACTION_DURATION_MS : DEFAULT_DURATION_MS);
      const record: ToastRecord = {
        id,
        eventKey: "legacy:toast",
        tone,
        message,
        priority: "normal",
        scope: "page",
        action,
        durationMs: Math.max(0, durationMs),
        remainingMs: Math.max(0, durationMs),
        urgent: false,
        sequence: sequenceRef.current,
        actionState: "idle",
        actionExpired: false,
      };
      if (document.hidden) {
        pauseReasonsRef.current.set(id, new Set(["document-hidden"]));
        setPausedIds((previous) => new Set(previous).add(id));
      }
      setToasts((previous) => {
        const visible = previous.slice(0, maxVisibleRef.current);
        const pending = previous.slice(maxVisibleRef.current);
        return insertPendingByPriority(visible, pending, record);
      });
      return id;
    },
    [],
  );

  const applyMaxVisible = useCallback((nextMaxVisible: number) => {
    const previousMaxVisible = maxVisibleRef.current;
    if (nextMaxVisible === previousMaxVisible) return;

    if (nextMaxVisible < previousMaxVisible) {
      setToasts((previous) => {
        const visible = previous.slice(0, nextMaxVisible);
        const returnedToQueue = previous.slice(
          nextMaxVisible,
          previousMaxVisible,
        );
        const alreadyPending = previous.slice(previousMaxVisible);
        const pending = [...returnedToQueue, ...alreadyPending].sort((a, b) => {
          const priority =
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          return priority || a.sequence - b.sequence;
        });
        return [...visible, ...pending];
      });
    }

    maxVisibleRef.current = nextMaxVisible;
    setMaxVisible(nextMaxVisible);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.(MOBILE_QUERY);
    if (!media) return;
    const sync = () =>
      applyMaxVisible(media.matches ? MOBILE_MAX_VISIBLE : DESKTOP_MAX_VISIBLE);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener?.(sync);
    return () => media.removeListener?.(sync);
  }, [applyMaxVisible]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let active = true;
    const sync = () => {
      if (!active) return;
      setKeyboardOffset(
        Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
      );
    };
    queueMicrotask(sync);
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      active = false;
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      const ids = toastsRef.current.map((toast) => toast.id);
      if (document.hidden) {
        ids.forEach((id) => pause(id, "document-hidden"));
      } else {
        ids.forEach((id) => resume(id, "document-hidden"));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause, resume]);

  useEffect(() => {
    const visible = toasts.slice(0, maxVisible);
    const visibleIds = new Set(visible.map((toast) => toast.id));

    timersRef.current.forEach((_timer, id) => {
      if (!visibleIds.has(id)) stopTimer(id, true);
    });

    visible.forEach((toast) => {
      const paused = (pauseReasonsRef.current.get(toast.id)?.size ?? 0) > 0;
      if (
        paused ||
        toast.actionState === "acting" ||
        toast.durationMs <= 0 ||
        timersRef.current.has(toast.id)
      ) {
        return;
      }
      if (toast.remainingMs <= 0) {
        dismiss(toast.id);
        return;
      }
      const handle = setTimeout(() => {
        timersRef.current.delete(toast.id);
        dismiss(toast.id);
      }, toast.remainingMs);
      timersRef.current.set(toast.id, { handle, startedAt: Date.now() });
    });
  }, [dismiss, maxVisible, stopTimer, toasts]);

  useEffect(() => {
    const currentIds = new Set(toasts.map((toast) => toast.id));
    actionExpiryTimersRef.current.forEach((handle, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(handle);
        actionExpiryTimersRef.current.delete(id);
      }
    });

    toasts.forEach((toast) => {
      if (
        toast.actionExpired ||
        toast.actionExpiresAtMs === undefined ||
        actionExpiryTimersRef.current.has(toast.id)
      ) {
        return;
      }
      const remaining = toast.actionExpiresAtMs - Date.now();
      if (remaining <= 0) {
        setToasts((previous) =>
          previous.map((item) =>
            item.id === toast.id ? { ...item, actionExpired: true } : item,
          ),
        );
        return;
      }
      const handle = setTimeout(() => {
        actionExpiryTimersRef.current.delete(toast.id);
        setToasts((previous) =>
          previous.map((item) =>
            item.id === toast.id ? { ...item, actionExpired: true } : item,
          ),
        );
      }, remaining);
      actionExpiryTimersRef.current.set(toast.id, handle);
    });
  }, [toasts]);

  useEffect(() => {
    const timers = timersRef.current;
    const actionExpiryTimers = actionExpiryTimersRef.current;
    const pauseReasons = pauseReasonsRef.current;
    const dedupeIds = dedupeIdsRef.current;
    const returnFocus = returnFocusRef.current;
    return () => {
      timers.forEach(({ handle }) => clearTimeout(handle));
      timers.clear();
      actionExpiryTimers.forEach((handle) => clearTimeout(handle));
      actionExpiryTimers.clear();
      pauseReasons.clear();
      dedupeIds.clear();
      returnFocus.clear();
    };
  }, []);

  const handleAction = useCallback(
    async (toast: ToastRecord) => {
      if (
        !toast.action ||
        "href" in toast.action ||
        toast.actionState === "acting" ||
        toast.actionExpired
      ) {
        return;
      }
      resume(toast.id, "action-failed");
      pause(toast.id, "focus");
      setToasts((previous) =>
        previous.map((item) =>
          item.id === toast.id
            ? { ...item, actionState: "acting", actionError: undefined }
            : item,
        ),
      );
      try {
        await toast.action.onSelect();
        dismiss(toast.id, true);
      } catch {
        const reasons = pauseReasonsRef.current.get(toast.id) ?? new Set<PauseReason>();
        reasons.delete("focus");
        reasons.add("action-failed");
        pauseReasonsRef.current.set(toast.id, reasons);
        setPausedIds((previous) => new Set(previous).add(toast.id));
        setToasts((previous) =>
          previous.map((item) =>
            item.id === toast.id
              ? {
                  ...item,
                  actionState: "failed",
                  actionError: toast.action?.failureMessage,
                }
              : item,
          ),
        );
      }
    },
    [dismiss, pause, resume],
  );

  const rememberReturnFocus = useCallback(
    (id: string, event: FocusEvent<HTMLElement>) => {
      const previous = event.relatedTarget;
      if (previous instanceof HTMLElement && !event.currentTarget.contains(previous)) {
        returnFocusRef.current.set(id, previous);
      }
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => legacyPush("success", message, options),
      info: (message, options) => legacyPush("info", message, options),
      error: (message, options) => legacyPush("error", message, options),
      warning: (message, options) => legacyPush("warning", message, options),
      dismiss: (id) => dismiss(id),
    }),
    [dismiss, legacyPush, show],
  );

  const visible = toasts.slice(0, maxVisible);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport
        toasts={visible}
        pausedIds={pausedIds}
        keyboardOffset={keyboardOffset}
        onDismiss={dismiss}
        onPause={pause}
        onResume={resume}
        onAction={handleAction}
        onFocusEnter={rememberReturnFocus}
      />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  pausedIds,
  keyboardOffset,
  onDismiss,
  onPause,
  onResume,
  onAction,
  onFocusEnter,
}: {
  toasts: ToastRecord[];
  pausedIds: ReadonlySet<string>;
  keyboardOffset: number;
  onDismiss: (id: string, restoreFocus?: boolean) => void;
  onPause: (id: string, reason: PauseReason) => void;
  onResume: (id: string, reason: PauseReason) => void;
  onAction: (toast: ToastRecord) => Promise<void>;
  onFocusEnter: (id: string, event: FocusEvent<HTMLElement>) => void;
}) {
  const t = useT();
  if (toasts.length === 0) return null;

  return (
    <div
      className="studio-toast-viewport"
      role="region"
      aria-label={t("chrome.toast.region_aria")}
      style={
        {
          "--studio-toast-keyboard-offset": `${keyboardOffset}px`,
        } as CSSProperties
      }
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          paused={pausedIds.has(toast.id)}
          onDismiss={onDismiss}
          onPause={onPause}
          onResume={onResume}
          onAction={onAction}
          onFocusEnter={onFocusEnter}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  paused,
  onDismiss,
  onPause,
  onResume,
  onAction,
  onFocusEnter,
}: {
  toast: ToastRecord;
  paused: boolean;
  onDismiss: (id: string, restoreFocus?: boolean) => void;
  onPause: (id: string, reason: PauseReason) => void;
  onResume: (id: string, reason: PauseReason) => void;
  onAction: (toast: ToastRecord) => Promise<void>;
  onFocusEnter: (id: string, event: FocusEvent<HTMLElement>) => void;
}) {
  const tone = TONE_BY_KIND[
    toast.actionState === "failed" ? "error" : toast.tone
  ];
  const t = useT();
  const failureMessage = toast.actionError ?? t("chrome.toast.action_failed");
  const state =
    toast.actionState === "acting"
      ? "acting"
      : toast.actionState === "failed"
        ? "action_failed"
        : paused
          ? "paused"
          : "visible";

  return (
    <div
      className="studio-toast"
      data-toast-id={toast.id}
      data-state={state}
      data-scope={toast.scope}
      data-correlation-id={toast.correlationId}
      role={toast.urgent ? "alert" : "status"}
      aria-live={toast.urgent ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => onPause(toast.id, "hover")}
      onMouseLeave={() => onResume(toast.id, "hover")}
      onFocusCapture={(event) => {
        onFocusEnter(toast.id, event);
        onPause(toast.id, "focus");
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onResume(toast.id, "focus");
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && toast.actionState !== "acting") {
          event.stopPropagation();
          onDismiss(toast.id, true);
        }
      }}
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--s-3)",
        minWidth: "min(320px, calc(100vw - var(--s-8)))",
        maxWidth: 560,
        padding: "var(--s-3) var(--s-4)",
        background: "var(--bg-surface)",
        border: `1px solid ${tone.border}`,
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-md)",
        color: "var(--ink)",
        animation: "studio-toast-in var(--dur) var(--ease)",
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
        {toast.actionState === "failed" && (
          <div
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            {failureMessage}
          </div>
        )}
        {toast.actionExpired && (
          <div
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {toast.actionExpiredMessage ??
              "Terminó la ventana inmediata para esta acción."}
          </div>
        )}
        {!toast.actionExpired &&
        toast.action &&
        "href" in toast.action &&
        toast.action.href ? (
          <Link
            href={toast.action.href}
            onClick={() => onDismiss(toast.id)}
            className="studio-toast-action"
          >
            {toast.action.label} →
          </Link>
        ) : toast.action && !("href" in toast.action) ? (
          <button
            type="button"
            disabled={toast.actionState === "acting" || toast.actionExpired}
            aria-busy={toast.actionState === "acting"}
            onClick={() => void onAction(toast)}
            className="studio-toast-action"
          >
            {toast.actionState === "acting"
              ? t("chrome.toast.acting")
              : toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id, true)}
        disabled={toast.actionState === "acting"}
        aria-label={t("chrome.toast.dismiss_aria")}
        className="studio-toast-close"
      >
        {Icon.close(14)}
      </button>
    </div>
  );
}

const TONE_BY_KIND: Record<
  ToastTone,
  { accent: string; border: string; icon: ReactNode }
> = {
  neutral: {
    accent: "var(--ink-soft)",
    border: "var(--border)",
    icon: <InfoIcon />,
  },
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
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <path d="M7.5 12.5l3 3 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <path d="M12 11v5M12 8h0.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <path d="M12 7v6M12 16h0.01" />
    </svg>
  );
}
