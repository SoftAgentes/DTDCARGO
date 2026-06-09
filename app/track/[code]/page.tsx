/**
 * /track/[code] — Portal Cliente Tracking Real (Sprint A v2).
 *
 * Cero login. El código es la "auth" (URL típica que el admin manda
 * por WhatsApp: dtdcargo.com/track/S-2026-0142).
 *
 * Reescribe el page.tsx mock previo (DTDU-* hardcoded) usando la RPC
 * pública `public_track_shipment` (SECURITY DEFINER, grant anon) que
 * vive en supabase/migrations/0059_public_track_rpc.sql.
 *
 * UI: mantiene el lenguaje visual del sitio público (NO Studio dark).
 * Sumá foto POD si delivered + WhatsApp share con mensaje pre-poblado.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { TrackInput } from "@/components/TrackInput";
import { CONTACT } from "@/lib/design-tokens";
import {
  publicTrackShipment,
  estimateEta,
  type PublicTrackResult,
} from "@/lib/public/tracking-queries";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SERVICE_LABELS,
  type ShipmentStatus,
} from "@/lib/shared/shipment-public";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Tracking ${code}`,
    description: `Estado en tiempo real del envío ${code} de DTD Cargo.`,
    robots: { index: false, follow: false },
  };
}

/**
 * Status que en el timeline marcan un milestone "done" vs "active" vs "pending".
 * El status actual del shipment es siempre "active" en la vista; los anteriores
 * a él en orden cronológico son "done".
 */
const STATUS_ORDER: ShipmentStatus[] = [
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "delayed_warehouse",
  "out_for_delivery",
  "last_mile",
  "delivered",
];

