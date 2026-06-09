import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  listPrealertas,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";
import { ArrowIcon } from "@/components/Icon";
import { PrealertaStatusBadge } from "../../_components/PrealertaStatusBadge";

export const metadata: Metadata = { title: "Mis compras" };

/**
 * "Mis compras" del Portal (SDD-0057 · Slice B). Listado read-only de las
 * compras (prealertas) del cliente, recientes primero: código + proveedor +
 * descripción + cajas + estado con badge. Cada fila linkea a sus etiquetas.
 */
export default async function PortalPurchasesPage() {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const [prealertas, suppliers] = await Promise.all([
    listPrealertas(supabase, { markbox: client.markbox }),
    listSuppliers(supabase, { markbox: client.markbox }),
  ]);

  const supplierName: Record<string, string> = {};
  for (const s of suppliers) supplierName[s.id] = s.name;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="eyebrow">Tu cuenta</span>
          <h1
            className="h-display mt-3"
            style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
          >
            Mis compras.
          </h1>
          <p className="lead mt-3 max-w-[60ch]">
            Cada compra que registras nos avisa que viene mercancía de China. Acá
            ves el estado de todas y vuelves a generar sus etiquetas.
          </p>
        </div>
        <Link
          href="/portal/proveedores"
          className="btn btn-primary inline-flex items-center gap-2 flex-shrink-0"
        >
          Nueva compra <ArrowIcon size={15} />
        </Link>
      </div>

      {prealertas.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no registraste compras.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            Registra tu primera compra desde Tus proveedores para obtener su
            código y las etiquetas.
          </p>
          <Link
            href="/portal/proveedores"
            className="btn btn-primary mt-6 inline-flex"
          >
            Ir a Tus proveedores <ArrowIcon />
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {prealertas.map((p) => (
            <Link
              key={p.id}
              href={`/portal/compras/${encodeURIComponent(p.code)}/etiquetas`}
              className="card-link group bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 transition-colors hover:border-ink focus-visible:border-ink"
              aria-label={`Ver etiquetas de la compra ${p.code}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="text-[14px] font-bold text-ink"
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                    }}
                  >
                    {p.code}
                  </span>
                  <PrealertaStatusBadge status={p.status} />
                </div>
                <div className="mt-1.5 text-[13.5px] text-grey-700 truncate">
                  {p.description}
                </div>
                <div className="mt-0.5 text-[12.5px] text-grey-500">
                  {p.supplier_id && supplierName[p.supplier_id]
                    ? supplierName[p.supplier_id]
                    : "Sin proveedor"}{" "}
                  · {p.boxes} caja{p.boxes === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 sm:justify-end">
                <span className="text-[12px] text-grey-500">Ver etiquetas</span>
                <ArrowIcon
                  className="text-grey-300 transition-colors group-hover:text-wine"
                  size={18}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
