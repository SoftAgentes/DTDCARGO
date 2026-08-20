/**
 * Cuerpo presentacional de una ficha de servicio + helpers de cabecera.
 *
 * Extraído de ServiciosDetalle para compartirlo entre:
 *  - el panel protagonista de DDP (server, abierto siempre), y
 *  - las tarjetas del explorador (client, acordeón <details>).
 *
 * Presentacional puro (sin "use client" → usable desde server y client).
 * Solo lee campos PÚBLICOS de ServicioDetalle; el contenido sigue intacto en
 * lib/servicios-detalle.ts (o lo alimenta el ERP vía getServiciosParaSitio()).
 */
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  CheckIcon,
  CloseIcon,
  ArrowIcon,
  WhatsAppIcon,
  FlagCN,
  FlagVE,
} from "@/components/Icon";
import { SegmentosGlosario } from "@/components/TerminoGlosario";
import { ambitoGlosario } from "@/lib/glosario-enlaces";
import type { ServicioDetalle } from "@/lib/servicios-detalle";

export const ESTADO_LABEL: Record<string, string> = {
  suspendido: "Suspendido",
  "a-pedido": "A pedido",
  proximamente: "Próximamente",
};

export function SedeFlag({ sede }: { sede: ServicioDetalle["sede"] }) {
  if (sede === "cn") return <FlagCN size={26} />;
  if (sede === "ve") return <FlagVE size={26} />;
  return (
    <span className="inline-flex items-center gap-0.5">
      <FlagCN size={22} />
      <FlagVE size={22} />
    </span>
  );
}

export function FichaCuerpo({ service }: { service: ServicioDetalle }) {
  const hasIncluye = service.incluye.length > 0;
  const hasNoIncluye = service.noIncluye.length > 0;

  // La ficha es UNA pieza para el lector, aunque por dentro sean muchos textos
  // cortos. Un ámbito compartido enlaza cada término una sola vez en toda la
  // ficha; sin él la del LCL consolidado llevaría 7 enlaces para 3 términos.
  // Se resuelve acá, antes del JSX: mutar el registro mientras renderizan los
  // hijos rompería en desarrollo, donde React invoca el render dos veces.
  // El orden de estas llamadas es el orden en que se ven en pantalla — así el
  // enlace cae en la primera mención que el lector encuentra, no en otra.
  const glosar = ambitoGlosario();
  const incluyeSegs = service.incluye.map((t) => glosar(t));
  const noIncluyeSegs = service.noIncluye.map((t) => glosar(t));
  const precioSegs = service.precio ? glosar(service.precio) : null;
  const notaTablaSegs = service.precioTabla?.nota
    ? glosar(service.precioTabla.nota)
    : null;
  const tiemposSegs = service.tiempos ? glosar(service.tiempos) : null;
  const comoSegs = service.comoSolicitar ? glosar(service.comoSolicitar) : null;
  const notaSegs = service.nota ? glosar(service.nota) : null;
  const cotizaMsg = buildWhatsAppLink(
    `Hola DTD Cargo, me interesa el servicio: ${service.titulo}. ¿Me pueden dar más información?`,
  );

  return (
    <div className="px-6 pb-6 pt-1 border-t border-grey-200">
      {(hasIncluye || hasNoIncluye) && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {hasIncluye && (
            <div>
              <FieldLabel>Qué incluye</FieldLabel>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {service.incluye.map((it, i) => (
                  <li key={it} className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-grey-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
                      <CheckIcon size={12} />
                    </span>
                    <SegmentosGlosario segmentos={incluyeSegs[i]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasNoIncluye && (
            <div>
              <FieldLabel>Qué no incluye</FieldLabel>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {service.noIncluye.map((it, i) => (
                  <li key={it} className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-grey-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center flex-shrink-0 bg-grey-100 text-grey-500">
                      <CloseIcon size={12} />
                    </span>
                    <SegmentosGlosario segmentos={noIncluyeSegs[i]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {service.precioTabla && (
        <div className="mt-6 border-t border-grey-200 pt-5">
          <FieldLabel>Precio · comisión por monto</FieldLabel>
          {precioSegs && (
            <p className="mt-2 text-[14px] leading-[1.5] text-grey-700 max-w-[62ch]">
              <SegmentosGlosario segmentos={precioSegs} />
            </p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  {service.precioTabla.columnas.map((col, i) => (
                    <th
                      key={col}
                      className={`border-b border-grey-200 pb-2 text-[10.5px] font-bold tracking-[0.08em] uppercase text-grey-500 ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {service.precioTabla.filas.map((fila) => (
                  <tr key={fila[0]}>
                    {fila.map((celda, i) => (
                      <td
                        key={`${fila[0]}-${i}`}
                        className={`border-b border-grey-100 py-2.5 ${
                          i === 0
                            ? "text-left font-medium text-ink"
                            : "text-right font-semibold tabular-nums text-grey-700"
                        }`}
                      >
                        {celda}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {notaTablaSegs && (
            <p className="mt-3 text-[12.5px] leading-[1.5] text-grey-500">
              <SegmentosGlosario segmentos={notaTablaSegs} />
            </p>
          )}
        </div>
      )}

      {((service.precio && !service.precioTabla) ||
        service.tiempos ||
        service.comoSolicitar) && (
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 border-t border-grey-200 pt-5 m-0">
          {precioSegs && !service.precioTabla && (
            <FieldBlock
              term="Precio o condición"
              desc={<SegmentosGlosario segmentos={precioSegs} />}
            />
          )}
          {tiemposSegs && (
            <FieldBlock term="Tiempos" desc={<SegmentosGlosario segmentos={tiemposSegs} />} />
          )}
          {comoSegs && (
            <FieldBlock
              term="Cómo se solicita"
              desc={<SegmentosGlosario segmentos={comoSegs} />}
            />
          )}
        </dl>
      )}

      {notaSegs && (
        <p className="mt-5 text-[12.5px] leading-[1.5] text-grey-500">
          <span className="font-semibold text-grey-700">Nota:</span>{" "}
          <SegmentosGlosario segmentos={notaSegs} />
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
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-wine">
      {children}
    </span>
  );
}

function FieldBlock({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500">
        {term}
      </dt>
      <dd className="m-0 mt-2 text-[14px] leading-[1.5] text-grey-700">{desc}</dd>
    </div>
  );
}
