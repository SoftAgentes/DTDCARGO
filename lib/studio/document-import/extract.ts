import "server-only";
import ExcelJS from "exceljs";
import { Unzip, UnzipInflate } from "fflate";
import { emptyDocumentDraft, parseDocumentDraft, type CartonGroup, type DocumentDraft, type DocumentProduct, type DocumentSource } from "@/lib/shared/document-import";
import { DocumentImportError, extractWithAnthropic, type ExtractionOptions } from "./anthropic";
export { DocumentImportError, type ExtractionOptions } from "./anthropic";

const MAX_BYTES = 15 * 1024 * 1024, MAX_ROWS = 2000, MAX_COLUMNS = 100, MAX_CELLS = 30000;
type Cell = { ref: string; value: string | number | null; formulaUnavailable?: boolean; formula?: boolean };
type Sheet = { name: string; rows: Cell[][] };
const key = (s: string) => s.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s._\-/()·:：³º°\n]/g, "");
const s = (c: Cell | undefined) => c?.value === null || c?.value === undefined ? "" : String(c.value).trim();
const issue = (d: DocumentDraft, code: string, path: string, message: string) => { d.issues.push({ id: (d.sources[0]?.id ?? "extract") + "-issue" + (d.issues.length + 1), code, path, message, blocking: true, severity: "warning", resolved: false }); };
const locate = (source: DocumentSource, path: string, sheet: string, ...cells: (Cell | undefined)[]) => { for (const cell of cells) if (cell) source.locations.push({ path, sheet, cell: cell.ref, page: null }); };

/** ZIP central-directory limits are checked BEFORE ExcelJS inflates XML. ZIP64/encryption rejected. */
export function validateXlsxContainer(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { eocd = i; break; }
  if (eocd < 0) throw new DocumentImportError("invalid_xlsx", "El archivo no es un XLSX válido.");
  const count = view.getUint16(eocd + 10, true), directorySize = view.getUint32(eocd + 12, true), offset = view.getUint32(eocd + 16, true);
  if (!count || count > 3000 || view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0 || view.getUint16(eocd + 8, true) !== count || offset + directorySize > eocd) throw new DocumentImportError("xlsx_limits", "El Excel excede los límites de lectura o usa un formato ZIP no compatible.");
  let cursor = offset, expanded = 0, contentTypes = false, workbook = false;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > eocd || view.getUint32(cursor, true) !== 0x02014b50) throw new DocumentImportError("invalid_xlsx", "El índice del Excel está dañado.");
    const flags = view.getUint16(cursor + 8, true), size = view.getUint32(cursor + 24, true), compressed = view.getUint32(cursor + 20, true), nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true), localOffset = view.getUint32(cursor + 42, true);
    expanded += size;
    if ((flags & 1) || size === 0xffffffff || compressed === 0xffffffff || expanded > 40 * 1024 * 1024 || size > 20 * 1024 * 1024 || cursor + 46 + nameLength + extraLength + commentLength > eocd || localOffset + 30 > offset || view.getUint32(localOffset, true) !== 0x04034b50) throw new DocumentImportError("xlsx_limits", "El Excel es demasiado grande al descomprimirlo o está cifrado.");
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === "[Content_Types].xml") contentTypes = true;
    if (name === "xl/workbook.xml") workbook = true;
    if (/vbaproject|externallinks/i.test(name)) throw new DocumentImportError("xlsx_external_content", "Guarda una copia XLSX sin macros ni vínculos externos para importarla.");
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (!contentTypes || !workbook || cursor !== offset + directorySize) throw new DocumentImportError("invalid_xlsx", "El archivo no contiene un libro XLSX válido.");
  // A forged central directory can lie about expanded size. Count the actual
  // stream without retaining it, before the full workbook loader allocates XML.
  let actual = 0;
  const unzip = new Unzip((file) => {
    let fileSize = 0;
    file.ondata = (error, data) => {
      if (error) throw new DocumentImportError("invalid_xlsx", "El contenido comprimido del Excel está dañado.");
      actual += data.length; fileSize += data.length;
      if (actual > 40 * 1024 * 1024 || fileSize > 20 * 1024 * 1024) throw new DocumentImportError("xlsx_limits", "El Excel excede el límite de tamaño al descomprimirlo.");
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try { for (let i = 0; i < bytes.length; i += 4096) unzip.push(bytes.subarray(i, i + 4096), i + 4096 >= bytes.length); }
  catch (error) { if (error instanceof DocumentImportError) throw error; throw new DocumentImportError("invalid_xlsx", "El contenido comprimido del Excel está dañado."); }
}

function cellValue(value: ExcelJS.CellValue): Pick<Cell, "value" | "formulaUnavailable" | "formula"> {
  if (value === null || value === undefined) return { value: null };
  if (typeof value === "number" || typeof value === "string") return { value };
  if (value instanceof Date) return { value: value.toISOString().slice(0, 10) };
  if (typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
    return typeof value.result === "number" || typeof value.result === "string" ? { value: value.result, formula: true } : { value: null, formulaUnavailable: true, formula: true };
  }
  if (typeof value === "object" && "richText" in value) return { value: value.richText.map((t) => t.text).join("") };
  if (typeof value === "object" && "hyperlink" in value) return { value: value.text };
  return { value: null };
}
async function readXlsx(bytes: Uint8Array): Promise<Sheet[]> {
  validateXlsxContainer(bytes);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new DocumentImportError("invalid_xlsx", "No se pudo abrir el Excel. Guarda otra copia e inténtalo de nuevo."); }
  if (workbook.worksheets.length > 20) throw new DocumentImportError("sheet_limits", "El Excel admite hasta 20 hojas para esta lectura.");
  let cellCount = 0;
  return workbook.worksheets.map((ws) => {
    // `rowCount`/`columnCount` cuentan lo que tiene FORMATO, no lo que tiene datos.
    // Un PI real guardado desde plantilla declara 16.382 columnas con estilo y
    // contenido sólo hasta la G: medir por ahí rechazaba documentos de 74 celdas.
    // El límite se aplica a la extensión con contenido; MAX_CELLS sigue siendo la
    // defensa contra abuso, y acota el recorrido para no barrer columnas vacías.
    const lastRow = Math.min(ws.rowCount, Math.max(ws.actualRowCount, 1), MAX_ROWS + 1);
    let lastColumn = 1;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (column > lastColumn) lastColumn = column;
      });
    });
    if (lastRow > MAX_ROWS || lastColumn > MAX_COLUMNS) throw new DocumentImportError("sheet_limits", `El Excel excede ${MAX_ROWS} filas o ${MAX_COLUMNS} columnas con datos por hoja.`);
    const rows: Cell[][] = [];
    for (let rowIndex = 1; rowIndex <= lastRow; rowIndex++) {
      const row: Cell[] = [];
      for (let column = 1; column <= lastColumn; column++) {
        const cell = ws.getCell(rowIndex, column);
        if (cell.isMerged && cell.master.address !== cell.address) { row.push({ ref: cell.address, value: null }); continue; }
        const read = cellValue(cell.value);
        if (read.value !== null || read.formulaUnavailable) cellCount++;
        if (cellCount > MAX_CELLS || (typeof read.value === "string" && read.value.length > 10000)) throw new DocumentImportError("sheet_limits", "El Excel contiene demasiadas celdas o textos demasiado largos.");
        row.push({ ref: cell.address, ...read });
      }
      rows.push(row);
    }
    return { name: ws.name, rows };
  });
}

