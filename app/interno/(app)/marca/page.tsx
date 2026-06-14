import type { Metadata } from "next";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon, DownloadIcon, CloseIcon } from "@/components/Icon";
import { ColorSwatch } from "../../_components/ColorSwatch";
import { ToolCard, ToolCardPlaceholder } from "../../_components/ToolCard";
import { InternoBreadcrumb } from "../../_components/InternoBreadcrumb";
import { QuickDownloads } from "../../_components/QuickDownloads";
import { SectionNav, type NavItem } from "../../_components/SectionNav";
import { DTD, BRAND_ASSETS, CONTACT, SHADOWS } from "@/lib/design-tokens";

/**
 * Hub de marca — zona interna del equipo (`/interno/marca`).
 *
 * Relocaliza el antiguo kit público `/brand` (logos, paleta, tipografía, voz,
 * descargas) DENTRO del área gateada, y suma: el Brand Book embebido + las
 * herramientas de WhatsApp Business. El acceso queda restringido a usuarios del
 * ERP (guard en `(app)/layout.tsx`) + noindex (layout raíz).
 *
 * Brand Book: el vigente es UNO solo (gobernanza v4.2). El standalone vive en
 * `private/marca/brand-book-vX.Y.html` (fuera de `public/`) y se sirve por la ruta
 * autenticada `/marca/asset/brand-book` (SOLO con login). Cuando llegue un book
 * nuevo desde el Norte → reemplazarlo ahí, borrar el anterior y actualizar el mapa
 * `ASSETS` de `app/marca/asset/[name]/route.ts`. El iframe hereda la CSP relajada
 * de `/marca/*` (next.config) y pasa la cookie de sesión.
 */

export const metadata: Metadata = {
  title: "Marca",
  robots: { index: false, follow: false },
};

const BRAND_BOOK = "/marca/asset/brand-book";
const BRAND_BOOK_VERSION = "v4.2";

const NAV: NavItem[] = [
  { id: "descargas-rapidas", label: "Descargas" },
  { id: "brandbook", label: "Brand Book" },
  { id: "herramientas", label: "Herramientas" },
  { id: "logos", label: "Logo" },
  { id: "uso", label: "Uso correcto" },
  { id: "color", label: "Color" },
  { id: "tipografia", label: "Tipografía" },
  { id: "descargas", label: "Assets" },
];

const LOGOS = [
  { variant: "primary" as const, bg: DTD.paper, label: "Primary", on: "Fondos claros · paper, blanco", ratio: "14.8 : 1", file: BRAND_ASSETS.isologoPrimary },
  { variant: "reverse" as const, bg: DTD.ink, label: "Reverse", on: "Fondos oscuros · navy, sidebar", ratio: "12.4 : 1", file: BRAND_ASSETS.isologoReverse },
  { variant: "mono-light" as const, bg: DTD.wine, label: "Mono light", on: "Sobre wine · CTAs, alertas", ratio: "7.2 : 1", file: BRAND_ASSETS.isologoMonoLight },
  { variant: "mono-dark" as const, bg: DTD.white, label: "Mono dark", on: "B&W · sello, imprenta", ratio: "15.3 : 1", file: BRAND_ASSETS.isologoMonoDark },
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
  { name: "Archivo Black", role: "Display · títulos, H1/H2, KPI", sample: "DTD Cargo", fontVar: "var(--font-archivo-black)", note: "Solo para títulos y números destacados." },
  { name: "Archivo", role: "Texto · cuerpo, labels, botones", sample: "Con Confianza.", fontVar: "var(--font-archivo)", note: "Pesos 300–900. Todo el cuerpo del sitio." },
  { name: "JetBrains Mono", role: "Códigos · Shipping Mark, contenedores, facturas", sample: "DTDU-000123", fontVar: "var(--font-jetbrains-mono)", note: "Para todo dato técnico o código de tracking." },
  { name: "Noto Sans SC", role: "Chino mandarín · direcciones CN", sample: "义乌 · 门到门", fontVar: "var(--font-noto-sc)", note: "Solo para texto en chino." },
];

const DONTS = [
  '"DTDCARGO" en una palabra o todo mayúsculas — es "DTD Cargo".',
  "El isólogo Primary sobre fondo navy o wine (queda invisible).",
  "Recolorear el logo con filtros CSS (brightness/invert).",
  'Usar wine-soft en el texto "DTD" del wordmark.',
  "Inventar variantes nuevas — son exactamente 4.",
  "Inter, Roboto, Helvetica o system-ui en el wordmark.",
  "Deformar, rotar o agregarle sombras al logo.",
];

