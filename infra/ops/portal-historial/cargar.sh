#!/usr/bin/env bash
# infra/ops/portal-historial/cargar.sh — SDD-0586 10.7 (P4), paso 3 de §10.5.10 en el VPS: el puente entre el
# contenedor de Chatwoot y la carpeta 0700 de E10. Corre el cargador de E5 (cargar-portal.rb) con `docker exec`, y
# trae los vínculos a /dev/shm/portal-historial/vinculos.ndjson, el nombre fijo que lee vincular.sh.
#
# Va entre extraer.sh y vincular.sh (README de esta carpeta):
#
#   DB_CW=chatwoot-rails-1 CUENTA=<n> BANDEJA=<CHATWOOT_INBOX_PORTAL_ID> AGENTE_SERVICIO=<user id> MODO=seco bash cargar.sh
#   DB_CW=chatwoot-rails-1 CUENTA=<n> BANDEJA=<CHATWOOT_INBOX_PORTAL_ID> AGENTE_SERVICIO=<user id> MODO=cargar bash cargar.sh
#
# Cómo (revisión del DG y Subdirector, 2026-11-08):
#   · el preparado (nombres y textos) entra por la entrada estándar de `docker exec -i`: NO se copia al contenedor;
#   · en el contenedor, el cargador escribe los vínculos (solo ids) en su /dev/shm/portal-historial (tmpfs, 0700);
#   · con MODO=cargar y `carga=ok`, `docker cp` los trae a un .parcial del VPS, se comprueban (cabecera y sin barras
#     invertidas, que vincular.sh rechaza), se renombran a vinculos.ndjson y quedan en 0600;
#   · el trap de EXIT borra, también si algo falla, /dev/shm/portal-historial y /tmp/cargar-portal.rb del contenedor
#     y el .parcial del VPS, y COMPRUEBA que en el contenedor no quedó nada: `HECHO contenedor_limpio=si|no`.
#
# Salida: solo las líneas HECHO del cargador (conteos) y las propias; nunca nombres ni textos. Códigos: 0 bien;
# 1 el cargador no dio carga=ok, o el traslado falló; 2 uso o archivos; 4 el contenedor no quedó limpio.
# No toca la base de Studio: eso es de extraer.sh y vincular.sh.
set -uo pipefail
umask 077

DB_CW="${DB_CW:-chatwoot-rails-1}"
DIR=/dev/shm/portal-historial
P="$DIR/preparado.ndjson"
V="$DIR/vinculos.ndjson"
EN_CW_DIR=/dev/shm/portal-historial
EN_CW_V="$EN_CW_DIR/vinculos.ndjson"
EN_CW_RB=/tmp/cargar-portal.rb
AQUI="$(cd "$(dirname "$0")" && pwd)"
MODO="${MODO:-}"

mal() { echo "HECHO error=$1" >&2; exit "${2:-2}"; }
cerrar() { chmod 0600 "$@"; } # los vínculos en el VPS: 0600, aunque solo lleven ids
case "$MODO" in seco | cargar) ;; *) mal modo_tiene_que_ser_seco_o_cargar ;; esac
for n in "${CUENTA:-}" "${BANDEJA:-}" "${AGENTE_SERVICIO:-}"; do
  case "$n" in '' | *[!0-9]*) mal cuenta_bandeja_o_agente_no_numerico ;; esac
done
[ -s "$P" ] || mal sin_preparado
[ ! -e "$V" ] && [ ! -e "$V.parcial" ] || mal ya_hay_vinculos_borrar_con_limpiar
[ -r "$AQUI/cargar-portal.rb" ] || mal sin_cargador
docker inspect "$DB_CW" >/dev/null 2>&1 || mal sin_contenedor_de_chatwoot

limpio=no
limpiar_contenedor() {
  local rc=$?
  docker exec "$DB_CW" rm -rf -- "$EN_CW_DIR" "$EN_CW_RB" >/dev/null 2>&1
  rm -f -- "$V.parcial"
  if docker exec "$DB_CW" sh -c "test ! -e '$EN_CW_DIR' && test ! -e '$EN_CW_RB'" >/dev/null 2>&1; then
    limpio=si
  fi
  echo "HECHO contenedor_limpio=$limpio"
  if [ "$limpio" != si ]; then exit 4; fi
  exit "$rc"
}
trap limpiar_contenedor EXIT

docker cp "$AQUI/cargar-portal.rb" "$DB_CW:$EN_CW_RB" >/dev/null || mal no_se_pudo_copiar_el_cargador 1
docker exec "$DB_CW" install -d -m 0700 "$EN_CW_DIR" || mal no_se_pudo_crear_la_carpeta_en_el_contenedor 1

salida="$(docker exec -i -e MODO="$MODO" -e CUENTA="$CUENTA" -e BANDEJA="$BANDEJA" -e AGENTE_SERVICIO="$AGENTE_SERVICIO" \
  -e CARGA=- -e VINCULOS="$EN_CW_V" "$DB_CW" bundle exec rails runner "$EN_CW_RB" <"$P" 2>&1)"
# Solo las HECHO: el resto de la salida de rails runner son Bundler y los logs de los inicializadores.
printf '%s\n' "$salida" | grep '^HECHO ' | tr -d '\r'
printf '%s\n' "$salida" | grep -qx 'HECHO carga=ok' || exit 1
[ "$MODO" = cargar ] || exit 0

docker cp "$DB_CW:$EN_CW_V" "$V.parcial" >/dev/null 2>&1 || mal no_se_pudo_traer_los_vinculos 1
cerrar "$V.parcial"
head -n 1 "$V.parcial" | grep -q '"tipo":"cabecera"' || mal vinculos_sin_cabecera 1
if grep -q '\\' "$V.parcial"; then mal barra_invertida_en_los_vinculos 1; fi
mv -f -- "$V.parcial" "$V"
cerrar "$V"
echo "HECHO vinculos=$V"
echo "HECHO vinculos_lineas=$(wc -l <"$V" | tr -d ' ')"
