#!/usr/bin/env bash
# infra/ops/tests/prueba-vigilar-chatwoot.sh — prueba de las alarmas nuevas de
# infra/chatwoot/vigilar.sh y de infra/chatwoot/renovar-instagram.sh (SDD-0583):
# la puerta 7 de 4.9 de la SDD-0582 (cupo y fallas de WhatsApp) y el token de Instagram.
#
#   bash infra/ops/tests/prueba-vigilar-chatwoot.sh              # suite, control rojo y mutantes (lo corre el CI)
#   bash infra/ops/tests/prueba-vigilar-chatwoot.sh --suite      # solo la suite
#   bash infra/ops/tests/prueba-vigilar-chatwoot.sh --mutantes   # solo control rojo y mutantes
#   MUTANTES_SOLO="cupo|días" bash … --mutantes                  # solo los mutantes cuyo nombre contiene alguno
#   MUTANTES_SECO=1 bash … --mutantes                             # sin correr suites: cada texto aparece una vez y el mutante pasa bash -n
#
# Sin Chatwoot, sin Docker y sin red. `docker`, `curl` y `df` son dobles en el PATH; /proc es
# una carpeta inventada (VIGILAR_PROC); los conteos de psql y la salida de `rails runner` son
# datos inventados. El doble de docker anota lo que recibe: la consulta que llega por stdin a
# psql y el Ruby que llega a `rails runner`. Con `ruby` en el PATH (lo trae el runner de
# ubuntu del CI), ese Ruby corre de verdad contra un Channel::Instagram de mentira; sin ruby,
# esa parte sale NO DISPONIBLE fuera del CI y FALLÓ dentro (CI=true).
# La consulta SQL se prueba aparte, en PGlite: infra/ops/tests/vigilar-whatsapp.test.mjs.
#
# Cada comprobación imprime «PASÓ  · …» o «FALLÓ · …». Cada mutante tiene que hacer fallar la
# suite; uno que sobrevive es FALLÓ. PRUEBA_SECCIONES (vigilar, renovar, e2e) y PRUEBA_PARAR
# (cortar al primer FALLÓ) los usa solo el modo de mutantes.
set -uo pipefail
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
YO="${R}/infra/ops/tests/prueba-vigilar-chatwoot.sh"
VIGILAR="${VIGILAR_SH:-${R}/infra/chatwoot/vigilar.sh}"
RENOVAR="${RENOVAR_SH:-${R}/infra/chatwoot/renovar-instagram.sh}"
SQL="${R}/infra/chatwoot/vigilar-whatsapp.sql"
MODO="${1:-todo}"

