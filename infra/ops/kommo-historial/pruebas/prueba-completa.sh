#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-completa.sh — prueba de las guardas de completa.sh (SDD-0590 §10.12),
# con systemd de verdad, un token falso, timers falsos y un extractor falso que solo anota cómo lo llamaron.
# No le pide nada a Kommo. Corre como root (sudo) en el runner de GitHub Actions.
#
# Se niega donde estén el token real, su timer o la carpeta del VPS: no es para correrla en el VPS.
#
#   G1   token válido y borrado programado activo: corre extraer con --adjuntos-para-carga y sin --sin-adjuntos,
#        y al terminar borra el token y para el timer
#   G2   sin el timer: código 11, sin llamar a extraer, el token queda
#   G3   el timer ya disparó y se descargó (RemainAfterElapse=no, como el del VPS): código 11
#   G4   el timer ya disparó y quedó activo sin próximo disparo (RemainAfterElapse=yes): código 11
#   G5   token con permisos 644: código 11
#   G6   token de 200 bytes: código 11
#   G7   sin token: código 11
#   G8   carga por encima de 8: código 12, sin llamar a extraer
#   G9   TERM a mitad de extraer (como el vigía): código 143, el token y el timer quedan para reanudar
#   G10  extraer falla: devuelve su código, borra el token y para el timer
#   F1   el contenido del token no aparece en ninguna salida
#   M0   control: una copia sin cambios pasa todo
#   MC1–MC5 mutantes: cada uno tiene que tumbar sus comprobaciones y dejar pasar las otras
set -uo pipefail
PRUEBAS="$(cd "$(dirname "$0")" && pwd)"
COMPLETA="$PRUEBAS/../completa.sh"
[ "$(id -u)" = 0 ] || { echo "hace falta root (sudo)"; exit 2; }
[ -d /run/systemd/system ] || { echo "hace falta systemd"; exit 2; }
if [ -e /dev/shm/k0582-e5 ] || [ -d /srv/ops/kommo-historial-0590b ] ||
   [ "$(systemctl show -p LoadState --value kommo-e5-token-caduca.timer 2>/dev/null)" = loaded ]; then
  echo "se niega: aquí están el token real, su timer o la carpeta del VPS"; exit 2
fi

W="$(mktemp -d /dev/shm/prueba-completa.XXXXXX)"
PREFIJO="kommo-prueba-guarda-$$"
N=0
limpiar() {
  pkill -f "$W/aqui/respaldar-historial.py" 2>/dev/null
  systemctl stop "$PREFIJO-*.timer" "$PREFIJO-*.service" 2>/dev/null
  systemctl reset-failed "$PREFIJO-*" 2>/dev/null
  rm -rf -- "$W"
}
trap limpiar EXIT

# Extractor falso: anota los argumentos y puede dormir o fallar.
mkdir -m 700 "$W/aqui"
cat >"$W/aqui/respaldar-historial.py" <<'EOF'
import os, sys, time
if "--help" in sys.argv:
    # La 1.3.0 lista --adjuntos-para-carga; con FALSO_VIEJO, como la 1.2.0, no. Larga, para que se note si alguien
    # la mira con un `| grep -q` y pipefail.
    print("usage: respaldar-historial.py extraer [-h] --token-file TOKEN_FILE [--corte CORTE]")
    if not os.environ.get("FALSO_VIEJO"):
        print("  --adjuntos-para-carga")
    for i in range(20000):
        print(f"  --opcion-{i}  relleno de la ayuda")
    sys.exit(0)
with open(os.environ["FALSO_ARGS"], "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\n")
time.sleep(float(os.environ.get("FALSO_DORMIR", "0")))
sys.exit(int(os.environ.get("FALSO_CODIGO", "0")))
EOF

PASA=0
FALLA=0
ok() { echo "PASA $1: $2"; PASA=$((PASA + 1)); }
mal() { echo "FALLA $1: $2"; FALLA=$((FALLA + 1)); }

