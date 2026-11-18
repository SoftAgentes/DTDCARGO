#!/usr/bin/env bash
# infra/ops/tests/prueba-aplicar-lote.sh — prueba de consolidados/aplicar-lote.sh (SDD-0543).
#
# Doble de docker en una carpeta temporal y lotes inventados: ninguna base.
# Comprueba las guardas (destino, -staging, --confirm, SHA256SUMS, entorno,
# id del lote, deshacer confirmado), el orden simulacro → aplicar, la forma de
# la salida (BEGIN … ROLLBACK/COMMIT) y que la evidencia no lleve nombres.
# Producción (extensión F2): AUTORIZACION.txt nominal por lote, deshacer y
# purgar deshabilitados, y un lote ya aplicado no se aplica otra vez.
#
#   bash infra/ops/tests/prueba-aplicar-lote.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APLICAR="${S}/consolidados/aplicar-lote.sh"
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }

mkdir -p "${T}/bin" "${T}/lote" "${T}/evid"
cat > "${T}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_LOG}"
script="$(cat)"
if [[ -n "${DOBLE_FALLA-}" && "${script}" == *"${DOBLE_FALLA}"* ]]; then
  echo "psql:stdin:9: ERROR:  preflight: el contenedor ABCU1234567 ya está cargado" >&2
  exit 3
fi
# Candado: el doble anota quién lo tiene mientras «psql» corre, puede robarlo
# (otro dueño rehízo el candado a mano) o dormir para dar tiempo a una señal.
if [[ -n "${DOBLE_VER_CANDADO-}" ]]; then cat "${LOTES_CANDADO}/pid" > "${DOBLE_VER_CANDADO}" 2> /dev/null; fi
if [[ -n "${DOBLE_ROBA_CANDADO-}" ]]; then echo 1 > "${LOTES_CANDADO}/pid"; fi
if [[ -n "${DOBLE_DORMIR-}" ]]; then sleep "${DOBLE_DORMIR}"; fi
# Fuga plantada: lo que psql escriba, con nombre y todo, llega a la evidencia tal cual.
if [[ -n "${DOBLE_FUGA-}" ]]; then
  echo "psql:stdin:12: NOTICE:  marca sin resolver: NOMBRE SECRETO PRUEBA" >&2
fi
echo BEGIN
lote="$(grep -oE 'carga-consolidado:[0-9]+:[0-9a-f]+' <<< "${script}" | head -1)"
echo "psql:stdin:40: NOTICE:  lote ${lote} · contenedor ABCU1234567 (DTD-CONSOL-0001) · 3 envíos · 3 recepciones · 3 items · 3 facturas · 3 clientes creados" >&2
if [[ "${script}" == *"-- cierre: commit"* ]]; then echo COMMIT; else echo ROLLBACK; fi
exit 0
DOBLE
chmod +x "${T}/bin/docker"
export PATH="${T}/bin:${PATH}" DOBLE_LOG="${T}/docker.log" LOTES_CANDADO="${T}/candado.lock.d"

L="${T}/lote"
for paso in previa simulacro verificar; do
  printf '\\set ON_ERROR_STOP on\n-- lote carga-consolidado:59:deadbeef · %s\nbegin transaction read only;\nselect 1;\nrollback;\n' "${paso}" > "${L}/${paso}.sql"
done
for paso in aplicar deshacer purgar; do
  printf '\\set ON_ERROR_STOP on\n-- lote carga-consolidado:59:deadbeef · %s\n-- cierre: commit\nbegin;\nselect 1;\ncommit;\n' "${paso}" > "${L}/${paso}.sql"