mutantes() {
  local M vivos=0 muertos=0
  M="$(mktemp -d)"
  cp "${SQL}" "${M}/vigilar-whatsapp.sql"
  suite() { # $1 = guion mutado, $2 = cuál (vigilar|renovar)
    if [ "$2" = vigilar ]; then
      PRUEBA_PARAR=1 PRUEBA_SECCIONES="vigilar e2e" VIGILAR_SH="$1" bash "${YO}" --suite > "${M}/suite.log" 2>&1
    else
      PRUEBA_PARAR=1 PRUEBA_SECCIONES="renovar e2e" RENOVAR_SH="$1" bash "${YO}" --suite > "${M}/suite.log" 2>&1
    fi
  }
  if [ -z "${MUTANTES_SECO:-}" ]; then
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/vigilar.sh"
  if suite "${M}/vigilar.sh" vigilar; then echo "FALLÓ · control rojo: la suite pasa con un vigilar.sh que no hace nada"; vivos=$((vivos + 1))
  else echo "PASÓ  · control rojo: con un vigilar.sh vacío la suite falla ($(grep -m1 '^FALLÓ' "${M}/suite.log" | sed 's/^FALLÓ · //'))"; fi
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/renovar.sh"
  if suite "${M}/renovar.sh" renovar; then echo "FALLÓ · control rojo: la suite pasa con un renovar-instagram.sh que no hace nada"; vivos=$((vivos + 1))
  else echo "PASÓ  · control rojo: con un renovar-instagram.sh vacío la suite falla ($(grep -m1 '^FALLÓ' "${M}/suite.log" | sed 's/^FALLÓ · //'))"; fi
  fi

  mutar() { # $1 = vigilar|renovar, $2 = nombre, $3 = texto exacto (una sola vez en el guion), $4 = reemplazo
    local orig destino n
    if [ -n "${MUTANTES_SOLO:-}" ] && ! [[ "$2" =~ ${MUTANTES_SOLO} ]]; then return; fi
    if [ "$1" = vigilar ]; then orig="${R}/infra/chatwoot/vigilar.sh"; destino="${M}/vigilar.sh"; else orig="${R}/infra/chatwoot/renovar-instagram.sh"; destino="${M}/renovar.sh"; fi
    n="$(perl -0ne 'BEGIN { $a = shift } $c = () = /\Q$a\E/g; print $c' -- "$3" "${orig}")"
    [ "${n}" = 1 ] || { echo "FALLÓ · mutante mal armado «$2»: el texto aparece ${n} veces"; vivos=$((vivos + 1)); return; }
    perl -0pe 'BEGIN { $a = shift; $b = shift } s/\Q$a\E/$b/' -- "$3" "$4" "${orig}" > "${destino}"
    if [ -n "${MUTANTES_SECO:-}" ]; then
      if bash -n "${destino}" && ! cmp -s "${destino}" "${orig}"; then echo "PASÓ  · armado «$2»"
      else echo "FALLÓ · el mutante «$2» no cambia el guion o no pasa bash -n"; vivos=$((vivos + 1)); fi
      return
    fi
    if suite "${destino}" "$1"; then
      echo "FALLÓ · mutante VIVO «$2»"; vivos=$((vivos + 1))
    else
      echo "PASÓ  · mutante muerto «$2» ($(grep -m1 '^FALLÓ' "${M}/suite.log" | sed 's/^FALLÓ · //'))"; muertos=$((muertos + 1))
    fi
  }
  # ── vigilar.sh · WhatsApp (puerta 7). El primero es el control rojo de la especificación:
  # sin el control nuevo, 800 salientes salen `up`.
  mutar vigilar "sin el control del cupo (800 sale up)" '[ "$s" -ge "$U_CUPO" ] && MOTIVOS+=("WhatsApp bandeja $b: $s de 1.000 en el mes")' ':'
  mutar vigilar "cupo con > en vez de ≥" '[ "$s" -ge "$U_CUPO" ]' '[ "$s" -gt "$U_CUPO" ]'
  mutar vigilar "cupo fijo, sin UMBRAL_CUPO_WHATSAPP" 'U_CUPO="${UMBRAL_CUPO_WHATSAPP:-800}"' 'U_CUPO=800'
  mutar vigilar "sin el control de fallas" '[ "$f" -ge "$U_FALLAS" ] && MOTIVOS+=("WhatsApp bandeja $b: $f fallas en 24 h")' ':'
  mutar vigilar "fallas con > en vez de ≥" '[ "$f" -ge "$U_FALLAS" ]' '[ "$f" -gt "$U_FALLAS" ]'
  mutar vigilar "fallas fijas, sin UMBRAL_FALLAS_WHATSAPP" 'U_FALLAS="${UMBRAL_FALLAS_WHATSAPP:-1}"' 'U_FALLAS=1'
  mutar vigilar "psql caído cuenta como verde" '2>/dev/null)"; then
  MOTIVOS+=("cupo WhatsApp sin lectura")' '2>/dev/null)"; then
  :'
  mutar vigilar "cero bandejas cuenta como verde" 'MOTIVOS+=("cupo WhatsApp: ninguna bandeja de WhatsApp")' ':'
  mutar vigilar "acepta filas mal formadas" 'then wa_ok=0; break; fi' 'then :; fi'
  mutar vigilar "fila mal formada no avisa" 'WA_FALLAS=""; MOTIVOS+=("cupo WhatsApp sin lectura"); fi' 'WA_FALLAS=""; fi'
  mutar vigilar "la columna guarda la última bandeja, no la mayor" '[ "$s" -gt "$WA_MAX" ] && WA_MAX="$s"' 'WA_MAX="$s"'
  mutar vigilar "las fallas no se suman entre bandejas" 'WA_FALLAS=$((WA_FALLAS + f))' 'WA_FALLAS=$f'
  mutar vigilar "la consulta no llega por stdin" '<"$SQL_WA" 2>/dev/null)"' '</dev/null 2>/dev/null)"'
  mutar vigilar "psql sin ON_ERROR_STOP" '-v ON_ERROR_STOP=1 ' ''
  mutar vigilar "lee con rails runner y no con psql" 'docker exec -i "${ID[postgres]}" sh -c' 'docker exec -i "${ID[rails]}" sh -c'
  # ── vigilar.sh · Instagram
  mutar vigilar "sin estado de Instagram cuenta como verde" ']] || [ -z "$IG_RES" ]; then
  MOTIVOS+=("token Instagram sin lectura")' ']] || [ -z "$IG_RES" ]; then
  :'
  mutar vigilar "renovación fallida cuenta como verde" '[ "$IG_RES" = ok ] || MOTIVOS+=' 'true || MOTIVOS+='
  mutar vigilar "sin el control de horas" '[ $((AHORA - IG_TS)) -gt $((U_IG_HORAS * 3600)) ] && MOTIVOS' 'false && MOTIVOS'
  mutar vigilar "horas fijas, sin UMBRAL_INSTAGRAM_HORAS" 'U_IG_HORAS="${UMBRAL_INSTAGRAM_HORAS:-26}"' 'U_IG_HORAS=26'
  mutar vigilar "sin el control de días" '[ $((IG_VENCE - IG_TS)) -lt $((U_IG_DIAS * 86400)) ] && MOTIVOS' 'false && MOTIVOS'
  mutar vigilar "días medidos contra la hora actual (suena en cada ciclo)" '[ $((IG_VENCE - IG_TS)) -lt' '[ $((IG_VENCE - AHORA)) -lt'
  mutar vigilar "días fijos, sin UMBRAL_INSTAGRAM_DIAS" 'U_IG_DIAS="${UMBRAL_INSTAGRAM_DIAS:-10}"' 'U_IG_DIAS=10'
  mutar vigilar "vencimiento ilegible cuenta como verde" 'else
      MOTIVOS+=("token Instagram sin lectura")' 'else
      :'
  # ── vigilar.sh · CSV y resumen
  mutar vigilar "COLUMNAS sin las columnas nuevas" 'ttfb_chat,wa_salientes_max,wa_fallas_24h,ig_dias,estado' 'ttfb_chat,estado'
  mutar vigilar "la fila sin los valores nuevos" '$TTFB_CHAT,$WA_MAX,$WA_FALLAS,$IG_DIAS,$ESTADO' '$TTFB_CHAT,$ESTADO'
  mutar vigilar "un CSV de otra versión no se aparta" 'then mv "$CSV" "$CSV.hasta-' 'then true "$CSV" "$CSV.hasta-'
  mutar vigilar "el resumen no dice WhatsApp" 'printf "WhatsApp: salientes del mes' 'if (0) printf "WhatsApp: salientes del mes'
  mutar vigilar "el resumen toma la última muestra y no la mayor" 'if (x + 0 > wamax) wamax = x + 0;' 'wamax = x + 0;'
  mutar vigilar "el resumen toma el último token y no el menor" '(igmin == "" || z + 0 < igmin + 0)' '(1)'
  mutar vigilar "el resumen de un CSV viejo inventa WhatsApp" 'if ("wa_salientes_max" in col) {
        printf' 'if (1) {
        printf'
  mutar vigilar "el motivo no llega al latido" '--data-urlencode "msg=$MOTIVO"' '--data-urlencode "msg=down"'
  # ── renovar-instagram.sh
  mutar renovar "sin rails cuenta como ok" 'MOTIVO="rails no corre"' 'MOTIVO=""'
  mutar renovar "el código de salida de rails runner no importa" 'if [ "$rc" != 0 ]; then' 'if false; then'
  mutar renovar "sin resumen cuenta como ok" 'MOTIVO="sin resumen de rails runner"' ':'
  mutar renovar "un resumen que no cuadra cuenta como ok" 'elif [ "$FIN" != "$lineas" ]; then' 'elif false; then'
  mutar renovar "una excepción no es falla" '[ "${BASH_REMATCH[4]}" = 1 ] && FALLAS=$((FALLAS + 1))' ':'
  mutar renovar "menos de 10 días no es falla (se traga el error)" '[ $((despues - AHORA)) -lt $((U_DIAS * 86400)) ] && BAJO=$((BAJO + 1))' ':'
  mutar renovar "mide los días con la fecha de antes" '[ $((despues - AHORA)) -lt' '[ $((antes - AHORA)) -lt'
  mutar renovar "umbral fijo, sin UMBRAL_INSTAGRAM_DIAS" 'U_DIAS="${UMBRAL_INSTAGRAM_DIAS:-10}"' 'U_DIAS=10'
  mutar renovar "no cuenta las renovaciones" '[ "$despues" -gt "$antes" ] && RENOVADOS=$((RENOVADOS + 1))' ':'
  mutar renovar "vence_min es el mayor y no el menor" '[ "$despues" -lt "$VENCE_MIN" ]' '[ "$despues" -gt "$VENCE_MIN" ]'
  mutar renovar "imprime la salida cruda de rails runner" '2>&1)"; rc=$?' '2>&1)"; rc=$?; printf "%s\n" "$SALIDA"'
  mutar renovar "sale 0 aunque falle" '[ "$RESULTADO" = ok ]
' 'true
'
  mutar renovar "el Ruby no lee el token" '    c.access_token
' '    c.id
'
  mutar renovar "el Ruby no relee el canal" '  c.reload
' ''
  rm -rf "${M}"
  echo "RESULTADO MUTANTES: ${muertos} muertos · ${vivos} vivos o mal armados"
  [ "${vivos}" = 0 ]
}

