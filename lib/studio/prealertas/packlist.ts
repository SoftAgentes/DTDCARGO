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
 * Celdas mapeadas (template branded de SDD-0096, generado por
 * scripts/build-packlist-template.mjs · grilla de proveedor A5:O8 + folio I3):
 *   C5 = 公司名称 (Proveedor)  → nombre del proveedor
 *   C6 = 唛头 (Shipping Mark)  → MARKBOX del cliente
 *   C7 = 订单 (Compra)         → código de la compra
 *   C8 = 微信 (WeChat)         → WeChat del proveedor
 *   I3 = N.º / Folio           → código de la compra
 *
 * Pre-llenar el 唛头 elimina el paso de "confirmar la marca en el grupo de WeChat"
 * que pedía el método viejo del template.
 *
 * El template branded escribe estas celdas como sharedString con un placeholder
 * (" "), así que en el XML salen `<c r="C6" s="N" t="s"><v>4</v></c>` —el formato
 * que setInlineCell ya maneja (preserva el estilo, las vuelve inlineStr).
 *
 * Función PURA (recibe/devuelve bytes) → testeable sin red ni DB.
 */
import { printMarkbox } from "@/lib/shared/markbox-chain";
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
 * (`<c r="C6" s="20" t="s"><v>5</v></c>`). El valor vacío borra el contenido; si la celda no existe, deja el XML igual.
 */
export function setInlineCell(xml: string, ref: string, value: string): string {
  const v = (value ?? "").trim();

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
    throw new Error("Packing list template is missing its worksheet");
  }
  let xml = strFromU8(sheet);
  for (const ref of ["C6", "C7", "I3"]) {
    if (!xml.includes(`r="${ref}"`)) throw new Error(`Missing reference cell ${ref}`);
  }
  xml = setInlineCell(xml, "C5", values.supplierName); // 公司名称
  xml = setInlineCell(xml, "C6", printMarkbox(values.markbox)); // 唛头
  xml = setInlineCell(xml, "C7", values.code); // Purchase reference, never client identity.
  xml = setInlineCell(xml, "C8", values.supplierWechat); // 微信
  xml = setInlineCell(xml, "I3", values.code); // N.º / Folio
  files[SHEET_PATH] = strToU8(xml);
  return zipSync(files);
}
