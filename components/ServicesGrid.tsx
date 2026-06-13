import Link from "next/link";
import { SERVICES_FEATURED, type Service } from "@/lib/design-tokens";
import {
  ArrowIcon,
  BoxIcon,
  CartIcon,
  ShieldIcon,
  StampIcon,
  PassportIcon,
  ContainerIcon,
  WarehouseIcon,
  CheckIcon,
  PaymentIcon,
  DocIcon,
  TruckIcon,
} from "./Icon";

const iconMap = {
  Box: BoxIcon,
  Cart: CartIcon,
  Shield: ShieldIcon,
  Stamp: StampIcon,
  Passport: PassportIcon,
  Container: ContainerIcon,
  Warehouse: WarehouseIcon,
  Check: CheckIcon,
  Payment: PaymentIcon,
  Doc: DocIcon,
  Truck: TruckIcon,
} as const;

type Props = {
  /** Si es true, oculta el header (eyebrow + título + lead). Default false. */
  noHead?: boolean;
  /** Override de servicios. Default: 5 featured del catálogo. */
  items?: readonly Service[];
};

/** Render de una card individual (reutilizable en las dos filas del grid y en /brochure) */
export function ServiceCard({ s }: { s: Service }) {
  const IconComponent = iconMap[s.icon as keyof typeof iconMap] ?? BoxIcon;
  const isDark = s.featured;
  return (
    <Link
      key={s.slug}
      href={`/servicios#${s.slug}`}
      className={`group rounded-[18px] p-7 flex flex-col min-h-[320px] transition-all duration-150 hover:-translate-y-1 ${
        isDark
          ? "border border-ink bg-ink text-white hover:bg-wine hover:border-wine"
          : "card-shadow border border-grey-200 bg-white hover:border-ink"
      }`}
    >
      <div
        className={`w-14 h-14 rounded-xl grid place-items-center mb-6 ${
          isDark ? "bg-white/10 text-white" : "bg-grey-100 text-ink"
        }`}
      >
        <IconComponent />
      </div>
      <div className={`h-card ${s.subtitle ? "mb-0.5" : "mb-2"} ${isDark ? "text-white" : "text-ink"}`}>
        {s.title}
      </div>
      {s.subtitle && (
        <div
          className={`text-[12.5px] leading-[1.3] mb-3 ${
            isDark ? "text-white/55" : "text-grey-500"
          }`}
        >
          {s.subtitle}
        </div>
      )}
      <p
        className={`text-[14px] leading-[1.5] flex-1 ${
          isDark ? "text-white/70" : "text-grey-700"
        }`}
      >
        {s.copy}
      </p>
      <div className="inline-flex items-center gap-2 text-[13px] font-semibold mt-4">
        Ver más{" "}
        <ArrowIcon
          className="transition-transform group-hover:translate-x-1"
          size={14}
        />
      </div>
    </Link>
  );
}

/**
 * Grid de servicios — layout asimétrico:
 *   Fila 1: 2 cards featured (dark, ancho completo en md:2col)
 *   Fila 2: 3 cards regulares (light, md:3col)
 * Por defecto usa SERVICES_FEATURED (5 items: 2 dark + 3 light).
 */
export function ServicesGrid({ noHead = false, items = SERVICES_FEATURED }: Props) {
  const featured = items.slice(0, 2);
  const rest = items.slice(2);

  return (
    <section className="py-20 lg:py-25" id="services">
      <div className="wrap">
        {!noHead && (
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-10 mb-14">
            <div>
              <span className="eyebrow">Servicios destacados</span>
              <h2 className="h-section mt-4">
                Una operación.
                <br />
                Todos los modos.
              </h2>
            </div>
            <p className="lead max-w-[36ch]">
              Suite completa entre China y Venezuela: desde sourcing y QC en
              Yiwu hasta entrega puerta a puerta en Caracas. Un solo
              responsable de coordinación de principio a fin.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Fila 1: las 2 cards featured (dark) — ancho completo, 2 columnas */}
          {featured.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featured.map((s) => (
                <ServiceCard key={s.slug} s={s} />
              ))}
            </div>
          )}

          {/* Fila 2: las 3 cards regulares (light) — 3 columnas */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((s) => (
                <ServiceCard key={s.slug} s={s} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/servicios"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink hover:text-wine"
          >
            Ver los 16 servicios completos <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
