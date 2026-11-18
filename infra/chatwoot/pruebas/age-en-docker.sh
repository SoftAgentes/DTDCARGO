#!/usr/bin/env bash
# age dentro de un contenedor, para la prueba local en Windows (SDD-0583). En el VPS
# respaldo.sh y restaurar.sh usan el `age` del host (paquete de Ubuntu 24.04).
#
# AGE_KEYDIR es la carpeta de claves de la prueba; las rutas bajo ella se traducen a
# /k dentro del contenedor. La entrada y la salida van por stdin/stdout.
set -euo pipefail
: "${AGE_KEYDIR:?define AGE_KEYDIR}"
args=()
for a in "$@"; do
  case "$a" in
    "$AGE_KEYDIR"/*) args+=("/k/${a#"$AGE_KEYDIR"/}") ;;
    *) args+=("$a") ;;
  esac
done
MSYS_NO_PATHCONV=1 exec docker run --rm -i -v "$(cd "$AGE_KEYDIR" && pwd -W 2>/dev/null || pwd):/k:ro" dtd-age:local age "${args[@]}"
