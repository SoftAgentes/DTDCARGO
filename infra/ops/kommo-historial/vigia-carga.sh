#!/usr/bin/env bash
# Vigía de las corridas de E5 (SDD-0590): para la unidad (systemctl stop, que le manda TERM; completa.sh sale con
# 143 y deja el token para reanudar) si
#   · la carga sostenida pasa del tope (8 por defecto): la de 5 minutos por encima del tope, o un pico de 1 minuto
#     por encima del doble. Con sar, de 05 a 11Z, la de 1 minuto pasó de 8 en hasta 6 de 36 lecturas por noche y la
#     de 5 minutos en 0 o 1 (2026-11-02 a -06): con la de 1 minuto sola, el vigía pararía casi seguro una completa
#     de 5 horas;
#   · /dev/shm pasa de VIGIA_SHM_TOPE_MB usados (5120), o
#   · MemAvailable baja de VIGIA_MEM_PISO_MB (6144),
# o si alguna de esas medidas no se puede leer. Los adjuntos en claro de la 5.5b viven en /dev/shm y se estimaron
# en ~2,1 GB: si salen más del doble, cambia el riesgo, y la condición de Sam es parar y preguntar (Director
# General, 2026-11-06). Se informa a sí mismo cada 20 vueltas para que se vea que sigue vivo.
#   systemd-run --unit kommo-e5-vigia --collect bash /srv/ops/kommo-historial-0590b/vigia-carga.sh <unidad> [tope]
#
# Las variables VIGIA_* existen para pruebas/prueba-vigia.sh, con medidas inyectadas. El timer del VPS no pasa
# ninguna y valen los valores de abajo.
u="${1:?falta la unidad}"
tope="${2:-8}"
CARGA_DE="${VIGIA_CARGA_DE:-/proc/loadavg}"
MEMINFO_DE="${VIGIA_MEMINFO_DE:-/proc/meminfo}"
SHM="${VIGIA_SHM:-/dev/shm}"
SHM_TOPE_MB="${VIGIA_SHM_TOPE_MB:-5120}"
MEM_PISO_MB="${VIGIA_MEM_PISO_MB:-6144}"
PAUSA="${VIGIA_PAUSA:-30}"
ESPERA_INICIO="${VIGIA_ESPERA_INICIO:-36}"
i=0
pico="$(awk -v t="$tope" 'BEGIN { print t * 2 }')"
echo "$(date -u +%FT%TZ) vigía de $u: arranca, tope de carga $tope a 5 minutos y $pico a 1 minuto, /dev/shm hasta $SHM_TOPE_MB MB, MemAvailable desde $MEM_PISO_MB MB"
# Si arranca a la misma hora que la unidad, la espera hasta 3 minutos en vez de salir de inmediato.
for _ in $(seq 1 "$ESPERA_INICIO"); do systemctl is-active --quiet "$u" && break; sleep 5; done
systemctl is-active --quiet "$u" || { echo "$(date -u +%FT%TZ) vigía: $u no arrancó en el tiempo de espera"; exit 0; }
echo "$(date -u +%FT%TZ) vigía: $u activa, empieza a vigilar"
entero() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }
while systemctl is-active --quiet "$u"; do
  c="$(cut -d' ' -f1 "$CARGA_DE" 2>/dev/null)"
  c5="$(cut -d' ' -f2 "$CARGA_DE" 2>/dev/null)"
  shm="$(df -Pm "$SHM" 2>/dev/null | awk 'NR == 2 { print $3 }')"
  mem="$(awk '/^MemAvailable:/ { print int($2 / 1024) }' "$MEMINFO_DE" 2>/dev/null)"
  motivo=""
  if ! awk -v c="$c" -v d="$c5" 'BEGIN { exit !(c ~ /^[0-9]+(\.[0-9]+)?$/ && d ~ /^[0-9]+(\.[0-9]+)?$/) }' \
     || ! entero "$shm" || ! entero "$mem"; then
    motivo="no se pudo medir (carga «$c» «$c5», /dev/shm «$shm» MB, MemAvailable «$mem» MB)"
  elif awk -v c="$c5" -v t="$tope" 'BEGIN { exit !(c > t) }'; then
    motivo="carga sostenida $c5 (5 minutos) por encima de $tope"
  elif awk -v c="$c" -v t="$pico" 'BEGIN { exit !(c > t) }'; then
    motivo="pico de carga $c (1 minuto) por encima de $pico"
  elif [ "$shm" -gt "$SHM_TOPE_MB" ]; then
    motivo="/dev/shm usa $shm MB, por encima de $SHM_TOPE_MB"
  elif [ "$mem" -lt "$MEM_PISO_MB" ]; then
    motivo="MemAvailable $mem MB, por debajo de $MEM_PISO_MB"
  fi
  if [ -n "$motivo" ]; then
    echo "$(date -u +%FT%TZ) $motivo: se para $u"
    systemctl stop "$u"
  fi
  i=$((i + 1))
  [ $((i % 20)) = 0 ] && echo "$(date -u +%FT%TZ) vigía: $u sigue, carga $c / $c5, /dev/shm $shm MB, MemAvailable $mem MB"
  sleep "$PAUSA"
done
echo "$(date -u +%FT%TZ) vigía: $u ya no está activa"
