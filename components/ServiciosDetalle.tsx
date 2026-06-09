/**
 * Servicios en detalle — sección de fichas desplegables para /servicios (SDD-0063).
 *
 * Cada servicio pasa de tarjeta corta a FICHA COMPLETA: qué incluye / qué NO
 * incluye / precio o condición / cómo se solicita / tiempos. Acordeón nativo
 * (<details>) → el contenido vive en el DOM aunque esté colapsado, así el AI
 * Agent de Kommo (que crawlea dtdcargo.com) toma info certera.
 *
 * Server component: sin JS de cliente. El despliegue es HTML nativo.
 * Solo renderiza los campos con dato (los "" / [] pendientes de entrevista se
 * omiten) — nada inventado llega a la web.
 */
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  SERVICIOS_GRUPOS,
  SERVICIOS_POR_GRUPO,
  SERVICIOS_DETALLE_BY_SLUG,
  type ServicioDetalle,
} from "@/lib/servicios-detalle";
import {
  CheckIcon,
  CloseIcon,
  ArrowIcon,
  WhatsAppIcon,
  FlagCN,
  FlagVE,
} from "@/components/Icon";

const ESTADO_LABEL: Record<string, string> = {
  suspendido: "Suspendido",
  "a-pedido": "A pedido",
};

export function ServiciosDetalle() {
  return (
    <section className="py-16 lg:py-20" id="detalle">
      <div className="wrap">
        <span className="eyebrow">Servicios en detalle</span>
        <h2 className="h-section mt-4" style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
          Cada servicio,{" "}
          <span style={{ color: "var(--color-wine)" }}>sin letra chica.</span>
        </h2>
        <p className="lead mt-5 max-w-[58ch]">
          Qué incluye, qué no incluye, cómo se solicita y los tiempos — para que
          sepas exactamente qué contratas. Toca cada servicio para ver el detalle.
        </p>

        {/* Índice de salto */}
        <nav
          aria-label="Índice de servicios"
          className="mt-8 flex flex-wrap gap-2"
        >
          {SERVICIOS_GRUPOS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="inline-flex items-center px-3.5 py-2 rounded-full bg-white border border-grey-200 text-[13px] font-semibold text-ink hover:border-ink hover:text-wine transition-colors"
            >
              {g.titulo}
            </a>
          ))}
        </nav>

        {/* Grupos */}
        <div className="mt-12 flex flex-col gap-14">
          {SERVICIOS_GRUPOS.map((g) => {
            const slugs = SERVICIOS_POR_GRUPO[g.id] ?? [];
            return (
              <div key={g.id} id={g.id} className="scroll-mt-28">
                <h3
                  className="text-[22px] lg:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  {g.titulo}
                </h3>
                <p className="mt-2 text-[14.5px] leading-[1.55] text-grey-700 max-w-[64ch]">
                  {g.blurb}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  {slugs.map((slug) => {
                    const service = SERVICIOS_DETALLE_BY_SLUG[slug];
                    if (!service) return null;
                    return <FichaDetalle key={slug} service={service} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SedeFlag({ sede }: { sede: ServicioDetalle["sede"] }) {
  if (sede === "cn") return <FlagCN size={26} />;
  if (sede === "ve") return <FlagVE size={26} />;
  return (
    <span className="inline-flex items-center gap-0.5">
      <FlagCN size={22} />
      <FlagVE size={22} />
    </span>
  );
}

function FichaDetalle({ service }: { service: ServicioDetalle }) {
  const estado = service.estado ?? "activo";
  const hasIncluye = service.incluye.length > 0;
  const hasNoIncluye = service.noIncluye.length > 0;
  const cotizaMsg = buildWhatsAppLink(
    `Hola DTD Cargo, me interesa el servicio: ${service.titulo}. ¿Me pueden dar más información?`,
  );

  return (
    <details
      id={service.slug}
      open={service.destacado}
      className={`brochure-group scroll-mt-28 card-shadow bg-white border rounded-[14px] overflow-hidden group ${
        service.destacado ? "border-wine" : "border-grey-200"
      }`}
    >
      <summary className="cursor-pointer px-6 py-5 flex items-start gap-4 select-none">
        <span className="flex-shrink-0 mt-0.5">
          <SedeFlag sede={service.sede} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[16.5px] lg:text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
              {service.titulo}
            </span>
            {service.destacado && (
              <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md bg-wine text-white">
                Principal
              </span>
            )}
            {estado !== "activo" && (
              <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md bg-grey-100 text-grey-700">
                {ESTADO_LABEL[estado]}
              </span>
            )}
          </span>
          <span className="mt-1.5 block text-[14px] leading-[1.5] text-grey-700">
            {service.resumen}
          </span>
        </span>
        <span
          className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-grey-100 grid place-items-center text-wine text-[12px] leading-none transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>

      {/* Cuerpo del acordeón */}
      <div className="px-6 pb-6 pt-1 border-t border-grey-200">
        {(hasIncluye || hasNoIncluye) && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {hasIncluye && (
              <div>
                <FieldLabel>Qué incluye</FieldLabel>
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {service.incluye.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-grey-700">
                      <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
                        <CheckIcon size={12} />
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasNoIncluye && (
              <div>
                <FieldLabel>Qué no incluye</FieldLabel>
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {service.noIncluye.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-grey-700">
                      <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-grey-100 text-grey-500">
                        <CloseIcon size={12} />
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {(service.precio || service.tiempos || service.comoSolicitar) && (
          <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 border-t border-grey-200 pt-5 m-0">
            {service.precio && <FieldBlock term="Precio o condición" desc={service.precio} />}
            {service.tiempos && <FieldBlock term="Tiempos" desc={service.tiempos} />}
            {service.comoSolicitar && <FieldBlock term="Cómo se solicita" desc={service.comoSolicitar} />}
          </dl>
        )}

        {service.nota && (
          <p className="mt-5 text-[12.5px] leading-[1.5] text-grey-500">
            <span className="font-semibold text-grey-700">Nota:</span> {service.nota}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={cotizaMsg}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ height: 42, padding: "0 18px", fontSize: 14 }}
          >
            <WhatsAppIcon size={16} /> Consulta este servicio
          </a>
          {service.href && (
            <Link
              href={service.href}
              className="text-[13.5px] font-semibold text-wine hover:text-wine-deep inline-flex items-center gap-1.5"
            >
              Ver el detalle completo <ArrowIcon size={14} />
            </Link>
          )}
        </div>
      </div>
    </details>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-wine">
      {children}
    </span>
  );
}

function FieldBlock({ term, desc }: { term: string; desc: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500">
        {term}
      </dt>
      <dd className="m-0 mt-2 text-[14px] leading-[1.5] text-grey-700">{desc}</dd>
    </div>
  );
}
