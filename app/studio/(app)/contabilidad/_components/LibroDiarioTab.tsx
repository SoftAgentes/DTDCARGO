"use client";

/**
 * Tab "Libro diario" (SDD-0040).
 *
 * Lista de asientos con su total (debe=haber), fecha, origen y estado.
 * Acciones por asiento: asentar (borrador→asentado), anular (asentado→anulado),
 * eliminar (solo borrador). "Nuevo asiento" abre el EntryDrawer.
 *
 * SDD-0557: la lista trae como mucho los 500 asientos más recientes
 * (`DIARIO_PANTALLA_MAX`). Los contadores salen de los totales REALES
 * (`countEntries`), no de la lista, y si hay más de los que se ven la pantalla
 * lo dice («Mostrando N de M») y enlaza el diario en CSV. El CSV baja solo los
 * asientos ASENTADOS (así cuadra con la comprobación; pregunta abierta 3 de la
 * spec): el enlace, el botón y el aviso lo dicen. La exportación con
 * Desde/Hasta vive acá; valida las fechas antes de navegar y la ruta las
 * vuelve a validar.
 */

import { useId, useState } from "react";
import {
  entryStatusBadgeTone,
  entryStatusLabel,
  entrySourceLabel,
  type JournalEntry,
} from "@/lib/studio/journal-types";
import { entryLineTotals } from "@/lib/studio/journal-queries";
import type { Account } from "@/lib/studio/account-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { StatusIcon } from "@/components/StatusIcon";
import {
  avisoDelDiario,
  enlaceDelDiario,
  rangoDelDiario,
  ROTULO_DIARIO_CSV,
} from "@/lib/studio/accounting/libro-control";
import { fmtAmount } from "./format";
import { EntryDrawer } from "./EntryDrawer";
import { ExcepcionCierreDialog } from "./ExcepcionCierreDialog";
import { postEntry, voidEntry, softDeleteEntry } from "../actions";
import { isPeriodClosed } from "@/lib/studio/accounting/period-queries";
import type { AvisoCierre, ResultadoDeAsiento } from "@/lib/studio/accounting/cierre-excepciones";

