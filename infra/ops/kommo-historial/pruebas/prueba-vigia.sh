#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-vigia.sh — prueba de vigia-carga.sh (SDD-0590 §10.12), con systemd de
# verdad: el vigía mira una unidad transitoria que solo duerme, con la carga y MemAvailable inyectados (VIGIA_*)
# y /dev/shm medido de verdad con df. Corre como root (sudo) en el runner de GitHub Actions. No toca nada de E5.
#
#   V1  control: carga, memoria y /dev/shm dentro de los topes → no para la unidad; sale cuando la unidad termina
#   V2  carga sostenida: 9.00 a 5 minutos (tope 8) → para la unidad, que recibe TERM
#   V7  pico tolerado: 9.50 a 1 minuto con 6.00 a 5 minutos → no la para
#   V8  pico grave: 17.00 a 1 minuto (más del doble del tope) → la para
#   V3  MemAvailable 5000 MB (piso 6144) → la para
#   V4  /dev/shm por encima del tope (VIGIA_SHM_TOPE_MB bajo y un archivo de 4 MB en /dev/shm) → la para
#   V5  MemAvailable que no se puede leer → la para
#   V6  la unidad no arranca en el tiempo de espera → sale 0 sin parar nada
#   M0  control: una copia sin cambios pasa todo
#   MV1–MV6 mutantes: cada uno tiene que tumbar sus comprobaciones y dejar pasar las otras
set -uo pipefail
PRUEBAS="$(cd "$(dirname "$0")" && pwd)"
VIGIA="$PRUEBAS/../vigia-carga.sh"
[ "$(id -u)" = 0 ] || { echo "hace falta root (sudo)"; exit 2; }
[ -d /run/systemd/system ] || { echo "hace falta systemd"; exit 2; }
if [ -e /dev/shm/k0582-e5 ] || [ -d /srv/ops/kommo-historial-0590b ]; then
  echo "se niega: aquí están el token real o la carpeta del VPS"; exit 2
fi
W="$(mktemp -d /tmp/prueba-vigia.XXXXXX)"
RELLENO="/dev/shm/prueba-vigia-relleno-$$"
PREFIJO="prueba-vigia-$$"
N=0
limpiar() {
  systemctl stop "$PREFIJO-*.service" 2>/dev/null
  systemctl reset-failed "$PREFIJO-*" 2>/dev/null
  rm -f -- "$RELLENO"
  rm -rf -- "$W"
}
trap limpiar EXIT
PASA=0
FALLA=0
ok() { echo "PASA $1: $2"; PASA=$((PASA + 1)); }
mal() { echo "FALLA $1: $2"; FALLA=$((FALLA + 1)); }
anota() { if eval "$2"; then echo si >"$W/r/$1"; else echo no >"$W/r/$1"; fi; }

carga() { echo "$1 $2 0.40 1/100 1" >"$W/loadavg"; } # 1 minuto, 5 minutos
memoria() { printf 'MemTotal:       24000000 kB\nMemFree:         1000000 kB\nMemAvailable:   %s kB\n' "$(( $1 * 1024 ))" >"$W/meminfo"; }
unidad() { # una unidad que duerme y anota si recibió TERM
  N=$((N + 1)); U="$PREFIJO-$N"
  : >"$W/$U.term"
  systemd-run --quiet --unit "$U" bash -c "trap 'echo TERM >>$W/$U.term; exit 143' TERM; sleep 600 & wait" \
    || echo "AVISO: no arrancó $U"
}
activa() { systemctl is-active --quiet "$U.service"; }
vigilar() { # script salida [variables...]: corre el vigía en primer plano, con un tope de 40 s
  local s="$1" n="$2"
  shift 2
  env VIGIA_CARGA_DE="$W/loadavg" VIGIA_MEMINFO_DE="$W/meminfo" VIGIA_PAUSA=1 VIGIA_ESPERA_INICIO=2 "$@" \
    timeout 40 bash "$s" "$U.service" 8 >"$W/$n.txt" 2>&1
  echo $? >"$W/$n.rc"
}
no_la_para() { # script salida: el vigía en segundo plano; a los 4 s, ¿sigue activa la unidad? Después se la para
  # desde fuera y el vigía tiene que salir solo. Deja seguia=si|no.
  local s="$1" n="$2" pid
  env VIGIA_CARGA_DE="$W/loadavg" VIGIA_MEMINFO_DE="$W/meminfo" VIGIA_PAUSA=1 VIGIA_ESPERA_INICIO=2 \
    timeout 40 bash "$s" "$U.service" 8 >"$W/$n.txt" 2>&1 &
  pid=$!
  sleep 4
  seguia=no
  activa && seguia=si
  systemctl stop "$U.service" 2>/dev/null
  wait "$pid"
  echo $? >"$W/$n.rc"
}
rc() { cat "$W/$1.rc" 2>/dev/null; }
paro() { grep -q ": se para $U.service" "$W/$1.txt"; }
recibio_term() { grep -q TERM "$W/$U.term"; }

