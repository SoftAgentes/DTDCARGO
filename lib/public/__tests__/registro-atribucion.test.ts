/**
 * SDD-0587 (6.4) · UTM del alta. Terminan en `crm_tarjetas` y no se pisan, y la
 * entrada es un querystring público: lo que no pasa se omite, sin romper el alta.
 */
import { describe, expect, it } from "vitest";

import { CAMPOS_UTM, normalizarAtribucion, type CampoUtm } from "../registro-atribucion";

const desde = (valores: Partial<Record<CampoUtm, unknown>>) => normalizarAtribucion((campo) => valores[campo]);

describe("normalizarAtribucion", () => {
  it("toma los cinco campos, recortados", () => {
    expect(
      desde({
        utm_source: " facebook ",
        utm_medium: "cpc",
        utm_campaign: "Lanzamiento Café 2026",
        utm_content: "video_a-1",
        utm_term: "carga china",
      }),
    ).toEqual({
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "Lanzamiento Café 2026",
      utm_content: "video_a-1",
      utm_term: "carga china",
    });
  });

  it("los ids numéricos de campaña pasan: Meta los manda así", () => {
    expect(desde({ utm_campaign: "23851234567890123" }).utm_campaign).toBe("23851234567890123");
  });

  it("sin nada no devuelve nada: la tarjeta guarda null", () => {
    expect(desde({})).toEqual({});
    expect(desde({ utm_source: "   ", utm_medium: "" })).toEqual({});
  });

  it("de varios valores toma el primero, como searchParams", () => {
    expect(desde({ utm_source: ["uno", "dos"] }).utm_source).toBe("uno");
  });

  it("se recorta a 120, lo que admite la tabla", () => {
    expect(desde({ utm_term: "x".repeat(500) }).utm_term).toHaveLength(120);
  });

  it.each([
    ["un correo", "ana.sintetica@example.test"],
    ["una credencial anidada", "token=abc123"],
    ["una credencial codificada", "token%3Dabc123"],
    ["etiquetas", "<script>alert(1)</script>"],
    ["comillas", "'; drop table clients; --"],
    ["saltos de línea", "linea\nfalsa"],
  ])("%s no llega a la base", (_caso, valor) => {
    expect(desde({ utm_source: valor })).toEqual({});
  });

  it("lo que no es texto se omite; nunca lanza", () => {
    expect(desde({ utm_source: 7, utm_medium: null, utm_campaign: {}, utm_content: new File([], "x") })).toEqual({});
  });

  it("los campos son los de la tabla, y ni uno más", () => {
    expect(CAMPOS_UTM).toEqual(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
  });
});
