// @vitest-environment node
import { describe, expect, it } from "vitest";
import { claveProyecto, sePublica, tipoBase, tipoDeContenido } from "../proyecto";

describe("claveProyecto", () => {
  // El fallo real que esto previene: Supabase Storage rechaza con «Invalid key»
  // todo lo que no sea ASCII, y los nombres de Cloud Design vienen con `·` y
  // acentos. En la primera subida pasaron los 140 binarios y fallaron los 45
  // documentos, que son justo los que hacen navegable el sistema.
  it("produce claves ASCII aunque el nombre traiga acentos y punto medio", () => {
    const clave = claveProyecto("Manual de Producción · DTD-Cargo.html");

    expect(clave).toMatch(/^[A-Za-z0-9._/-]+$/);
    expect(clave).toContain("produccion");
    expect(clave.endsWith(".html")).toBe(true);
  });

  it("conserva la estructura de carpetas", () => {
    // Aplanarla rompería los enlaces relativos entre documentos, que es lo
    // único que hace que el book navegue sin reescribir un href.
    expect(claveProyecto("assets/photo-editorial/humana-01.png").split("/")).toHaveLength(3);
  });

  it("es determinista — los dos lados calculan la misma clave", () => {
    // Si la subida y el servido no coincidieran, la subida diría "listo" y el
    // visor daría 404 en todo: el fallo más caro de diagnosticar de los dos.
    expect(claveProyecto("Logo Oficial.html")).toBe(claveProyecto("Logo Oficial.html"));
  });

  it("distingue el mismo nombre en carpetas distintas", () => {
    expect(claveProyecto("logo/icono.png")).not.toBe(claveProyecto("fotos/icono.png"));
  });

  it("distingue nombres que translitera igual", () => {
    // "Ficha 3D · x" y "Ficha 3D - x" colapsan al mismo texto ASCII; el hash de
    // la ruta completa es lo que evita que uno pise al otro en el bucket.
    expect(claveProyecto("Ficha 3D · x.html")).not.toBe(claveProyecto("Ficha 3D - x.html"));
  });
});

describe("sePublica", () => {
  it("publica el material de marca", () => {
    expect(sePublica("Brand Book DTD v5.0.html")).toBe(true);
    expect(sePublica("Logo Oficial.html")).toBe(true);
    expect(sePublica("packaging/Packaging Logístico · DTD-Cargo.html")).toBe(true);
  });

  it("deja fuera el producto — /marca se le pasa a diseño externo", () => {
    expect(sePublica("DTD Studio · ERP.html")).toBe(false);
    expect(sePublica("Operario · App.html")).toBe(false);
    expect(sePublica("erp-mockups-v5/01-dashboard.html")).toBe(false);
    expect(sePublica("_web-maquetas/Home Web · DTD-Cargo.html")).toBe(false);
  });

  it("no excluye el documento principal por parecerse a un patrón", () => {
    // Regresión: la primera clasificación usaba subcadenas y `"0"` matcheó
    // `Brand Book DTD v5.0.html`, dejando fuera el índice de todo el sistema.
    expect(sePublica("Brand Book DTD v5.0.html")).toBe(true);
  });
});

describe("tipoDeContenido / tipoBase", () => {
  it("declara UTF-8 al servir para que los acentos no salgan mojibake", () => {
    expect(tipoDeContenido("x.html")).toBe("text/html; charset=utf-8");
  });

  it("quita el charset para subir — Storage lo rechaza", () => {
    expect(tipoBase("x.html")).toBe("text/html");
  });

  it("lo desconocido se baja, no se adivina", () => {
    expect(tipoDeContenido("x.rareza")).toBe("application/octet-stream");
  });
});
