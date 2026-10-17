#!/usr/bin/env bash
# infra/ops/tests/prueba-aplicar-migracion-efimera.sh — aplicar-migracion.sh contra una base efímera (SDD-0540, Fase 1).
#
# CORRIDA PESADA: levanta un `supabase/postgres:17.6.1.136` desechable
# (contenedor zz540e-staging-db-1, sin puertos ni red publicada, con fsync apagado)
# y lo borra al terminar. Pide turno al Director (una corrida pesada a la vez).
# Nada real: proyecto, repositorio y migraciones inventados.
#
#   bash infra/ops/tests/prueba-aplicar-migracion-efimera.sh
#
# Aceptación del §3 · Fase 1:
#   · aplica una migración y su fila del ledger en una transacción (md5 del ledger = blob);
#   · un error a la mitad no deja ni el objeto ni la fila;
#   · aplicar dos veces la misma: la lectura previa la frena (5) sin tocar nada.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMG="supabase/postgres:17.6.1.136"
P=zz540e-staging
DB="${P}-db-1"
T="$(mktemp -d)"
limpiar() { docker rm -f -v "${DB}" > /dev/null 2>&1; rm -rf "${T}"; }
trap limpiar EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
q() { docker exec -i "${DB}" psql -U postgres -d postgres -X -At -c "$1"; }
command -v docker >/dev/null || { echo "NO DISPONIBLE · docker"; exit 2; }

echo "== base efímera ${IMG}"
docker rm -f -v "${DB}" > /dev/null 2>&1
# MSYS_NO_PATHCONV: en Git Bash la ruta del config_file se convertiría a C:/… (README de infra/dtd-cargo).
MSYS_NO_PATHCONV=1 docker run -d --name "${DB}" --network none -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  "${IMG}" postgres -c config_file=/etc/postgresql/postgresql.conf -c fsync=off -c full_page_writes=off > /dev/null \
  || { echo "NO DISPONIBLE · no se pudo levantar ${IMG}"; exit 2; }
source "${S}/staging/lib-prueba.sh"
die() { echo "$*" >&2; exit 2; }; refuse() { die "$@"; }
prueba_esperar_base "${DB}" 240 && ok "base estable" || { ko "la base no arrancó"; exit 1; }
docker exec -i "${DB}" psql -U supabase_admin -d postgres -X < "${S}/staging/plataforma-prueba.sql" > "${T}/plataforma.out" 2>&1 \
  && ok "plataforma-prueba.sql (ledger con created_by)" || { ko "plataforma"; tail -5 "${T}/plataforma.out"; }

FX="${T}/repo"; mkdir -p "${FX}/supabase/migrations"
cat > "${FX}/supabase/migrations/0998_zz_ok.sql" <<'SQL'
-- migración de la prueba efímera: tabla, función y comentario
create table public.zz_ok (id int primary key);
create function public.zz_ok_n() returns int language sql stable as $$ select count(*)::int from public.zz_ok $$;
comment on table public.zz_ok is 'prueba efímera SDD-0540';
SQL
cat > "${FX}/supabase/migrations/0999_zz_falla.sql" <<'SQL'
-- crea una tabla y después falla: no tiene que quedar nada
create table public.zz_falla (id int);
select 1 / 0;
SQL
git -C "${FX}" init -q && git -C "${FX}" config core.autocrlf false
git -C "${FX}" add -A && git -C "${FX}" -c user.email=prueba@example.test -c user.name=prueba commit -qm fixture
SHA="$(git -C "${FX}" rev-parse HEAD)"
am() { bash "${S}/migrate/aplicar-migracion.sh" --project "${P}" --sha "${SHA}" "$@"; }
md5() { md5sum < "$1" | cut -c1-32; }

echo "== una migración buena: objeto y fila en una transacción"
am --file 0998_zz_ok.sql --sdd 0540 --repo "${FX}" --generar "${T}/g8" > "${T}/g8.log" 2>&1 || ko "generar 0998"
am --file 0998_zz_ok.sql --ejecutar "${T}/g8" --md5 "$(md5 "${T}/g8/aplicar.sql")" --evidence-dir "${T}/evid" > "${T}/e8.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && ok "0998 aplicada (0)" || { ko "0998 rc=${rc}"; cat "${T}/e8.log"; }
[[ "$(q "select to_regclass('public.zz_ok') is not null and to_regprocedure('public.zz_ok_n()') is not null")" == t ]] && ok "la tabla y la función existen" || ko "faltan objetos de 0998"
[[ "$(q "select md5(array_to_string(statements, '')) from supabase_migrations.schema_migrations where name = '0998_zz_ok'")" == "$(md5 "${T}/g8/migracion.sql")" ]] \
  && ok "fila del ledger con el md5 del blob" || ko "md5 del ledger"
[[ "$(q "select created_by ~ '^servidor-propio:psql:prueba:SDD-0540$' and version ~ '^[0-9]{14}$' from supabase_migrations.schema_migrations where name = '0998_zz_ok'")" == t ]] \
  && ok "created_by de prueba y versión YYYYMMDDHHMMSS" || ko "created_by o versión"
EVD="$(ls -d "${T}"/evid/apply-0998-* | head -n1)"
grep -qx BEGIN "${EVD}/aplicar.out" && [[ "$(tail -n1 "${EVD}/aplicar.out")" == COMMIT ]] && grep -qx 'INSERT 0 1' "${EVD}/aplicar.out" \
  && ok "salida del apply: BEGIN … INSERT 0 1 … COMMIT" || ko "salida del apply"

echo "== un error a la mitad: ni objeto ni fila"
am --file 0999_zz_falla.sql --sdd 0540 --repo "${FX}" --generar "${T}/g9" > /dev/null 2>&1 || ko "generar 0999"
am --file 0999_zz_falla.sql --ejecutar "${T}/g9" --md5 "$(md5 "${T}/g9/aplicar.sql")" --evidence-dir "${T}/evid" > "${T}/e9.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && ok "0999 falla en el apply (6)" || { ko "0999 rc=${rc}"; cat "${T}/e9.log"; }
[[ "$(q "select to_regclass('public.zz_falla') is null")" == t ]] && ok "la tabla creada antes del error NO quedó" || ko "quedó public.zz_falla"
[[ "$(q "select count(*) from supabase_migrations.schema_migrations where name = '0999_zz_falla'")" == 0 ]] && ok "y no quedó la fila del ledger" || ko "quedó la fila de 0999"

echo "== la misma dos veces"
am --file 0998_zz_ok.sql --ejecutar "${T}/g8" --md5 "$(md5 "${T}/g8/aplicar.sql")" --evidence-dir "${T}/evid2" > "${T}/e8b.log" 2>&1; rc=$?
[[ ${rc} -eq 5 && "$(q "select count(*) from supabase_migrations.schema_migrations where name = '0998_zz_ok'")" == 1 ]] \
  && ok "la lectura previa la frena (5) y sigue una sola fila" || { ko "doble apply rc=${rc}"; cat "${T}/e8b.log"; }

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
