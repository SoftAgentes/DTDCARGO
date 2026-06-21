import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { ArrowIcon } from "@/components/Icon";
import { CotizacionRequestForm } from "../CotizacionRequestForm";

export const metadata: Metadata = { title: "Nueva cotización" };

/**
 * "Nueva cotización" del portal (Norte). El cliente registrado pide que le coticen
 * un servicio (se brinca la etapa de estimado). El destino se prellena con su
 * ciudad de entrega si la tiene cargada.
 */
export default async function NuevaCotizacionPage() {
  const supabase = await createClient();
  // El layout ya garantiza sesión de portal; esto sólo resuelve el default de destino.
  const client = await getPortalClient(supabase);
  const defaultDestination = client?.address?.trim() ? client.address : "";

  return (
    <div>
      <Link
        href="/portal/cotizaciones"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis cotizaciones
      </Link>

      <div className="mt-5">
        <span className="eyebrow">Tu cuenta</span>
        <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
          Pide una cotización.
        </h1>
      </div>
      <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
        Dinos qué quieres traer y tu asesor te arma el precio formal. No es un
        cálculo automático: lo revisa una persona y te lo confirma.
      </p>

      <CotizacionRequestForm defaultDestination={defaultDestination} />
    </div>
  );
}