const DOS = [
  "Elige la variante según el fondo (ver la tabla de arriba).",
  "Deja un clearspace de 2× la altura del trazo alrededor.",
  "Tamaño mínimo 24px de alto en digital.",
  'El wordmark "DTD Cargo" siempre en Archivo Black.',
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

const ASSETS_EMAIL = CONTACT.ve.email;

export default function MarcaHubPage() {
  return (
    <main className={jetbrainsMonoUi.variable}>
      <div className="wrap pt-6 pb-4">
        <InternoBreadcrumb
          items={[{ href: "/interno", label: "Recursos internos" }, { label: "Marca" }]}
        />
      </div>

      {/* Menú de secciones sticky — siempre visible, resalta dónde estás */}
      <SectionNav items={NAV} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-paper pt-8 pb-14 lg:pt-10 lg:pb-24">
        <div className="wrap">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <span className="eyebrow">Centro de marca · interno</span>
              <h1 className="h-display mt-5" style={{ fontSize: "clamp(38px, 5vw, 68px)" }}>
                La marca,
                <br />
                <span style={{ color: "var(--color-wine)" }}>en un solo lugar.</span>
              </h1>
              <p className="lead mt-6 max-w-[52ch]">
                El Brand Book, los logos, los colores, la tipografía y las
                herramientas de WhatsApp Business — todo descargable y siempre con
                la última versión. Para uso del equipo de DTD Cargo.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#brandbook" className="btn btn-primary">
                  Ver Brand Book <ArrowIcon />
                </a>
                <a href="#descargas" className="btn btn-ghost">
                  Descargar logos <DownloadIcon size={16} />
                </a>
              </div>

            </div>

            <div
              className="bg-white border border-grey-200 rounded-[18px] p-10 lg:p-12 flex flex-col items-center justify-center text-center"
              style={{ boxShadow: SHADOWS.card }}
            >
              <BrandMark variant="primary" size={72} />
              <div
                className="mt-8 text-[22px] lg:text-[26px] leading-[1.15]"
                style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
              >
                <span style={{ color: "var(--color-wine)" }}>Con Confianza,</span>
                <br />
                <span style={{ color: "var(--color-ink)" }}>de China a tu puerta.</span>
              </div>
              <p className="mt-4 text-[12.5px] text-grey-500">
                Brand Book {BRAND_BOOK_VERSION}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Descargas rápidas ────────────────────────────────── */}
      <QuickDownloads brandBook={BRAND_BOOK} brandBookVersion={BRAND_BOOK_VERSION} />

      {/* ── Brand Book embebido ──────────────────────────────── */}
      <section id="brandbook" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Brand Book {BRAND_BOOK_VERSION}</span>
              <h2 className="h-section mt-4">El documento maestro.</h2>
              <p className="lead mt-4 max-w-[58ch]">
                La fuente de verdad de la identidad. Se actualiza desde Norte; cada
                bloque se puede descargar dentro del documento.
              </p>
            </div>
            <a href={BRAND_BOOK} download={`Brand Book DTD ${BRAND_BOOK_VERSION}.html`} className="btn btn-primary flex-shrink-0">
              Descargar Brand Book <DownloadIcon size={16} />
            </a>
          </div>

          <a
            href="#herramientas"
            className="sr-only focus:not-sr-only focus:inline-block focus:mt-4 text-[13px] font-semibold text-wine underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded"
          >
            Saltar el Brand Book embebido →
          </a>

          <div
            className="mt-8 rounded-[16px] border border-grey-200 overflow-hidden bg-white"
            style={{ boxShadow: SHADOWS.card }}
          >
            <iframe
              src={BRAND_BOOK}
              title={`Brand Book DTD ${BRAND_BOOK_VERSION}`}
              loading="lazy"
              style={{ width: "100%", height: "min(78vh, 900px)", border: 0, display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* ── Herramientas ─────────────────────────────────────── */}
      <section id="herramientas" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">Herramientas de marca</span>
          <h2 className="h-section mt-4">Listas para usar.</h2>
          <p className="lead mt-4 max-w-[58ch]">
            Aplicaciones internas para producir material de marca sin diseñador.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ToolCard
              href="/interno/marca/whatsapp"
              meta="Generador + guía"
              title="WhatsApp Business Services"
              desc="Genera las imágenes 1080×1080 del catálogo y configura el perfil de cada número con la guía paso a paso (copiar y pegar)."
            />
            <ToolCardPlaceholder>
              Más plantillas y templates de marca van a aparecer acá.
            </ToolCardPlaceholder>
          </div>
        </div>
      </section>

      {/* ── Logo · 4 variantes ───────────────────────────────── */}
      <section id="logos" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">El isólogo</span>
          <h2 className="h-section mt-4">4 variantes oficiales.</h2>
          <p className="lead mt-4">
            Una por tipo de fondo. Elige la que corresponde según el contraste —
            nunca recolorees el logo con filtros: ya existe la variante nativa.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {LOGOS.map((l) => (
              <div key={l.variant} className="rounded-[16px] border border-grey-200 bg-white overflow-hidden">
                <div className="h-[150px] grid place-items-center" style={{ background: l.bg }}>
                  <BrandMark variant={l.variant} size={48} />
                </div>
                <div className="flex items-center justify-between gap-4 p-4 border-t border-grey-200">
                  <div>
                    <div className="text-[15px] font-bold text-ink">{l.label}</div>
                    <div className="text-[12.5px] text-grey-500 mt-0.5">{l.on}</div>
                    <div className="text-[11.5px] text-grey-700 mt-1" style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
                      WCAG {l.ratio}
                    </div>
                  </div>
                  <a href={l.file} download className="btn btn-ghost flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2" style={{ height: 40, padding: "0 14px", fontSize: 13 }}>
                    PNG <DownloadIcon size={15} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[16px] border border-grey-200 bg-paper p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-center">
              <div className="text-[40px] lg:text-[52px] leading-none" style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}>
                <span style={{ color: "var(--color-wine)" }}>DTD</span>
                <span style={{ display: "inline-block", width: "0.15em" }} />
                <span style={{ color: "var(--color-ink)" }}>Cargo</span>
              </div>
              <div className="text-[14px] text-grey-700 leading-[1.6]">
                Wordmark en <b className="text-ink">Archivo Black</b>. Dos palabras:{" "}
                <b className="text-ink">DTD</b> en wine, <b className="text-ink">Cargo</b> en
                navy. Letter-spacing −0.02em, gap de 0.15em entre palabras. Nunca
                “DTDCARGO” en una sola palabra ni todo en mayúsculas.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Uso correcto ─────────────────────────────────────── */}
      <section id="uso" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">Uso correcto</span>
          <h2 className="h-section mt-4">Lo que sí y lo que no.</h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="grid place-items-center w-7 h-7 rounded-full" style={{ background: "var(--color-status-success)", color: "#fff" }}>
                  <CheckIcon size={16} />
                </span>
                <h3 className="text-[16px] font-bold text-ink">Haz</h3>
              </div>
              <ul className="flex flex-col gap-3 list-none p-0">
                {DOS.map((d) => (
                  <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
                    <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-status-success)" }} />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="grid place-items-center w-7 h-7 rounded-full" style={{ background: "var(--color-status-danger)", color: "#fff" }}>
                  <CloseIcon size={15} />
                </span>
                <h3 className="text-[16px] font-bold text-ink">Evita</h3>
              </div>
              <ul className="flex flex-col gap-3 list-none p-0">
                {DONTS.map((d) => (
                  <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
                    <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-status-danger)" }} />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Color ────────────────────────────────────────────── */}
      <section id="color" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">Paleta de color</span>
          <h2 className="h-section mt-4">Vino, navy y papel.</h2>
          <p className="lead mt-4">
            Toca cualquier color para copiar el hex. Estos son los tokens reales
            del sitio — nada de hex inventados fuera de la paleta.
          </p>

          <div className="mt-10 flex flex-col gap-9">
            {PALETTE.map((grp) => (
              <div key={grp.group}>
                <h3 className="text-[12px] font-bold tracking-[0.12em] uppercase text-wine mb-4">{grp.group}</h3>
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
      <section id="tipografia" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">Tipografía</span>
          <h2 className="h-section mt-4">Cuatro familias, ninguna más.</h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {TYPE.map((t) => (
              <div key={t.name} className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-8">
                <div className="text-ink leading-[1.05] overflow-hidden" style={{ fontFamily: t.fontVar, fontSize: "clamp(30px, 4.6vw, 44px)" }}>
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

      {/* ── Descargas ────────────────────────────────────────── */}
      <section id="descargas" className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200">
        <div className="wrap">
          <span className="eyebrow">Descargas</span>
          <h2 className="h-section mt-4">Baja los assets.</h2>
          <p className="lead mt-4">
            PNG con transparencia, listos para usar. ¿Necesitas vectores (SVG) o
            versiones de impresión? Escríbenos.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOWNLOADS.map((d) => (
              <a key={d.label} href={d.href} download className="group flex items-center justify-between gap-4 rounded-[14px] border border-grey-200 bg-white p-4 hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-colors">
                <div>
                  <div className="text-[14.5px] font-bold text-ink">{d.label}</div>
                  <div className="text-[12px] text-grey-700 mt-0.5" style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
                    {d.sub}
                  </div>
                </div>
                <span className="grid place-items-center w-9 h-9 rounded-full border border-grey-200 text-grey-500 group-hover:text-wine group-hover:border-wine transition-colors flex-shrink-0">
                  <DownloadIcon size={16} />
                </span>
              </a>
            ))}
          </div>

          <div className="mt-8 bg-ink rounded-[18px] p-8 lg:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6" style={{ boxShadow: SHADOWS.card }}>
            <div>
              <h3 className="text-white text-[22px] lg:text-[26px] leading-[1.15]" style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}>
                ¿Falta un archivo fuente?
              </h3>
              <p className="mt-2 text-[14.5px] text-white/70 leading-[1.55] max-w-[52ch]">
                Pide los vectores (SVG) o versiones de impresión y te los pasamos.
              </p>
            </div>
            <a
              href={`mailto:${ASSETS_EMAIL}?subject=${encodeURIComponent("DTD Cargo — archivos fuente de marca")}`}
              className="btn btn-primary flex-shrink-0"
              aria-label={`Escribir al equipo de marca (${ASSETS_EMAIL})`}
            >
              Escribir al equipo de marca <ArrowIcon />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
