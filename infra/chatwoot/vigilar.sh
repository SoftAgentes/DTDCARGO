#!/usr/bin/env bash
# infra/chatwoot/vigilar.sh — vigilancia de Chatwoot Y del ERP en el mismo host (SDD-0583 · paso 1.6).
#
# Chatwoot comparte el VPS con la producción de DTD (E0-D1). Lo que hay que vigilar no
# es solo que Chatwoot viva: es que DTD no empeore. Cada corrida (timer de 5 min):
#   · presión de CPU, memoria y E/S del host (/proc/pressure), carga y memoria disponible;
#   · disco de / y tamaño de los datos de Chatwoot (adjuntos y Postgres);
#   · por contenedor de Chatwoot: memoria frente a su límite, CPU, reinicios y OOM;
#   · tiempo al primer byte de la web de DTD y de /api de Chatwoot (sin datos personales);
#   · WhatsApp, por bandeja (puerta 7 de 4.9, SDD-0582): salientes del mes contra el cupo de
#     1.000 de Meta y mensajes `failed` en 24 h, con vigilar-whatsapp.sql por psql en el
#     contenedor de postgres (sin rails). Solo conteos e IDs de bandeja;
#   · token de Instagram: el estado que deja renovar-instagram.sh (timer diario).
# Agrega una línea al CSV y manda el estado al monitor Push de Uptime Kuma
# («Chatwoot · recursos del host»): `up` si todo está dentro de los umbrales, `down`
# con el motivo si no. Nunca reinicia ni para nada: solo mide y avisa.
#
# Uso:
#   vigilar.sh --dir /srv/chatwoot [--project chatwoot] [--csv /var/log/chatwoot-vigilancia.csv]
#              [--heartbeat-url URL] [--dtd-url https://dtdcargo.com/] [--sin-latido]
#              [--estado-instagram /var/lib/chatwoot-vigilancia/instagram-token.estado]
#   vigilar.sh --resumen [--csv …] [--desde 2026-11-02T00:00]   (informe de las 72 h)
#
# Umbrales (variables de entorno, con su valor por omisión):
#   UMBRAL_PSI_CPU300=60       presión `some` de CPU a 5 min, % (antes de Chatwoot: 29–31 %)
#   UMBRAL_MEM_LIMITE=90       % del límite de memoria de un contenedor de Chatwoot
#   UMBRAL_DISCO_LIBRE=15      % libre mínimo en /
#   UMBRAL_TTFB_DTD=3.0        segundos al primer byte de la web de DTD
#   UMBRAL_CUPO_WHATSAPP=800   salientes del mes en una bandeja de WhatsApp (de 1.000)
#   UMBRAL_FALLAS_WHATSAPP=1   mensajes `failed` en 24 h en una bandeja de WhatsApp
#   UMBRAL_INSTAGRAM_DIAS=10   días que le quedaban al token al terminar la última renovación
#   UMBRAL_INSTAGRAM_HORAS=26  horas desde la última renovación (el timer es diario)
# Sin lectura de WhatsApp o de Instagram también es `down`: un hueco no cuenta como verde.
# El criterio de las 72 h (aceptar el VPS compartido o pasar al plan B) está en
# docs/runbooks/chatwoot-vigilancia.md §4.
set -uo pipefail

DIR="/srv/chatwoot"
PROJECT="chatwoot"
CSV="/var/log/chatwoot-vigilancia.csv"
HEARTBEAT_URL=""
DTD_URL="https://dtdcargo.com/"
ESTADO_IG="/var/lib/chatwoot-vigilancia/instagram-token.estado"
SIN_LATIDO=0
RESUMEN=0
DESDE=""
U_PSI="${UMBRAL_PSI_CPU300:-60}"
U_MEM="${UMBRAL_MEM_LIMITE:-90}"
U_DISCO="${UMBRAL_DISCO_LIBRE:-15}"
U_TTFB="${UMBRAL_TTFB_DTD:-3.0}"
U_CUPO="${UMBRAL_CUPO_WHATSAPP:-800}"
U_FALLAS="${UMBRAL_FALLAS_WHATSAPP:-1}"
U_IG_DIAS="${UMBRAL_INSTAGRAM_DIAS:-10}"
U_IG_HORAS="${UMBRAL_INSTAGRAM_HORAS:-26}"
# Raíz de /proc. Solo la cambia la prueba (infra/ops/tests/prueba-vigilar-chatwoot.sh).
PROC="${VIGILAR_PROC:-/proc}"
SQL_WA="$(dirname "${BASH_SOURCE[0]}")/vigilar-whatsapp.sql"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --csv) CSV="$2"; shift 2 ;;
    --heartbeat-url) HEARTBEAT_URL="$2"; shift 2 ;;
    --dtd-url) DTD_URL="$2"; shift 2 ;;
    --estado-instagram) ESTADO_IG="$2"; shift 2 ;;
    --sin-latido) SIN_LATIDO=1; shift ;;
    --resumen) RESUMEN=1; shift ;;
    --desde) DESDE="$2"; shift 2 ;;
    -h|--help) sed -n '2,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "vigilar: opción desconocida: $1" >&2; exit 2 ;;
  esac
