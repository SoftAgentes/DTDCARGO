import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { getPendingAcceptanceInvoice } from "@/lib/portal/portal-legal-queries";
import { currentClientDocs } from "@/lib/studio/legal/queries";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import type { InvoiceCurrency } from "@/lib/portal/portal-types";
import { ArrowIcon } from "@/components/Icon";
import { AcceptanceForm } from "./AcceptanceForm";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Aceptar términos · ${decodeURIComponent(code)}` };
}

/**
 * Página de aceptación de T&C del cliente (SDD-0054 · Slice C).
 *
 * Resuelve identidad por SESIÓN (getPortalClient) → con admin client (los
 * borradores los oculta el portal) lee la orden DDP pendiente + las 2 docs
 * vigentes. Si no aplica (no es borrador / no DDP / ya aceptada / ajena) →
 * redirect a /portal/facturas. Render: resumen de la orden + cuerpo de los dos
 * documentos (colapsables) + AcceptanceForm (checkbox + confirmar).
 */
export default async function AcceptTermsPage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) redirect("/portal/login");

  const admin = createAdminClient();

  const { data: clientRow } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = String(clientRow?.tenant_id ?? "").trim();
  if (!tenantId) redirect("/portal/facturas");

  const order = await getPendingAcceptanceInvoice(admin, {
    tenantId,
    markbox: client.markbox,
    code,
  });
  if (!order) redirect("/portal/facturas");

  const docs = await currentClientDocs(admin, tenantId);
  const currency = order.currency as InvoiceCurrency;

  return (
    <div>
      <Link
        href="/portal/facturas"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
      >
        <ArrowIcon size={15} className="rotate-180" /> Volver a mis facturas
      </Link>

      <div className="mt-5">
        <span className="eyebrow">Aceptación de términos</span>
        <h1
          className="h-display mt-3"
          style={{ fontSize: "clamp(26px, 4vw, 40px)" }}
        >
          Confirmá tu orden
        </h1>
        <p className="lead mt-2 max-w-[60ch]">
          Antes de emitir tu factura, necesitamos que aceptes los términos y
          confirmes el monto y la medida de esta orden de puerta a puerta DDP
          (prepago).
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-8 items-start">
        {/* Documentos legales vigentes */}
        <div className="flex flex-col gap-5">
          {docs.length === 0 ? (
            <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
              <p className="text-[13.5px] text-grey-700">
                No hay términos vigentes para mostrar en este momento. Contactá a
                tu asesor.
              </p>
            </div>
          ) : (
            docs.map((doc) => (
              <details
                key={`${doc.key}-${doc.version}`}
                className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden"
              >
                <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between gap-3 select-none">
                  <span>
                    <span className="text-[15px] font-bold text-ink">
                      {doc.name}
                    </span>
                    <span
                      className="ml-2 text-[12px] text-grey-500"
                      style={{
                        fontFamily:
                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                      }}
                    >
                      {doc.version}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-wine">
                    Ver / ocultar
                  </span>
                </summary>
                <div className="px-6 pb-6 pt-1 border-t border-grey-200 flex flex-col gap-4 max-h-[420px] overflow-auto">
                  {doc.body.map(([heading, paragraph], i) => (
                    <div key={i}>
                      {heading ? (
                        <div className="text-[13px] font-bold text-ink">
                          {heading}
                        </div>
                      ) : null}
                      {paragraph ? (
                        <p className="mt-1 text-[13px] text-grey-700 leading-[1.6]">
                          {paragraph}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>

        {/* Resumen de la orden + aceptación */}
        <div className="flex flex-col gap-5">
          <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6 sm:p-8">
            <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
              Resumen de la orden
            </h2>

            <div className="mt-5 flex flex-col divide-y divide-grey-200">
              {order.lines.length === 0 ? (
                <p className="text-[13.5px] text-grey-500">
                  Sin conceptos cargados.
                </p>
              ) : (
                order.lines.map((line, i) => {
                  const subtotal =
                    (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                  return (
                    <div
                      key={`${order.code}-${i}`}
                      className="py-3 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-ink">
                          {line.desc}
                        </div>
                        <div
                          className="text-[12px] text-grey-500"
                          style={{
                            fontFamily:
                              "var(--font-jetbrains-mono), ui-monospace, monospace",
                          }}
                        >
                          {line.qty} × {formatInvoiceAmount(line.unitPrice, currency)}
                        </div>
                      </div>
                      <div
                        className="text-[14px] font-semibold text-ink whitespace-nowrap"
                        style={{
                          fontFamily:
                            "var(--font-jetbrains-mono), ui-monospace, monospace",
                        }}
                      >
                        {formatInvoiceAmount(subtotal, currency)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <dl className="mt-5 pt-4 border-t border-grey-200 flex flex-col gap-2.5">
              <Row label="Subtotal" value={formatInvoiceAmount(order.baseAmount, currency)} />
              {order.ivaRate > 0 ? (
                <Row
                  label={`IVA (${order.ivaRate.toFixed(0)}%)`}
                  value={formatInvoiceAmount(order.ivaAmount, currency)}
                />
              ) : null}
              <Row
                label="Total"
                value={formatInvoiceAmount(order.totalAmount, currency)}
                strong
              />
            </dl>

            <dl className="mt-5 pt-4 border-t border-grey-200 flex flex-col gap-3">
              {order.shipmentCode ? (
                <Field label="Envío asociado" value={order.shipmentCode} mono />
              ) : null}
              {order.cbm != null ? (
                <Field label="Volumen" value={`${order.cbm.toFixed(2)} m³`} mono />
              ) : null}
              {order.weightKg != null ? (
                <Field label="Peso" value={`${order.weightKg.toFixed(0)} kg`} mono />
              ) : null}
            </dl>
          </div>

          <AcceptanceForm invoiceCode={order.code} />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={`text-[13px] ${strong ? "font-bold text-ink" : "text-grey-700"}`}>
        {label}
      </dt>
      <dd
        className={`text-[14px] whitespace-nowrap ${
          strong ? "font-extrabold text-ink" : "font-semibold text-ink"
        }`}
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className="text-[14px] font-semibold text-ink"
        style={
          mono
            ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
            : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}