if [ "${MODO}" = --mutantes ]; then mutantes; exit; fi

# ════════════════════════════════════════ suite ════════════════════════════════════════
T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); [ -z "${PRUEBA_PARAR:-}" ] || exit 1; }
seccion() { [[ " ${PRUEBA_SECCIONES:-vigilar renovar e2e} " == *" $1 "* ]]; }
D="${T}/doble"; mkdir -p "${T}/bin" "${D}" "${T}/proc/pressure" "${T}/cw" "${T}/datos/storage" "${T}/datos/postgres"
SECRETO="IGQWRtokenSECRETO0123456789"   # el «token» que traen los logs de mentira de Rails
TODO="${T}/todas-las-salidas.log"; : > "${TODO}"

cat > "${T}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
# Doble de docker: contenedores id-<servicio>, salvo los marcados caídos.
D="${DOBLE:?}"; printf '%s\n' "$*" >> "$D/docker.log"
case "$1" in
  ps) s=""; for a in "$@"; do case "$a" in label=com.docker.compose.service=*) s="${a#label=com.docker.compose.service=}" ;; esac; done
      [ -e "$D/caido-$s" ] || echo "id-$s" ;;
  stats) echo "12.50% 3.10%" ;;
  inspect) case "$3" in *RestartCount*) echo 0 ;; *OOMKilled*) echo false ;; esac ;;
  exec) shift; i=0; [ "$1" = -i ] && { i=1; shift; }; id="$1"; shift
    case "$id" in
      id-postgres) printf '%s\n' "$@" > "$D/psql.args"; echo "$i" > "$D/psql.i"; cat > "$D/psql.stdin"
        [ -e "$D/psql.salida" ] && cat "$D/psql.salida"; exit "$(cat "$D/psql.rc" 2>/dev/null || echo 0)" ;;
      id-rails) printf '%s\n' "$@" > "$D/rails.args"; printf '%s' "${!#}" > "$D/rails.ruby"
        if [ -e "$D/rails.prelude.rb" ]; then echo "I, [2026-11-06T07:15:00] INFO -- : arranque"; ruby -r "$D/rails.prelude.rb" -e "${!#}"; exit $?; fi
        [ -e "$D/rails.salida" ] && cat "$D/rails.salida"; exit "$(cat "$D/rails.rc" 2>/dev/null || echo 0)" ;;
      *) echo "doble docker: exec en «$id»" >&2; exit 1 ;;
    esac ;;
  *) echo "doble docker: $1 no previsto" >&2; exit 1 ;;
