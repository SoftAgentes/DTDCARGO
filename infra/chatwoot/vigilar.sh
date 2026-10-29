#!/usr/bin/env bash
# infra/chatwoot/vigilar.sh — vigilancia de Chatwoot Y del ERP en el mismo host (SDD-0583 · paso 1.6).
#
# Chatwoot comparte el VPS con la producción de DTD (E0-D1). Lo que hay que vigilar no
# es solo que Chatwoot viva: es que DTD no empeore. Cada corrida (timer de 5 min):
#   · presión de CPU, memoria y E/S del host (/proc/pressure), carga y memoria disponible;
#   · disco de / y tamaño de los datos de Chatwoot (adjuntos y Postgres);
#   · por contenedor de Chatwoot: memoria frente a su límite, CPU, reinicios y OOM;
#   · tiempo al primer byte de la web de DTD y de /api de Chatwoot (sin datos personales).
# Agrega una línea al CSV y manda el estado al monitor Push de Uptime Kuma
# («Chatwoot · recursos del host»): `up` si todo está dentro de los umbrales, `down`
# con el motivo si no. Nunca reinicia ni para nada: solo mide y avisa.
#
# Uso:
#   vigilar.sh --dir /srv/chatwoot [--project chatwoot] [--csv /var/log/chatwoot-vigilancia.csv]
#              [--heartbeat-url URL] [--dtd-url https://dtdcargo.com/] [--sin-latido]
#   vigilar.sh --resumen [--csv …] [--desde 2026-11-02T00:00]   (informe de las 72 h)
#
# Umbrales (variables de entorno, con su valor por omisión):
#   UMBRAL_PSI_CPU300=60   presión `some` de CPU a 5 min, % (antes de Chatwoot: 29–31 %)
#   UMBRAL_MEM_LIMITE=90   % del límite de memoria de un contenedor de Chatwoot
#   UMBRAL_DISCO_LIBRE=15  % libre mínimo en /
#   UMBRAL_TTFB_DTD=3.0    segundos al primer byte de la web de DTD
# El criterio de las 72 h (aceptar el VPS compartido o pasar al plan B) está en
# docs/runbooks/chatwoot-vigilancia.md §4.
set -uo pipefail

DIR="/srv/chatwoot"
PROJECT="chatwoot"
CSV="/var/log/chatwoot-vigilancia.csv"
HEARTBEAT_URL=""
DTD_URL="https://dtdcargo.com/"
SIN_LATIDO=0
RESUMEN=0
DESDE=""
U_PSI="${UMBRAL_PSI_CPU300:-60}"
U_MEM="${UMBRAL_MEM_LIMITE:-90}"
U_DISCO="${UMBRAL_DISCO_LIBRE:-15}"
U_TTFB="${UMBRAL_TTFB_DTD:-3.0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --csv) CSV="$2"; shift 2 ;;
    --heartbeat-url) HEARTBEAT_URL="$2"; shift 2 ;;
    --dtd-url) DTD_URL="$2"; shift 2 ;;
    --sin-latido) SIN_LATIDO=1; shift ;;
    --resumen) RESUMEN=1; shift ;;
    --desde) DESDE="$2"; shift 2 ;;
    -h|--help) sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "vigilar: opción desconocida: $1" >&2; exit 2 ;;
  esac
done

