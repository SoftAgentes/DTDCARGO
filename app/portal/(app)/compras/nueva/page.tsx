import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  listSuppliers,
  listPrealertas,
  listActivePrealertaAddons,
} from "@/lib/studio/prealertas/queries";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import { ArrowIcon } from "@/components/Icon";
import { NewPurchaseForm } from "./NewPurchaseForm";

export const metadata: Metadata = { title: "Nueva compra" };

/**
 * "Nueva compra" del Portal (SDD-0057 · terminología compra↔prealerta) —
 * pantalla completa (Norte `PortalNuevaCompra`), reemplaza el modal viejo que
 * quedó como único punto del portal sin migrar al armazón oscuro. Mismo form
 * y mismas server actions que el modal; sólo cambia el shell (página en vez
 * de overlay). `?proveedor=<id>` preselecciona (llega de "Re-comprar" en
 * /portal/proveedores).
 */
export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string }>;
}) {
  const { proveedor } = await searchParams;
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const [suppliers, prealertas, addons] = await Promise.all([
    listSuppliers(supabase, { markbox: client.markbox }),
    listPrealertas(supabase, { markbox: client.markbox }),
    listActivePrealertaAddons(supabase),
  ]);

  const orderCountBySupplierId: Record<string, number> = {};
  for (const p of prealertas) {
    if (p.supplier_id) {
      orderCountBySupplierId[p.supplier_id] =
        (orderCountBySupplierId[p.supplier_id] ?? 0) + 1;
    }
  }

  const supplierViews = summarizeSuppliers(
    client.markbox,
    suppliers.map((s) => ({
      id: s.id,
      supplier_seq: s.supplier_seq,
      name: s.name,
      wechat: s.wechat,
      city: s.city,
      contact: s.contact,
      notes: s.notes,
    })),
    orderCountBySupplierId,
  );

  const preselected = proveedor
    ? (supplierViews.find((s) => s.id === proveedor) ?? null)
    : null;

  return (
    <div>
      <Link
        href="/portal/compras"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis compras
      </Link>

      <div className="mt-5">
        <span className="eyebrow">Tu cuenta</span>
        <h1
          className="h-display mt-3"
          style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
        >
          Registra tu compra.
        </h1>
      </div>
      <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
        Cada <strong className="text-ink">compra</strong> es una{" "}
        <strong className="text-wine">prealerta</strong>: nos avisas que viene
        mercancía de China para esperarla en bodega y procesarla más rápido.
      </p>

      <div className="mt-8 max-w-[560px]">
        <NewPurchaseForm
          suppliers={supplierViews}
          addons={addons}
          preselected={preselected}
        />
      </div>
    </div>
  );
}
