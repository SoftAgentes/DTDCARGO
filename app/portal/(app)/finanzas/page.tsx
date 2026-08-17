import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  listMyInvoices,
  listMyShipments,
  listMyEstimates,
  getPortalClient,
} from "@/lib/portal/portal-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  formatInvoiceAmount,
  invoiceBalance,
  isActiveShipmentStatus,
  type InvoiceCurrency,
  type PortalShipmentRow,
  type PortalEstimateRow,
} from "@/lib/portal/portal-types";
import { showNortePortal } from "@/lib/portal/demo";
import { ArrowIcon, DocIcon, QuoteIcon } from "@/components/Icon";
import { InvoiceRow } from "../../_components/InvoiceRow";
import { InvoiceCycleCard } from "../facturas/_components/InvoiceCycleCard";

export const metadata: Metadata = { title: "Finanzas" };

/**
 * Finanzas del portal (founder 2026-06-20). La gente entra por sus FACTURAS, así
 * que la vista principal ES el estado de cuenta (KPIs de saldo + lista de
 * facturas), directo, sin desplegar ni pestañas. Arriba van dos accesos chicos a
 * las secciones secundarias: Estimados (→ /portal/estimados) y Cotizaciones
 * (→ /portal/cotizaciones). El detalle/tabla densa sigue en /portal/facturas;
 * las filas de acá linkean a cada factura.
 */
export default async function PortalFinanzasPage() {
  const supabase = await createClient();
  // Card "ciclo" del Norte GATEADA al demo: necesita estimados + envíos (sólo se
  // cargan para el demo; clientes reales: misma página, sin queries extra).
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

  // KPIs en la moneda DOMINANTE (sumar entre monedas sería incorrecto; mismo
  // criterio que /portal/facturas).
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
      <span className="eyebrow">Tu dinero</span>
      <h1
        className="mt-2 text-[30px] sm:text-[36px] leading-none text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        Finanzas
      </h1>
      <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
        Tus facturas y saldos. Estimados y cotizaciones, a un clic.
      </p>

      {/* Accesos secundarios — Estimados (lead/calculadora) + Cotizaciones (formal) */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <AccesoChip href="/portal/estimados" icon={<DocIcon size={16} />} label="Estimados" />
        <AccesoChip href="/portal/cotizaciones" icon={<QuoteIcon size={15} />} label="Cotizaciones" />
      </div>

      {/* Card "ciclo" del Norte — GATEADA al demo (clientes reales no la ven). */}
      {demo ? (
        <InvoiceCycleCard
          estimatesCount={estimates.length}
          approvedCount={approvedCount}
          invoicesCount={invoices.length}
          invoicedLabel={formatInvoiceAmount(agg.total, primary)}
        />
      ) : null}

      {/* Facturas — la vista principal (estado de cuenta) */}
      {invoices.length === 0 ? (
        <div className="mt-7 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no tienes facturas.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Cuando tu asesor emita una factura a tu nombre, aparece acá con su
            estado de pago.
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
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div className="mt-6 flex flex-col gap-3">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>

          <Link
            href="/portal/facturas"
            className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wine-text hover:underline underline-offset-2"
          >
            Ver tabla completa <ArrowIcon size={13} />
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * Acceso chico (pill) a una sección secundaria de Finanzas. Link si tiene `href`;
 * si `soon`, queda estático con la etiqueta "Próximamente".
 */
function AccesoChip({
  href,
  icon,
  label,
  soon = false,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  soon?: boolean;
}) {
  const inner = (
    <>
      <span className="text-wine-text flex-shrink-0">{icon}</span>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {soon && (
        <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-grey-500 bg-grey-100 rounded-full px-1.5 py-0.5">
          Próximamente
        </span>
      )}
    </>
  );
  const base =
    "inline-flex items-center gap-2 rounded-full border border-grey-200 bg-white px-3.5 py-2";

  if (soon || !href) {
    return <span className={`${base} opacity-70`}>{inner}</span>;
  }
  return (
    <Link
      href={href}
      className={`${base} hover:border-ink focus-visible:border-ink transition-colors`}
    >
      {inner}
    </Link>
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
          // Saldo con deuda → dorado (--warning). Wine se reserva a CTAs/marca.
          color: highlight ? "var(--color-status-warning)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
