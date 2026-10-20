#!/usr/bin/env bash
# Publicación automática de la web de DTD Cargo en el servidor propio (SDD-0541).
#
#   publicar-web.sh vigilar                          # el timer, cada minuto: sigue :publicable
#   publicar-web.sh <sha> [--aunque-congelado]       # a mano, un commit de main (40 hex o sha-<40 hex>)
#   publicar-web.sh publicar <sha> [--aunque-congelado]   # lo mismo, con el subcomando explícito
#   publicar-web.sh volver                           # vuelta atrás a la imagen anterior
#   publicar-web.sh revisar [<sha>]                  # las puertas, sin publicar nada
#   publicar-web.sh congelar "<motivo>" | descongelar
#   publicar-web.sh aceptar-pendiente <migración>    # una espera que va DESPUÉS de la web
#   publicar-web.sh estado
#
# Reemplaza al script interino que la sesión de Contabo dejó en esta misma ruta
# el 2026-10-16 (primera publicación sin Vercel) y conserva su interfaz:
# `publicar-web.sh <sha>`.
#
# Qué hace `vigilar`: baja ghcr.io/hailuwaycom-sketch/dtdcargo:publicable (la
# etiqueta que mueve el workflow publicable.yml solo con imagen y CI en verde),
# lee el commit de la etiqueta org.opencontainers.image.revision y, si no es lo
# que corre, lo publica:
#   1. puertas: toda migración del commit (etiqueta org.dtdcargo.migraciones)
#      está en el ledger de dtd-cargo-db-1; los compose y el cron del servidor
#      son los de ese commit (org.dtdcargo.fuera-de-imagen); y sharp convierte
#      dentro de la imagen (la prueba del Dockerfile, sin red). Si no, se niega y avisa.
#      Antes de eso: si existe compose.ensayo.yml no sigue (como el interino); la
#      imagen anterior (la de la vuelta atrás) tiene que estar en el servidor, y si
#      es la misma que la nueva no hay a dónde volver y no hace nada.
#   2. cambia SOLO la línea DTD_WEB_IMAGE del .env (copia previa; se conservan las
#      3 últimas .env.bak-publicar-*, las demás copias no se tocan) a
#      `…:sha-<sha>@sha256:<digest>`: lo que corre es exactamente lo que se revisó.
#   3. `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web`
#      (nunca cron ni Supabase), espera healthy y corre smoke-web.sh --host dtdcargo.com --www.
#   4. si algo falla, vuelve al valor anterior de DTD_WEB_IMAGE y lo prueba; esa
#      imagen queda rechazada hasta el próximo merge. Si la vuelta atrás también
#      falla, congela la publicación automática y avisa como urgente.
#
# Interruptor: el archivo /srv/ops/web/CONGELADO (`congelar`). Un candado (flock)
# impide dos publicaciones a la vez. Evidencia de cada publicación en
# /srv/ops/evidencias/publicar-web-*/ con SHA256SUMS. Avisos: Telegram y el
# monitor push de Uptime Kuma de /srv/ops/web/publicar.env (root, 600). Nunca
# imprime secretos ni escribe líneas `X=` vacías en el .env.
#
# Estado para el Studio (SDD-0547): al final de vigilar, publicar, volver,
# congelar y descongelar deja /srv/dtd-cargo/estado-publicacion/publicaciones.json
# (644, escrito con mv), que el contenedor web ve en solo lectura y muestra en
# /studio/debug. Solo lleva SHA, horas UTC, códigos de motivo y nombres de
# migración: el texto libre de MOTIVO (rutas, errores de docker o psql) se queda
# en el journal, la evidencia y los avisos.
#
# Salida: 0 al día, publicada o nada que hacer · 1 no se publicó (puerta,
# fallo con vuelta atrás, congelado) · 2 la vuelta atrás falló (queda congelado)
# · 3 uso · 4 entorno (flock, permisos).
set -uo pipefail

IMAGEN=ghcr.io/hailuwaycom-sketch/dtdcargo
ETIQUETA=publicable
PROYECTO=dtd-cargo
HOST_WEB=dtdcargo.com
# Cambio de nombre del perfil (2026-10-20), mismo repo ID 1246490707.
# Dos fuentes exactas: canónica actual y alias para las imágenes históricas.
readonly FUENTE=https://github.com/SoftAgentes/DTDCARGO
readonly FUENTE_HISTORICA=https://github.com/hailuwaycom-sketch/DTDCARGO
# Si difieren, el servidor quedó atrás del repo y cambiar la imagen no alcanza.
BLOQUEAN="compose.yml compose.supabase.yml cron/Dockerfile cron/crontab cron/entrypoint.sh"

DIR="${PUBLICAR_DIR:-/srv/dtd-cargo}"
OPS="${PUBLICAR_OPS:-/srv/ops/web}"
EVIDENCIAS="${PUBLICAR_EVIDENCIAS:-/srv/ops/evidencias}"
ESTADO="${PUBLICAR_ESTADO:-${OPS}/estado}"
# Dentro del directorio del compose: lo monta `./estado-publicacion` en el web.
ESTADO_WEB="${PUBLICAR_ESTADO_WEB:-${DIR}/estado-publicacion}"
CONGELADO="${PUBLICAR_CONGELADO:-${OPS}/CONGELADO}"
CANDADO="${PUBLICAR_CANDADO:-/run/lock/dtd-cargo-publicar.lock}"
CONFIG="${PUBLICAR_CONFIG:-${OPS}/publicar.env}"
SMOKE="${PUBLICAR_SMOKE:-${OPS}/smoke-web.sh}"
HUELLAS="${PUBLICAR_HUELLAS:-${OPS}/huellas-fuera-de-imagen.sh}"
DOCKER_RAIZ="${PUBLICAR_DOCKER_RAIZ:-/var/lib/docker}"
ESPERA_SALUD="${PUBLICAR_ESPERA_SALUD:-150}"
PASO_SALUD="${PUBLICAR_PASO_SALUD:-3}"
PAUSA_REINTENTO="${PUBLICAR_PAUSA_REINTENTO:-15}"
C=(docker compose -p "${PROYECTO}" -f compose.yml -f compose.supabase.yml)

# La misma prueba que corre el Dockerfile en la etapa build: sin libvips,
# /_next/image sirve las fotos sin optimizar (ensayo del 2026-10-14).
PRUEBA_SHARP="require('sharp')({create:{width:4,height:4,channels:3,background:'#ffffff'}}).webp().toBuffer().then((b)=>{if(!b.length)process.exit(1);console.log('sharp OK, webp de prueba:',b.length,'bytes')}).catch((e)=>{console.error(e);process.exit(1)})"

MODO="${1:-}"; shift || true
uso() { sed -n '2,11p' "$0"; exit 3; }
[ -n "$MODO" ] || uso
# Interfaz del interino: `publicar-web.sh <sha>` es `publicar <sha>`.
if [[ "${MODO}" =~ ^(sha-)?[0-9a-f]{40}$ ]]; then set -- "${MODO#sha-}" "$@"; MODO=publicar; fi