done
cat > "${L}/manifiesto.json" <<'JSON'
{
  "lote": "carga-consolidado:59:deadbeef",
  "entorno": "prueba",
  "esperado": { "envios": 3, "recepciones": 3, "items": 3, "cajas": 10, "clientes": 3, "facturas": 3, "cbm": 2.107, "kg": 278, "base": 1629.18 },
  "clientes": [{ "clave": "DTD-J031", "nombreExcel": "NOMBRE SECRETO PRUEBA" }]
}
JSON
echo "# resumen · NOMBRE SECRETO PRUEBA" > "${L}/resumen.md"
( cd "${L}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )
corre() { bash "${APLICAR}" --project zz-staging --confirm zz-staging --lote "${L}" --evidence-dir "${T}/evid" "$@"; }

# 1. Guardas de destino.
bash "${APLICAR}" --project dtd-cargo --confirm dtd-cargo --lote "${L}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "lote de prueba en producción rechazado (3)" || ko "lote de prueba en producción no rechazado"
bash "${APLICAR}" --project zz-prod --confirm zz-prod --lote "${L}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "ni producción ni -staging rechazado (3)" || ko "sin -staging no rechazado"
bash "${APLICAR}" --project zz-staging --confirm otro --lote "${L}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "--confirm distinto rechazado (3)" || ko "--confirm distinto no rechazado"
corre --paso cualquiera >/dev/null 2>&1; [[ $? -eq 2 ]] && ok "paso desconocido es uso inválido (2)" || ko "paso desconocido no rechazado"
[[ -z "$(cat "${DOBLE_LOG}" 2>/dev/null)" ]] && ok "ninguna guarda llegó a docker" || ko "una guarda llegó a docker: $(cat "${DOBLE_LOG}")"

# 2. Integridad del lote.
echo "x" >> "${L}/resumen.md"
corre --paso previa >/dev/null 2>&1; [[ $? -eq 4 ]] && ok "SHA256SUMS alterado sale 4" || ko "SHA256SUMS alterado no sale 4"
( cd "${L}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )
sed -i 's/"entorno": "prueba"/"entorno": "produccion"/' "${L}/manifiesto.json"; ( cd "${L}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )
corre --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "lote generado para producción rechazado (3)" || ko "lote de producción no rechazado"
sed -i 's/"entorno": "produccion"/"entorno": "prueba"/' "${L}/manifiesto.json"; ( cd "${L}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )

# 3. previa: PASÓ, ROLLBACK y evidencia sin nombres.
out="$(corre --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 0 && "${out}" == *"PASÓ · previa · ROLLBACK"* ]] && ok "previa PASÓ con ROLLBACK" || ko "previa rc=${rc}: ${out}"
evid="$(ls -d "${T}"/evid/lote-*-zz-staging-*-previa | head -1)"
[[ -f "${evid}/previa.out" && -f "${evid}/LOTE.txt" && -f "${evid}/SHA256SUMS" ]] && ok "evidencia con salida, LOTE.txt y SHA256SUMS en una carpeta por paso" || ko "evidencia incompleta en ${evid}"
grep -q '^envios=3$' "${evid}/LOTE.txt" && ok "LOTE.txt trae los conteos esperados" || ko "LOTE.txt sin conteos"
grep -rq "SECRETO" "${evid}" && ko "la evidencia lleva un nombre de cliente" || ok "la evidencia no lleva nombres de clientes"
# Control del detector: el guion copia la salida de psql tal cual (no filtra nada:
# la higiene de nombres es del SQL generado, probada en consolidados-sql.test.ts).
# Si psql dejara escapar un nombre, tiene que verse en la evidencia; sin este
# control, el «no lleva nombres» de arriba pasaría aunque el detector no viera nada.
sleep 1
DOBLE_FUGA=1 corre --paso previa >/dev/null 2>&1
evid_fuga="$(ls -dt "${T}"/evid/lote-*-zz-staging-*-previa | head -1)"
[[ "${evid_fuga}" != "${evid}" ]] && grep -q "SECRETO" "${evid_fuga}/previa.err" && ok "control: una fuga plantada en psql queda en la evidencia y el detector la ve" || ko "control: el detector no vio la fuga plantada (${evid_fuga})"
grep -q "exec -i zz-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1" "${DOBLE_LOG}" && ok "psql corre en zz-staging-db-1 como postgres con ON_ERROR_STOP" || ko "docker.log: $(cat "${DOBLE_LOG}")"

# 4. aplicar exige simulacro previo; después del simulacro pasa con COMMIT, incluso en el mismo segundo.
corre --paso aplicar >/dev/null 2>&1; [[ $? -eq 5 ]] && ok "aplicar sin simulacro sale 5" || ko "aplicar sin simulacro no sale 5"
corre --paso simulacro >/dev/null 2>&1 && ok "simulacro PASÓ" || ko "simulacro falló"
[[ "$(ls -d "${T}"/evid/lote-*-zz-staging-*-simulacro 2>/dev/null | wc -l)" -eq 1 ]] && ok "la evidencia del simulacro tiene su propia carpeta" || ko "el simulacro pisó otra evidencia"
out="$(corre --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 0 && "${out}" == *"PASÓ · aplicar · COMMIT"* ]] && ok "aplicar PASÓ con COMMIT tras el simulacro" || ko "aplicar rc=${rc}: ${out}"

# 5. psql falla → 6, y una salida sin BEGIN/COMMIT → 7.
sleep 1
out="$(DOBLE_FALLA='lote carga-consolidado:59:deadbeef · verificar' corre --paso verificar 2>&1)"; rc=$?
[[ ${rc} -eq 6 && "${out}" == *"preflight: el contenedor"* ]] && ok "psql con ERROR sale 6 y muestra la línea" || ko "fallo de psql rc=${rc}: ${out}"
sleep 1
sed -i 's/-- cierre: commit/-- cierre: nada/' "${L}/deshacer.sql"; ( cd "${L}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )
corre --paso deshacer >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "deshacer sin --confirm-deshacer rechazado (3)" || ko "deshacer sin confirmar no rechazado"
corre --paso deshacer --confirm-deshacer carga-consolidado:59:deadbeef >/dev/null 2>&1; [[ $? -eq 7 ]] && ok "salida sin COMMIT al deshacer sale 7" || ko "salida sin COMMIT no sale 7"

# 5b. purgar: sin --confirm-purga se rechaza; confirmado, PASÓ con COMMIT.
sleep 1
corre --paso purgar >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "purgar sin --confirm-purga rechazado (3)" || ko "purgar sin confirmar no rechazado"
out="$(corre --paso purgar --confirm-purga carga-consolidado:59:deadbeef 2>&1)"; rc=$?
[[ ${rc} -eq 0 && "${out}" == *"PASÓ · purgar · COMMIT"* ]] && ok "purgar confirmado PASÓ con COMMIT" || ko "purgar rc=${rc}: ${out}"

# 6. --dry-run no toca docker.
antes="$(wc -l < "${DOBLE_LOG}")"
corre --paso previa --dry-run >/dev/null 2>&1 && [[ "$(wc -l < "${DOBLE_LOG}")" == "${antes}" ]] && ok "--dry-run no llama a docker" || ko "--dry-run llamó a docker"

# 7. Producción (dtd-cargo): lote generado con --entorno produccion.
P="${T}/lote-prod"; EP="${T}/evid-prod"; mkdir -p "${P}" "${EP}"
for paso in previa simulacro verificar; do
  printf '\\set ON_ERROR_STOP on\n-- lote carga-consolidado:61:cafebabe · %s\nbegin transaction read only;\nselect 1;\nrollback;\n' "${paso}" > "${P}/${paso}.sql"
done
# Un paquete de producción no trae deshacer.sql ni purgar.sql (el generador no los emite).
printf '\\set ON_ERROR_STOP on\n-- lote carga-consolidado:61:cafebabe · aplicar\n-- cierre: commit\nbegin;\nselect 1;\ncommit;\n' > "${P}/aplicar.sql"
cat > "${P}/manifiesto.json" <<'JSON'
{
  "lote": "carga-consolidado:61:cafebabe",
  "entorno": "produccion",
  "esperado": { "envios": 1, "recepciones": 0, "items": 0, "cajas": 0, "clientes": 1, "facturas": 0, "cbm": 0, "kg": 0, "base": 0 }
}
JSON
# Empaque mínimo: el paquete de producción no trae resumen.md ni nombres en el manifiesto.
( cd "${P}" && sha256sum -- *.sql manifiesto.json > SHA256SUMS )
prod() { bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP}" "$@"; }
antes="$(wc -l < "${DOBLE_LOG}")"
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"AUTORIZACION.txt"* ]] && ok "producción sin AUTORIZACION.txt rechazada (3)" || ko "sin autorización rc=${rc}: ${out}"
: > "${P}/AUTORIZACION.txt"
prod --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "AUTORIZACION.txt vacía rechazada (3)" || ko "autorización vacía no rechazada"
echo "Sam, 2026-11-13: autorizo cargar el contenedor 61 en producción" > "${P}/AUTORIZACION.txt"
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"no cita el lote carga-consolidado:61:cafebabe"* ]] && ok "autorización con el número suelto (sin el id del lote) rechazada (3)" || ko "número suelto rc=${rc}: ${out}"
echo "Sam: autorizo carga-consolidado:61:cafebabf" > "${P}/AUTORIZACION.txt"
prod --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "autorización de otro lote (otro hash) rechazada (3)" || ko "otro hash no rechazado"
echo "Sam: autorizo CARGA-CONSOLIDADO:61:CAFEBABE" > "${P}/AUTORIZACION.txt"
prod --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "id del lote en mayúsculas no vale: tiene que citarse exacto (3)" || ko "id en mayúsculas no rechazado"
for paso in simulacro aplicar; do
  out="$(prod --paso "${paso}" 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"no cita el lote"* ]] && ok "${paso} sin autorización válida rechazado (3)" || ko "${paso} sin autorización rc=${rc}: ${out}"
done
# --autorizacion apuntando a un archivo del lote que cita el id (el manifiesto): rechazo, y no llega a la evidencia.
out="$(prod --paso previa --autorizacion "${P}/manifiesto.json" 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"sólo vale AUTORIZACION.txt"* && -z "$(ls -A "${EP}")" ]] && ok "--autorizacion a manifiesto.json del lote rechazada sin dejar evidencia (3)" || ko "manifiesto como autorización rc=${rc}: ${out}"
out="$(prod --paso previa --autorizacion "${P}/../lote-prod/manifiesto.json" 2>&1)"; rc=$?
[[ ${rc} -eq 3 ]] && ok "--autorizacion a un archivo del lote por ruta con .. también rechazada (3)" || ko "ruta con .. rc=${rc}: ${out}"
# Un texto con forma de manifiesto no es el OK de Sam, aunque cite el id (H3).
printf '{ "lote": "carga-consolidado:61:cafebabe" }\n' > "${P}/AUTORIZACION.txt"
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"parece un manifiesto"* ]] && ok "autorización con \"lote\": (forma de manifiesto) rechazada (3)" || ko "\"lote\": rc=${rc}: ${out}"
printf 'OK carga-consolidado:61:cafebabe\n"nombreExcel": "X"\n' > "${P}/AUTORIZACION.txt"
prod --paso previa >/dev/null 2>&1; [[ $? -eq 3 && -z "$(ls -A "${EP}")" ]] && ok "autorización con \"nombreExcel\" rechazada sin dejar evidencia (3)" || ko "nombreExcel no rechazado"
# Un paquete de producción que trae deshacer.sql o purgar.sql se rechaza entero (H6).
for f in deshacer purgar; do
  printf '\\set ON_ERROR_STOP on\n-- lote carga-consolidado:61:cafebabe · %s\n' "${f}" > "${P}/${f}.sql"
  ( cd "${P}" && sha256sum -- *.sql manifiesto.json > SHA256SUMS )
  echo "Sam: autorizo carga-consolidado:61:cafebabe" > "${P}/AUTORIZACION.txt"
  out="$(prod --paso previa 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"trae ${f}.sql"* ]] && ok "paquete de producción con ${f}.sql rechazado en la previa (3)" || ko "${f}.sql en producción rc=${rc}: ${out}"
  rm -f "${P}/${f}.sql"; ( cd "${P}" && sha256sum -- *.sql manifiesto.json > SHA256SUMS )
