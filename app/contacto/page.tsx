import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { ContactoForm } from "@/components/ContactoForm";
import { ChinaSupplierClip } from "@/components/ChinaSupplierClip";
import { CONTACT, buildGoogleMapsLink } from "@/lib/design-tokens";
import { WhatsAppIcon, MapPinIcon, PhoneIcon, MailIcon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Habla con DTD-CARGO. Oficinas propias en Yiwu (China) y Valencia (Venezuela). WhatsApp directo, info@dtdcargo.com, respuesta en menos de 24 horas.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto · DTD·CARGO",
    url: "/contacto",
  },
};

export default function ContactoPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        <section className="py-16 lg:py-24">
          <div className="wrap">
            <span className="eyebrow">Contacto</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
            >
              Una persona
              <br />
              <span style={{ color: "var(--color-wine)" }}>te responde.</span>
            </h1>
            <p className="lead mt-6">
              Sin call center, sin tickets, sin handoffs. Escribinos por el
              canal que prefieras y un asesor humano te responde en menos de
              24 horas.
            </p>
          </div>
        </section>

        <section className="pb-16 lg:pb-24">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12">
            {/* Tarjetas de oficinas */}
            <div className="flex flex-col gap-5">
              <OfficeCard
                flag="🇻🇪"
                country={CONTACT.ve.label}
                tagline="Oficina comercial y operativa"
                address={CONTACT.ve.address}
                addressFull={CONTACT.ve.addressFull}
                mapsUrl={CONTACT.ve.mapsUrl}
                city={CONTACT.ve.city}
                hours={CONTACT.ve.hours}
                contacts={[
                  {
                    kind: "phone",
                    label: CONTACT.ve.phone,
                    href: `tel:${CONTACT.ve.phoneRaw}`,
                  },
                  {
                    kind: "whatsapp",
                    label: `${CONTACT.ve.whatsapp} · WhatsApp`,
                    href: `https://wa.me/${CONTACT.ve.whatsappRaw}`,
                  },
                  {
                    kind: "email",
                    label: CONTACT.ve.email,
                    href: `mailto:${CONTACT.ve.email}`,
                  },
                ]}
              />
              <OfficeCard
                flag="🇨🇳"
                country={CONTACT.cn.label}
                tagline="Bodega propia y oficina operativa"
                address={CONTACT.cn.address}
                addressFull={CONTACT.cn.addressFull}
                city={CONTACT.cn.city}
                hours={CONTACT.cn.hours}
                contacts={[
                  {
                    kind: "phone",
                    label: `${CONTACT.cn.phone} · ${CONTACT.cn.contactPersonPinyin}`,
                    href: `tel:${CONTACT.cn.phoneRaw}`,
                  },
                  {
                    kind: "email",
                    label: CONTACT.cn.email,
                    href: `mailto:${CONTACT.cn.email}`,
                  },
                ]}
                note="Atención en mandarín. Visitas a fábrica con cita previa."
              />

              <ChinaSupplierClip />

              <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8">
                <div className="eyebrow mb-4">Email general</div>
                <a
                  href={`mailto:${CONTACT.emailGeneral}`}
                  className="text-[22px] lg:text-[26px] tracking-[-0.01em] text-ink hover:text-wine block"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  {CONTACT.emailGeneral}
                </a>
                <p className="text-[13.5px] text-grey-500 mt-2">
                  Si no sabes a qué sede escribir, este buzón llega al equipo
                  completo.
                </p>
              </div>

              <div className="card-shadow-dark bg-ink text-white rounded-[18px] p-7 lg:p-9 flex flex-col gap-3">
                <div
                  className="eyebrow"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Atajo
                </div>
                <h3
                  className="text-[26px] leading-[1.1] tracking-[-0.01em]"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  ¿Necesitás respuesta ya?
                </h3>
                <p className="text-[14.5px] text-white/70 leading-[1.5]">
                  Envíanos un WhatsApp y un asesor humano te contesta en
                  minutos durante horario comercial.
                </p>
                <a
                  href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
                    "Hola DTD-CARGO, quería consultar por un envío."
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn mt-3 inline-flex items-center gap-2 self-start"
                  style={{ background: "#25D366", color: "white" }}
                >
                  <WhatsAppIcon size={20} /> Abrir WhatsApp
                </a>
              </div>
            </div>

            {/* Formulario */}
            <ContactoForm />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

type Contact = {
  kind: "phone" | "whatsapp" | "email";
  label: string;
  href: string;
};

function OfficeCard({
  flag,
  country,
  tagline,
  address,
  addressFull,
  mapsUrl,
  city,
  hours,
  contacts,
  note,
}: {
  flag?: string;
  country: string;
  tagline: string;
  address: string;
  addressFull: string;
  /** URL específica del pin de Google Maps; tiene prioridad sobre el query por dirección. */
  mapsUrl?: string;
  city: string;
  hours: string;
  contacts: Contact[];
  note?: string;
}) {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9">
      <div className="eyebrow">
        {flag && <span className="mr-1.5">{flag}</span>}
        {country}
      </div>
      <div
        className="mt-3 text-[24px] lg:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {tagline}
      </div>

      <a
        href={mapsUrl ?? buildGoogleMapsLink(addressFull)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex flex-col gap-1 text-[14.5px] group"
      >
        <div className="text-ink font-semibold inline-flex items-start gap-1.5 group-hover:text-wine transition-colors">
          <MapPinIcon size={14} className="mt-1 flex-shrink-0 text-grey-500" />
          {address}
        </div>
        <div className="text-grey-500 pl-[22px]">{city}</div>
        <div className="text-grey-500 text-[13px] mt-1 pl-[22px]">{hours}</div>
      </a>

      <ul className="mt-5 pt-5 border-t border-grey-200 flex flex-col gap-3 list-none p-0">
        {contacts.map((c) => (
          <li key={c.label} className="text-[15px]">
            <a
              href={c.href}
              target={c.kind === "whatsapp" ? "_blank" : undefined}
              rel={c.kind === "whatsapp" ? "noopener noreferrer" : undefined}
              className="group inline-flex items-center gap-2.5 text-ink font-semibold hover:text-wine transition-colors"
            >
              <span className="text-grey-500 flex-shrink-0">
                {c.kind === "phone" ? (
                  <PhoneIcon size={16} />
                ) : c.kind === "whatsapp" ? (
                  <WhatsAppIcon size={16} />
                ) : (
                  <MailIcon size={16} />
                )}
              </span>
              <span>{c.label}</span>
            </a>
          </li>
        ))}
      </ul>
      {note && (
        <p className="mt-5 pt-5 border-t border-grey-200 text-[13.5px] text-grey-500 leading-[1.5]">
          {note}
        </p>
      )}
    </div>
  );
}
