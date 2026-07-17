/**
 * SDD-0158 — Lee los documentos de `docs/marketing/` del repo y los devuelve ya
 * renderizados a HTML para el lector del Studio (`/studio/marketing/docs`).
 *
 * Server-only: usa `fs`. En prod (Vercel) los `.md` viajan en el bundle de la
 * función porque están declarados en `outputFileTracingIncludes` de
 * `next.config.ts` para esta ruta (mismo patrón que el hub de marca ya usa con
 * `whatsapp-business.md`). El título de cada doc = su primer `# H1`.
 *
 * Orden y agrupación fijos (PLAN): el equipo ve primero el sistema de
 * adquisición, luego estrategia y canales. Un doc que no exista se salta sin
 * romper (defensivo ante renombres).
 */

import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderMarkdown } from "./markdown";

/** Grupos + orden de los documentos en el lector. */
const PLAN: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "Sistema de adquisición",
    [
      "README.md",
      "adquisicion.md",
      "oferta-borradores.md",
      "prospectos-ancla.md",
      "checklist-kommo.md",
      "ventas.md",
      "embudo-ventas.md",
    ],
  ],
  [
    "Estrategia y ventas",
    ["estrategia.md", "identidad.md", "manual-vendedores-peso.md", "condiciones-cotizacion.md"],
  ],
  [
    "Canales y contenido",
    [
      "seo.md",
      "plan-accion-digital.md",
      "ads-reestructura-search.md",
      "redes.md",
      "whatsapp-business.md",
      "link-in-bio.md",
      "videos/video-registro-markbox.md",
    ],
  ],
];

export interface MarketingDoc {
  /** Ruta repo-relativa, ej. "docs/marketing/adquisicion.md". */
  path: string;
  /** Basename, ej. "adquisicion.md" — llave para los enlaces internos. */
  file: string;
  group: string;
  title: string;
  /** HTML ya renderizado (dangerouslySetInnerHTML en el lector). */
  html: string;
}

export function getMarketingDocs(): MarketingDoc[] {
  const root = join(process.cwd(), "docs", "marketing");
  // Set de basenames enlazables (para que renderMarkdown marque los `.md` internos).
  const bundled = new Set<string>();
  for (const [, files] of PLAN) {
    for (const rel of files) bundled.add((rel.split("/").pop() || "").toLowerCase());
  }

  const docs: MarketingDoc[] = [];
  for (const [group, files] of PLAN) {
    for (const rel of files) {
      let src: string;
      try {
        src = readFileSync(join(root, rel), "utf8");
      } catch {
        continue; // doc renombrado/ausente → se salta
      }
      const m = src.match(/^#\s+(.+)$/m);
      const file = rel.split("/").pop() || rel;
      docs.push({
        path: "docs/marketing/" + rel,
        file,
        group,
        title: m ? m[1].trim() : file,
        html: renderMarkdown(src, bundled),
      });
    }
  }
  return docs;
}
