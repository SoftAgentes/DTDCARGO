import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { socialMeta } from "@/lib/seo-og";
import { CONTACT } from "@/lib/design-tokens";

/**
 * `/privacidad` — Política de Privacidad de DTD Cargo (sitio público, fuera del
 * ERP: contenido estático, sin tocar Supabase). Complementa la Política de
 * Cookies (`/cookies`). Borrador comercial-legal v1.0 (pendiente pase de abogado).
 */

const DESC =
  "Política de Privacidad de DTD Cargo — qué datos recogemos, para qué los usamos, con quién los compartimos y qué derechos tienes.";
const UPDATED = "12 de julio de 2026";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: DESC,
  alternates: { canonical: "/privacidad" },
  ...socialMeta({
    title: "Política de Privacidad · DTD Cargo",
    description: DESC,
    path: "/privacidad",
  }),
};

const H2 =
  "text-[17px] sm:text-[19px] font-extrabold text-ink tracking-[-0.01em]";
const P = "mt-2.5 text-[14.5px] leading-[1.7] text-grey-700";
const UL = "mt-3 flex flex-col gap-2 text-[14.5px] leading-[1.6] text-grey-700";

const CAPTURA: [string, string][] = [
  [
    "Formulario de contacto",
    "Nombre, correo, teléfono/WhatsApp y el mensaje que escribes.",
  ],
  [
    "Estimado / Calculadora",
    "Datos del envío (tipo de carga, volumen/peso, origen-destino) y el contacto que dejas para enviarte el estimado (EST-XXXX).",
  ],
  [
    "Registro de cliente",
    "Nombre, documento de identidad (cédula o RIF), correo y teléfono. Al registrarte se genera tu número de cliente (Shipping Mark). La dirección de entrega se agrega después, en tu perfil del Portal.",
  ],
  [
    "Portal del Cliente",
    "Información de tus envíos, direcciones de entrega, foto de tu documento de identidad (cédula/RIF), comprobantes de pago (que pueden incluir datos bancarios), otros documentos que subes, pagos reportados y comunicaciones con nuestro equipo.",
  ],
  [
    "Seguimiento de envío",
    "El código de rastreo que introduces para consultar el estado de tu carga.",
  ],
  [
    "Navegación",
    "Datos técnicos anónimos de uso del sitio (solo si aceptas las cookies de analítica). Ver Política de Cookies.",
  ],
  [
    "Seguridad y registro de actividad",
    "Tu dirección IP y datos técnicos de tu navegador (user-agent), para proteger tu cuenta, prevenir usos indebidos y dejar constancia de tu aceptación electrónica de nuestros términos.",
  ],
];

