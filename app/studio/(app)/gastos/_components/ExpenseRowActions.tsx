"use client";

/**
 * ExpenseRowActions — menú "···" por row de gasto: editar / eliminar.
 *
 * Editar → delega al padre (abre ExpenseDrawer en modo edición).
 * Eliminar → softDeleteExpenseAction con confirm inline + toast + refresh.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { useT, resolveErrorMessage } from "@/lib/i18n";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { softDeleteExpenseAction } from "../actions";

interface Props {
  expenseId: string;
  expenseCode: string;
  onEdit: () => void;
}

export function ExpenseRowActions({ expenseId, expenseCode, onEdit }: Props) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const doDelete = () => {
    startTransition(async () => {
      const res = await softDeleteExpenseAction(expenseId);
      if (res.ok) {
        toast.success(t("expenses.row.deleted", { code: expenseCode }));
        setOpen(false);
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(resolveErrorMessage(t, res) ?? t("error.internal_error"));
      }
    });
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("expenses.table.col_actions")}
        aria-expanded={open}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-soft)",
          background: open ? "var(--bg-elevated)" : "transparent",
          border: 0,
          cursor: "pointer",
        }}
      >
        {Icon.more(16)}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 60,
            minWidth: 180,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-pop)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {!confirming ? (
            <>
              <MenuItem
                icon={Icon.edit(14)}
                label={t("expenses.row.edit")}
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              />
              <MenuItem
                icon={Icon.trash(14)}
                label={t("expenses.row.delete")}
                danger
                onClick={() => setConfirming(true)}
              />
            </>
          ) : (
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  font: "600 12px/1.4 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {t("expenses.row.delete_confirm")}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-danger studio-btn-xs"
                  disabled={pending}
                  onClick={doDelete}
                >
                  {pending ? t("expenses.drawer.saving") : t("expenses.row.delete")}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  {t("chrome.action.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: 0,
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        font: "600 12.5px/1 var(--f-sans)",
        color: danger ? "var(--danger)" : "var(--ink)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "var(--danger-bg)"
          : "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ color: danger ? "var(--danger)" : "var(--ink-soft)", display: "inline-flex" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
