import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOTOS_PROPIAS_REVISADAS,
  esEnlaceDeOrigen,
  esUrlDePortadaPermitida,
  evaluarPortada,
  nombraMarcaAnterior,
  urlNombraMarcaAnterior,
  portadaDeRegistro,
  type PortadaDeclarada,
} from "../portada";

const valida: PortadaDeclarada = {
  url: "/fotos/dtd-cargo-camion-entrega.webp",
  alt: "Camión de DTD Cargo",
  origen: "propia",
  credito: null,
  licencia: "Foto propia de DTD Cargo",
  enlaceOrigen: null,
  licenciaVerificadaEn: "2026-11-15T12:00:00Z",
};

describe("SDD-0611 §11.5 · URL de portada permitida", () => {
  it.each([
    "/fotos/dtd-cargo-camion-entrega.webp",
    "/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg",
    "https://abcdefgh.supabase.co/storage/v1/object/public/noticias/foto-1.webp",
  ])("acepta %s", (url) => expect(esUrlDePortadaPermitida(url)).toBe(true));

  it.each([
    ["https://otro.example/x.jpg", "host ajeno"],
    ["https://supabase.co.otro.example/storage/v1/object/public/x.jpg", "host que solo contiene supabase.co"],
    ["http://abcdefgh.supabase.co/storage/v1/object/public/x.jpg", "sin https"],
    ["https://abcdefgh.supabase.co:8443/storage/v1/object/public/x.jpg", "con puerto"],
    ["https://u:p@abcdefgh.supabase.co/storage/v1/object/public/x.jpg", "con credenciales"],
    ["https://abcdefgh.supabase.co/storage/v1/object/public/x.jpg?token=1", "con query"],
    ["https://abcdefgh.supabase.co/storage/v1/object/sign/x.jpg", "ruta que no es pública"],
    ["//otro.example/x.jpg", "protocolo relativo"],
    ["/otra/x.jpg", "ruta fuera de /fotos"],
    ["/fotos/dtd-cargo-recepcion-contenedor.webp", "camisa con la marca anterior, sin nombrarla"],
    ["/fotos/puerto-venezuela-aduana-entrega-final-dtd-cargo.jpg", "gorra y camisa con la marca anterior"],
    ["/fotos/dtd-cargo-descarga-bodega.webp", "dudosa (logo sin confirmar)"],
    ["/fotos/dtd-cargo-atencion-mapa.webp", "dudosa (logo sin confirmar)"],
    ["/fotos/dtd-cargo-equipo-oficina.webp", "no revisada"],
    ["/fotos/propia.jpg", "fuera de la lista cerrada"],
    ["/fotos/../secreto.jpg", "con .."],
    ["/fotos//x.jpg", "con //"],
    ["/fotos/foto.svg", "extensión no admitida"],
    ["javascript:alert(1)", "esquema peligroso"],
    ["", "vacía"],
    [null, "nula"],
  ])("rechaza %s (%s)", (url, _motivo) => expect(esUrlDePortadaPermitida(url as string)).toBe(false));

  it("rechaza la marca anterior en cualquier forma", () => {
    for (const u of [
      "/fotos/precinto-doortudoor-contenedor.jpg",
      "/fotos/equipo-door-to-door.webp",
      "/fotos/door%20to%20door.webp",
      "/fotos/DoorToDoor.JPG",
      "/fotos/door2door.png",
      "https://abcdefgh.supabase.co/storage/v1/object/public/doortudoor/x.jpg",
    ]) {
      expect(esUrlDePortadaPermitida(u), u).toBe(false);
      expect(nombraMarcaAnterior(u), u).toBe(true);
    }
    expect(urlNombraMarcaAnterior("/fotos/dtd-cargo-puerta-a-puerta-china-venezuela.jpg")).toBe(false);
    expect(urlNombraMarcaAnterior("/fotos/%E0%A4%A.jpg")).toBe(true); // URL no decodificable: falla cerrado
    expect(urlNombraMarcaAnterior("/fotos/door%20to%20door.webp")).toBe(true);
  });
});

