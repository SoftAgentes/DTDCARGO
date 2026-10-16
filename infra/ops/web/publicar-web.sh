#!/usr/bin/env bash
# Publicación automática de la web de DTD Cargo en el servidor propio (SDD-0541).
#
#   publicar-web.sh vigilar                          # el timer, cada minuto: sigue :publicable
#   publicar-web.sh publicar <sha> [--aunque-congelado]   # a mano, un commit de main (40 hex)
#   publicar-web.sh volver                           # vuelta atrás a la imagen anterior
#   publicar-web.sh revisar [<sha>]                  # las puertas, sin publicar nada
#   publicar-web.sh congelar "<motivo>" | descongelar
#   publicar-web.sh aceptar-pendiente <migración>    # una espera que va DESPUÉS de la web
#   publicar-web.sh estado
#
# Qué hace `vigilar`: baja ghcr.io/hailuwaycom-sketch/dtdcargo:publicable (la
# etiqueta que mueve el workflow publicable.yml solo con imagen y CI en verde),
# lee el commit de la etiqueta org.opencontainers.image.revision y, si no es lo
# que corre, lo publica:
#   1. puertas: toda migración del commit (etiqueta org.dtdcargo.migraciones)
#      está en el ledger de dtd-cargo-db-1, y los compose y el cron del servidor
#      son los de ese commit (org.dtdcargo.fuera-de-imagen). Si no, se niega y avisa.
#   2. cambia SOLO la línea DTD_WEB_IMAGE del .env (copia previa) a
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
# Salida: 0 al día, publicada o nada que hacer · 1 no se publicó (puerta,
# fallo con vuelta atrás, congelado) · 2 la vuelta atrás falló (queda congelado)
# · 3 uso · 4 entorno (flock, permisos).
set -uo pipefail

IMAGEN=ghcr.io/hailuwaycom-sketch/dtdcargo
ETIQUETA=publicable
PROYECTO=dtd-cargo
HOST_WEB=dtdcargo.com
FUENTE=https://github.com/hailuwaycom-sketch/DTDCARGO
# Si difieren, el servidor quedó atrás del repo y cambiar la imagen no alcanza.
BLOQUEAN="compose.yml compose.supabase.yml cron/Dockerfile cron/crontab cron/entrypoint.sh"

DIR="${PUBLICAR_DIR:-/srv/dtd-cargo}"
OPS="${PUBLICAR_OPS:-/srv/ops/web}"
EVIDENCIAS="${PUBLICAR_EVIDENCIAS:-/srv/ops/evidencias}"
ESTADO="${PUBLICAR_ESTADO:-${OPS}/estado}"
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

MODO="${1:-}"; shift || true
uso() { sed -n '2,10p' "$0"; exit 3; }
[ -n "$MODO" ] || uso

