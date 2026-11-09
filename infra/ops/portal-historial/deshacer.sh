#!/usr/bin/env bash
# infra/ops/portal-historial/deshacer.sh — SDD-0586 10.7, PR 2c: la vuelta atrás dirigida de la carga P4 en el VPS
# (sub-paso 4.6b del runbook). Hermano de cargar.sh: corre deshacer-carga.rb con `docker exec` en el contenedor de
# Chatwoot y mueve contactos-conservados.ndjson entre el contenedor y la carpeta 0700 de E10.
#
#   paso 1:  DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=seco bash deshacer.sh
#   paso 1b: DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=borrar CONFIRMAR=no bash deshacer.sh
#   paso 3:  DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=borrar CONFIRMAR=si bash deshacer.sh
#
# La secuencia de 4.6b (aprobada por el DG, 2026-11-09). Cada paso exige el .hecho del anterior:
#   1. MODO=seco                    lo corre el DG (no borra). Escribe contactos-conservados.ndjson y
#                                   chatwoot-seco.hecho;
#   (1b. MODO=borrar CONFIRMAR=no   opcional, el ensayo suelto del DG: ROLLBACK, no exige ni escribe .hecho;)
#   2. el ensayo de Studio de E10   lo corre el DG (rollback). Escribe studio-ensayo.hecho;
#   3. MODO=borrar CONFIRMAR=si     LO CORRE SAM (borrado permanente). Exige chatwoot-seco.hecho y studio-ensayo.hecho
#                                   con =ok, el mismo conservados_sha256 en los dos y en el sha256sum actual del
#                                   .ndjson, y el mismo tenant. Antes de borrar deja la copia durable (la (a) de Sam,
#                                   «si protegidos»): el .ndjson y los dos .hecho en /srv/ops/portal-historial/deshacer
#                                   (root 0700, archivos 0600, comparados). Si sale con 0, escribe chatwoot-borrar.hecho
#                                   en las dos copias. Antes de la transacción deja chatwoot-borrar.inicio en la
#                                   durable, que se retira solo con un ROLLBACK comprobado. Si ya hay un .hecho o un
#                                   .inicio sin cerrar, no corre otro MODO=borrar;
#   4. Studio con MODO=aplicar      LO CORRE SAM, de E10. Exige studio-ensayo.hecho y chatwoot-borrar.hecho;
#   5. limpiar.sh --cierre-4-6b     LO CORRE SAM, de E10: exige studio-aplicar.hecho y borra el .ndjson y los .hecho
#                                   de las dos copias.
# Los .hecho son una línea HECHO, en 0600, escritos con .parcial + mv, sin seguir enlaces, y solo llevan ids y hashes.
# El disco: nada antes del paso 3 lo toca. El paso 3 crea la copia durable con el .ndjson, chatwoot-seco.hecho y
# studio-ensayo.hecho ANTES de borrar, y suma chatwoot-borrar.hecho solo DESPUÉS del COMMIT (el .rb dio deshacer=ok
# después de confirmar). Si el paso 3 falla o aborta antes del COMMIT, la copia durable queda sin chatwoot-borrar.hecho:
# la borra limpiar.sh --abandono-4-6b (E10). El paso 4 suma studio-aplicar.hecho.
# El plazo (regla del DG): si el paso 4 no corre en 24 h desde el utc= de chatwoot-borrar.hecho, el DG avisa a Sam.
# La copia durable nunca se borra sin que el paso 4 haya salido con 0.
#
# Antes de tocar Chatwoot, mira en Studio, en SOLO LECTURA (DB explícita, sin valor por defecto): la fila del flag
# del tenant existe, no está encendido ni se encendió alguna vez, la cola no corrió, y los hilos del tenant tienen el
# espejo en esta bandeja. Si no lo puede comprobar, no corre.
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
DIR=/dev/shm/portal-historial
C="$DIR/contactos-conservados.ndjson"
EN_CW_DIR=/dev/shm/portal-historial
EN_CW_C="$EN_CW_DIR/contactos-conservados.ndjson"
EN_CW_RB=/tmp/deshacer-carga.rb
H_SECO="$DIR/chatwoot-seco.hecho"
H_ENSAYO="$DIR/studio-ensayo.hecho"
H_BORRAR="$DIR/chatwoot-borrar.hecho"
# La copia durable. DESHACER_DURABLE vale solo con DESHACER_PRUEBA=1 (la prueba de Actions), como en E10, y tiene
# que terminar en /deshacer. Sin eso, siempre /srv/ops/portal-historial/deshacer.
if [ "${DESHACER_PRUEBA:-}" = 1 ] && [ -n "${DESHACER_DURABLE:-}" ]; then
  DURABLE="$DESHACER_DURABLE"
