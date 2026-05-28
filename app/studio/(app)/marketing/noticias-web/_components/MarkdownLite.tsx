/**
 * MarkdownLite · parser propio mínimo para artículos generados por Claude.
 *
 * Soporta:
 *  - `# H1`, `## H2`, `### H3` (al inicio de línea)
 *  - Párrafos (separados por línea en blanco)
 *  - Negritas inline `**texto**`
 *  - Itálicas inline `*texto*` (opcional, conservador)
 *
 * NO usa librerías externas (constraint del prompt). Suficiente para el
 * shape que devuelve Claude en el paso 3 (intro + ## secciones + conclusión).
 *
 * Visual: tipografía Georgia (serif) editorial, leading-relaxed, párrafos
 * en grey-700 sobre fondo paper/blanco.
 */

"use client";

import React from "react";

const SERIF: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};

/** Reemplaza **bold**, *italic* y [VERIFICAR:...] en un string. */
function inlineFormat(text: string, keyPrefix: string): React.ReactNode[] {
  // Primero: split por [VERIFICAR:...] markers. Cada marker se vuelve un
  // <mark> visualmente destacado para que el editor lo resuelva antes de
  // publicar. Plan v5.
  const verifyParts = text.split(/(\[VERIFICAR:?[^\]]*\])/gi);
  const nodes: React.ReactNode[] = [];

  verifyParts.forEach((part, vIdx) => {
    if (/^\[VERIFICAR:?[^\]]*\]$/i.test(part)) {
      nodes.push(
        <mark
          key={`${keyPrefix}-v-${vIdx}`}
          style={{
            background: "var(--warning-bg, rgba(184,137,58,0.15))",
            color: "var(--warning, #B8893A)",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: "0.92em",
            fontWeight: 600,
            border: "1px dashed var(--warning, #B8893A)",
            fontFamily:
              "var(--f-mono, 'JetBrains Mono', ui-monospace, monospace)",
          }}
          title="Dato sin verificar — resolvelo antes de publicar"
        >
          {part}
        </mark>,
      );
      return;
    }
    // Dentro del chunk no-VERIFICAR aplicamos **bold** y *italic* como antes.
    const boldSplit = part.split(/(\*\*[^*]+\*\*)/g);
    boldSplit.forEach((chunk, i) => {
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        const inner = chunk.slice(2, -2);
        nodes.push(
          <strong
            key={`${keyPrefix}-b-${vIdx}-${i}`}
            className="text-ink"
          >
            {inner}
          </strong>,
        );
      } else {
        const italicSplit = chunk.split(/(\*[^*]+\*)/g);
        italicSplit.forEach((piece, j) => {
          if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) {
            nodes.push(
              <em key={`${keyPrefix}-i-${vIdx}-${i}-${j}`}>
                {piece.slice(1, -1)}
              </em>,
            );
          } else if (piece) {
            nodes.push(piece);
          }
        });
      }
    });
  });
  return nodes;
}

export function MarkdownLite({ source }: { source: string }) {
  const lines = source.split("\n");
  // Acumulamos párrafos multi-línea hasta hit de heading o línea en blanco
  const blocks: React.ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    if (text) {
      blocks.push(
        <p
          key={`p-${key++}`}
          className="text-grey-700 leading-relaxed mb-5"
          style={{ ...SERIF, fontSize: 17 }}
        >
          {inlineFormat(text, `p-${key}`)}
        </p>,
      );
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push(
        <h3
          key={`h3-${key++}`}
          className="text-ink font-semibold mt-8 mb-3"
          style={{ ...SERIF, fontSize: 20 }}
        >
          {inlineFormat(line.slice(4), `h3-${key}`)}
        </h3>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push(
        <h2
          key={`h2-${key++}`}
          className="text-ink font-bold mt-10 mb-4"
          style={{ ...SERIF, fontSize: 26, letterSpacing: "-0.01em" }}
        >
          {inlineFormat(line.slice(3), `h2-${key}`)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push(
        <h1
          key={`h1-${key++}`}
          className="text-ink font-bold mt-12 mb-6"
          style={{ ...SERIF, fontSize: 32, letterSpacing: "-0.02em" }}
        >
          {inlineFormat(line.slice(2), `h1-${key}`)}
        </h1>,
      );
      continue;
    }

    // Línea normal → acumular en párrafo
    paragraphBuffer.push(line);
  }
  flushParagraph();

  return <div>{blocks}</div>;
}
