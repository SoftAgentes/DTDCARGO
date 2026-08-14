-- 0373_kommo_writeback_chequeo_optimista.sql
--
-- CRM · SDD-0256 · Fase 4 (A1) — la cola deja de PISAR al asesor en silencio.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- `kommo_writeback_outbox.kommo_updated_at_at_enqueue` existe desde la 0136.
-- Se guarda en cada encolado y **nadie la lee**. Mientras el ERP era el único
-- que escribía, daba igual. Dejó de darlo el 2026-08-13, cuando el founder
-- decidió que reasignar asesor se hace desde el ERP **y** desde Kommo: ahora
-- los dos lados editan, y si el asesor mueve el lead en Kommo mientras la orden
-- viaja desde el ERP, el ERP le pisa el trabajo — y la fila sale `sent`, sin
-- error y sin rastro. El peor desenlace posible: silencioso y con la pantalla
-- diciendo que todo salió bien.
--
-- Esta migración pone lo que falta en la base; la comparación en sí vive en
-- `_shared/kommo-writeback-plan.ts` (`evaluarChequeoOptimista`), que es puro y
-- está cubierto por tests.
--
-- ── Por qué hace falta el ECO (y no alcanza con el snapshot) ────────────────
-- El snapshot se toma del ESPEJO al encolar, y el espejo se llena por webhook.
-- Cuando el ERP escribe un lead, Kommo le sube el `updated_at`. Si el asesor
-- hace dos cosas seguidas sobre el mismo lead —mover de etapa y después
-- etiquetar— y el webhook de la primera todavía no volvió, la segunda orden
-- vería un `updated_at` más nuevo que su snapshot y se saltearía **por un
-- cambio que causamos nosotros**. El chequeo se volvería un verbo que a veces
-- no hace nada, que es peor que el problema que viene a resolver.
--
-- Por eso el drenaje registra acá el `updated_at` que Kommo devuelve tras cada
-- escritura propia, y el chequeo se lo descuenta.
--
-- ⚠️ Esto NO es el espejo. Escribir `kommo_leads` desde el ERP viola el
-- guardrail 0107 (el espejo lo escribe el webhook de Kommo, y sólo él). Esta
-- tabla es una bitácora del write-back: dice qué dejó el ERP, no qué es el lead.
--
-- ── Por qué `skip_code` y no parsear el texto ──────────────────────────────
-- La pantalla tiene que distinguir "no se mandó porque el gate está en ensayo"
-- de "no se mandó porque el lead cambió en el CRM" — la segunda ofrece
-- reintentar y la primera no. Hacer eso leyendo `last_error` con un `LIKE`
-- ataría la UI a la redacción de un mensaje en español. Una columna con
-- vocabulario cerrado no se rompe cuando alguien mejore la frase.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_writeback_outbox') is null then
    raise exception '0373 requiere public.kommo_writeback_outbox (migración 0136)';
  end if;
  if to_regclass('public.tenants') is null then
    raise exception '0373 requiere public.tenants';
  end if;
end;
$preflight$;

-- ── Motivo estructurado del salteo ──────────────────────────────────────────
alter table public.kommo_writeback_outbox
  add column if not exists skip_code text;

alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_skip_code_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_skip_code_check
  check (skip_code is null or skip_code in ('dry_run', 'stale', 'sin_destino'));

comment on column public.kommo_writeback_outbox.skip_code is
  'SDD-0256: por que se salteo la fila, con vocabulario cerrado. stale = el lead '
  'cambio en Kommo despues de encolarse y no se piso (la UI ofrece reintentar). '
  'dry_run = el gate esta en ensayo. sin_destino = falta el id de lead/contacto.';

-- ── El eco: qué dejó NUESTRA última escritura sobre cada lead ───────────────
create table if not exists public.kommo_writeback_echo (
  tenant_id        uuid   not null references public.tenants(id) on delete cascade,
  kommo_lead_id    bigint not null,
  -- El `updated_at` que Kommo devolvio DESPUES de que escribimos.
  kommo_updated_at timestamptz not null,
  written_at       timestamptz not null default now(),
  primary key (tenant_id, kommo_lead_id)
);

comment on table public.kommo_writeback_echo is
  'SDD-0256: bitacora del write-back — el updated_at que dejo cada escritura '
  'propia del ERP. La usa el chequeo optimista para no confundir un cambio '
  'nuestro con un cambio del asesor. NO es el espejo (guardrail 0107): no dice '
  'que ES el lead, dice que le escribimos nosotros.';

-- RLS: sólo el backend. La pantalla no la necesita — lo que la pantalla lee es
-- la outbox, que ya tiene su política de lectura por tenant (0136).
alter table public.kommo_writeback_echo enable row level security;
drop policy if exists "kommo_writeback_echo_service_all" on public.kommo_writeback_echo;
create policy "kommo_writeback_echo_service_all"
  on public.kommo_writeback_echo for all to service_role using (true) with check (true);
grant all on public.kommo_writeback_echo to service_role;

-- ── Registrar el eco ────────────────────────────────────────────────────────
--
-- Sólo AVANZA. Dos drenajes concurrentes pueden cerrar sus PATCH en distinto
-- orden; si el eco pudiera retroceder, el más lento dejaría escrito un
-- `updated_at` viejo y el chequeo empezaría a ver como ajeno un cambio propio.
create or replace function public.record_kommo_writeback_echo(
  p_tenant_id      uuid,
  p_kommo_lead_id  bigint,
  p_kommo_updated_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.kommo_writeback_echo (tenant_id, kommo_lead_id, kommo_updated_at)
  values (p_tenant_id, p_kommo_lead_id, p_kommo_updated_at)
  on conflict (tenant_id, kommo_lead_id) do update
     set kommo_updated_at = greatest(
           public.kommo_writeback_echo.kommo_updated_at, excluded.kommo_updated_at),
         written_at = now()
   where excluded.kommo_updated_at > public.kommo_writeback_echo.kommo_updated_at;
$$;

comment on function public.record_kommo_writeback_echo(uuid, bigint, timestamptz) is
  'SDD-0256: sella el updated_at que dejo una escritura propia del ERP sobre un '
  'lead. Solo avanza: nunca retrocede el eco.';

-- ── El salteo pasa a llevar código, no sólo prosa ───────────────────────────
--
-- Se DROPEA la de 2 argumentos en vez de sobrecargarla: con las dos vivas, una
-- llamada de 2 args sería ambigua y PostgREST fallaría al resolverla. El
-- parámetro nuevo va con default para que las llamadas existentes sigan
-- compilando sin tocarlas.
drop function if exists public.mark_kommo_writeback_skipped(uuid, text);

create or replace function public.mark_kommo_writeback_skipped(
  p_id     uuid,
  p_reason text default null,
  p_code   text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox
     set status     = 'skipped',
         last_error = p_reason,
         skip_code  = p_code,
         sent_at    = now()
   where id = p_id;
$$;

comment on function public.mark_kommo_writeback_skipped(uuid, text, text) is
  'SDD-0083/0256: marca la fila como salteada (no es fallo, no se reintenta). '
  'p_code da el motivo con vocabulario cerrado para que la UI no parsee prosa.';

-- ── Permisos: idénticos al resto de la cola ─────────────────────────────────
revoke execute on function public.record_kommo_writeback_echo(uuid, bigint, timestamptz) from public, anon, authenticated;
grant  execute on function public.record_kommo_writeback_echo(uuid, bigint, timestamptz) to service_role;
revoke execute on function public.mark_kommo_writeback_skipped(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.mark_kommo_writeback_skipped(uuid, text, text) to service_role;