else
  DURABLE=/srv/ops/portal-historial/deshacer
fi
AQUI="$(cd "$(dirname "$0")" && pwd)"
MODO="${MODO:-}"

mal() { echo "HECHO error=$1" >&2; exit "${2:-2}"; }
campo() { sed -n "s/.* $2=\([^ ]*\).*/\1/p" "$1" 2>/dev/null | head -n 1; } # campo archivo clave: de un .hecho
escribir_hecho() { # archivo línea: 0600, con .parcial + mv, sin seguir un enlace; la línea sale también por stdout
  [ -L "$1" ] || [ -L "$1.parcial" ] && mal hecho_es_un_enlace 1
  ( umask 077; printf '%s\n' "$2" >"$1.parcial" ) && chmod 0600 "$1.parcial" && mv -f -- "$1.parcial" "$1" || mal no_se_pudo_escribir_el_hecho 1
  printf '%s\n' "$2"
}
copiar_durable() { # archivos…: a la copia durable, 0600, comparados
  local f d
  install -d -m 0700 "$DURABLE" || mal no_se_pudo_crear_la_copia_durable 1
  if [ -L "$DURABLE" ] || [ ! -O "$DURABLE" ]; then mal la_copia_durable_no_es_de_este_usuario 1; fi
  for f in "$@"; do
    d="$DURABLE/$(basename "$f")"
    [ -L "$d" ] || [ -L "$d.parcial" ] && mal la_copia_durable_tiene_un_enlace 1
    ( umask 077; cp -- "$f" "$d.parcial" ) && chmod 0600 "$d.parcial" && mv -f -- "$d.parcial" "$d" || mal no_se_pudo_escribir_la_copia_durable 1
    cmp -s -- "$f" "$d" || mal la_copia_durable_no_coincide 1
  done
  echo "HECHO copia_durable=$DURABLE"
}
escribir_hecho_borrar() {
  escribir_hecho "$H_BORRAR" "HECHO chatwoot_borrar=ok conservados_sha256=$sha_actual tenant=$TENANT cuenta=$CUENTA bandeja=$BANDEJA fin=commit utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  copiar_durable "$H_BORRAR"
}
case "$MODO" in seco | borrar) ;; *) mal modo_tiene_que_ser_seco_o_borrar ;; esac
# DB sin valor por defecto: con la base equivocada (staging, otra), la guarda del flag no vería nada (revisión del DG).
[ -n "${DB:-}" ] || mal falta_db
# Sin ceros a la izquierda: Ruby leería «010» en octal (N6).
for n in "${CUENTA:-}" "${BANDEJA:-}"; do
  case "$n" in '' | 0[0-9]* | *[!0-9]*) mal cuenta_o_bandeja_no_numerica ;; esac