ESCRIBIR_ESTADO=0   # 1 cuando el subcomando deja el estado para el Studio al salir
TMP="$(mktemp -d)"
# Al salir, el estado para el Studio; nunca cambia el código de salida.
trap 'rc_salida=$?; [ "${ESCRIBIR_ESTADO}" = 1 ] && escribir_estado_web; rm -rf "${TMP}"; exit "${rc_salida}"' EXIT
EVID=""
MOTIVO=""
CODIGO=""     # el código de MOTIVO que ve el Studio (SDD-0547 §4.4); MOTIVO no sale del servidor
FALTAN=""     # con CODIGO=migraciones: las que faltan, una por línea
VIG_ESTADO="" # cómo terminó esta vuelta del vigilante (SDD-0547 §4.2) y su código
VIG_MOTIVO=""
PUBLICADA=0   # 1 solo si esta corrida cambió la web (no en «ya corre esa imagen»)

# ─── utilidades ──────────────────────────────────────────────────────────────

log() {
  local l; l="[$(date -u +%H:%M:%SZ)] $*"
  printf '%s\n' "$l"
  if [ -n "${EVID}" ]; then printf '%s\n' "$l" >> "${EVID}/salida.txt"; fi
  return 0
}
sin_comillas() { sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/" | tr -d '\r'; }
conf() { [ -f "${CONFIG}" ] || return 0; grep -E "^$1=" "${CONFIG}" | tail -1 | cut -d= -f2- | sin_comillas; }
envval() { grep -E "^$1=" "${DIR}/.env" 2>/dev/null | tail -1 | cut -d= -f2- | sin_comillas; }
corto() { printf '%s' "${1:0:8}"; }
sha_de_ref() { printf '%s' "$1" | sed -nE 's/.*:sha-([0-9a-f]{40})(@sha256:[0-9a-f]{64})?$/\1/p'; }
digest_de_ref() { printf '%s' "$1" | sed -nE 's/.*@(sha256:[0-9a-f]{64})$/\1/p'; }
commit_url() { printf '%s/commit/%s' "${FUENTE}" "$1"; }

cargar_config() {
  CHAT="$(conf PUBLICAR_TELEGRAM_CHAT_ID)"
  TG_TOKEN="$(conf PUBLICAR_TELEGRAM_BOT_TOKEN)"
  [ -n "${TG_TOKEN}" ] || TG_TOKEN="$(envval TELEGRAM_BOT_TOKEN)"
  KUMA="$(conf PUBLICAR_KUMA_PUSH_URL)"; KUMA="${KUMA%%\?*}"
  CONSERVAR="$(conf PUBLICAR_CONSERVAR_IMAGENES)"; CONSERVAR="${CONSERVAR:-5}"
  MIN_LIBRE="$(conf PUBLICAR_MIN_LIBRE_GB)"; MIN_LIBRE="${MIN_LIBRE:-10}"
  COPIAS_ENV="$(conf PUBLICAR_CONSERVAR_COPIAS_ENV)"; COPIAS_ENV="${COPIAS_ENV:-3}"
  [[ "${COPIAS_ENV}" =~ ^[0-9]+$ ]] && [ "${COPIAS_ENV}" -ge 1 ] || COPIAS_ENV=3
  [[ "${CONSERVAR}" =~ ^[0-9]+$ ]] && [ "${CONSERVAR}" -ge 2 ] || CONSERVAR=5
  [[ "${MIN_LIBRE}" =~ ^[0-9]+$ ]] || MIN_LIBRE=10
  install -d -m 700 "${ESTADO}" 2>/dev/null || { echo "no puedo crear ${ESTADO}" >&2; exit 4; }
}

abrir_evidencia() { # $1 = tipo, $2 = sha
  EVID="${EVIDENCIAS}/publicar-web-$(date -u +%Y%m%dT%H%M%SZ)-$1-$(corto "$2")"
  install -d -m 700 "${EVID}" || { echo "no puedo crear ${EVID}" >&2; exit 4; }
}
cerrar_evidencia() { # Después de SHA256SUMS ya no se escribe nada en la carpeta.
  [ -n "${EVID}" ] || return 0
  log "evidencia: ${EVID}"
  ( cd "${EVID}" && find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\0' | LC_ALL=C sort -z | xargs -0 -r sha256sum > SHA256SUMS )
  EVID=""
}

# ─── avisos ──────────────────────────────────────────────────────────────────

telegram() { # $1 = texto. El token viaja por stdin (-K -), nunca en la línea de comandos.
  if [ -z "${CHAT}" ] || [ -z "${TG_TOKEN}" ]; then log "aviso por Telegram: sin configurar"; return 0; fi
  local c
  # Telegram corta en 4096 caracteres: con muchas migraciones faltantes el motivo
  # completo no entra (la lista entera queda en la salida, es decir en el journal).
  c="$(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "${TG_TOKEN}" \
    | curl -s -m 20 -o /dev/null -w '%{http_code}' -K - \
        --data-urlencode "chat_id=${CHAT}" --data-urlencode "text=${1:0:3500}" --data-urlencode "disable_web_page_preview=true")"
  log "aviso por Telegram: HTTP ${c:-sin respuesta}"
}
kuma() { # $1 = up | down, $2 = mensaje. En cada vuelta: el monitor también vigila que el timer corra.
  [ -n "${KUMA}" ] || return 0
  printf 'url = "%s"\n' "${KUMA}" | curl -s -m 10 -o /dev/null -G -K - \
    --data-urlencode "status=$1" --data-urlencode "msg=${2:0:200}" --data-urlencode "ping=" || true
}
avisar_una_vez() { # $1 = clase, $2 = texto. Un aviso por motivo, no uno por minuto.
  local clave; clave="$1|$(printf '%s' "$2" | sha256sum | cut -c1-16)"
  if [ "$(cat "${ESTADO}/ultimo-aviso" 2>/dev/null)" = "${clave}" ]; then log "aviso ya enviado antes: $1"; return 0; fi
  telegram "$2"
  printf '%s\n' "${clave}" > "${ESTADO}/ultimo-aviso"
}
olvidar_aviso() { rm -f "${ESTADO}/ultimo-aviso" "${ESTADO}/ultimo-retenida"; }

# ─── estado para el Studio (SDD-0547) ────────────────────────────────────────
# ${ESTADO_WEB}/publicaciones.json, versión 1 del contrato de
# docs/specs/0547-panel-publicaciones-servidor/spec.md §4. Cada valor tiene una
# forma fija (SHA de 40 hex, hora UTC, código de una lista cerrada, nombre de
# migración, true/false), así que alcanza con printf y no hace falta jq. Nada
# de MOTIVO entra: es texto libre (rutas, errores de docker o de psql).

CODIGOS=" migraciones ledger huellas sharp etiquetas imagen descarga disco ensayo env sin-vuelta-atras salud prueba-rapida compose rechazada otro "
MAX_HISTORIAL=20   # los que muestra el panel; el archivo del servidor guarda 200
es_sha() { [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]]; }
hora_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
json_sha() { if es_sha "${1:-}"; then printf '"%s"' "$1"; else printf 'null'; fi; }
json_codigo() { # vacío → null; uno que no está en la lista → «otro»
  [ -n "${1:-}" ] || { printf 'null'; return; }
  case "${CODIGOS}" in *" $1 "*) printf '"%s"' "$1" ;; *) printf '"otro"' ;; esac
}
json_faltan() { # una por línea → ["0300_a","0301_b"]: solo nombres válidos, sin repetir, como máximo 50
  printf '['
  printf '%s\n' "${1:-}" | tr ' ' '\n' | grep -E '^[0-9]{4}[a-z]?_[a-z0-9_]{1,80}$' | awk '!visto[$0]++' | head -50 \
    | awk '{ printf "%s\"%s\"", (NR > 1 ? "," : ""), $0 }'
  printf ']'
}