token() { # bytes permisos: un token falso que se reconoce en las salidas
  rm -f "$W/token"
  python3 -I -c 'import sys; sys.stdout.write(("FALSOTOKEN" * 200)[: int(sys.argv[1])])' "$1" >"$W/token"
  chmod "$2" "$W/token"
}
carga() { echo "$1 0.50 0.40 1/100 1" >"$W/carga"; }
nueva_unidad() { N=$((N + 1)); U="$PREFIJO-$N"; }
timer_futuro() { # el caso normal: OnCalendar por disparar, como kommo-e5-token-caduca
  systemd-run --quiet --unit "$U" --on-calendar='2099-01-01 00:00:00 UTC' --timer-property=AccuracySec=1s /bin/true
}
timer_que_dispara() { # remain(no|yes): OnCalendar a 2 s, y espera a que dispare
  local cuando
  cuando="$(date -u -d '+2 sec' '+%Y-%m-%d %H:%M:%S') UTC"
  systemd-run --quiet --unit "$U" --on-calendar="$cuando" --timer-property=AccuracySec=100ms \
    --timer-property=RemainAfterElapse="$1" /bin/true
  for _ in $(seq 1 100); do
    if [ "$1" = no ]; then
      [ "$(systemctl show -p LoadState --value "$U.timer")" = not-found ] && return 0
    else
      [ -z "$(systemctl show -p NextElapseUSecRealtime --value "$U.timer")" ] && return 0
    fi
    sleep 0.2
  done
  echo "AVISO: $U no disparó en 20 s"
}
quitar() { systemctl stop "$U.timer" "$U.service" 2>/dev/null; systemctl reset-failed "$U.timer" "$U.service" 2>/dev/null; }
correr() { # script nombre [variables...]: código en $W/<nombre>.rc
  local s="$1" n="$2"
  shift 2
  : >"$W/args"
  env COMPLETA_TOKEN="$W/token" COMPLETA_TIMER="$U.timer" COMPLETA_AQUI="$W/aqui" COMPLETA_ESTADO="$W/$n.estado" \
    COMPLETA_CARGA_DE="$W/carga" COMPLETA_ESPERA=0 FALSO_ARGS="$W/args" CORTE=2026-11-07T05:00:00Z "$@" \
    bash "$s" >"$W/$n.txt" 2>&1
  echo $? >"$W/$n.rc"
}
rc() { cat "$W/$1.rc" 2>/dev/null; }
sin_llamar() { [ ! -s "$W/args" ]; }
activo() { [ "$(systemctl is-active "$U.timer")" = active ]; }
anota() { if eval "$2"; then echo si >"$W/r/$1"; else echo no >"$W/r/$1"; fi; }

