import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { GEO_ZONAS } from "@/lib/geo-zonas";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { socialMeta } from "@/lib/seo-og";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { serializeJsonLd } from "@/lib/public/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Hub del cluster geo "Importar de China a {ciudad}". Da una entrada única al
 * silo: el footer enlaza acá (site-wide) y desde acá repartimos link equity a
 * las 14 páginas de ciudad. Lista ordenada por cercanía a la bodega de Valencia
 * (de 0 km hacia afuera). Fuente única: lib/geo-zonas.ts — sumar una zona la
 * agrega sola acá, en el sitemap y en los cross-links.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Importar de China a Venezuela, ciudad por ciudad | DTD Cargo",
  },
  description:
    "Importa de China a Venezuela puerta a puerta: carga consolidada DDP, pagas al llegar y entrega en tu ciudad. Cobertura nacional desde Valencia.",
  alternates: { canonical: "/importar-de-china" },
  ...socialMeta({
    title: "Importar de China a Venezuela, ciudad por ciudad | DTD Cargo",
    description:
      "Cobertura nacional puerta a puerta de China a Venezuela. Elige tu ciudad.",
    path: "/importar-de-china",
  }),
};

export default function ImportarHubPage() {
  const wa = buildWhatsAppLink(
    "Hola DTD Cargo, quiero importar de China a Venezuela. ¿Me ayudan a cotizar?",
  );

  // Orden de cercanía: desde la bodega de Valencia (0 km) hacia afuera.
  const zonas = [...GEO_ZONAS].sort((a, b) => a.km - b.km);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Importar de China a Venezuela por ciudad",
    itemListElement: zonas.map((z, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Importar de China a ${z.ciudad}`,
      url: `${SITE_URL}/importar-de-china/${z.slug}`,
    })),
  };

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(itemListJsonLd),
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Importar de China", path: "/importar-de-china" },
        ]}
      />

      {/* Revestido al Norte con la superficie de recursos (`.rp-surface`).
          Landing SEO/GEO: se cambia SOLO el envoltorio visual del hero. El
          copy, los encabezados, el grid de ciudades y todo el JSON-LD quedan
          palabra por palabra como estaban. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "920px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Cobertura nacional · Puerta a puerta
            </div>
            <h1>Importar de China a Venezuela, ciudad por ciudad.</h1>
            <p>
              Traemos tu carga consolidada de China puerta a puerta a todo el
              país: flete, aduana e impuestos incluidos (DDP), pagas cuando
              llega —no por adelantado— y entrega coordinada
              hasta tu ciudad.
              Todo sale de nuestra bodega propia en Valencia, donde recibimos la
              mercancía desde Yiwu.
            </p>
            <div className="rp-hero-actions">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <WhatsAppIcon size={18} /> Cotizar por WhatsApp
              </a>
              <a href="/tarifas" className="btn btn-ghost">
                Calcular mi envío <ArrowIcon size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* Grid de ciudades */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Elige tu ciudad</span>
            <h2 className="h-section mt-4">
              Entregamos en {zonas.length} ciudades de Venezuela.
            </h2>
            <p className="lead mt-5 max-w-[64ch]">
              Cada ciudad tiene su página con el detalle de la entrega. Si la
              tuya no está en la lista, igual llegamos: escríbenos y coordinamos
              el last-mile hasta tu puerta.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonas.map((z) => (
                <Link
                  key={z.slug}
                  href={`/importar-de-china/${z.slug}`}
                  className="card-link card-shadow bg-white border border-grey-200 rounded-[18px] p-7 group flex flex-col"
                >
                  <h3 className="h-card text-ink">{z.ciudad}</h3>
                  <span className="mt-1 text-[13.5px] text-grey-500">
                    {z.estado}
                  </span>
                  <span className="mt-4 text-[13px] leading-[1.5] text-grey-700 flex-1">
                    {z.casco
                      ? "Entrega incluida: no cobramos el tramo nacional."
                      : "Entrega hasta tu puerta, cobrada por metro cúbico."}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-wine group-hover:text-wine-deep transition-colors">
                    Ver detalle{" "}
                    <ArrowIcon
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
