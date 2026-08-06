-- ─────────────────────────────────────────────────────────────
-- 0350 · SDD-0250 · "studio.access_link" en el carril D5
--
-- QUÉ HABILITA: que un admin le reponga el acceso al Studio a un miembro
-- desde Studio › Usuarios ("Enviar acceso"), sin que el founder tenga que
-- correr un UPDATE sobre auth.users.
--
-- POR QUÉ D5 Y NO D1: mandar un enlace de recuperación NO escribe nada en
-- `public` — genera un link contra Supabase Auth y manda un correo. Eso es un
-- efecto externo, que es exactamente lo que modela el carril D5 (0293):
-- intento → claim → efecto → succeed/fail, con reconciliación. El carril D1
-- ejecuta la escritura dentro de su propia función; acá no hay escritura.
--
-- EL VALOR PERMITIDO VIVE EN DOS LUGARES y hay que tocar los dos:
--   1. el CHECK de audit_d5_external_operations.operation_type
--   2. la validación `not in (...)` dentro de audit_d5_external_intent
-- Arreglar uno solo deja el bug vivo por el otro lado. El test contractual
-- 0350_audit_d5_studio_access_link.test.sql verifica cada uno por separado.
--
-- ENTITY TYPE: se reusa `membership`, que YA está registrado en
-- audit_entity_types con domain_code 'access' (hay FK desde entity_audit_log,
-- migr 0258 — un entity_type sin registrar reventaría al insertar el evento).
-- No se registra ninguno nuevo.
--
-- EVENT TYPE: `membership_access_link_requested` cumple el contrato de 0267
-- (regex ^[a-z][a-z0-9_]{1,79}$ y no termina en los sufijos reservados de
-- reversión: _rejected/_voided/_cancelled/_deleted/…).
--
-- LA PLANTILLA DE CORREO VA ACÁ A PROPÓSITO. `studio_access_link` es una FILA
-- de producción, no sólo código: sembrarla únicamente en
-- scripts/seed-mail-templates.ts dejaría el botón devolviendo
-- "template no encontrado" hasta que alguien corriera el seed contra prod.
-- El seed la mantiene igual para paridad local; el UPSERT de acá la pone en
-- prod al aplicar. Ambos lados con el mismo contenido.
--
-- Idempotente: el CHECK se recrea, la función es `create or replace` y la
-- plantilla es UPSERT por (tenant_id, slug).
-- ─────────────────────────────────────────────────────────────

-- ─── Preflight ───────────────────────────────────────────────
do $preflight$
begin
  if to_regclass('public.audit_d5_external_operations') is null then
    raise exception '0350 requiere public.audit_d5_external_operations (migr 0293)';
  end if;
  if to_regprocedure('public.audit_d5_external_intent(uuid,text,uuid)') is null then
    raise exception '0350 requiere public.audit_d5_external_intent (migr 0293)';
  end if;
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'membership' and status = 'active'
  ) then
    raise exception '0350 requiere el entity_type ''membership'' activo en audit_entity_types';
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
      'studio.access_link'
    )
  );

-- ─── 2. Validación dentro del intent + entity/event por tipo ─
-- Cuerpo idéntico al de 0293 salvo: (a) el valor nuevo en la lista, (b) el
-- entity_type/event_type salen de un case en vez de estar hardcodeados. Los
-- cuatro `portal.*` conservan EXACTAMENTE el par que tenían
-- (portal_invitation / portal_invitation_requested) — cero cambio de
-- comportamiento para lo que ya estaba en producción.
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
       'studio.access_link'
     ) then
    raise exception 'invalid_input' using errcode='22023';
  end if;

  if p_operation_type = 'studio.access_link' then
    v_entity_type := 'membership';
    v_event_type := 'membership_access_link_requested';
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
  'Registra el intento de un efecto externo D5. Tipos: portal.* (invitaciones al portal) y studio.access_link (reponer acceso al Studio, SDD-0250). 0293 + 0350.';

-- ─── 3. Plantilla de correo studio_access_link ───────────────
-- Espejo exacto de MAIL_TEMPLATE_SEED en scripts/seed-mail-templates.ts.
-- Vars: {{user_name}} {{tenant_name}} {{access_link}} {{sender_name}}
insert into public.mail_templates (
  tenant_id, slug, name, category, channel, lang, subject, body_html, active
)
select
  t.id,
  'studio_access_link',
  'Acceso al Studio · enlace para crear contraseña',
  'interno',
  'email',
  'es',
  'Tu acceso a {{tenant_name}} · DTD Studio',
  concat(
    '<p>Hola {{user_name}},</p>',
    '<p><strong>{{sender_name}}</strong> te habilitó el acceso a <strong>{{tenant_name}}</strong> en DTD Studio.</p>',
    '<p>Entra por este enlace y crea tu contraseña:</p>',
    '<p style="margin:20px 0;"><a href="{{access_link}}" style="display:inline-block;padding:10px 18px;background:#7F0F1A;color:#fff;text-decoration:none;font:600 14px Archivo,sans-serif;border-radius:6px;">Crear mi contraseña →</a></p>',
    '<p style="color:#6B6B6B;font-size:13px;">El enlace es de un solo uso y caduca. Si no funciona, pídele a quien te lo envió que te genere uno nuevo.</p>',
    '<p style="color:#6B6B6B;font-size:13px;">Una vez adentro puedes cambiar tu contraseña cuando quieras desde el menú de tu usuario, arriba a la derecha.</p>',
    '<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0;">',
    '<p style="color:#6B6B6B;font-size:12px;margin:0;">¿Problemas con el enlace? Cópialo a tu navegador:<br><code style="font-family:''JetBrains Mono'',monospace;font-size:11px;color:#7F0F1A;word-break:break-all;">{{access_link}}</code></p>'
  ),
  true
from public.tenants t
on conflict (tenant_id, slug) do update
set
  name = excluded.name,
  category = excluded.category,
  subject = excluded.subject,
  body_html = excluded.body_html,
  active = true;

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_d5_external_operations'::regclass
      and conname = 'audit_d5_external_operations_operation_type_check'
      and pg_get_constraintdef(oid) like '%studio.access_link%'
  ) then
    raise exception '0350: el CHECK no quedó con studio.access_link';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='audit_d5_external_intent'
      and pg_get_functiondef(p.oid) like '%studio.access_link%'
  ) then
    raise exception '0350: la función no quedó con studio.access_link';
  end if;

  if not exists (
    select 1 from public.mail_templates where slug = 'studio_access_link' and active
  ) then
    raise exception '0350: la plantilla studio_access_link no quedó activa';
  end if;
end;
$post$;
