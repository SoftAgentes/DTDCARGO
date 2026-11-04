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
// Al cambiar QUÉ se recoge hay que mover esta fecha: la política se publica con
// su fecha de vigencia y lo publicado obliga por haberse publicado. El 2026-08-05
// el registro pasó a pedir ciudad y estado de entrega (migr 0348) y el texto
// todavía decía que la dirección se agregaba después, en el Portal. El
// 2026-09-19 (SDD-0487) el Portal empezó a recoger la empresa para facturar y
// la foto de perfil pasó a guardarse sin metadatos. El 2026-10-30 (SDD-0585,
// paso 2.6) se sumaron los mensajes por WhatsApp y chat: el seguimiento del
// lead (SDD-0587), el BSUID y la respuesta automática (SDD-0586) con sus plazos.
// SDD-0587, paso 6.4, suma a «Registro de cliente» la campaña por la que llegó.
// OJO: este texto describe tablas y crons que entran con las PR de E2, E6 y E10.
// Sam aprobó este texto exacto el 2026-11-03: si cambia una palabra, se le vuelve
// a preguntar. Sale solo con la tanda A y esas piezas en producción: lo publicado
// obliga por haberse publicado.
const UPDATED = "4 de noviembre de 2026";

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
    "Mensajes por WhatsApp y chat",
    "Si nos escribes por WhatsApp u otro canal de chat: tu nombre y tu teléfono tal como aparecen en ese canal y el contenido de la conversación. Si no muestras tu teléfono, WhatsApp nos da en su lugar un código anónimo de tu cuenta (BSUID). Si todavía no eres cliente, guardamos tu nombre visible y los últimos 10 dígitos de tu teléfono para dar seguimiento a tu consulta.",
  ],
  [
    "Estimado / Calculadora",
    "Datos del envío (tipo de carga, volumen/peso, origen-destino) y el contacto que dejas para enviarte el estimado (EST-XXXX).",
  ],
  [
    "Registro de cliente",
    "Nombre, documento de identidad (cédula o RIF), correo, teléfono y la ciudad y el estado a donde entregamos tu mercancía. También guardamos la campaña por la que llegaste, si el enlace la trae. Al registrarte se genera tu número de cliente (Shipping Mark). La dirección detallada (calle, edificio, punto de referencia) la agregas después, en tu perfil del Portal.",
  ],
  [
    "Portal del Cliente",
    "Información de tus envíos, direcciones de entrega, foto de tu documento de identidad (cédula/RIF), tu foto de perfil si la subes (la guardamos sin la ubicación ni los demás datos ocultos de la imagen), los datos de tu empresa si la agregas para facturar (razón social, RIF y, si lo cargas, domicilio fiscal), comprobantes de pago (que pueden incluir datos bancarios), otros documentos que subes, pagos reportados y comunicaciones con nuestro equipo.",
  ],
  [
    "Seguimiento de envío",
    "El Shipping Mark o el número de envío que nos indicas al consultar con nuestro equipo el estado de tu carga.",
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
      {/* Reskin mínimo al Norte: hero navy `rp-*`. El texto legal y la
          estructura de secciones no se tocan.
          (Nota 2026-07-30: el comentario anterior hablaba de un `noindex` que
          nunca existió en el metadata de esta página — y está bien que no exista:
          una política de privacidad tiene que ser pública e indexable.) */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "900px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Legal · DTD Cargo
            </div>
            <h1>
              Política de <span className="accent">Privacidad.</span>
            </h1>
            <p>
              En DTD Cargo cuidamos tu información. Aquí te explicamos qué datos
              recogemos, para qué los usamos, con quién los compartimos y qué
              derechos tienes. Es complementaria a nuestra{" "}
              <Link href="/cookies" className="rp-plain underline underline-offset-2">
                Política de Cookies
              </Link>
              .
            </p>
            <p className="rp-hero-meta">
              <span>
                Responsable: <strong>DTD Cargo</strong>
              </span>
              <span>Última actualización: {UPDATED}</span>
            </p>
          </div>
        </section>

        <section className="pb-24 pt-12 lg:pt-16">
          {/* `max-w-[900px]` de Tailwind NO gana contra `.wrap{max-width:var(--maxw)}`
              (las utilidades v4 van en @layer y pierden contra la regla sin capa):
              el texto legal venía corriendo a 1280px, muy por encima del measure
              de 45-75 caracteres de BRAND.md. Se fija por estilo inline, que sí
              gana, y de paso alinea con el hero `rp-*`. */}
          <div className="wrap flex flex-col gap-9" style={{ maxWidth: 900 }}>
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
                  <strong>Atender tus mensajes por WhatsApp y chat:</strong>{" "}
                  saber si ya eres cliente para que te atienda el equipo que
                  corresponde, darle seguimiento a tu consulta y, al primer
                  mensaje, enviarte una respuesta automática. Guardamos un registro
                  de esas respuestas automáticas para no repetirlas.
                </li>
                <li>
                  <strong>Facturarte a tu nombre o al de tu empresa:</strong> si
                  agregas una empresa en tu perfil, usamos su razón social, su RIF
                  y, si lo cargas, su domicilio fiscal para emitir las facturas que
                  elijas a su nombre. Esos datos quedan en cada factura emitida.
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
                  del sitio y la base de datos, con servidores en Estados
                  Unidos, y un proveedor de almacenamiento donde guardamos
                  copias de respaldo cifradas.
                </li>
                <li>
                  <strong>Proveedor de envío de correos</strong> para mensajes
                  transaccionales (bienvenida, estimados, facturas).
                </li>
                <li>
                  <strong>Meta (WhatsApp)</strong>, que transporta los mensajes
                  que nos envías y te enviamos por WhatsApp. Las conversaciones
                  las atendemos en nuestro propio sistema de atención, alojado en
                  nuestro servidor.
                </li>
                <li>
                  <strong>Herramientas de analítica y publicidad</strong>{" "}
                  (Google), <strong>solo si aceptas</strong> las cookies
                  opcionales y de forma anonimizada.
                </li>
                <li>
                  <strong>Nuestro equipo en Venezuela</strong>, para coordinar tu
                  envío y la entrega.
                </li>
                <li>
                  <strong>Nuestro equipo en China</strong>, que trabaja{" "}
                  <strong>solo con tu Shipping Mark</strong> (tu código de
                  cliente) y los datos de la mercancía. <strong>No ve tu nombre</strong>,
                  ni tu documento, ni tu dirección, ni tu teléfono.
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
                Operamos entre <strong>China y Venezuela</strong>. Tus datos
                identificatorios —nombre, documento, dirección y teléfono— los
                trata <strong>nuestro equipo en Venezuela</strong>, y se alojan
                en servidores ubicados en <strong>Estados Unidos</strong>,
                operados por un proveedor de infraestructura. Las copias de
                respaldo se guardan <strong>cifradas</strong> en otro proveedor,
                también en Estados Unidos: solo nosotros tenemos la clave para
                abrirlas.
              </p>
              <p className={P}>
                Nuestro equipo en China trabaja con tu{" "}
                <strong>Shipping Mark</strong> y con los datos de la mercancía
                (proveedor, cajas, volumen, peso). Ese código identifica tu carga
                sin revelar quién eres: por eso el almacén puede recibir, estibar y
                etiquetar tus cajas <strong>sin conocer tu identidad</strong>. Es
                una decisión de diseño, no una casualidad — y está implementada en
                el sistema, no solo escrita acá.
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
                <li>
                  Si nos escribiste por <strong>WhatsApp o chat</strong> y no
                  llegaste a ser cliente, cuando tu consulta queda cerrada sin
                  servicio <strong>anonimizamos</strong> sus datos de seguimiento
                  (nombre, teléfono, identificadores del chat y notas) a los{" "}
                  <strong>12 meses sin actividad</strong>.
                </li>
                <li>
                  El <strong>código anónimo de WhatsApp (BSUID)</strong> se borra
                  al <strong>año sin actividad</strong>, y el registro de las
                  respuestas automáticas, a los <strong>30 días</strong>.
                </li>
                <li>
                  Las <strong>copias de respaldo</strong> se conservan{" "}
                  <strong>30 días</strong>. Lo que eliminas desaparece de nuestra
                  base al momento, y de los respaldos al cumplirse ese plazo.
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
                <li>
                  Las copias de respaldo se <strong>cifran antes de salir</strong>{" "}
                  de nuestro servidor, y la clave para abrirlas no se guarda ni
                  en el servidor ni con el proveedor de respaldos.
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
