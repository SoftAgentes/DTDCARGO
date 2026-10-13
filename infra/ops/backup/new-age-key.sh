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
# Ctrl+C no cancela hasta que la llave queda guardada: en la terminal significa
# «cancelar», no «copiar». El 2026-10-12 la ventana se cerró dos veces con la
# llave en pantalla, muy probablemente por un Ctrl+C para copiarla. Ahora avisa
# cómo copiar o pegar y sigue esperando; para cancelar de verdad se cierra la
# ventana. Si se corta sin guardar, lo dice al final de la pantalla limpia.
#
# Uso (como root en el VPS, dentro de tmux):
#   new-age-key.sh [--destinatarios /srv/ops/backup/age-recipients.txt] [--nombre "Sam 2026-10"]
#
# Códigos: 0 listo · 2 uso inválido o la clave no se guardó (no se agrega nada).
set -euo pipefail
umask 077

DEST="/srv/ops/backup/age-recipients.txt"
NOMBRE="Sam $(date -u +%Y-%m)"
usage() { sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
# Con el trap de salida armado, el motivo lo imprime el trap: la limpieza de
# pantalla borraría un error impreso aquí.
armado=0
motivo=""
die() { motivo="$*"; (( armado )) || echo "new-age-key: $*" >&2; exit 2; }
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
guardada=0
al_salir() {
  trap - INT
  rm -rf -- "${work}"
  if (( en_pantalla )); then limpiar_pantalla; fi
  if (( ! guardada )); then
    echo
    echo "✗ La llave NO se guardó${motivo:+: ${motivo}}."
    echo "  Esa llave ya no sirve: si alcanzaste a guardarla, bórrala."
    echo "  Para generar otra, vuelve a abrir esta ventana."
  fi
  pause_in_tmux
}
trap al_salir EXIT
armado=1

# Ctrl+C no corta `read`: el trap avisa y la pregunta sigue esperando. Al pegar,
# la terminal descarta lo que estaba a medio escribir.
etapa=copiar
aviso_ctrl_c() {
  echo
  echo "  Ctrl+C aquí no copia: en la terminal significa «cancelar», y lo dejé sin efecto."
  if [[ "${etapa}" == copiar ]]; then
    echo "  Para copiar: selecciona la línea con el ratón y pulsa Ctrl+Shift+C (o clic derecho → Copiar)."
    echo "  Cuando la hayas guardado, pulsa Enter."
  else
    echo "  Para pegar: Ctrl+Shift+V o clic derecho. Lo que habías pegado se borró:"
    echo "  pega la llave otra vez y pulsa Enter."
  fi
}
trap aviso_ctrl_c INT

age-keygen -o "${work}/llave.txt" 2>/dev/null
PRIVADA="$(grep '^AGE-SECRET-KEY-' "${work}/llave.txt")"
PUBLICA="$(age-keygen -y "${work}/llave.txt")"
en_pantalla=1

cat <<EOF

══════════════════════════════════════════════════════════════════════
  TU LLAVE PRIVADA DE LOS RESPALDOS (se muestra UNA sola vez)
══════════════════════════════════════════════════════════════════════

${PRIVADA}

  1. Cópiala COMPLETA (empieza con AGE-SECRET-KEY- y es una sola línea):
     selecciónala con el ratón y pulsa Ctrl+Shift+C (Ctrl+C sin Shift no copia).
  2. Guárdala en tu gestor de contraseñas con el nombre:
       «DTD Cargo · llave de respaldos (age)»
  3. Recomendado: escríbela también en papel y guárdalo en un lugar seguro.

  Sin esta llave NADIE puede abrir los respaldos, ni siquiera tú.
  No la mandes por chat ni por correo.
══════════════════════════════════════════════════════════════════════

EOF
read -r -p "Cuando la hayas guardado, pulsa Enter para comprobarla. " _ < "${tty_in}" \
  || die "se cortó antes de comprobar la llave"
limpiar_pantalla
en_pantalla=0
etapa=pegar
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
guardada=1
trap - INT
log "Listo: la clave PÚBLICA quedó en ${DEST}. La privada ya no está en el servidor."
log "Huella de la pública: $(printf '%s' "${PUBLICA}" | sha256sum | cut -c1-16)"
