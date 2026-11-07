#!/usr/bin/env bash
# scripts/ci-sql-tests.sh — corre los contratos de SQL (scripts/run-sql-tests.mjs) en el CI y lee bien su resultado.
#
# run-sql-tests.mjs sale con 0 (todos verdes), 1 (algún contrato roto) o 3 (SKIP: sin Docker, Postgres que no
# arranca a tiempo o VERIFY_SKIP_SQL=1). En `pnpm verify` el 3 se ve como SKIP; en el CI no hay otra corrida que lo
# tape, así que aquí solo vale el 0, y además:
#   · ninguna línea [SKIP];
#   · ningún ✗;
#   · tantos ✓ como contratos *.test.sql hay en supabase/tests de la carpeta raíz, y al menos uno.
# Un SKIP no es un verde: sale con 1 y lo dice.
#
# Uso: bash scripts/ci-sql-tests.sh [carpeta-raíz]   (por defecto, la actual; run-sql-tests lee supabase/ desde ahí)
# CI_SQL_TESTS_RUNNER cambia el runner: solo para probar este guion sin Docker.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "${1:-$PWD}" && pwd)"
RUNNER="${CI_SQL_TESTS_RUNNER:-$AQUI/run-sql-tests.mjs}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

(cd "$RAIZ" && node "$RUNNER") >"$LOG" 2>&1
rc=$?
cat "$LOG"

esperados=$(find "$RAIZ/supabase/tests" -maxdepth 1 -name '*.test.sql' 2>/dev/null | wc -l | tr -d ' ')
verdes=$(grep -c '✓' "$LOG")
rojos=$(grep -c '✗' "$LOG")
saltos=$(grep -c '\[SKIP\]' "$LOG")
echo "ci-sql-tests: código $rc · $verdes de $esperados contratos en verde · $rojos rojos · $saltos saltos"

if [ "$rc" = 3 ] || [ "$saltos" != 0 ]; then
  echo "::error::los contratos de SQL no corrieron (SKIP, código $rc): un salto no cuenta como verde"
  exit 1
fi
if [ "$rc" != 0 ] || [ "$rojos" != 0 ]; then
  echo "::error::$rojos contrato(s) de SQL en rojo (código $rc)"
  exit 1
fi
if [ "$esperados" -lt 1 ] || [ "$verdes" != "$esperados" ]; then
  echo "::error::run-sql-tests salió con 0 pero hay $verdes verdes para $esperados contratos"
  exit 1
fi
echo "ci-sql-tests: los $esperados contratos de SQL en verde"
