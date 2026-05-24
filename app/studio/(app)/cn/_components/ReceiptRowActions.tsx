"use client";

/**
 * ReceiptRowActions — menú "..." en cada row de la tabla para cambiar status.
 *
 * Acciones: marcar pendiente / consolidado / incidencia.
 * Llama changeReceiptStatusAction y refresca la ruta.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeReceiptStatusAction } from "../actions";
import type { WarehouseReceiptStatus } from "@/lib/studio/warehouse-cn-types";
import {
  RECEIPT_STATUS_LABELS,
  RECEIPT_STATUS_OPTIONS,
} from "@/lib/studio/warehouse-cn-types";
import { Icon } from "@/app/studio/_components/icons";

export function ReceiptRowActions({
  receiptId,
  currentStatus,
}: {
  receiptId: string;
  currentStatus: WarehouseReceiptStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const handleChange = (newStatus: WarehouseReceiptStatus) => {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      const res = await changeReceiptStatusAction(receiptId, newStatus);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={pending}
        aria-label="Acciones de la recepción"
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
            minWidth: 220,
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
            Cambiar estado
          </div>
          {RECEIPT_STATUS_OPTIONS.map((opt) => {
            const isCurrent = opt.value === currentStatus;
            return (
              <button
                key={opt.value}
                role="menuitem"
                type="button"
                onClick={() => handleChange(opt.value)}
                disabled={isCurrent || pending}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  border: 0,
                  background: isCurrent ? "var(--bg-elevated)" : "transparent",
                  color: isCurrent ? "var(--ink-mute)" : "var(--ink)",
                  font: "500 12.5px/1.2 var(--f-sans)",
                  cursor: isCurrent || pending ? "default" : "pointer",
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent && !pending) {
                    e.currentTarget.style.background = "var(--wine-tint)";
                    e.currentTarget.style.color = "var(--wine)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent && !pending) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--ink)";
                  }
                }}
              >
                <span style={{ width: 14, display: "inline-flex" }}>
                  {isCurrent ? Icon.check(13) : null}
                </span>
                <span>{opt.label}</span>
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
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export const STATUS_LABEL_FOR_TOOLTIP = RECEIPT_STATUS_LABELS;
