import "server-only";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { computeDocumentTotals, confirmationIssues, parseDocumentDraft, type DocumentDraft } from "@/lib/shared/document-import";
import { labelVerifyUrl, isBoxCode } from "@/lib/studio/etiquetas-qr";
import type { BoxLabel } from "@/lib/studio/prealertas/types";
import { ImportHttpError } from "./access";

export type PdfSurface = "packing-list" | "labels";
export type ConfirmedPdfInput = {
  draft: DocumentDraft; markbox: string; code: string; revision: number;
  folio: string; versionNo: number; labels: BoxLabel[];
};
export function parsePdfSurface(value: string | null): PdfSurface {
  if (value !== "packing-list" && value !== "labels") throw new ImportHttpError(400, "invalid_pdf_surface", "Elige el documento o sus etiquetas.");
  return value;
}
const cents = (value: number) => Number(value.toFixed(2));
const format = (value: number) => new Intl.NumberFormat("es-VE", { maximumFractionDigits: 6 }).format(value);
const price = (value: number) => new Intl.NumberFormat("es-VE", { maximumFractionDigits: 12 }).format(value);
const amount = (value: number, currency: string) => currency + " " + new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const needsCjk = (value: string) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);

/** Closed printable projection: no sources, issue messages, client identity or warehouse writes. */
export function buildConfirmedPdfModel(input: ConfirmedPdfInput) {
  const draft = parseDocumentDraft(input.draft);
  const totals = computeDocumentTotals(draft);
  if (!Number.isInteger(input.revision) || input.revision < 0 || !input.folio || !Number.isInteger(input.versionNo) || input.versionNo < 1 || confirmationIssues(draft).some(issue => issue.blocking))
    throw new ImportHttpError(409, "confirmation_required", "Confirma la revisión vigente antes de descargar el PDF.");
  if (!totals.cartons || input.labels.length !== totals.cartons || new Set(input.labels.map(label => label.boxCode)).size !== totals.cartons || input.labels.some((label, index) => !label.boxCode || !isBoxCode(label.boxCode) || label.code !== input.code || label.boxN !== index + 1 || label.totalBoxes !== totals.cartons))
    throw new ImportHttpError(409, "labels_need_operations", "Las cajas físicas no coinciden con el documento. Contacta a DTD.");
  const amounts: Record<string, number> = {};
  const quantities: Record<string, number> = {};
  const groups = draft.groups.map((group, index) => ({
    label: group.label || String(index + 1), cartons: group.cartons!, grossWeightKg: group.grossWeightKg!, cbm: group.cbm!,
    rows: group.items.map(item => {
      const product = draft.products.find(product => product.id === item.productId)!;
      const currency = product.currency ?? draft.currency!;
      const quantity = item.quantity!;
      const unit = product.unit ?? "pcs";
      const lineAmount = cents(quantity * product.unitPrice!);
      amounts[currency] = cents((amounts[currency] ?? 0) + lineAmount);
      quantities[unit] = (quantities[unit] ?? 0) + quantity;
      return { name: product.name, nameZh: product.nameZh, code: product.code, brand: product.brand, material: product.material, quantity, unit, unitPrice: product.unitPrice!, currency, amount: lineAmount };
    }),
  }));
  return {
    code: input.code, markbox: input.markbox, revision: input.revision, folio: input.folio, versionNo: input.versionNo,
    supplier: { ...draft.supplier }, date: draft.docDate, groups,
    totals: { cartons: totals.cartons, grossWeightKg: totals.grossWeightKg!, cbm: totals.cbm!, quantities, amounts },
    labels: input.labels.map(label => ({ code: label.code, boxN: label.boxN, totalBoxes: label.totalBoxes, boxCode: label.boxCode!, qr: labelVerifyUrl(input.markbox, label.boxN, label.totalBoxes, label.boxCode) })),
  };
}
type PdfFontMetadata = { type?: string; variationAxes?: Record<string, unknown>; directory?: { tables?: Record<string, unknown> } };
type FontInfo = { family: string; postscriptName: string; embedding: Record<string, boolean> | null; format: "TTF" | "WOFF"; variationAxes: string[]; weightClass: number | null };
const fontLoads = new Map<string, Promise<FontInfo>>();
const fontError = () => new ImportHttpError(503, "pdf_font_unavailable", "El PDF no está disponible: falta una fuente compatible en el servidor. Puedes usar la impresión existente o contactar a DTD.");

/** React-PDF v4 supports static TrueType/WOFF, not WOFF2 or variable/OpenType outlines. */
export function requireStaticPdfFont(font: PdfFontMetadata): { format: "TTF" | "WOFF"; variationAxes: string[] } {
  const axes = Object.keys(font.variationAxes ?? {});
  if ((font.type !== "TTF" && font.type !== "WOFF") || axes.length || font.directory?.tables?.["CFF "] || font.directory?.tables?.CFF2) throw fontError();
  return { format: font.type, variationAxes: axes };
}

