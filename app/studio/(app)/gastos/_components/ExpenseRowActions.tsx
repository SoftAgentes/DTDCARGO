"use client";

/**
 * ExpenseRowActions — menú "···" por row de gasto: editar / anular.
 *
 * Editar → delega al padre (abre ExpenseDrawer en modo edición).
 * Anular → ConfirmDialog R3 + voidExpenseAction + refresh durable.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { useT, resolveErrorMessage } from "@/lib/i18n";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { voidExpenseAction } from "../actions";

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
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidError, setVoidError] = useState<string>();
  const [requestRef, setRequestRef] = useState("");
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
  }, [open]);

  const openVoidDialog = () => {
    setOpen(false);
    setVoidError(undefined);
    setRequestRef(`expense-void:${expenseId}:${crypto.randomUUID()}`);
    setVoidOpen(true);
  };

  const doVoid = (reason: string) => {
    startTransition(async () => {
      const res = await voidExpenseAction(expenseId, reason, requestRef);
      if (res.ok) {
        toast.success(
          t(
            res.outcome === "replayed"
              ? "expenses.row.void_replayed"
              : "expenses.row.voided",
            { code: expenseCode },
          ),
        );
        setVoidOpen(false);
        setVoidError(undefined);
        router.refresh();
      } else {
        setVoidError(resolveErrorMessage(t, res) ?? res.error ?? t("error.internal_error"));
      }
    });
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          aria-label={t("expenses.table.col_actions")}
          aria-haspopup="menu"
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
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
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
              label={t("expenses.row.void")}
              danger
              onClick={openVoidDialog}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={voidOpen}
        danger
        reason
        reasonRequired
        holdToConfirm
        initialFocus="safe"
        title={t("expenses.row.void_title", { code: expenseCode })}
        message={t("expenses.row.void_message")}
        confirmLabel={t("expenses.row.void_confirm")}
        reasonLabel={t("expenses.row.void_reason")}
        reasonPlaceholder={t("expenses.row.void_reason_placeholder")}
        holdLabel={t("expenses.row.void_hold")}
        holdAlternativeLabel={t("expenses.row.void_alternative")}
        pending={pending}
        error={voidError}
        onCancel={() => {
          setVoidOpen(false);
          setVoidError(undefined);
        }}
        onConfirm={doVoid}
      />
    </>
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
