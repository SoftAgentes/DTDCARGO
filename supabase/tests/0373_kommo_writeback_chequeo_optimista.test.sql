\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0373 (SDD-0256 · Fase 4 · A1).
-- Fixtures ficticios + rollback. Carga la migración REAL con `\i`: un contrato
-- que reimplementa el DDL deja de medir el archivo que se aplica.
--
-- Lo que este contrato mide es la MITAD de base del chequeo optimista: que el
-- eco exista, que sólo avance, que el salteo lleve código y que nadie más que
-- el backend pueda tocarlo. La comparación en sí es TypeScript puro y vive en
-- `_shared/__tests__/kommo-writeback-plan.test.ts` — ahí está validada por
-- mutación (se rompió `evaluarChequeoOptimista` de 3 formas distintas y las
-- tres salieron rojas).

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');

-- ── Fixture: la tabla como la dejaron 0136 + 0344 + 0365 ────────────────────
create table public.kommo_writeback_outbox (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id    bigint,
  kommo_contact_id bigint,
  op               text not null,
  payload          jsonb not null,
  idempotency_key  text not null,
  status           text not null default 'pending'
    check (status in ('pending','processing','sent','skipped','error')),
  attempts         int not null default 0,
  last_error       text,
  claimed_at       timestamptz,
  kommo_updated_at_at_enqueue timestamptz,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

-- La firma VIEJA de 2 argumentos, tal como la dejó la 0136. La migración tiene
-- que dropearla: con las dos vivas, una llamada de 2 args sería ambigua.
create function public.mark_kommo_writeback_skipped(p_id uuid, p_reason text default null)
returns void language sql as $$
  update public.kommo_writeback_outbox
     set status = 'skipped', last_error = p_reason, sent_at = now() where id = p_id;
$$;

-- ── La migración bajo prueba ────────────────────────────────────────────────
\i /sb/migrations/0373_kommo_writeback_chequeo_optimista.sql

-- ── 1) ⭐ La firma vieja NO puede seguir viva: dos candidatas = ambigüedad ───
do $una_sola$
declare n int;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mark_kommo_writeback_skipped';
  if n <> 1 then
    raise exception
      'quedaron % versiones de mark_kommo_writeback_skipped: una llamada de 2 args seria ambigua y PostgREST fallaria al resolverla', n;
  end if;
end;
$una_sola$;

-- ── 2) El salteo lleva código, y la UI no tiene que parsear prosa ───────────
insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 501, 'patch_stage', '{"status_id":1}', '501:patch_stage'),
       ('11111111-1111-1111-1111-111111111111', 502, 'patch_stage', '{"status_id":2}', '502:patch_stage');

do $skip$
declare v record;
begin
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 501;
  perform public.mark_kommo_writeback_skipped(
    v.id, 'el lead cambio en el CRM despues de encolarse; no se piso', 'stale');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 501;
  if v.status <> 'skipped' then raise exception 'no quedo skipped (%)', v.status; end if;
  if v.skip_code <> 'stale' then
    raise exception 'skip_code quedo en % — la UI no puede distinguir el motivo', v.skip_code;
  end if;

  -- Y la llamada de 2 argumentos sigue funcionando (default null), porque los
  -- callers de hoy no la pasan.
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 502;
  perform public.mark_kommo_writeback_skipped(v.id, 'dry-run');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 502;
  if v.status <> 'skipped' or v.skip_code is not null then
    raise exception 'la llamada de 2 args debia seguir andando y dejar skip_code null (%, %)',
      v.status, v.skip_code;
  end if;
end;
$skip$;

-- ── 3) El vocabulario de skip_code es CERRADO ──────────────────────────────
do $vocab$
begin
  begin
    update public.kommo_writeback_outbox set skip_code = 'porque_si' where kommo_lead_id = 501;
    raise exception 'MUTACION: el CHECK acepto un skip_code inventado';
  exception when check_violation then null;
  end;
end;
$vocab$;

