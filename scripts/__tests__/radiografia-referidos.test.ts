// @vitest-environment node
/**
 * SDD-0567 · La radiografía de referidos, corrida de verdad en PostgreSQL embebido.
 *
 * `scripts/qa/radiografia-referidos.sql` es la consulta que el Director corrió en
 * producción el 2026-10-20 con la autorización de Sam (solo conteos), y la que
 * se repite después de aplicar la 0494. Acá corre en PGlite sobre
 * `scripts/qa/radiografia-referidos.fixture.sql`, que arma el esquema con las
 * migraciones REALES (las del contrato 0494) y siembra, sin disparadores, los
 * estados que el guardián ya no permite. El esquema completo lo cubre
 * `scripts/check-schema-rebuild.mjs`.
 *
 * Cada esperado sale de la validación del 2026-10-20 en postgres:17 sobre el
 * esquema completo de main (mismos fixtures): vacía, limpia y sucia. El control
 * rojo es la consulta sin uno de sus chequeos.
 *
 * Privacidad: la salida son tres columnas (chequeo, filas, tenants), con
 * literales y conteos. La consulta no lee los datos personales del referido.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONSULTA = readFileSync(resolve(ROOT, "scripts/qa/radiografia-referidos.sql"), "utf8");
const FIXTURE = resolve(ROOT, "scripts/qa/radiografia-referidos.fixture.sql");
const SLOW = 240_000;

/** psql → SQL plano: \set ON_ERROR_STOP y \ir (las únicas metaórdenes de la fixture). */
function inline(file: string): string {
  const out: string[] = [];
  const run = (path: string) => {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        out.push(line);
      } else if (meta[1] === "ir") {
        run(resolve(dirname(path), meta[2].trim()));
      } else if (!(meta[1] === "set" && meta[2].trim().startsWith("ON_ERROR_STOP"))) {
        throw new Error("metaorden psql no soportada: \\" + meta[1]);
      }
    }
  };
  run(file);
  return out.join("\n");
}

async function radiografia(siembra: "limpio" | "sucio" | null, consulta = CONSULTA): Promise<string[]> {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(inline(FIXTURE));
    if (siembra) await db.exec(`select pg_temp.sembrar_${siembra}();`);
    const results = await db.exec(consulta);
    return results
      .flatMap((r) => r.rows as Record<string, unknown>[])
      .filter((row) => "chequeo" in row)
      .map((row) => `${row.chequeo}|${row.filas}|${row.tenants}`);
  } finally {
    await db.close();
  }
}

const LIMPIO = [
  "R0 vivos en estado acreditado|1|1",
  "R0 vivos en estado aplicado|1|1",
  "R0 vivos en estado registrado|1|1",
];
const SUCIO = [
  "R0 vivos en estado acreditado|3|1",
  "R0 vivos en estado aplicado|2|1",
  "R1 acreditado o aplicado sin venta del referido|2|1",
  "R2 acreditado con la venta del referido solo anulada|1|1",
  "R3c «renacido»: no aplicado con factura o fecha de aplicación|1|1",
  "R4 asiento vivo y el referido no está aplicado|1|1",
  "R4d con dos o más asientos de crédito (vivos o anulados)|1|1",
  "R5 facturas con dos o más créditos aplicados|1|1",
];

describe("SDD-0567 · radiografía de referidos (PGlite)", () => {
  it("sin referidos, no devuelve filas", async () => {
    expect(await radiografia(null)).toEqual([]);
  }, SLOW);

  it("con referidos coherentes, solo las filas R0", async () => {
    expect(await radiografia("limpio")).toEqual(LIMPIO);
  }, SLOW);

  it("con los estados que el guardián ya no permite, cada chequeo los ve", async () => {
    expect(await radiografia("sucio")).toEqual(SUCIO);
  }, SLOW);

  it("control rojo: sin el chequeo R1, la sucia pierde esa fila", async () => {
    const desde = CONSULTA.indexOf("  -- R1 · «nace sin venta»");
    const hasta = CONSULTA.indexOf("  -- R2 · la regla de anulación");
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(desde);
    const sinR1 = CONSULTA.slice(0, desde) + CONSULTA.slice(hasta);
    const filas = await radiografia("sucio", sinR1);
    expect(filas).not.toEqual(SUCIO);
    expect(filas.some((f) => f.startsWith("R1 "))).toBe(false);
  }, SLOW);

  it("es de solo lectura y solo devuelve conteos", () => {
    const sinComentarios = CONSULTA.replace(/--[^\n]*/g, "");
    expect(sinComentarios.trim().startsWith("begin transaction isolation level repeatable read read only;")).toBe(true);
    expect(sinComentarios.trim().endsWith("rollback;")).toBe(true);
    expect(sinComentarios).not.toMatch(/\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|commit)\b/i);
    expect(sinComentarios).toMatch(/select chequeo, count\(\*\) as filas, count\(distinct tenant_id\) as tenants\s+from chequeos/);
    expect(sinComentarios).not.toMatch(/referred_(name|email|phone|company)/);
  });
});
