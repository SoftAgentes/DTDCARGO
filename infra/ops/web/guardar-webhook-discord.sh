#!/usr/bin/env bash
# infra/ops/web/guardar-webhook-discord.sh — guarda la dirección de un webhook de
# Discord en el servidor sin que pase por el chat (SDD-0609 y SDD-0606).
#
#   Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh [DESTINO]
#   guardar-webhook-discord.sh [DESTINO] [--config ARCHIVO] < pegado.txt     # (pruebas)
#
# DESTINO (por defecto, publicaciones):
#
#   destino         canal                    archivo                     variable
#   publicaciones   #publicaciones (Servidor) /srv/ops/web/publicar.env   PUBLICAR_DISCORD_WEBHOOK
#   registro        #registro-clientes        /srv/dtd-cargo/.env         DISCORD_WEBHOOK_REGISTRO
#   conversaciones  #conversaciones-portal    /srv/dtd-cargo/.env         DISCORD_WEBHOOK_CONVERSACIONES
#   bugs            #bugs                     /srv/dtd-cargo/.env         DISCORD_WEBHOOK_BUGS
#   reportes        #reporte-diario           /srv/dtd-cargo/.env         DISCORD_WEBHOOK_REPORTES
#   equipo          #avisos-equipo            /srv/dtd-cargo/.env         DISCORD_WEBHOOK_EQUIPO
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
#   3. La valida contra Discord: GET al webhook, 200, el mismo id y el channel_id
#      exacto del destino. Los IDs de canal (no son llaves) se leyeron en Discord el
#      2026-11-07: #publicaciones 1567955265918079096 · #registro-clientes
#      1567954867878629406 · #conversaciones-portal 1567954948333768854 · #bugs
#      1567955017237921883 · #reporte-diario 1567955085550428251 · #avisos-equipo
#      1567955151493271785. El nombre del webhook no importa.
#   4. Respalda el archivo como <archivo>.antes-<sdd>-<fecha UTC> (600, en la misma
#      carpeta: lleva llaves), reemplaza solo su variable y deja el archivo en 600
#      root. En publicar.env además quita PUBLICAR_TELEGRAM_* (corte directo de la
#      0609). En el .env de la app no toca nada más: retirar TELEGRAM_BOT_TOKEN es
#      un paso aparte del Director General (SDD-0606).
#
# No reinicia nada: el web lee el .env cuando se recrea (la próxima publicación).
# Imprime solo «GUARDADA» o «NO GUARDADA: <motivo>», con el largo y una huella
# sha256 corta. Nunca la dirección: no la recibe por argumentos, viaja a curl por
# stdin (-K -), curl corre con stderr a /dev/null y ningún mensaje la incluye.
# Salida: 0 guardada · 1 no guardada · 64 uso.
set -uo pipefail

UA='DiscordBot (https://dtdcargo.com, 1.0)'

DESTINO=publicaciones; CONFIG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --config) [ $# -ge 2 ] || { echo "uso: --config ARCHIVO"; exit 64; }; CONFIG="$2"; shift 2 ;;
    publicaciones|registro|conversaciones|bugs|reportes|equipo) DESTINO="$1"; shift ;;
    # Sin repetir el argumento: podría ser la dirección pegada donde no va.
    *) echo "argumento desconocido (${#1} caracteres): el destino es publicaciones, registro, conversaciones, bugs, reportes o equipo; la dirección va por la entrada estándar, nunca como argumento"; exit 64 ;;
  esac
done

