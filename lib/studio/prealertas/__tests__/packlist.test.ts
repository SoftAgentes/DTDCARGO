/**
 * Tests del pre-llenado del packing list (SDD-0057 ext · Fase 3, mapa de celdas
 * actualizado al template branded de SDD-0096).
 *  - setInlineCell: reemplaza celda auto-cerrada y celda con sharedString,
 *    preserva el estilo, escapa XML, ignora vacío / ref inexistente.
 *  - fillPacklist: contra el template REAL branded (public/templates) — inyecta
 *    los 5 valores (proveedor C5, markbox C6, cliente C7, wechat C8, folio I3)
 *    como inlineStr y el .xlsx sigue siendo un zip válido.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { setInlineCell, fillPacklist } from "../packlist";

describe("setInlineCell", () => {
  it("reemplaza una celda auto-cerrada preservando el estilo", () => {
    const xml = `<row><c r="C7" s="40"/></row>`;
    const out = setInlineCell(xml, "C7", "DTD-9000");
    expect(out).toBe(
      `<row><c r="C7" s="40" t="inlineStr"><is><t xml:space="preserve">DTD-9000</t></is></c></row>`,
    );
  });

  it("reemplaza una celda con sharedString preservando el estilo", () => {
    const xml = `<c r="C6" s="20" t="s"><v>5</v></c>`;
    const out = setInlineCell(xml, "C6", "ACME Trading");
    expect(out).toBe(
      `<c r="C6" s="20" t="inlineStr"><is><t xml:space="preserve">ACME Trading</t></is></c>`,
    );
  });

  it("escapa caracteres XML del valor", () => {
    const xml = `<c r="C8" s="20" t="s"><v>5</v></c>`;
    const out = setInlineCell(xml, "C8", "Juan & <Co>");
    expect(out).toContain("Juan &amp; &lt;Co&gt;");
  });

  it("valor vacío borra el contenido anterior", () => {
    const xml = `<c r="C10" s="24" t="s"><v>5</v></c>`;
    expect(setInlineCell(xml, "C10", "   ")).not.toContain("<v>5</v>");
  });

  it("ref inexistente → XML sin cambios", () => {
    const xml = `<c r="C7" s="40"/>`;
    expect(setInlineCell(xml, "Z99", "x")).toBe(xml);
  });
});

describe("fillPacklist (template real)", () => {
  const templatePath = join(
    process.cwd(),
    "public",
    "templates",
    "dtd-packing-list-invoice.xlsx",
  );

  it("inyecta MARKBOX y código en el sheet como inlineStr", () => {
    const bytes = new Uint8Array(readFileSync(templatePath));
    const out = fillPacklist(bytes, {
      markbox: "DTD-9000",
      clientName: "Cliente Demo",
      supplierName: "Proveedor Demo",
      supplierWechat: "wxid_demo",
      code: "DTD-9000-1-1",
    });

    expect(out.byteLength).toBeGreaterThan(0);

    const files = unzipSync(out);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain("DTD-9000"); // 唛头 (C6)
    expect(sheet).toContain("DTD-9000-1-1"); // folio (I3)
    expect(sheet).not.toContain("Cliente Demo"); // 客户 (C7)
    expect(sheet).toContain("Proveedor Demo"); // 公司名称 (C5)
    expect(sheet).toContain("wxid_demo"); // 微信 (C8)
  });

  it("escribe los valores en las celdas exactas del template branded", () => {
    const bytes = new Uint8Array(readFileSync(templatePath));
    const out = fillPacklist(bytes, {
      markbox: "DTD-1234",
      clientName: "Acme Cliente",
      supplierName: "Yiwu Proveedor",
      supplierWechat: "wxid_abc",
      code: "DTD-1234-2-3",
    });
    const files = unzipSync(out);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    // Cada valor cae en su ref como inlineStr (no como sharedString).
    const cellHas = (ref: string, val: string) =>
      new RegExp(
        `<c r="${ref}"[^>]*t="inlineStr"><is><t[^>]*>${val}</t></is></c>`,
      ).test(sheet);
    expect(cellHas("C5", "Yiwu Proveedor")).toBe(true);
    expect(cellHas("C6", "DTD-1234")).toBe(true);
    expect(cellHas("C7", "DTD-1234-2-3")).toBe(true);
    expect(sheet).not.toContain("Acme Cliente");
    expect(cellHas("C8", "wxid_abc")).toBe(true);
    expect(cellHas("I3", "DTD-1234-2-3")).toBe(true);
  });
});
