import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Timeline } from "@/components/Timeline";
import { Stats } from "@/components/Stats";
import { serializeJsonLd } from "@/lib/public/json-ld";
import {
  CONTACT,
  buildWhatsAppLink,
  buildGoogleMapsLink,
} from "@/lib/design-tokens";
import {
  ArrowIcon,
  WhatsAppIcon,
  CheckIcon,
  MapPinIcon,
} from "@/components/Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const DESCRIPTION =
  "Logística puerta a puerta China–Venezuela desde 2015, en el comercio con China desde 2008. Equipo propio en Yiwu y Valencia. Nuestra historia, misión y valores.";

export const metadata: Metadata = {
  title: "Sobre Nosotros",
  description: DESCRIPTION,
  alternates: { canonical: "/nosotros" },
  ...socialMeta({
    title: "Sobre Nosotros · DTD Cargo",
    description: DESCRIPTION,
    path: "/nosotros",
  }),
};

/**
 * AboutPage JSON-LD — referencia la entidad #organization del root layout por
 * @id (una sola entidad, no redeclara la empresa). Refuerza el conocimiento de
 * marca para Google/IA (página "About" canónica).
 */
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}/nosotros#aboutpage`,
  url: `${SITE_URL}/nosotros`,
  name: "Sobre Nosotros · DTD Cargo",
  primaryImageOfPage: `${SITE_URL}/brand/og-image.png`,
  mainEntity: { "@id": `${SITE_URL}/#organization` },
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

const VALORES = [
  { t: "Confianza", d: "El motor de todo; cada envío la construye." },
  { t: "Seguridad", d: "Tu mercancía custodiada de la fábrica a tu puerta." },
  { t: "Puntualidad", d: "Una cadencia que puedes planificar." },
  { t: "Transparencia", d: "Precios y estado del envío claros, con menos imprevistos." },
  {
    t: "Cercanía",
    d: "Un solo punto de contacto, con presencia real en ambos extremos.",
  },
  {
    t: "El cliente, nuestra razón de ser",
    d: "Construimos cada relación cliente a cliente, contenedor a contenedor.",
  },
];

const SEDES = [
  {
    country: CONTACT.cn.label,
    role: "Sourcing, consolidación e inspección",
    detail:
      "Compra asistida, verificación de proveedores y control de calidad en fábrica antes de embarcar.",
    address: CONTACT.cn.address,
    city: CONTACT.cn.city,
    mapsUrl: buildGoogleMapsLink(CONTACT.cn.addressFull),
  },
  {
    country: CONTACT.ve.label,
    role: "Aduana, nacionalización y last mile",
    detail:
      "Asumimos aduana e impuestos a nuestro nombre y entregamos en la puerta del cliente en toda Venezuela.",
    address: CONTACT.ve.address,
    city: CONTACT.ve.city,
    mapsUrl: CONTACT.ve.mapsUrl,
  },
];

