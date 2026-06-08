import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { listMyShipments } from "@/lib/portal/portal-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { ShipmentRow } from "../../_components/ShipmentRow";

export const metadata: Metadata = { title: "Mis envíos" };

/**
 * "Mis envíos" (SDD-0042). Lista read-only de los envíos del cliente. Vivía en
 * `(app)/page.tsx`; en Fase 5 (Norte) ese slot pasó a ser el Inicio/dashboard y
 * la lista se reubicó acá (`/portal/envios`). Funcionalidad preservada tal cual.
 */
export default async function PortalShipmentsPage() {
  const supabase = await createClient();
  const shipments = await listMyShipments(supabase);
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y tengo una consulta sobre mis envíos.",
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Mis envíos.
      </h1>
      <p className="lead mt-3">
        Sigue el estado de tus cargas en tiempo real. Para cambios o dudas,
        escríbele a tu asesor por WhatsApp.
      </p>

      {shipments.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no tienes envíos.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Cuando confirmes tu primera carga con tu asesor, va a aparecer acá con
            su estado.
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
        <div className="mt-8 flex flex-col gap-3">
          {shipments.map((s) => (
            <ShipmentRow key={s.id} shipment={s} />
          ))}
        </div>
      )}
    </div>
  );
}
