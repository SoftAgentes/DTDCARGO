"use client";

/**
 * VeRowActions — menú "···" en cada row del listado VE.
 *
 * Las acciones se muestran condicionalmente según el status actual del
 * shipment (ver availableActions en warehouse-ve-types.ts). Inputs
 * adicionales (delivery_address, pod_signed_by, reason de incidencia)
 * se piden inline con prompt() — V1 honest sin drawer separado.
 *
 * Cuando llegue SDD-0019 TMS, "Asignar reparto" se va a delegar al módulo
 * TMS con form completo; por ahora prompt simple.
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

export function VeRowActions({
  shipmentId,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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

    startTransition(async () => {
      let result: { ok?: boolean; error?: string } | undefined;

      if (action === "mark_customs_released") {
        result = await markCustomsReleasedAction(shipmentId);
      } else if (action === "assign_delivery") {
        // Refactor SDD-0019: el flow principal va por TMS (RouteDrawer
        // con shipment pre-seleccionado). El prompt() viejo queda solo
        // como fallback si alguien navega manualmente acá.
        router.push(`/studio/tms?view=route&shipment=${shipmentId}`);
        return;
      } else if (action === "mark_delivered") {
        const signedBy = window.prompt(
          "¿Quién firmó el POD? (opcional)",
          "",
        );
        if (signedBy === null) return; // cancelado
        result = await markDeliveredAction(shipmentId, {
          podSignedBy: signedBy.trim() || undefined,
        });
      } else if (action === "report_incident") {
        const reason = window.prompt(
          "Describí la incidencia (requerido):",
          "",
        );
        if (reason === null) return; // cancelado
        if (!reason.trim()) {
          setError("La razón es requerida.");
          return;
        }
        result = await reportIncidentAction(shipmentId, {
          reason: reason.trim(),
        });
      }

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.refresh();
      }
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
    </div>
  );
}
