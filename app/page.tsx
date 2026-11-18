import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { RespuestaRapida } from "@/components/RespuestaRapida";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/public/site-meta";
import { OperationGallery } from "@/components/OperationGallery";
import { CicloDTD } from "@/components/CicloDTD";
import { ShippingMarkCta } from "@/components/ShippingMarkCta";
import { aniosComercioChina } from "@/lib/design-tokens";
import { svcHref } from "@/components/servicios/svcHref";

/**
 * Home — rebuild fiel al mockup Cloud Design (Home Web · DTD-Cargo.html).
 * Chrome (Nav/Footer/WhatsAppFAB) = componentes del repo. SEO/GEO preservado:
 * WebPageJsonLd + RespuestaRapida (speakable) + metadata/canonical. El @graph
 * de layout.tsx no se toca. Estilos scopeados en `.home-surface` (globals.css).
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// ISR mensual: la home es estática, pero el KPI "X Años" (desde 2008) sube solo
// en enero sin redeploy (recomputa aniosComercioChina en el server).
export const revalidate = 2592000;

const HERO_STATS = [
  { num: String(aniosComercioChina()), small: "Años", lbl: "En el comercio con China desde 2008" },
  // "61K+" viene del mockup aprobado de Cloud Design; CONFIRMADO por el founder
  // (2026-07-19) como cifra real y publicable. No está en la constante STATS
  // (que trae 4 KPI); vive acá como dato de marca del Home.
  { num: "61K", small: "+", lbl: "Entregas exitosas · clientes satisfechos" },
  { num: "2015", small: "", lbl: "Presencia física en Venezuela" },
  { num: "24", small: "H", lbl: "Cotización inicial estimada" },
  { num: "2", small: "Bases", lbl: "Equipo propio en Yiwu & Valencia" },
];

// Cronología grounded (components/Stats.tsx · founder 2026-06-13). Se usan estos
// rótulos, no los del mockup ("2010 Operaciones hacia Venezuela / 2015 Primera
// sede"), por consistencia con el dato canónico del repo.
const TIMELINE = [
  { year: "2008", label: "Comercio con China" },
  { year: "2010", label: "Empresa de carga" },
  { year: "2015", label: "Operación en Venezuela" },
];

export default function HomePage() {
  return (
    <>
      <Nav />
      <WebPageJsonLd path="/" name={SITE_TITLE} description={SITE_DESCRIPTION} speakableSelectors={["#respuesta-rapida"]} />
      <main className="home-surface">
        {/* ── Hero ── */}
        <section className="hero" aria-label="Presentación">
          <div className="hero-grid">
            <div className="htext">
              <div className="eyebrow-h">
                <span className="rule" />
                Importación puerta a puerta · China → Venezuela
              </div>
              <h1 className="h1">
                <span className="l1">
                  Con <span className="hl">Confianza,</span>
                </span>
                <span className="l2">desde China hasta tu puerta.</span>
              </h1>
              <p className="hero-sub">
                Servicio puerta a puerta hacia Venezuela con recepción, inspección,
                consolidación, aduana, impuestos y entrega final coordinados por un
                solo equipo, de principio a fin.
              </p>
              <div className="hero-ctas">
                <Link className="btn btn-primary btn-lg" href="/tarifas">
                  Cotizar mi envío
                </Link>
                <ShippingMarkCta className="btn btn-ghost btn-lg" />
              </div>
              <ul className="hero-feats">
                <li>Puerta a puerta, todo incluido</li>
                <li>Aduana e impuestos incluidos</li>
                <li>Carga con Shipping Mark</li>
                <li>Pagas al llegar</li>
              </ul>
            </div>

            <CicloDTD />

            <a className="scroll-cue" href="#beneficios" aria-label="Desliza para ver más">
              Desliza
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </a>
          </div>

          {/* Franja de stats + cronología */}
          <div className="hero-stats">
            <div className="hero-stats-in">
              {HERO_STATS.map((s) => (
                <div className="hstat" key={s.lbl}>
                  <div className="hstat-num">
                    {s.num}
                    {s.small && <small>{s.small}</small>}
                  </div>
                  <div className="hstat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
            <div className="hero-timeline">
              <div className="hero-timeline-in">
                {TIMELINE.map((t, i) => (
                  <span key={t.year} style={{ display: "contents" }}>
                    <span className="tl">
                      <b>{t.year}</b> {t.label}
                    </span>
                    {i < TIMELINE.length - 1 && <span className="tl-dot" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Respuesta rápida (GEO · speakable) */}
        <RespuestaRapida
          id="respuesta-rapida"
          pregunta="¿Qué es DTD Cargo y qué hace?"
          respuesta="DTD Cargo trae tu mercancía de China a Venezuela puerta a puerta: se encarga del flete, la aduana y la entrega en tu dirección, con equipo y bodega propios en Yiwu (China) y Valencia. Opera desde 2015, con experiencia en el comercio con China desde 2008, y pagas cuando tu carga llega a Venezuela (pueden aplicar restricciones)."
        />

        {/* ── Beneficios ── */}
        <section className="sec" id="beneficios">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow-s">
                <span className="rule" />
                Lo que ganas tú
              </div>
              <h2 className="h2">
                Comprar en China <span className="accent">nunca fue tan fácil.</span>
              </h2>
              <p className="sec-sub">
                Tú compras; nosotros resolvemos el resto. Un solo equipo, de
                principio a fin, de la fábrica en China hasta tu puerta en Venezuela.
              </p>
            </div>
            <div className="bene-grid">
              <div className="bene">
                <div className="bene-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2.5 6.5h10.5v9H2.5z" />
                    <path d="M13 9.5h4l3.5 3.2v2.8H13z" />
                    <circle cx="7" cy="17.5" r="1.9" />
                    <circle cx="17" cy="17.5" r="1.9" />
                  </svg>
                </div>
                <h3>Envíos puerta a puerta</h3>
                <p>
                  Flete, aduana, impuestos y entrega en una sola tarifa. Pagas al
                  llegar, sin trámites ni sorpresas de tu lado.
                </p>
              </div>
              <div className="bene">
                <div className="bene-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 8h12l-1 12.5H7L6 8z" />
                    <path d="M9 8a3 3 0 0 1 6 0" />
                    <path d="M9.5 13l1.8 1.8 3.2-3.2" />
                  </svg>
                </div>
                <h3>Compra desde Venezuela</h3>
                <p>
                  Nuestro equipo en Yiwu compra por ti: verifica al proveedor, paga a
                  fábrica e inspecciona tu mercancía antes de embarcar.
                </p>
              </div>
              <div className="bene">
                <div className="bene-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" />
                    <line x1="8.5" y1="10.5" x2="15.5" y2="10.5" />
                    <line x1="8.5" y1="14" x2="13" y2="14" />
                  </svg>
                </div>
                <h3>Atención al instante</h3>
                <p>
                  Personas reales en Valencia y Yiwu te responden por WhatsApp. Tu
                  cotización inicial estimada, en 24 horas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Servicios · momentos del viaje ── */}
        <section className="journey sec" id="servicios">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow-s">
                <span className="rule" />
                Servicios
              </div>
              <h2 className="h2">
                Un servicio para cada <span className="accent">momento del viaje.</span>
              </h2>
              <p className="sec-sub">
                De la fábrica a tu puerta, tu carga pasa por cuatro momentos. En
                todos está el mismo equipo.
              </p>
              <Link className="btn btn-soft" href="/servicios" style={{ marginTop: "var(--s-5)" }}>
                Ver todos los servicios
              </Link>
            </div>

            <div className="jy-grid">
              <div className="jy-card">
                <div className="jy-step">
                  <span className="jy-num">01</span>
                  <span className="jy-arrow"><ArrowSm /></span>
                </div>
                <h3>
                  Origen <small>China</small>
                </h3>
                <ul>
                  <li>
                    <Link href={svcHref("inspeccion-en-fabrica")}>Inspección de calidad en fábrica</Link>
                  </li>
                  <li>
                    <Link href={svcHref("verificacion-de-proveedores")}>Verificación de proveedores</Link>
                  </li>
                  <li>
                    <Link href={svcHref("compra-asistida")}>Compra y pago asistido</Link>
                  </li>
                </ul>
              </div>
              <div className="jy-card">
                <div className="jy-step">
                  <span className="jy-num">02</span>
                  <span className="jy-arrow"><ArrowSm /></span>
                </div>
                <h3>
                  Bodega <small>Yiwu</small>
                </h3>
                <ul>
                  <li>
                    <Link href={svcHref("pre-alerta")}>Pre-alerta de compra</Link>
                  </li>
                  <li>
                    <Link href={svcHref("validacion")}>Validación con fotos al recibir</Link>
                  </li>
                  <li>
                    <Link href={svcHref("hold")}>HOLD · Re-Empaque · Etiquetado</Link>
                  </li>
                </ul>
              </div>
              <div className="jy-card">
                <div className="jy-step">
                  <span className="jy-num">03</span>
                  <span className="jy-arrow"><ArrowSm /></span>
                </div>
                <h3>
                  Transporte + Aduana <small>CN → VE</small>
                </h3>
                <ul>
                  <li>
                    <Link href={svcHref("puerta-a-puerta")}>Puerta a Puerta (todo pagado)</Link>
                  </li>
                  <li>
                    <Link href={svcHref("consolidado-lcl")}>Consolidado LCL</Link>
                  </li>
                  <li>
                    <Link href={svcHref("fcl")}>FCL — Contenedor completo</Link>
                  </li>
                </ul>
              </div>
              <div className="jy-card">
                <div className="jy-step">
                  <span className="jy-num">04</span>
                </div>
                <h3>
                  Tu puerta <small>Venezuela</small>
                </h3>
                <ul>
                  <li>Entrega final coordinada</li>
                  <li>Cobertura nacional</li>
                  <li>Pagas al llegar</li>
                </ul>
              </div>

              <div className="jy-star">
                <div className="jy-star-txt">
                  <div className="jy-star-eyebrow">El servicio estrella</div>
                  <h3>
                    Puerta a Puerta{" "}
                    <small style={{ font: "700 15px/1 var(--f-brand)", opacity: 0.85 }}>
                      (todo pagado)
                    </small>
                  </h3>
                  <p>
                    Todo incluido en un solo precio: flete, aduana, impuestos y
                    entrega final. Un solo canal de comunicación, de punta a punta.
                  </p>
                  <Link className="jy-star-link" href="/servicios/puerta-a-puerta">
                    Ver el servicio completo →
                  </Link>
                </div>
                <div className="jy-star-stat">
                  <div className="big">8/10</div>
                  <div className="cap">el servicio más solicitado</div>
                </div>
                <Link className="btn btn-onwine btn-lg" href="/tarifas">
                  Cotizar mi envío
                </Link>
              </div>
            </div>

            <div className="jy-foto">
              <figure className="jy-foto-fig">
                <Image
                  src="/videos/equipo-cargando-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela-poster.jpg"
                  alt="Equipo de DTD consolidando y cargando el contenedor en la bodega de Yiwu, China"
                  width={1000}
                  height={700}
                  loading="lazy"
                />
                <figcaption className="foto-caption">
                  <span>Origen · China</span>
                  <span>Yiwu · 义乌</span>
                </figcaption>
              </figure>
              <div className="jy-foto-txt">
                <h3>Bodegas y equipo propios en los dos extremos de la ruta.</h3>
                <p>
                  Nada tercerizado: tu mercancía la recibe, inspecciona y despacha
                  gente de DTD en Yiwu, y la entrega gente de DTD desde Valencia. Por
                  eso podemos responder por ella en cada momento.
                </p>
                <div className="jy-tags">
                  <span className="jy-tag">Bodega Yiwu · China</span>
                  <span className="jy-tag">Bodega Valencia · Venezuela</span>
                  <span className="jy-tag">Equipo propio</span>
                </div>
              </div>
            </div>

            <div className="jy-extra">
              <span className="jy-extra-eyebrow">Servicios complementarios</span>
              <div className="jy-extra-grid">
                <div className="jy-extra-card">
                  <div className="jy-extra-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="5" y="3" width="14" height="18" rx="2" />
                      <circle cx="12" cy="9.5" r="2.3" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                      <line x1="9.5" y1="18" x2="14.5" y2="18" />
                    </svg>
                  </div>
                  <h3>Visado de negocios chino</h3>
                  <p>
                    Gestionamos tu visado para viajar a China: ferias, visita a
                    fábrica y negociación en sitio.
                  </p>
                  <Link className="jy-extra-link" href={svcHref("visado-de-negocios")}>
                    Ver servicio →
                  </Link>
                </div>
                <div className="jy-extra-card">
                  <div className="jy-extra-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="9" r="5.2" />
                      <path d="M9.3 13.2L7.5 21l4.5-2.6 4.5 2.6-1.8-7.8" />
                    </svg>
                  </div>
                  <h3>Registro de marca en China</h3>
                  <p>
                    Registramos tu marca ante las autoridades chinas para proteger tu
                    producto y tu proveedor.
                  </p>
                  <Link className="jy-extra-link" href={svcHref("registro-de-marca")}>
                    Ver servicio →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Galería · operación real (componente del repo) ── */}
        <OperationGallery />

        {/* ── CTA final ── */}
        <section className="final" aria-label="Empieza hoy">
          <div className="final-in">
            <div className="final-copy">
              <div className="eyebrow-f">Empieza hoy</div>
              <h2>
                Tu <span className="accent">Shipping Mark</span> te espera.
              </h2>
              <p className="lead">
                Regístrate gratis y obtén el código que identifica tu carga durante
                todo el ciclo. Tú compras en China; nosotros la llevamos hasta tu
                puerta.
              </p>
              <div className="final-ctas">
                {/* Mismo componente que el hero: "Casillero" viaja pegado. */}
                <ShippingMarkCta className="btn btn-primary btn-lg" />
              </div>
              {/* Anti-fricción (anotación Agentation #5): el CTA de cierre resuelve
                  la última objeción. Claims ya publicados en la página (gratis, 24h). */}
              <p className="final-reassure">
                Gratis · Sin compromiso · Cotización inicial estimada en 24 h
              </p>
              <div className="final-mark">
                Tu código: <b>DTD-XXXX</b> · Shipping Mark{" "}
                <span style={{ fontFamily: "var(--f-cn)" }}>(唛头)</span> — identifica
                tu carga de punta a punta.
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function ArrowSm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
