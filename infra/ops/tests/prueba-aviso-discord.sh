#!/usr/bin/env bash
# infra/ops/tests/prueba-aviso-discord.sh — prueba de infra/ops/web/aviso-discord.sh (SDD-0609).
#
#   bash infra/ops/tests/prueba-aviso-discord.sh               # la prueba
#   bash infra/ops/tests/prueba-aviso-discord.sh --mutantes    # control rojo + mutantes
#
# Sin red: `curl` y `sleep` son dobles. El doble de curl anota sus argumentos, la
# configuración que llega por stdin (-K -) y el cuerpo, y responde lo que diga la
# cola ${DOBLE}/respuestas («rc|http|retry-after|cuerpo», una por llamada; si no
# hay, 200 con un id). Cuando su rc no es 0 imprime en stderr un error con la
# dirección, como lo haría curl sin -s: si esa salida se escapara, la prueba lo ve.
# Corre en Linux y en Git Bash (no pide flock). Necesita node para leer el JSON.
set -uo pipefail
shopt -s lastpipe   # `printf … | correr` deja $RC en esta shell
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${AVISO_DISCORD_SH:-${S}/web/aviso-discord.sh}"

if [ "${1:-}" = --mutantes ]; then
  ORIG="${S}/web/aviso-discord.sh"
  M="$(mktemp -d)"; trap 'rm -rf "${M}"' EXIT
  vivos=0; muertos=0
  correr_suite() { AVISO_DISCORD_SH="$1" bash "${BASH_SOURCE[0]}" > "${M}/suite.log" 2>&1; }
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/control.sh"
  if correr_suite "${M}/control.sh"; then echo "CONTROL ROJO FALLÓ: la suite pasa contra un script que no hace nada"; exit 1; fi
  echo "control rojo: contra un script vacío la suite falla ($(grep -c '^FALLÓ' "${M}/suite.log") FALLÓ)"
  mutar() { # $1 = nombre, $2 = texto exacto (una sola vez en el script), $3 = reemplazo
    local n
    n="$(perl -0ne 'BEGIN { $a = shift } $c = () = /\Q$a\E/g; print $c' -- "$2" "${ORIG}")"
    [ "${n}" = 1 ] || { echo "MUTANTE MAL ARMADO «$1»: el texto aparece ${n} veces"; vivos=$((vivos + 1)); return; }
    perl -0pe 'BEGIN { $a = shift; $b = shift } s/\Q$a\E/$b/' -- "$2" "$3" "${ORIG}" > "${M}/mutante.sh"
    if correr_suite "${M}/mutante.sh"; then
      echo "VIVO   · $1"; vivos=$((vivos + 1))
    else
      echo "MUERTO · $1 ($(grep '^FALLÓ' "${M}/suite.log" | head -1 | cut -c1-90))"; muertos=$((muertos + 1))
    fi
  }
  mutar "con menciones" '"allowed_mentions":{"parse":[]},' ''
  mutar "con vista previa de enlaces" ',"flags":4}' '}'
  mutar "sin wait=true" 'url = "%s?wait=true"' 'url = "%s"'
  mutar "la dirección como argumento" 'curl -s -K - --connect-timeout' 'curl -s "${WEBHOOK}" -K - --connect-timeout'
  mutar "errores de curl a la vista" '--data-binary @"${T}/cuerpo" 2>/dev/null)"' '--data-binary @"${T}/cuerpo")"'
  mutar "sin validar la dirección" 'if ! [[ "${WEBHOOK}" =~ ${FORMA} ]]; then' 'if false; then'
  mutar "acepta query en la dirección" '[A-Za-z0-9_-]{20,100}$'"'" '[A-Za-z0-9_-]{20,100}'"'"
  mutar "sin recorte" 'if [ "${#t}" -le "${TOPE}" ]; then' 'if true; then'
  mutar "parte un carácter UTF-8" '[ "${largo}" -gt "${i}" ] && t=' 'false && t='
  mutar "sin escapar comillas" "-e 's/\"/\\\\\"/g' " ''
  mutar "deja pasar controles" "tr -d '\\000-\\010\\013-\\037\\177'" 'cat'
  mutar "User-Agent genérico" "UA='DiscordBot (https://dtdcargo.com, 1.0)'" "UA='curl/8'"
  mutar "429 sin esperar" 'sleep "${espera}"' ':'
  mutar "429 espera lo que sea" ' || [ "${espera}" -gt "${MAX_ESPERA}" ]' ''
  mutar "429 sin reintento" 'intento=$((intento + 1)) ;;' 'exit 4 ;;'
  mutar "429 reintenta sin fin" '[ "${intento}" -ge "${INTENTOS}" ] ||' 'false ||'
  mutar "2xx sin id cuenta como entregado" 'sin el id del mensaje; pudo llegar"; exit 5' 'sin el id del mensaje; pudo llegar"; exit 0'
  mutar "sin conexión cuenta como incierto" '6|7|35)' '6|35)'
  mutar "texto vacío se envía" 'if [ -z "${TEXTO//[[:space:]]/}" ]; then' 'if false; then'
  echo "RESULTADO MUTANTES: ${muertos} muertos · ${vivos} vivos"
  [ "${vivos}" = 0 ]; exit