export default function NosotrosPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Sobre Nosotros", path: "/nosotros" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(aboutJsonLd),
        }}
      />
      {/* Revestido al Norte con la superficie de recursos (`.rp-surface`).
          Sin mockup propio: se aplica el armazón `rp-*` de glosario/FAQ/
          noticias, sin inventar dirección nueva. El copy de la cronología
          (2008 experiencia / 2015 fundación) NO se toca. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "var(--maxw)" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Quiénes somos
            </div>
            <h1>
              De la experiencia comercial{" "}
              <span className="accent">a la logística integral.</span>
            </h1>
            <p>
              Desde 2008 trabajamos con China; en 2010 abrimos nuestra primera
              oficina allá y en 2015 fundamos la operación en Venezuela. Hoy
              somos un puente de confianza entre las fábricas asiáticas y los
              comercios de Venezuela — con equipo propio en Yiwu y Valencia.
            </p>
          </div>
        </section>

        {/* PROPÓSITO + MISIÓN/VISIÓN */}
        <section className="py-16 lg:py-20">
          <div className="wrap">
            <span className="eyebrow">Por qué existimos</span>
            <h2 className="h-section mt-4 max-w-[22ch]">
              Que importar de China deje de ser caro, lento y arriesgado.
            </h2>
            <p className="lead mt-6 max-w-[62ch]">
              No tiene por qué serlo. Existimos para que cualquier comercio o
              emprendedor en Venezuela pueda hacerlo con confianza, sin viajar ni
              arriesgar su capital — de la fábrica a su puerta.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-10">
              <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9">
                <div className="eyebrow">Misión</div>
                <p className="mt-4 text-[17px] leading-[1.6] text-grey-700">
                  Llevamos tu mercancía de China a tu puerta con rapidez,
                  economía y seguridad. Compramos, inspeccionamos, consolidamos y
                  nacionalizamos a nuestro nombre. Tú solo recibes. Cliente a
                  cliente, contenedor a contenedor.
                </p>
              </div>
              <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9">
                <div className="eyebrow">Visión</div>
                <p className="mt-4 text-[17px] leading-[1.6] text-grey-700">
                  Ser el referente en logística entre China y Venezuela: la forma
                  más confiable, económica y rápida de importar puerta a puerta.
                  Con equipo propio en Yiwu y Valencia, trayectoria desde 2008 y
                  tecnología propia, hacemos que importar sea simple, transparente
                  y rentable.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HISTORIA — Timeline 2008-2026 (reusa el componente del home) */}
        <Timeline />

        {/* SEDES — equipo propio en ambos extremos */}
        <section className="py-16 lg:py-20 bg-paper">
          <div className="wrap">
            <span className="eyebrow">Equipo propio en ambos extremos</span>
            <h2 className="h-section mt-4">
              Gente nuestra, de la fábrica a tu puerta.
            </h2>
            <p className="lead mt-6 max-w-[58ch]">
              Operamos con equipo propio en ambos extremos. Tenemos oficina y bodega propias
              en los dos puntos clave de la ruta — por eso podemos responder por
              cada envío de principio a fin.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-10">
              {SEDES.map((s) => (
                <a
                  key={s.country}
                  href={s.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-link card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 group"
                >
                  <div className="eyebrow">{s.country}</div>
                  <div
                    className="mt-3 text-[24px] lg:text-[26px] leading-[1.12] tracking-[-0.01em] text-ink group-hover:text-wine transition-colors"
                    style={{ fontFamily: "var(--font-archivo-black)" }}
                  >
                    {s.role}
                  </div>
                  <p className="mt-4 text-[14.5px] leading-[1.55] text-grey-500">
                    {s.detail}
                  </p>
                  <div className="mt-5 pt-5 border-t border-grey-200 flex items-start gap-1.5 text-[14px]">
                    <MapPinIcon
                      size={14}
                      className="mt-1 flex-shrink-0 text-grey-500"
                    />
                    <span>
                      <span className="text-ink font-semibold">
                        {s.address}
                      </span>
                      <br />
                      <span className="text-grey-500">{s.city}</span>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* VALORES */}
        <section className="py-16 lg:py-20">
          <div className="wrap">
            <span className="eyebrow">Lo que nos sostiene</span>
            <h2 className="h-section mt-4">Nuestros valores.</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
              {VALORES.map((v) => (
                <div
                  key={v.t}
                  className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-wine flex-shrink-0">
                      <CheckIcon size={18} />
                    </span>
                    <h3 className="h-card text-[19px]">{v.t}</h3>
                  </div>
                  <p className="mt-3 text-[14.5px] leading-[1.55] text-grey-500">
                    {v.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STATS — KPIs (reusa el componente del home) */}
        <Stats />

        {/* CTA FINAL */}
        <section className="py-16 lg:py-24 bg-paper">
          <div className="wrap">
            <h2 className="h-section max-w-[24ch]">
              ¿Listo para importar con confianza?
            </h2>
            <p className="lead mt-5 max-w-[52ch]">
              Escríbenos por WhatsApp y un asesor humano te responde — sin call
              centers ni traspasos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={buildWhatsAppLink(
                  "Hola DTD Cargo, vi su página y quiero cotizar un envío. ¿Pueden ayudarme?"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary inline-flex items-center gap-2"
              >
                Cotiza tu envío <ArrowIcon size={18} />
              </a>
              <a
                href={buildWhatsAppLink(
                  "Hola DTD Cargo, quería conocer más sobre la empresa."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost inline-flex items-center gap-2"
              >
                <WhatsAppIcon size={18} /> Escríbenos
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
