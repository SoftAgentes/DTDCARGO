// @vitest-environment node
/**
 * SDD-0630 · migración 0537 en PGlite, una sola sesión.
 *
 * Fixture: el del contrato 0533 en modo fixture_only (lo arma
 * scripts/tests/fechas-caracas-postgrest.mjs › inlineContract), con la 0533
 * aplicada. Encima, la 0537 en una transacción y los casos compartidos
 * supabase/tests/0537_recibo_al_confirmar_reporte.casos.sql, y después la 0422
 * y la 0423 (…despues.sql). La carrera con sesiones reales vive en
 * supabase/tests/0537_recibo_al_confirmar_reporte.test.sql (Postgres 17 + dblink,
 * en el CI). Los mutantes de abajo prueban que los casos no salen verdes vacíos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const harnessPath = "../../../scripts/tests/fechas-caracas-postgrest.mjs";
const { inlineContract, embeddedSql, root } = (await import(harnessPath)) as {
  inlineContract: (vars?: Record<string, string>) => string;
  embeddedSql: (sql: string) => string;
  root: string;
};
const leer = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const MIGRACION = leer("supabase/migrations/0537_recibo_al_confirmar_reporte.sql");
const CASOS = leer("supabase/tests/0537_recibo_al_confirmar_reporte.casos.sql");
const DESPUES = leer("supabase/tests/0537_recibo_al_confirmar_reporte.despues.sql");

async function correr(
  pasos: string[],
  vars: Record<string, string> = {},
): Promise<string | null> {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(embeddedSql(inlineContract({ fixture_only: "true", ...vars })));
    for (const paso of pasos) await db.exec(embeddedSql(paso));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}
const enTransaccion = (sql: string) => `begin;\n${sql}\ncommit;`;

/** Cambia un fragmento exacto de la migración; falla si el ancla ya no existe. */
function mutante(desde: string, hacia: string): string {
  expect(MIGRACION.includes(desde), `ancla del mutante: ${desde}`).toBe(true);
  return MIGRACION.replace(desde, hacia);
}

describe("SDD-0630 · 0537: confirmar un reporte crea su recibo", () => {
  it("con la 0533 aplicada: recibo, reintento, rechazo, permisos y vínculo; después 0422 y 0423", async () => {
    expect(await correr([enTransaccion(MIGRACION), CASOS, DESPUES])).toBeNull();
  }, 300_000);

  it("preflight: sin la 0533 aborta sin cambiar nada", async () => {
    expect(await correr([enTransaccion(MIGRACION)], { apply_fix: "false" }))
      .toMatch(/^0537 abortado: payment_private\.run_report_command\(uuid,uuid,text,jsonb\) tiene otro cuerpo/);
  }, 300_000);

  it("preflight: una segunda aplicación aborta", async () => {
    expect(await correr([enTransaccion(MIGRACION), enTransaccion(MIGRACION)]))
      .toMatch(/^0537 abortado: payment_receipts\.payment_report_id ya existe/);
  }, 300_000);

  it("mutante: sin el vínculo, los casos caen", async () => {
    const m = mutante(
      "update public.payment_receipts set payment_report_id = p_report_id\n        where id = v_receipt_id returning * into v_receipt_row;",
      "select * into v_receipt_row from public.payment_receipts where id = v_receipt_id;",
    );
    expect(await correr([enTransaccion(m), CASOS])).toBe("TEST0537: confirmar crea un recibo vinculado al reporte");
  }, 300_000);

  it("mutante: si la cuenta no entra en la huella, el reintento con otra cuenta no es conflicto", async () => {
    const m = mutante(
      "v_input := pg_catalog.jsonb_build_object('reason', v_reason, 'cash_account_id', v_cash);",
      "v_input := pg_catalog.jsonb_build_object('reason', v_reason);",
    );
    expect(await correr([enTransaccion(m), CASOS])).toMatch(/^TEST0537: misma clave, otra cuenta/);
  }, 300_000);

  it("mutante: sin validar la cuenta, una de gasto se acepta", async () => {
    const m = mutante("and (a.qbo_type = 'Bank' or a.code like '1.1.1%')) then", ") then");
    expect(await correr([enTransaccion(m), CASOS])).toMatch(/^TEST0537: cuenta de gasto/);
  }, 300_000);
});
