import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { YiwuAdvantage } from "@/components/YiwuAdvantage";
import { HowWeWork } from "@/components/HowWeWork";
import { Philosophy } from "@/components/Philosophy";
import { WorkBand } from "@/components/WorkBand";
import { OperationGallery } from "@/components/OperationGallery";
import { Testimonials } from "@/components/Testimonials";
import { ServicesByOffice } from "@/components/brochure/ServicesByOffice";
import { DownloadPdfButton } from "@/components/brochure/DownloadPdfButton";
import {
  CONTACT,
  TIMELINE,
  SERVICES_MATRIX,
  buildWhatsAppLink,
  aniosComercioChina,
} from "@/lib/design-tokens";
import {
  MailIcon,
  PhoneIcon,
  WhatsAppIcon,
  MapPinIcon,
  InstagramIcon,
} from "@/components/Icon";

export const metadata: Metadata = {
  title: "Brochure",
  description:
    "Carga consolidada puerta a puerta China → Venezuela, todo incluido (DDP). 15 servicios, equipo y bodega propios en Yiwu y Valencia, pagas al llegar. Operando desde 2015.",
  alternates: { canonical: "/brochure" },
  ...socialMeta({
    title: "Brochure · DTD Cargo",
    description:
      "Carga consolidada puerta a puerta China → Venezuela, todo incluido (DDP). 15 servicios, equipo y bodega propios en Yiwu y Valencia, pagas al llegar. Operando desde 2015.",
    path: "/brochure",
  }),
};

// Revalidación mensual: el contador de años (aniosComercioChina) se recomputa sin redeploy.
export const revalidate = 2592000;

const WA_COTIZAR = buildWhatsAppLink(
  "Hola DTD Cargo, vi el brochure y quiero cotizar un envío de China a Venezuela. ¿Me ayudan?",
);

const WHY = [
  {
    t: "Pagas al llegar",
    d: "Pagas cuando tu carga llega a Venezuela, no por adelantado. Pueden aplicar restricciones.",
  },
  {
    t: "Equipo y bodega propios",
    d: "Oficinas en Yiwu (China) y Valencia: operación propia en ambos extremos.",
  },
  {
    t: "Inspección en fábrica",
    d: "Verificamos tu mercancía antes de embarcar para reducir el riesgo de fraude.",
  },
  {
    t: "Un solo punto de contacto",
    d: "Una persona coordina todo. No te pasamos de área en área.",
  },
];