casos() { # script → $W/r/<id> = si | no
  local S="$1"
  rm -rf "$W/r"
  mkdir "$W/r"
  rm -f -- "$RELLENO"

  # V1: control. El vigía corre en segundo plano; a los 4 s la unidad sigue activa; se la para desde fuera.
  carga 1.00 1.00; memoria 12000; unidad
  no_la_para "$S" v1
  anota V1 '[ "$seguia" = si ] && [ "$(rc v1)" = 0 ] && ! paro v1 && grep -q "ya no está activa" "$W/v1.txt"'

  carga 9.50 9.00; memoria 12000; unidad
  vigilar "$S" v2
  anota V2 '[ "$(rc v2)" = 0 ] && paro v2 && grep -q "carga sostenida 9.00 (5 minutos) por encima de 8" "$W/v2.txt" && ! activa && recibio_term'

  carga 9.50 6.00; memoria 12000; unidad
  no_la_para "$S" v7
  anota V7 '[ "$seguia" = si ] && [ "$(rc v7)" = 0 ] && ! paro v7'

  carga 17.00 6.00; memoria 12000; unidad
  vigilar "$S" v8
  anota V8 '[ "$(rc v8)" = 0 ] && paro v8 && grep -q "pico de carga 17.00 (1 minuto) por encima de 16" "$W/v8.txt" && ! activa'

  carga 1.00 1.00; memoria 5000; unidad
  vigilar "$S" v3
  anota V3 '[ "$(rc v3)" = 0 ] && paro v3 && grep -q "MemAvailable 5000 MB, por debajo de 6144" "$W/v3.txt" && ! activa'

  carga 1.00 1.00; memoria 12000; unidad
  dd if=/dev/zero of="$RELLENO" bs=1M count=4 status=none
  vigilar "$S" v4 VIGIA_SHM_TOPE_MB=1
  rm -f -- "$RELLENO"
  anota V4 '[ "$(rc v4)" = 0 ] && paro v4 && grep -qE "/dev/shm usa [0-9]+ MB, por encima de 1" "$W/v4.txt" && ! activa'

  carga 1.00 1.00; memoria 12000; unidad
  vigilar "$S" v5 VIGIA_MEMINFO_DE="$W/no-existe"
  anota V5 '[ "$(rc v5)" = 0 ] && paro v5 && grep -q "no se pudo medir" "$W/v5.txt" && ! activa'

  N=$((N + 1)); U="$PREFIJO-$N"   # nunca arranca
  carga 1.00 1.00; memoria 12000
  vigilar "$S" v6
  anota V6 '[ "$(rc v6)" = 0 ] && ! paro v6 && grep -q "no arrancó en el tiempo de espera" "$W/v6.txt"'
}