done
printf '%s' "${TENANT:-}" | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || mal tenant_no_es_uuid
case "$DURABLE" in /*/deshacer) ;; *) mal la_copia_durable_tiene_que_terminar_en_deshacer ;; esac
if [ "$MODO" = borrar ]; then
  case "${CONFIRMAR:-}" in si | no) ;; *) mal confirmar_tiene_que_ser_si_o_no ;; esac
  # La evidencia de un borrado anterior nunca se borra (revisión del DG de la #480, B1): con un chatwoot-borrar.hecho o
  # un chatwoot-borrar.inicio sin cerrar en la copia durable, o un chatwoot-borrar.hecho en tmpfs, no corre otro
  # MODO=borrar, ni siquiera con CONFIRMAR=no. Lo resuelve el runbook.
  if [ -e "$DURABLE/chatwoot-borrar.hecho" ] || [ -e "$DURABLE/chatwoot-borrar.inicio" ] || [ -e "$H_BORRAR" ]; then
    mal ya_hay_un_borrado_en_la_copia_durable
  fi
  [ -s "$C" ] || mal sin_contactos_conservados_correr_el_seco_antes
  if grep -q '\\' "$C"; then mal barra_invertida_en_los_conservados; fi
else
  [ ! -e "$C" ] && [ ! -e "$C.parcial" ] || mal ya_hay_conservados_borrar_con_limpiar
  rm -f -- "$H_SECO"
fi
[ -r "$AQUI/deshacer-carga.rb" ] || mal sin_deshacer_carga_rb
docker inspect "$DB_CW" >/dev/null 2>&1 || mal sin_contenedor_de_chatwoot
docker inspect "$DB" >/dev/null 2>&1 || mal sin_contenedor_de_studio

# ── El flag, la cola y el espejo, en Studio y en solo lectura ────────────────
# La misma guarda que el desarme de E10 (deshacer-vinculos.sql), más el espejo: la cola usa los mismos prefijos dtd: y
# dtd-portal:, así que esto es lo único que separa un mensaje real de la cola de uno cargado (revisión del DG, B1).
#   · la fila de chatwoot_portal del tenant existe (la 0519 la siembra para todos): si no, TENANT o DB no son los de la
#     carga;
#   · el flag no está encendido, ni se encendió alguna vez (entity_audit_log);
#   · ninguna salida del tenant está en un estado que no sea cargado: la cola nunca corrió;
#   · el tenant tiene hilos vinculados, y el espejo de cada uno es de esta bandeja.
studio() {
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$DB" \
    psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres -v tenant="$TENANT" -v bandeja="$BANDEJA" -f -
}
flag="$(studio <<'SQL' 2>/dev/null
select case
  when to_regclass('public.entity_audit_log') is null or to_regclass('public.feature_flags') is null
    or to_regclass('public.chatwoot_portal_salida') is null or to_regclass('public.chatwoot_portal_hilos') is null
    or to_regclass('public.chatwoot_conversations') is null then 'sin_auditoria'
  when not exists (select 1 from public.feature_flags f where f.tenant_id = :'tenant' and f.key = 'chatwoot_portal') then 'sin_fila'
  when exists (select 1 from public.feature_flags f where f.tenant_id = :'tenant' and f.key = 'chatwoot_portal' and f.enabled) then 'encendido'
  when exists (select 1 from public.chatwoot_portal_salida s where s.tenant_id = :'tenant' and s.estado <> 'cargado') then 'cola'
  when not exists (select 1 from public.chatwoot_portal_hilos h where h.tenant_id = :'tenant') then 'sin_hilos'
  when exists (
    select 1 from public.chatwoot_portal_hilos h
    left join public.chatwoot_conversations c on c.tenant_id = h.tenant_id and c.conversation_id = h.chatwoot_conversation_id
    where h.tenant_id = :'tenant' and c.inbox_id is distinct from :bandeja
  ) then 'otra_bandeja'
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
  sin_fila) mal el_tenant_no_tiene_la_fila_del_flag 1 ;;
  encendido) mal chatwoot_portal_encendido 1 ;;
  alguna_vez) mal chatwoot_portal_se_encendio_alguna_vez 1 ;;
  cola) mal la_cola_corrio 1 ;;
  sin_hilos) mal el_tenant_no_tiene_hilos_vinculados 1 ;;
  otra_bandeja) mal un_hilo_del_tenant_no_es_de_esta_bandeja 1 ;;
  *) mal no_se_pudo_comprobar_el_flag 1 ;;
esac

# ── La carpeta del VPS ───────────────────────────────────────────────────────
mkdir -p -m 0700 "$DIR"
if [ -L "$DIR" ] || [ ! -d "$DIR" ] || [ ! -O "$DIR" ]; then mal la_carpeta_no_es_de_este_usuario; fi
chmod 0700 "$DIR"

# ── El paso 3: los .hecho del 1 y del 2, y la copia durable, antes de tocar Chatwoot ──
if [ "$MODO" = borrar ] && [ "$CONFIRMAR" = si ]; then
  [ -s "$H_SECO" ] || mal falta_chatwoot_seco_hecho
  [ -s "$H_ENSAYO" ] || mal falta_studio_ensayo_hecho
  grep -q '^HECHO chatwoot_seco=ok ' "$H_SECO" && grep -q '^HECHO studio_ensayo=ok ' "$H_ENSAYO" || mal los_hecho_no_dicen_ok
  sha_actual="$(sha256sum "$C" | cut -c1-64)"
  sha_seco="$(campo "$H_SECO" conservados_sha256)"
  sha_ensayo="$(campo "$H_ENSAYO" conservados_sha256)"
  [ "$sha_seco" = "$sha_actual" ] && [ "$sha_ensayo" = "$sha_actual" ] || mal el_sha256_de_los_conservados_no_coincide
  [ "$(campo "$H_SECO" tenant)" = "$TENANT" ] && [ "$(campo "$H_ENSAYO" tenant)" = "$TENANT" ] || mal el_tenant_de_los_hecho_no_coincide
  [ "$(campo "$H_SECO" cuenta)" = "$CUENTA" ] && [ "$(campo "$H_SECO" bandeja)" = "$BANDEJA" ] || mal la_cuenta_o_la_bandeja_del_seco_no_coinciden
  copiar_durable "$C" "$H_SECO" "$H_ENSAYO"
  # El .inicio, antes de abrir la transacción: si el proceso se corta entre el COMMIT y chatwoot-borrar.hecho, la copia
  # durable dice que el borrado empezó (B1 de la revisión del DG de la #480).
  escribir_hecho "$DURABLE/chatwoot-borrar.inicio" "INICIO chatwoot_borrar=en_curso conservados_sha256=$sha_actual tenant=$TENANT cuenta=$CUENTA bandeja=$BANDEJA utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

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
if ! printf '%s\n' "$salida" | grep -qx 'HECHO deshacer=ok'; then
  # El .inicio se retira solo con un ROLLBACK comprobado (el .rb dice fin=rollback). Sin esa línea (un corte) o con
  # fin=commit (un error después del COMMIT), se queda.
  if [ "$MODO" = borrar ] && [ "$CONFIRMAR" = si ] && printf '%s\n' "$salida" | grep -qx 'HECHO fin=rollback'; then
    rm -f -- "$DURABLE/chatwoot-borrar.inicio"
  fi
  exit 1
fi
# Con CONFIRMAR=no nunca se escribe chatwoot-borrar.hecho: el ensayo no habilita el paso 4.
[ "$MODO" = borrar ] && [ "$CONFIRMAR" = si ] && escribir_hecho_borrar
[ "$MODO" = seco ] || exit 0

( umask 077; docker exec "$DB_CW" cat "$EN_CW_C" >"$C.parcial" ) 2>/dev/null || mal no_se_pudieron_traer_los_conservados 1
chmod 0600 "$C.parcial"
head -n 1 "$C.parcial" | grep -q '"tipo":"cabecera"' || mal conservados_sin_cabecera 1
if grep -q '\\' "$C.parcial"; then mal barra_invertida_en_los_conservados 1; fi
mv -f -- "$C.parcial" "$C"
chmod 0600 "$C"
echo "HECHO conservados=$C"
echo "HECHO conservados_lineas=$(wc -l <"$C" | tr -d ' ')"
escribir_hecho "$H_SECO" "HECHO chatwoot_seco=ok conservados_sha256=$(sha256sum "$C" | cut -c1-64) tenant=$TENANT cuenta=$CUENTA bandeja=$BANDEJA utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
