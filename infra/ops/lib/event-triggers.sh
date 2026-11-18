# infra/ops/lib/event-triggers.sh — event triggers de una base restaurada (SDD-0594).
#
# Se carga con `source`; no corre solo. Lo usa restore.sh, que le saca `ensure_rls`
# a pg_restore, lo recrea y compara lo que quedó contra el índice del dump.
#
# Por qué hace falta: pg_restore corre como supabase_admin porque los otros seis
# event triggers exigen superusuario. Crea cada uno a su nombre y después le pasa
# el dueño. `ensure_rls` dispara `public.rls_auto_enable()`, que es de `postgres`,
# y supautils rechaza un superusuario disparando la función de un rol que no lo es:
#   ERROR:  Superuser owned event trigger must execute a superuser owned function
#   ERROR:  event trigger "ensure_rls" does not exist     (el ALTER ... OWNER de después)
# La base queda sin RLS automática en las tablas nuevas. Con `set role postgres`
# sí se crea (medido en el corte del 2026-10-14 y otra vez el 2026-11-02).
#
# Definición: la de supabase/migrations/0277_version_rls_auto_enable.sql, la misma
# de producción. infra/ops/tests/prueba-restore-event-triggers.sh compara las
# etiquetas contra toda migración que lo cree.

# shellcheck disable=SC2034  # las variables se usan donde se carga
EVT_ENSURE_RLS_CREAR_SQL="set role postgres; create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable();"
EVT_ENSURE_RLS_QUITAR_SQL="set client_min_messages = warning; drop event trigger if exists ensure_rls;"
# Lo único que vale como `ensure_rls` restaurado: dueño, función, estado y etiquetas.
EVT_ENSURE_RLS_ESPERADO='ensure_rls|postgres|public.rls_auto_enable|O|{"CREATE TABLE","CREATE TABLE AS","SELECT INTO"}'
# Foto de la base, una línea por trigger, con el mismo formato. Con search_path
# vacío la función sale calificada, sea quien sea el que pregunta.
EVT_FOTO_SQL="set search_path = '';
select e.evtname || '|' || pg_catalog.pg_get_userbyid(e.evtowner) || '|' || e.evtfoid::pg_catalog.regproc::text
       || '|' || e.evtenabled::text || '|' || coalesce(e.evttags::text, '')
from pg_catalog.pg_event_trigger e order by e.evtname"
# En el índice: el trigger (`EVENT TRIGGER - ensure_rls postgres`) y, si lo tuviera,
# su comentario (`COMMENT - EVENT TRIGGER ensure_rls postgres`).
EVT_INDICE_ENSURE_RLS_RE='EVENT TRIGGER (- )?ensure_rls( |$)'

# El dump trae `ensure_rls`.
evt_indice_trae_ensure_rls() { grep -qE "${EVT_INDICE_ENSURE_RLS_RE}" "$1"; }

# `ensure_rls` le toca a este dump: trae el trigger o su función. Un dump con la
# función y sin el trigger viene de un origen que ya lo perdió: se exige igual, o
# la pérdida se copiaría de respaldo en respaldo. Otro proyecto de la plantilla no
# trae ninguno de los dos.
evt_indice_exige_ensure_rls() {
  evt_indice_trae_ensure_rls "$1" || grep -qE '^[0-9]+; [0-9]+ [0-9]+ FUNCTION public rls_auto_enable\(\) ' "$1"
}

# `nombre|dueño` de los event triggers que tienen que quedar, uno por línea.
evt_esperados() {
  sed -nE 's/^[0-9]+; [0-9]+ [0-9]+ EVENT TRIGGER - ([^ ]+) ([^ ]+)$/\1|\2/p' "$1"
  if evt_indice_exige_ensure_rls "$1" && ! evt_indice_trae_ensure_rls "$1"; then echo 'ensure_rls|postgres'; fi
}

# evt_faltan <índice> <foto>: los nombres que faltan o no quedaron como deben, uno
# por línea. Nada impreso: están todos. Un trigger de más no cuenta como falta.
evt_faltan() {
  local foto=$'\n'"$2"$'\n' nombre dueno
  while IFS='|' read -r nombre dueno; do
    if [[ "${nombre}" == "ensure_rls" ]]; then
      [[ "${foto}" == *$'\n'"${EVT_ENSURE_RLS_ESPERADO}"$'\n'* ]] || echo "${nombre}"
    else
      [[ "${foto}" == *$'\n'"${nombre}|${dueno}|"* ]] || echo "${nombre}"
    fi
  done < <(evt_esperados "$1")
}
