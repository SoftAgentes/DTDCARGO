#!/usr/bin/env bash
# infra/ops/tests/prueba-resetear-base-efimera.sh — reset de la base de prueba contra una base efímera (SDD-0540, Fase 1).
#
# CORRIDA PESADA: arma el paquete con las migraciones del HEAD de este checkout,
# levanta un `supabase/postgres:17.6.1.136` desechable (zz540r-staging-db-1, sin
# red) y corre resetear-base-prueba.sh --solo-base con la semilla. Tarda unos
# minutos (una transacción por migración). Pide turno al Director.
#
#   bash infra/ops/tests/prueba-resetear-base-efimera.sh
#
# Aceptación del §3 · Fase 1:
#   · aplica todas las migraciones y deja el ledger con una fila por archivo
#     (menos las esperas de pendingBelowCutoff, que producción no tiene);
#   · la semilla es idempotente: dos corridas, mismos conteos;
#   · cubre admin, operario VE, operario CN, cliente del Portal y proveedor CN.
# El HEAD tiene que incluir los archivos de la Fase 1 (si no, --preparar se niega).
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
IMG="supabase/postgres:17.6.1.136"
P=zz540r-staging
DB="${P}-db-1"
T="$(mktemp -d)"
limpiar() { docker rm -f -v "${DB}" > /dev/null 2>&1; rm -rf "${T}"; }
trap limpiar EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
q() { docker exec -i "${DB}" psql -U postgres -d postgres -X -At -c "$1"; }
command -v docker >/dev/null || { echo "NO DISPONIBLE · docker"; exit 2; }
SHA="$(git -C "${R}" rev-parse HEAD)"

echo "== paquete de ${SHA:0:12}"
bash "${S}/staging/resetear-base-prueba.sh" --preparar "${T}/paquete" --to-sha "${SHA}" --repo "${R}" > "${T}/prep.log" 2>&1 \
  && ok "$(head -n1 "${T}/prep.log")" || { ko "--preparar"; cat "${T}/prep.log"; exit 1; }

echo "== base efímera ${IMG}"
docker rm -f -v "${DB}" > /dev/null 2>&1
MSYS_NO_PATHCONV=1 docker run -d --name "${DB}" --network none -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  "${IMG}" postgres -c config_file=/etc/postgresql/postgresql.conf -c fsync=off -c full_page_writes=off > /dev/null \
  || { echo "NO DISPONIBLE · no se pudo levantar ${IMG}"; exit 2; }

PD="${T}/${P}"; mkdir -p "${PD}"
t0="$(date +%s)"
bash "${S}/staging/resetear-base-prueba.sh" --project "${P}" --confirm "${P}" --to-sha "${SHA}" --bundle "${T}/paquete" \
  --project-dir "${PD}" --evidence-dir "${T}/evid" --solo-base --db-container "${DB}" > "${T}/reset.log" 2>&1; rc=$?
echo "   reset en $(( $(date +%s) - t0 )) s"
[[ ${rc} -eq 0 ]] && ok "reset completo (0)" || { ko "reset rc=${rc}"; tail -15 "${T}/reset.log"; }

esperadas="$(cd "${T}/paquete/migraciones" && ls -1 *.sql | sed 's/\.sql$//' | grep -vxF -f "${T}/paquete/PENDIENTES.txt" | LC_ALL=C sort)"
en_ledger="$(q "select name from supabase_migrations.schema_migrations" | LC_ALL=C sort)"
[[ -n "${esperadas}" && "${esperadas}" == "${en_ledger}" ]] && ok "una fila del ledger por archivo ($(wc -l <<< "${esperadas}" | tr -d ' ')), sin las de pendingBelowCutoff" \
  || { ko "ledger distinto de los archivos"; diff <(echo "${esperadas}") <(echo "${en_ledger}") | head -10; }
[[ "$(q "select count(*) from supabase_migrations.schema_migrations group by version having count(*) > 1" | wc -l | tr -d ' ')" == 0 ]] && ok "versiones únicas" || ko "versiones repetidas"
[[ "$(q "select count(*) from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and (d.defaclacl::text ~ 'anon=' or d.defaclacl::text ~ 'authenticated=')")" == 0 ]] \
  && ok "default privileges de postgres en public sin anon ni authenticated (como producción)" || ko "default privileges abiertos"

echo "== semilla: roles e idempotencia"
c1="$(grep -h 'semilla_conteo' "${T}"/evid/reset-*/semilla.out | tr -d ' ')"
[[ "${c1}" == "semilla_conteo|2|1|1|1|2|1|1" ]] && ok "admin, cliente del Portal, 2 operarios (VE y CN), proveedor CN y prealerta: ${c1}" || ko "conteos de la semilla: ${c1:-sin línea}"
[[ "$(q "select string_agg(region::text || ':' || role, ',' order by region) from public.operario_pins where id::text like '05400000-%'")" == "cn:operario,ve:bodeguero" ]] \
  && ok "operario CN y operario VE con PIN" || ko "operarios"
[[ "$(q "select count(*) from public.operario_pins where id::text like '05400000-%' and pin_cifrado is not null and pin_hash like '\$2%'")" == 2 ]] \
  && ok "PIN con bcrypt y cifrado con operario_pin_key" || ko "PIN sin hash o sin cifrar"
bash "${S}/staging/sembrar-prueba.sh" --project "${P}" --project-dir "${PD}" --db-container "${DB}" --semilla "${T}/paquete/semilla-prueba.sql" \
  --salida "${T}/semilla2.out" > "${T}/sembrar2.log" 2>&1; rc=$?
c2="$(grep -h 'semilla_conteo' "${T}/semilla2.out" | tr -d ' ')"
[[ ${rc} -eq 0 && "${c2}" == "${c1}" ]] && ok "segunda corrida de la semilla: mismos conteos" || { ko "semilla 2 rc=${rc} (${c2})"; tail -5 "${T}/semilla2.out"; }
[[ "$(q "select count(*) from public.clients where email is not null and email !~* '@([a-z0-9-]+[.])*(test|invalid)\$'")" == 0 ]] \
  && ok "ningún cliente con correo fuera de .test/.invalid (también los demo de la 0006)" || ko "clientes con correos reales"
[[ "$(q "select count(*) from public.clients where phone is not null and phone !~ '^[+]120255501[0-9]{2}\$'")" == 0 ]] \
  && ok "ningún cliente con teléfono fuera de +1 202 555 0100-0199" || ko "clientes con teléfonos fuera del rango"
[[ "$(q "select count(*) from vault.secrets where name in ('kommo_cron_key','kommo_token_dtd_v1','functions_base_url')")" == 0 ]] \
  && ok "Vault sin claves de Kommo ni functions_base_url" || ko "Vault con claves de Kommo"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