done
# Empaque mínimo (2026-11-14): un paquete de producción con resumen.md, o con un
# manifiesto que trae nombreExcel, se rechaza entero, sin tocar docker ni dejar evidencia.
antes_em="$(wc -l < "${DOBLE_LOG}")"
echo "# resumen · NOMBRE SECRETO PRUEBA" > "${P}/resumen.md"
( cd "${P}" && sha256sum -- *.sql manifiesto.json resumen.md > SHA256SUMS )
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"trae resumen.md"* && -z "$(ls -A "${EP}")" ]] && ok "paquete de producción con resumen.md rechazado sin dejar evidencia (3)" || ko "resumen.md en producción rc=${rc}: ${out}"
rm -f "${P}/resumen.md"
cp "${P}/manifiesto.json" "${T}/manifiesto-limpio.json"
printf '{\n  "lote": "carga-consolidado:61:cafebabe",\n  "entorno": "produccion",\n  "clientes": [{ "clave": "MG-0019", "nombreExcel": "NOMBRE SECRETO PRUEBA" }]\n}\n' > "${P}/manifiesto.json"
( cd "${P}" && sha256sum -- *.sql manifiesto.json > SHA256SUMS )
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"trae nombreExcel"* && -z "$(ls -A "${EP}")" ]] && ok "manifiesto de producción con nombreExcel rechazado sin dejar evidencia (3)" || ko "nombreExcel en el manifiesto rc=${rc}: ${out}"
cp "${T}/manifiesto-limpio.json" "${P}/manifiesto.json"; ( cd "${P}" && sha256sum -- *.sql manifiesto.json > SHA256SUMS )
[[ "$(wc -l < "${DOBLE_LOG}")" -eq "${antes_em}" ]] && ok "los rechazos del empaque mínimo no llamaron a docker" || ko "un rechazo del empaque mínimo llamó a docker"
echo "Sam, 2026-11-13: autorizo cargar el lote carga-consolidado:61:cafebabe en producción" > "${P}/AUTORIZACION.txt"
out="$(prod --paso deshacer --confirm-deshacer carga-consolidado:61:cafebabe 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"deshabilitado en producción"* ]] && ok "deshacer en producción deshabilitado aunque esté confirmado (3)" || ko "deshacer en producción rc=${rc}: ${out}"
out="$(prod --paso purgar --confirm-purga carga-consolidado:61:cafebabe 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"deshabilitado en producción"* ]] && ok "purgar en producción deshabilitado aunque esté confirmado (3)" || ko "purgar en producción rc=${rc}: ${out}"
[[ "$(wc -l < "${DOBLE_LOG}")" == "${antes}" ]] && ok "ningún rechazo de producción llegó a docker" || ko "un rechazo de producción llegó a docker"
bash "${APLICAR}" --project zz-staging --confirm zz-staging --lote "${P}" --evidence-dir "${EP}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "lote de producción en prueba rechazado (3)" || ko "lote de producción corrió en prueba"
out="$(prod --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 0 && "${out}" == *"PASÓ · previa · ROLLBACK"* ]] && ok "previa en producción PASÓ con la autorización" || ko "previa producción rc=${rc}: ${out}"
ev="$(ls -d "${EP}"/lote-*-dtd-cargo-*-previa | head -1)"
grep -q "carga-consolidado:61:cafebabe" "${ev}/AUTORIZACION.txt" 2>/dev/null && ok "la evidencia de producción guarda la autorización" || ko "la evidencia no trae AUTORIZACION.txt"
grep -rq "SECRETO" "${EP}" && ko "la evidencia de producción lleva un nombre" || ok "la evidencia de producción no lleva nombres"
tail -1 "${DOBLE_LOG}" | grep -q "exec -i dtd-cargo-db-1 psql" && ok "psql corre en dtd-cargo-db-1" || ko "docker.log: $(tail -1 "${DOBLE_LOG}")"
prod --paso aplicar >/dev/null 2>&1; [[ $? -eq 5 ]] && ok "aplicar en producción sin simulacro sale 5" || ko "aplicar producción sin simulacro no sale 5"
sleep 1
prod --paso simulacro >/dev/null 2>&1 && ok "simulacro en producción PASÓ" || ko "simulacro producción falló"
out="$(prod --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 0 && "${out}" == *"PASÓ · aplicar · COMMIT"* ]] && ok "aplicar en producción PASÓ con COMMIT" || ko "aplicar producción rc=${rc}: ${out}"
antes="$(wc -l < "${DOBLE_LOG}")"
sleep 1
out="$(prod --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"ya se aplicó"* && "$(wc -l < "${DOBLE_LOG}")" == "${antes}" ]] && ok "lote ya aplicado: el segundo aplicar se niega sin tocar docker (3)" || ko "segundo aplicar rc=${rc}: ${out}"
# Sin evidencia local (otra carpeta), el preflight de aplicar.sql lo frena en la base: psql ≠ 0 → 6.
EP2="${T}/evid-prod-2"; mkdir -p "${EP2}"
bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP2}" --paso simulacro >/dev/null 2>&1
sleep 1
out="$(DOBLE_FALLA='carga-consolidado:61:cafebabe · aplicar' bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP2}" --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 6 && "${out}" == *"ya está cargado"* ]] && ok "lote existente en la base: el preflight lo frena y sale 6" || ko "preflight producción rc=${rc}: ${out}"
rm -f "${P}/AUTORIZACION.txt"; echo "OK de Sam para carga-consolidado:61:cafebabe" > "${T}/ok-61.txt"
prod --paso previa --autorizacion "${T}/ok-61.txt" >/dev/null 2>&1 && ok "--autorizacion <archivo> fuera del lote también vale" || ko "--autorizacion externa no funcionó"

