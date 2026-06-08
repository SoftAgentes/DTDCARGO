import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import { JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon, DownloadIcon, CloseIcon } from "@/components/Icon";
import { ColorSwatch } from "./_components/ColorSwatch";
import { DTD, BRAND_ASSETS, CONTACT, SHADOWS } from "@/lib/design-tokens";

/**
 * JetBrains Mono — NO se carga en el layout público (solo Archivo / Archivo
 * Black / Noto Sans SC). Acá lo cargamos *scoped* a la ruta /brand para que
 * el specimen de tipografía de código se vea en la fuente real y no en un
 * monospace de fallback. La variable se aplica al <main> de esta página.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kit de marca",
  description:
    "Logos, colores y tipografía oficiales de DTD Cargo, con sus reglas de uso. Descarga el isólogo en sus 4 variantes, la paleta de color y la tipografía de la marca.",
  keywords: [
    "kit de marca DTD Cargo",
    "logo DTD Cargo",
    "isólogo DTD",
    "paleta de color DTD Cargo",
    "press kit DTD Cargo",
  ],
  alternates: { canonical: "/brand" },
  ...socialMeta({
    title: "Kit de marca · DTD Cargo",
    description:
      "Logos, colores y tipografía oficiales de DTD Cargo, con sus reglas de uso.",
    path: "/brand",
  }),
};

// ── Datos del kit (fuente: lib/design-tokens.ts + BRAND.md v3.0) ──────────

const ANCHORS = [
  { href: "#logos", label: "Logo" },
  { href: "#uso", label: "Uso correcto" },
  { href: "#color", label: "Color" },
  { href: "#tipografia", label: "Tipografía" },
  { href: "#voz", label: "Tagline y voz" },
  { href: "#descargas", label: "Descargas" },
];

const LOGOS = [
  {
    variant: "primary" as const,
    bg: DTD.paper,
    label: "Primary",
    on: "Fondos claros · paper, blanco",
    ratio: "14.8 : 1",
    file: BRAND_ASSETS.isologoPrimary,
  },
  {
    variant: "reverse" as const,
    bg: DTD.ink,
    label: "Reverse",
    on: "Fondos oscuros · navy, sidebar",
    ratio: "12.4 : 1",
    file: BRAND_ASSETS.isologoReverse,
  },
  {
    variant: "mono-light" as const,
    bg: DTD.wine,
    label: "Mono light",
    on: "Sobre wine · CTAs, alertas",
    ratio: "7.2 : 1",
    file: BRAND_ASSETS.isologoMonoLight,
  },
  {
    variant: "mono-dark" as const,
    bg: DTD.white,
    label: "Mono dark",
    on: "B&W · sello, imprenta",
    ratio: "15.3 : 1",
    file: BRAND_ASSETS.isologoMonoDark,
  },
];

const PALETTE: { group: string; swatches: { token: string; hex: string; role: string }[] }[] = [
  {
    group: "Marca",
    swatches: [
      { token: "wine", hex: DTD.wine, role: "Acento primario · CTAs" },
      { token: "wine-deep", hex: DTD.wineDeep, role: "Hover de wine" },
      { token: "wine-soft", hex: DTD.wineSoft, role: "Acento 2 · sobre oscuro" },
      { token: "ink", hex: DTD.ink, role: "Navy · texto y fondos" },
    ],
  },
  {
    group: "Superficies",
    swatches: [
      { token: "paper", hex: DTD.paper, role: "Fondo base" },
      { token: "white", hex: DTD.white, role: "Cards" },
      { token: "grey-100", hex: DTD.grey100, role: "Elevado · hover" },
      { token: "grey-200", hex: DTD.grey200, role: "Bordes" },
    ],
  },
  {
    group: "Texto y neutros",
    swatches: [
      { token: "grey-300", hex: DTD.grey300, role: "Bordes suaves" },
      { token: "grey-500", hex: DTD.grey500, role: "Texto secundario" },
      { token: "grey-700", hex: DTD.grey700, role: "Texto fuerte" },
      { token: "grey-900", hex: DTD.grey900, role: "Casi negro" },
    ],
  },
  {
    group: "Estados (uso funcional, no decorativo)",
    swatches: [
      { token: "success", hex: DTD.statusSuccess, role: "Confirmaciones" },
      { token: "warning", hex: DTD.statusWarning, role: "Riesgo real" },
      { token: "danger", hex: DTD.statusDanger, role: "Errores · vencidos" },
      { token: "whatsapp", hex: DTD.whatsapp, role: "Canal WhatsApp" },
    ],
  },
];

const TYPE = [
  {
    name: "Archivo Black",
    role: "Display · títulos, H1/H2, KPI",
    sample: "DTD Cargo",
    fontVar: "var(--font-archivo-black)",
    note: "Solo para títulos y números destacados.",
  },
  {
    name: "Archivo",
    role: "Texto · cuerpo, labels, botones",
    sample: "Con confianza.",
    fontVar: "var(--font-archivo)",
    note: "Pesos 300–900. Todo el cuerpo del sitio.",
  },
  {
    name: "JetBrains Mono",
    role: "Códigos · MARKBOX, contenedores, facturas",
    sample: "DTDU-000123",
    fontVar: "var(--font-jetbrains-mono)",
    note: "Para todo dato técnico o código de tracking.",
  },
  {
    name: "Noto Sans SC",
    role: "Chino mandarín · direcciones CN",
    sample: "义乌 · 门到门",
    fontVar: "var(--font-noto-sc)",
    note: "Solo para texto en chino.",
  },
];

const DONTS = [
  '“DTDCARGO” en una palabra o todo mayúsculas — es “DTD Cargo”.',
  "El isólogo Primary sobre fondo navy o wine (queda invisible).",
  "Recolorear el logo con filtros CSS (brightness/invert).",
  "Usar wine-soft en el texto “DTD” del wordmark.",
  "Inventar variantes nuevas — son exactamente 4.",
  "Inter, Roboto, Helvetica o system-ui en el wordmark.",
  "Deformar, rotar o agregarle sombras al logo.",
];

const DOS = [
  "Elige la variante según el fondo (ver la tabla de arriba).",
  "Deja un clearspace de 2× la altura del trazo alrededor.",
  "Tamaño mínimo 24px de alto en digital.",
  "El wordmark “DTD Cargo” siempre en Archivo Black.",
  "Sobre fondo oscuro, usa Reverse o Mono light.",
];

const DOWNLOADS = [
  { label: "Isólogo Primary", sub: "PNG · 741×764", href: BRAND_ASSETS.isologoPrimary },
  { label: "Isólogo Reverse", sub: "PNG · 741×764", href: BRAND_ASSETS.isologoReverse },
  { label: "Isólogo Mono light", sub: "PNG · 741×764", href: BRAND_ASSETS.isologoMonoLight },
  { label: "Isólogo Mono dark", sub: "PNG · 741×764", href: BRAND_ASSETS.isologoMonoDark },
  { label: "OG image", sub: "PNG · 1200×630", href: BRAND_ASSETS.ogImage },
  { label: "Favicon", sub: "PNG · 32×32", href: BRAND_ASSETS.favicon32 },
];

const ASSETS_EMAIL = CONTACT.ve.email; // Vzla@dtdcargo.com — pedidos de fuentes

export default function BrandPage() {
  return (
    <>
      <Nav />
      <main className={jetbrainsMono.variable}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="bg-paper py-16 lg:py-24">
          <div className="wrap">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
              <div>
                <span className="eyebrow">Kit de marca · DTD Cargo</span>
                <h1
                  className="h-display mt-5"
                  style={{ fontSize: "clamp(40px, 5.5vw, 72px)" }}
                >
                  La marca,
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>lista para usar.</span>
                </h1>
                <p className="lead mt-6">
                  Logos, colores y tipografía oficiales de DTD Cargo — con las
                  reglas para usarlos bien. Si eres socio, proveedor o prensa,
                  descarga lo que necesites desde acá.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a href="#descargas" className="btn btn-primary">
                    Descargar logos <DownloadIcon size={16} />
                  </a>
                  <a
                    href={`mailto:${ASSETS_EMAIL}?subject=${encodeURIComponent(
                      "DTD Cargo — pedido de archivos fuente de marca",
                    )}`}
                    className="btn btn-ghost"
                  >
                    Pedir archivos fuente
                  </a>
                </div>

                {/* Anchor chips */}
                <nav className="mt-8 flex flex-wrap gap-2" aria-label="Secciones del kit">
                  {ANCHORS.map((a) => (
                    <a
                      key={a.href}
                      href={a.href}
                      className="text-[12.5px] font-semibold text-grey-700 border border-grey-200 rounded-full px-3.5 py-1.5 hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-colors"
                    >
                      {a.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Showcase del lockup primary — sombra estática del sistema
                  (sin el lift hover de .card-shadow: el panel no es clickeable) */}
              <div
                className="bg-white border border-grey-200 rounded-[18px] p-10 lg:p-12 flex flex-col items-center justify-center text-center"
                style={{ boxShadow: SHADOWS.card }}
              >
                <BrandMark variant="primary" size={72} />
                <div
                  className="mt-8 text-[22px] lg:text-[26px] leading-[1.15]"
                  style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
                >
                  <span style={{ color: "var(--color-wine)" }}>Con confianza,</span>
                  <br />
                  <span style={{ color: "var(--color-ink)" }}>de China a tu puerta.</span>
                </div>
                <p className="mt-4 text-[12.5px] text-grey-500">
                  Brand Book v3.0 · mayo 2026
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Logo · 4 variantes ───────────────────────────────── */}
        <section id="logos" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <span className="eyebrow">El isólogo</span>
            <h2 className="h-section mt-4">4 variantes oficiales.</h2>
            <p className="lead mt-4">
              Una por tipo de fondo. Elige la que corresponde según el contraste
              — nunca recolorees el logo con filtros: ya existe la variante nativa.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {LOGOS.map((l) => (
                <div
                  key={l.variant}
                  className="rounded-[16px] border border-grey-200 bg-white overflow-hidden"
                >
                  <div
                    className="h-[150px] grid place-items-center"
                    style={{ background: l.bg }}
                  >
                    <BrandMark variant={l.variant} size={48} />
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 border-t border-grey-200">
                    <div>
                      <div className="text-[15px] font-bold text-ink">{l.label}</div>
                      <div className="text-[12.5px] text-grey-500 mt-0.5">{l.on}</div>
                      <div
                        className="text-[11.5px] text-grey-500 mt-1"
                        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                      >
                        WCAG {l.ratio}
                      </div>
                    </div>
                    <a
                      href={l.file}
                      download
                      className="btn btn-ghost flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                      style={{ height: 40, padding: "0 14px", fontSize: 13 }}
                    >
                      PNG <DownloadIcon size={15} />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Wordmark */}
            <div className="mt-6 rounded-[16px] border border-grey-200 bg-paper p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-center">
                <div
                  className="text-[40px] lg:text-[52px] leading-none"
                  style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
                >
                  <span style={{ color: "var(--color-wine)" }}>DTD</span>
                  <span style={{ display: "inline-block", width: "0.15em" }} />
                  <span style={{ color: "var(--color-ink)" }}>Cargo</span>
                </div>
                <div className="text-[14px] text-grey-700 leading-[1.6]">
                  Wordmark en <b className="text-ink">Archivo Black</b>. Dos
                  palabras: <b className="text-ink">DTD</b> en wine,{" "}
                  <b className="text-ink">Cargo</b> en navy. Letter-spacing
                  −0.02em, gap de 0.15em entre palabras. Nunca “DTDCARGO” en una
                  sola palabra ni todo en mayúsculas.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Uso correcto ─────────────────────────────────────── */}
        <section id="uso" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <span className="eyebrow">Uso correcto</span>
            <h2 className="h-section mt-4">Lo que sí y lo que no.</h2>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DO */}
              <div className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-7">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="grid place-items-center w-7 h-7 rounded-full"
                    style={{ background: "var(--color-status-success)", color: "#fff" }}
                  >
                    <CheckIcon size={16} />
                  </span>
                  <h3 className="text-[16px] font-bold text-ink">Haz</h3>
                </div>
                <ul className="flex flex-col gap-3 list-none p-0">
                  {DOS.map((d) => (
                    <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
                      <span
                        aria-hidden
                        className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--color-status-success)" }}
                      />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* DON'T */}
              <div className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-7">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="grid place-items-center w-7 h-7 rounded-full"
                    style={{ background: "var(--color-status-danger)", color: "#fff" }}
                  >
                    <CloseIcon size={15} />
                  </span>
                  <h3 className="text-[16px] font-bold text-ink">Evita</h3>
                </div>
                <ul className="flex flex-col gap-3 list-none p-0">
                  {DONTS.map((d) => (
                    <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
                      <span
                        aria-hidden
                        className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--color-status-danger)" }}
                      />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Color ────────────────────────────────────────────── */}
        <section id="color" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <span className="eyebrow">Paleta de color</span>
            <h2 className="h-section mt-4">Vino, navy y papel.</h2>
            <p className="lead mt-4">
              Toca cualquier color para copiar el hex. Estos son los tokens
              reales del sitio — nada de hex inventados fuera de la paleta.
            </p>

            <div className="mt-10 flex flex-col gap-9">
              {PALETTE.map((grp) => (
                <div key={grp.group}>
                  <h3 className="text-[12px] font-bold tracking-[0.12em] uppercase text-wine mb-4">
                    {grp.group}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {grp.swatches.map((s) => (
                      <ColorSwatch key={s.token} token={s.token} hex={s.hex} role={s.role} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tipografía ───────────────────────────────────────── */}
        <section id="tipografia" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <span className="eyebrow">Tipografía</span>
            <h2 className="h-section mt-4">Cuatro familias, ninguna más.</h2>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              {TYPE.map((t) => (
                <div key={t.name} className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-8">
                  <div
                    className="text-ink leading-[1.05] overflow-hidden"
                    style={{ fontFamily: t.fontVar, fontSize: "clamp(30px, 4.6vw, 44px)" }}
                  >
                    {t.sample}
                  </div>
                  <div className="mt-6 pt-5 border-t border-grey-200">
                    <div className="text-[15px] font-bold text-ink">{t.name}</div>
                    <div className="text-[12.5px] text-grey-500 mt-0.5">{t.role}</div>
                    <div className="text-[13px] text-grey-700 mt-2 leading-[1.5]">{t.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tagline y voz ────────────────────────────────────── */}
        <section id="voz" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16">
              <div>
                <span className="eyebrow">Tagline oficial</span>
                <div
                  className="mt-6 leading-[1.08]"
                  style={{ fontFamily: "var(--font-archivo-black)", fontSize: "clamp(32px,4.4vw,52px)", letterSpacing: "-0.02em" }}
                >
                  <span style={{ color: "var(--color-wine)" }}>Con confianza,</span>
                  <br />
                  <span style={{ color: "var(--color-ink)" }}>de China a tu puerta.</span>
                </div>
                <p className="mt-6 text-[15px] text-grey-700 leading-[1.6] max-w-[46ch]">
                  La línea 1 va en wine; la línea 2 en navy. Antepone el valor
                  (confianza) a la promesa funcional. Sub-claim:{" "}
                  <i className="text-ink not-italic font-semibold">
                    “Construyendo confianza cliente a cliente, contenedor a contenedor.”
                  </i>
                </p>
              </div>

              <div>
                <span className="eyebrow">Cómo hablamos</span>
                <ul className="mt-6 flex flex-col gap-4 list-none p-0">
                  {[
                    ["Castellano venezolano neutro", "Cercano y directo, sin jerga innecesaria."],
                    ["CTAs con verbos", "“Cotizar puerta a puerta”, “Rastrear envío” — nunca “Click acá”."],
                    ["Cero AI slop", "Sin gradientes coloridos, sin emojis decorativos, sin glassmorphism."],
                    ["Tagline vigente", "Usar la v3.0 — no la vieja “De China a tu puerta. Sin intermediarios.”."],
                  ].map(([t, d]) => (
                    <li key={t} className="border-l-[3px] pl-4" style={{ borderColor: "var(--color-wine)" }}>
                      <div className="text-[14.5px] font-bold text-ink">{t}</div>
                      <div className="text-[13.5px] text-grey-700 mt-0.5 leading-[1.5]">{d}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Descargas ────────────────────────────────────────── */}
        <section id="descargas" className="scroll-mt-24 py-16 lg:py-20 border-t border-grey-200">
          <div className="wrap">
            <span className="eyebrow">Descargas</span>
            <h2 className="h-section mt-4">Baja los assets.</h2>
            <p className="lead mt-4">
              PNG con transparencia, listos para usar. ¿Necesitas vectores (SVG),
              versiones de impresión o el Brand Book completo? Escríbenos.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DOWNLOADS.map((d) => (
                <a
                  key={d.label}
                  href={d.href}
                  download
                  className="group flex items-center justify-between gap-4 rounded-[14px] border border-grey-200 bg-white p-4 hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-colors"
                >
                  <div>
                    <div className="text-[14.5px] font-bold text-ink">{d.label}</div>
                    <div
                      className="text-[12px] text-grey-500 mt-0.5"
                      style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                    >
                      {d.sub}
                    </div>
                  </div>
                  <span className="grid place-items-center w-9 h-9 rounded-full border border-grey-200 text-grey-500 group-hover:text-wine group-hover:border-wine transition-colors flex-shrink-0">
                    <DownloadIcon size={16} />
                  </span>
                </a>
              ))}
            </div>

            {/* CTA fuentes */}
            <div
              className="mt-8 bg-ink rounded-[18px] p-8 lg:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
              style={{ boxShadow: SHADOWS.card }}
            >
              <div>
                <h3
                  className="text-white text-[22px] lg:text-[26px] leading-[1.15]"
                  style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}
                >
                  ¿Vas a usar nuestra marca?
                </h3>
                <p className="mt-2 text-[14.5px] text-white/70 leading-[1.55] max-w-[52ch]">
                  Pedinos los archivos fuente (SVG, versiones de impresión) o
                  contanos dónde la vas a usar. Te respondemos en el día.
                </p>
              </div>
              <a
                href={`mailto:${ASSETS_EMAIL}?subject=${encodeURIComponent(
                  "DTD Cargo — uso de marca / archivos fuente",
                )}`}
                className="btn btn-primary flex-shrink-0"
              >
                Escribir a {ASSETS_EMAIL} <ArrowIcon />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
