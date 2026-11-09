#!/usr/bin/env bash
# supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh — SDD-0586 10.7, sub-paso 4.6b del runbook
# docs/runbooks/chatwoot-portal-p4-puertas.md: deshace en Studio los vínculos de la carga P4, con
# deshacer-vinculos.sql, en UNA transacción.
#
#   MODO=ensayo  → termina en ROLLBACK (lo corre el DG para ensayar). Es el paso 2 del 4.6b.
#   MODO=aplicar → termina en COMMIT. BORRADO PERMANENTE en producción: lo corre Sam, con su OK nominal.
#                  Es el paso 4 del 4.6b.
#
# Lee contactos-conservados.ndjson (de la pieza de E5, solo ids) y los conteos esperados, sacados del
# conteo previo de solo lectura. Imprime solo líneas HECHO con conteos.
#
# EL ORDEN DEL 4.6b LO IMPONEN LOS ARCHIVOS (aprobado por el DG, 2026-11-09):
#   1. Chatwoot en seco (E5)    → escribe chatwoot-seco.hecho
#   2. Studio, MODO=ensayo       → exige chatwoot-seco.hecho; escribe studio-ensayo.hecho
#   3. Chatwoot borra (E5)      → exige studio-ensayo.hecho; escribe chatwoot-borrar.hecho, y copia el .ndjson
#                                 y los tres .hecho a la carpeta durable (Sam eligió la opción a)
#   4. Studio, MODO=aplicar      → exige studio-ensayo.hecho y chatwoot-borrar.hecho; escribe studio-aplicar.hecho
#   5. Se borran el .ndjson y los .hecho de las dos carpetas, solo si el 4 salió con 0.
# Cada .hecho es una línea `HECHO <paso>=ok conservados_sha256=<64 hex> tenant=<uuid> …`, en 0600, escrita
# con .parcial + mv. Sin datos de personas. Todos tienen que traer el sha256 del .ndjson y el tenant de
# esta corrida; si no, se niega sin llamar a psql. A psql entra una copia del .ndjson tomada al empezar,
# con el sha256 comprobado; si el .ndjson cambia durante la corrida, no deja evidencia.
#
# LA CARPETA DURABLE: /dev/shm se borra si el VPS se reinicia. Si eso pasa entre el 3 y el 4, el paso 4 usa
# /srv/ops/portal-historial/deshacer/ (root, 0700, archivos 0600). La CREA el paso 3 de E5 (el .ndjson,
# chatwoot-seco.hecho y studio-ensayo.hecho, y después chatwoot-borrar.hecho); el paso 4 le AGREGA su
# studio-aplicar.hecho, para que el 5 sobreviva a un reinicio entre el 4 y el 5. Nada antes del paso 3 toca el
# disco: el ensayo no la toca. Solo el paso 4 la lee, y solo para lo que falta en tmpfs; si un archivo está en
# las dos y no son iguales, se niega. Con permisos abiertos, no la usa.
#
# Uso:  DB=<contenedor de la base de Studio> TENANT=<uuid> CUENTA=<n> BANDEJA=<n> \
#       ESPERADOS_SALIDA=<n> ESPERADOS_HILOS=<n> ESPERADOS_CONTACTOS=<n> ESPERADOS_ESPEJO=<n> \
#       ENTORNO=copia|produccion \
#       MODO=ensayo|aplicar bash deshacer-vinculos.sh
#
# En produccion, el system_identifier sale de /srv/ops/portal-historial/sistema-produccion (root 0600, uid 0), no del
# entorno, y su sha corto tiene que ser b4fbe1b236 (producción) antes de llamar a psql.
#
# El VPS lo tiene en /srv/ops/portal-historial/ (sub-paso 3.0 del runbook), junto a deshacer-vinculos.sql.
set -euo pipefail
umask 077

