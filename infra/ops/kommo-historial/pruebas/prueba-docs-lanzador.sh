#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-docs-lanzador.sh — lo que la documentación del lanzador tiene que decir
# (SDD-0590 §10.19). Sin root ni contenedores: lee archivos del repo y nada más.
#
#   D1  el README y la cabecera de lanzar-unidad.sh dicen que el token nunca va por --env
#   D2  ni el README ni lanzar-unidad.sh citan un «<guion de la carga>» que no existe; el README dice que el de la
#       noche del 2026-11-07, carga-57-remoto.sh, quedó fuera del repo, y da los pasos del repo
#   D3  el handoff de la #432 y la §10.18 ya no dejan el CI como pendiente: traen los tres runs
#   D4  el README da el código 7 del lanzador (no arrancó el vigía y se paró la unidad)
set -uo pipefail
KH="$(cd "$(dirname "$0")/.." && pwd)"
RAIZ="$(cd "$KH/../../.." && pwd)"
README="$KH/README.md"
LANZADOR="$KH/lanzar-unidad.sh"
HANDOFF="$RAIZ/.agents/handoffs/0590-e5-guarda-adjuntos.md"
SPEC="$RAIZ/docs/specs/0590-kommo-historial-e5/spec.md"
PASA=0
FALLA=0
CORRIDAS=0
ok() { echo "PASA $1: $2"; PASA=$((PASA + 1)); }
mal() { echo "FALLA $1: $2"; FALLA=$((FALLA + 1)); }
tiene() { grep -qF -- "$2" "$1"; } # archivo literal
caso() { # id descripción condición
  CORRIDAS=$((CORRIDAS + 1))
  if eval "$3"; then ok "$1" "$2"; else mal "$1" "$2"; fi
}
for f in "$README" "$LANZADOR" "$HANDOFF" "$SPEC"; do
  [ -r "$f" ] || { echo "FALLA: no se puede leer $f"; exit 1; }
done

caso D1 "el README y lanzar-unidad.sh dicen que el token nunca va por --env" \
  'tiene "$README" "El token nunca va por \`--env\`" && tiene "$LANZADOR" "el token nunca va por --env"'
caso D2 "sin «<guion de la carga>»; el README dice que carga-57-remoto.sh quedó fuera del repo" \
  '! tiene "$README" "guion de la carga>" && ! tiene "$LANZADOR" "guion de la carga>" &&
   tiene "$README" "carga-57-remoto.sh" && tiene "$README" "no está en el repo"'
caso D3 "el handoff de la #432 y la §10.18 traen los runs, sin CI pendiente" \
  '! tiene "$HANDOFF" "| PENDIENTE |" && ! tiene "$SPEC" "| CI con los arreglos | Ver la PR |" &&
   tiene "$HANDOFF" "42424887376" && tiene "$HANDOFF" "42428357622" && tiene "$HANDOFF" "42428357683" &&
   tiene "$SPEC" "42428357622"'
caso D4 "el README da el código 7 del lanzador" \
  'tiene "$README" "| 7 | No arrancó el vigía"'

# Piso: si un caso dejara de correr, la prueba no puede salir verde.
[ "$CORRIDAS" = 4 ] || mal PISO "corrieron $CORRIDAS casos de 4"
echo "== resultado: $PASA pasan, $FALLA fallan"
[ "$FALLA" = 0 ]
