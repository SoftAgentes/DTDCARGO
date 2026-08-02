import type { Metadata } from "next";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, DownloadIcon } from "@/components/Icon";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { loadBrandCatalog } from "@/lib/marca/catalog-queries";
import {
  BRAND_BOOK_DOWNLOAD_NAME,
  BRAND_BOOK_URL,
  BRAND_BOOK_VERSION,
} from "@/lib/marca/brand-book";
import { formatBytes } from "@/lib/marca/catalog-types";
import { CONTACT, SHADOWS } from "@/lib/design-tokens";
import { BrandGate } from "./_components/BrandGate";
import { CatalogClient } from "./_components/CatalogClient";
import { ZipButton } from "./_components/ZipButton";
import { lockBrandAction } from "./actions";

/**
 * Centro de marca — `/marca` (SDD-0238).
 *
 * ESTE ES EL LINK QUE SE LE MANDA A DISEÑO. Una sola URL, protegida con un
 * código de 4-6 dígitos que el founder pone desde el ERP.
 *
 * ESTA PÁGINA ES EL MARCO; el catálogo interactivo (buscador, selección,
 * descargas) vive en `<CatalogClient>` porque necesita estado compartido entre
 * secciones — la selección tiene que sobrevivir el scroll de "Logos" a
 * "Tipografía".
 *
 * QUÉ CAMBIÓ EN EL REDISEÑO:
 *  · El Brand Book dejó de venir EMBEBIDO en un iframe. Eran 13,5 MB en la
 *    primera sección, y en el teléfono el scroll se peleaba entre el iframe y la
 *    página. Ahora es una tarjeta con "Leer" (pantalla completa) y "Descargar".
 *  · El hero pasó de un titular a pantalla casi completa a una línea con el dato
 *    útil. Quien abre esto ya sabe qué es: se lo dijeron por WhatsApp junto con
 *    el código. Gastarle la primera pantalla en explicárselo otra vez es
 *    gastarle el momento de más atención.
 */