/** RFC4180 quoted cells/newlines; expressions stay text and are never evaluated. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] ?? "";
  const counts = [",", ";", "\t"].map((delimiter) => { let quoted = false, count = 0; for (let i = 0; i < first.length; i++) { if (first[i] === '"') quoted = !quoted; else if (!quoted && first[i] === delimiter) count++; } return { delimiter, count }; });
  const delimiter = counts.sort((a, b) => b.count - a.count)[0].delimiter;
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false, closed = false;
  const pushCell = () => { if (row.length >= 100 || value.length > 10000) throw new DocumentImportError("sheet_limits", "El CSV excede los límites de lectura."); row.push(value); value = ""; closed = false; };
  const pushRow = () => { pushCell(); if (row.some((c) => c.trim())) rows.push(row); row = []; if (rows.length > MAX_ROWS || rows.reduce((a, r) => a + r.length, 0) > MAX_CELLS) throw new DocumentImportError("sheet_limits", "El CSV excede los límites de lectura."); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; }
    else if (c === '"' && value === "" && !closed) quoted = true;
    else if (c === delimiter) pushCell();
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; pushRow(); }
    else if (closed && c.trim()) throw new DocumentImportError("invalid_csv", "El CSV tiene comillas o separadores inválidos.");
    else if (!closed) value += c;
  }
  if (quoted) throw new DocumentImportError("invalid_csv", "El CSV tiene una celda con comillas sin cerrar.");
  if (value || row.length) pushRow();
  return rows;
}
const columnName = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : columnName(Math.floor(index / 26) - 1) + String.fromCharCode(65 + index % 26);

type Field = "name" | "nameZh" | "code" | "brand" | "material" | "quantity" | "perCarton" | "unitPrice" | "currency" | "unit" | "cartons" | "cartonLabel" | "grossTotal" | "grossEach" | "cbmTotal" | "cbmEach" | "amount" | "lengthCm" | "widthCm" | "heightCm";
const aliases: Record<Field, string[]> = {
  // `item` y `descripciones` salen de proformas reales de Yiwu, donde la columna
  // ITEM trae el nombre del producto y DESCRIPCIONES el detalle. Como el emparejado
  // se queda con la PRIMERA columna que reconoce, ITEM gana por estar a la izquierda
  // y la descripción larga no pisa el nombre.
  name: ["product", "productname", "description", "descriptions", "itemdescription", "goodsdescription", "item", "nombre", "producto", "descripcion", "descripciones", "英文品名", "品名", "货物名称"],
  nameZh: ["chinesename", "namechinese", "中文品名", "中文名称"], code: ["code", "productcode", "itemno", "itemcode", "sku", "codigo", "货号", "型号"],
  brand: ["brand", "marca", "品牌"], material: ["material", "hs", "hscode", "材质", "材质hs"],
  quantity: ["qty", "quantity", "totalqty", "totalquantity", "totalpcs", "cantidad", "cantidadtotal", "totaluds", "总数量", "数量"],
  perCarton: ["pcsctn", "qtyctn", "pcspercarton", "qtypercarton", "udscaja", "unidadesporcaja", "每箱装量", "装箱数", "每箱数量"],
  unitPrice: ["unitprice", "price", "punit", "preciounitario", "单价"], currency: ["currency", "moneda", "币种", "货币"], unit: ["unit", "uom", "unidad", "单位"],
  cartons: ["cartons", "ctns", "ctn", "noofcartons", "cajas", "bultos", "件数", "箱数"], cartonLabel: ["cartonno", "cartonnos", "cartonnumber", "nrocaja", "ncaja", "箱号"],
  // `tgw` / `总重量` / `总毛重` son inequívocos: la T y el 总 dicen TOTAL. `G.W.` a secas
  // NO se agrega a propósito — en las proformas de Yiwu convive con `T.G.W.` y ahí es el
  // peso POR CAJA, así que mapearlo a total metería el número de otra columna.
  grossTotal: ["grossweightkg", "totalgrossweightkg", "gwkg", "pesobrutokg", "pesobrutototalkg", "毛重kg", "总毛重kg", "tgwkgs", "tgwkg", "tgw", "总重量", "总毛重"],
  grossEach: ["gwctnkg", "grossweightpercartonkg", "kgcaja", "pesobrutoporcajakg", "每箱毛重kg", "每箱重kg"],
  cbmTotal: ["cbm", "totalcbm", "volumem3", "volumentotalm3", "体积m3", "总体积", "总体积m3"], cbmEach: ["cbmctn", "cbmcarton", "cbmcaja", "cbmpercarton", "每箱体积", "每箱体积m3"],
  amount: ["amount", "totalamount", "importe", "totalimporte", "总金额", "金额", "总价"],
  lengthCm: ["lengthcm", "largocm", "长cm"], widthCm: ["widthcm", "anchocm", "宽cm"], heightCm: ["heightcm", "altocm", "高cm"],
};
/** Cargos que NO son valor de mercancía, en las tres lenguas de nuestros documentos. */
const CHARGE_LABEL = /^(commission|comision|comisión|佣金|freight|shipping|flete|运费|insurance|seguro|保险费|discount|descuento|折扣)/i;
/**
 * `Sin asignar` en la primera columna es un CENTINELA: marca la fila de sobrantes,
 * los productos que no viven en ningún grupo de cajas. No es una etiqueta de grupo.
 *
 * El choque es real: un proveedor puede bautizar así un grupo suyo. `exportDocument`
 * lo esquiva entrecomillando la etiqueta que choca (`groupLabel`), y acá se deshace
 * ese entrecomillado. Las dos mitades tienen que existir: sin esta, el round-trip
 * devuelve el grupo con los guillemets pegados y la etiqueta deja de ser la que el
 * proveedor escribió.
 */