TMP="$(mktemp -d)"; trap 'rm -rf "${TMP}"' EXIT
EVID=""
MOTIVO=""

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
  c="$(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "${TG_TOKEN}" \
    | curl -s -m 20 -o /dev/null -w '%{http_code}' -K - \
        --data-urlencode "chat_id=${CHAT}" --data-urlencode "text=$1" --data-urlencode "disable_web_page_preview=true")"
  log "aviso por Telegram: HTTP ${c:-sin respuesta}"
}
kuma() { # $1 = up | down, $2 = mensaje. En cada vuelta: el monitor también vigila que el timer corra.
  [ -n "${KUMA}" ] || return 0
  printf 'url = "%s"\n' "${KUMA}" | curl -s -m 10 -o /dev/null -G -K - \
    --data-urlencode "status=$1" --data-urlencode "msg=$2" --data-urlencode "ping=" || true
}
avisar_una_vez() { # $1 = clase, $2 = texto. Un aviso por motivo, no uno por minuto.
  local clave; clave="$1|$(printf '%s' "$2" | sha256sum | cut -c1-16)"
  if [ "$(cat "${ESTADO}/ultimo-aviso" 2>/dev/null)" = "${clave}" ]; then log "aviso ya enviado antes: $1"; return 0; fi
  telegram "$2"
  printf '%s\n' "${clave}" > "${ESTADO}/ultimo-aviso"
}
olvidar_aviso() { rm -f "${ESTADO}/ultimo-aviso"; }

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
  MOTIVO="no pude bajar $1 ($(tail -1 "${TMP}/pull" | cut -c1-200))"
  return 1
}
libre_suficiente() {
  local kb; kb="$(df -Pk "${DOCKER_RAIZ}" 2>/dev/null | awk 'NR == 2 { print $4 }')"
  [[ "${kb}" =~ ^[0-9]+$ ]] || { MOTIVO="no pude medir el disco de ${DOCKER_RAIZ}"; return 1; }
  if [ "$((kb / 1048576))" -lt "${MIN_LIBRE}" ]; then
    MOTIVO="quedan $((kb / 1048576)) GB libres en ${DOCKER_RAIZ} (mínimo ${MIN_LIBRE})"; return 1
  fi
}
validar_imagen() { # $1 = referencia local, $2 = revisión, $3 = digest
  [[ "$2" =~ ^[0-9a-f]{40}$ ]] || { MOTIVO="$1 no trae un commit válido en org.opencontainers.image.revision («$(printf '%s' "$2" | cut -c1-60)»)"; return 1; }
  [[ "$3" =~ ^sha256:[0-9a-f]{64}$ ]] || { MOTIVO="$1 no tiene digest de ${IMAGEN}"; return 1; }
  local f; f="$(etiqueta_de "$1" org.opencontainers.image.source)"
  [ "${f,,}" = "${FUENTE,,}" ] || { MOTIVO="$1 no viene de ${FUENTE} (source «${f}»)"; return 1; }
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
    || { MOTIVO="la imagen no trae la etiqueta org.dtdcargo.migraciones (¿construida antes de la SDD-0541?)"; return 1; }
  espera="$(leer_lista "$(etiqueta_de "$1" org.dtdcargo.migraciones-en-espera)")" || espera=""
  db="$(contenedor db)"
  [ -n "${db}" ] || { MOTIVO="la base (servicio db de ${PROYECTO}) no está corriendo: no puedo leer el ledger"; return 1; }
  if ! docker exec -e "PGOPTIONS=-c default_transaction_read_only=on" "${db}" \
      psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 \
      -c "select name from supabase_migrations.schema_migrations where name is not null" > "${TMP}/ledger" 2> "${TMP}/ledger.err"; then
    MOTIVO="no pude leer el ledger ($(tail -1 "${TMP}/ledger.err" | cut -c1-200))"; return 1
  fi
  [ -s "${TMP}/ledger" ] || { MOTIVO="el ledger de la base salió vacío"; return 1; }
  aceptadas="$(cat "${ESTADO}/pendientes-aceptadas" 2>/dev/null)"
  printf '%s\n' "${exig}" | LC_ALL=C sort -u > "${TMP}/exigidas"
  { cat "${TMP}/ledger"; printf '%s\n' "${aceptadas}"; } | tr -d '\r' | LC_ALL=C sort -u > "${TMP}/presentes"
  faltan="$(LC_ALL=C comm -23 "${TMP}/exigidas" "${TMP}/presentes")"
  n="$(grep -c . "${TMP}/exigidas")"
  if [ -n "${faltan}" ]; then
    MOTIVO="faltan en la base $(printf '%s\n' "${faltan}" | grep -c .) de ${n} migraciones:"
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
    || { MOTIVO="la imagen no trae la etiqueta org.dtdcargo.fuera-de-imagen (¿construida antes de la SDD-0541?)"; return 1; }
  fdir="$(envval DTD_FUNCTIONS_DIR)"; fdir="${fdir:-./functions}"
  case "${fdir}" in /*) ;; *) fdir="${DIR}/${fdir#./}" ;; esac
  HUELLAS_FUNCTIONS_DIR="${fdir}" bash "${HUELLAS}" servidor "${DIR}" > "${TMP}/servidor" 2> "${TMP}/huellas.err" \
    || { MOTIVO="no pude calcular las huellas del servidor ($(tail -1 "${TMP}/huellas.err"))"; return 1; }
  for r in ${BLOQUEAN}; do
    grep -q "^${r}=" "${TMP}/esperado" || { MOTIVO="la etiqueta org.dtdcargo.fuera-de-imagen no trae ${r}"; return 1; }
  done
  while IFS='=' read -r r h; do
    [ -n "${r}" ] || continue
    a="$(awk -v r="${r}" '$1 == r { print $2 }' "${TMP}/servidor")"
    [ "${a}" = "${h}" ] && continue
    if grep -q " ${r} " <<< " ${BLOQUEAN} "; then bloqueo="${bloqueo} ${r}"; else AVISOS_HUELLAS="${AVISOS_HUELLAS} ${r}"; fi
  done < "${TMP}/esperado"
  if [ -n "${bloqueo}" ]; then
    MOTIVO="el servidor no tiene la misma copia que el repo en ese commit:${bloqueo}. Copiar infra/dtd-cargo de ese commit a ${DIR} (y, si cambió cron/, reconstruir y reiniciar cron) antes de publicar."
    return 1
  fi
  if [ -n "${AVISOS_HUELLAS}" ]; then log "huellas: difieren (sin frenar):${AVISOS_HUELLAS}"; else log "huellas: compose, cron, functions, plantillas y volúmenes iguales al repo"; fi
}

puertas() { # $1 = referencia local → MOTIVO si alguna niega
  puerta_migraciones "$1" || return 1
  puerta_huellas "$1" || return 1
}

# ─── .env ────────────────────────────────────────────────────────────────────

respaldar_env() {
  local b; b="${DIR}/.env.bak-publicar-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "${DIR}/.env" "${b}" || { MOTIVO="no pude copiar el .env"; return 1; }
  # Se conservan las 10 últimas copias de este script (llevan secretos: no se multiplican).
  find "${DIR}" -maxdepth 1 -name '.env.bak-publicar-*' -printf '%f\n' | LC_ALL=C sort -r | tail -n +11 \
    | while read -r v; do rm -f "${DIR}/${v}"; done
  log "copia del .env: $(basename "${b}")"
}

cambiar_imagen() { # $1 = valor nuevo de DTD_WEB_IMAGE. Solo esa línea; nunca líneas vacías.
  local env="${DIR}/.env" tmp n
  [[ "$1" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { MOTIVO="valor de DTD_WEB_IMAGE inválido: «$1»"; return 1; }
  n="$(grep -c '^DTD_WEB_IMAGE=' "${env}")"
  [ "${n}" = 1 ] || { MOTIVO="el .env tiene ${n} líneas DTD_WEB_IMAGE= (tiene que tener una)"; return 1; }
  tmp="$(mktemp "${DIR}/.env.publicar.XXXXXX")" || { MOTIVO="no pude crear el .env temporal"; return 1; }
  awk -v v="$1" '/^DTD_WEB_IMAGE=/ { print "DTD_WEB_IMAGE=" v; next } { print }' "${env}" > "${tmp}"
  if ! cmp -s <(grep -v '^DTD_WEB_IMAGE=' "${env}") <(grep -v '^DTD_WEB_IMAGE=' "${tmp}") \
     || [ "$(grep -c '' "${env}")" != "$(grep -c '' "${tmp}")" ]; then
    rm -f "${tmp}"; MOTIVO="el .env nuevo cambiaba algo más que DTD_WEB_IMAGE: no se toca"; return 1
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
    MOTIVO="docker compose config falló"; return 1
  fi
  log "docker compose -p ${PROYECTO} -f compose.yml -f compose.supabase.yml up -d --no-deps web"
  if ! ( cd "${DIR}" && "${C[@]}" up -d --no-deps web ) > "${EVID}/compose-up-$3.txt" 2>&1; then
    MOTIVO="docker compose up falló ($(tail -1 "${EVID}/compose-up-$3.txt" | cut -c1-200))"; return 1
  fi
  esperar_web "$2" || { MOTIVO="la web no quedó healthy"; return 1; }
  prueba_rapida "$3-1" && return 0
  sleep "${PAUSA_REINTENTO}"
  prueba_rapida "$3-2" && return 0
  MOTIVO="la prueba rápida falló dos veces (${EVID}/prueba-rapida-$3-2.txt)"
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
  local sha="$1" digest="$2" origen="$3" ref nuevo nuevo_id previo previo_id fallo resumen rc n
  ref="${IMAGEN}@${digest}"
  nuevo="${IMAGEN}:sha-${sha}@${digest}"
  n="$(grep -c '^DTD_WEB_IMAGE=' "${DIR}/.env" 2>/dev/null)"
  if [ "${n:-0}" != 1 ]; then
    MOTIVO="el .env tiene ${n:-0} líneas DTD_WEB_IMAGE= (tiene que tener una): no se toca"
  elif ! puertas "${ref}"; then
    :
  else
    MOTIVO=""
  fi
  if [ -n "${MOTIVO}" ]; then
    log "NO se publica $(corto "${sha}"): ${MOTIVO}"
    avisar_una_vez "puerta|${digest}" "DTD Cargo · NO se publicó $(corto "${sha}") en ${HOST_WEB}: ${MOTIVO} La web sigue con lo que tenía. $(commit_url "${sha}")"
    kuma down "$(corto "${sha}") retenida: ${MOTIVO}"
    return 1
  fi
  previo="$(envval DTD_WEB_IMAGE)"
  [ -n "${previo}" ] || { MOTIVO="DTD_WEB_IMAGE vacía en ${DIR}/.env"; log "${MOTIVO}"; kuma down "${MOTIVO}"; return 1; }
  previo_id="$(imagen_que_corre)"; [ -n "${previo_id}" ] || previo_id="$(id_de "${previo}")"
  nuevo_id="$(id_de "${ref}")"
  abrir_evidencia publicar "${sha}"
  log "== publicar $(corto "${sha}") · origen ${origen} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "commit: $(commit_url "${sha}")"
  log "antes: ${previo}"
  printf '%s\n' "${previo}" > "${EVID}/imagen-antes.txt"
  printf '%s\n' "${nuevo}" > "${EVID}/imagen-nueva.txt"
  cp "${TMP}/exigidas" "${EVID}/migraciones-exigidas.txt" 2>/dev/null
  cp "${TMP}/servidor" "${EVID}/huellas-servidor.txt" 2>/dev/null
  respaldar_env || { log "${MOTIVO}"; cerrar_evidencia; return 1; }
  desplegar "${nuevo}" "${nuevo_id}" nueva; rc=$?
  if [ "${rc}" = 3 ]; then # el .env no se tocó: no hay nada que deshacer
    log "NO se publica $(corto "${sha}"): ${MOTIVO}"
    avisar_una_vez "env|${digest}" "DTD Cargo · NO se publicó $(corto "${sha}"): ${MOTIVO}. No se cambió nada."
    kuma down "$(corto "${sha}") retenida: ${MOTIVO}"
    cerrar_evidencia
    return 1
  fi
  if [ "${rc}" = 0 ]; then
    printf '%s\n' "${previo}" > "${ESTADO}/anterior"
    printf '%s\n' "${nuevo}" > "${ESTADO}/publicada"
    quitar_rechazo "${digest}"
    resumen="$(grep -m1 '^RESUMEN' "${EVID}/prueba-rapida-nueva-1.txt" "${EVID}/prueba-rapida-nueva-2.txt" 2>/dev/null | tail -1 | sed 's/^[^:]*://')"
    log "PUBLICADA $(corto "${sha}")"
    limpiar_imagenes "${nuevo_id}" "${previo_id}"
    olvidar_aviso
    telegram "DTD Cargo · publicada $(corto "${sha}") en ${HOST_WEB} (${origen}). Prueba rápida: ${resumen:-sin resumen}. Antes: $(corto "$(sha_de_ref "${previo}")"). $(commit_url "${sha}")$( [ -n "${AVISOS_HUELLAS}" ] && printf ' · OJO, el servidor difiere del repo en:%s (no frena la web; revisar)' "${AVISOS_HUELLAS}")"
    kuma up "publicada $(corto "${sha}")"
    cerrar_evidencia
    return 0
  fi
  fallo="${MOTIVO}"
  log "FALLÓ $(corto "${sha}"): ${fallo} → vuelta atrás a ${previo}"
  if desplegar "${previo}" "${previo_id}" vuelta; then
    marcar_rechazo "${digest}" "${sha}" "${fallo}"
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
  local rev dig actual motivo
  tomar_candado 0 || { echo "otra publicación en curso: nada que hacer"; return 0; }
  if [ -f "${CONGELADO}" ]; then
    motivo="$(head -1 "${CONGELADO}")"; log "congelado: ${motivo}"; kuma up "congelado: ${motivo}"; return 0
  fi
  if ! libre_suficiente; then
    log "${MOTIVO}"; avisar_una_vez disco "DTD Cargo · publicación automática detenida: ${MOTIVO}."; kuma down "${MOTIVO}"; return 1
  fi
  if ! bajar "${IMAGEN}:${ETIQUETA}"; then
    log "${MOTIVO}"; avisar_una_vez "pull|${ETIQUETA}" "DTD Cargo · ${MOTIVO}. ¿Venció el login de GHCR de root? La web sigue como está."
    kuma down "no pude bajar :${ETIQUETA}"; return 1
  fi
  rev="$(etiqueta_de "${IMAGEN}:${ETIQUETA}" org.opencontainers.image.revision)"
  dig="$(digest_de "${IMAGEN}:${ETIQUETA}")"
  if ! validar_imagen "${IMAGEN}:${ETIQUETA}" "${rev}" "${dig}"; then
    log "${MOTIVO}"; avisar_una_vez imagen "DTD Cargo · :${ETIQUETA} no se publica: ${MOTIVO}"; kuma down "${MOTIVO}"; return 1
  fi
  actual="$(envval DTD_WEB_IMAGE)"
  if al_dia "${actual}" "${rev}" "${dig}"; then log "al día: $(corto "${rev}")"; kuma up "al día $(corto "${rev}")"; return 0; fi
  motivo="$(rechazo_de "${dig}")"
  if [ -n "${motivo}" ]; then
    log "$(corto "${rev}") rechazada antes (${motivo}): espera el próximo merge"; kuma down "$(corto "${rev}") rechazada: ${motivo}"; return 1
  fi
  publicar_imagen "${rev}" "${dig}" vigilante
}

publicar_a_mano() { # $1 = sha, $2 = --aunque-congelado (opcional)
  local sha="${1:-}" rev dig pdig prev rc
  [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || { echo "uso: publicar <sha de main, 40 caracteres hex> (sin prefijos ni etiquetas)" >&2; exit 3; }
  case "${2:-}" in ''|--aunque-congelado) ;; *) echo "argumento desconocido: $2" >&2; exit 3 ;; esac
  tomar_candado 600 || { echo "otra publicación lleva 10 min en curso" >&2; exit 1; }
  if [ -f "${CONGELADO}" ] && [ "${2:-}" != --aunque-congelado ]; then
    echo "congelado: $(head -1 "${CONGELADO}"). Usa --aunque-congelado si es a propósito." >&2; exit 1
  fi
  libre_suficiente || { log "${MOTIVO}"; exit 1; }
  bajar "${IMAGEN}:sha-${sha}" || { log "${MOTIVO}"; exit 1; }
  rev="$(etiqueta_de "${IMAGEN}:sha-${sha}" org.opencontainers.image.revision)"
  dig="$(digest_de "${IMAGEN}:sha-${sha}")"
  [ "${rev}" = "${sha}" ] || { log "la etiqueta sha-${sha} trae el commit ${rev:-ninguno}: no se publica"; exit 1; }
  validar_imagen "${IMAGEN}:sha-${sha}" "${rev}" "${dig}" || { log "${MOTIVO}"; exit 1; }
  publicar_imagen "${sha}" "${dig}" a-mano; rc=$?
  if [ "${rc}" = 0 ] && bajar "${IMAGEN}:${ETIQUETA}"; then
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
  anterior="$(cat "${ESTADO}/anterior" 2>/dev/null)"
  actual="$(envval DTD_WEB_IMAGE)"
  [ -n "${anterior}" ] || { echo "no hay imagen anterior registrada en ${ESTADO}/anterior" >&2; exit 1; }
  [ "${anterior}" != "${actual}" ] || { echo "la imagen anterior es la que ya corre: ${actual}" >&2; exit 1; }
  id_ant="$(id_de "${anterior}")"
  if [ -z "${id_ant}" ]; then bajar "${anterior}" || { echo "${MOTIVO}" >&2; exit 1; }; id_ant="$(id_de "${anterior}")"; fi
  abrir_evidencia volver "$(sha_de_ref "${actual}")"
  log "== vuelta atrás a mano · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "de: ${actual}"; log "a:  ${anterior}"
  [ -f "${CONGELADO}" ] && log "(congelado: la vuelta atrás corre igual)"
  respaldar_env || { log "${MOTIVO}"; cerrar_evidencia; exit 1; }
  if desplegar "${anterior}" "${id_ant}" vuelta; then
    dact="$(digest_de_ref "${actual}")"; [ -n "${dact}" ] || dact="$(digest_de "${actual}")"
    marcar_rechazo "${dact}" "$(sha_de_ref "${actual}")" "vuelta atrás a mano"
    printf '%s\n' "${anterior}" > "${ESTADO}/publicada"
    telegram "DTD Cargo · vuelta atrás a mano: la web volvió a $(corto "$(sha_de_ref "${anterior}")") y pasó la prueba rápida. Evidencia: ${EVID}"
    kuma down "vuelta atrás a mano a $(corto "$(sha_de_ref "${anterior}")")"
    cerrar_evidencia; return 0
  fi
  log "LA VUELTA ATRÁS FALLÓ: ${MOTIVO}"
  printf 'vuelta atrás a mano fallida a %s (%s) · %s\n' "${anterior}" "${MOTIVO}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${CONGELADO}"
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
    printf '%s · %s · %s\n' "$(printf '%s' "$1" | tr '\n' ' ')" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${SUDO_USER:-${USER:-root}}" > "${CONGELADO}"
    log "congelado: $(head -1 "${CONGELADO}")"
    telegram "DTD Cargo · publicación automática congelada: $1"
    ;;
  descongelar)
    [ -f "${CONGELADO}" ] || { echo "no estaba congelado"; exit 0; }
    log "descongelado (estaba: $(head -1 "${CONGELADO}"))"
    rm -f "${CONGELADO}"
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
