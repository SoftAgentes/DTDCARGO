#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-regla-clave.sh — ensayo LOCAL de la regla de Traefik contra
# «olvidé mi clave» (SDD-0585, paso 2.7). Nunca en el VPS. Solo datos sintéticos.
# Es una corrida pesada (Docker): una a la vez.
#
# Levanta el compose real detrás del Traefik de prueba y pide lo mismo por dos caminos:
#   · directo a Rails: la variante llega al controlador, y sale un correo;
#   · por Traefik desde «internet»: ninguna variante llega, y no sale ningún correo.
# Al final quita la regla de la copia y repite: el mismo pedido da 200. Si no, el 403 no
# saldría de la regla. Sale 0 solo sin fallas.
#
# Uso:  bash infra/chatwoot/pruebas/prueba-regla-clave.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-clave}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-clave"
EDGE="chatwoot_edge_prueba"
HOST_CHAT="chat.prueba.test"
CORREO="agente-clave@example.test"
TRAEFIK="chatwoot-traefik-prueba-traefik-1"
FALLAS=0

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -d "$D" ] && dc down -v --remove-orphans >/dev/null 2>&1
  (cd "$ORIGEN/pruebas" && docker compose -f compose.traefik-prueba.yml down >/dev/null 2>&1)
  docker network rm "$EDGE" internet_prueba >/dev/null 2>&1
  return 0
}
bajar_todo
rm -rf "$TRABAJO"; mkdir -p "$D"
[ "${PRUEBA_CONSERVAR:-0}" = 1 ] || trap bajar_todo EXIT

ok() { echo "PASÓ  $1 — $2"; }
mal() { echo "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
pedir() { # red url método ruta
  docker run --rm --network "$1" curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' --path-as-is \
    -X "$3" -H "Host: $HOST_CHAT" -H 'Content-Type: application/json' -d "{\"email\":\"$CORREO\"}" "$2$4"
}
directo() { pedir "$EDGE" "http://$P-rails-1:3000" "$1" "$2"; }
por_traefik() { pedir internet_prueba "http://$TRAEFIK" "$1" "$2"; }
correos() { # Devise manda por Sidekiq: se le da tiempo antes de contar.
  sleep 8
  dc exec -T mailpit wget -qO- http://127.0.0.1:8025/api/v1/messages | grep -o '"total":[0-9]*' | head -n 1 | cut -d: -f2
}

cp "$ORIGEN/compose.yml" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/marca" "$ORIGEN/pruebas" "$D/"
cp "$ORIGEN/pruebas/compose.local.yml" "$D/compose.override.yml"
cat >"$D/.env" <<EOF
CHATWOOT_HOST=$HOST_CHAT
CHATWOOT_EDGE_NETWORK=$EDGE
TRAEFIK_ENTRYPOINT=websecure
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.prueba.test
CHATWOOT_FRONTEND_URL=http://$HOST_CHAT
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 16)
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
CHATWOOT_SMTP_AUTHENTICATION=
CHATWOOT_SMTP_ENABLE_STARTTLS_AUTO=false
CHATWOOT_SMTP_OPENSSL_VERIFY_MODE=none
EOF
docker network create --subnet 100.64.250.0/24 "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
docker network create internet_prueba >/dev/null || { mal P0 "no se pudo crear internet_prueba"; exit 1; }
(cd "$ORIGEN/pruebas" && docker compose -f compose.traefik-prueba.yml up -d --wait >/dev/null) \
  || { mal P0 "no arrancó el Traefik de prueba"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f pruebas/compose.clave.yml)
dc "${BASE[@]}" up -d --wait >"$TRABAJO/up.txt" 2>&1 || { mal P0 "el stack no arrancó (ver $TRABAJO/up.txt)"; exit 1; }
dc exec -T rails bundle exec rails runner "
  u = User.new(name: 'Agente sintético', email: '$CORREO', password: 'Pw-' + SecureRandom.hex(8) + '-a1!')
  u.skip_confirmation!
  u.save!
  Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)
