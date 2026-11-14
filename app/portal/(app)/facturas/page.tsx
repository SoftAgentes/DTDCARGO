import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  listMyInvoices,
  listMyShipments,
  listMyEstimates,
  getPortalClientPrincipal,
} from "@/lib/portal/portal-queries";
import {
  formatInvoiceAmount,
  isActiveShipmentStatus,
  type InvoiceCurrency,
  type PortalInvoiceRow,
  type PortalShipmentRow,
  type PortalEstimateRow,
} from "@/lib/portal/portal-types";
import {
  esAnulada,
  notaPagosEnAnuladas,
  notaSobrepagos,
  resumenDeCuenta,
  saldoPorPagar,
} from "@/lib/portal/saldo-de-cuenta";
import { showNortePortal } from "@/lib/portal/demo";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { InvoiceRow } from "../../_components/InvoiceRow";
import { InvoiceStatusBadge } from "../../_components/InvoiceStatusBadge";
import { PendingAcceptanceCard } from "../_components/PendingAcceptanceCard";
import { InvoiceCycleCard } from "./_components/InvoiceCycleCard";
import { StatementLedgerTable } from "./_components/StatementLedgerTable";
import { EquivalenteBs } from "../../_components/EquivalenteBs";
import { equivalenteEnBs } from "@/lib/shared/equivalente-bs";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import { tasasReferencialesDelPortal } from "@/lib/portal/tasa-referencial";
import {
  loadPendingAcceptanceForClient,
  totalPorAceptar,
} from "@/lib/portal/pending-acceptance";

export const metadata: Metadata = { title: "Mis facturas" };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * "Mis facturas" (SDD-0042 Fase 3 · alineado al Norte `PortalInvoices`):
 * fila de KPIs (Total facturado / Pagado / Pendiente) + tabla densa. Como las
 * facturas pueden estar en distintas monedas y sumar entre monedas sería
 * incorrecto, los KPIs de monto se calculan en la moneda DOMINANTE (la mayoría
 * de los clientes factura en una sola); si hay varias, se avisa. En desktop es
 * una tabla; en mobile cae a las cards `InvoiceRow`. Cada fila linkea al detalle.
 */