# 8. Candado: con otro paso en curso, un aplicar se niega sin tocar docker; se libera al terminar.
EP3="${T}/evid-prod-3"; mkdir -p "${EP3}"
bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso simulacro >/dev/null 2>&1
[[ ! -e "${LOTES_CANDADO}" ]] && ok "el candado se libera al terminar el simulacro" || ko "el candado quedó tomado"
mkdir "${LOTES_CANDADO}"; antes="$(wc -l < "${DOBLE_LOG}")"; sleep 1
out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"candado"* && "$(wc -l < "${DOBLE_LOG}")" == "${antes}" && -d "${LOTES_CANDADO}" ]] && ok "aplicar con el candado tomado se niega sin tocar docker ni soltar el candado ajeno (3)" || ko "candado tomado rc=${rc}: ${out}"
rmdir "${LOTES_CANDADO}"
out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso aplicar 2>&1)"; rc=$?
[[ ${rc} -eq 0 && ! -e "${LOTES_CANDADO}" ]] && ok "sin candado, aplicar PASÓ y lo suelta" || ko "aplicar tras el candado rc=${rc}: ${out}"

# 9. Destino: PROD_COMPOSE_PROJECT cambia cuál es producción; mayúsculas no cuentan.
PROD_COMPOSE_PROJECT=otra-prod bash "${APLICAR}" --proyecto otra-prod --confirm otra-prod --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso previa >/dev/null 2>&1 && ok "PROD_COMPOSE_PROJECT=otra-prod: otra-prod es producción y acepta el lote" || ko "PROD_COMPOSE_PROJECT no se respetó"
PROD_COMPOSE_PROJECT=otra-prod bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "con PROD_COMPOSE_PROJECT=otra-prod, dtd-cargo deja de ser destino válido (3)" || ko "dtd-cargo aceptado con otra producción"
bash "${APLICAR}" --proyecto DTD-CARGO --confirm DTD-CARGO --lote "${P}" --evidence-dir "${EP3}" --autorizacion "${T}/ok-61.txt" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "DTD-CARGO en mayúsculas no es producción (3)" || ko "DTD-CARGO aceptado"
bash "${APLICAR}" --project ZZ-STAGING --confirm ZZ-STAGING --lote "${L}" --evidence-dir "${T}/evid" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "ZZ-STAGING en mayúsculas no es prueba (3)" || ko "ZZ-STAGING aceptado"

