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
import { computeTotals } from "../packlist-form";
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

  it("calcula solas las columnas de color; 件数 vacío = otro producto de la misma caja", () => {
    for (const r of [12, 27]) {
      expect(formulaOf(`I${r}`)).toBe(`IF(H${r}="","",IF(G${r}="",H${r},G${r}*H${r}))`);
      expect(formulaOf(`K${r}`)).toBe(`IF(OR(I${r}="",J${r}=""),"",I${r}*J${r})`);
      expect(formulaOf(`M${r}`)).toBe(`IF(OR(G${r}="",L${r}=""),"",G${r}*L${r})`);
      expect(formulaOf(`O${r}`)).toBe(`IF(OR(G${r}="",N${r}=""),"",G${r}*N${r})`);
    }
    expect(formulaOf("I28")).toBe("SUM(I12:I27)");
    expect(strFromU8(files["xl/workbook.xml"])).toMatch(/fullCalcOnLoad="1"/);
  });

  it("con una caja mixta (Caja Padre), los totales del Excel coinciden con computeTotals", () => {
    // Disposición infeliz a propósito: una caja normal de 2 cartones y una caja
    // mixta con 3 productos (1 líder + 2 filas `same` con 件数 vacío). La hoja
    // se evalúa con las fórmulas PUBLICADAS, no con una copia de la regla.
    const hoja = evaluarHoja(formulaOf, {
      G12: 2, H12: 10, J12: 1.5, L12: 8, N12: 0.05,
      G13: 1, H13: 20, J13: 2, L13: 12, N13: 0.08,
      H14: 5, J14: 3,
      H15: 7, J15: 1,
    });
    const { totals } = computeTotals([
      { zh: "A", ctns: 2, perctn: 10, unit: 1.5, wkg: 8, cbm: 0.05 },
      { zh: "B", ctns: 1, perctn: 20, unit: 2, wkg: 12, cbm: 0.08 },
      { zh: "C", same: true, qtyDirect: 5, unit: 3 },
      { zh: "D", same: true, qtyDirect: 7, unit: 1 },
    ]);

    expect(totals.qty).toBe(52); // ancla: el fixture sí ejerce la caja mixta
    expect(hoja.G28).toBeCloseTo(totals.ctns, 6);
    expect(hoja.I28).toBeCloseTo(totals.qty, 6);
    expect(hoja.K28).toBeCloseTo(totals.amount, 6);
    expect(hoja.M28).toBeCloseTo(totals.weight, 6);
    expect(hoja.O28).toBeCloseTo(totals.cbm, 6);
    // Las filas hijas no aportan peso ni volumen.
    expect(hoja.M14).toBe("");
    expect(hoja.O15).toBe("");
  });

  it("no invita a escribir encima del Shipping Mark ni trae eslogan comercial", () => {
    expect(shared + sheet).not.toContain("DTD-____");
    expect(shared).not.toContain("puerta a puerta");
  });

  it("no protege la hoja: la caja mixta no depende de escribir encima de una fórmula", () => {
    expect(sheet).not.toMatch(/<sheetProtection/);
  });

  it("dice en chino cómo se llena y deja 6 reglas cortas, chino primero", () => {
    expect(shared).toContain("只填白色格子，带底色的列自动计算（一箱多种货见第 2 条）。");
    for (const n of [1, 2, 3, 4, 5, 6]) expect(shared).toContain(`${n}. `);
    expect(shared).not.toContain("7. ");
    expect(shared).toMatch(/1\. 每个箱子都要写上方的唛头/);
    expect(shared).toMatch(/2\. 一箱装多种货：第一行填件数/);
  });
});

type Valor = number | "";

/**
 * Evalúa las fórmulas del template (solo IF, OR, comparación con "", producto
 * y SUM de rango: la gramática que usa el script) sobre una hoja en memoria.
 * Recorre las filas 12-27 en el orden de dependencia (I antes que K) y luego
 * los totales de la fila 28.
 */
function evaluarHoja(
  formulaOf: (ref: string) => string | undefined,
  entradas: Record<string, number>,
): Record<string, Valor> {
  const celdas: Record<string, Valor> = { ...entradas };
  const leer = (ref: string): Valor => celdas[ref] ?? "";
  const si = (cond: unknown, a: Valor, b: Valor) => (cond ? a : b);
  const alguno = (...xs: unknown[]) => xs.some(Boolean);
  const sumar = (col: string, desde: number, hasta: number) => {
    let s = 0;
    for (let r = desde; r <= hasta; r++) {
      const v = leer(`${col}${r}`);
      if (typeof v === "number") s += v;
    }
    return s;
  };
  const evaluar = (ref: string) => {
    const f = formulaOf(ref);
    if (!f) throw new Error(`sin fórmula en ${ref}`);
    const js = f
      .replace(/SUM\(([A-O])(\d+):[A-O](\d+)\)/g, '__sum("$1",$2,$3)')
      .replace(/IF\(/g, "__if(")
      .replace(/OR\(/g, "__or(")
      .replace(/([A-O]\d+)=""/g, '__g("$1")===""')
      .replace(/(?<!")\b([A-O]\d+)\b/g, '__g("$1")');
    celdas[ref] = new Function("__if", "__or", "__sum", "__g", `return (${js});`)(
      si,
      alguno,
      sumar,
      leer,
    ) as Valor;
  };
  for (let r = 12; r <= 27; r++) for (const col of ["I", "K", "M", "O"]) evaluar(`${col}${r}`);
  for (const col of ["G", "I", "K", "M", "O"]) evaluar(`${col}28`);
  return celdas;
}