-- ── 4) ⭐ El eco SÓLO AVANZA ────────────────────────────────────────────────
--
-- Si pudiera retroceder, dos drenajes que cierran fuera de orden dejarían un
-- `updated_at` viejo y el chequeo empezaría a ver como AJENO un cambio propio:
-- el verbo dejaría de funcionar de a ratos, que es la peor forma de fallar.
do $eco$
declare v timestamptz;
begin
  perform public.record_kommo_writeback_echo(
    '11111111-1111-1111-1111-111111111111', 601, '2026-08-14T12:00:00Z');
  select kommo_updated_at into v from public.kommo_writeback_echo where kommo_lead_id = 601;
  if v <> '2026-08-14T12:00:00Z'::timestamptz then
    raise exception 'el eco no se sello (%)', v;
  end if;

  -- Avanza.
  perform public.record_kommo_writeback_echo(
    '11111111-1111-1111-1111-111111111111', 601, '2026-08-14T12:05:00Z');
  select kommo_updated_at into v from public.kommo_writeback_echo where kommo_lead_id = 601;
  if v <> '2026-08-14T12:05:00Z'::timestamptz then
    raise exception 'el eco no avanzo (%)', v;
  end if;

  -- Retrocede: NO.
  perform public.record_kommo_writeback_echo(
    '11111111-1111-1111-1111-111111111111', 601, '2026-08-14T11:00:00Z');
  select kommo_updated_at into v from public.kommo_writeback_echo where kommo_lead_id = 601;
  if v <> '2026-08-14T12:05:00Z'::timestamptz then
    raise exception 'EL ECO RETROCEDIO a %: un drenaje lento pisaria el eco del rapido', v;
  end if;
end;
$eco$;

-- ── 5) El eco es por (tenant, lead), no global ─────────────────────────────
do $por_lead$
declare n int;
begin
  perform public.record_kommo_writeback_echo(
    '11111111-1111-1111-1111-111111111111', 602, '2026-08-14T09:00:00Z');
  select count(*) into n from public.kommo_writeback_echo;
  if n <> 2 then raise exception 'se esperaban 2 filas de eco (una por lead), hay %', n; end if;
end;
$por_lead$;

-- ── 6) ⭐ El eco NO es el espejo: no existe camino que escriba kommo_leads ───
--
-- Guardrail 0107. Si alguna vez alguien "resuelve" el falso positivo escribiendo
-- el espejo desde el ERP, este contrato tiene que gritarlo.
do $guardrail$
declare v text;
begin
  select prosrc into v from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'record_kommo_writeback_echo';
  if position('kommo_leads' in v) > 0 then
    raise exception 'el eco toca kommo_leads: eso es escribir el espejo (guardrail 0107)';
  end if;
end;
$guardrail$;

-- ── 7) Permisos: sólo el backend ───────────────────────────────────────────
do $permisos$
begin
  if has_function_privilege('anon', 'public.record_kommo_writeback_echo(uuid,bigint,timestamptz)', 'execute')
  or has_function_privilege('authenticated', 'public.record_kommo_writeback_echo(uuid,bigint,timestamptz)', 'execute')
  or has_function_privilege('authenticated', 'public.mark_kommo_writeback_skipped(uuid,text,text)', 'execute') then
    raise exception 'anon/authenticated pueden tocar la cola: el revoke no quedo';
  end if;
  if not has_function_privilege('service_role', 'public.record_kommo_writeback_echo(uuid,bigint,timestamptz)', 'execute') then
    raise exception 'service_role SI debe poder sellar el eco';
  end if;
end;
$permisos$;

-- ── 8) RLS prendida en el eco, y sin grant a authenticated ─────────────────
do $rls$
begin
  if not exists (select 1 from pg_class where relname = 'kommo_writeback_echo' and relrowsecurity) then
    raise exception 'kommo_writeback_echo quedo SIN RLS';
  end if;
  if has_table_privilege('authenticated', 'public.kommo_writeback_echo', 'select') then
    raise exception 'authenticated no necesita leer el eco: la pantalla lee la outbox';
  end if;
end;
$rls$;

rollback;
