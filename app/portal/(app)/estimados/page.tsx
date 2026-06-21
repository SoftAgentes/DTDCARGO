import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { listMyEstimates } from "@/lib/portal/portal-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { EstimateRow } from "../../_components/EstimateRow";

export const metadata: Metadata = { title: "Estimados" };

/**
 * "Estimados" (SDD-0061 · portal read-only · split Norte). Lista los estimados LEAD
 * del cliente — los que generó en la calculadora pública (`source='web'`). Cada uno
 * trae un CTA "Avanzar a cotización" que lo formaliza (pasa a la pista formal, ver
 * /portal/cotizaciones). Lo formal/asesor vive en /portal/cotizaciones.
 */
export default async function PortalEstimatesPage() {
  const supabase = await createClient();
  const estimates = await listMyEstimates(supabase);
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y quiero hacer un estimado nuevo.",
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Estimados.
      </h1>
      <p className="lead mt-3">
        Los cálculos rápidos que hiciste en la calculadora. Cuando quieras un precio
        formal para una carga puntual, pide una{" "}
        <Link
          href="/portal/cotizaciones"
          className="text-wine font-semibold hover:underline"
        >
          cotización
        </Link>
        .
      </p>

      {estimates.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no tienes estimados.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Calcula tu carga en la calculadora o pídele un estimado a tu asesor.
            Cuando quede vinculado a tu cuenta, va a aparecer acá.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="/calculadora" className="btn btn-primary inline-flex">
              Ir a la calculadora <ArrowIcon />
            </a>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost inline-flex"
            >
              Pedir un estimado
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {estimates.map((e) => (
            <EstimateRow key={e.id} estimate={e} />
          ))}
        </div>
      )}
    </div>
  );
}
