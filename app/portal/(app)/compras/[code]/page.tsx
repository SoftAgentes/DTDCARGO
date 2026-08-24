import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  getPrealertaByCode,
  listPredeclaredBoxes,
  listPrealertaServiceRequests,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";
import {
  compararCajas,
  listarRecepcionesDeCompra,
} from "@/lib/portal/purchase-reception-queries";
import { defaultAddon } from "@/lib/studio/prealertas/addons";
import { ArrowIcon } from "@/components/Icon";
import { PrealertaStatusBadge } from "../../../_components/PrealertaStatusBadge";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Compra ${decodeURIComponent(code)}` };
}

/**
 * SDD-0281 · Detalle de UNA compra en el portal.
 *
 * Esta pantalla no existía. El cliente podía anunciar la compra y volver a
 * imprimir sus etiquetas, pero no **abrirla**: desde el momento del aviso
 * quedaba a ciegas hasta que la mercancía aparecía dentro de un envío. Cada
 * "¿ya llegó a la bodega?" y "¿cuántas cajas les llegaron?" salía del ERP por
 * WhatsApp, escrito a mano por alguien del equipo.
 *
 * Lo que responde, en este orden —que es el orden en que el cliente pregunta—:
 *
 *   1. ¿Llegó a Yiwu? ¿Cuándo?
 *   2. ¿Llegaron TODAS las cajas que anuncié?  ← lo más importante
 *   3. ¿Cuánto midió y pesó de verdad?
 *   4. ¿Ya va en un envío?
 *
 * ## El desajuste se muestra, no se esconde
 *
 * Si el cliente anunció 10 cajas y llegaron 7, la pantalla lo dice arriba y en
 * grande. Es la información más útil de todas: quiere enterarse acá y no cuando
 * le llegue la factura. Mostrar sólo "7 recibidas" sería técnicamente cierto y
 * prácticamente una omisión.
 *
 * ## Seguridad
 *
 * `getPrealertaByCode` va con el cliente AUTENTICADO y filtra por
 * `client_markbox`: una compra ajena o inexistente devuelve null → 404, sin
 * distinguir entre los dos casos. Sólo con la propiedad ya probada se leen las
 * recepciones con el admin client — `warehouse_receipts_cn` tiene policy
 * "by tenant" y un cliente del portal no está en `user_tenants`, así que con su
 * sesión la consulta volvería vacía siempre y en silencio. Es el mismo patrón
 * del detalle de envío con consolidaciones. Ver
 * `lib/portal/purchase-reception-queries.ts`.
 */
export default async function PortalPurchaseDetailPage({ params }: Props) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
  });
  if (!prealerta) notFound();

  const [cajas, proveedores, servicios, recepcion] = await Promise.all([
    listPredeclaredBoxes(supabase, prealerta.id),
    listSuppliers(supabase, { markbox: client.markbox }),
    listPrealertaServiceRequests(supabase, { markbox: client.markbox }),
    // Propiedad ya probada arriba → recién ahora el admin client.
    listarRecepcionesDeCompra(createAdminClient(), prealerta.id),
  ]);

  const proveedor = prealerta.supplier_id
    ? (proveedores.find((s) => s.id === prealerta.supplier_id) ?? null)
    : null;
  const misServicios = servicios.filter((s) => s.prealerta_id === prealerta.id);
  const cotejo = compararCajas(prealerta.boxes, recepcion.cajasRecibidas);

  return (
    <div>
      <Link
        href="/portal/compras"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis compras
      </Link>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="eyebrow">Detalle de la compra</span>
          <div
            className="mt-2 text-[26px] sm:text-[34px] leading-none text-ink"
            style={{
              fontFamily: "var(--font-archivo-black)",
              letterSpacing: "-0.02em",
            }}
          >
            {prealerta.code}
          </div>
          <p className="mt-3 text-[15px] text-grey-700 max-w-[60ch] leading-[1.55]">
            {prealerta.description}
          </p>
        </div>
        <PrealertaStatusBadge status={prealerta.status} />
      </div>

      {/* ── Lo primero que se pregunta: ¿llegó todo? ───────────── */}
      <EstadoDeLlegada
        anunciadas={prealerta.boxes}
        recibidas={recepcion.cajasRecibidas}
        estado={cotejo.estado}
        diferencia={cotejo.diferencia}
        primeraRecepcion={recepcion.primeraRecepcion}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-start">
        {/* Recepciones en bodega */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Recepción en bodega (China)
          </h2>

          {recepcion.recepciones.length === 0 ? (
            <p className="mt-5 text-[14px] text-grey-700 leading-[1.55]">
              Todavía no registramos la llegada de esta compra a nuestra bodega
              en Yiwu. Cuando el proveedor entregue, verás acá cada recepción con
              su fecha, sus cajas y las medidas reales.
            </p>
          ) : (
            <>
              <div className="mt-5 flex flex-col divide-y divide-grey-200">
                {recepcion.recepciones.map((r) => (
                  <div key={r.id} className="py-4 first:pt-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div
                          className="text-[14.5px] font-semibold text-ink"
                          style={{
                            fontFamily:
                              "var(--font-jetbrains-mono), ui-monospace, monospace",
                          }}
                        >
                          {r.receiptCode}
                        </div>
                        <div className="mt-1 text-[12.5px] text-grey-500">
                          Recibida el {fechaLegible(r.receivedAt)}
                          {r.supplierName ? ` · ${r.supplierName}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14.5px] font-semibold text-ink">
                          {r.boxes} {r.boxes === 1 ? "caja" : "cajas"}
                        </div>
                        <div className="mt-1 text-[12.5px] text-grey-500">
                          {medida(r.cbm, "m³")} · {medida(r.weightKg, "kg")}
                        </div>
                      </div>
                    </div>
                    {r.enEmbarque ? (
                      <div className="mt-2 text-[12.5px] font-semibold text-wine-text">
                        Ya asignada a un envío
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {recepcion.recepciones.length > 1 ? (
                <dl className="mt-5 pt-5 border-t border-grey-200 flex flex-col gap-2.5">
                  <FilaTotal
                    label="Total recibido"
                    value={`${recepcion.cajasRecibidas} ${
                      recepcion.cajasRecibidas === 1 ? "caja" : "cajas"
                    }`}
                  />
                  <FilaTotal
                    label="Volumen medido"
                    value={medida(recepcion.cbmTotal, "m³")}
                  />
                  <FilaTotal
                    label="Peso medido"
                    value={medida(recepcion.pesoTotal, "kg")}
                  />
                </dl>
              ) : null}
            </>
          )}
        </div>

        {/* Lo que el cliente declaró */}
        <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Lo que registraste
          </h2>
          <dl className="mt-5 flex flex-col gap-4">
            <Campo
              label="Cajas anunciadas"
              value={String(prealerta.boxes)}
            />
            {proveedor ? <Campo label="Proveedor" value={proveedor.name} /> : null}
            {prealerta.tracking_cn ? (
              <Campo label="Guía en China" value={prealerta.tracking_cn} mono />
            ) : null}
            {prealerta.est_value_usd != null ? (
              <Campo
                label="Valor declarado"
                value={`USD ${prealerta.est_value_usd.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
              />
            ) : null}
            <Campo
              label="Registrada"
              value={fechaLegible(prealerta.created_at.slice(0, 10))}
            />
          </dl>

          {prealerta.client_note ? (
            <div className="mt-6 pt-5 border-t border-grey-200">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                Tu nota
              </div>
              <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
                {prealerta.client_note}
              </p>
            </div>
          ) : null}

          {misServicios.length > 0 ? (
            <div className="mt-6 pt-5 border-t border-grey-200">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                Servicios pedidos
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {misServicios.map((s) => (
                  <li key={s.id} className="text-[13.5px] text-grey-700">
                    {defaultAddon(s.addon_code)?.label ?? "Servicio de recepción"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 pt-6 border-t border-grey-200">
            <Link
              href={`/portal/compras/${encodeURIComponent(prealerta.code)}/etiquetas`}
              className="btn btn-primary w-full justify-center"
            >
              Ver etiquetas
            </Link>
            {cajas.length > 0 ? (
              <p className="mt-3 text-[13px] text-grey-700 leading-[1.5]">
                Esta compra tiene {cajas.length}{" "}
                {cajas.length === 1 ? "caja" : "cajas"} con código propio. Cada
                una lleva su etiqueta con QR.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El bloque de arriba: ¿llegó, llegó a medias, o no llegó?
 *
 * Un faltante se dice con todas las letras y con el número exacto. El cliente
 * que anunció 10 y recibió 7 necesita ver "faltan 3" acá, no deducirlo restando
 * dos cifras que están en tarjetas distintas.
 */
function EstadoDeLlegada({
  anunciadas,
  recibidas,
  estado,
  diferencia,
  primeraRecepcion,
}: {
  anunciadas: number;
  recibidas: number;
  estado: "sin_llegar" | "parcial" | "completo" | "excedente";
  diferencia: number;
  primeraRecepcion: string | null;
}) {
  const copy = {
    sin_llegar: {
      titulo: "Todavía no llegó a nuestra bodega",
      detalle: `Anunciaste ${anunciadas} ${anunciadas === 1 ? "caja" : "cajas"}. Te avisamos apenas el proveedor entregue en Yiwu.`,
      color: "var(--color-grey-500)",
    },
    parcial: {
      titulo: `Llegaron ${recibidas} de ${anunciadas} cajas`,
      detalle: `Faltan ${Math.abs(diferencia)} ${Math.abs(diferencia) === 1 ? "caja" : "cajas"} por recibir. Si tu proveedor ya las despachó, escríbenos con la guía y las rastreamos.`,
      color: "var(--color-status-warning)",
    },
    completo: {
      titulo: `Llegaron las ${recibidas} cajas`,
      detalle: primeraRecepcion
        ? `Recibidas en nuestra bodega de Yiwu el ${fechaLegible(primeraRecepcion)}.`
        : "Recibidas completas en nuestra bodega de Yiwu.",
      color: "var(--color-status-success)",
    },
    excedente: {
      titulo: `Llegaron ${recibidas} cajas — anunciaste ${anunciadas}`,
      detalle: `Recibimos ${diferencia} ${diferencia === 1 ? "caja" : "cajas"} de más. Las guardamos igual; el cobro se ajusta a lo que realmente viaja.`,
      color: "var(--color-status-warning)",
    },
  }[estado];

  return (
    <div
      className="mt-7 rounded-[18px] p-6 sm:p-7 border"
      style={{
        // El color va en el borde y el fondo, nunca en el texto: el ámbar como
        // tinta no llega al 4.5:1 en claro (BRAND ♿ · SDD-0176).
        background: `color-mix(in srgb, ${copy.color} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${copy.color} 22%, transparent)`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 block rounded-full flex-shrink-0"
          style={{ width: 9, height: 9, background: copy.color }}
        />
        <div className="min-w-0">
          <div className="text-[17px] sm:text-[19px] font-bold text-ink leading-[1.3]">
            {copy.titulo}
          </div>
          <p className="mt-2 text-[14px] text-grey-700 leading-[1.55] max-w-[62ch]">
            {copy.detalle}
          </p>
        </div>
      </div>
    </div>
  );
}

/** `null` = todavía no lo midieron. No se imprime `0`: diría algo distinto. */
function medida(v: number | null, unidad: string): string {
  if (v == null) return `— ${unidad}`;
  return `${v.toLocaleString("en-US", {
    minimumFractionDigits: unidad === "m³" ? 3 : 1,
    maximumFractionDigits: unidad === "m³" ? 3 : 1,
  })} ${unidad}`;
}

/** `2026-08-23` → `23 ago 2026`. */
function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  const mes = meses[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

function Campo({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className="text-[15px] font-semibold text-ink"
        style={
          mono
            ? {
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
              }
            : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}

function FilaTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[13.5px] font-bold text-ink">{label}</dt>
      <dd
        className="text-[13.5px] font-bold text-ink whitespace-nowrap"
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
