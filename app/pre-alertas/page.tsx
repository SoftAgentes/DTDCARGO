import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { serializeJsonLd } from "@/lib/public/json-ld";

/**
 * `/pre-alertas` — landing de la pre-alerta de carga (acción del portal).
 *
 * Rebuild fiel al mockup Cloud Design ("Pre-alertas · DTD-Cargo.html" +
 * `web/prealertas.css`): hero con el panel "estado de una pre-alerta" +
 * respuesta rápida (GEO) + los 4 pasos + 4 bloques infográficos (modalidad,
 * notas, Shipping Mark, consolidación) + condiciones importantes + CTA
 * final. Estilos scopeados en `.pa-surface` (`app/prealertas.css`) — cero
 * hex inventado, ver los comentarios de adaptación en ese archivo.
 *
 * Es la única página de primer nivel del nav que Cloud Design diseñó y el
 * repo todavía no tenía construida (aparece en 5 mockups distintos, entre
 * "Servicios" y "Acceder" — ver `components/Nav.tsx`).
 *
 * AJUSTE DE VERDAD COMERCIAL (founder 2026-07-20): el mockup presenta
 * marítimo y aéreo como dos modalidades simétricas y disponibles hoy. El
 * servicio aéreo está SUSPENDIDO (mismo estado que la referencia del
 * portal, `portal/app.jsx` ~L3829: tarjeta atenuada + badge "Próximamente").
 * El bloque "Modalidad de envío" ajusta el ítem de aéreo para no prometer
 * algo que no está activo — el resto de la página se transcribe tal cual
 * el copy aprobado.
 *
 * Todos los CTA "Iniciar pre-alerta" van a `/portal/login`: pre-alertar es
 * una acción del portal (requiere sesión), no del sitio público.
 */

const DESC =
  "Pre-alerta tu carga antes de que salga de China: registra tu compra, define la modalidad de envío y sigue cada paso con tu Shipping Mark, desde la bodega en Yiwu hasta tu puerta en Venezuela.";

export const metadata: Metadata = {
  title: "Pre-alertas",
  description: DESC,
  keywords: [
    "pre-alerta de carga",
    "Shipping Mark",
    "bodega Yiwu",
    "modalidad de envío China Venezuela",
    "consolidación de carga",
    "importar de China a Venezuela",
  ],
  alternates: { canonical: "/pre-alertas" },
  ...socialMeta({
    title: "Pre-alertas · DTD Cargo",
    description: DESC,
    path: "/pre-alertas",
  }),
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

// Mismo patrón que app/shipping-mark/page.tsx — paridad SEO/GEO entre las
// páginas hermanas que explican un mecanismo del servicio (no un producto
// del catálogo comercial, por eso no usa buildOfferCatalog).
const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Pre-alerta de carga",
  serviceType: "Aviso previo de compra + elección de modalidad de envío",
  description: DESC,
  areaServed: [
    { "@type": "Country", name: "China" },
    { "@type": "Country", name: "Venezuela" },
  ],
  provider: { "@id": `${SITE_URL}/#organization` },
  url: `${SITE_URL}/pre-alertas`,
};

const wa = buildWhatsAppLink(
  "Hola DTD Cargo, tengo una duda sobre cómo pre-alertar mi carga. ¿Me ayudan?",
);

