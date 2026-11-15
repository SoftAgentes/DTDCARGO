"use client";

import { fechaCaracas } from "@/lib/shared/fechas-caracas";

/**
 * EntryDrawer (SDD-0040) — "Nuevo asiento" con editor de líneas.
 *
 * Cada línea: cuenta (postable) + debe O haber. Total debe/haber en vivo con
 * indicador de balance. No deja crear/asentar si no balancea. Checkbox para
 * asentar al crear (si no, queda en borrador).
 *
 * El balance se calcula con `entryTotals` (la misma fn pura que el server),
 * así UI y validación coinciden.
 */

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  entryTotals,
  type JournalActionState,
} from "@/lib/studio/journal-types";
import type { Account } from "@/lib/studio/account-types";
import { compareCodes } from "@/lib/studio/account-types";
import { createJournalEntry } from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { fmtAmount } from "./format";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { textoAvisoCierre } from "@/lib/studio/accounting/cierre-excepciones";
import { CamposExcepcionCierre, excepcionCompleta } from "./CamposExcepcionCierre";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

interface Props {
  postableAccounts: Account[];
  onClose: () => void;
}

const initialState: JournalActionState = {};

type DraftLine = {
  account_id: string;
  debit: string;
  credit: string;
  line_memo: string;
};

function emptyLine(): DraftLine {
  return { account_id: "", debit: "", credit: "", line_memo: "" };
}

function todayISO(): string {
  return fechaCaracas();
}

