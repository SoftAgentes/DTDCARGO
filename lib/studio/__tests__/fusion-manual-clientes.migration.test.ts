// @vitest-environment node
/**
 * SDD-0712 · lo que la migración 0572 NO puede perder. Es estática (lee el
 * texto que el runbook aplicará): comprueba que las tres funciones nuevas
 * conservan los candados. El contrato corrido sobre PostgreSQL queda para el CI
 * con Docker (supabase/tests).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SQL = readFileSync(resolve(ROOT, "supabase/migrations/0572_fusion_manual_clientes.sql"), "utf8");

function cuerpo(nombre: string): string {
  const i = SQL.indexOf(`create or replace function public.${nombre}(`);
  expect(i, `falta ${nombre}`).toBeGreaterThan(-1);
  const fin = SQL.indexOf("\n$$;", i);
  return SQL.slice(i, fin);
}

const FUNCIONES = ["client_search_for_merge", "client_merge_preview", "merge_clients_manual"];

describe("0572 fusión manual", () => {
  it.each(FUNCIONES)("%s: SECURITY DEFINER, search_path vacío, rol y tenant de la sesión", (f) => {
    const c = cuerpo(f);
    expect(c).toMatch(/security definer/);
    expect(c).toMatch(/set search_path = ''/);
    expect(c).toMatch(/assert_studio_role/);
    expect(c).toMatch(/get_user_tenant_id\(\)/);
  });

  it.each([
    "client_search_for_merge(text)",
    "client_merge_preview(uuid, uuid)",
    "merge_clients_manual(uuid, uuid, text, text)",
  ])("%s: anon sin EXECUTE", (firma) => {
    expect(SQL).toContain(`revoke all on function public.${firma} from public, anon;`);
    expect(SQL).toContain(`grant execute on function public.${firma} to authenticated;`);
  });

  it("ninguna recibe el tenant por parámetro", () => {
    for (const f of FUNCIONES) expect(cuerpo(f).split("returns")[0]).not.toMatch(/p_tenant/);
  });

  it("la búsqueda excluye aliados, borrados y fusionados y tiene tope", () => {
    const c = cuerpo("client_search_for_merge");
    expect(c).toMatch(/c\.deleted_at is null/);
    expect(c).toMatch(/c\.merged_into_client_id is null/);
    expect(c).toMatch(/c\.aliado_id is null/);
    expect(c).toMatch(/limit 25/);
  });

  it("la vista previa no calcula montos", () => {
    expect(cuerpo("client_merge_preview")).not.toMatch(/amount|total|balance|outstanding/i);
  });

  it("la fusión manual exige motivo, confirmación y deja rastro, sin reescribir merge_clients", () => {
    const c = cuerpo("merge_clients_manual");
    expect(c).toMatch(/not between 4 and 1000/);
    expect(c).toMatch(/is distinct from pg_catalog\.upper\(m\.markbox\)/);
    expect(c).toMatch(/set_config\('dtd\.audit_reason'/);
    expect(c).toMatch(/public\.merge_clients\(p_survivor_id, p_merged_id\)/);
    expect(c).toMatch(/'client_merge_manual'/);
    expect(SQL).not.toMatch(/create or replace function public\.merge_clients\(/);
  });

  it("no toca datos fuera de las funciones", () => {
    const fuera = SQL.replace(/create or replace function[\s\S]*?\n\$\$;/g, "");
    expect(fuera).not.toMatch(/^\s*(insert into|update|delete from)\s/im);
  });
});
