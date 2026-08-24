/**
 * SDD-0281 · Estado de cuenta del cliente, del lado del ERP.
 *
 * El botón existía en la ficha del cliente desde SDD-0032, deshabilitado con
 * "Pantalla portada en un SDD futuro". Es la pregunta que más hace un cliente
 * por teléfono —"¿cuánto debo?"— y el asesor la contestaba sumando facturas a
 * mano en el listado.
 *
 * ## No se calcula nada nuevo
 *
 * El ledger sale de `buildStatementLedger`, la MISMA función pura que arma el
 * estado de cuenta del portal (SDD-0177). Es deliberado: si el ERP tuviera su
 * propio cálculo, el asesor y el cliente podrían estar mirando dos saldos
 * distintos de la misma cuenta — que es exactamente la discusión que un estado
 * de cuenta viene a evitar.
 *
 * Vive en `lib/portal/` por historia, no por pertenencia: es pura, recibe filas
 * planas y no toca red ni Supabase. Se importa tal cual en vez de copiarla.
 *
 * ## La forma de la factura
 *
 * El Studio lee `Invoice` (todas las columnas) y el ledger espera
 * `PortalInvoiceRow` (la vista acotada del cliente). Se mapea acá, filtrando
 * borradores y anuladas: el portal ya las excluye en su query
 * (`neq status borrador`), así que la función asume que no llegan. Un borrador
 * colado aparecería como cargo — o sea, deuda inventada.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { getClientByMarkbox } from "@/lib/studio/client-queries";
import { listInvoices } from "@/lib/studio/invoice-queries";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import type { Invoice } from "@/lib/studio/invoice-types";

export const metadata: Metadata = { title: "Estado de cuenta" };

/**
 * `Invoice` (Studio) → `PortalInvoiceRow` (lo que el ledger necesita).
 *
 * Se descartan borradores y anuladas: una factura en borrador no es deuda, y
 * una anulada dejó de serlo. Meterlas inflaría el saldo que el asesor le lee al
 * cliente por teléfono.
 */
export function filasParaLedger(invoices: Invoice[]): PortalInvoiceRow[] {
  return invoices
    .filter((i) => i.status !== "borrador" && i.status !== "anulada")
    .map((i) => ({
      id: i.id,
      code: i.invoice_code,
      status: i.status,
      currency: i.currency,
      total: i.total_amount,
      paid: i.paid_amount,
      issuedAt: i.issued_at,
      dueDate: i.due_date,
      shipmentCode: i.shipment_code,
    }));
}

function monto(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function EstadoDeCuentaPage({
  params,
}: {
  params: Promise<{ markbox: string }>;
}) {
  await requireModuleView("invoices");

  const { markbox: raw } = await params;
  const markbox = decodeURIComponent(raw);

  const supabase = await createClient();
  const client = await getClientByMarkbox(supabase, markbox);
  if (!client) notFound();

  const invoices = await listInvoices(supabase, { clientMarkbox: markbox });
  const ledger = buildStatementLedger(filasParaLedger(invoices));

  return (
    <div style={{ maxWidth: 1080 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/studio/clientes/${encodeURIComponent(markbox)}`}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          ← Volver a la ficha
        </Link>
        {/* SDD-0287 · el papel que se le manda al cliente cuando pregunta
            cuánto debe. Sale del MISMO ledger que esta pantalla. */}
        <a
          href={`/studio/clientes/${encodeURIComponent(markbox)}/estado-de-cuenta/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          title="Abre el estado de cuenta en PDF"
        >
          PDF
        </a>
      </div>

      <span className="studio-eyebrow">Estado de cuenta</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 4px", color: "var(--ink)" }}
      >
        {client.name}
      </h1>
      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 24px",
        }}
      >
        <span className="studio-input-mono" style={{ padding: 0, border: 0 }}>
          {client.markbox}
        </span>{" "}
        · el MISMO cálculo que ve el cliente en su portal.
      </p>

      {/* Totales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Total label="Facturado" value={monto(ledger.totalCargo, ledger.currency)} />
        <Total label="Abonado" value={monto(ledger.totalAbono, ledger.currency)} />
        <Total
          label="Saldo"
          value={monto(ledger.balance, ledger.currency)}
          destacado
          tono={ledger.balance > 0 ? "danger" : "success"}
        />
      </div>

      {/* La mezcla de monedas se DICE. Un saldo corrido que suma USD con VES es
          peor que no mostrarlo, y el asesor tiene que saber que está leyendo
          sólo una parte de la cuenta. */}
      {ledger.mixedCurrencies ? (
        <p
          role="note"
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-sm)",
            padding: "10px 12px",
            margin: "0 0 20px",
          }}
        >
          Este cliente tiene facturas en más de una moneda. Acá sólo se muestran
          las de {ledger.currency}; el resto queda fuera del saldo corrido.
        </p>
      ) : null}

      {ledger.moves.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 28,
            font: "400 14px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Este cliente todavía no tiene facturas emitidas.
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <caption className="studio-eyebrow" style={{ padding: "14px 16px", textAlign: "left" }}>
              Movimientos · {ledger.moves.length}
            </caption>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Envío</Th>
                <Th alineado="right">Cargo</Th>
                <Th alineado="right">Abono</Th>
                <Th alineado="right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.moves.map((m, i) => (
                <tr key={`${m.concept}-${i}`}>
                  <Td mono>{m.date ?? "—"}</Td>
                  <Td>{m.concept}</Td>
                  <Td mono>{m.reference ?? "—"}</Td>
                  <Td alineado="right" mono>
                    {m.kind === "cargo" ? monto(m.amount, ledger.currency) : ""}
                  </Td>
                  <Td alineado="right" mono>
                    {m.kind === "abono" ? monto(m.amount, ledger.currency) : ""}
                  </Td>
                  <Td alineado="right" mono fuerte>
                    {monto(m.balance, ledger.currency)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* La misma nota al pie que lleva el portal: si algún día cambia el
          criterio de la fecha del abono, se va con él en los dos lados. */}
      {ledger.moves.some((m) => m.kind === "abono") ? (
        <p
          style={{
            font: "400 12px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "12px 0 0",
            maxWidth: "70ch",
          }}
        >
          La fecha del abono es la de vencimiento de su factura, no la del pago:
          el modelo guarda cuánto se pagó, no cuándo. Un abono puede aparecer con
          fecha futura si su factura todavía no vence.
        </p>
      ) : null}
    </div>
  );
}

function Total({
  label,
  value,
  destacado = false,
  tono,
}: {
  label: string;
  value: string;
  destacado?: boolean;
  tono?: "danger" | "success";
}) {
  return (
    <div
      style={{
        background: destacado && tono ? `var(--${tono}-bg)` : "var(--bg-surface)",
        border: `1px solid ${destacado && tono ? `var(--${tono})` : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ font: "900 22px/1 var(--f-display)", color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  alineado = "left",
}: {
  children: React.ReactNode;
  alineado?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      style={{
        font: "700 9.5px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        textAlign: alineado,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  alineado = "left",
  mono = false,
  fuerte = false,
}: {
  children: React.ReactNode;
  alineado?: "left" | "right";
  mono?: boolean;
  fuerte?: boolean;
}) {
  return (
    <td
      style={{
        font: `${fuerte ? 600 : 400} 13px/1.4 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
        color: "var(--ink)",
        textAlign: alineado,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
