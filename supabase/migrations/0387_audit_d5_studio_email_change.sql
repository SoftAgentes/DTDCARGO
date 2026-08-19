-- ─────────────────────────────────────────────────────────────
-- 0387 · SDD-0272 · "studio.email_change" en el carril D5
--
-- QUÉ HABILITA: que un admin corrija desde Studio › Usuarios el correo de un
-- miembro del equipo, y que al hacerlo el correo anterior deje de servir para
-- entrar (enlaces de acceso vigentes revocados + sesiones cerradas).
--
-- POR QUÉ D5 Y NO D1: la escritura ocurre en `auth.users` vía el admin API de
-- Supabase, no en `public`. El carril D1 ejecuta la mutación dentro de su
-- propia función SQL; acá no hay nada que escribir en `public` salvo el rastro.
-- Mismo razonamiento que 0350 para `studio.access_link`.
--
-- ⚠️ EL VALOR PERMITIDO VIVE EN DOS LUGARES y hay que tocar los dos:
--   1. el CHECK de audit_d5_external_operations.operation_type
--   2. la validación `not in (...)` dentro de audit_d5_external_intent
-- Arreglar uno solo deja el bug vivo por el otro lado — la lección que dejó
-- escrita 0350. El test contractual 0387 verifica cada uno por separado.
--
-- ENTITY TYPE: se reusa `membership` (registrado en audit_entity_types con
-- domain_code 'access'), igual que 0350. No se registra ninguno nuevo.
--
-- EVENT TYPE: `membership_email_changed` cumple el contrato de 0267 — matchea
-- ^[a-z][a-z0-9_]{1,79}$ y `_changed` no es de los sufijos reservados de
-- reversión (_rejected|_voided|_cancelled|_canceled|_overridden|_deleted|
-- _restored|_reversed).
--
-- NO HAY PLANTILLA DE CORREO: corregir una dirección no le avisa a nadie por
-- correo. Avisar al buzón viejo sería mandarle el dato a quien justamente ya
-- no debe tener acceso, y al nuevo todavía no hay nada que confirmarle — el
-- gesto que sigue es "Enviar acceso", que ya tiene su propia plantilla (0350).
--
-- Idempotente: el CHECK se recrea y la función es `create or replace`.
-- ─────────────────────────────────────────────────────────────

-- ─── Preflight ───────────────────────────────────────────────
do $preflight$
begin
  if to_regclass('public.audit_d5_external_operations') is null then
    raise exception '0387 requiere public.audit_d5_external_operations (migr 0293)';
  end if;
  if to_regprocedure('public.audit_d5_external_intent(uuid,text,uuid)') is null then
    raise exception '0387 requiere public.audit_d5_external_intent (migr 0293/0350)';
  end if;
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'membership' and status = 'active'
  ) then
    raise exception '0387 requiere el entity_type membership activo en audit_entity_types';
  end if;
  if to_regclass('public.studio_access_tokens') is null then
    raise exception '0387 requiere public.studio_access_tokens (migr 0354)';
  end if;
end;
$preflight$;

-- ─── 1. CHECK de la tabla ────────────────────────────────────
alter table public.audit_d5_external_operations
  drop constraint if exists audit_d5_external_operations_operation_type_check;

alter table public.audit_d5_external_operations
  add constraint audit_d5_external_operations_operation_type_check
  check (
    operation_type in (
      'portal.whatsapp_link',
      'portal.bulk_whatsapp_link',
      'portal.email_invite',
      'portal.email_resend',
      'studio.access_link',
      'studio.email_change'
    )
  );

-- ─── 2. Validación dentro del intent + entity/event por tipo ─
-- Cuerpo idéntico al que dejó 0350 salvo: (a) el valor nuevo en la lista,
-- (b) una rama más en el case de entity/event. Los cuatro `portal.*` y
-- `studio.access_link` conservan EXACTAMENTE el par que tenían — cero cambio
-- de comportamiento para lo que ya está en producción.
create or replace function public.audit_d5_external_intent(
  p_operation_id uuid,
  p_operation_type text,
  p_target_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d5_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_operation public.audit_d5_external_operations%rowtype;
  v_entity_id uuid := coalesce(p_target_id, p_operation_id);
  v_inserted_count integer := 0;
  v_entity_type text;
  v_event_type text;
begin
  if p_operation_id is null
     or p_operation_type not in (
       'portal.whatsapp_link',
       'portal.bulk_whatsapp_link',
       'portal.email_invite',
       'portal.email_resend',
       'studio.access_link',
       'studio.email_change'
     ) then
    raise exception 'invalid_input' using errcode='22023';
  end if;

  if p_operation_type = 'studio.access_link' then
    v_entity_type := 'membership';
    v_event_type := 'membership_access_link_requested';
  elsif p_operation_type = 'studio.email_change' then
    v_entity_type := 'membership';
    v_event_type := 'membership_email_changed';
  else
    v_entity_type := 'portal_invitation';
    v_event_type := 'portal_invitation_requested';
  end if;

  insert into public.audit_d5_external_operations (
    tenant_id, operation_key, operation_type, target_id, requested_by
  ) values (
    v_tenant_id, p_operation_id, p_operation_type, p_target_id, v_actor_id
  )
  on conflict (tenant_id, operation_key) do nothing;
  get diagnostics v_inserted_count = row_count;

  select * into v_operation
  from public.audit_d5_external_operations
  where tenant_id=v_tenant_id and operation_key=p_operation_id
  for update;

  if v_operation.operation_type <> p_operation_type
     or v_operation.target_id is distinct from p_target_id
     or v_operation.requested_by <> v_actor_id then
    raise exception 'idempotency_conflict' using errcode='23505';
  end if;

  if v_inserted_count = 1 then
    perform public.append_audit_event(
      v_tenant_id, v_entity_type, v_entity_id, 'user', v_actor_id,
      v_event_type, 'rpc', 'succeeded', null,
      null,
      pg_catalog.jsonb_build_object('operation_type', p_operation_type),
      '{}'::jsonb,
      pg_catalog.concat('d5:',p_operation_id::text),
      1, 'restricted'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'operation_id', v_operation.operation_key,
    'status', v_operation.status
  );
end;
$function$;

comment on function public.audit_d5_external_intent(uuid,text,uuid) is
  'Registra el intento de un efecto externo D5. Tipos: portal.* (invitaciones al portal), studio.access_link (reponer acceso, SDD-0250) y studio.email_change (corregir el correo de un miembro, SDD-0272). 0293 + 0350 + 0387.';

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_d5_external_operations'::regclass
      and conname = 'audit_d5_external_operations_operation_type_check'
      and pg_get_constraintdef(oid) like '%studio.email_change%'
  ) then
    raise exception '0387: el CHECK no quedo con studio.email_change';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='audit_d5_external_intent'
      and pg_get_functiondef(p.oid) like '%studio.email_change%'
  ) then
    raise exception '0387: la funcion no quedo con studio.email_change';
  end if;

  -- El valor que ya estaba no se puede haber perdido al recrear el CHECK.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_d5_external_operations'::regclass
      and conname = 'audit_d5_external_operations_operation_type_check'
      and pg_get_constraintdef(oid) like '%studio.access_link%'
  ) then
    raise exception '0387: el CHECK perdio studio.access_link';
  end if;
end;
$post$;