async function loadLocalFont(file: string, prefix: string): Promise<FontInfo> {
  try {
    if (!path.isAbsolute(file)) throw fontError();
    const info = await stat(file);
    if (!info.isFile() || info.size < 100 || info.size > 50 * 1024 * 1024) throw fontError();
    const key = file + ":" + info.size + ":" + info.mtimeMs;
    let loading = fontLoads.get(key);
    if (!loading) {
      loading = (async () => {
        const family = prefix + createHash("sha256").update(key).digest("hex").slice(0, 16);
        Font.register({ family, src: file });
        const source = Font.getFont({ fontFamily: family });
        await source.load();
        if (!source.data) throw fontError();
        const raw = source.data as unknown as PdfFontMetadata & { postscriptName?: string; "OS/2"?: { fsType?: Record<string, boolean>; usWeightClass?: number } };
        const compatible = requireStaticPdfFont(raw);
        const embedding = raw["OS/2"]?.fsType ?? null;
        // Enforce the font's own embedding flags; this does not certify its licence or portability.
        if (embedding && (embedding.noEmbedding || embedding.noSubsetting || embedding.bitmapOnly)) throw fontError();
        return { family, postscriptName: raw.postscriptName ?? "", embedding, ...compatible, weightClass: raw["OS/2"]?.usWeightClass ?? null };
      })();
      fontLoads.set(key, loading);
      void loading.catch(() => fontLoads.delete(key));
    }
    return await loading;
  } catch { throw fontError(); }
}

const style = StyleSheet.create({
  page: { padding: 26, fontSize: 9, color: "#0F1E3D", backgroundColor: "#FFFFFF" },
  header: { borderBottom: "2 solid #7F0F1A", paddingBottom: 10, marginBottom: 12 },
  brand: { fontSize: 20 }, title: { fontSize: 15, marginTop: 5 },
  muted: { color: "#6B6B6B", fontSize: 8, marginTop: 4 }, supplier: { marginBottom: 12, lineHeight: 1.5 },
  group: { marginBottom: 12 }, groupHead: { backgroundColor: "#F2F0EC", padding: 7, lineHeight: 1.5 },
  row: { flexDirection: "row", borderBottom: "0.5 solid #E8E6E2", paddingVertical: 7, minHeight: 25 },
  product: { width: "48%", paddingRight: 8 }, qty: { width: "16%" }, price: { width: "18%" }, total: { width: "18%", textAlign: "right" },
  small: { fontSize: 8, marginTop: 3 }, totals: { borderTop: "1 solid #7F0F1A", paddingTop: 8, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 12, left: 26, right: 26, fontSize: 7, color: "#6B6B6B" },
  labelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  label: { width: "48%", height: 226, border: "1 solid #0F1E3D", padding: 10, alignItems: "center", justifyContent: "center" },
  mark: { fontSize: 14, marginTop: 4 }, qr: { width: 100, height: 100, marginVertical: 6 },
});

