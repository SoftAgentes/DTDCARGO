// @vitest-environment node
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { unzipSync } from "fflate";
import { computeDocumentTotals, confirmationIssues, emptyDocumentDraft, type DocumentDraft, type DocumentProduct } from "@/lib/shared/document-import";
import { exportDocument } from "./export";
import { extractDocument } from "./extract";

/**
 * SDD-0473 · Contrato del Excel que descargan el cliente y el proveedor.
 *
 * Este archivo sale del Studio y termina abierto en la máquina de un tercero,
 * así que la suite fija cuatro cosas que no se pueden romper:
 *
 * 1. SEGURIDAD: el libro sólo lleva valores literales. Un nombre de producto
 *    que empiece con «=», «+», «-» o «@» viaja como texto; nunca como fórmula
 *    ni como hipervínculo (inyección de fórmulas / DDE en Excel).
 * 2. NUNCA INVENTAR: lo que falta en el borrador sale vacío. Ni cantidad 0, ni
 *    unidad «pcs» de regalo, ni una moneda adivinada, ni un valor de mercancía
 *    parcial que el proveedor pueda leer como el total del embarque.
 * 3. UNA SOLA VEZ: cajas, peso bruto y CBM son del GRUPO. Se escriben en la
 *    primera fila del grupo y el pie los cuenta una vez — repetirlos por
 *    producto multiplica el flete, que se cobra por peso y volumen.
 * 4. IDA Y VUELTA: lo que escribe `exportDocument` lo vuelve a leer
 *    `extractDocument` con los mismos números, con estilos y con huecos.
 *
 * Los `it.fails` marcan defectos reales encontrados escribiendo la suite: el
 * cuerpo enuncia la regla que el módulo TODAVÍA no cumple. Si alguien arregla
 * el módulo, el `it.fails` se pone rojo y hay que convertirlo en `it`.
 */

const ctx = { markbox: "DTD-TEST", code: "TEST-001", confirmed: false, revision: 1 };
const opts = { sourceId: "export-test", fileName: "export.xlsx", kind: "combined" as const };
const HEADER_ROW = 9;

const product = (over: Partial<DocumentProduct> & { id: string }): DocumentProduct =>
  ({ name: "", nameZh: "", code: "", brand: "", material: "", quantity: null, unitPrice: null, currency: null, unit: "pcs", ...over });
const draftOf = (over: Partial<DocumentDraft>): DocumentDraft => ({ ...emptyDocumentDraft(), currency: "USD", ...over });

async function openExport(draft: DocumentDraft, context = ctx) {
  const bytes = await exportDocument(draft, context);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return { bytes, ws: wb.worksheets[0] };
}
const isTotals = (ws: ExcelJS.Worksheet, n: number) => /^总计/.test(String(ws.getCell(n, 1).value ?? ""));
/** Filas de producto: entre el encabezado y el pie de totales. */
function dataRows(ws: ExcelJS.Worksheet): ExcelJS.Row[] {
  const rows: ExcelJS.Row[] = [];
  for (let n = HEADER_ROW + 1; n <= ws.rowCount && !isTotals(ws, n); n++) rows.push(ws.getRow(n));
  return rows;
}
function totalsRow(ws: ExcelJS.Worksheet): ExcelJS.Row {
  for (let n = HEADER_ROW + 1; n <= ws.rowCount; n++) if (isTotals(ws, n)) return ws.getRow(n);
  throw new Error("El export no escribió el pie de totales");
}
/** Filas «货值 / Mercancía»: valor declarado por moneda, ordenadas para comparar. */
function merchandise(ws: ExcelJS.Worksheet): [string, unknown][] {
  const found: [string, unknown][] = [];
  for (let n = 1; n <= ws.rowCount; n++) if (/^货值/.test(String(ws.getCell(n, 1).value ?? ""))) found.push([String(ws.getCell(n, 2).value), ws.getCell(n, 3).value]);
  return found.sort((a, b) => a[0].localeCompare(b[0]));
}
const column = (rows: ExcelJS.Row[], index: number) => rows.map((r) => r.getCell(index).value);
const addUp = (rows: ExcelJS.Row[], index: number) => Number(column(rows, index).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0).toFixed(4));

