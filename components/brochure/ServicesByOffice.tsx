import { SERVICES_CN, SERVICES_VE, type Service } from "@/lib/design-tokens";
import { ServiceCard } from "@/components/ServicesGrid";

/** Mapa slug → servicio (China + Venezuela: los 16). */
const BY_SLUG: Record<string, Service> = Object.fromEntries(
  [...SERVICES_CN, ...SERVICES_VE].map((s) => [s.slug, s]),
);

/** El héroe: carga consolidada puerta a puerta, todo pagado (≈95% del negocio real). */
const HERO = BY_SLUG["dtd-services-lcl"];

/**
 * Los otros 15 servicios agrupados por función (jerarquía C de la design
 * review), en orden de viaje del cliente: compras → controlas → mueves → tramitas.
 */
const GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Compra y pagos en China", slugs: ["compra-asistida", "asesoria-pagos"] },
  {
    title: "Control de calidad e inspección",
    slugs: [
      "chequeo-etiquetado",
      "verificacion-proveedores",
      "auditoria-calidad",
      "lab-permisologia",
    ],
  },
  {
    title: "Logística y consolidación",
    slugs: [
      "reserva-contenedores",
      "consolidacion-bodega-yiwu",
      "muestras-courier",
      "transito-aduana",
      "last-mile",
    ],
  },
  {
    title: "Trámites y documentos",
    slugs: [
      "registro-marca-cn",
      "registro-marca-coord",
      "visado-chino",
      "documentos-importacion",
    ],
  },
];

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Grilla de los 16 servicios para /brochure.
 * - Puerta a puerta consolidado = card héroe (featured, ancho completo).
 * - Resto en 4 grupos `<details>` colapsables (nativo → teclado/lector de
 *   pantalla gratis). En `@media print` se fuerzan todos abiertos
 *   (ver globals.css + DownloadPdfButton) para que el PDF muestre los 16.
 */
export function ServicesByOffice() {
  return (
    <section className="py-16 lg:py-20 bg-paper" id="servicios">
      <div className="wrap">
        <span className="eyebrow">16 servicios</span>
        <h2 className="h-section mt-4">Todo lo que mueve tu carga.</h2>
        <p className="lead mt-3 max-w-[60ch]">
          Del sourcing en China a la entrega en tu puerta en Venezuela. Un solo
          equipo, de punta a punta.
        </p>

        {/* Héroe — puerta a puerta consolidado */}
        {HERO && (
          <div className="mt-10">
            <ServiceCard s={HERO} />
          </div>
        )}

        {/* Los otros 15, agrupados y colapsables */}
        <div className="mt-5 flex flex-col gap-4">
          {GROUPS.map((g) => {
            const items = g.slugs
              .map((slug) => BY_SLUG[slug])
              .filter((s): s is Service => Boolean(s));
            return (
              <details
                key={g.title}
                className="brochure-group group card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer select-none min-h-[44px]">
                  <span className="h-card text-ink">{g.title}</span>
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-grey-500">
                    {items.length} servicios
                    <ChevronDown className="transition-transform duration-200 group-open:rotate-180" />
                  </span>
                </summary>
                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => (
                    <ServiceCard key={s.slug} s={s} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
