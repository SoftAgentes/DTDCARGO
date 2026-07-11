/**
 * Rendición imprimible (SDD-0069 · decisión #8b) — hoja formal de cuentas a la
 * Operadora.
 *
 * Server component, ADMIN-ONLY (la rendición es compliance del mandato). Calca
 * el patrón print-friendly del recibo de cobranza (0068) / expediente legal
 * (0067): `@media print` oculta el shell del Studio y deja SOLO el documento,
 * con los tokens re-anclados a su valor light canónico de tokens.css (no son
 * hex inventados) para que dark mode no sangre al papel.
 *
 * El contenido lo arma el builder PURO `buildRenditionPrintable` (string-exacto
 * contra el copy, testeado): encabezado "RENDICIÓN DE CUENTAS A LA OPERADORA",
 * código RND-, período, 3 totales con su base, tabla de recibos y el pie
 * "Inversiones DTD Services, C.A., en su condición de agente de cobranza de la
 * Operadora." CERO "Canopy" / "DoorTuDoor Trading" / J-50220185 (regla absoluta).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { getRenditionWithReceipts } from "@/lib/studio/renditions/queries";
import {
  buildRenditionPrintable,
  fmtUsd,
} from "@/lib/studio/renditions/printable";
import {
  renditionStatusLabel,
  renditionStatusTone,
} from "@/lib/studio/renditions/types";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Rendición · Operadora · DTD Studio" };
export const dynamic = "force-dynamic";

const LABEL: React.CSSProperties = {
  font: "700 9.5px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export default async function RenditionPrintPage({
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
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pídele a un admin que te agregue al equipo."
      />
    );
  }

  // Admin-only (la rendición es compliance del dueño).
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const data = await getRenditionWithReceipts(supabase, {
    tenantId: link.tenant_id,
    code,
  });

  if (!data) {
    return (
      <EmptyState
        eyebrow="Rendición"
        title="No existe esa rendición."
        description={`No encontramos la rendición "${code}" en este tenant.`}
      />
    );
  }

  const doc = buildRenditionPrintable({
    rendition: data.rendition,
    lines: data.lines,
  });
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Acciones de pantalla — NO van al papel. */}
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
          href="/studio/rendiciones"
        >
          ← Volver a Rendiciones
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone={renditionStatusTone(data.rendition.status)} dot>
            {renditionStatusLabel(data.rendition.status)}
          </Badge>
          <Link
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={`/studio/rendiciones/${data.rendition.rendition_code}/export`}
            prefetch={false}
          >
            Exportar CSV
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* El documento — lo ÚNICO visible al imprimir. */}
      <div
        id="rendicion-doc"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 28,
        }}
      >
        {/* Encabezado */}
        <div style={{ paddingBottom: 14, borderBottom: "2px solid var(--ink)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                className="studio-display"
                style={{ font: "800 19px/1.2 var(--f-display)", color: "var(--ink)" }}
              >
                {doc.title}
              </div>
              <div
                style={{
                  font: "500 11.5px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                {doc.subtitle}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={LABEL}>Rendición</div>
              <div
                style={{
                  font: "800 16px/1.2 var(--f-mono)",
                  color: "var(--wine-text)",
                  marginTop: 3,
                }}
              >
                {doc.code}
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-mono)",
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                {doc.periodLine}
              </div>
            </div>
          </div>
        </div>

        {/* Aviso de anulación, si aplica */}
        {doc.voidNotice && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--danger-bg)",
              borderRadius: "var(--r-md)",
              margin: "14px 0 0",
              font: "700 12px/1.5 var(--f-sans)",
              color: "var(--danger)",
            }}
          >
            {doc.voidNotice}
          </div>
        )}

        {/* 3 totales con su base */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 0 }}>
          {doc.totals.map((t, i) => {
            const isNet = i === doc.totals.length - 1;
            return (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  // El neto = saldo a favor de la Operadora = cifra-conclusión
                  // del documento → bloque destacado con fondo + más peso.
                  padding: isNet ? "12px 14px" : "10px 0",
                  marginTop: isNet ? 4 : 0,
                  background: isNet ? "var(--bg-base)" : "transparent",
                  borderRadius: isNet ? "var(--r-md)" : 0,
                  borderTop: isNet ? "2px solid var(--ink)" : "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    font: `${isNet ? 700 : 500} 12.5px/1.4 var(--f-sans)`,
                    color: isNet ? "var(--ink)" : "var(--ink-soft)",
                    maxWidth: 480,
                  }}
                >
                  {t.label}
                </span>
                <span
                  style={{
                    font: `${isNet ? 800 : 600} ${isNet ? 22 : 14}px/1 var(--f-mono)`,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                  }}
                >
                  USD {t.formatted}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabla de recibos */}
        <div style={{ marginTop: 22 }}>
          <div style={{ ...LABEL, marginBottom: 8 }}>
            Recibos incluidos ({doc.lines.length})
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              font: "500 11.5px/1.4 var(--f-sans)",
            }}
          >
            <thead>
              <tr>
                {["Recibo", "Cliente", "Shipping Mark", "Ref. envío", "Fecha", "USD"].map(
                  (h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 5 ? "right" : "left",
                        padding: "6px 8px",
                        font: "700 9px/1 var(--f-sans)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.receiptId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td
                    style={{
                      padding: "6px 8px",
                      font: "600 11px/1 var(--f-mono)",
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.receiptCode}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{l.clientName ?? "—"}</td>
                  <td
                    style={{
                      padding: "6px 8px",
                      font: "500 10.5px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.clientMarkbox ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      font: "500 10.5px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.reference ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      whiteSpace: "nowrap",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {l.receivedAt}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      font: "600 11px/1 var(--f-mono)",
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtUsd(l.amountUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie probatorio (literal). La razón social SÍ va en este documento. */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ font: "700 12.5px/1.6 var(--f-sans)", color: "var(--ink)" }}>
            {doc.footer}
          </div>
          <div
            style={{
              font: "500 9.5px/1.6 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-2) 0 0",
            }}
          >
            Documento generado el {generatedAt} (UTC) · DTD Cargo. Bases: el
            recaudado de terceros es base caja; los servicios locales facturados
            son base devengado.
          </div>
        </div>
      </div>

      {/* Print: ocultar el shell del Studio y dejar SOLO el documento. Tokens
          re-anclados al valor light canónico (no sangra el dark mode). */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #rendicion-doc, #rendicion-doc * { visibility: visible !important; }
          #rendicion-doc {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --ink-mute: #9A958C;
            --wine: #7F0F1A;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
            --bg-base: #FBFAF7;
            --danger: #B0142B;
            --danger-bg: rgba(176,20,43,0.10);
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
