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

/**
 * `/contacto` — "Contáctenos".
 *
 * Rebuild fiel al mockup Cloud Design "Contáctenos · DTD-Cargo.html"
 * (2026-07-20), VARIANTE C: encabezado + bloque dual China/Venezuela a todo el
 * ancho + fila de canales + panel vino con el formulario. El CSS del handoff
 * (`web/contacto.css`) trae las 3 propuestas; solo la C llegó al marcado, y
 * solo esa se portó — ver el bloque `.cx-surface` en `app/globals.css`.
 *
 * Dos decisiones del founder que se apartan del mockup:
 *   · El formulario manda SOLO por WhatsApp (ya no postea a `/api/contact`,
 *     que queda deprecado pero en su sitio).
 *   · La micro-línea legal NO lleva RIF ni razón social: van únicamente en el
 *     JSON-LD del layout raíz (`#organization`).
 *
 * Nav / Footer / WhatsAppFAB son los del sitio (el mockup trae los suyos, que
 * no se copian). Los datos de contacto visibles salen de `CONTACT`.
 */

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
      <main className="cx-surface">
        {/* ── Encabezado ── */}
        <section className="wrap cx-c-head">
          <div className="eyebrow-h">
            <span className="rule" />
            Dos países, un solo equipo
          </div>
          <h1 className="cx-h1">
            Un equipo. Dos países. <span className="hl">Una sola conversación.</span>
          </h1>
          <p className="cx-sub">
            De la bodega en Yiwu a tu puerta en Valencia, el mismo equipo coordina todo
            el trayecto. Escríbenos y hablas con quien de verdad conoce tu carga.
          </p>
        </section>

        {/* ── Puente CN ↔ VE ── */}
        <section className="cx-dual">
          <DualHalf
            src="/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg"
            alt="Operación de DTD Cargo en Yiwu: un contenedor estibado de piso a techo con cajas de varios clientes, el equipo con camisa DTD Cargo revisando los listados junto al contenedor y sacos rotulados en chino listos para consolidar"
            tag="Yiwu · China"
            title="Recepción y consolidación"
            text="Bodega propia: recibimos, revisamos y consolidamos cada compra antes de embarcarla."
            priority
          />
          <DualHalf
            src="/fotos/puerto-venezuela-aduana-entrega-final-dtd-cargo.jpg"
            alt="Operación de DTD Cargo en Venezuela: la cuadrilla descargando el contenedor en el puerto con las grúas del patio al fondo, el equipo en la oficina de Valencia y un operario con la mercancía ya nacionalizada"
            tag="Valencia · Venezuela"
            title="Aduana y entrega final"
            text="Nacionalización, impuestos y reparto puerta a puerta. Pagas al llegar."
          />
        </section>

        <section className="wrap" style={{ padding: "clamp(40px, 6vw, 56px) 0 0" }}>
          {/* ── Canales directos (datos desde CONTACT) ── */}
          <div className="cx-inline-channels">
            <Channel
              icon={<MailIcon size={21} />}
              label="Email"
              value={CONTACT.emailGeneral}
              href={`mailto:${CONTACT.emailGeneral}`}
            />
            <Channel
              icon={<PhoneIcon size={21} />}
              label="Teléfono"
              value={CONTACT.ve.phone}
              href={`tel:${CONTACT.ve.phoneRaw}`}
            />
            <Channel
              icon={<WhatsAppIcon size={21} />}
              label="WhatsApp directo"
              value={CONTACT.ve.whatsapp}
              href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
              external
            />
          </div>

          {/* ── Panel vino · formulario (envío por WhatsApp) ── */}
          <div className="cx-wine-panel">
            <div className="cx-panel-head">
              <div className="cx-panel-eyebrow">
                <span className="rule" />
                Escríbenos
              </div>
              <h2>Cuéntanos qué necesitas.</h2>
              <p>
                Lo enviamos directo por WhatsApp a un asesor — te responde alguien que
                conoce la ruta CN → VE.
              </p>
            </div>
            <ContactoForm />
          </div>

          {/* Sin RIF ni razón social: van solo en el JSON-LD (regla de marca). */}
          <p className="cx-legal">
            DTD Cargo · © {new Date().getFullYear()} Todos los derechos reservados
          </p>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function DualHalf({
  src,
  alt,
  tag,
  title,
  text,
  priority,
}: {
  src: string;
  alt: string;
  tag: string;
  title: string;
  text: string;
  priority?: boolean;
}) {
  return (
    <div className="cx-dual-half">
      <Image src={src} alt={alt} fill sizes="(max-width: 767px) 100vw, 50vw" priority={priority} />
      <div className="cx-dual-in">
        <span className="cx-dual-tag">{tag}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
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
    <div className="cx-inline-ch">
      <span className="ic">{icon}</span>
      <div>
        <span className="tt">{label}</span>
        <br />
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {value}
        </a>
      </div>
    </div>
  );
}
