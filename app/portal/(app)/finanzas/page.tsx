import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon, DocIcon, PaymentIcon, QuoteIcon } from "@/components/Icon";

export const metadata: Metadata = { title: "Finanzas" };

/**
 * Hub de Finanzas del portal (founder 2026-06-20): agrupa Estimados, Facturas y
 * Cotizaciones formales en un solo lugar. "Estimados" y "Facturas" salieron del
 * nav top-level (PortalNav) y se acceden desde acá. "Cotizaciones formales" aún no
 * existe como feature → tarjeta "Próximamente" (mismo criterio que el botón "Nueva
 * cotización" del dashboard). Las rutas /portal/estimados y /portal/facturas siguen
 * existiendo; esta página es el punto de entrada agrupado.
 */
export default function PortalFinanzasPage() {
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

      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <FinanzaCard
          href="/portal/estimados"
          icon={<DocIcon size={24} />}
          title="Estimados"
          desc="Los estimados que sacaste con la calculadora web."
        />
        <FinanzaCard
          href="/portal/facturas"
          icon={<PaymentIcon size={24} />}
          title="Facturas"
          desc="Tus facturas, montos y saldos pendientes."
        />
        <FinanzaCard
          icon={<QuoteIcon size={24} />}
          title="Cotizaciones"
          desc="Cotizaciones formales que te arma tu asesor."
          soon
        />
      </div>
    </div>
  );
}

/**
 * Tarjeta de sección del hub. Clickeable (Link) si tiene `href`; si `soon`, queda
 * estática con la etiqueta "Próximamente" (la feature aún no existe).
 */
function FinanzaCard({
  href,
  icon,
  title,
  desc,
  soon = false,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  soon?: boolean;
}) {
  const body = (
    <>
      <div className="w-10 h-10 rounded-[12px] bg-paper grid place-items-center text-wine">
        {icon}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[16px] font-bold text-ink">{title}</span>
        {soon && (
          <span className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
            Próximamente
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.5]">{desc}</p>
      {!soon && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-wine">
          Ver {title.toLowerCase()} <ArrowIcon size={14} />
        </span>
      )}
    </>
  );

  if (soon || !href) {
    return (
      <div className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-6 opacity-75">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="card-link group bg-white border border-grey-200 rounded-[18px] p-6 hover:border-ink focus-visible:border-ink transition-colors block"
    >
      {body}
    </Link>
  );
}
