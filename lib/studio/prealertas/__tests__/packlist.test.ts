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

/**
 * SDD-0468 · Excel reformulado para el proveedor chino. Se prueba el binario
 * publicado (no el script) porque es lo que descarga el proveedor: si alguien
 * edita el script y no regenera, esto lo delata.
 */
describe("template reformulado (SDD-0468)", () => {
  const files = unzipSync(
    new Uint8Array(
      readFileSync(
        join(process.cwd(), "public", "templates", "dtd-packing-list-invoice.xlsx"),
      ),
    ),
  );
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const shared = files["xl/sharedStrings.xml"]
    ? strFromU8(files["xl/sharedStrings.xml"])
    : "";
  const formulaOf = (ref: string) =>
    sheet
      .match(new RegExp(`<c r="${ref}"[^>]*><f>([^<]*)</f>`))?.[1]
      ?.replaceAll("&quot;", '"');

  it("calcula solas las columnas de color, con la regla del formulario web", () => {
    // packlist-form · computeTotals: qty = cajas×uds/caja, total = qty×precio,
    // peso = cajas×kg/caja, CBM = cajas×CBM/caja. Fila vacía → celda vacía.
    for (const r of [12, 27]) {
      expect(formulaOf(`I${r}`)).toBe(`IF(OR(G${r}="",H${r}=""),"",G${r}*H${r})`);
      expect(formulaOf(`K${r}`)).toBe(`IF(OR(I${r}="",J${r}=""),"",I${r}*J${r})`);
      expect(formulaOf(`M${r}`)).toBe(`IF(OR(G${r}="",L${r}=""),"",G${r}*L${r})`);
      expect(formulaOf(`O${r}`)).toBe(`IF(OR(G${r}="",N${r}=""),"",G${r}*N${r})`);
    }
    expect(formulaOf("I28")).toBe("SUM(I12:I27)");
    expect(strFromU8(files["xl/workbook.xml"])).toMatch(/fullCalcOnLoad="1"/);
  });

  it("no invita a escribir encima del Shipping Mark ni trae eslogan comercial", () => {
    expect(shared + sheet).not.toContain("DTD-____");
    expect(shared).not.toContain("puerta a puerta");
  });

  it("dice en chino cómo se llena y deja 5 reglas cortas, chino primero", () => {
    expect(shared).toContain("只填白色格子，带底色的列自动计算。");
    for (const n of [1, 2, 3, 4, 5]) expect(shared).toContain(`${n}. `);
    expect(shared).not.toContain("6. ");
    expect(shared).toMatch(/1\. 每个箱子都要写上方的唛头/);
  });
});
