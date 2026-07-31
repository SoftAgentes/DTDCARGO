import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { CookiePreferencesLink } from "./CookiePreferencesLink";
import { TERMINOS_LIVE } from "@/lib/legal-public";
import { CONTACT, buildGoogleMapsLink } from "@/lib/design-tokens";
import {
  InstagramIcon,
  YoutubeIcon,
  TiktokIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  WhatsAppIcon,
} from "./Icon";

/**
 * Footer — rebuild por IA (Explora / Ayuda / Enlaces rápidos / Contacto) en
 * vez de la columna vieja "Servicios Yiwu / Servicios Venezuela" por sede
 * (esa listaba 4 servicios por país + flags; se reemplaza por un único link
 * a /servicios). Referencia: captura del founder 2026-07-21. Direcciones
 * VE/CN se mueven a una franja propia sobre el copyright (antes vivían
 * dentro de la columna Contacto) — la fuente de los datos sigue siendo
 * `CONTACT` (NAP único, no se hardcodea texto nuevo).
 */
export function Footer() {
  return (
    <footer className="bg-ink text-white pt-20 pb-8">
      <div className="wrap">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr] gap-9 pb-15 border-b border-white/10">
          {/* Brand */}
          <div>
            <BrandMark onDark size={48} />
            <p className="mt-4 text-[14.5px] leading-[1.5] text-white/60 max-w-[36ch]">
              Puente logístico entre China y Venezuela. Operando desde 2015,
              construyendo confianza cliente a cliente, contenedor a
              contenedor.
            </p>
            {/* Al interactuar, cada icono toma el color de SU red (founder
                2026-07-31). Los hex viven en tokens --social-* de globals.css,
                nunca sueltos acá. Los tres estados van juntos a propósito:
                hover = mouse · focus-visible = teclado · active = pantalla
                táctil, donde el hover en muchos navegadores no llega o se queda
                pegado. Los enlaces no se tocaron. */}
            <div className="mt-5 flex items-center gap-2.5">
              <a
                href={CONTACT.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${CONTACT.instagram.handle}`}
                className="text-white/55 transition-colors duration-200 hover:text-[var(--social-instagram)] focus-visible:text-[var(--social-instagram)] active:text-[var(--social-instagram)]"
              >
                <InstagramIcon size={34} />
              </a>
              <a
                href={CONTACT.youtube.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`YouTube ${CONTACT.youtube.handle}`}
                className="text-white/55 transition-colors duration-200 hover:text-[var(--social-youtube)] focus-visible:text-[var(--social-youtube)] active:text-[var(--social-youtube)]"
              >
                <YoutubeIcon size={34} />
              </a>
              <a
                href={CONTACT.tiktok.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`TikTok ${CONTACT.tiktok.handle}`}
                className="text-white/55 transition-colors duration-200 hover:text-[var(--social-tiktok)] focus-visible:text-[var(--social-tiktok)] active:text-[var(--social-tiktok)]"
              >
                <TiktokIcon size={34} />
              </a>
            </div>
          </div>

          {/* Explora */}
          <FooterCol title="Explora">
            <FooterLink href="/tarifas">Tarifas</FooterLink>
            <FooterLink href="/servicios">Servicios</FooterLink>
            <FooterLink href="/pre-alertas">Pre-alertas</FooterLink>
            <FooterLink href="/nosotros">Nosotros</FooterLink>
            <FooterLink href="/portal/login">Mi portal</FooterLink>
            <FooterLink href="/registro">Regístrate</FooterLink>
          </FooterCol>

          {/* Ayuda */}
          <FooterCol title="Ayuda">
            <FooterLink href="/faq">Preguntas frecuentes</FooterLink>
            <FooterLink href="/glosario">Glosario</FooterLink>
              <FooterLink href="/noticias">Actualidad</FooterLink>
            <FooterLink href="/academia">Academia</FooterLink>
            {/* Mismo destino que "Cómo trabajamos" del menú Ayuda (Nav.tsx) —
                deliberado, dos nombres para la misma página (ver comentario ahí). */}
            <FooterLink href="/shipping-mark">Cómo trabajamos</FooterLink>
          </FooterCol>

          {/* Enlaces rápidos */}
          <FooterCol title="Enlaces rápidos">
            {/* Rastreo: el /track público se eliminó (vive dentro del portal). */}
            <FooterLink href="/portal/login">Rastrea tu envío</FooterLink>
            <FooterLink href="/tarifas">Calculadora de envío</FooterLink>
            <FooterLink href="/contacto">Contáctenos</FooterLink>
            <FooterLink href="/enlaces">Enlaces</FooterLink>
          </FooterCol>

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
                {/* El icono verdea con el enlace (no por sí solo): acá el
                    objetivo de clic es la fila entera, no el glifo. */}
                <a
                  href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 text-white/85 hover:text-white transition-colors"
                >
                  <WhatsAppIcon
                    size={15}
                    className="text-white/55 flex-shrink-0 transition-colors duration-200 group-hover:text-[var(--social-whatsapp)] group-focus-visible:text-[var(--social-whatsapp)] group-active:text-[var(--social-whatsapp)]"
                  />
                  <span>{CONTACT.ve.whatsapp} · WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Direcciones VE/CN — franja propia sobre el copyright */}
        <div className="pt-7 pb-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-white/10">
          <a
            href={CONTACT.ve.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-2 text-white/70 hover:text-white transition-colors"
          >
            <MapPinIcon size={13} className="mt-0.5 flex-shrink-0 text-white/50" />
            <span className="text-[13px] leading-[1.5]">
              <span className="block text-[11px] tracking-[0.1em] uppercase text-white/40 mb-0.5">
                Venezuela
              </span>
              {CONTACT.ve.address}, {CONTACT.ve.city}
            </span>
          </a>
          <a
            href={buildGoogleMapsLink(CONTACT.cn.addressFull)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-2 text-white/70 hover:text-white transition-colors"
          >
            <MapPinIcon size={13} className="mt-0.5 flex-shrink-0 text-white/50" />
            <span className="text-[13px] leading-[1.5]">
              <span className="block text-[11px] tracking-[0.1em] uppercase text-white/40 mb-0.5">
                China
              </span>
              {CONTACT.cn.address}, {CONTACT.cn.city}
            </span>
          </a>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
            <span className="text-[12.5px] font-medium tracking-[0.06em] text-white/45">
              © {new Date().getFullYear()} {CONTACT.legalName}. Todos los
              derechos reservados.
            </span>
            {/* Franja legal compacta (patrón Términos/Privacidad/Cookies bajo
                el copyright, referencia del founder 2026-07-21). Reemplaza los
                links sueltos que antes vivían en "Enlaces rápidos". */}
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
              {TERMINOS_LIVE && (
                <FooterLegalLink href="/terminos">Términos</FooterLegalLink>
              )}
              <FooterLegalLink href="/privacidad">Privacidad</FooterLegalLink>
              <FooterLegalLink href="/cookies">Cookies</FooterLegalLink>
              <CookiePreferencesLink className="text-[12.5px] font-medium text-white/45 hover:text-white/80 transition-colors w-fit" />
            </div>
          </div>
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/35">
            CN → VE · Puerta a puerta, todo pagado
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[12.5px] font-bold tracking-[0.12em] uppercase text-white/50 mb-[18px]">
        {title}
      </h2>
      <ul className="flex flex-col gap-3 list-none p-0">
        {Array.isArray(children)
          ? children.filter(Boolean).map((child, i) => <li key={i}>{child}</li>)
          : children}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[14.5px] font-medium text-white/85 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}

function FooterLegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12.5px] font-medium text-white/45 hover:text-white/80 transition-colors"
    >
      {children}
    </Link>
  );
}
