// @vitest-environment node
/**
 * Contrato de trazabilidad spec → migración.
 *
 * Cuando dos ventanas chocan de número, la migración se renumera… y la spec
 * que la cita se queda con el nombre viejo. El archivo citado deja de existir
 * y la pregunta "¿qué migración implementa esta spec?" pierde respuesta.
 *
 * Barrido del 2026-08-02: SIETE specs `done` citaban archivos inexistentes —
 * 0020 (0012→0015_agents), 0044 (0087→0088_tesoreria), 0095 (0145→0146_
 * ocean_rates_cache), 0109 (0178→0179_nomina_settlements), 0113 (0178→0180 y
 * 0179→0181), más dos que nunca se crearon. Ninguno lo agarró nadie porque
 * `docs:check` valida el front-matter, no el cuerpo.
 *
 * Este test mira el CUERPO. Cualquier `NNNN_nombre.sql` mencionado en una spec
 * tiene que existir en `supabase/migrations/`.
 */
import { describe, it, expect, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


const RAIZ = process.cwd();
const SPECS = join(RAIZ, "docs", "specs");
const MIGRACIONES = join(RAIZ, "supabase", "migrations");

/**
 * Citas que NO son trazabilidad: números tentativos de un plan que nunca se
 * ejecutó tal cual. Se toleran nombrando POR QUÉ; si alguna se construye, sale
 * de acá. La lista es corta a propósito — que crecer duela.
 */
const TOLERADAS = new Map<string, string>([
  [
    "0178_financiero_china_slice_c.sql",
    "SDD-0115 §Backend lo marca '(número tentativo)'. El Slice C terminó " +
      "cerrándose SIN migración (4 sub-slices sobre backend existente, commit " +
      "e98078f5), así que el archivo nunca existió.",
  ],
  [
    "0026_suppliers_cn.sql",
    "SDD-0031 §Plan proponía crearla. La tabla `suppliers_cn` terminó naciendo " +
      "dentro de 0105_portal_compras.sql, con otro alcance y otro número.",
  ],
]);

function specs(): { id: string; archivo: string; texto: string }[] {
  return readdirSync(SPECS)
    .filter((d) => existsSync(join(SPECS, d, "spec.md")))
    .map((d) => ({
      id: d,
      archivo: join(SPECS, d, "spec.md"),
      texto: readFileSync(join(SPECS, d, "spec.md"), "utf8"),
    }));
}

describe("Trazabilidad spec → migración", () => {
  const existentes = new Set(
    readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")),
  );
  const todas = specs();

  it("hay specs y migraciones que auditar (sanity)", () => {
    expect(todas.length).toBeGreaterThan(50);
    expect(existentes.size).toBeGreaterThan(200);
  });

  // Sólo se audita a las specs que AFIRMAN que el trabajo existe. Una spec
  // `proposed` o `draft` nombrando la migración que va a crear es legítimo —
  // todavía no la escribió. Una `done` citando un archivo inexistente no: está
  // declarando terminado algo cuya evidencia no se puede abrir.
  const AFIRMAN = new Set(["done", "in-progress"]);

  it("toda migración citada en una spec construida existe en el repo", () => {
    const rotas: string[] = [];
    for (const s of todas) {
      const st = s.texto.match(/^status:\s*(\S+)/m)?.[1];
      if (!st || !AFIRMAN.has(st)) continue;
      const citadas = new Set(
        [...s.texto.matchAll(/\b(0[0-9]{3}_[a-z0-9_]+\.sql)/g)].map((m) => m[1]),
      );
      for (const c of citadas) {
        if (existentes.has(c) || TOLERADAS.has(c)) continue;
        rotas.push(`${s.id} → ${c}`);
      }
    }
    expect(
      rotas,
      "Estas specs citan migraciones que NO existen. Casi siempre es una " +
        "renumeración por colisión que no se propagó al cuerpo de la spec: " +
        "buscá el archivo real por su nombre (no por su número) y corregí la " +
        "cita.\n  " + rotas.join("\n  "),
    ).toEqual([]);
  });

  it("las excepciones toleradas siguen siendo necesarias", () => {
    // Si alguien crea el archivo, la excepción sobra: sacarla mantiene la
    // lista corta y honesta.
    const sobrantes = [...TOLERADAS.keys()].filter((f) => existentes.has(f));
    expect(
      sobrantes,
      `Estas migraciones ya existen y siguen en la lista de toleradas: ` +
        `${sobrantes.join(", ")}. Quitalas de TOLERADAS.`,
    ).toEqual([]);
  });
});

describe("Coherencia de supersedes / superseded_by", () => {
  const todas = specs();
  const campo = (texto: string, k: string) => {
    const m = texto.match(new RegExp(`^${k}:\\s*"?([^"\\n]*)"?\\s*$`, "m"));
    const v = m?.[1]?.trim();
    return !v || v === "null" ? null : v;
  };

  it("el enlace de reemplazo va en las dos direcciones", () => {
    // 0155 declaraba `supersedes: 0152` y 0152 seguía en `in-progress` con
    // `superseded_by: null`: un lector que abriera 0152 primero no tenía cómo
    // enterarse de que estaba reemplazada.
    const porId = new Map(todas.map((s) => [s.id.slice(0, 4), s]));
    const rotos: string[] = [];
    for (const s of todas) {
      const sup = campo(s.texto, "supersedes");
      if (!sup) continue;
      const otra = porId.get(sup.padStart(4, "0"));
      if (!otra) {
        rotos.push(`${s.id} dice supersedes: ${sup}, que no existe`);
        continue;
      }
      const vuelta = campo(otra.texto, "superseded_by");
      if (vuelta !== s.id.slice(0, 4)) {
        rotos.push(
          `${s.id} reemplaza a ${otra.id}, pero ${otra.id} tiene ` +
            `superseded_by: ${vuelta ?? "null"}`,
        );
      }
    }
    expect(rotos, rotos.join("\n  ")).toEqual([]);
  });

  it("una spec reemplazada no queda en in-progress", () => {
    const malos = todas
      .filter((s) => campo(s.texto, "superseded_by"))
      .filter((s) => {
        const st = campo(s.texto, "status");
        return st === "in-progress" || st === "draft" || st === "proposed";
      })
      .map((s) => `${s.id} (status: ${campo(s.texto, "status")})`);
    expect(
      malos,
      `Tienen superseded_by pero siguen como trabajo activo: ${malos.join(", ")}. ` +
        `El status correcto es "superseded".`,
    ).toEqual([]);
  });
});