done

COLUMNAS="ts,psi_cpu10,psi_cpu300,psi_mem300,psi_io300,carga1,mem_disp_mib,disco_libre_pct,storage_mib,postgres_mib,rails_mem_pct,sidekiq_mem_pct,postgres_mem_pct,redis_mem_pct,rails_cpu,sidekiq_cpu,postgres_cpu,redis_cpu,reinicios,oom,ttfb_dtd,ttfb_chat,wa_salientes_max,wa_fallas_24h,ig_dias,estado,motivo"

if [ "$RESUMEN" = 1 ]; then
  [ -f "$CSV" ] || { echo "vigilar: no existe $CSV" >&2; exit 1; }
  awk -F, -v desde="$DESDE" '
    function pct(arr, n, p,   i) { if (n == 0) return "-"; i = int((n - 1) * p) + 1; return arr[i] }
    function orden(arr, n,   i, j, t) { for (i = 2; i <= n; i++) { t = arr[i]; for (j = i - 1; j >= 1 && arr[j] > t; j--) arr[j + 1] = arr[j]; arr[j + 1] = t } }
    NR == 1 { for (i = 1; i <= NF; i++) col[$i] = i; next }
    desde != "" && $1 < desde { next }
    { n++; if (n == 1) primero = $1; ultimo = $1
      split("psi_cpu300 psi_mem300 ttfb_dtd ttfb_chat rails_mem_pct sidekiq_mem_pct postgres_mem_pct disco_libre_pct storage_mib", m, " ")
      for (k in m) { c = m[k]; v[c, n] = $(col[c]) + 0 }
      if ($(col["estado"]) == "down") caidas++
      if ($(col["oom"]) + 0 > 0) oom = 1
      if (n == 1) { s0 = $(col["storage_mib"]) + 0; d0 = $(col["disco_libre_pct"]) + 0 }
      s1 = $(col["storage_mib"]) + 0; d1 = $(col["disco_libre_pct"]) + 0
      # Columnas de WhatsApp e Instagram: solo en los CSV de esta versión.
      if ("wa_salientes_max" in col) {
        x = $(col["wa_salientes_max"]); y = $(col["wa_fallas_24h"])
        if (x == "") wahuecos++
        else { if (x + 0 > wamax) wamax = x + 0; if (y + 0 > wafmax) wafmax = y + 0 }
        z = $(col["ig_dias"])
        if (z != "" && (igmin == "" || z + 0 < igmin + 0)) igmin = z
      } }
    END {
      if (n == 0) { print "sin muestras"; exit 1 }
      horas = n * 5 / 60
      printf "muestras=%d (~%.1f h) desde %s hasta %s\n", n, horas, primero, ultimo
      split("psi_cpu300 psi_mem300 ttfb_dtd ttfb_chat rails_mem_pct sidekiq_mem_pct postgres_mem_pct", m, " ")
      for (k = 1; k <= 7; k++) { c = m[k]; delete a; for (i = 1; i <= n; i++) a[i] = v[c, i]; orden(a, n)
        printf "%-17s p50=%s p95=%s max=%s\n", c, pct(a, n, 0.5), pct(a, n, 0.95), a[n] }
      printf "adjuntos: %d → %d MiB · disco libre: %d → %d %%\n", s0, s1, d0, d1
      printf "muestras en down: %d · OOM de Chatwoot: %s\n", caidas + 0, oom ? "SÍ" : "no"
      if ("wa_salientes_max" in col) {
        printf "WhatsApp: salientes del mes, máx por bandeja = %d · fallas en 24 h, máx = %d · sin lectura: %d\n", wamax, wafmax, wahuecos + 0
        printf "Instagram: días al vencer el token, mín = %s\n", igmin == "" ? "-" : igmin
      }
    }' "$CSV"
  exit $?
fi

