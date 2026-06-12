"use client";

/**
 * VeRowActions — menú "···" en cada row del listado VE.
 *
 * Las acciones se muestran condicionalmente según el status actual del
 * shipment (ver availableActions en warehouse-ve-types.ts).
 *
 * Inputs adicionales (pod_signed_by, reason de incidencia) se piden con
 * un modal inline en lugar de window.prompt — refactor 2026-05-26 que
 * cierra deuda técnica `studio-tech-debt-post-sprint3` item 3 (los
 * prompts se rompían en demos con cliente).
 *
 * Cuando llegue refactor completo de TMS, "Asignar reparto" delega al
 * módulo TMS con form completo (ya hecho).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import {
  VE_ACTION_LABELS,
  availableActions,
  type VeAction,
} from "@/lib/studio/warehouse-ve-types";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";
import {
  markCustomsReleasedAction,
  markDeliveredAction,
  reportIncidentAction,
} from "../actions";

interface Props {
  shipmentId: string;
  status: ShipmentStatus;
  /** Deprecated post-SDD-0019: el flow asignar reparto va a TMS. Se mantiene
   *  como prop opcional para no romper callers existentes. */
  currentDeliveryAddress?: string | null;
}

/** Estado del modal inline · null = cerrado. */
type PromptState =
  | null
  | {
      kind: "delivered";
      title: string;
      label: string;
      placeholder: string;
      required: boolean;
      multiline: boolean;
    }
  | {
      kind: "incident";
      title: string;
      label: string;
      placeholder: string;
      required: boolean;
      multiline: boolean;
    };

export function VeRowActions({
  shipmentId,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const actions = availableActions(status);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handle = (action: VeAction) => {
    setError(null);
    setOpen(false);

    if (action === "view_detail") {
      router.push(`/studio/tracking/${shipmentId}`);
      return;
    }

    if (action === "mark_customs_released") {
      startTransition(async () => {
        const result = await markCustomsReleasedAction(shipmentId);
        if (result?.error) setError(result.error);
        else if (result?.ok) router.refresh();
      });
      return;
    }

    if (action === "assign_delivery") {
      router.push(`/studio/tms?view=route&shipment=${shipmentId}`);
      return;
    }

    if (action === "mark_delivered") {
      setPrompt({
        kind: "delivered",
        title: "Marcar entregada",
        label: "¿Quién firmó el POD?",
        placeholder: "Nombre del receptor (opcional)",
        required: false,
        multiline: false,
      });
      return;
    }

    if (action === "report_incident") {
      setPrompt({
        kind: "incident",
        title: "Reportar incidencia",
        label: "Describe qué pasó",
        placeholder: "Ej: caja dañada al recibir, falta una unidad…",
        required: true,
        multiline: true,
      });
      return;
    }
  };

  /** Confirm del modal · llama la action correspondiente. */
  const onPromptConfirm = (value: string) => {
    if (!prompt) return;
    const trimmed = value.trim();
    if (prompt.required && !trimmed) {
      setError("Este campo es obligatorio.");
      return;
    }
    startTransition(async () => {
      let result: { ok?: boolean; error?: string } | undefined;
      if (prompt.kind === "delivered") {
        result = await markDeliveredAction(shipmentId, {
          podSignedBy: trimmed || undefined,
        });
      } else if (prompt.kind === "incident") {
        result = await reportIncidentAction(shipmentId, {
          reason: trimmed,
        });
      }
      setPrompt(null);
      if (result?.error) setError(result.error);
      else if (result?.ok) router.refresh();
    });
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={pending}
        aria-label="Acciones del shipment VE"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-soft)",
          cursor: pending ? "wait" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!pending) {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--ink)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-soft)";
        }}
      >
        {Icon.more(14)}
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 240,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            padding: 4,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-mute)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Acciones operativas
          </div>
          {actions.map((action) => {
            const isDetail = action === "view_detail";
            const isIncident = action === "report_incident";
            return (
              <button
                key={action}
                role="menuitem"
                type="button"
                onClick={() => handle(action)}
                disabled={pending}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  border: 0,
                  background: "transparent",
                  color: isIncident ? "var(--danger)" : "var(--ink)",
                  font: "500 12.5px/1.2 var(--f-sans)",
                  cursor: pending ? "wait" : "pointer",
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!pending) {
                    if (isIncident) {
                      e.currentTarget.style.background = "var(--danger-bg)";
                    } else if (isDetail) {
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    } else {
                      e.currentTarget.style.background = "var(--wine-tint)";
                      e.currentTarget.style.color = "var(--wine)";
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (!pending) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = isIncident
                      ? "var(--danger)"
                      : "var(--ink)";
                  }
                }}
              >
                <span style={{ flex: 1 }}>{VE_ACTION_LABELS[action]}</span>
                {isDetail && (
                  <span style={{ color: "var(--ink-mute)" }}>
                    {Icon.arrowR(11)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            padding: "6px 10px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            whiteSpace: "nowrap",
            zIndex: 31,
            maxWidth: 320,
          }}
        >
          {error}
        </div>
      )}

      {prompt && (
        <PromptModal
          title={prompt.title}
          label={prompt.label}
          placeholder={prompt.placeholder}
          required={prompt.required}
          multiline={prompt.multiline}
          pending={pending}
          onCancel={() => setPrompt(null)}
          onConfirm={onPromptConfirm}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PromptModal · reemplazo de window.prompt() con UI nativa del Studio
// ─────────────────────────────────────────────────────────────

function PromptModal({
  title,
  label,
  placeholder,
  required,
  multiline,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  label: string;
  placeholder: string;
  required: boolean;
  multiline: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onCancel, pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 440,
          borderRadius: "var(--r-lg, 12px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h2
          id="prompt-modal-title"
          style={{
            margin: 0,
            fontFamily: "var(--font-archivo-black, 'Archivo Black')",
            fontSize: 18,
            color: "var(--ink)",
          }}
        >
          {title}
        </h2>

        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
              }}
            >
              {label}
              {required && (
                <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
              )}
            </span>
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={pending}
                rows={4}
                style={{
                  padding: 12,
                  border: "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  minHeight: 80,
                }}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={pending}
                style={{
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            )}
          </label>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="studio-btn studio-btn-primary studio-btn-sm"
            >
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
