/**
 * Contrato del minicerebro de Faro (SDD-0637 §5, AC-1).
 *
 * Lee `MODULES` sin modificarlo. Si alguien agrega un módulo al Studio y no le
 * pone entrada en el catálogo, esta prueba falla: Faro no puede ignorar una
 * pantalla ni decidir su visibilidad por omisión.
 *
 * Alcance: comprueba estructura, cobertura, permisos declarados y que las
 * fuentes existan. NO comprueba que los textos de las guías sean exactos; eso
 * lo hace la revisión humana (las guías nacen en `borrador`).
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MODULES } from "@/lib/studio/modules";
import {
  ADMIN_ONLY_MODULES,
  CAPABILITIES,
  isKnownModule,
  moduleIdForPath,
  SUPERADMIN_ONLY_MODULES,
} from "@/lib/studio/rbac";

import { CATALOGO, entradaDe, PROCEDENCIA_CATALOGO } from "../catalogo";
import { GUIAS, guiaDe } from "../guias";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const RAIZ = process.cwd();
const existe = (ruta: string) => existsSync(path.join(RAIZ, ruta));

/** Decisión D-3, aprobada por Sam el 2026-11-16. Cambiarla exige su aprobación. */
const D3_OCULTAS = ["financiero-china", "legal", "no-olvidar", "renditions"];
const D3_RESERVADAS = ["admin", "costing", "direccion", "mailing", "nomina", "users"];

describe("Faro · catálogo (AC-1)", () => {
  it("tiene una entrada por cada módulo de MODULES, y ninguna de más", () => {
    const delStudio = MODULES.map((m) => m.id).sort();
    const delCatalogo = CATALOGO.map((e) => e.id).sort();
    expect(delCatalogo).toEqual(delStudio);
  });

  it("no repite ids", () => {
    const ids = CATALOGO.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada entrada tiene una descripción de una línea", () => {
    for (const e of CATALOGO) {
      expect(e.descripcion.trim().length, e.id).toBeGreaterThan(10);
      expect(e.descripcion.length, e.id).toBeLessThanOrEqual(160);
      expect(e.descripcion, e.id).not.toMatch(/\n/);
    }
  });

  it("entradaDe encuentra por id y devuelve undefined para lo desconocido", () => {
    expect(entradaDe("collections")?.id).toBe("collections");
    expect(entradaDe("no-existe")).toBeUndefined();
  });

  it("la procedencia del catálogo existe, y cada módulo tiene su página", () => {
    expect(PROCEDENCIA_CATALOGO.revisado).toMatch(FECHA_ISO);
    for (const fuente of PROCEDENCIA_CATALOGO.fuentes) {
      expect(existe(fuente), fuente).toBe(true);
    }
    for (const m of MODULES) {
      const pagina = path.join("app/studio/(app)", m.slug.replace(/^\/studio/, ""), "page.tsx");
      expect(existe(pagina), `${m.id}: ${pagina}`).toBe(true);
    }
  });
});

describe("Faro · visibilidad (D-3)", () => {
  it("los ocultos son exactamente los aprobados", () => {
    const ocultas = CATALOGO.filter((e) => e.visibilidad === "oculta").map((e) => e.id).sort();
    expect(ocultas).toEqual(D3_OCULTAS);
  });

  it("los reservados son exactamente los aprobados; el resto es normal", () => {
    const reservadas = CATALOGO.filter((e) => e.visibilidad === "reservada").map((e) => e.id).sort();
    expect(reservadas).toEqual(D3_RESERVADAS);
    const normales = CATALOGO.filter((e) => e.visibilidad === "normal").length;
    expect(normales).toBe(MODULES.length - D3_OCULTAS.length - D3_RESERVADAS.length);
  });

  it("sigue cuadrando con los candados de rbac.ts", () => {
    // Si alguien cambia los candados, la D-3 se vuelve a decidir con Sam.
    expect([...SUPERADMIN_ONLY_MODULES].sort()).toEqual(D3_OCULTAS);
    for (const id of ADMIN_ONLY_MODULES) {
      expect(entradaDe(id)?.visibilidad, id).not.toBe("normal");
    }
  });

  it("un módulo escondido del menú no es de visibilidad normal", () => {
    for (const m of MODULES.filter((x) => x.hidden)) {
      expect(entradaDe(m.id)?.visibilidad, m.id).not.toBe("normal");
    }
  });
});

