/**
 * /studio/etiquetas — Generador de etiquetas para suppliers CN (SDD-0031).
 *
 * Server component: fetcha clientes del tenant + warehouses_cn seedeados
 * (SDD-0008). Render LabelGeneratorClient.
 *
 * Preselect via ?id=<markbox> (cross-link desde Clientes drawer · SDD-0032).
 */

import { createClient } from "@/lib/db/server";
import { listSuppliers } from "@/lib/studio/prealertas/queries";
import { LabelGeneratorClient } from "./_components/LabelGeneratorClient";
import {
  resolveBrand,
  type AliadoBrandRow,
  type BrandContext,
} from "@/lib/shared/brand-context";

export const metadata = { title: "Etiquetas CN · DTD Studio" };

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Cliente del generador de etiquetas.
 *
 * ⚠️ NO agregar `company`: `clients` NO tiene esa columna y nunca la tuvo. Para
 * empresa, la razón social YA ES `clients.name` (el alta guarda
 * `input.company ?? input.name`) y el contacto va en `notes`. Este tipo pedía
 * `company` y el `.select()` reventaba entero → `clientsData` llegaba null y el
 * generador se quedaba SIN clientes, callado. Misma familia que el hueco
 * `city_slug` de la 0347.
 */
export type LabelClient = {
  markbox: string;
  name: string;
  /**
   * SDD-0255 · marca con la que se pinta la etiqueta y el mensaje al proveedor.
   * Para un cliente directo es la de DTD; para un cliente de aliado, la del
   * aliado. Se resuelve acá (server) y viaja con el cliente para no pagar una
   * consulta por cada cambio de selección en el generador.
   */
  brand: BrandContext;
};

export type LabelWarehouseCn = {
  id: string;
  code: string;
  city: string;
  hub_name_cn: string | null;
  warehouse_name: string | null;
};

/** Proveedor del dropdown (suppliers_cn, SDD-0057). Cierra D6 de SDD-0031. */
export type LabelSupplier = {
  id: string;
  client_markbox: string;
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
};

export default async function EtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const preselectMarkbox = typeof idRaw === "string" ? idRaw.trim() : undefined;

  const supabase = await createClient();

  const [{ data: clientsData }, { data: warehousesData }, suppliersData] =
    await Promise.all([
      supabase
        .from("clients")
        // ⚠️ Pedir una columna inexistente rompe el select ENTERO y la pantalla
        // se queda sin clientes en silencio (ver la nota del tope del archivo).
        // `aliado_id` y la tabla `aliados` existen en prod desde la migr 0362.
        .select(
          "markbox, name, aliado_id, aliados:aliado_id (trade_name, brand_name, brand_primary, brand_secondary, support_email, support_whatsapp, support_website, hide_dtd_brand)",
        )
        .is("deleted_at", null)
        .order("markbox", { ascending: true })
        .limit(500),
      supabase
        .from("warehouses_cn")
        .select("id, code, city, hub_name_cn, warehouse_name")
        .order("code", { ascending: true }),
      // Defensivo: si 0105 no está aplicada en un env, no rompemos la pantalla
      // de etiquetas (el dropdown cae a "Otro / a mano").
      listSuppliers(supabase).catch(() => []),
    ]);

  const clients: LabelClient[] = (clientsData ?? []).map((c) => {
    // PostgREST devuelve el embed como objeto o como array según cómo infiera la
    // relación; se normaliza para no depender de esa inferencia.
    const raw = (c as { aliados?: unknown }).aliados;
    const row = (Array.isArray(raw) ? raw[0] : raw) ?? null;
    return {
      markbox: c.markbox as string,
      name: c.name as string,
      brand: resolveBrand(row as AliadoBrandRow | null),
    };
  });

  const warehouses: LabelWarehouseCn[] = (warehousesData ?? []).map((w) => ({
    id: w.id as string,
    code: w.code as string,
    city: w.city as string,
    hub_name_cn: (w.hub_name_cn as string | null) ?? null,
    warehouse_name: (w.warehouse_name as string | null) ?? null,
  }));

  const suppliers: LabelSupplier[] = suppliersData.map((s) => ({
    id: s.id,
    client_markbox: s.client_markbox,
    name: s.name,
    city: s.city,
    wechat: s.wechat,
    contact: s.contact,
  }));

  return (
    <div style={{ maxWidth: 1480 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-6)",
          marginBottom: "var(--s-6)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · CN</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Etiquetas para suppliers CN
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Plancha PDF bilingüe ES / 中文 con el Shipping Mark del cliente + Box X/Y.
            Mándala al supplier chino para que pegue las etiquetas antes del
            despacho a tu almacén CN.{" "}
            <span style={{ color: "var(--ink-soft)" }}>
              El navegador abre el diálogo de impresión — elige
              &quot;Guardar como PDF&quot; como destino.
            </span>
          </p>
        </div>
      </div>

      <LabelGeneratorClient
        clients={clients}
        warehouses={warehouses}
        suppliers={suppliers}
        preselectMarkbox={preselectMarkbox}
      />
    </div>
  );
}