export const metadata: Metadata = {
  title: `Centro de marca · DTD Cargo`,
  description: "Brand book, logos y recursos de marca de DTD Cargo.",
  // Triple noindex: este meta + X-Robots-Tag (next.config) + Disallow (robots.ts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// La página depende de la cookie del gate → nunca estática.
export const dynamic = "force-dynamic";

const HEADER_H = "64px";

export default async function MarcaPage() {
  // El gate: sesión del ERP o cookie del código. Sin ninguna de las dos, lo
  // único que se renderiza es el formulario — el catálogo ni se consulta.
  if (!(await hasBrandAccess())) return <BrandGate />;

  const tenantId = await resolveBrandTenantId();
  const catalog = tenantId ? await loadBrandCatalog(tenantId) : [];

  // El Brand Book tiene su propia tarjeta arriba: sacarlo de la lista evita que
  // aparezca dos veces y que su sección de un solo archivo compita con Logos.
  const bookSection = catalog.find((s) => s.slug === "brand-book");
  const sections = catalog.filter((s) => s.slug !== "brand-book");

  const totalAssets = catalog.reduce((n, s) => n + s.assets.length, 0);
  const totalBytes = catalog.reduce(
    (n, s) => n + s.assets.reduce((m, a) => m + (a.bytes ?? 0), 0),
    0,
  );
  const withFiles = sections.filter((s) => s.assets.length > 0).length;

  return (
    <div className={`bg-paper min-h-screen text-ink ${jetbrainsMonoUi.variable}`}>
      {/* Header propio: /marca no cuelga del layout del sitio público ni del ERP */}
      <header
        className="sticky top-0 z-30 bg-paper border-b border-grey-200"
        style={{ height: HEADER_H }}
      >
        <div className="wrap h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark variant="primary" size={30} />
            <span className="text-[14px] font-bold text-ink truncate">
              Centro de marca
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalAssets > 0 && (
              <ZipButton
                href="/api/marca/bundle/todo"
                filename="dtd-kit-de-marca"
                className="btn btn-ghost"
                style={{ height: 38, fontSize: 13 }}
                ariaLabel={`Descargar los ${totalAssets} archivos del centro de marca`}
              >
                <span className="hidden sm:inline">Descargar todo</span>
                <span className="sm:hidden">Todo</span>
              </ZipButton>
            )}
            <form action={lockBrandAction}>
              <button
                type="submit"
                className="text-[12.5px] font-semibold text-grey-500 hover:text-ink px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Encabezado compacto: el dato útil, no el eslogan. */}
      <section className="pt-8 pb-7 lg:pt-11 lg:pb-9">
        <div className="wrap">
          <h1 className="h-display" style={{ fontSize: "clamp(30px, 3.6vw, 44px)" }}>
            La marca, <span style={{ color: "var(--color-wine)" }}>lista para usar.</span>
          </h1>
          <p
            className="mt-3 text-[13px] text-grey-700"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {totalAssets} {totalAssets === 1 ? "archivo" : "archivos"}
            {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`} · Brand Book{" "}
            {BRAND_BOOK_VERSION}
          </p>
          <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.55] max-w-[58ch]">
            Marca lo que necesites y bájalo en un solo paquete, o descarga sección
            por sección. {withFiles === 0 && "El equipo está cargando el material."}
          </p>
        </div>
      </section>

      {/* Brand Book: tarjeta, no iframe. */}
      <section className="pb-4">
        <div className="wrap">
          <div
            className="rounded-[18px] bg-ink overflow-hidden p-7 lg:p-9 flex flex-col md:flex-row md:items-center justify-between gap-6"
            style={{ boxShadow: SHADOWS.card }}
          >
            <div className="min-w-0">
              <span
                className="text-[11px] font-bold tracking-[0.14em] uppercase"
                style={{ color: "var(--color-wine-soft)" }}
              >
                El documento maestro
              </span>
              <h2
                className="mt-3 text-white text-[26px] lg:text-[32px] leading-[1.1]"
                style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
              >
                Brand Book {BRAND_BOOK_VERSION}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] max-w-[52ch] text-white/75">
                La identidad completa: cuándo usar cada cosa y por qué. Léelo en
                pantalla o llévatelo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 flex-shrink-0">
              <a href="/marca/brand-book" className="btn btn-primary">
                Leer <ArrowIcon />
              </a>
              <a
                href={BRAND_BOOK_URL}
                download={BRAND_BOOK_DOWNLOAD_NAME}
                className="btn btn-ghost-inv"
              >
                Descargar <DownloadIcon size={16} />
              </a>
            </div>
          </div>

          {/* Si Marketing subió algo más a la sección del book (una versión en
              PDF, por ejemplo), no se pierde por haberla sacado de la lista. */}
          {bookSection && bookSection.assets.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[13px] text-grey-700">
                Hay {bookSection.assets.length} archivos en esta sección.
              </span>
              <ZipButton
                href="/api/marca/bundle/brand-book"
                filename="dtd-brand-book"
                className="btn btn-ghost"
                style={{ height: 36, fontSize: 12.5 }}
              >
                Descargarlos todos
              </ZipButton>
            </div>
          )}
        </div>
      </section>

      {sections.length === 0 ? (
        <div className="wrap py-16">
          <div className="rounded-[16px] border border-dashed border-grey-300 bg-white p-10 text-center">
            <p className="text-[15px] font-bold text-ink">
              El catálogo todavía está vacío.
            </p>
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
              El equipo de DTD Cargo carga los archivos desde el ERP. Escríbenos y
              te los pasamos mientras tanto.
            </p>
            <a
              href={`mailto:${CONTACT.ve.email}?subject=${encodeURIComponent("DTD Cargo — archivos de marca")}`}
              className="btn btn-primary mt-6"
            >
              Escribir al equipo <ArrowIcon />
            </a>
          </div>
        </div>
      ) : (
        <CatalogClient sections={sections} headerHeight={HEADER_H} />
      )}

      <footer className="border-t border-grey-200 py-8">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-grey-500">
          <span>
            ¿Falta un archivo fuente?{" "}
            <a
              href={`mailto:${CONTACT.ve.email}?subject=${encodeURIComponent("DTD Cargo — archivos fuente de marca")}`}
              className="font-semibold text-wine underline underline-offset-2"
            >
              Pídelo acá
            </a>
            .
          </span>
          <span>© {new Date().getFullYear()} DTD Cargo</span>
        </div>
      </footer>
    </div>
  );
}
