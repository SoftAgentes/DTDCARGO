#!/usr/bin/env bash
# infra/ops/web/guardar-webhook-discord.sh — guarda la dirección del webhook de
# #publicaciones en /srv/ops/web/publicar.env sin que pase por el chat (SDD-0609).
#
#   Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh
#   guardar-webhook-discord.sh [--config ARCHIVO] < pegado.txt     # (pruebas)
#
# La dirección llega por la ENTRADA ESTÁNDAR, no por una terminal. Pegar dentro
# de `ssh -t` desde la consola de Windows no llega bien a `read -s` (2026-11-05,
# oficina: la ventana recibía 122 caracteres y no los reconocía); mandar el
# portapapeles por stdin sí funcionó.
#
# Qué hace:
#   1. Busca la dirección DENTRO de lo pegado (se cuelan saltos de línea, comillas,
#      espacios o texto alrededor). Tiene que haber exactamente una.
#   2. La normaliza a https://discord.com/api/webhooks/<id>/<token>
#      (discordapp.com, ptb., canary. y /api/vN pasan a esa forma).
#   3. La valida contra Discord: GET al webhook. Tiene que responder 200 con
#      channel_id = 1567955265918079096 (#publicaciones) y el mismo id.
#   4. Respalda publicar.env como publicar.env.antes-0609-<fecha UTC> (600, en la
#      misma carpeta: lleva llaves), escribe PUBLICAR_DISCORD_WEBHOOK, quita las
#      líneas PUBLICAR_TELEGRAM_* (corte directo) y deja el archivo en 600 root.
#
# Imprime solo «GUARDADA» o «NO GUARDADA: <motivo>», con el largo y una huella
# sha256 corta. Nunca la dirección: no la recibe por argumentos, viaja a curl por
# stdin (-K -), curl corre con stderr a /dev/null y ningún mensaje la incluye.
# Salida: 0 guardada · 1 no guardada · 64 uso.
set -uo pipefail

CONFIG=/srv/ops/web/publicar.env
CANAL=1567955265918079096   # #publicaciones, categoría «Servidor» del servidor «DTD Cargo»
UA='DiscordBot (https://dtdcargo.com, 1.0)'

while [ $# -gt 0 ]; do
  case "$1" in
    --config) [ $# -ge 2 ] || { echo "uso: --config ARCHIVO"; exit 64; }; CONFIG="$2"; shift 2 ;;
    # Sin repetir el argumento: podría ser la dirección pegada donde no va.
    *) echo "argumento desconocido (${#1} caracteres): la dirección va por la entrada estándar, nunca como argumento"; exit 64 ;;
  esac
done

no() { echo "NO GUARDADA: $*"; exit 1; }
[ -t 0 ] && no "la dirección tiene que llegar por la entrada estándar (Get-Clipboard | ssh.exe …)"

PEGADO="$(head -c 65536)"
mapfile -t HALLADAS < <(printf '%s' "${PEGADO}" | tr -d '\r' \
  | grep -oE 'https://(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)/api(/v[0-9]{1,2})?/webhooks/[0-9]{17,20}/[A-Za-z0-9_-]{20,100}' \
  | sed -E 's#^https://[^/]+/api(/v[0-9]{1,2})?/webhooks/#https://discord.com/api/webhooks/#' | awk '!visto[$0]++')
unset PEGADO
case "${#HALLADAS[@]}" in
  0) no "lo pegado no trae la dirección de un webhook de Discord (¿se copió otra cosa?)" ;;
  1) ;;
  *) no "lo pegado trae ${#HALLADAS[@]} direcciones de webhook distintas: copia solo la de #publicaciones" ;;
esac
W="${HALLADAS[0]}"; unset HALLADAS
ID="$(printf '%s' "${W}" | sed -E 's#^https://discord\.com/api/webhooks/([0-9]+)/.*$#\1#')"
LARGO="${#W}"
HUELLA="$(printf '%s' "${W}" | sha256sum | cut -c1-12)"
que() { printf '%s caracteres · sha256 %s' "${LARGO}" "${HUELLA}"; }

T="$(mktemp -d)" || no "sin directorio temporal"
trap 'rm -rf "${T}"' EXIT
chmod 700 "${T}"

# GET al webhook: Discord responde el objeto del webhook (id, channel_id, guild_id…).
codigo="$(printf 'url = "%s"\n' "${W}" | curl -s -K - --connect-timeout 10 -m 20 -o "${T}/respuesta" -w '%{http_code}' -A "${UA}" 2>/dev/null)"
rc=$?
[ "${rc}" = 0 ] || no "no pude preguntarle a Discord (curl ${rc}); no se cambió nada · $(que)"
case "${codigo}" in
  200) ;;
  401|403|404) no "Discord no reconoce ese webhook (HTTP ${codigo}): ¿se borró o se copió incompleto? · $(que)" ;;
  429) no "Discord pide esperar (HTTP 429): repite en un minuto · $(que)" ;;
  *) no "Discord respondió HTTP ${codigo:-sin respuesta} · $(que)" ;;
esac
canal="$(grep -oE '"channel_id"[[:space:]]*:[[:space:]]*"[0-9]+"' "${T}/respuesta" | head -1 | grep -oE '[0-9]+')"
id_resp="$(grep -oE '"id"[[:space:]]*:[[:space:]]*"[0-9]+"' "${T}/respuesta" | head -1 | grep -oE '[0-9]+')"
[ "${id_resp}" = "${ID}" ] || no "la respuesta de Discord no es de ese webhook · $(que)"
[ "${canal}" = "${CANAL}" ] || no "el webhook es del canal ${canal:-desconocido}, no de #publicaciones (${CANAL}) · $(que)"

dir="$(dirname "${CONFIG}")"
[ -d "${dir}" ] || no "no existe ${dir}"
umask 077
if [ -f "${CONFIG}" ]; then
  respaldo="${CONFIG}.antes-0609-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "${CONFIG}" "${respaldo}" && chmod 600 "${respaldo}" || no "no pude respaldar ${CONFIG}"
fi
nuevo="$(mktemp "${dir}/.publicar.env.XXXXXX")" || no "no pude crear el temporal en ${dir}"
{ [ -f "${CONFIG}" ] && grep -v -E '^(PUBLICAR_DISCORD_WEBHOOK|PUBLICAR_TELEGRAM_[A-Z_]*)=' "${CONFIG}"; printf 'PUBLICAR_DISCORD_WEBHOOK=%s\n' "${W}"; } > "${nuevo}" \
  || { rm -f "${nuevo}"; no "no pude escribir el archivo nuevo"; }
chmod 600 "${nuevo}"
[ "$(id -u)" = 0 ] && chown root:root "${nuevo}"
mv -f "${nuevo}" "${CONFIG}" || { rm -f "${nuevo}"; no "no pude reemplazar ${CONFIG}"; }
unset W
echo "GUARDADA · $(que) · canal #publicaciones · ${CONFIG} en $(stat -c '%a %U' "${CONFIG}" 2>/dev/null)${respaldo:+ · respaldo $(basename "${respaldo}")}"