describe("Faro · guías", () => {
  it("cada guía pertenece a un módulo conocido y a uno solo", () => {
    const modulos = GUIAS.map((g) => g.modulo);
    expect(new Set(modulos).size).toBe(modulos.length);
    for (const id of modulos) {
      expect(isKnownModule(id), `guía de módulo fantasma "${id}"`).toBe(true);
    }
  });

  it("`conGuia` del catálogo coincide con las guías que existen", () => {
    for (const e of CATALOGO) {
      expect(Boolean(guiaDe(e.id)), e.id).toBe(e.conGuia);
    }
  });

  it("cada guía trae procedencia completa, y sus fuentes existen", () => {
    for (const g of GUIAS) {
      expect(g.procedencia.revisado, g.modulo).toMatch(FECHA_ISO);
      expect(g.procedencia.responsable.trim(), g.modulo).not.toBe("");
      expect(g.procedencia.fuentes.length, g.modulo).toBeGreaterThan(0);
      for (const fuente of g.procedencia.fuentes) {
        expect(existe(fuente), `${g.modulo}: ${fuente}`).toBe(true);
      }
      expect(g.tareas.length, g.modulo).toBeGreaterThan(0);
      expect(g.queSeVe.length, g.modulo).toBeGreaterThan(0);
    }
  });

  it("cada tarea tiene id único, pasos y permisos sobre módulos conocidos", () => {
    for (const g of GUIAS) {
      const ids = g.tareas.map((t) => t.id);
      expect(new Set(ids).size, g.modulo).toBe(ids.length);
      for (const t of g.tareas) {
        const clave = `${g.modulo}/${t.id}`;
        expect(t.pasos.length, clave).toBeGreaterThan(0);
        expect(t.requiere.length, clave).toBeGreaterThan(0);
        for (const r of t.requiere) {
          expect(isKnownModule(r.modulo), `${clave}: módulo "${r.modulo}"`).toBe(true);
        }
        if (t.capacidad) {
          expect(Object.keys(CAPABILITIES), clave).toContain(t.capacidad);
        }
      }
    }
  });

  it("el módulo de la ruta de cada tarea está entre sus permisos (subrutas incluidas)", () => {
    // moduleIdForPath elige el slug más específico: /studio/despacho/reglas es
    // de despacho-rules, no de despacho.
    for (const g of GUIAS) {
      for (const t of g.tareas) {
        const moduloDeRuta = moduleIdForPath(t.ruta);
        expect(moduloDeRuta, `${g.modulo}/${t.id}: ${t.ruta}`).not.toBeNull();
        expect(
          t.requiere.map((r) => r.modulo),
          `${g.modulo}/${t.id}: ${t.ruta} es de ${moduloDeRuta}`,
        ).toContain(moduloDeRuta);
      }
    }
  });

  it("ningún texto trae correos, teléfonos ni montos con símbolo de moneda", () => {
    // Heurística, no garantía: el repositorio es público y las guías describen
    // botones, no casos reales. La revisión humana sigue siendo necesaria.
    const sospechoso = /@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s-]{9,}\d|(?:US\$|\$|Bs\.?)\s?\d/i;
    for (const g of GUIAS) {
      expect(JSON.stringify(g), g.modulo).not.toMatch(sospechoso);
    }
    expect(JSON.stringify(CATALOGO)).not.toMatch(sospechoso);
  });
});