export default function PreAlertasPage() {
  return (
    <>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Pre-alertas", path: "/pre-alertas" },
        ]}
      />

      <main className="pa-surface">
        {/* ── Hero ── */}
        <section className="pa-hero">
          <div className="pa-hero-in">
            <div>
              <div className="eyebrow-h">
                <span className="rule" aria-hidden />
                Toma el control de tu carga
              </div>
              <h1 className="pa-h1">
                Pre-alerta tu carga{" "}
                <span className="accent">antes de que salga de China.</span>
              </h1>
              <p className="pa-lead">
                Avísanos que viene tu mercancía y define cómo debe viajar.
                Nuestro equipo en Yiwu la recibe con tu Shipping Mark, la
                revisa y la consolida — tú sigues cada paso desde el portal.
              </p>
              <div className="pa-hero-ctas">
                <Link href="/portal/login" className="btn btn-primary btn-lg">
                  Iniciar pre-alerta
                </Link>
                <a href="#como-funciona" className="btn btn-ghost btn-lg">
                  Ver cómo funciona
                </a>
              </div>
              <div className="pa-hero-note">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 8v4l2.5 2.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                Aplican ciertas condiciones · pre-alerta antes de que la carga
                llegue a bodega Yiwu.
              </div>
            </div>

            {/* panel mock: estado de una pre-alerta */}
            <div
              className="pa-hero-card"
              aria-label="Ejemplo de estado de una pre-alerta"
            >
              <div className="pa-card-top">
                <div className="pa-card-mark">
                  DTD-5532
                  <small>Shipping Mark</small>
                </div>
                <span className="pa-chip">Pre-alertada</span>
              </div>
              <div className="pa-card-steps">
                <div className="pa-cs pa-cs--done">
                  <span className="pa-cs-ic">
                    <CheckIcon />
                  </span>
                  <span className="pa-cs-txt">
                    Compra registrada
                    <small>Modalidad marítima · 3 bultos</small>
                  </span>
                </div>
                <div className="pa-cs pa-cs--now">
                  <span className="pa-cs-ic">
                    <BoxIcon />
                  </span>
                  <span className="pa-cs-txt">
                    En bodega Yiwu
                    <small>Recibida e inspeccionada con fotos</small>
                  </span>
                </div>
                <div className="pa-cs pa-cs--wait">
                  <span className="pa-cs-ic">
                    <TruckIcon />
                  </span>
                  <span className="pa-cs-txt">
                    En tránsito a Venezuela
                    <small>Consolidación y aduana</small>
                  </span>
                </div>
                <div className="pa-cs pa-cs--wait">
                  <span className="pa-cs-ic">
                    <HouseIcon />
                  </span>
                  <span className="pa-cs-txt">
                    Entrega a tu puerta
                    <small>Cobertura nacional</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Respuesta rápida (GEO) — citable por asistentes de voz / IA */}
        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Qué es una pre-alerta en DTD Cargo?"
          respuesta="Es el aviso que registras en el portal antes de que tu carga salga de China: incluyes el proveedor, los bultos y el valor del pedido, y confirmas la modalidad de envío. Con tu Shipping Mark, nuestro equipo en Yiwu identifica tu carga al recibirla, la revisa con fotos y la consolida junto a tus otros pedidos hasta la entrega puerta a puerta en Venezuela."
        />

        {/* ── Cómo funciona ── */}
        <section className="pa-steps scroll-mt-24" id="como-funciona">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow-s">
                <span className="rule" aria-hidden />
                Cómo funciona
              </div>
              <h2 className="h2">
                Cuatro pasos, <span className="accent">una sola pre-alerta.</span>
              </h2>
              <p className="sec-sub">
                Desde que compras en China hasta que recibimos tu carga en
                Yiwu, la pre-alerta mantiene a todo el equipo trabajando con
                la misma información.
              </p>
            </div>
            <div className="pa-steps-grid">
              <div className="pa-step">
                <span className="pa-step-n">01</span>
                <div className="pa-step-ic">
                  <ClipboardIcon />
                </div>
                <h3>Registra tu compra</h3>
                <p>
                  Crea la pre-alerta en el portal con el proveedor, los
                  bultos y el valor de tu pedido.
                </p>
              </div>
              <div className="pa-step">
                <span className="pa-step-n">02</span>
                <div className="pa-step-ic">
                  <TruckIcon />
                </div>
                <h3>Elige la modalidad y otros servicios</h3>
                <p>
                  Indica la vía (marítima o aérea) y los servicios extra de
                  tu pre-alerta, como revisión. Puedes ajustarlos antes de
                  que llegue a bodega.
                </p>
              </div>
              <div className="pa-step">
                <span className="pa-step-n">03</span>
                <div className="pa-step-ic">
                  <BoxIcon />
                </div>
                <h3>Recibimos en Yiwu</h3>
                <p>
                  Con tu Shipping Mark identificamos tu carga, la
                  inspeccionamos y te enviamos fotos.
                </p>
              </div>
              <div className="pa-step">
                <span className="pa-step-n">04</span>
                <div className="pa-step-ic">
                  <WarehouseIcon />
                </div>
                <h3>Consolidamos y despachamos</h3>
                <p>
                  Juntamos tus pedidos, gestionamos aduana e impuestos y
                  coordinamos la entrega final.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bloques infográficos ── */}
        <section className="pa-blocks">
          <div className="pa-blocks-in">
            {/* 1 · Modalidad — ver AJUSTE DE VERDAD COMERCIAL arriba */}
            <div className="pa-block">
              <div className="pa-block-visual">
                <div className="pa-bigicon">
                  <ShipIcon />
                </div>
              </div>
              <div className="pa-block-txt">
                <div className="pa-b-eyebrow">
                  <span className="rule" aria-hidden />
                  Modalidad de envío
                </div>
                <h2>Pre-alerta la modalidad de tu carga</h2>
                <p>
                  Ratifica o cambia tu envío marítimo o aéreo antes de que
                  llegue a nuestra bodega en Yiwu. Elige según urgencia y
                  volumen; nosotros te asesoramos si dudas.
                </p>
                <ul className="pa-b-list">
                  <li>
                    <CheckIcon />
                    Marítimo para grandes volúmenes y mejor tarifa
                  </li>
                  <li className="pa-b-item-soon">
                    <CheckIcon />
                    <span>
                      Aéreo — próximamente, para cuando necesites tu carga
                      con prisa
                    </span>
                    <span className="pa-soon">Próximamente</span>
                  </li>
                </ul>
                <div className="pa-b-ctas">
                  <Link href="/portal/login" className="btn btn-primary">
                    Iniciar pre-alerta
                  </Link>
                </div>
              </div>
            </div>

            {/* 2 · Notas */}
            <div className="pa-block">
              <div className="pa-block-visual">
                <div className="pa-bigicon">
                  <DocIcon />
                </div>
              </div>
              <div className="pa-block-txt">
                <div className="pa-b-eyebrow">
                  <span className="rule" aria-hidden />
                  Notas del pedido
                </div>
                <h2>Deja notas detalladas sobre tu pedido</h2>
                <p>
                  Cuéntanos qué debe considerar nuestro equipo antes de que
                  tu carga llegue: proveedor, instrucciones de empaque,
                  fragilidad o cualquier detalle importante.
                </p>
                <ul className="pa-b-list">
                  <li>
                    <CheckIcon />
                    Instrucciones para recepción e inspección
                  </li>
                  <li>
                    <CheckIcon />
                    Datos del proveedor y número de seguimiento
                  </li>
                </ul>
                <div className="pa-b-ctas">
                  <Link href="/portal/login" className="btn btn-primary">
                    Iniciar pre-alerta
                  </Link>
                </div>
              </div>
            </div>

            {/* 3 · Shipping Mark */}
            <div className="pa-block">
              <div className="pa-block-visual">
                <div className="pa-bigicon">
                  <TagIcon />
                </div>
              </div>
              <div className="pa-block-txt">
                <div className="pa-b-eyebrow">
                  <span className="rule" aria-hidden />
                  Shipping Mark <span style={{ fontFamily: "var(--f-cn)" }}>(唛头)</span>
                </div>
                <h2>Tu carga, siempre identificada</h2>
                <p>
                  Cada pre-alerta genera tu Shipping Mark (código{" "}
                  <b>DTD-XXXX</b>). Es la etiqueta que viaja con tu mercancía
                  y la conecta contigo en cada momento, de la bodega en Yiwu
                  hasta tu puerta.
                </p>
                <ul className="pa-b-list">
                  <li>
                    <CheckIcon />
                    Recepción sin confusiones en bodega
                  </li>
                  <li>
                    <CheckIcon />
                    Seguimiento de punta a punta desde el portal
                  </li>
                </ul>
                <div className="pa-b-ctas">
                  <Link href="/shipping-mark" className="btn btn-primary">
                    Obtén tu Shipping Mark
                  </Link>
                </div>
              </div>
            </div>

            {/* 4 · Consolidación */}
            <div className="pa-block">
              <div className="pa-block-visual">
                <div className="pa-bigicon">
                  <StackIcon />
                </div>
              </div>
              <div className="pa-block-txt">
                <div className="pa-b-eyebrow">
                  <span className="rule" aria-hidden />
                  Consolidación
                </div>
                <h2>Junta varios pedidos y ahorra</h2>
                <p>
                  Mantén en espera los pedidos que van llegando a la bodega
                  y, cuando los reúnas, actívalos en un solo envío
                  consolidado. Menos flete, un solo despacho.
                </p>
                <ul className="pa-b-list">
                  <li>
                    <CheckIcon />
                    Varios proveedores en un mismo contenedor
                  </li>
                  <li>
                    <CheckIcon />
                    Optimiza el costo por CBM
                  </li>
                </ul>
                <div className="pa-b-ctas">
                  <Link href="/portal/login" className="btn btn-primary">
                    Iniciar pre-alerta
                  </Link>
                  <Link href="/tarifas" className="btn btn-ghost">
                    Calcular CBM
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Condiciones importantes ── */}
        <section className="pa-cond">
          <div className="wrap">
            <div className="pa-cond-grid">
              <div className="pa-cond-head">
                <div className="eyebrow-s">
                  <span className="rule" aria-hidden />
                  Importante
                </div>
                <h2 className="h2">
                  Antes de pre-alertar, <span className="accent">ten esto en cuenta.</span>
                </h2>
                <p className="sec-sub">
                  Condiciones que ayudan a que tu carga viaje sin
                  contratiempos. Ante cualquier duda, tu asesor te acompaña
                  por WhatsApp.
                </p>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: "var(--s-6)" }}
                >
                  Hablar con un asesor
                </a>
              </div>
              <ul className="pa-cond-list">
                <li>
                  <span className="pa-cond-n">1</span>
                  <div>
                    <h3>La identificación corre por cuenta del cliente</h3>
                    <p>
                      Cada pedido debe llevar tu Shipping Mark correcto.
                      Verifica que tu proveedor lo incluya antes de
                      despachar a nuestra bodega.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pa-cond-n">2</span>
                  <div>
                    <h3>Pre-alerta a tiempo</h3>
                    <p>
                      Registra o cambia la modalidad antes de que la carga
                      llegue a bodega Yiwu. Fuera de ese plazo, la solicitud
                      puede no hacerse efectiva.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pa-cond-n">3</span>
                  <div>
                    <h3>Sin modalidad definida</h3>
                    <p>
                      Si un paquete llega sin modalidad indicada, se
                      gestiona según la información disponible al momento
                      de recepción.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pa-cond-n">4</span>
                  <div>
                    <h3>Hold para consolidar</h3>
                    <p>
                      Puedes mantener pedidos en espera para consolidarlos.
                      Pasado el plazo acordado, puede aplicar un cargo por
                      almacenaje.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="pa-final">
          <div className="pa-final-in">
            <div>
              <div className="eyebrow-f">Empieza ahora</div>
              <h2>¿Listo para pre-alertar tu carga?</h2>
              <p>
                Regístrate, obtén tu Shipping Mark y toma el control de tu
                envío desde el primer día. Con Confianza, de China a tu
                puerta.
              </p>
            </div>
            <div className="pa-final-ctas">
              <Link href="/portal/login" className="btn btn-onwine btn-lg">
                Iniciar pre-alerta
              </Link>
              <Link href="/registro" className="btn btn-ghost btn-lg">
                Regístrate gratis
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFAB />
    </>
  );
}

