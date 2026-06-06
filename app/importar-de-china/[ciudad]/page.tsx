import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { HowWeWork } from "@/components/HowWeWork";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { GEO_ZONAS, getGeoZona } from "@/lib/geo-zonas";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Páginas geo-locales "Importar de China a {zona}". Datos + contenido genuino
 * (verificado, sin invención ni duplicado) viven en lib/geo-zonas.ts — fuente
 * única para esta ruta, el sitemap y los cross-links. Cada zona consolida
 * ciudad + estado para capturar ambas búsquedas sin canibalizar.
 */
export function generateStaticParams() {
  return GEO_ZONAS.map((z) => ({ ciudad: z.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad } = await params;
  const z = getGeoZona(ciudad);
  if (!z) return {};
  return {
    title: { absolute: z.metaTitle },
    description: z.metaDescription,
    alternates: { canonical: `/importar-de-china/${z.slug}` },
    openGraph: {
      title: z.metaTitle,
      description: z.metaDescription,
      url: `/importar-de-china/${z.slug}`,
    },
  };
}

export default async function ImportarCiudadPage({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const z = getGeoZona(ciudad);
  if (!z) notFound();

  const wa = buildWhatsAppLink(
    `Hola DTD Cargo, quiero importar de China a ${z.ciudad} (${z.estado}). ¿Me ayudan a cotizar?`,
  );

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Importar de China a ${z.ciudad}`,
    serviceType: "Carga consolidada DDP China → Venezuela puerta a puerta",
    description: z.metaDescription,
    areaServed: [
      { "@type": "City", name: z.ciudad, containedInPlace: { "@type": "Country", name: "Venezuela" } },
      { "@type": "AdministrativeArea", name: z.estado },
    ],
    provider: { "@type": "LocalBusiness", name: "DTD Cargo", url: SITE_URL },
    url: `${SITE_URL}/importar-de-china/${z.slug}`,
  };

  const otras = GEO_ZONAS.filter((o) => o.slug !== z.slug);

  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: `Importar de China a ${z.ciudad}`, path: `/importar-de-china/${z.slug}` },
        ]}
      />

      <main>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">China → {z.ciudad} · DDP puerta a puerta</span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(34px, 5.5vw, 68px)" }}>
              {z.h1}
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              Carga consolidada puerta a puerta de China a {z.ciudad}: flete, aduana
              e impuestos incluidos, y pagás cuando tu mercancía llega a Venezuela.
              Operamos desde 2010 con equipo y bodega propios en Yiwu y Valencia.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <WhatsAppIcon size={18} /> Cotizar por WhatsApp
              </a>
              <a href="/calculadora" className="btn btn-ghost">
                Calcular mi envío <ArrowIcon size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* Cómo llega a la zona — contenido genuino por ubicación */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">Entrega en {z.ciudad} · {z.estado}</span>
            <h2 className="h-section mt-4">Cómo llega tu carga a {z.ciudad}.</h2>
            <p className="lead mt-5 max-w-[64ch]">{z.anguloLocal}</p>
            <p className="mt-5 text-[15px] leading-[1.6] text-grey-700 max-w-[64ch]">
              {z.notaEntrega} Tu mercancía se consolida e inspecciona en nuestra
              bodega de Yiwu (China) antes de embarcar y viaja en modalidad DDP
              hasta Venezuela — un solo punto de contacto de la fábrica a tu puerta.
            </p>
          </div>
        </section>

        {/* Por qué DTD */}
        <section className="py-16 lg:py-20 bg-paper">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Por qué importar con DTD</span>
            <h2 className="h-section mt-4">De China a {z.ciudad}, con confianza.</h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { t: "Financiamiento 100%", d: "Pagás cuando tu carga llega a Venezuela, no por adelantado." },
                { t: "Inspección en fábrica", d: "Verificamos tu mercancía en China antes de embarcar. Cero estafas." },
                { t: "Equipo y bodega propios", d: "Operación propia en Yiwu y Valencia. No somos un intermediario remoto." },
                { t: "Un solo punto de contacto", d: `Una persona coordina todo tu envío hasta ${z.ciudad}.` },
              ].map((w) => (
                <div key={w.t} className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7">
                  <h3 className="h-card text-ink mb-2">{w.t}</h3>
                  <p className="text-[14.5px] leading-[1.55] text-grey-500">{w.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cobertura nacional — links internos a las otras zonas */}
        <section className="py-12 lg:py-14 bg-grey-100">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">Importamos a todo el país</span>
            <p className="mt-4 text-[15px] text-grey-700">
              También traemos carga de China puerta a puerta a otras zonas de Venezuela:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2.5 list-none p-0">
              {otras.map((o) => (
                <li key={o.slug}>
                  <a
                    href={`/importar-de-china/${o.slug}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-white border border-grey-200 text-[14px] font-semibold text-ink hover:border-ink transition-colors"
                  >
                    {o.ciudad}{" "}
                    <span className="text-grey-500 font-normal">· {o.estado}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              <a
                href="/importar-de-china"
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-wine hover:text-wine-deep transition-colors"
              >
                Ver todas las ciudades que cubrimos{" "}
                <ArrowIcon size={14} />
              </a>
            </p>
          </div>
        </section>

        <HowWeWork />
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