# 10. La autorización no puede ser un enlace simbólico (seguimiento de la #534).
# En Git Bash para Windows `ln -s` copia en vez de enlazar: ahí estos dos casos no
# se pueden montar y salen OMITIDOS (no cuentan como PASÓ); el CI Linux sí los corre.
EP4="${T}/evid-prod-4"; mkdir -p "${EP4}"
ln -s "${P}/manifiesto.json" "${T}/enlace-aut.txt" 2> /dev/null
if [[ -L "${T}/enlace-aut.txt" ]]; then
  out="$(prod_ep4() { bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP4}" "$@"; }; prod_ep4 --paso previa --autorizacion "${T}/enlace-aut.txt" 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"enlace simbólico"* && -z "$(ls -A "${EP4}")" ]] && ok "--autorizacion como enlace simbólico (al manifiesto) rechazada sin dejar evidencia (3)" || ko "enlace externo rc=${rc}: ${out}"
  ln -s "${T}/ok-61.txt" "${P}/AUTORIZACION.txt"
  out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP4}" --paso previa 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"enlace simbólico"* ]] && ok "AUTORIZACION.txt del lote como enlace simbólico rechazada, aunque apunte a un OK válido (3)" || ko "enlace en el lote rc=${rc}: ${out}"
  rm -f "${P}/AUTORIZACION.txt"
