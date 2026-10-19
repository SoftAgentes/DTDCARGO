import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  listPrealertas,
  listSuppliers,
  listPrealertaServiceRequests,
} from "@/lib/studio/prealertas/queries";
import { PREALERTA_DESCRIPCION_PENDIENTE } from "@/lib/studio/prealertas/types";
import { ArrowIcon } from "@/components/Icon";
import { NewPurchaseButton } from "../../_components/NewPurchaseButton";
import { EnviosHubTabs } from "../../_components/PortalHubTabs";
import { ComprasList, type CompraItem } from "./ComprasList";

export const metadata: Metadata = { title: "Mis compras" };

/**
 * "Mis compras" del Portal (SDD-0057 · Slice B) — rediseño Norte. Listado de las
 * compras (prealertas) del cliente, recientes primero, con la DNA visual del hub
 * `PortalAlertasHub`: ícono por estado, filtro por estado con conteo y cards
 * theme-aware. Enfocado SOLO en compras (sin mezclar envíos). Cada card linkea a
 * sus etiquetas.
 *
 * Compras y proveedores se leen con el tenant y el Shipping Mark del principal
 * de sesión (SDD-0554): el Shipping Mark es único por tenant, y con él solo una
 * sesión híbrida recibía también las compras del otro tenant.
 */
export default async function PortalPurchasesPage() {
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client, tenantId } = principal;
  const scope = { markbox: client.markbox, tenantId };

  const [prealertas, suppliers, serviceRequests] = await Promise.all([
    listPrealertas(supabase, scope),
    listSuppliers(supabase, scope),
    // Ya filtra por el tenant del vínculo de sesión (SDD-0381).
    listPrealertaServiceRequests(supabase, { markbox: client.markbox }),
  ]);

  const supplierName: Record<string, string> = {};
  for (const s of suppliers) supplierName[s.id] = s.name;

  // nº de servicios de recepción pedidos por compra (SDD-0098) → chip en la card.
  const servicesById: Record<string, number> = {};
  for (const r of serviceRequests) {
    servicesById[r.prealerta_id] = (servicesById[r.prealerta_id] ?? 0) + 1;
  }

  const items: CompraItem[] = prealertas.map((p) => ({
    code: p.code,
    description: p.description,
    supplierName:
      p.supplier_id && supplierName[p.supplier_id]
        ? supplierName[p.supplier_id]
        : null,
    boxes: p.boxes,
    status: p.status,
    services: servicesById[p.id] ?? 0,
    faltaDetalle:
      p.status === "anunciada" &&
      p.description === PREALERTA_DESCRIPCION_PENDIENTE,
  }));

  return (
    <div>
      <EnviosHubTabs />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="eyebrow eyebrow-wine">Tu cuenta</span>
          <h1 className="h-display mt-3" style={{ fontSize: "clamp(28px, 4.2vw, 44px)" }}>
            Mis compras
          </h1>
          <p className="lead mt-3 max-w-[60ch]">
            Cada compra que registras nos avisa que viene mercancía de China. Acá
            ves el estado de todas y vuelves a generar sus etiquetas.
          </p>
        </div>
        <NewPurchaseButton href="/portal/compras/nueva" />
      </div>

      {items.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no registraste compras.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Registra tu primera compra para obtener su código y las etiquetas.
          </p>
          <Link
            href="/portal/compras/nueva"
            className="btn btn-primary mt-6 inline-flex"
          >
            Registrar compra <ArrowIcon />
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <ComprasList items={items} />
        </div>
      )}
    </div>
  );
}
