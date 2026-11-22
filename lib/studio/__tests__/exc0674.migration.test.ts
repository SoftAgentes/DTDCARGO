/**
 * SDD-0674 · EXC-0674 — congela, sobre el texto de la migración 0564, por dónde llegan `accounting` y
 * `admin` a `invoices` sin su RLS: la RPC `exc0674_facturar` (security definer) y la vista de la 0574. Si alguien cambia la
 * firma, el `security definer`, el `search_path`, los grants, el lock de numeración, la regla del
 * asiento o abre escritura en las tablas, esta prueba se pone en rojo. El contrato de la base (RLS,
 * privilegios efectivos y carreras) está en supabase/tests/0564_*.test.sql.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/0564_exc0674_facturar_contenedor.sql"), "utf8");

/** El cuerpo de la RPC, desde su `create` hasta el fin del dólar-quote. */
function rpc(): string {
  const ini = SQL.indexOf("create or replace function public.exc0674_facturar(");
  expect(ini).toBeGreaterThan(-1);
  const fin = SQL.indexOf("$function$;", ini);
  expect(fin).toBeGreaterThan(ini);
  return SQL.slice(ini, fin);
}

describe("migración 0564 · contrato congelado", () => {
  it("firma, security definer y search_path vacío de la RPC", () => {
    const r = rpc();
    expect(r).toMatch(
      /^create or replace function public\.exc0674_facturar\(\s*p_consolidation_id uuid,\s*p_montos jsonb,\s*p_confirmacion text\s*\)\s*returns jsonb\s*language plpgsql\s*volatile\s*security definer\s*set search_path = ''/,
    );
  });

  it("EXECUTE solo para authenticated", () => {
    expect(SQL).toContain("revoke all on function public.exc0674_facturar(uuid, jsonb, text) from public, anon, service_role;");
    expect(SQL).toContain("grant execute on function public.exc0674_facturar(uuid, jsonb, text) to authenticated;");
    expect(SQL.match(/grant execute on function public\.exc0674_facturar/g)).toHaveLength(1);
  });

  it("roles de la EXC-0674 y confirmación exacta en la RPC", () => {
    const r = rpc();
    expect(r).toContain("v_role not in ('accounting', 'admin')");
    // Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.»
    expect(SQL).not.toMatch(/'operations'/);
    expect(r).toContain("p_confirmacion is distinct from 'Confirmado'");
    expect(r).toContain("exc0674:contenedor_fuera_de_lista");
  });

  it("lock de numeración por tenant antes de next_invoice_code, y clientes en orden de Shipping Mark", () => {
    const r = rpc();
    const lock = r.indexOf("'exc0674:numeracion:' || v_tenant::text");
    const numero = r.indexOf("public.next_invoice_code(v_tenant)");
    expect(lock).toBeGreaterThan(-1);
    expect(numero).toBeGreaterThan(lock);
    expect(r).toMatch(/order by pg_catalog\.upper\(pg_catalog\.btrim\(e\.value ->> 'client_markbox'\)\)/);
  });

  it("el asiento tiene que quedar posted o already_posted, y el evento de auditoría lleva legal_ack", () => {
    const r = rpc();
    expect(r).toContain("v_outcome not in ('posted', 'already_posted')");
    expect(r).toContain("'invoice_emitted_exc0674'");
    expect(r).toContain("'legal_ack', 'exc_0674'");
  });

  it("la vista de la 0574 es security_invoker y solo se lee", () => {
    expect(SQL).toMatch(/create or replace view public\.exc0674_envios_cubiertos\s+with \(security_invoker = true\)/);
    expect(SQL).toContain("revoke all on public.exc0674_envios_cubiertos from public, anon, authenticated;");
    expect(SQL).toContain("grant select on public.exc0674_envios_cubiertos to authenticated;");
  });

  it("ninguna policy de escritura y ningún grant de escritura a authenticated", () => {
    for (const m of SQL.matchAll(/create policy [a-z0-9_]+ on public\.exc0674_[a-z_]+\s+for ([a-z]+)/g)) {
      expect(m[1]).toBe("select");
    }
    expect(SQL).not.toMatch(/grant (insert|update|delete|all)[^;]*to authenticated/i);
    expect(SQL).toContain("create trigger exc0674_contenedores_auditar");
    expect(SQL).toMatch(/create unique index if not exists exc0674_facturas_un_cliente_vivo\s+on public\.exc0674_facturas \(tenant_id, consolidation_id, client_markbox\)\s+where anulada_at is null;/);
    expect(SQL).toContain("create trigger exc0674_marcar_anulada");
    expect(SQL.match(/current_studio_role\(\)\) in \('accounting', 'admin'\)/g)).toHaveLength(3);
    expect(SQL).toContain("exc0674:lista_sin_motivo");
  });
});