else
  echo "OMITIDA · --autorizacion como enlace simbólico (este bash no crea enlaces: ln -s copia)"
  echo "OMITIDA · AUTORIZACION.txt del lote como enlace simbólico (este bash no crea enlaces: ln -s copia)"
fi
rm -f "${T}/enlace-aut.txt"

# 11. Candado con dueño: el pid queda adentro mientras corre, una señal lo suelta
# por EXIT, y nunca se suelta uno que ya no es suyo.
# `exec`: en segundo plano, $! es el pid del guion mismo y no el de una subshell.
lento() { DOBLE_DORMIR="${DOBLE_DORMIR:-3}" exec bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP4}" --autorizacion "${T}/ok-61.txt" --paso simulacro "$@"; }
espera_candado() { local i; for i in $(seq 1 100); do [[ -s "${LOTES_CANDADO}/pid" ]] && return 0; sleep 0.1; done; return 1; }
# Sin control de trabajos, bash arranca los procesos de `&` con SIGINT ignorado y
# el trap no podría verlo; `set -m` sólo para esta sección.
set -m
for senal in TERM:143 HUP:129 INT:130; do
  nombre="${senal%%:*}"; esperado="${senal##*:}"
  visto="${T}/visto-${nombre}.pid"; rm -f "${visto}"
  # DOBLE_VER_CANDADO: el «psql» del doble anota el pid del candado mientras corre.
  (DOBLE_VER_CANDADO="${visto}" lento > /dev/null 2>&1) &
  pid=$!
  espera_candado
  # La señal llega mientras «psql» corre: hasta que el doble anotó el pid.
  for _ in $(seq 1 100); do [[ -s "${visto}" ]] && break; sleep 0.1; done
  dueno="$(cat "${LOTES_CANDADO}/pid" 2> /dev/null)"
  kill -"${nombre}" "${pid}" 2> /dev/null
  wait "${pid}"; rc=$?
  [[ "${dueno}" == "${pid}" && "$(cat "${visto}" 2> /dev/null)" == "${pid}" && ${rc} -eq ${esperado} && ! -e "${LOTES_CANDADO}" ]] \
    && ok "${nombre} durante el paso: psql ve el candado con el pid ${pid}, sale ${esperado} y lo suelta" \
    || ko "${nombre}: dueño='${dueno}' visto='$(cat "${visto}" 2> /dev/null)' pid=${pid} rc=${rc} candado=$([[ -e "${LOTES_CANDADO}" ]] && echo tomado || echo libre)"
  rm -rf "${LOTES_CANDADO}"; sleep 1
