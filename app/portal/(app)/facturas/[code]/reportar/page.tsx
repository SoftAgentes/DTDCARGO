import type { Metadata } from "next";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getMyInvoice } from "@/lib/portal/portal-queries";
import { formatInvoiceAmount, invoiceBalance } from "@/lib/portal/portal-types";
import { ArrowIcon } from "@/components/Icon";
import { PaymentReportForm } from "./PaymentReportForm";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Reportar pago · ${decodeURIComponent(code)}` };
}

/**
 * Página "Reportar pago" del portal (SDD-0134 · Slice A). Verifica por SESIÓN que
 * la factura sea del cliente y esté abierta; si no, redirige al detalle/lista.
 * Render: resumen del saldo + PaymentReportForm.
 */
export default async function ReportPaymentPage({ params }: Props) {
  const todayIso = fechaCaracas();
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const inv = await getMyInvoice(supabase, code);
  if (!inv) redirect("/portal/facturas");

  // Factura ya cerrada → no tiene sentido reportar; vuelve al detalle.
  if (inv.status === "pagada" || inv.status === "anulada") {
    redirect(`/portal/facturas/${encodeURIComponent(code)}`);
  }

  const balance = invoiceBalance({ total_amount: inv.total, paid_amount: inv.paid });

  return (
    <div>
      <Link
        href={`/portal/facturas/${encodeURIComponent(code)}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a la factura
      </Link>

      <div className="mt-5">
        <span className="eyebrow">Reportar pago</span>
        <h1
          className="mt-2 text-[28px] sm:text-[36px] leading-none text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
        >
          {inv.code}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
        <PaymentReportForm
          invoiceCode={inv.code}
          currency={inv.currency}
          todayIso={todayIso}
        />

        {/* Resumen del saldo */}
        <aside className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Esta factura
          </h2>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13.5px] text-grey-700">Total</dt>
              <dd
                className="text-[14.5px] font-semibold text-ink whitespace-nowrap"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {formatInvoiceAmount(inv.total, inv.currency)}
              </dd>
            </div>
            {inv.paid > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[13.5px] text-grey-700">Pagado</dt>
                <dd
                  className="text-[14.5px] font-semibold text-ink whitespace-nowrap"
                  style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                >
                  {formatInvoiceAmount(inv.paid, inv.currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-grey-200">
              <dt className="text-[13.5px] font-bold text-ink">Saldo pendiente</dt>
              <dd
                className="text-[15px] font-extrabold text-wine-text whitespace-nowrap"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {formatInvoiceAmount(balance, inv.currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-[12.5px] text-grey-600 leading-[1.55]">
            Puedes reportar un abono parcial o el total. Tu asesor confirma cada
            reporte tras revisar el comprobante.
          </p>
        </aside>
      </div>
    </div>
  );
}
