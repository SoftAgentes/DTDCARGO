#!/usr/bin/env bash
# infra/ops/migrate/env-set.sh — carga claves en el .env de un proyecto del VPS sin mostrarlas (SDD-0505).
#
# Para el día anterior al corte: las claves que hoy viven en Vercel (Resend,
# Telegram, VAPID, Anthropic…) y las de Supabase Cloud pasan al .env del servidor.
# Quien las pega es Sam; el script no las imprime nunca, ni las pone en argumentos
# (no quedan en `ps` ni en el historial).
#
# Modos:
#   --name VAR            una variable.
#   --integraciones       recorre las variables del bloque «Integraciones de la app»
#                         que siguen vacías en el .env; Enter deja una vacía.
#   --claves-supabase     JWT secret, anon key y service role key de Cloud. Comprueba
#                         que las dos keys están firmadas (HS256) con ese secreto y
#                         que sus roles son anon y service_role; recién entonces
#                         escribe JWT_SECRET, ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#                         SERVICE_ROLE_KEY y SUPABASE_SERVICE_ROLE_KEY. Con las mismas
#                         keys que hoy, las sesiones abiertas siguen valiendo.
#
# El .env se reescribe en un archivo temporal 600 y se mueve encima (nunca queda a
# medias). Los valores van entre comillas simples: compose no interpola `$` ahí.
# Un valor con comilla simple o salto de línea se rechaza.
#
# Uso (como root en el VPS):
#   env-set.sh --project dtd-cargo (--name VAR | --integraciones | --claves-supabase) [--project-dir /srv/dtd-cargo]
#
# Códigos: 0 listo · 2 uso inválido o dato rechazado.
set -euo pipefail
umask 077

PROJECT=""
PROJECT_DIR=""
MODE=""
NAME=""

usage() {
  sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}
log() { printf '%s\n' "$*"; }
die() { echo "env-set: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --name) MODE="name"; setopt NAME "${2-}"; shift 2 ;;
    --integraciones) MODE="integraciones"; shift ;;
    --claves-supabase) MODE="supabase"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ -n "${MODE}" ]] || die "falta el modo: --name VAR, --integraciones o --claves-supabase"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
ENV_FILE="${PROJECT_DIR}/.env"
[[ -f "${ENV_FILE}" ]] || die "no existe ${ENV_FILE} (primero infra/ops/staging/new-env.sh)"

tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then tty_in=/dev/tty; fi
# shellcheck source=../lib/prompt.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/prompt.sh"

has_var() { grep -qE "^${1}=" "${ENV_FILE}"; }
is_empty() { local v; v="$(grep -E "^${1}=" "${ENV_FILE}" | tail -n1 | cut -d= -f2-)"; [[ -z "${v}" || "${v}" == "''" || "${v}" == '""' ]]; }

