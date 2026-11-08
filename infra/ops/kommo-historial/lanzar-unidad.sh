#!/usr/bin/env bash
# infra/ops/kommo-historial/lanzar-unidad.sh — lanza el ensayo o la carga del Archivo Kommo como unidad de systemd,
# con su vigía (SDD-0590 §10.18). Corre en el VPS, como root. Reemplaza los lanzadores de una sola noche del
# 2026-11-07 (lanzar-ensayo-v3.sh y lanzar-carga-57.sh, fuera del repo).
#
#   bash lanzar-unidad.sh --unidad kommo-e5-ensayo --dir /srv/ops/kommo-historial-ensayo \
#     --env CARGA=/dev/shm/kommo-e5-carga/carga.ndjson --env INFORME_CARGA=… --env STAGING=/dev/shm/kommo-e5-carga \
#     -- /bin/bash /srv/ops/kommo-historial-ensayo/ensayo-archivo.sh
#   La carga (5.7) no tiene guion en el repo: la de la noche del 2026-11-07 fue carga-57-remoto.sh, de una sola
#   corrida, fuera del repo. Sus pasos son los del cargador de Rails del README. Una carga nueva se lanza con
#   --unidad kommo-e5-carga y el comando de su propio guion, revisado en su PR.
#
#   Secretos: el token nunca va por --env, porque --setenv queda en Environment= y lo muestra `systemctl show`.
#   El lanzador niega las claves con TOKEN, SECRET, PASSWORD, CLAVE o KEY (código 2). El token se lee de su
#   archivo 0600.
#
# Qué fija, para las dos:
#   · TimeoutStopSec de 600 s (TIMEOUT_STOP_S): si la paran, la limpieza tiene tiempo. Con los 90 s por defecto,
#     systemd la mataría con KILL a mitad. El ensayo exige 300 o más y, si no, no arranca (código 5);
#   · Nice 10 y la carpeta de trabajo;
#   · su vigía, <unidad>-vigia, con el vigia-carga.sh de la carpeta y el tope pedido (--tope-vigia, 8 por defecto).
#     Si el vigía no arranca, para la unidad y sale con 7: nunca corre sin vigía;
#     El vigía para con `systemctl stop`: el TERM le llega a toda la unidad, y el paso en curso termina enseguida.
#     Un TERM solo al proceso principal (`systemctl kill --kill-whom=main`) espera a que termine el paso;
#   · nunca dos a la vez: si ya corre el ensayo o la carga, se niega (código 6).
#
# Códigos: 0 lanzada; 2 uso, carpeta mala o un secreto en --env; 6 ya corre una de las dos; 7 no arrancó el vigía y
# se paró la unidad; otro, el de systemd-run.
# Imprime las huellas (sha256, 16 caracteres) de lo que va a correr, para compararlas con las de la rama.
set -uo pipefail

readonly TIMEOUT_STOP_S=600
UNIDAD=""
CARPETA=""
TOPE_VIGIA=8
VIGIA=1
ENTORNO=()
uso() { echo "uso: lanzar-unidad.sh --unidad kommo-e5-ensayo|kommo-e5-carga --dir <carpeta> [--env CLAVE=valor]... [--tope-vigia N] [--sin-vigia] -- <comando>..." >&2; exit 2; }
# Una opción con valor, al final y sin él: `shift 2` fallaría sin mover nada, y el while giraría para siempre.
pide_valor() { [ "$1" -ge 2 ] || uso; }
while [ $# -gt 0 ]; do
  case "$1" in
    --unidad) pide_valor $#; UNIDAD="$2"; shift 2 ;;
    --dir) pide_valor $#; CARPETA="$2"; shift 2 ;;
    --env)
      pide_valor $#
      case "$2" in [A-Z_]*=*) ;; *) echo "--env pide CLAVE=valor" >&2; exit 2 ;; esac
      # El token nunca va por --env: se vería en `systemctl show` (Environment=). No se imprime el valor.
      case "${2%%=*}" in *TOKEN* | *SECRET* | *PASSWORD* | *CLAVE* | *KEY*)
        echo "--env no lleva secretos: ${2%%=*} se vería en systemctl show. El token se lee de su archivo 0600" >&2; exit 2 ;;
      esac
      ENTORNO+=(--setenv="$2"); shift 2 ;;
    --tope-vigia) pide_valor $#; TOPE_VIGIA="$2"; shift 2 ;;
    --sin-vigia) VIGIA=0; shift ;;
    --) shift; break ;;
    *) uso ;;
  esac
done
[ $# -gt 0 ] || uso
case "$UNIDAD" in
  kommo-e5-ensayo | kommo-e5-carga) ;;
  *) echo "unidad desconocida: «$UNIDAD» (solo kommo-e5-ensayo o kommo-e5-carga)" >&2; exit 2 ;;
esac
[ -d "$CARPETA" ] || { echo "no existe la carpeta $CARPETA" >&2; exit 2; }
CARPETA="$(cd "$CARPETA" && pwd)"
case "$TOPE_VIGIA" in '' | *[!0-9.]*) echo "--tope-vigia pide un número: $TOPE_VIGIA" >&2; exit 2 ;; esac
if [ "$VIGIA" = 1 ] && [ ! -r "$CARPETA/vigia-carga.sh" ]; then
  echo "falta $CARPETA/vigia-carga.sh (o --sin-vigia)" >&2; exit 2
fi

# Nunca el ensayo y la carga a la vez, ni dos veces la misma.
if systemctl is-active --quiet kommo-e5-ensayo.service || systemctl is-active --quiet kommo-e5-carga.service; then
  echo "PARO: ya corre $(systemctl is-active --quiet kommo-e5-ensayo.service && echo kommo-e5-ensayo || echo kommo-e5-carga); no se lanza $UNIDAD" >&2
  exit 6
fi

echo "== $UNIDAD · $(date -u +%FT%TZ) · carpeta $CARPETA"
echo "carga=$(cut -d' ' -f1-3 /proc/loadavg) mem=$(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo)MB"
echo "huellas:"
(cd "$CARPETA" && find . -maxdepth 2 -type f \( -name '*.sh' -o -name '*.rb' -o -name '*.py' -o -name '*.sql' \) \
  ! -name 'evidencia-*' -print | sort | while read -r f; do echo "  $(sha256sum "$f" | cut -c1-16) ${f#./}"; done)
systemctl reset-failed "$UNIDAD.service" "$UNIDAD-vigia.service" 2>/dev/null

systemd-run --quiet --unit "$UNIDAD" -p "TimeoutStopSec=${TIMEOUT_STOP_S}s" -p Nice=10 -p WorkingDirectory="$CARPETA" \
  "${ENTORNO[@]}" "$@" || { rc=$?; echo "systemd-run no pudo lanzar $UNIDAD (código $rc)" >&2; exit "$rc"; }
echo "lanzada $UNIDAD (TimeoutStopSec ${TIMEOUT_STOP_S} s, Nice 10)"
if [ "$VIGIA" = 1 ]; then
  if ! systemd-run --quiet --unit "$UNIDAD-vigia" -p WorkingDirectory="$CARPETA" /bin/bash "$CARPETA/vigia-carga.sh" "$UNIDAD" "$TOPE_VIGIA"; then
    echo "PARO: no arrancó $UNIDAD-vigia; se para $UNIDAD, que no corre sin vigía (código 7)" >&2
    systemctl stop "$UNIDAD.service"
    exit 7
  fi
  echo "lanzado $UNIDAD-vigia (tope $TOPE_VIGIA)"
fi