fi

command -v node >/dev/null 2>&1 || { echo "NO DISPONIBLE: falta node para leer el JSON"; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }

D="${T}/doble"; mkdir -p "${T}/bin" "${D}"
cat > "${T}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
# Doble de curl para un webhook de Discord. Sin red.
D="${DOBLE:?}"; n="$(($(cat "$D/llamadas" 2>/dev/null || echo 0) + 1))"; echo "$n" > "$D/llamadas"
entrada="$(cat)"; out=""; cab=""; cuerpo=""
printf 'ARGS %s\nSTDIN %s\n' "$*" "$entrada" >> "$D/curl.log"
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift ;;
    -D) cab="$2"; shift ;;
    --data-binary) cuerpo="${2#@}"; shift ;;
  esac
  shift
done
[ -n "$cuerpo" ] && cp "$cuerpo" "$D/cuerpo.$n"
linea='0|200||{"id":"123456789012345678","channel_id":"1567955265918079096"}'
if [ -s "$D/respuestas" ]; then linea="$(head -1 "$D/respuestas")"; sed -i '1d' "$D/respuestas"; fi
IFS='|' read -r rc http espera resp <<< "$linea"
if [ "$rc" != 0 ]; then echo "curl: ($rc) falló con ${entrada}" >&2; exit "$rc"; fi
[ -n "$cab" ] && { printf 'HTTP/2 %s\r\n' "$http"; [ -n "$espera" ] && printf 'retry-after: %s\r\n' "$espera"; printf '\r\n'; } > "$cab"
[ -n "$out" ] && printf '%s' "$resp" > "$out"
printf '%s' "$http"
exit 0
DOBLE
cat > "${T}/bin/sleep" <<'DOBLE'
#!/usr/bin/env bash
echo "sleep $*" >> "${DOBLE:?}/sleep.log"
DOBLE
chmod +x "${T}/bin/"*

TOKEN="TOKENSECRETO_del-webhook_0123456789abcdef"
WEB="https://discord.com/api/webhooks/1567955265918079096/${TOKEN}"
CFG="${T}/publicar.env"
TODO="${T}/todas-las-salidas.log"; : > "${TODO}"

reiniciar() { rm -rf "${D}"; mkdir -p "${D}"; : > "${D}/curl.log"; : > "${D}/sleep.log"; }
config() { printf '%s\n' "PUBLICAR_KUMA_PUSH_URL=https://kuma.test/api/push/X" "$@" > "${CFG}"; }
correr() { # texto por stdin; argumentos al script → $RC, salida en ${T}/salida
  PATH="${T}/bin:${PATH}" DOBLE="${D}" bash "${SCRIPT}" --config "${CFG}" "$@" > "${T}/salida" 2>&1
  RC=$?; cat "${T}/salida" >> "${TODO}"
}
llamadas() { cat "${D}/llamadas" 2>/dev/null || echo 0; }
ver() { sed 's/^/      /' "${T}/salida" | head -3; }
contenido() { # $1 = número de llamada → el campo content, tal como lo leería Discord
  node -e 'const fs=require("fs");const b=fs.readFileSync(process.argv[1]);const j=JSON.parse(b.toString("utf8"));process.stdout.write(j.content)' "${D}/cuerpo.$1"
}

