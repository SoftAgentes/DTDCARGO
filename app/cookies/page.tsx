import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { CookiePreferencesLink } from "@/components/CookiePreferencesLink";
import { socialMeta } from "@/lib/seo-og";
import { CONTACT } from "@/lib/design-tokens";

/**
 * `/cookies` — Política de Cookies de DTD Cargo (sitio público, contenido
 * estático fuera del ERP). Tablas de cookies reales por categoría + sección de
 * datos del Portal. Borrador comercial-legal v1.0 (pendiente pase de abogado).
 */

const DESC =
  "Política de Cookies de DTD Cargo — qué cookies usamos, cuáles son opcionales y cómo cambiar tu consentimiento.";
const UPDATED = "12 de julio de 2026";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description: DESC,
  alternates: { canonical: "/cookies" },
  ...socialMeta({
    title: "Política de Cookies · DTD Cargo",
    description: DESC,
    path: "/cookies",
  }),
};

const H2 =
  "text-[17px] sm:text-[19px] font-extrabold text-ink tracking-[-0.01em]";
const H3 = "text-[15px] font-bold text-ink mt-5";
const P = "mt-2.5 text-[14.5px] leading-[1.7] text-grey-700";
const UL = "mt-3 flex flex-col gap-2 text-[14.5px] leading-[1.6] text-grey-700";

type Row = { cookie: string; quien: string; duracion: string; para: string };