const UNASSIGNED = "Sin asignar";
const unquoteLabel = (label: string) => (label === "«" + UNASSIGNED + "»" ? UNASSIGNED : label);
const headerMap = new Map(Object.entries(aliases).flatMap(([field, values]) => values.map((v) => [key(v), field as Field] as const)));
/**
 * Códigos de barras: NO son el código del artículo. «BAR CODE» contiene «CODE», así
 * que al partir la celda caería en `code` y el documento llevaría el EAN donde debería
 * ir la referencia del proveedor. Se descarta antes de mirar los trozos.
 */
const NOT_A_FIELD = [key("barcode"), key("条码"), key("codigodebarras")];
/**
 * Un encabezado puede traer DOS idiomas en la misma celda —«DESCRIPTIONS 品名描述»,
 * «T.CBM 总体积», «CTN 箱数»—, que es lo normal en las proformas de Yiwu. La comparación
 * exacta nunca los reconocía, así que el documento entero derivaba a lectura asistida
 * pudiendo leerse gratis.
 *
 * Se prueba primero la celda COMPLETA: el comportamiento anterior queda intacto y
 * ningún documento que hoy se lee cambia de interpretación. Sólo si eso no cae se
 * parte, y el ORDEN importa: las palabras van antes que las rachas de alfabeto para
 * que «CBM/CTN 体积» dé volumen POR CAJA por su parte latina, en vez de confundirse
 * con el volumen total, que en ese mismo documento es otra columna.
 */
