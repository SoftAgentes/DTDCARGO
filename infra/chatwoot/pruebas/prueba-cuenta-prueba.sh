#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-cuenta-prueba.sh — ensayo LOCAL de la cuenta de Chatwoot solo
# para prueba (infra/chatwoot/crear-cuenta-prueba.rb). Nunca en el VPS. Solo datos sintéticos.
# Es una corrida pesada (Docker): una a la vez.
#
# Levanta Postgres y Redis del compose real con el overlay local, migra con `prepare` y corre
# pruebas/sonda-cuenta-prueba.rb con `rails runner`. Sale 0 solo sin fallas.
#
# Uso:  bash infra/chatwoot/pruebas/prueba-cuenta-prueba.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-cuenta}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-cuenta"
EDGE="chatwoot_edge_cuenta"
FALLAS=0

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -d "$D" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
bajar_todo
rm -rf "$TRABAJO"; mkdir -p "$D"
trap bajar_todo EXIT

mal() { echo "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
h() { sed -n "s/^HECHO $1=//p" "$F" | tail -n 1 | tr -d '\r'; }
exigir() { # clave esperado descripción
  local v
  v="$(h "$1")"
  if [ "$v" = "$2" ]; then echo "PASÓ  $1 — $3"; else mal "$1" "$3 (dio «$v», esperaba «$2»)"; fi
}

cp "$ORIGEN/compose.yml" "$ORIGEN/crear-cuenta-prueba.rb" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/marca" "$ORIGEN/pruebas" "$D/"
cp "$ORIGEN/pruebas/compose.local.yml" "$D/compose.override.yml"
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
docker network create "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f pruebas/compose.cuenta.yml)

dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1 || { mal P0 "Postgres o Redis no arrancaron"; exit 1; }
dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 || { mal P0 "db:chatwoot_prepare falló"; exit 1; }
F="$TRABAJO/sonda.txt"
dc "${BASE[@]}" run --rm -T prepare bundle exec rails runner /tmp/sonda-cuenta-prueba.rb >"$F" 2>&1

exigir crea si "crea la cuenta y la app"
exigir foto_tras_crear igual "la cuenta real no cambia al crearlas"
exigir segunda_vez rechaza "una segunda corrida no toca nada"
exigir flags_correo 0 "agentes de prueba sin avisos por correo"
exigir flags_push 0 "agentes de prueba sin avisos push"
exigir app_cuenta_real 401 "el token de prueba no lee la cuenta real"
exigir app_cuenta_propia 200 "el token de prueba lee la suya"
exigir app_usuario_real 401 "el token de prueba no lee un usuario real"
exigir app_login_real 401 "el token de prueba no entra como un usuario real"
exigir app_miembro_real 401 "el token de prueba no se agrega a la cuenta real"
exigir app_borrar_real 401 "el token de prueba no borra la cuenta real"
exigir app_lista solo_la_propia "la lista de cuentas de la app solo trae la suya"
exigir servicio_conversaciones_reales 401 "su usuario de servicio no ve conversaciones reales"
exigir servicio_conversaciones_propias 200 "su usuario de servicio ve las suyas"
exigir webhook_secreto si "el webhook nace con su secreto"
exigir conversacion_correo 200 "crea una conversación en la bandeja de correo, sin mensaje"
exigir evento_creada si "sale conversation_created"
exigir evento_creada_canal Channel::Email "el evento dice Channel::Email: Studio le da fuente correo"
exigir evento_creada_cuenta propia "el evento lleva la cuenta de prueba"
exigir evento_url solo_prueba "solo va al webhook de prueba"
exigir asignar 200 "asigna a un agente"
exigir evento_asignada si "sale conversation_updated"
exigir evento_asignada_asignado si "el evento trae al asignado"
exigir entrante_en_api 200 "la bandeja API admite un mensaje entrante"
exigir evento_entrante si "sale message_created"
exigir evento_entrante_tipo incoming "el evento dice incoming"
exigir correos_enviados 0 "no se manda ningún correo con los avisos apagados"
exigir control_correo si "control: con el aviso encendido, el mismo paso sí manda correo"
exigir eventos_de_lo_real 0 "lo de la cuenta real no llega al webhook de prueba"
exigir adopta si "POST /users adopta por correo: la regla de example.test hace falta"
exigir suspender 200 "se suspende con el token de la app"
exigir suspendida si "la cuenta queda suspendida"
exigir token_revocado 401 "con el token revocado ya no entra"
exigir real_activa si "la cuenta real sigue activa"
echo "(sin exigir) entrante en una bandeja de correo: $(h entrante_en_correo) · su usuario sobre la cuenta suspendida: $(h servicio_suspendida)"
if [ "$(grep -c '^HECHO' "$F")" = 0 ]; then echo "--- la sonda no llegó a imprimir:"; tail -n 15 "$F" | cut -c1-170; fi
grep -n -E 'Error|error' "$F" | grep -v HECHO | head -5 | cut -c1-170
echo "fallas: $FALLAS"
[ "$FALLAS" = 0 ]
