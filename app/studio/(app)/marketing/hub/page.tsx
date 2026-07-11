/**
 * Marketing · HUB de marca (SDD-0119) — estructura + secciones V1.
 *
 * Repositorio de recursos de marca para el equipo de marketing:
 *   1. Logos          — los 4 isólogos oficiales, descargables (V1 real).
 *   2. Fondos/portadas — por red social (placeholder; assets pendientes).
 *   3. Plantillas      — de marca, incl. historias de TikTok (placeholder).
 *   4. Herramientas    — framework + utilidades (placeholder).
 *
 * Las muestras de logo se pintan sobre su fondo previsto (claro/oscuro). Los
 * tokens de marca `--color-paper/--color-ink` se invierten con el tema del
 * Studio (dark por default), así que acá se fijan los 2 colores CANÓNICOS de
 * BRAND.md (paper #FBFAF7 · navy #0F1E3D) SOLO en el tile — es el uso correcto
 * para una galería de assets, no un color inventado. El resto es token-puro.
 */

import Link from "next/link";
import Image from "next/image";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { Icon } from "@/app/studio/_components/icons";

export const metadata = { title: "HUB de marca · Marketing · DTD Studio" };
export const dynamic = "force-dynamic";

// Colores de marca canónicos (BRAND.md) para el fondo de cada muestra.
const BRAND_PAPER = "#FBFAF7";
const BRAND_NAVY = "#0F1E3D";

type Logo = {
  file: string;
  label: string;
  caption: string;
  tile: string;
  onDark: boolean;
};

const LOGOS: Logo[] = [
  {
    file: "/brand/dtdcargo-isologo-primary.png",
    label: "Principal",
    caption: "Color · sobre fondo claro",
    tile: BRAND_PAPER,
    onDark: false,
  },
  {
    file: "/brand/dtdcargo-isologo-reverse.png",
    label: "Inverso",
    caption: "Color · sobre fondo oscuro o foto",
    tile: BRAND_NAVY,
    onDark: true,
  },
  {
    file: "/brand/dtdcargo-isologo-mono-dark.png",
    label: "Mono oscuro",
    caption: "Monocromo · sobre fondo claro",
    tile: BRAND_PAPER,
    onDark: false,
  },
  {
    file: "/brand/dtdcargo-isologo-mono-light.png",
    label: "Mono claro",
    caption: "Monocromo · sobre fondo oscuro",
    tile: BRAND_NAVY,
    onDark: true,
  },
];

type Placeholder = {
  eyebrow: string;
  title: string;
  desc: string;
};

const PLACEHOLDERS: Placeholder[] = [
  {
    eyebrow: "Fondos y portadas",
    title: "Fondos y portadas por red",
    desc: "Fondos de Facebook, portadas y formatos por red social. Se cargan acá para que descargues el que necesites al instante.",
  },
  {
    eyebrow: "Plantillas",
    title: "Plantillas de marca",
    desc: "Plantillas listas para usar, incluidas las historias de TikTok. Te dan el cómo diseñar rápido sin ser diseñadora.",
  },
  {
    eyebrow: "Herramientas",
    title: "Framework y herramientas",
    desc: "El framework de marca y las utilidades que se van sumando (motores de contenido, guías, checklists).",
  },
];

export default async function MarketingHubPage() {
  await requireModuleView("marketing");

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/studio/marketing"
          style={{
            font: "600 13px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
          }}
        >
          ← Marketing
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine-text)" }}
        >
          Marketing · HUB
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 var(--s-2)", color: "var(--ink)" }}
        >
          HUB de marca
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "64ch",
          }}
        >
          Todo lo de marca en un solo lugar: logos, fondos, plantillas y
          herramientas. Descarga lo que necesites sin pedirlo.
        </p>
      </div>

      {/* Logos */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
          Logos
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {LOGOS.map((logo) => (
            <div
              key={logo.file}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                background: "var(--bg-surface)",
                overflow: "hidden",
              }}
            >
              {/* Muestra sobre su fondo previsto */}
              <div
                style={{
                  position: "relative",
                  height: 132,
                  background: logo.tile,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Image
                  src={logo.file}
                  alt={`Isólogo DTD Cargo — ${logo.label}`}
                  fill
                  sizes="240px"
                  style={{ objectFit: "contain", padding: 26 }}
                />
              </div>
              {/* Meta + descarga */}
              <div style={{ padding: "12px 14px 14px" }}>
                <h3
                  style={{
                    font: "700 14px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    margin: "0 0 2px",
                  }}
                >
                  {logo.label}
                </h3>
                <p
                  style={{
                    font: "400 12px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "0 0 var(--s-3)",
                  }}
                >
                  {logo.caption}
                </p>
                <a
                  href={logo.file}
                  download
                  aria-label={`Descargar isólogo ${logo.label} en PNG`}
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                >
                  {Icon.download(14)}
                  Descargar PNG
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Secciones pendientes */}
      {PLACEHOLDERS.map((p) => (
        <section key={p.eyebrow} style={{ marginBottom: 24 }}>
          <h2 className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
            {p.eyebrow}
          </h2>
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 14,
              padding: "22px 24px",
              background: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <p
                style={{
                  font: "600 14px/1.4 var(--f-sans)",
                  color: "var(--ink)",
                  margin: "0 0 var(--s-1)",
                }}
              >
                {p.title}
              </p>
              <p
                style={{
                  font: "400 13px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: 0,
                  maxWidth: "64ch",
                }}
              >
                {p.desc}
              </p>
            </div>
            <span
              className="studio-eyebrow"
              style={{ fontSize: 10, color: "var(--ink-soft)", flexShrink: 0 }}
            >
              Próximamente
            </span>
          </div>
        </section>
      ))}
    </div>
  );
}
