/**
 * Motor de la guía sin DOM (SDD-0589, 9.2): forma de los recorridos,
 * navegación con anclas faltantes, colocación de la tarjeta y almacén.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hasI18nKey, t } from "@/lib/i18n";
import { guide as guideES } from "@/lib/i18n/es-VE/guide";
import { guide as guideCN } from "@/lib/i18n/zh-CN/guide";
import { crearAlmacenLocal, crearAlmacenMemoria } from "../almacen";
import { anclaEfectiva, contador, pasoAnterior, pasoPresente, pasoSiguiente, primerPaso } from "../motor";
import { colocarTarjeta, MARGEN, SEPARACION } from "../posicion";
import { ROLES_ASIGNAR } from "../preferencias";
import {
  buscarRecorrido,
  PASO_QUITAR_ACCESO,
  RECORRIDOS,
  RECORRIDO_ACTUALIZACIONES,
  RECORRIDO_BANDEJA,
  RECORRIDO_DASHBOARD,
  RECORRIDO_EMBUDO,
  recorridosParaRol,
  rutaCoincide,
} from "../recorridos";
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

  it("U1 y U3 llevan, palabra por palabra, los textos que aprobó Sam (2026-11-07 07:02Z)", () => {
    const huella = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex").slice(0, 16);
    expect(huella(guideES["guide.users.grant.what"])).toBe("d5654c7bab073a82");
    expect(huella(guideES["guide.users.grant.now"])).toBe("ceae585ea7ba8997");
    expect(huella(guideES["guide.users.revoke.now"])).toBe("c8036fae1eaf9340");
    expect(validarRecorrido({ id: "u3", ruta: "/studio/usuarios", pasos: [PASO_QUITAR_ACCESO] })).toEqual([]);
    for (const sufijo of ["title", "what", "before", "now"] as const) {
      const k = `${PASO_QUITAR_ACCESO.clave}.${sufijo}` as keyof typeof guideES;
      expect(hasI18nKey(k), k).toBe(true);
      expect(guideES[k], k).toBeTruthy();
      expect(guideCN[k], k).not.toBe(guideES[k]);
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

describe("9.4 · ancla de respaldo", () => {
  const conRespaldo: GuiaPaso[] = [
    { id: "A", ancla: "chat.a", clave: "guide.inbox.reply", respaldo: "bandeja.marco" },
    { id: "B", ancla: "demo.b", clave: "guide.dashboard.kpis" },
    { id: "C", ancla: "chat.c", clave: "guide.inbox.note", respaldo: "bandeja.marco" },
  ];

  it("un paso sigue presente con su respaldo; sin los dos, se salta", () => {
    expect(pasoPresente(conRespaldo[0], presentes("bandeja.marco"))).toBe(true);
    expect(pasoPresente(conRespaldo[0], presentes())).toBe(false);
    expect(primerPaso(conRespaldo, presentes("bandeja.marco"))).toBe(0);
    expect(pasoSiguiente(conRespaldo, 0, presentes("bandeja.marco"))).toBe(2);
    expect(contador(conRespaldo, 0, presentes("bandeja.marco"))).toEqual({ n: 1, total: 2 });
  });

  it("la tarjeta va a su ancla si está; si no, al respaldo", () => {
    expect(anclaEfectiva(conRespaldo[0], presentes("chat.a", "bandeja.marco"))).toBe("chat.a");
    expect(anclaEfectiva(conRespaldo[0], presentes("bandeja.marco"))).toBe("bandeja.marco");
    expect(anclaEfectiva(conRespaldo[0], presentes())).toBeNull();
    expect(anclaEfectiva(conRespaldo[1], presentes("bandeja.marco"))).toBeNull();
  });

  it("validarRecorrido revisa el respaldo y las listas de roles", () => {
    const base = { id: "x", ruta: "/studio/x" as const };
    expect(validarRecorrido({ ...base, pasos: [{ id: "A", ancla: "x.a", clave: "guide.inbox.reply", respaldo: "X" }] })).toHaveLength(1);
    expect(validarRecorrido({ ...base, pasos: [{ id: "A", ancla: "x.a", clave: "guide.inbox.reply", respaldo: "x.a" }] })).toHaveLength(1);
    expect(validarRecorrido({ ...base, pasos: [{ id: "A", ancla: "x.a", clave: "guide.inbox.reply", roles: [] }] })).toHaveLength(1);
    expect(validarRecorrido({ ...base, roles: [], pasos: [{ id: "A", ancla: "x.a", clave: "guide.inbox.reply" }] })).toHaveLength(1);
  });
});

describe("9.5 · recorridos por rol", () => {
  const ids = (rol: Parameters<typeof recorridosParaRol>[1]) => recorridosParaRol(RECORRIDOS, rol).map((r) => r.id);
  const pasosDe = (rol: Parameters<typeof recorridosParaRol>[1], id: string) =>
    recorridosParaRol(RECORRIDOS, rol)
      .find((r) => r.id === id)
      ?.pasos.map((p) => p.id);

  it("admin ve todos los recorridos y todos los pasos", () => {
    expect(ids("admin")).toEqual(RECORRIDOS.map((r) => r.id));
    expect(pasosDe("admin", "bandeja")).toEqual(RECORRIDO_BANDEJA.pasos.map((p) => p.id));
  });

  it("B4 (asignar) la ven admin, commercial y support: S-2 cerrada (Sam, 2026-11-07 07:00Z)", () => {
    expect(pasosDe("commercial", "bandeja")).toEqual(["B1", "B2", "B3", "B4", "B5", "B6", "F1"]);
    expect(pasosDe("support", "bandeja")).toEqual(["B1", "B2", "B3", "B4", "B5", "B6", "F1"]);
    expect(pasosDe("admin", "bandeja")).toContain("B4");
    // Sin el módulo Bandeja no la ve, aunque el recorrido le llegue.
    expect(pasosDe("accounting", "bandeja")).not.toContain("B4");
    expect(ROLES_ASIGNAR).toEqual(["admin", "commercial", "support"]);
  });

  it("U1 (Vínculos) va al final de la Bandeja y solo la ve admin; U3 también es de admin", () => {
    expect(pasosDe("admin", "bandeja")?.at(-1)).toBe("U1");
    for (const rol of ["commercial", "support", "accounting"] as const) {
      expect(pasosDe(rol, "bandeja"), rol).not.toContain("U1");
    }
    expect(PASO_QUITAR_ACCESO.roles).toEqual(["admin"]);
  });

  it("Embudo es de admin y commercial; Actualizaciones, solo de admin", () => {
    expect(RECORRIDO_EMBUDO.roles).toEqual(["admin", "commercial"]);
    expect(RECORRIDO_ACTUALIZACIONES.roles).toEqual(["admin"]);
    expect(ids("commercial")).toEqual(["dashboard", "bandeja", "embudo", "cliente"]);
    expect(ids("support")).toEqual(["dashboard", "bandeja", "cliente"]);
    expect(ids("accounting")).toEqual(["dashboard", "bandeja", "cliente"]);
  });

  it("sin rol, solo lo que no pide ninguno; un recorrido sin pasos para el rol desaparece", () => {
    expect(ids(null)).toEqual(["dashboard", "bandeja", "cliente"]);
    const soloAdmin = [{ ...RECORRIDO_DASHBOARD, pasos: RECORRIDO_DASHBOARD.pasos.map((p) => ({ ...p, roles: ["admin" as const] })) }];
    expect(recorridosParaRol(soloAdmin, "support")).toEqual([]);
    // Sin filtrar nada, devuelve el mismo objeto.
    expect(recorridosParaRol([RECORRIDO_DASHBOARD], "support")[0]).toBe(RECORRIDO_DASHBOARD);
  });

  it("solo el Dashboard arranca solo; los recorridos de 9.5 esperan a la 9.6 (D11)", () => {
    expect(RECORRIDOS.filter((r) => r.arranqueAutomatico !== false).map((r) => r.id)).toEqual(["dashboard"]);
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
