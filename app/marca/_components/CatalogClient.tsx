"use client";

/**
 * El catálogo interactivo de `/marca` (SDD-0238, rediseño).
 *
 * LO QUE ARREGLA, respecto de la primera versión:
 *
 *  1. SELECCIÓN. Antes se podía bajar de a un archivo o la sección completa —
 *     nada en el medio. Quien quería el logo inverso + la tipografía + un ícono
 *     hacía tres descargas o se llevaba 14 MB para usar 200 KB. Era literalmente
 *     lo que pedía el encargo ("escoge qué quiere bajar y lo descarga") y
 *     faltaba.
 *  2. EL BOTÓN DE SECCIÓN SUBIÓ. Estaba al final de la grilla: con 6 logos se
 *     ve, con 30 plantillas hay que recorrer toda la sección para descubrir que
 *     existe. Ahora está en el encabezado, donde se descubre al llegar.
 *  3. BUSCADOR. A 60 archivos, sin filtro el diseñador vuelve a preguntar por
 *     WhatsApp — justo lo que este centro venía a evitar.
 *
 * Las secciones vacías SE MUESTRAN (decisión del founder): el diseñador ve el
 * mapa completo de lo que va a existir. Lo que cambia es el tono — el vacío se
 * lee como promesa, no como puerta cerrada.
 */

