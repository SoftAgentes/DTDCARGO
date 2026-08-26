import Link from "next/link";
import { type Service } from "@/lib/design-tokens";
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

/** Render de una card individual (reutilizable en las dos filas del grid y en /brochure) */
export function ServiceCard({ s }: { s: Service }) {
  const IconComponent = iconMap[s.icon as keyof typeof iconMap] ?? BoxIcon;
  const isDark = s.featured;
  return (
    <Link
      key={s.slug}
      href={`/servicios#${s.slug}`}
      className={`group rounded-[18px] p-7 flex flex-col min-h-[320px] transition-[transform,background-color,border-color] duration-150 hover:-translate-y-1 ${
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