esac
DOBLE
cat > "${T}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
# Doble de curl: el latido de Uptime Kuma (-G) se anota; el resto es un TTFB de 0,25 s.
case " $* " in *" -G "*) printf '%s\n' "$@" > "${DOBLE:?}/latido.args" ;; *) printf '0.250' ;; esac
DOBLE
cat > "${T}/bin/df" <<'DOBLE'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 100000 40000 60000 40%% /\n'
DOBLE
chmod +x "${T}/bin/"*
for r in cpu memory io; do printf 'some avg10=1.00 avg60=2.00 avg300=3.00 total=1\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n' > "${T}/proc/pressure/${r}"; done
echo "0.50 0.40 0.30 1/100 1234" > "${T}/proc/loadavg"
printf 'MemTotal:        8000000 kB\nMemAvailable:    4096000 kB\n' > "${T}/proc/meminfo"
printf 'CHATWOOT_HOST=chat.test\nCHATWOOT_DATA_DIR=%s\n' "${T}/datos" > "${T}/cw/.env"

IG="${T}/ig/instagram-token.estado"
reiniciar() { rm -rf "${D}" "${T}/ig"; mkdir -p "${D}" "${T}/ig"; rm -f "${T}/v.csv"*; A="$(date +%s)"; }
psql_da() { printf '%b' "$1" > "${D}/psql.salida"; }   # filas «bandeja|salientes|fallas»
ig_estado() { # $1 resultado · $2 horas desde la renovación · $3 horas que le quedaban al token al renovar · $4 canales [· $5 motivo]
  local ts=$(($(date +%s) - $2 * 3600))
  printf 'ts_epoch=%s\nresultado=%s\nmotivo=%s\ncanales=%s\nvence_min_epoch=%s\n' "${ts}" "$1" "${5:-}" "$4" "$((ts + $3 * 3600))" > "${IG}"
}
base() { reiniciar; psql_da '1|3|0\n2|1|0\n'; ig_estado ok 2 1200 1; }   # dos bandejas tranquilas; token con 50 días
vigilar() { # argumentos extra → $RC, salida en ${T}/salida, última línea en $LINEA
  PATH="${T}/bin:${PATH}" DOBLE="${D}" VIGILAR_PROC="${T}/proc" bash "${VIGILAR}" --dir "${T}/cw" --csv "${T}/v.csv" \
    --estado-instagram "${IG}" "$@" > "${T}/salida" 2>&1
  RC=$?; LINEA="$(tail -n 1 "${T}/salida")"; cat "${T}/salida" >> "${TODO}"
}
renovar() {
  PATH="${T}/bin:${PATH}" DOBLE="${D}" bash "${RENOVAR}" --estado "${IG}" "$@" > "${T}/salida" 2>&1
  RC=$?; LINEA="$(tail -n 1 "${T}/salida")"; cat "${T}/salida" >> "${TODO}"; [ -f "${IG}" ] && cat "${IG}" >> "${TODO}"
}
up() { [ "${RC}" = 0 ] && [ "${LINEA}" = "vigilar: up · ok" ]; }
down_con() { [ "${RC}" = 0 ] && [[ "${LINEA}" == "vigilar: down · "*"$1"* ]]; }
col() { # $1 = columna → su valor en la última fila del CSV
  awk -F, -v c="$1" 'NR == 1 { for (i = 1; i <= NF; i++) if ($i == c) k = i; next } { v = k ? $k : "SIN-COLUMNA" } END { print v }' "${T}/v.csv"
}
est() { sed -n "s/^$1=//p" "${IG}"; }
ver() { sed 's/^/      /' "${T}/salida" | tail -n 3; }
canal() { echo "DTDIG canal=$1 antes=$((A + $2 * 3600)) despues=$((A + $3 * 3600)) error=$4"; }   # horas desde ahora
ruido() { echo "I, [2026-11-06T07:15:02] INFO -- : Token refresh failed: {\"error\":{\"message\":\"Invalid token ${SECRETO}\"}}"; echo "D, access_token=${SECRETO}"; }
rails_da() { { ruido; cat; } > "${D}/rails.salida"; }

if seccion vigilar; then
echo "== vigilar.sh · línea base =="
base; vigilar --sin-latido
up && ok "dos bandejas con 3 y 1 salientes, sin fallas, token sano: up · ok" || { ko "base: rc=${RC} «${LINEA}»"; ver; }
awk -F, 'NR == 1 { h = NF } NR > 1 && NF != h { mal = 1 } END { exit mal || NR < 2 }' "${T}/v.csv" \
  && [ "$(head -n 1 "${T}/v.csv" | awk -F, '{ print NF }')" = 27 ] && ok "CSV: 27 columnas en la cabecera y en la fila" \
  || ko "CSV descuadrado: $(head -n 1 "${T}/v.csv" | awk -F, '{ print NF }') en la cabecera, $(tail -n 1 "${T}/v.csv" | awk -F, '{ print NF }') en la fila"
[ "$(col wa_salientes_max)" = 3 ] && [ "$(col wa_fallas_24h)" = 0 ] && [[ "$(col ig_dias)" =~ ^(49|50)$ ]] \
  && ok "CSV: wa_salientes_max=3, wa_fallas_24h=0 e ig_dias=$(col ig_dias)" || ko "CSV: $(col wa_salientes_max) · $(col wa_fallas_24h) · $(col ig_dias)"

echo "== vigilar.sh · WhatsApp, puerta 7 de 4.9 =="
cmp -s "${D}/psql.stdin" "${SQL}" && ok "a psql le llega por stdin vigilar-whatsapp.sql, entero" || ko "la consulta que llegó a psql no es vigilar-whatsapp.sql"
[ "$(cat "${D}/psql.i" 2>/dev/null)" = 1 ] && grep -qF 'exec psql -X -q -At -F "|" -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' "${D}/psql.args" \
  && ok "psql en el contenedor de postgres con -i, -At, separador «|» y ON_ERROR_STOP, con el usuario y la base de su entorno" || ko "psql: $(tr '\n' ' ' < "${D}/psql.args" 2>/dev/null)"