/** Server-only renderer. The caller must gate the confirmed revision before AND after rendering. */
export async function renderConfirmedDocumentPdf(input: ConfirmedPdfInput, surface: PdfSurface) {
  const model = buildConfirmedPdfModel(input);
  const cjkPath = process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH?.trim();
  if (!cjkPath) throw fontError();
  const [cjk, body, heading, mono, brand] = await Promise.all([
    loadLocalFont(cjkPath, "DTDCJK"),
    loadLocalFont(path.join(process.cwd(), "lib/font-files/pdf/nunito-sans-400.ttf"), "DTDBody"),
    loadLocalFont(path.join(process.cwd(), "lib/font-files/pdf/sora-600.ttf"), "DTDHeading"),
    loadLocalFont(path.join(process.cwd(), "lib/font-files/pdf/jetbrains-mono-400.ttf"), "DTDCode"),
    loadLocalFont(path.join(process.cwd(), "lib/font-files/pdf/archivo-black-400.ttf"), "DTDBrand"),
  ]);
  function text(value: string, kind: "body" | "heading" | "mono" | "brand" = "body") {
    const selected = needsCjk(value) ? cjk : kind === "brand" ? brand : kind === "heading" ? heading : kind === "mono" ? mono : body;
    const source = Font.getFont({ fontFamily: selected.family });
    for (const character of value) if (!/[\r\n\t]/.test(character) && !source.data?.hasGlyphForCodePoint(character.codePointAt(0)!)) throw fontError();
    return <Text style={{ fontFamily: selected.family }}>{value}</Text>;
  }
  text("DTD Cargo", "brand");
  const wordmark = () => <Text style={{ fontFamily: brand.family }}><Text style={{ color: "#7F0F1A" }}>DTD</Text><Text style={{ color: "#0F1E3D" }}> Cargo</Text></Text>;
  const meta = `${model.code} · Rev. ${model.revision} · ${model.folio} · V${model.versionNo}`;
  text(meta, "mono");
  const footer = <Text fixed style={[style.footer, { fontFamily: needsCjk(meta) ? cjk.family : mono.family }]} render={({ pageNumber, totalPages }) => `${meta} · ${pageNumber}/${totalPages}`} />;
  const supplierLabels: Record<string, string> = { company: "供应商 / Proveedor", contact: "联系人 / Contacto", email: "Email", wechat: "WeChat", phone: "Tel", address: "地址 / Dirección", city: "城市 / Ciudad" };
  const header = <View style={style.header}><View style={style.brand}>{wordmark()}</View><View style={style.title}>{text("装箱单 + 商业发票 / Packing List + Factura", "heading")}</View><View style={style.muted}>{text("Confirmado / 已确认 · " + meta, "mono")}</View></View>;
  let document;
  if (surface === "packing-list") {
    document = <Document title={`Packing List + Factura ${model.code}`} author="DTD Cargo"><Page size="A4" orientation="landscape" style={[style.page, { fontFamily: body.family }]}>
      {header}<View style={style.supplier}>{text(`Shipping Mark: ${model.markbox}`, "mono")}{Object.entries(model.supplier).filter(([, value]) => value).map(([key, value]) => <View key={key}>{text(`${supplierLabels[key]}: ${value}`)}</View>)}{model.date && text(`Fecha: ${model.date}`, "mono")}</View>
      {model.groups.map((group, index) => <View key={index} style={style.group}>
        <View style={style.groupHead}>{text(`箱组 / Grupo ${group.label}`)}{text(`${format(group.cartons)} cajas · ${format(group.grossWeightKg)} kg bruto · ${format(group.cbm)} m³ TOTAL del grupo`)}</View>
        <View style={style.row}><View style={style.product}>{text("产品 / Producto · Código")}</View><View style={style.qty}>{text("数量 / Cantidad")}</View><View style={style.price}>{text("单价 / Precio")}</View><View style={style.total}>{text("金额 / Importe")}</View></View>
        {group.rows.map((row, rowIndex) => <View key={rowIndex} style={style.row} wrap={false}><View style={style.product}>{row.name && text(row.name)}{row.nameZh && text(row.nameZh)}<View style={style.small}>{text(row.code || "—", "mono")}</View>{(row.brand || row.material) && <View style={style.small}>{text([row.brand, row.material].filter(Boolean).join(" · "))}</View>}</View><View style={style.qty}>{text(`${format(row.quantity)} ${row.unit}`)}</View><View style={style.price}>{text(`${row.currency} ${price(row.unitPrice)}`)}</View><View style={style.total}>{text(amount(row.amount, row.currency))}</View></View>)}
      </View>)}
      <View style={style.totals} wrap={false}>{text("总计 / Totales")}{text(`${format(model.totals.cartons)} cajas · ${Object.entries(model.totals.quantities).map(([unit, n]) => `${format(n)} ${unit}`).join(" · ")} · ${format(model.totals.grossWeightKg)} kg bruto · ${format(model.totals.cbm)} m³`)}{text(Object.entries(model.totals.amounts).map(([currency, n]) => amount(n, currency)).join(" · "))}</View>{footer}
    </Page></Document>;
  } else {
    const images = await Promise.all(model.labels.map(label => QRCode.toDataURL(label.qr, { errorCorrectionLevel: "M", margin: 4, width: 400, color: { dark: "#0F1E3D", light: "#FFFFFF" } })));
    const pages = Array.from({ length: Math.ceil(model.labels.length / 6) }, (_, index) => model.labels.slice(index * 6, index * 6 + 6));
    document = <Document title={`Etiquetas ${model.code}`} author="DTD Cargo">{pages.map((labels, pageIndex) => <Page key={pageIndex} size="A4" style={[style.page, { fontFamily: body.family }]}><View style={style.labelGrid}>{labels.map((label, index) => <View key={label.boxCode} style={style.label} wrap={false}>{text("Shipping Mark")}<View style={style.mark}>{text(model.markbox, "mono")}</View><Image style={style.qr} src={images[pageIndex * 6 + index]} />{text(label.code, "mono")}{text(`第 ${label.boxN}/${label.totalBoxes} 箱 · Caja ${label.boxN}/${label.totalBoxes}`)}{text(label.boxCode, "mono")}<View style={style.small}>{wordmark()}{text(`Rev. ${model.revision} · ${model.folio} · V${model.versionNo}`, "mono")}</View></View>)}</View>{footer}</Page>)}</Document>;
  }
  const bytes = new Uint8Array(await renderToBuffer(document));
  const audit = (font: FontInfo) => ({ postscriptName: font.postscriptName, format: font.format, variationAxes: font.variationAxes, weightClass: font.weightClass, embedding: font.embedding });
  return { bytes, fontAudit: { cjk: audit(cjk), latin: { body: audit(body), heading: audit(heading), mono: audit(mono), brand: audit(brand) }, licenceAndServerPortabilityCertified: false } };
}
