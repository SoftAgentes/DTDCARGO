"use client";

/**
 * Drawer de Cierre de período contable (SDD-0080, admin-only).
 * Fija la fecha hasta la cual los asientos quedan cerrados (read-only), o
 * reabre el período (quita el cierre). La defensa dura vive en el trigger de DB.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setClosingDateAction } from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

export function ClosingDateDrawer({
  currentClosingDate,
  onClose,
}: {
  currentClosingDate: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(currentClosingDate ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string | null, successMsg: string) => {
    setPending(true);
    setError(null);
    const r = await setClosingDateAction(value);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(successMsg);
    router.refresh();
    onClose();
  };

  return (
    <div
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="closing-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="closing-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Cierre de período
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: pending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="closing-drawer-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date || pending) return;
            submit(date, `Período cerrado hasta el ${date}`);
          }}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p
            style={{
              font: "400 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              padding: "12px 14px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            Los asientos con fecha igual o anterior a la de cierre quedan{" "}
            <strong>de solo lectura</strong>: no se pueden crear, asentar, anular
            ni borrar. Para corregir algo de un período cerrado, reabre primero
            (mueve la fecha hacia atrás).
          </p>

          <div>
            <label className="studio-label" htmlFor="closing-date">
              Cerrar hasta la fecha{" "}
              <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="closing-date"
              type="date"
              className="studio-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {currentClosingDate && (
            <p
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              Cierre actual:{" "}
              <span
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                }}
              >
                {currentClosingDate}
              </span>
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {error}
            </p>
          )}

          <div style={{ flex: 1, minHeight: 8 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          {currentClosingDate ? (
            <button
              type="button"
              className="studio-btn studio-btn-warning"
              onClick={() => submit(null, "Período reabierto")}
              disabled={pending}
              title="Quitar el cierre (reabrir el período)"
            >
              Reabrir período
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="closing-drawer-form"
              className="studio-btn studio-btn-primary"
              disabled={pending || !date}
            >
              {pending ? "Guardando…" : "Guardar cierre"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
