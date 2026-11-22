// @vitest-environment node
/** SDD-0704 §3.2 y §5 · El catálogo en código es el mismo que siembra la 0570, y la regla D-2 no tiene atajo. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CATALOGO_MODELOS,
  MARCA_DE_LA_FUNCION,
  ORIGEN_DEL_PROVEEDOR,
  PROVEEDORES,
  esChino,
  estaEnElCatalogo,
  proveedorPermitido,
} from "../catalogo";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIGRACION = readFileSync(resolve(ROOT, "supabase/migrations/0570_ia_catalogo_y_costo.sql"), "utf8");

function siembra(): Array<{ proveedor: string; modelo: string; origen: string }> {
  const bloque = MIGRACION.match(/insert into public\.ia_catalogo_modelos \(proveedor, modelo, origen\) values([\s\S]*?)on conflict/);
  if (!bloque) throw new Error("no se encontró la siembra del catálogo en la 0570");
  return [...bloque[1].matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)].map((m) => ({ proveedor: m[1], modelo: m[2], origen: m[3] }));
}

describe("catálogo de modelos", () => {
  it("es igual a la siembra de la 0570, en el mismo orden", () => {
    const filas = siembra();
    expect(filas.map(({ proveedor, modelo }) => ({ proveedor, modelo }))).toEqual([...CATALOGO_MODELOS]);
    for (const f of filas) expect(f.origen, `${f.proveedor}/${f.modelo}`).toBe(ORIGEN_DEL_PROVEEDOR[f.proveedor as never]);
  });

  it("la lista cerrada de proveedores es la misma en la base", () => {
    for (const restriccion of ["ia_catalogo_proveedor_valido", "ia_cuentas_proveedor_valido"]) {
      const linea = MIGRACION.split("\n").find((l) => l.includes(restriccion));
      const enLaBase = [...(linea ?? "").matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
      expect(enLaBase, restriccion).toEqual([...PROVEEDORES]);
    }
  });

  it("Z.AI y DeepSeek son chinos; Anthropic y OpenAI no", () => {
    expect(PROVEEDORES.filter(esChino)).toEqual(["zai", "deepseek"]);
  });

  it("no se inventa un modelo fuera del catálogo", () => {
    expect(estaEnElCatalogo("anthropic", "claude-sonnet-5-5")).toBe(true);
    expect(estaEnElCatalogo("anthropic", "glm-5.3")).toBe(false);
    expect(estaEnElCatalogo("deepseek", "deepseek-reasoner")).toBe(false);
  });
});

describe("regla D-2", () => {
  it("una función con datos de clientes nunca admite un proveedor chino", () => {
    const conDatos = Object.entries(MARCA_DE_LA_FUNCION).filter(([, m]) => m === "con_datos").map(([f]) => f);
    expect(conDatos).toEqual(
      expect.arrayContaining(["oficina", "a3_actas", "a4a_resumen_interno", "a4b_resumen_portal", "a5_documentos", "a6_agentes"]),
    );
    for (const funcion of conDatos) {
      for (const p of PROVEEDORES) {
        expect(proveedorPermitido(funcion, p), `${funcion} · ${p}`).toBe(!esChino(p));
      }
    }
  });

  it("una función sin datos de clientes admite todos; una desconocida, ninguno", () => {
    for (const p of PROVEEDORES) {
      expect(proveedorPermitido("a1_noticias", p)).toBe(true);
      expect(proveedorPermitido("no-existe", p)).toBe(false);
    }
  });

  it("la base también lo ata: la cuenta de la Oficina no puede ser china", () => {
    expect(MIGRACION).toMatch(/ia_cuentas_oficina_no_china check \(not \(uso = 'oficina' and proveedor in \('zai', 'deepseek'\)\)\)/);
  });
});
