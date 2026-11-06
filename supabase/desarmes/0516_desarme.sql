-- SDD-0608 · Desarme de la 0516: quita el registro de consultas y la búsqueda de /cliente.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/studio/discord/consulta/__tests__/consulta-clientes.migration.test.ts («desarme»).
--
-- QUITA public.discord_buscar_clientes, public.discord_consulta_registrar y la tabla
--   public.discord_consultas_clientes con sus índices.
-- NO TOCA clients, user_profiles ni ninguna otra tabla, función, policy o grant.
--
-- PIERDE el registro de consultas (quién consultó qué y cuándo) que hubiera hasta ese momento. Si hace
--   falta conservarlo, exportarlo antes con OK de Sam: lleva términos que pueden ser nombres.
-- Efecto en la web: /cliente contesta «no disponible» y no busca (el código degrada así: ver la
--   declaración sdd-0608-discord-consulta-clientes). No rompe ninguna otra pantalla.
set local lock_timeout = '5s'; -- local: valen hasta el COMMIT, también para la fila del ledger
set local statement_timeout = '30s';

do $preflight$
begin
  -- Sólo desarma lo que puso la 0516: si la tabla existe con otra forma, parar.
  if pg_catalog.to_regclass('public.discord_consultas_clientes') is not null
     and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'discord_consultas_clientes'
          and column_name = 'resultado'
     ) then
    raise exception 'desarme 0516: public.discord_consultas_clientes existe con otra forma';
  end if;
end
$preflight$;

drop function if exists public.discord_buscar_clientes(uuid, text, integer);
drop function if exists public.discord_consulta_registrar(text, uuid, uuid, text, text, integer);
drop table if exists public.discord_consultas_clientes;