export function LibroDiarioTab({
  entries,
  totalEntries,
  postableAccounts,
  accountsCount,
  asentadosCount,
  showCreate,
  onOpenCreate,
  onCloseCreate,
  avisoCierre = null,
}: {
  entries: JournalEntry[];
  /** Asientos vivos del diario, sin el tope de pantalla (countEntries). */
  totalEntries: number;
  postableAccounts: Account[];
  accountsCount: number;
  asentadosCount: number;
  showCreate: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  /** SDD-0566: el cierre del período, para ofrecer la excepción en sus asientos. */
  avisoCierre?: AvisoCierre | null;
}) {
  const toast = useToast();
  const flashClassFor = useRowHighlight();
  const [error, setError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<JournalEntry | null>(null);
  const [voidPending, setVoidPending] = useState(false);
  // SDD-0566: asentar, anular o eliminar un asiento de período cerrado.
  const [excepcionTarget, setExcepcionTarget] = useState<{
    op: "asentar" | "anular" | "eliminar";
    entry: JournalEntry;
  } | null>(null);
  const enCierre = (e: JournalEntry) =>
    avisoCierre !== null && isPeriodClosed(avisoCierre.closingDate, e.entry_date);

  const noAccounts = accountsCount === 0 || postableAccounts.length === 0;
  const aviso = avisoDelDiario(entries.length, totalEntries, asentadosCount);

  if (totalEntries === 0) {
    return (
      <>
        <EmptyState
          eyebrow="Sin asientos"
          title="Aún no hay asientos en el diario."
          description={
            noAccounts
              ? "Primero necesitas un plan de cuentas con cuentas postables para poder asentar."
              : "Carga tu primer asiento de doble partida (debe = haber). Las facturas emitidas también generan su asiento acá."
          }
          action={
            !noAccounts ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={onOpenCreate}
              >
                + Nuevo asiento
              </button>
            ) : null
          }
        />
        {showCreate && (
          <EntryDrawer
            postableAccounts={postableAccounts}
            onClose={onCloseCreate}
          />
        )}
      </>
    );
  }

  const GRID = "130px 110px 1.4fr 110px 120px 130px 150px";

  return (
    <>
      {error && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 12px",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-4)",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          <div
            data-testid="diario-contador"
            style={{
              display: "flex",
              gap: "var(--s-3)",
              font: "500 12px/1.2 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <span>
              {totalEntries.toLocaleString("es-VE")} asiento{totalEntries === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {asentadosCount.toLocaleString("es-VE")} asentado{asentadosCount === 1 ? "" : "s"}
            </span>
          </div>
          {aviso && (
            <p
              role="status"
              data-testid="diario-aviso"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-2)",
                flexWrap: "wrap",
                margin: 0,
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              <StatusIcon tone="warning" size={14} style={{ color: "var(--warning)" }} />
              <span>{aviso}</span>
              <a
                href={enlaceDelDiario()}
                style={{ color: "var(--wine-text)", fontWeight: 700 }}
              >
                {ROTULO_DIARIO_CSV}
              </a>
            </p>
          )}
        </div>
        <ExportarDiario />
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            gap: 12,
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          <span>Asiento</span>
          <span>Fecha</span>
          <span>Concepto</span>
          <span>Origen</span>
          <span style={{ textAlign: "right" }}>Monto</span>
          <span>Estado</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        {entries.map((entry, i) => {
          const totals = entryLineTotals(entry);
          return (
            <div
              key={entry.id}
              data-row-id={entry.entry_code}
              className={`studio-tracking-row ${flashClassFor(entry.entry_code)}`.trim()}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "13px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                {entry.entry_code}
              </span>
              <span
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {entry.entry_date}
              </span>
              <span
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.memo ?? "—"}
              </span>
              <span>
                <Badge
                  tone={entry.source === "invoice" || entry.source === "invoice_reversal" ? "info" : "neutral"}
                  size="sm"
                >
                  {entrySourceLabel(entry.source)}
                </Badge>
              </span>
              <span
                style={{
                  font: "800 12.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                ${fmtAmount(totals.debit)}
              </span>
              <span>
                <Badge tone={entryStatusBadgeTone(entry.status)} size="sm">
                  {entryStatusLabel(entry.status)}
                </Badge>
              </span>
              <span
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                {entry.status === "borrador" && enCierre(entry) && (
                  <>
                    <button
                      type="button"
                      className="studio-btn studio-btn-dark studio-btn-xs"
                      onClick={() => {
                        setError(null);
                        setExcepcionTarget({ op: "asentar", entry });
                      }}
                    >
                      Asentar…
                    </button>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      style={{ color: "var(--danger)" }}
                      onClick={() => {
                        setError(null);
                        setExcepcionTarget({ op: "eliminar", entry });
                      }}
                    >
                      Eliminar…
                    </button>
                  </>
                )}
                {entry.status === "borrador" && !enCierre(entry) && (
                  <>
                    <ActionButton
                      variant="dark"
                      size="xs"
                      idleLabel="Asentar"
                      loadingLabel="Asentando…"
                      successLabel="Asentado"
                      idleIcon={Icon.check(12)}
                      onAction={async () => {
                        setError(null);
                        const r = await postEntry(entry.id);
                        if (r.error) throw new Error(r.error);
                      }}
                      onSuccess={() =>
                        toast.success(`Asiento ${entry.entry_code} asentado`)
                      }
                      onError={setError}
                    />
                    <DeleteButton
                      entryCode={entry.entry_code}
                      onConfirm={async () => {
                        setError(null);
                        const r = await softDeleteEntry(entry.id);
                        if (r.error) setError(r.error);
                        else toast.info(`Asiento ${entry.entry_code} eliminado`);
                      }}
                    />
                  </>
                )}
                {entry.status === "asentado" && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    style={{ color: "var(--danger)" }}
                    onClick={() => {
                      setError(null);
                      if (enCierre(entry)) setExcepcionTarget({ op: "anular", entry });
                      else setVoidTarget(entry);
                    }}
                  >
                    {enCierre(entry) ? "Anular…" : "Anular"}
                  </button>
                )}
                {entry.status === "anulado" && (
                  <span
                    style={{
                      font: "500 11px/1 var(--f-sans)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    —
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <EntryDrawer postableAccounts={postableAccounts} onClose={onCloseCreate} />
      )}
      {excepcionTarget && avisoCierre && (
        <ExcepcionCierreDialog
          aviso={avisoCierre}
          operacion={excepcionTarget.op}
          entryCode={excepcionTarget.entry.entry_code}
          onCancel={() => setExcepcionTarget(null)}
          onConfirm={async ({ superclave, motivo }) => {
            const { op, entry } = excepcionTarget;
            let r: ResultadoDeAsiento;
            if (op === "asentar") r = await postEntry(entry.id, { superclave, motivo });
            else if (op === "eliminar") r = await softDeleteEntry(entry.id, { superclave, motivo });
            else r = await voidEntry(entry.id, motivo, superclave);
            if (!r.ok) return r.error ?? "No se pudo guardar el cambio.";
            const hecho = op === "asentar" ? "asentado" : op === "eliminar" ? "eliminado" : "anulado";
            toast.success(`Asiento ${entry.entry_code} ${hecho} con excepción al cierre`);
            setExcepcionTarget(null);
            return null;
          }}
        />
      )}
      <ConfirmDialog
        open={voidTarget !== null}
        danger
        reason
        reasonRequired
        initialFocus="reason"
        title="Anular asiento"
        message={`El asiento ${voidTarget?.entry_code ?? ""} quedará anulado en el historial. Indica el motivo contable.`}
        confirmLabel="Anular asiento"
        pending={voidPending}
        error={error ?? undefined}
        onCancel={() => {
          if (!voidPending) setVoidTarget(null);
        }}
        onConfirm={async (reason) => {
          if (!voidTarget) return;
          setVoidPending(true);
          setError(null);
          const result = await voidEntry(voidTarget.id, reason);
          if (result.error) {
            setError(result.error);
            setVoidPending(false);
            return;
          }
          toast.success(`Asiento ${voidTarget.entry_code} anulado`);
          setVoidTarget(null);
          setVoidPending(false);
        }}
      />
    </>
  );
}

/**
 * Exportación del diario con Desde/Hasta opcionales (SDD-0557). Es un GET a la
 * ruta de exportación: la respuesta es un adjunto y el navegador la descarga
 * sin salir de la pantalla. Las fechas se validan antes de enviar con la misma
 * regla que usa la ruta (`rangoDelDiario`), para no mandar a nadie a una
 * respuesta de error.
 */
function ExportarDiario() {
  const id = useId();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = `${id}-error`;

  return (
    <form
      method="get"
      action="/api/studio/contabilidad/export"
      aria-label="Exportar el diario a CSV"
      onSubmit={(e) => {
        const r = rangoDelDiario(desde, hasta);
        if (r.error) {
          e.preventDefault();
          setError(r.error);
          return;
        }
        setError(null);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}
    >
      <input type="hidden" name="tipo" value="diario" />
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-2)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span className="studio-label">Desde (opcional)</span>
          <input
            type="date"
            name="desde"
            className="studio-input"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              if (error) setError(rangoDelDiario(e.target.value, hasta).error);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            style={{ minWidth: 160 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span className="studio-label">Hasta (opcional)</span>
          <input
            type="date"
            name="hasta"
            className="studio-input"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              if (error) setError(rangoDelDiario(desde, e.target.value).error);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            style={{ minWidth: 160 }}
          />
        </label>
        <button type="submit" className="studio-btn studio-btn-ghost studio-btn-sm">
          {ROTULO_DIARIO_CSV}
        </button>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            margin: 0,
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <StatusIcon tone="danger" size={14} style={{ color: "var(--danger-text)" }} />
          {error}
        </p>
      )}
    </form>
  );
}

/** Botón de eliminar con confirmación inline (solo borradores). */
function DeleteButton({
  entryCode,
  onConfirm,
}: {
  entryCode: string;
  onConfirm: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirm) {
    return (
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        style={{ color: "var(--danger)" }}
        onClick={() => setConfirm(true)}
        aria-label={`Eliminar asiento ${entryCode}`}
      >
        Eliminar
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <button
        type="button"
        className="studio-btn studio-btn-danger studio-btn-xs"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await onConfirm();
          setPending(false);
          setConfirm(false);
        }}
      >
        {pending ? "…" : "Sí"}
      </button>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        onClick={() => setConfirm(false)}
        disabled={pending}
      >
        No
      </button>
    </span>
  );
}
