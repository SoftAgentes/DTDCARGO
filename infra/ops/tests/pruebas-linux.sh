#!/usr/bin/env bash
# infra/ops/tests/pruebas-linux.sh — pruebas bash con dobles que piden Linux y que
# Vitest no corre (SDD-0550). Las corre el CI «Calidad continua» en ubuntu.
#
#   bash infra/ops/tests/pruebas-linux.sh
#
# En Windows no hay flock (prueba-publicar-web.sh lo pide): en un contenedor, por ejemplo
#   docker run --rm -v "$PWD":/repo -w /repo node:24 bash infra/ops/tests/pruebas-linux.sh
#
# Cada prueba cuenta como PASÓ sólo si sale 0, escribe al menos un «PASÓ» y
# ningún «FALLÓ». Un exit 0 sin líneas «PASÓ» es FALLÓ: una prueba vacía no es
# verde. Una que falla no corta a las demás; al final sale 1 si falló alguna.
#
# Qué corre dónde lo fija scripts/__tests__/ci-workflow-contract.test.mjs: toda
# prueba-*.sh de infra/ops/tests está aquí, en una prueba de Vitest o en su lista
# de excluidas con el motivo.
#
# Cada prueba tiene un tope de 600 s (PRUEBAS_LINUX_TOPE_S); al vencer es FALLÓ
# con exit 124.
#
# Además, cada prueba con piso en PISO tiene que escribir al menos ese número de «PASÓ».
#
# PRUEBAS_LINUX_LISTA (una ruta por línea, relativa a la raíz o absoluta),
# PRUEBAS_LINUX_PISOS y PRUEBAS_LINUX_TOPE_S los usa sólo la prueba de este runner,
# infra/ops/tests/pruebas-linux.test.mjs. El CI no los define.
set -uo pipefail
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

PRUEBAS=(
  infra/ops/tests/prueba-publicar-web.sh # SDD-0541: publicación automática de la web
  infra/ops/tests/prueba-aviso-discord.sh # SDD-0609: aviso del servidor a Discord
  infra/ops/tests/prueba-guardar-webhook-discord.sh # SDD-0609: guardar el webhook de #publicaciones
  infra/ops/tests/prueba-runbook-avisos-discord.sh # SDD-0609: el paso 2 del runbook corta al primer PARAR; la vuelta atrás elige por huella
  infra/ops/tests/prueba-aplicar-lote.sh # SDD-0543: carga de consolidados en prueba y producción
  infra/ops/tests/prueba-ips-prueba.sh   # SDD-0540: lista de IP del entorno de prueba
  infra/ops/tests/prueba-prompt-trim.sh  # SDD-0505: trim() de lib/prompt.sh
  infra/ops/tests/prueba-restore-event-triggers.sh # SDD-0594: restore.sh con ensure_rls y los demás event triggers
  infra/ops/tests/prueba-portal-historial.sh # SDD-0586 10.7: extraer.sh y vincular.sh de la carga del portal, con /dev/shm
  infra/ops/tests/prueba-respaldo-storage.sh # SDD-0620: respaldo cifrado y restore de los archivos del Storage, con mutantes
  infra/ops/tests/prueba-vigilar-chatwoot.sh # SDD-0583: alarmas de vigilar.sh (cupo de WhatsApp, token de Instagram), con mutantes
)
# Piso de «PASÓ» por prueba (revisión del DG de la #480, N4): una prueba que pierde casos en silencio, aunque salga 0
# y sin «FALLÓ», es FALLÓ. Cada piso es el conteo medido en el CI. Cada prueba que corre tiene que estar aquí: una
# sin piso declarado es FALLÓ, aunque pase.
declare -A PISO=(
  [infra/ops/tests/prueba-publicar-web.sh]=228
  [infra/ops/tests/prueba-aviso-discord.sh]=39
  [infra/ops/tests/prueba-guardar-webhook-discord.sh]=32
  [infra/ops/tests/prueba-runbook-avisos-discord.sh]=12
  [infra/ops/tests/prueba-aplicar-lote.sh]=40
  [infra/ops/tests/prueba-ips-prueba.sh]=24
  [infra/ops/tests/prueba-prompt-trim.sh]=13
  [infra/ops/tests/prueba-restore-event-triggers.sh]=78
  [infra/ops/tests/prueba-portal-historial.sh]=139
  [infra/ops/tests/prueba-respaldo-storage.sh]=90
  [infra/ops/tests/prueba-vigilar-chatwoot.sh]=102
)
# PRUEBAS_LINUX_PISOS («ruta=n» por línea) la usa sólo pruebas-linux.test.mjs, para probar el piso con pruebas de mentira.
if [ -n "${PRUEBAS_LINUX_PISOS:-}" ]; then
  while IFS='=' read -r k v; do [ -n "${k}" ] && PISO["${k}"]="${v}"; done <<< "${PRUEBAS_LINUX_PISOS}"
fi
if [ -n "${PRUEBAS_LINUX_LISTA:-}" ]; then
  PRUEBAS=()
  while IFS= read -r l; do [ -n "${l}" ] && PRUEBAS+=("${l}"); done <<< "${PRUEBAS_LINUX_LISTA}"
fi

T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
fallas=0; total=0; inicio_total=${SECONDS}
for p in "${PRUEBAS[@]}"; do
  total=$((total + 1))
  log="${T}/${total}.log"; inicio=${SECONDS}
  case "${p}" in /* | [A-Za-z]:/*) ruta="${p}" ;; *) ruta="${R}/${p}" ;; esac
  if [ -f "${ruta}" ]; then
    # Tope por prueba: un cuelgue sale como FALLÓ con su nombre (exit 124), no como
    # el timeout del job entero.
    LC_ALL=C.UTF-8 timeout -k 10 "${PRUEBAS_LINUX_TOPE_S:-600}" bash "${ruta}" > "${log}" 2>&1; rc=$?
  else
    echo "no existe: ${p}" > "${log}"; rc=127
  fi
  pasaron="$(grep -c '^PASÓ' "${log}")"; fallaron="$(grep -c '^FALLÓ' "${log}")"
  seg=$((SECONDS - inicio))
  # Cada prueba que corre tiene que tener su piso declarado en PISO: si no, es FALLÓ (revisión del DG de la #480).
  piso="${PISO[${p}]:-}"; sin_piso=""
  [ -n "${piso}" ] || sin_piso=" · sin piso declarado" # guarda:piso_declarado
  [ -n "${piso}" ] || piso=1
  if [ "${rc}" = 0 ] && [ "${fallaron}" = 0 ] && [ "${pasaron}" -gt 0 ] && [ "${pasaron}" -ge "${piso}" ] && [ -z "${sin_piso}" ]; then
    echo "PASÓ  · ${p} · ${pasaron} PASÓ · ${seg} s"
  else
    fallas=$((fallas + 1))
    bajo=""; [ "${pasaron}" -ge "${piso}" ] || bajo=" · bajo el piso de ${piso} PASÓ"
    echo "FALLÓ · ${p} · exit ${rc} · ${pasaron} PASÓ · ${fallaron} FALLÓ · ${seg} s${bajo}${sin_piso}"
    grep '^FALLÓ' "${log}" | head -n 20 | sed 's/^/    /'
    echo "    --- últimas líneas ---"
    tail -n 40 "${log}" | sed 's/^/    /'
  fi
done
echo "RESULTADO: $((total - fallas)) PASÓ · ${fallas} FALLÓ · ${total} pruebas en $((SECONDS - inicio_total)) s"
[ "${total}" -gt 0 ] && [ "${fallas}" = 0 ]
