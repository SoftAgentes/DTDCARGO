/**
 * Motor de la guía sin DOM (SDD-0589, 9.2): forma de los recorridos,
 * navegación con anclas faltantes, colocación de la tarjeta y almacén.
 */

import { describe, expect, it } from "vitest";
import { hasI18nKey, t } from "@/lib/i18n";
import { guide as guideES } from "@/lib/i18n/es-VE/guide";
import { guide as guideCN } from "@/lib/i18n/zh-CN/guide";
import { crearAlmacenLocal, crearAlmacenMemoria } from "../almacen";
import { contador, pasoAnterior, pasoSiguiente, primerPaso } from "../motor";
import { colocarTarjeta, MARGEN, SEPARACION } from "../posicion";
import { buscarRecorrido, RECORRIDOS, RECORRIDO_DASHBOARD, rutaCoincide } from "../recorridos";
import { esAnclaValida, textoDe, validarRecorrido, type GuiaPaso } from "../tipos";

const pasos: GuiaPaso[] = [
  { id: "A", ancla: "demo.a", clave: "guide.dashboard.welcome" },
  { id: "B", ancla: "demo.b", clave: "guide.dashboard.kpis" },
  { id: "C", ancla: "demo.c", clave: "guide.dashboard.configure" },
  { id: "D", ancla: "demo.d", clave: "guide.dashboard.panels" },
];
const presentes = (...anclas: string[]) => (a: string) => anclas.includes(a);

describe("recorridos como datos", () => {
  it("todo recorrido del catálogo es válido y su ruta es de Studio", () => {
    for (const r of RECORRIDOS) {
      expect(validarRecorrido(r)).toEqual([]);
      expect(r.ruta.startsWith("/studio/")).toBe(true);
    }
  });

  it("cada paso tiene título y «qué es» en los dos idiomas", () => {
    for (const r of RECORRIDOS) {
      for (const p of r.pasos) {
        for (const sufijo of ["title", "what"] as const) {
          const k = textoDe(p.clave, sufijo);
          expect(hasI18nKey(k)).toBe(true);
          expect(t("es-VE", k)).not.toBe(k);
          expect(t("zh-CN", k)).not.toBe(t("es-VE", k));
        }
      }
    }
  });

  it("es-VE y zh-CN tienen exactamente las mismas claves guide.*", () => {
    expect(Object.keys(guideCN).sort()).toEqual(Object.keys(guideES).sort());
  });

  it("los textos del guion respetan el tamaño de la tarjeta y el tono", () => {
    for (const [k, v] of Object.entries(guideES)) {
      if (k.endsWith(".title")) expect(v.length, k).toBeLessThanOrEqual(40);
      else expect(v.length, k).toBeLessThanOrEqual(140);
      expect(v, k).not.toMatch(/[!¡]/);
      // Tuteo sin voseo (BRAND.md · Tono): nada de «pulsá», «mirá», «vos».
      expect(v, k).not.toMatch(/\b(vos|sos|pulsá|mirá|elegí|tenés|podés)\b/i);
    }
  });

  it("formato de ancla del guion: <pantalla>.<elemento>", () => {
    expect(esAnclaValida("bandeja.nota-privada")).toBe(true);
    expect(esAnclaValida("dashboard.kpis")).toBe(true);
    for (const mala of ["Bandeja.composer", "bandeja", "a.b.c", 'x"]', "a.-b", "a b.c", ""]) {
      expect(esAnclaValida(mala), mala).toBe(false);
    }
  });

  it("validarRecorrido detecta ids repetidos, anclas malas y recorridos vacíos", () => {
    expect(
      validarRecorrido({
        id: "Malo",
        ruta: "/studio/x",
        pasos: [
          { id: "A", ancla: "x.a", clave: "guide.dashboard.kpis" },
          { id: "A", ancla: "X", clave: "guide.dashboard.kpis" },
        ],
      }),
    ).toHaveLength(3);
    expect(validarRecorrido({ id: "vacio", ruta: "/studio/x", pasos: [] })).toHaveLength(1);
  });

  it("buscarRecorrido y rutaCoincide", () => {
    expect(buscarRecorrido("dashboard")).toBe(RECORRIDO_DASHBOARD);
    expect(buscarRecorrido("no-existe")).toBeNull();
    expect(buscarRecorrido(null)).toBeNull();
    expect(rutaCoincide(RECORRIDO_DASHBOARD, "/studio/dashboard")).toBe(true);
    expect(rutaCoincide(RECORRIDO_DASHBOARD, "/studio/dashboard/x")).toBe(true);
    expect(rutaCoincide(RECORRIDO_DASHBOARD, "/studio/dashboard-otro")).toBe(false);
    expect(rutaCoincide(RECORRIDO_DASHBOARD, "/studio/bandeja")).toBe(false);
  });
});

