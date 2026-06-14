-- ─────────────────────────────────────────────────────────────
-- SDD-0080 · Cierre de período contable ("cerrar los libros", estilo QBO)
--
-- Permite al admin fijar una `closing_date` por tenant. Los asientos con
-- `entry_date <= closing_date` quedan READ-ONLY: un trigger en journal_entries
-- rechaza INSERT/UPDATE/DELETE de filas en período cerrado. Para corregir algo
-- de un período cerrado, el admin primero mueve la fecha de cierre hacia atrás
-- (reabre), corrige y vuelve a cerrar.
--
-- El trigger aplica a TODOS los roles (incl. service_role): los posteos
-- automáticos (factura/cobro/CxP/pago/gasto) que intenten asentar dentro de un
-- período cerrado fallan en best-effort (logean, no rompen la transacción).
--
-- Patrón singleton + RLS admin-only tomado de fiscal_settings (0126). Trigger +
-- helper security-definer tomados de 0128 (revoke execute from public, anon).
-- Aditiva: no toca tablas existentes. Sin seed (closing_date nace NULL = abierto).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. accounting_settings — singleton por tenant             ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.accounting_settings (
  tenant_id    uuid primary key references public.tenants(id) on delete cascade,
  -- NULL = período abierto (sin restricción). Fechas <= esta quedan cerradas.
  closing_date date,
  locked_by    uuid references auth.users(id) on delete set null,
  locked_at    timestamptz,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

comment on table public.accounting_settings is
  'SDD-0080: config contable per-tenant (1 row/tenant). closing_date = fecha del cierre; asientos con entry_date <= closing_date son read-only (trigger rechaza INSERT/UPDATE/DELETE). NULL = abierto. RLS por tenant, admin-only para escribir.';
comment on column public.accounting_settings.closing_date is
  'SDD-0080: fecha del cierre de período. Asientos con entry_date <= esta fecha quedan bloqueados (trigger journal_entries_validate_closing). NULL = período abierto. Solo admin la cambia.';

grant select, insert, update on public.accounting_settings to authenticated;
grant all on public.accounting_settings to service_role;

alter table public.accounting_settings enable row level security;

-- SELECT: cualquier usuario autenticado del tenant (para mostrar el estado).
create policy "accounting_settings_tenant_select"
  on public.accounting_settings for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT (lazy upsert): solo admin del tenant.
create policy "accounting_settings_admin_insert"
  on public.accounting_settings for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = accounting_settings.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

-- UPDATE: solo admin del tenant (USING + WITH CHECK ambos requeridos).
create policy "accounting_settings_admin_update"
  on public.accounting_settings for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = accounting_settings.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

-- DELETE: bloqueado para authenticated (singleton, no se borra).
create policy "accounting_settings_no_delete_authenticated"
  on public.accounting_settings for delete to authenticated using (false);

-- service_role: acceso total (admin client / jobs).
create policy "service_role_all_accounting_settings"
  on public.accounting_settings for all to service_role using (true) with check (true);

create trigger accounting_settings_touch
  before update on public.accounting_settings
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Bloqueo de asientos en período cerrado (trigger)       ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Helper: closing_date del tenant (NULL si no hay config o período abierto).
-- security-definer para leer accounting_settings saltando RLS (lo llama el
-- trigger, que puede correr como cualquier rol). STABLE → cacheable por statement.
create or replace function public.get_accounting_closing_date(p_tenant_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select closing_date
  from public.accounting_settings
  where tenant_id = p_tenant_id;
$$;

comment on function public.get_accounting_closing_date(uuid) is
  'SDD-0080: closing_date del tenant (NULL si sin cierre). Lo usa el trigger de bloqueo de período.';

revoke execute on function public.get_accounting_closing_date(uuid) from public, anon;
grant execute on function public.get_accounting_closing_date(uuid) to authenticated;
grant execute on function public.get_accounting_closing_date(uuid) to service_role;

-- Trigger: rechaza INSERT/UPDATE/DELETE de asientos con entry_date <= closing_date.
-- SECURITY INVOKER (default) — aplica a todos los roles, incl. service_role.
create or replace function public.journal_entries_validate_closing()
returns trigger
language plpgsql
as $$
declare
  v_closing_date date;
  v_tenant_id    uuid := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;
  -- Chequea OLD *y* NEW: así no se puede "sacar" un asiento del período cerrado
  -- moviendo su entry_date a futuro (ni meterlo retroactivo).
  v_old_date     date := case when tg_op = 'INSERT' then null else old.entry_date end;
  v_new_date     date := case when tg_op = 'DELETE' then null else new.entry_date end;
begin
  v_closing_date := public.get_accounting_closing_date(v_tenant_id);

  if v_closing_date is not null
     and ((v_old_date is not null and v_old_date <= v_closing_date)
       or (v_new_date is not null and v_new_date <= v_closing_date)) then
    raise exception
      'Período contable cerrado: no se puede %s un asiento en período cerrado (cierre: %).',
      case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'borrar' end,
      v_closing_date
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.journal_entries_validate_closing() is
  'SDD-0080: bloquea INSERT/UPDATE/DELETE de journal_entries con entry_date <= closing_date del tenant (período cerrado). raise check_violation.';

revoke execute on function public.journal_entries_validate_closing() from public, anon;

drop trigger if exists journal_entries_validate_closing_trg on public.journal_entries;
create trigger journal_entries_validate_closing_trg
  before insert or update or delete on public.journal_entries
  for each row execute function public.journal_entries_validate_closing();

-- ── Las LÍNEAS de un asiento cerrado también son inmutables ───
-- El debe/haber real vive en journal_lines. Sin esto, un PATCH directo a
-- journal_lines alteraría los montos de un período cerrado saltando el trigger
-- del header. Helper security-definer (lee el entry padre saltando RLS → fail-closed).
create or replace function public.journal_entry_is_closed(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select je.entry_date <= s.closing_date
  from public.journal_entries je
  join public.accounting_settings s on s.tenant_id = je.tenant_id
  where je.id = p_entry_id
    and s.closing_date is not null;
$$;

comment on function public.journal_entry_is_closed(uuid) is
  'SDD-0080: ¿el asiento está en período cerrado? (entry_date <= closing_date del tenant). Lo usa el trigger de journal_lines.';

revoke execute on function public.journal_entry_is_closed(uuid) from public, anon;
grant execute on function public.journal_entry_is_closed(uuid) to authenticated;
grant execute on function public.journal_entry_is_closed(uuid) to service_role;

create or replace function public.journal_lines_validate_closing()
returns trigger
language plpgsql
as $$
declare
  v_entry_id uuid := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
begin
  if coalesce(public.journal_entry_is_closed(v_entry_id), false) then
    raise exception
      'Período contable cerrado: no se pueden modificar las líneas de un asiento cerrado.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.journal_lines_validate_closing() is
  'SDD-0080: bloquea INSERT/UPDATE/DELETE de líneas cuyo asiento está en período cerrado.';

revoke execute on function public.journal_lines_validate_closing() from public, anon;

drop trigger if exists journal_lines_validate_closing_trg on public.journal_lines;
create trigger journal_lines_validate_closing_trg
  before insert or update or delete on public.journal_lines
  for each row execute function public.journal_lines_validate_closing();

-- ─────────────────────────────────────────────────────────────
-- Nota: los posteos automáticos (best-effort) que caigan en período cerrado
-- fallan sin romper la transacción de origen (logean). Editar/borrar un gasto
-- cuyo asiento está en período cerrado deja el asiento intacto (los libros
-- cerrados son inmutables); es el comportamiento contable correcto.
-- ─────────────────────────────────────────────────────────────
-- Fin migración 0133_period_close.sql
-- Aplicar (coordinación, NO en esta ventana): supabase migration apply 0133
-- ─────────────────────────────────────────────────────────────