casos() { # script → $W/r/<id> = si | no
  local S="$1"
  rm -rf "$W/r" "$W"/*.estado "$W"/*.txt "$W"/*.rc
  mkdir "$W/r"

  token 1035 600; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g1
  anota G1 '[ "$(rc g1)" = 0 ] && [ "$(grep -c . "$W/args")" = 1 ] &&
    grep -q -- "^extraer --token-file $W/token --corte 2026-11-07T05:00:00Z " "$W/args" &&
    grep -q -- " --adjuntos-para-carga " "$W/args" && ! grep -q -- "--sin-adjuntos" "$W/args" &&
    grep -q "borrado_programado=active proximo_borrado=" "$W/g1.estado" && ! grep -q "proximo_borrado=ninguno" "$W/g1.estado" &&
    [ ! -e "$W/token" ] && ! activo && grep -qx "codigo=0" "$W/g1.estado"'
  quitar

  token 1035 600; carga 1.00; nueva_unidad
  correr "$S" g2
  anota G2 '[ "$(rc g2)" = 11 ] && sin_llamar && [ -e "$W/token" ] && grep -q "borrado_programado=inactive" "$W/g2.estado"'

  token 1035 600; carga 1.00; nueva_unidad; timer_que_dispara no
  correr "$S" g3
  anota G3 '[ "$(rc g3)" = 11 ] && sin_llamar && [ -e "$W/token" ] && grep -q "borrado_programado=inactive" "$W/g3.estado"'
  quitar

  token 1035 600; carga 1.00; nueva_unidad; timer_que_dispara yes
  correr "$S" g4
  # Que de verdad se probó un timer activo sin próximo disparo: si no, la comprobación no mira nada.
  anota G4 '[ "$(rc g4)" = 11 ] && sin_llamar && [ -e "$W/token" ] && grep -q "borrado_programado=active proximo_borrado=ninguno" "$W/g4.estado"'
  quitar

  token 1035 644; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g5
  anota G5 '[ "$(rc g5)" = 11 ] && sin_llamar && [ -e "$W/token" ] && activo'
  quitar

  token 200 600; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g6
  anota G6 '[ "$(rc g6)" = 11 ] && sin_llamar && [ -e "$W/token" ] && activo'
  quitar

  rm -f "$W/token"; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g7
  anota G7 '[ "$(rc g7)" = 11 ] && sin_llamar && grep -qx "token=ausente" "$W/g7.estado" && activo'
  quitar

  token 1035 600; carga 9.50; nueva_unidad; timer_futuro
  correr "$S" g8
  anota G8 '[ "$(rc g8)" = 12 ] && sin_llamar && [ -e "$W/token" ] && activo'
  quitar

  # G9: TERM a bash mientras extraer duerme, como cuando el vigía para la unidad.
  token 1035 600; carga 1.00; nueva_unidad; timer_futuro
  : >"$W/args"
  env COMPLETA_TOKEN="$W/token" COMPLETA_TIMER="$U.timer" COMPLETA_AQUI="$W/aqui" COMPLETA_ESTADO="$W/g9.estado" \
    COMPLETA_CARGA_DE="$W/carga" COMPLETA_ESPERA=0 FALSO_ARGS="$W/args" FALSO_DORMIR=30 CORTE=2026-11-07T05:00:00Z \
    bash "$S" >"$W/g9.txt" 2>&1 &
  local pid=$!
  for _ in $(seq 1 100); do [ -s "$W/args" ] && break; sleep 0.1; done
  kill -TERM "$pid"
  wait "$pid"
  echo $? >"$W/g9.rc"
  pkill -f "$W/aqui/respaldar-historial.py" 2>/dev/null
  anota G9 '[ "$(rc g9)" = 143 ] && [ -e "$W/token" ] && activo && grep -qx "codigo=143" "$W/g9.estado"'
  quitar

  token 1035 600; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g10 FALSO_CODIGO=3
  anota G10 '[ "$(rc g10)" = 3 ] && [ ! -e "$W/token" ] && ! activo && grep -qx "codigo=3" "$W/g10.estado"'
  quitar

  token 1035 600; carga 1.00; nueva_unidad; timer_futuro
  correr "$S" g11 FALSO_VIEJO=1
  anota G11 '[ "$(rc g11)" = 13 ] && sin_llamar && [ -e "$W/token" ] && activo'
  quitar

  anota F1 '! grep -l FALSOTOKEN "$W"/*.txt "$W"/*.estado "$W/args" >/dev/null 2>&1'
}

declare -A TEXTO=(
  [G1]="token válido y borrado programado activo: extraer con --adjuntos-para-carga, sin --sin-adjuntos; al terminar, token borrado y timer parado"
  [G2]="sin el timer: código 11, extraer no se llama y el token queda"
  [G3]="el timer ya disparó y se descargó: código 11"
  [G4]="el timer ya disparó y quedó activo sin próximo disparo: código 11"
  [G5]="token con permisos 644: código 11"
  [G6]="token de 200 bytes: código 11"
  [G7]="sin token: código 11"
  [G8]="carga 9.50: código 12, extraer no se llama"
  [G9]="TERM a mitad de extraer: código 143, el token y el timer quedan para reanudar"
  [G10]="extraer falla con 3: devuelve 3, borra el token y para el timer"
  [G11]="el extractor desplegado no entiende --adjuntos-para-carga (la 1.2.0): código 13, sin llamar a extraer; el token y el timer quedan"
  [F1]="el contenido del token no aparece en ninguna salida"
)
IDS="G1 G2 G3 G4 G5 G6 G7 G8 G9 G10 G11 F1"

echo "== completa.sh"
casos "$COMPLETA"
for id in $IDS; do
  if [ "$(cat "$W/r/$id")" = si ]; then ok "$id" "${TEXTO[$id]}"; else mal "$id" "${TEXTO[$id]}"; fi
done
if [ "$FALLA" -gt 0 ]; then
  for f in "$W"/*.estado; do echo "--- $(basename "$f")"; sed 's/FALSOTOKEN[A-Za-z]*/[TOKEN]/g' "$f"; done
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
  if ! mutar "$COMPLETA" "$W/$id.sh" "$5" "$6"; then mal "$id" "no se pudo mutar ($que)"; return; fi
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
cp "$COMPLETA" "$W/M0.sh"
casos "$W/M0.sh"
faltan=""
for id in $IDS; do [ "$(cat "$W/r/$id")" = si ] || faltan="$faltan $id"; done
if [ -z "$faltan" ]; then ok M0 "una copia sin cambios pasa las ${IDS// /, }"; else mal M0 "la copia sin cambios no pasa:$faltan"; fi

mutante MC1 "la guarda vieja de 24 h, sin mirar el timer" "G2 G3 G4" "G1 G5 G6" \
  '[ "$borrado" != active ] || [ "$proximo" = ninguno ]' '[ "$edad" -ge 86400 ]'
mutante MC2 "sin mirar el próximo disparo" "G4" "G1 G2 G3" \
  ' || [ "$proximo" = ninguno ]; then' '; then'
mutante MC3 "vuelve --sin-adjuntos" "G1" "G2 G10" \
  '  --adjuntos-para-carga --staging' '  --sin-adjuntos --staging'
mutante MC4 "no para el timer al terminar" "G1 G10" "G2 G9" \
  'systemctl stop "$TIMER" 2>/dev/null' 'true'
mutante MC5 "borra el token cuando la paran" "G9" "G1 G2" \
  'estado "codigo=143"; exit 143; }' 'rm -f "$TOKEN"; estado "codigo=143"; exit 143; }'
mutante MC6 "no mira si el extractor entiende --adjuntos-para-carga" "G11" "G1 G2" \
  '  *) estado "extractor=sin_adjuntos_para_carga: no se pide nada a Kommo"; estado "codigo=13"; exit 13 ;;' \
  '  *) estado "extractor=sin_adjuntos_para_carga" ;;'
mutante MC7 "mira la ayuda con | grep -q y pipefail" "G1" "G2 G11" \
  'case "$ayuda" in' \
  'python3 -I "$AQUI/respaldar-historial.py" extraer --help 2>/dev/null | grep -q -- --adjuntos-para-carga || ayuda=vieja
case "$ayuda" in'

echo "== resultado: $PASA pasan, $FALLA fallan"
[ "$FALLA" = 0 ]