function resolveHeader(raw: string): Field | undefined {
  const entero = key(raw);
  if (!entero) return undefined;
  const exacto = headerMap.get(entero);
  if (exacto) return exacto;
  if (NOT_A_FIELD.some((marca) => entero.includes(marca))) return undefined;
  const normal = raw.normalize("NFKC");
  const trozos = [
    ...normal.split(/[\s,;|]+/),
    ...(normal.match(/[㐀-鿿豈-﫿]+|[A-Za-z][A-Za-z.]*/g) ?? []),
  ];
  for (const trozo of trozos) {
    const campo = headerMap.get(key(trozo));
    if (campo) return campo;
  }
  return undefined;
}

function readNumber(cell: Cell | undefined, d: DocumentDraft, path: string): number | null {
  if (!cell) return null;
  if (cell.formulaUnavailable) { issue(d, "formula_unavailable", path, "Una fórmula no tiene un resultado guardado. Abre y guarda el Excel o completa el dato."); return null; }
  if (cell.value === null || s(cell) === "") return null;
  if (typeof cell.value === "number") {
    if (Number.isFinite(cell.value) && cell.value >= 0 && cell.value <= 1e12) return cell.value;
    issue(d, "number_invalid", path, "El número no es válido. Completa un valor positivo o cero explícito."); return null;
  }
  let value = s(cell).replace(/\u00a0/g, " ");
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(value)) value = value.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(value) || /^0,\d+$/.test(value)) value = value.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) > 1e12) { issue(d, "number_ambiguous", path, "Un número tiene un formato ambiguo o no se puede leer. Revísalo sin evaluar expresiones."); return null; }
  return Number(value);
}
function readCurrency(cell: Cell | undefined, d: DocumentDraft, path: string): string | null {
  const value = s(cell).toUpperCase();
  if (!value) return null;
  if (/^[A-Z]{3}$/.test(value)) return value === "CNY" ? "RMB" : value;
  issue(d, "currency_ambiguous", path, "Confirma la moneda con su código (por ejemplo USD, RMB o EUR)."); return null;
}