! grep -q '^exec id-rails' "${D}/docker.log" && ok "la lectura de WhatsApp no pasa por rails" || ko "vigilar llamó a rails"
base; psql_da '1|800|0\n2|1|0\n'; vigilar --sin-latido
down_con "WhatsApp bandeja 1: 800 de 1.000 en el mes" && [ "$(col wa_salientes_max)" = 800 ] \
  && ok "800 salientes del mes en la bandeja 1: down «WhatsApp bandeja 1: 800 de 1.000 en el mes»" || { ko "800: «${LINEA}»"; ver; }
base; psql_da '1|799|0\n2|1|0\n'; vigilar --sin-latido
up && [ "$(col wa_salientes_max)" = 799 ] && ok "799 salientes: up" || { ko "799: «${LINEA}»"; ver; }
base; psql_da '1|3|0\n2|5|1\n'; vigilar --sin-latido
down_con "WhatsApp bandeja 2: 1 fallas en 24 h" && ! [[ "${LINEA}" == *"bandeja 1"* ]] \
  && ok "1 falla en 24 h en la bandeja 2: down «WhatsApp bandeja 2: 1 fallas en 24 h», sin nombrar a la 1" || { ko "1 falla: «${LINEA}»"; ver; }
base; psql_da '1|500|2\n2|20|1\n'; vigilar --sin-latido
[ "$(col wa_salientes_max)" = 500 ] && [ "$(col wa_fallas_24h)" = 3 ] && ok "CSV: la mayor de las bandejas (500, no la última) y la suma de fallas (2 + 1 = 3)" \
  || ko "CSV con dos bandejas: $(col wa_salientes_max) · $(col wa_fallas_24h)"
base; psql_da '1|3|0\n'; UMBRAL_CUPO_WHATSAPP=3 vigilar --sin-latido
down_con "WhatsApp bandeja 1: 3 de 1.000 en el mes" && ok "UMBRAL_CUPO_WHATSAPP=3 baja el umbral: 3 salientes ya es down" || { ko "umbral de cupo: «${LINEA}»"; ver; }
base; psql_da '1|3|2\n'; UMBRAL_FALLAS_WHATSAPP=3 vigilar --sin-latido
up && ok "UMBRAL_FALLAS_WHATSAPP=3: 2 fallas siguen up" || { ko "umbral de fallas: «${LINEA}»"; ver; }
base; echo 2 > "${D}/psql.rc"; psql_da ''; vigilar --sin-latido
down_con "cupo WhatsApp sin lectura" && [ "$(col wa_salientes_max)" = "" ] && [ "$(col wa_fallas_24h)" = "" ] \
  && ok "psql sale 2: down «cupo WhatsApp sin lectura», con las columnas vacías (un hueco no es un 0)" || { ko "psql roto: «${LINEA}»"; ver; }
base; psql_da '1|abc|0\n'; vigilar --sin-latido
down_con "cupo WhatsApp sin lectura" && [ "$(col wa_salientes_max)" = "" ] && ok "una fila que no son tres números: sin lectura" || { ko "fila mal formada: «${LINEA}»"; ver; }
base; psql_da '1|3|0|9\n'; vigilar --sin-latido
down_con "cupo WhatsApp sin lectura" && ok "una fila con cuatro campos: sin lectura" || { ko "cuatro campos: «${LINEA}»"; ver; }
base; psql_da ''; vigilar --sin-latido
down_con "cupo WhatsApp: ninguna bandeja de WhatsApp" && ok "cero filas: down «ninguna bandeja de WhatsApp» (otra versión o otra base, no un verde)" || { ko "cero filas: «${LINEA}»"; ver; }
base; touch "${D}/caido-postgres"; vigilar --sin-latido
down_con "postgres no corre" && [[ "${LINEA}" == *"cupo WhatsApp sin lectura"* ]] && ok "postgres caído: «postgres no corre» y «cupo WhatsApp sin lectura»" || { ko "postgres caído: «${LINEA}»"; ver; }