echo "== configuración =="
reiniciar; rm -f "${CFG}"; printf 'hola' | correr
[ "${RC}" = 2 ] && [ "$(llamadas)" = 0 ] && grep -q 'aviso NO enviado: Discord SIN CONFIGURAR (falta PUBLICAR_DISCORD_WEBHOOK' "${T}/salida" \
  && ok "sin archivo de configuración: sale 2, lo dice en una línea y no llama a Discord" || { ko "sin config rc=${RC}"; ver; }
reiniciar; config "PUBLICAR_DISCORD_WEBHOOK="; printf 'hola' | correr
[ "${RC}" = 2 ] && [ "$(llamadas)" = 0 ] && grep -q 'SIN CONFIGURAR' "${T}/salida" && ok "línea vacía: sin configurar" || { ko "vacía rc=${RC}"; ver; }

malas=(
  "http://discord.com/api/webhooks/1567955265918079096/${TOKEN}"
  "https://discord.com.otro.test/api/webhooks/1567955265918079096/${TOKEN}"
  "https://otro.test/api/webhooks/1567955265918079096/${TOKEN}"
  "${WEB}?wait=true"
  "${WEB}#x"
  "${WEB}/slack"
  "https://discord.com/api/webhooks/1234/${TOKEN}"
  "https://discord.com/api/webhooks/1567955265918079096/corto"
  "https://usuario@discord.com/api/webhooks/1567955265918079096/${TOKEN}"
  "https://discord.com:8443/api/webhooks/1567955265918079096/${TOKEN}"
)
todas=1
for m in "${malas[@]}"; do
  reiniciar; config "PUBLICAR_DISCORD_WEBHOOK=${m}"; printf 'hola' | correr
  if [ "${RC}" != 2 ] || [ "$(llamadas)" != 0 ] || ! grep -q 'NO VÁLIDO' "${T}/salida"; then todas=0; ko "aceptó «${m%%/api*}…» rc=${RC}"; fi
done
[ "${todas}" = 1 ] && ok "${#malas[@]} direcciones con otra forma (http, otro host, query, fragmento, ruta extra, id o token raros, usuario, puerto): NO VÁLIDO, sin envío"

reiniciar; config "PUBLICAR_DISCORD_WEBHOOK=\"${WEB}\"" ; printf '\r\n' >> "${CFG}"; correr --estado
[ "${RC}" = 0 ] && grep -q '^Discord: configurado$' "${T}/salida" && [ "$(llamadas)" = 0 ] && ok "--estado: configurado (con comillas en el archivo), sin enviar nada" || { ko "estado rc=${RC}"; ver; }
reiniciar; config "PUBLICAR_DISCORD_WEBHOOK=${WEB}x?y"; correr --estado
[ "${RC}" = 2 ] && grep -q '^Discord: NO VÁLIDO' "${T}/salida" && ok "--estado: NO VÁLIDO sin mostrar el valor" || { ko "estado no válido rc=${RC}"; ver; }
reiniciar; config "OTRA_CLAVE=${WEB}"; printf 'hola' | correr --clave OTRA_CLAVE
[ "${RC}" = 0 ] && [ "$(llamadas)" = 1 ] && ok "--clave elige otra variable del archivo" || { ko "clave rc=${RC}"; ver; }

echo "== envío =="
reiniciar; config "PUBLICAR_DISCORD_WEBHOOK='${WEB}'"
printf 'DTD Cargo · publicada 0123abcd en dtdcargo.com (vigilante). @everyone <@123456789012345678>' | correr
[ "${RC}" = 0 ] && grep -qx 'aviso por Discord: entregado (HTTP 200)' "${T}/salida" && ok "200 con id: entregado, sale 0" || { ko "entregado rc=${RC}"; ver; }
grep '^ARGS' "${D}/curl.log" > "${T}/args"
[ -s "${T}/args" ] && ! grep -q "${TOKEN}\|webhooks" "${T}/args" && ok "la dirección no viaja como argumento de curl" || ko "la dirección viajó como argumento"
grep -qx "STDIN url = \"${WEB}?wait=true\"" "${D}/curl.log" && ok "la dirección llega por stdin (-K -) con ?wait=true" || ko "stdin: $(grep -c STDIN "${D}/curl.log")"
grep -q -- "-A DiscordBot (https://dtdcargo.com, 1.0)" "${T}/args" && grep -q -- '-H Content-Type: application/json' "${T}/args" \
  && ok "User-Agent DiscordBot (https://dtdcargo.com, 1.0) y Content-Type JSON" || ko "cabeceras: $(cat "${T}/args")"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  const ok=Array.isArray(j.allowed_mentions.parse)&&j.allowed_mentions.parse.length===0&&Object.keys(j.allowed_mentions).length===1&&j.flags===4&&Object.keys(j).sort().join()==="allowed_mentions,content,flags";
  process.exit(ok?0:1)' "${D}/cuerpo.1" && ok "cuerpo: content, allowed_mentions.parse = [] (ni @everyone ni usuarios suenan) y flags = 4" || ko "cuerpo: $(cat "${D}/cuerpo.1")"
