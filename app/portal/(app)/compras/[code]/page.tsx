import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  getPrealertaByCode,
  listPredeclaredBoxes,
  listPrealertaServiceRequests,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";
import {
  compararCajas,
  listarRecepcionesDeCompra,
  nombreDeProveedor,
} from "@/lib/portal/purchase-reception-queries";
import {
  cotejarConLoAnunciado,
  obtenerPackingListDeCompra,
} from "@/lib/portal/packing-list-queries";
import { defaultAddon } from "@/lib/studio/prealertas/addons";
import { PREALERTA_DESCRIPCION_PENDIENTE } from "@/lib/studio/prealertas/types";
import { ArrowIcon } from "@/components/Icon";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { listMyPortalAvisos } from "@/lib/portal/portal-avisos-queries";
import { historialDesdeAviso } from "@/lib/portal/portal-avisos";
import { PortalNotificationHistory } from "../../../_components/PortalNotificationHistory";
import { PrealertaStatusBadge } from "../../../_components/PrealertaStatusBadge";
import { PortalTrackingEnConstruccion } from "../../../_components/PortalTrackingEnConstruccion";
import { PackingListDelProveedor } from "./_components/PackingListDelProveedor";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Compra ${decodeURIComponent(code)}` };
}

/**
 * SDD-0307 · Detalle de UNA compra en el portal.
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
 * `getPrealertaByCode` va con el cliente AUTENTICADO y filtra por el tenant y el
 * `client_markbox` del principal (SDD-0552): una compra ajena, del mismo Shipping
 * Mark en otro tenant o inexistente devuelve null → 404, sin distinguir entre
 * los casos. Sólo con la propiedad ya probada se leen las
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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client } = principal;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
    tenantId: principal.tenantId,
  });
  if (!prealerta) notFound();

  const [cajas, proveedores, servicios, recepcion, packing, avisos] = await Promise.all([
    listPredeclaredBoxes(supabase, prealerta.id),
    // Tenant + Shipping Mark del principal (SDD-0554).
    listSuppliers(supabase, { markbox: client.markbox, tenantId: principal.tenantId }),
    // Ya filtra por el tenant del vínculo de sesión (SDD-0381).
    listPrealertaServiceRequests(supabase, { markbox: client.markbox }),
    // Propiedad ya probada arriba → recién ahora el admin client.
    listarRecepcionesDeCompra(createAdminClient(), prealerta.id),
    // Ídem (SDD-0308): `packing_list_submissions` sólo tiene policy "by tenant"
    // y el cliente del portal no está en `user_tenants` — con su sesión la RLS
    // niega. Se lee con el admin client acotado al `prealerta_id` ya verificado,
    // y la query revalida el markbox por dentro.
    obtenerPackingListDeCompra(
      createAdminClient(),
      prealerta.id,
      client.markbox,
    ),
    // SDD-0526 · los avisos ya enviados de ESTA compra, con la sesión del
    // cliente (RPC 0479): la base vuelve a exigir que la compra sea suya y viva.
    listMyPortalAvisos(supabase, { prealertaId: prealerta.id, limit: 50 }),
  ]);

  const proveedor = prealerta.supplier_id
    ? (proveedores.find((s) => s.id === prealerta.supplier_id) ?? null)
    : null;
  const misServicios = servicios.filter((s) => s.prealerta_id === prealerta.id);

  /**
   * ¿La compra quedó registrada sin detalle? La descripción sigue siendo el
   * relleno del servidor y todavía nadie la tocó en bodega — el único caso en
   * que `updatePrealertaDetalleAction` acepta cambios del cliente.
   */
  const faltaDetalle =
    prealerta.status === "anunciada" &&
    prealerta.description === PREALERTA_DESCRIPCION_PENDIENTE;
  const cotejo = compararCajas(prealerta.boxes, recepcion.cajasRecibidas);

  /**
   * SDD-0516 · Mientras el seguimiento esté en construcción (SDD-0514), la
   * pantalla no promete lo que hoy no pasa. El aviso «recibido en bodega» sólo
   * se programa cuando la recepción se registra en el sistema, y la bodega de
   * China todavía registra en Excel: «Te avisamos apenas…» y «verás acá cada
   * recepción» serían falsos. Se dice una frase neutra; con el interruptor
   * apagado vuelve el texto de siempre. Sólo cambia la compra SIN recepciones:
   * una recepción registrada es real y se muestra como siempre.
   */
  const enConstruccion = TRACKING_EN_CONSTRUCCION;

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

      {/* SDD-0514 · la bodega de China todavía registra en Excel, así que la
          recepción de abajo puede salir vacía aunque la mercancía haya llegado.
          El aviso lo explica; no esconde las recepciones que sí existan. */}
      <PortalTrackingEnConstruccion className="mt-7" />

      {/* ── Lo primero que se pregunta: ¿llegó todo? ───────────── */}
      <EstadoDeLlegada
        anunciadas={prealerta.boxes}
        recibidas={recepcion.cajasRecibidas}
        estado={cotejo.estado}
        diferencia={cotejo.diferencia}
        primeraRecepcion={recepcion.primeraRecepcion}
        enConstruccion={enConstruccion}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-start">
        {/* Recepciones en bodega */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Recepción en bodega (China)
          </h2>

          {recepcion.recepciones.length === 0 ? (
            enConstruccion ? (
              <p className="mt-5 text-[14px] text-grey-700 leading-[1.55]">
                Las recepciones de esta compra todavía no aparecen aquí mientras
                activamos el seguimiento.
              </p>
            ) : (
              <p className="mt-5 text-[14px] text-grey-700 leading-[1.55]">
                Todavía no registramos la llegada de esta compra a nuestra bodega
                en Yiwu. Cuando el proveedor entregue, verás acá cada recepción con
                su fecha, sus cajas y las medidas reales.
              </p>
            )
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
                          {(() => {
                            // SDD-0284 · manda el proveedor que TÚ registraste;
                            // el nombre que escribió la bodega sólo aparece si
                            // difiere (a veces llega en chino o abreviado).
                            const p = nombreDeProveedor(
                              proveedor?.name ?? null,
                              r.supplierName,
                            );
                            return p.principal ? ` · ${p.principal}` : "";
                          })()}
                        </div>
                        {(() => {
                          const p = nombreDeProveedor(
                            proveedor?.name ?? null,
                            r.supplierName,
                          );
                          return p.segundo ? (
                            <div className="mt-0.5 text-[11.5px] text-grey-500">
                              La bodega lo anotó como &ldquo;{p.segundo}&rdquo;
                            </div>
                          ) : null;
                        })()}
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

                    {/* SDD-0285 · las fotos que tomó el operario al recibir.
                        Es lo que convierte "llegaron 7 cajas" en "llegaron, y
                        aquí están". Se abren en pestaña nueva a tamaño completo:
                        el cliente quiere mirar la etiqueta y el estado del
                        embalaje, no una miniatura. */}
                    {r.fotos.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                          Fotos de la recepción
                        </div>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {r.fotos.map((f) => (
                            <a
                              key={`${r.id}-${f.position}`}
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-[10px] overflow-hidden border border-grey-200 hover:border-ink focus-visible:border-ink transition-colors"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element --
                                  la URL es firmada y temporal (1 h): next/image
                                  la optimizaría a una ruta cacheada que
                                  sobreviviría a la firma y quedaría rota. */}
                              <img
                                src={f.url}
                                alt={`Foto ${f.position + 1} de la recepción ${r.receiptCode}`}
                                width={96}
                                height={96}
                                loading="lazy"
                                className="block w-[96px] h-[96px] object-cover"
                              />
                            </a>
                          ))}
                        </div>
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

          {/* SDD-0313 · La única puerta de vuelta al paso 2. Hasta acá, una
              compra registrada sin detalle no se podía completar NUNCA: el
              formulario sólo existía en el instante del alta. */}
          {faltaDetalle ? (
            <div
              className="mt-4 rounded-[12px] border p-4"
              style={{
                borderColor: "var(--color-wine)",
                background: "var(--color-paper)",
              }}
            >
              <div className="text-[13px] font-bold text-ink">
                Te falta el detalle de esta compra.
              </div>
              <p className="mt-1 text-[12.5px] text-grey-700 leading-[1.5]">
                Cuéntanos qué traes, cuántas cajas y su valor. Nos ayuda a
                recibirla más rápido — y te queda de recordatorio.
              </p>
              <Link
                href={`/portal/compras/${encodeURIComponent(prealerta.code)}/detalle`}
                className="btn btn-primary mt-3 inline-flex"
              >
                Completar el detalle <ArrowIcon size={15} />
              </Link>
            </div>
          ) : null}
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

      {/* ── Packing list del proveedor (SDD-0308) ──────────────────
          Va a ancho completo y DEBAJO del grid: es un documento de once
          columnas, no cabe en media pantalla sin comprimirlo. Y va al final
          porque responde la cuarta pregunta ("¿qué despachó exactamente?"),
          después de las tres que el cliente hace primero. */}
      {packing ? (
        <PackingListDelProveedor
          packing={packing}
          cotejo={cotejarConLoAnunciado(prealerta.boxes, packing.totales.ctns)}
        />
      ) : (
        <EsperandoPackingList code={prealerta.code} />
      )}

      {/* SDD-0526 · Historial de avisos de esta compra, igual que el del envío.
          Se oculta si no hay. */}
      {avisos.length > 0 ? (
        <div className="mt-6">
          <PortalNotificationHistory
            items={avisos.map(historialDesdeAviso)}
            descripcion="El historial de notificaciones de esta compra."
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sin packing list todavía.
 *
 * No se calla la sección: que el proveedor no haya mandado el documento es
 * información, y además es **accionable** — el cliente puede reclamárselo. Un
 * hueco en blanco lo dejaría creyendo que la pantalla no lo muestra.
 */
function EsperandoPackingList({ code }: { code: string }) {
  return (
    <section className="mt-6 rounded-[18px] border border-dashed border-grey-300 p-6 sm:p-8">
      <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
        Packing list del proveedor
      </h2>
      <p className="mt-3 text-[14px] text-grey-700 max-w-[62ch] leading-[1.55]">
        Tu proveedor todavía no ha enviado el packing list de esta compra.
        Cuando lo llene, acá vas a ver el detalle línea por línea: qué despachó,
        cuántas cajas, cuánto pesa y cuánto mide.
      </p>
      <Link
        href={`/portal/compras/${encodeURIComponent(code)}/etiquetas`}
        className="btn btn-ghost mt-5 inline-flex"
      >
        Compartir el enlace con mi proveedor <ArrowIcon size={15} />
      </Link>
    </section>
  );
}

/**
 * El bloque de arriba: ¿llegó, llegó a medias, o no llegó?
 *
 * Un faltante se dice con todas las letras y con el número exacto. El cliente
 * que anunció 10 y recibió 7 necesita ver "faltan 3" acá, no deducirlo restando
 * dos cifras que están en tarjetas distintas.
 *
 * SDD-0516 · `enConstruccion` sólo cambia el caso `sin_llegar`. Con la bodega
 * registrando en Excel, «Todavía no llegó» puede ser falso para mercancía que
 * ya está en Yiwu, y el «Te avisamos apenas…» no va a salir. La frase neutra
 * dice lo que es cierto y manda a Soporte, que es quien puede contestar hoy.
 * Los otros tres casos sólo existen con recepciones registradas, que son reales.
 */
function EstadoDeLlegada({
  anunciadas,
  recibidas,
  estado,
  diferencia,
  primeraRecepcion,
  enConstruccion,
}: {
  anunciadas: number;
  recibidas: number;
  estado: "sin_llegar" | "parcial" | "completo" | "excedente";
  diferencia: number;
  primeraRecepcion: string | null;
  enConstruccion: boolean;
}) {
  const cajasAnunciadas = `${anunciadas} ${anunciadas === 1 ? "caja" : "cajas"}`;
  const copy = {
    sin_llegar: enConstruccion
      ? {
          titulo: "La llegada a bodega todavía no aparece aquí",
          detalle: `Anunciaste ${cajasAnunciadas}. Mientras activamos el seguimiento, nuestro equipo en China lleva el control de cada recepción. Para saber si ya llegó, escríbenos en Soporte.`,
          color: "var(--color-grey-500)",
        }
      : {
          titulo: "Todavía no llegó a nuestra bodega",
          detalle: `Anunciaste ${cajasAnunciadas}. Te avisamos apenas el proveedor entregue en Yiwu.`,
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
