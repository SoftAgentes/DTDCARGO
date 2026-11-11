-- infra/ops/portal-historial/controles-studio.sql — SDD-0586 10.7 (P4), los controles del lado de Studio del
-- ensayo (§10.5.10): C-6, C-7 y C-8. SOLO LECTURA. Devuelve conteos y huellas md5; ni texto, ni nombres,
-- ni ids de clientes. Lo escribe el Worker de la 10.5 y lo corre E5 desde su ensayo, contra la copia
-- efímera de Studio, antes y después de la carga: C-6 y C-7 tienen que dar igual, C-8 lo nuevo.
--
-- Uso:  psql -X -v ON_ERROR_STOP=1 -v tenant=<uuid> -At -f controles-studio.sql
\set ON_ERROR_STOP on
begin transaction read only;
set local statement_timeout = '60s';

-- C-6 · El portal no cambia: conteo y md5 de los ids de conversation_messages y de conversations.
select 'C-6 conversation_messages filas=' || count(*) || ' md5=' || coalesce(md5(string_agg(id::text, ',' order by id)), '-')
from public.conversation_messages where tenant_id = :'tenant'::uuid;
select 'C-6 conversations filas=' || count(*) || ' md5=' || coalesce(md5(string_agg(id::text || ':' || status::text || ':' || coalesce(deleted_at::text, '-'), ',' order by id)), '-')
from public.conversations where tenant_id = :'tenant'::uuid;

-- C-7 · El CRM no cambia.
select 'C-7 crm_tarjetas filas=' || count(*) || ' md5=' || coalesce(md5(string_agg(id::text, ',' order by id)), '-')
from public.crm_tarjetas where tenant_id = :'tenant'::uuid;
select 'C-7 crm_tareas filas=' || count(*) || ' md5=' || coalesce(md5(string_agg(id::text, ',' order by id)), '-')
from public.crm_tareas where tenant_id = :'tenant'::uuid;
select 'C-7 crm_historial_etapas filas=' || count(*) || ' md5=' || coalesce(md5(string_agg(id::text, ',' order by id)), '-')
from public.crm_historial_etapas where tenant_id = :'tenant'::uuid;
select 'C-7 chatwoot_webhook_events filas=' || count(*)
from public.chatwoot_webhook_events where tenant_id = :'tenant'::uuid;

-- C-8 · chatwoot_conversations: una fila por hilo vinculado, con el client_id de su hilo.
select 'C-8 hilos_vinculados=' || count(*)
  || ' con_espejo=' || count(cc.conversation_id)
  || ' client_id_distinto=' || count(*) filter (where cc.conversation_id is not null and cc.client_id is distinct from c.client_id)
from public.chatwoot_portal_hilos h
join public.conversations c on c.id = h.conversation_id
left join public.chatwoot_conversations cc on cc.tenant_id = h.tenant_id and cc.conversation_id = h.chatwoot_conversation_id
where h.tenant_id = :'tenant'::uuid;
select 'C-8 salida_cargado=' || count(*) filter (where estado = 'cargado') || ' salida_enviado=' || count(*) filter (where estado = 'enviado')
from public.chatwoot_portal_salida where tenant_id = :'tenant'::uuid;

commit;
