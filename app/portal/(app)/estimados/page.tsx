import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { listMyEstimates } from "@/lib/portal/portal-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { EstimateRow } from "../../_components/EstimateRow";

export const metadata: Metadata = { title: "Estimados" };

/**
 * "Estimados" (SDD-0061 · portal read-only). Lista los estimados ligados al
 * MARKBOX del cliente: los que generó en la calculadora pública (ya vinculados a
 * su cuenta) y los que le armó un asesor. La confirmación/conversión la maneja el
 * asesor → cada estimado trae un CTA "Pedir que lo confirmen" a WhatsApp.
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
        Los cálculos que hiciste en la calculadora y los que armó tu asesor. Cuando
        quieras confirmar uno, escríbele a tu asesor y lo convertimos en tu envío.
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
