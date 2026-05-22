import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { TrackInput } from "@/components/TrackInput";
import { CONTACT } from "@/lib/design-tokens";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Tracking ${decodeURIComponent(code)}`,
    description: `Estado en tiempo real del envío ${decodeURIComponent(code)} de DTD·CARGO.`,
    robots: { index: false, follow: false },
  };
}

type TrackEvent = {
  state: "done" | "active" | "pending";
  title: string;
  meta: string;
  time: string;
};

/**
 * Página de resultado de tracking.
 *
 * MOCK: actualmente devuelve un timeline de ejemplo. Cuando el ERP exponga
 * `GET {NEXT_PUBLIC_HAILUWAY_API}/api/public/track/[code]` (SDD-0008), reemplazamos
 * `mockTracking` por `fetch(...)` en server.
 */
async function getTracking(code: string): Promise<{
  found: boolean;
  origin?: string;
  destination?: string;
  service?: string;
  estimatedDelivery?: string;
  events: TrackEvent[];
} | null> {
  // TODO: reemplazar por fetch real cuando endpoint del ERP esté listo
  // const r = await fetch(`${process.env.NEXT_PUBLIC_HAILUWAY_API}/api/public/track/${encodeURIComponent(code)}`, { next: { revalidate: 60 } });
  // if (!r.ok) return r.status === 404 ? { found: false, events: [] } : null;
  // return r.json();

  // Mock de ejemplo
  if (code.toUpperCase().startsWith("DTDU")) {
    return {
      found: true,
      origin: "Yiwu, CN",
      destination: "Puerto Cabello, VE",
      service: "Carga suelta DDP",
      estimatedDelivery: "15 JUN 2026",
      events: [
        { state: "done", title: "Inspección de fábrica · OK", meta: "Yiwu · 8 cajas · 0 observaciones", time: "08 MAY" },
        { state: "done", title: "Carga en depósito DTD", meta: "Yiwu Bonded Warehouse · YBW-12", time: "11 MAY" },
        { state: "done", title: "Embarque COSCO PISCES · ETD", meta: "Ningbo → Puerto Cabello", time: "14 MAY" },
        { state: "active", title: "En tránsito — Pacífico Sur", meta: "Próximo evento: Canal de Panamá", time: "HOY" },
        { state: "pending", title: "Arribo Puerto Cabello · ETA", meta: "Terminal Bolipuertos", time: "12 JUN" },
        { state: "pending", title: "Entrega puerta · DDP cerrado", meta: "Valencia, VE", time: "15 JUN" },
      ],
    };
  }
  return { found: false, events: [] };
}

export default async function TrackResultPage({ params }: Props) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);
  const data = await getTracking(decoded);

  return (
    <>
      <Nav />
      <main className="min-h-[70vh]">
        <section className="py-12 lg:py-20 bg-ink text-white">
          <div className="wrap">
            <div className="flex flex-col gap-6">
              <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
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

        {data?.found ? (
          <section className="py-16 lg:py-20">
            <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12">
              <div>
                <h2 className="h-section mb-2" style={{ fontSize: "clamp(28px, 3.5vw, 42px)" }}>
                  En tránsito
                </h2>
                <p className="lead">
                  Tu envío está en camino. La próxima actualización llegará por
                  WhatsApp al confirmar el evento.
                </p>
                <dl className="mt-8 flex flex-col gap-4 text-[14.5px]">
                  <Field label="Origen" value={data.origin ?? "—"} />
                  <Field label="Destino" value={data.destination ?? "—"} />
                  <Field label="Servicio" value={data.service ?? "—"} />
                  <Field label="Entrega estimada" value={data.estimatedDelivery ?? "—"} highlight />
                </dl>
              </div>

              <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-8 lg:p-10">
                <h3 className="text-[14px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-6">
                  Timeline de eventos
                </h3>
                <div className="flex flex-col gap-5">
                  {data.events.map((row, i) => (
                    <div key={i} className="grid grid-cols-[22px_1fr_auto] gap-4 items-center">
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
                          {row.title}
                        </div>
                        <div className="text-[12.5px] leading-[1.3] text-grey-500 mt-0.5">
                          {row.meta}
                        </div>
                      </div>
                      <div className="text-[12px] font-semibold tracking-[0.06em] text-grey-500">
                        {row.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16 lg:py-24">
            <div className="wrap max-w-[640px] text-center">
              <div
                className="text-[72px] mb-6"
                style={{ fontFamily: "var(--font-archivo-black)", color: "var(--color-wine)" }}
              >
                404
              </div>
              <h2 className="h-section">No encontramos tu envío</h2>
              <p className="lead mx-auto mt-4">
                El código <strong className="text-ink">{decoded}</strong> no coincide
                con ninguno de nuestros envíos activos. Revisá la ortografía o
                escríbenos por WhatsApp y te ayudamos a buscarlo.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <a
                  href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
                    `Hola, no encuentro mi tracking ${decoded}. ¿Me podrían ayudar?`
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
        )}
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
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
