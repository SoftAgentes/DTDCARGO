/**
 * SDD-0604 · Contenido de `/llms-full.txt`: la versión ampliada de
 * `public/llms.txt` para motores de IA.
 *
 * Se arma con las mismas fuentes que las páginas públicas para que no se desvíe
 * de ellas. Los precios quedan fuera a propósito: viven en `/tarifas` y dependen
 * de la configuración del ERP.
 */
import { FAQS } from "@/lib/faqs";
import { GLOSSARY_TERMS, type GlossaryTerm } from "@/lib/design-tokens";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { isOfferable } from "@/lib/seo-offer-catalog";
import { SERVICIOS_DETALLE } from "@/lib/servicios-detalle";

const SITIO = "https://dtdcargo.com";

/** Texto plano: el glosario admite `<b>` y código entre comillas invertidas. */
function plano(texto: string): string {
  return texto.replace(/<[^>]+>/g, "").replace(/`/g, "");
}

function cuerpoDelTermino(term: GlossaryTerm): string[] {
  return TRACKING_EN_CONSTRUCCION && term.enConstruccion ? term.enConstruccion.body : term.body;
}

export function buildLlmsFull(): string {
  const lineas: string[] = [
    "# DTD Cargo: información ampliada",
    "",
    "> Agente de carga puerta a puerta (DDP) entre China y Venezuela. Fundada en 2015, con experiencia en el comercio con China desde 2008. Equipo y bodega propios en Yiwu (China) y Valencia (Venezuela).",
    "",
    `Resumen: ${SITIO}/llms.txt`,
    `Precios y calculadora: ${SITIO}/tarifas`,
    "",
    "## Servicios",
  ];

  for (const s of SERVICIOS_DETALLE.filter(isOfferable)) {
    lineas.push("", `### ${s.titulo}`, s.resumen);
    if (s.incluye.length > 0) {
      lineas.push("", "Incluye:", ...s.incluye.map((item) => `- ${item}`));
    }
    if (s.noIncluye.length > 0) {
      lineas.push("", "No incluye:", ...s.noIncluye.map((item) => `- ${item}`));
    }
    if (s.tiempos) lineas.push("", `Tiempos: ${s.tiempos}`);
    if (s.comoSolicitar) lineas.push(`Cómo solicitarlo: ${s.comoSolicitar}`);
  }

  lineas.push("", "## Preguntas frecuentes");
  for (const f of FAQS) {
    lineas.push("", `### ${f.pregunta}`, f.respuesta);
  }

  lineas.push("", "## Glosario");
  for (const t of GLOSSARY_TERMS) {
    lineas.push("", `### ${t.term} (${t.acronym})`, ...cuerpoDelTermino(t).map(plano));
  }

  return `${lineas.join("\n")}\n`;
}
