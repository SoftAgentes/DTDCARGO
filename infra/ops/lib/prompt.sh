# infra/ops/lib/prompt.sh — pedir secretos por la terminal sin mostrarlos (SDD-0505).
#
# Se carga con `source`; no corre solo. Quien lo carga define antes `log`, `die` y
# `tty_in` (de dónde se lee: /dev/tty o /dev/stdin). Lo usa storage-from-cloud.sh;
# import-from-cloud.sh tiene todavía su propia copia (mismo comportamiento),
# pendiente de pasarlo a esta.
#
# Lo aprendido con Sam entre el 2026-10-09 y el 12, y que esto resuelve:
#   · Copiar del Bloc de notas puede arrastrar un \r final: se recorta.
#   · Un pegado vacío o con dos líneas no se nota con `read -s`: se dice qué llegó
#     (largo y forma), nunca el texto.
#   · Un dato que no sirve se vuelve a pedir (MAX_TRIES) en vez de empezar de cero.
#   · Dentro de tmux, la sesión se cierra al terminar: se espera un Enter.
# shellcheck disable=SC2034  # MAX_TRIES lo ajusta quien carga

MAX_TRIES="${MAX_TRIES:-3}"

# Quita espacios, tabuladores y \r de los extremos. Sin subprocesos: el valor no
# pasa por `ps`.
trim() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "${s}"
}

# Describe lo que llegó sin mostrar ningún secreto: largo y forma, nunca el texto.
describe_input() { # $1 = lo recibido
  local s="$1" d
  if [[ -z "${s}" ]]; then
    printf '%s' "no llegó nada: el pegado no entró (en la terminal de la app prueba Ctrl+Shift+V; en PowerShell del menú Inicio, clic derecho)"
    return
  fi
  d="llegaron ${#s} caracteres"
  [[ "${s}" =~ [[:space:]] ]] && d="${d}; tiene espacios o saltos de línea en el medio (¿se copiaron dos líneas?)"
  printf '%s' "${d}"
}

# Lee sin eco y recortado. Devuelve 1 si no hay más entrada (sin terminal o Ctrl+D).
ask_secret() { # $1 = pregunta, $2 = variable
  local v=""
  read -rs -p "$1" v < "${tty_in}" || { echo; return 1; }
  echo
  printf -v "$2" '%s' "$(trim "${v}")"
}

# Registra el problema y corta si ya se agotaron los intentos.
retry_or_die() { # $1 = intento, $2 = problema, $3 = qué hacer
  log "✗ intento $1: $2"
  (( $1 < MAX_TRIES )) || die "$2 (${MAX_TRIES} intentos)"
  echo "$3 (intento $(( $1 + 1 )) de ${MAX_TRIES})"
}

pause_in_tmux() {
  if [[ -n "${TMUX:-}" ]] && { : < /dev/tty; } 2>/dev/null; then
    read -r -p "Terminó. Revisa el resultado de arriba y pulsa Enter para cerrar. " _ < /dev/tty || true
  fi
}
