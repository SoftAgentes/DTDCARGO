/**
 * lib/news/markdown.tsx · Plan v4 · Phase F
 *
 * Parser server-side de Markdown para el body de news_posts. Devuelve JSX
 * puro — NO `dangerouslySetInnerHTML`, NO librerías externas.
 *
 * Soporta:
 *  - `# H1` (renderiza como h2 visual — h1 lo da el page con el title)
 *  - `## H2`, `### H3`
 *  - Párrafos (separados por línea en blanco)
 *  - `**bold**` (también acepta `<b>` HTML inline legacy)
 *  - `*italic*`
 *  - `- bullet` y `* bullet` (listas no ordenadas)
 *  - `1. item` (listas ordenadas)
 *  - `> quote` (blockquote)
 *  - `[texto](url)` links · auto-detecta externos para target=_blank
 *
 * Estilo: tipografía Archivo brand del sitio público + leading 1.7 +
 * grey-700 sobre paper/blanco. Match con el resto de /noticias.
 */

import React, { Fragment, type ReactNode } from "react";

// ──────────────────────────────────────────────────────────────
// Inline formatting · **bold** · *italic* · [text](url) · <b>X</b>
// ──────────────────────────────────────────────────────────────

/** Regex combinada — captura los 4 patrones de inline format. */
const INLINE_TOKEN_RE =
  /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\[[^\]\n]+\]\([^)\n]+\)|<b>[^<]+<\/b>)/g;

function inlineFormat(text: string, keyPrefix: string): ReactNode[] {
  if (!text) return [];
  const parts = text.split(INLINE_TOKEN_RE);
  const nodes: ReactNode[] = [];

  parts.forEach((part, i) => {
    if (!part) return;
    const k = `${keyPrefix}-${i}`;

    // **bold**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      nodes.push(
        <strong key={k} className="text-ink font-bold">
          {part.slice(2, -2)}
        </strong>,
      );
      return;
    }

    // <b>...</b> (legacy HTML inline)
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      nodes.push(
        <strong key={k} className="text-ink font-bold">
          {part.slice(3, -4)}
        </strong>,
      );
      return;
    }

    // *italic* — must not be ** (handled above) and must have content
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length > 2 &&
      !part.startsWith("**")
    ) {
      nodes.push(<em key={k}>{part.slice(1, -1)}</em>);
      return;
    }

    // [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      const isExternal = /^https?:\/\//.test(url);
      return nodes.push(
        <a
          key={k}
          href={url}
          className="text-wine hover:text-wine-deep underline underline-offset-2"
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {label}
        </a>,
      );
    }

    // Plain text
    nodes.push(<Fragment key={k}>{part}</Fragment>);
  });

  return nodes;
}

// ──────────────────────────────────────────────────────────────
// Block tokenizer · headings · listas · blockquote · paragraphs
// ──────────────────────────────────────────────────────────────

type Block =
  | { type: "h1" | "h2" | "h3"; content: string }
  | { type: "p" | "blockquote"; content: string }
  | { type: "ul" | "ol"; items: string[] };

function tokenize(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];

  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let bqBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    const text = paragraphBuf.join(" ").trim();
    if (text) blocks.push({ type: "p", content: text });
    paragraphBuf = [];
  };

  const flushList = () => {
    if (listBuf.length === 0 || !listType) return;
    blocks.push({ type: listType, items: [...listBuf] });
    listBuf = [];
    listType = null;
  };

  const flushBlockquote = () => {
    if (bqBuf.length === 0) return;
    blocks.push({ type: "blockquote", content: bqBuf.join(" ").trim() });
    bqBuf = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushAll();
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushAll();
      blocks.push({ type: "h3", content: line.slice(4) });
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "h2", content: line.slice(3) });
      continue;
    }
    if (line.startsWith("# ")) {
      flushAll();
      blocks.push({ type: "h1", content: line.slice(2) });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      bqBuf.push(line.slice(2));
      continue;
    }

    // Unordered list (- or *)
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushBlockquote();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(ulMatch[1]);
      continue;
    }

    // Ordered list (1. 2. 3. ...)
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushBlockquote();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(olMatch[1]);
      continue;
    }

    // Plain text — acumular párrafo
    flushList();
    flushBlockquote();
    paragraphBuf.push(line);
  }

  flushAll();
  return blocks;
}

