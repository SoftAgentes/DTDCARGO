#!/usr/bin/env bash
# infra/ops/portal-historial/deshacer.sh — SDD-0586 10.7, PR 2c: la vuelta atrás dirigida de la carga P4 en el VPS
# (sub-paso 4.6b del runbook). Hermano de cargar.sh: corre deshacer-carga.rb con `docker exec` en el contenedor de
# Chatwoot y mueve contactos-conservados.ndjson entre el contenedor y la carpeta 0700 de E10.
#
#   DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=seco bash deshacer.sh
#   … MODO=borrar CONFIRMAR=no bash deshacer.sh   # el ensayo del DG: todo, y ROLLBACK
#   … MODO=borrar CONFIRMAR=si bash deshacer.sh   # el borrado permanente: lo corre Sam
#
# El orden (4.6b): este guion en seco → el desarme de Studio (supabase/cargas/portal-historial-deshacer/) → este guion
# en borrar, que recalcula los conservados y aborta si cambiaron.
#
# Antes de tocar Chatwoot, mira en Studio, en SOLO LECTURA, que chatwoot_portal no esté encendido ni se haya
# encendido alguna vez para el tenant (feature_flags y entity_audit_log, la misma guarda que el desarme de E10). Si
# no lo puede comprobar, no corre.
#
# Cómo, igual que cargar.sh:
#   · MODO=seco: el .rb escribe /dev/shm/portal-historial/contactos-conservados.ndjson en el contenedor (tmpfs, 0700);
#     `docker exec … cat` lo trae a un .parcial del VPS, se comprueba (cabecera, sin barras invertidas), se renombra y
#     queda en 0600. Solo lleva ids;
#   · MODO=borrar: el archivo del VPS entra por la entrada estándar de `docker exec -i`;
#   · el trap de EXIT borra /dev/shm/portal-historial y /tmp/deshacer-carga.rb del contenedor y el .parcial del VPS,
#     y lo comprueba: `HECHO contenedor_limpio=si|no`.
# Salida: solo líneas HECHO, con conteos. Códigos: 0 bien; 1 el .rb no dio deshacer=ok, el flag o el traslado; 2 uso o
# archivos; 4 el contenedor no quedó limpio.
set -uo pipefail
umask 077

DB_CW="${DB_CW:-chatwoot-rails-1}"
DB="${DB:-dtd-cargo-db-1}"
DIR=/dev/shm/portal-historial
C="$DIR/contactos-conservados.ndjson"
EN_CW_DIR=/dev/shm/portal-historial
EN_CW_C="$EN_CW_DIR/contactos-conservados.ndjson"
EN_CW_RB=/tmp/deshacer-carga.rb
AQUI="$(cd "$(dirname "$0")" && pwd)"
MODO="${MODO:-}"

mal() { echo "HECHO error=$1" >&2; exit "${2:-2}"; }
case "$MODO" in seco | borrar) ;; *) mal modo_tiene_que_ser_seco_o_borrar ;; esac
for n in "${CUENTA:-}" "${BANDEJA:-}"; do
  case "$n" in '' | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;; esac
done
printf '%s' "${TENANT:-}" | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || mal tenant_no_es_uuid
if [ "$MODO" = borrar ]; then
  case "${CONFIRMAR:-}" in si | no) ;; *) mal confirmar_tiene_que_ser_si_o_no ;; esac
  [ -s "$C" ] || mal sin_contactos_conservados_correr_el_seco_antes
  if grep -q '\\' "$C"; then mal barra_invertida_en_los_conservados; fi
else
  [ ! -e "$C" ] && [ ! -e "$C.parcial" ] || mal ya_hay_conservados_borrar_con_limpiar
fi
[ -r "$AQUI/deshacer-carga.rb" ] || mal sin_deshacer_carga_rb
docker inspect "$DB_CW" >/dev/null 2>&1 || mal sin_contenedor_de_chatwoot
docker inspect "$DB" >/dev/null 2>&1 || mal sin_contenedor_de_studio

