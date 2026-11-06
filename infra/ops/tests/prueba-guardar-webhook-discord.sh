#!/usr/bin/env bash
# infra/ops/tests/prueba-guardar-webhook-discord.sh — prueba de
# infra/ops/web/guardar-webhook-discord.sh (SDD-0609).
#
#   bash infra/ops/tests/prueba-guardar-webhook-discord.sh
#
# Sin red: `curl` es un doble que responde el GET al webhook según
# ${DOBLE}/webhooks/<id> («http|json»); un id sin archivo da 404. Corre en Linux
# y en Git Bash (en Windows los permisos 600 no se pueden comprobar: NO VERIFICADO).
set -uo pipefail
shopt -s lastpipe
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${GUARDAR_WEBHOOK_SH:-${S}/web/guardar-webhook-discord.sh}"

T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0; nv=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
nover() { echo "NO VERIFICADO · $*"; nv=$((nv + 1)); }

D="${T}/doble"; mkdir -p "${T}/bin"
cat > "${T}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
# Doble de curl para el GET a un webhook de Discord. Sin red.
D="${DOBLE:?}"; entrada="$(cat)"; out=""
printf 'ARGS %s\nSTDIN %s\n' "$*" "$entrada" >> "$D/curl.log"
a=("$@"); for ((i = 0; i < ${#a[@]}; i++)); do [ "${a[i]}" = -o ] && out="${a[i+1]}"; done
rc="$(cat "$D/rc" 2>/dev/null || echo 0)"
if [ "$rc" != 0 ]; then echo "curl: ($rc) no se pudo con ${entrada}" >&2; exit "$rc"; fi
id="$(printf '%s' "$entrada" | sed -nE 's#^url = "https://discord\.com/api/webhooks/([0-9]+)/[^"]*"$#\1#p')"
tok="$(printf '%s' "$entrada" | sed -nE 's#^url = "https://discord\.com/api/webhooks/[0-9]+/([^"]*)"$#\1#p')"
linea='404|{"message": "Unknown Webhook", "code": 10015}'
if [ -n "$id" ] && [ -f "$D/webhooks/$id" ]; then
  linea="$(cat "$D/webhooks/$id")"
  # Como Discord: con el id bien y el token mal, 401.
  case "$linea" in *'"token": "'*) grep -qF "\"token\": \"$tok\"" "$D/webhooks/$id" || linea='401|{"message": "Invalid Webhook Token", "code": 50027}' ;; esac
fi
[ -n "$out" ] && printf '%s' "${linea#*|}" > "$out"
printf '%s' "${linea%%|*}"
DOBLE
chmod +x "${T}/bin/curl"

PUB=1567955265918079096; SALUD=1567955345219780698
IDP=1570000000000000001; IDS=1570000000000000002
TOK="TokenSecreto_publicaciones-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ012345"
TOKS="TokenSecreto_salud-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP0123456"
BUENA="https://discord.com/api/webhooks/${IDP}/${TOK}"
DE_SALUD="https://discord.com/api/webhooks/${IDS}/${TOKS}"
CFG="${T}/srv/ops/web/publicar.env"
TODO="${T}/todas.log"; : > "${TODO}"

reiniciar() {
  rm -rf "${D}" "${T}/srv"; mkdir -p "${D}/webhooks" "${T}/srv/ops/web"; : > "${D}/curl.log"
  printf '200|{"type": 1, "id": "%s", "name": "Servidor · publicaciones", "channel_id": "%s", "guild_id": "1534936818951262390", "token": "%s"}\n' "${IDP}" "${PUB}" "${TOK}" > "${D}/webhooks/${IDP}"
  printf '200|{"type": 1, "id": "%s", "name": "Uptime Kuma", "channel_id": "%s", "guild_id": "1534936818951262390", "token": "%s"}\n' "${IDS}" "${SALUD}" "${TOKS}" > "${D}/webhooks/${IDS}"
  printf '%s\n' 'PUBLICAR_KUMA_PUSH_URL=https://kuma.test/api/push/TOKENKUMA' 'PUBLICAR_TELEGRAM_CHAT_ID=-1001234' 'PUBLICAR_TELEGRAM_BOT_TOKEN=123:SECRETO' 'PUBLICAR_MIN_LIBRE_GB=10' > "${CFG}"
  chmod 600 "${CFG}"; cp "${CFG}" "${T}/cfg-antes"
}
correr() { # lo pegado por stdin → $RC, salida en ${T}/salida
  PATH="${T}/bin:${PATH}" DOBLE="${D}" bash "${SCRIPT}" --config "${CFG}" "$@" > "${T}/salida" 2>&1
  RC=$?; cat "${T}/salida" >> "${TODO}"
}
sin_cambios() { cmp -s "${CFG}" "${T}/cfg-antes" && [ -z "$(ls "${T}/srv/ops/web" | grep -v '^publicar.env$')" ]; }
gets() { grep -c '^ARGS' "${D}/curl.log"; }
ver() { sed 's/^/      /' "${T}/salida" | head -3; }
guardada() { grep -E '^PUBLICAR_DISCORD_WEBHOOK=' "${CFG}" | cut -d= -f2-; }

echo "== lo que no sirve =="
reiniciar; printf 'hola, esto no es un webhook\r\n' | correr
[ "${RC}" = 1 ] && grep -q '^NO GUARDADA: lo pegado no trae la dirección' "${T}/salida" && [ "$(gets)" = 0 ] && sin_cambios \
  && ok "basura: NO GUARDADA, no le pregunta a Discord y no toca nada" || { ko "basura rc=${RC}"; ver; }
reiniciar; printf '' | correr
[ "${RC}" = 1 ] && grep -q '^NO GUARDADA' "${T}/salida" && sin_cambios && ok "vacío: NO GUARDADA" || { ko "vacío rc=${RC}"; ver; }
reiniciar; printf 'https://discord.com/api/webhooks/123/%s\nhttps://otro.test/api/webhooks/%s/%s\nhttp://discord.com/api/webhooks/%s/%s\n' "${TOK}" "${IDP}" "${TOK}" "${IDP}" "${TOK}" | correr
[ "${RC}" = 1 ] && [ "$(gets)" = 0 ] && sin_cambios && ok "id corto, otro host o http: no cuenta como dirección" || { ko "formas raras rc=${RC}"; ver; }
reiniciar; printf '%s\n' "${DE_SALUD}" | correr
[ "${RC}" = 1 ] && grep -q "^NO GUARDADA: el webhook es del canal ${SALUD}, no de #publicaciones" "${T}/salida" && [ "$(gets)" = 1 ] && sin_cambios \
  && ok "dirección válida de otro canal (#salud): NO GUARDADA, sin respaldo ni cambios" || { ko "otro canal rc=${RC}"; ver; }
reiniciar; printf '%s %s\n' "${BUENA}" "${DE_SALUD}" | correr
[ "${RC}" = 1 ] && grep -q 'trae 2 direcciones de webhook distintas' "${T}/salida" && [ "$(gets)" = 0 ] && sin_cambios \
  && ok "dos direcciones distintas: NO GUARDADA sin preguntar" || { ko "dos rc=${RC}"; ver; }
reiniciar; printf '%sXYZ\n' "${BUENA}" | correr
[ "${RC}" = 1 ] && grep -q 'Discord no reconoce ese webhook (HTTP 401)' "${T}/salida" && sin_cambios \
  && ok "token con letras de más pegadas: Discord no lo reconoce, NO GUARDADA" || { ko "token largo rc=${RC}"; ver; }
reiniciar; printf '200|{"type": 1, "id": "999", "channel_id": "%s"}\n' "${PUB}" > "${D}/webhooks/${IDP}"; printf '%s\n' "${BUENA}" | correr
[ "${RC}" = 1 ] && grep -q 'no es de ese webhook' "${T}/salida" && sin_cambios && ok "respuesta con otro id: NO GUARDADA" || { ko "id distinto rc=${RC}"; ver; }
for caso in '429|Discord pide esperar' '500|HTTP 500'; do
  IFS='|' read -r http palabra <<< "${caso}"
  reiniciar; printf '%s|{}\n' "${http}" > "${D}/webhooks/${IDP}"; printf '%s\n' "${BUENA}" | correr
  [ "${RC}" = 1 ] && grep -q "${palabra}" "${T}/salida" && sin_cambios && ok "Discord responde ${http}: NO GUARDADA" || { ko "${http} rc=${RC}"; ver; }
done
reiniciar; echo 7 > "${D}/rc"; printf '%s\n' "${BUENA}" | correr
[ "${RC}" = 1 ] && grep -q 'no pude preguntarle a Discord (curl 7)' "${T}/salida" && sin_cambios && ok "sin red: NO GUARDADA y no se cambió nada" || { ko "curl 7 rc=${RC}"; ver; }
reiniciar; correr "${BUENA}" < /dev/null
[ "${RC}" = 64 ] && sin_cambios && ! grep -q "${TOK}" "${T}/salida" && ok "la dirección como argumento: error de uso (64) y no la repite" || { ko "argumento rc=${RC}"; ver; }

echo "== la correcta =="
reiniciar; printf '%s\r\n' "${BUENA}" | correr
[ "${RC}" = 0 ] && grep -q "^GUARDADA · ${#BUENA} caracteres · sha256 [0-9a-f]\{12\} · canal #publicaciones" "${T}/salida" \
  && ok "la correcta: GUARDADA con el largo y la huella" || { ko "correcta rc=${RC}"; ver; }
[ "$(guardada)" = "${BUENA}" ] && [ "$(grep -c '^PUBLICAR_DISCORD_WEBHOOK=' "${CFG}")" = 1 ] && ! grep -q '^PUBLICAR_TELEGRAM_' "${CFG}" \
  && grep -qx 'PUBLICAR_KUMA_PUSH_URL=https://kuma.test/api/push/TOKENKUMA' "${CFG}" && grep -qx 'PUBLICAR_MIN_LIBRE_GB=10' "${CFG}" \
  && ok "publicar.env: una línea PUBLICAR_DISCORD_WEBHOOK, sin PUBLICAR_TELEGRAM_*, el resto igual" || { ko "contenido: $(grep -c . "${CFG}") líneas"; }
huella="$(printf '%s' "${BUENA}" | sha256sum | cut -c1-12)"
grep -q "sha256 ${huella} " "${T}/salida" && ok "la huella es el sha256 de la dirección guardada" || ko "huella"
r="$(ls "${T}/srv/ops/web" | grep '^publicar.env.antes-0609-[0-9]\{8\}T[0-9]\{6\}Z$')"
[ -n "${r}" ] && cmp -s "${T}/srv/ops/web/${r}" "${T}/cfg-antes" && grep -q "respaldo ${r}" "${T}/salida" \
  && ok "respaldo publicar.env.antes-0609-<fecha> con el contenido de antes" || ko "respaldo: ${r:-ninguno}"
[ -z "$(ls -a "${T}/srv/ops/web" | grep '^\.publicar\.env\.')" ] && ok "no deja temporales" || ko "temporales"
grep -qx "STDIN url = \"${BUENA}\"" "${D}/curl.log" && ! grep '^ARGS' "${D}/curl.log" | grep -q "${TOK}\|webhooks" \
  && grep '^ARGS' "${D}/curl.log" | grep -q -- '-A DiscordBot (https://dtdcargo.com, 1.0)' \
  && ok "GET a Discord con la dirección por stdin (-K -), nunca como argumento" || ko "curl: $(head -1 "${D}/curl.log" | cut -c1-80)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) nover "permisos 600 del archivo y del respaldo (Windows no los guarda)" ;;
  *) [ "$(stat -c %a "${CFG}")" = 600 ] && [ "$(stat -c %a "${T}/srv/ops/web/${r}")" = 600 ] && ok "publicar.env y el respaldo en 600" || ko "permisos $(stat -c %a "${CFG}")" ;;
esac

echo "== caracteres de más y otras formas =="
reiniciar; printf '  Copiado: "https://discordapp.com/api/v10/webhooks/%s/%s"\r\n\r\n' "${IDP}" "${TOK}" | correr
[ "${RC}" = 0 ] && [ "$(guardada)" = "${BUENA}" ] && ok "con comillas, espacios, texto alrededor, CRLF, discordapp.com y /api/v10: guarda la forma limpia de discord.com" || { ko "de más rc=${RC} → $(guardada | cut -c1-40)"; ver; }
reiniciar; printf '\e[200~https://ptb.discord.com/api/webhooks/%s/%s\e[201~' "${IDP}" "${TOK}" | correr
[ "${RC}" = 0 ] && [ "$(guardada)" = "${BUENA}" ] && ok "ptb.discord.com y marcas de pegado de la terminal: guarda la forma limpia" || { ko "ptb rc=${RC}"; ver; }
reiniciar; printf '%s\n%s\n' "${BUENA}" "${BUENA}" | correr
[ "${RC}" = 0 ] && ok "la misma dirección dos veces cuenta como una" || { ko "repetida rc=${RC}"; ver; }
reiniciar; printf 'PUBLICAR_DISCORD_WEBHOOK=https://discord.com/api/webhooks/1/vieja\n' >> "${CFG}"; printf '%s\n' "${BUENA}" | correr
[ "${RC}" = 0 ] && [ "$(grep -c '^PUBLICAR_DISCORD_WEBHOOK=' "${CFG}")" = 1 ] && [ "$(guardada)" = "${BUENA}" ] && ok "reemplaza una PUBLICAR_DISCORD_WEBHOOK anterior, sin duplicar" || { ko "reemplazo rc=${RC}"; ver; }
reiniciar; rm -f "${CFG}"; printf '%s\n' "${BUENA}" | correr
[ "${RC}" = 0 ] && [ "$(grep -c . "${CFG}")" = 1 ] && [ "$(guardada)" = "${BUENA}" ] && ! grep -q respaldo "${T}/salida" && ok "sin publicar.env: lo crea con la línea, sin respaldo" || { ko "sin archivo rc=${RC}"; ver; }

echo "== la llave no sale =="
! grep -q "${TOK}\|${TOKS}\|/api/webhooks/" "${TODO}" && [ "$(grep -c . "${TODO}")" -ge 15 ] \
  && ok "en $(grep -c . "${TODO}") líneas de salida (con un error de curl que traía la dirección) no aparece ninguna dirección ni token" \
  || ko "se escapó una dirección: $(grep -n "${TOK}\|${TOKS}\|/api/webhooks/" "${TODO}" | head -1 | cut -c1-60)"

echo "RESUMEN: ${pass} PASÓ · ${fail} FALLÓ · ${nv} NO VERIFICADO"
[ "${fail}" = 0 ]