// ──────────────────────────────────────────────────────────────
// Component público
// ──────────────────────────────────────────────────────────────

export function NewsMarkdown({ source }: { source: string }) {
  const blocks = tokenize(source ?? "");
  const headingIds = buildHeadingIds(blocks);
  let headingIndex = 0;

  return (
    <div className="flex flex-col">
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        switch (block.type) {
          case "h1":
            return (
              <h2
                key={key}
                id={headingIds[headingIndex++]}
                className="h-display mt-12 mb-5"
                style={{
                  fontSize: "clamp(26px, 3.2vw, 32px)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                }}
              >
                {inlineFormat(block.content, `${key}-i`)}
              </h2>
            );
          case "h2":
            return (
              <h2
                key={key}
                id={headingIds[headingIndex++]}
                className="text-ink font-extrabold mt-10 mb-4"
                style={{
                  fontSize: "clamp(22px, 2.6vw, 26px)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                {inlineFormat(block.content, `${key}-i`)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={key}
                id={headingIds[headingIndex++]}
                className="text-ink font-bold mt-8 mb-3"
                style={{ fontSize: 20, lineHeight: 1.3 }}
              >
                {inlineFormat(block.content, `${key}-i`)}
              </h3>
            );
          case "p":
            return (
              <p
                key={key}
                className="text-grey-700 mb-5"
                style={{ fontSize: 16, lineHeight: 1.7 }}
              >
                {inlineFormat(block.content, `${key}-i`)}
              </p>
            );
          case "ul":
            return (
              <ul
                key={key}
                className="list-disc list-outside pl-6 mb-5 flex flex-col gap-2"
              >
                {block.items.map((item, j) => (
                  <li
                    key={`${key}-li-${j}`}
                    className="text-grey-700"
                    style={{ fontSize: 16, lineHeight: 1.7 }}
                  >
                    {inlineFormat(item, `${key}-li-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={key}
                className="list-decimal list-outside pl-6 mb-5 flex flex-col gap-2"
              >
                {block.items.map((item, j) => (
                  <li
                    key={`${key}-li-${j}`}
                    className="text-grey-700"
                    style={{ fontSize: 16, lineHeight: 1.7 }}
                  >
                    {inlineFormat(item, `${key}-li-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <blockquote
                key={key}
                className="border-l-4 border-wine pl-5 italic text-grey-700 my-6"
                style={{ fontSize: 16, lineHeight: 1.7 }}
              >
                {inlineFormat(block.content, `${key}-i`)}
              </blockquote>
            );
        }
      })}
    </div>
  );
}

export type NewsHeading = { id: string; text: string; level: 2 | 3 };

function plainHeadingText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`<>]/g, "")
    .trim();
}

function headingSlug(value: string) {
  return plainHeadingText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-VE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "seccion";
}

function buildHeadingIds(blocks: Block[]) {
  const seen = new Map<string, number>();
  return blocks.flatMap((block) => {
      if (block.type !== "h1" && block.type !== "h2" && block.type !== "h3") return [];
      const base = headingSlug(block.content);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return [count === 0 ? base : `${base}-${count + 1}`];
    });
}

export function extractNewsHeadings(source: string): NewsHeading[] {
  const blocks = tokenize(source ?? "");
  const ids = buildHeadingIds(blocks);
  let index = 0;
  return blocks.flatMap((block) => {
    if (block.type !== "h1" && block.type !== "h2" && block.type !== "h3") return [];
    const heading: NewsHeading = {
      id: ids[index++],
      text: plainHeadingText(block.content),
      level: block.type === "h3" ? 3 : 2,
    };
    return [heading];
  });
}
