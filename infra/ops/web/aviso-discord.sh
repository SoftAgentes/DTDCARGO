#!/usr/bin/env bash
# infra/ops/web/aviso-discord.sh — un aviso del servidor a un canal de Discord
# por su webhook (SDD-0609). Reemplaza al aviso por Telegram de publicar-web.sh:
# corte directo, sin doble envío (decisión de Sam del 2026-11-05).
#
#   printf '%s' "texto" | aviso-discord.sh [--config ARCHIVO] [--clave NOMBRE]
#   aviso-discord.sh --probar [--config ARCHIVO]   # manda un aviso de prueba (ida y vuelta)
#   aviso-discord.sh --estado [--config ARCHIVO]   # configurado | SIN CONFIGURAR | NO VÁLIDO; no envía
#
# ARCHIVO es por defecto /srv/ops/web/publicar.env (root, 600) y NOMBRE,
# PUBLICAR_DISCORD_WEBHOOK: la dirección del webhook del canal #publicaciones.
#
# Reglas, cada una con su prueba en infra/ops/tests/prueba-aviso-discord.sh:
#   1. La dirección del webhook es una LLAVE: quien la tenga escribe en el canal.
#      Vive solo en el archivo de configuración del servidor, viaja a curl por
#      stdin (-K -), nunca en la línea de comandos, y no aparece en ninguna
#      salida ni error de este script (curl corre con stderr a /dev/null).
#   2. Se valida ENTERA antes de usarla (la misma forma que SDD-0606): https, un
#      host de Discord, la ruta exacta /api[/vN]/webhooks/<id>/<token>, sin query
#      ni nada más. Otro valor cuenta como no válido y no se envía nada.
#   3. Sin menciones: allowed_mentions.parse = []. Sin vista previa de enlaces
#      (flags = 4, SUPPRESS_EMBEDS).
#   4. Recorte a 2.000: el texto se corta a 2.000 BYTES sin partir un carácter
#      UTF-8. Un carácter ocupa al menos un byte y nunca más unidades UTF-16 que
#      bytes, así que nunca pasa del tope de Discord se cuente como se cuente.
#   5. ?wait=true: solo cuenta como entregado lo que vuelve con el id del mensaje.
#   6. HTTP 429: espera lo que diga Retry-After (mínimo 1 s) y reintenta, hasta
#      3 intentos, si la espera no pasa de 10 s. Si pide más, no espera:
#      «reintentable», y el próximo aviso lo intentará otra vez.
#   7. User-Agent `DiscordBot (https://dtdcargo.com, 1.0)`, como pide Discord.
#
# Salida: una línea en stdout que nunca lleva la dirección. Código:
#   0 entregado · 2 sin configurar o dirección no válida · 3 rechazado (texto
#   vacío o un 4xx: repetir igual no sirve) · 4 reintentable (429 largo, 5xx, no
#   hubo conexión) · 5 incierto (salió y no volvió respuesta clara: pudo llegar,
#   no se repite a ciegas) · 64 uso.
set -uo pipefail

CONFIG=/srv/ops/web/publicar.env
CLAVE=PUBLICAR_DISCORD_WEBHOOK
MODO=enviar
TOPE=2000
INTENTOS=3
MAX_ESPERA="${AVISO_DISCORD_MAX_ESPERA:-10}"
UA='DiscordBot (https://dtdcargo.com, 1.0)'
FORMA='^https://(discord\.com|discordapp\.com|canary\.discord\.com|ptb\.discord\.com)/api(/v[0-9]{1,2})?/webhooks/[0-9]{17,20}/[A-Za-z0-9_-]{20,100}$'

while [ $# -gt 0 ]; do
  case "$1" in
    --config) [ $# -ge 2 ] || { echo "uso: --config ARCHIVO"; exit 64; }; CONFIG="$2"; shift 2 ;;
    --clave) [ $# -ge 2 ] || { echo "uso: --clave NOMBRE"; exit 64; }; CLAVE="$2"; shift 2 ;;
    --probar) MODO=probar; shift ;;
    --estado) MODO=estado; shift ;;
    *) echo "argumento desconocido: $1 (--config, --clave, --probar, --estado)"; exit 64 ;;
  esac
