import Link from "next/link";
import { BrandMark } from "./BrandMark";
import {
  CONTACT,
  SERVICES_CN,
  SERVICES_VE,
  buildGoogleMapsLink,
} from "@/lib/design-tokens";
import {
  FlagCN,
  FlagVE,
  InstagramIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  WhatsAppIcon,
} from "./Icon";

export function Footer() {
  // Top-4 servicios por sede para el footer (los más representativos)
  const topCN = SERVICES_CN.slice(0, 4);
  const topVE = SERVICES_VE.slice(0, 4);

  return (
    <footer className="bg-ink text-white pt-20 pb-8">
      <div className="wrap">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-9 pb-15 border-b border-white/10">
          {/* Brand */}
          <div>
            <BrandMark onDark size={48} />
            <p className="mt-4 text-[14.5px] leading-[1.5] text-white/60 max-w-[36ch]">
              Puente logístico entre China y Venezuela. Operando desde 2008,
              construyendo confianza cliente a cliente, contenedor a
              contenedor.
            </p>
            <a
              href={CONTACT.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram ${CONTACT.instagram.handle}`}
              className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-white/85 hover:text-white transition-colors"
            >
              <InstagramIcon size={18} className="text-white/55 flex-shrink-0" />
              <span>{CONTACT.instagram.handle}</span>
            </a>
          </div>

          {/* Servicios CN */}
          <div>
            <h2 className="text-[12.5px] font-bold tracking-[0.12em] uppercase text-white/50 mb-[18px] inline-flex items-center gap-2">
              <FlagCN size={18} className="flex-shrink-0" />
              <span>Servicios Yiwu</span>
            </h2>
            <ul className="flex flex-col gap-3 list-none p-0">
              {topCN.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/servicios#${s.slug}`}
                    className="text-[14.5px] font-medium text-white/85 hover:text-white transition-colors"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/servicios#detalle"
                  className="text-[13px] text-white/55 hover:text-white transition-colors"
                >
                  + Ver todos →
                </Link>
              </li>
            </ul>
          </div>

          {/* Servicios VE */}
          <div>
            <h2 className="text-[12.5px] font-bold tracking-[0.12em] uppercase text-white/50 mb-[18px] inline-flex items-center gap-2">
              <FlagVE size={18} className="flex-shrink-0" />
              <span>Servicios Venezuela</span>
            </h2>
            <ul className="flex flex-col gap-3 list-none p-0">
              {topVE.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/servicios#${s.slug}`}
                    className="text-[14.5px] font-medium text-white/85 hover:text-white transition-colors"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/importar-de-china"
                  className="text-[14.5px] font-medium text-white/85 hover:text-white transition-colors"
                >
                  Importar de China a tu ciudad
                </Link>
              </li>
              <li>
                <Link
                  href="/servicios#detalle"
                  className="text-[13px] text-white/55 hover:text-white transition-colors"
                >
                  + Ver todos →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h2 className="text-[12.5px] font-bold tracking-[0.12em] uppercase text-white/50 mb-[18px]">
              Contacto
            </h2>
            <ul className="flex flex-col gap-3 list-none p-0">
              <li className="text-[14.5px]">
                <a
                  href={`mailto:${CONTACT.emailGeneral}`}
                  className="inline-flex items-center gap-2 text-white/85 hover:text-white transition-colors"
                >
                  <MailIcon size={15} className="text-white/55 flex-shrink-0" />
                  <span>{CONTACT.emailGeneral}</span>
                </a>
              </li>
              <li className="text-[14.5px]">
                <a
                  href={`tel:${CONTACT.ve.phoneRaw}`}
                  className="inline-flex items-center gap-2 text-white/85 hover:text-white transition-colors"
                >
                  <PhoneIcon size={15} className="text-white/55 flex-shrink-0" />
                  <span>{CONTACT.ve.phone}</span>
                </a>
              </li>
              <li className="text-[14.5px]">
                <a
                  href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/85 hover:text-white transition-colors"
                >
                  <WhatsAppIcon size={15} className="text-white/55 flex-shrink-0" />
                  <span>{CONTACT.ve.whatsapp} · WhatsApp</span>
                </a>
              </li>
              <li className="pt-3 mt-1 border-t border-white/10">
                <div className="text-[12px] tracking-[0.08em] uppercase text-white/40 mb-1.5">
                  Venezuela
                </div>
                <a
                  href={CONTACT.ve.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-white/70 leading-[1.45] hover:text-white transition-colors inline-flex items-start gap-1.5"
                >
                  <MapPinIcon size={12} className="mt-1 flex-shrink-0 text-white/55" />
                  <span>
                    {CONTACT.ve.address}
                    <br />
                    {CONTACT.ve.city}
                  </span>
                </a>
              </li>
              <li className="pt-3 border-t border-white/10">
                <div className="text-[12px] tracking-[0.08em] uppercase text-white/40 mb-1.5">
                  China
                </div>
                <a
                  href={buildGoogleMapsLink(CONTACT.cn.addressFull)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-white/70 leading-[1.45] hover:text-white transition-colors inline-flex items-start gap-1.5"
                >
                  <MapPinIcon size={12} className="mt-1 flex-shrink-0 text-white/55" />
                  <span>
                    {CONTACT.cn.address}
                    <br />
                    {CONTACT.cn.city}
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col md:flex-row md:justify-between md:items-center gap-3 text-[12.5px] font-medium tracking-[0.06em] text-white/45">
          <span>
            © {new Date().getFullYear()} {CONTACT.legalName}. Todos los
            derechos reservados.
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/portal/login" className="hover:text-white transition-colors">
              Acceder al portal
            </Link>
            <Link href="/registro" className="hover:text-white transition-colors">
              Registro de cliente
            </Link>
            <Link href="/brochure" className="hover:text-white transition-colors">
              Brochure
            </Link>
            <Link href="/faq" className="hover:text-white transition-colors">
              Preguntas frecuentes
            </Link>
            <span>{CONTACT.web} · Made in Yiwu &amp; Valencia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
