-- SDD-0646 · Desarme de la 0559: quita la comprobación del correo del registro por link y devuelve
-- portal_registration_link_bind y portal_registration_link_email_status a sus cuerpos de la 0552.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/portal/__tests__/correo-comprobado.migration.test.ts.
--
-- QUITA la tabla client_email_checks (con el estado «comprobado / sin comprobar» y los enlaces
-- emitidos), sus RPC y el trigger clients_email_vuelve_sin_comprobar_t.
-- NO DESHACE DATOS NI CUENTAS, Y ESO IMPORTA: las cuentas de Auth que llevan su dirección interna
-- la SIGUEN llevando, y client_users.email de esas cuentas sigue siendo la dirección interna. Con la
-- tabla borrada ya no se sabe cuál era el correo por comprobar de cada una (queda en la ficha del
-- cliente, clients.email). ANTES de usar este desarme, para cada cuenta que siga con su
-- dirección interna, hay que hacer UNA de estas dos cosas:
--   · exportar client_email_checks y devolverle su correo con la API de Auth; o
--   · desactivar el acceso por WhatsApp (SDD-0253) de esos clientes.
-- Sin una de las dos, el desarme no se aplica. Este archivo no lo hace.
-- El cuerpo de portal_registration_link_bind de abajo es copia exacta de la 0552 (md5 9dc4862d…).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists clients_email_vuelve_sin_comprobar_t on public.clients;
drop function if exists public.clients_email_vuelve_sin_comprobar();
drop function if exists public.portal_email_check_release(uuid, boolean);
drop function if exists public.portal_email_check_estado(uuid[]);
drop function if exists public.portal_email_check_revisar(uuid);
drop function if exists public.portal_email_check_confirm(uuid, uuid);
drop function if exists public.portal_email_check_claim(text, uuid);
drop function if exists public.portal_email_check_peek(text, uuid);
drop function if exists public.portal_email_check_issue(uuid, text);
drop function if exists public.portal_email_check_auth_interno(uuid);
drop function if exists public.portal_email_check_prepare(uuid);
drop function if exists public.portal_email_sin_comprobar(text);

create or replace function public.portal_registration_link_bind(
  p_link_id      uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l       public.client_registration_links;
  v_email text;
begin
  select * into l from public.client_registration_links x where x.id = p_link_id for update;
  if l.id is null or l.used_at is null or l.used_at < now() - interval '10 minutes' then
    raise exception 'link_invalido' using errcode = 'P0002';
  end if;

  select lower(au.email) into v_email from auth.users au where au.id = p_auth_user_id;
  if v_email is null or v_email is distinct from (l.submitted_data ->> 'email') then
    raise exception 'La cuenta no es la del registro' using errcode = '22023';
  end if;

  insert into public.client_users as u
    (tenant_id, client_id, email, auth_user_id, status, invited_at, bound_at, revoked_at)
  values (l.tenant_id, l.client_id, v_email, p_auth_user_id, 'active', now(), now(), null)
  on conflict (tenant_id, client_id) do update
     set email = excluded.email,
         auth_user_id = excluded.auth_user_id,
         status = 'active',
         invited_at = coalesce(u.invited_at, excluded.invited_at),
         bound_at = excluded.bound_at,
         revoked_at = null
   where u.status <> 'active';

  if not found then
    raise exception 'El cliente ya tiene acceso al portal' using errcode = '22023';
  end if;

  update public.client_registration_links x set access_error = null where x.id = l.id;
end;
$$;

revoke all on function public.portal_registration_link_bind(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_registration_link_bind(uuid, uuid) to service_role;

drop table if exists public.client_email_checks;
drop function if exists public.portal_email_interno_nuevo();

create function public.portal_registration_link_email_status(p_link_ids uuid[])
returns table (link_id uuid, entered_via_email boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    exists (
      select 1
        from public.client_users cu
        join auth.users au on au.id = cu.auth_user_id
       where cu.tenant_id = l.tenant_id
         and cu.client_id = l.client_id
         and cu.status = 'active'
         and au.last_sign_in_at > l.used_at + interval '1 hour'
    )
    and not exists (
      select 1
        from public.portal_access_links a
       where a.tenant_id = l.tenant_id
         and a.client_id = l.client_id
         and a.used_at > l.used_at
    )
  from public.client_registration_links l
  where l.id = any(p_link_ids)
    and l.used_at is not null
    and l.tenant_id = public.get_user_tenant_id();
$$;

comment on function public.portal_registration_link_email_status(uuid[]) is
  'SDD-0646 D-1: por cada link usado del tenant del usuario, si el cliente volvió a entrar al portal por un camino que pasa por su correo (regla conservadora; ver la migración).';

revoke all on function public.portal_registration_link_email_status(uuid[]) from public, anon, service_role;
grant execute on function public.portal_registration_link_email_status(uuid[]) to authenticated;
