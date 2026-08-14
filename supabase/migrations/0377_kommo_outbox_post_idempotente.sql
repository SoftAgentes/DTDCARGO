-- 0377_kommo_outbox_post_idempotente.sql
--
-- CRM · SDD-0256 · Fase 5 (B2 + B3) — la cola aprende a llevar POST sin duplicar.
--
-- Va ANTES de que exista la primera nota, no después: es la misma disciplina de
-- la 0366 (arreglar la fusión de arrays antes de cablear la UI de etiquetas).
-- Al revés, la primera nota duplicada ya está en Kommo y no se puede sacar de
-- la cabeza del cliente que la leyó.
--
-- ── B2 · por qué la clave de hoy no sirve para POST ─────────────────────────
-- La clave es `<leadId>:<op>` (0364:94) y el índice único sólo cubre
-- `status='pending'` (0136:48-50). Para PATCH está bien y es deliberado:
-- "gana el último", dos órdenes de etapa se fusionan en una y Kommo recibe el
-- estado final. Para POST está roto: **dos notas distintas son dos notas**, y
-- con esa clave la segunda pisaría el texto de la primera y saldría una sola.
--
-- Se agrega `dedupe_token`, que genera el DRAWER al abrirse:
--   · dos notas distintas  → dos drawers → dos tokens → dos filas.   ✔
--   · doble submit / doble clic → mismo drawer → mismo token → una fila. ✔
--
-- ── El índice: por qué el del token NO filtra por status ───────────────────
-- Un token de idempotencia vale para siempre, no mientras la fila esté
-- pendiente. Si filtrara por status, un re-submit llegado después de que la
-- nota ya salió (`sent`) crearía una segunda nota — que es justo lo que se
-- viene a evitar. Por eso el índice del token es único sobre
-- `(tenant_id, idempotency_key)` a secas.
--
-- ⚠️ Y por qué el índice de PATCH se queda como está. La tentación es
-- extenderlo a `status in ('pending','processing')` para que la dedup no
-- "desaparezca" con la fila en vuelo. Sería un retroceso: con la fila en
-- `processing` el drenaje YA leyó el payload, así que fusionar encima
-- descartaría la orden nueva —la fila saldría `sent` con el valor viejo— que es
-- exactamente la pérdida silenciosa que la 0364 vino a cerrar. Hoy, con la fila
-- en vuelo, se crea una fila nueva y Kommo termina en el estado que el asesor
-- pidió último; repetir un PATCH es inocuo. El hueco real de `processing` es
-- el de POST, y lo cierra el token de arriba.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_writeback_outbox') is null then
    raise exception '0377 requiere public.kommo_writeback_outbox (migración 0136)';
  end if;
  if to_regprocedure('public.kommo_merge_payload(jsonb, jsonb)') is null then
    raise exception '0377 requiere public.kommo_merge_payload (migración 0366)';
  end if;
end;
$preflight$;

-- ── B3 · las ops nuevas ─────────────────────────────────────────────────────
alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_op_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_op_check
  check (op in (
    'patch_price', 'patch_stage', 'patch_lead', 'patch_contact',
    'patch_owner',  -- reasignar asesor  → { responsible_user_id }
    'patch_tags',   -- etiquetar         → { tags_to_add[], tags_to_delete[] }
    'add_note',     -- POST /leads/{id}/notes  → { note_type, params:{text} }
    'add_task'      -- POST /tasks             → { text, complete_till, entity_id, … }
  ));

-- ── B2 · el token del drawer ────────────────────────────────────────────────
alter table public.kommo_writeback_outbox
  add column if not exists dedupe_token text;

comment on column public.kommo_writeback_outbox.dedupe_token is
  'SDD-0256: token que genera el drawer al abrirse, para las ops POST. Dos notas '
  'distintas = dos tokens = dos filas; doble submit = un token = una fila.';

-- Único para SIEMPRE (sin filtro de status): el token identifica la intención,
-- y esa intención ya se cumplió aunque la fila haya salido `sent` hace un rato.
create unique index if not exists kommo_writeback_outbox_token_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where dedupe_token is not null;

