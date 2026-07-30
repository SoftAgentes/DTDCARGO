/**
 * Comprobante de factura imprimible del portal (Norte · cierra el botón
 * "Descargar PDF · próximamente" del detalle de factura). Espeja el template de
 * factura del Norte (`docs/design/studio/_norte/factura-template/Factura · DTD-Cargo.html`)
 * con DATOS REALES de la factura del cliente (`getMyInvoice`, RLS-scopeada por
 * markbox) y el patrón print-friendly del recibo de cobranza del Studio
 * (SDD-0068): `@media print` oculta el cromo del portal y deja SOLO la hoja.
 *
 * BRAND-CHECK (documentado): la hoja usa una PALETA DE DOCUMENTO en variables
 * locales `--doc-*` con valores LIGHT CANÓNICOS del repo (NO hex inventados):
 * estructura (wine #7F0F1A, ink #0F1E3D, border, surface, base) del factura-template
 * del Norte y del bloque print del recibo del Studio; estados (success #1F8A5B,
 * warning #B8893A, danger #C2353F) de los `--color-status-*` del portal
 * (STATUS_COLORS en lib/portal/portal-types). Va fija a claro a propósito: un
 * comprobante es una hoja blanca tanto en pantalla (aunque el portal esté en modo
 * oscuro) como en papel, igual que el template del Norte que define su propio
 * `:root`. El logo sale por `<BrandMark>` (capa branding, Archivo Black inmune).
 *
 * El documento es un COMPROBANTE, NO una factura fiscal (la facturación fiscal
 * SENIAT es SDD-0073, write-path diferido) — se declara explícito en la nota al
 * pie, mismo criterio que el recibo del Studio ("NO constituye factura fiscal").
 * Sin razón social/RIF legal en texto visible (regla de marca: van sólo en schema).
 */
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getMyInvoice, getPortalClient } from "@/lib/portal/portal-queries";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import { buildComprobante } from "@/lib/portal/comprobante";
import { CONTACT } from "@/lib/design-tokens";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon } from "@/components/Icon";
import { PrintButton } from "./PrintButton";

