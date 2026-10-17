#!/usr/bin/env bash
# infra/ops/tests/prueba-aplicar-migracion.sh — prueba de migrate/aplicar-migracion.sh con dobles (SDD-0540, Fase 1).
#
# Repositorio git inventado en una carpeta temporal y el doble de docker de
# dobles-prueba.sh: nada llega a una base real. Comprueba el contrato del método
# del Director: `\set ON_ERROR_STOP on`, `begin;`, el texto exacto, el insert del
# ledger con la versión calculada en el SQL y `commit;`; los rechazos (CR, barra
# invertida al inicio de línea, delimitador, begin/commit propios, producción,
# md5 que no coincide, primera línea alterada) y que la lectura previa y la
# verificación vayan en `begin transaction read only … rollback`.
#
#   bash infra/ops/tests/prueba-aplicar-migracion.sh
#
# La prueba contra una base efímera (aplica con su fila; un error a la mitad no
# deja ni objeto ni fila) es infra/ops/tests/prueba-aplicar-migracion-efimera.sh.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=dobles-prueba.sh
source "${S}/tests/dobles-prueba.sh"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
dobles_instalar "${T}/doble"
AM="${S}/migrate/aplicar-migracion.sh"
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
md5() { md5sum < "$1" | cut -c1-32; }
P=zz540-staging

FX="${T}/repo"; mkdir -p "${FX}/supabase/migrations"
cat > "${FX}/supabase/migrations/0991_zz_buena.sql" <<'SQL'
-- migración de prueba: crea una tabla y una función con un cuerpo $$
create table public.zz_buena (id int primary key, nota text default 'a\b');
create function public.zz_buena_n() returns int language sql as $$ select count(*)::int from public.zz_buena $$;
SQL
printf 'create table public.zz_sin_salto (id int);' > "${FX}/supabase/migrations/0992_zz_sin_salto.sql"
printf 'create table public.zz_cr (id int);\r\n' > "${FX}/supabase/migrations/0993_zz_cr.sql"
printf 'select 1;\n\\connect otra\n' > "${FX}/supabase/migrations/0994_zz_barra.sql"
printf 'select $mig0995$texto$mig0995$;\n' > "${FX}/supabase/migrations/0995_zz_delim.sql"
printf 'begin;\ncreate table public.zz_tx (id int);\ncommit;\n' > "${FX}/supabase/migrations/0996_zz_tx.sql"
printf 'do $$ begin perform 1; end $$;\n' > "${FX}/supabase/migrations/0997_zz_end_plpgsql.sql"
git -C "${FX}" init -q
git -C "${FX}" config core.autocrlf false
git -C "${FX}" add -A && git -C "${FX}" -c user.email=prueba@example.test -c user.name=prueba commit -qm fixture
SHA="$(git -C "${FX}" rev-parse HEAD)"
gen() { bash "${AM}" --project "${P}" --sha "${SHA}" --sdd 0540 --repo "${FX}" "$@"; }

echo "== guardas"
dobles_limpiar_log
gen --file 0991_zz_buena.sql --generar "${T}/g0" --project dtd-cargo > /dev/null 2>&1; rc=$?
# --project se repite: gana el último (dtd-cargo).
[[ ${rc} -eq 3 && ! -e "${T}/g0" ]] && ok "dtd-cargo (producción): rechaza (3) sin generar nada" || ko "dtd-cargo rc=${rc}"
bash "${AM}" --project zz540 --sha "${SHA}" --file 0991_zz_buena.sql --sdd 0540 --repo "${FX}" --generar "${T}/g0" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "proyecto sin -staging: rechaza (3)" || ko "sin -staging rc=${rc}"
gen --file ../../etc/passwd --generar "${T}/g0" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "--file que no es un nombre de migración: rechaza (2)" || ko "--file raro rc=${rc}"
bash "${AM}" --project "${P}" --sha abc --file 0991_zz_buena.sql --generar "${T}/g0" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "--sha corto: rechaza (2)" || ko "--sha corto rc=${rc}"
[[ "$(dobles_llamadas)" == 0 ]] && ok "las guardas no llaman a docker" || ko "las guardas llamaron a docker"

