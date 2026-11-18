-- SDD-0650 F2 · Desarme de la 0554: quita la lista de uniones chat ↔ ficha.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0554_chatwoot_contact_links.test.sql y
--   lib/studio/__tests__/chatwoot-contact-links.migration.test.ts.
--
-- QUITA el disparador de clients, las cinco funciones y la tabla (se pierden las uniones; las fichas,
-- las conversaciones y la auditoría quedan). El tipo de auditoría chatwoot_contact_link queda como
-- 'deprecated': entity_audit_log es de solo agregar y sus filas lo referencian.
-- Sin la 0554 el código vuelve solo a la tarjeta de la F1 (lo detecta por PGRST205/42P01/PGRST202).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists chatwoot_contact_links_al_borrar_ficha on public.clients;
drop function if exists public.chatwoot_contact_links_al_borrar_ficha();
drop function if exists public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text);
drop function if exists public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text);
drop function if exists public.chatwoot_contact_links_actor_puede(uuid, uuid);
drop function if exists public.chatwoot_unir_contactos(uuid, text, jsonb);
drop table if exists public.chatwoot_contact_links;

update public.audit_entity_types set status = 'deprecated' where entity_type = 'chatwoot_contact_link';

do $post$
begin
  if to_regclass('public.chatwoot_contact_links') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_unir_contactos(uuid,text,jsonb)') is not null then
    raise exception 'desarme 0554: quedó la tabla o la función';
  end if;
end;
$post$;
