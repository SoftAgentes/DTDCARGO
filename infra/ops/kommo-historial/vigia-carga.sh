#!/usr/bin/env bash
# Vigía de carga de las corridas de E5 (SDD-0590): para la unidad si la carga de 1 minuto pasa del tope.
# Se informa a sí mismo cada 10 minutos para que se vea que sigue vivo.
#   systemd-run --unit kommo-e5-vigia --collect bash /srv/ops/kommo-historial-0590b/vigia-carga.sh <unidad> [tope]
u="${1:?falta la unidad}"
tope="${2:-8}"
i=0
echo "$(date -u +%FT%TZ) vigía de $u: arranca, tope $tope"
# Si arranca a la misma hora que la unidad, la espera hasta 3 minutos en vez de salir de inmediato.
for _ in $(seq 1 36); do systemctl is-active --quiet "$u" && break; sleep 5; done
systemctl is-active --quiet "$u" || { echo "$(date -u +%FT%TZ) vigía: $u no arrancó en 3 minutos"; exit 0; }
echo "$(date -u +%FT%TZ) vigía: $u activa, empieza a vigilar"
while systemctl is-active --quiet "$u"; do
  c="$(cut -d' ' -f1 /proc/loadavg)"
  if awk -v c="$c" -v t="$tope" 'BEGIN { exit !(c > t) }'; then
    echo "$(date -u +%FT%TZ) carga $c por encima de $tope: se para $u"
    systemctl stop "$u"
  fi
  i=$((i + 1))
  [ $((i % 20)) = 0 ] && echo "$(date -u +%FT%TZ) vigía: $u sigue, carga $c"
  sleep 30
done
echo "$(date -u +%FT%TZ) vigía: $u ya no está activa"
