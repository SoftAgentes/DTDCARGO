import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { listMyEstimates, listMyInvoices } from "@/lib/portal/portal-queries";
import {
  formatInvoiceAmount,
  invoiceBalance,
  type InvoiceCurrency,
} from "@/lib/portal/portal-types";
import { ArrowIcon, DocIcon, PaymentIcon, QuoteIcon } from "@/components/Icon";
import { EstimateRow } from "../../_components/EstimateRow";
import { InvoiceRow } from "../../_components/InvoiceRow";
import { FinanzaSection } from "./FinanzaSection";

export const metadata: Metadata = { title: "Finanzas" };

/**
 * Hub de Finanzas del portal (founder 2026-06-20). Acordeón con 3 secciones en
 * orden de ciclo: Estimados → Cotizaciones → Facturas. Facturas nace ABIERTA por
 * defecto (es el estado de cuenta — lo que el cliente debe). El contenido es el
 * REAL: reusa las queries (listMyEstimates/listMyInvoices) y las filas
 * (EstimateRow/InvoiceRow) de /portal/estimados y /portal/facturas, que siguen
 * existiendo (con su tabla densa). "Cotizaciones formales" aún no existe →
 * "Próximamente" (mismo criterio que "Nueva cotización" del dashboard).
 */
export default async function PortalFinanzasPage() {
  const supabase = await createClient();
  const [estimates, invoices] = await Promise.all([
    listMyEstimates(supabase),
    listMyInvoices(supabase),
  ]);

  // KPIs de facturas en la moneda DOMINANTE (sumar entre monedas sería incorrecto;
  // mismo criterio que /portal/facturas).
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
        Tus estimados y facturas en un solo lugar. Las cotizaciones formales
        llegan pronto.
      </p>

      <div className="mt-7 flex flex-col gap-4">
        {/* 1. Estimados */}
        <FinanzaSection
          title="Estimados"
          icon={<DocIcon size={22} />}
          summary={
            estimates.length === 0
              ? "Sin estimados todavía"
              : `${estimates.length} ${estimates.length === 1 ? "estimado" : "estimados"}`
          }
        >
          {estimates.length === 0 ? (
            <EmptyMini
              text="Calcula tu carga en la calculadora o pídele un estimado a tu asesor. Cuando quede vinculado a tu cuenta, aparece acá."
              href="/calculadora"
              cta="Ir a la calculadora"
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {estimates.map((e) => (
                  <EstimateRow key={e.id} estimate={e} />
                ))}
              </div>
              <FullLink href="/portal/estimados" label="Ver estimados en pantalla completa" />
            </>
          )}
        </FinanzaSection>

        {/* 2. Cotizaciones (próximamente) */}
        <FinanzaSection
          title="Cotizaciones"
          icon={<QuoteIcon size={20} />}
          summary="Cotizaciones formales de tu asesor"
          badge={
            <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
              Próximamente
            </span>
          }
        >
          <p className="text-[13px] text-grey-700 leading-[1.55] max-w-[52ch]">
            Pronto vas a ver acá las cotizaciones formales que te arme tu asesor —
            con su validez, condiciones y un botón para confirmarlas.
          </p>
        </FinanzaSection>

        {/* 3. Facturas (abierta por defecto — estado de cuenta) */}
        <FinanzaSection
          title="Facturas"
          icon={<PaymentIcon size={22} />}
          defaultOpen
          summary={
            invoices.length === 0 ? (
              "Sin facturas todavía"
            ) : agg.balance > 0 ? (
              <span
                className="font-semibold"
                style={{ color: "var(--color-status-warning)" }}
              >
                Saldo pendiente {formatInvoiceAmount(agg.balance, primary)}
              </span>
            ) : (
              "Al día · sin saldo pendiente"
            )
          }
        >
          {invoices.length === 0 ? (
            <EmptyMini text="Cuando tu asesor emita una factura a tu nombre, aparece acá con su estado de pago." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniKpi label="Total facturado" value={formatInvoiceAmount(agg.total, primary)} />
                <MiniKpi label="Pagado" value={formatInvoiceAmount(agg.paid, primary)} />
                <MiniKpi
                  label="Saldo pendiente"
                  value={formatInvoiceAmount(agg.balance, primary)}
                  highlight={agg.balance > 0}
                />
              </div>
              {mixed && (
                <p className="mt-2.5 text-[11.5px] text-grey-500 leading-[1.4]">
                  Montos en {primary}. Tienes facturas en otras monedas — abre cada
                  una para ver su detalle.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-3">
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
              <FullLink href="/portal/facturas" label="Ver facturas en pantalla completa" />
            </>
          )}
        </FinanzaSection>
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[12px] bg-paper px-4 py-3">
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </div>
      <div
        className="mt-1 text-[18px] leading-none text-ink"
        style={{
          fontFamily: "var(--font-archivo-black)",
          letterSpacing: "-0.01em",
          color: highlight ? "var(--color-status-warning)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FullLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wine hover:underline underline-offset-2"
    >
      {label} <ArrowIcon size={13} />
    </Link>
  );
}

function EmptyMini({
  text,
  href,
  cta,
}: {
  text: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="text-center py-4">
      <p className="text-[13px] text-grey-700 leading-[1.55] max-w-[46ch] mx-auto">
        {text}
      </p>
      {href && cta && (
        <a href={href} className="btn btn-ghost mt-4 inline-flex">
          {cta} <ArrowIcon size={14} />
        </a>
      )}
    </div>
  );
}