async function getClientIpAsync(): Promise<string | null> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (!xff) return null;
    // Tomar la primera IP (la del cliente, no proxies)
    return xff.split(",")[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

export default async function TrackResultPage({ params }: Props) {
  const { code: decoded } = await params;
  const ip = await getClientIpAsync();
  const data = await publicTrackShipment(decoded, ip);

  return (
    <>
      <Nav />
      <main className="min-h-[70vh]">
        <section className="py-12 lg:py-20 bg-ink text-white">
          <div className="wrap">
            <div className="flex flex-col gap-6">
              <span
                className="eyebrow"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Tracking
              </span>
              <div
                className="text-[36px] lg:text-[56px] leading-none text-white"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  letterSpacing: "-0.02em",
                }}
              >
                {decoded}
              </div>
              <TrackInput defaultValue={decoded} />
            </div>
          </div>
        </section>

        {data.found ? (
          <FoundView data={data} code={decoded} />
        ) : (
          <NotFoundView code={decoded} />
        )}
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function FoundView({
  data,
  code,
}: {
  data: Extract<PublicTrackResult, { found: true }>;
  code: string;
}) {
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const statusColor = STATUS_COLORS[data.status] ?? "#0F1E3D";
  const serviceLabel = SERVICE_LABELS[data.shipment_service];
  const eta = estimateEta(data);
  const isDelivered = data.status === "delivered" || !!data.delivered_at;

  // Timeline: combinar eventos reales + milestones del enum status (los que aún no ocurrieron
  // se muestran como "pending"). Esto da continuidad visual aunque la operación todavía no
  // haya marcado todos los milestones.
  const eventByStatus = new Map<ShipmentStatus, { occurred_at: string; note: string | null }>();
  for (const e of data.events) {
    // Solo el primer evento por status (el más viejo, ya que viene ASC)
    if (!eventByStatus.has(e.status)) {
      eventByStatus.set(e.status, { occurred_at: e.occurred_at, note: e.note });
    }
  }
  const currentIdx = STATUS_ORDER.indexOf(data.status);
  const timeline = STATUS_ORDER.filter((s) => {
    // Mostrar todos los que ocurrieron + el actual + máximo 2 pending después.
    const idx = STATUS_ORDER.indexOf(s);
    return idx <= currentIdx + 2;
  }).map((s) => {
    const idx = STATUS_ORDER.indexOf(s);
    const evt = eventByStatus.get(s);
    let state: "done" | "active" | "pending";
    if (idx < currentIdx) state = "done";
    else if (idx === currentIdx) state = "active";
    else state = "pending";
    return {
      status: s,
      label: STATUS_LABELS[s],
      state,
      note: evt?.note ?? null,
      occurred_at: evt?.occurred_at ?? null,
    };
  });

  // WhatsApp share text
  const shareText = encodeURIComponent(
    `Mi envío DTD ${code} está en estado: ${statusLabel}` +
      (eta ? `. ETA: ${formatDate(eta)}.` : ".") +
      ` Seguilo en vivo: https://dtdcargo.com/track/${code}`,
  );
  const shareUrl = `https://wa.me/?text=${shareText}`;

  return (
    <section className="py-16 lg:py-20">
      <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
            style={{
              background: `${statusColor}15`,
              border: `1px solid ${statusColor}40`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: statusColor }}
            />
            <span
              className="text-[12px] font-bold tracking-[0.06em] uppercase"
              style={{ color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>

          <h2
            className="h-section mb-2"
            style={{ fontSize: "clamp(28px, 3.5vw, 42px)" }}
          >
            {isDelivered ? "Entregado" : "En curso"}
          </h2>
          <p className="lead">
            {isDelivered
              ? data.pod_signed_by
                ? `Recibido por ${data.pod_signed_by}.`
                : "Tu envío llegó a destino."
              : "Tu envío está en curso. La próxima actualización llegará por WhatsApp al confirmar el evento."}
          </p>

          <dl className="mt-8 flex flex-col gap-4 text-[14.5px]">
            <Field label="Origen" value={data.origin ?? "—"} />
            <Field label="Destino" value={data.destination ?? "—"} />
            <Field
              label="Servicio"
              value={
                serviceLabel
                  ? serviceLabel.sub
                    ? `${serviceLabel.primary} · ${serviceLabel.sub}`
                    : serviceLabel.primary
                  : data.shipment_service
              }
            />
            {!isDelivered && eta && (
              <Field
                label="Entrega estimada"
                value={formatDate(eta)}
                highlight
              />
            )}
            {isDelivered && data.delivered_at && (
              <Field
                label="Entregado el"
                value={formatDate(data.delivered_at)}
                highlight
              />
            )}
            {data.weight_kg && (
              <Field label="Peso" value={`${data.weight_kg.toFixed(0)} kg`} />
            )}
            {data.volume_m3 && (
              <Field label="Volumen" value={`${data.volume_m3.toFixed(2)} m³`} />
            )}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Compartir status
            </a>
            <a
              href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
                `Hola, tengo una consulta sobre mi envío ${code}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Preguntar por WhatsApp
            </a>
          </div>
        </div>

        <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-8 lg:p-10">
          <h3 className="text-[14px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-6">
            Timeline de eventos
          </h3>
          <div className="flex flex-col gap-5">
            {timeline.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[22px_1fr_auto] gap-4 items-center"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2"
                  style={{
                    background:
                      row.state === "done" || row.state === "active"
                        ? "var(--color-wine)"
                        : "var(--color-grey-300)",
                    borderColor:
                      row.state === "active"
                        ? "var(--color-paper)"
                        : row.state === "done"
                          ? "var(--color-wine)"
                          : "var(--color-grey-300)",
                    boxShadow:
                      row.state === "active"
                        ? "0 0 0 4px rgba(127,15,26,0.25)"
                        : undefined,
                  }}
                />
                <div>
                  <div className="text-[14.5px] font-semibold leading-[1.3] text-ink">
                    {row.label}
                  </div>
                  {row.note && (
                    <div className="text-[12.5px] leading-[1.3] text-grey-500 mt-0.5">
                      {row.note}
                    </div>
                  )}
                </div>
                <div className="text-[12px] font-semibold tracking-[0.06em] text-grey-500">
                  {row.occurred_at ? formatShortDate(row.occurred_at) : "—"}
                </div>
              </div>
            ))}
          </div>

          {data.pod_signed_by && (
            <div className="mt-8 pt-6 border-t border-grey-200">
              <h4 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-2">
                Prueba de entrega
              </h4>
              <p className="text-[14px] text-ink">
                Recibido por <strong>{data.pod_signed_by}</strong>
                {data.delivered_at &&
                  ` el ${formatDate(data.delivered_at)}.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NotFoundView({ code }: { code: string }) {
  return (
    <section className="py-16 lg:py-24">
      <div className="wrap max-w-[640px] text-center">
        <div
          className="text-[72px] mb-6"
          style={{
            fontFamily: "var(--font-archivo-black)",
            color: "var(--color-wine)",
          }}
        >
          404
        </div>
        <h2 className="h-section">No encontramos tu envío</h2>
        <p className="lead mx-auto mt-4">
          El código <strong className="text-ink">{code}</strong> no coincide con
          ninguno de nuestros envíos activos. Revisa la ortografía o escríbenos
          por WhatsApp y te ayudamos a buscarlo.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
              `Hola, no encuentro mi tracking ${code}. ¿Me podrían ayudar?`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Escribir por WhatsApp
          </a>
          <Link href="/track" className="btn btn-ghost">
            Probar otro código
          </Link>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </dt>
      <dd
        className={`text-[16px] ${
          highlight ? "font-extrabold text-wine" : "font-semibold text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}
