#!/usr/bin/env bash
# Exporta los PNG del ícono de Noticias desde los SVG con Chrome headless (Git Bash en Windows).
# Uso: bash docs/specs/0611-noticias-publicacion-automatica/assets/discord/render.sh
set -euo pipefail
cd "$(dirname "$0")"
CH="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROF="$(mktemp -d)"; command -v cygpath >/dev/null && PROF="$(cygpath -w "$PROF")"
DIR="$(pwd -W 2>/dev/null || pwd)"

shot() { # archivo ancho alto salida
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$PROF" --window-size="$2,$3" --screenshot="$DIR/$4" "file:///$DIR/$1" 2>/dev/null
}

node generar.mjs
shot noticias-icono.svg           1024 1024 noticias-icono-1024.png
shot noticias-icono-periodico.svg 1024 1024 noticias-icono-periodico-1024.png
shot noticias-icono-sello.svg     1024 1024 noticias-icono-sello-1024.png
shot vista-previa.html            1000  560 noticias-vista-previa.png
rm -rf "$PROF"