describe("Excel de packing list + factura que entregamos al cliente y al proveedor", () => {
  it("escribe los textos del documento como valores literales, aunque parezcan fórmulas", async () => {
    // Un proveedor chino que llama a su producto «=1+1», o un shipping mark
    // pegado desde otro sistema, no puede convertirse en algo que Excel ejecute
    // al abrir el archivo en la máquina del cliente.
    const payloads: Record<string, string> = {
      B3: "=cmd|' /c calc'!A1",
      B4: '=HYPERLINK("http://malicioso.example","Haz clic")',
      A10: "=1+1",
      B10: "=SUM(1,1)",
      C10: "@SUM(A1)",
      D10: "-2+3",
      M10: "+A1",
    };
    const draft = draftOf({
      supplier: { ...emptyDocumentDraft().supplier, company: payloads.B4 },
      products: [product({ id: "p1", name: payloads.B10, nameZh: payloads.C10, code: payloads.D10, brand: payloads.M10, quantity: 2, unitPrice: 1, currency: "USD" })],
      groups: [{ id: "g1", label: payloads.A10, cartons: 1, grossWeightKg: 1, cbm: 0.1, items: [{ productId: "p1", quantity: 2 }] }],
    });
    const { bytes, ws } = await openExport(draft, { ...ctx, markbox: payloads.B3 });

    for (const [ref, payload] of Object.entries(payloads)) {
      const cell = ws.getCell(ref);
      expect(cell.value, ref).toBe(payload);
      expect(cell.type, ref).toBe(ExcelJS.ValueType.String);
      expect(cell.formula, ref).toBeUndefined();
      expect(cell.hyperlink, ref).toBeUndefined();
    }
    ws.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (cell) => {
      expect([ExcelJS.ValueType.Formula, ExcelJS.ValueType.Hyperlink], cell.address).not.toContain(cell.type);
    }));
    // Prueba independiente de ExcelJS: el XML del libro no tiene <f> (fórmula),
    // ni hipervínculos, ni partes de macro o vínculo externo.
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).some((name) => /vbaProject|externalLink/i.test(name))).toBe(false);
    for (const [name, content] of Object.entries(entries)) {
      if (!/^xl\/worksheets\/.*\.xml$/.test(name)) continue;
      const xml = new TextDecoder().decode(content);
      expect(xml, name).not.toMatch(/<f[\s>/]/);
      expect(xml, name).not.toMatch(/<hyperlink/);
    }
    // Y al releerlo, el nombre sigue siendo el texto, no su resultado.
    expect((await extractDocument(bytes, opts)).products[0].name).toBe(payloads.B10);
  });

  it("cuenta las cajas, el peso y el CBM del grupo una sola vez, no una por producto", async () => {
    // Caso canónico: 2 productos metidos en las MISMAS 5 cajas son 5 cajas y
    // 40 kg. Repetirlos por fila declararía 10 cajas y 80 kg de flete.
    const draft = draftOf({
      products: [
        product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 1, currency: "USD" }),
        product({ id: "p2", name: "Gorra", quantity: 5, unitPrice: 2, currency: "USD" }),
      ],
      groups: [{ id: "g1", label: "1-5", cartons: 5, grossWeightKg: 40, cbm: 0.5, items: [{ productId: "p1", quantity: 10 }, { productId: "p2", quantity: 5 }] }],
    });
    const { bytes, ws } = await openExport(draft);
    const rows = dataRows(ws);

    expect(rows).toHaveLength(2);
    expect([column(rows, 5), column(rows, 10), column(rows, 11)]).toEqual([[5, null], [40, null], [0.5, null]]);
    expect([totalsRow(ws).getCell(5).value, totalsRow(ws).getCell(10).value, totalsRow(ws).getCell(11).value]).toEqual([5, 40, 0.5]);

    const read = await extractDocument(bytes, opts);
    expect(read.groups).toHaveLength(1);
    expect(read.groups[0]).toMatchObject({ cartons: 5, grossWeightKg: 40, cbm: 0.5 });
    expect(read.groups[0].items.map((i) => i.quantity)).toEqual([10, 5]);
    expect(computeDocumentTotals(read)).toMatchObject({ cartons: 5, grossWeightKg: 40, cbm: 0.5, quantity: 15 });
  });

  it("manda los productos sin caja a «Sin asignar» sin inventarles cajas ni peso", async () => {
    // Una camiseta con 10 unidades de las que sólo 4 están en cajas, y una gorra
    // que no está en ninguna. Ninguna de las dos puede desaparecer del Excel, y
    // ninguna puede estrenar cajas, peso o CBM que nadie midió.
    const draft = draftOf({
      products: [
        product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 2, currency: "USD" }),
        product({ id: "p2", name: "Gorra", quantity: 3, unitPrice: 5, currency: "USD" }),
      ],
      groups: [{ id: "g1", label: "1-2", cartons: 2, grossWeightKg: 4, cbm: 0.2, items: [{ productId: "p1", quantity: 4 }] }],
    });
    const { bytes, ws } = await openExport(draft);
    const loose = dataRows(ws).filter((r) => r.getCell(1).value === "Sin asignar");

    expect(loose.map((r) => [r.getCell(2).value, r.getCell(6).value])).toEqual([["Camiseta", 6], ["Gorra", 3]]);
    expect([column(loose, 5), column(loose, 10), column(loose, 11)]).toEqual([[null, null], [null, null], [null, null]]);
    expect(totalsRow(ws).getCell(5).value).toBe(2);

    const read = await extractDocument(bytes, opts);
    expect(read.products.map((p) => [p.name, p.quantity])).toEqual([["Camiseta", 10], ["Gorra", 3]]);
    expect(read.groups).toHaveLength(1);
    expect(read.groups[0]).toMatchObject({ cartons: 2, grossWeightKg: 4, cbm: 0.2 });
    expect(read.groups[0].items.map((i) => i.quantity)).toEqual([4]);
  });

  it("deja vacío lo que falta: ni cantidad 0, ni importe 0, ni unidad «pcs» de regalo", async () => {
    const draft = draftOf({
      products: [product({ id: "p1", name: "Producto sin confirmar", unit: "" })],
      groups: [{ id: "g1", label: "1", cartons: null, grossWeightKg: null, cbm: null, items: [{ productId: "p1", quantity: null }] }],
    });
    const { bytes, ws } = await openExport(draft);
    const [row] = dataRows(ws);

    // Cajas, cantidad, precio, importe, peso y CBM: celdas vacías, no ceros.
    expect([5, 6, 8, 9, 10, 11].map((c) => row.getCell(c).value)).toEqual([null, null, null, null, null, null]);
    expect(row.getCell(7).value).toBe("");
    expect([5, 6, 10, 11].map((c) => totalsRow(ws).getCell(c).value)).toEqual([null, null, null, null]);
    expect(merchandise(ws)).toEqual([]);

    const read = await extractDocument(bytes, opts);
    expect(read.products[0]).toMatchObject({ quantity: null, unitPrice: null, unit: "" });
    // Los huecos siguen bloqueando la confirmación después del viaje de ida y vuelta.
    expect(confirmationIssues(read).filter((i) => i.blocking).map((i) => i.code))
      .toEqual(expect.arrayContaining(["quantity_missing", "price_missing", "unit_review"]));
  });

  it("no adivina la moneda: sin moneda confirmada escribe «Pendiente» y vuelve pendiente", async () => {
    const draft = draftOf({
      currency: null,
      products: [product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 2 })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }] }],
    });
    const { bytes, ws } = await openExport(draft);

    expect(ws.getCell("D7").value).toBe("Pendiente");
    expect(dataRows(ws)[0].getCell(12).value).toBe("Pendiente");
    expect(merchandise(ws)).toEqual([]); // 20 de nada no es un valor de mercancía.

    const read = await extractDocument(bytes, opts);
    expect(read.currency).toBeNull();
    expect(read.products.map((p) => p.currency)).toEqual([null]);
    expect(read.issues.some((i) => i.code === "currency_ambiguous" && i.blocking)).toBe(true);
    expect(computeDocumentTotals(read).amounts).toEqual({});
  });

  it("no publica un valor de mercancía parcial cuando a un producto le falta el precio", async () => {
    // Un total que sólo suma los productos con precio se lee como EL total del
    // embarque. Mejor ninguno que uno corto.
    const incomplete = draftOf({
      products: [
        product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 2, currency: "USD" }),
        product({ id: "p2", name: "Gorra", quantity: 5, currency: "USD" }),
      ],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }, { productId: "p2", quantity: 5 }] }],
    });
    const parcial = await openExport(incomplete);
    expect(merchandise(parcial.ws)).toEqual([]);
    expect(dataRows(parcial.ws)[1].getCell(9).value).toBeNull();

    const completo = await openExport({ ...incomplete, products: [incomplete.products[0], { ...incomplete.products[1], unitPrice: 3 }] });
    expect(merchandise(completo.ws)).toEqual([["USD", 35]]);
  });

  it("escribe el importe 0 de una muestra gratis; precio cero es un dato, no un hueco", async () => {
    // «Precio 0» y «precio sin confirmar» no son lo mismo. Si la celda del
    // importe sale en blanco, la aduana y el cliente leen un precio pendiente
    // mientras el pie ya declaró la mercancía en 0 — y el que quiera cobrarla
    // rellena el hueco con lo que le parezca.
    const draft = draftOf({
      products: [product({ id: "p1", name: "Muestra", quantity: 10, unitPrice: 0, currency: "USD" })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 2, cbm: 0.1, items: [{ productId: "p1", quantity: 6 }] }],
    });
    const { bytes, ws } = await openExport(draft);
    const rows = dataRows(ws);

    expect(column(rows, 8)).toEqual([0, 0]); // precio unitario declarado
    expect(column(rows, 9)).toEqual([0, 0]); // fila del grupo y fila «Sin asignar»
    expect(merchandise(ws)).toEqual([["USD", 0]]);

    const read = await extractDocument(bytes, opts);
    expect(read.products[0]).toMatchObject({ quantity: 10, unitPrice: 0 });
    expect(confirmationIssues(read).map((i) => i.code)).not.toContain("price_missing");
  });

  it("redondea a dos decimales el importe de las filas de grupo", async () => {
    // 3 × 1,10 en coma flotante da 3,3000000000000003. Una columna de dinero no
    // publica eso: el proveedor lo copia a su factura y deja de cuadrar.
    const draft = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 3, unitPrice: 1.1, currency: "USD" })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 2, cbm: 0.1, items: [{ productId: "p1", quantity: 3 }] }],
    });
    const { ws } = await openExport(draft);
    const importe = dataRows(ws)[0].getCell(9).value;

    expect(importe).toBe(3.3);
    expect(String(importe)).toBe("3.3");
    expect(merchandise(ws)).toEqual([["USD", 3.3]]);
  });

  it("no suma monedas distintas ni unidades distintas en una sola cifra", async () => {
    const draft = draftOf({
      products: [
        product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 2, currency: "USD" }),
        product({ id: "p2", name: "Juego de vasos", quantity: 3, unitPrice: 5, currency: "RMB", unit: "set" }),
      ],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }, { productId: "p2", quantity: 3 }] }],
    });
    const { ws } = await openExport(draft);

    expect(merchandise(ws)).toEqual([["RMB", 15], ["USD", 20]]);
    expect(merchandise(ws).map(([, amount]) => amount)).not.toContain(35);
    // 10 piezas + 3 juegos no son 13 de nada: el pie deja la cantidad vacía.
    expect(totalsRow(ws).getCell(6).value).toBeNull();
  });

  it("cierra el pie con la suma real de las filas, no con una cuenta aparte", async () => {
    const draft = draftOf({
      products: [
        product({ id: "p1", name: "Camiseta", quantity: 30, unitPrice: 2, currency: "USD" }),
        product({ id: "p2", name: "Gorra", quantity: 5, unitPrice: 3, currency: "USD" }),
        product({ id: "p3", name: "Sin caja", quantity: 4, unitPrice: 10, currency: "USD" }),
      ],
      groups: [
        { id: "g1", label: "1-2", cartons: 2, grossWeightKg: 20, cbm: 0.3, items: [{ productId: "p1", quantity: 20 }, { productId: "p2", quantity: 5 }] },
        { id: "g2", label: "3", cartons: 1, grossWeightKg: 8, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }] },
      ],
    });
    const { bytes, ws } = await openExport(draft);
    const rows = dataRows(ws), pie = totalsRow(ws);

    expect(rows).toHaveLength(4); // 3 de grupo + 1 «Sin asignar»
    for (const [label, index] of [["cajas", 5], ["cantidad", 6], ["peso", 10], ["cbm", 11]] as const) {
      expect(pie.getCell(index).value, label).toBe(addUp(rows, index));
    }
    expect(merchandise(ws)).toEqual([["USD", addUp(rows, 9)]]);
    expect(computeDocumentTotals(await extractDocument(bytes, opts))).toMatchObject(computeDocumentTotals(draft));
  });

  it("sobrevive a un archivo con estilos, encabezado congelado y autofiltro", async () => {
    // El formato (fills, fuentes, alturas, panel congelado, autofiltro) no puede
    // estorbar la relectura: es el mismo archivo que el proveedor devuelve editado.
    const draft = draftOf({
      supplier: { company: "Yiwu Synthetic Trading", contact: "Li", email: "li@synthetic.example", wechat: "li-wechat", phone: "+86 000", address: "Calle 1", city: "Yiwu" },
      docDate: "2026-02-03",
      products: [product({ id: "p1", name: "Camiseta", nameZh: "衬衫", code: "A1", brand: "Marca", material: "Algodón", quantity: 10, unitPrice: 2, currency: "USD" })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }] }],
    });
    const { bytes, ws } = await openExport(draft, { ...ctx, confirmed: true, revision: 4 });

    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: HEADER_ROW });
    expect(ws.getRow(HEADER_ROW).font?.bold).toBe(true);
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getCell("A2").value).toContain("Confirmado");
    expect(ws.getCell("B2").value).toBe("Rev. 4");

    const read = await extractDocument(bytes, opts);
    expect(read.supplier).toEqual(draft.supplier);
    expect(read.docDate).toBe("2026-02-03");
    expect(read.products[0]).toMatchObject({ name: "Camiseta", nameZh: "衬衫", code: "A1", brand: "Marca", material: "Algodón", quantity: 10, unitPrice: 2, currency: "USD" });
    expect(read.issues).toEqual([]);
  });

  it("no genera ningún archivo a partir de un borrador que el contrato compartido rechaza", async () => {
    // Fail-closed: antes que exportar un Excel con una caja que apunta a un
    // producto inexistente (y sin sus cajas en el papel), no exportar nada.
    const base = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 2, currency: "USD" })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 10 }] }],
    });
    await expect(exportDocument({ ...base, groups: [{ ...base.groups[0], items: [{ productId: "fantasma", quantity: 1 }] }] }, ctx)).rejects.toThrow(/group.items.reference/);
    await expect(exportDocument({ ...base, products: [{ ...base.products[0], quantity: -5 }] }, ctx)).rejects.toThrow();
    await expect(exportDocument({ ...base, groups: [{ ...base.groups[0], cartons: 2.5 }] }, ctx)).rejects.toThrow(/cartons.integer/);
  });

  /**
   * DEFECTO (export.ts:30-31): el importe de las filas «Sin asignar» se escribe
   * sin redondear, mientras el de las filas de grupo pasa por `toFixed(2)`. El
   * cliente abre la factura y lee «6,6000000000000005» en una columna de dinero.
   */
  it.fails("redondea el importe de «Sin asignar» a dos decimales, como el resto", async () => {
    const draft = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 6, unitPrice: 1.1, currency: "USD" })],
      groups: [],
    });
    const { ws } = await openExport(draft);
    expect(dataRows(ws)[0].getCell(9).value).toBe(6.6);
  });

  /**
   * DEFECTO (export.ts:24 + extract.ts:192): la etiqueta del grupo se escribe
   * cruda en la misma columna que lleva el centinela «Sin asignar». Un grupo
   * etiquetado así pierde sus cajas, su peso y su CBM al releer el archivo.
   */
  it.fails("conserva las cajas de un grupo aunque su etiqueta se llame «Sin asignar»", async () => {
    const draft = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 4, unitPrice: 1, currency: "USD" })],
      groups: [{ id: "g1", label: "Sin asignar", cartons: 5, grossWeightKg: 50, cbm: 1, items: [{ productId: "p1", quantity: 4 }] }],
    });
    const { bytes } = await openExport(draft);
    const read = await extractDocument(bytes, opts);
    expect(read.groups.map((g) => [g.cartons, g.grossWeightKg, g.cbm])).toEqual([[5, 50, 1]]);
  });

  /**
   * DEFECTO (export.ts:24, `group.label||group.id`): cuando la caja no tiene
   * número, el Excel publica el id interno del grupo («g1») en la columna
   * «箱组 / Grupo», y la relectura lo adopta como número de caja. Es un dato
   * inventado en un documento cuya regla es que lo que falta, falta — y
   * export.ts:28 ya escribe la etiqueta cruda para los grupos vacíos.
   */
  it.fails("deja en blanco el número de una caja que no lo tiene", async () => {
    const draft = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 4, unitPrice: 1, currency: "USD" })],
      groups: [{ id: "g1", label: "", cartons: 2, grossWeightKg: 5, cbm: 0.1, items: [{ productId: "p1", quantity: 4 }] }],
    });
    const { bytes, ws } = await openExport(draft);
    expect(dataRows(ws)[0].getCell(1).value).toBe("");
    expect((await extractDocument(bytes, opts)).groups[0].label).toBe("");
  });

  /**
   * DEFECTO (export.ts:30-33): si un grupo tiene asignadas MÁS unidades de las
   * que declara el producto, la fila sobrante no se escribe y el pie sigue
   * contando la cantidad del producto. El Excel sale con las filas sumando 12 y
   * el pie diciendo 10, y el valor de mercancía cobrando por 10.
   */
  it.fails("el pie coincide con las filas incluso si el borrador sobreasigna un producto", async () => {
    const draft = draftOf({
      products: [product({ id: "p1", name: "Camiseta", quantity: 10, unitPrice: 1, currency: "USD" })],
      groups: [{ id: "g1", label: "1", cartons: 1, grossWeightKg: 1, cbm: 0.1, items: [{ productId: "p1", quantity: 12 }] }],
    });
    const { ws } = await openExport(draft);
    expect(totalsRow(ws).getCell(6).value).toBe(addUp(dataRows(ws), 6));
  });
});
