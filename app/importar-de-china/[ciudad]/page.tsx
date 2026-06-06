import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { HowWeWork } from "@/components/HowWeWork";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { CIUDADES } from "@/lib/calculadora";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/**
 * Páginas geo-locales "Importar de China a {ciudad}".
 *
 * Contenido GENUINO por ciudad (no doorway pages): cada una usa datos reales de
 * lib/calculadora (distancia desde la bodega de Valencia + si entra en el casco
 * central) para describir la entrega de forma distinta. Para sumar una ciudad:
 * agregá su `id` acá (debe existir en CIUDADES) — la ruta y el contenido se
 * generan solos. Recordá sumarla también al sitemap + un link interno.
 */
const GEO_CITIES = ["caracas"] as const;

function cityLabel(label: string) {
  return label.replace(/\s*\(.*\)\s*/, "").trim();
}

function getCity(slug: string) {
  if (!(GEO_CITIES as readonly string[]).includes(slug)) return null;
  return CIUDADES.find((c) => c.id === slug) ?? null;
}

export function generateStaticParams() {
  return GEO_CITIES.map((ciudad) => ({ ciudad }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad } = await params;
  const city = getCity(ciudad);
  if (!city) return {};
  const name = cityLabel(city.label);
  return {
    title: `Importar de China a ${name}`,
    description: `Carga consolidada DDP puerta a puerta de China a ${name}, Venezuela. Financiamiento 100% (pagás cuando llega), inspección en fábrica y entrega en ${name}. Equipo y bodega propios en Yiwu y Valencia desde 2010.`,
    alternates: { canonical: `/importar-de-china/${ciudad}` },
    openGraph: {
      title: `Importar de China a ${name} · DTD Cargo`,
      url: `/importar-de-china/${ciudad}`,
    },
  };
}

export default async function ImportarCiudadPage({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const city = getCity(ciudad);
  if (!city) notFound();
  const name = cityLabel(city.label);

  const entrega = city.casco
    ? `${name} está en nuestro casco central de entrega (junto con Valencia y Maracay). Tu carga llega sin recargo por distancia desde nuestra bodega en Valencia.`
    : `Entregamos en ${name}, a ${city.km} km de nuestra bodega en Valencia. Coordinamos el last-mile hasta tu puerta; el recargo por distancia lo ves al instante en la calculadora.`;

  const wa = buildWhatsAppLink(
    `Hola DTD Cargo, quiero importar de China a ${name}. ¿Me ayudan a cotizar?`,
  );

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Importar de China a ${name}`,
    serviceType: "Carga consolidada DDP China → Venezuela puerta a puerta",
    description: `Envío consolidado puerta a puerta (DDP) de China a ${name}, Venezuela, con financiamiento 100% e inspección en fábrica.`,
    areaServed: {
      "@type": "City",
      name,
      containedInPlace: { "@type": "Country", name: "Venezuela" },
    },
    provider: {
      "@type": "LocalBusiness",
      name: "DTD Cargo",
      url: SITE_URL,
    },
    url: `${SITE_URL}/importar-de-china/${ciudad}`,
  };

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
          { name: `Importar de China a ${name}`, path: `/importar-de-china/${ciudad}` },
        ]}
      />

      <main>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">China → {name} · DDP puerta a puerta</span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(38px, 6vw, 76px)" }}>
              Importar de China
              <br />
              a <span style={{ color: "var(--color-wine)" }}>{name}</span>.
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              Carga consolidada puerta a puerta de China a {name}: flete, aduana e
              impuestos incluidos, y pagás cuando tu mercancía llega a Venezuela.
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

        {/* Entrega a la ciudad — contenido genuino por ubicación */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">Entrega en {name}</span>
            <h2 className="h-section mt-4">Cómo llega tu carga a {name}.</h2>
            <p className="lead mt-5 max-w-[62ch]">{entrega}</p>
            <p className="mt-5 text-[15px] leading-[1.6] text-grey-700 max-w-[62ch]">
              Tu mercancía se consolida en nuestra bodega de Yiwu (China), se
              inspecciona antes de embarcar y viaja en modalidad DDP hasta
              Venezuela. Desde Valencia coordinamos la entrega final en {name} —
              un solo punto de contacto de la fábrica a tu puerta.
            </p>
          </div>
        </section>

        {/* Por qué DTD */}
        <section className="py-16 lg:py-20 bg-paper">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Por qué importar con DTD</span>
            <h2 className="h-section mt-4">De China a {name}, con confianza.</h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  t: "Financiamiento 100%",
                  d: `Pagás cuando tu carga llega a Venezuela, no por adelantado.`,
                },
                {
                  t: "Inspección en fábrica",
                  d: "Verificamos tu mercancía en China antes de embarcar. Cero estafas.",
                },
                {
                  t: "Equipo y bodega propios",
                  d: "Operación propia en Yiwu y Valencia. No somos un intermediario remoto.",
                },
                {
                  t: "Un solo punto de contacto",
                  d: `Una persona coordina todo tu envío hasta ${name}.`,
                },
              ].map((w) => (
                <div
                  key={w.t}
                  className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7"
                >
                  <h3 className="h-card text-ink mb-2">{w.t}</h3>
                  <p className="text-[14.5px] leading-[1.55] text-grey-500">{w.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HowWeWork />
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}