/** SDD-0473 export: explicit group TOTALS (different from the original per-carton template). */
function parseDtdExport(sheet: Sheet, options: ExtractionOptions): DocumentDraft | null {
  if (!s(sheet.rows[0]?.[0]).startsWith("DTD Cargo · 装箱单") || !s(sheet.rows[8]?.[0]).includes("箱组") || !s(sheet.rows[8]?.[9]).includes("TOTAL del grupo")) return null;
  const d = emptyDocumentDraft(), source: DocumentSource = { id: options.sourceId, fileName: options.fileName, kind: options.kind === "unknown" ? "combined" : options.kind, locations: [] };
  d.sources = [source];
  for (const [field, row, column] of [["company", 3, 1], ["contact", 3, 3], ["email", 4, 1], ["wechat", 4, 3], ["phone", 4, 5], ["address", 5, 1], ["city", 5, 3]] as const) {
    d.supplier[field] = s(sheet.rows[row]?.[column]); locate(source, "supplier." + field, sheet.name, sheet.rows[row]?.[column]);
  }
  const date = s(sheet.rows[6]?.[1]); d.docDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  d.currency = readCurrency(sheet.rows[6]?.[3], d, "currency"); locate(source, "currency", sheet.name, sheet.rows[6]?.[3]);
  let group: CartonGroup | undefined;
  for (const [offset, row] of sheet.rows.slice(9).entries()) {
    if (/^总计\s*\/\s*Totales/.test(s(row[0]))) {
      for (const [field, col] of [["cartons", 4], ["grossWeightKg", 9], ["cbm", 10]] as const) { d.declaredTotals[field] = readNumber(row[col], d, "declaredTotals." + field); locate(source, "declaredTotals." + field, sheet.name, row[col]); }
      const currencies = new Set(d.products.map((p) => p.currency).filter(Boolean));
      for (const footer of sheet.rows.slice(10 + offset)) if (/^货值\s*\/\s*Mercancía/.test(s(footer[0])) && currencies.size === 1 && s(footer[1]) === d.currency) { d.declaredTotals.amount = readNumber(footer[2], d, "declaredTotals.amount"); locate(source, "declaredTotals.amount", sheet.name, footer[2]); }
      break;
    }
    if (!s(row[1]) && !s(row[2]) && !s(row[3]) && !s(row[4])) continue;
    const cartons = readNumber(row[4], d, "groups.cartons");
    const unassigned = s(row[0]) === UNASSIGNED;
    if (unassigned) group = undefined;
    else if (cartons !== null || !group) {
      const id = options.sourceId + "-g" + (d.groups.length + 1);
      group = { id, label: unquoteLabel(s(row[0])), cartons, grossWeightKg: readNumber(row[9], d, "groups." + id + ".grossWeightKg"), cbm: readNumber(row[10], d, "groups." + id + ".cbm"), items: [] };
      d.groups.push(group);
      for (const [field, col] of [["cartons", 4], ["grossWeightKg", 9], ["cbm", 10]] as const) locate(source, "groups." + id + "." + field, sheet.name, row[col]);
    }
    if (s(row[1]) === "Productos pendientes" && !s(row[2]) && !s(row[3]) && !s(row[5])) continue;
    const quantity = readNumber(row[5], d, "products.quantity"), unitPrice = readNumber(row[7], d, "products.unitPrice"), currency = readCurrency(row[11], d, "products.currency") ?? d.currency;
    const candidate = { name: s(row[1]), nameZh: s(row[2]), code: s(row[3]), unit: s(row[6]), unitPrice, currency, brand: s(row[12]), material: s(row[13]) };
    let product = d.products.find((p) => p.name === candidate.name && p.nameZh === candidate.nameZh && p.code === candidate.code && p.unit === candidate.unit && p.unitPrice === candidate.unitPrice && p.currency === candidate.currency && p.brand === candidate.brand && p.material === candidate.material);
    if (product) product.quantity = product.quantity !== null && quantity !== null ? product.quantity + quantity : null;
    else { product = { id: options.sourceId + "-p" + (d.products.length + 1), ...candidate, quantity }; d.products.push(product); }
    for (const [field, col] of [["name", 1], ["nameZh", 2], ["code", 3], ["quantity", 5], ["unit", 6], ["unitPrice", 7], ["currency", 11], ["brand", 12], ["material", 13]] as const) locate(source, "products." + product.id + "." + field, sheet.name, row[col]);
    if (group) {
      const existing = group.items.find((i) => i.productId === product.id);
      if (existing) existing.quantity = existing.quantity !== null && quantity !== null ? existing.quantity + quantity : null;
      else group.items.push({ productId: product.id, quantity });
      locate(source, "groups." + group.id + ".items", sheet.name, row[5]);
    }
  }
  return d;
}