describe("navegación con anclas faltantes", () => {
  it("arranca en el primer paso presente y no abre si no hay ninguno", () => {
    expect(primerPaso(pasos, presentes("demo.a", "demo.b"))).toBe(0);
    expect(primerPaso(pasos, presentes("demo.c"))).toBe(2);
    expect(primerPaso(pasos, presentes())).toBeNull();
  });

  it("siguiente y anterior saltan los pasos sin ancla", () => {
    const existe = presentes("demo.a", "demo.d");
    expect(pasoSiguiente(pasos, 0, existe)).toBe(3);
    expect(pasoSiguiente(pasos, 3, existe)).toBeNull();
    expect(pasoAnterior(pasos, 3, existe)).toBe(0);
    expect(pasoAnterior(pasos, 0, existe)).toBeNull();
  });

  it("el contador cuenta sólo los presentes y conserva el actual si su ancla se fue", () => {
    expect(contador(pasos, 3, presentes("demo.a", "demo.d"))).toEqual({ n: 2, total: 2 });
    expect(contador(pasos, 1, presentes("demo.a", "demo.c"))).toEqual({ n: 2, total: 3 });
    expect(contador(pasos, 0, presentes("demo.a", "demo.b", "demo.c", "demo.d"))).toEqual({ n: 1, total: 4 });
  });

  it("índices fuera de rango no rompen", () => {
    const todo = () => true;
    expect(pasoSiguiente(pasos, 99, todo)).toBeNull();
    expect(pasoAnterior(pasos, -5, todo)).toBeNull();
    expect(pasoSiguiente(pasos, -10, todo)).toBe(0);
  });
});

describe("colocación de la tarjeta", () => {
  const vp = { width: 1280, height: 800 };
  const card = { width: 360, height: 200 };

  it("prefiere debajo del ancla, alineada a su borde izquierdo", () => {
    const r = colocarTarjeta({ top: 100, left: 200, width: 300, height: 40 }, card, vp);
    expect(r).toEqual({ top: 100 + 40 + SEPARACION, left: 200, lado: "abajo" });
  });

  it("si no cabe debajo, va arriba", () => {
    const r = colocarTarjeta({ top: 650, left: 200, width: 300, height: 100 }, card, vp);
    expect(r.lado).toBe("arriba");
    expect(r.top).toBe(650 - SEPARACION - 200);
  });

  it("un ancla alta va al lado; nunca se sale del viewport", () => {
    const r = colocarTarjeta({ top: 50, left: 100, width: 300, height: 700 }, card, vp);
    expect(r.lado).toBe("derecha");
    const pegadoDerecha = colocarTarjeta({ top: 50, left: 1100, width: 170, height: 700 }, card, vp);
    expect(pegadoDerecha.lado).toBe("izquierda");
    const alBorde = colocarTarjeta({ top: 10, left: 1200, width: 70, height: 20 }, card, vp);
    expect(alBorde.left + card.width).toBeLessThanOrEqual(vp.width - MARGEN);
  });

  it("sin ancla o sin sitio queda libre, abajo a la derecha", () => {
    expect(colocarTarjeta(null, card, vp)).toEqual({
      top: vp.height - card.height - MARGEN,
      left: vp.width - card.width - MARGEN,
      lado: "libre",
    });
    const movil = colocarTarjeta({ top: 0, left: 0, width: 375, height: 812 }, { width: 343, height: 260 }, { width: 375, height: 812 });
    expect(movil.lado).toBe("libre");
    expect(movil.left).toBe(MARGEN);
  });
});

describe("almacén del progreso (lugar de 9.3)", () => {
  const progreso = { pasoId: "D2", terminado: false };

  it("memoria guarda copias", () => {
    const a = crearAlmacenMemoria();
    expect(a.leer("dashboard")).toBeNull();
    a.guardar("dashboard", progreso);
    expect(a.leer("dashboard")).toEqual(progreso);
  });

  it("localStorage con prefijo versionado", () => {
    const a = crearAlmacenLocal(window.localStorage);
    a.guardar("dashboard", progreso);
    expect(JSON.parse(window.localStorage.getItem("dtd.guia.v1.dashboard") ?? "null")).toEqual(progreso);
    expect(crearAlmacenLocal(window.localStorage).leer("dashboard")).toEqual(progreso);
    window.localStorage.clear();
  });

  it("si el almacenamiento lanza, cae a memoria sin romper", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cuota");
      },
    } as unknown as Storage;
    const a = crearAlmacenLocal(roto);
    expect(() => a.guardar("dashboard", progreso)).not.toThrow();
    expect(a.leer("dashboard")).toEqual(progreso);
  });

  it("descarta JSON roto o con otra forma", () => {
    window.localStorage.setItem("dtd.guia.v1.x", "{roto");
    window.localStorage.setItem("dtd.guia.v1.y", JSON.stringify({ pasoId: 3 }));
    const a = crearAlmacenLocal(window.localStorage);
    expect(a.leer("x")).toBeNull();
    expect(a.leer("y")).toBeNull();
    window.localStorage.clear();
  });
});
