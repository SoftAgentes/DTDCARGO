#!/usr/bin/env bash
# infra/ops/cable-oficina/puente-prueba.sh — arranca, para o muestra el puente interno de PRUEBA del cable
# (SDD-0626 Paso 2b; el código es puente-prueba.mjs, al lado).
#
# Corre EN EL VPS DTD como root, con la copia en /srv/ops/cable-oficina/. El puente es un contenedor
# suelto, sin compose y sin reinicio automático:
#   - nombre dtd-cable-puente-prueba, imagen node:24.22.3-alpine, solo lectura, sin capacidades,
#     usuario 1000, 128 MiB, --restart no, --stop-timeout 1;
#   - dos redes y ninguna más: chatwoot_interna (para leer la API de Chatwoot en rails:3000) y
#     dtd-cargo-staging_dtd_internal (para llegar al web de PRUEBA en dtd-cargo-staging-web-1:3000). Ninguna sale a
#     internet. La red de producción (dtd-cargo_dtd_internal) está prohibida: si el contenedor
#     terminara en ella, se borra y el script falla;
#   - el entorno sale de /etc/dtd-cable/puente-prueba.env (root 600): CHATWOOT_API_TOKEN y
#     OFICINA_WEBHOOK_SECRET. Nunca se imprimen;
#   - en disco solo el cursor: /var/lib/dtd-cable/puente-prueba/cursor (último id entregado).
#
# Uso:
#   puente-prueba.sh arrancar     crea y arranca el contenedor (falla si ya existe)
#   puente-prueba.sh parar        lo para en ~1 s y lo borra (el cursor se queda)
#   puente-prueba.sh estado       estado del contenedor y sus últimas 20 líneas de log (solo ids y códigos)
#   puente-prueba.sh una-vuelta   corre UNA vuelta en un contenedor efímero y sale (diagnóstico)
#
# Revertir del todo: `parar`, luego `rm -rf /var/lib/dtd-cable/puente-prueba /etc/dtd-cable/puente-prueba.env`
# y borrar el usuario del puente en Chatwoot (docs/runbooks/oficina-cable.md §9).
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por una guarda · 5 docker falló.
set -uo pipefail
umask 077

NOMBRE="dtd-cable-puente-prueba"
IMAGEN="node:24.22.3-alpine"
RED_CHATWOOT="chatwoot_interna"
RED_PRUEBA="dtd-cargo-staging_dtd_internal"
RED_PROHIBIDA="dtd-cargo_dtd_internal"
WEB_PRUEBA="dtd-cargo-staging-web-1"
ENV_FILE="${PUENTE_ENV_FILE:-/etc/dtd-cable/puente-prueba.env}"
ESTADO_DIR="${PUENTE_ESTADO_DIR:-/var/lib/dtd-cable/puente-prueba}"
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
CODIGO="${HERE}/puente-prueba.mjs"

die() { echo "puente-prueba: $*" >&2; exit 2; }
refuse() { echo "puente-prueba: RECHAZADO · $*" >&2; exit 3; }

guardas() {
  [[ "$(id -u)" == "0" ]] || refuse "corre como root"
  [[ -f "${CODIGO}" ]] || refuse "no está ${CODIGO}"
  [[ -f "${ENV_FILE}" ]] || refuse "no existe ${ENV_FILE}"
  [[ "$(stat -c '%a %U' "${ENV_FILE}")" == "600 root" ]] || refuse "${ENV_FILE} tiene que ser root 600"
  grep -q '^CHATWOOT_API_TOKEN=.\{16,\}' "${ENV_FILE}" || refuse "falta CHATWOOT_API_TOKEN en ${ENV_FILE}"
  grep -q '^OFICINA_WEBHOOK_SECRET=.\{32,\}' "${ENV_FILE}" || refuse "falta OFICINA_WEBHOOK_SECRET en ${ENV_FILE}"
  # El destino es SOLO el web de prueba: tiene que existir y estar en la red de prueba.
  docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${WEB_PRUEBA}" 2>/dev/null \
    | grep -qw "${RED_PRUEBA}" || refuse "${WEB_PRUEBA} no está en ${RED_PRUEBA}"
  # En la red de prueba, «web» tiene que ser el web de prueba y nadie más.
  local webs
  webs="$(docker network inspect "${RED_PRUEBA}" -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -c -- '-web-')"
  [[ "${webs}" == "1" ]] || refuse "en ${RED_PRUEBA} hay ${webs} contenedores web (se espera solo ${WEB_PRUEBA})"
  docker network inspect "${RED_CHATWOOT}" > /dev/null 2>&1 || refuse "no existe la red ${RED_CHATWOOT}"
  # En la red de Chatwoot no puede haber ningún web (ni de prueba ni de producción).
  local webs_cw
  webs_cw="$(docker network inspect "${RED_CHATWOOT}" -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -c -- '-web-')"
  [[ "${webs_cw}" == "0" ]] || refuse "en ${RED_CHATWOOT} hay ${webs_cw} contenedores web (se espera ninguno)"
}