echo "== vigilar.sh · token de Instagram =="
base; rm -f "${IG}"; vigilar --sin-latido
down_con "token Instagram sin lectura" && [ "$(col ig_dias)" = "" ] && ok "sin el estado de renovar-instagram.sh: down «token Instagram sin lectura»" || { ko "sin estado: «${LINEA}»"; ver; }
base; printf 'ts_epoch=ayer\nresultado=ok\ncanales=1\nvence_min_epoch=1\n' > "${IG}"; vigilar --sin-latido
down_con "token Instagram sin lectura" && ok "estado con una fecha que no es un número: sin lectura" || { ko "estado roto: «${LINEA}»"; ver; }
base; ig_estado falla 2 200 1 "1 canal(es) con menos de 10 días"; vigilar --sin-latido
down_con "token Instagram: la renovación falló (1 canal(es) con menos de 10 días)" && ok "resultado=falla: down con el motivo de la renovación" || { ko "falla: «${LINEA}»"; ver; }
base; ig_estado ok 27 1200 1; vigilar --sin-latido
down_con "token Instagram: sin renovar hace 27 h" && ok "última renovación hace 27 h: down «sin renovar hace 27 h»" || { ko "27 h: «${LINEA}»"; ver; }
base; ig_estado ok 25 1200 1; vigilar --sin-latido
up && ok "última renovación hace 25 h: up" || { ko "25 h: «${LINEA}»"; ver; }
base; ig_estado ok 2 1200 1; UMBRAL_INSTAGRAM_HORAS=1 vigilar --sin-latido
down_con "sin renovar hace 2 h" && ok "UMBRAL_INSTAGRAM_HORAS=1: 2 h ya es down" || { ko "umbral de horas: «${LINEA}»"; ver; }
base; ig_estado ok 2 239 1; vigilar --sin-latido
down_con "token Instagram: le quedaban 9 días al renovar" && ok "al renovar le quedaban 9 días y 23 h: down «le quedaban 9 días al renovar»" || { ko "9 días: «${LINEA}»"; ver; }
base; ig_estado ok 2 240 1; vigilar --sin-latido
up && ok "al renovar le quedaban 10 días justos: up" || { ko "10 días: «${LINEA}»"; ver; }
base; ig_estado ok 2 1200 1; UMBRAL_INSTAGRAM_DIAS=60 vigilar --sin-latido
down_con "le quedaban 50 días al renovar" && ok "UMBRAL_INSTAGRAM_DIAS=60: 50 días ya es down" || { ko "umbral de días: «${LINEA}»"; ver; }
# Entre dos corridas diarias un token sano baja de 10 días: medirlo contra la hora actual sonaría
# en cada ciclo de renovación.
base; ig_estado ok 23 245 1; vigilar --sin-latido
up && [ "$(col ig_dias)" = 9 ] && ok "renovado hace 23 h con 10,2 días: hoy le quedan 9 (ig_dias=9) y sigue up, sin falsa alarma" || { ko "falsa alarma: «${LINEA}» ig_dias=$(col ig_dias)"; ver; }
base; printf 'ts_epoch=%s\nresultado=ok\ncanales=0\nvence_min_epoch=\n' "$(date +%s)" > "${IG}"; vigilar --sin-latido
up && [ "$(col ig_dias)" = "" ] && ok "cero canales de Instagram: up, ig_dias vacío" || { ko "cero canales: «${LINEA}»"; ver; }
base; printf 'ts_epoch=%s\nresultado=ok\ncanales=1\nvence_min_epoch=\n' "$(date +%s)" > "${IG}"; vigilar --sin-latido
down_con "token Instagram sin lectura" && ok "un canal sin fecha de vencimiento: sin lectura" || { ko "sin vencimiento: «${LINEA}»"; ver; }

echo "== vigilar.sh · CSV, resumen y latido =="
base; echo "ts,psi_cpu10,estado,motivo" > "${T}/v.csv"; echo "2026-11-01T00:00:00Z,1,up,ok" >> "${T}/v.csv"; vigilar --sin-latido
viejo="$(ls "${T}"/v.csv.hasta-* 2>/dev/null | head -n 1)"
[ -n "${viejo}" ] && [ "$(head -n 1 "${viejo}")" = "ts,psi_cpu10,estado,motivo" ] && [ "$(wc -l < "${viejo}")" = 2 ] && [ "$(wc -l < "${T}/v.csv")" = 2 ] \
  && [ "$(head -n 1 "${T}/v.csv" | awk -F, '{ print NF }')" = 27 ] && ok "un CSV con otra cabecera se aparta entero (v.csv.hasta-…) y se empieza otro" || ko "CSV viejo: «${viejo}»"
base; psql_da '1|800|0\n'; vigilar --sin-latido; psql_da '1|3|1\n'; ig_estado ok 2 1440 1; vigilar --sin-latido
PATH="${T}/bin:${PATH}" bash "${VIGILAR}" --resumen --csv "${T}/v.csv" > "${T}/resumen" 2>&1
grep -qx 'WhatsApp: salientes del mes, máx por bandeja = 800 · fallas en 24 h, máx = 1 · sin lectura: 0' "${T}/resumen" \
  && grep -qx 'Instagram: días al vencer el token, mín = 49' "${T}/resumen" && grep -q '^muestras=2 ' "${T}/resumen" \
  && ok "--resumen: máximo de salientes (800, no el último 3), máximo de fallas y mínimo de días del token (49, no el último 59)" \
  || { ko "resumen:"; sed 's/^/      /' "${T}/resumen"; }
printf 'ts,psi_cpu300,psi_mem300,ttfb_dtd,ttfb_chat,rails_mem_pct,sidekiq_mem_pct,postgres_mem_pct,disco_libre_pct,storage_mib,oom,estado,motivo\n2026-11-01T00:00:00Z,30,1,0.4,0.2,40,30,20,60,10,0,up,ok\n' > "${T}/viejo.csv"
PATH="${T}/bin:${PATH}" bash "${VIGILAR}" --resumen --csv "${T}/viejo.csv" > "${T}/resumen" 2>&1; rcr=$?
[ "${rcr}" = 0 ] && grep -q '^muestras=1 ' "${T}/resumen" && ! grep -q '^WhatsApp\|^Instagram' "${T}/resumen" \
  && ok "--resumen de un CSV de la versión anterior: sale 0 y no inventa líneas de WhatsApp ni de Instagram" || { ko "resumen viejo rc=${rcr}:"; sed 's/^/      /' "${T}/resumen"; }
base; psql_da '1|800|0\n'; vigilar --heartbeat-url 'https://kuma.test/api/push/ABC?status=up&msg=OK&ping='
grep -qx 'https://kuma.test/api/push/ABC' "${D}/latido.args" && grep -qx 'status=down' "${D}/latido.args" \
  && grep -qx 'msg=WhatsApp bandeja 1: 800 de 1.000 en el mes' "${D}/latido.args" && ok "el latido a Uptime Kuma lleva down y el motivo del cupo" \
  || ko "latido: $(tr '\n' ' ' < "${D}/latido.args" 2>/dev/null)"