[ "$(contenido 1)" = 'DTD Cargo · publicada 0123abcd en dtdcargo.com (vigilante). @everyone <@123456789012345678>' ] \
  && ok "el texto llega tal cual" || ko "contenido: $(contenido 1)"

reiniciar; texto="$(printf 'comillas "x" \\ barra\tcon tab\r\ny línea\x01 nueva — ñ 🚚')"
printf '%s' "${texto}" | correr
esperado="$(printf 'comillas "x" \\ barra\tcon tab\ny línea nueva — ñ 🚚')"
[ "${RC}" = 0 ] && [ "$(contenido 1)" = "${esperado}" ] && ok "JSON válido con comillas, barra, tab, salto de línea y UTF-8; CR y los demás controles se quitan" \
  || { ko "escape: $(cat "${D}/cuerpo.1" 2>/dev/null)"; ver; }

echo "== recorte a 2.000 =="
validar_recorte() { # $1 = llamada → «bytes unidades» si es UTF-8 válido, «INVÁLIDO» si no
  node -e 'const fs=require("fs");const b=fs.readFileSync(process.argv[1]);const s=b.toString("utf8");
    if(!Buffer.from(s,"utf8").equals(b)){console.log("INVÁLIDO");process.exit(0)}
    const c=JSON.parse(s).content;if(c.includes("�")){console.log("INVÁLIDO");process.exit(0)}
    console.log(Buffer.byteLength(c,"utf8")+" "+c.length+" "+(c.endsWith("…")?"…":"-"))' "${D}/cuerpo.$1"
}
reiniciar; head -c 5000 /dev/zero | tr '\0' 'a' | correr
r="$(validar_recorte 1)"; set -- ${r}
[ "${RC}" = 0 ] && [ "${1:-9999}" -le 2000 ] && [ "${1:-0}" -ge 1990 ] && [ "${3:-}" = "…" ] && ok "5.000 caracteres ASCII: se envían ${1} bytes, terminan en «…»" || { ko "ascii: ${r}"; ver; }
reiniciar; printf 'a%.0s' $(seq 1 2000) | correr
[ "$(contenido 1 | wc -c)" = 2000 ] && ! contenido 1 | grep -q '…' && ok "exactamente 2.000 bytes: va entero, sin «…»" || ko "2000 exactos: $(contenido 1 | wc -c)"
todas=1
for pre in 0 1 2 3; do
  for c in 'ñ' '€' '🚚'; do
    reiniciar
    { head -c "${pre}" /dev/zero | tr '\0' 'x'; for _ in $(seq 1 1100); do printf '%s' "${c}"; done; } | correr
    r="$(validar_recorte 1)"; set -- ${r}
    if [ "${RC}" != 0 ] || [ "${1:-}" = INVÁLIDO ] || [ "${1:-9999}" -gt 2000 ] || [ "${2:-9999}" -gt 2000 ] || [ "${3:-}" != "…" ]; then
      todas=0; ko "recorte con ${pre} ASCII + «${c}»: ${r}"
    fi
  done
done
[ "${todas}" = 1 ] && ok "caracteres de 2, 3 y 4 bytes en cada alineación: UTF-8 válido, ≤ 2.000 bytes y ≤ 2.000 unidades UTF-16"