evento() { # $1 = resultado, $2 = sha, $3 = origen, $4 = código (vacío = null). Una línea del historial.
  local linea
  es_sha "$2" || { log "historial: «$1» sin un commit válido, no se anota"; return 1; }
  linea="{\"hora\":\"$(hora_utc)\",\"sha\":\"$2\",\"origen\":\"$3\",\"resultado\":\"$1\",\"motivo\":$(json_codigo "$4")"
  [ "$4" = migraciones ] && linea="${linea},\"faltan\":$(json_faltan "${FALTAN}")"
  printf '%s}\n' "${linea}" >> "${ESTADO}/historial.jsonl"
  tail -n 200 "${ESTADO}/historial.jsonl" > "${ESTADO}/historial.tmp" && mv -f "${ESTADO}/historial.tmp" "${ESTADO}/historial.jsonl"
}
retenida_una_vez() { # $1 = clase, $2 = texto del aviso, $3 = sha, $4 = origen. La misma clave que avisar_una_vez:
  local clave                                     # un evento por motivo, no uno por minuto.
  clave="$1|$(printf '%s' "$2" | sha256sum | cut -c1-16)"
  if [ "$(cat "${ESTADO}/ultimo-retenida" 2>/dev/null)" = "${clave}" ]; then return 0; fi
  evento retenida "$3" "$4" "${CODIGO}" && printf '%s\n' "${clave}" > "${ESTADO}/ultimo-retenida"
}

FORMA_VIGILANTE='^\{"estado":"(al-dia|retenida|detenido|congelado)","motivo":(null|"[a-z-]+"),"faltan":\[["0-9a-z_,]*\]\}$'
estado_vigilante() { # el objeto «vigilante»: el de esta vuelta, o el que dejó la última
  local v
  if [ "${MODO}" = vigilar ] && [ -n "${VIG_ESTADO}" ]; then
    case "${VIG_ESTADO}" in retenida|detenido) v="$(json_codigo "${VIG_MOTIVO}")" ;; *) v=null ;; esac
    v="{\"estado\":\"${VIG_ESTADO}\",\"motivo\":${v},\"faltan\":$([ "${VIG_MOTIVO}" = migraciones ] && json_faltan "${FALTAN}" || printf '[]')}"
    printf '%s\n' "${v}" > "${ESTADO}/vigilante.json"
  else
    v="$(head -1 "${ESTADO}/vigilante.json" 2>/dev/null)"
  fi
  # Lo que vuelve del disco se revisa igual: solo la forma que escribe este script.
  [[ "${v}" =~ ${FORMA_VIGILANTE} ]] || v=null
  printf '%s' "${v}"
}

escribir_estado_web() { # Lo llama la trampa de salida. Si falla, lo dice y sigue: nunca cambia el código de salida.
  local vig cong hist tmp
  vig="$(estado_vigilante)"
  cong=null
  if [ -f "${CONGELADO}" ]; then
    # Automático solo si la marca es de este congelamiento (no más vieja que CONGELADO).
    cong="{\"desde\":\"$(date -u -r "${CONGELADO}" +%Y-%m-%dT%H:%M:%SZ)\",\"automatico\":$([ -f "${ESTADO}/congelado-automatico" ] && [ ! "${ESTADO}/congelado-automatico" -ot "${CONGELADO}" ] && printf true || printf false)}"
    vig='{"estado":"congelado","motivo":null,"faltan":[]}'
  elif [[ "${vig}" == '{"estado":"congelado"'* ]]; then
    vig=null # se descongeló después de la última vuelta: lo dice el vigilante en el próximo minuto
  fi
  hist="$(grep -E '^\{"hora":"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z","sha":"[0-9a-f]{40}","origen":"(vigilante|a-mano)","resultado":"[a-z-]+","motivo":(null|"[a-z-]+")(,"faltan":\[["0-9a-z_,]*\])?\}$' "${ESTADO}/historial.jsonl" 2>/dev/null \
    | tail -n "${MAX_HISTORIAL}" | tac | paste -sd, -)"
  install -d -m 755 "${ESTADO_WEB}" 2>/dev/null && chmod 755 "${ESTADO_WEB}" 2>/dev/null \
    || { log "estado para el Studio: no pude crear ${ESTADO_WEB}"; return 0; }
  tmp="$(mktemp "${ESTADO_WEB}/.publicaciones.XXXXXX" 2>/dev/null)" || { log "estado para el Studio: no pude crear el temporal"; return 0; }
  # mktemp crea en 600 y el web corre como node: sin el chmod no podría leerlo.
  if printf '{"version":1,"actualizado":"%s","corre":%s,"anterior":%s,"publicable":%s,"congelado":%s,"vigilante":%s,"historial":[%s]}\n' \
       "$(hora_utc)" \
       "$(json_sha "$(sha_de_ref "$(envval DTD_WEB_IMAGE)")")" \
       "$(json_sha "$(sha_de_ref "$(cat "${ESTADO}/anterior" 2>/dev/null)")")" \
       "$(json_sha "$(etiqueta_de "${IMAGEN}:${ETIQUETA}" org.opencontainers.image.revision)")" \
       "${cong}" "${vig}" "${hist}" > "${tmp}" \
     && chmod 644 "${tmp}" && mv -f "${tmp}" "${ESTADO_WEB}/publicaciones.json"; then
    return 0
  fi
  rm -f "${tmp}"; log "estado para el Studio: no pude escribir ${ESTADO_WEB}/publicaciones.json"
  return 0
}

# ─── docker ──────────────────────────────────────────────────────────────────

tomar_candado() { # $1 = segundos de espera (0 = no esperar)
  command -v flock >/dev/null 2>&1 || { echo "falta flock (util-linux)" >&2; exit 4; }
  exec 9>"${CANDADO}" || { echo "no puedo abrir el candado ${CANDADO}" >&2; exit 4; }
  if [ "$1" = 0 ]; then flock -n 9; else flock -w "$1" 9; fi
}
etiqueta_de() { docker image inspect -f "{{index .Config.Labels \"$2\"}}" "$1" 2>/dev/null; }
id_de() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null; }
digest_de() {
  docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$1" 2>/dev/null \
    | grep -m1 "^${IMAGEN}@sha256:" | cut -d@ -f2
}
contenedor() {
  docker ps -q --filter "label=com.docker.compose.project=${PROYECTO}" --filter "label=com.docker.compose.service=$1" | head -1
}
imagen_que_corre() { local id; id="$(contenedor web)"; [ -n "${id}" ] && docker inspect -f '{{.Image}}' "${id}" 2>/dev/null; }
bajar() { # $1 = referencia
  if timeout 600 docker pull -q "$1" > "${TMP}/pull" 2>&1; then return 0; fi
  MOTIVO="no pude bajar $1 ($(tail -1 "${TMP}/pull" | cut -c1-200))"; CODIGO=descarga
  return 1
}
sin_ensayo() { # Como el interino: con el override del ensayo de la web puesto, no se publica.
  [ ! -f "${DIR}/compose.ensayo.yml" ] || { MOTIVO="hay un compose.ensayo.yml en ${DIR}: no sigo (el override del ensayo de la web sigue puesto)"; CODIGO=ensayo; return 1; }
}
libre_suficiente() {
  local kb; kb="$(df -Pk "${DOCKER_RAIZ}" 2>/dev/null | awk 'NR == 2 { print $4 }')"
  [[ "${kb}" =~ ^[0-9]+$ ]] || { MOTIVO="no pude medir el disco de ${DOCKER_RAIZ}"; CODIGO=disco; return 1; }
  if [ "$((kb / 1048576))" -lt "${MIN_LIBRE}" ]; then
    MOTIVO="quedan $((kb / 1048576)) GB libres en ${DOCKER_RAIZ} (mínimo ${MIN_LIBRE})"; CODIGO=disco; return 1
  fi
}
validar_imagen() { # $1 = referencia local, $2 = revisión, $3 = digest
  [[ "$2" =~ ^[0-9a-f]{40}$ ]] || { MOTIVO="$1 no trae un commit válido en org.opencontainers.image.revision («$(printf '%s' "$2" | cut -c1-60)»)"; CODIGO=imagen; return 1; }
  [[ "$3" =~ ^sha256:[0-9a-f]{64}$ ]] || { MOTIVO="$1 no tiene digest de ${IMAGEN}"; CODIGO=imagen; return 1; }
  local f; f="$(etiqueta_de "$1" org.opencontainers.image.source)"
  [[ "${f,,}" = "${FUENTE,,}" || "${f,,}" = "${FUENTE_HISTORICA,,}" ]] || { MOTIVO="$1 no viene de ${FUENTE} ni de su alias histórico ${FUENTE_HISTORICA} (source «${f}»)"; CODIGO=imagen; return 1; }
}