# Escribe VAR='valor' reemplazando la línea (o agregándola) en una copia 600 y mv.
write_var() { # $1 = nombre, $2 = valor
  local name="$1" value="$2" tmp
  [[ "${name}" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "nombre de variable inválido: '${name}'"
  [[ "${value}" != *"'"* ]] || die "${name}: el valor trae una comilla simple; no se puede guardar literal en el .env"
  [[ "${value}" != *$'\n'* ]] || die "${name}: el valor trae saltos de línea"
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  chmod 600 "${tmp}"
  NAME_="${name}" VALUE_="${value}" awk '
    BEGIN { n = ENVIRON["NAME_"]; v = ENVIRON["VALUE_"]; done = 0 }
    index($0, n "=") == 1 { if (!done) { print n "=\x27" v "\x27"; done = 1 }; next }
    { print }
    END { if (!done) print n "=\x27" v "\x27" }
  ' "${ENV_FILE}" > "${tmp}"
  mv -f "${tmp}" "${ENV_FILE}"
}

ask_value() { # $1 = nombre, $2 = permitir vacío (1/0); deja el valor en VALUE
  local name="$1" allow_empty="$2" try problem=""
  VALUE=""
  for (( try = 1; ; try++ )); do
    ask_secret "${name} (no se ve al pegar$( (( allow_empty )) && echo '; Enter para dejarla vacía')): " VALUE \
      || die "${problem:-${name}: no llegó nada (fin de la entrada)}"
    if [[ -z "${VALUE}" ]]; then
      (( allow_empty )) && return 0
      problem="${name}: $(describe_input "")"
    elif [[ "${VALUE}" == *"'"* ]]; then
      problem="${name}: trae una comilla simple ('); revisa que copiaste solo el valor"
    else
      return 0
    fi
    retry_or_die "${try}" "${problem}" "Pega de nuevo SOLO el valor de ${name} y pulsa Enter"
  done
}

case "${MODE}" in
  name)
    [[ "${NAME}" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "--name inválido: '${NAME}'"
    has_var "${NAME}" || log "aviso: ${NAME} no está en ${ENV_FILE}; se agrega al final"
    ask_value "${NAME}" 0
    write_var "${NAME}" "${VALUE}"
    log "${NAME}: guardada (${#VALUE} caracteres)"
    ;;

  integraciones)
    # Variables del bloque «Integraciones de la app» del .env, en orden.
    mapfile -t vars < <(awk '
      /^# ── Integraciones de la app/ { on = 1; next }
      on && /^#{4,}/ { on = 0 }
      on && /^[A-Z_][A-Z0-9_]*=/ { split($0, a, "="); print a[1] }
    ' "${ENV_FILE}")
    (( ${#vars[@]} > 0 )) || die "no encontré el bloque «# ── Integraciones de la app» en ${ENV_FILE}"
    pendientes=()
    for v in "${vars[@]}"; do is_empty "${v}" && pendientes+=("${v}"); done
    log "${#pendientes[@]} de ${#vars[@]} variables de integración están vacías. Pega el valor de cada una, o Enter para dejarla vacía."
    guardadas=0
    for v in ${pendientes[@]+"${pendientes[@]}"}; do
      ask_value "${v}" 1
      if [[ -n "${VALUE}" ]]; then
        write_var "${v}" "${VALUE}"; guardadas=$((guardadas + 1))
        log "  ${v}: guardada (${#VALUE} caracteres)"
      else
        log "  ${v}: queda vacía"
      fi
    done
    log "listo: ${guardadas} guardadas"
    ;;

  supabase)
    command -v python3 >/dev/null || die "falta python3 para comprobar las firmas"
    ask_value "JWT secret de Supabase Cloud (Settings › JWT Keys › Legacy JWT secret)" 0; JWT="${VALUE}"
    ask_value "anon key (legacy) de Cloud" 0; ANON="${VALUE}"
    ask_value "service_role key (legacy) de Cloud" 0; SRK="${VALUE}"
    # La comprobación corre con los valores por entorno, nunca por argumento.
    resultado="$(JWT="${JWT}" ANON="${ANON}" SRK="${SRK}" python3 - <<'PY'
import base64, hashlib, hmac, json, os
def b64(s): return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
secret = os.environ["JWT"].encode()
out = []
for name, role in (("ANON", "anon"), ("SRK", "service_role")):
    tok = os.environ[name]
    parts = tok.split(".")
    if len(parts) != 3:
        out.append(f"{name}: no es un JWT (3 partes)"); continue
    try:
        head, body = json.loads(b64(parts[0])), json.loads(b64(parts[1]))
    except Exception:
        out.append(f"{name}: no se puede leer"); continue
    firma = base64.urlsafe_b64encode(hmac.new(secret, f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    if head.get("alg") != "HS256": out.append(f"{name}: alg {head.get('alg')} (se esperaba HS256)")
    elif not hmac.compare_digest(firma, parts[2]): out.append(f"{name}: la firma NO coincide con ese JWT secret")
    elif body.get("role") != role: out.append(f"{name}: role {body.get('role')} (se esperaba {role})")
    else: out.append(f"{name}: OK (role {role}, ref {body.get('ref', '-')})")
print("\n".join(out))
PY
)"
    log "${resultado}"
    [[ "$(grep -c ': OK ' <<< "${resultado}")" == "2" ]] || die "las claves no son coherentes: no se guardó nada"
    write_var JWT_SECRET "${JWT}"
    write_var ANON_KEY "${ANON}"
    write_var NEXT_PUBLIC_SUPABASE_ANON_KEY "${ANON}"
    write_var SERVICE_ROLE_KEY "${SRK}"
    write_var SUPABASE_SERVICE_ROLE_KEY "${SRK}"
    unset JWT ANON SRK VALUE
    log "listo: JWT_SECRET, ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE_ROLE_KEY y SUPABASE_SERVICE_ROLE_KEY guardadas"
    ;;
esac
pause_in_tmux
