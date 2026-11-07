#!/usr/bin/env bash
# infra/chatwoot/pruebas/portal/prueba-portal-poc.sh — prueba de concepto de la ida del chat del portal a Chatwoot
# (SDD-0586, paso 10.5, §10.5.15: PoC-1, PoC-2, PoC-3 y PoC-5) contra una instancia EFÍMERA de Chatwoot
# v4.19.1-ce: el compose real de infra/chatwoot (imagen fijada por digest) con su Postgres, su Redis, Rails y
# Sidekiq. Corre en GitHub Actions (.github/workflows/chatwoot-portal-poc.yml) o en una PC con Docker; nunca en el
# VPS. Solo datos inventados y secretos generados al azar para esta corrida, sin nada del repositorio.
#
#   1. Levanta Postgres y Redis, migra (db:chatwoot_prepare) y prepara la cuenta con la sonda: administrador con
#      token, bandeja API «Conversaciones del portal» y webhook de cuenta al receptor de la red interna.
#   2. Levanta Rails (en 127.0.0.1:3000 del runner), Sidekiq y el receptor.
#   3. Corre lib/studio/chatwoot/__tests__/portal.poc.test.ts con el cliente REAL de Studio (router-api.ts y
#      portal.ts) contra esa instancia. Cada PoC es una prueba con su PASÓ o FALLÓ.
#
# Uso:  bash infra/chatwoot/pruebas/portal/prueba-portal-poc.sh [--conservar]
# Sale con el código de vitest; 1 si la instancia no arrancó.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
for a in "$@"; do
  case "$a" in
    --conservar) CONSERVAR=1 ;;
    *) echo "opción desconocida: $a"; exit 2 ;;
  esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CW="$(cd "$AQUI/../.." && pwd)"
RAIZ="$(cd "$CW/../.." && pwd)"
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-portal-poc.XXXXXX")"
D="$TRABAJO/stack"
P="chatwoot-portal-poc"
EDGE="chatwoot_edge_portal_poc"

dc() { (cd "$D" && docker compose -p "$P" "${BASE[@]}" "$@"); }
bajar_todo() {
  [ -f "$D/compose.yml" ] && (cd "$D" && docker compose -p "$P" -f compose.yml -f compose.override.yml -f compose.portal-poc.yml down -v --remove-orphans >/dev/null 2>&1)
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
limpiar() {
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stack arriba en $D)"; return; }
  bajar_todo
}
trap limpiar EXIT
leer() { sed -n "s/^$1=//p" "$D/estado/sonda.txt" | tail -n 1 | tr -d '\r'; }
falla_arranque() {
  echo "FALLÓ arranque — $1"
  dc logs --no-color --tail 80 "${@:2}" 2>/dev/null | sed 's/^/   /'
  exit 1
}

echo "== prueba de concepto de la ida del portal · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
mkdir -p "$D/poc" "$D/estado"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.portal-poc.yml" "$D/"
cp "$AQUI/sonda-portal-poc.rb" "$AQUI/receptor-webhook.mjs" "$D/poc/"
chmod 0777 "$D/estado"
cat >"$D/.env" <<EOF
CHATWOOT_HOST=chat.prueba.test
CHATWOOT_EDGE_NETWORK=$EDGE
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.prueba.test
CHATWOOT_FRONTEND_URL=http://chat.prueba.test
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 16)
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
EOF
bajar_todo
docker network create "$EDGE" >/dev/null || { echo "FALLÓ arranque — no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f compose.portal-poc.yml)

echo "== 1. Postgres, Redis, migración y sonda"
dc up -d --wait postgres redis >"$TRABAJO/up-base.txt" 2>&1 || falla_arranque "Postgres/Redis no arrancaron" postgres redis
dc run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null || { tail -n 60 "$TRABAJO/prepare.txt"; falla_arranque "db:chatwoot_prepare falló"; }
dc run --rm -T -e SALIDA=/tmp/estado/sonda.txt -e WEBHOOK_URL=http://receptor:8080/webhook prepare \
  bundle exec rails runner /tmp/poc/sonda-portal-poc.rb >"$TRABAJO/sonda.txt" 2>&1 </dev/null \
  || { tail -n 60 "$TRABAJO/sonda.txt"; falla_arranque "la sonda falló"; }
grep -q '^HECHO sonda=ok' "$TRABAJO/sonda.txt" || { tail -n 40 "$TRABAJO/sonda.txt"; falla_arranque "la sonda no terminó"; }
CUENTA="$(leer cuenta)"
BANDEJA="$(leer bandeja)"
TOKEN="$(leer token)"
[ -n "$CUENTA" ] && [ -n "$BANDEJA" ] && [ -n "$TOKEN" ] || falla_arranque "la sonda no dejó cuenta, bandeja y token"
echo "   cuenta $CUENTA, bandeja $BANDEJA, webhook_url del canal: $(leer webhook_url_del_canal) (el token no se imprime)"

echo "== 2. Rails, Sidekiq y el receptor"
dc up -d --wait rails sidekiq receptor >"$TRABAJO/up-app.txt" 2>&1 || { tail -n 40 "$TRABAJO/up-app.txt"; falla_arranque "Rails/Sidekiq/receptor no arrancaron" rails sidekiq receptor; }
LISTO=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/health; then LISTO=1; break; fi
  sleep 2
done
[ "$LISTO" = 1 ] || falla_arranque "Rails no contesta /health en 127.0.0.1:3000" rails

echo "== 3. PoC con el cliente de Studio"
cd "$RAIZ" || exit 1
CHATWOOT_POC_ORIGIN=http://127.0.0.1:3000 \
CHATWOOT_POC_CUENTA="$CUENTA" \
CHATWOOT_POC_BANDEJA="$BANDEJA" \
CHATWOOT_POC_TOKEN="$TOKEN" \
CHATWOOT_POC_WEBHOOKS="$D/estado/webhooks.ndjson" \
  pnpm exec vitest run lib/studio/chatwoot/__tests__/portal.poc.test.ts --reporter=verbose --maxWorkers=1
CODIGO=$?
if [ "$CODIGO" != 0 ]; then
  echo "== registros de Sidekiq (redactados por zz_dtd_redaccion_logs.rb)"
  dc logs --no-color --tail 60 sidekiq 2>/dev/null | sed 's/^/   /'
fi
echo "== resultado: vitest salió con $CODIGO"
exit "$CODIGO"