describe("SDD-0611 §11.5 · la marca anterior en textos (no se decodifican)", () => {
  it.each(["Foto 100% propia", "Carga al 50%", "Descuento del 20 % en fletes", "100%", "%", "Equipo %E0 de DTD"])(
    "«%s» no es la marca anterior",
    (t) => expect(nombraMarcaAnterior(t)).toBe(false),
  );
  it.each(["Equipo DoorTuDoor", "DOOR-TO-DOOR", "door to door 100%", "Foto 100% de Door2Door"])(
    "«%s» sí",
    (t) => expect(nombraMarcaAnterior(t)).toBe(true),
  );
  it("una portada con «%» en alt, crédito y licencia se usa", () => {
    const r = evaluarPortada({
      url: "/fotos/dtd-cargo-camion-entrega.webp", origen: "propia", alt: "Carga al 50%", credito: "Foto 100% propia",
      licencia: "Propia 100%", licenciaVerificadaEn: "2026-11-15T12:00:00Z",
    });
    expect(r.usa).toBe(true);
    expect(
      portadaDeRegistro({
        cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp", cover_alt: "Carga al 50%",
        cover_credit: "Foto 100% propia", cover_license: "Propia 100%",
      }),
    ).not.toBeNull();
  });
  it("la marca anterior en la licencia descarta la portada", () => {
    const r = evaluarPortada({
      url: "/fotos/dtd-cargo-camion-entrega.webp", origen: "propia", licencia: "Propia de DoorTuDoor",
      licenciaVerificadaEn: "2026-11-15T12:00:00Z",
    });
    expect(r.usa).toBe(false);
    if (!r.usa) expect(r.motivos).toContain("portada:marca_anterior");
  });
});

describe("SDD-0611 §11.5 · lista cerrada de fotos propias", () => {
  it("tiene las 5 revisadas, todas existen y ninguna es de las excluidas o dudosas", () => {
    expect(FOTOS_PROPIAS_REVISADAS).toHaveLength(5);
    for (const f of FOTOS_PROPIAS_REVISADAS) {
      expect(esUrlDePortadaPermitida(f), f).toBe(true);
      expect(existsSync(join(process.cwd(), "public", f)), f).toBe(true);
    }
    for (const fuera of ["recepcion-contenedor", "aduana-entrega-final", "descarga-bodega", "atencion-mapa"]) {
      for (const f of FOTOS_PROPIAS_REVISADAS) expect(f).not.toContain(fuera);
    }
  });
});

