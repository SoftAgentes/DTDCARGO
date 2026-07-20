import type { Metadata } from "next";
import Image from "next/image";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { ContactoForm } from "@/components/ContactoForm";
import { CONTACT } from "@/lib/design-tokens";
import { WhatsAppIcon, PhoneIcon, MailIcon } from "@/components/Icon";

const DESC =
  "Habla con DTD Cargo. Oficinas propias en Yiwu (China) y Valencia (Venezuela). WhatsApp directo, info@dtdcargo.com, respuesta en menos de 24 horas.";

export const metadata: Metadata = {
  title: "Contáctenos",
  description: DESC,
  alternates: { canonical: "/contacto" },
  ...socialMeta({
    title: "Contáctenos · DTD Cargo",
    description: DESC,
    path: "/contacto",
  }),
};

export default function ContactoPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Contáctenos", path: "/contacto" },
        ]}
      />
      <main className="bg-paper">
        {/* ── Hero ── */}
        <section className="py-16 lg:py-20">
          <div className="wrap max-w-[820px]">
            <span
              className="inline-flex items-center gap-2 text-[12.5px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "var(--color-wine)" }}
            >
              <span className="w-[34px] h-0.5 inline-block" style={{ background: "var(--color-wine)" }} />
              Dos países, un solo equipo
            </span>
            <h1 className="h-display mt-5" style={{ fontSize: "clamp(34px, 5vw, 60px)" }}>
              Un equipo. Dos países.{" "}
              <span style={{ color: "var(--color-wine)" }}>Una sola conversación.</span>
            </h1>
            <p className="lead mt-6 max-w-[58ch]">
              De la bodega en Yiwu a tu puerta en Valencia, el mismo equipo coordina todo
              el trayecto. Escríbenos y hablas con quien de verdad conoce tu carga.
            </p>
          </div>
        </section>

        {/* ── Banda dual · China ↔ Venezuela ── */}
        <section className="pb-4">
          <div className="wrap grid grid-cols-1 md:grid-cols-2 gap-5">
            <DualHalf
              img="/videos/equipo-cargando-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela-poster.jpg"
              alt="Bodega propia de DTD Cargo en Yiwu, China, con el equipo consolidando cajas rotuladas"
              tag="Yiwu · China"
              title="Recepción y consolidación"
              text="Bodega propia: recibimos, revisamos y consolidamos cada compra antes de embarcarla."
            />
            <DualHalf
              img="/fotos/carga-contenedor-precinto-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg"
              alt="Contenedor con carga consolidada y precinto llegando a Venezuela"
              tag="Valencia · Venezuela"
              title="Aduana y entrega final"
              text="Nacionalización, impuestos y reparto puerta a puerta. Pagas al llegar."
            />
          </div>
        </section>

        {/* ── Canales directos ── */}
        <section className="pt-10 lg:pt-14">
          <div className="wrap">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Channel
                icon={<MailIcon size={18} />}
                label="Email"
                value={CONTACT.emailGeneral}
                href={`mailto:${CONTACT.emailGeneral}`}
              />
              <Channel
                icon={<PhoneIcon size={18} />}
                label="Teléfono"
                value={CONTACT.ve.phone}
                href={`tel:${CONTACT.ve.phoneRaw}`}
              />
              <Channel
                icon={<WhatsAppIcon size={18} />}
                label="WhatsApp directo"
                value={CONTACT.ve.whatsapp}
                href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
                external
              />
            </div>
          </div>
        </section>

        {/* ── Panel wine · formulario (backend real /api/contact) ── */}
        <section className="py-12 lg:py-16">
          <div className="wrap">
            <div
              className="rounded-[22px] p-6 sm:p-10 lg:p-12"
              style={{ background: "var(--color-wine)" }}
            >
              <div className="max-w-[540px]">
                <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] uppercase text-white/80">
                  <span className="w-[28px] h-0.5 inline-block bg-white/60" />
                  Escríbenos
                </span>
                <h2
                  className="mt-3 text-[28px] lg:text-[34px] leading-[1.05] text-white"
                  style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
                >
                  Cuéntanos qué necesitas.
                </h2>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-white/80">
                  Te responde alguien que conoce la ruta China → Venezuela — no un bot.
                  Normalmente en menos de 24 horas.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-8 items-start">
                {/* El form real: fields topic/nombre/email/whatsapp/mensaje →
                    POST /api/contact (honeypot + throttle IP + Resend). Sin cambios. */}
                <ContactoForm />
                <ul className="flex flex-col gap-4 list-none p-0 lg:pt-2">
                  {[
                    ["Un solo canal, de punta a punta.", "El mismo equipo que recibe en Yiwu te entrega en Valencia."],
                    ["Respuesta humana.", "Te contesta un asesor real, no un ticket ni un call center."],
                    ["Todo queda por escrito.", "Al enviar te llega tu WhatsApp pre-armado con tus datos."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-start gap-3 text-[14px] text-white/85 leading-[1.5]">
                      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-white/70" aria-hidden />
                      <span>
                        <strong className="text-white">{t}</strong> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Línea legal — SIN RIF ni razón social en texto visible (regla de
                marca: van solo en el schema). */}
            <p className="mt-6 text-center text-[12px] text-grey-500">
              DTD Cargo · © {new Date().getFullYear()} Todos los derechos reservados.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function DualHalf({
  img,
  alt,
  tag,
  title,
  text,
}: {
  img: string;
  alt: string;
  tag: string;
  title: string;
  text: string;
}) {
  return (
    <figure className="relative m-0 rounded-[18px] overflow-hidden border border-grey-200 min-h-[240px]">
      <Image src={img} alt={alt} width={900} height={600} className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(6,13,28,0.92) 0%, rgba(6,13,28,0.55) 45%, transparent 78%)" }}
        aria-hidden
      />
      <figcaption className="relative z-10 flex flex-col justify-end h-full min-h-[240px] p-6">
        <span
          className="inline-flex self-start items-center text-[10.5px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full mb-2.5"
          style={{ background: "var(--color-wine)", color: "#fff" }}
        >
          {tag}
        </span>
        <h3
          className="text-[19px] text-white leading-[1.15]"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
        >
          {title}
        </h3>
        <p className="mt-1.5 text-[13.5px] text-white/80 leading-[1.5] max-w-[38ch]">{text}</p>
      </figcaption>
    </figure>
  );
}

function Channel({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group card-shadow bg-white border border-grey-200 rounded-[14px] px-5 py-4 flex items-center gap-3.5 transition-all hover:-translate-y-0.5 hover:border-ink"
    >
      <span className="w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0 bg-wine/10 text-wine">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10.5px] font-bold tracking-[0.12em] uppercase text-grey-500">
          {label}
        </span>
        <span className="block text-[15px] font-bold text-ink group-hover:text-wine truncate">
          {value}
        </span>
      </span>
    </a>
  );
}