type Props = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Comprobante ${decodeURIComponent(code)}` };
}

/** Paleta de documento (valores light canónicos del repo — ver cabecera). */
const DOC_PALETTE = {
  "--doc-wine": "#7F0F1A",
  "--doc-ink": "#0F1E3D",
  "--doc-ink-soft": "#6B6B6B",
  "--doc-ink-mute": "#9B9B9B",
  "--doc-border": "#E8E6E2",
  "--doc-surface": "#FFFFFF",
  "--doc-base": "#FBFAF7",
  "--doc-cream": "#FBFAF7",
  "--doc-success": "#1F8A5B",
  "--doc-warning": "#B8893A",
  "--doc-danger": "#C2353F",
} as CSSProperties;

export default async function PortalComprobantePage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const [inv, client] = await Promise.all([
    getMyInvoice(supabase, code),
    getPortalClient(supabase),
  ]);
  // La RLS + el filtro por markbox sólo devuelven facturas del cliente logueado;
  // si no hay match (ajena, borrador o inexistente) → 404. Igual que el detalle.
  if (!inv || !client) notFound();

  const c = buildComprobante(inv);
  const pill = statusPill(c, inv.dueDate);
  const generatedAt = formatDate(new Date().toISOString());

  return (
    <div style={DOC_PALETTE}>
      {/* Acciones de pantalla — NO van al papel. */}
      <div
        data-print-hide
        className="flex items-center justify-between gap-3 flex-wrap mb-6"
      >
        <Link
          href={`/portal/facturas/${encodeURIComponent(inv.code)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
        >
          <ArrowIcon size={15} className="rotate-180" /> Volver a la factura
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-grey-500 hidden sm:inline">
            Elige “Guardar como PDF” en el diálogo de impresión
          </span>
          <PrintButton />
        </div>
      </div>

      {/* La hoja — lo ÚNICO visible al imprimir. */}
      <article
        id="portal-comprobante"
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: "var(--doc-surface)",
          color: "var(--doc-ink)",
          border: "1px solid var(--doc-border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(15,30,61,.10)",
        }}
      >
        <div style={{ padding: "clamp(28px, 5vw, 48px) clamp(24px, 5vw, 52px)" }}>
          {/* ── Header: marca + meta del documento ── */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
              paddingBottom: 24,
              borderBottom: "2px solid var(--doc-ink)",
            }}
          >
            <div>
              <BrandMark variant="primary" size={40} />
              <div
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--doc-ink-soft)",
                  marginTop: 8,
                  letterSpacing: "0.01em",
                }}
              >
                Con <span style={{ color: "var(--doc-wine)" }}>Confianza</span>, de
                China a tu puerta.
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-0.01em",
                  color: "var(--doc-ink)",
                }}
              >
                COMPROBANTE
              </div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--doc-wine)",
                  marginTop: 3,
                }}
              >
                {inv.code}
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 9,
                  font: "700 10px/1 var(--font-archivo)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "5px 10px",
                  borderRadius: 999,
                  color: pill.color,
                  background: `color-mix(in srgb, ${pill.color} 14%, var(--doc-surface))`,
                }}
              >
                {pill.label}
              </span>
            </div>
          </header>

          {/* ── Partes: emisor / cliente ── */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 28,
              padding: "24px 0",
              borderBottom: "1px solid var(--doc-border)",
            }}
          >
            <Party label="Emisor">
              <PartyName>DTD Cargo</PartyName>
              <PartyLine>{CONTACT.ve.address}</PartyLine>
              <PartyLine>{CONTACT.ve.city}</PartyLine>
              <PartyLine mono>{CONTACT.emailGeneral}</PartyLine>
              <PartyLine mono>{CONTACT.web}</PartyLine>
            </Party>
            <Party label="Cliente">
              <PartyName>{inv.clientName}</PartyName>
              <PartyLine mono>
                Shipping Mark ·{" "}
                <b style={{ color: "var(--doc-wine)" }}>{client.markbox}</b>
              </PartyLine>
              {client.address ? <PartyLine>{client.address}</PartyLine> : null}
            </Party>
          </section>

          {/* ── Meta strip ── */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 1,
              background: "var(--doc-border)",
              border: "1px solid var(--doc-border)",
              borderRadius: 8,
              overflow: "hidden",
              margin: "22px 0",
            }}
          >
            <MetaCell k="Emisión" v={formatDate(inv.issuedAt)} />
            <MetaCell k="Vencimiento" v={formatDate(inv.dueDate)} />
            <MetaCell k="Embarque" v={inv.shipmentCode ?? "—"} />
            <MetaCell
              k="Moneda"
              v={
                inv.currency === "VES" && inv.fxRate
                  ? `${inv.currency} · BCV ${inv.fxRate.toFixed(2)}`
                  : inv.currency
              }
            />
          </section>

          {/* ── Conceptos ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th right>Cant.</Th>
                <Th right>Precio unit.</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody>
              {c.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "16px 12px",
                      fontSize: 12.5,
                      color: "var(--doc-ink-soft)",
                    }}
                  >
                    Sin conceptos cargados.
                  </td>
                </tr>
              ) : (
                c.lines.map((l, i) => (
                  <tr key={`${inv.code}-${i}`}>
                    <Td>
                      <div style={{ fontWeight: 600, color: "var(--doc-ink)" }}>
                        {l.desc}
                      </div>
                    </Td>
                    <Td right mono>
                      {l.qty}
                    </Td>
                    <Td right mono>
                      {formatInvoiceAmount(l.unitPrice, inv.currency)}
                    </Td>
                    <Td right mono>
                      {formatInvoiceAmount(l.subtotal, inv.currency)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ── Totales ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
            <div style={{ width: 320, maxWidth: "100%" }}>
              <TotalRow k="Subtotal" v={formatInvoiceAmount(c.subtotal, inv.currency)} />
              {c.ivaOn ? (
                <TotalRow
                  k={`IVA (${c.ivaRate.toFixed(0)}%)`}
                  v={formatInvoiceAmount(c.ivaAmount, inv.currency)}
                />
              ) : null}
              <div
                style={{
                  marginTop: 6,
                  borderTop: "2px solid var(--doc-ink)",
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--doc-ink)",
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontWeight: 700,
                    fontSize: 21,
                    color: "var(--doc-wine)",
                  }}
                >
                  {formatInvoiceAmount(c.total, inv.currency)}
                </span>
              </div>
              {c.paid > 0 ? (
                <TotalRow k="Pagado" v={formatInvoiceAmount(c.paid, inv.currency)} />
              ) : null}
              {c.hasBalance ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0 0",
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--doc-ink)" }}
                  >
                    Saldo pendiente
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontWeight: 800,
                      fontSize: 15,
                      color: "var(--doc-warning)",
                    }}
                  >
                    {formatInvoiceAmount(c.balance, inv.currency)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Nota (no fiscal) + notas de la factura ── */}
          <div
            style={{
              marginTop: 30,
              paddingTop: 22,
              borderTop: "1px solid var(--doc-border)",
            }}
          >
            <div
              style={{
                font: "700 12px/1.6 var(--font-archivo)",
                color: "var(--doc-ink)",
              }}
            >
              Este comprobante refleja el estado de tu cuenta con DTD Cargo. No
              constituye factura fiscal.
            </div>
            {inv.notes ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  color: "var(--doc-ink-soft)",
                }}
              >
                {inv.notes}
              </p>
            ) : null}
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 9.5,
                lineHeight: 1.6,
                color: "var(--doc-ink-mute)",
              }}
            >
              Generado el {generatedAt} · {client.markbox}
            </p>
          </div>
        </div>

        {/* ── Footer navy ── */}
        <footer
          style={{
            background: "var(--doc-ink)",
            color: "var(--doc-cream)",
            padding: "18px clamp(24px, 5vw, 52px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(251,250,247,.72)" }}>
            <b style={{ color: "var(--doc-cream)" }}>{CONTACT.legalName}</b> ·{" "}
            {CONTACT.emailGeneral} · {CONTACT.web}
          </div>
          <div
            style={{
              fontFamily: "var(--font-archivo-black)",
              fontWeight: 600,
              fontSize: 11,
              color: "var(--doc-wine)",
            }}
          >
            Con Confianza, de China a tu puerta.
          </div>
        </footer>
      </article>

      {/* Print: ocultar el cromo del portal y dejar SOLO la hoja (patrón recibo
          SDD-0068). La paleta ya es light fija (--doc-*) → no re-anclamos tokens. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #portal-comprobante, #portal-comprobante * { visibility: visible !important; }
          #portal-comprobante {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
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

/* ── Subcomponentes de la hoja (paleta --doc-*) ── */

function Party({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--font-archivo)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--doc-ink-mute)",
          marginBottom: 9,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function PartyName({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-archivo-black)",
        fontWeight: 700,
        fontSize: 15,
        color: "var(--doc-ink)",
        marginBottom: 2,
      }}
    >
      {children}
    </div>
  );
}

