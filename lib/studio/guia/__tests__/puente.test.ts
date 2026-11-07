/**
 * SDD-0589 · paso 9.4 · lado Studio del puente con el panel de Chatwoot:
 * archivo de selectores, mensajes y paso de coordenadas. Puro, sin DOM.
 */
import { describe, expect, it } from "vitest";
import {
  cajaEnPagina,
  leerMensajePanel,
  MAX_ANCLAS,
  pedidoMirar,
  pedidoMostrar,
  PEDIDO_PARAR,
  SELECTORES_CHATWOOT,
  validarSelectores,
  type ArchivoSelectores,
} from "../puente-chatwoot";
import { ANCLA_MARCO_BANDEJA, RECORRIDO_BANDEJA } from "../recorridos";

const BASE = SELECTORES_CHATWOOT;
const con = (anclas: ArchivoSelectores["anclas"], version = BASE.version): ArchivoSelectores => ({
  version,
  medido: BASE.medido,
  anclas,
});

describe("archivo de selectores (un solo archivo)", () => {
  it("es válido y nombra la versión de Chatwoot medida", () => {
    expect(validarSelectores(BASE)).toEqual([]);
    expect(BASE.version).toBe("v4.19.1-ce");
    expect(BASE.medido).toMatch(/NV/);
  });

  it("cada ancla de Chatwoot del recorrido Bandeja está en el archivo, y nada sobra", () => {
    // Los pasos de Chatwoot caen al marco; U1 es de Studio (Vínculos) y no lo necesita.
    const deChatwoot = RECORRIDO_BANDEJA.pasos.filter((p) => p.respaldo === ANCLA_MARCO_BANDEJA);
    expect(Object.keys(BASE.anclas).sort()).toEqual(deChatwoot.map((p) => p.ancla).sort());
    expect(RECORRIDO_BANDEJA.pasos.filter((p) => !deChatwoot.includes(p)).map((p) => p.id)).toEqual(["U1"]);
  });

  it("detecta selectores vacíos, largos o de más, anclas mal escritas y versión rara", () => {
    const s = BASE.anclas["bandeja.composer"];
    expect(validarSelectores(con({ ...BASE.anclas, "MAL.ancla": s }))).toContain("ancla inválida: «MAL.ancla»");
    expect(validarSelectores(con({ "a.b": { ...s, css: [] } }))[0]).toMatch(/entre 1 y 4/);
    expect(validarSelectores(con({ "a.b": { ...s, css: ["a", "b", "c", "d", "e"] } }))[0]).toMatch(/entre 1 y 4/);
    expect(validarSelectores(con({ "a.b": { ...s, css: ["x".repeat(201)] } }))[0]).toMatch(/200/);
    expect(validarSelectores(con({ "a.b": { ...s, cerca: "button)" } }))[0]).toMatch(/cerca/);
    expect(validarSelectores(con({ "a.b": { ...s, condicion: "" } }))[0]).toMatch(/condición/);
    expect(validarSelectores(con(BASE.anclas, "latest"))).toContain("versión de Chatwoot inválida");
    const muchas = Object.fromEntries(Array.from({ length: MAX_ANCLAS + 1 }, (_, i) => [`a.b${i}`, s]));
    expect(validarSelectores(con(muchas))).toContain(`más de ${MAX_ANCLAS} anclas`);
  });
});

describe("mensajes a Chatwoot", () => {
  it("«mirar» lleva todas las anclas con sus selectores y solo `cerca` cuando lo hay", () => {
    const m = pedidoMirar();
    expect(m.evento).toBe("dtd:guia:mirar");
    expect(Object.keys(m.anclas)).toHaveLength(Object.keys(BASE.anclas).length);
    expect(m.anclas["bandeja.composer"]).toEqual({ css: [...BASE.anclas["bandeja.composer"].css] });
    expect(m.anclas["bandeja.plantillas"]).toEqual({ css: [...BASE.anclas["bandeja.plantillas"].css], cerca: "button" });
    // No viajan la condición ni la fuente: el script no las necesita.
    expect(JSON.stringify(m)).not.toMatch(/condicion|fuente|obligatoria/);
  });

  it("«mostrar» y «parar»", () => {
    expect(pedidoMostrar("bandeja.composer", false)).toEqual({ evento: "dtd:guia:mostrar", ancla: "bandeja.composer", suave: false });
    expect(PEDIDO_PARAR).toEqual({ evento: "dtd:guia:parar" });
  });
});

