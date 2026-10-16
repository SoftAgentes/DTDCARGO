# infra/ops/staging/lib-prueba.sh — piezas comunes de crear, resetear y desplegar prueba (SDD-0540).
#
# Se carga con `source` desde crear-prueba.sh, resetear-base-prueba.sh y
# desplegar-prueba.sh. Define las guardas (proyecto, carpeta e imagen), el
# compose con los tres archivos, la espera de contenedores y el smoke de la
# puerta del web. Quien lo carga define antes `die`, `refuse` y `log`.

PRUEBA_IMAGE_REPO="ghcr.io/hailuwaycom-sketch/dtdcargo"
PRUEBA_PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

# El proyecto: nunca producción y siempre `*-staging` (lo que habilita las
# guardas de destroy-staging.sh y de los imports).
prueba_guarda_proyecto() { # $1 proyecto
  [[ "$1" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '$1'"
  [[ "$1" != "${PRUEBA_PROD_PROJECT}" ]] || refuse "$1 es el proyecto de producción"
  [[ "$1" == *-staging ]] || refuse "$1 no termina en -staging: estos scripts solo tocan prueba"
}

# La carpeta del proyecto: `*-staging`, nunca la de producción ni una raíz.
prueba_guarda_carpeta() { # $1 carpeta
  case "$1" in
    ""|/|/srv|/srv/"${PRUEBA_PROD_PROJECT}"|/srv/"${PRUEBA_PROD_PROJECT}"/*) refuse "--project-dir '$1' es producción o una raíz" ;;
  esac
  [[ "$1" == *-staging ]] || refuse "--project-dir $1 no termina en -staging"
}

# La imagen: solo `prueba-sha-<40 hex>` del repo de la casa y, si se da el SHA,
# exactamente la de ese SHA. Nunca `sha-*` ni `:main` (son de producción).
prueba_guarda_imagen() { # $1 imagen, $2 sha (opcional)
  local re="^${PRUEBA_IMAGE_REPO//./\\.}:prueba-sha-[0-9a-f]{40}\$"
  [[ "$1" =~ ${re} ]] || refuse "la imagen tiene que ser ${PRUEBA_IMAGE_REPO}:prueba-sha-<40 hex>, no '$1'"
  if [[ -n "${2-}" ]]; then
    [[ "$1" == "${PRUEBA_IMAGE_REPO}:prueba-sha-$2" ]] || refuse "la imagen no es la del SHA ${2:0:12}: '$1'"
  fi
}

prueba_guarda_sha() { # $1 sha
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || die "--sha tiene que ser el SHA completo (40 hex): '$1'"
}

# Compose con los tres archivos y el nombre de proyecto, desde su carpeta (el
# .env de la carpeta alimenta la interpolación).
prueba_compose() { # usa PROJECT y PROJECT_DIR
  ( cd "${PROJECT_DIR}" && docker compose -p "${PROJECT}" -f compose.yml -f compose.supabase.yml -f compose.staging.yml "$@" )
}

# Espera a que la base acepte consultas ESTABLE: la imagen reinicia Postgres al
# terminar su initdb, así que se piden cinco lecturas seguidas del rol
# supabase_admin (mismo criterio que scripts/check-schema-rebuild.mjs).
prueba_esperar_base() { # $1 contenedor, $2 segundos (180)
  local i racha=0 max="${2:-180}"
  for (( i = 0; i < max; i++ )); do
    if docker exec "$1" psql -U postgres -d postgres -X -Atc "select 1 from pg_roles where rolname = 'supabase_admin'" 2>/dev/null | grep -qx 1; then
      racha=$((racha + 1)); (( racha >= 5 )) && return 0
    else
      racha=0
    fi
    sleep "${PRUEBA_ESPERA_PASO:-1}"
  done
  return 1
}

# Espera el healthcheck de un contenedor.
prueba_esperar_sano() { # $1 contenedor, $2 segundos (180)
  local i estado max="${2:-180}"
  for (( i = 0; i < max; i += 2 )); do
    estado="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null)"
    [[ "${estado}" == "healthy" || "${estado}" == "running" ]] && return 0
    sleep "${PRUEBA_ESPERA_PASO:-2}"
  done
  return 1
}

# Reemplaza (o agrega) una variable sin comillas en el .env, por copia 600 + mv.
prueba_fijar_env() { # $1 archivo, $2 nombre, $3 valor (sin comillas ni espacios)
  local tmp
  [[ "$2" =~ ^[A-Z_][A-Z0-9_]*$ && "$3" =~ ^[A-Za-z0-9:/._@-]+$ ]] || die "valor inválido para $2"
  tmp="$(mktemp "$1.XXXXXX")"; chmod 600 "${tmp}"
  N_="$2" V_="$3" awk '
    BEGIN { n = ENVIRON["N_"]; v = ENVIRON["V_"]; hecho = 0 }
    index($0, n "=") == 1 { if (!hecho) { print n "=" v; hecho = 1 }; next }
    { print }
    END { if (!hecho) print n "=" v }
  ' "$1" > "${tmp}"
  mv -f -- "${tmp}" "$1"
}

# Smoke de la puerta, sin datos: el web pide clave, con la clave responde, los
# dos hosts mandan `noindex` y la API sin `apikey` responde 401. La clave sale de
# secretos/clave-web.txt y viaja a curl en un archivo de configuración 600, nunca
# por argumentos. Imprime una línea PASÓ/FALLÓ por punto y devuelve 1 si falló algo.
prueba_smoke_puerta() { # $1 host del web, $2 host de la API, $3 IP, $4 archivo usuario:clave
  local web="$1" api="$2" ip="$3" cred="$4" cfg c h mal=0
  [[ -f "${cred}" ]] || { echo "FALLÓ · falta ${cred} (clave-web-prueba.sh)"; return 1; }
  cfg="$(mktemp)"; chmod 600 "${cfg}"
  printf 'user = "%s"\n' "$(head -n1 "${cred}")" > "${cfg}"
  pedir() { curl -s --max-time 30 --resolve "${web}:443:${ip}" --resolve "${api}:443:${ip}" "$@"; }

  c="$(pedir -o /dev/null -w '%{http_code}' "https://${web}/")"
  [[ "${c}" == 401 ]] && echo "PASÓ  · ${web}/ sin clave → 401" || { echo "FALLÓ · ${web}/ sin clave → ${c} (esperado 401)"; mal=1; }
  for p in / /studio/login /correo/; do
    c="$(pedir -K "${cfg}" -o /dev/null -w '%{http_code}' "https://${web}${p}")"
    [[ "${c}" == 200 ]] && echo "PASÓ  · ${web}${p} con clave → 200" || { echo "FALLÓ · ${web}${p} con clave → ${c} (esperado 200)"; mal=1; }
  done
  h="$(pedir -K "${cfg}" -o /dev/null -D - "https://${web}/" | tr -d '\r' | grep -i '^x-robots-tag:' || true)"
  [[ "${h,,}" == *noindex* ]] && echo "PASÓ  · ${web} manda X-Robots-Tag: noindex" || { echo "FALLÓ · ${web} sin X-Robots-Tag noindex"; mal=1; }
  c="$(pedir -o /dev/null -w '%{http_code}' "https://${api}/auth/v1/health")"
  [[ "${c}" == 401 ]] && echo "PASÓ  · ${api}/auth/v1/health sin apikey → 401" || { echo "FALLÓ · ${api}/auth/v1/health sin apikey → ${c} (esperado 401)"; mal=1; }
  h="$(pedir -o /dev/null -D - "https://${api}/auth/v1/health" | tr -d '\r' | grep -i '^x-robots-tag:' || true)"
  [[ "${h,,}" == *noindex* ]] && echo "PASÓ  · ${api} manda X-Robots-Tag: noindex" || { echo "FALLÓ · ${api} sin X-Robots-Tag noindex"; mal=1; }
  rm -f -- "${cfg}"
  return "${mal}"
}

# Lee una variable del .env sin `source` (sin las comillas de afuera).
prueba_env_valor() { # $1 archivo, $2 nombre
  local v
  v="$(grep -E "^$2=" "$1" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  v="${v#\'}"; v="${v%\'}"; v="${v#\"}"; v="${v%\"}"
  printf '%s' "${v}"
}
