/**
 * /studio/cola-qr/[id]/imprimir — etiquetas del HUB con el código único por caja
 * (SDD-0152).
 *
 * Es la pieza que faltaba para cerrar el círculo del escaneo. Hasta acá:
 *  · /studio/etiquetas genera etiquetas LIBRES (elegís cliente + tecleás "12
 *    cajas") que se mandan al proveedor ANTES de que la caja exista → su QR
 *    identifica al CLIENTE (?c=<markbox>&n=3/12), no a la caja.
 *  · /studio/cola-qr era solo un rastreador de estados (pendiente→imprimiendo→
 *    impresa) con impresoras mock: NO renderizaba etiquetas.
 * Resultado: el código DTD-B-NNNNNN existía en la base pero nada lo ponía en la
 * caja, así que no había qué escanear.
 *
 * Esta vista imprime, para una orden de la cola, UNA etiqueta por caja real de
 * su recepción (warehouse_boxes, migr 0240) con su código en el QR y legible.
 * Decisión del founder (2026-07-16): en Yiwu se re-etiqueta cada caja al
 * recibirla.
 *
 * Server component: solo lee y arma. La impresión la dispara el operador con
 * Ctrl+P (mismo criterio que /studio/etiquetas).
 */

import Link from "next/link";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { FORMATS } from "@/lib/studio/etiquetas-formats";
import type { LabelWarehouseCn } from "../../../etiquetas/page";
import { HubLabelSheet } from "../../_components/HubLabelSheet";

export const metadata = { title: "Imprimir etiquetas del hub · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function ImprimirOrdenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  const supabase = await createClient();

  // RLS filtra por tenant
  const { data: order } = await supabase
    .from("qr_print_orders")
    .select("id, order_code, markbox, client_name, supplier_name, bultos, receipt_id, warehouse_id")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      order_code: string;
      markbox: string;
      client_name: string;
      supplier_name: string | null;
      bultos: number;
      receipt_id: string | null;
      warehouse_id: string | null;
    }>();

  if (!order) notFound();

  // Las cajas REALES de la recepción. Sin receipt_id (órdenes previas a
  // SDD-0152) no hay códigos que imprimir → modo legacy más abajo.
  let boxes: { code: string; seq: number }[] = [];
  if (order.receipt_id) {
    const { data: rows } = await supabase
      .from("warehouse_boxes")
      .select("code, seq")
      .eq("receipt_id", order.receipt_id)
      .is("deleted_at", null)
      .order("seq", { ascending: true })
      .limit(500);
    boxes = (rows as { code: string; seq: number }[] | null) ?? [];
  }

  // Hub del pie de etiqueta. El contacto/dirección SIEMPRE salen de CONTACT.cn
  // vía warehouseAddress() — DTD opera una sola bodega real (Yiwu) y esa es la
  // fuente única; del catálogo solo se toman code y ciudad.
  const { data: wh } = order.warehouse_id
    ? await supabase
        .from("warehouses_cn")
        .select("id, code, city, hub_name_cn, warehouse_name")
        .eq("id", order.warehouse_id)
        .maybeSingle<LabelWarehouseCn>()
    : { data: null };

  const format = FORMATS.find((x) => x.id === f) ?? FORMATS[0];

  return (
    <div style={{ padding: "var(--s-6)" }}>
      {/* Chrome · no se imprime */}
      <div className="no-print" style={{ marginBottom: "var(--s-4)" }}>
        <Link
          href="/studio/cola-qr"
          style={{
            font: "600 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          ← Cola de impresión
        </Link>
        <h1 style={{ margin: "4px 0 2px", font: "900 22px/1.2 var(--f-display)", color: "var(--ink)" }}>
          {order.order_code}
        </h1>
        <p style={{ margin: 0, font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          {order.markbox} · {order.client_name}
          {order.supplier_name ? ` · ${order.supplier_name}` : ""}
        </p>

        {!order.receipt_id ? (
          <div style={{ marginTop: "var(--s-3)", maxWidth: 640 }}>
            <Aviso tono="atencion" compacto>
              Esta orden es anterior a la estiba por zonas: no sabemos de qué recepción salió, así
              que las etiquetas van sin código de caja. Sirven para rotular, pero{" "}
              <strong>no se pueden escanear al estibar</strong>. Manda a imprimir desde una
              recepción nueva para que lleven código.
            </Aviso>
          </div>
        ) : boxes.length === 0 ? (
          <div style={{ marginTop: "var(--s-3)", maxWidth: 640 }}>
            <Aviso tono="error" compacto>
              La recepción no tiene cajas registradas. Revisa que el conteo de bultos sea mayor a
              cero.
            </Aviso>
          </div>
        ) : (
          <p
            style={{
              marginTop: "var(--s-3)",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {boxes.length} etiqueta{boxes.length === 1 ? "" : "s"} · una por caja, con su código
            único. Imprime con <strong>Ctrl+P</strong> y pégalas antes de estibar.
          </p>
        )}

        {/* Formatos */}
        <div style={{ display: "flex", gap: 6, marginTop: "var(--s-3)", flexWrap: "wrap" }}>
          {FORMATS.map((x) => (
            <Link
              key={x.id}
              href={`/studio/cola-qr/${id}/imprimir?f=${x.id}`}
              className={`studio-btn studio-btn-sm ${
                x.id === format.id ? "studio-btn-dark" : "studio-btn-ghost"
              }`}
              style={{ textDecoration: "none" }}
            >
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      <HubLabelSheet
        formatId={format.id}
        markbox={order.markbox}
        clientName={order.client_name}
        boxes={boxes.length > 0 ? boxes : null}
        legacyCount={order.bultos}
        warehouseRow={wh ?? null}
      />
    </div>
  );
}
