\set ON_ERROR_STOP on
-- SDD-0366: ejecuta el contrato COMPLETO con la variante0195 exacta observada
-- read-only en Cloud; no establece ninguna conexión con servicios alojados.
-- El fixture exige PostgreSQL desechable vacío, usa datos sintéticos y ROLLBACK.
\set cloud_validator_baseline true
\ir 0423_payment_report_historical_identity.test.sql
-- No contaminar un test posterior si un caller reusa la misma sesión psql.
\unset cloud_validator_baseline