export default function BrochurePage() {
  return (
    <>
      <div data-print-hide>
        <Nav />
      </div>

      <main className="brochure-doc">
        {/* 1 · Portada / Hero */}
        <section className="bg-paper pt-14 pb-14 lg:pt-24 lg:pb-20">
          <div className="wrap max-w-[920px]">
            <span className="eyebrow">Carga China → Venezuela · Desde 2015</span>
            <h1 className="h-display mt-6" style={{ fontSize: "clamp(40px, 6.5vw, 76px)" }}>
              <span style={{ color: "var(--color-wine)" }}>Con Confianza,</span>
              <br />
              de China a tu puerta.
            </h1>
            <p className="lead mt-6" style={{ fontSize: "19px" }}>
              Carga consolidada puerta a puerta entre China y Venezuela, todo
              incluido (DDP). Y pagas cuando llega a
              Venezuela, no por adelantado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={WA_COTIZAR}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <WhatsAppIcon size={18} /> Cotizar por WhatsApp
              </a>
              <DownloadPdfButton />
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-semibold text-grey-700">
              <span>Pagas al llegar</span>
              <span>Equipo propio en Yiwu &amp; Valencia</span>
              <span>Inspección antes de embarcar</span>
            </div>
          </div>
        </section>

        {/* 2 · Nuestra historia (compacta) */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Nuestra historia</span>
            <h2 className="h-section mt-4">{aniosComercioChina()} años de trayectoria.</h2>
            <p className="lead mt-3 max-w-[60ch]">
              De importadores a referente logístico entre China y América
              Latina. Operando desde 2015, contenedor a contenedor.
            </p>
            <ol className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 list-none p-0">
              {TIMELINE.map((t) => (
                <li key={t.year} className="flex items-baseline gap-3">
                  <span
                    className="text-[15px] flex-shrink-0 w-[42px]"
                    style={{
                      fontFamily: "var(--font-archivo-black)",
                      color: "var(--color-wine)",
                    }}
                  >
                    {t.year}
                  </span>
                  <span className="text-[14px] leading-[1.4] text-grey-700">
                    {t.title}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3 · Yiwu — ventaja estratégica (reuso) */}
        <YiwuAdvantage />

        {/* 3b · Operación real en Yiwu (clip de bodega). noVideoSchema: acá
            también se monta <OperationGallery /> (3c), que emite el MISMO
            VideoObject — sin esto el schema quedaba duplicado (inválido). */}
        <WorkBand noVideoSchema />

        {/* 3c · El sello DoorTuDoor (fotos de marca en la operación) */}
        <OperationGallery />

        {/* 4-5 · Los 15 servicios (héroe DDP + 4 grupos) */}
        <ServicesByOffice />

        {/* 6 · Mapa de servicios por sede */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Mapa de servicios por sede</span>
            <h2 className="h-section mt-4">Yiwu ejecuta. Valencia coordina.</h2>
            <div className="mt-8 card-shadow bg-white rounded-[18px] border border-grey-200 overflow-hidden">
              <table className="w-full border-collapse text-left text-[14px]">
                <thead>
                  <tr className="bg-grey-100 text-ink">
                    <th className="p-3.5 font-bold">Servicio</th>
                    <th className="p-3.5 font-bold whitespace-nowrap">Yiwu (China)</th>
                    <th className="p-3.5 font-bold whitespace-nowrap">Valencia (Venezuela)</th>
                  </tr>
                </thead>
                <tbody>
                  {SERVICES_MATRIX.map((r) => (
                    <tr key={r.service} className="border-t border-grey-200">
                      <td className="p-3.5 font-medium text-ink">{r.service}</td>
                      <td className="p-3.5 text-grey-700">{r.cn}</td>
                      <td className="p-3.5 text-grey-700">{r.ve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 7 · Cómo trabajamos (reuso) */}
        <HowWeWork />

        {/* 8 · Por qué DTD */}
        <section className="py-16 lg:py-20 bg-white">
          <div className="wrap max-w-[1000px]">
            <span className="eyebrow">Por qué DTD</span>
            <h2 className="h-section mt-4">
              Un solo responsable de coordinación, de fábrica a tu puerta.
            </h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {WHY.map((w) => (
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

        {/* 9 · Filosofía (reuso) */}
        <Philosophy />

        {/* 9b · Testimonios (la sección se auto-oculta sin reseñas reales) */}
        <Testimonials />

        {/* 10 · Cierre / contacto */}
        <section className="py-20 bg-ink text-white">
          <div className="wrap max-w-[920px] text-center">
            <h2 className="h-display" style={{ color: "white", fontSize: "clamp(32px, 5vw, 56px)" }}>
              ¿Listo para traer
              <br />
              tu carga de China?
            </h2>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <a
                href={WA_COTIZAR}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <WhatsAppIcon size={18} /> Cotizar por WhatsApp
              </a>
              <DownloadPdfButton dark />
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 text-left text-[14.5px] max-w-[640px] mx-auto">
              <a href={`mailto:${CONTACT.emailGeneral}`} className="inline-flex items-center gap-2 text-white/85 hover:text-white">
                <MailIcon size={15} className="text-white/55" /> {CONTACT.emailGeneral}
              </a>
              <a
                href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/85 hover:text-white"
              >
                <WhatsAppIcon size={15} className="text-white/55" /> {CONTACT.ve.whatsapp}
              </a>
              <a href={`tel:${CONTACT.ve.phoneRaw}`} className="inline-flex items-center gap-2 text-white/85 hover:text-white">
                <PhoneIcon size={15} className="text-white/55" /> {CONTACT.ve.phone}
              </a>
              <a href={CONTACT.instagram.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/85 hover:text-white">
                <InstagramIcon size={15} className="text-white/55" /> {CONTACT.instagram.handle}
              </a>
              <div className="inline-flex items-start gap-2 text-white/70">
                <MapPinIcon size={15} className="text-white/55 mt-0.5 flex-shrink-0" />
                <span>{CONTACT.ve.address}, {CONTACT.ve.city}</span>
              </div>
              <div className="inline-flex items-start gap-2 text-white/70">
                <MapPinIcon size={15} className="text-white/55 mt-0.5 flex-shrink-0" />
                <span>{CONTACT.cn.city}</span>
              </div>
            </div>
            <p className="mt-10 text-[12.5px] tracking-[0.06em] text-white/45">
              {CONTACT.web} · {CONTACT.legalName}
            </p>
          </div>
        </section>
      </main>

      <div data-print-hide>
        <WhatsAppFAB />
      </div>
      <Footer />
    </>
  );
}