echo "== 429 y errores =="
reiniciar; config "PUBLICAR_DISCORD_WEBHOOK=${WEB}"
printf '%s\n' '0|429|2|{"retry_after":2}' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 0 ] && [ "$(llamadas)" = 2 ] && grep -qx 'sleep 2' "${D}/sleep.log" && ok "429 con Retry-After 2: espera 2 s, reintenta y entrega" || { ko "429 corto rc=${RC} llamadas=$(llamadas)"; ver; }
[ "$(contenido 2)" = hola ] && ok "el reintento manda el mismo cuerpo" || ko "reintento: $(contenido 2)"
reiniciar; printf '%s\n' '0|429|0.25|' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 0 ] && grep -qx 'sleep 1' "${D}/sleep.log" && ok "Retry-After con decimales: espera al menos 1 s" || { ko "decimales $(cat "${D}/sleep.log")"; ver; }
reiniciar; printf '%s\n' '0|429||' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 0 ] && grep -qx 'sleep 1' "${D}/sleep.log" && ok "429 sin Retry-After: espera 1 s" || { ko "sin retry-after"; ver; }
reiniciar; printf '%s\n' '0|429|60|' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 4 ] && [ "$(llamadas)" = 1 ] && [ ! -s "${D}/sleep.log" ] && grep -q 'pide esperar 60 s' "${T}/salida" \
  && ok "429 con 60 s: no espera, sale 4 (reintentable)" || { ko "429 largo rc=${RC}"; ver; }
reiniciar; printf '%s\n' '0|429|1|' '0|429|1|' '0|429|1|' '0|200||{"id":"123456789012345678"}' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 4 ] && [ "$(llamadas)" = 3 ] && [ "$(grep -c sleep "${D}/sleep.log")" = 2 ] && ok "tres 429 seguidos: 3 intentos y sale 4" || { ko "tres 429 rc=${RC} llamadas=$(llamadas)"; ver; }
for caso in '400|3|rechaz' '401|3|rechaz' '404|3|rechaz' '500|4|HTTP 500' '503|4|HTTP 503'; do
  IFS='|' read -r http esperado palabra <<< "${caso}"
  reiniciar; printf '0|%s||{"message":"x"}\n' "${http}" > "${D}/respuestas"; printf 'hola' | correr
  [ "${RC}" = "${esperado}" ] && [ "$(llamadas)" = 1 ] && grep -q "${palabra}" "${T}/salida" && ok "HTTP ${http}: sale ${esperado}, sin reintentar" || { ko "HTTP ${http} rc=${RC}"; ver; }
done
reiniciar; printf '%s\n' '0|200||' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 5 ] && grep -q 'incierto' "${T}/salida" && ok "200 sin id: incierto (sale 5), no cuenta como entregado" || { ko "200 sin id rc=${RC}"; ver; }
reiniciar; printf '%s\n' '0|204||' > "${D}/respuestas"; printf 'hola' | correr
[ "${RC}" = 5 ] && ok "204 (sin wait): incierto" || { ko "204 rc=${RC}"; ver; }
for caso in '6|4' '7|4' '35|4' '28|5' '52|5' '56|5'; do
  IFS='|' read -r rcc esperado <<< "${caso}"
  reiniciar; printf '%s|000||\n' "${rcc}" > "${D}/respuestas"; printf 'hola' | correr
  [ "${RC}" = "${esperado}" ] && ok "curl sale ${rcc}: el script sale ${esperado}" || { ko "curl ${rcc} rc=${RC}"; ver; }
done
reiniciar; printf ' \n\t ' | correr
[ "${RC}" = 3 ] && [ "$(llamadas)" = 0 ] && grep -q 'texto vacío' "${T}/salida" && ok "texto vacío: no se envía (sale 3)" || { ko "vacío rc=${RC}"; ver; }
reiniciar; correr --probar < /dev/null
[ "${RC}" = 0 ] && contenido 1 | grep -q '^DTD Cargo · prueba de avisos del servidor desde ' && ok "--probar manda el aviso de prueba" || { ko "probar rc=${RC}"; ver; }
reiniciar; correr --otra < /dev/null
[ "${RC}" = 64 ] && ok "un argumento desconocido es error de uso (64)" || { ko "uso rc=${RC}"; ver; }

echo "== la llave no sale =="
! grep -q "${TOKEN}\|/api/webhooks/" "${TODO}" && [ "$(wc -l < "${TODO}")" -gt 40 ] \
  && ok "en $(wc -l < "${TODO}") líneas de salida (con los errores de curl que traían la dirección) no aparece la dirección ni el token" \
  || ko "la dirección apareció en la salida: $(grep -n "${TOKEN}\|/api/webhooks/" "${TODO}" | head -2)"

echo "RESUMEN: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