: "${DB:?falta DB}" "${TENANT:?falta TENANT}" "${CUENTA:?falta CUENTA}" "${BANDEJA:?falta BANDEJA}"
: "${ESPERADOS_SALIDA:?falta ESPERADOS_SALIDA}" "${ESPERADOS_HILOS:?falta ESPERADOS_HILOS}"
: "${ESPERADOS_CONTACTOS:?falta ESPERADOS_CONTACTOS}" "${ESPERADOS_ESPEJO:?falta ESPERADOS_ESPEJO}"
: "${MODO:?falta MODO (ensayo o aplicar)}" "${ENTORNO:?falta ENTORNO (copia o produccion)}"
# SISTEMA (aprobado por el DG, 2026-11-09): el system_identifier de producción sale de un archivo de root, nunca del
# entorno ni de la base que se protege. Se imprime solo su sha256 corto, con la fórmula del DG (printf '%s', sin salto
# de línea, y los primeros 10 caracteres de sha256sum), para que el DG lo compare con su nota de control. El valor no
# se imprime nunca. El archivo lo deja el sub-paso 3.0 del runbook (aprobado por el DG; /srv/ops/portal-historial no
# existe antes), y lo borran el cierre o el abandono del 4.6b (limpiar.sh).
[ -z "${SISTEMA:-}" ] || { echo "HECHO error=sistema_va_en_el_archivo_no_en_el_entorno" >&2; exit 2; }
SISTEMA_ARCHIVO="${DESHACER_SISTEMA:-/srv/ops/portal-historial/sistema-produccion}"
# El sha corto esperado es el de producción (dtd-cargo-db-1, nota de control del DG), y el archivo es de root (uid 0).
# Los dos solo cambian en la prueba bash (DESHACER_PRUEBA=1), que usa su valor de mentira y el uid del runner. Así, un
# archivo con el identificador de staging no pasa aunque la base a la que se conecta sea la de staging (revisión del
# DG de la #480 en 65539df37: la SQL compara contra la misma base que protege).
SISTEMA_SHA_ESPERADO=b4fbe1b236
SISTEMA_UID=0
if [ "${DESHACER_PRUEBA:-}" = 1 ]; then
  SISTEMA_SHA_ESPERADO="${DESHACER_SISTEMA_SHA:-$SISTEMA_SHA_ESPERADO}"
  SISTEMA_UID="${DESHACER_SISTEMA_UID:-$SISTEMA_UID}"
fi
sha_corto() { printf '%s' "$1" | sha256sum | cut -c1-10; } # guarda:sistema_printf
leer_sistema() {
  local f="$SISTEMA_ARCHIVO" v=""
  [ -f "$f" ] && [ ! -L "$f" ] && [ -O "$f" ] && [ "$(stat -c %a "$f")" = 600 ] || { echo "HECHO error=sin_archivo_de_sistema_0600" >&2; return 1; }
  [ "$(stat -c %u "$f")" = "$SISTEMA_UID" ] || { echo "HECHO error=archivo_de_sistema_no_es_de_root" >&2; return 1; } # guarda:sistema_root
  # Solo cifras y a lo sumo un salto de línea, contado en los bytes con tr (un CR o un espacio cuentan como otros):
  # se acepta un salto final, y un CR, un espacio o una segunda línea se rechazan (condición del DG). Después, $(cat)
  # quita ese salto final y el case de abajo exige que quede un número.
  [ "$(LC_ALL=C tr -d '0-9\n' < "$f" | wc -c)" -eq 0 ] && [ "$(LC_ALL=C tr -cd '\n' < "$f" | wc -c)" -le 1 ] || { echo "HECHO error=archivo_de_sistema_no_es_un_numero" >&2; return 1; }
  v="$(cat -- "$f")"
  case "$v" in ''|*[!0-9]*) echo "HECHO error=archivo_de_sistema_no_es_un_numero" >&2; return 1 ;; esac
  printf '%s' "$v"
}
DIR="${DIR:-/dev/shm/portal-historial}"
# La copia durable, con la misma variable que deshacer.sh de la #478: DESHACER_DURABLE vale solo con
# DESHACER_PRUEBA=1 (la prueba bash) y tiene que terminar en /deshacer; si no, es siempre la fija.
DURABLE="${DESHACER_DURABLE:-/srv/ops/portal-historial/deshacer}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
CONS=contactos-conservados.ndjson

# Solo los nombres fijos, como los demás guiones de esta carpeta. La durable solo cambia en la prueba bash.
if [ "$DIR" != /dev/shm/portal-historial ]; then
  echo "HECHO error=dir_no_es_dev_shm_portal_historial" >&2
  exit 2
fi
[ "$DURABLE" = /srv/ops/portal-historial/deshacer ] || { [ "${DESHACER_PRUEBA:-}" = 1 ] && [ "${DURABLE%/deshacer}" != "$DURABLE" ]; } || { echo "HECHO error=durable_no_es_srv_ops_portal_historial_deshacer" >&2; exit 2; } # guarda:durable_fijo
# La ruta de SISTEMA, después de la de la durable: cada guarda se prueba sola (revisión del rojo de be22af8a3).
[ "$SISTEMA_ARCHIVO" = /srv/ops/portal-historial/sistema-produccion ] || [ "${DESHACER_PRUEBA:-}" = 1 ] || { echo "HECHO error=sistema_no_es_el_archivo_fijo" >&2; exit 2; } # guarda:sistema_fijo
case "$MODO" in
  ensayo) FIN=rollback; PROPIA=studio-ensayo.hecho; PASO=studio_ensayo ;;
  aplicar) FIN=commit; PROPIA=studio-aplicar.hecho; PASO=studio_aplicar ;;
  *) echo "HECHO error=modo_invalido" >&2; exit 2 ;;