" >"$TRABAJO/usuario.txt" 2>&1 || { mal P0 "no se creó el usuario (ver $TRABAJO/usuario.txt)"; exit 1; }

# Traefik tarda unos segundos en leer las etiquetas del contenedor recién sano.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ "$(por_traefik GET /api)" = 200 ] && break
  sleep 3
done

# ── Por Traefik: ninguna variante llega a Rails ───────────────────────────────
# `post` en minúsculas y las rutas raras no son paranoia: el rol de la regla es que ningún
# camino dispare el correo, y Rails normaliza más de lo que Traefik compara.
ANTES="$(correos)"
[ "$ANTES" = 0 ] || mal P1 "había correos antes de empezar: «$ANTES»"
for v in "POST /auth/password" "POST /auth/password.json" "POST /auth/password/" "POST /auth/password?x=1"; do
  c="$(por_traefik ${v% *} "${v#* }")"
  if [ "$c" = 403 ]; then ok "T" "$v → 403"; else mal "T" "$v → $c (esperaba 403)"; fi
done
for v in "POST //auth/password" "POST /auth/%70assword" "POST /auth/./password" "POST /auth/x/../password" "post /auth/password" "POST /AUTH/PASSWORD"; do
  c="$(por_traefik ${v% *} "${v#* }")"
  case "$c" in 2*) mal "T" "$v → $c: llegó a Rails" ;; *) ok "T" "$v → $c" ;; esac
done
TRAS="$(correos)"
if [ "$TRAS" = 0 ]; then ok T0 "ningún pedido por Traefik mandó correo"; else mal T0 "por Traefik salieron $TRAS correos"; fi

# ── Lo demás sigue abierto ────────────────────────────────────────────────────
c="$(por_traefik POST /auth/sign_in)"
[ "$c" = 401 ] && ok A1 "POST /auth/sign_in → 401 (entrar sigue abierto)" || mal A1 "POST /auth/sign_in → $c (esperaba 401)"
c="$(por_traefik GET /app/login)"
[ "$c" = 200 ] && ok A2 "GET /app/login → 200" || mal A2 "GET /app/login → $c (esperaba 200)"
c="$(por_traefik GET /auth/password/edit)"
[ "$c" != 403 ] && ok A3 "GET /auth/password/edit → $c (la regla es solo para POST)" || mal A3 "GET /auth/password/edit → 403"

# ── Directo a Rails: la prueba de arriba mide algo ────────────────────────────
for v in "POST /auth/password" "POST /auth/password.json"; do
  c="$(directo ${v% *} "${v#* }")"
  if [ "$c" = 200 ]; then ok "D" "directo $v → 200 (la ruta existe)"; else mal "D" "directo $v → $c (esperaba 200)"; fi
done
for v in "POST //auth/password" "POST /auth/%70assword" "POST /auth/password/" "post /auth/password" "POST /AUTH/PASSWORD"; do
  echo "(solo para saber) directo $v → $(directo ${v% *} "${v#* }")"
done
DIR="$(correos)"
if [ "${DIR:-0}" -gt 0 ]; then ok D0 "directo a Rails sí salen correos ($DIR)"; else mal D0 "directo no salió ningún correo: «$DIR»; el 0 de arriba no mide nada"; fi

# ── Sin la regla: el mismo pedido llega ───────────────────────────────────────
sed -i -e '/-clave\./d' -e '/-nadie\./d' "$D/compose.yml"
dc "${BASE[@]}" up -d --wait --no-deps rails >"$TRABAJO/sin-regla.txt" 2>&1 || mal S0 "rails no volvió sin la regla (ver $TRABAJO/sin-regla.txt)"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  c="$(por_traefik POST /auth/password)"
  [ "$c" = 200 ] && break
  sleep 3
done
if [ "$c" = 200 ]; then ok S1 "sin la regla, POST /auth/password por Traefik → 200"; else mal S1 "sin la regla → $c (esperaba 200)"; fi

echo "fallas: $FALLAS"
[ "$FALLAS" = 0 ]