function parseSheet(sheet: Sheet, options: ExtractionOptions): DocumentDraft | null {
  const exported = parseDtdExport(sheet, options);
  if (exported) return exported;
  const d = emptyDocumentDraft(), source: DocumentSource = { id: options.sourceId, fileName: options.fileName, kind: options.kind, locations: [] };
  d.sources = [source];
  const at = (ref: string) => sheet.rows.flat().find((c) => c.ref === ref);
  const dtd = /中文品名/.test(s(at("C11"))) && /件数/.test(s(at("G11"))) && /总体积/.test(s(at("O11")));
  let headerIndex = -1; let fields: Partial<Record<Field, number>> = {};
  if (dtd) {
    headerIndex = 10;
    fields = { brand: 0, code: 1, nameZh: 2, name: 3, material: 4, cartonLabel: 5, cartons: 6, perCarton: 7, quantity: 8, unitPrice: 9, amount: 10, grossEach: 11, grossTotal: 12, cbmEach: 13, cbmTotal: 14 };
    if (options.kind === "unknown") source.kind = "combined";
    for (const [field, ref] of [["company", "C5"], ["wechat", "C8"], ["email", "I5"], ["phone", "I6"], ["address", "I7"]] as const) { d.supplier[field] = s(at(ref)); if (d.supplier[field]) locate(source, "supplier." + field, sheet.name, at(ref)); }
    const date = s(at("I8")); if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { d.docDate = date; locate(source, "docDate", sheet.name, at("I8")); }
    const currencyRow = sheet.rows.find((r) => /货币|moneda/i.test(s(r[0])));
    d.currency = readCurrency(currencyRow?.[2], d, "currency"); locate(source, "currency", sheet.name, currencyRow?.[2]);
  } else {
    for (let i = 0; i < Math.min(sheet.rows.length, 50); i++) {
      const found: Partial<Record<Field, number>> = {};
      for (const [index, cell] of sheet.rows[i].entries()) { const f = resolveHeader(s(cell)); if (f && found[f] === undefined) found[f] = index; }
      if ((found.name !== undefined || found.nameZh !== undefined || found.code !== undefined) && (found.quantity !== undefined || found.perCarton !== undefined || found.unitPrice !== undefined)) { headerIndex = i; fields = found; break; }
    }
    if (headerIndex < 0) return null;
    for (const row of sheet.rows.slice(0, headerIndex)) for (let i = 0; i < row.length - 1; i++) {
      const label = key(s(row[i]));
      if (["supplier", "suppliername", "seller", "proveedor", "供应商", "供货方", "卖方"].includes(label)) { d.supplier.company = s(row[i + 1]); locate(source, "supplier.company", sheet.name, row[i + 1]); }
      if (["currency", "moneda", "货币", "币种"].includes(label)) { d.currency = readCurrency(row[i + 1], d, "currency"); locate(source, "currency", sheet.name, row[i + 1]); }
    }
  }
  let previousGroup: CartonGroup | undefined;
  const unallocated: { cartons: number | null; grossWeightKg: number | null; cbm: number | null; cells: Partial<Record<"cartons" | "grossTotal" | "cbmTotal", Cell>> }[] = [];
  for (const [rowOffset, row] of sheet.rows.slice(headerIndex + 1).entries()) {
    const cell = (field: Field) => fields[field] === undefined ? undefined : row[fields[field]!];
    const name = s(cell("name")), nameZh = s(cell("nameZh")), code = s(cell("code"));
    const first = row.find((c) => s(c))?.value;
    if (typeof first === "string" && /^(total(?:es)?|grand\s*total|合计|总计|总共)(?:[\s:：·]|$)/i.test(first.trim())) {
      // Las proformas de Yiwu encadenan varias filas que empiezan con "TOTAL PRICE":
      // una es la comisión y otra el importe real, y la etiqueta que las distingue
      // está en otra celda de la misma fila. Quedarse con la primera guardaba la
      // COMISIÓN como importe del documento — un dato falso, peor que ninguno.
      // Se salta la fila y se pide revisión, sin adivinar cuál de las dos vale.
      if (row.some((c) => CHARGE_LABEL.test(s(c)))) {
        issue(d, "non_product_charge", "declaredTotals.amount", "El documento declara una comisión, flete u otro cargo junto al total. Revisa el valor de mercancía por separado.");
        continue;
      }
      for (const [target, field] of [["cartons", "cartons"], ["grossWeightKg", "grossTotal"], ["cbm", "cbmTotal"], ["amount", "amount"]] as const) {
        // Formula totals in our template are recomputed from explicit input cells, not stale caches.
        const targetCell = cell(field);
        if (dtd && targetCell?.formula) continue;
        d.declaredTotals[target] = readNumber(targetCell, d, "declaredTotals." + target); locate(source, "declaredTotals." + target, sheet.name, targetCell);
      }
      const remaining = sheet.rows.slice(headerIndex + rowOffset + 2);
      if (remaining.some((later) => {
        const headers = later.map((c) => resolveHeader(s(c))).filter(Boolean);
        if (headers.length >= 3) return true;
        const laterCell = (field: Field) => fields[field] === undefined ? undefined : later[fields[field]!];
        return (s(laterCell("name")) || s(laterCell("nameZh")) || s(laterCell("code"))) && ["quantity", "perCarton", "unitPrice"].some((field) => /^\d/.test(s(laterCell(field as Field))));
      })) issue(d, "additional_sections", "document", "Hay otras secciones después de los totales. Se requiere lectura asistida para revisar el documento completo.");
      break;
    }
    if (!name && !nameZh && !code) continue;
    if (/^(freight|shipping|insurance|discount|flete|seguro|descuento|运费|保险费|折扣)$/i.test(name || nameZh)) { issue(d, "non_product_charge", "declaredTotals.amount", "El documento incluye flete, descuento u otro cargo. Revísalo por separado del valor de mercancía."); continue; }
    const id = options.sourceId + "-p" + (d.products.length + 1), path = "products." + id;
    const productCurrency = readCurrency(cell("currency"), d, path + ".currency") ?? d.currency;
    const cartons = readNumber(cell("cartons"), d, path + ".cartons"), perCarton = readNumber(cell("perCarton"), d, path + ".perCarton");
    const isMixed = dtd && cartons === null;
    // DTD's total quantity is formula-derived. Its explicit inputs are authoritative.
    const calculatedQuantity = isMixed ? perCarton : cartons !== null && perCarton !== null ? cartons * perCarton : null;
    const explicitQuantity = dtd && cell("quantity")?.formula ? null : readNumber(cell("quantity"), d, path + ".quantity");
    const quantity = explicitQuantity ?? calculatedQuantity;
    if (explicitQuantity !== null && calculatedQuantity !== null && Math.abs(explicitQuantity - calculatedQuantity) > 0.0005) issue(d, "quantity_conflict", path + ".quantity", "El total de unidades difiere de cajas × unidades por caja. Revisa ambos datos.");
    const unitHeader = fields.quantity !== undefined ? s(sheet.rows[headerIndex][fields.quantity]) : fields.perCarton !== undefined ? s(sheet.rows[headerIndex][fields.perCarton]) : "";
    const unit = s(cell("unit")) || (dtd || /pcs|uds|unidades|pieces/i.test(unitHeader) ? "pcs" : "");
    const product: DocumentProduct = { id, name, nameZh, code, brand: s(cell("brand")), material: s(cell("material")), quantity, unitPrice: readNumber(cell("unitPrice"), d, path + ".unitPrice"), currency: productCurrency, unit };
    d.products.push(product);
    for (const field of ["name", "nameZh", "code", "brand", "material", "quantity", "unitPrice", "currency", "unit"] as const) locate(source, path + "." + field, sheet.name, cell(field));
    if (calculatedQuantity !== null) locate(source, path + ".quantity", sheet.name, cell("cartons"), cell("perCarton"));
    if (!cell("currency") && d.currency) source.locations.push(...source.locations.filter((l) => l.path === "currency").map((l) => ({ ...l, path: path + ".currency" })));
    if (isMixed) {
      if (previousGroup) previousGroup.items.push({ productId: id, quantity });
      else issue(d, "orphan_mixed_product", path, "El primer producto deja cajas vacías. Completa el grupo de cajas antes de confirmar.");
      continue;
    }
    if (cartons !== null && !Number.isInteger(cartons)) { issue(d, "cartons_fractional", path, "La cantidad de cajas debe ser un número entero."); continue; }
    if (cartons === null) {
      unallocated.push({ cartons, grossWeightKg: readNumber(cell("grossTotal"), d, "declaredTotals.grossWeightKg"), cbm: readNumber(cell("cbmTotal"), d, "declaredTotals.cbm"), cells: { grossTotal: cell("grossTotal"), cbmTotal: cell("cbmTotal") } });
      previousGroup = undefined; continue;
    }
    const groupId = options.sourceId + "-g" + (d.groups.length + 1), gp = "groups." + groupId;
    const weightEach = readNumber(cell("grossEach"), d, gp + ".grossWeightKg"), cbmEach = readNumber(cell("cbmEach"), d, gp + ".cbm");
    const weightTotal = dtd && cell("grossTotal")?.formula ? null : readNumber(cell("grossTotal"), d, gp + ".grossWeightKg");
    const volumeTotal = dtd && cell("cbmTotal")?.formula ? null : readNumber(cell("cbmTotal"), d, gp + ".cbm");
    const grossWeightKg = weightEach !== null ? weightEach * cartons : weightTotal;
    let cbm = cbmEach !== null ? cbmEach * cartons : volumeTotal;
    if (weightTotal !== null && weightEach !== null && Math.abs(weightTotal - weightEach * cartons) > 0.0005) issue(d, "weight_conflict", gp + ".grossWeightKg", "El peso bruto total difiere de cajas × peso por caja. Revisa ambos datos.");
    if (volumeTotal !== null && cbmEach !== null && Math.abs(volumeTotal - cbmEach * cartons) > 0.0005) issue(d, "cbm_conflict", gp + ".cbm", "El CBM total difiere de cajas × CBM por caja. Revisa ambos datos.");
    if (cbm === null && fields.lengthCm !== undefined && fields.widthCm !== undefined && fields.heightCm !== undefined) {
      const dims = ["lengthCm", "widthCm", "heightCm"].map((f) => readNumber(cell(f as Field), d, gp + ".cbm"));
      if (dims.every((v) => v !== null)) cbm = dims.reduce<number>((a, v) => a * v!, 1) / 1_000_000 * cartons;
    }
    if (!dtd && cartons > 1 && perCarton === null && weightEach === null && cbmEach === null) {
      // A global count and grand totals do not prove equal composition of cartons.
      issue(d, "packing_pattern_unknown", path, "Confirma cómo se distribuyen los productos entre las cajas; el archivo no lo especifica.");
      unallocated.push({ cartons, grossWeightKg, cbm, cells: { cartons: cell("cartons"), grossTotal: cell("grossTotal"), cbmTotal: cell("cbmTotal") } });
      previousGroup = undefined; continue;
    }
    const label = s(cell("cartonLabel"));
    const repeated = label ? d.groups.find((g) => g.label === label) : undefined;
    if (repeated) {
      issue(d, "repeated_carton_label", "groups." + repeated.id, "El número de caja se repite. Confirma si son cajas mixtas sin duplicar peso y volumen.");
      repeated.items.push({ productId: id, quantity }); previousGroup = repeated; continue;
    }
    previousGroup = { id: groupId, label, cartons, grossWeightKg, cbm, items: [{ productId: id, quantity }] }; d.groups.push(previousGroup);
    locate(source, gp + ".cartons", sheet.name, cell("cartons"));
    locate(source, gp + ".grossWeightKg", sheet.name, cell("grossEach"), cell("grossTotal"), cell("cartons"));
    locate(source, gp + ".cbm", sheet.name, cell("cbmEach"), cell("cbmTotal"), cell("cartons"), cell("lengthCm"), cell("widthCm"), cell("heightCm"));
    locate(source, gp + ".items", sheet.name, cell("quantity"), cell("perCarton"));
    if (d.products.length > 500) throw new DocumentImportError("product_limits", "El documento admite hasta 500 productos.");
  }
  if (d.products.length === 1 && unallocated.length === 1) {
    const total = unallocated[0];
    for (const [field, cellKey] of [["cartons", "cartons"], ["grossWeightKg", "grossTotal"], ["cbm", "cbmTotal"]] as const) if (d.declaredTotals[field] === null && total[field] !== null) { d.declaredTotals[field] = total[field]; locate(source, "declaredTotals." + field, sheet.name, total.cells[cellKey]); }
  } else if (unallocated.some((u) => u.grossWeightKg !== null || u.cbm !== null || u.cartons !== null)) {
    issue(d, "packing_patterns_assisted", "document", "Hay medidas por producto sin distribución de cajas explícita. Requiere lectura asistida para conservar y revisar los totales.");
  }
  return d;
}

