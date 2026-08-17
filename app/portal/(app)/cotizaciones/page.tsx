import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { listMyCotizaciones } from "@/lib/portal/portal-queries";
import { ArrowIcon } from "@/components/Icon";
import { CotizacionRow } from "../../_components/CotizacionRow";

export const metadata: Metadata = { title: "Cotizaciones" };

/**
 * "Cotizaciones" del portal (Norte · split estimado/cotización). Lo FORMAL: lo que
 * pediste desde el portal o lo que te armó un asesor (`quotes.source != 'web'`),
 * ligado a tu MARKBOX. La etapa lead (calculadora) vive en /portal/estimados.
 */
export default async function PortalCotizacionesPage() {
  const supabase = await createClient();
  const cotizaciones = await listMyCotizaciones(supabase);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="eyebrow">Tu cuenta</span>
          <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
            Cotizaciones.
          </h1>
          <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
            El precio formal que te arma tu asesor. Pídele uno nuevo cuando ya
            sepas qué vas a traer.
          </p>
        </div>
        <Link
          href="/portal/cotizaciones/nueva"
          className="btn btn-primary inline-flex items-center gap-1.5 flex-shrink-0"
        >
          Nueva cotización <ArrowIcon size={15} />
        </Link>
      </div>

      {cotizaciones.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no tienes cotizaciones.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[48ch] mx-auto leading-[1.55]">
            Cuando quieras un precio formal para una carga puntual, pídelo acá y tu
            asesor te lo arma. ¿Solo quieres un cálculo rápido? Usa la{" "}
            <Link href="/portal/estimados" className="text-wine-text font-semibold hover:underline">
              calculadora de estimados
            </Link>
            .
          </p>
          <Link
            href="/portal/cotizaciones/nueva"
            className="btn btn-primary mt-6 inline-flex items-center gap-1.5"
          >
            Pedir una cotización <ArrowIcon size={15} />
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {cotizaciones.map((c) => (
            <CotizacionRow key={c.id} cotizacion={c} />
          ))}
        </div>
      )}
    </div>
  );
}
