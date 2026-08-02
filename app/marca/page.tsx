import type { Metadata } from "next";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { BrandMark } from "@/components/BrandMark";
import { ArrowIcon, CheckIcon, CloseIcon, DownloadIcon } from "@/components/Icon";
import { ColorSwatch } from "@/components/marca/ColorSwatch";
import { SectionNav, type NavItem } from "@/components/marca/SectionNav";
import { hasBrandAccess, resolveBrandTenantId } from "@/lib/marca/access";
import { loadBrandCatalog } from "@/lib/marca/catalog-queries";
import {
  BRAND_BOOK_DOWNLOAD_NAME,
  BRAND_BOOK_URL,
  BRAND_BOOK_VERSION,
} from "@/lib/marca/brand-book";
import type { BrandSection } from "@/lib/marca/catalog-types";
import { DTD, CONTACT, SHADOWS } from "@/lib/design-tokens";
import { BrandGate } from "./_components/BrandGate";
import { AssetCard } from "./_components/AssetCard";
import { lockBrandAction } from "./actions";

/**
 * Centro de marca — `/marca` (SDD-0238).
 *
 * ESTE ES EL LINK QUE SE LE MANDA A DISEÑO. Una sola URL, protegida con un
 * código de 4-6 dígitos que el founder pone desde el ERP. Adentro: el brand book
 * navegable y **cada sección con su propia descarga**, para que nadie tenga que
 * pedir un archivo por WhatsApp.
 *
 * Antes esto vivía en `/interno/marca`, detrás de la sesión del ERP — o sea,
 * inalcanzable para un externo. La página vieja quedó como redirect acá.
 *
 * El contenido descargable sale de `brand_assets` + Storage (migr 0334), no de
 * constantes en el código: Marketing sube un archivo y aparece sin desplegar.
 * Lo único que sigue en constantes es la interpretación de la marca (paleta,
 * tipografía, reglas de uso), que es doctrina, no inventario.
 */

export const metadata: Metadata = {
  title: `Centro de marca · DTD Cargo`,
  description: "Brand book, logos y recursos de marca de DTD Cargo.",
  // Triple noindex: este meta + X-Robots-Tag (next.config) + Disallow (robots.ts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// La página depende de la cookie del gate → nunca estática.
export const dynamic = "force-dynamic";

const HEADER_H = "64px";

// ── Doctrina de marca (no es inventario: no vive en la DB) ──────

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

const DOS = [
  "Elige la variante según el fondo (clara sobre papel, inversa sobre navy).",
  "Deja un clearspace de 2× la altura del trazo alrededor.",
  "Tamaño mínimo 24px de alto en digital.",
  'El wordmark "DTD Cargo" siempre en Archivo Black.',
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

// ── Bloques de doctrina por sección ─────────────────────────────

function ColorDoctrine() {
  return (
    <div className="flex flex-col gap-9">
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
  );
}

function TypeDoctrine() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
  );
}

function LogoDoctrine() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
  );
}

function BrandBookDoctrine() {
  return (
    <div className="rounded-[16px] border border-grey-200 bg-white overflow-hidden" style={{ boxShadow: SHADOWS.card }}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-grey-200">
        <div>
          <div className="text-[15px] font-bold text-ink">
            Brand Book DTD {BRAND_BOOK_VERSION}
          </div>
          <div className="text-[13px] text-grey-500 mt-0.5">
            El documento maestro completo, para leer en pantalla.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/marca/brand-book" className="btn btn-ghost" style={{ height: 40, fontSize: 13 }}>
            Abrir a pantalla completa <ArrowIcon />
          </a>
          <a
            href={BRAND_BOOK_URL}
            download={BRAND_BOOK_DOWNLOAD_NAME}
            className="btn btn-primary"
            style={{ height: 40, fontSize: 13 }}
          >
            Descargar <DownloadIcon size={15} />
          </a>
        </div>
      </div>
      <iframe
        src={BRAND_BOOK_URL}
        title={`Brand Book DTD ${BRAND_BOOK_VERSION}`}
        loading="lazy"
        style={{ width: "100%", height: "min(70vh, 820px)", border: 0, display: "block" }}
      />
    </div>
  );
}

/** La doctrina que acompaña a cada sección, por slug. */
function doctrineFor(slug: string) {
  switch (slug) {
    case "brand-book":
      return <BrandBookDoctrine />;
    case "color":
      return <ColorDoctrine />;
    case "tipografia":
      return <TypeDoctrine />;
    case "logos":
      return <LogoDoctrine />;
    default:
      return null;
  }
}

// ── Sección ─────────────────────────────────────────────────────

