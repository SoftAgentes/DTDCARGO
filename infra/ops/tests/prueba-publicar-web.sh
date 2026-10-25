#!/usr/bin/env bash
# infra/ops/tests/prueba-publicar-web.sh — prueba de infra/ops/web/publicar-web.sh,
# de huellas-fuera-de-imagen.sh y de las unidades de systemd (SDD-0541).
#
#   bash infra/ops/tests/prueba-publicar-web.sh               # la prueba
#   bash infra/ops/tests/prueba-publicar-web.sh --mutantes    # control rojo + mutantes del diff
#   MUTANTES_SOLO="disco|sharp" bash … --mutantes             # solo los mutantes cuyo nombre contiene alguno
#   MUTANTES_PARTE=1/2 bash … --mutantes                      # la mitad impar (y 2/2 la par), para dos contenedores
#
# No toca Docker, GHCR, Telegram ni Kuma: `docker`, `curl` y la prueba rápida son
# dobles con estado en un directorio temporal (el doble de docker resuelve
# etiquetas y digests, mueve etiquetas al bajar y recrea el web leyendo el .env,
# como compose). El proyecto es una copia de infra/dtd-cargo armada como en el
# servidor, así que también prueba que las huellas del repo y las del servidor
# coinciden. Necesita Linux (flock de util-linux): en Windows, dentro de un
# contenedor, por ejemplo
#   docker run --rm -v "$PWD":/repo -w /repo node:24 bash infra/ops/tests/prueba-publicar-web.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "${S}/../.." && pwd)"
SCRIPT="${PUBLICAR_WEB_SH:-${S}/web/publicar-web.sh}"
HUELLAS="${S}/web/huellas-fuera-de-imagen.sh"
UNITS="${REPO}/infra/dtd-cargo/systemd"
IMG=ghcr.io/hailuwaycom-sketch/dtdcargo