done
[[ "${CLAVE}" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "uso: --clave con un nombre de variable en mayúsculas"; exit 64; }

# El mismo lector que publicar-web.sh: la última línea CLAVE=, sin comillas ni \r.
conf() {
  [ -r "${CONFIG}" ] || return 0
  grep -E "^${CLAVE}=" "${CONFIG}" | tail -1 | cut -d= -f2- | sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/" | tr -d '\r'
}
WEBHOOK="$(conf)"
WEBHOOK="${WEBHOOK#"${WEBHOOK%%[![:space:]]*}"}"; WEBHOOK="${WEBHOOK%"${WEBHOOK##*[![:space:]]}"}"

estado() {
  if [ -z "${WEBHOOK}" ]; then printf 'SIN CONFIGURAR (falta %s en %s)' "${CLAVE}" "${CONFIG}"; return 2; fi
  if ! [[ "${WEBHOOK}" =~ ${FORMA} ]]; then printf 'NO VÁLIDO (%s no es la dirección de un webhook de Discord)' "${CLAVE}"; return 2; fi
  printf 'configurado'
}

if [ "${MODO}" = estado ]; then e="$(estado)"; rc=$?; echo "Discord: ${e}"; exit "${rc}"; fi

if [ "${MODO}" = probar ]; then
  TEXTO="DTD Cargo · prueba de avisos del servidor desde $(hostname 2>/dev/null || echo '?') a las $(date -u +%Y-%m-%dT%H:%M:%SZ). Si lo ves, el aviso de publicaciones llega."
else
  TEXTO="$(cat)"
fi

e="$(estado)" || { echo "aviso NO enviado: Discord ${e}"; exit 2; }
if [ -z "${TEXTO//[[:space:]]/}" ]; then echo "aviso NO enviado: texto vacío"; exit 3; fi

recortar() { # $1 = texto → a lo sumo ${TOPE} bytes, sin partir un carácter UTF-8
  local LC_ALL=C t="$1" i b largo
  if [ "${#t}" -le "${TOPE}" ]; then printf '%s' "${t}"; return; fi
  t="${t:0:$((TOPE - 3))}"   # 3 bytes para «…»
  for i in 1 2 3; do         # ¿termina en una secuencia UTF-8 incompleta?
    [ "${#t}" -ge "${i}" ] || break
    b="$(printf '%d' "'${t:$((${#t} - i)):1}")"; [ "${b}" -lt 0 ] && b=$((b + 256))
    [ "${b}" -lt 128 ] && break                 # ASCII: completa
    if [ "${b}" -ge 192 ]; then                 # byte inicial: ¿caben sus continuaciones?
      if [ "${b}" -ge 240 ]; then largo=4; elif [ "${b}" -ge 224 ]; then largo=3; else largo=2; fi
      [ "${largo}" -gt "${i}" ] && t="${t:0:$((${#t} - i))}"
      break
    fi
  done
  printf '%s…' "${t}"
}

json_cadena() { # $1 = texto → cadena JSON (sin las comillas de afuera). Quedan el tab y el salto de línea;
  # los demás controles (también el CR, que Git Bash ya quita en $(…)) se borran.
  printf '%s' "$1" | LC_ALL=C tr -d '\000-\010\013-\037\177' \
    | LC_ALL=C sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' \
    | awk 'BEGIN { ORS = "" } NR > 1 { print "\\n" } { print }'
}

T="$(mktemp -d)" || { echo "aviso NO enviado: sin directorio temporal"; exit 4; }
trap 'rm -rf "${T}"' EXIT
chmod 700 "${T}"
printf '{"content":"%s","allowed_mentions":{"parse":[]},"flags":4}' "$(json_cadena "$(recortar "${TEXTO}")")" > "${T}/cuerpo"

segundos() { # Retry-After (puede traer decimales) → segundos enteros hacia arriba, mínimo 1; vacío si no es un número
  awk -v v="$1" 'BEGIN { if (v !~ /^[0-9]+(\.[0-9]+)?$/) exit; s = int(v); if (s < v) s++; if (s < 1) s = 1; print s }'
}

intento=1
while :; do
  : > "${T}/respuesta"; : > "${T}/cabeceras"
  codigo="$(printf 'url = "%s?wait=true"\n' "${WEBHOOK}" \
    | curl -s -K - --connect-timeout 10 -m 20 -o "${T}/respuesta" -D "${T}/cabeceras" -w '%{http_code}' \
        -H 'Content-Type: application/json' -A "${UA}" --data-binary @"${T}/cuerpo" 2>/dev/null)"
  rc_curl=$?
  if [ "${rc_curl}" != 0 ]; then
    case "${rc_curl}" in
      6|7|35) echo "aviso NO enviado: Discord no disponible (no hubo conexión, curl ${rc_curl})"; exit 4 ;;
      *) echo "aviso incierto: salió y no volvió respuesta (curl ${rc_curl}); pudo llegar"; exit 5 ;;
    esac
  fi
  case "${codigo}" in
    2??)
      if grep -qE '"id"[[:space:]]*:[[:space:]]*"[0-9]{17,20}"' "${T}/respuesta"; then
        echo "aviso por Discord: entregado (HTTP ${codigo})"; exit 0
      fi
      echo "aviso incierto: Discord respondió HTTP ${codigo} sin el id del mensaje; pudo llegar"; exit 5 ;;
    429)
      espera="$(segundos "$(grep -i '^retry-after:' "${T}/cabeceras" | tail -1 | cut -d: -f2- | tr -d ' \r')")"
      espera="${espera:-1}"
      if [ "${intento}" -ge "${INTENTOS}" ] || [ "${espera}" -gt "${MAX_ESPERA}" ]; then
        echo "aviso NO enviado: Discord pide esperar ${espera} s (HTTP 429, intento ${intento} de ${INTENTOS})"; exit 4
      fi
      echo "Discord pide esperar ${espera} s (HTTP 429); reintento"
      sleep "${espera}"
      intento=$((intento + 1)) ;;
    4??) echo "aviso NO enviado: Discord lo rechazó (HTTP ${codigo}); revisar el webhook de ${CLAVE}"; exit 3 ;;
    *) echo "aviso NO enviado: Discord respondió HTTP ${codigo:-sin respuesta}"; exit 4 ;;
  esac
done