function Section({ section }: { section: BrandSection }) {
  const doctrine = doctrineFor(section.slug);
  const hasAssets = section.assets.length > 0;

  return (
    <section
      id={section.slug}
      className="scroll-mt-[116px] py-14 lg:py-20 border-t border-grey-200"
    >
      <div className="wrap">
        <h2 className="h-section">{section.title}</h2>
        {section.intro && <p className="lead mt-4 max-w-[62ch]">{section.intro}</p>}

        {doctrine && <div className="mt-10">{doctrine}</div>}

        {hasAssets ? (
          <>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {section.assets.map((a) => (
                <AssetCard key={a.id} asset={a} />
              ))}
            </div>

            {/* El botón que pidió el founder: al pie de CADA sección. */}
            <a
              href={`/api/marca/bundle/${section.slug}`}
              className="btn btn-primary mt-8"
              aria-label={`Descargar todos los archivos de ${section.title} en un zip`}
            >
              Descargar {section.title.toLowerCase()} ({section.assets.length}){" "}
              <DownloadIcon size={16} />
            </a>
          </>
        ) : (
          !doctrine && (
            <div className="mt-8 rounded-[16px] border border-dashed border-grey-300 bg-white p-8 text-center">
              <p className="text-[14px] text-grey-700 leading-[1.55]">
                Todavía no hay archivos cargados en esta sección.
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
}

// ── Página ──────────────────────────────────────────────────────

export default async function MarcaPage() {
  // El gate: sesión del ERP o cookie del código. Sin ninguna de las dos, lo
  // único que se renderiza es el formulario — el catálogo ni se consulta.
  if (!(await hasBrandAccess())) return <BrandGate />;

  const tenantId = await resolveBrandTenantId();
  const catalog = tenantId ? await loadBrandCatalog(tenantId) : [];

  const nav: NavItem[] = catalog.map((s) => ({ id: s.slug, label: s.title }));
  const totalAssets = catalog.reduce((n, s) => n + s.assets.length, 0);

  return (
    <div className={`bg-paper min-h-screen text-ink ${jetbrainsMonoUi.variable}`}>
      {/* Header propio: /marca no cuelga del layout del sitio público ni del ERP */}
      <header
        className="sticky top-0 z-30 bg-paper border-b border-grey-200"
        style={{ height: HEADER_H }}
      >
        <div className="wrap h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark variant="primary" size={30} />
            <span className="text-[14px] font-bold text-ink truncate">
              Centro de marca
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalAssets > 0 && (
              /* Descarga, no navegación: `<Link>` haría transición cliente y el
                 zip nunca llegaría. La regla lo confunde con una página. */
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a
                href="/api/marca/bundle/todo"
                className="btn btn-ghost"
                style={{ height: 38, fontSize: 13 }}
              >
                Descargar todo <DownloadIcon size={15} />
              </a>
            )}
            <form action={lockBrandAction}>
              <button
                type="submit"
                className="text-[12.5px] font-semibold text-grey-500 hover:text-ink px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {nav.length > 0 && <SectionNav items={nav} stickyTop={HEADER_H} />}

      {/* Hero */}
      <section className="pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="wrap">
          <span className="eyebrow">Brand Book {BRAND_BOOK_VERSION}</span>
          <h1 className="h-display mt-5" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            La marca,
            <br />
            <span style={{ color: "var(--color-wine)" }}>en un solo lugar.</span>
          </h1>
          <p className="lead mt-6 max-w-[54ch]">
            El brand book, los logos, la paleta, la tipografía y las plantillas —
            todo descargable, siempre en la última versión. Toma lo que necesites.
          </p>
        </div>
      </section>

      {catalog.length === 0 ? (
        <div className="wrap pb-24">
          <div className="rounded-[16px] border border-dashed border-grey-300 bg-white p-10 text-center">
            <p className="text-[15px] font-bold text-ink">
              El catálogo todavía está vacío.
            </p>
            <p className="mt-2 text-[14px] text-grey-700 leading-[1.55]">
              El equipo de DTD Cargo carga los archivos desde el ERP. Escríbenos y
              te los pasamos mientras tanto.
            </p>
            <a
              href={`mailto:${CONTACT.ve.email}?subject=${encodeURIComponent("DTD Cargo — archivos de marca")}`}
              className="btn btn-primary mt-6"
            >
              Escribir al equipo <ArrowIcon />
            </a>
          </div>
        </div>
      ) : (
        catalog.map((s) => <Section key={s.id} section={s} />)
      )}

      <footer className="border-t border-grey-200 py-8">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-grey-500">
          <span>
            ¿Falta un archivo fuente?{" "}
            <a
              href={`mailto:${CONTACT.ve.email}?subject=${encodeURIComponent("DTD Cargo — archivos fuente de marca")}`}
              className="font-semibold text-wine underline underline-offset-2"
            >
              Pídelo acá
            </a>
            .
          </span>
          <span>© {new Date().getFullYear()} DTD Cargo</span>
        </div>
      </footer>
    </div>
  );
}