echo "== generar: el envoltorio"
gen --file 0991_zz_buena.sql --generar "${T}/g1" > "${T}/g1.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && ok "generar sale 0" || { ko "generar rc=${rc}"; cat "${T}/g1.log"; }
A="${T}/g1/aplicar.sql"; M="${T}/g1/migracion.sql"
cmp -s "${M}" "${FX}/supabase/migrations/0991_zz_buena.sql" && ok "migracion.sql es el blob exacto" || ko "migracion.sql distinto del blob"
[[ "$(sed -n 1p "${A}")" == '\set ON_ERROR_STOP on' && "$(sed -n 2p "${A}")" == 'begin;' && "$(tail -n1 "${A}")" == 'commit;' ]] \
  && ok "aplicar.sql: \\set ON_ERROR_STOP on · begin; … commit;" || ko "cabecera o cierre de aplicar.sql"
n_texto="$(wc -l < "${M}" | tr -d ' ')"
[[ "$(sed -n "3,$((2 + n_texto))p" "${A}")" == "$(cat "${M}")" ]] && ok "el texto exacto del archivo va después de begin;" || ko "texto ejecutado distinto"
grep -qF "insert into supabase_migrations.schema_migrations (version, statements, name, created_by)" "${A}" \
  && grep -qF "values (to_char(clock_timestamp() at time zone 'utc','YYYYMMDDHH24MISS'), array[\$mig0991\$-- migración de prueba" "${A}" \
  && grep -qF "\$mig0991\$], '0991_zz_buena', 'servidor-propio:psql:prueba:SDD-0540');" "${A}" \
  && ok "insert: versión con clock_timestamp en UTC, array[\$mig0991\$…\$mig0991\$], nombre y created_by" || ko "insert del ledger"
# El literal del array tiene que ser el archivo byte a byte: se recorta entre los delimitadores.
awk 'BEGIN { RS = "\\$mig0991\\$" } NR == 2 { printf "%s", $0 }' "${A}" > "${T}/literal.sql"
[[ "$(md5 "${T}/literal.sql")" == "$(md5 "${M}")" ]] && ok "statements = el archivo exacto (md5 $(md5 "${M}"))" || ko "statements no es el archivo exacto"
for s in previa verificar; do
  [[ "$(sed -n 1p "${T}/g1/${s}.sql")" == '\set ON_ERROR_STOP on' && "$(sed -n 2p "${T}/g1/${s}.sql")" == 'begin transaction read only;' \
     && "$(tail -n1 "${T}/g1/${s}.sql")" == 'rollback;' ]] && ok "${s}.sql en begin transaction read only … rollback" || ko "${s}.sql sin read only/rollback"
done
grep -qF "if m <> '$(md5 "${M}")' or b <> $(wc -c < "${M}" | tr -d ' ') then" "${T}/g1/verificar.sql" && ok "verificar compara md5 y bytes del ledger con el blob" || ko "verificar sin md5/bytes"
grep -q "^aplicar_md5=$(md5 "${A}")$" "${T}/g1/IDENTIDAD.txt" && grep -q "md5 de aplicar.sql: $(md5 "${A}")" "${T}/g1.log" \
  && ok "IDENTIDAD.txt y la salida dan el md5 de aplicar.sql" || ko "md5 de aplicar.sql"
( cd "${T}/g1" && sha256sum -c --quiet SHA256SUMS ) && ok "SHA256SUMS del paquete" || ko "SHA256SUMS"
gen --file 0992_zz_sin_salto.sql --generar "${T}/g2" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && grep -q '^create table public.zz_sin_salto (id int);$' "${T}/g2/aplicar.sql" \
  && [[ "$(grep -c '^insert into supabase_migrations' "${T}/g2/aplicar.sql")" == 1 ]] && ok "archivo sin salto final: el insert queda en su propia línea" || ko "sin salto final rc=${rc}"
gen --file 0997_zz_end_plpgsql.sql --generar "${T}/g7" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && ok "el end; de un bloque plpgsql no cuenta como commit propio" || ko "end; plpgsql rc=${rc}"

echo "== generar: rechazos del archivo"
for caso in "0993_zz_cr.sql:CR" "0994_zz_barra.sql:barra invertida" "0995_zz_delim.sql:delimitador" "0996_zz_tx.sql:begin, commit o rollback"; do
  f="${caso%%:*}"; motivo="${caso#*:}"
  gen --file "${f}" --generar "${T}/r-${f}" > "${T}/r.log" 2>&1; rc=$?
  [[ ${rc} -eq 3 && ! -e "${T}/r-${f}" ]] && grep -q "${motivo}" "${T}/r.log" && ok "${f}: rechaza (3) por ${motivo}" || { ko "${f} rc=${rc}"; cat "${T}/r.log"; }
