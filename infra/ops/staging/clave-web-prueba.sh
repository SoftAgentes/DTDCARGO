#!/usr/bin/env bash
# infra/ops/staging/clave-web-prueba.sh — clave de la puerta del web de prueba (SDD-0540, D4).
#
# Genera en el servidor una clave aleatoria para un usuario, calcula su bcrypt con
# pgcrypto en la base de PRUEBA (`<proyecto>-db-1`: la imagen ya está en el VPS y
# no hace falta instalar htpasswd) y la guarda:
#   · PRUEBA_WEB_USUARIOS en el .env, entre comillas simples (compose no
#     interpola `$` ahí), `usuario:$2a$10$…`; los otros usuarios se conservan;
#   · usuario:clave en <project-dir>/secretos/clave-web.txt (600), para que Sam la
#     copie a su gestor y para el smoke de desplegar-prueba.sh.
# La clave viaja a psql por la entrada estándar, nunca por argumentos, y el script
# no la imprime. Después hay que recrear web y mailpit para que Traefik lea la
# etiqueta nueva (el script lo recuerda; no lo hace solo).
#
# Uso (en el VPS):
#   clave-web-prueba.sh --project dtd-cargo-staging [--project-dir /srv/dtd-cargo-staging] [--usuario sam]
#
# Códigos: 0 listo · 2 uso inválido · 3 rechazado por la guarda · 4 no se pudo calcular el bcrypt.
set -euo pipefail
umask 077

PROJECT=""
PROJECT_DIR=""
USUARIO="sam"
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

die() { echo "clave-web-prueba: $*" >&2; exit 2; }
refuse() { echo "clave-web-prueba: RECHAZADO · $*" >&2; exit 3; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --usuario) setopt USUARIO "${2-}"; shift 2 ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${PROJECT}" != "${PROD_PROJECT}" ]] || refuse "${PROJECT} es producción"
[[ "${PROJECT}" == *-staging ]] || refuse "${PROJECT} no termina en -staging"
[[ "${USUARIO}" =~ ^[a-z0-9._-]{2,32}$ ]] || die "--usuario inválido: '${USUARIO}' (minúsculas, números, . _ -)"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
PROJECT_DIR="${PROJECT_DIR%/}"
[[ "${PROJECT_DIR}" == *-staging ]] || refuse "--project-dir ${PROJECT_DIR} no es un directorio de prueba"
ENV_FILE="${PROJECT_DIR}/.env"
[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE} (primero env-prueba.sh)"
DB="${PROJECT}-db-1"
[[ "$(docker inspect -f '{{.State.Running}}' "${DB}" 2>/dev/null)" == "true" ]] || die "el contenedor ${DB} no está corriendo: el bcrypt se calcula en la base de prueba"

clave="$(openssl rand -hex 16)"
hash="$(printf '%s\n' '\set ON_ERROR_STOP on' "\\set clave '${clave}'" \
  "select extensions.crypt(:'clave', extensions.gen_salt('bf', 10));" \
  | docker exec -i "${DB}" psql -U postgres -d postgres -X -At 2>/dev/null | tail -n1 || true)"
[[ "${hash}" =~ ^\$2[aby]\$10\$.{53}$ ]] || { unset clave; echo "clave-web-prueba: no pude calcular el bcrypt en ${DB}" >&2; exit 4; }

# Usuarios que ya estaban (sin el que se renueva ni el marcador inicial).
actual="$(grep -E '^PRUEBA_WEB_USUARIOS=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- || true)"
actual="${actual#\'}"; actual="${actual%\'}"
nuevos="${USUARIO}:${hash}"
IFS=',' read -r -a lista <<< "${actual}"
for u in ${lista[@]+"${lista[@]}"}; do
  case "${u}" in
    "${USUARIO}:"*|pendiente:*|"") ;;
    *) nuevos="${nuevos},${u}" ;;
  esac
done

tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
chmod 600 "${tmp}"
VALOR_="${nuevos}" awk '
  BEGIN { v = ENVIRON["VALOR_"]; hecho = 0 }
  /^PRUEBA_WEB_USUARIOS=/ { if (!hecho) { print "PRUEBA_WEB_USUARIOS=\047" v "\047"; hecho = 1 }; next }
  { print }
  END { if (!hecho) print "PRUEBA_WEB_USUARIOS=\047" v "\047" }
' "${ENV_FILE}" > "${tmp}"
mv -f -- "${tmp}" "${ENV_FILE}"

mkdir -p -m 700 -- "${PROJECT_DIR}/secretos"
cred="${PROJECT_DIR}/secretos/clave-web.txt"
{
  [[ -f "${cred}" ]] && grep -v "^${USUARIO}:" "${cred}" || true
  printf '%s:%s\n' "${USUARIO}" "${clave}"
} > "${cred}.tmp"
chmod 600 "${cred}.tmp"
mv -f -- "${cred}.tmp" "${cred}"
unset clave hash

echo "clave-web-prueba: clave nueva para «${USUARIO}» (bcrypt en PRUEBA_WEB_USUARIOS; la clave en ${cred}, 600)"
echo "clave-web-prueba: usuarios en la puerta: $(tr ',' '\n' <<< "${nuevos}" | cut -d: -f1 | tr '\n' ' ')"
echo "clave-web-prueba: para que Traefik la lea: docker compose -p ${PROJECT} -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps --force-recreate web mailpit"