if [ "${1:-}" = --mutantes ]; then
  # Cada mutante quita una garantía. Si la suite sigue verde, falta una prueba
  # (o sobra el código): mutante que sobrevive.
  ORIG="${S}/web/publicar-web.sh"
  M="$(mktemp -d)"; trap 'rm -rf "${M}"' EXIT
  vivos=0; muertos=0
  correr_suite() { PUBLICAR_WEB_SH="$1" bash "${BASH_SOURCE[0]}" > "${M}/suite.log" 2>&1; }
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/control.sh"
  if correr_suite "${M}/control.sh"; then echo "CONTROL ROJO FALLÓ: la suite pasa contra un script que no hace nada"; exit 1; fi
  echo "control rojo: contra un script vacío la suite falla ($(grep -c '^FALLÓ' "${M}/suite.log") FALLÓ)"
  indice=0
  mutar() { # $1 = nombre, $2 = texto exacto, $3 = reemplazo. MUTANTES_SOLO="a|b" corre solo los que nombran a o b.
    local n s hay=0
    # MUTANTES_PARTE=k/n: solo uno de cada n (el k-ésimo), para repartir en paralelo.
    indice=$((indice + 1))
    if [ -n "${MUTANTES_PARTE:-}" ] && [ $(( (indice - 1) % ${MUTANTES_PARTE#*/} + 1 )) != "${MUTANTES_PARTE%/*}" ]; then return; fi
    IFS='|' read -ra solos <<< "${MUTANTES_SOLO:-}"
    [ "${#solos[@]}" = 0 ] && hay=1
    for s in "${solos[@]}"; do case "$1" in *"${s}"*) hay=1 ;; esac; done
    [ "${hay}" = 1 ] || return
    # `--`: un texto que empieza con guion (`--entrypoint…`) no es una opción de perl.
    n="$(perl -0ne 'BEGIN { $a = shift } $c = () = /\Q$a\E/g; print $c' -- "$2" "${ORIG}")"
    [ "${n}" = 1 ] || { echo "MUTANTE MAL ARMADO «$1»: el texto aparece ${n} veces"; vivos=$((vivos + 1)); return; }
    perl -0pe 'BEGIN { $a = shift; $b = shift } s/\Q$a\E/$b/' -- "$2" "$3" "${ORIG}" > "${M}/mutante.sh"
    if correr_suite "${M}/mutante.sh"; then
      echo "VIVO   · $1"; vivos=$((vivos + 1))
    else
      echo "MUERTO · $1 ($(grep '^FALLÓ' "${M}/suite.log" | head -1 | cut -c1-90))"; muertos=$((muertos + 1))
    fi
  }
  mutar "sin puerta de migraciones" 'puerta_migraciones "$1" || return 1' 'true'
  mutar "las esperas aceptadas no cuentan" '{ cat "${TMP}/ledger"; printf' '{ cat "${TMP}/ledger"; true || printf'
  mutar "compose y cron no frenan" 'BLOQUEAN="compose.yml compose.supabase.yml cron/Dockerfile cron/crontab cron/entrypoint.sh"' 'BLOQUEAN=""'
  mutar "sin --no-deps" 'up -d --no-deps web ) >' 'up -d web ) >'
  mutar "sin vuelta atrás" 'if desplegar "${previo}" "${previo_id}" vuelta; then' 'if false; then'
  mutar "la fallida no queda rechazada" '    marcar_rechazo "${digest}" "${sha}" "${fallo}"' '    true'
  mutar "sin candado" 'if [ "$1" = 0 ]; then flock -n 9;' 'if [ "$1" = 0 ]; then true;'
  mutar "sin interruptor" "  if [ -f \"\${CONGELADO}\" ]; then
    motivo=" "  if false; then
    motivo="
  mutar "acepta un sha corto" '[[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || { echo "uso: publicar' '[[ "${sha}" =~ ^[0-9a-f]+$ ]] || { echo "uso: publicar'
  mutar "no compara el commit de la etiqueta" '[ "${rev}" = "${sha}" ] || {' 'true || {'
  mutar "no comprueba el origen" '[ "${f,,}" = "${FUENTE,,}" ] ||' 'true ||'
  mutar "avisa cada minuto" 'if [ "$(cat "${ESTADO}/ultimo-aviso" 2>/dev/null)" = "${clave}" ]; then' 'if false; then'
  mutar "sin copia del .env" 'cp -p "${DIR}/.env" "${b}" ||' 'true ||'
  mutar "cambiar_imagen acepta dos líneas DTD_WEB_IMAGE" '[ "${n}" = 1 ] || { MOTIVO="el .env tiene' 'true || { MOTIVO="el .env tiene'
  mutar "sin el chequeo previo del .env" 'if [ "${n:-0}" != 1 ]; then' 'if false; then'
  mutar "un .env roto dispara la vuelta atrás" 'if [ "${rc}" = 3 ]; then' 'if false; then'
  mutar "nunca está al día" 'if [ -n "${d}" ]; then [ "${d}" = "$3" ]; else' 'if true; then false; else'
  mutar "borra la imagen anterior" '|| grep -qx "${id}" <<< "${protegidas}"; then continue; fi' '; then continue; fi'
  mutar "sin chequeo de disco" 'if ! libre_suficiente; then
    log "${MOTIVO}"; avisar_una_vez disco' 'if false; then
    log "${MOTIVO}"; avisar_una_vez disco'
  mutar "no espera healthy" 'esperar_web "$2" || { MOTIVO="la web no quedó healthy"; CODIGO=salud; return 1; }' 'true'
  mutar "sin prueba de sharp" 'prueba_sharp "$1" || return 1' 'true'
  mutar "sharp con red" 'docker run --rm --network none --entrypoint node' 'docker run --rm --entrypoint node'
  mutar "sin la interfaz del interino" 'if [[ "${MODO}" =~ ^(sha-)?[0-9a-f]{40}$ ]]; then set -- "${MODO#sha-}" "$@"; MODO=publicar; fi' ':'
  mutar "sharp solo require" "PRUEBA_SHARP=\"require('sharp')({create:" "PRUEBA_SHARP=\"require('sharp');//({create:"
  mutar "sharp fuera de /app" '--entrypoint node -w /app "$1"' '--entrypoint node "$1"'
  mutar "conserva todas las copias del .env" 'tail -n "+$((COPIAS_ENV + 1))"' 'tail -n "+999"'
  mutar "borra copias del .env ajenas" "-name '.env.bak-publicar-*'" "-name '.env.bak-*'"
  mutar "republica la misma imagen" 'elif [ "${previo_id}" = "${nuevo_id}" ]; then' 'elif false; then'
  mutar "publica sin imagen anterior" 'if [ -z "${previo_id}" ]; then
      MOTIVO="la imagen anterior' 'if false; then
      MOTIVO="la imagen anterior'
  mutar "no baja la anterior que falta" 'if [ -z "${previo_id}" ] && bajar "${previo}"; then' 'if false; then'
  mutar "la limpieza borra la vigente" 'limpiar_imagenes "${nuevo_id}" "${previo_id}" "${corria_id}"' 'limpiar_imagenes "${previo_id}" "${corria_id}"'
  mutar "la limpieza borra la anterior" 'limpiar_imagenes "${nuevo_id}" "${previo_id}" "${corria_id}"' 'limpiar_imagenes "${nuevo_id}"'
  mutar "sin la negativa del ensayo" '[ ! -f "${DIR}/compose.ensayo.yml" ] ||' 'true ||'
  mutar "el no-op deja :publicable rechazada" 'if [ "${rc}" = 0 ] && [ "${PUBLICADA}" = 1 ] && bajar' 'if [ "${rc}" = 0 ] && bajar'
  mutar "volver a la misma imagen" 'if [ "${id_ant}" = "$(imagen_que_corre)" ]; then' 'if false; then'
  mutar "Telegram sin recorte" '"text=${1:0:3500}"' '"text=$1"'
  mutar "Kuma sin recorte" '"msg=${2:0:200}"' '"msg=$2"'
  mutar "publica a mano y el vigilante la pisa" '      marcar_rechazo "${pdig}" "${prev}"' '      true "${pdig}" "${prev}"'
  # SDD-0547: el estado para el Studio.
  mutar "estado sin chmod 644" 'chmod 644 "${tmp}" && mv -f' 'true && mv -f'
  mutar "estado escrito en el sitio (sin mv)" 'mv -f "${tmp}" "${ESTADO_WEB}/publicaciones.json"' 'cat "${tmp}" > "${ESTADO_WEB}/publicaciones.json" && rm -f "${tmp}"'
  mutar "retenida cada minuto" 'if [ "$(cat "${ESTADO}/ultimo-retenida" 2>/dev/null)" = "${clave}" ]; then return 0; fi' ':'
  mutar "texto libre al historial" '\"motivo\":$(json_codigo "$4")"' '\"motivo\":\"${MOTIVO}\""'
  mutar "historial sin tope" '| tail -n "${MAX_HISTORIAL}" | tac' '| tail -n 200 | tac'
  mutar "faltantes sin tope" "| awk '!visto[\$0]++' | head -50" "| awk '!visto[\$0]++'"
  mutar "vigilar no escribe el estado" '  tomar_candado 0 || { echo "otra publicación en curso: nada que hacer"; return 0; }
  ESCRIBIR_ESTADO=1' '  tomar_candado 0 || { echo "otra publicación en curso: nada que hacer"; return 0; }'
  mutar "escribe sin el candado" 'ESCRIBIR_ESTADO=0   # 1 cuando' 'ESCRIBIR_ESTADO=1   # 1 cuando'
  mutar "congelado siempre automático" '[ ! "${ESTADO}/congelado-automatico" -ot "${CONGELADO}" ]' 'true'
  mutar "el vigilante guardado sin revisar" '[[ "${v}" =~ ${FORMA_VIGILANTE} ]] || v=null' 'true'
  mutar "la fallida lleva el motivo de la vuelta" 'evento vuelta-atras-fallida "${sha}" "${origen}" "${fallo_codigo}"' 'evento vuelta-atras-fallida "${sha}" "${origen}" "${CODIGO}"'
  mutar "la rechazada sin su código" 'VIG_ESTADO=retenida; VIG_MOTIVO=rechazada; return 1' 'VIG_ESTADO=retenida; return 1'
  echo "RESULTADO MUTANTES: ${muertos} muertos · ${vivos} vivos"
  [ "${vivos}" = 0 ]; exit
fi

command -v flock >/dev/null 2>&1 || { echo "NO DISPONIBLE: falta flock (util-linux); corre esta prueba en Linux"; exit 1; }
T="$(mktemp -d)"
trap 'kill "${PID_CANDADO:-0}" 2>/dev/null; rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
hx() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
A="$(hx commit-a | cut -c1-40)"; B="$(hx commit-b | cut -c1-40)"; X="$(hx commit-x | cut -c1-40)"
IA="$(hx id-a)"; IB="$(hx id-b)"; IX="$(hx id-x)"
DA="sha256:$(hx dig-a)"; DB="sha256:$(hx dig-b)"; DX="sha256:$(hx dig-x)"

# ─── dobles ──────────────────────────────────────────────────────────────────
mkdir -p "${T}/bin"
cat > "${T}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
# Doble de docker con estado en $DOBLE. Solo lo que usa publicar-web.sh.
D="${DOBLE:?}"; IMG=ghcr.io/hailuwaycom-sketch/dtdcargo
printf '%s\n' "$*" >> "$D/llamadas.log"
clave() { printf '%s' "$1" | tr '/:@' '___'; }
resolver() { # referencia local → id
  local ref="$1" id
  case "$ref" in
    sha256:*) id="${ref#sha256:}"; [ -f "$D/img/$id/local" ] && echo "$id" ;;
    *@sha256:*) for id in $(ls "$D/img"); do [ -f "$D/img/$id/local" ] && [ "$(cat "$D/img/$id/digest")" = "${ref##*@}" ] && { echo "$id"; return; }; done ;;
    *:*) for id in $(ls "$D/img"); do [ -f "$D/img/$id/local" ] && grep -qx "${ref##*:}" "$D/img/$id/tags" 2>/dev/null && { echo "$id"; return; }; done ;;
  esac
}
case "$1" in
  pull)
    ref="${*: -1}"
    [ "$(cat "$D/rc-pull" 2>/dev/null || echo 0)" = 0 ] || { echo "Error response from daemon: denied" >&2; exit 1; }
    [ -f "$D/reg/$(clave "$ref")" ] || { echo "Error response from daemon: manifest unknown" >&2; exit 1; }
    id="$(cat "$D/reg/$(clave "$ref")")"; touch "$D/img/$id/local"
    case "$ref" in *@*) ;; *:*)
      t="${ref##*:}"
      for o in $(ls "$D/img"); do [ -f "$D/img/$o/tags" ] && { grep -vx "$t" "$D/img/$o/tags" > "$D/t"; mv "$D/t" "$D/img/$o/tags"; }; done
      echo "$t" >> "$D/img/$id/tags" ;;
    esac
    echo "$ref" ;;
  image)
    [ "$2" = inspect ] && [ "$3" = -f ] || exit 9
    fmt="$4"; id="$(resolver "$5")"
    [ -n "$id" ] || { echo "Error: No such image: $5" >&2; exit 1; }
    case "$fmt" in
      '{{.Id}}') echo "sha256:$id" ;;
      '{{index .Config.Labels "'*'"}}')
        k="$(printf '%s' "$fmt" | sed -E 's/^\{\{index \.Config\.Labels "(.*)"\}\}$/\1/')"
        v="$(grep -m1 "^$k=" "$D/img/$id/labels" | cut -d= -f2-)"
        if [ -n "$v" ]; then echo "$v"; else echo "<no value>"; fi ;;
      '{{range .RepoDigests}}{{println .}}{{end}}') echo "$IMG@$(cat "$D/img/$id/digest")" ;;
      '{{range .RepoTags}}'*) sed "s|^|$IMG:|" "$D/img/$id/tags" 2>/dev/null; echo "$IMG@$(cat "$D/img/$id/digest")" ;;
      *) echo "formato que el doble no conoce: $fmt" >&2; exit 9 ;;
    esac ;;
  ps)
    s="$(printf '%s\n' "$@" | sed -n 's/^label=com.docker.compose.service=//p')"
    [ -f "$D/cont/$s" ] && echo "c-$s"; exit 0 ;;
  inspect)
    s="${4#c-}"; [ -f "$D/cont/$s" ] || exit 1
    case "$3" in
      '{{.Image}}') echo "sha256:$(cat "$D/cont/$s")" ;;
      '{{.State.Health.Status}}') cat "$D/salud/$(cat "$D/cont/$s")" 2>/dev/null || echo healthy ;;
      *) exit 9 ;;
    esac ;;
  compose)
    printf '%s · %s\n' "$PWD" "$*" >> "$D/compose.log"
    case " $* " in
      *" config -q "*) exit "$(cat "$D/rc-config" 2>/dev/null || echo 0)" ;;
      *" up -d "*" web "*)
        v="$(grep '^DTD_WEB_IMAGE=' .env | cut -d= -f2-)"; id="$(resolver "$v")"
        [ -n "$id" ] || { echo "no such image: $v" >&2; exit 1; }
        echo "$id" > "$D/cont/web"; echo "Container dtd-cargo-web-1 Started"
        exit "$(cat "$D/rc-up" 2>/dev/null || echo 0)" ;;
      *) exit 9 ;;
    esac ;;
  exec) printf '%s\n' "$*" >> "$D/exec.log"; cat "$D/ledger"; exit "$(cat "$D/rc-ledger" 2>/dev/null || echo 0)" ;;
  run)
    printf '%s\n' "$*" >> "$D/run.log"; rc="$(cat "$D/rc-sharp" 2>/dev/null || echo 0)"
    if [ "$rc" = 0 ]; then echo "sharp OK, webp de prueba: 42 bytes"; else echo "Error: libvips-cpp.so.42: cannot open shared object file" >&2; fi
    exit "$rc" ;;
  images)
    for id in $(ls "$D/img"); do [ -f "$D/img/$id/local" ] && echo "$(cat "$D/img/$id/creado") $id"; done | sort -rn | awk '{ print "sha256:" $2 }' ;;
  rmi)
    echo "$2" >> "$D/rmi-intentos.log"   # también los que docker rechaza
    id="$(resolver "$2")"; [ -n "$id" ] || exit 1
    for s in $(ls "$D/cont"); do [ "$(cat "$D/cont/$s")" = "$id" ] && { echo "conflict: in use" >&2; exit 1; }; done
    echo "$2" >> "$D/rmi.log"
    case "$2" in
      *@*) [ -s "$D/img/$id/tags" ] && { echo "conflict: referenced" >&2; exit 1; }; rm -f "$D/img/$id/local" ;;
      *) grep -vx "${2##*:}" "$D/img/$id/tags" > "$D/t"; mv "$D/t" "$D/img/$id/tags" ;;
    esac ;;
  *) echo "subcomando que el doble no conoce: $1" >&2; exit 9 ;;
esac
DOBLE
cat > "${T}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
# Doble de curl: anota argumentos y la configuración que llega por stdin (-K -).
entrada="$(cat)"
printf 'ARGS %s\nSTDIN %s\n' "$*" "$entrada" >> "${DOBLE:?}/curl.log"
case " $* " in *" -w "*) printf '200' ;; esac
exit 0
DOBLE
cat > "${T}/bin/smoke" <<'DOBLE'
#!/usr/bin/env bash
# Doble de smoke-web.sh: sale con el primer código de $DOBLE/smoke-rcs (0 si no hay).
D="${DOBLE:?}"; echo "$*" >> "$D/smoke.log"
rc=0; if [ -s "$D/smoke-rcs" ]; then rc="$(head -1 "$D/smoke-rcs")"; sed -i '1d' "$D/smoke-rcs"; fi
if [ "$rc" = 0 ]; then echo "RESUMEN: 14 PASÓ · 0 FALLÓ"; else echo "RESUMEN: 13 PASÓ · 1 FALLÓ"; fi
exit "$rc"
DOBLE
chmod +x "${T}/bin/"*