function CookieTable({ rows }: { rows: Row[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left border-collapse text-[13.5px] min-w-[560px]">
        <thead>
          <tr className="border-b border-grey-300">
            <th className="py-2.5 pr-4 font-bold text-ink align-top">Cookie</th>
            <th className="py-2.5 pr-4 font-bold text-ink align-top">
              Quién la pone
            </th>
            <th className="py-2.5 pr-4 font-bold text-ink align-top">
              Duración
            </th>
            <th className="py-2.5 font-bold text-ink align-top">Para qué</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cookie} className="border-b border-grey-200">
              <td className="py-3 pr-4 align-top">
                <code className="text-[12.5px] text-ink">{r.cookie}</code>
              </td>
              <td className="py-3 pr-4 text-grey-700 align-top">{r.quien}</td>
              <td className="py-3 pr-4 text-grey-700 align-top">{r.duracion}</td>
              <td className="py-3 text-grey-700 leading-[1.6] align-top">
                {r.para}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NECESARIAS: Row[] = [
  {
    cookie: "sb-…-auth-token",
    quien: "DTD Cargo (proveedor de infraestructura)",
    duracion: "Sesión",
    para: "Mantener tu sesión iniciada de forma segura en el Portal del Cliente.",
  },
  {
    cookie: "Verificación de login (PKCE)",
    quien: "DTD Cargo (proveedor de infraestructura)",
    duracion: "Minutos, durante el login",
    para: "Completar el inicio de sesión con enlace mágico de forma segura.",
  },
  {
    cookie: "dtd_cookie_consent",
    quien: "DTD Cargo",
    duracion: "6 meses",
    para: "Recordar si aceptaste o rechazaste las cookies opcionales.",
  },
];

const FUNCIONALES: Row[] = [
  {
    cookie: "portal-theme",
    quien: "DTD Cargo",
    duracion: "12 meses",
    para: "Recordar si prefieres el Portal en modo claro u oscuro.",
  },
];

const ANALITICA: Row[] = [
  {
    cookie: "_ga",
    quien: "Google Analytics 4",
    duracion: "2 años",
    para: "Distinguir visitantes de forma anónima para medir el uso del sitio.",
  },
  {
    cookie: "_ga_25CD7BZH98",
    quien: "Google Analytics 4",
    duracion: "2 años",
    para: "Mantener el estado de la sesión de analítica.",
  },
];

const PUBLICIDAD: Row[] = [
  {
    cookie: "_gcl_au",
    quien: "Google Ads",
    duracion: "90 días",
    para: "Atribuir de forma anónima si llegaste desde un anuncio (medir conversiones).",
  },
  {
    cookie: "_gcl_aw / _gcl_gb",
    quien: "Google Ads",
    duracion: "90 días",
    para: "Solo si llegas desde un clic de anuncio de Google; miden esa conversión.",
  },
];

export default function CookiesPage() {
  return (
    <>
      <Nav />
      {/* Reskin mínimo al Norte: hero navy `rp-*`. Texto legal, tablas de
          cookies, banner de consentimiento y `noindex` sin tocar. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "900px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Legal · DTD Cargo
            </div>
            <h1>
              Política de <span className="accent">Cookies.</span>
            </h1>
            <p>
              Cómo usamos las cookies en dtdcargo.com: cuáles son necesarias,
              cuáles son opcionales y cómo cambiar tu decisión cuando quieras.
            </p>
            <p className="rp-hero-meta">
              <span>
                Operador del sitio: <strong>DTD Cargo</strong>
              </span>
              <span>Última actualización: {UPDATED}</span>
            </p>
          </div>
        </section>

        <section className="pb-24 pt-12 lg:pt-16">
          {/* Ver nota en /privacidad: `max-w-[900px]` pierde contra `.wrap`. */}
          <div className="wrap flex flex-col gap-9" style={{ maxWidth: 900 }}>
            <article>
              <h2 className={H2}>1. Qué es una cookie</h2>
              <p className={P}>
                Una cookie es un pequeño archivo de texto que un sitio web guarda
                en tu navegador (o dispositivo) cuando lo visitas. Sirve para que
                el sitio funcione, recuerde tus preferencias o entienda cómo se
                usa. Algunas se borran al cerrar el navegador (de sesión) y otras
                permanecen un tiempo (persistentes). En esta política tratamos
                igual a las cookies y a otras tecnologías equivalentes de
                almacenamiento local del navegador.
              </p>
            </article>

            <article>
              <h2 className={H2}>2. Cómo pedimos tu consentimiento</h2>
              <p className={P}>
                Dividimos las cookies en <strong>necesarias</strong> (que no
                requieren tu permiso porque sin ellas el servicio no funciona) y{" "}
                <strong>opcionales</strong> (analítica y publicidad, que solo
                activamos si las aceptas).
              </p>
              <ul className={UL}>
                <li>
                  <strong>
                    Mientras solo navegas y lees el sitio, no instalamos ninguna
                    cookie opcional.
                  </strong>{" "}
                  Las cookies de analítica y publicidad de Google arrancan en un
                  modo restringido, sin almacenar información en tu equipo, hasta
                  que das tu consentimiento.
                </li>
                <li>
                  Cuando vas a <strong>registrarte o iniciar sesión</strong> en el
                  Portal del Cliente, te mostramos el aviso de cookies para que
                  aceptes o rechaces las opcionales. También puedes cambiar tu
                  decisión cuando quieras (ver sección 7).
                </li>
                <li>
                  Las cookies <strong>estrictamente necesarias</strong> (por
                  ejemplo, mantener tu sesión iniciada) se activan siempre que usas
                  esas funciones, porque son imprescindibles para prestarte el
                  servicio que pediste.
                </li>
              </ul>
              <p className={P}>
                Tu elección se guarda en una cookie propia (
                <code className="text-[13px]">dtd_cookie_consent</code>) para no
                volver a preguntarte en cada visita.
              </p>
            </article>

            <article>
              <h2 className={H2}>3. Qué cookies usamos</h2>

              <h3 className={H3}>
                a) Estrictamente necesarias (siempre activas)
              </h3>
              <CookieTable rows={NECESARIAS} />
              <p className="mt-3 text-[13px] leading-[1.6] text-grey-500">
                Estas cookies <strong>no</strong> se usan para publicidad ni se
                comparten con terceros con fines de marketing. Sin ellas, el Portal
                no puede mantenerte identificado ni proteger tus datos.
              </p>

              <h3 className={H3}>b) De preferencia / funcionales</h3>
              <CookieTable rows={FUNCIONALES} />

              <h3 className={H3}>
                c) De analítica <em>(opcionales — solo si las aceptas)</em>
              </h3>
              <CookieTable rows={ANALITICA} />
              <p className="mt-3 text-[13px] leading-[1.6] text-grey-500">
                Usamos Google Analytics 4 solo en las páginas públicas de
                marketing. <strong>Nunca</strong> cargamos analítica dentro del
                Portal del Cliente ni en páginas cuya dirección contenga datos
                tuyos (tu número de cliente / Shipping Mark, tokens o enlaces
                personales): esas zonas quedan excluidas para no enviar información
                personal a Google.
              </p>

              <h3 className={H3}>
                d) De publicidad <em>(opcionales — solo si las aceptas)</em>
              </h3>
              <CookieTable rows={PUBLICIDAD} />
            </article>

            <article>
              <h2 className={H2}>4. Tus datos en el Portal del Cliente</h2>
              <p className={P}>
                El Portal del Cliente maneja{" "}
                <strong>información confidencial</strong> (tus envíos, direcciones,
                documentos y datos de contacto). Queremos ser claros sobre esto:
              </p>
              <ul className={UL}>
                <li>
                  <strong>Las cookies del Portal son únicamente de sesión y
                  seguridad.</strong>{" "}
                  No usamos cookies de publicidad ni de rastreo dentro del Portal.
                </li>
                <li>
                  Tu sesión viaja <strong>cifrada</strong> y protegida; el acceso a
                  tu información está restringido a tu propia cuenta mediante
                  controles de seguridad a nivel de base de datos.
                </li>
                <li>
                  <strong>No compartimos</strong> los datos de tu Portal con Google
                  ni con ninguna plataforma de publicidad o analítica. La analítica
                  del sitio y los datos del Portal están completamente separados.
                </li>
                <li>
                  Los documentos y archivos que subes no se guardan en cookies: se
                  almacenan de forma segura y solo accesibles con tu sesión.
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>5. Terceros que instalan cookies</h2>
              <p className={P}>
                El único tercero que puede instalar cookies en tu navegador a
                través de nuestro sitio es <strong>Google</strong> (Google
                Analytics 4 y Google Ads), y <strong>solo si aceptas</strong> las
                cookies opcionales. Puedes consultar cómo trata Google la
                información en{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  su política de privacidad
                </a>{" "}
                y en{" "}
                <a
                  href="https://policies.google.com/technologies/cookies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  cómo usa Google las cookies
                </a>
                .
              </p>
            </article>

            <article>
              <h2 className={H2}>6. Base para usar cookies</h2>
              <ul className={UL}>
                <li>
                  <strong>Necesarias y de sesión:</strong> son imprescindibles para
                  prestarte el servicio que solicitaste (por ejemplo, entrar al
                  Portal), por lo que se usan sin requerir consentimiento.
                </li>
                <li>
                  <strong>Analítica y publicidad:</strong> se usan{" "}
                  <strong>con base en tu consentimiento</strong>, que puedes
                  otorgar o retirar libremente en cualquier momento.
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>7. Cómo cambiar o retirar tu consentimiento</h2>
              <ul className={UL}>
                <li>
                  Puedes <strong>cambiar tu decisión</strong> desde{" "}
                  <CookiePreferencesLink className="underline underline-offset-2 font-semibold text-wine" />{" "}
                  (también disponible en el pie de página del sitio).
                </li>
                <li>
                  Puedes <strong>borrar o bloquear</strong> cookies desde la
                  configuración de tu navegador. Si bloqueas las necesarias,
                  algunas funciones del Portal podrían dejar de funcionar.
                </li>
                <li>
                  Chrome, Safari, Firefox y Edge tienen secciones de
                  &ldquo;Privacidad y seguridad&rdquo; donde puedes gestionar y
                  eliminar cookies.
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>8. Cambios en esta política</h2>
              <p className={P}>
                Podemos actualizar esta política si cambian las tecnologías que
                usamos o la normativa aplicable. Publicaremos siempre la versión
                vigente en esta página, con su fecha de actualización.
              </p>
            </article>

            <article>
              <h2 className={H2}>9. Contacto</h2>
              <p className={P}>
                Si tienes dudas sobre esta política o sobre el tratamiento de tus
                datos, escríbenos a{" "}
                <a
                  href={`mailto:${CONTACT.emailGeneral}`}
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  {CONTACT.emailGeneral}
                </a>{" "}
                o por WhatsApp al{" "}
                <a
                  href={`https://wa.me/${CONTACT.ve.whatsappRaw}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  {CONTACT.ve.whatsapp}
                </a>
                . Consulta también nuestra{" "}
                <Link
                  href="/privacidad"
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  Política de Privacidad
                </Link>
                .
              </p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
