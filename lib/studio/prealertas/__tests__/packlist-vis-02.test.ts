import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/p/[token]/PackingListFormSection.tsx"),
  "utf8",
);

describe("VIS-02 V3 · packing list formal zh-CN", () => {
  it("declara chino simplificado con el tag regional aprobado", () => {
    expect(source).not.toContain('lang="zh"');
    expect(source.match(/lang="zh-CN"/g)?.length ?? 0).toBeGreaterThan(20);
    expect(source).toContain('lang={zh ? "zh-CN" : undefined}');
  });

  it("mantiene Noto Sans SC en pantalla y controles", () => {
    const printBoundary = source.indexOf("@media print");
    const documentAlias = source.indexOf("font-family: var(--f-cn-document)");

    expect(source).toContain(
      'const BRAND_CJK = "var(--font-archivo), var(--font-noto-sc)"',
    );
    expect(source).toContain(
      ".pl-doc .pl-cell.zh { font-family: var(--font-noto-sc)",
    );
    expect(documentAlias).toBeGreaterThan(printBoundary);
  });

  it("usa el alias documental sólo al imprimir el documento formal", () => {
    expect(source.match(/var\(--f-cn-document\)/g)).toHaveLength(1);
    expect(source).toMatch(
      /@media print \{[\s\S]*?\.pl-doc \[lang="zh-CN"\] \{[\s\S]*?font-family: var\(--f-cn-document\) !important;/,
    );
  });
});
