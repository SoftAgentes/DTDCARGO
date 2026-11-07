#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-lanzador.sh — prueba de lanzar-unidad.sh (SDD-0590 §10.18), con systemd
# de verdad: lanza kommo-e5-ensayo y kommo-e5-carga con un comando que solo duerme y un vigía falso en la carpeta.
# Corre como root (sudo) en el runner de GitHub Actions. Se niega donde estén las unidades o la carpeta del VPS.
#
#   L1  ensayo: la unidad queda con TimeoutStopSec 10min, Nice 10, la carpeta de trabajo y el entorno pedido, y su
#       vigía corre con la unidad y el tope
#   L2  con el ensayo activo, otro ensayo se niega (código 6) y no relanza nada
#   L3  con el ensayo activo, la carga también se niega (código 6): nunca corren las dos
#   L4  una unidad que no es la del ensayo ni la de la carga se niega (código 2) sin lanzar nada
#   L5  --sin-vigia: la carga corre sin vigía
#   M0  control: una copia sin cambios pasa todo
#   MLA1–MLA3 mutantes: cada uno tiene que tumbar sus comprobaciones y dejar pasar las otras
set -uo pipefail
PRUEBAS="$(cd "$(dirname "$0")" && pwd)"
LANZADOR="$PRUEBAS/../lanzar-unidad.sh"
[ "$(id -u)" = 0 ] || { echo "hace falta root (sudo)"; exit 2; }
[ -d /run/systemd/system ] || { echo "hace falta systemd"; exit 2; }
if [ -d /srv/ops/kommo-historial-0590b ] || [ -d /srv/ops/kommo-historial-ensayo ] ||
   [ "$(systemctl show -p LoadState --value kommo-e5-ensayo.service 2>/dev/null)" = loaded ] ||
   [ "$(systemctl show -p LoadState --value kommo-e5-carga.service 2>/dev/null)" = loaded ]; then
  echo "se niega: aquí están las unidades o las carpetas del VPS"; exit 2
fi

W="$(mktemp -d /tmp/prueba-lanzador.XXXXXX)"
UNIDADES="kommo-e5-ensayo kommo-e5-ensayo-vigia kommo-e5-carga kommo-e5-carga-vigia"
parar() {
  local u
  for u in $UNIDADES; do systemctl stop "$u.service" 2>/dev/null; systemctl reset-failed "$u.service" 2>/dev/null; done
  return 0
}
limpiar() { parar; rm -rf -- "$W"; }
trap limpiar EXIT
PASA=0
FALLA=0
ok() { echo "PASA $1: $2"; PASA=$((PASA + 1)); }
mal() { echo "FALLA $1: $2"; FALLA=$((FALLA + 1)); }
anota() { if eval "$2"; then echo si >"$W/r/$1"; else echo no >"$W/r/$1"; fi; }
prop() { systemctl show -p "$2" --value "$1.service" 2>/dev/null; }
activa() { systemctl is-active --quiet "$1.service"; }

# La carpeta «desplegada»: un vigía falso que solo duerme y anota con qué lo llamaron.
mkdir -p "$W/dir"
cat >"$W/dir/vigia-carga.sh" <<'EOF'
#!/usr/bin/env bash
echo "vigía falso: $*"
sleep 300
EOF

lanzar() { # script nombre args...: código en $W/<nombre>.rc
  local s="$1" n="$2"
  shift 2
  bash "$s" "$@" >"$W/$n.txt" 2>&1
  echo $? >"$W/$n.rc"
}
rc() { cat "$W/$1.rc" 2>/dev/null; }

