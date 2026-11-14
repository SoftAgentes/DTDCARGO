// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { zipSync, strToU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { emptyDocumentDraft, computeDocumentTotals } from "@/lib/shared/document-import";
const assisted = vi.hoisted(() => vi.fn());
vi.mock("./anthropic", async (importOriginal) => ({ ...(await importOriginal<typeof import("./anthropic")>()), extractWithAnthropic: assisted }));
import { extractDocument, parseCsv, validateXlsxContainer } from "./extract";
import { exportDocument } from "./export";

const opts = { sourceId: "test-source", fileName: "synthetic.csv", kind: "combined" as const };
const csv = (text: string) => extractDocument(new TextEncoder().encode(text), opts);
async function workbook(rows: unknown[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Synthetic");
  for (const row of rows) ws.addRow(row);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
beforeEach(() => { assisted.mockReset(); assisted.mockResolvedValue(emptyDocumentDraft()); });

describe("S3 native-only and explicit PDF seam", () => {
  it("reads a complete XLSX natively without either assisted provider", async () => {
    const pdf = vi.fn(), bytes = await workbook([["Product", "Cartons", "PCS/CTN", "Gross weight per carton kg", "Net weight per carton kg", "CBM/CTN"], ["Vasos", 2, 10, 12, 10, 0.2]]);
    const result = await extractDocument(bytes, { ...opts, fileName: "fictitious.xlsx" }, { nativeOnly: true, pdf });
    expect(computeDocumentTotals(result)).toMatchObject({ cartons: 2, grossWeightKg: 24, netWeightKg: 20, cbm: 0.4 });
    expect(pdf).not.toHaveBeenCalled(); expect(assisted).not.toHaveBeenCalled();
  });
  it("does not escalate ambiguous multiple sheets to AI in native-only mode", async () => {
    const wb = new ExcelJS.Workbook(); for (const name of ["Invoice", "Packing"]) { const sheet = wb.addWorksheet(name); sheet.addRow(["Product", "Quantity"]); sheet.addRow(["Cup", 10]); }
    await expect(extractDocument(new Uint8Array(await wb.xlsx.writeBuffer()), { ...opts, fileName: "fictitious.xlsx" }, { nativeOnly: true })).rejects.toMatchObject({ code: "native_review_required" });
    expect(assisted).not.toHaveBeenCalled();
  });
  it("uses only the server supplied PDF function and preserves its pending declarations", async () => {
    const draft = emptyDocumentDraft(); draft.transportDeclarations = { battery: null, specialCargo: null };
    const pdf = vi.fn(async () => draft);
    const output = await extractDocument(new TextEncoder().encode("%PDF-synthetic"), { ...opts, fileName: "synthetic.pdf" }, { nativeOnly: true, pdf });
    expect(pdf).toHaveBeenCalledTimes(1); expect(output.transportDeclarations).toEqual({ battery: null, specialCargo: null }); expect(assisted).not.toHaveBeenCalled();
  });
});

describe("S2: lectura de peso neto y autoridad legacy", () => {
  it("lee bruto y neto explícitos por caja sin confundirlos", async () => {
    const d = await csv("Product,Cartons,PCS/CTN,Gross weight per carton kg,Net weight per carton kg,CBM/CTN\nVasos,2,10,12,10,0.2");
    expect(assisted).not.toHaveBeenCalled();
    expect(d.groups[0]).toMatchObject({ cartons: 2, grossWeightKg: 24, netWeightKg: 20, cbm: 0.4 });
    expect(computeDocumentTotals(d)).toMatchObject({ grossWeightKg: 24, netWeightKg: 20 });
  });
  it("un neto solitario nunca se transforma en peso bruto para el flete", async () => {
    const d = await csv("Product,Cartons,PCS/CTN,Net weight kg,CBM\nVasos,1,10,12,0.2");
    expect(d.groups[0]).toMatchObject({ grossWeightKg: null, netWeightKg: 12 });
  });
  it("el DTO asistido antiguo no otorga procedencia ni declaraciones de seguridad", async () => {
    const legacy = emptyDocumentDraft(); legacy.transportDeclarations = { battery: false, specialCargo: false };
    legacy.fieldDecisions = [{ path: "supplier.company", origin: "manual", references: [] }];
    assisted.mockResolvedValue(legacy);
    const d = await extractDocument(new TextEncoder().encode("%PDF-synthetic"), { ...opts, fileName: "synthetic.pdf" });
    expect(d).not.toHaveProperty("fieldDecisions"); expect(d).not.toHaveProperty("transportDeclarations");
  });
});

describe("native document extraction", () => {
  /**
   * Regresiones de proformas REALES de Yiwu. Las fixtures sintéticas nunca las
   * disparaban porque las escribe ExcelJS fila por fila, sin el formato de
   * plantilla que traen los documentos que manda un proveedor de verdad.
   */
  it("lee una proforma cuyo formato declara miles de columnas vacías", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["FOTO", "ITEM", "DESCRIPCIONES", "", "QUANTITY", "PRICE", "TOTAL AMOUNT"]);
    ws.addRow(["", "Drawstring bag", "Single strap", "", 984, 4.46, 4388.64]);
    // El proveedor guarda desde plantilla: 16.382 columnas con ESTILO y ninguna
    // con datos. Medir por `columnCount` rechazaba un documento de 14 celdas.
    for (let c = 8; c <= 16382; c++) ws.getColumn(c).width = 9;
    const d = await extractDocument(new Uint8Array(await wb.xlsx.writeBuffer()), { ...opts, fileName: "pi.xlsx" });
    expect(d.products).toHaveLength(1);
    expect(d.products[0]).toMatchObject({ name: "Drawstring bag", quantity: 984, unitPrice: 4.46 });
    expect(assisted).not.toHaveBeenCalled();
  });
  /**
   * La orden de compra que usan de verdad en Yiwu trae los DOS idiomas en la misma
   * celda del encabezado. La comparación exacta no reconocía ninguna columna, así
   * que el documento entero derivaba a lectura asistida pudiendo leerse gratis.
   *
   * Los encabezados son los de un PO real (`PO-2025-109`); los datos, inventados.
   * Lo que se fija no es «que lea», sino que lea la columna CORRECTA: el archivo
   * trae volumen por caja Y volumen total, y confundirlos publica el número de
   * otra columna sin que nada se vea roto.
   */
  it("lee encabezados bilingües y distingue el total del por-caja", async () => {
    const bytes = await workbook([
      ["Remark", "FOTO 图片", "ITEM.NO 货号", "BAR CODE 条码", "DESCRIPTIONS 品名描述", "中文描述",
        "CTN 箱数", "QTY/CTN 每箱数量", "T.QTY 总数量", "CBM/CTN 体积", "T.CBM 总体积",
        "T.G.W.（KGS） 总重量", "RMB 单价"],
      ["", "", "MQ-4", "4112345678910", "Barber chair", "理发椅", 4, 1, 4, 0.52, 2.08, 96, 1850],
    ]);
    const d = await extractDocument(bytes, { ...opts, fileName: "po.xlsx" });

    expect(assisted).not.toHaveBeenCalled();
    expect(d.products).toHaveLength(1);
    // El código del artículo, no el código de barras: «BAR CODE» contiene «CODE».
    expect(d.products[0]).toMatchObject({ name: "Barber chair", code: "MQ-4", quantity: 4, unitPrice: 1850 });
    expect(d.groups).toHaveLength(1);
    // 2,08 es el TOTAL. 0,52 es por caja: publicarlo acá cotizaría un cuarto del envío.
    expect(d.groups[0]).toMatchObject({ cartons: 4, cbm: 2.08, grossWeightKg: 96 });
  });
  /**
   * El caso anterior no prueba la guarda: ahí `ITEM.NO` viene ANTES que `BAR CODE` y
   * gana por orden, así que quitar la guarda no rompía nada. Acá el código de barras
   * va primero —layout igual de real— y sin la guarda se lleva el campo `code`: el
   * documento saldría con el EAN donde va la referencia del proveedor.
   */
  /**
   * En Yiwu unos proveedores cotizan en RMB y otros en dólares, y muchos lo dicen
   * SÓLO en el encabezado del precio («RMB 单价»), no en una columna de moneda. Sin
   * leerlo, el precio está en pantalla pero el valor de la mercancía no se puede
   * publicar: `computeDocumentTotals` no suma importes sin moneda.
   *
   * La trampa: `美元` (dólar) TERMINA en `元` (yuan). Probar RMB primero convertiría
   * en yuanes todo documento en dólares — el mismo número, la moneda equivocada, y
   * nada roto a la vista.
   */
  it.each([
    ["RMB 单价", "RMB"],
    ["USD 单价", "USD"],
    ["单价 美元", "USD"],
    ["UNIT PRICE (USD)", "USD"],
    ["单价 人民币", "RMB"],
  ])("lee la moneda declarada en el encabezado del precio: %s → %s", async (encabezado, esperada) => {
    const bytes = await workbook([
      ["ITEM.NO 货号", "DESCRIPTIONS 品名描述", "T.QTY 总数量", encabezado],
      ["MQ-4", "Barber chair", 4, 1850],
    ]);
    const d = await extractDocument(bytes, { ...opts, fileName: "po.xlsx" });

    expect(assisted).not.toHaveBeenCalled();
    expect(d.currency).toBe(esperada);
    expect(d.products[0]?.currency).toBe(esperada);
    // Con moneda, el importe SÍ se publica: sin ella quedaría vacío.
    expect(computeDocumentTotals(d).amounts).toEqual({ [esperada]: 7400 });
  });
  it("no elige por el cliente cuando las columnas de precio declaran monedas distintas", async () => {
    const bytes = await workbook([
      ["ITEM.NO 货号", "DESCRIPTIONS 品名描述", "T.QTY 总数量", "RMB 单价", "TOTAL USD 总价"],
      ["MQ-4", "Barber chair", 4, 1850, 1040],
    ]);
    const d = await extractDocument(bytes, { ...opts, fileName: "po.xlsx" });

    expect(d.currency).toBeNull();
    expect(d.issues.map((i) => i.code)).toContain("currency_ambiguous");
  });
  it("un `$` suelto no alcanza: puede ser USD, HKD o SGD", async () => {
    const bytes = await workbook([
      ["ITEM.NO 货号", "DESCRIPTIONS 品名描述", "T.QTY 总数量", "$ 单价"],
      ["MQ-4", "Barber chair", 4, 1850],
    ]);
    const d = await extractDocument(bytes, { ...opts, fileName: "po.xlsx" });

    expect(d.currency).toBeNull();
  });
  it("nunca toma el código de barras como código del artículo, venga en la columna que venga", async () => {
    const bytes = await workbook([
      ["BAR CODE 条码", "ITEM.NO 货号", "DESCRIPTIONS 品名描述", "T.QTY 总数量", "RMB 单价"],
      ["4112345678910", "MQ-4", "Barber chair", 4, 1850],
    ]);
    const d = await extractDocument(bytes, { ...opts, fileName: "po.xlsx" });

    expect(assisted).not.toHaveBeenCalled();
    expect(d.products[0]?.code).toBe("MQ-4");
    expect(d.products[0]?.code).not.toBe("4112345678910");
  });
  it("no toma la comisión como importe declarado del documento", async () => {
    // Las proformas de Yiwu ponen COMMISSION arriba de TOTAL AMMOUNT, ambas con
    // su número a la derecha. Quedarse con la primera etiqueta que se parece a un
    // total mete un importe FALSO, que es peor que no tener ninguno.
    const d = await csv(
      [
        "ITEM,QUANTITY,PRICE,TOTAL AMOUNT",
        "Drawstring bag,984,4.46,4388.64",
        ",,,9879.36",
        "TOTAL PRICE,,COMMISSION,493.968",
        "TOTAL PRICE,,TOTAL AMMOUNT,10373.328",
      ].join(String.fromCharCode(10)),
    );
    expect(d.declaredTotals.amount).not.toBe(493.968);
    expect(d.declaredTotals.amount === null || d.declaredTotals.amount === 10373.328).toBe(true);
  });

  it("parses quoted CSV with embedded newlines, commas and escaped quotes", () => {
    expect(parseCsv('Name,Qty\r\n"Shirt, \"\"blue\"\"\nlarge",10\r\n')).toEqual([["Name", "Qty"], ['Shirt, "blue"\nlarge', "10"]]);
    expect(parseCsv("Name;Qty\nA;2")).toEqual([["Name", "Qty"], ["A", "2"]]);
    expect(() => parseCsv('Name,Qty\n"oops,3')).toThrow();
  });
  it("recognizes a standard table and keeps source cell references", async () => {
    const d = await csv("Product,Code,Cartons,PCS/CTN,Unit price,Currency,G.W.(KG),CBM\nShirt,S1,10,5,2,USD,200,1.5");
    expect(d.products[0]).toMatchObject({ name: "Shirt", code: "S1", quantity: 50, unitPrice: 2, currency: "USD", unit: "pcs" });
    expect(computeDocumentTotals(d)).toMatchObject({ cartons: 10, grossWeightKg: 200, cbm: 1.5, amounts: { USD: 100 } });
    expect(d.sources[0].locations).toContainEqual({ path: "products.test-source-p1.unitPrice", sheet: "CSV", cell: "E2", page: null });
    expect(assisted).not.toHaveBeenCalled();
  });
  it("keeps a generic Qty unit unknown instead of inventing pieces", async () => {
    const d = await csv("Product,Qty,Price,Currency\nLiquid,2,10,USD");
    expect(d.products[0].unit).toBe("");
  });
  it("keeps net weight distinct from gross, including Chinese labels", async () => {
    const d = await csv("品名,数量,箱数,单价,币种,净重(KG),CBM\n杯子,5,1,2,USD,8,0.1");
    expect(d.groups[0].grossWeightKg).toBeNull();
    const gross = await csv("品名,数量,箱数,单价,币种,毛重(KG),CBM\n杯子,5,1,2,USD,10,0.1");
    expect(gross.groups[0].grossWeightKg).toBe(10);
  });
  it("does not divide grand totals across unspecified carton composition", async () => {
    const d = await csv("Product,Qty,Cartons,Unit price,Currency,G.W.(KG),CBM\nParts,50,10,2,USD,200,1.5");
    expect(d.groups).toEqual([]);
    expect(d.declaredTotals).toMatchObject({ cartons: 10, grossWeightKg: 200, cbm: 1.5 });
    expect(d.issues.some((i) => i.code === "packing_pattern_unknown")).toBe(true);
  });
  it("retains single-product gross/CBM totals even when carton count is missing", async () => {
    const d = await csv("Product,Qty,G.W.(KG),CBM\nA,50,200,1.5");
    expect(d.groups).toHaveLength(0);
    expect(d.declaredTotals).toMatchObject({ cartons: null, grossWeightKg: 200, cbm: 1.5 });
  });
  it("does not mistake the first of multiple unallocated rows for a grand total", async () => {
    await csv("Product,Qty,Cartons,G.W.(KG),CBM\nA,50,10,200,1.5\nB,20,5,100,0.5");
    expect(assisted).toHaveBeenCalledOnce();
  });
  it("calculates CBM only from dimensions explicitly marked cm", async () => {
    const d = await csv("Product,Cartons,PCS/CTN,Length(cm),Width(cm),Height(cm)\nA,2,10,50,40,30");
    expect(d.groups[0].cbm).toBeCloseTo(0.12);
    const unknown = await csv("Product,Cartons,PCS/CTN,Length,Width,Height\nA,2,10,50,40,30");
    expect(unknown.groups[0].cbm).toBeNull();
  });
  it("blocks disagreement between quantities and logistical per-carton/total values", async () => {
    const d = await csv("Product,Cartons,PCS/CTN,Qty,kg/caja,G.W.(KG),CBM/caja,CBM\nA,2,10,25,5,15,0.1,0.5");
    expect(d.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["quantity_conflict", "weight_conflict", "cbm_conflict"]));
    expect(d.sources[0].locations.filter((l) => l.path.endsWith("grossWeightKg")).map((l) => l.cell)).toEqual(expect.arrayContaining(["E2", "F2", "B2"]));
  });
  it("does not double-count repeated carton IDs and requests composition review", async () => {
    const d = await csv("Product,Carton no,Cartons,Qty,G.W.(KG),CBM\nA,1,1,5,10,0.1\nB,1,1,3,10,0.1");
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0].items).toHaveLength(2);
    expect(computeDocumentTotals(d).grossWeightKg).toBe(10);
    expect(d.issues.some((i) => i.code === "repeated_carton_label" && i.blocking)).toBe(true);
  });
  it("does not evaluate formula text or guess ambiguous numeric punctuation", async () => {
    const d = await csv('Product,Qty,Unit price,Currency\nA,=2+3,"1,234",$');
    expect(d.products[0]).toMatchObject({ quantity: null, unitPrice: null, currency: null });
    expect(d.issues.map((i) => i.code)).toContain("number_ambiguous");
  });
  it("does not emit partial amounts when a second product table follows Total", async () => {
    await csv("Product,Qty,Unit price\nA,5,2\nTotal,5,10\nProduct,Qty,Unit price\nB,6,3");
    expect(assisted).toHaveBeenCalledOnce();
    expect(JSON.stringify(assisted.mock.calls[0][0])).toContain('"B"');
  });
  it("keeps freight outside product lines and flags the discrepancy", async () => {
    const d = await csv("Product,Qty,Unit price\nA,5,2\nFreight,1,20");
    expect(d.products).toHaveLength(1);
    expect(d.issues.some((i) => i.code === "non_product_charge")).toBe(true);
  });
  it("XLSX formulas use cached results only and flag missing caches", async () => {
    const bytes = await workbook([["Product", "Qty", "Unit price", "Currency"], ["A", { formula: "1+1" }, { formula: "2+3", result: 5 }, "USD"]]);
    const d = await extractDocument(bytes, { ...opts, fileName: "synthetic.xlsx" });
    expect(d.products[0]).toMatchObject({ quantity: null, unitPrice: 5 });
    expect(d.issues.some((i) => i.code === "formula_unavailable")).toBe(true);
  });
  it("imports the real DTD template map and mixed cartons using explicit inputs", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await readFile("public/templates/dtd-packing-list-invoice.xlsx") as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    ws.getCell("C5").value = "Synthetic supplier"; ws.getCell("C8").value = "synthetic-contact";
    for (const [cell, value] of Object.entries({ B12: "A1", D12: "Shirt", F12: "1-10", G12: 10, H12: 10, J12: 2, L12: 20, N12: 0.15, B13: "A2", D13: "Trousers", H13: 50, J13: 3 })) ws.getCell(cell).value = value;
    const d = await extractDocument(new Uint8Array(await wb.xlsx.writeBuffer()), { ...opts, fileName: "dtd.xlsx" });
    expect(assisted).not.toHaveBeenCalled();
    expect(d.supplier.company).toBe("Synthetic supplier");
    expect(d.groups).toHaveLength(1);
    expect(computeDocumentTotals(d)).toMatchObject({ cartons: 10, grossWeightKg: 200, cbm: 1.5, quantity: 150, amounts: { USD: 350 } });
    expect(d.issues).toEqual([]);
  });
  it("unknown layouts and overlapping sheets go to the bounded assisted reader", async () => {
    await csv("Mystery,Other\nA,1"); expect(assisted).toHaveBeenCalledOnce();
    const wb = new ExcelJS.Workbook(); for (const title of ["Invoice", "Packing"]) { const ws = wb.addWorksheet(title); ws.addRows([["Product", "Qty"], ["A", 3]]); }
    await extractDocument(new Uint8Array(await wb.xlsx.writeBuffer()), { ...opts, fileName: "multi.xlsx" });
    expect(assisted).toHaveBeenCalledTimes(2);
  });
  it("round-trips the new complete DTD export, mixed boxes and repeated products", async () => {
    const draft = emptyDocumentDraft(); draft.currency = "USD"; draft.supplier.company = "Synthetic company"; draft.supplier.wechat = "synthetic-contact";
    draft.products = [
      { id: "p1", name: "Shirt", nameZh: "衬衫", code: "A1", brand: "Synthetic brand", material: "Cotton", quantity: 35, unitPrice: 2, currency: "USD", unit: "pcs" },
      { id: "p2", name: "Trousers", nameZh: "", code: "A2", brand: "", material: "", quantity: 5, unitPrice: 3, currency: "USD", unit: "pcs" },
    ];
    draft.groups = [
      { id: "g1", label: "1-2", cartons: 2, grossWeightKg: 20, cbm: 0.3, items: [{ productId: "p1", quantity: 20 }, { productId: "p2", quantity: 5 }] },
      { id: "g2", label: "3", cartons: 1, grossWeightKg: 8, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }] },
    ];
    const bytes = await exportDocument(draft, { markbox: "DTD-TEST", code: "TEST-001", confirmed: false, revision: 1 });
    const read = await extractDocument(bytes, { ...opts, fileName: "export.xlsx" });
    expect(assisted).not.toHaveBeenCalled(); expect(read.products).toHaveLength(2); expect(read.groups).toHaveLength(2);
    expect(computeDocumentTotals(read)).toEqual(computeDocumentTotals(draft));
    expect(read.supplier).toEqual(draft.supplier);
    expect(read.products[0]).toMatchObject({ quantity: 35, brand: "Synthetic brand", material: "Cotton" });
    expect(read.issues).toEqual([]);
  });
  /**
   * El lector reconoce el cajón de sobrantes por su ETIQUETA («Sin asignar»), no por
   * identidad. Un proveedor que bautiza así un grupo REAL chocaba con el centinela y
   * perdía sus cajas enteras.
   *
   * La exportación ya lo esquiva entrecomillando la etiqueta que choca, pero eso sólo
   * cierra media vuelta: sin desentrecomillar al leer, el round-trip devuelve el grupo
   * con guillemets pegados y la etiqueta deja de ser la que el proveedor escribió.
   */
  it("round-trips a group the supplier actually named «Sin asignar», label and cartons intact", async () => {
    const draft = emptyDocumentDraft(); draft.currency = "USD"; draft.supplier.company = "Yiwu"; draft.supplier.wechat = "wx";
    draft.products = [{ id: "p1", name: "Cups", nameZh: "杯子", code: "C1", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD", unit: "pcs" }];
    draft.groups = [{ id: "g1", label: "Sin asignar", cartons: 5, grossWeightKg: 15, cbm: 2.5, items: [{ productId: "p1", quantity: 50 }] }];

    const bytes = await exportDocument(draft, { markbox: "DTD-TEST", code: "TEST-002", confirmed: false, revision: 1 });
    const read = await extractDocument(bytes, { ...opts, fileName: "export.xlsx" });

    expect(assisted).not.toHaveBeenCalled();
    expect(read.groups).toHaveLength(1);
    expect(read.groups[0]).toMatchObject({ label: "Sin asignar", cartons: 5, grossWeightKg: 15, cbm: 2.5 });
    expect(computeDocumentTotals(read)).toEqual(computeDocumentTotals(draft));
  });
  it("rejects old XLS, invalid PDF, invalid ZIP and oversized files", async () => {
    await expect(extractDocument(new Uint8Array([1]), { ...opts, fileName: "old.xls" })).rejects.toMatchObject({ code: "legacy_xls" });
    await expect(extractDocument(new Uint8Array([1]), { ...opts, fileName: "bad.pdf" })).rejects.toMatchObject({ code: "invalid_pdf" });
    expect(() => validateXlsxContainer(new Uint8Array([1, 2]))).toThrow();
    await expect(extractDocument(new Uint8Array(15 * 1024 * 1024 + 1), opts)).rejects.toMatchObject({ code: "file_size" });
  });
  it("rejects declared and forged expansion bombs before ExcelJS", () => {
    const zipped = zipSync({ "[Content_Types].xml": strToU8("types"), "xl/workbook.xml": new Uint8Array(21 * 1024 * 1024) });
    expect(() => validateXlsxContainer(zipped)).toThrow();
    const forged = zipped.slice(); const view = new DataView(forged.buffer);
    for (let i = 0; i < forged.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 10, true);
    expect(() => validateXlsxContainer(forged)).toThrow();
  });
  it("rejects macro/external link containers", () => {
    const zipped = zipSync({ "[Content_Types].xml": strToU8("types"), "xl/workbook.xml": strToU8("book"), "xl/externalLinks/externalLink1.xml": strToU8("remote") });
    expect(() => validateXlsxContainer(zipped)).toThrow(/vínculos externos/);
  });
});