export function EntryDrawer({ postableAccounts, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    createJournalEntry,
    initialState,
  );

  const [entryDate, setEntryDate] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [postOnCreate, setPostOnCreate] = useState(true);
  // SDD-0566: si la fecha cae en período cerrado, el servidor devuelve el aviso
  // y el mismo formulario lleva la superclave y el motivo. La superclave se
  // vacía al enviar: el FormData ya la tomó y no queda en pantalla.
  const [superclave, setSuperclave] = useState("");
  const [motivoCierre, setMotivoCierre] = useState("");
  // Si la persona mueve la fecha fuera del cierre, el aviso ya no aplica.
  const cierre = state.cierre && entryDate <= state.cierre.closingDate ? state.cierre : null;
  const enviar = (fd: FormData) => {
    setSuperclave("");
    formAction(fd);
  };

  const sortedAccounts = postableAccounts
    .slice()
    .sort((a, b) => compareCodes(a.code, b.code));

  useEffect(() => {
    if (!state.ok) return;
    if (state.createdCode) {
      toast.success(`Asiento ${state.createdCode} creado`, {
        link: {
          href: `/studio/contabilidad?tab=diario&highlight=${encodeURIComponent(state.createdCode)}&hl-tone=warm`,
          label: "Ver en el diario",
        },
      });
    }
    router.refresh();
    onClose();
  }, [state.ok, state.createdCode, router, toast, onClose]);

  const numericLines = lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    line_memo: l.line_memo.trim() || null,
  }));
  const totals = entryTotals(numericLines);

  const linesJson = JSON.stringify(
    numericLines.filter(
      (l) => l.account_id && (l.debit > 0 || l.credit > 0),
    ),
  );

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLines((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx),
    );
  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const filledLines = numericLines.filter(
    (l) => l.account_id && (l.debit > 0 || l.credit > 0),
  ).length;
  const canSubmit =
    filledLines >= 2 &&
    totals.balanced &&
    (!cierre || excepcionCompleta(cierre, superclave, motivoCierre));

  const panelRef = useRef<HTMLElement>(null);

  useDialogA11y(panelRef, { onClose, pending: isPending });


  return (
    <div
      onClick={() => !isPending && onClose()}
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-drawer-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
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
            id="entry-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Nuevo asiento
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
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
              cursor: isPending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="entry-drawer-form"
          action={enviar}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <input type="hidden" name="lines" value={linesJson} />
          <input
            type="hidden"
            name="post_on_create"
            value={postOnCreate ? "true" : "false"}
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="entry-date">
                Fecha <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="entry-date"
                name="entry_date"
                type="date"
                className="studio-input"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
              {state.fieldErrors?.entry_date && (
                <FieldError msg={state.fieldErrors.entry_date} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="entry-memo">
                Concepto
              </label>
              <input
                id="entry-memo"
                name="memo"
                type="text"
                className="studio-input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Ajuste, provisión, cobro de caja…"
              />
            </div>
          </div>

          {/* Editor de líneas */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div className="studio-eyebrow">Líneas</div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                onClick={addLine}
              >
                + Agregar línea
              </button>
            </div>

            {/* Head de columnas */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 120px 28px",
                gap: 8,
                padding: "0 2px 6px",
                font: "700 9.5px/1 var(--f-sans)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
              }}
            >
              <span>Cuenta</span>
              <span style={{ textAlign: "right" }}>Debe</span>
              <span style={{ textAlign: "right" }}>Haber</span>
              <span />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 120px 28px",
                    gap: 8,
                    alignItems: "start",
                  }}
                >
                  <select
                    className="studio-input"
                    value={l.account_id}
                    onChange={(e) =>
                      updateLine(idx, { account_id: e.target.value })
                    }
                    aria-label={`Cuenta línea ${idx + 1}`}
                  >
                    <option value="">— Elige una cuenta —</option>
                    {sortedAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                  <NumericInput
                    type="currency"
                    currency="USD"
                    min={0}
                    placeholder="0.00"
                    value={l.debit === "" ? null : Number(l.debit)}
                    onChange={(v) =>
                      updateLine(idx, {
                        debit: v != null ? String(v) : "",
                        // debe XOR haber: si pongo debe, limpio haber.
                        credit: v != null && v > 0 ? "" : l.credit,
                      })
                    }
                    aria-label={`Debe línea ${idx + 1}`}
                  />
                  <NumericInput
                    type="currency"
                    currency="USD"
                    min={0}
                    placeholder="0.00"
                    value={l.credit === "" ? null : Number(l.credit)}
                    onChange={(v) =>
                      updateLine(idx, {
                        credit: v != null ? String(v) : "",
                        debit: v != null && v > 0 ? "" : l.debit,
                      })
                    }
                    aria-label={`Haber línea ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 2}
                    aria-label={`Quitar línea ${idx + 1}`}
                    title="Quitar línea"
                    style={{
                      height: 38,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                      color:
                        lines.length <= 2 ? "var(--ink-mute)" : "var(--danger)",
                      cursor: lines.length <= 2 ? "not-allowed" : "pointer",
                    }}
                  >
                    {Icon.trash(13)}
                  </button>
                </div>
              ))}
            </div>
            {state.fieldErrors?.lines && (
              <FieldError msg={state.fieldErrors.lines} />
            )}
          </div>

          {cierre && (
            <CamposExcepcionCierre
              aviso={cierre}
              superclave={superclave}
              onSuperclave={setSuperclave}
              motivo={motivoCierre}
              onMotivo={setMotivoCierre}
              disabled={isPending}
              nombres={{ superclave: "cierre_superclave", motivo: "cierre_motivo" }}
            />
          )}

          {state.error && !(cierre && state.error === textoAvisoCierre(cierre)) && (
            <Aviso tono="error" compacto>{state.error}</Aviso>
          )}

          {/* Totales debe/haber + balance, navy LIVE */}
          <div
            style={{
              padding: "var(--s-4) var(--s-5)",
              background: "var(--bg-sidebar)",
              color: "var(--ink-side)",
              borderRadius: "var(--r-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                font: "500 13px/1 var(--f-sans)",
                color: "var(--ink-side)",
              }}
            >
              <span>Total debe</span>
              <span style={{ font: "700 13px/1 var(--f-mono)" }}>
                ${fmtAmount(totals.debit)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                font: "500 13px/1 var(--f-sans)",
                color: "var(--ink-side)",
              }}
            >
              <span>Total haber</span>
              <span style={{ font: "700 13px/1 var(--f-mono)" }}>
                ${fmtAmount(totals.credit)}
              </span>
            </div>
            <div style={{ height: 1, background: "var(--ink-side-soft)" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  font: "600 10.5px/1 var(--f-sans)",
                  color: "var(--ink-side-soft)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {totals.balanced ? "Balanceado" : "Diferencia"}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  font: "800 14px/1 var(--f-mono)",
                  color: totals.balanced
                    ? "var(--success)"
                    : "var(--warning)",
                }}
              >
                {totals.balanced ? (
                  <>
                    {Icon.check(13)}
                    debe = haber
                  </>
                ) : (
                  `$${fmtAmount(Math.abs(totals.debit - totals.credit))}`
                )}
              </span>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              font: "600 12.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={postOnCreate}
              onChange={(e) => setPostOnCreate(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            Asentar al crear (si no, queda en borrador)
          </label>

          <div style={{ flex: 1, minHeight: 8 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="entry-drawer-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
            title={
              !canSubmit && !isPending
                ? "El asiento necesita ≥2 líneas y debe = haber"
                : undefined
            }
          >
            {isPending
              ? "Guardando…"
              : cierre
                ? "Crear con excepción"
                : postOnCreate
                ? "Crear y asentar"
                : "Guardar borrador"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