import { useMemo, useState } from "react";
import { SectionNav, type NavItem } from "@/components/marca/SectionNav";
import { ColorSwatch } from "@/components/marca/ColorSwatch";
import { CheckIcon, CloseIcon } from "@/components/Icon";
import {
  extensionOf,
  formatBytes,
  kindLabel,
  type BrandSection,
} from "@/lib/marca/catalog-types";
import { DTD, SHADOWS } from "@/lib/design-tokens";
import { AssetCard } from "./AssetCard";
import { ZipButton } from "./ZipButton";

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
  { name: "Chino · fuente del sistema", role: "Chino mandarín · direcciones CN", sample: "义乌 · 门到门", fontVar: "var(--font-noto-sc)", note: "Sin fuente web: cada equipo usa su fuente china (PingFang, Microsoft YaHei, Noto CJK)." },
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
            style={{ background: "var(--color-status-success)", color: "var(--color-on-accent)" }}
          >
            <CheckIcon size={16} />
          </span>
          <h3 className="text-[16px] font-bold text-ink">Haz</h3>
        </div>
        <ul className="flex flex-col gap-3 list-none p-0">
          {DOS.map((d) => (
            <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
              <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "var(--color-status-success)" }} />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[16px] border border-grey-200 bg-white p-6 lg:p-7">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="grid place-items-center w-7 h-7 rounded-full"
            style={{ background: "var(--color-status-danger)", color: "var(--color-on-accent)" }}
          >
            <CloseIcon size={15} />
          </span>
          <h3 className="text-[16px] font-bold text-ink">Evita</h3>
        </div>
        <ul className="flex flex-col gap-3 list-none p-0">
          {DONTS.map((d) => (
            <li key={d} className="flex gap-2.5 text-[14.5px] text-grey-700 leading-[1.5]">
              <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "var(--color-status-danger)" }} />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function doctrineFor(slug: string) {
  if (slug === "color") return <ColorDoctrine />;
  if (slug === "tipografia") return <TypeDoctrine />;
  if (slug === "logos") return <LogoDoctrine />;
  return null;
}

// ── Búsqueda ────────────────────────────────────────────────────

/** Sin acentos y en minúsculas: "tipografia" tiene que encontrar "Tipografía". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ── Componente ──────────────────────────────────────────────────

export function CatalogClient({
  sections,
  headerHeight,
}: {
  sections: BrandSection[];
  headerHeight: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    if (!searching) return sections;
    const q = normalize(query.trim());
    return sections
      .map((s) => ({
        ...s,
        assets: s.assets.filter((a) =>
          normalize(
            [a.title, a.subtitle ?? "", kindLabel(a.kind), extensionOf(a.storagePath) ?? ""].join(" "),
          ).includes(q),
        ),
      }))
      // Buscando, una sección sin coincidencias es ruido.
      .filter((s) => s.assets.length > 0);
  }, [sections, query, searching]);

  const nav: NavItem[] = visible.map((s) => ({ id: s.slug, label: s.title }));

  const allAssets = useMemo(() => sections.flatMap((s) => s.assets), [sections]);
  const selectedAssets = useMemo(
    () => allAssets.filter((a) => selected.has(a.id)),
    [allAssets, selected],
  );
  const selectedBytes = selectedAssets.reduce((n, a) => n + (a.bytes ?? 0), 0);

  const matches = visible.reduce((n, s) => n + s.assets.length, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(section: BrandSection) {
    const ids = section.assets.map((a) => a.id);
    const allIn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      {/* Barra fija: navegación + buscador. Un solo lugar para "dónde estoy" y
          "cómo llego a lo que busco". */}
      <div className="sticky z-20 bg-paper border-b border-grey-200" style={{ top: headerHeight }}>
        <div className="wrap py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {nav.length > 0 && <SectionNav items={nav} embedded />}
          </div>
          <label className="relative flex-shrink-0">
            <span className="sr-only">Buscar en el centro de marca</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              /* `grey-500` y no `grey-300` en el borde: es lo único que
                 identifica al campo, y WCAG 1.4.11 pide 3:1 para eso.
                 Medido: grey-300 sobre blanco = 1.45 · grey-500 = 5.11. */
              className="h-9 w-[130px] sm:w-[210px] rounded-full border border-grey-500 bg-white pl-3.5 pr-3 text-[13px] text-ink placeholder:text-grey-500 focus:outline-none focus:border-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
            />
          </label>
        </div>
      </div>

      {searching && (
        <div className="wrap pt-6">
          <p className="text-[13.5px] text-grey-700" role="status">
            {matches === 0
              ? `Nada coincide con “${query}”.`
              : `${matches} ${matches === 1 ? "archivo" : "archivos"} para “${query}”.`}{" "}
            <button
              type="button"
              onClick={() => setQuery("")}
              className="font-semibold text-wine underline underline-offset-2"
            >
              Ver todo
            </button>
          </p>
        </div>
      )}

      {visible.map((section) => {
        const doctrine = searching ? null : doctrineFor(section.slug);
        const count = section.assets.length;
        const allIn = count > 0 && section.assets.every((a) => selected.has(a.id));

        return (
          <section
            key={section.id}
            id={section.slug}
            /* 132 = header (64) + barra fija (~56) + 12 de aire. Con 120 el
               título aterrizaba al ras del borde inferior de la barra. */
            className="scroll-mt-[132px] py-12 lg:py-16 border-t border-grey-200"
          >
            <div className="wrap">
              {/* Encabezado: título + acciones. Las acciones se ven al LLEGAR
                  a la sección, no después de recorrerla entera. */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="h-section">{section.title}</h2>
                  {section.intro && (
                    <p className="lead mt-3 max-w-[62ch]">{section.intro}</p>
                  )}
                </div>

                {count > 0 && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className="btn btn-ghost"
                      style={{ height: 40, fontSize: 13 }}
                    >
                      {allIn ? "Quitar los" : "Elegir los"} {count}
                    </button>
                    {/* Buscando, `count` es el número de COINCIDENCIAS, no el de
                        la sección: bajar por slug traería la sección entera y el
                        botón estaría mintiendo. Con filtro activo se baja
                        exactamente lo que se ve, por ids. */}
                    <ZipButton
                      href={
                        searching
                          ? `/api/marca/seleccion?ids=${section.assets.map((a) => a.id).join(",")}`
                          : `/api/marca/bundle/${section.slug}`
                      }
                      filename={`dtd-${section.slug}`}
                      style={{ height: 40, fontSize: 13 }}
                      ariaLabel={`Descargar los ${count} archivos de ${section.title} en un zip`}
                    >
                      Descargar {count === 1 ? "el archivo" : `los ${count}`}
                    </ZipButton>
                  </div>
                )}
              </div>

              {doctrine && <div className="mt-9">{doctrine}</div>}

              {count > 0 ? (
                <div
                  /*
                    La cuarta columna entra SÓLO en 2xl (1536px+), y es a
                    propósito que no entre antes. Con el contenedor ya abierto a
                    1760px, tres columnas en una pantalla de 2560 dan fichas de
                    ~570px de ancho con una miniatura de 224 de alto: mucha ficha
                    para poca imagen. En cuatro la proporción vuelve a su sitio y
                    siguen siendo bastante más grandes que las de antes.

                    Debajo de 1536 no cambia nada: 1 · 2 · 3 como siempre.
                  */
                  className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5"
                >
                  {section.assets.map((a) => (
                    <AssetCard
                      key={a.id}
                      asset={a}
                      selected={selected.has(a.id)}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              ) : (
                !doctrine && (
                  /* El founder pidió que las secciones vacías se vean: el
                     diseñador tiene el mapa completo de lo que va a existir. El
                     tono es de promesa, no de error. */
                  <div className="mt-7 rounded-[16px] border border-dashed border-grey-300 bg-white/60 px-7 py-8">
                    <p className="text-[14px] font-bold text-ink">En camino</p>
                    <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55] max-w-[60ch]">
                      Esta sección todavía no tiene archivos. Cuando el equipo los
                      cargue van a aparecer acá, sin que tengas que pedirlos.
                    </p>
                  </div>
                )
              )}
            </div>
          </section>
        );
      })}

      {/* Barra de selección: aparece al marcar el primero. Fija abajo para que
          no haya que volver arriba a "confirmar" nada. */}
      {selectedAssets.length > 0 && (
        <>
          {/* Colchón para que la barra no tape la última fila de fichas. */}
          <div aria-hidden style={{ height: 96 }} />
          <div
            role="region"
            aria-label="Archivos elegidos"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-grey-200 bg-white"
            style={{ boxShadow: SHADOWS.barUp }}
          >
            <div className="wrap py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-ink font-semibold" aria-live="polite">
                {selectedAssets.length}{" "}
                {selectedAssets.length === 1 ? "archivo elegido" : "archivos elegidos"}
                {selectedBytes > 0 && (
                  <span className="font-normal text-grey-700">
                    {" "}
                    · {formatBytes(selectedBytes)}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="btn btn-ghost"
                  style={{ height: 40, fontSize: 13 }}
                >
                  Limpiar
                </button>
                <ZipButton
                  href={`/api/marca/seleccion?ids=${selectedAssets.map((a) => a.id).join(",")}`}
                  filename="dtd-seleccion"
                  style={{ height: 40, fontSize: 13 }}
                >
                  Descargar lo elegido
                </ZipButton>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
