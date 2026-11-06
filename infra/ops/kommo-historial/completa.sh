#!/usr/bin/env bash
# Completa hasta el corte de E5 (SDD-0590 §10.1 y §10.12; handoff 0590-e5-estado §5.3). La lanza el timer
# kommo-e5-completa en el VPS, desde /srv/ops/kommo-historial-0590b.
#
# Guardas al arrancar, antes de pedirle nada a Kommo:
#   · el token /dev/shm/k0582-e5 existe, tiene permisos 600 y más de 200 bytes, y su borrado programado
#     (kommo-e5-token-caduca.timer) sigue activo y por disparar. Si el timer no está o ya disparó, sale (código 11).
#     La vida del token la fija un solo plazo, el de ese timer (Director General, 2026-11-06);
#   · la carga del VPS no pasa de 8 (código 12);
#   · el extractor desplegado entiende --adjuntos-para-carga, o sea, es la 1.3.0 o posterior (código 13). Si no,
#     extraer fallaría por la opción y, al terminar, se borraría el token sin haber bajado nada.
# Baja los adjuntos para el Archivo Kommo (5.5b, --adjuntos-para-carga): cifrados para el respaldo y, además, en
# claro en el staging (tmpfs, 0600) para el cargador.
# Al terminar extraer (bien o mal) borra el token y para su timer. Si la paran (el vigía, por carga), el token
# queda para reanudar con el mismo CORTE (CORTE=... bash completa.sh), mientras su timer siga activo.
# Deja en ESTADO solo códigos, fechas, el corte y datos del token (permisos, bytes, edad). Nunca el token.
#
# Las variables COMPLETA_* existen solo para pruebas/prueba-completa.sh, con un token y un timer falsos. En el VPS
# el timer no pasa ninguna y valen los valores de abajo.
set -uo pipefail
TOKEN="${COMPLETA_TOKEN:-/dev/shm/k0582-e5}"
TIMER="${COMPLETA_TIMER:-kommo-e5-token-caduca.timer}"
AQUI="${COMPLETA_AQUI:-/srv/ops/kommo-historial-0590b}"
ESTADO="${COMPLETA_ESTADO:-/srv/backups/kommo/completa-0590.estado}"
CARGA_DE="${COMPLETA_CARGA_DE:-/proc/loadavg}"
ESPERA="${COMPLETA_ESPERA:-30}"
umask 077
estado() { echo "$*" >>"$ESTADO"; echo "$*"; }

estado "== corrida $(date -u +%FT%TZ)"
if [ ! -f "$TOKEN" ]; then estado "token=ausente"; estado "codigo=11"; exit 11; fi
perm="$(stat -c %a "$TOKEN")"
bytes="$(stat -c %s "$TOKEN")"
edad=$(( $(date +%s) - $(stat -c %Y "$TOKEN") ))
# El borrado programado: activo y esperando su disparo (SubState=waiting), sea OnCalendar o --on-active. Un timer
# que ya disparó queda descargado o inactive (medido con systemd 255), o en running mientras corre su borrado.
borrado="$(systemctl is-active "$TIMER" 2>/dev/null)"
subestado="$(systemctl show -p SubState --value "$TIMER" 2>/dev/null)"
estado "token_permisos=$perm token_bytes=$bytes token_edad_s=$edad borrado_programado=${borrado:-ausente}/${subestado:-ausente}"
if [ "$perm" != 600 ] || [ "$bytes" -le 200 ] || [ "$borrado" != active ] || [ "$subestado" != waiting ]; then
  estado "token=no_valido: no se pide nada a Kommo"; estado "codigo=11"; exit 11
fi
carga="$(cut -d' ' -f1 "$CARGA_DE")"
estado "carga_inicio=$carga"
if awk -v c="$carga" 'BEGIN { exit !(c > 8) }'; then estado "carga=alta: no arranca"; estado "codigo=12"; exit 12; fi
# La ayuda se guarda antes de mirarla: con pipefail, un `| grep -q` cortaría la salida y daría un falso «no».
ayuda="$(python3 -I "$AQUI/respaldar-historial.py" extraer --help 2>/dev/null)"
case "$ayuda" in
  *--adjuntos-para-carga*) estado "extractor=entiende_adjuntos_para_carga" ;;
  *) estado "extractor=sin_adjuntos_para_carga: no se pide nada a Kommo"; estado "codigo=13"; exit 13 ;;
esac

CORTE="${CORTE:-$(date -u +%Y-%m-%dT%H:00:00Z)}"
sleep "$ESPERA" # el corte tiene que estar en el pasado
estado "corte=$CORTE"

parada() { estado "parada=$(date -u +%FT%TZ) (señal: el token queda para reanudar con CORTE=$CORTE)"; estado "codigo=143"; exit 143; }
trap parada TERM INT
python3 -I "$AQUI/respaldar-historial.py" extraer --token-file "$TOKEN" --corte "$CORTE" --sondear-huecos -1 \
  --adjuntos-para-carga --staging /dev/shm/kommo-e5-carga --destino /srv/backups/kommo --pausa 0.5 \
  --log /srv/backups/kommo/respaldo.log &
wait "$!"
rc=$?
trap - TERM INT
estado "fin=$(date -u +%FT%TZ) extraer_codigo=$rc"
rm -f "$TOKEN"
systemctl stop "$TIMER" 2>/dev/null
estado "token=$([ -e "$TOKEN" ] && echo presente || echo borrado) borrado_programado=$(systemctl is-active "$TIMER" 2>/dev/null)"
estado "codigo=$rc"
exit "$rc"
