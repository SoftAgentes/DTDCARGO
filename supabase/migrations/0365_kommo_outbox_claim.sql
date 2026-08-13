-- SDD-0256 · Fase 4 · la cola se puede drenar en paralelo sin duplicar.
--
-- Hoy el drenaje hace `select … where status='pending'` y **no reserva nada**
-- (`kommo-writeback/index.ts`). Con un único cron cada 15 min eso nunca se
-- solapa, así que el hueco es invisible. Deja de serlo en cuanto la Fase 4
-- agregue el *nudge* —invocar el drenaje al instante desde la Server Action—
-- porque entonces el nudge y el cron pueden correr a la vez y **elegir las
-- mismas filas**.
--
-- Con las ops de hoy (todas PATCH) un doble envío es inocuo: PATCH es
-- idempotente, se escribe dos veces el mismo valor. Con las de la Fase 5
-- (`POST /notes`, `POST /tasks`) **crea dos notas**. Se cierra ahora, antes de
-- que exista la op que lo convierte en daño visible.
--
-- ── Por qué `attempts` se incrementa al RESERVAR y no al fallar ─────────────
-- Si sólo contara los fallos, una corrida que muere a mitad (timeout de la edge
-- function, deploy en caliente) dejaría la fila reservada sin haber contado el
-- intento: el reaper la devuelve a `pending`, se vuelve a tomar, vuelve a morir
-- — y `attempts < 5` nunca se agota. Contando en la reserva, `attempts` mide lo
-- que de verdad importa: **cuántas veces se intentó**, muera como muera.
-- Corolario: el fallo se registra con `record_kommo_writeback_error`, que NO
-- vuelve a incrementar. Usar `bump_kommo_writeback_attempt` acá contaría doble.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_writeback_outbox') is null then
    raise exception '0365 requiere public.kommo_writeback_outbox (migración 0136)';
  end if;
end;
$preflight$;

-- ── Estado nuevo: 'processing' = reservada por un drenaje ───────────────────
alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_status_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'skipped', 'error'));

alter table public.kommo_writeback_outbox
  add column if not exists claimed_at timestamptz;

comment on column public.kommo_writeback_outbox.claimed_at is
  'SDD-0256: cuando un drenaje reservo la fila. El reaper usa esto para soltar '
  'las que quedaron colgadas si el proceso murio a mitad.';

-- ── Ops nuevas de la Fase 4 (todas PATCH sobre el lead) ────────────────────
alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_op_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_op_check
  check (op in (
    'patch_price', 'patch_stage', 'patch_lead', 'patch_contact',
    'patch_owner',  -- reasignar asesor  → { responsible_user_id }
    'patch_tags'    -- etiquetar         → { tags_to_add[], tags_to_delete[] }
  ));

-- El reaper barre por (tenant, status='processing'): índice parcial, liviano.
create index if not exists kommo_writeback_outbox_processing_idx
  on public.kommo_writeback_outbox (tenant_id, claimed_at)
  where status = 'processing';

-- ── Reserva atómica ─────────────────────────────────────────────────────────
--
-- `for update skip locked` es lo que hace que dos drenajes simultáneos se
-- repartan el trabajo en vez de pelearlo: el segundo SALTEA las filas que el
-- primero ya bloqueó, en lugar de esperarlas (y terminar procesándolas también).
create or replace function public.claim_kommo_writeback_batch(
  p_tenant_id uuid,
  p_limit     int default 100
)
returns setof public.kommo_writeback_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with elegidas as (
    select o.id
      from public.kommo_writeback_outbox o
     where o.tenant_id = p_tenant_id
       and o.status = 'pending'
       and o.attempts < 5
     order by o.created_at
     for update skip locked
     limit greatest(p_limit, 0)
  )
  update public.kommo_writeback_outbox o
     set status     = 'processing',
         attempts   = o.attempts + 1,
         claimed_at = now()
    from elegidas e
   where o.id = e.id
  returning o.*;
end;
$$;

comment on function public.claim_kommo_writeback_batch(uuid, int) is
  'SDD-0256: reserva filas pendientes con FOR UPDATE SKIP LOCKED y las pasa a '
  'processing incrementando attempts. Dos drenajes simultaneos NO toman la misma fila.';

-- ── Registrar un fallo SIN volver a contar el intento ───────────────────────
create or replace function public.record_kommo_writeback_error(
  p_id    uuid,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox
     set last_error = p_error,
         -- El intento ya lo contó el claim. A los 5, se rinde.
         status = case when attempts >= 5 then 'error' else 'pending' end,
         claimed_at = null
   where id = p_id;
$$;

comment on function public.record_kommo_writeback_error(uuid, text) is
  'SDD-0256: marca el fallo de una fila reservada. NO incrementa attempts — eso lo '
  'hizo el claim; incrementar aca contaria doble cada intento.';

-- ── Soltar lo que quedó colgado ─────────────────────────────────────────────
--
-- Una fila en `processing` con `claimed_at` viejo significa que el drenaje que
-- la tomó murió sin cerrarla. Volverla a `pending` sólo es seguro para ops
-- IDEMPOTENTES: repetir un PATCH escribe el mismo valor dos veces y no pasa
-- nada.
--
-- ⭐ La lista es de lo que SÍ se puede reintentar, no de lo que no. Falla
-- cerrado a propósito: una op futura que no esté acá —las de la Fase 5 son
-- POST, y repetir un POST CREA otra nota— se marca `error` y la mira una
-- persona, en vez de duplicarse en silencio por un default permisivo.
create or replace function public.reap_kommo_writeback_stale(
  p_tenant_id uuid,
  p_older     interval default '10 minutes'
)
returns int
language sql
security definer
set search_path = public
as $$
  with soltadas as (
    update public.kommo_writeback_outbox
       set status = case
                      when op in ('patch_price','patch_stage','patch_lead',
                                  'patch_contact','patch_owner','patch_tags')
                      then 'pending'
                      else 'error'
                    end,
           last_error = 'reserva vencida: el drenaje murio sin cerrar la fila',
           claimed_at = null
     where tenant_id = p_tenant_id
       and status = 'processing'
       and claimed_at < now() - p_older
    returning 1
  )
  select coalesce(count(*), 0)::int from soltadas;
$$;

comment on function public.reap_kommo_writeback_stale(uuid, interval) is
  'SDD-0256: suelta las filas reservadas que quedaron colgadas. Solo vuelven a '
  'pending las ops idempotentes (PATCH); cualquier otra va a error — repetir un '
  'POST crearia un duplicado.';

-- ── Permisos: sólo el backend drena ─────────────────────────────────────────
revoke execute on function public.claim_kommo_writeback_batch(uuid, int) from public, anon, authenticated;
revoke execute on function public.record_kommo_writeback_error(uuid, text) from public, anon, authenticated;
revoke execute on function public.reap_kommo_writeback_stale(uuid, interval) from public, anon, authenticated;
grant  execute on function public.claim_kommo_writeback_batch(uuid, int) to service_role;
grant  execute on function public.record_kommo_writeback_error(uuid, text) to service_role;
grant  execute on function public.reap_kommo_writeback_stale(uuid, interval) to service_role;
