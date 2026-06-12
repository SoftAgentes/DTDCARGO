/**
 * SDD-0057 ext · Fase 3 — pre-llenado del template de packing list/factura por
 * compra.
 *
 * Toma el `.xlsx` base (public/templates/dtd-packing-list-invoice.xlsx) y escribe
 * los datos de la compra en sus celdas, sin tocar el formato ni el resto del
 * archivo. Un `.xlsx` es un zip de XML; usamos `fflate` para abrir/recomprimir y
 * editamos sólo `xl/worksheets/sheet1.xml`, inyectando los valores como
 * `inlineStr` (así no tocamos `sharedStrings.xml`).
 *
 * Celdas mapeadas (verificadas contra el template real, hojas A1:O58):
 *   C7  = 唛头 (Shipping Mark)  → MARKBOX del cliente
 *   C8  = 客户 (Cliente)        → nombre del cliente
 *   C6  = 公司名称 (Proveedor)  → nombre del proveedor
 *   C10 = 微信 (WeChat)         → WeChat del proveedor
 *   H12 = 参考号 (Referencia)   → código de la compra
 *
 * Pre-llenar el 唛头 elimina el paso de "confirmar la marca en el grupo de WeChat"
 * que pide el propio instructivo del template.
 *
 * Función PURA (recibe/devuelve bytes) → testeable sin red ni DB.
 */
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

const SHEET_PATH = "xl/worksheets/sheet1.xml";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Reemplaza una celda (por su ref, ej. "C7") por una celda `inlineStr` con el
 * valor, preservando el estilo (`s="…"`) original. Soporta la celda vacía
 * auto-cerrada (`<c r="C7" s="40"/>`) y la que referencia un sharedString
 * (`<c r="C6" s="20" t="s"><v>5</v></c>`). Si el valor es vacío o la celda no
 * existe, deja el XML igual.
 */
export function setInlineCell(xml: string, ref: string, value: string): string {
  const v = (value ?? "").trim();
  if (!v) return xml;
  const re = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>.*?</c>)`);
  const match = xml.match(re);
  if (!match) return xml;
  const styleMatch = match[0].match(/ s="(\d+)"/);
  const styleAttr = styleMatch ? ` s="${styleMatch[1]}"` : "";
  const cell = `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
    v,
  )}</t></is></c>`;
  return xml.replace(re, cell);
}

export type PacklistValues = {
  markbox: string;
  clientName: string;
  supplierName: string;
  supplierWechat: string;
  code: string;
};

/**
 * Pre-llena el template `.xlsx` (bytes) con los datos de la compra y devuelve el
 * nuevo `.xlsx` (bytes). No muta la entrada.
 */
export function fillPacklist(
  templateBytes: Uint8Array,
  values: PacklistValues,
): Uint8Array {
  const files = unzipSync(templateBytes);
  const sheet = files[SHEET_PATH];
  if (!sheet) {
    // Estructura inesperada → devolvemos el template tal cual (mejor que romper).
    return templateBytes;
  }
  let xml = strFromU8(sheet);
  xml = setInlineCell(xml, "C7", values.markbox); // 唛头
  xml = setInlineCell(xml, "C8", values.clientName); // 客户
  xml = setInlineCell(xml, "C6", values.supplierName); // 公司名称
  xml = setInlineCell(xml, "C10", values.supplierWechat); // 微信
  xml = setInlineCell(xml, "H12", values.code); // 参考号
  files[SHEET_PATH] = strToU8(xml);
  return zipSync(files);
}
