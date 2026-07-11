/**
 * Recibo de cobranza imprimible (SDD-0068 · decisión #6 — COPY_LEGAL_UI §2).
 *
 * Server component. Gating = usuario del tenant (`user_tenants`) — Cobranzas
 * NO es admin-only, a diferencia del expediente legal (0067) del que calca el
 * patrón print-friendly: `@media print` oculta el shell del Studio y deja SOLO
 * el recibo, con los tokens re-anclados a su valor light canónico de
 * tokens.css (no son hex inventados) para que dark mode no sangre al papel.
 *
 * El contenido lo arma el builder PURO `buildReceiptDoc` (string-exacto contra
 * el COPY §2, testeado): leyenda de mandato, Ref. envío, pagador (tercero con
 * relación), "Recibido por: Inversiones DTD Services, C.A. …" (BRAND-CHECK
 * documentado en el spec — la razón social SÍ va en este documento legal),
 * "NO constituye factura fiscal" y la versión del Acuerdo de Servicios
 * (aceptación vigente de la orden → legal_docs vigente → "v—").
 * Cero "DoorTuDoor Trading" / J-50220185 (regla absoluta del handoff).
 *
 * Un pago sin referencia también es imprimible: Ref. = "Pendiente de
 * identificación" + estado visible al cliente (constancia de COPY §3/§7).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  currentClientDocs,
  listAcceptanceEvidenceByQuote,
} from "@/lib/studio/legal/queries";
import { getReceiptByCode } from "@/lib/studio/payment-queries";
import {
  applicationStatusLabel,
  applicationStatusTone,
  fundClassLabel,
  fundClassTone,
  paymentMethodLabel,
} from "@/lib/studio/payment-types";
import {
  buildReceiptDoc,
  fmtAmount,
  pickAcuerdoVersion,
  type ReceiptTemplateInvoice,
} from "@/lib/studio/receipts/receipt-template";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Recibo de cobranza · DTD Studio" };
export const dynamic = "force-dynamic";

const FIELD_LABEL: React.CSSProperties = {
  font: "700 9.5px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const FIELD_VALUE: React.CSSProperties = {
  font: "600 12.5px/1.5 var(--f-mono)",
  color: "var(--ink)",
  overflowWrap: "anywhere",
  margin: "3px 0 0",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={FIELD_LABEL}>{label}</div>
      <div style={FIELD_VALUE}>{value}</div>
    </div>
  );
}

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw ?? "").trim();

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pídele a un admin que te agregue al equipo."
      />
    );
  }

  const receipt = await getReceiptByCode(supabase, {
    tenantId: link.tenant_id,
    code,
  });

  if (!receipt) {
    return (
      <EmptyState
        eyebrow="Recibo"
        title="No existe ese recibo."
        description={`No encontramos el recibo "${code}" en este tenant (los anulados no se muestran).`}
      />
    );
  }

  // Factura asociada (null para un pago sin referencia aún no identificado).
  let invoice: ReceiptTemplateInvoice = null;
  if (receipt.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("invoice_code, shipment_code, client_markbox")
      .eq("id", receipt.invoice_id)
      .maybeSingle<{
        invoice_code: string;
        shipment_code: string | null;
        client_markbox: string | null;
      }>();
    invoice = inv ?? null;
  }

  // Versión del Acuerdo de Servicios: aceptación vigente del cliente para ESA
  // orden (reusa lib/studio/legal) → fallback legal_docs vigente → "v—".
  let acuerdoVersion: string | null = null;
  try {
    const orderRef = invoice?.shipment_code?.trim() ?? "";
    const [acceptances, vigentes] = await Promise.all([
      orderRef
        ? listAcceptanceEvidenceByQuote(supabase, {
            tenantId: link.tenant_id,
            quoteCode: orderRef,
          })
        : Promise.resolve([]),
      currentClientDocs(supabase, link.tenant_id),
    ]);
    acuerdoVersion = pickAcuerdoVersion(
      acceptances.map((a) => ({
        docs: a.acceptance.docs,
        hash_verified: a.hash_verified,
      })),
      vigentes.map((d) => ({ key: d.key, version: d.version })),
    );
  } catch {
    acuerdoVersion = null; // best-effort: el recibo imprime "v—"
  }

  const doc = buildReceiptDoc({ receipt, invoice, acuerdoVersion });
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Acciones de pantalla — NO van al papel (data-print-hide). */}
      <div
        data-print-hide
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <Link
          className="studio-btn studio-btn-ghost studio-btn-sm"
          href="/studio/cobranzas"
        >
          ← Volver a Cobranzas
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone={applicationStatusTone(receipt.application_status)} dot>
            {applicationStatusLabel(receipt.application_status)}
          </Badge>
          <Badge tone={fundClassTone(receipt.fund_class)}>
            {fundClassLabel(receipt.fund_class)}
          </Badge>
          <PrintButton />
        </div>
      </div>

      {/* El recibo — lo ÚNICO visible al imprimir. */}
      <div
        id="recibo-cobranza"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 28,
        }}
      >
        {/* Encabezado + leyenda de mandato (COPY §2, literal) */}
        <div
          style={{
            paddingBottom: 14,
            borderBottom: "2px solid var(--ink)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              className="studio-display"
              style={{ font: "800 19px/1.2 var(--f-display)", color: "var(--ink)" }}
            >
              {doc.title}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={FIELD_LABEL}>Recibo</div>
              <div
                style={{
                  font: "800 16px/1.2 var(--f-mono)",
                  color: "var(--wine-text)",
                  marginTop: 3,
                }}
              >
                {receipt.receipt_code}
              </div>
            </div>
          </div>
          <div
            style={{
              font: "700 11.5px/1.5 var(--f-sans)",
              color: "var(--ink)",
              marginTop: 10,
            }}
          >
            {doc.legend}
          </div>
          <div
            style={{
              font: "500 11.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            {doc.serviceLine}
          </div>
        </div>

        {/* Estado visible al cliente (solo pagos sin identificar — COPY §3/§7) */}
        {doc.estadoCliente && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--warning-bg)",
              borderRadius: "var(--r-md)",
              margin: "14px 0 0",
              font: "600 11.5px/1.5 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Estado: {doc.estadoCliente}
          </div>
        )}

        {/* Monto — ancla visual del documento probatorio (el dato que el
            lector busca primero). El texto plano del recibo mantiene la línea
            "Monto: … · Canal: …" del COPY §2; acá solo cambia la jerarquía. */}
        <div
          style={{
            marginTop: 16,
            padding: "var(--s-3) var(--s-4)",
            background: "var(--bg-base)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={FIELD_LABEL}>Monto recibido</div>
          <div
            style={{
              font: "700 24px/1.1 var(--f-mono)",
              color: "var(--ink)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {fmtAmount(receipt.amount)}{" "}
            <span style={{ fontSize: 15, color: "var(--ink-soft)" }}>
              {receipt.currency}
            </span>
          </div>
        </div>

        {/* Campos del recibo (COPY §2) */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 24,
            }}
          >
            <Field label="Ref. envío" value={doc.refEnvio} />
            <Field label="Cliente" value={doc.cliente} />
            <Field label="Pagador" value={doc.pagador} />
            <Field label="Factura" value={invoice?.invoice_code ?? "—"} />
            <Field label="Canal de pago" value={paymentMethodLabel(receipt.method)} />
            <Field
              label="Fecha de recepción de fondos"
              value={receipt.received_at}
            />
          </div>
          <Field label="Recibido por" value={doc.recibidoPor.replace("Recibido por: ", "")} />
        </div>

        {/* Pie probatorio (COPY §2, literal). La negación "NO constituye
            factura fiscal" es la advertencia legalmente crítica → peso propio,
            por encima de la nota del Acuerdo. */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ font: "700 12.5px/1.6 var(--f-sans)", color: "var(--ink)" }}>
            {doc.noFiscal}
          </div>
          <div
            style={{
              font: "500 11px/1.6 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {doc.acuerdoLine}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            font: "500 9.5px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Recibo generado el {generatedAt} (UTC) · DTD Cargo.
        </div>
      </div>

      {/* Print: ocultar el shell del Studio y dejar SOLO el recibo (patrón
          0067/Reportes). Tokens re-anclados al valor light canónico. */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #recibo-cobranza, #recibo-cobranza * { visibility: visible !important; }
          #recibo-cobranza {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --wine: #7F0F1A;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
            --bg-base: #FBFAF7;
            --warning-bg: rgba(184,137,58,0.12);
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            border-radius: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
