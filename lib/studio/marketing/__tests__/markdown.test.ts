/**
 * SDD-0158 — Tests del renderizador markdown del lector de docs de Marketing.
 * Cubre lo que usan los docs reales: encabezados, tablas GFM, listas + task
 * items, código, citas, enlaces (internos → data-doc · externos · muertos) y el
 * escape de HTML.
 */
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/studio/marketing/markdown";

const bundled = new Set(["ventas.md", "adquisicion.md"]);

describe("renderMarkdown", () => {
  it("encabezados por nivel", () => {
    expect(renderMarkdown("# Uno")).toBe("<h1>Uno</h1>");
    expect(renderMarkdown("### Tres")).toBe("<h3>Tres</h3>");
  });

  it("negrita, itálica, tachado y código inline", () => {
    const h = renderMarkdown("Un **bold**, un *it* y `cod` y ~~old~~.");
    expect(h).toContain("<strong>bold</strong>");
    expect(h).toContain("<em>it</em>");
    expect(h).toContain("<code>cod</code>");
    expect(h).toContain("<del>old</del>");
  });

  it("tabla GFM → thead + tbody con celdas", () => {
    const src = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const h = renderMarkdown(src);
    expect(h).toContain("<table>");
    expect(h).toContain("<th>A</th>");
    expect(h).toContain("<td>1</td>");
    expect(h).toContain("<td>4</td>");
    expect(h).toContain('class="mdoc-tablewrap"');
  });

  it("lista desordenada + task items", () => {
    const h = renderMarkdown("- uno\n- [ ] pendiente\n- [x] hecho");
    expect(h).toContain("<ul><li>uno</li>");
    expect(h).toContain("☐");
    expect(h).toContain("☑");
  });

  it("lista ordenada", () => {
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("enlace interno a doc del bundle → data-doc; externo → target _blank; muerto → mdoc-dead", () => {
    const h = renderMarkdown(
      "Ver [ventas](ventas.md), [Google](https://google.com) y [runbook](../runbooks/x.md).",
      bundled,
    );
    expect(h).toContain('<a class="mdoc-link" data-doc="ventas.md">ventas</a>');
    expect(h).toContain('href="https://google.com" target="_blank"');
    expect(h).toContain('class="mdoc-dead"');
  });

  it("ancla en enlace interno se ignora para el match", () => {
    const h = renderMarkdown("[x](adquisicion.md#seccion-10)", bundled);
    expect(h).toContain('data-doc="adquisicion.md"');
  });

  it("bloque de código conserva el texto crudo escapado", () => {
    const h = renderMarkdown("```\nconst x = a < b && c > d;\n```");
    expect(h).toContain("<pre><code>const x = a &lt; b &amp;&amp; c &gt; d;</code></pre>");
  });

  it("cita (blockquote) se renderiza recursivamente", () => {
    const h = renderMarkdown("> **Nota:** algo");
    expect(h).toContain("<blockquote>");
    expect(h).toContain("<strong>Nota:</strong>");
  });

  it("escapa HTML del texto (sin inyección)", () => {
    const h = renderMarkdown("Texto con <script>alert(1)</script> y <Image>.");
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("&lt;Image&gt;");
  });

  it("hr", () => {
    expect(renderMarkdown("---")).toBe("<hr>");
  });
});
