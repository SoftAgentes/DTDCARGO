/**
 * FaqPageJsonLd · schema.org FAQPage extraído del markdown del artículo.
 *
 * Plan v5 · Fase D. Funciona en simbiosis con el prompt:
 * buildGenerateArticlePrompt instruye a Claude a agregar una sección
 * "## Preguntas frecuentes" con H3 = "¿Pregunta?" + párrafo respuesta
 * cuando hay pain_points. Este componente parsea ese pattern y emite
 * el schema FAQPage estándar.
 *
 * Si el artículo NO contiene esa sección (o no tiene Q+A parseables),
 * devuelve null — no inyecta schema vacío (penalty SEO).
 *
 * Validar con: https://search.google.com/test/rich-results
 */

import { serializeJsonLd } from "@/lib/public/json-ld";

interface Props {
  bodyMarkdown: string;
}

interface QAPair {
  question: string;
  answer: string;
}

/**
 * Extrae el bloque "## Preguntas frecuentes" del markdown y parsea
 * sus H3 (preguntas) + párrafo siguiente (respuesta).
 *
 * Tolera variaciones: "Preguntas Frecuentes" / "FAQ" / "Faq".
 */
function extractFaq(markdown: string): QAPair[] {
  if (!markdown) return [];

  // Buscar el inicio de la sección FAQ (case insensitive)
  const faqHeaderRe = /^##\s+(preguntas\s+frecuentes|faq)\s*$/im;
  const match = markdown.match(faqHeaderRe);
  if (!match || match.index === undefined) return [];

  // Sección FAQ va desde el match hasta el próximo "## " o EOF
  const fromIdx = match.index + match[0].length;
  const rest = markdown.slice(fromIdx);
  const nextH2 = rest.search(/^##\s+/m);
  const faqBlock = nextH2 === -1 ? rest : rest.slice(0, nextH2);

  // Parsear pares: ### ¿Pregunta? + párrafo respuesta
  const pairs: QAPair[] = [];
  const lines = faqBlock.split(/\n/);
  let currentQ: string | null = null;
  let currentABuf: string[] = [];

  const flush = () => {
    if (!currentQ) return;
    const answer = currentABuf
      .join(" ")
      .replace(/\[VERIFICAR:?[^\]]*\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (answer.length >= 20) {
      pairs.push({ question: currentQ, answer });
    }
    currentQ = null;
    currentABuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("### ")) {
      flush();
      const q = line.slice(4).trim();
      // Solo aceptamos las que parecen preguntas (?, ¿, signo o palabra interrogativa)
      if (q.length === 0) continue;
      currentQ = q;
      continue;
    }
    if (line === "") {
      // Línea en blanco — no flush automático (acumula párrafo)
      continue;
    }
    if (line.startsWith("##") || line.startsWith("# ")) {
      // Otro heading inesperado — terminamos la sección
      flush();
      break;
    }
    if (currentQ) {
      currentABuf.push(line);
    }
  }
  flush();

  return pairs.slice(0, 8); // max 8 Q+A (más es spam para Google)
}

export function FaqPageJsonLd({ bodyMarkdown }: Props) {
  const pairs = extractFaq(bodyMarkdown);
  if (pairs.length < 2) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: p.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
