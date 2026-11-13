"use client";

import { fechaCaracas } from "@/lib/shared/fechas-caracas";

/**
 * Drawer del receivable (SDD-0041): datos de la factura + acciones de gestión
 * (contacto/promesa/nota) + registrar cobro + historial de recibos y gestiones.
 *
 * El cobro y la gestión usan las server actions del módulo
 * (registerCollection / logActivity / voidReceipt). El historial se carga al
 * abrir vía getReceivableHistory.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PendingReportsNotice } from "./PendingReportsNotice";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  applicationStatusLabel,
  applicationStatusTone,
  collectionKindLabel,
  fundClassLabel,
  fundClassTone,
  paymentMethodLabel,
  PAYMENT_METHOD_OPTIONS,
  PAYER_RELATION_OPTIONS,
  stageLabel,
  stageTone,
  type CollectionActivity,
  type PayerKind,
  type PayerRelation,
  type PaymentMethod,
  type PaymentReceipt,
} from "@/lib/studio/payment-types";
import type { Receivable } from "@/lib/studio/payment-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  getReceivableHistory,
  logActivity,
  registerCollection,
  voidReceipt,
} from "../actions";

/** Cuenta de caja/banco (subset para el select del cobro). */
export type CashAccountOption = { id: string; code: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CobranzaDrawer({
  receivable,
  cashAccounts,
  onClose,
}: {
  receivable: Receivable;
  cashAccounts: CashAccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const inv = receivable.invoice;

  const [error, setError] = useState<string | null>(null);
  const [showCobro, setShowCobro] = useState(false);
  const [showPromise, setShowPromise] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [voidPending, setVoidPending] = useState(false);
  const [history, setHistory] = useState<{
    receipts: PaymentReceipt[];
    activities: CollectionActivity[];
  } | null>(null);

  // Cargar historial al abrir. Si el gate de VISTA deniega (SDD-0497), el motivo
  // se muestra en el banner de error del drawer en vez de un historial vacío
  // indistinguible de "esta factura no tiene cobros".
  useEffect(() => {
    let active = true;
    getReceivableHistory(inv.id)
      .then((h) => {
        if (!active) return;
        setHistory({ receipts: h.receipts, activities: h.activities });
        if (h.error) setError(h.error);
      })
      .catch(() => {
        if (active) setHistory({ receipts: [], activities: [] });
      });
    return () => {
      active = false;
    };
  }, [inv.id]);

  const refresh = () => router.refresh();

  const stageBadge = (
    <Badge tone={stageTone(receivable.stage)}>
      {stageLabel(receivable.stage)}
    </Badge>
  );

  return (
    <>
    <DrawerShell
      title={inv.invoice_code}
      subtitle={`${inv.client_name} · saldo $${fmt(receivable.balance)}`}
      onClose={onClose}
      pending={false}
      width={640}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
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

        {/* Estado + saldo */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--r-md)",
            // stageTone() solo devuelve success|danger|warning|info|neutral
            // (payment-types.ts), nunca "wine", por lo que el -bg interpolado
            // siempre existe en tokens.css. No usar wine acá: --wine-bg no existe.
            background: `var(--${stageTone(receivable.stage)}-bg)`,
            borderLeft: `4px solid var(--${stageTone(receivable.stage)})`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            {stageBadge}
            <div
              style={{
                font: "600 12px/1.4 var(--f-sans)",
                color:
                  (receivable.daysOverdue ?? 0) > 0
                    ? "var(--danger)"
                    : "var(--ink-soft)",
                marginTop: 8,
              }}
            >
              {receivable.daysOverdue == null
                ? "Sin fecha de vencimiento"
                : receivable.daysOverdue > 0
                  ? `Vencida hace ${receivable.daysOverdue} días`
                  : receivable.daysOverdue === 0
                    ? "Vence hoy"
                    : `Vence en ${Math.abs(receivable.daysOverdue)} días`}
              {receivable.promiseDate && (
                <span style={{ color: "var(--info)" }}>
                  {" · promesa de pago "}
                  {receivable.promiseDate}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "700 9.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Saldo a cobrar
            </div>
            <div
              style={{
                font: "900 24px/1 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              ${fmt(receivable.balance)}
            </div>
          </div>
        </div>

        <PendingReportsNotice invoiceId={inv.id} invoiceCode={inv.invoice_code} currency={inv.currency} />

        {/* Cobro */}
        {!showCobro ? (
          receivable.balance > 0 && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowCobro(true)}
              style={{ alignSelf: "flex-start" }}
            >
              <span style={{ display: "inline-flex" }}>{Icon.invoice(14)}</span>
              Registrar cobro
            </button>
          )
        ) : (
          <CobroForm
            receivable={receivable}
            cashAccounts={cashAccounts}
            onCancel={() => setShowCobro(false)}
            onError={setError}
            onDone={(receiptCode, fullyPaid) => {
              toast.success(
                `Cobro ${fullyPaid ? "total" : "parcial"} registrado en ${inv.invoice_code}${receiptCode ? ` · recibo ${receiptCode}` : ""}`,
              );
              setShowCobro(false);
              refresh();
              getReceivableHistory(inv.id).then(setHistory).catch(() => {});
            }}
          />
        )}

        {/* Gestión de cobranza */}
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Gestión de cobranza
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <ActionButton
              variant="ghost"
              size="sm"
              idleLabel="Registrar contacto"
              loadingLabel="Guardando…"
              successLabel="Contacto registrado"
              idleIcon={Icon.bell(13)}
              onAction={async () => {
                setError(null);
                const r = await logActivity(inv.id, {
                  kind: "contacto",
                  body: "Llamada / WhatsApp al cliente",
                });
                if (r.error) return { error: r.error };
                refresh();
                getReceivableHistory(inv.id).then(setHistory).catch(() => {});
                return undefined;
              }}
              onError={setError}
            />
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setShowPromise((o) => !o)}
            >
              <span style={{ display: "inline-flex" }}>{Icon.clock(13)}</span>
              Promesa de pago
            </button>
            <ActionButton
              variant="ghost"
              size="sm"
              idleLabel="Enviar recordatorio"
              loadingLabel="Guardando…"
              successLabel="Recordatorio anotado"
              idleIcon={Icon.mail(13)}
              onAction={async () => {
                setError(null);
                const r = await logActivity(inv.id, {
                  kind: "recordatorio",
                  body: "Recordatorio enviado al cliente",
                });
                if (r.error) return { error: r.error };
                refresh();
                getReceivableHistory(inv.id).then(setHistory).catch(() => {});
                return undefined;
              }}
              onError={setError}
            />
            {/* SDD-0281 · la nota libre. Las otras tres gestiones anotan un
                texto fijo; ésta es la que sirve cuando lo que pasó no entra en
                ninguna categoría ("el cliente pidió refacturar a otro RIF"),
                que en cobranza es la mitad de los casos. El backend ya existía
                —`logActivity` acepta `kind: "nota"` desde que se construyó el
                módulo—; sólo faltaba el formulario. */}
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              aria-expanded={showNote}
              onClick={() => {
                setShowNote((o) => !o);
                setShowPromise(false);
              }}
            >
              <span style={{ display: "inline-flex" }}>{Icon.edit(13)}</span>
              Nota
            </button>
          </div>

          {showNote && (
            <NoteForm
              onCancel={() => setShowNote(false)}
              onSubmit={async (body) => {
                setError(null);
                const r = await logActivity(inv.id, { kind: "nota", body });
                if (r.error) {
                  setError(r.error);
                  return false;
                }
                setShowNote(false);
                refresh();
                getReceivableHistory(inv.id).then(setHistory).catch(() => {});
                return true;
              }}
            />
          )}

          {showPromise && (
            <PromiseForm
              balance={receivable.balance}
              onCancel={() => setShowPromise(false)}
              onError={setError}
              onSubmit={async (promisedDate, promisedAmount) => {
                setError(null);
                const r = await logActivity(inv.id, {
                  kind: "promesa",
                  promisedDate,
                  promisedAmount,
                  body: `Cliente promete pagar el ${promisedDate}`,
                });
                if (r.error) {
                  setError(r.error);
                  return false;
                }
                setShowPromise(false);
                refresh();
                getReceivableHistory(inv.id).then(setHistory).catch(() => {});
                return true;
              }}
            />
          )}
        </div>

        {/* Datos de la factura */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <Field label="Factura" value={inv.invoice_code} mono />
          <Field
            label="Emitida / vence"
            value={`${inv.issued_at ?? "—"} → ${inv.due_date ?? "—"}`}
            mono
          />
          <Field
            label="Total / pagado"
            value={`$${fmt(inv.total_amount)} / $${fmt(inv.paid_amount)}`}
            mono
          />
          <Field label="Embarque" value={inv.shipment_code ?? "—"} mono />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/studio/facturacion/${inv.invoice_code}`}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Ver factura
            <span style={{ display: "inline-flex" }}>{Icon.arrowR(12)}</span>
          </Link>
          <Link
            href={`/studio/clientes/${inv.client_markbox}`}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Ver cliente
            <span style={{ display: "inline-flex" }}>{Icon.arrowR(12)}</span>
          </Link>
        </div>

        {/* Historial */}
        <HistorySection
          history={history}
          onRequestVoid={(receiptId, code) => {
            setError(null);
            setVoidTarget({ id: receiptId, code });
          }}
        />
      </div>
    </DrawerShell>
    <ConfirmDialog
      open={voidTarget !== null}
      danger
      reason
      reasonRequired
      initialFocus="reason"
      title="Anular recibo"
      message={`El recibo ${voidTarget?.code ?? ""} se anulará y se revertirá su saldo. Indica el motivo.`}
      confirmLabel="Anular recibo"
      pending={voidPending}
      error={error ?? undefined}
      onCancel={() => {
        if (!voidPending) setVoidTarget(null);
      }}
      onConfirm={async (reason) => {
        if (!voidTarget) return;
        setVoidPending(true);
        setError(null);
        const result = await voidReceipt(voidTarget.id, reason);
        if (result.error) {
          setError(result.error);
          setVoidPending(false);
          return;
        }
        toast.info(`Recibo ${voidTarget.code} anulado · se revirtió el saldo`);
        setVoidTarget(null);
        setVoidPending(false);
        refresh();
        getReceivableHistory(inv.id).then(setHistory).catch(() => {});
      }}
    />
    </>
  );
}

function CobroForm({
  receivable,
  cashAccounts,
  onCancel,
  onError,
  onDone,
}: {
  receivable: Receivable;
  cashAccounts: CashAccountOption[];
  onCancel: () => void;
  onError: (m: string) => void;
  onDone: (receiptCode: string | undefined, fullyPaid: boolean) => void;
}) {
  const balance = receivable.balance;
  const today = fechaCaracas();
  const [amount, setAmount] = useState<string>(String(balance));
  const [cashAccountId, setCashAccountId] = useState<string>(
    cashAccounts[0]?.id ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [receivedAt, setReceivedAt] = useState<string>(today);
  const [reference, setReference] = useState<string>("");
  // Pagador (SDD-0068 · decisión #7 + COPY §3).
  const [payerKind, setPayerKind] = useState<PayerKind>("cliente");
  const [payerName, setPayerName] = useState<string>("");
  const [payerRelation, setPayerRelation] = useState<PayerRelation | "">("");
  const [licitDeclared, setLicitDeclared] = useState(false);

  const amt = Number(amount) || 0;
  const noCashAccounts = cashAccounts.length === 0;
  const payerValid =
    payerKind === "cliente" ||
    (!!payerName.trim() && !!payerRelation && licitDeclared);
  const valid =
    amt > 0 &&
    amt <= balance + 1e-6 &&
    !!cashAccountId &&
    !noCashAccounts &&
    payerValid;

  return (
    <div
      style={{
        padding: "16px 16px 14px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="studio-eyebrow">Registrar cobro</div>

      <div>
        <label className="studio-label" htmlFor="cob-amount">
          Monto a cobrar ({receivable.invoice.currency})
        </label>
        <NumericInput
          id="cob-amount"
          type="currency"
          currency="USD"
          min={0}
          max={balance}
          placeholder="0.00"
          value={amount === "" ? null : Number(amount)}
          onChange={(v) => setAmount(v != null ? String(v) : "")}
        />
        {amt > 0 && amt <= balance + 1e-6 && (
          <p
            style={{
              font: "500 11px/1.3 var(--f-sans)",
              color: amt >= balance - 1e-6 ? "var(--ink-soft)" : "var(--warning)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {amt >= balance - 1e-6
              ? "Cobro total · salda la factura."
              : `Abono parcial · quedan $${fmt(balance - amt)} pendientes.`}
          </p>
        )}
      </div>

      <div>
        <label className="studio-label" htmlFor="cob-cash-account">
          Cuenta de caja / banco
        </label>
        {noCashAccounts ? (
          <p
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--warning)",
              margin: "var(--s-1) 0 0",
            }}
          >
            No hay cuentas de caja/banco en el plan de cuentas. Siembra el plan
            en Contabilidad para registrar cobros con asiento.
          </p>
        ) : (
          <select
            id="cob-cash-account"
            className="studio-input"
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
          >
            {cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="studio-label" htmlFor="cob-method">
            Método
          </label>
          <select
            id="cob-method"
            className="studio-input"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="studio-label" htmlFor="cob-date">
            Fecha
          </label>
          <input
            id="cob-date"
            type="date"
            className="studio-input studio-input-mono"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="studio-label" htmlFor="cob-ref">
          Referencia <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
        </label>
        <input
          id="cob-ref"
          type="text"
          className="studio-input"
          placeholder="Nro de transferencia, captura, nota…"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      {/* Pagador (SDD-0068 · decisión #7 — COPY §3). "Yo mismo" = el cliente. */}
      <div>
        <span className="studio-label" id="cob-payer-label">
          ¿Quién realizó el pago?
        </span>
        <div
          role="radiogroup"
          aria-labelledby="cob-payer-label"
          style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "500 12.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="cob-payer-kind"
              checked={payerKind === "cliente"}
              onChange={() => setPayerKind("cliente")}
            />
            Yo mismo (el cliente)
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "500 12.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="cob-payer-kind"
              checked={payerKind === "tercero"}
              onChange={() => setPayerKind("tercero")}
            />
            Un tercero
          </label>
        </div>

        {payerKind === "tercero" && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              <div>
                <label className="studio-label" htmlFor="cob-payer-name">
                  Nombre del pagador
                </label>
                <input
                  id="cob-payer-name"
                  type="text"
                  className="studio-input"
                  placeholder="Nombre y apellido"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                />
              </div>
              <div>
                <label className="studio-label" htmlFor="cob-payer-relation">
                  Relación con el cliente
                </label>
                <select
                  id="cob-payer-relation"
                  className="studio-input"
                  value={payerRelation}
                  onChange={(e) =>
                    setPayerRelation(e.target.value as PayerRelation | "")
                  }
                >
                  <option value="">Elegir…</option>
                  {PAYER_RELATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                font: "500 11.5px/1.5 var(--f-sans)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={licitDeclared}
                onChange={(e) => setLicitDeclared(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                El pagador declaró que los fondos corresponden a la operación y
                son de origen lícito.
                {!licitDeclared && (
                  <span style={{ color: "var(--wine-text)", fontWeight: 600 }}>
                    {" "}
                    · requerido para registrar un pago de tercero
                  </span>
                )}
              </span>
            </label>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Confirmar cobro"
          loadingLabel="Registrando…"
          successLabel="Cobro registrado"
          idleIcon={Icon.check(13)}
          successIcon={Icon.check(13)}
          disabled={!valid}
          onAction={async () => {
            onError("");
            const r = await registerCollection(receivable.invoice.id, {
              amount: amt,
              cashAccountId,
              method,
              receivedAt,
              reference: reference.trim() || null,
              payerKind,
              payerName: payerKind === "tercero" ? payerName.trim() : null,
              payerRelation:
                payerKind === "tercero" && payerRelation ? payerRelation : null,
              licitDeclared: payerKind === "tercero" ? licitDeclared : false,
            });
            if (r.error) return { error: r.error };
            onDone(r.receiptCode, r.fullyPaid ?? amt >= balance - 1e-6);
            return undefined;
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}

/**
 * SDD-0281 · Nota libre de gestión.
 *
 * El botón se queda deshabilitado hasta que hay texto: una gestión vacía en el
 * historial es peor que ninguna — el que la lea mañana no sabrá si hubo
 * contacto o si alguien hizo clic sin querer.
 */
function NoteForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  const limpio = body.trim();

  return (
    <div
      style={{
        marginTop: 8,
        padding: "12px 14px",
        background: "var(--info-bg)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <label className="studio-label" htmlFor="collection-note">
          Nota de gestión
        </label>
        <textarea
          id="collection-note"
          className="studio-input"
          rows={3}
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Qué pasó con esta cobranza…"
          style={{ resize: "vertical", minHeight: 68 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Guardar nota"
          loadingLabel="Guardando…"
          successLabel={null}
          disabled={limpio.length === 0}
          onAction={async () => {
            await onSubmit(limpio);
            return undefined;
          }}
        />
      </div>
    </div>
  );
}

function PromiseForm({
  balance,
  onCancel,
  onError,
  onSubmit,
}: {
  balance: number;
  onCancel: () => void;
  onError: (m: string) => void;
  onSubmit: (
    promisedDate: string,
    promisedAmount: number | null,
  ) => Promise<boolean>;
}) {
  const today = fechaCaracas();
  const [date, setDate] = useState<string>(today);
  const [amount, setAmount] = useState<string>("");

  return (
    <div
      style={{
        marginTop: 8,
        padding: "12px 14px",
        background: "var(--info-bg)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="studio-label" htmlFor="promise-date">
            Fecha comprometida
          </label>
          <input
            id="promise-date"
            type="date"
            className="studio-input studio-input-mono"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="studio-label" htmlFor="promise-amount">
            Monto <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
          </label>
          <NumericInput
            id="promise-amount"
            type="currency"
            currency="USD"
            min={0}
            max={balance}
            placeholder={fmt(balance)}
            value={amount === "" ? null : Number(amount)}
            onChange={(v) => setAmount(v != null ? String(v) : "")}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Confirmar promesa"
          loadingLabel="Guardando…"
          successLabel="Promesa registrada"
          idleIcon={Icon.check(13)}
          disabled={!date}
          onAction={async () => {
            onError("");
            const ok = await onSubmit(
              date,
              amount.trim() ? Number(amount) : null,
            );
            if (!ok) return { error: "No se pudo registrar la promesa." };
            return undefined;
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}

function HistorySection({
  history,
  onRequestVoid,
}: {
  history: {
    receipts: PaymentReceipt[];
    activities: CollectionActivity[];
  } | null;
  onRequestVoid: (receiptId: string, code: string) => void;
}) {
  if (!history) {
    return (
      <p
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Cargando historial…
      </p>
    );
  }

  const { receipts, activities } = history;

  return (
    <>
      {/* Recibos */}
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Recibos · {receipts.length}
        </div>
        {receipts.length === 0 ? (
          <EmptyBox text="Sin cobros registrados todavía." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {receipts.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        font: "700 12px/1.2 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {r.receipt_code}
                    </span>
                    <Badge tone={applicationStatusTone(r.application_status)} size="sm">
                      {applicationStatusLabel(r.application_status)}
                    </Badge>
                    <Badge tone={fundClassTone(r.fund_class)} size="sm">
                      {fundClassLabel(r.fund_class)}
                    </Badge>
                  </div>
                  <div
                    style={{
                      font: "500 10.5px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    {paymentMethodLabel(r.method)} · {r.received_at}
                    {r.reference ? ` · ${r.reference}` : ""}
                    {r.journal_entry_id ? " · asentado" : ""}
                    {r.payer_kind === "tercero" && r.payer_name
                      ? ` · pagó ${r.payer_name} (tercero)`
                      : ""}
                  </div>
                </div>
                <div
                  style={{
                    font: "700 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  ${fmt(r.amount)}
                </div>
                <Link
                  href={`/studio/cobranzas/recibo/${encodeURIComponent(r.receipt_code)}`}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                >
                  Ver recibo
                </Link>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  style={{ color: "var(--danger)" }}
                  onClick={() => onRequestVoid(r.id, r.receipt_code)}
                >
                  Anular
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestiones */}
      <div>
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Bitácora de gestión · {activities.length}
        </div>
        {activities.length === 0 ? (
          <EmptyBox text="Sin gestiones registradas. Usa los botones de arriba para registrar el seguimiento." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {activities.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--wine-tint)",
                    color: "var(--wine-text)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {Icon.flag(13)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {collectionKindLabel(a.kind)}
                    {a.promised_date && (
                      <span style={{ color: "var(--info)" }}>
                        {" · "}
                        {a.promised_date}
                      </span>
                    )}
                  </div>
                  {a.body && (
                    <div
                      style={{
                        font: "500 11px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        marginTop: 2,
                      }}
                    >
                      {a.body}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    font: "500 10px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    flexShrink: 0,
                  }}
                >
                  {a.created_at.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 16,
        textAlign: "center",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--r-md)",
        font: "500 12px/1.5 var(--f-sans)",
        color: "var(--ink-soft)",
      }}
    >
      {text}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono
            ? "600 12.5px/1.3 var(--f-mono)"
            : "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
