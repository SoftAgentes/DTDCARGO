#!/usr/bin/env bash
# infra/ops/backup/new-age-key.sh — crea la llave de cifrado de los respaldos con Sam (SDD-0505).
#
# Los dumps se cifran con `age` para una clave PÚBLICA que vive en el servidor
# (age-recipients.txt); la PRIVADA la guarda Sam fuera del servidor (gestor de
# contraseñas y papel). Sin la privada, ningún respaldo se puede abrir: ni un
# ladrón del servidor o del bucket, ni nosotros.
#
# Qué hace, en este orden:
#   1. Genera el par en /dev/shm (memoria): nunca toca el disco.
#   2. Muestra la clave PRIVADA una sola vez, para que Sam la guarde.
#   3. Pide que Sam la PEGUE de vuelta (sin eco) y la compara: así se sabe que la
#      guardó completa. Si no coincide, deja intentarlo otra vez.
#   4. Recién entonces agrega la clave PÚBLICA a age-recipients.txt (600) y borra
#      el par de /dev/shm.
#   5. Limpia la pantalla y el historial de tmux: la privada no queda en el
#      scrollback.
#
# Uso (como root en el VPS, dentro de tmux):
#   new-age-key.sh [--destinatarios /srv/ops/backup/age-recipients.txt] [--nombre "Sam 2026-10"]
#
# Códigos: 0 listo · 2 uso inválido o la clave no se guardó (no se agrega nada).
set -euo pipefail
umask 077

DEST="/srv/ops/backup/age-recipients.txt"
NOMBRE="Sam $(date -u +%Y-%m)"
usage() { sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "new-age-key: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --destinatarios) setopt DEST "${2-}"; shift 2 ;;
    --nombre) setopt NOMBRE "${2-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done
command -v age-keygen >/dev/null || die "falta age (apt-get install age)"

tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then tty_in=/dev/tty; fi
log() { printf '%s\n' "$*"; }
# shellcheck source=../lib/prompt.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/prompt.sh"

work="$(mktemp -d /dev/shm/age-key-XXXXXX)"
limpiar_pantalla() {
  if [[ -n "${TMUX:-}" ]]; then clear; tmux clear-history 2>/dev/null || true; fi
}
# Si se corta mientras la privada está en pantalla, se limpia igual; al terminar
# bien no, para que se vea el resultado.
en_pantalla=0
trap 'rm -rf -- "${work}"; (( en_pantalla )) && limpiar_pantalla; pause_in_tmux' EXIT

age-keygen -o "${work}/llave.txt" 2>/dev/null
PRIVADA="$(grep '^AGE-SECRET-KEY-' "${work}/llave.txt")"
PUBLICA="$(age-keygen -y "${work}/llave.txt")"
en_pantalla=1

cat <<EOF

══════════════════════════════════════════════════════════════════════
  TU LLAVE PRIVADA DE LOS RESPALDOS (se muestra UNA sola vez)
══════════════════════════════════════════════════════════════════════

${PRIVADA}

  1. Cópiala COMPLETA (empieza con AGE-SECRET-KEY- y es una sola línea).
  2. Guárdala en tu gestor de contraseñas con el nombre:
       «DTD Cargo · llave de respaldos (age)»
  3. Recomendado: escríbela también en papel y guárdalo en un lugar seguro.

  Sin esta llave NADIE puede abrir los respaldos, ni siquiera tú.
  No la mandes por chat ni por correo.
══════════════════════════════════════════════════════════════════════

EOF
read -r -p "Cuando la hayas guardado, pulsa Enter para comprobarla. " _ < "${tty_in}" || die "no hubo respuesta"
limpiar_pantalla
en_pantalla=0
problem=""
for (( try = 1; ; try++ )); do
  ask_secret "Pega aquí la llave que guardaste (no se ve al pegar), para comprobarla: " VUELTA \
    || die "${problem:-no llegó la llave}"
  if [[ "${VUELTA}" == "${PRIVADA}" ]]; then
    log "La llave guardada coincide: perfecto."
    break
  fi
  problem="la llave pegada no coincide con la generada ($(describe_input "${VUELTA}")): revisa que la copiaste entera, de AGE-SECRET-KEY- hasta el final"
  retry_or_die "${try}" "${problem}" "Abre la llave que guardaste, cópiala entera y pégala de nuevo"
done
unset VUELTA PRIVADA

install -d -m 700 "$(dirname "${DEST}")"
[[ -f "${DEST}" ]] || install -m 600 /dev/null "${DEST}"
grep -qF "${PUBLICA}" "${DEST}" || printf '# %s · creada %s\n%s\n' "${NOMBRE}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${PUBLICA}" >> "${DEST}"
chmod 600 "${DEST}"
log "Listo: la clave PÚBLICA quedó en ${DEST}. La privada ya no está en el servidor."
log "Huella de la pública: $(printf '%s' "${PUBLICA}" | sha256sum | cut -c1-16)"