COLUMNAS="ts,psi_cpu10,psi_cpu300,psi_mem300,psi_io300,carga1,mem_disp_mib,disco_libre_pct,storage_mib,postgres_mib,rails_mem_pct,sidekiq_mem_pct,postgres_mem_pct,redis_mem_pct,rails_cpu,sidekiq_cpu,postgres_cpu,redis_cpu,reinicios,oom,ttfb_dtd,ttfb_chat,estado,motivo"

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
      s1 = $(col["storage_mib"]) + 0; d1 = $(col["disco_libre_pct"]) + 0 }
    END {
      if (n == 0) { print "sin muestras"; exit 1 }
      horas = n * 5 / 60
      printf "muestras=%d (~%.1f h) desde %s hasta %s\n", n, horas, primero, ultimo
      split("psi_cpu300 psi_mem300 ttfb_dtd ttfb_chat rails_mem_pct sidekiq_mem_pct postgres_mem_pct", m, " ")
      for (k = 1; k <= 7; k++) { c = m[k]; delete a; for (i = 1; i <= n; i++) a[i] = v[c, i]; orden(a, n)
        printf "%-17s p50=%s p95=%s max=%s\n", c, pct(a, n, 0.5), pct(a, n, 0.95), a[n] }
      printf "adjuntos: %d → %d MiB · disco libre: %d → %d %%\n", s0, s1, d0, d1
      printf "muestras en down: %d · OOM de Chatwoot: %s\n", caidas + 0, oom ? "SÍ" : "no"
    }' "$CSV"
  exit $?
fi

leer_env() { [ -f "$DIR/.env" ] && sed -n "s/^$1=//p" "$DIR/.env" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'; }
[ -n "$HEARTBEAT_URL" ] || HEARTBEAT_URL="$(leer_env CHATWOOT_VIGILANCIA_HEARTBEAT_URL)"
CHAT_HOST="$(leer_env CHATWOOT_HOST)"
DATOS="$(leer_env CHATWOOT_DATA_DIR)"; DATOS="${DATOS:-$DIR/data}"

psi() { sed -n "s/^some .*avg$2=\([0-9.]*\).*/\1/p" "/proc/pressure/$1" 2>/dev/null; }
PSI_CPU10="$(psi cpu 10)"; PSI_CPU300="$(psi cpu 300)"; PSI_MEM300="$(psi memory 300)"; PSI_IO300="$(psi io 300)"
CARGA1="$(cut -d' ' -f1 /proc/loadavg)"
MEM_DISP="$(awk '/^MemAvailable:/ { printf "%d", $2 / 1024 }' /proc/meminfo)"
DISCO_LIBRE="$(df -P / | awk 'NR == 2 { gsub("%", "", $5); print 100 - $5 }')"
STORAGE_MIB="$(du -sm "$DATOS/storage" 2>/dev/null | cut -f1)"; STORAGE_MIB="${STORAGE_MIB:-0}"
PG_MIB="$(du -sm "$DATOS/postgres" 2>/dev/null | cut -f1)"; PG_MIB="${PG_MIB:-0}"

declare -A MEMP CPU
REINICIOS=0; OOM=0; MOTIVOS=()
for s in rails sidekiq postgres redis; do
  id="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=$s" | head -n 1)"
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

ESTADO=up; MOTIVO="ok"
if [ "${#MOTIVOS[@]}" -gt 0 ]; then ESTADO=down; MOTIVO="$(IFS=';'; echo "${MOTIVOS[*]}")"; fi

[ -f "$CSV" ] || echo "$COLUMNAS" >"$CSV"
printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ),$PSI_CPU10,$PSI_CPU300,$PSI_MEM300,$PSI_IO300,$CARGA1,$MEM_DISP,$DISCO_LIBRE,$STORAGE_MIB,$PG_MIB,${MEMP[rails]},${MEMP[sidekiq]},${MEMP[postgres]},${MEMP[redis]},${CPU[rails]},${CPU[sidekiq]},${CPU[postgres]},${CPU[redis]},$REINICIOS,$OOM,$TTFB_DTD,$TTFB_CHAT,$ESTADO,${MOTIVO//,/ }" >>"$CSV"

if [ "$SIN_LATIDO" = 0 ] && [ -n "$HEARTBEAT_URL" ]; then
  # Uptime Kuma Push: misma URL del monitor, con status y msg propios (urlencode por curl).
  base="${HEARTBEAT_URL%%\?*}"
  curl -fsS -m 15 -o /dev/null -G "$base" --data-urlencode "status=$ESTADO" --data-urlencode "msg=$MOTIVO" --data-urlencode "ping=" \
    || echo "vigilar: no se pudo mandar el latido" >&2
fi
echo "vigilar: $ESTADO · $MOTIVO"
