// @vitest-environment node
import { describe, it, expect } from "vitest";

import { validateNuevoMarkbox } from "../markbox-history-types";

/**
 * El validador del formulario es un ESPEJO de las validaciones de
 * `rename_client_markbox()` (migr 0367). Existe para dar el error sin viajar a la
 * base; la base valida igual y ella es la que manda.
 *
 * ⚠️ Lo que este validador NO decide, a propósito: la familia del código. Si el
 * cliente cuelga de un aliado, su código tiene que llevar la cadena de ese
 * aliado — y eso depende de qué aliados existen, así que vive en la base, donde
 * no puede quedar desincronizado. Estos casos lo comprueban explícitamente.
 */
describe("validateNuevoMarkbox", () => {
  it("normaliza a mayúsculas y recorta espacios", () => {
    expect(validateNuevoMarkbox("  dtd-9063 ", "DTD-D000").value).toBe("DTD-9063");
    expect(validateNuevoMarkbox("dc-0001", "DTD-D000").value).toBe("DC-0001");
  });

  it("acepta las tres familias reales del sistema", () => {
    // De la casa, de aliado, y legado de forma libre (ITS-01, AD-001… existen).
    expect(validateNuevoMarkbox("DTD-9063", "X").error).toBeUndefined();
    expect(validateNuevoMarkbox("DC-FA-1232", "X").error).toBeUndefined();
    expect(validateNuevoMarkbox("ITS-05", "X").error).toBeUndefined();
  });

  it("rechaza vacío", () => {
    expect(validateNuevoMarkbox("", "DTD-9058").error).toBeTruthy();
    expect(validateNuevoMarkbox("   ", "DTD-9058").error).toBeTruthy();
    expect(validateNuevoMarkbox(null, "DTD-9058").error).toBeTruthy();
    expect(validateNuevoMarkbox(undefined, "DTD-9058").error).toBeTruthy();
  });

  it("rechaza espacios, acentos y símbolos — espejo del CHECK '^[A-Z0-9-]+$'", () => {
    expect(validateNuevoMarkbox("DTD 9063", "X").error).toBeTruthy();
    expect(validateNuevoMarkbox("DTD-906Ñ", "X").error).toBeTruthy();
    expect(validateNuevoMarkbox("DTD_9063", "X").error).toBeTruthy();
    expect(validateNuevoMarkbox("DTD/9063", "X").error).toBeTruthy();
  });

  it("rechaza más de 40 caracteres, como la base", () => {
    expect(validateNuevoMarkbox("A".repeat(40), "X").error).toBeUndefined();
    expect(validateNuevoMarkbox("A".repeat(41), "X").error).toBeTruthy();
  });

  it("⭐ rechaza el código actual, comparando ya normalizado", () => {
    // Sin normalizar, ' dtd-9058 ' pasaría como si fuera un código distinto y el
    // renombrado viajaría a la base para no hacer nada.
    expect(validateNuevoMarkbox("DTD-9058", "DTD-9058").error).toBeTruthy();
    expect(validateNuevoMarkbox(" dtd-9058 ", "DTD-9058").error).toBeTruthy();
    expect(validateNuevoMarkbox("dtd-9058", " DTD-9058 ").error).toBeTruthy();
  });

  it("NO opina sobre la familia: eso lo decide la base según el aliado del cliente", () => {
    // Un cliente de DC no puede llevar XX-0001, pero el formulario no lo sabe —
    // depende de qué aliados existan. Lo rechaza el guard de la migr 0367.
    expect(validateNuevoMarkbox("XX-0001", "DC-0001").error).toBeUndefined();
    expect(validateNuevoMarkbox("DC-0777", "DTD-9058").error).toBeUndefined();
  });
});
