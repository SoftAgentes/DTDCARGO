#!/usr/bin/env bash
# infra/ops/kommo-historial/pegar-token.sh — SDD-0590 (E5): Sam pega el token de larga duración de la
# integración de Kommo «DTD 0582 historial (solo lectura)» en una ventana tmux del VPS.
#
# Desde PowerShell, con la terminal ancha:
#   C:\Windows\System32\OpenSSH\ssh.exe -t root@217.216.54.70 tmux new -A -s token-kommo "bash /srv/ops/kommo-historial/pegar-token.sh"
#
# El token no se ve al pegarlo, no va en argv ni al log, y queda SOLO en la RAM del servidor
# (/dev/shm/k0582-e5, 0600). Después se comprueba con `probar-token`, que muestra largo, alcances, días de
# vigencia y si entra a la cuenta. Nunca el token.
#
# Lo aprendido en las ventanas de claves (SDD-0505): Ctrl+C no copia aquí, así que se ignora; las flechas
# y las marcas de pegado entran como texto, y `trim` de ../lib/prompt.sh las quita; dentro de tmux la
# ventana espera un Enter antes de cerrarse.
set -uo pipefail

AQUI="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
DESTINO="${KOMMO_TOKEN_FILE:-/dev/shm/k0582-e5}"
tty_in="${TTY_IN:-/dev/tty}"
log() { echo "$*"; }
die() { echo "✗ $*"; exit 1; }
# shellcheck source=../lib/prompt.sh
source "${PROMPT_LIB:-${AQUI}/../lib/prompt.sh}" || { echo "✗ falta lib/prompt.sh"; exit 1; }
trap '' INT
trap pause_in_tmux EXIT

echo "Kommo → Ajustes → Integraciones → «DTD 0582 historial (solo lectura)» → Claves y alcances"
echo "→ Token de larga duración → Generar → Copiar. Aquí no uses Ctrl+C: se ignora."
intento=1
while :; do
  ask_secret "Pega el token (no se verá) y pulsa Enter: " T || die "no hay terminal para leer el token"
  # Un token de larga duración de Kommo es un JWT: tres partes separadas por puntos, y largo.
  if (( ${#T} >= 200 )) && [[ "${T}" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    break
  fi
  retry_or_die "${intento}" "no parece el token: $(describe_input "${T}")" "Vuelve a copiarlo desde Kommo"
  intento=$(( intento + 1 ))
done

umask 077
printf '%s' "${T}" > "${DESTINO}"
unset T
chmod 600 "${DESTINO}"
echo "Guardado en la RAM del servidor (${DESTINO}, 0600)."
if [[ "${PROBAR:-1}" == "1" ]]; then
  echo "Lo compruebo sin mostrarlo:"
  python3 -I "${AQUI}/respaldar-historial.py" probar-token --token-file "${DESTINO}"
fi