export default function PrivacidadPage() {
  return (
    <>
      <Nav />
      <main className="bg-paper">
        <section className="py-16 lg:py-24">
          <div className="wrap max-w-[900px]">
            <span className="eyebrow">Legal · DTD Cargo</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
            >
              Política de{" "}
              <span style={{ color: "var(--color-wine)" }}>Privacidad.</span>
            </h1>
            <p className="lead mt-6 max-w-[60ch]">
              En DTD Cargo cuidamos tu información. Aquí te explicamos qué datos
              recogemos, para qué los usamos, con quién los compartimos y qué
              derechos tienes. Es complementaria a nuestra{" "}
              <Link
                href="/cookies"
                className="underline underline-offset-2"
                style={{ color: "var(--color-wine)" }}
              >
                Política de Cookies
              </Link>
              .
            </p>
            <p className="mt-4 text-[13px] text-grey-500">
              Responsable: <strong>DTD Cargo</strong> · Última actualización:{" "}
              {UPDATED}
            </p>
          </div>
        </section>

        <section className="pb-24">
          <div className="wrap max-w-[900px] flex flex-col gap-9">
            <article>
              <h2 className={H2}>1. Qué datos recogemos y cuándo</h2>
              <p className={P}>
                Solo pedimos lo necesario para prestarte el servicio de logística
                puerta a puerta. Recogemos datos en estos momentos:
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse text-[14px]">
                  <thead>
                    <tr className="border-b border-grey-300">
                      <th className="py-2.5 pr-4 font-bold text-ink align-top w-[30%]">
                        Momento
                      </th>
                      <th className="py-2.5 font-bold text-ink align-top">
                        Datos que recogemos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAPTURA.map(([momento, datos]) => (
                      <tr key={momento} className="border-b border-grey-200">
                        <td className="py-3 pr-4 font-semibold text-ink align-top">
                          {momento}
                        </td>
                        <td className="py-3 text-grey-700 leading-[1.6] align-top">
                          {datos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={P}>
                <strong>No pedimos</strong> datos sensibles que no necesitemos, ni
                recogemos información de menores de edad de forma intencional.
              </p>
              <p className={P}>
                <strong>Datos de terceros que nos aportas.</strong> Si nos das
                datos de otra persona —por ejemplo, a quién refieres o quién
                recibirá tu envío en destino—, declaras que cuentas con su permiso
                para compartirlos. Usamos esos datos únicamente para el fin por el
                que nos los diste (enviar la invitación de referido o coordinar la
                entrega).
              </p>
            </article>

            <article>
              <h2 className={H2}>2. Para qué usamos tus datos</h2>
              <ul className={UL}>
                <li>
                  <strong>Prestarte el servicio:</strong> cotizar, coordinar y dar
                  seguimiento a tus envíos puerta a puerta.
                </li>
                <li>
                  <strong>Comunicarnos contigo:</strong> responder consultas,
                  enviarte tu estimado, avisarte del estado de tu carga y enviarte
                  comprobantes o facturas.
                </li>
                <li>
                  <strong>Gestionar tu cuenta</strong> en el Portal del Cliente.
                </li>
                <li>
                  <strong>Cumplir obligaciones</strong> administrativas, contables
                  y legales aplicables a la operación logística.
                </li>
                <li>
                  <strong>Mejorar el sitio</strong> (analítica anónima) y medir
                  nuestras campañas — <strong>solo si aceptas</strong> las cookies
                  correspondientes.
                </li>
              </ul>
              <p className={P}>
                <strong>No vendemos tus datos.</strong> No los usamos para fines
                distintos de los aquí descritos.
              </p>
            </article>

            <article>
              <h2 className={H2}>3. Base para el tratamiento</h2>
              <ul className={UL}>
                <li>
                  <strong>Ejecución del servicio</strong> que solicitas
                  (cotización, envío, cuenta de cliente).
                </li>
                <li>
                  <strong>Tu consentimiento</strong>, para comunicaciones de
                  marketing y para las cookies de analítica y publicidad (que
                  puedes retirar cuando quieras).
                </li>
                <li>
                  <strong>Cumplimiento de obligaciones legales</strong> (por
                  ejemplo, respaldos contables o fiscales).
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>4. Con quién compartimos datos</h2>
              <p className={P}>
                Trabajamos con proveedores de confianza que nos ayudan a operar.
                Solo acceden a lo necesario y bajo obligación de confidencialidad:
              </p>
              <ul className={UL}>
                <li>
                  <strong>Proveedores de infraestructura y alojamiento</strong>{" "}
                  del sitio y la base de datos.
                </li>
                <li>
                  <strong>Proveedor de envío de correos</strong> para mensajes
                  transaccionales (bienvenida, estimados, facturas).
                </li>
                <li>
                  <strong>Herramientas de analítica y publicidad</strong>{" "}
                  (Google), <strong>solo si aceptas</strong> las cookies
                  opcionales y de forma anonimizada.
                </li>
                <li>
                  <strong>Nuestro equipo operativo</strong> en Venezuela y China,
                  para coordinar tu carga.
                </li>
                <li>
                  <strong>Autoridades</strong>, únicamente cuando la ley lo exija.
                </li>
              </ul>
              <p className={P}>
                No compartimos la información de tu Portal con plataformas de
                publicidad. La analítica del sitio y tus datos de cliente están{" "}
                <strong>separados</strong>.
              </p>
            </article>

            <article>
              <h2 className={H2}>5. Transferencias internacionales</h2>
              <p className={P}>
                Operamos entre <strong>China y Venezuela</strong>, así que para
                coordinar tu envío parte de tus datos de contacto y de la carga se
                procesan en ambos países por nuestro propio equipo. Lo hacemos solo
                en la medida necesaria para cumplir con el servicio que
                contrataste.
              </p>
            </article>

            <article>
              <h2 className={H2}>6. Cuánto tiempo guardamos tus datos</h2>
              <ul className={UL}>
                <li>
                  Mientras tengas una <strong>cuenta o relación activa</strong>{" "}
                  con nosotros.
                </li>
                <li>
                  Después, <strong>el tiempo que exijan</strong> las obligaciones
                  legales, contables y fiscales aplicables.
                </li>
                <li>
                  Los datos de <strong>contacto/consultas</strong> que no derivan
                  en servicio se conservan solo lo necesario para atenderte y luego
                  se eliminan o anonimizan.
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>7. Cómo protegemos tus datos</h2>
              <ul className={UL}>
                <li>
                  Acceso a tu información{" "}
                  <strong>restringido a tu propia cuenta</strong> mediante
                  controles de seguridad a nivel de base de datos.
                </li>
                <li>
                  Sesiones <strong>cifradas</strong> y conexiones seguras.
                </li>
                <li>
                  Acceso interno limitado al personal que lo necesita para operar
                  tu envío.
                </li>
                <li>
                  Los documentos que subes se guardan en almacenamiento seguro,
                  accesibles solo con tu sesión.
                </li>
              </ul>
            </article>

            <article>
              <h2 className={H2}>8. Tus derechos</h2>
              <p className={P}>Puedes pedirnos en cualquier momento:</p>
              <ul className={UL}>
                <li>
                  <strong>Acceder</strong> a los datos que tenemos sobre ti.
                </li>
                <li>
                  <strong>Corregir</strong> datos inexactos (también desde tu
                  perfil en el Portal).
                </li>
                <li>
                  <strong>Eliminar</strong> tu cuenta y tus datos, salvo lo que
                  debamos conservar por ley.
                </li>
                <li>
                  <strong>Retirar tu consentimiento</strong> para marketing o
                  cookies, sin que afecte el servicio ya prestado.
                </li>
              </ul>
              <p className={P}>
                Para ejercerlos, escríbenos a{" "}
                <a
                  href={`mailto:${CONTACT.emailGeneral}`}
                  className="underline underline-offset-2"
                  style={{ color: "var(--color-wine)" }}
                >
                  {CONTACT.emailGeneral}
                </a>
                . Te responderemos en un plazo razonable.
              </p>
            </article>

            <article>
              <h2 className={H2}>9. Comunicaciones de marketing</h2>
              <p className={P}>
                Si te suscribes o aceptas recibir novedades, puedes{" "}
                <strong>darte de baja</strong> en cualquier momento desde el enlace
                de cada correo o escribiéndonos. Los correos{" "}
                <strong>transaccionales</strong> (relacionados con tu envío, cuenta
                o factura) no son marketing y se envían aunque no estés suscrito a
                novedades, porque son parte del servicio.
              </p>
            </article>

            <article>
              <h2 className={H2}>10. Cambios en esta política</h2>
              <p className={P}>
                Podemos actualizar esta política. Publicaremos siempre la versión
                vigente en esta página, con su fecha de actualización. Si el cambio
                es importante, te lo comunicaremos.
              </p>
            </article>

            <article>
              <h2 className={H2}>11. Contacto</h2>
              <p className={P}>
                ¿Dudas sobre tu privacidad? Escríbenos a{" "}
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