done
set +m
(DOBLE_DORMIR=0 DOBLE_ROBA_CANDADO=1 lento > /dev/null 2>&1)
[[ -d "${LOTES_CANDADO}" && "$(cat "${LOTES_CANDADO}/pid" 2> /dev/null)" == "1" ]] && ok "un candado que cambió de dueño durante el paso no se suelta al salir" || ko "se soltó un candado ajeno"
out="$(DOBLE_DORMIR=0 lento 2>&1)"; rc=$?  # $(…) ya es una subshell: el exec no se lleva la prueba
[[ ${rc} -eq 3 && "${out}" == *"dueño pid 1"* ]] && ok "el rechazo por candado tomado nombra el pid del dueño (3)" || ko "rechazo sin dueño rc=${rc}: ${out}"
rm -rf "${LOTES_CANDADO}"

# 12. Seguimiento de la #538.
# 12a. Una copia de resumen.md («# Lote <id>») no es el OK de Sam, aunque cite el id.
EP5="${T}/evid-prod-5"; mkdir -p "${EP5}"
printf '# Lote carga-consolidado:61:cafebabe · contenedor DTD #61\nOK\n' > "${T}/copia-resumen.txt"
out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP5}" --autorizacion "${T}/copia-resumen.txt" --paso previa 2>&1)"; rc=$?
[[ ${rc} -eq 3 && "${out}" == *"copia de resumen.md"* && -z "$(ls -A "${EP5}")" ]] && ok "autorización copiada de resumen.md (# Lote) rechazada sin dejar evidencia (3)" || ko "copia de resumen.md rc=${rc}: ${out}"
# Variantes que se colaban con `^# Lote ` (revisión de la #545): BOM UTF-8, sangría,
# renderizada sin «#», citada con «>», y sólo las cabeceras de la tabla de clientes.
# Todas citan el id: sin la guarda pasarían como OK y la previa correría (rc 0).
printf '\xEF\xBB\xBF# Lote carga-consolidado:61:cafebabe · contenedor DTD #61 (ABCU1234567)\n' > "${T}/resumen-bom.txt"
printf '   # Lote carga-consolidado:61:cafebabe · contenedor DTD #61 (ABCU1234567)\n' > "${T}/resumen-sangria.txt"
printf 'Lote carga-consolidado:61:cafebabe · contenedor DTD #61 (ABCU1234567)\n' > "${T}/resumen-renderizado.txt"
printf 'OK de Sam:\n> # Lote carga-consolidado:61:cafebabe · contenedor DTD #61\n' > "${T}/resumen-citado.txt"
printf 'OK carga-consolidado:61:cafebabe\n| Marca | Etiqueta en la evidencia | Nombre (Excel) | Embarques | Cajas | CBM | kg | Base | Candidatos a resolver |\n' > "${T}/resumen-tabla.txt"
for v in bom sangria renderizado citado tabla; do
  out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP5}" --autorizacion "${T}/resumen-${v}.txt" --paso previa 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"copia de resumen.md"* && -z "$(ls -A "${EP5}")" ]] && ok "copia de resumen.md (${v}) rechazada sin dejar evidencia (3)" || ko "copia de resumen.md (${v}) rc=${rc}: ${out}"