# ── El flag, en Studio y en solo lectura ─────────────────────────────────────
studio() {
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$DB" \
    psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres -v tenant="$TENANT" -f -
}
flag="$(studio <<'SQL' 2>/dev/null
select case
  when to_regclass('public.entity_audit_log') is null or to_regclass('public.feature_flags') is null then 'sin_auditoria'
  when exists (select 1 from public.feature_flags f where f.tenant_id = :'tenant' and f.key = 'chatwoot_portal' and f.enabled) then 'encendido'
  else 'consultar' end;
SQL
)"
if [ "$flag" = consultar ]; then
  flag="$(studio <<'SQL' 2>/dev/null
select case when exists (
  select 1 from public.entity_audit_log a
  where a.tenant_id = :'tenant' and a.entity_type = 'feature_flag' and a.event_type = 'feature_flag_changed'
    and a.after_data ->> 'key' = 'chatwoot_portal' and a.after_data ->> 'enabled' = 'true'
) then 'alguna_vez' else 'apagado' end;
SQL
)"
fi
echo "HECHO flag=${flag:-ilegible}"
case "$flag" in
  apagado) ;;
  encendido) mal chatwoot_portal_encendido 1 ;;
  alguna_vez) mal chatwoot_portal_se_encendio_alguna_vez 1 ;;
  *) mal no_se_pudo_comprobar_el_flag 1 ;;
esac

# ── La carpeta del VPS ───────────────────────────────────────────────────────
mkdir -p -m 0700 "$DIR"
if [ -L "$DIR" ] || [ ! -d "$DIR" ] || [ ! -O "$DIR" ]; then mal la_carpeta_no_es_de_este_usuario; fi
chmod 0700 "$DIR"

limpio=no
limpiar_contenedor() {
  local rc=$?
  docker exec "$DB_CW" rm -rf -- "$EN_CW_DIR" "$EN_CW_RB" >/dev/null 2>&1
  rm -f -- "$C.parcial"
  if docker exec "$DB_CW" sh -c "test ! -e '$EN_CW_DIR' && test ! -e '$EN_CW_RB'" >/dev/null 2>&1; then
    limpio=si
  fi
  echo "HECHO contenedor_limpio=$limpio"
  if [ "$limpio" != si ]; then exit 4; fi
  exit "$rc"
}
trap limpiar_contenedor EXIT

docker cp "$AQUI/deshacer-carga.rb" "$DB_CW:$EN_CW_RB" >/dev/null || mal no_se_pudo_copiar_el_guion 1
docker exec "$DB_CW" install -d -m 0700 "$EN_CW_DIR" || mal no_se_pudo_crear_la_carpeta_en_el_contenedor 1

if [ "$MODO" = seco ]; then
  salida="$(docker exec -i -e MODO=seco -e TENANT="$TENANT" -e CUENTA="$CUENTA" -e BANDEJA="$BANDEJA" \
    -e CONSERVADOS="$EN_CW_C" "$DB_CW" bundle exec rails runner "$EN_CW_RB" </dev/null 2>&1)"
else
  salida="$(docker exec -i -e MODO=borrar -e TENANT="$TENANT" -e CUENTA="$CUENTA" -e BANDEJA="$BANDEJA" \
    -e CONFIRMAR="$CONFIRMAR" "$DB_CW" bundle exec rails runner "$EN_CW_RB" <"$C" 2>&1)"
fi
printf '%s\n' "$salida" | grep '^HECHO ' | tr -d '\r'
printf '%s\n' "$salida" | grep -qx 'HECHO deshacer=ok' || exit 1
[ "$MODO" = seco ] || exit 0

( umask 077; docker exec "$DB_CW" cat "$EN_CW_C" >"$C.parcial" ) 2>/dev/null || mal no_se_pudieron_traer_los_conservados 1
chmod 0600 "$C.parcial"
head -n 1 "$C.parcial" | grep -q '"tipo":"cabecera"' || mal conservados_sin_cabecera 1
if grep -q '\\' "$C.parcial"; then mal barra_invertida_en_los_conservados 1; fi
mv -f -- "$C.parcial" "$C"
chmod 0600 "$C"
echo "HECHO conservados=$C"
echo "HECHO conservados_lineas=$(wc -l <"$C" | tr -d ' ')"