# ─── puertas ─────────────────────────────────────────────────────────────────

leer_lista() { # «v1:<n>:a,b» → una por línea. 1 si falta o no cuadra el conteo.
  local v="$1" n resto
  case "${v}" in v1:*) ;; *) return 1 ;; esac
  resto="${v#v1:}"; n="${resto%%:*}"; resto="${resto#*:}"
  [[ "${n}" =~ ^[0-9]+$ ]] || return 1
  if [ "${n}" = 0 ]; then [ -z "${resto}" ]; return; fi
  printf '%s' "${resto}" | tr ',' '\n' > "${TMP}/lista"; echo >> "${TMP}/lista"
  [ "$(grep -c . "${TMP}/lista")" = "${n}" ] || return 1
  grep . "${TMP}/lista"
}

puerta_migraciones() { # $1 = referencia local
  local exig espera db aceptadas faltan n
  exig="$(leer_lista "$(etiqueta_de "$1" org.dtdcargo.migraciones)")" \
    || { MOTIVO="la imagen no trae la etiqueta org.dtdcargo.migraciones (¿construida antes de la SDD-0541?)"; CODIGO=etiquetas; return 1; }
  espera="$(leer_lista "$(etiqueta_de "$1" org.dtdcargo.migraciones-en-espera)")" || espera=""
  db="$(contenedor db)"
  [ -n "${db}" ] || { MOTIVO="la base (servicio db de ${PROYECTO}) no está corriendo: no puedo leer el ledger"; CODIGO=ledger; return 1; }
  if ! docker exec -e "PGOPTIONS=-c default_transaction_read_only=on" "${db}" \
      psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 \
      -c "select name from supabase_migrations.schema_migrations where name is not null" > "${TMP}/ledger" 2> "${TMP}/ledger.err"; then
    MOTIVO="no pude leer el ledger ($(tail -1 "${TMP}/ledger.err" | cut -c1-200))"; CODIGO=ledger; return 1
  fi
  [ -s "${TMP}/ledger" ] || { MOTIVO="el ledger de la base salió vacío"; CODIGO=ledger; return 1; }
  aceptadas="$(cat "${ESTADO}/pendientes-aceptadas" 2>/dev/null)"
  printf '%s\n' "${exig}" | LC_ALL=C sort -u > "${TMP}/exigidas"
  { cat "${TMP}/ledger"; printf '%s\n' "${aceptadas}"; } | tr -d '\r' | LC_ALL=C sort -u > "${TMP}/presentes"
  faltan="$(LC_ALL=C comm -23 "${TMP}/exigidas" "${TMP}/presentes")"
  n="$(grep -c . "${TMP}/exigidas")"
  if [ -n "${faltan}" ]; then
    MOTIVO="faltan en la base $(printf '%s\n' "${faltan}" | grep -c .) de ${n} migraciones:"; CODIGO=migraciones; FALTAN="${faltan}"
    local m
    for m in ${faltan}; do
      if grep -qx "${m}" <<< "${espera}"; then
        MOTIVO="${MOTIVO} ${m} (declarada como espera: si va DESPUÉS de la web, con el OK de Sam: publicar-web.sh aceptar-pendiente ${m});"
      else
        MOTIVO="${MOTIVO} ${m};"
      fi
    done
    MOTIVO="${MOTIVO} Una PR migrate-first no llega a la web antes que su migración."
    return 1
  fi
  log "puerta de migraciones: las ${n} exigidas están en el ledger ($(printf '%s\n' "${aceptadas}" | grep -c .) aceptadas a mano)"
}