done
# Un OK legítimo que nombra el lote (incluso empezando con «Lote <id>» o mencionando «# Lote») sigue valiendo.
printf 'Sam: autorizo carga-consolidado:61:cafebabe (ver # Lote en el resumen)\n' > "${T}/ok-con-almohadilla.txt"
bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP5}" --autorizacion "${T}/ok-con-almohadilla.txt" --paso previa >/dev/null 2>&1 && ok "un OK que menciona «# Lote» sin el título del resumen sigue valiendo" || ko "un OK válido con «# Lote» se rechazó"
printf 'Lote carga-consolidado:61:cafebabe: autorizado por Sam el 2026-11-14\n' > "${T}/ok-empieza-lote.txt"
bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP5}" --autorizacion "${T}/ok-empieza-lote.txt" --paso previa >/dev/null 2>&1 && ok "un OK que empieza con «Lote <id>» (sin «· contenedor DTD #») sigue valiendo" || ko "un OK válido que empieza con «Lote <id>» se rechazó"
# 12b. Los traps de señal (129, 130, 143) y el de EXIT que suelta el candado se
# ponen antes de tomarlo: una señal entre el mkdir y el printf del pid también lo suelta.
l_exit="$(grep -n "^trap al_salir EXIT" "${APLICAR}" | head -1 | cut -d: -f1)"
l_sen="$(grep -n "^trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM" "${APLICAR}" | head -1 | cut -d: -f1)"
l_mkdir="$(grep -n 'mkdir -- "${CANDADO}"' "${APLICAR}" | head -1 | cut -d: -f1)"
l_pid="$(grep -n '"${CANDADO}/pid"; }' "${APLICAR}" | head -1 | cut -d: -f1)"
[[ -n "${l_exit}" && -n "${l_sen}" && -n "${l_mkdir}" && -n "${l_pid}" && ${l_exit} -lt ${l_mkdir} && ${l_sen} -lt ${l_mkdir} && ${l_mkdir} -lt ${l_pid} ]] \
  && ok "traps EXIT y 129/130/143 antes del mkdir del candado y del pid (líneas ${l_exit}, ${l_sen} < ${l_mkdir} < ${l_pid})" \
  || ko "orden de traps: exit=${l_exit} señales=${l_sen} mkdir=${l_mkdir} pid=${l_pid}"
# 12c. Un deshacer.sql que es un enlace simbólico roto también se rechaza (no basta -e).
ln -s "${T}/no-existe.sql" "${P}/deshacer.sql" 2> /dev/null
if [[ -L "${P}/deshacer.sql" ]]; then
  antes="$(wc -l < "${DOBLE_LOG}")"
  out="$(bash "${APLICAR}" --proyecto dtd-cargo --confirm dtd-cargo --lote "${P}" --evidence-dir "${EP5}" --autorizacion "${T}/ok-61.txt" --paso previa 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"trae deshacer.sql"* && "$(wc -l < "${DOBLE_LOG}")" == "${antes}" ]] && ok "paquete de producción con deshacer.sql como enlace roto rechazado sin tocar docker (3)" || ko "enlace roto de deshacer.sql rc=${rc}: ${out}"
else
  echo "OMITIDA · deshacer.sql como enlace simbólico roto (este bash no crea enlaces: ln -s copia)"
fi
rm -f "${P}/deshacer.sql"
# 12d. Si el pid no se puede escribir en el candado, rechaza (3), no corre psql y
# no deja el candado tomado. Se fuerza con `ulimit -f 0` (escribir 1 byte da EFBIG)
# y SIGXFSZ ignorada; donde el bash no aplica el límite (Git Bash), sale OMITIDA.
if ( trap '' XFSZ; ulimit -f 0; printf x > "${T}/sonda-ulimit" ) 2> /dev/null; then
  echo "OMITIDA · candado sin pid escrito (este bash no aplica ulimit -f)"
else
  antes="$(wc -l < "${DOBLE_LOG}")"; rm -rf "${LOTES_CANDADO}"
  out="$( ( trap '' XFSZ; ulimit -f 0; exec bash "${APLICAR}" --project zz-staging --confirm zz-staging --lote "${L}" --evidence-dir "${T}/evid" --paso simulacro ) 2>&1)"; rc=$?
  [[ ${rc} -eq 3 && "${out}" == *"no pude escribir el pid"* && ! -e "${LOTES_CANDADO}" && "$(wc -l < "${DOBLE_LOG}")" == "${antes}" ]] \
    && ok "pid sin escribir: rechaza (3), no llama a docker y suelta el candado" \
    || ko "pid sin escribir rc=${rc} candado=$([[ -e "${LOTES_CANDADO}" ]] && echo tomado || echo libre): ${out}"
  rm -rf "${LOTES_CANDADO}"
fi
rm -f "${T}/sonda-ulimit"

echo "${pass} PASÓ · ${fail} FALLÓ"
[[ ${fail} -eq 0 ]]