export async function extractDocument(bytes: Uint8Array, options: ExtractionOptions): Promise<DocumentDraft> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new DocumentImportError("file_size", "El archivo debe tener contenido y pesar hasta 15 MB.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(options.sourceId) || options.fileName.length > 255) throw new DocumentImportError("invalid_metadata", "Los datos del archivo no son válidos.");
  const ext = options.fileName.toLowerCase().split(".").pop();
  if (ext === "xls") throw new DocumentImportError("legacy_xls", "El archivo XLS se conserva como adjunto. Conviértelo a XLSX o PDF para importar sus datos.");
  if (ext === "pdf") {
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) throw new DocumentImportError("invalid_pdf", "El archivo no tiene una cabecera PDF válida.");
    return extractWithAnthropic({ type: "pdf", bytes }, options);
  }
  let sheets: Sheet[];
  if (ext === "xlsx") sheets = await readXlsx(bytes);
  else if (ext === "csv") {
    let decoded: string;
    try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new DocumentImportError("csv_encoding", "Guarda el CSV con codificación UTF-8 para importarlo."); }
    sheets = [{ name: "CSV", rows: parseCsv(decoded).map((row, index) => row.map((value, column) => ({ ref: columnName(column) + (index + 1), value }))) }];
  } else throw new DocumentImportError("unsupported_format", "Para importar utiliza XLSX, CSV o PDF.");
  const useful = sheets.filter((sheet) => sheet.rows.some((row) => row.some((c) => s(c))));
  if (!useful.length) throw new DocumentImportError("empty_document", "El documento no contiene datos para importar.");
  const parsed = useful.map((sheet) => parseSheet(sheet, options));
  if (parsed.length !== 1 || parsed.some((d) => !d || !d.products.length || d.issues.some((i) => ["additional_sections", "packing_patterns_assisted"].includes(i.code)))) {
    // Multiple sheets may overlap (invoice + packing list): model proposes matches,
    // preview is mandatory. Never concatenate sheets and silently double-count.
    const serialized = useful.map((sheet) => ({ name: sheet.name, cells: sheet.rows.flat().filter((c) => c.value !== null || c.formulaUnavailable).map((c) => ({ cell: c.ref, value: c.formulaUnavailable ? "[FORMULA_VALUE_UNAVAILABLE]" : c.value! })) }));
    if (JSON.stringify(serialized).length > 200000) throw new DocumentImportError("assisted_input_limits", "Divide el Excel en archivos más pequeños para la lectura asistida.");
    return extractWithAnthropic({ type: "spreadsheet", sheets: serialized }, options);
  }
  return parseDocumentDraft(parsed[0]);
}
