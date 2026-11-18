// @vitest-environment node
/**
 * SDD-0481 · La migración 0461 corrida de verdad sobre PostgreSQL embebido.
 *
 * POR QUÉ ESTE TEST: el contrato `supabase/tests/0461_…test.sql` sólo corre en
 * `verify` con Docker, y el CI de calidad no lo ejecuta. PGlite (dependencia del
 * repo desde SDD-0473) corre ese MISMO contrato —con los `.sql` reales de 0445,
 * 0446, 0447 y 0461 inlineados— así que lo que se prueba es el texto que el
 * runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: el contrato se corre también SIN 0461 y tiene que fallar; sin
 * eso, un verde no demostraría que el contrato ve el gate de 0447.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(
  ROOT,
  "supabase/tests/0461_identity_photo_replacement_enable.test.sql",
);
const MIGRATION_0461 = "0461_identity_photo_replacement_enable.sql";

/** psql → SQL plano: inlinea `\ir` (salvo los omitidos) y quita `\set`. */
function inline(file: string, omit: string[] = []): string {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (omit.some((name) => include[1].endsWith(name))) return "";
        return inline(resolve(dirname(file), include[1]), omit);
      }
      return /^\\set\s/.test(line) ? "" : line;
    })
    .join("\n");
}

/** Fixture del contrato hasta el primer `\ir` + las migraciones pedidas. */
function fixtureWith(migrations: string[]): string {
  const contract = readFileSync(CONTRACT, "utf8");
  const fixture = contract.slice(0, contract.indexOf("\\ir "));
  return [
    fixture.replace(/^\\set\s.*$/m, ""),
    ...migrations.map((name) =>
      readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8"),
    ),
  ].join("\n");
}

async function run(sql: string): Promise<string | null> {
  const db = await pgliteLimpio();
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

const BEFORE_0461 = [
  "0445_portal_profile_edit_limit.sql",
  "0446_portal_profile_functional_remediation.sql",
  "0447_identity_photo_replacement_privacy_gate.sql",
];

describe("0461 · reemplazo de la foto de identidad (PGlite)", () => {
  it("el contrato completo pasa con la cadena real 0445 → 0446 → 0447 → 0461", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin 0461 el mismo contrato falla por el gate de 0447", async () => {
    expect(await run(inline(CONTRACT, [MIGRATION_0461]))).toMatch(
      /CONTRATO 1 ROTO: el trigger de 0447 sigue enganchado/,
    );
  }, 60_000);

  it("preflight: sin la versión 0446 de la RPC aborta sin tocar el gate", async () => {
    const error = await run(
      fixtureWith([
        "0445_portal_profile_edit_limit.sql",
        "0447_identity_photo_replacement_privacy_gate.sql",
        MIGRATION_0461,
      ]),
    );
    expect(error).toMatch(/0461 abortado: portal_set_identity_photo no es la versión 0446/);
  }, 60_000);

  it("preflight: aplicada dos veces, la segunda aborta", async () => {
    const error = await run(fixtureWith([...BEFORE_0461, MIGRATION_0461, MIGRATION_0461]));
    expect(error).toMatch(/0461 abortado: no está el gate de 0447/);
  }, 60_000);
});
