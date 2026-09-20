// @vitest-environment node
/**
 * SDD-0298 · El documento fiscal del cliente en la factura.
 *
 * Lo que se prueba es lo que puede salir MAL IMPRESO en un documento fiscal:
 * la etiqueta y el criterio de "no hay nada que imprimir". Poner "RIF" sobre
 * una cédula no es un detalle de estilo — identifica mal al contribuyente.
 */

import { describe, it, expect } from "vitest";
import {
  etiquetaDocumento,
  lineaDocumentoCliente,
} from "../invoice-client-doc";

describe("etiquetaDocumento", () => {
  it("🔴 una empresa lleva RIF y una persona lleva Cédula", () => {
    // Cruzarlas identifica mal al contribuyente: es un error fiscal, no
    // cosmético.
    expect(etiquetaDocumento("empresa")).toBe("RIF");
    expect(etiquetaDocumento("persona")).toBe("Cédula");
  });

  it("sin tipo NO adivina: cae a una etiqueta neutra", () => {
    // El tipo puede faltar en clientes viejos. Asumir "RIF" por ser el caso
    // más común imprimiría una etiqueta falsa sin que nadie se entere.
    expect(etiquetaDocumento(null)).toBe("Documento");
    expect(etiquetaDocumento(undefined)).toBe("Documento");
    expect(etiquetaDocumento("")).toBe("Documento");
    expect(etiquetaDocumento("otra_cosa")).toBe("Documento");
  });
});

describe("lineaDocumentoCliente", () => {
  it("arma el renglón con la etiqueta que corresponde", () => {
    expect(lineaDocumentoCliente("J-12345678-9", "empresa")).toBe("RIF: J-12345678-9");
    expect(lineaDocumentoCliente("V-12345678", "persona")).toBe("Cédula: V-12345678");
  });

  it("🔴 sin número NO hay línea, aunque venga el tipo", () => {
    // "RIF" solo no identifica a nadie, y una etiqueta colgando en un
    // documento fiscal se lee como un dato que se perdió.
    expect(lineaDocumentoCliente(null, "empresa")).toBeNull();
    expect(lineaDocumentoCliente("", "empresa")).toBeNull();
    expect(lineaDocumentoCliente("   ", "persona")).toBeNull();
    expect(lineaDocumentoCliente(undefined, undefined)).toBeNull();
  });

  it("con número pero sin tipo imprime igual, con etiqueta neutra", () => {
    // Es mejor mostrar el número que ocultarlo: el contador reconoce un
    // J-xxxxx a simple vista, pero no puede adivinar un dato ausente.
    expect(lineaDocumentoCliente("J-12345678-9", null)).toBe("Documento: J-12345678-9");
  });
});
