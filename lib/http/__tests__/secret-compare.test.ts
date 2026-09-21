// @vitest-environment node
/**
 * SDD-0499 · el comparador de secretos unificado.
 *
 * Lo sustancial que fija esta prueba no es la constancia temporal —eso no se
 * mide de forma estable en una suite— sino el **fail-closed**: sin secreto
 * configurado no pasa nadie, y en particular dos vacíos NO coinciden. Ése es el
 * modo de fallo que convierte una variable de entorno olvidada en una puerta
 * abierta, y es el que un `===` ingenuo sí dejaba pasar cuando ambos lados
 * llegaban como `""`.
 */
import { describe, it, expect } from "vitest";
import { matchesBearerSecret, sameSecret } from "@/lib/http/secret-compare";

const SECRETO = "valor-de-prueba-1234567890";

describe("sameSecret", () => {
  it("iguales → true", () => {
    expect(sameSecret(SECRETO, SECRETO)).toBe(true);
  });

  it("distintos del mismo largo → false", () => {
    expect(sameSecret(SECRETO, `${SECRETO.slice(0, -1)}X`)).toBe(false);
  });

  it("prefijo → false", () => {
    expect(sameSecret(SECRETO.slice(0, -1), SECRETO)).toBe(false);
  });

  it.each([
    ["ambos vacíos", "", ""],
    ["esperado vacío", SECRETO, ""],
    ["esperado undefined", SECRETO, undefined],
    ["esperado null", SECRETO, null],
    ["recibido vacío", "", SECRETO],
    ["recibido undefined", undefined, SECRETO],
    ["recibido null", null, SECRETO],
  ])("fail-closed · %s → false", (_caso, actual, esperado) => {
    expect(sameSecret(actual, esperado)).toBe(false);
  });

  it("distingue multibyte con el mismo número de caracteres", () => {
    expect(sameSecret("ñañaña", "nananá")).toBe(false);
  });
});

describe("matchesBearerSecret", () => {
  it("header exacto → true", () => {
    expect(matchesBearerSecret(`Bearer ${SECRETO}`, SECRETO)).toBe(true);
  });

  it("el token pelado, sin el esquema → false", () => {
    expect(matchesBearerSecret(SECRETO, SECRETO)).toBe(false);
  });

  it.each([
    ["esquema en minúscula", `bearer ${SECRETO}`],
    ["espacio de más", `Bearer  ${SECRETO}`],
    ["otro esquema", `Basic ${SECRETO}`],
    ["header ausente", null],
    ["header vacío", ""],
  ])("%s → false", (_caso, header) => {
    expect(matchesBearerSecret(header, SECRETO)).toBe(false);
  });

  it("sin secreto configurado no pasa ni un header bien formado", () => {
    expect(matchesBearerSecret("Bearer ", undefined)).toBe(false);
    expect(matchesBearerSecret("Bearer ", "")).toBe(false);
  });
});
