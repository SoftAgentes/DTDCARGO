/**
 * Barra de "Descargas rápidas" del hub de marca — lo más usado a 1 clic, arriba.
 * Mega-botón "Descargar todo el kit" + chips. Los `.zip` van a route handlers
 * gateados (`/interno/marca/d/<bundle>`); los estáticos usan `<a download>`.
 */

import { DownloadIcon } from "@/components/Icon";
import { BRAND_ASSETS, SHADOWS } from "@/lib/design-tokens";

type Chip = { label: string; sub: string; href: string; download?: string };

export function QuickDownloads({
  brandBook,
  brandBookVersion,
}: {
  brandBook: string;
  brandBookVersion: string;
}) {
  const chips: Chip[] = [
    { label: "Logos", sub: ".zip · 4 variantes + OG + favicon", href: "/interno/marca/d/logos" },
    {
      label: "Brand Book",
      sub: `${brandBookVersion} · HTML`,
      href: brandBook,
      download: `Brand Book DTD ${brandBookVersion}.html`,
    },
    { label: "Kit WhatsApp", sub: ".zip · generador + guía + doc", href: "/interno/marca/d/whatsapp" },
    { label: "OG / redes", sub: "1200×630 PNG", href: BRAND_ASSETS.ogImage, download: "dtdcargo-og.png" },
  ];

  return (
    <section id="descargas-rapidas" className="scroll-mt-[116px] bg-paper border-t border-grey-200 py-8 lg:py-10">
      <div className="wrap">
        <div
          className="rounded-[18px] border border-grey-200 bg-white p-6 lg:p-7"
          style={{ boxShadow: SHADOWS.card }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <span className="eyebrow">Descargas rápidas</span>
              <p className="text-[14px] text-grey-700 mt-1.5">Lo más usado, a un clic.</p>
            </div>
            {/* route handler de descarga (zip), no una page → <a> es lo correcto */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/interno/marca/d/todo" className="btn btn-primary flex-shrink-0">
              Descargar todo el kit <DownloadIcon size={16} />
            </a>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {chips.map((c) => (
              <a
                key={c.href}
                href={c.href}
                download={c.download}
                className="group flex items-center justify-between gap-2 rounded-[12px] border border-grey-200 bg-paper px-4 py-3 hover:border-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-colors"
              >
                <span className="flex flex-col min-w-0">
                  <span className="text-[14px] font-bold text-ink">{c.label}</span>
                  <span className="text-[11.5px] text-grey-700 mt-0.5 truncate">{c.sub}</span>
                </span>
                <span className="grid place-items-center w-8 h-8 rounded-full border border-grey-200 text-grey-500 group-hover:text-wine group-hover:border-wine transition-colors flex-shrink-0">
                  <DownloadIcon size={15} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