casos() { # script → $W/r/<id> = si | no
  local S="$1" id_antes
  rm -rf "$W/r" "$W"/*.txt "$W"/*.rc
  mkdir "$W/r"
  parar

  lanzar "$S" l1 --unidad kommo-e5-ensayo --dir "$W/dir" --env PRUEBA_LANZADOR=si --tope-vigia 9 -- /bin/sleep 300
  sleep 1
  anota L1 '[ "$(rc l1)" = 0 ] && activa kommo-e5-ensayo && [ "$(prop kommo-e5-ensayo TimeoutStopUSec)" = 10min ] &&
    [ "$(prop kommo-e5-ensayo Nice)" = 10 ] && [ "$(prop kommo-e5-ensayo WorkingDirectory)" = "$W/dir" ] &&
    prop kommo-e5-ensayo Environment | tr " " "\n" | grep -qx "PRUEBA_LANZADOR=si" &&
    activa kommo-e5-ensayo-vigia && prop kommo-e5-ensayo-vigia ExecStart | grep -q "vigia-carga.sh kommo-e5-ensayo 9"'

  id_antes="$(prop kommo-e5-ensayo InvocationID)"
  lanzar "$S" l2 --unidad kommo-e5-ensayo --dir "$W/dir" -- /bin/sleep 300
  anota L2 '[ "$(rc l2)" = 6 ] && [ "$(prop kommo-e5-ensayo InvocationID)" = "$id_antes" ]'

  lanzar "$S" l3 --unidad kommo-e5-carga --dir "$W/dir" -- /bin/sleep 300
  anota L3 '[ "$(rc l3)" = 6 ] && ! activa kommo-e5-carga'

  lanzar "$S" l4 --unidad otra-unidad --dir "$W/dir" -- /bin/sleep 300
  anota L4 '[ "$(rc l4)" = 2 ] && [ "$(systemctl show -p LoadState --value otra-unidad.service 2>/dev/null)" != loaded ]'

  parar
  lanzar "$S" l5 --unidad kommo-e5-carga --dir "$W/dir" --sin-vigia -- /bin/sleep 300
  sleep 1
  anota L5 '[ "$(rc l5)" = 0 ] && activa kommo-e5-carga && [ "$(prop kommo-e5-carga TimeoutStopUSec)" = 10min ] && ! activa kommo-e5-carga-vigia'
  parar
}

declare -A TEXTO=(
  [L1]="ensayo: TimeoutStopSec 10min, Nice 10, la carpeta de trabajo y el entorno pedido, y el vigía con la unidad y el tope"
  [L2]="con el ensayo activo, otro ensayo se niega con 6 y no lo relanza"
  [L3]="con el ensayo activo, la carga se niega con 6: nunca corren las dos"
  [L4]="una unidad que no es la del ensayo ni la de la carga se niega con 2"
  [L5]="--sin-vigia: la carga corre con su TimeoutStopSec y sin vigía"
)
IDS="L1 L2 L3 L4 L5"

echo "== lanzar-unidad.sh"
casos "$LANZADOR"
for id in $IDS; do
  if [ "$(cat "$W/r/$id")" = si ]; then ok "$id" "${TEXTO[$id]}"; else mal "$id" "${TEXTO[$id]}"; fi
done
if [ "$FALLA" -gt 0 ]; then
  for f in "$W"/l*.txt; do echo "--- $(basename "$f")"; sed 's/^/    /' "$f"; done
fi

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
  if ! mutar "$LANZADOR" "$W/$id.sh" "$5" "$6"; then mal "$id" "no se pudo mutar ($que)"; return; fi
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
if [ -f "$LANZADOR" ]; then
  cp "$LANZADOR" "$W/M0.sh"
  casos "$W/M0.sh"
  faltan=""
  for id in $IDS; do [ "$(cat "$W/r/$id")" = si ] || faltan="$faltan $id"; done
  if [ -z "$faltan" ]; then ok M0 "una copia sin cambios pasa las ${IDS// /, }"; else mal M0 "la copia sin cambios no pasa:$faltan"; fi
else
  mal M0 "no existe $LANZADOR"
fi
mutante MLA1 "sin TimeoutStopSec (los 90 s por defecto)" "L1 L5" "L2 L4" \
  '-p "TimeoutStopSec=${TIMEOUT_STOP_S}s" ' ''
mutante MLA2 "sin la negativa con otra unidad activa" "L2 L3" "L1 L4" \
  '  if systemctl is-active --quiet kommo-e5-ensayo.service || systemctl is-active --quiet kommo-e5-carga.service; then' \
  '  if false; then'
mutante MLA3 "sin el vigía" "L1" "L2 L4 L5" \
  '  systemd-run --quiet --unit "$UNIDAD-vigia"' '  : systemd-run --quiet --unit "$UNIDAD-vigia"'

echo "== resultado: $PASA pasan, $FALLA fallan"
[ "$FALLA" = 0 ]
