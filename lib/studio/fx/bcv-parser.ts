import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { CARACAS_TIME_ZONE, fechaCaracas, isCalendarDate, validInstant } from "@/lib/shared/fechas-caracas";
import { BcvError, decimalRateKey, type BcvQuote } from "./bcv-types";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const invalid = (): never => { throw new BcvError("SOURCE_INVALID"); };
const isElement = (node: Node): node is Element => "tagName" in node;
const attr = (node: Element, name: string) => node.attrs.find(a => a.name === name)?.value;
const hasClass = (node: Element, name: string) => (attr(node, "class") ?? "").split(/\s+/).includes(name);
const whitespace = (text: string) => text.replace(/\s+/gu, " ").trim();

function elements(node: Node): Element[] {
  if (isElement(node) && ["script", "style", "template"].includes(node.tagName)) return [];
  const children = "childNodes" in node ? node.childNodes : [];
  return [...(isElement(node) ? [node] : []), ...children.flatMap(elements)];
}

function text(node: Node): string {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  if (isElement(node) && ["script", "style", "template"].includes(node.tagName)) return "";
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}

function one<T>(items: T[]): T {
  if (items.length !== 1) return invalid();
  return items[0];
}

function valueDate(node: Element): string {
  const content = attr(node, "content");
  const match = content && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/.exec(content);
  if (!match || !isCalendarDate(match[1]) || match[2] !== "00" || match[3] !== "00" || match[4] !== "00") return invalid();
  let instant: Date;
  try { instant = validInstant(content!); } catch { return invalid(); }
  if (fechaCaracas(instant) !== match[1]) return invalid();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CARACAS_TIME_ZONE, hourCycle: "h23",
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "longOffset" }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
  if (part("timeZoneName") !== `GMT${match[5]}` || part("hour") !== match[2]
    || part("minute") !== match[3] || part("second") !== match[4]) return invalid();

  const visible = whitespace(text(node)).normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const v = /^(domingo|lunes|martes|miercoles|jueves|viernes|sabado), (\d{1,2}) (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) (\d{4})$/.exec(visible);
  if (!v) return invalid();
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const visibleDay = `${v[4]}-${String(months.indexOf(v[3]) + 1).padStart(2, "0")}-${v[2].padStart(2, "0")}`;
  if (visibleDay !== match[1] || weekdays[new Date(`${match[1]}T12:00:00Z`).getUTCDay()] !== v[1]) return invalid();
  return match[1];
}

/** Árbol inerte: cardinalidad y parentesco, sin buscar números/fechas globales. */
export function parseBcvHtml(html: string): BcvQuote {
  if (!html.trim()) return invalid();
  const blocks = elements(parse(html)).filter(n => hasClass(n, "view-tipo-de-cambio-oficial-del-bcv")
    && hasClass(n, "view-id-tipo_de_cambio_oficial_del_bcv"));
  const block = one(blocks);
  const descendants = elements(block);
  const dollar = one(descendants.filter(n => attr(n, "id") === "dolar"));
  const dollarNodes = elements(dollar);
  const label = one(dollarNodes.filter(n => n.tagName === "span" && whitespace(text(n)) !== ""));
  if (whitespace(text(label)) !== "USD") return invalid();
  const amount = one(dollarNodes.filter(n => n.tagName === "strong"));
  if (!hasClass(amount, "strong-tb")) return invalid();
  // No unir dígitos separados por markup: una estructura cambiada exige revisión.
  if (amount.childNodes.some(n => n.nodeName !== "#text")) return invalid();
  const raw = text(amount).trim();
  if (!/^[0-9]{1,12},[0-9]{1,8}$/.test(raw)) return invalid();
  const rate = raw.replace(",", ".");
  if (decimalRateKey(rate) === null) return invalid();
  const date = one(descendants.filter(n => hasClass(n, "date-display-single") || attr(n, "property") === "dc:date"));
  if (date.tagName !== "span" || !hasClass(date, "date-display-single")
    || attr(date, "property") !== "dc:date" || attr(date, "datatype") !== "xsd:dateTime") return invalid();
  // El rótulo pertenece al campo que contiene el valor, no a cualquier nota
  // del bloque. Un segundo campo rotulado, incluso pendiente, es ambiguo.
  const ownText = (node: Element) => whitespace(node.childNodes.filter(n => n.nodeName === "#text").map(text).join(""));
  const startsLabel = (node: Node) => whitespace(text(node)).startsWith("Fecha Valor:");
  // Un rótulo puede verse partido por markup inline. Excluir subcampos ya
  // rotulados evita contar sus wrappers como otro campo, sin ocultar un
  // rótulo propio anterior a un subcampo (también sería ambiguo).
  const visibleOwnLabel = (node: Element) => whitespace(node.childNodes
    .filter(child => !isElement(child) || !startsLabel(child)).map(text).join(""));
  const field = one(descendants.filter(node => visibleOwnLabel(node).startsWith("Fecha Valor:")));
  if (field.tagName !== "div" || date.parentNode !== field || ownText(field) !== "Fecha Valor:"
    || field.childNodes.some(node => isElement(node) && node !== date && node.tagName !== "hr")) return invalid();
  return Object.freeze({ currency: "VES", source: "bcv", unit: "VES/USD", rate, validOn: valueDate(date) });
}