/* ── Iconos (inline SVG, mismo patrón que /shipping-mark: sin abstraer a
   components/Icon.tsx porque son ilustrativos de esta página, no de uso
   general en el sitio) ── */

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
      <path d="M3.5 8l8.5 4.5L20.5 8" />
      <path d="M12 12.5V20.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 6.5h10.5v9H2.5z" />
      <path d="M13 9.5h4l3.5 3.2v2.8H13z" />
      <circle cx="7" cy="17.5" r="1.9" />
      <circle cx="17" cy="17.5" r="1.9" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6.5 9.6V20h11V9.6" />
      <rect x="10" y="14" width="4" height="6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="13" y2="15" />
    </svg>
  );
}

function WarehouseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h11v8H4z" />
      <path d="M8 15v2M11 15v2" />
      <path d="M15 9h3l2.5 2.5V15H15z" />
    </svg>
  );
}

function ShipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 15.5c1.2 1 2.2 1 3.4 0 1.2-1 2.2-1 3.4 0 1.2 1 2.2 1 3.4 0 1.2-1 2.2-1 3.4 0 1.2 1 2.2 1 3.4 0" />
      <path d="M4 13.5l1.5-4.5h9l2.5 4.5" />
      <path d="M9 9V5h3l2 4" />
      <line x1="9" y1="6.5" x2="12" y2="6.5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 3.5h9l5 5V20.5H5z" />
      <path d="M14 3.5V9h5" />
      <line x1="8.5" y1="12.5" x2="15.5" y2="12.5" />
      <line x1="8.5" y1="16" x2="13.5" y2="16" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
      <path d="M3.5 8l8.5 4.5L20.5 8" />
      <path d="M12 12.5V20.5" />
      <path d="M7.7 6.2l8.6 4.6" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="10" width="7" height="7" rx="1" />
      <rect x="11" y="10" width="7" height="7" rx="1" />
      <rect x="7" y="3.5" width="7" height="6" rx="1" />
    </svg>
  );
}