leer_env() { [ -f "$DIR/.env" ] && sed -n "s/^$1=//p" "$DIR/.env" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'; }
[ -n "$HEARTBEAT_URL" ] || HEARTBEAT_URL="$(leer_env CHATWOOT_VIGILANCIA_HEARTBEAT_URL)"
CHAT_HOST="$(leer_env CHATWOOT_HOST)"
DATOS="$(leer_env CHATWOOT_DATA_DIR)"; DATOS="${DATOS:-$DIR/data}"

psi() { sed -n "s/^some .*avg$2=\([0-9.]*\).*/\1/p" "$PROC/pressure/$1" 2>/dev/null; }
PSI_CPU10="$(psi cpu 10)"; PSI_CPU300="$(psi cpu 300)"; PSI_MEM300="$(psi memory 300)"; PSI_IO300="$(psi io 300)"
CARGA1="$(cut -d' ' -f1 "$PROC/loadavg")"
MEM_DISP="$(awk '/^MemAvailable:/ { printf "%d", $2 / 1024 }' "$PROC/meminfo")"
DISCO_LIBRE="$(df -P / | awk 'NR == 2 { gsub("%", "", $5); print 100 - $5 }')"
STORAGE_MIB="$(du -sm "$DATOS/storage" 2>/dev/null | cut -f1)"; STORAGE_MIB="${STORAGE_MIB:-0}"
PG_MIB="$(du -sm "$DATOS/postgres" 2>/dev/null | cut -f1)"; PG_MIB="${PG_MIB:-0}"

declare -A MEMP CPU ID
REINICIOS=0; OOM=0; MOTIVOS=()
for s in rails sidekiq postgres redis; do
  id="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=$s" | head -n 1)"
  ID[$s]="$id"
  if [ -z "$id" ]; then MEMP[$s]=""; CPU[$s]=""; MOTIVOS+=("$s no corre"); continue; fi
  read -r mp cp <<<"$(docker stats --no-stream --format '{{.MemPerc}} {{.CPUPerc}}' "$id" | tr -d '%')"
  MEMP[$s]="$mp"; CPU[$s]="$cp"
  r="$(docker inspect -f '{{.RestartCount}}' "$id")"; REINICIOS=$((REINICIOS + r))
  [ "$(docker inspect -f '{{.State.OOMKilled}}' "$id")" = true ] && { OOM=1; MOTIVOS+=("$s OOM"); }
  awk -v a="$mp" -v b="$U_MEM" 'BEGIN { exit !(a > b) }' && MOTIVOS+=("$s memoria ${mp}% del límite")
done

# Sin respuesta cuenta como 15 s (el tope): un sitio caído es el peor tiempo, no un hueco.
ttfb() { local t; t="$(curl -s -o /dev/null -m 15 -w '%{time_starttransfer}' "$1" 2>/dev/null)" || t=15; echo "$t"; }
TTFB_DTD="$(ttfb "$DTD_URL")"
TTFB_CHAT="$([ -n "$CHAT_HOST" ] && ttfb "https://$CHAT_HOST/api" || echo "")"

awk -v a="${PSI_CPU300:-0}" -v b="$U_PSI" 'BEGIN { exit !(a > b) }' && MOTIVOS+=("presión CPU ${PSI_CPU300}% > ${U_PSI}%")
[ "${DISCO_LIBRE:-100}" -lt "$U_DISCO" ] && MOTIVOS+=("disco libre ${DISCO_LIBRE}%")
awk -v a="$TTFB_DTD" -v b="$U_TTFB" 'BEGIN { exit !(a > b) }' && MOTIVOS+=("web DTD ${TTFB_DTD}s")

# WhatsApp (puerta 7 de 4.9, SDD-0582): cupo de 1.000 salientes de servicio por número y
# por mes, y fallas de entrega. Lee con psql en el contenedor de postgres, con el usuario y
# la base de su propio entorno. El cupo es de Meta: esto es una estimación local, no la factura.
# Si postgres no corre o falta el .sql, `docker exec` falla y cae en «sin lectura».
WA_MAX=""; WA_FALLAS=""
if ! WA="$(timeout 30 docker exec -i "${ID[postgres]}" sh -c 'exec psql -X -q -At -F "|" -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <"$SQL_WA" 2>/dev/null)"; then
  MOTIVOS+=("cupo WhatsApp sin lectura")
elif [ -z "$WA" ]; then
  # DTD tiene bandejas de WhatsApp: cero filas es una lectura rota (otro channel_type tras
  # una versión, otra base), no un verde.
  MOTIVOS+=("cupo WhatsApp: ninguna bandeja de WhatsApp")
