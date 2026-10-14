-- ─────────────────────────────────────────────────────────────────────────────
-- 0474 · SDD-0508 — los adjuntos de Bitácora creados antes del fix dicen su bucket.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo. Producción es el Supabase self-hosted del
--    servidor propio (docs/runbooks/servidor-contabo.md). ORDEN: DESPUÉS de
--    desplegar la PR de la SDD-0508 (registerTaskAttachmentAction con
--    bucket_id). Antes de ese deploy, cada subida nueva vuelve a nacer con el
--    bucket equivocado y esta migración no la vería.
--
-- ── El defecto ──────────────────────────────────────────────
-- registerTaskAttachmentAction subía el binario al bucket `bitacora` e insertaba
-- la fila de documents sin bucket_id: la columna tomaba el default
-- 'documents' de 0307. La 0473 (aplicada en el servidor el 2026-10-14 a las
-- 01:44:06Z) habilitó esas subidas antes del fix de la app. Conteo READ ONLY
-- del 2026-10-14 02:26:44Z, solo agregados: 1 fila bitacora_task, viva, con
-- bucket_id 'documents', cuyo objeto existe en `bitacora` y no en `documents`.
-- Con el fix desplegado, la app firma y borra en el bucket de la fila: esa
-- fila no se vería en la galería y su borrado dejaría el objeto huérfano.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- bucket_id pasa de 'documents' a 'bitacora' SOLO en las filas bitacora_task
-- cuyo objeto existe en storage.objects del bucket `bitacora` y NO existe en el
-- de `documents`. Es la prueba de dónde está el objeto: el tipo de entidad no
-- basta, porque el hub también guarda bitacora_task en `documents` (con el mismo
-- formato de path). Incluye filas con deleted_at: también deben decir la verdad.
-- Una fila cuyo objeto no está en ningún bucket, o está en los dos, no se toca.
-- No cambia storage_path ni object_key. El trigger documents_touch actualiza
-- updated_at de las filas corregidas; documents_validate_entity_trg vuelve a
-- validar la entidad (por eso el preflight exige la rama de la 0473), y el
-- guardia RBAC de 0435/0438 sólo actúa con auth.role() = 'authenticated'.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si falta public.documents con las columnas de 0307,
-- si falta storage.objects, o si document_entity_in_tenant() no tiene la rama
-- 'bitacora_task' (0473): el UPDATE la necesita para pasar la validación de
-- entidad. El postflight exige que no quede ninguna fila que cumpla el filtro.
-- Re-aplicable: la segunda corrida no encuentra filas. LOCKS: ROW EXCLUSIVE
-- sobre documents y bloqueo de las filas corregidas; ningún DDL. ROLLBACK: no
-- aplica (devolverlas a 'documents' restaura la mentira); el NOTICE informa
-- cuántas filas cambió.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.documents') is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception '0474: falta public.documents o storage.objects';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_attribute
    where attrelid = 'public.documents'::regclass
      and not attisdropped
      and attname in ('entity_type', 'storage_path', 'bucket_id', 'deleted_at')
  ) <> 4 then
    raise exception '0474: public.documents no tiene las columnas de 0097/0307';
  end if;

  if pg_catalog.to_regprocedure(
       'public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)'
     ) is null
     or (
       select p.prosrc
       from pg_catalog.pg_proc p
       where p.oid = 'public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)'::regprocedure
     ) not like '%when ''bitacora_task'' then%' then
    raise exception '0474: document_entity_in_tenant sin la rama bitacora_task (falta la 0473)';
  end if;
end;
$preflight$;

do $backfill$
declare
  v_corregidas integer;
begin
  update public.documents d
     set bucket_id = 'bitacora'
   where d.entity_type::text = 'bitacora_task'
     and d.bucket_id = 'documents'
     and exists (
       select 1 from storage.objects o
       where o.bucket_id = 'bitacora' and o.name = d.storage_path
     )
     and not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'documents' and o.name = d.storage_path
     );
  get diagnostics v_corregidas = row_count;
  raise notice '0474: % fila(s) bitacora_task pasaron a bucket_id = bitacora', v_corregidas;
end;
$backfill$;

do $postflight$
begin
  if exists (
    select 1
    from public.documents d
    where d.entity_type::text = 'bitacora_task'
      and d.bucket_id = 'documents'
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'bitacora' and o.name = d.storage_path
      )
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'documents' and o.name = d.storage_path
      )
  ) then
    raise exception '0474: quedaron adjuntos de Bitácora con bucket_id documents';
  end if;
end;
$postflight$;