function PartyLine({
  children,
  mono = false,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: mono ? 11.5 : 12.5,
        color: mono ? "var(--doc-ink)" : "var(--doc-ink-soft)",
        margin: "1px 0",
        fontFamily: mono
          ? "var(--font-jetbrains-mono), ui-monospace, monospace"
          : undefined,
      }}
    >
      {children}
    </div>
  );
}

function MetaCell({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ background: "var(--doc-surface)", padding: "12px 14px" }}>
      <div
        style={{
          font: "700 9px/1 var(--font-archivo)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--doc-ink-mute)",
          marginBottom: 5,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontWeight: 600,
          fontSize: 12.5,
          color: "var(--doc-ink)",
          overflowWrap: "anywhere",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      style={{
        font: "700 9.5px/1.2 var(--font-archivo)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--doc-ink-mute)",
        textAlign: right ? "right" : "left",
        padding: "10px 12px",
        borderBottom: "2px solid var(--doc-ink)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right = false,
  mono = false,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "13px 12px",
        borderBottom: "1px solid var(--doc-border)",
        verticalAlign: "top",
        fontSize: 12.5,
        textAlign: right ? "right" : "left",
        fontFamily: mono
          ? "var(--font-jetbrains-mono), ui-monospace, monospace"
          : undefined,
        fontWeight: mono ? 500 : undefined,
        color: "var(--doc-ink)",
      }}
    >
      {children}
    </td>
  );
}

function TotalRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--doc-ink-soft)" }}>{k}</span>
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontWeight: 600,
          color: "var(--doc-ink)",
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* ── Estado visible del comprobante (pill) ── */

function statusPill(
  c: ReturnType<typeof buildComprobante>,
  dueDate: string | null,
): { label: string; color: string } {
  if (c.isPaid) return { label: "Pagada", color: "var(--doc-success)" };
  if (c.hasBalance && isPast(dueDate))
    return { label: "Vencida", color: "var(--doc-danger)" };
  if (c.hasBalance) return { label: "Pendiente", color: "var(--doc-warning)" };
  return { label: "Emitida", color: "var(--doc-ink-soft)" };
}

function isPast(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

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
