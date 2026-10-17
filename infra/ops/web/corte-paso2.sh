#!/usr/bin/env bash
# Paso 2 del corte de DTD Cargo: la web de Vercel al VPS (SDD-0505, runbook
# servidor-contabo §3.6, jueves 15). Un subcomando por fila del guion, para no
# teclear nada a mano en la ventana:
#
#   corte-paso2.sh previo    # T−10: todo listo y nada cambiado
#   corte-paso2.sh dns       # T+1…5: espera a que los autoritativos den la IP del VPS
#   corte-paso2.sh router    # T+5: web en dtdcargo.com (sin compose.ensayo.yml) + certificado + smoke
#   corte-paso2.sh cron      # T+15, DESPUÉS de pausar Vercel: cron arriba + dos drains a mano
#   corte-paso2.sh cierre    # T+30: retira compose.ensayo.yml
#
# Cada corrida deja su salida en /srv/ops/evidencias/corte-paso2-<subcomando>-<hora>.txt.
# No imprime secretos. Rollback: DNS de vuelta a Vercel (lo hace Sam) y
# `corte-paso2.sh cron-stop` si el cron ya estaba arriba.
set -uo pipefail

IP=217.216.54.70
DIR=/srv/dtd-cargo
NS="athena.dns-parking.com apollo.dns-parking.com"
SMOKE=/srv/ops/web/smoke-web.sh
C=(docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml)
MODO="${1:-}"
[ -n "$MODO" ] || { sed -n '2,15p' "$0"; exit 2; }
EVID="/srv/ops/evidencias/corte-paso2-${MODO}-$(date -u +%Y%m%dT%H%M%SZ).txt"
exec > >(tee -a "$EVID") 2>&1
echo "== corte-paso2 ${MODO} · $(date -u +%Y-%m-%dT%H:%M:%SZ) · evidencia ${EVID}"
cd "$DIR"

web_id() { docker ps -q --filter label=com.docker.compose.project=dtd-cargo --filter label=com.docker.compose.service=web; }
esperar_web() {
  local id st=""; id=$(web_id)
  for _ in $(seq 1 60); do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null); [ "$st" = healthy ] && break; [ "$st" = unhealthy ] && break; sleep 2
  done
  echo "web: ${st:-sin contenedor} · $(docker inspect -f '{{.Config.Image}} reinicios={{.RestartCount}}' "$id" 2>/dev/null)"
  [ "$st" = healthy ]
}
dns_vps() { # 0 si los dos autoritativos dan la IP del VPS para dtdcargo.com
  local ok=0 n a
  for n in $NS; do
    a=$(dig +short +norec dtdcargo.com A @"$n" | tr '\n' ' ')
    echo "  $n → ${a:-vacío} (serial $(dig +short +norec dtdcargo.com SOA @"$n" | awk '{print $3}'))"
    [ "$(echo $a)" = "$IP" ] || ok=1
  done
  return $ok
}
router_actual() { docker inspect -f '{{index .Config.Labels "traefik.http.routers.dtd-cargo-web.rule"}}' "$(web_id)"; }

