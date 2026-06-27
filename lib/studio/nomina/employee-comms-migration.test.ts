/**
 * Guard anti-regresión de las migraciones de SDD-0113 B/C/D (lane ROBUSTO).
 * No corre SQL: lee el archivo y asegura que los INVARIANTES DE SEGURIDAD
 * defensa-en-DB siguen presentes (si alguien los borra al refactor, este test
 * cae). Es dinero + PII: estos candados no se quitan sin querer.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const COMMS = "supabase/migrations/0181_employee_comms.sql";
const SELF = "supabase/migrations/0182_employee_self_service.sql";

describe("0181 employee_comms · defensa-en-DB", () => {
  const sql = read(COMMS);

  it("RLS habilitada en la tabla", () => {
    expect(sql).toContain("alter table public.nomina_employee_comms enable row level security");
  });

  it("helper employee_in_tenant es SECURITY DEFINER, fail-closed y revocado de public/anon", () => {
    expect(sql).toMatch(/create or replace function public\.employee_in_tenant/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).toContain("revoke all on function public.employee_in_tenant(uuid, uuid) from public");
    expect(sql).toContain("revoke execute on function public.employee_in_tenant(uuid, uuid) from anon");
    expect(sql).toContain("grant execute on function public.employee_in_tenant(uuid, uuid) to authenticated");
  });

  it("trigger same-tenant valida employee_id Y el puntero polimórfico ref_id", () => {
    expect(sql).toContain("nomina_employee_comm_check");
    expect(sql).toContain("before insert or update on public.nomina_employee_comms");
    // valida cada ref_kind conocido contra su tabla, mismo tenant:
    expect(sql).toContain("nomina_payroll_run_lines");
    expect(sql).toContain("nomina_warnings");
    expect(sql).toContain("nomina_loans");
  });

  it("RLS DOBLE LADO: admin (nomina_can_access) + empleado dueño (get_employee_id_for_user)", () => {
    expect(sql).toContain("nomina_can_access()");
    expect(sql).toContain("get_employee_id_for_user()");
    // El empleado NO tiene policy de INSERT/DELETE (no puede crear/borrar comms):
    // las policies self son SOLO select + update.
    expect(sql).toContain('"nomina_employee_comms self read"');
    expect(sql).toContain('"nomina_employee_comms self update"');
    expect(sql).not.toMatch(/"nomina_employee_comms self (insert|delete)"/);
  });

  it("guard de columnas del empleado: solo read_at/acked_at (no reescribe el acta · M-2)", () => {
    // El empleado dueño puede UPDATE (policy C) pero el trigger congela el
    // contenido: no puede reescribir body/title/requires_ack de una amonestación.
    expect(sql).toContain("nomina_employee_comm_update_guard");
    expect(sql).toContain("before update on public.nomina_employee_comms");
    expect(sql).toMatch(/new\.body\s+is distinct from old\.body/);
    expect(sql).toMatch(/new\.requires_ack is distinct from old\.requires_ack/);
    // El admin (nomina_can_access) sí puede editar libremente.
    expect(sql).toMatch(/if \(select public\.nomina_can_access\(\)\) then\s*\n\s*return new/);
  });

  it("get_employee_id_for_user es fail-closed (excluye egresado/soft-deleted)", () => {
    expect(sql).toContain("create or replace function public.get_employee_id_for_user()");
    expect(sql).toContain("e.deleted_at is null");
    expect(sql).toContain("e.status <> 'egresado'");
    expect(sql).toContain("auth_user_id");
  });

  it("auth_user_id tiene índice único (1 empleado por auth.user)", () => {
    expect(sql).toContain("nomina_employees_auth_user_uniq");
  });
});

describe("0182 self-service · candados de recibo y perfil", () => {
  const sql = read(SELF);

  it("get_my_payslip es SECURITY DEFINER y SOLO confirmado/pagado (nunca borrador)", () => {
    expect(sql).toContain("create or replace function public.get_my_payslip");
    expect(sql).toMatch(/security definer/);
    expect(sql).toContain("r.status in ('confirmado', 'pagado')");
    expect(sql).toContain("l.employee_id = (select public.get_employee_id_for_user())");
    // No abre RLS de payroll_run_lines: revocada de public/anon.
    expect(sql).toContain("revoke execute on function public.get_my_payslip(text) from anon");
  });

  it("cambio bancario = staging PENDIENTE; el admin confirma (no entra directo)", () => {
    expect(sql).toContain("create table public.nomina_employee_bank_changes");
    expect(sql).toContain("'pendiente'");
    expect(sql).toContain("create or replace function public.request_my_bank_change");
    expect(sql).toContain("create or replace function public.confirm_bank_change");
    // confirm exige rol admin:
    expect(sql).toContain("public.nomina_can_access()");
  });

  it("update_my_contact toca SOLO phone/email (allowlist en la DB)", () => {
    expect(sql).toContain("create or replace function public.update_my_contact");
    expect(sql).toMatch(/set phone = p_phone, email = p_email/);
    // No hay UPDATE directo del empleado sobre salary/cargo: no se da policy de
    // update directa, solo la RPC. (el archivo no debe contener un update de salary
    // accesible al empleado)
    expect(sql).not.toMatch(/set salary_usd/);
  });
});
