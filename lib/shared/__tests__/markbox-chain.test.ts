// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  parseMarkbox,
  buildMarkbox,
  printMarkbox,
  displayMarkbox,
  hidesRootPrefix,
} from "../markbox-chain";

describe("parseMarkbox", () => {
  it("descompone un cliente directo de la casa", () => {
    expect(parseMarkbox("DTD-9058")).toEqual({
      prefixes: ["DTD"],
      seq: 9058,
      padded: "9058",
    });
  });

  it("descompone un cliente de aliado raíz", () => {
    expect(parseMarkbox("HR-0001")).toEqual({
      prefixes: ["HR"],
      seq: 1,
      padded: "0001",
    });
  });

  it("descompone la cadena de un sub-aliado", () => {
    expect(parseMarkbox("DC-FA-1232")).toEqual({
      prefixes: ["DC", "FA"],
      seq: 1232,
      padded: "1232",
    });
  });

  it("normaliza espacios y minúsculas", () => {
    expect(parseMarkbox("  dc-fa-1232 ")?.prefixes).toEqual(["DC", "FA"]);
  });

  it("NO reconoce los códigos de vendedor del legado — no son cadenas de aliado", () => {
    // A=Darilis, J=José, D=Darín, Y=Yeglenis, P=Pedro. Práctica descontinuada:
    // esas 361 fichas son clientes directos de DTD, no de un aliado.
    expect(parseMarkbox("DTD-A101")).toBeNull();
    expect(parseMarkbox("DTD-J044")).toBeNull();
  });

  it("devuelve null para basura y para vacío", () => {
    expect(parseMarkbox("bncvcc")).toBeNull();
    expect(parseMarkbox("DTD-LEG-SN02")).toBeNull();
    expect(parseMarkbox("DTD-A102-")).toBeNull();
    expect(parseMarkbox("")).toBeNull();
    expect(parseMarkbox(null)).toBeNull();
    expect(parseMarkbox(undefined)).toBeNull();
  });

  it("exige entre 2 y 4 letras por segmento", () => {
    expect(parseMarkbox("H-0001")).toBeNull();
    expect(parseMarkbox("HERNEKA-0001")).toBeNull();
  });
});

describe("buildMarkbox", () => {
  it("arma la forma guardada con relleno a 4", () => {
    expect(buildMarkbox(["HR"], 1)).toBe("HR-0001");
    expect(buildMarkbox(["DC", "FA"], 8)).toBe("DC-FA-0008");
  });

  it("no recorta cuando el correlativo pasa de 4 dígitos", () => {
    expect(buildMarkbox(["HR"], 10234)).toBe("HR-10234");
  });

  it("es el espejo de parseMarkbox", () => {
    const code = buildMarkbox(["DC", "FA"], 1232);
    expect(parseMarkbox(code)).toEqual({
      prefixes: ["DC", "FA"],
      seq: 1232,
      padded: "1232",
    });
  });
});

describe("printMarkbox — la forma que sale en los documentos", () => {
  it("⭐ oculta el segmento raíz de un sub-aliado", () => {
    // El cliente de FA no debe ver DC. Es el pedido explícito del founder y el
    // punto que el caso Greaves señala como debilitante de la defensa.
    expect(printMarkbox("DC-FA-1232")).toBe("FA-1232");
  });

  it("deja igual a un cliente de aliado raíz", () => {
    expect(printMarkbox("HR-0001")).toBe("HR-0001");
  });

  it("deja igual a un cliente directo de la casa", () => {
    expect(printMarkbox("DTD-9058")).toBe("DTD-9058");
  });

  it("conserva el relleno original", () => {
    expect(printMarkbox("DC-FA-0008")).toBe("FA-0008");
  });

  it("devuelve tal cual lo que no es una cadena reconocible", () => {
    // Los códigos de vendedor del legado se imprimen como siempre.
    expect(printMarkbox("DTD-A101")).toBe("DTD-A101");
    expect(printMarkbox("bncvcc")).toBe("bncvcc");
  });

  it("devuelve cadena vacía para vacío o nulo, nunca 'undefined'", () => {
    expect(printMarkbox(null)).toBe("");
    expect(printMarkbox(undefined)).toBe("");
    expect(printMarkbox("")).toBe("");
  });

  it("baja de nivel con cadenas más profundas", () => {
    expect(printMarkbox("DC-FA-XY-0003")).toBe("XY-0003");
  });
});

describe("displayMarkbox — la forma que ve el equipo de DTD", () => {
  it("conserva la cadena completa", () => {
    expect(displayMarkbox("DC-FA-1232")).toBe("DC-FA-1232");
  });

  it("normaliza sin perder segmentos", () => {
    expect(displayMarkbox(" dc-fa-1232 ")).toBe("DC-FA-1232");
  });

  it("nunca coincide con printMarkbox cuando hay raíz que ocultar", () => {
    expect(displayMarkbox("DC-FA-1232")).not.toBe(printMarkbox("DC-FA-1232"));
  });
});

describe("hidesRootPrefix", () => {
  it("es cierto sólo para clientes de sub-aliado", () => {
    expect(hidesRootPrefix("DC-FA-1232")).toBe(true);
    expect(hidesRootPrefix("HR-0001")).toBe(false);
    expect(hidesRootPrefix("DTD-9058")).toBe(false);
    expect(hidesRootPrefix("DTD-A101")).toBe(false);
    expect(hidesRootPrefix(null)).toBe(false);
  });
});
