\set ON_ERROR_STOP on
-- Misma matriz sintética: 0410 crea el facade, 0415 restringe tras el deploy.
-- El archivo incluido abre la transacción y termina en rollback total.
\set apply_mail_logs_close true
\ir 0410_collections_mail_context.test.sql
\unset apply_mail_logs_close
