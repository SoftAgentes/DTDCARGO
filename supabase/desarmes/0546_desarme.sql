-- SDD-0611 §11.4.1 · Desarme de la 0546: quita la purga de actor_id y vuelve las restricciones de la 0518.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/news/autopublicar/__tests__/noticias-0546.migration.test.ts («desarme», solo en PGlite;
--   el contrato .test.sql no lo incluye porque el control C4 del CI no copia esta carpeta).
--
-- QUITA la función news_purgar_actor_id, el disparador de marca de purga (y su función), las dos columnas de marca (actor_purged_at, changed_by_purged_at)
--   y los cuatro CHECK de la 0546; restaura news_audit_manual_con_persona de la 0518 y el NOT NULL de
--   news_autopublish_settings_log.changed_by.
-- NO TOCA ninguna fila, policy ni grant, ni otra tabla o función.
--
-- LO YA VACIADO NO VUELVE. Si la purga ya vació algún uuid, restaurar las restricciones de la 0518 es
--   imposible (changed_by NOT NULL y «manual con persona» fallarían): el desarme PARA con un mensaje.
--   Quitar la función antes de la primera purga real no pierde nada.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.news_publication_audit') is null
     or pg_catalog.to_regclass('public.news_autopublish_settings_log') is null then
    raise exception 'desarme 0546: faltan las tablas de la 0518';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'news_publication_audit'
                and column_name = 'actor_purged_at') then
    -- Anidado: la columna solo se nombra si existe (el desarme repetido no falla por eso).
    if exists (select 1 from public.news_publication_audit where actor_purged_at is not null)
       or exists (select 1 from public.news_autopublish_settings_log where changed_by is null) then
      raise exception 'desarme 0546: la purga ya vació uuid; no se pueden restaurar las restricciones de la 0518 (lo vaciado no vuelve)';
    end if;
  end if;
end
$preflight$;

drop function if exists public.news_purgar_actor_id();
drop trigger if exists news_audit_marca_purga_ins on public.news_publication_audit;
drop trigger if exists news_autopublish_log_marca_purga_ins on public.news_autopublish_settings_log;
drop function if exists public.news_purga_marca_solo_por_purga();

alter table public.news_publication_audit drop constraint if exists news_audit_purga_sin_uuid;
alter table public.news_publication_audit drop constraint if exists news_audit_manual_con_persona;
alter table public.news_publication_audit
  add constraint news_audit_manual_con_persona check (via = 'automatica' or actor_id is not null);
alter table public.news_publication_audit drop column if exists actor_purged_at;

alter table public.news_autopublish_settings_log drop constraint if exists news_autopublish_log_purga_sin_uuid;
alter table public.news_autopublish_settings_log drop constraint if exists news_autopublish_log_con_persona;
alter table public.news_autopublish_settings_log drop column if exists changed_by_purged_at;
alter table public.news_autopublish_settings_log alter column changed_by set not null;

notify pgrst, 'reload schema';
