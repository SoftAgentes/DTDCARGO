#!/usr/bin/env bash
# scripts/ci-sql-tests-control.sh — control del job de contratos de SQL: que dé rojo cuando tiene que darlo.
#
# Arma, en una carpeta temporal, un supabase/ con las migraciones del repo y dos contratos reales, 0310 y 0327, y
# corre scripts/ci-sql-tests.sh sobre él:
#   C0  control: los dos contratos tal cual → verde (2 de 2)
#   C1  mutante en el contrato: la primera aserción de la 0327 espera lo contrario → rojo, con ✗ 0327 y ✓ 0310
#   C2  regresión en la migración: la 0327 sin el REVOKE de sync_boxes → el contrato de siempre da rojo
#   C3  salto: VERIFY_SKIP_SQL=1 → run-sql-tests sale con 3 y ci-sql-tests.sh no lo cuenta como verde
#   C4  arranque: con la fase temporal del initdb alargada 8 s (imagen derivada de postgres:17), todos los contratos
#       tienen que salir verdes; la espera no puede dar por listo al servidor temporal (tren #427, run 42415565680)
# Sale con 0 solo si los cinco casos dan lo esperado. Cada caso levanta su Postgres desechable (el de
# run-sql-tests.mjs) y lo borra al terminar.
#
# Uso: bash scripts/ci-sql-tests-control.sh   (desde la raíz del repo, con Docker)
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/.." && pwd)"
PY="${PYTHON:-python3}"
W="$(mktemp -d)"
trap 'rm -rf -- "$W"' EXIT
FALLAS=0
ok() { echo "PASÓ  $1 — $2"; }
mal() { echo "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }

CONTROL=0310_erp_attachments_bucket.test.sql
OBJETIVO=0327_internal_function_grants.test.sql
MIGRACION=0327_internal_function_grants.sql

armar() { # caso → $W/<caso>/supabase con las migraciones y los dos contratos
  mkdir -p "$W/$1/supabase/tests"
  cp -r "$REPO/supabase/migrations" "$W/$1/supabase/"
  cp "$REPO/supabase/tests/$CONTROL" "$REPO/supabase/tests/$OBJETIVO" "$W/$1/supabase/tests/"
}
mutar() { # archivo buscar reemplazo: el texto tiene que aparecer exactamente una vez
  "$PY" -I - "$@" <<'EOF'
import sys
ruta, buscar, poner = sys.argv[1:4]
texto = open(ruta, encoding="utf-8").read()
n = texto.count(buscar)
if n != 1:
    sys.exit(f"el texto a mutar aparece {n} veces en {ruta}: {buscar!r}")
open(ruta, "w", encoding="utf-8").write(texto.replace(buscar, poner))
EOF
}
correr() { # caso [VAR=valor...] → $W/<caso>.log y $W/<caso>.rc
  local caso="$1"
  shift
  env "$@" bash "$AQUI/ci-sql-tests.sh" "$W/$caso" >"$W/$caso.log" 2>&1
  echo $? >"$W/$caso.rc"
}
rc() { cat "$W/$1.rc"; }
tiene() { grep -qF -- "$2" "$W/$1.log"; }
verde_de() { grep -q "✓.*$2" "$W/$1.log"; }
mostrar() { sed 's/^/     /' "$W/$1.log" | tail -n 15; }

echo "== control del job de contratos de SQL"

armar c0
correr c0
if [ "$(rc c0)" = 0 ] && tiene c0 "2 de 2 contratos en verde" && verde_de c0 "$CONTROL" && verde_de c0 "$OBJETIVO"; then
  ok C0 "los dos contratos tal cual: verde, 2 de 2"
else
  mal C0 "los dos contratos tal cual tenían que dar verde (código $(rc c0))"; mostrar c0
fi

armar c1
if mutar "$W/c1/supabase/tests/$OBJETIVO" \
     "if has_function_privilege('anon','public.warehouse_receipts_cn_sync_boxes()','EXECUTE')" \
     "if not has_function_privilege('anon','public.warehouse_receipts_cn_sync_boxes()','EXECUTE')"; then
  correr c1
  if [ "$(rc c1)" != 0 ] && tiene c1 "✗ $OBJETIVO" && verde_de c1 "$CONTROL" && tiene c1 "1 contrato(s) de SQL en rojo"; then
    ok C1 "mutante en el contrato 0327: rojo (código $(rc c1)), con ✗ 0327 y ✓ 0310"
  else
    mal C1 "el mutante en el contrato 0327 tenía que dar rojo solo en la 0327 (código $(rc c1))"; mostrar c1
  fi
else
  mal C1 "no se pudo mutar el contrato 0327"
fi

armar c2
if mutar "$W/c2/supabase/migrations/$MIGRACION" \
     $'revoke all on function public.warehouse_receipts_cn_sync_boxes()\n  from public, anon, authenticated;\n' ""; then
  correr c2
  if [ "$(rc c2)" != 0 ] && tiene c2 "✗ $OBJETIVO" && tiene c2 "0327: sync_boxes público" && verde_de c2 "$CONTROL"; then
    ok C2 "la 0327 sin su REVOKE: el contrato de siempre da rojo (código $(rc c2)) y dice «sync_boxes público»"
  else
    mal C2 "la migración 0327 sin su REVOKE tenía que poner en rojo su contrato (código $(rc c2))"; mostrar c2
  fi
else
  mal C2 "no se pudo mutar la migración 0327"
fi

correr c0 VERIFY_SKIP_SQL=1
if [ "$(rc c0)" != 0 ] && tiene c0 "[SKIP]" && tiene c0 "código 3" && tiene c0 "un salto no cuenta como verde"; then
  ok C3 "VERIFY_SKIP_SQL=1: run-sql-tests sale con 3 y el job lo da en rojo"
else
  mal C3 "un salto tenía que dar rojo (código $(rc c0))"; mostrar c0
fi

# C4: el arranque de Postgres. La imagen oficial levanta primero un servidor temporal, solo en el socket, para el
# initdb, y después lo apaga y arranca el definitivo. Si la espera de run-sql-tests da por listo al temporal, los
# psql que caen en el cambio fallan sin ningún ERROR de SQL: es el rojo intermitente del tren #427 (run 42415565680,
# la 0310 en C0 a C2). Aquí la fase temporal se alarga 8 s con un script de initdb, en una imagen derivada de la misma,
# y se corren todos los contratos: los que caigan en el cambio tienen que salir verdes igual.
LENTA=dtd-sqltest-initdb-lento:control
if docker build -q -t "$LENTA" - >"$W/c4-build.log" 2>&1 <<'EOF'
FROM postgres:17
RUN printf '#!/bin/sh\necho "control C4: fase temporal del initdb alargada"\nsleep 8\n' \
      > /docker-entrypoint-initdb.d/00-lento.sh && chmod 755 /docker-entrypoint-initdb.d/00-lento.sh
EOF
then
  mkdir -p "$W/c4/supabase"
  cp -r "$REPO/supabase/migrations" "$REPO/supabase/tests" "$W/c4/supabase/"
  correr c4 SQL_TEST_PG_IMAGE="$LENTA"
  if [ "$(rc c4)" = 0 ] && tiene c4 "contratos de SQL en verde"; then
    ok C4 "con la fase temporal del initdb alargada 8 s, $(grep -o '[0-9]* de [0-9]* contratos en verde' "$W/c4.log" | head -n 1): la espera no confunde el servidor temporal con el definitivo"
  else
    mal C4 "con la fase temporal del initdb alargada, los contratos tenían que salir verdes (código $(rc c4))"
    grep -E '✗|sin ERROR de SQL|ERROR:|ci-sql-tests:' "$W/c4.log" | head -n 12 | sed 's/^/     /'
  fi
  docker image rm -f "$LENTA" >/dev/null 2>&1
else
  mal C4 "no se pudo armar la imagen de Postgres con el initdb alargado"; sed 's/^/     /' "$W/c4-build.log" | tail -n 5
fi

echo "== control: $FALLAS fallas"
[ "$FALLAS" = 0 ]