# ─── escenario base ──────────────────────────────────────────────────────────
P="${T}/srv/dtd-cargo"; O="${T}/srv/ops/web"; EV="${T}/srv/ops/evidencias"; D="${T}/doble"
armar_proyecto() { # una copia de infra/dtd-cargo como la arma el README en el servidor
  rm -rf "${P}"; mkdir -p "${P}/supabase" "${P}/functions"
  cp "${REPO}/infra/dtd-cargo/compose.yml" "${REPO}/infra/dtd-cargo/compose.supabase.yml" "${REPO}/infra/dtd-cargo/.env.example" "${P}/"
  cp -R "${REPO}/infra/dtd-cargo/cron" "${P}/cron"
  cp -R "${REPO}/infra/dtd-cargo/supabase/templates" "${REPO}/infra/dtd-cargo/supabase/volumes" "${P}/supabase/"
  cp -R "${REPO}/infra/dtd-cargo/supabase/volumes/functions/." "${P}/functions/"
  cp -R "${REPO}/supabase/functions/." "${P}/functions/"
}
HUELLAS_REPO="$(bash "${HUELLAS}" repo "${REPO}" --etiqueta)"
imagen() { # $1 = sha, $2 = id, $3 = digest, $4 = creado; etiquetas en ${D}/img/$2/labels
  mkdir -p "${D}/img/$2"; printf '%s\n' "$3" > "${D}/img/$2/digest"; echo "$4" > "${D}/img/$2/creado"; : > "${D}/img/$2/tags"
  cat > "${D}/img/$2/labels" <<EOF
org.opencontainers.image.revision=$1
org.opencontainers.image.source=https://github.com/hailuwaycom-sketch/DTDCARGO
org.dtdcargo.migraciones=v1:3:0300_alfa,0301_beta,0302_gama
org.dtdcargo.migraciones-en-espera=v1:1:0302_gama
org.dtdcargo.fuera-de-imagen=${HUELLAS_REPO}
EOF
  printf '%s\n' "$2" > "${D}/reg/$(printf '%s' "${IMG}:sha-$1" | tr '/:@' '___')"
}
en_registro() { printf '%s\n' "$2" > "${D}/reg/$(printf '%s' "${IMG}:$1" | tr '/:@' '___')"; } # $1 = etiqueta, $2 = id
etiquetar_local() { echo "$2" >> "${D}/img/$1/tags"; touch "${D}/img/$1/local"; } # $1 = id, $2 = etiqueta
reiniciar() {
  rm -rf "${T}/srv" "${D}"; mkdir -p "${O}" "${EV}" "${D}/img" "${D}/reg" "${D}/cont" "${D}/salud"
  armar_proyecto
  cat > "${P}/.env" <<EOF
APP_ENV=production
APP_URL=https://dtdcargo.com
DTD_WEB_IMAGE=${IMG}:sha-${A}
TELEGRAM_BOT_TOKEN='123456:SECRETO-DEL-BOT'
CRON_SECRET="secreto-cron"
EOF
  chmod 600 "${P}/.env"
  cat > "${O}/publicar.env" <<EOF
PUBLICAR_TELEGRAM_CHAT_ID=-1001234
PUBLICAR_KUMA_PUSH_URL=https://kuma.test/api/push/TOKENKUMA?status=up&msg=OK&ping=
PUBLICAR_MIN_LIBRE_GB=0
PUBLICAR_CONSERVAR_IMAGENES=2
EOF
  imagen "${A}" "${IA}" "${DA}" 100; etiquetar_local "${IA}" "sha-${A}"
  imagen "${B}" "${IB}" "${DB}" 200; en_registro publicable "${IB}"
  echo "${IA}" > "${D}/cont/web"; echo db > "${D}/cont/db"
  printf '%s\n' 0001_init 0300_alfa 0301_beta 0302_gama > "${D}/ledger"
  : > "${D}/curl.log"; : > "${D}/compose.log"; : > "${D}/smoke.log"
}
correr() { # subcomando y argumentos → código en $RC, salida en ${T}/salida.log
  ( cd "${T}" && PATH="${PATH_EXTRA:-}${T}/bin:${PATH}" DOBLE="${D}" \
      PUBLICAR_DIR="${P}" PUBLICAR_OPS="${O}" PUBLICAR_EVIDENCIAS="${EV}" \
      PUBLICAR_CANDADO="${T}/candado" PUBLICAR_SMOKE="${T}/bin/smoke" PUBLICAR_HUELLAS="${HUELLAS}" \
      PUBLICAR_DOCKER_RAIZ="${T}" PUBLICAR_ESPERA_SALUD=5 PUBLICAR_PASO_SALUD=0 PUBLICAR_PAUSA_REINTENTO=0 \
      bash "${SCRIPT}" "$@" ) > "${T}/salida.log" 2>&1
  RC=$?
}
imagen_env() { grep '^DTD_WEB_IMAGE=' "${P}/.env" | cut -d= -f2-; }
ups() { grep -c ' up -d ' "${D}/compose.log"; }
telegrams() { grep -c 'sendMessage' "${D}/curl.log"; }
ver() { tail -4 "${T}/salida.log" | sed 's/^/      /'; }

# ─── huellas ─────────────────────────────────────────────────────────────────
echo "== huellas fuera de la imagen =="
reiniciar
[ "$(bash "${HUELLAS}" servidor "${P}" --etiqueta)" = "${HUELLAS_REPO}" ] \
  && ok "la copia armada como en el README da las mismas huellas que el repo" || ko "huellas servidor ≠ repo"
case "${HUELLAS_REPO}" in v1:9:compose.yml=*) ok "etiqueta v1 con 9 entradas" ;; *) ko "formato: ${HUELLAS_REPO:0:40}" ;; esac
echo "# cambio" >> "${P}/compose.yml"; rm -f "${P}/functions/kommo-sync/index.ts"
diff <(bash "${HUELLAS}" repo "${REPO}") <(bash "${HUELLAS}" servidor "${P}") | grep '^>' | cut -d' ' -f2 | tr '\n' ' ' > "${T}/dif"
[ "$(cat "${T}/dif")" = "compose.yml functions/ " ] && ok "un byte en compose.yml y un archivo borrado en functions/ cambian solo esas dos entradas" || ko "entradas distintas: $(cat "${T}/dif")"
# Sin tuberías hacia `grep -q`: con pipefail, el SIGPIPE del productor da un
# verde (o un rojo) falso.
reiniciar; echo nuevo > "${P}/functions/sobra.ts"
bash "${HUELLAS}" repo "${REPO}" | awk '$1 == "functions/" { print $2 }' > "${T}/f-repo"
bash "${HUELLAS}" servidor "${P}" > "${T}/h-serv"
[ -s "${T}/f-repo" ] && grep -q '^functions/ ' "${T}/h-serv" && ! grep -qx "functions/ $(cat "${T}/f-repo")" "${T}/h-serv" \
  && ok "un archivo de más en functions/ cambia su huella" || ko "un archivo de más en functions/ no se nota"
rm -f "${P}/cron/crontab"
bash "${HUELLAS}" servidor "${P}" > "${T}/h-serv"
grep -qx 'cron/crontab ausente' "${T}/h-serv" && ok "un archivo que falta sale «ausente»" || ko "falta sin «ausente»"
bash "${HUELLAS}" servidor "${T}/no-existe" >/dev/null 2>&1; [ $? = 2 ] && ok "carpeta inexistente: sale 2" || ko "carpeta inexistente"

# ─── vigilar ─────────────────────────────────────────────────────────────────
echo; echo "== vigilar: publica lo que dice :publicable =="
reiniciar
sed -n '/^[A-Z_]*=$/p' "${P}/.env" > "${T}/vacias-antes"
correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && ok "publica B y fija DTD_WEB_IMAGE por commit y digest" || { ko "publicar B rc=${RC} env=$(imagen_env)"; ver; }
[ "$(grep -c ' up -d ' "${D}/compose.log")" = 1 ] && grep -q "^${P} · compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web$" "${D}/compose.log" \
  && ok "el comando es exactamente «compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web» desde ${P##*/}" || { ko "comando compose"; cat "${D}/compose.log"; }