case "$MODO" in
  previo)
    echo "-- servicios de dtd-cargo"; docker ps --filter label=com.docker.compose.project=dtd-cargo --format '{{.Names}} {{.Status}}' | sort
    echo "-- imagen fijada: $(grep '^DTD_WEB_IMAGE=' .env | cut -d= -f2-)"
    echo "-- router del web: $(router_actual)"
    echo "-- override del ensayo: $([ -f compose.ensayo.yml ] && echo presente || echo AUSENTE)"
    echo "-- compose.yml con www → 301 a la raíz: $(grep -q 'www-a-raiz.redirectregex' compose.yml && echo sí || echo 'NO (copiar infra/dtd-cargo/compose.yml de main)')"
    echo "-- imagen del cron: $(docker images dtd-cargo-cron:local --format '{{.ID}} {{.CreatedSince}}' | head -1)"
    echo "-- cron corriendo: $(docker ps -q --filter label=com.docker.compose.project=dtd-cargo --filter label=com.docker.compose.service=cron | wc -l) (debe ser 0)"
    vac=$(grep -E "^[A-Z_][A-Z0-9_]*=(''|\"\")?$" .env | cut -d= -f1)
    malas=""; for v in $vac; do grep -qE "\\\$\\{${v}:-" compose*.yml || malas="$malas $v"; done
    echo "-- vacías en .env fuera de \${X:-} de los compose: ${malas:-ninguna}"
    echo "-- DNS de dtdcargo.com hoy:"; dns_vps && echo "  (ya apunta al VPS)" || echo "  (todavía en Vercel: correcto antes de T+0)"
    /srv/ops/web/telegram-webhook.sh info
    "$SMOKE" --host nuevo.dtdcargo.com
    ;;
  dns)
    for i in $(seq 1 45); do
      echo "-- intento $i · $(date -u +%H:%M:%SZ)"
      if dns_vps; then echo "LISTO: los dos autoritativos dan ${IP}"; exit 0; fi
      sleep 20
    done
    echo "15 min y los autoritativos no dan ${IP}: revisar el registro en Hostinger"; exit 1
    ;;
  router)
    if [ "${2:-}" != "--forzar" ]; then
      dns_vps || { echo "NO: el DNS todavía no apunta al VPS; el certificado fallaría (usar --forzar solo si se sabe por qué)"; exit 1; }
    fi
    grep -q 'www-a-raiz.redirectregex' compose.yml || echo "AVISO: compose.yml sin el middleware www → raíz: www servirá la app sin redirigir"
    echo "-- antes: $(router_actual)"
    "${C[@]}" up -d --no-deps web 2>&1 | tail -2
    esperar_web || { echo "el web no quedó healthy"; exit 1; }
    echo "-- después: $(router_actual)"
    curl -s -o /dev/null -k --resolve dtdcargo.com:443:127.0.0.1 https://dtdcargo.com/robots.txt || true
    for _ in $(seq 1 30); do
      docker logs --since 3m ops-traefik-traefik-1 2>&1 | grep -q 'Server responded with a certificate.*dtdcargo.com' && break; sleep 2
    done
    docker logs --since 3m ops-traefik-traefik-1 2>&1 | grep -iE 'acme|certificate|unable' | grep -v '^{' | tail -4
    "$SMOKE" --host dtdcargo.com --www
    ;;
  cron)
    "${C[@]}" up -d --no-deps cron 2>&1 | tail -2
    sleep 3
    id=$(docker ps -q --filter label=com.docker.compose.project=dtd-cargo --filter label=com.docker.compose.service=cron)
    [ -n "$id" ] || { echo "el cron no arrancó"; exit 1; }
    docker logs "$id" 2>&1 | grep '\[cron\]' | tail -2
    for r in client-notifications-drain push-drain; do
      echo "-- a mano: /api/cron/$r → $(docker exec "$id" sh -c "curl -s -o /dev/null -w '%{http_code}' --max-time 120 -H \"Authorization: Bearer \$CRON_SECRET\" http://web:3000/api/cron/$r")"
    done
    ;;
  cron-stop)
    "${C[@]}" stop cron 2>&1 | tail -1
    ;;
  cierre)
    [ "$(router_actual | grep -c 'Host(`dtdcargo.com`)')" = 1 ] || { echo "el router todavía no está en dtdcargo.com: no se retira el override"; exit 1; }
    install -d -m 700 /srv/ops/evidencias/ensayo-web
    mv compose.ensayo.yml "/srv/ops/evidencias/ensayo-web/compose.ensayo.yml.retirado-$(date -u +%Y%m%dT%H%M%SZ)"
    echo "-- override del ensayo retirado; router: $(router_actual)"
    echo "-- falta: Sam borra el registro A nuevo en Hostinger"
    ;;
  *) echo "subcomando desconocido: $MODO"; exit 2 ;;
esac
