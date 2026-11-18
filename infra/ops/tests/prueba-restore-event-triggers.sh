#!/usr/bin/env bash
# infra/ops/tests/prueba-restore-event-triggers.sh — restore.sh y restore-test.sh con
# los event triggers que pg_restore no puede crear (SDD-0594). Con dobles: sin base,
# sin Docker, sin secretos. Corre en cualquier bash:
#   bash infra/ops/tests/prueba-restore-event-triggers.sh
#
# Control rojo: esta prueba sobre el infra/ops de antes del arreglo da FALLÓ. Y el
# primer bloque comprueba que el doble reproduce lo medido el 29-oct: sin esto, un
# doble complaciente daría verde sin probar nada.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
# shellcheck source=dobles-restore.sh
. "${S}/tests/dobles-restore.sh"
dobles_restore_instalar "${T}/d"
mkdir -p "${T}/shm"

paso=0; fallo=0
ok() { paso=$((paso + 1)); printf 'PASÓ  · %s\n' "$1"; }
ko() { fallo=$((fallo + 1)); printf 'FALLÓ · %s\n' "$1"; }
si() { if eval "$2"; then ok "$1"; else ko "$1"; fi; } # $1 nombre, $2 condición
igual() { if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1 · esperado '$2' · llegó '$3'"; fi; }

ESPERADO='ensure_rls|postgres|public.rls_auto_enable|O|{"CREATE TABLE","CREATE TABLE AS","SELECT INTO"}'
SEIS='5514; 3466 16642 EVENT TRIGGER - issue_graphql_placeholder supabase_admin
5517; 3466 16721 EVENT TRIGGER - issue_pg_cron_access supabase_admin
5519; 3466 16733 EVENT TRIGGER - issue_pg_graphql_access supabase_admin
5518; 3466 16724 EVENT TRIGGER - issue_pg_net_access supabase_admin
5515; 3466 16643 EVENT TRIGGER - pgrst_ddl_watch supabase_admin
5516; 3466 16644 EVENT TRIGGER - pgrst_drop_watch supabase_admin'
TRIGGER='5520; 3466 26316 EVENT TRIGGER - ensure_rls postgres'
FUNCION='626; 1255 17666 FUNCTION public rls_auto_enable() postgres'
# Índices: el de producción (medido el 2026-11-02), uno que perdió el trigger y el de otro proyecto.
indice_normal() { printf ';\n; Archive\n;\n%s\n%s\n%s\n' "${FUNCION}" "${SEIS}" "${TRIGGER}" > "${T}/d/indice"; }
indice_sin_trigger() { printf ';\n%s\n%s\n' "${FUNCION}" "${SEIS}" > "${T}/d/indice"; }
indice_otro_proyecto() { printf ';\n%s\n' "${SEIS}" > "${T}/d/indice"; }

printf 'dump de mentira' > "${T}/x.dump"
printf -- '-- huella-acl: 1:0123456789abcdef0123456789abcdef\nrevoke all on table public.t from anon;\n' > "${T}/x-acl.sql"

restore() { # argumentos extra para restore.sh
  PGPASSWORD=x bash "${S}/backup/restore.sh" --file "${T}/x.dump" --project prueba-evt --target restaurada \
    --user supabase_admin --work-dir "${T}/shm" "$@" > "${T}/salida.log" 2>&1
}
restore_test() {
  bash "${S}/backup/restore-test.sh" --file "${T}/x.dump" --work-dir "${T}/shm" "$@" > "${T}/salida.log" 2>&1
}
salida() { grep -qF -- "$1" "${T}/salida.log"; }
filas() { dobles_restore_foto | wc -l | tr -d ' '; }
orden() { grep -n -- "$1" "${T}/d/docker.log" | head -n1 | cut -d: -f1; }

echo "== el doble reproduce lo medido el 29-oct: pg_restore a secas no puede crear ensure_rls"
indice_normal; dobles_restore_reiniciar
docker run --rm --network n -e PGPASSWORD img pg_restore -h db -U supabase_admin -d r --clean --if-exists --jobs 2 /restore.dump > "${T}/control.log" 2>&1; rc=$?
igual "pg_restore sale 1" "1" "${rc}"
igual "dos errores, los del 29-oct" "2" "$(grep -c '^pg_restore: error:' "${T}/control.log")"
si "el primero: Superuser owned event trigger" "grep -qF 'Superuser owned event trigger must execute a superuser owned function' '${T}/control.log'"
si "el segundo: event trigger does not exist" "grep -qF 'event trigger \"ensure_rls\" does not exist' '${T}/control.log'"
igual "quedan los otros seis" "6" "$(filas)"
si "sin ensure_rls" "! grep -q '^ensure_rls|' '${T}/d/evt'"
dobles_restore_reiniciar
docker run --rm --network n -e PGPASSWORD img psql -h db -U supabase_admin -d r -c "create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();" > "${T}/control.log" 2>&1; rc=$?
igual "como supabase_admin, sin set role, el CREATE también falla" "3" "${rc}"

echo "== restore.sh · base nueva"
indice_normal; dobles_restore_reiniciar
restore --acl "${T}/x-acl.sql"; rc=$?
igual "sale 0" "0" "${rc}"
igual "quedan los siete" "7" "$(filas)"
si "ensure_rls exacto: dueño, función, estado y etiquetas" "grep -qxF '${ESPERADO}' '${T}/d/evt'"
si "informa iguales" "salida 'event triggers: esperados 7 · restaurada 7 · iguales'"
si "sin errores de pg_restore" "! salida 'pg_restore: error'"
si "se recrea después de pg_restore" "[[ \$(orden 'pg_restore -h') -lt \$(orden 'create event trigger ensure_rls') ]]"
si "el índice se lee antes de tocar el destino" "[[ \$(orden 'pg_restore --list') -lt \$(orden 'create database') ]]"
si "el índice se lee sin red" "grep -E 'pg_restore --list' '${T}/d/docker.log' | grep -q -- '--network none'"
si "pg_restore recibe el índice con -L" "grep -E 'pg_restore -h' '${T}/d/docker.log' | grep -q -- '-L /restore.list'"
si "no queda nada en la carpeta de trabajo" "[[ -z \"\$(ls -A '${T}/shm')\" ]]"

echo "== restore.sh · base que ya tiene ensure_rls (restaurar encima)"
indice_normal; dobles_restore_reiniciar
printf '%s\n' "${ESPERADO}" > "${T}/d/evt"
restore --acl "${T}/x-acl.sql"; rc=$?
igual "sale 0" "0" "${rc}"
si "no falla el DROP de la función" "! salida 'cannot drop function'"
si "se quita antes de pg_restore" "[[ \$(orden 'drop event trigger if exists ensure_rls') -lt \$(orden 'pg_restore -h') ]]"
igual "un solo ensure_rls" "1" "$(grep -c '^ensure_rls|' "${T}/d/evt")"
igual "quedan los siete" "7" "$(filas)"

echo "== restore.sh · nadie puede ver éxito sin ensure_rls"
indice_normal; dobles_restore_reiniciar
DOBLE_RECREAR_FALLA=1 restore --acl "${T}/x-acl.sql"; rc=$?
igual "si no se puede recrear, sale 9" "9" "${rc}"
si "lo dice" "salida 'FALTAN ensure_rls (no se pudo recrear ensure_rls)'"
si "y dice qué significa" "salida 'las tablas nuevas de public nacen sin RLS'"
si "no dice listo" "! salida ' listo'"
dobles_restore_reiniciar
DOBLE_DUENO_RECREADO=supabase_admin restore --acl "${T}/x-acl.sql"; rc=$?
igual "con otro dueño, sale 9" "9" "${rc}"
si "lo dice" "salida 'FALTAN ensure_rls'"
dobles_restore_reiniciar
DOBLE_RECREAR_FALLA=1 DOBLE_ACL_HUELLA='9:ffffffffffffffffffffffffffffffff' restore --acl "${T}/x-acl.sql"; rc=$?
igual "con permisos distintos gana el 8" "8" "${rc}"
si "pero informa los dos" "salida 'FALTAN ensure_rls' && salida 'DISTINTOS'"
dobles_restore_reiniciar
DOBLE_RECREAR_FALLA=1 DOBLE_PG_RESTORE_RC=1 restore --acl "${T}/x-acl.sql"; rc=$?
igual "con advertencias de pg_restore gana el 9, no el 4" "9" "${rc}"

echo "== restore.sh · otro event trigger del dump que no queda"
indice_normal; dobles_restore_reiniciar
DOBLE_PIERDE=pgrst_ddl_watch restore --acl "${T}/x-acl.sql"; rc=$?
igual "sale 9" "9" "${rc}"
si "lo nombra" "salida 'FALTAN pgrst_ddl_watch'"
si "cuenta seis de siete" "salida 'esperados 7 · restaurada 6'"
dobles_restore_reiniciar
DOBLE_CAMBIA_DUENO=pgrst_ddl_watch restore --acl "${T}/x-acl.sql"; rc=$?
igual "con otro dueño que el del dump, sale 9" "9" "${rc}"
si "lo nombra aunque cuente siete" "salida 'esperados 7 · restaurada 7 · FALTAN pgrst_ddl_watch'"

echo "== restore.sh · el dump no trae el trigger, pero sí su función (el origen lo perdió)"
indice_sin_trigger; dobles_restore_reiniciar
restore --acl "${T}/x-acl.sql"; rc=$?
igual "lo recrea y sale 0" "0" "${rc}"
si "ensure_rls exacto" "grep -qxF '${ESPERADO}' '${T}/d/evt'"
si "avisa del origen" "salida 'ADVERTENCIA: ensure_rls no venía en el dump'"
si "cuenta siete esperados" "salida 'esperados 7 · restaurada 7 · iguales'"

echo "== restore.sh · otro proyecto, sin ensure_rls ni su función"
indice_otro_proyecto; dobles_restore_reiniciar
restore --acl "${T}/x-acl.sql"; rc=$?
igual "sale 0" "0" "${rc}"
si "no lo crea" "! grep -q 'ensure_rls' '${T}/d/docker.log'"
si "cuenta seis" "salida 'esperados 6 · restaurada 6 · iguales'"
indice_otro_proyecto; dobles_restore_reiniciar
DOBLE_PIERDE=pgrst_drop_watch restore --acl "${T}/x-acl.sql"; rc=$?
igual "si pierde uno de los suyos, también sale 9" "9" "${rc}"

echo "== restore.sh · lo demás sigue igual"
indice_normal; dobles_restore_reiniciar
DOBLE_PG_RESTORE_RC=1 restore --acl "${T}/x-acl.sql"; rc=$?
igual "otras advertencias de pg_restore: sale 4" "4" "${rc}"
si "con ensure_rls recreado" "grep -qxF '${ESPERADO}' '${T}/d/evt'"
dobles_restore_reiniciar
: > "${T}/d/indice-roto"
restore --acl "${T}/x-acl.sql"; rc=$?
igual "dump que no se lee: sale 2" "2" "${rc}"
si "lo dice" "salida 'no pudo leer el índice'"
si "no toca el destino" "! grep -qE 'create database|pg_restore -h|psql' '${T}/d/docker.log'"
dobles_restore_reiniciar
DOBLE_QUITAR_FALLA=1 restore --acl "${T}/x-acl.sql"; rc=$?
igual "si no se puede quitar ensure_rls: sale 2" "2" "${rc}"
si "lo dice" "salida 'no se pudo quitar ensure_rls del destino: no se restauró nada'"
si "no corre pg_restore" "! grep -q 'pg_restore -h' '${T}/d/docker.log'"
dobles_restore_reiniciar
PGPASSWORD=x bash "${S}/backup/restore.sh" --file "${T}/x.dump" --project prueba-evt --target restaurada --user supabase_admin --dry-run > "${T}/salida.log" 2>&1; rc=$?
igual "dry-run: sale 0" "0" "${rc}"
igual "dry-run: no llama a docker" "0" "$(dobles_restore_llamadas)"
si "dry-run: el plan incluye recrearlo" "salida 'create\\ event\\ trigger\\ ensure_rls'"
PGPASSWORD=x bash "${S}/backup/restore.sh" --help > "${T}/salida.log" 2>&1
si "--help llega hasta el final del encabezado" "salida 'Restore de prueba mensual'"
si "--help no se pasa al código" "! salida 'set -euo pipefail'"

echo "== restore-test.sh"
indice_normal; dobles_restore_reiniciar
restore_test --acl "${T}/x-acl.sql"; rc=$?
igual "feliz: sale 0" "0" "${rc}"
si "comprueba los event triggers" "salida 'PASÓ  · event triggers iguales a los del dump · iguales'"
si "comprueba que el dump lo traiga" "salida 'PASÓ  · el dump trae ensure_rls si trae su función'"
si "mide que una tabla nueva nace con RLS" "salida 'PASÓ  · una tabla nueva de public nace con RLS (ensure_rls) · t'"
si "resultado sin FALLÓ" "salida '· 0 FALLÓ'"

dobles_restore_reiniciar
DOBLE_RECREAR_FALLA=1 restore_test --acl "${T}/x-acl.sql"; rc=$?
igual "sin ensure_rls: sale 7, no 5 de 5" "7" "${rc}"
si "falla la comprobación de event triggers" "salida 'FALLÓ · event triggers iguales a los del dump'"
si "y la evidencia nombra lo que falta" "salida \"obtenido 'FALTAN ensure_rls\""
si "falla la de la tabla nueva" "salida 'FALLÓ · una tabla nueva de public nace con RLS'"

dobles_restore_reiniciar
DOBLE_RECREAR_FALLA=1 DOBLE_ACL_HUELLA='9:ffffffffffffffffffffffffffffffff' restore_test --acl "${T}/x-acl.sql"; rc=$?
igual "con permisos distintos también (restore.sh salió 8): sale 7" "7" "${rc}"
si "falla la comprobación de event triggers aunque el código sea 8" "salida 'FALLÓ · event triggers iguales a los del dump'"

indice_sin_trigger; dobles_restore_reiniciar
restore_test --acl "${T}/x-acl.sql"; rc=$?
igual "el origen lo perdió: sale 7 aunque aquí se recree" "7" "${rc}"
si "lo dice" "salida 'FALLÓ · el dump trae ensure_rls si trae su función'"

indice_otro_proyecto; dobles_restore_reiniciar
restore_test --acl "${T}/x-acl.sql"; rc=$?
igual "otro proyecto: sale 0" "0" "${rc}"
si "no mide la tabla nueva" "! salida 'una tabla nueva de public'"

# restore.sh de antes del arreglo: no informa nada. No verificado no es éxito.
mkdir -p "${T}/viejo/backup" "${T}/viejo/lib"
cp "${S}/backup/restore-test.sh" "${T}/viejo/backup/"
printf '#!/usr/bin/env bash\necho "permisos de public: origen 1:a · restaurada 1:a · iguales"\nexit 0\n' > "${T}/viejo/backup/restore.sh"
chmod +x "${T}/viejo/backup/restore.sh" "${T}/viejo/backup/restore-test.sh"
indice_normal; dobles_restore_reiniciar
printf '%s\n' "${SEIS}" | sed -E 's/^[0-9]+; [0-9]+ [0-9]+ EVENT TRIGGER - ([^ ]+) ([^ ]+)$/\1|\2|extensions.\1|O|/' > "${T}/d/evt"
bash "${T}/viejo/backup/restore-test.sh" --file "${T}/x.dump" --work-dir "${T}/shm" > "${T}/salida.log" 2>&1; rc=$?
igual "un restore.sh que no informa: sale 7" "7" "${rc}"
si "«no verificados» no pasa" "salida \"FALLÓ · event triggers iguales a los del dump · esperado 'iguales', obtenido 'no verificados'\""

echo "== la definición es la de las migraciones"
# Toda migración que crea ensure_rls tiene que decir lo mismo que lib/event-triggers.sh.
. "${S}/lib/event-triggers.sh"
definiciones=0
while IFS= read -r m; do
  definiciones=$((definiciones + 1))
  tags="$(tr -s ' \n\r' ' ' < "${m}" | grep -oE "create event trigger ensure_rls on ddl_command_end when tag in \([^)]*\) execute function [a-z_.]+\(\)" | sort -u)"
  igual "$(basename "${m}") dice lo mismo" "create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable()" "${tags}"
done < <(grep -lE 'create event trigger ensure_rls' "${R}"/supabase/migrations/*.sql)
si "alguna migración lo crea" "(( definiciones > 0 ))"
si "el CREATE de la lib es esa definición" "[[ \"\${EVT_ENSURE_RLS_CREAR_SQL}\" == *\"create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable();\" ]]"

echo "RESULTADO: ${paso} PASÓ · ${fallo} FALLÓ"
(( fallo == 0 ))