redes_ok() {
  local redes
  redes="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$1" 2>/dev/null)"
  for r in ${redes}; do
    [[ "${r}" == "${RED_CHATWOOT}" || "${r}" == "${RED_PRUEBA}" ]] || return 1
    [[ "${r}" != "${RED_PROHIBIDA}" ]] || return 1
  done
  return 0
}

crear() { # $1 nombre, $2 extra (vacío o PUENTE_UNA_VUELTA=1)
  local extra=()
  [[ -n "${2-}" ]] && extra=(-e "$2")
  install -d -m 700 -o 1000 -g 1000 "${ESTADO_DIR}"
  docker create --name "$1" --restart no --read-only --cap-drop ALL --security-opt no-new-privileges \
    --user 1000:1000 --memory 128m --pids-limit 64 --stop-timeout 1 --log-opt max-size=1m --log-opt max-file=2 \
    --network "${RED_CHATWOOT}" --env-file "${ENV_FILE}" -e PUENTE_ENTORNO=prueba "${extra[@]}" \
    -v "${CODIGO}:/app/puente.mjs:ro" -v "${ESTADO_DIR}:/estado" \
    --label dtd.cable=puente-prueba --label dtd.sdd=0626 \
    "${IMAGEN}" node /app/puente.mjs > /dev/null || return 1
  docker network connect "${RED_PRUEBA}" "$1" || { docker rm -f "$1" > /dev/null 2>&1; return 1; }
  redes_ok "$1" || { docker rm -f "$1" > /dev/null 2>&1; refuse "el contenedor quedó en una red no permitida"; }
}

case "${1-}" in
  arrancar)
    guardas
    docker inspect "${NOMBRE}" > /dev/null 2>&1 && refuse "ya existe ${NOMBRE} (primero: $0 parar)"
    crear "${NOMBRE}" "" || { echo "puente-prueba: docker falló al crear" >&2; exit 5; }
    docker start "${NOMBRE}" > /dev/null || exit 5
    sleep 2
    echo "puente-prueba: arrancado · $(docker inspect -f '{{.State.Status}}' "${NOMBRE}")"
    docker logs --tail 5 "${NOMBRE}" 2>&1
    ;;
  parar)
    if docker inspect "${NOMBRE}" > /dev/null 2>&1; then
      docker stop -t 1 "${NOMBRE}" > /dev/null 2>&1
      if docker rm -f "${NOMBRE}" > /dev/null && ! docker inspect "${NOMBRE}" > /dev/null 2>&1; then
        echo "puente-prueba: parado y borrado (el cursor queda en ${ESTADO_DIR})"
      else
        echo "puente-prueba: FALLÓ borrar ${NOMBRE}; sigue existiendo (docker ps -a --filter name=${NOMBRE})" >&2
        exit 5
      fi
    else
      echo "puente-prueba: no estaba corriendo"
    fi
    ;;
  estado)
    if docker inspect "${NOMBRE}" > /dev/null 2>&1; then
      docker inspect -f 'estado={{.State.Status}} desde={{.State.StartedAt}} redes={{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${NOMBRE}"
      docker logs --tail 20 "${NOMBRE}" 2>&1
    else
      echo "puente-prueba: no existe ${NOMBRE}"
    fi
    echo "cursor: $(cat "${ESTADO_DIR}/cursor" 2>/dev/null || echo '-')"
    ;;
  una-vuelta)
    guardas
    n="${NOMBRE}-vuelta"
    docker rm -f "${n}" > /dev/null 2>&1
    crear "${n}" "PUENTE_UNA_VUELTA=1" || exit 5
    docker start -a "${n}"; rc=$?
    docker rm -f "${n}" > /dev/null 2>&1 || echo "puente-prueba: FALLÓ borrar ${n}" >&2
    exit "${rc}"
    ;;
  *) die "uso: $0 arrancar|parar|estado|una-vuelta" ;;
esac