declare -A TEXTO=(
  [V1]="carga 1, MemAvailable 12000 MB y /dev/shm bajo el tope: no para la unidad y sale cuando termina"
  [V2]="carga sostenida 9.00 a 5 minutos: para la unidad, que recibe TERM"
  [V7]="pico de 9.50 a 1 minuto con 6.00 a 5 minutos: no la para"
  [V8]="pico de 17.00 a 1 minuto: la para"
  [V3]="MemAvailable 5000 MB: para la unidad"
  [V4]="/dev/shm por encima del tope: para la unidad"
  [V5]="MemAvailable que no se puede leer: para la unidad"
  [V6]="la unidad no arranca: sale 0 sin parar nada"
)
IDS="V1 V2 V7 V8 V3 V4 V5 V6"

echo "== vigia-carga.sh"
casos "$VIGIA"
for id in $IDS; do
  if [ "$(cat "$W/r/$id")" = si ]; then ok "$id" "${TEXTO[$id]}"; else mal "$id" "${TEXTO[$id]}"; fi
done
if [ "$FALLA" -gt 0 ]; then for f in "$W"/v*.txt; do echo "--- $(basename "$f")"; cat "$f"; done; fi

mutar() { # origen destino buscar reemplazo: el texto tiene que aparecer exactamente una vez
  python3 -I - "$@" <<'EOF'
import sys
origen, destino, buscar, poner = sys.argv[1:5]
texto = open(origen, encoding="utf-8").read()
n = texto.count(buscar)
if n != 1:
    sys.exit(f"el texto a mutar aparece {n} veces: {buscar!r}")
open(destino, "w", encoding="utf-8").write(texto.replace(buscar, poner))
EOF
}
mutante() { # id descripción "caen" "pasan" buscar reemplazo
  local id="$1" que="$2" caen="$3" pasan="$4" faltan="" otro="" c
  if ! mutar "$VIGIA" "$W/$id.sh" "$5" "$6"; then mal "$id" "no se pudo mutar ($que)"; return; fi
  casos "$W/$id.sh"
  for c in $caen; do [ "$(cat "$W/r/$c")" = no ] || faltan="$faltan $c"; done
  for c in $pasan; do [ "$(cat "$W/r/$c")" = si ] || otro="$otro $c"; done
  if [ -z "$faltan" ] && [ -z "$otro" ]; then
    ok "$id" "$que: caen $caen; pasan $pasan"
  else
    mal "$id" "$que: no cayeron:${faltan:- ninguna}; cayeron de más:${otro:- ninguna}"
  fi
}

echo "== control y mutantes"
cp "$VIGIA" "$W/M0.sh"
casos "$W/M0.sh"
faltan=""
for id in $IDS; do [ "$(cat "$W/r/$id")" = si ] || faltan="$faltan $id"; done
if [ -z "$faltan" ]; then ok M0 "una copia sin cambios pasa las ${IDS// /, }"; else mal M0 "la copia sin cambios no pasa:$faltan"; fi

mutante MV1 "no mira MemAvailable" "V3" "V1 V2 V4" \
  '  elif [ "$mem" -lt "$MEM_PISO_MB" ]; then' '  elif false; then'
mutante MV2 "no mira /dev/shm" "V4" "V1 V2 V3" \
  '  elif [ "$shm" -gt "$SHM_TOPE_MB" ]; then' '  elif false; then'
mutante MV3 "una medida que no se puede leer no para" "V5" "V1 V2 V3" \
  '    motivo="no se pudo medir' '    : "no se pudo medir'
mutante MV4 "solo avisa, no para la unidad" "V2 V3 V4 V5" "V1 V6" \
  '    systemctl stop "$u"' '    :'
mutante MV5 "vuelve a la carga de 1 minuto sola, como el vigía de antes" "V7" "V1 V2" \
  "  elif awk -v c=\"\$c5\" -v t=\"\$tope\"" "  elif awk -v c=\"\$c\" -v t=\"\$tope\""
mutante MV6 "sin el tope del pico de 1 minuto" "V8" "V1 V2 V7" \
  "  elif awk -v c=\"\$c\" -v t=\"\$pico\"" "  elif false && awk -v c=\"\$c\" -v t=\"\$pico\""

echo "== resultado: $PASA pasan, $FALLA fallan"
[ "$FALLA" = 0 ]