AVISOS_HUELLAS=""
puerta_huellas() { # $1 = referencia local
  local esperado fdir r h a bloqueo=""
  AVISOS_HUELLAS=""
  esperado="$(etiqueta_de "$1" org.dtdcargo.fuera-de-imagen)"
  leer_lista "${esperado}" > "${TMP}/esperado" \
    || { MOTIVO="la imagen no trae la etiqueta org.dtdcargo.fuera-de-imagen (¿construida antes de la SDD-0541?)"; CODIGO=etiquetas; return 1; }
  fdir="$(envval DTD_FUNCTIONS_DIR)"; fdir="${fdir:-./functions}"
  case "${fdir}" in /*) ;; *) fdir="${DIR}/${fdir#./}" ;; esac
  HUELLAS_FUNCTIONS_DIR="${fdir}" bash "${HUELLAS}" servidor "${DIR}" > "${TMP}/servidor" 2> "${TMP}/huellas.err" \
    || { MOTIVO="no pude calcular las huellas del servidor ($(tail -1 "${TMP}/huellas.err"))"; CODIGO=huellas; return 1; }
  for r in ${BLOQUEAN}; do
    grep -q "^${r}=" "${TMP}/esperado" || { MOTIVO="la etiqueta org.dtdcargo.fuera-de-imagen no trae ${r}"; CODIGO=etiquetas; return 1; }
  done
  while IFS='=' read -r r h; do
    [ -n "${r}" ] || continue
    a="$(awk -v r="${r}" '$1 == r { print $2 }' "${TMP}/servidor")"
    [ "${a}" = "${h}" ] && continue
    if grep -q " ${r} " <<< " ${BLOQUEAN} "; then bloqueo="${bloqueo} ${r}"; else AVISOS_HUELLAS="${AVISOS_HUELLAS} ${r}"; fi
  done < "${TMP}/esperado"
  if [ -n "${bloqueo}" ]; then
    MOTIVO="el servidor no tiene la misma copia que el repo en ese commit:${bloqueo}. Copiar infra/dtd-cargo de ese commit a ${DIR} (y, si cambió cron/, reconstruir y reiniciar cron) antes de publicar."; CODIGO=huellas
    return 1
  fi
  if [ -n "${AVISOS_HUELLAS}" ]; then log "huellas: difieren (sin frenar):${AVISOS_HUELLAS}"; else log "huellas: compose, cron, functions, plantillas y volúmenes iguales al repo"; fi
}

prueba_sharp() { # $1 = referencia local. Dentro de la imagen, sin red y con su usuario (node).
  # A diferencia del interino (solo `require`), convierte de verdad a WebP: es lo
  # que hace /_next/image.
  if timeout 120 docker run --rm --network none --entrypoint node -w /app "$1" -e "${PRUEBA_SHARP}" > "${TMP}/sharp" 2>&1; then
    log "sharp: $(tail -1 "${TMP}/sharp" | cut -c1-80)"; return 0
  fi
  MOTIVO="sharp no convierte dentro de la imagen ($(tail -1 "${TMP}/sharp" | cut -c1-160)): /_next/image serviría las fotos sin optimizar"; CODIGO=sharp
  return 1
}

puertas() { # $1 = referencia local → MOTIVO si alguna niega
  puerta_migraciones "$1" || return 1
  puerta_huellas "$1" || return 1
  prueba_sharp "$1" || return 1
}

# ─── .env ────────────────────────────────────────────────────────────────────

respaldar_env() { # Copia previa del .env. Nunca muestra su contenido.
  local b; b="${DIR}/.env.bak-publicar-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "${DIR}/.env" "${b}" || { MOTIVO="no pude copiar el .env"; CODIGO=env; return 1; }
  # Llevan secretos: de las copias de publicación (prefijo .env.bak-publicar-,
  # también las del script interino) se conservan las ${COPIAS_ENV} últimas. Las
  # demás copias del .env (.env.bak-vacias-*, .env.bak-ensayo-*…) no se tocan.
  find "${DIR}" -maxdepth 1 -type f -name '.env.bak-publicar-*' -printf '%f\n' | LC_ALL=C sort -r \
    | tail -n "+$((COPIAS_ENV + 1))" | while read -r v; do rm -f "${DIR}/${v}"; done
  log "copia del .env: $(basename "${b}") (se conservan las ${COPIAS_ENV} últimas de publicación)"
}

cambiar_imagen() { # $1 = valor nuevo de DTD_WEB_IMAGE. Solo esa línea; nunca líneas vacías.
  local env="${DIR}/.env" tmp n
  [[ "$1" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { MOTIVO="valor de DTD_WEB_IMAGE inválido: «$1»"; CODIGO=env; return 1; }
  n="$(grep -c '^DTD_WEB_IMAGE=' "${env}")"
  [ "${n}" = 1 ] || { MOTIVO="el .env tiene ${n} líneas DTD_WEB_IMAGE= (tiene que tener una)"; CODIGO=env; return 1; }
  tmp="$(mktemp "${DIR}/.env.publicar.XXXXXX")" || { MOTIVO="no pude crear el .env temporal"; CODIGO=env; return 1; }
  awk -v v="$1" '/^DTD_WEB_IMAGE=/ { print "DTD_WEB_IMAGE=" v; next } { print }' "${env}" > "${tmp}"
  if ! cmp -s <(grep -v '^DTD_WEB_IMAGE=' "${env}") <(grep -v '^DTD_WEB_IMAGE=' "${tmp}") \
     || [ "$(grep -c '' "${env}")" != "$(grep -c '' "${tmp}")" ]; then
    rm -f "${tmp}"; MOTIVO="el .env nuevo cambiaba algo más que DTD_WEB_IMAGE: no se toca"; CODIGO=env; return 1
  fi
  chmod 600 "${tmp}"; chown --reference="${env}" "${tmp}" 2>/dev/null || true
  mv -f "${tmp}" "${env}"
  log "DTD_WEB_IMAGE=$1"
}

# ─── publicar ────────────────────────────────────────────────────────────────

esperar_web() { # $1 = id de imagen esperado
  local t=0 id="" st="" img=""
  while [ "${t}" -le "${ESPERA_SALUD}" ]; do
    id="$(contenedor web)"
    if [ -n "${id}" ]; then
      img="$(docker inspect -f '{{.Image}}' "${id}" 2>/dev/null)"
      st="$(docker inspect -f '{{.State.Health.Status}}' "${id}" 2>/dev/null)"
      if [ "${img}" = "$1" ]; then
        [ "${st}" = healthy ] && { log "web healthy a los ${t} s"; return 0; }
        [ "${st}" = unhealthy ] && break
      fi
    fi
    sleep "${PASO_SALUD}"; t=$((t + PASO_SALUD))
    [ "${PASO_SALUD}" = 0 ] && t=$((t + 1))
  done
  log "web: ${st:-sin contenedor} con la imagen ${img:-?} (se esperaba $1) a los ${t} s"
  return 1
}

prueba_rapida() { # $1 = nombre del intento
  local f="${EVID}/prueba-rapida-$1.txt" rc
  "${SMOKE}" --host "${HOST_WEB}" --www > "${f}" 2>&1; rc=$?
  log "prueba rápida $1: $(grep -m1 '^RESUMEN' "${f}" || echo 'sin resumen') (código ${rc})"
  return "${rc}"
}

desplegar() { # $1 = valor de DTD_WEB_IMAGE, $2 = id esperado, $3 = nueva | vuelta → 0 bien · 3 no cambió nada · 1 falló
  cambiar_imagen "$1" || return 3
  if ! ( cd "${DIR}" && "${C[@]}" config -q ) > "${EVID}/compose-config-$3.txt" 2>&1; then
    MOTIVO="docker compose config falló"; CODIGO=compose; return 1
  fi
  log "docker compose -p ${PROYECTO} -f compose.yml -f compose.supabase.yml up -d --no-deps web"
  if ! ( cd "${DIR}" && "${C[@]}" up -d --no-deps web ) > "${EVID}/compose-up-$3.txt" 2>&1; then
    MOTIVO="docker compose up falló ($(tail -1 "${EVID}/compose-up-$3.txt" | cut -c1-200))"; CODIGO=compose; return 1
  fi
  esperar_web "$2" || { MOTIVO="la web no quedó healthy"; CODIGO=salud; return 1; }
  prueba_rapida "$3-1" && return 0
  sleep "${PAUSA_REINTENTO}"
  prueba_rapida "$3-2" && return 0
  MOTIVO="la prueba rápida falló dos veces (${EVID}/prueba-rapida-$3-2.txt)"; CODIGO=prueba-rapida
  return 1
}

marcar_rechazo() { # $1 = digest, $2 = sha, $3 = motivo
  [ -n "$1" ] || return 0
  quitar_rechazo "$1"
  printf '%s %s %s\n' "$1" "${2:--}" "$(printf '%s' "$3" | tr '\n' ' ')" >> "${ESTADO}/rechazados"
}
rechazo_de() { grep -m1 "^$1 " "${ESTADO}/rechazados" 2>/dev/null | cut -d' ' -f3-; }
quitar_rechazo() {
  [ -f "${ESTADO}/rechazados" ] || return 0
  grep -v "^$1 " "${ESTADO}/rechazados" > "${ESTADO}/rechazados.tmp"; mv -f "${ESTADO}/rechazados.tmp" "${ESTADO}/rechazados"
}

limpiar_imagenes() { # $@ = ids que no se tocan. Solo imágenes de ${IMAGEN}; las demás, nunca.
  local n=0 id r protegidas
  protegidas="$(printf '%s\n' "$@")"
  docker images --no-trunc --format '{{.ID}}' "${IMAGEN}" 2>/dev/null | awk '!visto[$0]++' > "${TMP}/imagenes"
  while read -r id; do
    [ -n "${id}" ] || continue
    n=$((n + 1))
    if [ "${n}" -le "${CONSERVAR}" ] || grep -qx "${id}" <<< "${protegidas}"; then continue; fi
    docker image inspect -f '{{range .RepoTags}}{{println .}}{{end}}{{range .RepoDigests}}{{println .}}{{end}}' "${id}" 2>/dev/null \
      | grep . > "${TMP}/refs"
    while read -r r; do
      if docker rmi "${r}" > /dev/null 2>&1; then log "imagen vieja borrada: ${r}"; else log "no se borró ${r} (¿en uso?)"; break; fi
    done < "${TMP}/refs"
  done < "${TMP}/imagenes"
}

publicar_imagen() { # $1 = sha, $2 = digest, $3 = origen (vigilante | a-mano)
  local sha="$1" digest="$2" origen="$3" ref nuevo nuevo_id previo previo_id corria_id fallo fallo_codigo resumen rc n aviso
  ref="${IMAGEN}@${digest}"
  nuevo="${IMAGEN}:sha-${sha}@${digest}"
  nuevo_id="$(id_de "${ref}")"
  corria_id="$(imagen_que_corre)"
  previo="$(envval DTD_WEB_IMAGE)"
  MOTIVO=""; CODIGO=""; FALTAN=""
  n="$(grep -c '^DTD_WEB_IMAGE=' "${DIR}/.env" 2>/dev/null)"
  if [ "${n:-0}" != 1 ]; then
    MOTIVO="el .env tiene ${n:-0} líneas DTD_WEB_IMAGE= (tiene que tener una): no se toca"; CODIGO=env
  elif [ -z "${previo}" ]; then
    MOTIVO="DTD_WEB_IMAGE vacía en ${DIR}/.env: no habría a dónde volver"; CODIGO=env
  else
    # La vuelta atrás es el valor anterior de DTD_WEB_IMAGE: su imagen tiene que
    # estar en el servidor ANTES de publicar (se baja si hace falta).
    previo_id="$(id_de "${previo}")"
    if [ -z "${previo_id}" ] && bajar "${previo}"; then previo_id="$(id_de "${previo}")"; fi
    if [ -z "${previo_id}" ]; then
      MOTIVO="la imagen anterior (${previo}) no está en el servidor y no se pudo bajar: no habría vuelta atrás"; CODIGO=sin-vuelta-atras
    elif [ "${previo_id}" = "${nuevo_id}" ]; then
      log "ya corre esa imagen (${previo}): no hay a dónde volver, así que no hago nada"
      kuma up "al día $(corto "${sha}")"
      return 0
    elif ! puertas "${ref}"; then
      :
    fi
  fi
  if [ -n "${MOTIVO}" ]; then
    log "NO se publica $(corto "${sha}"): ${MOTIVO}"
    aviso="DTD Cargo · NO se publicó $(corto "${sha}") en ${HOST_WEB}: ${MOTIVO} La web sigue con lo que tenía. $(commit_url "${sha}")"
    avisar_una_vez "puerta|${digest}" "${aviso}"
    retenida_una_vez "puerta|${digest}" "${aviso}" "${sha}" "${origen}"
    kuma down "$(corto "${sha}") retenida: ${MOTIVO}"
    return 1
  fi
  abrir_evidencia publicar "${sha}"
  log "== publicar $(corto "${sha}") · origen ${origen} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "commit: $(commit_url "${sha}")"
  log "antes: ${previo}"
  printf '%s\n' "${previo}" > "${EVID}/imagen-antes.txt"
  printf '%s\n' "${nuevo}" > "${EVID}/imagen-nueva.txt"
  cp "${TMP}/exigidas" "${EVID}/migraciones-exigidas.txt" 2>/dev/null
  cp "${TMP}/servidor" "${EVID}/huellas-servidor.txt" 2>/dev/null
  cp "${TMP}/sharp" "${EVID}/sharp.txt" 2>/dev/null
  respaldar_env || { log "${MOTIVO}"; cerrar_evidencia; return 1; }
  desplegar "${nuevo}" "${nuevo_id}" nueva; rc=$?
  if [ "${rc}" = 3 ]; then # el .env no se tocó: no hay nada que deshacer
    log "NO se publica $(corto "${sha}"): ${MOTIVO}"
    aviso="DTD Cargo · NO se publicó $(corto "${sha}"): ${MOTIVO}. No se cambió nada."
    avisar_una_vez "env|${digest}" "${aviso}"
    retenida_una_vez "env|${digest}" "${aviso}" "${sha}" "${origen}"
    kuma down "$(corto "${sha}") retenida: ${MOTIVO}"
    cerrar_evidencia
    return 1
  fi
  if [ "${rc}" = 0 ]; then
    PUBLICADA=1
    printf '%s\n' "${previo}" > "${ESTADO}/anterior"
    printf '%s\n' "${nuevo}" > "${ESTADO}/publicada"
    quitar_rechazo "${digest}"
    resumen="$(grep -m1 '^RESUMEN' "${EVID}/prueba-rapida-nueva-1.txt" "${EVID}/prueba-rapida-nueva-2.txt" 2>/dev/null | tail -1 | sed 's/^[^:]*://')"
    log "PUBLICADA $(corto "${sha}")"
    evento publicada "${sha}" "${origen}" ""
    # Nunca la vigente (la nueva) ni la anterior a ella (la de la vuelta atrás y la
    # que corría): las protege por id, no por fecha.
    limpiar_imagenes "${nuevo_id}" "${previo_id}" "${corria_id}"
    olvidar_aviso
    telegram "DTD Cargo · publicada $(corto "${sha}") en ${HOST_WEB} (${origen}). Prueba rápida: ${resumen:-sin resumen}. Antes: $(corto "$(sha_de_ref "${previo}")"). $(commit_url "${sha}")$( [ -n "${AVISOS_HUELLAS}" ] && printf ' · OJO, el servidor difiere del repo en:%s (no frena la web; revisar)' "${AVISOS_HUELLAS}")"
    kuma up "publicada $(corto "${sha}")"
    cerrar_evidencia
    return 0
  fi
  fallo="${MOTIVO}"; fallo_codigo="${CODIGO}"
  log "FALLÓ $(corto "${sha}"): ${fallo} → vuelta atrás a ${previo}"
  if desplegar "${previo}" "${previo_id}" vuelta; then
    marcar_rechazo "${digest}" "${sha}" "${fallo}"
    evento vuelta-atras "${sha}" "${origen}" "${fallo_codigo}"
    printf '%s\n' "${previo}" > "${ESTADO}/publicada"
    log "vuelta atrás bien: la web sigue en $(corto "$(sha_de_ref "${previo}")"); $(corto "${sha}") queda rechazada"
    olvidar_aviso
    telegram "DTD Cargo · vuelta atrás: $(corto "${sha}") falló (${fallo}). La web volvió a $(corto "$(sha_de_ref "${previo}")") y pasó la prueba rápida. Se publica sola de nuevo con el próximo merge. Evidencia: ${EVID}"
    kuma down "$(corto "${sha}") falló y volvió: ${fallo}"
    cerrar_evidencia
    return 1
  fi
  log "LA VUELTA ATRÁS FALLÓ: ${MOTIVO}"
  printf 'vuelta atrás fallida a %s (%s) · %s · automático\n' "${previo}" "${MOTIVO}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${CONGELADO}"
  touch "${ESTADO}/congelado-automatico"
  # El motivo del evento es el de la versión nueva: es lo que desató todo (el de
  # la vuelta atrás queda en el aviso urgente y en la evidencia).
  evento vuelta-atras-fallida "${sha}" "${origen}" "${fallo_codigo}"
  telegram "URGENTE · DTD Cargo: falló la publicación de $(corto "${sha}") (${fallo}) y TAMBIÉN la vuelta atrás a $(corto "$(sha_de_ref "${previo}")") (${MOTIVO}). Publicación automática CONGELADA. Revisar ${HOST_WEB} ya. Evidencia: ${EVID}"
  kuma down "URGENTE: vuelta atrás fallida"
  cerrar_evidencia
  return 2
}

# ─── subcomandos ─────────────────────────────────────────────────────────────

al_dia() { # $1 = valor actual, $2 = revisión, $3 = digest
  local d; d="$(digest_de_ref "$1")"
  if [ -n "${d}" ]; then [ "${d}" = "$3" ]; else [ "$(sha_de_ref "$1")" = "$2" ]; fi
}

vigilar() {
  local rev dig actual motivo rc
  tomar_candado 0 || { echo "otra publicación en curso: nada que hacer"; return 0; }
  ESCRIBIR_ESTADO=1
  if [ -f "${CONGELADO}" ]; then
    motivo="$(head -1 "${CONGELADO}")"; log "congelado: ${motivo}"; kuma up "congelado: ${motivo}"; VIG_ESTADO=congelado; return 0
  fi
  if ! sin_ensayo; then
    log "${MOTIVO}"; avisar_una_vez ensayo "DTD Cargo · publicación automática detenida: ${MOTIVO}."; kuma down "${MOTIVO}"; detenido; return 1
  fi
  if ! libre_suficiente; then
    log "${MOTIVO}"; avisar_una_vez disco "DTD Cargo · publicación automática detenida: ${MOTIVO}."; kuma down "${MOTIVO}"; detenido; return 1
  fi
  if ! bajar "${IMAGEN}:${ETIQUETA}"; then
    log "${MOTIVO}"; avisar_una_vez "pull|${ETIQUETA}" "DTD Cargo · ${MOTIVO}. ¿Venció el login de GHCR de root? La web sigue como está."
    kuma down "no pude bajar :${ETIQUETA}"; detenido; return 1
  fi
  rev="$(etiqueta_de "${IMAGEN}:${ETIQUETA}" org.opencontainers.image.revision)"
  dig="$(digest_de "${IMAGEN}:${ETIQUETA}")"
  if ! validar_imagen "${IMAGEN}:${ETIQUETA}" "${rev}" "${dig}"; then
    log "${MOTIVO}"; avisar_una_vez imagen "DTD Cargo · :${ETIQUETA} no se publica: ${MOTIVO}"; kuma down "${MOTIVO}"; detenido; return 1
  fi
  actual="$(envval DTD_WEB_IMAGE)"
  if al_dia "${actual}" "${rev}" "${dig}"; then log "al día: $(corto "${rev}")"; kuma up "al día $(corto "${rev}")"; VIG_ESTADO=al-dia; return 0; fi
  motivo="$(rechazo_de "${dig}")"
  if [ -n "${motivo}" ]; then
    log "$(corto "${rev}") rechazada antes (${motivo}): espera el próximo merge"; kuma down "$(corto "${rev}") rechazada: ${motivo}"
    VIG_ESTADO=retenida; VIG_MOTIVO=rechazada; return 1
  fi
  publicar_imagen "${rev}" "${dig}" vigilante; rc=$?
  case "${rc}" in
    0) VIG_ESTADO=al-dia ;;                              # publicada, o ya corría
    1) VIG_ESTADO=retenida; VIG_MOTIVO="${CODIGO}" ;;    # puerta, .env o falla con vuelta atrás
    *) VIG_ESTADO=congelado ;;                           # la vuelta atrás falló: quedó congelado
  esac
  return "${rc}"
}
detenido() { VIG_ESTADO=detenido; VIG_MOTIVO="${CODIGO}"; } # la vuelta no llegó a evaluar :publicable

publicar_a_mano() { # $1 = sha, $2 = --aunque-congelado (opcional)
  local sha="${1:-}" rev dig pdig prev rc
  sha="${sha#sha-}"
  [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || { echo "uso: publicar <sha de main, 40 caracteres hex> (sin prefijos ni etiquetas)" >&2; exit 3; }
  case "${2:-}" in ''|--aunque-congelado) ;; *) echo "argumento desconocido: $2" >&2; exit 3 ;; esac
  tomar_candado 600 || { echo "otra publicación lleva 10 min en curso" >&2; exit 1; }
  ESCRIBIR_ESTADO=1
  if [ -f "${CONGELADO}" ] && [ "${2:-}" != --aunque-congelado ]; then
    echo "congelado: $(head -1 "${CONGELADO}"). Usa --aunque-congelado si es a propósito." >&2; exit 1
  fi
  sin_ensayo || { log "${MOTIVO}"; exit 1; }
  libre_suficiente || { log "${MOTIVO}"; exit 1; }
  bajar "${IMAGEN}:sha-${sha}" || { log "${MOTIVO}"; exit 1; }
  rev="$(etiqueta_de "${IMAGEN}:sha-${sha}" org.opencontainers.image.revision)"
  dig="$(digest_de "${IMAGEN}:sha-${sha}")"
  [ "${rev}" = "${sha}" ] || { log "la etiqueta sha-${sha} trae el commit ${rev:-ninguno}: no se publica"; exit 1; }
  validar_imagen "${IMAGEN}:sha-${sha}" "${rev}" "${dig}" || { log "${MOTIVO}"; exit 1; }
  publicar_imagen "${sha}" "${dig}" a-mano; rc=$?
  if [ "${rc}" = 0 ] && [ "${PUBLICADA}" = 1 ] && bajar "${IMAGEN}:${ETIQUETA}"; then
    # Para que el vigilante no la pise en el próximo minuto: la :publicable de
    # ahora queda rechazada y la automática vuelve con el próximo merge.
    pdig="$(digest_de "${IMAGEN}:${ETIQUETA}")"; prev="$(etiqueta_de "${IMAGEN}:${ETIQUETA}" org.opencontainers.image.revision)"
    if [ -n "${pdig}" ] && [ "${pdig}" != "${dig}" ]; then
      marcar_rechazo "${pdig}" "${prev}" "reemplazada a mano por ${sha:0:8}"
      log ":${ETIQUETA} ($(corto "${prev}")) no se publica sola hasta el próximo merge"
    fi
  fi
  return "${rc}"
}

volver() {
  local anterior actual id_ant dact
  tomar_candado 600 || { echo "otra publicación lleva 10 min en curso" >&2; exit 1; }
  ESCRIBIR_ESTADO=1
  anterior="$(cat "${ESTADO}/anterior" 2>/dev/null)"
  actual="$(envval DTD_WEB_IMAGE)"
  sin_ensayo || { echo "${MOTIVO}" >&2; exit 1; }
  [ -n "${anterior}" ] || { echo "no hay imagen anterior registrada en ${ESTADO}/anterior" >&2; exit 1; }
  [ "${anterior}" != "${actual}" ] || { echo "la imagen anterior es la que ya corre (${actual}): no hay a dónde volver, no hago nada" >&2; exit 1; }
  id_ant="$(id_de "${anterior}")"
  if [ -z "${id_ant}" ]; then bajar "${anterior}" || { echo "${MOTIVO}" >&2; exit 1; }; id_ant="$(id_de "${anterior}")"; fi
  if [ "${id_ant}" = "$(imagen_que_corre)" ]; then
    echo "la imagen anterior (${anterior}) es la misma que corre: no hay a dónde volver, no hago nada" >&2; exit 1
  fi
  abrir_evidencia volver "$(sha_de_ref "${actual}")"
  log "== vuelta atrás a mano · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "de: ${actual}"; log "a:  ${anterior}"
  [ -f "${CONGELADO}" ] && log "(congelado: la vuelta atrás corre igual)"
  respaldar_env || { log "${MOTIVO}"; cerrar_evidencia; exit 1; }
  if desplegar "${anterior}" "${id_ant}" vuelta; then
    dact="$(digest_de_ref "${actual}")"; [ -n "${dact}" ] || dact="$(digest_de "${actual}")"
    marcar_rechazo "${dact}" "$(sha_de_ref "${actual}")" "vuelta atrás a mano"
    printf '%s\n' "${anterior}" > "${ESTADO}/publicada"
    evento vuelta-atras-a-mano "$(sha_de_ref "${anterior}")" a-mano ""
    telegram "DTD Cargo · vuelta atrás a mano: la web volvió a $(corto "$(sha_de_ref "${anterior}")") y pasó la prueba rápida. Evidencia: ${EVID}"
    kuma down "vuelta atrás a mano a $(corto "$(sha_de_ref "${anterior}")")"
    cerrar_evidencia; return 0
  fi
  log "LA VUELTA ATRÁS FALLÓ: ${MOTIVO}"
  printf 'vuelta atrás a mano fallida a %s (%s) · %s\n' "${anterior}" "${MOTIVO}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${CONGELADO}"
  touch "${ESTADO}/congelado-automatico"   # lo congeló el script, no una persona
  evento vuelta-atras-fallida "$(sha_de_ref "${anterior}")" a-mano "${CODIGO}"
  telegram "URGENTE · DTD Cargo: la vuelta atrás a $(corto "$(sha_de_ref "${anterior}")") falló (${MOTIVO}). Publicación automática CONGELADA. Evidencia: ${EVID}"
  kuma down "URGENTE: vuelta atrás fallida"
  cerrar_evidencia; return 2
}

revisar() { # $1 = sha (opcional; si no, :publicable)
  local ref rev dig
  if [ -n "${1:-}" ]; then
    [[ "$1" =~ ^[0-9a-f]{40}$ ]] || { echo "uso: revisar [<sha de 40 hex>]" >&2; exit 3; }
    ref="${IMAGEN}:sha-$1"
  else
    ref="${IMAGEN}:${ETIQUETA}"
  fi
  bajar "${ref}" || { echo "${MOTIVO}"; return 1; }
  rev="$(etiqueta_de "${ref}" org.opencontainers.image.revision)"; dig="$(digest_de "${ref}")"
  validar_imagen "${ref}" "${rev}" "${dig}" || { echo "NO: ${MOTIVO}"; return 1; }
  echo "imagen: ${ref} → commit ${rev} · ${dig}"
  echo "corre:  $(envval DTD_WEB_IMAGE)"
  if puertas "${IMAGEN}@${dig}"; then echo "PUERTAS: pasan (publicable)"; return 0; fi
  echo "PUERTAS: NO · ${MOTIVO}"; return 1
}

estado() {
  echo "corre:       $(envval DTD_WEB_IMAGE)"
  echo "anterior:    $(cat "${ESTADO}/anterior" 2>/dev/null || echo '(ninguna registrada)')"
  echo "publicable:  $(etiqueta_de "${IMAGEN}:${ETIQUETA}" org.opencontainers.image.revision 2>/dev/null || true) (copia local, sin bajar)"
  if [ -f "${CONGELADO}" ]; then echo "CONGELADO:   $(head -1 "${CONGELADO}")"; else echo "congelado:   no"; fi
  local n; n="$(grep -c . "${ESTADO}/rechazados" 2>/dev/null)"
  echo "rechazadas:  ${n:-0}"
  if [ -f "${ESTADO}/rechazados" ]; then sed 's/^/  /' "${ESTADO}/rechazados"; fi
  echo "esperas aceptadas a mano: $(tr '\n' ' ' < "${ESTADO}/pendientes-aceptadas" 2>/dev/null)"
  echo "Telegram:    $([ -n "${CHAT}" ] && [ -n "${TG_TOKEN}" ] && echo configurado || echo 'SIN CONFIGURAR')"
  echo "Uptime Kuma: $([ -n "${KUMA}" ] && echo configurado || echo 'SIN CONFIGURAR')"
  echo "última evidencia: $(find "${EVIDENCIAS}" -maxdepth 1 -name 'publicar-web-*' -printf '%f\n' 2>/dev/null | LC_ALL=C sort | tail -1)"
}

cargar_config
case "${MODO}" in
  vigilar) vigilar ;;
  publicar) publicar_a_mano "$@" ;;
  volver) volver ;;
  revisar) revisar "$@" ;;
  estado) estado ;;
  congelar)
    [ -n "${1:-}" ] || { echo 'uso: congelar "<motivo>"' >&2; exit 3; }
    ESCRIBIR_ESTADO=1
    printf '%s · %s · %s\n' "$(printf '%s' "$1" | tr '\n' ' ')" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${SUDO_USER:-${USER:-root}}" > "${CONGELADO}"
    rm -f "${ESTADO}/congelado-automatico"   # este lo congeló una persona
    log "congelado: $(head -1 "${CONGELADO}")"
    telegram "DTD Cargo · publicación automática congelada: $1"
    ;;
  descongelar)
    [ -f "${CONGELADO}" ] || { echo "no estaba congelado"; exit 0; }
    ESCRIBIR_ESTADO=1
    log "descongelado (estaba: $(head -1 "${CONGELADO}"))"
    rm -f "${CONGELADO}" "${ESTADO}/congelado-automatico"
    telegram "DTD Cargo · publicación automática descongelada: vuelve a seguir :${ETIQUETA}"
    ;;
  aceptar-pendiente)
    [[ "${1:-}" =~ ^[0-9]{4}[a-z]?_[a-z0-9_]+$ ]] || { echo "uso: aceptar-pendiente <nombre exacto de la migración, sin .sql>" >&2; exit 3; }
    if grep -qx "$1" "${ESTADO}/pendientes-aceptadas" 2>/dev/null; then echo "ya estaba aceptada: $1"; exit 0; fi
    printf '%s\n' "$1" >> "${ESTADO}/pendientes-aceptadas"
    printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${SUDO_USER:-${USER:-root}}" >> "${ESTADO}/aceptadas.log"
    log "aceptada: $1 puede faltar en la base al publicar (va después de la web)"
    ;;
  -h|--help|ayuda) uso ;;
  *) echo "subcomando desconocido: ${MODO}" >&2; uso ;;
esac
