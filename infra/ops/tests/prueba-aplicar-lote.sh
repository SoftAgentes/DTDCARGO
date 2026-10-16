#!/usr/bin/env bash
# infra/ops/tests/prueba-aplicar-lote.sh — prueba de consolidados/aplicar-lote.sh (SDD-0543).
#
# Doble de docker en una carpeta temporal y un lote inventado: ninguna base.
# Comprueba las guardas (producción, -staging, --confirm, SHA256SUMS, entorno,
# id del lote, deshacer confirmado), el orden simulacro → aplicar, la forma de
# la salida (BEGIN … ROLLBACK/COMMIT) y que la evidencia no lleve nombres.
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
echo BEGIN
echo "psql:stdin:40: NOTICE:  lote carga-consolidado:59:deadbeef · contenedor ABCU1234567 (DTD-CONSOL-0001) · 3 envíos · 3 recepciones · 3 items · 3 facturas · 3 clientes creados" >&2
if [[ "${script}" == *"-- cierre: commit"* ]]; then echo COMMIT; else echo ROLLBACK; fi
exit 0
DOBLE
chmod +x "${T}/bin/docker"
export PATH="${T}/bin:${PATH}" DOBLE_LOG="${T}/docker.log"

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
bash "${APLICAR}" --project dtd-cargo --confirm dtd-cargo --lote "${L}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "producción rechazada (3)" || ko "producción no rechazada"
bash "${APLICAR}" --project zz-prod --confirm zz-prod --lote "${L}" --paso previa >/dev/null 2>&1; [[ $? -eq 3 ]] && ok "sin -staging rechazado (3)" || ko "sin -staging no rechazado"
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
evid="$(ls -d "${T}"/evid/lote-*-zz-staging-* | head -1)"
[[ -f "${evid}/previa.out" && -f "${evid}/LOTE.txt" && -f "${evid}/SHA256SUMS" ]] && ok "evidencia con salida, LOTE.txt y SHA256SUMS" || ko "evidencia incompleta en ${evid}"
grep -q '^envios=3$' "${evid}/LOTE.txt" && ok "LOTE.txt trae los conteos esperados" || ko "LOTE.txt sin conteos"
grep -rq "SECRETO" "${evid}" && ko "la evidencia lleva un nombre de cliente" || ok "la evidencia no lleva nombres de clientes"
grep -q "exec -i zz-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1" "${DOBLE_LOG}" && ok "psql corre en zz-staging-db-1 como postgres con ON_ERROR_STOP" || ko "docker.log: $(cat "${DOBLE_LOG}")"

# 4. aplicar exige simulacro previo; después del simulacro pasa con COMMIT.
corre --paso aplicar >/dev/null 2>&1; [[ $? -eq 5 ]] && ok "aplicar sin simulacro sale 5" || ko "aplicar sin simulacro no sale 5"
sleep 1
corre --paso simulacro >/dev/null 2>&1 && ok "simulacro PASÓ" || ko "simulacro falló"
sleep 1
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

echo "${pass} PASÓ · ${fail} FALLÓ"
[[ ${fail} -eq 0 ]]
