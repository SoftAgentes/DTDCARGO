"use client";

/**
 * LineMatchDrawer (SDD-0105) — ligar un movimiento del extracto a un asiento
 * EXISTENTE del diario, o marcarlo manual (conciliado sin asiento).
 *
 * REGLA DURA: solo setea el vínculo (matchLine) o el estado (setLineStatus). NO
 * crea ni postea asientos al mayor (eso queda como no-goal V1). Los candidatos
 * que ya están ligados a otro movimiento se muestran deshabilitados (1:1).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  lineDirectionLabel,
  type BankStatementLine,
} from "@/lib/studio/accounting/bank-statement-types";
import {
  matchConfidenceFor,
  type EntryCandidate,
} from "@/lib/studio/accounting/bank-statement-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { fmtAmount } from "./format";
import { matchLine, setLineStatus } from "../reconcile-actions";

interface Props {
  line: BankStatementLine;
  candidates: EntryCandidate[];
  onClose: () => void;
}

export function LineMatchDrawer({ line, candidates, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = candidates
    .filter(
      (c) =>
        !q ||
        c.entry_code.toLowerCase().includes(q) ||
        (c.memo ?? "").toLowerCase().includes(q),
    )
    .slice(0, 30);

  const doMatch = async (entryId: string) => {
    setError(null);
    setPending(true);
    const conf = matchConfidenceFor(line.amount, {
      amount: candidates.find((c) => c.id === entryId)?.amount ?? 0,
      alreadyLinked: false,
    });
    const r = await matchLine(line.id, entryId, conf);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Movimiento conciliado");
    router.refresh();
    onClose();
  };

  const doManual = async () => {
    setError(null);
    setPending(true);
    const r = await setLineStatus(line.id, "manual");
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.info("Movimiento marcado como manual");
    router.refresh();
    onClose();
  };

  return (
    <div
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 110,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 96vw)",
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
          <div>
            <h2
              id="match-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              Conciliar movimiento
            </h2>
            <p
              style={{
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "4px 0 0",
              }}
            >
              Liga este movimiento a un asiento existente del diario.
            </p>
          </div>
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

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Resumen del movimiento */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <Badge tone={line.direction === "credit" ? "success" : "wine"} size="sm" dot>
                  {lineDirectionLabel(line.direction)}
                </Badge>
                <code style={{ font: "500 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                  {line.line_date}
                </code>
              </div>
              <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {line.description}
              </div>
            </div>
            <div
              style={{
                font: "900 18px/1 var(--f-mono)",
                color: line.direction === "credit" ? "var(--success)" : "var(--ink)",
              }}
            >
              ${fmtAmount(line.amount)}
            </div>
          </div>

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

          {/* Buscar asiento */}
          <div>
            <label className="studio-label" htmlFor="match-search">
              Buscar asiento (código o concepto)
            </label>
            <input
              id="match-search"
              type="text"
              className="studio-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="A-2026-… o concepto"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.length === 0 && (
              <p
                style={{
                  font: "500 12px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No hay asientos asentados en la cuenta de este extracto para ligar.
              </p>
            )}
            {filtered.map((c) => {
              const conf = matchConfidenceFor(line.amount, {
                amount: c.amount,
                alreadyLinked: c.alreadyLinked,
              });
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={pending || c.alreadyLinked}
                  onClick={() => doMatch(c.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    background: c.alreadyLinked
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    textAlign: "left",
                    cursor: c.alreadyLinked || pending ? "not-allowed" : "pointer",
                    opacity: c.alreadyLinked ? 0.55 : 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <code style={{ font: "700 11px/1 var(--f-mono)", color: "var(--wine)" }}>
                        {c.entry_code}
                      </code>
                      {c.alreadyLinked ? (
                        <Badge tone="neutral" size="sm">
                          ya conciliado
                        </Badge>
                      ) : conf ? (
                        <Badge
                          tone={
                            conf === "high"
                              ? "success"
                              : conf === "medium"
                                ? "warning"
                                : "danger"
                          }
                          size="sm"
                        >
                          {conf === "high"
                            ? "match seguro"
                            : conf === "medium"
                              ? "probable"
                              : "dudoso"}
                        </Badge>
                      ) : null}
                    </div>
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.entry_date} · {c.memo ?? "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      font: "800 13px/1 var(--f-mono)",
                      color: "var(--ink)",
                      textAlign: "right",
                    }}
                  >
                    ${fmtAmount(c.amount)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={doManual}
            disabled={pending}
            title="Conciliado sin asiento (manual)"
          >
            Marcar manual
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cerrar
          </button>
        </footer>
      </aside>
    </div>
  );
}