fi

if seccion renovar; then
echo "== renovar-instagram.sh =="
reiniciar; { canal 5 1200 1200 0; echo "DTDIG fin canales=1"; } | rails_da; renovar
[ "${RC}" = 0 ] && [ "$(est resultado)" = ok ] && [ "$(est canales)" = 1 ] && [ "$(est renovados)" = 0 ] && [ "$(est fallas)" = 0 ] \
  && [[ "$(est dias_min)" =~ ^(49|50)$ ]] && [ "$(est vence_min_epoch)" = "$((A + 1200 * 3600))" ] && [[ "$(est vence_min)" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]T[0-9:]{8}Z$ ]] \
  && ok "token con 50 días (Chatwoot no lo renueva): ok, sale 0, canales=1, renovados=0, dias_min=$(est dias_min) y vence_min en ISO" || { ko "sano rc=${RC}"; ver; cat "${IG}" 2>/dev/null; }
[ "$(grep -c . "${T}/salida")" = 1 ] && [[ "${LINEA}" == "renovar-instagram: ok · canales=1 renovados=0 fallas=0 vence_min="*" dias_min="* ]] \
  && ok "la salida es una sola línea de conteos y fechas" || { ko "salida:"; ver; }
grep -q 'bundle' "${D}/rails.args" && grep -qx 'exec' <(sed -n 2p "${D}/rails.args") && grep -q 'Channel::Instagram.find_each do |c|' "${D}/rails.ruby" \
  && grep -qx '    c.access_token' "${D}/rails.ruby" && grep -qx '  c.reload' "${D}/rails.ruby" && grep -q '^exec id-rails bundle exec rails runner ' "${D}/docker.log" \
  && ok "corre «bundle exec rails runner» en el contenedor de rails con Channel::Instagram.find_each, access_token y reload" || ko "rails runner: $(grep '^exec' "${D}/docker.log")"
[ "$(ls -A "${T}/ig")" = "instagram-token.estado" ] && ok "el estado se escribe al lado y se mueve: no queda ningún temporal" || ko "en la carpeta del estado: $(ls -A "${T}/ig")"
reiniciar; { canal 5 216 1440 0; echo "DTDIG fin canales=1"; } | rails_da; renovar
[ "${RC}" = 0 ] && [ "$(est resultado)" = ok ] && [ "$(est renovados)" = 1 ] && ok "le quedaban 9 días y Chatwoot lo renovó a 60: ok, renovados=1" || { ko "renovado rc=${RC}"; ver; }
reiniciar; { canal 5 216 216 0; echo "DTDIG fin canales=1"; } | rails_da; renovar
[ "${RC}" = 1 ] && [ "$(est resultado)" = falla ] && [ "$(est motivo)" = "1 canal(es) con menos de 10 días" ] && [ "$(est bajo_umbral)" = 1 ] \
  && ok "Chatwoot se tragó el error (sigue en 9 días, sin excepción): falla «1 canal(es) con menos de 10 días», sale 1" || { ko "error tragado rc=${RC}"; ver; }
reiniciar; { canal 5 1200 1200 1; echo "DTDIG fin canales=1"; } | rails_da; renovar
[ "${RC}" = 1 ] && [ "$(est resultado)" = falla ] && [ "$(est fallas)" = 1 ] && [ "$(est motivo)" = "1 canal(es) con error al leer el token" ] \
  && ok "leer el token lanzó una excepción: falla «1 canal(es) con error al leer el token»" || { ko "excepción rc=${RC}"; ver; }
reiniciar; { canal 5 1200 1200 0; canal 6 720 720 0; echo "DTDIG fin canales=2"; } | rails_da; renovar
[ "${RC}" = 0 ] && [ "$(est canales)" = 2 ] && [ "$(est vence_min_epoch)" = "$((A + 720 * 3600))" ] && [[ "$(est dias_min)" =~ ^(29|30)$ ]] \
  && ok "dos canales (50 y 30 días): vence_min es el más cercano y dias_min=$(est dias_min)" || { ko "dos canales rc=${RC}"; ver; }
reiniciar; { canal 5 1200 1200 0; echo "DTDIG fin canales=1"; } | rails_da; UMBRAL_INSTAGRAM_DIAS=60 renovar
[ "${RC}" = 1 ] && [ "$(est motivo)" = "1 canal(es) con menos de 60 días" ] && ok "UMBRAL_INSTAGRAM_DIAS=60: 50 días ya es falla" || { ko "umbral rc=${RC}"; ver; }
reiniciar; { canal 5 1200 1200 0; echo "DTDIG fin canales=1"; } | rails_da; echo 1 > "${D}/rails.rc"; renovar
[ "${RC}" = 1 ] && [ "$(est resultado)" = falla ] && [ "$(est motivo)" = "rails runner salió 1" ] && [ $(( $(date +%s) - $(est ts_epoch) )) -lt 60 ] \
  && ok "rails runner sale 1 aunque traiga un resumen: falla «rails runner salió 1», con la hora de esta corrida" || { ko "rc 1: rc=${RC}"; ver; }
