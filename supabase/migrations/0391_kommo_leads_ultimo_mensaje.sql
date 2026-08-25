-- SDD-0288 rebanada 1 · el último mensaje del lead, y de qué lado vino.
--
-- El founder pidió ver "qué cliente está activo, a quién le escribo y de quién
-- espero respuesta". Eso son tres estados, y los tres salen de dos fechas.
--
-- ── Por qué DOS FECHAS y no una columna de estado ───────────────────────────
--
-- Se guarda el HECHO (cuándo escribió cada lado), no la conclusión (si está
-- rojo). Un `estado text` habría que recalcularlo con cada mensaje y quedaría
-- mintiendo en cuanto alguien conteste desde Kommo sin que llegue el webhook.
-- Con las dos fechas, el estado se deriva en el momento de pintar y no puede
-- desincronizarse:
--
--   last_inbound_at > last_outbound_at (o sin outbound) → TE ESCRIBIÓ  🔴
--   hay outbound y es el más reciente                   → ESPERANDO    ⚪
--   las dos en null                                     → sin conversación
--
-- ── Los valores salen de producción, no de la documentación ─────────────────
--
-- Medido el 2026-08-25 04:34 UTC sobre un mensaje real (SDD-0288 rebanada 0b):
--
--   message[add][N][type]         = "incoming"
--   message[add][N][author][type] = "external"
--   message[add][N][entity_type]  = "lead"
--   message[add][N][origin]       = "waba"
--
-- ⚠️ Sólo se observó el lado ENTRANTE. El token de saliente todavía no se vio,
-- así que la regla se escribe como "¿es incoming?" y NO como "¿es igual a tal
-- token de saliente?". Consecuencia: cualquier valor no visto cae en el estado
-- neutro, nunca en el rojo. Falla hacia el lado seguro — como mucho deja de
-- encender una alerta, jamás la enciende de más.
--
-- ── last_message_origin ─────────────────────────────────────────────────────
--
-- El canal por el que entró. No lo necesita el semáforo: responde una pregunta
-- de negocio que lleva abierta desde el 10-ago — cuánta captación viene de
-- Instagram y Facebook, que hasta hoy es un 32% ESTIMADO. Con esta columna pasa
-- a ser medido, y sale gratis porque el dato viaja en el mismo webhook.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_leads') is null then
    raise exception '0391 requiere public.kommo_leads (migración 0082)';
  end if;
end;
$preflight$;

alter table public.kommo_leads
  add column if not exists last_inbound_at      timestamptz,
  add column if not exists last_outbound_at     timestamptz,
  add column if not exists last_message_origin  text;

comment on column public.kommo_leads.last_inbound_at is
  'SDD-0288: cuando el CLIENTE escribio por ultima vez (message[add] con '
  'type=incoming y author.type=external). Null = nunca escribio por chat.';

comment on column public.kommo_leads.last_outbound_at is
  'SDD-0288: cuando le escribimos por ultima vez (cualquier message[add] que NO '
  'sea incoming). Se define por descarte a proposito: el token de saliente no '
  'esta medido, y asi un valor desconocido cae en el estado neutro, no en rojo.';

comment on column public.kommo_leads.last_message_origin is
  'SDD-0288: canal del ultimo mensaje (waba | instagram | facebook | ...). No lo '
  'usa el semaforo: mide que porcentaje de la captacion entra por cada canal, '
  'que hasta ahora era una estimacion.';

-- El Tablero pregunta "¿a quién le debo respuesta?" — o sea, los leads con
-- entrante más reciente que el saliente. Índice parcial: los que nunca
-- escribieron no participan de esa consulta y no tienen por qué ocupar el índice.
create index if not exists kommo_leads_sin_responder_idx
  on public.kommo_leads (tenant_id, last_inbound_at desc)
  where last_inbound_at is not null;

-- ── La RPC que estampa el mensaje ───────────────────────────────────────────
--
-- ⚠️ Los webhooks NO llegan en orden garantizado, y Kommo reintenta. Un simple
-- `set last_inbound_at = <fecha>` haría que un evento atrasado PISE una fecha
-- más nueva y el lead se vea "contestado" cuando no lo está. Por eso el update
-- es monótono: `greatest()`, nunca hacia atrás.
--
-- ⚠️ Y es UPDATE, no upsert, a propósito. Un `message[add]` puede referirse a un
-- lead que todavía no está espejado (los de la bandeja `unsorted` no existen en
-- `kommo_leads` hasta que alguien los acepta). Un upsert fabricaría una fila
-- fantasma con dos fechas y ningún nombre, etapa ni embudo — basura que el
-- Tablero pintaría como un lead real. Si la fila no existe, esto devuelve null
-- y el llamador lo cuenta como "sin espejar".
create or replace function public.kommo_touch_lead_message(
  p_tenant_id uuid,
  p_lead_id   bigint,
  p_at        timestamptz,
  p_entrante  boolean,
  p_origin    text
) returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  update public.kommo_leads
     set last_inbound_at = case
           when p_entrante then greatest(
             coalesce(last_inbound_at, '-infinity'::timestamptz), p_at)
           else last_inbound_at
         end,
         last_outbound_at = case
           when p_entrante then last_outbound_at
           else greatest(
             coalesce(last_outbound_at, '-infinity'::timestamptz), p_at)
         end,
         -- El canal sólo se pisa si ESTE mensaje es el más nuevo de los dos
         -- lados; si no, un evento atrasado dejaría un canal viejo como "el
         -- último".
         last_message_origin = case
           when p_origin is not null and p_at >= greatest(
                  coalesce(last_inbound_at,  '-infinity'::timestamptz),
                  coalesce(last_outbound_at, '-infinity'::timestamptz))
           then p_origin
           else last_message_origin
         end
   where tenant_id = p_tenant_id
     and id = p_lead_id
  returning true;
$$;

comment on function public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text) is
  'SDD-0288: estampa el ultimo mensaje del lead. Monotona (greatest: un webhook '
  'atrasado no pisa una fecha mas nueva) y UPDATE, no upsert (un mensaje de un '
  'lead sin espejar devuelve null en vez de fabricar una fila fantasma).';

-- Sólo el webhook (service_role) escribe el espejo. Revoke explícito primero:
-- el default de Postgres es EXECUTE para PUBLIC, y en una función SECURITY
-- DEFINER eso sería una escritura al espejo abierta a cualquiera con sesión.
revoke all on function public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text) from public;
revoke all on function public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text) from anon;
revoke all on function public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text) from authenticated;
grant execute on function public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text) to service_role;
