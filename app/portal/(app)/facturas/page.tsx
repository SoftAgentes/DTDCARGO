import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  listMyInvoices,
  listMyShipments,
  listMyEstimates,
  getPortalClient,
} from "@/lib/portal/portal-queries";
import {
  formatInvoiceAmount,
  invoiceBalance,
  isActiveShipmentStatus,
  type InvoiceCurrency,
  type PortalInvoiceRow,
  type PortalShipmentRow,
  type PortalEstimateRow,
} from "@/lib/portal/portal-types";
import { showNortePortal } from "@/lib/portal/demo";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { InvoiceRow } from "../../_components/InvoiceRow";
import { InvoiceStatusBadge } from "../../_components/InvoiceStatusBadge";
import { InvoiceCycleCard } from "./_components/InvoiceCycleCard";

export const metadata: Metadata = { title: "Mis facturas" };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

/**
 * "Mis facturas" (SDD-0042 Fase 3 · alineado al Norte `PortalInvoices`):
 * fila de KPIs (Total facturado / Pagado / Pendiente) + tabla densa. Como las
 * facturas pueden estar en distintas monedas y sumar entre monedas sería
 * incorrecto, los KPIs de monto se calculan en la moneda DOMINANTE (la mayoría
 * de los clientes factura en una sola); si hay varias, se avisa. En desktop es
 * una tabla; en mobile cae a las cards `InvoiceRow`. Cada fila linkea al detalle.
 */
export default async function PortalInvoicesPage() {
  const supabase = await createClient();
  // Rediseño Norte (founder 2026-06-20) GATEADO al demo: la card "ciclo"
  // (Estimado→Aprobado→Facturado) necesita estimados + envíos; sólo se cargan para
  // el demo (clientes reales: misma página, sin queries extra).
  const client = await getPortalClient(supabase);
  const demo = showNortePortal(client?.markbox);
  const [invoices, shipments, estimates] = await Promise.all([
    listMyInvoices(supabase),
    demo ? listMyShipments(supabase) : Promise.resolve<PortalShipmentRow[]>([]),
    demo ? listMyEstimates(supabase) : Promise.resolve<PortalEstimateRow[]>([]),
  ]);
  const approvedCount = shipments.filter((s) =>
    isActiveShipmentStatus(s.status),
  ).length;
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y tengo una consulta sobre mis facturas.",
  );

  // ── KPIs por moneda dominante ──
  const byCurrency = new Map<
    InvoiceCurrency,
    { total: number; paid: number; balance: number }
  >();
  for (const inv of invoices) {
    const e = byCurrency.get(inv.currency) ?? { total: 0, paid: 0, balance: 0 };
    e.total += inv.total;
    e.paid += inv.paid;
    e.balance += invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid });
    byCurrency.set(inv.currency, e);
  }
  const currencies = [...byCurrency.keys()];
  const primary =
    currencies
      .slice()
      .sort((a, b) => (byCurrency.get(b)?.total ?? 0) - (byCurrency.get(a)?.total ?? 0))[0] ??
    "USD";
  const agg = byCurrency.get(primary) ?? { total: 0, paid: 0, balance: 0 };
  const mixed = currencies.length > 1;

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Mis facturas.
      </h1>
      <p className="lead mt-3">
        Tu estado de cuenta y comprobantes. Al pagar, entra a la factura y
        <span className="whitespace-nowrap"> reporta tu pago</span> con el
        comprobante — tu asesor lo confirma.
      </p>

      {/* Card "ciclo" del Norte — GATEADA al demo (clientes reales no la ven). */}
      {demo ? (
        <InvoiceCycleCard
          estimatesCount={estimates.length}
          approvedCount={approvedCount}
          invoicesCount={invoices.length}
          invoicedLabel={formatInvoiceAmount(agg.total, primary)}
        />
      ) : null}

      {invoices.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no tienes facturas.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Cuando tu asesor emita una factura a tu nombre, va a aparecer acá con
            su estado de pago.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-6 inline-flex"
          >
            Escribir a mi asesor <ArrowIcon />
          </a>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Total facturado" value={formatInvoiceAmount(agg.total, primary)} />
            <Kpi label="Pagado" value={formatInvoiceAmount(agg.paid, primary)} />
            <Kpi
              label="Saldo pendiente"
              value={formatInvoiceAmount(agg.balance, primary)}
              highlight={agg.balance > 0}
            />
          </div>
          {mixed && (
            <p className="mt-3 text-[12px] text-grey-500">
              Montos en {primary}. Tienes facturas en otras monedas — abre cada una
              para ver su detalle.
            </p>
          )}

          {/* Mobile: cards */}
          <div className="mt-6 flex flex-col gap-3 sm:hidden">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="mt-6 hidden sm:block card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden">
            <div className="grid grid-cols-[112px_1fr_96px_96px_112px_120px_44px] items-center gap-3 px-5 py-3 bg-paper border-b border-grey-200">
              {["Factura", "Envío", "Emitida", "Vence", "Monto", "Estado", ""].map((h, i) => (
                <span
                  key={h || "act"}
                  className={`text-[10.5px] font-bold tracking-[0.1em] uppercase text-grey-500 ${i === 4 ? "text-right" : ""}`}
                >
                  {h}
                </span>
              ))}
            </div>
            {invoices.map((inv) => (
              <TableRow key={inv.id} inv={inv} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </div>
      <div
        className="mt-2 text-[26px] leading-none text-ink"
        style={{
          fontFamily: "var(--font-archivo-black)",
          letterSpacing: "-0.01em",
          // Saldo pendiente con deuda → dorado (--warning, "atención"). Wine se
          // reserva para CTAs/marca, no para estados (regla del Norte).
          color: highlight ? "var(--color-status-warning)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableRow({ inv }: { inv: PortalInvoiceRow }) {
  return (
    <Link
      href={`/portal/facturas/${encodeURIComponent(inv.code)}`}
      className="group grid grid-cols-[112px_1fr_96px_96px_112px_120px_44px] items-center gap-3 px-5 py-3.5 border-b border-grey-200 last:border-0 hover:bg-paper focus-visible:bg-paper transition-colors"
      aria-label={`Ver detalle de la factura ${inv.code}`}
    >
      <code
        className="text-[13px] font-bold text-ink"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {inv.code}
      </code>
      <code
        className="text-[12.5px] text-grey-500 truncate"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {inv.shipmentCode ?? "—"}
      </code>
      <span
        className="text-[12px] text-grey-500"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatDate(inv.issuedAt)}
      </span>
      <span
        className="text-[12px] text-grey-700"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatDate(inv.dueDate)}
      </span>
      <span
        className="text-[13px] font-bold text-ink text-right"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatInvoiceAmount(inv.total, inv.currency)}
      </span>
      <div className="flex justify-start">
        <InvoiceStatusBadge status={inv.status} dueDate={inv.dueDate} />
      </div>
      <div className="flex justify-end">
        <ArrowIcon
          size={16}
          className="text-grey-300 group-hover:text-wine transition-colors"
        />
      </div>
    </Link>
  );
}
