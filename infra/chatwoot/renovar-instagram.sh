#!/usr/bin/env bash
# infra/chatwoot/renovar-instagram.sh — renovación diaria del token de Instagram (SDD-0583).
#
# Chatwoot 4.19.1 renueva el token de Instagram solo cuando alguien lo lee:
# `Channel::Instagram#access_token` llama a `Instagram::RefreshOauthTokenService`, que renueva si
# el token está vigente, tiene 24 h o más desde `updated_at` y vence en menos de 10 días. Ningún
# job lo lee a diario: solo el primer mensaje de una persona nueva, un envío desde Chatwoot y la
# respuesta a una historia. Si vence, Instagram se apaga sin aviso. Este guion, con su timer
# diario (systemd/chatwoot-instagram-token.timer), lo lee en el contenedor de rails:
# `Channel::Instagram.find_each(&:access_token)`, canal por canal.
#
# El servicio de Chatwoot se traga el error de la renovación (`rescue StandardError` y devuelve
# el token viejo), así que una renovación fallida no sale como error: se mide con `expires_at`
# antes y después. El resultado es `falla` si:
#   · el contenedor de rails no corre o `rails runner` sale distinto de 0;
#   · la salida no trae el resumen o el resumen no cuadra con los canales;
#   · leer el token lanzó una excepción en algún canal;
#   · a algún canal le quedan menos de UMBRAL_INSTAGRAM_DIAS (10) días después de intentarlo.
# Escribe el estado en --estado (clave=valor; lo lee vigilar.sh) y sale 0 solo si es `ok`.
#
# Salida: solo conteos y fechas. La salida cruda de `rails runner` (Rails escribe sus logs en
# stdout, y pueden traer la respuesta de Instagram) no se imprime ni se guarda en disco: se
# queda en memoria y solo se leen las líneas marcadas `DTDIG`. Nunca el token ni datos de personas.
#
# Uso:
#   renovar-instagram.sh [--project chatwoot] [--estado /var/lib/chatwoot-vigilancia/instagram-token.estado]
set -uo pipefail

PROJECT="chatwoot"
ESTADO="/var/lib/chatwoot-vigilancia/instagram-token.estado"
U_DIAS="${UMBRAL_INSTAGRAM_DIAS:-10}"

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --estado) ESTADO="$2"; shift 2 ;;
    -h|--help) sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "renovar-instagram: opción desconocida: $1" >&2; exit 2 ;;
  esac
done

# Ruby plano: corre igual en `rails runner` y en la prueba con dobles. Una línea por canal con
# su id y las fechas en segundos, y un resumen al final. Ni el token ni el mensaje del error.
read -r -d '' RUBY <<'RUBY'
$stdout.sync = true
n = 0
Channel::Instagram.find_each do |c|
  n += 1
  antes = c.expires_at.to_i
  error = 0
  begin
    c.access_token
  rescue StandardError
    error = 1
  end
  c.reload
  puts "DTDIG canal=#{c.id.to_i} antes=#{antes} despues=#{c.expires_at.to_i} error=#{error}"
end
puts "DTDIG fin canales=#{n}"
RUBY

CANALES=0; RENOVADOS=0; FALLAS=0; BAJO=0; VENCE_MIN=""; MOTIVO=""
id="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=rails" | head -n 1)"
if [ -z "$id" ]; then
  MOTIVO="rails no corre"
else
  SALIDA="$(timeout 600 docker exec "$id" bundle exec rails runner "$RUBY" 2>&1)"; rc=$?
  AHORA="$(date +%s)"
  if [ "$rc" != 0 ]; then
    MOTIVO="rails runner salió $rc"
  else
    FIN="$(printf '%s\n' "$SALIDA" | sed -n 's/^DTDIG fin canales=\([0-9][0-9]*\)$/\1/p' | tail -n 1)"
    lineas=0
    while IFS= read -r l; do
      [[ "$l" =~ ^DTDIG\ canal=([0-9]+)\ antes=([0-9]+)\ despues=([0-9]+)\ error=([01])$ ]] || continue
      lineas=$((lineas + 1)); antes="${BASH_REMATCH[2]}"; despues="${BASH_REMATCH[3]}"
      [ "${BASH_REMATCH[4]}" = 1 ] && FALLAS=$((FALLAS + 1))
      [ "$despues" -gt "$antes" ] && RENOVADOS=$((RENOVADOS + 1))
      [ $((despues - AHORA)) -lt $((U_DIAS * 86400)) ] && BAJO=$((BAJO + 1))
      if [ -z "$VENCE_MIN" ] || [ "$despues" -lt "$VENCE_MIN" ]; then VENCE_MIN="$despues"; fi
    done <<<"$SALIDA"
    if [ -z "$FIN" ]; then
      MOTIVO="sin resumen de rails runner"
    elif [ "$FIN" != "$lineas" ]; then
      MOTIVO="el resumen dice $FIN canales y llegaron $lineas"
    else
      CANALES="$FIN"
      [ "$FALLAS" -gt 0 ] && MOTIVO="$FALLAS canal(es) con error al leer el token"
      [ "$BAJO" -gt 0 ] && MOTIVO="${MOTIVO:+$MOTIVO y }$BAJO canal(es) con menos de $U_DIAS días"
    fi
  fi
  unset SALIDA
fi
AHORA="${AHORA:-$(date +%s)}"

RESULTADO=ok; [ -n "$MOTIVO" ] && RESULTADO=falla
iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
VENCE_ISO=""; DIAS_MIN=""
if [ -n "$VENCE_MIN" ]; then VENCE_ISO="$(iso "$VENCE_MIN")"; DIAS_MIN=$(((VENCE_MIN - AHORA) / 86400)); fi

# Se escribe al lado y se mueve: vigilar.sh nunca lee un estado a medias.
mkdir -p "$(dirname "$ESTADO")" || exit 3
TMP="$(mktemp "$ESTADO.XXXXXX")" || exit 3
{
  echo "ts=$(iso "$AHORA")"
  echo "ts_epoch=$AHORA"
  echo "resultado=$RESULTADO"
  echo "motivo=$MOTIVO"
  echo "canales=$CANALES"
  echo "renovados=$RENOVADOS"
  echo "fallas=$FALLAS"
  echo "bajo_umbral=$BAJO"
  echo "vence_min=$VENCE_ISO"
  echo "vence_min_epoch=$VENCE_MIN"
  echo "dias_min=$DIAS_MIN"
} >"$TMP" && chmod 644 "$TMP" && mv -f "$TMP" "$ESTADO" || { rm -f "$TMP"; echo "renovar-instagram: no se pudo escribir $ESTADO" >&2; exit 3; }

echo "renovar-instagram: $RESULTADO${MOTIVO:+ · $MOTIVO} · canales=$CANALES renovados=$RENOVADOS fallas=$FALLAS vence_min=${VENCE_ISO:--} dias_min=${DIAS_MIN:--}"
[ "$RESULTADO" = ok ]
