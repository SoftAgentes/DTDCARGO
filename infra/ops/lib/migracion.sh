# infra/ops/lib/migracion.sh — envoltorio de una migración con su fila del ledger (SDD-0540, Fase 1).
#
# Se carga con `source`. Es el método con el que el Director aplica hoy en el
# servidor propio (0473, 0474, 0475 y el lote del 2026-10-15; handoff 0506 §
# APLICACIÓN): un solo script de psql que
#
#   \set ON_ERROR_STOP on
#   begin;
#   <el texto exacto del archivo>
#   insert into supabase_migrations.schema_migrations (version, statements, name, created_by)
#   values (<version>, array[$migNNNN$<el texto exacto del archivo>$migNNNN$], '<nombre>', '<created_by>');
#   commit;
#
# Con ON_ERROR_STOP, un error en cualquier punto corta psql antes del commit y el
# servidor deshace todo: no queda ni el objeto ni la fila. Lo usan
# migrate/aplicar-migracion.sh (una migración, con la hora real como versión) y
# staging/resetear-base-prueba.sh (todas las de main, con versiones seguidas).
#
# mig_revisar rechaza lo que rompería ese contrato: CR (salvo permitirlo), una
# línea que empieza con barra invertida (psql la tomaría como meta-comando), el
# delimitador dentro del texto y un begin/commit/rollback propio del archivo.

# Versión con la hora real del apply, calculada por el servidor.
MIG_VERSION_RELOJ="to_char(clock_timestamp() at time zone 'utc','YYYYMMDDHH24MISS')"

mig_nombre() { local b; b="$(basename -- "$1")"; printf '%s' "${b%.sql}"; }
mig_prefijo() { local n; n="$(mig_nombre "$1")"; printf '%s' "${n%%_*}"; }
# El delimitador sale del NOMBRE de la migración (0475_x → $mig0475$), nunca de
# la ruta de la copia (migracion.sql en el paquete de aplicar-migracion.sh).
mig_delimitador() { printf '$mig%s$' "$(mig_prefijo "$1")"; }
mig_md5() { md5sum < "$1" | cut -c1-32; }
mig_bytes() { wc -c < "$1" | tr -d '[:space:]'; }

# Primera línea útil (ni vacía ni comentario `--`) de un script.
mig_primera_util() { awk 'NF && $0 !~ /^[[:space:]]*--/ { print; exit }' "$1"; }

# mig_revisar <archivo> <nombre-del-ledger> [permitir_cr=0]
# Sale 0 si el archivo se puede envolver; si no, imprime el motivo y sale 1.
mig_revisar() {
  local f="$1" nombre="$2" permitir_cr="${3:-0}" delim n
  [[ -f "${f}" ]] || { echo "no existe ${f}"; return 1; }
  [[ "${nombre}" =~ ^[0-9]{4}[a-z]?_[a-z0-9_]+$ ]] || { echo "nombre de migración inválido: '${nombre}'"; return 1; }
  if (( ! permitir_cr )); then
    n="$(tr -cd '\r' < "${f}" | wc -c | tr -d '[:space:]')"
    [[ "${n}" == 0 ]] || { echo "${nombre}: el archivo tiene ${n} CR (salto de línea de Windows)"; return 1; }
  fi
  n="$(awk 'substr($0, 1, 1) == "\\" { c++ } END { print c + 0 }' "${f}")"
  [[ "${n}" == 0 ]] || { echo "${nombre}: ${n} líneas empiezan con barra invertida (psql las leería como meta-comandos)"; return 1; }
  delim="$(mig_delimitador "${nombre}")"
  if grep -qF -- "${delim}" "${f}"; then echo "${nombre}: el delimitador ${delim} aparece dentro del texto"; return 1; fi
  n="$(grep -ciE '^[[:space:]]*(begin|commit|rollback|start[[:space:]]+transaction|abort)([[:space:]]+(work|transaction))?[[:space:]]*;' "${f}" || true)"
  [[ "${n}" == 0 ]] || { echo "${nombre}: el archivo trae su propio begin, commit o rollback (${n} líneas)"; return 1; }
  return 0
}

# mig_envolver <archivo> <nombre> <created_by> <version_sql> <salida>
# Escribe el script de apply. No revisa: llama antes a mig_revisar.
mig_envolver() {
  local f="$1" nombre="$2" created_by="$3" version_sql="$4" salida="$5" delim
  [[ "${created_by}" =~ ^[A-Za-z0-9:@._-]+$ ]] || { echo "created_by inválido: '${created_by}'" >&2; return 1; }
  delim="$(mig_delimitador "${nombre}")"
  {
    printf '%s\n' '\set ON_ERROR_STOP on' 'begin;'
    cat -- "${f}"
    # Si el archivo no termina en salto de línea, el insert no se pega a su última línea.
    [[ "$(tail -c 1 -- "${f}" | od -An -tx1 | tr -d '[:space:]')" == "0a" ]] || printf '\n'
    printf '%s\n' 'insert into supabase_migrations.schema_migrations (version, statements, name, created_by)'
    printf 'values (%s, array[%s' "${version_sql}" "${delim}"
    cat -- "${f}"
    printf "%s], '%s', '%s');\n" "${delim}" "${nombre}" "${created_by}"
    printf '%s\n' 'commit;'
  } > "${salida}"
}

# mig_solo_ledger <archivo> <nombre> <created_by> <version_sql> <salida>
# Para las migraciones que solo reparan el ledger de producción (LEDGER_ONLY de
# scripts/check-schema-rebuild.mjs): sus preflights exigen filas de producción y
# sobre una base nueva no tienen nada que reparar. Se registra la fila con el
# texto exacto, sin ejecutarlo.
mig_solo_ledger() {
  local f="$1" nombre="$2" created_by="$3" version_sql="$4" salida="$5" delim
  [[ "${created_by}" =~ ^[A-Za-z0-9:@._-]+$ ]] || { echo "created_by inválido: '${created_by}'" >&2; return 1; }
  delim="$(mig_delimitador "${nombre}")"
  {
    printf '%s\n' '\set ON_ERROR_STOP on' 'begin;'
    printf '%s\n' 'insert into supabase_migrations.schema_migrations (version, statements, name, created_by)'
    printf 'values (%s, array[%s' "${version_sql}" "${delim}"
    cat -- "${f}"
    printf "%s], '%s', '%s');\n" "${delim}" "${nombre}" "${created_by}"
    printf '%s\n' 'commit;'
  } > "${salida}"
}

# mig_salida_ok <stdout de psql> <cierre esperado: COMMIT|ROLLBACK>
# La salida tiene que empezar con BEGIN y terminar con el cierre: si falta el
# BEGIN, el envoltorio no se aplicó (así se detectó el heredoc que se comió una
# barra el 2026-10-15).
mig_salida_ok() {
  local out="$1" cierre="$2" primera ultima
  primera="$(awk 'NF { print; exit }' "${out}")"
  ultima="$(awk 'NF { l = $0 } END { print l }' "${out}")"
  [[ "${primera}" == "BEGIN" && "${ultima}" == "${cierre}" ]]
}