describe("SDD-0611 §11.5 · evaluarPortada", () => {
  it("sin foto declarada no hay nada que decidir", () => {
    expect(evaluarPortada(null)).toEqual({ usa: false, declarada: false, motivos: [] });
    expect(evaluarPortada({ url: "  " })).toEqual({ usa: false, declarada: false, motivos: [] });
  });

  it("una portada completa se usa", () => {
    const r = evaluarPortada(valida);
    expect(r.usa).toBe(true);
    if (r.usa) expect(r.portada.licencia).toBe("Foto propia de DTD Cargo");
  });

  it("foto de la fuente con licencia y enlace de origen", () => {
    const r = evaluarPortada({
      ...valida, origen: "fuente", licencia: "CC BY 4.0", credito: "Autoría",
      enlaceOrigen: "https://fuente.example/foto",
    });
    expect(r.usa).toBe(true);
  });

  const casos: Array<[string, Partial<PortadaDeclarada>, string]> = [
    ["sin licencia", { licencia: null }, "portada:sin_licencia"],
    ["licencia en blanco", { licencia: "   " }, "portada:sin_licencia"],
    ["licencia sin comprobar", { licenciaVerificadaEn: null }, "portada:licencia_sin_comprobar"],
    ["fecha de comprobación ilegible", { licenciaVerificadaEn: "ayer" }, "portada:licencia_sin_comprobar"],
    ["origen inventado", { origen: "inventado" }, "portada:origen"],
    ["sin origen", { origen: null }, "portada:origen"],
    ["fuente sin enlace de origen", { origen: "fuente" }, "portada:sin_enlace_de_origen"],
    ["banco con enlace http", { origen: "banco", enlaceOrigen: "http://banco.example/x" }, "portada:sin_enlace_de_origen"],
    ["host ajeno", { url: "https://otro.example/x.jpg" }, "portada:url"],
    ["marca anterior", { url: "/fotos/precinto-doortudoor-x.jpg" }, "portada:marca_anterior"],
    ["foto propia fuera de la lista", { url: "/fotos/dtd-cargo-recepcion-contenedor.webp" }, "portada:url"],
    ["marca anterior en el alt", { alt: "Equipo DoorTuDoor" }, "portada:marca_anterior"],
    ["marca anterior en el crédito", { credito: "DOOR-TO-DOOR" }, "portada:marca_anterior"],
    ["marca anterior en el enlace de origen", { origen: "fuente", enlaceOrigen: "https://doortudoor.com/f" }, "portada:marca_anterior"],
    ["fecha de comprobación futura", { licenciaVerificadaEn: "2999-01-01T00:00:00Z" }, "portada:licencia_sin_comprobar"],
    ["alt demasiado largo", { alt: "a".repeat(201) }, "portada:campo_invalido"],
    ["licencia demasiado larga", { licencia: "L".repeat(121) }, "portada:campo_invalido"],
  ];
  it.each(casos)("se descarta: %s", (_n, cambio, motivo) => {
    const r = evaluarPortada({ ...valida, ...cambio });
    expect(r.usa).toBe(false);
    if (!r.usa) {
      expect(r.declarada).toBe(true);
      expect(r.motivos).toContain(motivo);
    }
  });

  it("piso: hay al menos 17 casos de descarte", () => {
    expect(casos.length).toBeGreaterThanOrEqual(17);
  });
});

describe("SDD-0611 §11.5 · portadaDeRegistro (lo que pinta el sitio)", () => {
  it("usa la portada con licencia", () => {
    const p = portadaDeRegistro({
      cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp",
      cover_license: "CC BY 4.0",
      cover_credit: "Autoría",
      cover_source_url: "https://fuente.example/foto",
    });
    expect(p).toMatchObject({ src: "/fotos/dtd-cargo-camion-entrega.webp", licencia: "CC BY 4.0", credito: "Autoría" });
    expect(p?.enlaceOrigen).toBe("https://fuente.example/foto");
  });

  it("sin licencia, con URL ajena o con la marca anterior, no hay portada propia", () => {
    expect(portadaDeRegistro({ cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp" })).toBeNull();
    expect(portadaDeRegistro({ cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp", cover_license: " " })).toBeNull();
    expect(portadaDeRegistro({ cover_image_url: "https://otro.example/a.jpg", cover_license: "CC0" })).toBeNull();
    expect(portadaDeRegistro({ cover_image_url: "/fotos/doortudoor.jpg", cover_license: "CC0" })).toBeNull();
    expect(portadaDeRegistro({})).toBeNull();
    expect(portadaDeRegistro({ cover_image_url: "/fotos/dtd-cargo-recepcion-contenedor.webp", cover_license: "Propia" })).toBeNull();
    for (const campo of ["cover_alt", "cover_credit", "cover_license"] as const) {
      expect(
        portadaDeRegistro({ cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp", cover_license: "CC0", [campo]: "DoorTuDoor" }),
        campo,
      ).toBeNull();
    }
  });

  it("un enlace de origen que no es https no se muestra", () => {
    const p = portadaDeRegistro({
      cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp", cover_license: "CC0", cover_source_url: "javascript:alert(1)",
    });
    expect(p?.enlaceOrigen).toBeNull();
    expect(esEnlaceDeOrigen("javascript:alert(1)")).toBe(false);
  });
});
