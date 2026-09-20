// @vitest-environment node
/**
 * SDD-0468 · El mensaje que el cliente le manda a su proveedor chino.
 *
 * Se fija el texto completo a propósito: cambiar una palabra de este mensaje es
 * cambiar lo que lee un proveedor que no habla español, y eso tiene que pasar
 * por revisión, no colarse en un refactor.
 */
import { describe, expect, it } from "vitest";
import { buildProviderLinkMessage } from "../provider-link-message";

const URL = "https://dtdcargo.com/p/tok_demo_123";

describe("buildProviderLinkMessage", () => {
  const msg = buildProviderLinkMessage(URL);
  const lines = msg.split("\n");

  it("arma chino → enlace → español, con el texto aprobado", () => {
    expect(msg).toBe(
      [
        "您好！请打开 DTD Cargo 链接，完成 3 步：",
        "1. 在线填写装箱单和发票（也可以用 Excel）",
        "2. 打印标签，每个箱子贴一张",
        "3. 按页面上的地址，把货送到仓库",
        `链接：${URL}`,
        "",
        "Hola. Abre el enlace de DTD Cargo y completa 3 pasos:",
        "1. Llena el packing list y la factura (en línea o en Excel)",
        "2. Imprime las etiquetas y pega una en cada caja",
        "3. Envía la mercancía al almacén que indica la página",
      ].join("\n"),
    );
  });

  it("pone el enlace una sola vez, en su propia línea y antes del español", () => {
    expect(msg.split(URL)).toHaveLength(2);
    const linkLine = lines.findIndex((l) => l.includes(URL));
    const esStart = lines.findIndex((l) => l.startsWith("Hola."));
    expect(lines[linkLine]).toBe(`链接：${URL}`);
    expect(linkLine).toBeLessThan(esStart);
  });

  it("el bloque en chino no pide leer inglés: solo la marca y «Excel» van en latín", () => {
    const zhBlock = lines.slice(0, lines.findIndex((l) => l.includes(URL)));
    const latinWords = zhBlock
      .join(" ")
      .match(/[A-Za-z]+/g)
      ?.filter((w) => !["DTD", "Cargo", "Excel"].includes(w));
    expect(latinWords ?? []).toEqual([]);
  });

  it("no agrega nada distinto de la URL recibida (sin identidad del cliente)", () => {
    const other = buildProviderLinkMessage("https://x.test/p/otro");
    expect(other.replace("https://x.test/p/otro", URL)).toBe(msg);
  });
});