esac
case "$ENTORNO" in
  copia) SISTEMA="" ;;
  produccion)
    SISTEMA="$(leer_sistema)" || exit 2
    echo "HECHO sistema_sha256_corto=$(sha_corto "$SISTEMA")" # guarda:sistema_corto
    # Antes de psql: si no es el de producción, se niega. Imprime el esperado, nunca el valor.
    [ "$(sha_corto "$SISTEMA")" = "$SISTEMA_SHA_ESPERADO" ] || { echo "HECHO error=sistema_no_es_el_de_produccion esperado=$SISTEMA_SHA_ESPERADO" >&2; exit 2; } # guarda:sistema_esperado
    ;;
  *) echo "HECHO error=entorno_invalido" >&2; exit 2 ;;
esac
case "$TENANT" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) echo "HECHO error=tenant_no_es_uuid" >&2; exit 2 ;;
esac
for n in "$CUENTA" "$BANDEJA" "$ESPERADOS_SALIDA" "$ESPERADOS_HILOS" "$ESPERADOS_CONTACTOS" "$ESPERADOS_ESPEJO"; do
  case "$n" in
    ''|*[!0-9]*) echo "HECHO error=numero_invalido" >&2; exit 2 ;;
  esac
done

# La carpeta durable, si existe y es el paso 4: una carpeta de verdad, de este usuario (-O) y en 0700.
durable_ok() { [ -d "$DURABLE" ] && [ ! -L "$DURABLE" ] && [ -O "$DURABLE" ] && [ "$(stat -c %a "$DURABLE")" = 700 ]; }
[ "$MODO" != aplicar ] || [ ! -e "$DURABLE" ] || durable_ok || { echo "HECHO error=durable_no_es_carpeta_0700" >&2; exit 2; } # guarda:durable0700

# fuente <nombre>: la ruta del archivo en tmpfs; si falta y es el paso 4, la de la carpeta durable. O nada.
fuente() {
  if [ -e "$DIR/$1" ]; then printf '%s' "$DIR/$1"
  elif [ "$MODO" = aplicar ] && durable_ok && [ -e "$DURABLE/$1" ]; then printf '%s' "$DURABLE/$1" # guarda:respaldo
  fi
}
# Un archivo que está en las dos carpetas tiene que ser el mismo: si no, no se elige ninguno.
distintas() {
  local n
  for n in "$CONS" chatwoot-seco.hecho studio-ensayo.hecho chatwoot-borrar.hecho; do
    if [ -e "$DIR/$n" ] && [ -e "$DURABLE/$n" ] && ! cmp -s "$DIR/$n" "$DURABLE/$n"; then return 0; fi
  done
  return 1
}
[ "$MODO" != aplicar ] || ! distintas || { echo "HECHO error=copias_distintas" >&2; exit 2; } # guarda:distintas

# La evidencia propia de un intento anterior no vale: se borra antes de empezar, y solo vuelve si este sale con 0.
rm -f "$DIR/$PROPIA" "$DIR/$PROPIA.parcial" # guarda:viejo
[ "$MODO" != aplicar ] || ! durable_ok || rm -f "$DURABLE/$PROPIA" "$DURABLE/$PROPIA.parcial" # guarda:viejo_durable
C="$(fuente "$CONS")"
[ -n "$C" ] && [ ! -L "$C" ] && test -s "$C" || { echo "HECHO error=sin_contactos_conservados" >&2; exit 2; }
# El archivo entra a psql por COPY de texto, que interpreta la barra invertida: solo lleva ids.
if grep -q '\\' "$C"; then
  echo "HECHO error=barra_invertida_en_los_conservados" >&2
  exit 2
fi

# Después de un reinicio, el paso 4 vuelve a crear la carpeta de tmpfs para su foto y su evidencia.
[ -d "$DIR" ] || mkdir -m 0700 "$DIR"
# La copia que entra a psql, con su sha256. Si el .ndjson cambió mientras se copiaba, no se sigue.
FOTO="$DIR/.conservados-foto.$$"
trap 'rm -f "$FOTO" "$DIR/$PROPIA.parcial" "$DURABLE/$PROPIA.parcial"' EXIT
cp "$C" "$FOTO"
SHA="$(sha256sum "$FOTO" | cut -c1-64)"
[ "$(sha256sum "$C" | cut -c1-64)" = "$SHA" ] || { echo "HECHO error=conservados_cambiaron" >&2; exit 2; }

