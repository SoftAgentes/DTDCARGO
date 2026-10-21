// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBcvHtml } from "../bcv-parser";
import { BcvError, decimalRateKey, sameDecimalRate } from "../bcv-types";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
const official = fixture("bcv-usd-20261021");

describe("B1–B3 · BCV estructural y decimal exacto", () => {
  it.each(["bcv-usd-20261021", "bcv-decoys"])("lee solo VES/USD y fecha del bloque: %s", (name) => {
    expect(parseBcvHtml(fixture(name))).toEqual({ currency: "VES", source: "bcv", unit: "VES/USD",
      rate: "883.39630000", validOn: "2026-10-21" });
  });
  it("rechaza USD duplicado", () => expect(() => parseBcvHtml(fixture("bcv-ambiguous"))).toThrow(BcvError));
  it.each(["12:00:00", "01:00:00", "00:00:01", "00:00:00.001"])("F01 · exige medianoche IANA, rechaza hora %s", (hour) => {
    const changed = official.replace('content="2026-10-21T00:00:00-04:00"', `content="2026-10-21T${hour}-04:00"`);
    expect(changed).not.toBe(official);
    expect(() => parseBcvHtml(changed)).toThrow(BcvError);
  });
  it("F01 · conserva medianoche y weekday en día bisiesto válido", () => {
    const leap = official.replace("2026-10-21T00:00:00-04:00", "2024-02-29T00:00:00-04:00")
      .replace("Miércoles, 21 Octubre  2026", "Jueves, 29 Febrero 2024");
    expect(parseBcvHtml(leap).validOn).toBe("2024-02-29");
  });
  it.each(["pending-with-update", "duplicate-label", "label-in-note"])("F02 · Fecha Valor inequívoca: %s", (variant) => {
    const date = official.match(/<span class="date-display-single"[\s\S]*?<\/span>/)?.[0];
    expect(date).toBeDefined();
    const changedField = variant === "pending-with-update"
      ? `<div>Fecha Valor: pendiente</div><div>Última actualización: ${date}</div>`
      : variant === "duplicate-label"
        ? `<div>Fecha Valor: pendiente</div><div>Fecha Valor: ${date}</div>`
        : `<div>Nota sobre Fecha Valor: no disponible</div><div>Última actualización: ${date}</div>`;
    const changed = official.replace(/<div class="pull-right dinpro center">[\s\S]*?<\/div>/, changedField);
    expect(changed).not.toBe(official);
    expect(() => parseBcvHtml(changed)).toThrow(BcvError);
  });
  it("F02 · conserva el campo oficial con entidades y whitespace", () => {
    const changed = official.replace("Fecha Valor:", "Fecha&nbsp;Valor&#58;")
      .replace("Miércoles, 21", "Miércoles,&#32;21");
    expect(parseBcvHtml(changed).validOn).toBe("2026-10-21");
  });
  it.each([
    official + official,
    official.replace("view-id-tipo_de_cambio_oficial_del_bcv", "vista-cambiada"),
    official.replace("id=\"dolar\"", "id=\"otro\""),
    official.replace(" USD", " EUR"),
    official.replace('class="strong-tb"', 'class="valor-nuevo"'),
    official.replace('content="2026-10-21T00:00:00-04:00"', ""),
    official.replace("Miércoles, 21", "Miércoles, 22"),
    official.replace("Miércoles", "Jueves"),
    official.replace("</strong>", '</strong><strong>999,00</strong>'),
    official.replace(" USD</span>", " USD</span><span>EUR</span>"),
    official.replace("<hr>", '<span class="date-display-single">otra fecha</span><hr>'),
    official.replaceAll("2026-10-21", "2026-02-30"),
    official.replace("-04:00", "-03:00"),
    official.replace("<strong class=\"strong-tb\">883,39630000</strong>", '<strong class="strong-tb">883,39<span>630000</span></strong>'),
  ])("cierra ante cardinalidad/markup/fecha contradictorios", (html) => {
    expect(() => parseBcvHtml(html)).toThrow(BcvError);
  });
  it.each(["0,00000000", "-1,00", "+1,00", "NaN", "Infinity", "1e3", "1.234,56", "1.25",
    "883,396300001", "1000000000000,00", "1,2 3", "1,2USD", "1", "1,", ",25"])("rechaza %s", (rate) => {
    expect(() => parseBcvHtml(official.replace("883,39630000", rate))).toThrow(BcvError);
  });
  it.each(["0,00000001", "999999999999,99999999", "1,0"])("preserva completo %s", (rate) => {
    expect(parseBcvHtml(official.replace("883,39630000", rate)).rate).toBe(rate.replace(",", "."));
  });
  it("compara por valor sin perder el último decimal ni causar churn por ceros", () => {
    expect(sameDecimalRate("883.39630000", "883.3963")).toBe(true);
    expect(sameDecimalRate("999999999999.99999999", "999999999999.99999998")).toBe(false);
    expect(decimalRateKey("0.00000001")).toBe("1");
    expect(decimalRateKey("1000000000000")).toBeNull();
    expect(decimalRateKey(883.3963)).toBeNull();
  });
});
