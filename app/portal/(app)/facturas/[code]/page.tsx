import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getMyInvoice } from "@/lib/portal/portal-queries";
import { listMyInvoiceReports } from "@/lib/portal/payment-report-queries";
import { formatInvoiceAmount, invoiceBalance } from "@/lib/portal/portal-types";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { InvoiceStatusBadge } from "../../../_components/InvoiceStatusBadge";
import { InvoicePaymentReports } from "./_components/InvoicePaymentReports";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Factura ${decodeURIComponent(code)}` };
}

export default async function PortalInvoiceDetailPage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const inv = await getMyInvoice(supabase, code);
  // La RLS + el filtro por markbox sólo devuelven facturas del cliente logueado;
  // si no hay match (ajena, borrador o inexistente) → 404.
  if (!inv) notFound();

  const balance = invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid });
  const ivaOn = inv.ivaRate > 0;
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, tengo una consulta sobre mi factura ${inv.code}.`,
  );

  // Reportes de pago del cliente sobre esta factura (SDD-0134) + si puede reportar
  // uno nuevo (saldo abierto y factura no cerrada).
  const reports = await listMyInvoiceReports(supabase, code);
  const canReport =
    balance > 0 && inv.status !== "pagada" && inv.status !== "anulada";

  return (
    <div>
      <Link
        href="/portal/facturas"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis facturas
      </Link>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="eyebrow">Detalle de la factura</span>
          <div
            className="mt-2 text-[30px] sm:text-[40px] leading-none text-ink"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            {inv.code}
          </div>
        </div>
        <InvoiceStatusBadge status={inv.status} dueDate={inv.dueDate} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-start">
        {/* Conceptos + totales */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Conceptos
          </h2>

          <div className="mt-5 flex flex-col divide-y divide-grey-200">
            {inv.lines.length === 0 ? (
              <p className="text-[14px] text-grey-500">Sin conceptos cargados.</p>
            ) : (
              inv.lines.map((line, i) => {
                const subtotal =
                  (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <div
                    key={`${inv.code}-${i}`}
                    className="py-3 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold text-ink">
                        {line.desc}
                      </div>
                      <div
                        className="text-[12.5px] text-grey-500"
                        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                      >
                        {line.qty} × {formatInvoiceAmount(line.unitPrice, inv.currency)}
                      </div>
                    </div>
                    <div
                      className="text-[14.5px] font-semibold text-ink whitespace-nowrap"
                      style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                    >
                      {formatInvoiceAmount(subtotal, inv.currency)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <dl className="mt-6 pt-5 border-t border-grey-200 flex flex-col gap-2.5">
            <TotalRow label="Subtotal" value={formatInvoiceAmount(inv.base, inv.currency)} />
            {ivaOn ? (
              <TotalRow
                label={`IVA (${inv.ivaRate.toFixed(0)}%)`}
                value={formatInvoiceAmount(inv.ivaAmount, inv.currency)}
              />
            ) : null}
            <TotalRow
              label="Total"
              value={formatInvoiceAmount(inv.total, inv.currency)}
              strong
            />
            {inv.paid > 0 ? (
              <TotalRow label="Pagado" value={formatInvoiceAmount(inv.paid, inv.currency)} />
            ) : null}
            {balance > 0 ? (
              <TotalRow
                label="Saldo pendiente"
                value={formatInvoiceAmount(balance, inv.currency)}
                highlight
              />
            ) : null}
          </dl>

          {inv.notes ? (
            <div className="mt-6 pt-5 border-t border-grey-200">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                Notas
              </div>
              <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
                {inv.notes}
              </p>
            </div>
          ) : null}
        </div>

        {/* Resumen / pago + CTA */}
        <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Resumen
          </h2>
          <dl className="mt-5 flex flex-col gap-4">
            {inv.issuedAt ? <Field label="Emitida" value={formatDate(inv.issuedAt)} /> : null}
            {inv.dueDate ? <Field label="Vence" value={formatDate(inv.dueDate)} /> : null}
            <Field label="Moneda" value={inv.currency} mono />
            {inv.currency === "VES" && inv.fxRate ? (
              <Field label="Tasa (BCV)" value={inv.fxRate.toFixed(2)} mono />
            ) : null}
            {inv.shipmentCode ? (
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                  Envío asociado
                </dt>
                <dd>
                  <Link
                    href={`/portal/envios/${encodeURIComponent(inv.shipmentCode)}`}
                    className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-wine hover:underline"
                    style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                  >
                    {inv.shipmentCode} <ArrowIcon size={14} />
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-8 pt-6 border-t border-grey-200">
            {canReport ? (
              <Link
                href={`/portal/facturas/${encodeURIComponent(inv.code)}/reportar`}
                className="btn btn-primary w-full justify-center"
              >
                Reportar pago
              </Link>
            ) : null}
            <Link
              href={`/portal/facturas/${encodeURIComponent(inv.code)}/comprobante`}
              className={`btn w-full justify-center ${canReport ? "btn-ghost mt-3" : "btn-primary"}`}
            >
              Ver / Imprimir comprobante
            </Link>
            <p className="mt-4 text-[13.5px] text-grey-700 leading-[1.55]">
              {canReport
                ? "¿Ya pagaste? Repórtalo con tu comprobante y tu asesor lo confirma. También puedes abrir el comprobante de la factura y guardarlo como PDF."
                : "Abre el comprobante y guárdalo como PDF desde el diálogo de impresión."}
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-4 inline-flex items-center gap-2"
            >
              <WhatsAppIcon size={18} /> Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>

      {reports.length > 0 ? (
        <div className="mt-6">
          <InvoicePaymentReports invoiceCode={inv.code} reports={reports} />
        </div>
      ) : null}
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  highlight = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt
        className={`text-[13.5px] ${
          strong || highlight ? "font-bold text-ink" : "text-grey-700"
        }`}
      >
        {label}
      </dt>
      <dd
        className={`text-[14.5px] whitespace-nowrap ${
          highlight
            ? "font-extrabold text-wine"
            : strong
              ? "font-extrabold text-ink"
              : "font-semibold text-ink"
        }`}
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className="text-[15.5px] font-semibold text-ink"
        style={
          mono
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