done
gen --file 0999_no_existe.sql --generar "${T}/r-ne" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "archivo que no existe en el SHA: rechaza (3)" || ko "no existe rc=${rc}"

echo "== ejecutar"
cp -r "${T}/g1" "${T}/vps"
MD5A="$(md5 "${T}/vps/aplicar.sql")"
ej() { bash "${AM}" --project "${P}" --sha "${SHA}" --file 0991_zz_buena.sql --ejecutar "$1" --evidence-dir "${T}/evid" "${@:2}"; }
dobles_limpiar_log
ej "${T}/vps" --md5 0123456789abcdef0123456789abcdef > "${T}/e1.log" 2>&1; rc=$?
[[ ${rc} -eq 4 && "$(dobles_llamadas)" == 0 ]] && grep -q 'el md5 de aplicar.sql en destino es' "${T}/e1.log" && ok "md5 que no coincide: integridad (4), sin tocar la base" || ko "md5 malo rc=${rc}"
ej "${T}/vps" --md5 "${MD5A}" --dry-run > "${T}/e2.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(dobles_llamadas)" == 0 ]] && ok "--dry-run: comprueba todo y no toca la base" || ko "dry-run rc=${rc}"
cp -r "${T}/g1" "${T}/vps-sin-set"
sed -i '1d' "${T}/vps-sin-set/aplicar.sql"
( cd "${T}/vps-sin-set" && sha256sum migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt > SHA256SUMS )
ej "${T}/vps-sin-set" --md5 "$(md5 "${T}/vps-sin-set/aplicar.sql")" > "${T}/e3.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(dobles_llamadas)" == 0 ]] && grep -q 'la primera línea útil no es' "${T}/e3.log" && ok "sin \\set ON_ERROR_STOP on en la primera línea útil: rechaza (3)" || { ko "sin \\set rc=${rc}"; cat "${T}/e3.log"; }
cp -r "${T}/g1" "${T}/vps-otro"
printf 'drop table public.clientes;\n' >> "${T}/vps-otro/aplicar.sql"
( cd "${T}/vps-otro" && sha256sum migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt > SHA256SUMS )
ej "${T}/vps-otro" --md5 "$(md5 "${T}/vps-otro/aplicar.sql")" > "${T}/e4.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(dobles_llamadas)" == 0 ]] && grep -q 'no es el envoltorio de migracion.sql' "${T}/e4.log" && ok "aplicar.sql que no es el envoltorio del blob: rechaza (3)" || ko "envoltorio alterado rc=${rc}"
cp -r "${T}/g1" "${T}/vps-roto"; printf ' ' >> "${T}/vps-roto/previa.sql"
ej "${T}/vps-roto" --md5 "${MD5A}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 4 ]] && ok "SHA256SUMS que no coincide: integridad (4)" || ko "SHA256SUMS roto rc=${rc}"
bash "${AM}" --project "${P}" --sha "${SHA}" --file 0992_zz_sin_salto.sql --ejecutar "${T}/vps" --md5 "${MD5A}" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "IDENTIDAD de otro archivo: rechaza (3)" || ko "IDENTIDAD cruzada rc=${rc}"
ej "${T}/vps" --md5 "${MD5A}" > "${T}/e5.log" 2>&1; rc=$?
EVD="$(ls -d "${T}"/evid/apply-0991-"${P}"-* 2>/dev/null | head -n1)"
[[ ${rc} -eq 0 && -n "${EVD}" ]] && grep -q 'PASÓ apply: COMMIT con la fila del ledger' "${T}/e5.log" && grep -q 'PASÓ verificación' "${T}/e5.log" \
  && ok "ejecutar: previa, apply y verificación PASÓ" || { ko "ejecutar rc=${rc}"; cat "${T}/e5.log"; }
[[ -n "${EVD}" ]] && ( cd "${EVD}" && sha256sum -c --quiet SHA256SUMS ) && [[ -f "${EVD}/aplicar.out" && -f "${EVD}/previa.out" && -f "${EVD}/verificar.out" ]] \
  && ok "evidencia apply-0991-${P}-<ts>/ con salidas y SHA256SUMS" || ko "evidencia incompleta"
