// @vitest-environment node
/**
 * Contrato del enlace a la guía interactiva de Alibaba (SDD-0099).
 *
 * Por qué existe: el querystring que arma `guiaAlibabaHref` tiene que sanitizar
 * IGUAL que la guía (`public/guias/comprar-en-alibaba.html`, const URL_MARK), o
 * el cliente ve un MARKBOX distinto del suyo — y con eso su caja llega a Yiwu
 * sin poder identificarse. Si cambia una de las dos sanitizaciones, este test
 * es el que avisa.
 */

import { describe, it, expect } from "vitest";
import { guiaAlibabaHref } from "../guia-alibaba";

const BASE = "/guias/comprar-en-alibaba.html";

describe("guiaAlibabaHref", () => {
  it("sin markbox devuelve la guía pelada (modo público)", () => {
    expect(guiaAlibabaHref()).toBe(BASE);
    expect(guiaAlibabaHref("")).toBe(BASE);
    expect(guiaAlibabaHref("   ")).toBe(BASE);
  });

  it("pasa el markbox tal cual cuando ya viene con el prefijo", () => {
    expect(guiaAlibabaHref("DTD-1042")).toBe(`${BASE}?mark=DTD-1042`);
  });

  it("antepone DTD- cuando falta, igual que la guía", () => {
    expect(guiaAlibabaHref("1042")).toBe(`${BASE}?mark=DTD-1042`);
  });

  it("normaliza a mayúsculas y recorta espacios", () => {
    expect(guiaAlibabaHref("  dtd-1042  ")).toBe(`${BASE}?mark=DTD-1042`);
  });

  it("descarta lo que no sea A-Z, 0-9 o guion", () => {
    // Un mark con basura no debe viajar: la guía aplica el mismo filtro.
    expect(guiaAlibabaHref("DTD-10 42!")).toBe(`${BASE}?mark=DTD-1042`);
    expect(guiaAlibabaHref("<script>")).toBe(`${BASE}?mark=DTD-SCRIPT`);
  });

  it("suma el nombre para el saludo y lo corta en 40 caracteres", () => {
    const url = new URL(guiaAlibabaHref("DTD-1042", "  José Pérez  "), "https://dtdcargo.com");
    expect(url.searchParams.get("mark")).toBe("DTD-1042");
    expect(url.searchParams.get("name")).toBe("José Pérez");

    const largo = guiaAlibabaHref("DTD-1", "x".repeat(80));
    expect(new URL(largo, "https://dtdcargo.com").searchParams.get("name")).toHaveLength(40);
  });

  it("no manda `name` vacío", () => {
    expect(guiaAlibabaHref("DTD-1042", "   ")).toBe(`${BASE}?mark=DTD-1042`);
  });
});
