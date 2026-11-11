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

import { useId, useRef, useState } from "react";
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

const CAMBIO_NO_CONFIRMADO = "No se pudo confirmar el cambio. Recarga el diario antes de volver a intentarlo.";
function mensajeDeAccion(result: ResultadoDeAsiento | null | undefined): string {
  return typeof result?.error === "string" && result.error.trim() ? result.error : CAMBIO_NO_CONFIRMADO;
}
function admiteCambioManual(entry: JournalEntry): boolean {
  const p = entry.protection;
  const sourceKnown = ["manual", "receipt", "supplier_bill", "supplier_payment", "expense", "depreciacion"].includes(entry.source);
  return sourceKnown && typeof entry.id === "string" && !!entry.id.trim() && typeof entry.tenant_id === "string" && !!entry.tenant_id.trim() &&
    (entry.invoice_id === null || (typeof entry.invoice_id === "string" && !!entry.invoice_id.trim())) && entry.deleted_at === null &&
    p?.state === "sin_vinculo_visible" && p.reading === "completa" && p.relation === "ninguno_visible";
}
function avisoDeProteccion(entry: JournalEntry): string {
  const p = entry.protection;
  if (p?.state === "protegido") {
    if (p.relation === "inconsistente") return "Asiento protegido con un vínculo que requiere revisión. Revisa la factura; los cambios manuales están bloqueados.";
    if (p.reading === "no_comprobada" || p.relation === "no_comprobado") return "Asiento protegido. No se pudo completar la revisión del vínculo; revisa la factura antes de continuar.";
    if (p.relation === "original" || p.relation === "reverso") return `Original y reverso identificados${p.counterpartCode ? `: ${p.counterpartCode}` : ""}. Esto no verifica los importes. Revisa la factura; no admite cambios manuales.`;
  }
  if (entry.source === "invoice" || entry.source === "invoice_reversal" || p?.state === "protegido") return "Asiento automático o vinculado protegido. Revísalo desde la factura; no admite cambios manuales.";
  return "Protección sin comprobar. Recarga el diario y solicita revisión si el aviso continúa. Los cambios manuales están bloqueados.";
}

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
  const protectionId = useId();
  const voidRequest = useRef(false);
  const exceptionRequest = useRef<Promise<string | null> | null>(null);
  const postingRequests = useRef(new Set<string>());
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
          const blocked = !admiteCambioManual(entry);
          const reasonId = `${protectionId}-${i}`;
          return (
            <div
              key={entry.id}
              data-row-id={entry.entry_code}
              aria-describedby={blocked ? reasonId : undefined}
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
                {blocked && (entry.status === "borrador" || entry.status === "asentado") && (
                  <>
                    <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" disabled aria-describedby={reasonId}>
                      {entry.status === "borrador" ? "Asentar" : "Anular"}
                    </button>
                    {entry.status === "borrador" && <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" disabled aria-describedby={reasonId}>Eliminar</button>}
                  </>
                )}
                {!blocked && entry.status === "borrador" && enCierre(entry) && (
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
                {!blocked && entry.status === "borrador" && !enCierre(entry) && (
                  <>
                    <ActionButton
                      variant="dark"
                      size="xs"
                      idleLabel="Asentar"
                      loadingLabel="Asentando…"
                      successLabel="Asentado"
                      idleIcon={Icon.check(12)}
                      onAction={async () => {
                        if (postingRequests.current.has(entry.id)) throw new Error("Ya hay un cambio en curso para este asiento.");
                        postingRequests.current.add(entry.id);
                        setError(null);
                        let r: ResultadoDeAsiento;
                        try { r = await postEntry(entry.id); }
                        catch { throw new Error(CAMBIO_NO_CONFIRMADO); }
                        finally { postingRequests.current.delete(entry.id); }
                        if (r?.ok !== true) throw new Error(mensajeDeAccion(r));
                      }}
                      onSuccess={() => {
                        setError(null);
                        toast.show({
                          eventKey: "accounting:journal-entry:posted", tone: "success",
                          message: `Asiento ${entry.entry_code} asentado`, priority: "normal", scope: "module",
                          dedupeKey: `accounting:journal-entry:posted:${entry.id}`,
                        });
                      }}
                      onError={setError}
                    />
                    <DeleteButton
                      entryCode={entry.entry_code}
                      onError={setError}
                      onConfirm={async () => {
                        setError(null);
                        const r = await softDeleteEntry(entry.id);
                        if (r?.ok !== true) { setError(mensajeDeAccion(r)); return false; }
                        toast.show({
                          eventKey: "accounting:journal-entry:draft-deleted", tone: "info",
                          message: `Asiento ${entry.entry_code} eliminado`, priority: "normal", scope: "module",
                          dedupeKey: `accounting:journal-entry:draft-deleted:${entry.id}`,
                        });
                        return true;
                      }}
                    />
                  </>
                )}
                {!blocked && entry.status === "asentado" && (
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
              {blocked && (
                <p id={reasonId} role="note" style={{ gridColumn: "1 / -1", margin: 0, display: "flex", gap: "var(--s-2)", alignItems: "flex-start", color: "var(--ink)", font: "500 12px/1.45 var(--f-sans)" }}>
                  <StatusIcon tone="warning" size={14} style={{ color: "var(--warning)" }} />
                  <span>{avisoDeProteccion(entry)}</span>
                </p>
              )}
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
          onCancel={() => { if (!exceptionRequest.current) setExcepcionTarget(null); }}
          onConfirm={async ({ superclave, motivo }) => {
            const { op, entry } = excepcionTarget;
            if (!admiteCambioManual(entry)) return avisoDeProteccion(entry);
            if (exceptionRequest.current) return exceptionRequest.current;
            const request = (async (): Promise<string | null> => {
              try {
                let r: ResultadoDeAsiento;
                if (op === "asentar") r = await postEntry(entry.id, { superclave, motivo });
                else if (op === "eliminar") r = await softDeleteEntry(entry.id, { superclave, motivo });
                else r = await voidEntry(entry.id, motivo, superclave);
                if (r?.ok !== true) return mensajeDeAccion(r);
                const hecho = op === "asentar" ? "asentado" : op === "eliminar" ? "eliminado" : "anulado";
                toast.show({
                  eventKey: "accounting:journal-entry:closing-exception-applied", tone: "success",
                  message: `Asiento ${entry.entry_code} ${hecho} con excepción al cierre`, priority: "normal", scope: "module",
                  dedupeKey: `accounting:journal-entry:closing-exception-applied:${op}:${entry.id}`,
                });
                setExcepcionTarget(null);
                return null;
              } catch { return CAMBIO_NO_CONFIRMADO; }
            })();
            exceptionRequest.current = request;
            try { return await request; }
            finally { if (exceptionRequest.current === request) exceptionRequest.current = null; }
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
          if (!voidRequest.current) setVoidTarget(null);
        }}
        onConfirm={async (reason) => {
          if (!voidTarget || voidRequest.current) return;
          if (!admiteCambioManual(voidTarget)) { setError(avisoDeProteccion(voidTarget)); return; }
          voidRequest.current = true;
          setVoidPending(true);
          setError(null);
          try {
            const result = await voidEntry(voidTarget.id, reason);
            if (result?.ok !== true) { setError(mensajeDeAccion(result)); return; }
            toast.show({
              eventKey: "accounting:journal-entry:voided", tone: "success",
              message: `Asiento ${voidTarget.entry_code} anulado`, priority: "normal", scope: "module",
              dedupeKey: `accounting:journal-entry:voided:${voidTarget.id}`,
            });
            setVoidTarget(null);
          } catch { setError(CAMBIO_NO_CONFIRMADO); }
          finally {
            voidRequest.current = false;
            setVoidPending(false);
          }
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
  onError,
}: {
  entryCode: string;
  onConfirm: () => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const request = useRef(false);

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
          if (request.current) return;
          request.current = true;
          setPending(true);
          try { if (await onConfirm() === true) setConfirm(false); }
          catch { onError(CAMBIO_NO_CONFIRMADO); }
          finally { request.current = false; setPending(false); }
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