export default async function PortalInvoicesPage({
  searchParams,
}: {
  // `?saldo=1` → solo facturas por pagar. Lo usa "Reportar un pago" del menú
  // Crear: ese ítem prometía subir un comprobante y aterrizaba en la lista
  // completa, dejando al cliente a tres saltos de la acción anunciada.
  //
  // `?vista=cuenta` → estado de cuenta (libro de movimientos, SDD-0177) en vez
  // de la lista. Va en la URL y no en `useState` para que la vista se pueda
  // compartir por link y la página siga siendo server component.
  searchParams: Promise<{ saldo?: string; vista?: string }>;
}) {
  const { saldo, vista } = await searchParams;
  const soloConSaldo = saldo === "1";
  const vistaCuenta = vista === "cuenta";
  const supabase = await createClient();
  // Rediseño Norte (founder 2026-06-20) GATEADO al demo: la card "ciclo"
  // (Estimado→Aprobado→Facturado) necesita estimados + envíos; sólo se cargan para
  // el demo (clientes reales: misma página, sin queries extra).
  // SDD-0549 · un solo principal de sesión: su cliente decide el demo y su
  // tenant + Shipping Mark acotan los borradores por aceptar (sin releer
  // `clients.tenant_id` con el admin client).
  const principal = await getPortalClientPrincipal(supabase);
  const demo = showNortePortal(principal?.client.markbox);
  const [todasLasFacturas, shipments, estimates, porAceptar] = await Promise.all([
    listMyInvoices(supabase),
    demo ? listMyShipments(supabase) : Promise.resolve<PortalShipmentRow[]>([]),
    demo ? listMyEstimates(supabase) : Promise.resolve<PortalEstimateRow[]>([]),
    // SDD-0543 · borradores DDP que esperan su aceptación de T&C: el portal los
    // oculta de la lista, pero el cliente tiene que saber que existen y cuánto son.
    principal
      ? loadPendingAcceptanceForClient(principal)
      : Promise.resolve([]),
  ]);
  const sumaPorAceptar = totalPorAceptar(porAceptar);
  // Los KPIs siguen midiendo TODO (el saldo total no cambia porque filtres la
  // vista); solo la lista se recorta. «Por pagar» = `saldoPorPagar` > 0: una
  // anulada nunca está por pagar (SDD-0556).
  const invoices = soloConSaldo
    ? todasLasFacturas.filter((inv) => saldoPorPagar(inv) > 0)
    : todasLasFacturas;
  const ocultas = todasLasFacturas.length - invoices.length;

  const approvedCount = shipments.filter((s) =>
    isActiveShipmentStatus(s.status),
  ).length;
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y tengo una consulta sobre mis facturas.",
  );

  // ── KPIs: una sola definición de deuda (SDD-0556) ──
  // Moneda dominante entre las vigentes; las anuladas no suman. Lo pagado en
  // anuladas no se resta: se informa aparte, en la nota de abajo.
  const r = resumenDeCuenta(todasLasFacturas);
  const notaAnuladas = notaPagosEnAnuladas(r.pagosEnAnuladas);
  // Con un sobrepago, facturado − pagado no da el saldo pendiente: la nota lo
  // explica bajo los KPIs. En el estado de cuenta va la versión del libro.
  const notaDeMas = notaSobrepagos(r.sobrepagos, r.currency, { donde: "kpis" });

  // SDD-0629 · el saldo pendiente en Bs a la tasa de hoy, solo vista. Con
  // monedas mezcladas el saldo de arriba es parcial: no se convierte.
  const hoy = fechaCaracas();
  const conBs = r.porPagar > 0 && !r.mixedCurrencies && !!principal;
  const tasasHoy = conBs
    ? await tasasReferencialesDelPortal(principal?.tenantId, [hoy])
    : new Map();
  const bsSaldo = equivalenteEnBs({
    amount: conBs ? r.porPagar : null,
    currency: r.currency,
    tasa: tasasHoy.get(hoy),
    fechaPedida: hoy,
  });

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Mis facturas.
      </h1>
      <p className="lead mt-3">
        {soloConSaldo
          ? "Estas son tus facturas por pagar. Entra a la que vas a reportar y sube el comprobante — tu asesor lo confirma."
          : "Tu estado de cuenta y comprobantes. Al pagar, entra a la factura y reporta tu pago con el comprobante — tu asesor lo confirma."}
      </p>

      {/* La vista filtrada avisa que está filtrada y ofrece la salida: si no,
          un cliente con facturas pagadas creería que se le perdieron. */}
      {soloConSaldo ? (
        <div
          className="mt-5 rounded-[12px] border border-grey-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ background: "var(--color-paper)" }}
        >
          <span className="text-[13px] text-grey-700">
            Mostrando solo las facturas <strong className="text-ink">por pagar</strong>
            {/* Las ocultas son pagadas o anuladas: «sin saldo» dice las dos. */}
            {ocultas > 0
              ? ` · ${ocultas} factura${ocultas === 1 ? "" : "s"} sin saldo oculta${
                  ocultas === 1 ? "" : "s"
                }`
              : ""}
          </span>
          <Link
            href="/portal/facturas"
            className="text-[12.5px] font-bold text-wine-text hover:underline"
          >
            Ver todas →
          </Link>
        </div>
      ) : null}

      {/* SDD-0543 · lo que está por aceptar va ANTES de la lista: el monto se ve
          acá y en el estado de cuenta; el detalle se abre cuando acepte. */}
      {porAceptar.length > 0 ? (
        <div className="mt-6">
          <PendingAcceptanceCard
            pending={porAceptar}
            heading={
              // Con una sola, la tarjeta ya pinta su monto: no se repite en el título.
              porAceptar.length === 1
                ? "Tienes 1 factura por aceptar."
                : `Tienes ${porAceptar.length} facturas por aceptar${sumaPorAceptar ? ` · ${formatInvoiceAmount(sumaPorAceptar.total, sumaPorAceptar.currency as InvoiceCurrency)}` : ""}.`
            }
          />
        </div>
      ) : null}

      {/* Card "ciclo" del Norte — GATEADA al demo (clientes reales no la ven). */}
      {demo ? (
        <InvoiceCycleCard
          estimatesCount={estimates.length}
          approvedCount={approvedCount}
          invoicesCount={invoices.length}
          invoicedLabel={formatInvoiceAmount(r.facturado, r.currency)}
        />
      ) : null}

      {/* El vacío de «no tienes facturas» sale sólo si de verdad no hay
          ninguna. Con `?saldo=1` y nada por pagar, los KPIs y la nota siguen a
          la vista y la lista dice que no hay facturas por pagar (SDD-0556). */}
      {todasLasFacturas.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          {/* SDD-0543 · con borradores por aceptar arriba, «no tienes facturas» se
              contradice: el vacío habla de facturas EMITIDAS y dice cuándo entran. */}
          <div className="text-[16px] font-bold text-ink">
            {porAceptar.length > 0 ? "Todavía no tienes facturas emitidas." : "Todavía no tienes facturas."}
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
            {porAceptar.length > 0
              ? `${porAceptar.length === 1 ? "La factura por aceptar que ves arriba" : `Las ${porAceptar.length} facturas por aceptar que ves arriba`}${
                  sumaPorAceptar ? ` (${formatInvoiceAmount(sumaPorAceptar.total, sumaPorAceptar.currency as InvoiceCurrency)})` : ""
                } ${porAceptar.length === 1 ? "entra" : "entran"} al estado de cuenta cuando ${porAceptar.length === 1 ? "la aceptes y se emita" : "las aceptes y se emitan"}; acá ${
                  porAceptar.length === 1 ? "la" : "las"
                } vas a ver con su estado de pago.`
              : "Cuando tu asesor emita una factura a tu nombre, va a aparecer acá con su estado de pago."}
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
        <>
          {/* KPIs */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Total facturado" value={formatInvoiceAmount(r.facturado, r.currency)} />
            <Kpi label="Pagado" value={formatInvoiceAmount(r.pagado, r.currency)} />
            <Kpi
              label="Saldo pendiente"
              value={formatInvoiceAmount(r.porPagar, r.currency)}
              highlight={r.porPagar > 0}
            />
          </div>
          {bsSaldo.estado !== "no-aplica" ? (
            <div className="mt-3 flex justify-end">
              <div className="max-w-[40ch]">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                  Saldo pendiente en bolívares
                </span>
                <EquivalenteBs eq={bsSaldo} leyenda />
              </div>
            </div>
          ) : null}
          {r.mixedCurrencies && (
            <p className="mt-3 text-[12px] text-grey-500">
              Montos en {r.currency}. Tienes facturas en otras monedas — abre cada una
              para ver su detalle.
            </p>
          )}
          {/* En el estado de cuenta la misma nota va bajo el libro
              (`StatementLedgerTable`); acá no se repite. */}
          {notaAnuladas && !vistaCuenta ? (
            <p className="mt-3 text-[12.5px] text-grey-700 leading-[1.5] max-w-[64ch]">
              {notaAnuladas}
            </p>
          ) : null}
          {notaDeMas && !vistaCuenta ? (
            <p className="mt-3 text-[12.5px] text-grey-700 leading-[1.5] max-w-[64ch]">
              {notaDeMas}
            </p>
          ) : null}

          {vistaCuenta ? (
            // El estado de cuenta se arma SIEMPRE con todas las facturas, aunque
            // esté puesto `?saldo=1`: un libro al que le faltan movimientos no
            // cuadra el saldo corrido, y eso es peor que no mostrarlo.
            <>
              {porAceptar.length > 0 ? (
                // Un borrador no es un cargo: entra al libro cuando se emite. Pero
                // el cliente tiene que ver que viene, para que el saldo no lo
                // sorprenda después (SDD-0543).
                <p className="mt-6 text-[12.5px] text-grey-700 leading-[1.5] max-w-[64ch]">
                  {porAceptar.length === 1 ? "Tienes 1 factura por aceptar" : `Tienes ${porAceptar.length} facturas por aceptar`}
                  {sumaPorAceptar
                    ? ` por ${formatInvoiceAmount(sumaPorAceptar.total, sumaPorAceptar.currency as InvoiceCurrency)}`
                    : ""}
                  {" "}que todavía no entran al estado de cuenta: entran cuando las aceptes y se emitan.
                </p>
              ) : null}
              <StatementLedgerTable invoices={todasLasFacturas} />
              {/* SDD-0287 · el documento que el cliente le pasa a su contador.
                  Sale del MISMO ledger que la tabla de arriba: si tuviera su
                  propio cálculo, el saldo del PDF y el de la pantalla podrían
                  discrepar — la discusión que un estado de cuenta viene a
                  evitar. */}
              {todasLasFacturas.length > 0 ? (
                // No es una página: es un route handler que devuelve el PDF
                // como `attachment`. `<Link>` haría prefetch y navegación de
                // cliente sobre un archivo binario.
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a
                  href="/portal/facturas/estado-de-cuenta/pdf"
                  className="btn btn-ghost mt-6 inline-flex"
                >
                  Descargar estado de cuenta en PDF
                </a>
              ) : null}
            </>
          ) : invoices.length === 0 ? (
            // `?saldo=1` sin nada por pagar: hay facturas, pero todas están
            // pagadas o anuladas. No es «no tienes facturas».
            <div className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] p-8 text-center">
              <div className="text-[15px] font-bold text-ink">
                No tienes facturas por pagar.
              </div>
              <p className="mt-2 text-[13.5px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
                Tus facturas están pagadas o anuladas. Usa «Ver todas» para revisarlas.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="mt-6 flex flex-col gap-3 sm:hidden">
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="mt-6 hidden sm:block card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden">
                <div className="grid grid-cols-[112px_1fr_96px_96px_112px_120px_44px] items-center gap-3 px-5 py-3 bg-paper border-b border-grey-200">
                  {["Factura", "Envío", "Emitida", "Vence", "Monto", "Estado", ""].map((h, i) => (
                    <span
                      key={h || "act"}
                      className={`text-[10.5px] font-bold tracking-[0.1em] uppercase text-grey-500 ${i === 4 ? "text-right" : ""}`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} inv={inv} />
                ))}
              </div>
            </>
          )}

          {/* Alternar lista ↔ estado de cuenta (Norte: dos lecturas del mismo
              dato, no dos pantallas). Conserva `?saldo=1` para no tirar el
              filtro al volver. */}
          <Link
            href={
              vistaCuenta
                ? `/portal/facturas${soloConSaldo ? "?saldo=1" : ""}`
                : `/portal/facturas?vista=cuenta${soloConSaldo ? "&saldo=1" : ""}`
            }
            className="btn btn-secondary mt-6 inline-flex"
          >
            {vistaCuenta ? "Ver como lista" : "Ver estado de cuenta"} <ArrowIcon />
          </Link>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </div>
      <div
        className="mt-2 text-[26px] leading-none text-ink"
        style={{
          fontFamily: "var(--font-archivo-black)",
          letterSpacing: "-0.01em",
          // Saldo pendiente con deuda → dorado (--warning, "atención"). Wine se
          // reserva para CTAs/marca, no para estados (regla del Norte).
          color: highlight ? "var(--color-status-warning)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableRow({ inv }: { inv: PortalInvoiceRow }) {
  return (
    <Link
      href={`/portal/facturas/${encodeURIComponent(inv.code)}`}
      className="group grid grid-cols-[112px_1fr_96px_96px_112px_120px_44px] items-center gap-3 px-5 py-3.5 border-b border-grey-200 last:border-0 hover:bg-paper focus-visible:bg-paper transition-colors"
      aria-label={`Ver detalle de la factura ${inv.code}`}
    >
      <code
        className="text-[13px] font-bold text-ink"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {inv.code}
      </code>
      <code
        className="text-[12.5px] text-grey-500 truncate"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {inv.shipmentCode ?? "—"}
      </code>
      <span
        className="text-[12px] text-grey-500"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatDate(inv.issuedAt)}
      </span>
      <span
        className="text-[12px] text-grey-700"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatDate(inv.dueDate)}
      </span>
      {/* SDD-0556 · una anulada sigue en la lista, con su monto tachado: se
          ve el documento, pero no es deuda. El badge dice «Anulada». */}
      <span
        className={`text-[13px] font-bold text-right ${
          esAnulada(inv) ? "line-through text-grey-500" : "text-ink"
        }`}
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {formatInvoiceAmount(inv.total, inv.currency)}
      </span>
      <div className="flex justify-start">
        <InvoiceStatusBadge status={inv.status} dueDate={inv.dueDate} />
      </div>
      <div className="flex justify-end">
        <ArrowIcon
          size={16}
          className="text-grey-300 group-hover:text-wine-text transition-colors"
        />
      </div>
    </Link>
  );
}