describe("mensajes de Chatwoot", () => {
  it("lee «listo» y las cajas, como texto o como objeto", () => {
    expect(leerMensajePanel(JSON.stringify({ evento: "dtd:guia:listo" }))).toEqual({ tipo: "listo" });
    const r = leerMensajePanel({
      evento: "dtd:guia:cajas",
      cajas: { "bandeja.composer": { top: 1, left: 2, width: 3, height: 4 }, "bandeja.plantillas": null },
    });
    expect(r).toEqual({
      tipo: "cajas",
      cajas: new Map([
        ["bandeja.composer", { top: 1, left: 2, width: 3, height: 4 }],
        ["bandeja.plantillas", null],
      ]),
    });
  });

  it("descarta anclas que no están en el archivo y cajas que no son números finitos", () => {
    const r = leerMensajePanel({
      evento: "dtd:guia:cajas",
      cajas: {
        "otra.ancla": { top: 1, left: 1, width: 1, height: 1 },
        "bandeja.composer": { top: "1", left: 1, width: 1, height: 1 },
        "bandeja.buscar": { top: Number.NaN, left: 1, width: 1, height: 1 },
        "bandeja.asignar": { top: 1, left: 1, width: -1, height: 1 },
        "bandeja.filtro-canal": { top: 1, left: 1, width: 10, height: 10 },
        __proto__: { top: 1, left: 1, width: 1, height: 1 },
      },
    });
    expect(r?.tipo).toBe("cajas");
    expect(r?.tipo === "cajas" && [...r.cajas.keys()]).toEqual(["bandeja.filtro-canal"]);
  });

  it.each([
    ["JSON roto", "{no"],
    ["otro evento", { evento: "dtd:cerrar-sesion" }],
    ["cajas en lista", { evento: "dtd:guia:cajas", cajas: [] }],
    ["sin cajas", { evento: "dtd:guia:cajas" }],
    ["nada", null],
    ["un número", 7],
    ["texto enorme", JSON.stringify({ evento: "dtd:guia:cajas", relleno: "x".repeat(20_001) })],
  ])("ignora %s", (_n, data) => {
    expect(leerMensajePanel(data)).toBeNull();
  });
});

describe("de coordenadas del marco a la página", () => {
  const vista = { top: 100, left: 50, width: 800, height: 600 };

  it("suma la posición del área visible del marco", () => {
    expect(cajaEnPagina({ top: 10, left: 20, width: 30, height: 40 }, vista)).toEqual({ top: 110, left: 70, width: 30, height: 40 });
  });

  it("recorta lo que se sale del marco", () => {
    expect(cajaEnPagina({ top: 580, left: 790, width: 100, height: 100 }, vista)).toEqual({ top: 680, left: 840, width: 10, height: 20 });
    expect(cajaEnPagina({ top: -10, left: -10, width: 30, height: 30 }, vista)).toEqual({ top: 100, left: 50, width: 20, height: 20 });
  });

  it("fuera de la parte visible da null", () => {
    expect(cajaEnPagina({ top: 700, left: 0, width: 10, height: 10 }, vista)).toBeNull();
    expect(cajaEnPagina({ top: -50, left: 0, width: 10, height: 10 }, vista)).toBeNull();
    expect(cajaEnPagina({ top: 0, left: 0, width: 0, height: 10 }, vista)).toBeNull();
  });
});