-- ── El encolado, con las dos semánticas ─────────────────────────────────────
--
-- Se DROPEA la firma de 5 argumentos en vez de sobrecargarla: con las dos vivas
-- una llamada de 5 sería ambigua. El parámetro nuevo lleva default, así que los
-- callers de hoy (`enqueueKommoLeadOp`, los tres `enqueueKommo*Writeback`)
-- siguen resolviendo sin tocarlos.
drop function if exists public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz);

create or replace function public.enqueue_kommo_writeback(
  p_tenant_id         uuid,
  p_kommo_lead_id     bigint,
  p_op                text,
  p_payload           jsonb,
  p_kommo_updated_at  timestamptz default null,
  p_dedupe_token      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_tok text := nullif(btrim(coalesce(p_dedupe_token, '')), '');
  v_key text;
begin
  if v_tok is null then
    -- ── PATCH · "gana el último": se fusiona sobre la fila pendiente ────────
    v_key := p_kommo_lead_id::text || ':' || p_op;

    insert into public.kommo_writeback_outbox
      (tenant_id, kommo_lead_id, op, payload, idempotency_key, kommo_updated_at_at_enqueue)
    values
      (p_tenant_id, p_kommo_lead_id, p_op, p_payload, v_key, p_kommo_updated_at)
    on conflict (tenant_id, idempotency_key) where status = 'pending'
    do update set
      payload = public.kommo_merge_payload(
                  public.kommo_writeback_outbox.payload, excluded.payload),
      kommo_updated_at_at_enqueue = excluded.kommo_updated_at_at_enqueue,
      attempts   = 0,
      last_error = null,
      skip_code  = null,
      created_at = now()
    returning id into v_id;
    return v_id;
  end if;

  -- ── POST · "una sola vez": el token manda, y no se fusiona NADA ───────────
  -- Fusionar dos notas sería inventar una tercera. Si el token ya existe, la
  -- intención ya está registrada: se devuelve la fila que hay.
  v_key := p_kommo_lead_id::text || ':' || p_op || ':' || v_tok;

  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key,
     kommo_updated_at_at_enqueue, dedupe_token)
  values
    (p_tenant_id, p_kommo_lead_id, p_op, p_payload, v_key, p_kommo_updated_at, v_tok)
  on conflict (tenant_id, idempotency_key) where dedupe_token is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.kommo_writeback_outbox
     where tenant_id = p_tenant_id and idempotency_key = v_key
     limit 1;
  end if;
  return v_id;
end;
$$;

comment on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz, text) is
  'SDD-0256: encola una orden ERP->Kommo. Sin token (PATCH) fusiona sobre la fila '
  'pendiente: gana el ultimo. Con token (POST) crea UNA fila por token y devuelve '
  'la existente si se repite — dos notas distintas nunca colapsan en una.';

-- ── B3 · un POST se intenta UNA vez ─────────────────────────────────────────
--
-- La 0365 dejó `record_kommo_writeback_error` devolviendo la fila a `pending`
-- mientras `attempts < 5`. Correcto para PATCH. Para POST no: un fallo puede
-- ser "Kommo cortó la respuesta DESPUÉS de crear la nota", y reintentar deja
-- dos. La lista de reintentables es la MISMA del reaper (0365:150-151), y es
-- de lo que SÍ se puede repetir — una op que nadie declare cae en `error` y la
-- mira una persona.
create or replace function public.record_kommo_writeback_error(
  p_id    uuid,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox o
     set last_error = p_error,
         status = case
                    when o.op not in ('patch_price','patch_stage','patch_lead',
                                      'patch_contact','patch_owner','patch_tags')
                      then 'error'          -- POST: se intenta una vez y basta
                    when o.attempts >= 5 then 'error'
                    else 'pending'
                  end,
         claimed_at = null
   where o.id = p_id;
$$;

comment on function public.record_kommo_writeback_error(uuid, text) is
  'SDD-0256: marca el fallo de una fila reservada. NO incrementa attempts (eso lo '
  'hizo el claim). Una op NO idempotente (POST) va directo a error: reintentarla '
  'crearia una nota/tarea duplicada.';

-- ── Permisos: idénticos al resto de la cola ─────────────────────────────────
revoke execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz, text) to service_role;
revoke execute on function public.record_kommo_writeback_error(uuid, text) from public, anon, authenticated;
grant  execute on function public.record_kommo_writeback_error(uuid, text) to service_role;