# evidencia <nombre> <prefijo> [<campo=valor>…]: la primera línea empieza con el prefijo y trae el sha256 de
# esta corrida, el tenant y cada campo pedido. Un enlace simbólico no vale.
evidencia() {
  local f prefijo="$2" l="" campo
  f="$(fuente "$1")"
  shift 2
  [ -n "$f" ] && [ -f "$f" ] && [ ! -L "$f" ] || return 1
  IFS= read -r l < "$f" || [ -n "$l" ] || return 1
  case "$l" in "$prefijo "*) ;; *) return 1 ;; esac
  case " $l " in *" conservados_sha256=$SHA "*) ;; *) return 1 ;; esac # guarda:sha
  case " $l " in *" tenant=$TENANT "*) ;; *) return 1 ;; esac # guarda:tenant
  for campo in "$@"; do
    case " $l " in *" $campo "*) ;; *) return 1 ;; esac
  done
}
CHATWOOT_DE_ESTA=("cuenta=$CUENTA" "bandeja=$BANDEJA")
evidencia chatwoot-seco.hecho "HECHO chatwoot_seco=ok" "${CHATWOOT_DE_ESTA[@]}" || { echo "HECHO error=sin_seco_de_chatwoot" >&2; exit 2; } # guarda:seco
if [ "$MODO" = aplicar ]; then
  evidencia studio-ensayo.hecho "HECHO studio_ensayo=ok" "entorno=$ENTORNO" || { echo "HECHO error=sin_ensayo_previo" >&2; exit 2; } # guarda:ensayo
  evidencia chatwoot-borrar.hecho "HECHO chatwoot_borrar=ok" "${CHATWOOT_DE_ESTA[@]}" "fin=commit" || { echo "HECHO error=sin_borrado_de_chatwoot" >&2; exit 2; } # guarda:borrar
fi

{
  # Sin DETAIL ni CONTEXT: un error o un deadlock no imprime filas (como crm-kommo/correr.sh).
  printf '%s\n' '\set ON_ERROR_STOP on' '\set VERBOSITY terse' 'begin;'
  # SISTEMA entra por la entrada de psql, no por -v: un argumento se ve en `ps`. Son solo cifras (o vacío en la copia).
  printf '%s\n' "\\set sistema '$SISTEMA'"
  printf '%s\n' 'create temp table deshacer_param (tenant uuid, cuenta bigint, bandeja bigint, esperados_salida integer, esperados_hilos integer, esperados_contactos integer, esperados_espejo integer, entorno text, sistema text);'
  printf '%s\n' "insert into deshacer_param values (:'tenant', :cuenta, :bandeja, :esperados_salida, :esperados_hilos, :esperados_contactos, :esperados_espejo, :'entorno', nullif(:'sistema', ''));"
  printf '%s\n' 'create temp table conservados (n serial, linea text);' 'copy conservados (linea) from stdin;'
  cat "$FOTO"
  # Sin salto de línea al final, la última línea se juntaría con el fin del COPY.
  [ -z "$(tail -c 1 "$FOTO")" ] || printf '\n'
  printf '%s\n' '\.'
  cat "$AQUI/deshacer-vinculos.sql"
  printf '%s\n' 'select l from pg_temp.deshacer_vinculos() as t(l);'
  printf '%s\n' "$FIN;"
} | docker exec -i "$DB" psql -X -q -At -U postgres -d postgres \
      -v tenant="$TENANT" -v cuenta="$CUENTA" -v bandeja="$BANDEJA" \
      -v esperados_salida="$ESPERADOS_SALIDA" -v esperados_hilos="$ESPERADOS_HILOS" \
      -v esperados_contactos="$ESPERADOS_CONTACTOS" -v esperados_espejo="$ESPERADOS_ESPEJO" \
      -v entorno="$ENTORNO" -f - # guarda:sistema_argv

echo "HECHO modo=$MODO fin=$FIN"
# El .ndjson tiene que seguir igual que la copia que entró: si no, esta corrida no deja evidencia.
[ "$(sha256sum "$C" | cut -c1-64)" = "$SHA" ] || { echo "HECHO error=conservados_cambiaron" >&2; exit 2; } # guarda:despues
LINEA="HECHO $PASO=ok conservados_sha256=$SHA tenant=$TENANT entorno=$ENTORNO fin=$FIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
escribir() { printf '%s\n' "$LINEA" > "$1/$PROPIA.parcial"; mv "$1/$PROPIA.parcial" "$1/$PROPIA"; }
escribir "$DIR"
# El paso 4 deja su evidencia también en la durable, para que el paso 5 la encuentre después de otro reinicio.
if [ "$MODO" = aplicar ] && durable_ok; then escribir "$DURABLE"; fi
echo "$LINEA"
