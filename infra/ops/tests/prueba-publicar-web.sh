#!/usr/bin/env bash
# infra/ops/tests/prueba-publicar-web.sh — prueba de infra/ops/web/publicar-web.sh,
# de huellas-fuera-de-imagen.sh y de las unidades de systemd (SDD-0541).
#
#   bash infra/ops/tests/prueba-publicar-web.sh               # la prueba
#   bash infra/ops/tests/prueba-publicar-web.sh --mutantes    # control rojo + mutantes del diff
#   MUTANTES_SOLO=disco bash … --mutantes                     # solo los mutantes cuyo nombre lo contiene
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
  mutar() { # $1 = nombre, $2 = texto exacto, $3 = reemplazo. MUTANTES_SOLO=<texto> corre solo los que lo nombran.
    local n
    case "$1" in *"${MUTANTES_SOLO:-}"*) ;; *) return ;; esac
    n="$(perl -0ne 'BEGIN { $a = shift } $c = () = /\Q$a\E/g; print $c' "$2" "${ORIG}")"
    [ "${n}" = 1 ] || { echo "MUTANTE MAL ARMADO «$1»: el texto aparece ${n} veces"; vivos=$((vivos + 1)); return; }
    perl -0pe 'BEGIN { $a = shift; $b = shift } s/\Q$a\E/$b/' "$2" "$3" "${ORIG}" > "${M}/mutante.sh"
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
  mutar "no espera healthy" 'esperar_web "$2" || { MOTIVO="la web no quedó healthy"; return 1; }' 'true'
  mutar "publica a mano y el vigilante la pisa" '      marcar_rechazo "${pdig}" "${prev}"' '      true "${pdig}" "${prev}"'
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
  images)
    for id in $(ls "$D/img"); do [ -f "$D/img/$id/local" ] && echo "$(cat "$D/img/$id/creado") $id"; done | sort -rn | awk '{ print "sha256:" $2 }' ;;
  rmi)
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

echo; echo "== estado, revisar y uso =="
reiniciar; correr estado
[ "${RC}" = 0 ] && grep -q 'Telegram:    configurado' "${T}/salida.log" && ! grep -q 'SECRETO\|TOKENKUMA\|-1001234' "${T}/salida.log" && ok "estado no imprime tokens ni el chat" || { ko "estado"; ver; }
correr revisar; [ "${RC}" = 0 ] && grep -q 'PUERTAS: pasan' "${T}/salida.log" && [ "$(ups)" = 0 ] && ok "revisar: corre las puertas sin publicar" || { ko "revisar rc=${RC}"; ver; }
correr; [ "${RC}" = 3 ] && ok "sin subcomando: uso (3)" || ko "uso rc=${RC}"

echo; echo "== unidades de systemd =="
grep -qx 'ExecStart=/srv/ops/web/publicar-web.sh vigilar' "${UNITS}/dtd-cargo-publicar.service" && grep -qx 'Type=oneshot' "${UNITS}/dtd-cargo-publicar.service" \
  && ok "el servicio corre publicar-web.sh vigilar, oneshot" || ko "servicio"
grep -qx 'OnUnitInactiveSec=60s' "${UNITS}/dtd-cargo-publicar.timer" && grep -qx 'Unit=dtd-cargo-publicar.service' "${UNITS}/dtd-cargo-publicar.timer" \
  && ok "el timer vuelve 60 s después de que termina la vuelta anterior (no se superponen)" || ko "timer"
bash -n "${S}/web/publicar-web.sh" && bash -n "${HUELLAS}" && ok "bash -n de los dos scripts" || ko "bash -n"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