else
  WA_MAX=0; WA_FALLAS=0; wa_ok=1
  while IFS='|' read -r b s f; do
    if ! [[ "$b" =~ ^[0-9]+$ && "$s" =~ ^[0-9]+$ && "$f" =~ ^[0-9]+$ ]]; then wa_ok=0; break; fi
    [ "$s" -gt "$WA_MAX" ] && WA_MAX="$s"
    WA_FALLAS=$((WA_FALLAS + f))
    [ "$s" -ge "$U_CUPO" ] && MOTIVOS+=("WhatsApp bandeja $b: $s de 1.000 en el mes")
    [ "$f" -ge "$U_FALLAS" ] && MOTIVOS+=("WhatsApp bandeja $b: $f fallas en 24 h")
  done <<<"$WA"
  if [ "$wa_ok" = 0 ]; then WA_MAX=""; WA_FALLAS=""; MOTIVOS+=("cupo WhatsApp sin lectura"); fi
fi

# Token de Instagram (SDD-0583). Chatwoot 4.19.1 lo renueva solo cuando alguien lo lee, y lo
# lee renovar-instagram.sh una vez al día. Los días se miden al terminar esa renovación y no
# contra la hora actual: Chatwoot renueva cuando faltan menos de 10 días, así que entre dos
# corridas diarias un token sano baja hasta ~9 días, y medirlo ahora sonaría en cada ciclo.
IG_DIAS=""
leer_ig() { [ -r "$ESTADO_IG" ] && sed -n "s/^$1=//p" "$ESTADO_IG" | tail -n 1; }
IG_TS="$(leer_ig ts_epoch)"; IG_RES="$(leer_ig resultado)"; IG_CAN="$(leer_ig canales)"; IG_VENCE="$(leer_ig vence_min_epoch)"
AHORA="$(date +%s)"
if ! [[ "$IG_TS" =~ ^[0-9]+$ && "$IG_CAN" =~ ^[0-9]+$ ]] || [ -z "$IG_RES" ]; then
  MOTIVOS+=("token Instagram sin lectura")
else
  [ "$IG_RES" = ok ] || MOTIVOS+=("token Instagram: la renovación falló ($(leer_ig motivo))")
  [ $((AHORA - IG_TS)) -gt $((U_IG_HORAS * 3600)) ] && MOTIVOS+=("token Instagram: sin renovar hace $(((AHORA - IG_TS) / 3600)) h")
  if [ "$IG_CAN" -gt 0 ]; then
    if [[ "$IG_VENCE" =~ ^[0-9]+$ ]]; then
      IG_DIAS=$(((IG_VENCE - AHORA) / 86400))
      [ $((IG_VENCE - IG_TS)) -lt $((U_IG_DIAS * 86400)) ] && MOTIVOS+=("token Instagram: le quedaban $(((IG_VENCE - IG_TS) / 86400)) días al renovar")
    else
      MOTIVOS+=("token Instagram sin lectura")
    fi
  fi
fi

ESTADO=up; MOTIVO="ok"
if [ "${#MOTIVOS[@]}" -gt 0 ]; then ESTADO=down; MOTIVO="$(IFS=';'; echo "${MOTIVOS[*]}")"; fi

# Un CSV con otra cabecera (de una versión anterior) se guarda aparte y se empieza otro:
# mezclar filas de dos formas descuadra las columnas de --resumen.
if [ -f "$CSV" ] && [ "$(head -n 1 "$CSV")" != "$COLUMNAS" ]; then mv "$CSV" "$CSV.hasta-$(date -u +%Y%m%dT%H%M%SZ)"; fi
[ -f "$CSV" ] || echo "$COLUMNAS" >"$CSV"
printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ),$PSI_CPU10,$PSI_CPU300,$PSI_MEM300,$PSI_IO300,$CARGA1,$MEM_DISP,$DISCO_LIBRE,$STORAGE_MIB,$PG_MIB,${MEMP[rails]},${MEMP[sidekiq]},${MEMP[postgres]},${MEMP[redis]},${CPU[rails]},${CPU[sidekiq]},${CPU[postgres]},${CPU[redis]},$REINICIOS,$OOM,$TTFB_DTD,$TTFB_CHAT,$WA_MAX,$WA_FALLAS,$IG_DIAS,$ESTADO,${MOTIVO//,/ }" >>"$CSV"

if [ "$SIN_LATIDO" = 0 ] && [ -n "$HEARTBEAT_URL" ]; then
  # Uptime Kuma Push: misma URL del monitor, con status y msg propios (urlencode por curl).
  base="${HEARTBEAT_URL%%\?*}"
  curl -fsS -m 15 -o /dev/null -G "$base" --data-urlencode "status=$ESTADO" --data-urlencode "msg=$MOTIVO" --data-urlencode "ping=" \
    || echo "vigilar: no se pudo mandar el latido" >&2
fi
echo "vigilar: $ESTADO · $MOTIVO"
