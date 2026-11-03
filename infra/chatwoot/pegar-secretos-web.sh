#!/usr/bin/env bash
# SDD-0585 (E2) y SDD-0586 (E10): recibe los 3 secretos de Chatwoot para el contenedor `web`
# de DTD y los escribe en el .env del entorno. Se corre en el VPS:
#   bash /srv/chatwoot/pegar-secretos-web.sh prueba|produccion [NOMBRE...]
#
# Cada secreto se pega sin eco, o con Enter se toma del servidor sin mostrarlo. Solo muestra
# nombre, largo y sha256 corto. Solo escribe una variable que falta o está vacía. No corre
# sin la 0505 en el ledger de ese entorno, y no recrea contenedores: eso va aparte.
#
# Códigos: 0 listo · 2 uso inválido · 3 falta la 0505 o el .env · 4 un valor no sirve, sin
# escribir nada · 5 quedó alguno sin cargar (por ejemplo, el webhook todavía no existe).
set -euo pipefail
shopt -s extglob

ENTORNO="${1:-}"
[ $# -gt 0 ] && shift
case "$ENTORNO" in
  produccion) ENV_WEB=/srv/dtd-cargo/.env; DB=dtd-cargo-db-1; SITIO=https://dtdcargo.com ;;
  prueba) ENV_WEB=/srv/dtd-cargo-staging/.env; DB=dtd-cargo-staging-db-1; SITIO=https://prueba.dtdcargo.com ;;
  *) echo "Uso: $0 prueba|produccion [NOMBRE...]" >&2; exit 2 ;;
esac
# Solo para su prueba: infra/chatwoot/pruebas/prueba-pegar-secretos-web.sh.
ENV_WEB="${PEGAR_ENV_WEB:-$ENV_WEB}"
PLATFORM_ENV="${PEGAR_PLATFORM_ENV:-/srv/chatwoot/secretos/platform-app.env}"
URL_WEBHOOK="$SITIO/api/chatwoot/webhook"
TODOS=(CHATWOOT_PLATFORM_TOKEN CHATWOOT_ROUTER_TOKEN CHATWOOT_WEBHOOK_SECRET)
MAX_INTENTOS=3

NOMBRES=("$@")
[ ${#NOMBRES[@]} -gt 0 ] || NOMBRES=("${TODOS[@]}")
for n in "${NOMBRES[@]}"; do
  case " ${TODOS[*]} " in
    *" $n "*) ;;
    *) echo "No conozco $n. Son: ${TODOS[*]}" >&2; exit 2 ;;
  esac
done

[ -f "$ENV_WEB" ] || { echo "No existe $ENV_WEB: no toco nada." >&2; exit 3; }
HAY_0505=$(docker exec "$DB" psql -U postgres -d postgres -X -At -c \
  "select count(*) from supabase_migrations.schema_migrations where name = '0505_chatwoot_segmento'" 2>/dev/null || echo 0)
if [ "$HAY_0505" != "1" ]; then
  echo "La 0505 no está aplicada en $ENTORNO: estas variables van después de ella. No toco nada." >&2
  exit 3
fi

# Quita \r, espacios de los extremos y lo que mete la terminal: marcas de pegado y flechas
# (infra/ops/lib/prompt.sh). `read -s` no usa readline, así que llegan como texto.
limpiar() {
  local s="$1"
  s="${s//$'\e'\[*([0-9;:<=>?])*([ !-\/])[@-~]/}"
  s="${s//$'\e'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Toma el valor del servidor. Sale vacío si no se pudo. Nunca lo muestra.
de_rails() { # $1 = código Ruby que imprime el valor
  docker exec chatwoot-rails-1 bundle exec rails runner "print 'DTDVALOR=' + ($1).to_s" 2>/dev/null \
    | sed -n 's/.*DTDVALOR=//p' | tail -n 1
}
del_archivo() { # $1 = nombre
  sed -n "s/^$1=//p" "$PLATFORM_ENV" 2>/dev/null | head -n 1 | tr -d "'\""
}
del_servidor() {
  case "$1" in
    CHATWOOT_PLATFORM_TOKEN) del_archivo CHATWOOT_PLATFORM_TOKEN ;;
    CHATWOOT_ROUTER_TOKEN)
      local id
      id=$(del_archivo CHATWOOT_SERVICE_USER_ID)
      case "$id" in '' | *[!0-9]*) return 0 ;; esac
      de_rails "User.find($id).access_token.token"
      ;;
    CHATWOOT_WEBHOOK_SECRET) de_rails "Webhook.find_by!(url: '$URL_WEBHOOK').secret" ;;
  esac
}
huella() { printf '%s' "$1" | sha256sum | cut -c1-8; }

declare -A VALORES=()
SIN_CARGAR=()
for n in "${NOMBRES[@]}"; do
  if grep -q "^$n=." "$ENV_WEB"; then
    echo "$n ya tiene valor: no lo toco."
    continue
  fi
  intento=1
  while :; do
    v=""
    read -rs -p "Pega $n (no se ve), o Enter para tomarlo del servidor: " v || v=""
    echo
    v=$(limpiar "$v")
    desde="pegado"
    if [ -z "$v" ]; then
      desde="del servidor"
      echo "  Lo busco en el servidor; puede tardar un minuto..."
      v=$(del_servidor "$n" || true)
      if [ -z "$v" ]; then
        echo "  $n no está en el servidor. Si es el del webhook, créalo en Chatwoot y corre esto otra vez con ese nombre."
        SIN_CARGAR+=("$n")
        break
      fi
    fi
    if [[ "$v" =~ ^[A-Za-z0-9_-]{16,255}$ ]]; then
      VALORES[$n]="$v"
      echo "  $n: $desde, largo ${#v}, sha256 $(huella "$v")"
      break
    fi
    echo "  Eso no parece un token: llegaron ${#v} caracteres ($desde)."
    if [ "$intento" -ge "$MAX_INTENTOS" ]; then
      unset v VALORES
      echo "Son $MAX_INTENTOS intentos con $n. No escribí nada." >&2
      exit 4
    fi
    intento=$((intento + 1))
  done
done
unset v

if [ ${#VALORES[@]} -gt 0 ]; then
  umask 077
  TMP=$(mktemp /dev/shm/dtd-env.XXXXXX 2>/dev/null || mktemp)
  trap 'rm -f "$TMP"' EXIT
  while IFS= read -r linea || [ -n "$linea" ]; do
    nombre="${linea%%=*}"
    if [ "$linea" = "$nombre=" ] && [ -n "${VALORES[$nombre]:-}" ]; then
      printf "%s='%s'\n" "$nombre" "${VALORES[$nombre]}"
      unset "VALORES[$nombre]"
    else
      printf '%s\n' "$linea"
    fi
  done < "$ENV_WEB" > "$TMP"
  for n in "${!VALORES[@]}"; do printf "%s='%s'\n" "$n" "${VALORES[$n]}" >> "$TMP"; done
  # cat > conserva el archivo, su dueño y sus permisos.
  cat "$TMP" > "$ENV_WEB"
  echo "Escrito en $ENV_WEB. `web` los lee cuando se recree; eso va aparte."
fi
unset VALORES

if [ ${#SIN_CARGAR[@]} -gt 0 ]; then
  echo "Quedó sin cargar: ${SIN_CARGAR[*]}" >&2
  exit 5
fi
