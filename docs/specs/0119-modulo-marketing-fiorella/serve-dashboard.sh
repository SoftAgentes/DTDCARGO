#!/usr/bin/env bash
# Levanta un servidor HTTP local para el dashboard maestro y lo abre en el navegador.
# Necesario porque el dashboard.html usa fetch() para leer dashboard-data.json,
# y los navegadores bloquean fetch desde file:// por seguridad.
#
# Uso:
#   ./serve-dashboard.sh
#
# Para detener: Ctrl+C en esta terminal.

set -euo pipefail

cd "$(dirname "$0")"

PORT=8765
# Si el puerto está ocupado, buscar uno libre
while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 8800 ]; then
    echo "❌ No encontré puerto libre entre 8765-8800. Cierra algún servidor previo."
    exit 1
  fi
done

URL="http://localhost:$PORT/dashboard.html"

echo "🚀 Levantando servidor en puerto $PORT..."
echo "📂 Sirviendo: $(pwd)"
echo "🌐 Dashboard: $URL"
echo ""
echo "Abriendo navegador en 2 segundos..."
echo "Para detener: presiona Ctrl+C"
echo ""

(sleep 2 && open "$URL") &

# Servir en foreground para que Ctrl+C cierre limpiamente
python3 -m http.server "$PORT"
