/**
 * Tarjeta de herramienta interna — compartida por el índice (`/interno`) y el hub
 * de marca (`/interno/marca`). Un solo componente para evitar drift de
 * tamaños/hover/placeholder entre páginas (recomendación del UI/UX review).
 */

import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";

export function ToolCard({
  href,
  title,
  desc,
  meta,
}: {
  href: string;
  title: string;
  desc: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[16px] border border-grey-200 bg-white p-6 hover:border-ink hover:shadow-[0_10px_24px_-12px_rgba(15,30,61,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-[box-shadow,border-color]"
    >
      <span className="eyebrow text-grey-500">{meta}</span>
      <span
        className="mt-3 text-[20px] text-ink leading-tight"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
      >
        {title}
      </span>
      <span className="mt-2 text-[14px] text-grey-700 leading-[1.55] flex-1">{desc}</span>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-wine">
        Abrir <ArrowIcon />
      </span>
    </Link>
  );
}

export function ToolCardPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-[16px] border border-dashed border-grey-300 bg-paper p-6 text-grey-500">
      <span className="text-[13.5px] leading-[1.5]">{children}</span>
    </div>
  );
}
