/**
 * Contrato del minicerebro de Faro (SDD-0637 §5, AC-1).
 *
 * Lee `MODULES` sin modificarlo. Si alguien agrega un módulo al Studio y no le
 * pone entrada en el catálogo, esta prueba falla: Faro no puede ignorar una
 * pantalla ni decidir su visibilidad por omisión.
 */

import { describe, expect, it } from "vitest";

import { MODULES } from "@/lib/studio/modules";
import {
  ADMIN_ONLY_MODULES,
  SUPERADMIN_ONLY_MODULES,
  isKnownModule,
} from "@/lib/studio/rbac";

import { CATALOGO, entradaDe } from "../catalogo";
import { GUIAS, guiaDe } from "../guias";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

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
});

describe("Faro · visibilidad (D-3)", () => {
  it("todo módulo de superadministrador es oculto", () => {
    for (const id of SUPERADMIN_ONLY_MODULES) {
      expect(entradaDe(id)?.visibilidad, id).toBe("oculta");
    }
  });

  it("todo módulo solo-administrador es reservado u oculto, nunca normal", () => {
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

  it("cada guía trae procedencia completa y al menos una tarea", () => {
    for (const g of GUIAS) {
      expect(g.procedencia.revisado, g.modulo).toMatch(FECHA_ISO);
      expect(g.procedencia.responsable.trim(), g.modulo).not.toBe("");
      expect(g.procedencia.fuentes.length, g.modulo).toBeGreaterThan(0);
      expect(g.tareas.length, g.modulo).toBeGreaterThan(0);
      expect(g.queSeVe.length, g.modulo).toBeGreaterThan(0);
    }
  });

  it("cada tarea empieza dentro de la pantalla de su módulo y tiene pasos", () => {
    for (const g of GUIAS) {
      const slug = MODULES.find((m) => m.id === g.modulo)!.slug;
      const ids = g.tareas.map((t) => t.id);
      expect(new Set(ids).size, g.modulo).toBe(ids.length);
      for (const t of g.tareas) {
        expect(
          t.ruta === slug || t.ruta.startsWith(`${slug}/`),
          `${g.modulo}/${t.id}: ${t.ruta} no cuelga de ${slug}`,
        ).toBe(true);
        expect(t.pasos.length, `${g.modulo}/${t.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("ninguna guía trae correos, teléfonos ni montos con símbolo de moneda", () => {
    // El repositorio es público: las guías describen botones, no casos reales.
    const sospechoso = /@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s-]{9,}\d|(?:US\$|\$|Bs\.?)\s?\d/i;
    for (const g of GUIAS) {
      expect(JSON.stringify(g), g.modulo).not.toMatch(sospechoso);
    }
  });
});