reiniciar; canal 5 1200 1200 0 | rails_da; renovar
[ "${RC}" = 1 ] && [ "$(est motivo)" = "sin resumen de rails runner" ] && ok "sin la línea de resumen: falla «sin resumen de rails runner»" || { ko "sin resumen rc=${RC}"; ver; }
reiniciar; { canal 5 1200 1200 0; echo "DTDIG fin canales=2"; } | rails_da; renovar
[ "${RC}" = 1 ] && [ "$(est motivo)" = "el resumen dice 2 canales y llegaron 1" ] && ok "el resumen no cuadra con las líneas: falla" || { ko "no cuadra rc=${RC}"; ver; }
reiniciar; echo "DTDIG fin canales=0" | rails_da; renovar
[ "${RC}" = 0 ] && [ "$(est canales)" = 0 ] && [ "$(est vence_min)" = "" ] && [ "$(est vence_min_epoch)" = "" ] && ok "cero canales: ok, sin fecha de vencimiento" || { ko "cero canales rc=${RC}"; ver; }
reiniciar; touch "${D}/caido-rails"; renovar
[ "${RC}" = 1 ] && [ "$(est resultado)" = falla ] && [ "$(est motivo)" = "rails no corre" ] && ! grep -q '^exec' "${D}/docker.log" \
  && ok "rails caído: falla «rails no corre», sin docker exec" || { ko "rails caído rc=${RC}"; ver; }
if command -v ruby >/dev/null 2>&1; then
  cat > "${T}/prelude.rb" <<'RB'
# Channel::Instagram de mentira, con lo que hace Instagram::RefreshOauthTokenService de 4.19.1.
module Channel
  class Instagram
    TODOS = []
    attr_reader :id, :expires_at
    def initialize(id, expires_at, modo) @id = id; @expires_at = expires_at; @guardado = expires_at; @modo = modo end
    def self.find_each(&b) TODOS.each(&b) end
    def access_token
      case @modo
      when :renueva then @guardado = Time.now + 60 * 86400; 'IGQWRtokenSECRETO-nuevo'
      when :traga then puts 'E, Token refresh failed: {"error":{"message":"IGQWRtokenSECRETO0123456789"}}'; 'IGQWRtokenSECRETO0123456789'
      when :lanza then raise 'IGQWRtokenSECRETO0123456789'
      else 'IGQWRtokenSECRETO0123456789'
      end
    end
    def reload() @expires_at = @guardado; self end
  end
end
ahora = Time.now
ENV.fetch('ESCENARIO').split(',').each_with_index { |m, i| Channel::Instagram::TODOS << Channel::Instagram.new(5 + i, ahora + (m == 'sano' ? 50 : 9) * 86400, m.to_sym) }
RB
  rb() { reiniciar; cp "${T}/prelude.rb" "${D}/rails.prelude.rb"; ESCENARIO="$1" renovar; }
  rb renueva,sano
  [ "${RC}" = 0 ] && [ "$(est canales)" = 2 ] && [ "$(est renovados)" = 1 ] && [[ "$(est dias_min)" =~ ^(49|50)$ ]] \
    && ok "Ruby real (ruby $(ruby -e 'print RUBY_VERSION')): uno renovado a 60 días y otro sano a 50: ok, renovados=1" || { ko "ruby renueva rc=${RC}"; ver; }
  rb traga
  [ "${RC}" = 1 ] && [ "$(est motivo)" = "1 canal(es) con menos de 10 días" ] && ok "Ruby real: el servicio se traga el error y el token sigue en 9 días: falla" || { ko "ruby traga rc=${RC}"; ver; }
  rb lanza
  [ "${RC}" = 1 ] && [ "$(est motivo)" = "1 canal(es) con error al leer el token y 1 canal(es) con menos de 10 días" ] \
    && ok "Ruby real: access_token lanza: falla, con el error y los días" || { ko "ruby lanza rc=${RC}"; ver; }
elif [ "${CI:-}" = true ]; then
  ko "falta ruby en el runner del CI: el Ruby de renovar-instagram.sh queda sin correr"
else
  echo "NO DISPONIBLE · sin ruby en esta máquina: el Ruby de renovar-instagram.sh no corrió (en el CI sí)"
fi
fi

if seccion e2e; then
echo "== de punta a punta: renovar-instagram.sh deja el estado y vigilar.sh lo lee =="
reiniciar; psql_da '1|3|0\n'; { canal 5 216 1440 0; echo "DTDIG fin canales=1"; } | rails_da; renovar; vigilar --sin-latido
up && [[ "$(col ig_dias)" =~ ^(59|60)$ ]] && ok "renovación ok → vigilar up, ig_dias=$(col ig_dias)" || { ko "e2e ok: «${LINEA}»"; ver; }
reiniciar; psql_da '1|3|0\n'; { canal 5 228 228 0; echo "DTDIG fin canales=1"; } | rails_da; renovar; vigilar --sin-latido
down_con "token Instagram: la renovación falló (1 canal(es) con menos de 10 días)" && [[ "${LINEA}" == *"le quedaban 9 días al renovar"* ]] \
  && ok "renovación tragada → vigilar down con el motivo y con los días al renovar" || { ko "e2e falla: «${LINEA}»"; ver; }
reiniciar; psql_da '1|3|0\n'; touch "${D}/caido-rails"; renovar; vigilar --sin-latido
down_con "token Instagram: la renovación falló (rails no corre)" && ok "rails caído al renovar → vigilar down «la renovación falló (rails no corre)»" || { ko "e2e rails: «${LINEA}»"; ver; }
fi

if seccion renovar; then
  # Al final, sobre todo lo que imprimieron y guardaron las corridas de esta suite.
  ! grep -q "${SECRETO}\|IGQWR" "${TODO}" && ok "el token de los logs de Rails no aparece en ninguna salida ni en ningún estado ($(wc -l < "${TODO}") líneas)" \
    || ko "el token se filtró: $(grep -c "${SECRETO}\|IGQWR" "${TODO}") líneas"
fi

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ] && [ "${pass}" -gt 0 ] || exit 1
if [ "${MODO}" = todo ]; then echo "== control rojo y mutantes =="; mutantes; fi