case "${DESTINO}" in
  publicaciones)  ARCHIVO=/srv/ops/web/publicar.env; CLAVE=PUBLICAR_DISCORD_WEBHOOK;       CANAL_NOMBRE='#publicaciones';         CANAL=1567955265918079096; SDD=0609 ;;
  registro)       ARCHIVO=/srv/dtd-cargo/.env;       CLAVE=DISCORD_WEBHOOK_REGISTRO;       CANAL_NOMBRE='#registro-clientes';     CANAL=1567954867878629406; SDD=0606 ;;
  conversaciones) ARCHIVO=/srv/dtd-cargo/.env;       CLAVE=DISCORD_WEBHOOK_CONVERSACIONES; CANAL_NOMBRE='#conversaciones-portal'; CANAL=1567954948333768854; SDD=0606 ;;
  bugs)           ARCHIVO=/srv/dtd-cargo/.env;       CLAVE=DISCORD_WEBHOOK_BUGS;           CANAL_NOMBRE='#bugs';                  CANAL=1567955017237921883; SDD=0606 ;;
  reportes)       ARCHIVO=/srv/dtd-cargo/.env;       CLAVE=DISCORD_WEBHOOK_REPORTES;       CANAL_NOMBRE='#reporte-diario';        CANAL=1567955085550428251; SDD=0606 ;;
  equipo)         ARCHIVO=/srv/dtd-cargo/.env;       CLAVE=DISCORD_WEBHOOK_EQUIPO;         CANAL_NOMBRE='#avisos-equipo';         CANAL=1567955151493271785; SDD=0606 ;;
esac
CONFIG="${CONFIG:-${ARCHIVO}}"

no() { echo "NO GUARDADA (${DESTINO}): $*"; exit 1; }
[ -t 0 ] && no "la dirección tiene que llegar por la entrada estándar (Get-Clipboard | ssh.exe …)"

PEGADO="$(head -c 65536)"
mapfile -t HALLADAS < <(printf '%s' "${PEGADO}" | tr -d '\r' \
  | grep -oE 'https://(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)/api(/v[0-9]{1,2})?/webhooks/[0-9]{17,20}/[A-Za-z0-9_-]{20,100}' \
  | sed -E 's#^https://[^/]+/api(/v[0-9]{1,2})?/webhooks/#https://discord.com/api/webhooks/#' | awk '!visto[$0]++')
unset PEGADO
case "${#HALLADAS[@]}" in
  0) no "lo pegado no trae la dirección de un webhook de Discord (¿se copió otra cosa?)" ;;
  1) ;;
  *) no "lo pegado trae ${#HALLADAS[@]} direcciones de webhook distintas: copia solo la de ${CANAL_NOMBRE}" ;;
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
campo() { grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "${T}/respuesta" | head -1 | sed -E 's/^"[^"]*"[[:space:]]*:[[:space:]]*"(.*)"$/\1/'; }
canal="$(campo channel_id)"; id_resp="$(campo id)"
[ "${id_resp}" = "${ID}" ] || no "la respuesta de Discord no es de ese webhook · $(que)"
[ "${canal}" = "${CANAL}" ] || no "el webhook es del canal ${canal:-desconocido}, no de ${CANAL_NOMBRE} (${CANAL}) · $(que)"

dir="$(dirname "${CONFIG}")"
[ -d "${dir}" ] || no "no existe ${dir}"
umask 077
if [ -f "${CONFIG}" ]; then
  respaldo="${CONFIG}.antes-${SDD}-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "${CONFIG}" "${respaldo}" && chmod 600 "${respaldo}" || no "no pude respaldar ${CONFIG}"
fi
if [ "${DESTINO}" = publicaciones ]; then quitar="^(${CLAVE}|PUBLICAR_TELEGRAM_[A-Z_]*)="; else quitar="^${CLAVE}="; fi
nuevo="$(mktemp "${dir}/.$(basename "${CONFIG}").XXXXXX")" || no "no pude crear el temporal en ${dir}"
{ [ -f "${CONFIG}" ] && grep -v -E "${quitar}" "${CONFIG}"; printf '%s=%s\n' "${CLAVE}" "${W}"; } > "${nuevo}" \
  || { rm -f "${nuevo}"; no "no pude escribir el archivo nuevo"; }
chmod 600 "${nuevo}"
[ "$(id -u)" = 0 ] && chown root:root "${nuevo}"
mv -f "${nuevo}" "${CONFIG}" || { rm -f "${nuevo}"; no "no pude reemplazar ${CONFIG}"; }
unset W
echo "GUARDADA (${DESTINO}) · $(que) · canal ${CANAL_NOMBRE} ${canal} · ${CLAVE} en ${CONFIG} ($(stat -c '%a %U' "${CONFIG}" 2>/dev/null))${respaldo:+ · respaldo $(basename "${respaldo}")}"