orden="$(for f in "${DOBLE_DIR}"/stdin-*.sql; do head -n2 "${f}" | tail -n1; done | tr '\n' '|')"
[[ "${orden}" == "begin transaction read only;|begin;|begin transaction read only;|" ]] && ok "orden en la base: lectura previa, apply, verificación" || ko "orden ${orden}"
grep -q "docker exec -i ${P}-db-1 psql -U postgres -d postgres -X\|exec -i ${P}-db-1 psql -U postgres -d postgres -X" "${DOBLE_DIR}/docker.log" && ok "psql como postgres en ${P}-db-1, sin psqlrc (-X)" || ko "comando de psql"
dobles_limpiar_log
DOBLE_FALLA="create function public.zz_buena_n" ej "${T}/vps" --md5 "${MD5A}" > "${T}/e6.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && grep -q 'FALLÓ el apply' "${T}/e6.log" && [[ "$(grep -c 'begin transaction read only' "${DOBLE_DIR}"/stdin-*.sql | grep -c ':1')" == 1 ]] \
  && ok "apply que falla: sale 6 y no corre la verificación" || { ko "apply que falla rc=${rc}"; cat "${T}/e6.log"; }
dobles_limpiar_log
DOBLE_FALLA="ya está en el ledger" ej "${T}/vps" --md5 "${MD5A}" > "${T}/e7.log" 2>&1; rc=$?
[[ ${rc} -eq 5 ]] && [[ "$(ls "${DOBLE_DIR}"/stdin-*.sql | wc -l | tr -d ' ')" == 1 ]] && ok "lectura previa que falla: sale 5 y no aplica" || ko "previa que falla rc=${rc}"

echo "== evidencia: SHA256SUMS no depende del formato de sha256sum (SDD-0550)"
# El sha256sum de Git para Windows escribe «hash *archivo» (modo binario). La
# disposición infeliz: SHA256SUMS ya existe en la evidencia al cerrar, como
# cuando el glob le gana a la redirección. Con el filtro « SHA256SUMS$» de antes,
# la línea de SHA256SUMS se colaba y `sha256sum -c` fallaba.
BIN="${T}/binario"; mkdir -p "${BIN}"
REAL_SHA="$(command -v sha256sum)"
cat > "${BIN}/sha256sum" <<EOF
#!/usr/bin/env bash
# Doble: modo binario, como el de Git para Windows. Al comprobar (-c) no aplica.
for a in "\$@"; do case "\$a" in -c|--check) exec "${REAL_SHA}" "\$@" ;; esac; done
exec "${REAL_SHA}" -b "\$@"
EOF
cat > "${BIN}/docker" <<EOF
#!/usr/bin/env bash
# Antes de cada llamada deja un SHA256SUMS vacío en la evidencia en curso.
for d in "${T}"/evid-bin/apply-*/; do [[ -d "\$d" ]] && : > "\${d}SHA256SUMS"; done
exec "${DOBLE_DIR}/bin/docker" "\$@"
EOF
chmod +x "${BIN}/sha256sum" "${BIN}/docker"
dobles_limpiar_log
PATH="${BIN}:${PATH}" bash "${AM}" --project "${P}" --sha "${SHA}" --file 0991_zz_buena.sql --ejecutar "${T}/vps" --md5 "${MD5A}" \
  --evidence-dir "${T}/evid-bin" > "${T}/e8.log" 2>&1; rc=$?
EVB="$(ls -d "${T}"/evid-bin/apply-0991-"${P}"-* 2>/dev/null | head -n1)"
[[ ${rc} -eq 0 && -n "${EVB}" ]] && grep -q '^[0-9a-f]\{64\} \*aplicar\.out$' "${EVB}/SHA256SUMS" \
  && ! grep -qE ' [ *]SHA256SUMS$' "${EVB}/SHA256SUMS" && ( cd "${EVB}" && sha256sum -c --quiet SHA256SUMS ) \
  && ok "en modo binario («hash *archivo») SHA256SUMS no se lista a sí mismo y verifica" \
  || { ko "evidencia en modo binario rc=${rc}"; cat "${T}/e8.log" "${EVB}/SHA256SUMS" 2>/dev/null; }

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
