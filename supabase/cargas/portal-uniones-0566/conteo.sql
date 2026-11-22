-- supabase/cargas/portal-uniones-0566/conteo.sql — SDD-0676, conteo previo del relleno de uniones del portal.
--
-- SOLO LECTURA. Una sola consulta que devuelve CONTEOS: ningún nombre, teléfono, correo, texto ni id.
-- No crea funciones ni tablas, ni siquiera temporales, y corre dentro de una transacción de solo lectura
-- que termina en rollback. Es la consulta que se le lleva a Sam ANTES de pedir el OK del relleno
-- (uniones-portal.sql en esta carpeta, que sí escribe filas).
--
-- Requiere la 0566 aplicada (usa chatwoot_conversations.chat_contact_id y el origen «portal»). Sin ella,
-- falla con «column does not exist» y no devuelve nada.
--
-- Cómo correrla (desde el repo, contra la base de producción, con quien tenga acceso):
--
--   psql -v ON_ERROR_STOP=1 -v tenant=<TENANT> -f supabase/cargas/portal-uniones-0566/conteo.sql
--
-- <TENANT> es el tenant dueño de la cuenta de Chatwoot (CHATWOOT_TENANT_ID). La salida son 8 filas.
--
-- Cómo leerla:
--   · El dato 5 es el número ESPERADAS que hay que pasarle al relleno: las uniones que crearía.
--   · El dato 3 debe ser cero. Si no lo es, hay contactos del portal que alguien unió a mano a OTRA
--     ficha: el relleno no los toca y los resuelve una persona, uno por uno, desde la ficha del cliente.
--   · Los datos 4 y 8 son informativos: no se crean uniones para ellos.
--   · Con el dato 5 en cero y el 6 en cero no hay nada que rellenar.
--
-- Es la misma lógica de pg_temp.contar_uniones_portal (uniones-portal.sql) más los datos 7 y 8; la
-- prueba de PGlite (chatwoot-vincular-canal.migration.test.ts) comprueba que dan lo mismo.
begin read only;

with portal as (
  select k.client_id, k.chatwoot_contact_id, c.deleted_at is null as viva
  from public.chatwoot_portal_contactos k
  join public.clients c on c.id = k.client_id and c.tenant_id = k.tenant_id
  where k.tenant_id = :'tenant'::uuid and k.chatwoot_contact_id is not null
), cruzado as (
  select p.client_id, p.viva, l.client_id as unido_a
  from portal p
  left join public.chatwoot_contact_links l on l.chatwoot_contact_id = p.chatwoot_contact_id
)
select '1. contactos del portal con contacto de Chatwoot' as dato, count(*) as cuantos from cruzado
union all
select '2. ya unidos a su ficha (no se tocan)', count(*) from cruzado where unido_a = client_id
union all
select '3. unidos a OTRA ficha (no se tocan; los resuelve una persona)', count(*) from cruzado
  where unido_a is not null and unido_a <> client_id
union all
select '4. de una ficha borrada (no se crean)', count(*) from cruzado where unido_a is null and not viva
union all
select '5. ESPERADAS: uniones que el relleno va a crear', count(*) from cruzado where unido_a is null and viva
union all
select '6. conversaciones del portal sin contacto anotado', count(*)
  from public.chatwoot_portal_hilos h
  join public.conversations t on t.id = h.conversation_id and t.tenant_id = h.tenant_id
  join public.chatwoot_portal_contactos k on k.tenant_id = h.tenant_id and k.client_id = t.client_id
  join public.chatwoot_conversations cc on cc.tenant_id = h.tenant_id and cc.conversation_id = h.chatwoot_conversation_id
  where h.tenant_id = :'tenant'::uuid and k.chatwoot_contact_id is not null and cc.chat_contact_id is null
union all
select '7. uniones de origen portal que ya existen (las que dejó chatwoot_portal_vincular desde la 0566)', count(*)
  from public.chatwoot_contact_links l
  where l.tenant_id = :'tenant'::uuid and l.origen = 'portal'
union all
select '8. fichas del portal todavía sin contacto de Chatwoot (informativo)', count(*)
  from public.chatwoot_portal_contactos k
  where k.tenant_id = :'tenant'::uuid and k.chatwoot_contact_id is null
order by 1;

rollback;
