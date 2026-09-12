\set ON_ERROR_STOP on
-- Misma matriz sintética: 0410 crea el facade, 0415 restringe tras el deploy.
-- El archivo incluido abre la transacción y termina en rollback total.

-- Importación L10: 0415 toma ACCESS EXCLUSIVE sobre mail_logs, así que fija
-- lock_timeout y statement_timeout antes de su primer lock o DDL (lectura
-- estática del archivo, sin comentarios). El archivo incluido comprueba además
-- que los deja vigentes en su transacción.
do $lock_timeout_0415_static$
declare
  v_code text := pg_catalog.regexp_replace(
    pg_catalog.pg_read_file('/sb/migrations/0415_mail_logs_read_rbac.sql'),
    '--[^\n]*', '', 'g'
  );
  v_lock integer := pg_catalog.strpos(v_code, 'set local lock_timeout = ''5s'';');
  v_statement integer := pg_catalog.strpos(v_code, 'set local statement_timeout = ''60s'';');
  v_first integer := pg_catalog.regexp_instr(
    v_code,
    '^[[:space:]]*(do|create|alter|drop|grant|revoke|comment|lock|select|insert|update|delete|truncate)\M',
    1, 1, 0, 'in', 1
  );
begin
  if v_lock = 0 or v_statement = 0 or v_first = 0
     or v_lock > v_first or v_statement > v_first then
    raise exception 'TEST 0415: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=%, statement_timeout=%, primera sentencia=%)',
      v_lock, v_statement, v_first;
  end if;
end;
$lock_timeout_0415_static$;

\set apply_mail_logs_close true
\ir 0410_collections_mail_context.test.sql
\unset apply_mail_logs_close
