import { describe, expect, it } from "vitest";
import {
  extensionOf,
  formatBytes,
  formatDimensions,
  isBrandTile,
  tileBackground,
  type BrandAsset,
} from "../catalog-types";

function asset(over: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: "a",
    title: "Isólogo",
    subtitle: null,
    kind: "logo",
    mime: "image/png",
    bytes: 1024,
    width: null,
    height: null,
    tile: "auto",
    storagePath: "t/marca/logos/isologo.png",
    ...over,
  };
}

describe("tileBackground", () => {
  it("respeta el tile explícito y no mira el nombre", () => {
    // El nombre dice "primary" (claro) pero el tile dice oscuro: manda el tile.
    // Ésta es la razón de existir de la columna (migr 0335).
    const a = asset({ tile: "dark", title: "Isólogo Primary", storagePath: "x/primary.png" });
    expect(tileBackground(a)).toBe("var(--color-ink)");
  });

  it("light y checker devuelven fondos distintos", () => {
    expect(tileBackground(asset({ tile: "light" }))).toBe("var(--color-paper)");
    expect(tileBackground(asset({ tile: "checker" }))).toContain("repeating-conic-gradient");
  });

  it("con auto, cae a la heurística por nombre (comportamiento previo a 0335)", () => {
    expect(tileBackground(asset({ tile: "auto", title: "Isólogo Reverse" }))).toBe(
      "var(--color-ink)",
    );
    expect(tileBackground(asset({ tile: "auto", title: "Isólogo Primary" }))).toBe(
      "var(--color-paper)",
    );
  });

  it("documenta el fallo que la columna vino a resolver", () => {
    // Un nombre libre que SÍ es para fondo oscuro pero no matchea la heurística:
    // con `auto` el logo blanco se pinta sobre papel blanco. Con `dark` explícito
    // se ve. Este test fija por qué no alcanza con adivinar por el nombre.
    const suelto = asset({ tile: "auto", title: "Marca en negativo", storagePath: "x/neg.png" });
    expect(tileBackground(suelto)).toBe("var(--color-paper)");

    const clasificado = { ...suelto, tile: "dark" as const };
    expect(tileBackground(clasificado)).toBe("var(--color-ink)");
  });
});

describe("formatDimensions", () => {
  it("necesita las dos", () => {
    expect(formatDimensions(741, 764)).toBe("741 × 764");
    expect(formatDimensions(741, null)).toBeNull();
    expect(formatDimensions(null, 764)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("usa coma decimal (español venezolano)", () => {
    expect(formatBytes(1024 * 1024 * 1.4)).toBe("1,4 MB");
  });

  it("escala y tolera nulos", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
  });
});

describe("extensionOf", () => {
  it("saca la extensión del nombre, no de la ruta", () => {
    expect(extensionOf("t/marca/logos/isologo.png")).toBe("PNG");
    expect(extensionOf("t/marca/x/archivo.tar.gz")).toBe("GZ");
  });

  it("null cuando no hay extensión utilizable", () => {
    expect(extensionOf("t/marca/x/sinpunto")).toBeNull();
    expect(extensionOf("t/marca/x/termina.")).toBeNull();
    expect(extensionOf("t/marca/x/.oculto")).toBeNull();
  });
});

describe("isBrandTile", () => {
  it("sólo los cuatro del CHECK de la migración", () => {
    for (const ok of ["auto", "light", "dark", "checker"]) {
      expect(isBrandTile(ok)).toBe(true);
    }
    for (const bad of ["transparente", "", null, undefined, 3]) {
      expect(isBrandTile(bad)).toBe(false);
    }
  });
});