grep -q "config -q" "${D}/compose.log" && ! grep -q 'cron\|ensayo' "${D}/compose.log" && ok "valida con config -q; nunca toca cron ni compose.ensayo.yml" || ko "config / cron"
diff <(grep -v '^DTD_WEB_IMAGE=' "${P}/.env") <(printf '%s\n' APP_ENV=production APP_URL=https://dtdcargo.com "TELEGRAM_BOT_TOKEN='123456:SECRETO-DEL-BOT'" 'CRON_SECRET="secreto-cron"') >/dev/null \
  && ok "el resto del .env queda igual, byte a byte" || ko "el .env cambió en otra línea"
[ "$(sed -n '/^[A-Z_]*=$/p' "${P}/.env")" = "$(cat "${T}/vacias-antes")" ] && ok "no escribe líneas X= vacías" || ko "líneas vacías nuevas"
[ "$(stat -c %a "${P}/.env")" = 600 ] && ok ".env sigue en 600" || ko "permisos del .env: $(stat -c %a "${P}/.env")"
bk="$(ls "${P}"/.env.bak-publicar-* 2>/dev/null | head -1)"
[ -n "${bk}" ] && grep -qx "DTD_WEB_IMAGE=${IMG}:sha-${A}" "${bk}" && ok "copia previa del .env con el valor anterior" || ko "sin copia previa"
grep -q -- '--host dtdcargo.com --www' "${D}/smoke.log" && ok "prueba rápida: smoke-web.sh --host dtdcargo.com --www" || ko "argumentos del smoke: $(cat "${D}/smoke.log")"
ev="$(ls -d "${EV}"/publicar-web-*-publicar-"${B:0:8}" 2>/dev/null | head -1)"
[ -n "${ev}" ] && ( cd "${ev}" && sha256sum -c --quiet SHA256SUMS ) && [ -s "${ev}/prueba-rapida-nueva-1.txt" ] && grep -q 'PUBLICADA' "${ev}/salida.txt" \
  && ok "evidencia con salida, prueba rápida y SHA256SUMS que verifica" || ko "evidencia: ${ev:-ninguna}"
! grep -rq 'SECRETO-DEL-BOT\|secreto-cron' "${EV}" && ok "la evidencia no tiene secretos del .env" || ko "secretos en la evidencia"
grep '^ARGS' "${D}/curl.log" > "${T}/args"
[ -s "${T}/args" ] && ! grep -q 'SECRETO-DEL-BOT\|TOKENKUMA' "${T}/args" && ok "los tokens de Telegram y Kuma viajan por stdin, nunca como argumento" || ko "un token viajó como argumento de curl"
grep -q "STDIN url = \"https://api.telegram.org/bot123456:SECRETO-DEL-BOT/sendMessage\"" "${D}/curl.log" && grep -q 'text=DTD Cargo · publicada '"${B:0:8}" "${D}/curl.log" \
  && ok "aviso por Telegram: «publicada ${B:0:8}» con el bot del .env" || ko "aviso de publicada"
grep -q 'STDIN url = "https://kuma.test/api/push/TOKENKUMA"' "${D}/curl.log" && grep -q 'status=up' "${D}/curl.log" \
  && ok "Kuma recibe up, y la URL del monitor sin su ?status=… original" || ko "kuma: $(grep -c kuma "${D}/curl.log")"
[ "$(cat "${O}/estado/anterior")" = "${IMG}:sha-${A}" ] && ok "queda registrada la anterior para volver" || ko "estado/anterior"
: > "${D}/compose.log"; : > "${D}/curl.log"
correr vigilar
[ "${RC}" = 0 ] && [ "$(ups)" = 0 ] && grep -q 'al día' "${T}/salida.log" && grep -q 'status=up' "${D}/curl.log" && [ "$(telegrams)" = 0 ] \
  && ok "otra vuelta sin cambios: al día, nada que publicar, Kuma up, sin Telegram" || { ko "al día rc=${RC}"; ver; }

echo; echo "== copias del .env =="
reiniciar
for d in 10 11 12 13 14; do printf 'TELEGRAM_BOT_TOKEN=SECRETO-DEL-BOT\n' > "${P}/.env.bak-publicar-202610${d}T000000Z"; done
printf 'x=1\n' > "${P}/.env.bak-vacias-20261015T053615Z"; printf 'x=1\n' > "${P}/.env.bak-ensayo-20261014T132336Z"
correr vigilar
find "${P}" -maxdepth 1 -name '.env.bak-publicar-*' -printf '%f\n' | LC_ALL=C sort > "${T}/copias"
[ "${RC}" = 0 ] && [ "$(grep -c . "${T}/copias")" = 3 ] && grep -q 'bak-publicar-20261014T000000Z' "${T}/copias" && grep -q 'bak-publicar-20261013T000000Z' "${T}/copias" \
  && ! grep -q 'bak-publicar-20261012T000000Z' "${T}/copias" \
  && ok "quedan las 3 copias de publicación más nuevas (la de hoy y dos viejas)" || { ko "copias: $(tr '\n' ' ' < "${T}/copias")"; ver; }
[ -f "${P}/.env.bak-vacias-20261015T053615Z" ] && [ -f "${P}/.env.bak-ensayo-20261014T132336Z" ] && ok "las copias que no son de publicación no se tocan" || ko "borró copias ajenas"
! grep -q 'SECRETO-DEL-BOT' "${T}/salida.log" && ok "no muestra el contenido de las copias" || ko "imprimió un secreto"

echo; echo "== imagen anterior (la de la vuelta atrás) =="
reiniciar; correr publicar "${A}"
[ "${RC}" = 0 ] && [ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && grep -q 'no hay a dónde volver, así que no hago nada' "${T}/salida.log" \
  && [ ! -s "${O}/estado/rechazados" ] && ok "publicar la misma imagen que corre: lo dice y no hace nada (ni deja :publicable rechazada)" || { ko "misma imagen rc=${RC}"; ver; }
reiniciar; rm -f "${D}/img/${IA}/local" "${D}/reg/$(printf '%s' "${IMG}:sha-${A}" | tr '/:@' '___')"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && grep -q 'no habría vuelta atrás' "${T}/salida.log" \
  && ok "si la anterior no está en el servidor ni se puede bajar: no publica (no habría vuelta atrás)" || { ko "sin anterior rc=${RC}"; ver; }
reiniciar; rm -f "${D}/img/${IA}/local"; correr vigilar
[ "${RC}" = 0 ] && grep -q "^pull -q ${IMG}:sha-${A}$" "${D}/llamadas.log" && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] \
  && ok "si la anterior no está en el servidor pero sí en GHCR: la baja antes de publicar" || { ko "bajar anterior rc=${RC}"; ver; }
reiniciar; correr vigilar
printf '%s\n' "${IMG}:sha-${A}" > "${O}/estado/anterior"
sed -i "s|^DTD_WEB_IMAGE=.*|DTD_WEB_IMAGE=${IMG}:sha-${A}@${DA}|" "${P}/.env"; echo "${IA}" > "${D}/cont/web"; : > "${D}/compose.log"
correr volver
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'es la misma que corre: no hay a dónde volver' "${T}/salida.log" \
  && ok "volver a la misma imagen escrita de otra forma: lo dice y no hace nada" || { ko "volver misma imagen rc=${RC}"; ver; }

echo; echo "== compose.ensayo.yml =="
reiniciar; touch "${P}/compose.ensayo.yml"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ! grep -q '^pull' "${D}/llamadas.log" 2>/dev/null && grep -q 'hay un compose.ensayo.yml' "${T}/salida.log" \
  && ok "vigilar: con compose.ensayo.yml no sigue (ni baja la imagen)" || { ko "ensayo vigilar rc=${RC}"; ver; }
correr publicar "${B}"; [ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "a mano: con compose.ensayo.yml no sigue" || { ko "ensayo a mano rc=${RC}"; ver; }
reiniciar; correr vigilar; touch "${P}/compose.ensayo.yml"; : > "${D}/compose.log"; correr volver
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && ok "volver: con compose.ensayo.yml no sigue" || { ko "ensayo volver rc=${RC}"; ver; }

echo; echo "== al día desde el valor de hoy (solo etiqueta sha-, sin digest) =="
reiniciar; en_registro publicable "${IA}"
correr vigilar
[ "${RC}" = 0 ] && [ "$(ups)" = 0 ] && ok "si corre sha-A y :publicable es A, no republica" || { ko "rc=${RC}"; ver; }

echo; echo "== imagen reconstruida del mismo commit =="
reiniciar; correr vigilar
imagen "${B}" "${IX}" "${DX}" 300; en_registro publicable "${IX}"; : > "${D}/compose.log"
correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DX}" ] && ok "mismo commit con otro digest: publica el digest nuevo" || { ko "rebuild rc=${RC}"; ver; }

# ─── puertas ─────────────────────────────────────────────────────────────────
echo; echo "== puerta de migraciones =="
reiniciar; printf '%s\n' 0001_init 0300_alfa > "${D}/ledger"
correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && ok "falta 0301_beta y 0302_gama: no publica y no toca el .env" || { ko "migraciones rc=${RC}"; ver; }
grep -q 'text=DTD Cargo · NO se publicó.*0301_beta;.*0302_gama (declarada como espera' "${D}/curl.log" && ok "el aviso nombra las que faltan y marca la espera" || ko "texto del aviso: $(grep -o 'text=[^ ]* [^ ]* [^ ]*' "${D}/curl.log" | head -1)"
grep -q 'default_transaction_read_only=on' "${D}/exec.log" && grep -q 'supabase_migrations.schema_migrations' "${D}/exec.log" && ok "lee el ledger en una transacción de solo lectura" || ko "lectura del ledger"
grep -q 'status=down' "${D}/curl.log" && ok "Kuma recibe down" || ko "kuma down"
: > "${D}/curl.log"; correr vigilar
[ "${RC}" = 1 ] && [ "$(telegrams)" = 0 ] && grep -q 'status=down' "${D}/curl.log" && ok "al minuto siguiente: sin repetir el Telegram, Kuma sigue en down" || { ko "aviso repetido: $(telegrams)"; ver; }
echo 0301_beta >> "${D}/ledger"; : > "${D}/curl.log"; correr vigilar
[ "${RC}" = 1 ] && [ "$(telegrams)" = 1 ] && ok "si cambia lo que falta, avisa otra vez" || ko "aviso por cambio: $(telegrams)"
correr aceptar-pendiente 0302_gama; correr aceptar-pendiente 0302_gama
[ "$(grep -c . "${O}/estado/pendientes-aceptadas")" = 1 ] && ok "aceptar-pendiente anota una vez" || ko "aceptadas"
correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && ok "con la espera aceptada a mano, publica" || { ko "tras aceptar rc=${RC}"; ver; }
correr aceptar-pendiente '0302_gama;rm' ; [ "${RC}" = 3 ] && ok "aceptar-pendiente rechaza un nombre raro" || ko "nombre raro rc=${RC}"
reiniciar; : > "${D}/ledger"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'ledger de la base salió vacío' "${T}/salida.log" && ok "ledger vacío: no publica" || { ko "ledger vacío rc=${RC}"; ver; }
reiniciar; rm -f "${D}/cont/db"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "sin base corriendo: no publica" || { ko "sin db rc=${RC}"; ver; }
reiniciar; sed -i '/^org.dtdcargo.migraciones=/d' "${D}/img/${IB}/labels"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'antes de la SDD-0541' "${T}/salida.log" && ok "imagen sin etiqueta de migraciones: no publica (falla cerrado)" || { ko "sin etiqueta rc=${RC}"; ver; }
reiniciar; sed -i 's/^org.dtdcargo.migraciones=v1:3:/org.dtdcargo.migraciones=v1:4:/' "${D}/img/${IB}/labels"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "etiqueta truncada (el conteo no cuadra): no publica" || { ko "conteo rc=${RC}"; ver; }

echo; echo "== avisos largos =="
# 300 migraciones faltantes: el motivo pasa de 12 KB. Telegram corta en 4096 y una
# URL de Kuma tan larga no sirve.
reiniciar
lista="$(for i in $(seq 300 599); do printf '0%s_migracion_de_prueba_con_nombre_largo,' "${i}"; done)"; lista="${lista%,}"
sed -i "s/^org.dtdcargo.migraciones=.*/org.dtdcargo.migraciones=v1:300:${lista}/" "${D}/img/${IB}/labels"
correr vigilar
grep '^ARGS' "${D}/curl.log" | grep 'chat_id' | awk '{ print length }' | sort -n | tail -1 > "${T}/largo-tg"
grep '^ARGS' "${D}/curl.log" | grep 'status=' | awk '{ print length }' | sort -n | tail -1 > "${T}/largo-kuma"
lt="$(cat "${T}/largo-tg")"; lk="$(cat "${T}/largo-kuma")"
[ "${RC}" = 1 ] && [ "${lt:-0}" -gt 1000 ] && [ "${lt}" -le 3700 ] && [ "${lk:-0}" -gt 0 ] && [ "${lk}" -le 400 ] && grep -q '0599_migracion' "${T}/salida.log" \
  && ok "300 faltantes: el Telegram se corta a 3500 caracteres y Kuma a 200; la lista entera queda en la salida" || { ko "avisos largos: telegram=${lt:-?} kuma=${lk:-?}"; ver; }

echo; echo "== puerta de lo que vive fuera de la imagen =="
reiniciar; echo "# a mano" >> "${P}/compose.yml"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'text=.*no tiene la misma copia que el repo en ese commit: compose.yml' "${D}/curl.log" \
  && ok "compose.yml distinto del commit: no publica y avisa cuál" || { ko "compose distinto rc=${RC}"; ver; }
reiniciar; echo "* * * * * otra" >> "${P}/cron/crontab"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'cron/crontab' "${T}/salida.log" && ok "cron/crontab distinto: no publica" || { ko "crontab rc=${RC}"; ver; }
reiniciar; echo "// cambio" >> "${P}/functions/kommo-sync/index.ts"; correr vigilar
[ "${RC}" = 0 ] && [ "$(ups)" = 1 ] && grep -q 'OJO, el servidor difiere del repo en: functions/' "${D}/curl.log" \
  && ok "functions/ distinta: publica la web y avisa (las funciones se sincronizan aparte)" || { ko "functions rc=${RC}"; ver; }
reiniciar; sed -i '/^org.dtdcargo.fuera-de-imagen=/d' "${D}/img/${IB}/labels"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "imagen sin etiqueta de huellas: no publica" || { ko "sin huellas rc=${RC}"; ver; }

echo; echo "== prueba de sharp dentro de la imagen =="
reiniciar; correr vigilar
grep -qF -- "run --rm --network none --entrypoint node -w /app ${IMG}@${DB} -e require('sharp')({create:" "${D}/run.log" 2>/dev/null \
  && grep -qF '.webp().toBuffer()' "${D}/run.log" \
  && ok "prueba sharp dentro de la imagen nueva, por digest, sin red, en /app y convirtiendo a WebP (no solo require)" || ko "llamada a sharp: $(head -1 "${D}/run.log" 2>/dev/null | cut -c1-120)"
ev="$(ls -d "${EV}"/publicar-web-* 2>/dev/null | head -1)"
grep -q 'sharp OK' "${ev}/sharp.txt" 2>/dev/null && ok "la salida de sharp queda en la evidencia" || ko "sharp en la evidencia"
reiniciar; echo 1 > "${D}/rc-sharp"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && grep -q 'text=.*sharp no convierte dentro de la imagen' "${D}/curl.log" \
  && ok "si sharp no convierte: no publica, no toca el .env y avisa" || { ko "sharp rc=${RC}"; ver; }

echo; echo "== validación de la imagen =="
reiniciar; sed -i 's|^org.opencontainers.image.source=.*|org.opencontainers.image.source=https://github.com/otro/repo|' "${D}/img/${IB}/labels"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "imagen de otro repositorio: no publica" || { ko "source rc=${RC}"; ver; }
reiniciar; sed -i 's|^org.opencontainers.image.revision=.*|org.opencontainers.image.revision=main|' "${D}/img/${IB}/labels"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "revisión que no es un sha de 40: no publica" || { ko "revision rc=${RC}"; ver; }
reiniciar; echo 1 > "${D}/rc-pull"; correr vigilar
[ "${RC}" = 1 ] && grep -q 'text=DTD Cargo · no pude bajar .*:publicable.*login de GHCR' "${D}/curl.log" && ok "si el pull falla, avisa (¿login de GHCR vencido?)" || { ko "pull rc=${RC}"; ver; }
reiniciar; sed -i 's/^PUBLICAR_MIN_LIBRE_GB=0/PUBLICAR_MIN_LIBRE_GB=999999/' "${O}/publicar.env"; correr vigilar
[ "${RC}" = 1 ] && ! grep -q '^pull' "${D}/llamadas.log" 2>/dev/null && grep -q 'GB libres' "${T}/salida.log" && ok "sin disco suficiente: ni siquiera baja la imagen" || { ko "disco rc=${RC}"; ver; }
reiniciar; echo "DTD_WEB_IMAGE=${IMG}:sha-${X}" >> "${P}/.env"; cp "${P}/.env" "${T}/env-doble"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && cmp -s "${P}/.env" "${T}/env-doble" && grep -q '2 líneas DTD_WEB_IMAGE' "${T}/salida.log" && ok ".env con dos líneas DTD_WEB_IMAGE: no lo toca" || { ko "dos líneas rc=${RC}"; ver; }
[ ! -f "${O}/CONGELADO" ] && [ -z "$(ls "${EV}")" ] && ok "y no congela ni abre una carpeta de evidencia por minuto" || ko "dos líneas: congelado o evidencia ($(ls "${EV}" | head -1))"
reiniciar; mkdir -p "${T}/bin-mk"
printf '#!/usr/bin/env bash\ncase "$*" in *.env.publicar.*) echo "mktemp: falla a propósito" >&2; exit 1 ;; esac\nexec /usr/bin/mktemp "$@"\n' > "${T}/bin-mk/mktemp"
chmod +x "${T}/bin-mk/mktemp"; cp "${P}/.env" "${T}/env-antes"
PATH_EXTRA="${T}/bin-mk:" correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && cmp -s "${P}/.env" "${T}/env-antes" && [ ! -f "${O}/CONGELADO" ] && grep -q 'no pude crear el .env temporal' "${T}/salida.log" \
  && ok "si no puede escribir el .env nuevo: no publica, no vuelve atrás ni congela (no cambió nada)" || { ko "mktemp rc=${RC}"; ver; }
reiniciar; correr vigilar; echo "DTD_WEB_IMAGE=${IMG}:sha-${X}" >> "${P}/.env"; cp "${P}/.env" "${T}/env-doble"; : > "${D}/compose.log"; correr volver
[ "${RC}" != 0 ] && [ "$(ups)" = 0 ] && cmp -s "${P}/.env" "${T}/env-doble" && ok "volver tampoco toca un .env con dos líneas DTD_WEB_IMAGE" || { ko "volver con dos líneas rc=${RC}"; ver; }

# ─── vuelta atrás ────────────────────────────────────────────────────────────
echo; echo "== vuelta atrás =="
reiniciar; printf '1\n1\n' > "${D}/smoke-rcs"; correr vigilar
[ "${RC}" = 1 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && [ "$(cat "${D}/cont/web")" = "${IA}" ] && [ "$(ups)" = 2 ] \
  && ok "la prueba rápida falla dos veces: vuelve a A (.env y contenedor) y la prueba" || { ko "vuelta rc=${RC} env=$(imagen_env)"; ver; }
grep -q "^${DB} ${B} " "${O}/estado/rechazados" && grep -q 'text=DTD Cargo · vuelta atrás' "${D}/curl.log" && grep -q 'status=down' "${D}/curl.log" \
  && ok "B queda rechazada; Telegram y Kuma avisan" || ko "rechazo / avisos"
: > "${D}/compose.log"; correr vigilar
[ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && grep -q 'rechazada antes' "${T}/salida.log" && ok "al minuto siguiente no la reintenta" || { ko "reintento rc=${RC}"; ver; }
imagen "${X}" "${IX}" "${DX}" 300; en_registro publicable "${IX}"; correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${X}@${DX}" ] && ok "el próximo merge (otra imagen) se publica solo" || { ko "siguiente rc=${RC}"; ver; }
reiniciar; printf '1\n0\n' > "${D}/smoke-rcs"; correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && ok "una prueba rápida que falla una vez y pasa al reintento: publica" || { ko "reintento smoke rc=${RC}"; ver; }
reiniciar; echo unhealthy > "${D}/salud/${IB}"; correr vigilar
[ "${RC}" = 1 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && ! grep -q 'nueva' "${D}/smoke.log" 2>/dev/null && grep -q 'no quedó healthy' "${T}/salida.log" \
  && ok "web unhealthy: vuelve atrás sin correr la prueba rápida de la nueva" || { ko "unhealthy rc=${RC}"; ver; }
reiniciar; printf '1\n1\n1\n1\n' > "${D}/smoke-rcs"; correr vigilar
[ "${RC}" = 2 ] && [ -f "${O}/CONGELADO" ] && grep -q 'text=URGENTE' "${D}/curl.log" && ok "si la vuelta atrás también falla: sale 2, congela y avisa URGENTE" || { ko "doble fallo rc=${RC}"; ver; }
: > "${D}/compose.log"; correr vigilar
[ "${RC}" = 0 ] && [ "$(ups)" = 0 ] && grep -q 'congelado: vuelta atrás fallida' "${T}/salida.log" && ok "congelado solo: el vigilante ya no intenta nada" || { ko "tras doble fallo rc=${RC}"; ver; }

# ─── interruptor, candado, a mano ────────────────────────────────────────────
echo; echo "== interruptor y candado =="
reiniciar; correr congelar "corte de prueba"; : > "${D}/llamadas.log"; correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && ! grep -q '^pull' "${D}/llamadas.log" && grep -q 'status=up' "${D}/curl.log" && grep -q 'msg=congelado: corte de prueba' "${D}/curl.log" \
  && ok "congelado: no baja ni publica; Kuma up con el motivo" || { ko "congelado rc=${RC}"; ver; }
correr publicar "${B}"; [ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "a mano, congelado: se niega sin --aunque-congelado" || { ko "a mano congelado rc=${RC}"; ver; }
correr descongelar; correr vigilar
[ ! -f "${O}/CONGELADO" ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && ok "descongelar: vuelve a publicar" || { ko "descongelar"; ver; }
reiniciar
( exec 9>"${T}/candado"; flock 9; sleep 30 ) & PID_CANDADO=$!
sleep 1; correr vigilar
kill "${PID_CANDADO}" 2>/dev/null; wait "${PID_CANDADO}" 2>/dev/null
[ "${RC}" = 0 ] && [ "$(ups)" = 0 ] && grep -q 'otra publicación en curso' "${T}/salida.log" && ok "con otra publicación en curso: sale sin hacer nada" || { ko "candado rc=${RC}"; ver; }

echo; echo "== a mano y vuelta atrás a mano =="
reiniciar; imagen "${X}" "${IX}" "${DX}" 300
correr "${X}"
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${X}@${DX}" ] && ok "interfaz del interino: «publicar-web.sh <sha>» publica ese commit" || { ko "interfaz <sha> rc=${RC}"; ver; }
reiniciar; imagen "${X}" "${IX}" "${DX}" 300
correr "sha-${X}"
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${X}@${DX}" ] && ok "también acepta «sha-<sha>»" || { ko "interfaz sha-<sha> rc=${RC}"; ver; }
reiniciar; imagen "${X}" "${IX}" "${DX}" 300
correr "${X:0:12}"; [ "${RC}" = 3 ] && [ "$(ups)" = 0 ] && ok "un sha corto como argumento suelto es error de uso (3)" || { ko "sha corto suelto rc=${RC}"; ver; }
correr publicar "${X:0:12}"; [ "${RC}" = 3 ] && [ "$(ups)" = 0 ] && ok "a mano: un sha corto es error de uso (3)" || { ko "sha corto rc=${RC}"; ver; }
correr publicar "main"; [ "${RC}" = 3 ] && ok "a mano: una etiqueta en vez de sha es error de uso" || ko "etiqueta rc=${RC}"
sed -i "s/^org.opencontainers.image.revision=.*/org.opencontainers.image.revision=${A}/" "${D}/img/${IX}/labels"
correr publicar "${X}"; [ "${RC}" = 1 ] && [ "$(ups)" = 0 ] && ok "a mano: si sha-X trae otro commit en la etiqueta, no publica" || { ko "revision ajena rc=${RC}"; ver; }
reiniciar; imagen "${X}" "${IX}" "${DX}" 300
correr publicar "${X}"
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${X}@${DX}" ] && grep -q "^${DB} ${B} reemplazada a mano" "${O}/estado/rechazados" \
  && ok "a mano: publica X y deja :publicable (B) fuera hasta el próximo merge" || { ko "a mano rc=${RC}"; ver; }
: > "${D}/compose.log"; correr vigilar
[ "$(ups)" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${X}@${DX}" ] && ok "el vigilante no pisa lo publicado a mano" || { ko "pisó"; ver; }
correr volver
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${A}" ] && [ "$(cat "${D}/cont/web")" = "${IA}" ] && grep -q "^${DX} ${X} vuelta atrás a mano" "${O}/estado/rechazados" \
  && ok "volver: vuelve a la anterior y deja la de ahora rechazada" || { ko "volver rc=${RC} env=$(imagen_env)"; ver; }
correr volver; [ "${RC}" = 1 ] && ok "volver otra vez: ya corre la anterior, no hace nada" || ko "volver dos veces rc=${RC}"

echo; echo "== limpieza de imágenes =="
# Conservar = 2. La anterior (A) es la MÁS VIEJA de todas: si se conserva es por
# estar protegida, no por su posición. Orden por fecha: B, v4, v3, v2, v1, A.
reiniciar; echo 0 > "${D}/img/${IA}/creado"
for i in 1 2 3 4; do
  id="$(hx "vieja-${i}")"; s="$(hx "commit-vieja-${i}" | cut -c1-40)"
  imagen "${s}" "${id}" "sha256:$(hx "dig-vieja-${i}")" "$((50 + i))"; etiquetar_local "${id}" "sha-${s}"
done
correr vigilar
[ "${RC}" = 0 ] && [ -f "${D}/img/${IA}/local" ] && [ -f "${D}/img/${IB}/local" ] && [ -f "${D}/img/$(hx vieja-4)/local" ] \
  && ok "conserva la nueva, la anterior (aunque sea la más vieja) y las 2 más nuevas" || { ko "limpieza: borró de más ($(tr '\n' ' ' < "${D}/rmi.log" 2>/dev/null | cut -c1-120))"; ver; }
[ "$(grep -c . "${D}/rmi.log" 2>/dev/null)" = 6 ] && ! grep -qv "^${IMG}" "${D}/rmi.log" && [ ! -f "${D}/img/$(hx vieja-1)/local" ] \
  && ok "borra las otras 3 (etiqueta y digest de cada una) y nada de otro repositorio" || { ko "limpieza: $(grep -c . "${D}/rmi.log" 2>/dev/null) borradas"; ver; }
! grep -q "sha-${A}\|${DA}\|${DB}\|:publicable" "${D}/rmi-intentos.log" && ok "ni siquiera intenta borrar la vigente ni la anterior" || ko "intentó: $(tr '\n' ' ' < "${D}/rmi-intentos.log" | cut -c1-160)"
# A mano, una vigente vieja: X es más vieja que las 2 que se conservan por fecha.
reiniciar; echo 0 > "${D}/img/${IA}/creado"
for i in 1 2 3 4; do
  id="$(hx "vieja-${i}")"; s="$(hx "commit-vieja-${i}" | cut -c1-40)"
  imagen "${s}" "${id}" "sha256:$(hx "dig-vieja-${i}")" "$((50 + i))"; etiquetar_local "${id}" "sha-${s}"
done
imagen "${X}" "${IX}" "${DX}" 10
correr publicar "${X}"
[ "${RC}" = 0 ] && [ -f "${D}/img/${IX}/local" ] && [ -f "${D}/img/${IA}/local" ] && ! grep -q "sha-${X}\|${DX}\|sha-${A}\|${DA}" "${D}/rmi-intentos.log" \
  && ok "una vigente más vieja que las conservadas tampoco se toca, ni la anterior" || { ko "vigente vieja: $(tr '\n' ' ' < "${D}/rmi-intentos.log" 2>/dev/null | cut -c1-160)"; ver; }

echo; echo "== estado, revisar y uso =="
reiniciar; correr estado
[ "${RC}" = 0 ] && grep -q 'Telegram:    configurado' "${T}/salida.log" && ! grep -q 'SECRETO\|TOKENKUMA\|-1001234' "${T}/salida.log" && ok "estado no imprime tokens ni el chat" || { ko "estado"; ver; }
correr revisar; [ "${RC}" = 0 ] && grep -q 'PUERTAS: pasan' "${T}/salida.log" && [ "$(ups)" = 0 ] && ok "revisar: corre las puertas sin publicar" || { ko "revisar rc=${RC}"; ver; }
correr; [ "${RC}" = 3 ] && ok "sin subcomando: uso (3)" || ko "uso rc=${RC}"

# ─── estado para el Studio (SDD-0547) ────────────────────────────────────────
echo; echo "== estado para el Studio (SDD-0547) =="
J="${P}/estado-publicacion/publicaciones.json"
LECTOR="${REPO}/lib/studio/publicaciones-types.ts"
EJEMPLO="${REPO}/docs/specs/0547-panel-publicaciones-servidor/ejemplo-publicaciones.v1.json"
nv=0
nv() { echo "NO VERIFICADO · $*"; nv=$((nv + 1)); }
# js '<expresión con e = el JSON>': un campo del archivo (los no-texto, como JSON).
js() {
  node -e 'const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const r = new Function("e", "return (" + process.argv[2] + ")")(e);
    process.stdout.write(typeof r === "string" ? r : JSON.stringify(r));' "${J}" "$1" 2>/dev/null
}
# Las formas del contrato (§4.1-§4.5), sin el código del Studio: claves conocidas
# y cada valor con su forma. Un texto libre (ruta, error, URL) no cabe en ninguna.
cat > "${T}/formas.js" <<'NODE'
const e = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
const SHA = /^[0-9a-f]{40}$/, HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/, MIG = /^[0-9]{4}[a-z]?_[a-z0-9_]{1,80}$/;
const COD = new Set(["migraciones", "ledger", "huellas", "sharp", "etiquetas", "imagen", "descarga", "disco", "ensayo", "env",
  "sin-vuelta-atras", "salud", "prueba-rapida", "compose", "rechazada", "otro"]);
const EST = new Set(["al-dia", "retenida", "detenido", "congelado"]), ORI = new Set(["vigilante", "a-mano"]);
const RES = new Set(["publicada", "retenida", "vuelta-atras", "vuelta-atras-fallida", "vuelta-atras-a-mano"]);
const malos = [];
const claves = (o) => Object.keys(o).join(",");
const migs = (l) => Array.isArray(l) && l.length <= 50 && l.every((m) => typeof m === "string" && MIG.test(m));
if (claves(e) !== "version,actualizado,corre,anterior,publicable,congelado,vigilante,historial") malos.push("claves " + claves(e));
if (e.version !== 1) malos.push("version");
if (!HORA.test(e.actualizado)) malos.push("actualizado");
for (const k of ["corre", "anterior", "publicable"]) if (e[k] !== null && !SHA.test(e[k])) malos.push(k);
const c = e.congelado;
if (c !== null && (claves(c) !== "desde,automatico" || !HORA.test(c.desde) || typeof c.automatico !== "boolean")) malos.push("congelado");
const v = e.vigilante;
if (v !== null && (claves(v) !== "estado,motivo,faltan" || !EST.has(v.estado) || (v.motivo !== null && !COD.has(v.motivo)) || !migs(v.faltan))) malos.push("vigilante");
if (!Array.isArray(e.historial) || e.historial.length > 20) malos.push("historial");
else e.historial.forEach((h, i) => {
  const k = claves(h);
  if (!(k === "hora,sha,origen,resultado,motivo" || k === "hora,sha,origen,resultado,motivo,faltan") || !HORA.test(h.hora) || !SHA.test(h.sha)
    || !ORI.has(h.origen) || !RES.has(h.resultado) || (h.motivo !== null && !COD.has(h.motivo)) || ("faltan" in h && !migs(h.faltan))) malos.push("historial[" + i + "]");
  if (i > 0 && e.historial[i - 1].hora < h.hora) malos.push("orden " + i);
});
if (malos.length) { console.log(malos.join(" ")); process.exit(1); }
NODE
formas() { node "${T}/formas.js" "${1:-${J}}" 2>&1; }
lector() { # el parser del Studio (PR #264), si está en el árbol → «ok descartados=N historial=N vigilante=…»
  node --input-type=module -e "import { readFileSync } from 'node:fs';
    const m = await import('file://${LECTOR}');
    const r = m.parseEstadoPublicaciones(JSON.parse(readFileSync(process.argv[1], 'utf8')));
    console.log(r.ok ? 'ok descartados=' + r.estado.descartados + ' historial=' + r.estado.historial.length + ' vigilante=' + (r.estado.vigilante ? r.estado.vigilante.estado : 'null') : 'no ' + r.motivo);" "$1" 2>/dev/null
}
vig() { js 'e.vigilante === null ? "null" : e.vigilante.estado + " " + e.vigilante.motivo'; }
ult() { js 'e.historial.length ? e.historial[0].resultado + " " + e.historial[0].sha + " " + e.historial[0].origen + " " + e.historial[0].motivo : "vacío"'; }

if [ -f "${EJEMPLO}" ]; then
  f="$(formas "${EJEMPLO}")" && ok "el validador de formas acepta el ejemplo canónico de la spec" || ko "el ejemplo de la spec no pasa: ${f}"
else nv "el ejemplo canónico de la spec no está en este árbol (PR #264)"; fi

reiniciar; correr vigilar
[ "${RC}" = 0 ] && [ -f "${J}" ] && [ "$(stat -c %a "${J}")" = 644 ] && [ "$(stat -c %a "${P}/estado-publicacion")" = 755 ] \
  && ok "vigilar deja publicaciones.json en 644, en una carpeta 755 dentro del directorio del compose" || { ko "archivo o permisos: $(stat -c '%a %n' "${J}" "${P}/estado-publicacion" 2>&1 | tr '\n' ' ')"; ver; }
[ "$(ls -A "${P}/estado-publicacion")" = publicaciones.json ] && ok "no quedan temporales en la carpeta" || ko "sobran: $(ls -A "${P}/estado-publicacion" | tr '\n' ' ')"
f="$(formas)" && ok "cada valor tiene una forma del contrato (§4.5): no hay texto libre" || ko "formas: ${f}"
[ "$(js e.version)" = 1 ] && [ "$(js e.corre)" = "${B}" ] && [ "$(js e.anterior)" = "${A}" ] && [ "$(js e.publicable)" = "${B}" ] \
  && [ "$(js 'JSON.stringify(e.vigilante)')" = '{"estado":"al-dia","motivo":null,"faltan":[]}' ] && [ "$(js e.congelado)" = null ] \
  && ok "corre B, anterior A, publicable B, vigilante al día y sin congelar" || ko "campos: $(cut -c1-300 "${J}")"
[ "$(js e.historial.length)" = 1 ] && [ "$(ult)" = "publicada ${B} vigilante null" ] && ok "historial: un evento «publicada» de B, automático" || ko "historial: $(ult)"
! grep -q 'SECRETO\|TOKENKUMA\|secreto-cron\|/srv\|http' "${J}" && ok "sin secretos, rutas ni URLs" || ko "el archivo trae texto que no debe"
i1="$(stat -c %i "${J}")"; correr vigilar; i2="$(stat -c %i "${J}")"
[ "${RC}" = 0 ] && [ "${i1}" != "${i2}" ] && [ "$(js e.historial.length)" = 1 ] && [ "$(vig)" = "al-dia null" ] \
  && ok "otra vuelta al día: reemplaza el archivo con mv (otro inodo) y no agrega eventos" || ko "segunda vuelta: inodo ${i1}→${i2}, $(js e.historial.length) eventos"
if [ -f "${LECTOR}" ]; then
  r="$(lector "${J}")"; [ "${r}" = "ok descartados=0 historial=1 vigilante=al-dia" ] && ok "el lector del Studio (parseEstadoPublicaciones) lo acepta entero" || ko "lector: ${r:-sin salida}"
else nv "el lector del Studio no está en este árbol (PR #264): se prueban las formas, no el parser"; fi

echo; echo "== estado: retenida, un evento por motivo =="
reiniciar; printf '%s\n' 0001_init 0300_alfa > "${D}/ledger"; correr vigilar; correr vigilar
[ "${RC}" = 1 ] && [ "$(js 'JSON.stringify(e.vigilante)')" = '{"estado":"retenida","motivo":"migraciones","faltan":["0301_beta","0302_gama"]}' ] \
  && ok "faltan migraciones: vigilante retenido por «migraciones», con las que faltan" || ko "vigilante: $(js 'JSON.stringify(e.vigilante)')"
[ "$(js e.historial.length)" = 1 ] && [ "$(ult)" = "retenida ${B} vigilante migraciones" ] && [ "$(js 'JSON.stringify(e.historial[0].faltan)')" = '["0301_beta","0302_gama"]' ] \
  && ok "dos vueltas con el mismo motivo: un solo evento «retenida», con sus faltantes" || ko "retenidas: $(js 'JSON.stringify(e.historial)')"
echo 0301_beta >> "${D}/ledger"; correr vigilar
[ "$(js e.historial.length)" = 2 ] && [ "$(js 'JSON.stringify(e.historial[0].faltan)')" = '["0302_gama"]' ] \
  && ok "si cambia lo que falta, otro evento (la misma regla que el aviso)" || ko "tras el cambio: $(js 'JSON.stringify(e.historial)')"
f="$(formas)" && ok "retenida: sigue sin texto libre" || ko "formas: ${f}"
correr aceptar-pendiente 0302_gama; correr vigilar
[ "${RC}" = 0 ] && [ "$(ult)" = "publicada ${B} vigilante null" ] && [ "$(vig)" = "al-dia null" ] && ok "cuando pasa la puerta: «publicada» y al día" || ko "tras aceptar: $(ult) / $(vig)"

echo; echo "== estado: cada negativa con su código =="
caso() { # $1 = «estado motivo» esperado del vigilante, $2 = evento esperado («vacío» o «resultado motivo»), $3 = qué se probó
  local f e
  correr vigilar
  e="$(js 'e.historial.length ? e.historial[0].resultado + " " + e.historial[0].motivo : "vacío"')"
  if [ "$(vig)" = "$1" ] && [ "${e}" = "$2" ] && f="$(formas)"; then ok "$3 → vigilante «$1», historial «$2»"; else ko "$3: vigilante «$(vig)», historial «${e}» ${f:-}"; fi
}
reiniciar; echo 1 > "${D}/rc-pull"; caso "detenido descarga" "vacío" "no pudo bajar :publicable"
! grep -q 'denied\|Error' "${J}" && ok "el error de docker pull no llega al archivo" || ko "el error de docker llegó al archivo"
reiniciar; touch "${P}/compose.ensayo.yml"; caso "detenido ensayo" "vacío" "compose.ensayo.yml puesto"
reiniciar; sed -i 's/^PUBLICAR_MIN_LIBRE_GB=0/PUBLICAR_MIN_LIBRE_GB=999999/' "${O}/publicar.env"; caso "detenido disco" "vacío" "poco disco"
reiniciar; sed -i 's|^org.opencontainers.image.source=.*|org.opencontainers.image.source=https://github.com/otro/repo|' "${D}/img/${IB}/labels"; caso "detenido imagen" "vacío" "imagen de otro repositorio"
reiniciar; echo "# a mano" >> "${P}/compose.yml"; caso "retenida huellas" "retenida huellas" "compose.yml distinto del commit"
reiniciar; sed -i '/^org.dtdcargo.migraciones=/d' "${D}/img/${IB}/labels"; caso "retenida etiquetas" "retenida etiquetas" "imagen sin etiqueta de migraciones"
reiniciar; : > "${D}/ledger"; caso "retenida ledger" "retenida ledger" "ledger vacío"
reiniciar; echo 1 > "${D}/rc-sharp"; caso "retenida sharp" "retenida sharp" "sharp no convierte"
reiniciar; echo "DTD_WEB_IMAGE=${IMG}:sha-${X}" >> "${P}/.env"; caso "retenida env" "retenida env" ".env con dos líneas DTD_WEB_IMAGE"
reiniciar; rm -f "${D}/img/${IA}/local" "${D}/reg/$(printf '%s' "${IMG}:sha-${A}" | tr '/:@' '___')"; caso "retenida sin-vuelta-atras" "retenida sin-vuelta-atras" "sin la imagen anterior"
reiniciar; echo unhealthy > "${D}/salud/${IB}"; caso "retenida salud" "vuelta-atras salud" "web unhealthy"
reiniciar; printf '1\n1\n' > "${D}/smoke-rcs"; caso "retenida prueba-rapida" "vuelta-atras prueba-rapida" "la prueba rápida falla dos veces"
[ "$(ult)" = "vuelta-atras ${B} vigilante prueba-rapida" ] && [ "$(js e.corre)" = "${A}" ] && ok "la «vuelta-atras» es de B (la que falló) y corre A" || ko "vuelta: $(ult) corre $(js e.corre)"
caso "retenida rechazada" "vuelta-atras prueba-rapida" "al minuto siguiente, ya rechazada (sin evento nuevo)"
[ "$(js e.historial.length)" = 1 ] && ok "la rechazada no suma eventos" || ko "eventos: $(js e.historial.length)"

echo; echo "== estado: congelado y vuelta atrás fallida =="
reiniciar; printf '1\n1\n1\n1\n' > "${D}/smoke-rcs"; correr vigilar
[ "${RC}" = 2 ] && [ "$(ult)" = "vuelta-atras-fallida ${B} vigilante prueba-rapida" ] && [ "$(js e.congelado.automatico)" = true ] \
  && [[ "$(js e.congelado.desde)" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z$ ]] && [ "$(vig)" = "congelado null" ] && f="$(formas)" \
  && ok "doble fallo: sale 2, «vuelta-atras-fallida» por el motivo de la nueva, congelado automático" || ko "doble fallo rc=${RC}: $(cut -c1-400 "${J}") ${f:-}"
correr descongelar
[ "$(js e.congelado)" = null ] && [ "$(vig)" = null ] && ok "descongelar: sin congelado; el vigilante, sin dato hasta su próxima vuelta" || ko "descongelar: $(cut -c1-300 "${J}")"
reiniciar; echo 1 > "${D}/rc-up"; correr vigilar
[ "${RC}" = 2 ] && [ "$(ult)" = "vuelta-atras-fallida ${B} vigilante compose" ] && ok "docker compose up falla en la nueva y en la vuelta: «vuelta-atras-fallida» por compose" || ko "compose rc=${RC}: $(ult)"
reiniciar; echo unhealthy > "${D}/salud/${IB}"; printf '1\n1\n' > "${D}/smoke-rcs"; correr vigilar
[ "${RC}" = 2 ] && [ "$(ult)" = "vuelta-atras-fallida ${B} vigilante salud" ] \
  && ok "la nueva no arranca (salud) y la vuelta falla la prueba rápida: el evento lleva «salud», el motivo de la nueva" || ko "motivo de la fallida rc=${RC}: $(ult)"
reiniciar; correr vigilar; correr congelar "corte de prueba"
[ "$(js e.congelado.automatico)" = false ] && [ "$(vig)" = "congelado null" ] && ! grep -q 'corte de prueba' "${J}" \
  && ok "congelar a mano: automático false, y el motivo escrito a mano no va al archivo" || ko "congelar: $(cut -c1-300 "${J}")"
reiniciar; mkdir -p "${O}/estado"; touch -d '2 minutes ago' "${O}/estado/congelado-automatico"; echo "a mano · alguien" > "${O}/CONGELADO"; correr vigilar
[ "$(js e.congelado.automatico)" = false ] && ok "una marca de automático vieja no cuenta para un CONGELADO puesto después a mano" || ko "marca vieja: $(js 'JSON.stringify(e.congelado)')"

echo; echo "== estado: a mano y vuelta atrás a mano =="
reiniciar; imagen "${X}" "${IX}" "${DX}" 300; correr publicar "${X}"
[ "${RC}" = 0 ] && [ "$(ult)" = "publicada ${X} a-mano null" ] && [ "$(js e.corre)" = "${X}" ] && ok "a mano: «publicada» con origen a-mano" || ko "a mano: $(ult)"
correr volver
[ "${RC}" = 0 ] && [ "$(ult)" = "vuelta-atras-a-mano ${A} a-mano null" ] && [ "$(js e.corre)" = "${A}" ] && ok "volver: «vuelta-atras-a-mano» con el commit al que volvió" || ko "volver: $(ult)"
if [ -f "${LECTOR}" ]; then
  r="$(lector "${J}")"; [ "${r}" = "ok descartados=0 historial=2 vigilante=null" ] && ok "el lector del Studio acepta el historial a mano" || ko "lector: ${r:-sin salida}"
fi

echo; echo "== estado: historial, tamaño y fallas del escritor =="
reiniciar; mkdir -p "${O}/estado"
for i in $(seq 0 249); do
  printf '{"hora":"2026-10-01T%02d:%02d:%02dZ","sha":"%s","origen":"vigilante","resultado":"publicada","motivo":null}\n' $((i / 3600)) $((i / 60 % 60)) $((i % 60)) "${A}"
done > "${O}/estado/historial.jsonl"
printf '{"hora":"2026-10-01T09:00:00Z","sha":"%s","origen":"vigilante","resultado":"publicada","motivo":"/srv/ops/web SECRETO"}\n' "${A}" >> "${O}/estado/historial.jsonl"
correr vigilar
[ "$(js e.historial.length)" = 20 ] && [ "$(ult)" = "publicada ${B} vigilante null" ] && [ "$(js e.historial[1].hora)" = "2026-10-01T00:04:09Z" ] && ! grep -q SECRETO "${J}" \
  && ok "historial: los 20 más nuevos, el más nuevo primero; una línea con texto libre no pasa" || ko "historial: $(js e.historial.length) · $(js e.historial[1].hora)"
[ "$(grep -c . "${O}/estado/historial.jsonl")" = 200 ] && ok "el historial del servidor se queda en 200 líneas" || ko "historial.jsonl: $(grep -c . "${O}/estado/historial.jsonl") líneas"
reiniciar; mkdir -p "${O}/estado"
largo="$(for i in $(seq 1000 1099); do printf '%s_%s,' "${i}" "$(printf 'x%.0s' $(seq 1 78))"; done)"; largo="${largo%,}"
sed -i "s/^org.dtdcargo.migraciones=.*/org.dtdcargo.migraciones=v1:100:${largo}/" "${D}/img/${IB}/labels"
for i in $(seq 10 49); do
  printf '{"hora":"2026-10-01T00:00:%02dZ","sha":"%s","origen":"vigilante","resultado":"retenida","motivo":"migraciones","faltan":[%s]}\n' "${i}" "${A}" \
    "$(printf '"%s",' $(printf '%s' "${largo}" | tr ',' ' ' | cut -d' ' -f1-50) | sed 's/,$//')"
done > "${O}/estado/historial.jsonl"
correr vigilar
tam="$(stat -c %s "${J}")"
[ "${tam}" -le 131072 ] && [ "$(js e.vigilante.faltan.length)" = 50 ] && [ "$(js e.historial[0].faltan.length)" = 50 ] && f="$(formas)" \
  && ok "100 faltantes de 83 caracteres y 20 eventos llenos: ${tam} bytes (tope del Studio: 131072), 50 faltantes por lista" || ko "tamaño ${tam} · $(js e.vigilante.faltan.length) ${f:-}"
reiniciar; echo "no soy carpeta" > "${P}/estado-publicacion"; correr vigilar
[ "${RC}" = 0 ] && [ "$(imagen_env)" = "${IMG}:sha-${B}@${DB}" ] && grep -q 'estado para el Studio: no pude' "${T}/salida.log" \
  && ok "si no puede escribir el estado: publica igual, lo dice y sale 0" || { ko "escritor roto rc=${RC}"; ver; }
reiniciar; mkdir -p "${O}/estado"; imagen "${X}" "${IX}" "${DX}" 300
printf '%s\n' '{"estado":"al-dia","motivo":"/srv/ops SECRETO","faltan":[]}' > "${O}/estado/vigilante.json"
correr publicar "${X}"
[ "$(vig)" = null ] && ! grep -q SECRETO "${J}" && ok "un vigilante.json con otra forma no pasa al archivo (queda null)" || ko "vigilante.json raro: $(vig)"
reiniciar; correr estado; correr revisar; correr aceptar-pendiente 0302_gama
[ ! -e "${J}" ] && ok "estado, revisar y aceptar-pendiente no escriben el archivo" || ko "lo escribieron"
reiniciar; correr vigilar; i1="$(stat -c %i "${J}")"
( exec 9>"${T}/candado"; flock 9; sleep 30 ) & PID_CANDADO=$!
sleep 1; correr vigilar
kill "${PID_CANDADO}" 2>/dev/null; wait "${PID_CANDADO}" 2>/dev/null
[ "$(stat -c %i "${J}")" = "${i1}" ] && ok "con otra publicación en curso no toca el estado (lo escribe la que tiene el candado)" || ko "escribió sin el candado"

echo; echo "== estado: el código y el montaje =="
awk '/(^|[^A-Z_])MOTIVO="/ && !/MOTIVO="\$\{MOTIVO\}/ && !/MOTIVO=""/ && !/CODIGO=/ { print NR ": " $0 }' "${SCRIPT}" > "${T}/sin-codigo"
[ -s "${SCRIPT}" ] && grep -q 'MOTIVO="' "${SCRIPT}" && [ ! -s "${T}/sin-codigo" ] && ok "cada MOTIVO= lleva su CODIGO en la misma línea" || ko "MOTIVO sin CODIGO: $(head -2 "${T}/sin-codigo" | cut -c1-140)"
grep -oE 'CODIGO=[a-z-]+' "${SCRIPT}" | cut -d= -f2 | sort -u > "${T}/codigos"
printf '%s\n' migraciones ledger huellas sharp etiquetas imagen descarga disco ensayo env sin-vuelta-atras salud prueba-rapida compose rechazada | sort > "${T}/lista"
[ -s "${T}/codigos" ] && [ -z "$(comm -23 "${T}/codigos" "${T}/lista")" ] && ok "los códigos del script son de la lista cerrada de §4.4 ($(grep -c . "${T}/codigos") distintos)" || ko "códigos fuera de la lista: $(comm -23 "${T}/codigos" "${T}/lista" | tr '\n' ' ')"
awk '/^  web:/ { w = 1; next } /^  [a-z]/ { w = 0 } w' "${REPO}/infra/dtd-cargo/compose.yml" > "${T}/web.yml"
grep -qx '      - ./estado-publicacion:/var/lib/dtd-cargo/publicacion:ro' "${T}/web.yml" \
  && ok "compose.yml: el web monta ./estado-publicacion en /var/lib/dtd-cargo/publicacion, solo lectura" || ko "montaje del web en compose.yml"
if [ -f "${REPO}/lib/studio/publicaciones-loader.ts" ]; then
  grep -qF '"/var/lib/dtd-cargo/publicacion/publicaciones.json"' "${REPO}/lib/studio/publicaciones-loader.ts" \
    && ok "el destino del montaje es la carpeta que lee el Studio (RUTA_ESTADO_PUBLICACIONES)" || ko "el loader del Studio lee otra ruta"
else nv "publicaciones-loader.ts no está en este árbol (PR #264): no se compara su ruta con el montaje"; fi

echo; echo "== unidades de systemd =="
grep -qx 'ExecStart=/srv/ops/web/publicar-web.sh vigilar' "${UNITS}/dtd-cargo-publicar.service" && grep -qx 'Type=oneshot' "${UNITS}/dtd-cargo-publicar.service" \
  && ok "el servicio corre publicar-web.sh vigilar, oneshot" || ko "servicio"
grep -qx 'OnUnitInactiveSec=60s' "${UNITS}/dtd-cargo-publicar.timer" && grep -qx 'Unit=dtd-cargo-publicar.service' "${UNITS}/dtd-cargo-publicar.timer" \
  && ok "el timer vuelve 60 s después de que termina la vuelta anterior (no se superponen)" || ko "timer"
bash -n "${S}/web/publicar-web.sh" && bash -n "${HUELLAS}" && ok "bash -n de los dos scripts" || ko "bash -n"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ · ${nv} NO VERIFICADO"
[ "${fail}" = 0 ]
