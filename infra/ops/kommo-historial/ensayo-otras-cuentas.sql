-- infra/ops/kommo-historial/ensayo-otras-cuentas.sql — SDD-0590 5.6. Borra de la COPIA del ensayo todo lo que no
-- es de la cuenta :cuenta. Lo corre ensayo-archivo.sh, solo con `docker exec -i chatwoot-ensayo-postgres-1 psql`.
--
--   psql -At -v ON_ERROR_STOP=1 -v cuenta=<id> -v marca=<valor> < ensayo-otras-cuentas.sql
--
-- Guarda (Director General, 2026-11-06): todo va en UNA transacción que empieza por verificar la marca de la
-- copia. ensayo-archivo.sh crea `public._dtd_ensayo_marca` con un valor aleatorio al restaurar; producción nunca
-- tiene esa tabla. Sin la tabla, o con otro valor, RAISE: la transacción se deshace y no se lee ni se borra nada.
\set ON_ERROR_STOP on
SELECT set_config('ensayo.cuenta', :'cuenta', false) IS NOT NULL AS cuenta,
       set_config('ensayo.marca', :'marca', false) IS NOT NULL AS marca;
BEGIN;
DO $$
DECLARE v text;
BEGIN
  IF to_regclass('public._dtd_ensayo_marca') IS NULL THEN
    RAISE EXCEPTION 'sin la marca del ensayo: no se borra nada';
  END IF;
  EXECUTE 'SELECT valor FROM public._dtd_ensayo_marca LIMIT 1' INTO v;
  IF v IS DISTINCT FROM current_setting('ensayo.marca') THEN
    RAISE EXCEPTION 'la marca del ensayo no coincide: no se borra nada';
  END IF;
END $$;
SELECT 'HECHO marca=ok';

-- account_id se compara como texto: así no importa el tipo de la columna en cada tabla. Los NULL no se tocan.
CREATE FUNCTION pg_temp.filas_de_otras_cuentas() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE t record; n bigint; total bigint := 0; c text := current_setting('ensayo.cuenta');
BEGIN
  FOR t IN SELECT k.table_name FROM information_schema.columns k
           JOIN information_schema.tables tb ON tb.table_schema = k.table_schema AND tb.table_name = k.table_name
           WHERE k.table_schema = 'public' AND k.column_name = 'account_id' AND tb.table_type = 'BASE TABLE' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE account_id::text <> %L', t.table_name, c) INTO n;
    total := total + n;
  END LOOP;
  RETURN total;
END $$;
SELECT 'HECHO otras_cuentas_antes=' || count(*) FROM accounts WHERE id::text <> current_setting('ensayo.cuenta');
SELECT 'HECHO otras_cuentas_filas_antes=' || pg_temp.filas_de_otras_cuentas();

SET LOCAL session_replication_role = replica;
DO $$
DECLARE t record; c text := current_setting('ensayo.cuenta');
BEGIN
  FOR t IN SELECT k.table_name FROM information_schema.columns k
           JOIN information_schema.tables tb ON tb.table_schema = k.table_schema AND tb.table_name = k.table_name
           WHERE k.table_schema = 'public' AND k.column_name = 'account_id' AND tb.table_type = 'BASE TABLE' LOOP
    EXECUTE format('DELETE FROM public.%I WHERE account_id::text <> %L', t.table_name, c);
  END LOOP;
  DELETE FROM public.accounts WHERE id::text <> c;
  DELETE FROM public.contact_inboxes ci WHERE NOT EXISTS (SELECT 1 FROM public.inboxes i WHERE i.id = ci.inbox_id)
                                         OR NOT EXISTS (SELECT 1 FROM public.contacts k WHERE k.id = ci.contact_id);
  DELETE FROM public.inbox_members m WHERE NOT EXISTS (SELECT 1 FROM public.inboxes i WHERE i.id = m.inbox_id);
  DELETE FROM public.users u WHERE NOT EXISTS (SELECT 1 FROM public.account_users au WHERE au.user_id = u.id);
END $$;
SET LOCAL session_replication_role = origin;

SELECT 'HECHO otras_cuentas=' || count(*) FROM accounts WHERE id::text <> current_setting('ensayo.cuenta');
SELECT 'HECHO cuenta_del_ensayo=' || count(*) FROM accounts WHERE id::text = current_setting('ensayo.cuenta');
SELECT 'HECHO otras_cuentas_filas=' || pg_temp.filas_de_otras_cuentas();
SELECT 'HECHO contact_inboxes_huerfanos=' || count(*) FROM contact_inboxes ci
  WHERE NOT EXISTS (SELECT 1 FROM inboxes i WHERE i.id = ci.inbox_id) OR NOT EXISTS (SELECT 1 FROM contacts k WHERE k.id = ci.contact_id);
SELECT 'HECHO miembros_huerfanos=' || count(*) FROM inbox_members m WHERE NOT EXISTS (SELECT 1 FROM inboxes i WHERE i.id = m.inbox_id);
SELECT 'HECHO usuarios_sin_cuenta=' || count(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM account_users au WHERE au.user_id = u.id);
COMMIT;
