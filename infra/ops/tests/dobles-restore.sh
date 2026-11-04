# infra/ops/tests/dobles-restore.sh — doble de docker para probar restore.sh y restore-test.sh (SDD-0594).
#
# Se carga con `source`. `dobles_restore_instalar <dir>` escribe docker y sleep en
# <dir>/bin y los pone primero en el PATH: ninguna prueba llega al docker real. Cada
# llamada queda en <dir>/docker.log.
#
# El doble imita lo medido el 2026-10-29 y el 2026-11-02, no una respuesta fija. La
# base es <dir>/evt, una línea por event trigger con el formato de EVT_FOTO_SQL:
#   pg_restore --list     imprime <dir>/indice (falla si existe <dir>/indice-roto)
#   pg_restore            recorre su índice (`-L` o el entero). Con --clean quita lo
#                         que va a crear. Si la base tiene `ensure_rls` y el índice
#                         no, el DROP de su función falla por dependencia. Un trigger
#                         de un dueño que no es superusuario da los dos errores del
#                         29-oct y no se crea. Un trigger de supabase_admin se crea.
#   psql -c …             el DROP y el CREATE de `ensure_rls`, sin `set role postgres`
#                         falla igual que pg_restore; la foto lee <dir>/evt. La tabla de
#                         prueba necesita el grant, porque `postgres` no es dueño de
#                         restore_test, y `role postgres`, porque como superusuario el
#                         trigger no dispara; nace con RLS solo si `ensure_rls` está y es
#                         de postgres (todo medido con la imagen real el 2026-11-02).
#
# Variables para torcerlo:
#   DOBLE_PIERDE=<nombre>         pg_restore no crea ese trigger y sale 1
#   DOBLE_CAMBIA_DUENO=<nombre>   pg_restore crea ese trigger con otro dueño
#   DOBLE_QUITAR_FALLA=1          el DROP de `ensure_rls` falla
#   DOBLE_PG_RESTORE_RC=<n>       pg_restore sale con ese código al final
#   DOBLE_RECREAR_FALLA=1         el CREATE EVENT TRIGGER falla
#   DOBLE_DUENO_RECREADO=<rol>    el CREATE deja ese dueño en vez del role activo
#   DOBLE_ACL_HUELLA=<huella>     lo que devuelve la huella de permisos
#   DOBLE_DB_EXISTE=1             la base destino ya existe

dobles_restore_instalar() {
  local d="$1"
  mkdir -p "${d}/bin"
  export DOBLE_DIR="${d}"
  : > "${d}/evt"
  cat > "${d}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/docker.log"
EVT="${DOBLE_DIR}/evt"

doble_pg_restore() {
  local lista="" rc=0 args=" $* " a prev="" otra
  for a in "$@"; do
    if [[ "${prev}" == "-L" ]]; then lista="${a}"; fi
    prev="${a}"
  done
  local indice="${DOBLE_DIR}/indice"
  if [[ -n "${lista}" ]]; then indice="${DOBLE_MONTADO_LIST:?el doble no vio montado el índice}"; fi
  # --clean: quita lo que va a crear, y la función de ensure_rls si viene en el índice.
  if [[ "${args}" == *" --clean "* ]]; then
    if grep -qE 'FUNCTION public rls_auto_enable\(\) ' "${indice}" && grep -q '^ensure_rls|' "${EVT}" && ! grep -qE 'EVENT TRIGGER - ensure_rls ' "${indice}"; then
      echo 'pg_restore: error: could not execute query: ERROR:  cannot drop function public.rls_auto_enable() because other objects depend on it' >&2
      rc=1
    fi
    while read -r _ _ _ _ _ _ nombre _; do
      otra="$(grep -v "^${nombre}|" "${EVT}" || true)"; printf '%s' "${otra:+${otra}$'\n'}" > "${EVT}"
    done < <(grep -E ' EVENT TRIGGER - ' "${indice}")
  fi
  while read -r _ _ _ _ _ _ nombre dueno; do
    if [[ "${dueno}" != "supabase_admin" ]]; then
      echo 'pg_restore: error: could not execute query: ERROR:  Superuser owned event trigger must execute a superuser owned function' >&2
      echo "pg_restore: error: could not execute query: ERROR:  event trigger \"${nombre}\" does not exist" >&2
      rc=1
    elif [[ "${nombre}" == "${DOBLE_PIERDE:-}" ]]; then
      echo "pg_restore: error: could not execute query: ERROR:  se perdió ${nombre} (doble)" >&2
      rc=1
    elif [[ "${nombre}" == "${DOBLE_CAMBIA_DUENO:-}" ]]; then
      printf '%s|otro_rol|extensions.%s|O|\n' "${nombre}" "${nombre}" >> "${EVT}"
    else
      printf '%s|%s|extensions.%s|O|\n' "${nombre}" "${dueno}" "${nombre}" >> "${EVT}"
    fi
  done < <(grep -E ' EVENT TRIGGER - ' "${indice}")
  return "$(( ${DOBLE_PG_RESTORE_RC:-0} > rc ? ${DOBLE_PG_RESTORE_RC:-0} : rc ))"
}

doble_psql() { # $1 = sql, $2 = usuario
  local sql="$1" usuario="$2"
  case "${sql}" in
    *"create event trigger ensure_rls"*)
      if [[ -n "${DOBLE_RECREAR_FALLA:-}" ]]; then echo 'ERROR:  falla del doble' >&2; return 3; fi
      if [[ "${sql}" != *"set role postgres"* && "${usuario}" != "postgres" ]]; then
        echo 'ERROR:  Superuser owned event trigger must execute a superuser owned function' >&2; return 3
      fi
      if grep -q '^ensure_rls|' "${EVT}"; then echo 'ERROR:  event trigger "ensure_rls" already exists' >&2; return 3; fi
      local tags funcion
      tags="$(sed -nE "s/.*when tag in \(([^)]*)\).*/\1/p" <<< "${sql}" | sed -E "s/'/\"/g; s/, /,/g")"
      funcion="$(sed -nE 's/.*execute function ([a-z_.]+)\(\).*/\1/p' <<< "${sql}")"
      printf 'ensure_rls|%s|%s|O|{%s}\n' "${DOBLE_DUENO_RECREADO:-postgres}" "${funcion}" "${tags}" >> "${EVT}"
      ;;
    *"drop event trigger if exists ensure_rls"*)
      if [[ -n "${DOBLE_QUITAR_FALLA:-}" ]]; then echo 'ERROR:  falla del doble' >&2; return 3; fi
      local otra; otra="$(grep -v '^ensure_rls|' "${EVT}" || true)"; printf '%s' "${otra:+${otra}$'\n'}" > "${EVT}"
      ;;
    *pg_event_trigger*) cat "${EVT}" ;;
    *pg_database*) if [[ -n "${DOBLE_DB_EXISTE:-}" ]]; then echo 1; fi ;;
    *"create database"*) : ;;
    *"huella"* | *"pg_catalog.md5"*) echo "${DOBLE_ACL_HUELLA:-1:0123456789abcdef0123456789abcdef}" ;;
    *"to_regprocedure"*) if grep -qE 'FUNCTION public rls_auto_enable' "${DOBLE_DIR}/indice"; then echo t; else echo f; fi ;;
    *"relrowsecurity"*)
      if [[ "${sql}" != *"grant create on schema public to postgres"* ]]; then
        echo 'ERROR:  permission denied for schema public' >&2; return 3
      fi
      if [[ "${sql}" == *"role postgres"* ]] && grep -q '^ensure_rls|postgres|public.rls_auto_enable|O|' "${EVT}"; then echo t; else echo f; fi ;;
    *"pg_default_acl"* | *"vault.secrets"* | *"vault.decrypted_secrets"*) echo 0 ;;
    *pg_roles*) echo 1 ;;
    *"select count(*)"*) echo 5 ;;
  esac
}

# Lo que corre dentro del contenedor: lo primero tras la imagen o el nombre.
doble_adentro() {
  local usuario="" sql="" a prev=""
  for a in "$@"; do
    case "${prev}" in
      -U) usuario="${a}" ;;
      -c | -Atc) sql="${a}" ;;
    esac
    prev="${a}"
  done
  case "${1-}" in
    pg_restore)
      if [[ " $* " == *" --list "* ]]; then
        if [[ -e "${DOBLE_DIR}/indice-roto" ]]; then echo 'pg_restore: error: input file does not appear to be a valid archive' >&2; return 1; fi
        cat "${DOBLE_DIR}/indice"; return 0
      fi
      doble_pg_restore "$@" ;;
    psql)
      if [[ -n "${sql}" ]]; then doble_psql "${sql}" "${usuario}"; else cat > /dev/null; fi ;;
  esac
}

case "${1-}" in
  run)
    shift
    # Opciones de `docker run` hasta la imagen; el resto es lo que corre adentro.
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --rm | -i | -d) shift ;;
        -v)
          if [[ "$2" == *":/restore.list:ro" ]]; then DOBLE_MONTADO_LIST="${2%:/restore.list:ro}"; fi
          shift 2 ;;
        --label | --network | --network-alias | --name | --tmpfs | -e) shift 2 ;;
        *) break ;;
      esac
    done
    shift # imagen
    if [[ "${1-}" == "postgres" ]]; then echo contenedor; exit 0; fi # el arranque de restore-test
    doble_adentro "$@"
    exit $? ;;
  exec)
    shift
    [[ "${1-}" == "-i" ]] && shift
    shift # contenedor
    doble_adentro "$@"
    exit $? ;;
esac
exit 0
DOBLE
  printf '#!/usr/bin/env bash\nexit 0\n' > "${d}/bin/sleep"
  chmod +x "${d}/bin/docker" "${d}/bin/sleep"
  export PATH="${d}/bin:${PATH}"
}

# La foto de la base simulada, una línea por trigger.
dobles_restore_foto() { cat "${DOBLE_DIR}/evt"; }
# Cuántas veces se llamó al doble (0 = no se tocó nada).
dobles_restore_llamadas() { [[ -f "${DOBLE_DIR}/docker.log" ]] && wc -l < "${DOBLE_DIR}/docker.log" | tr -d '[:space:]' || echo 0; }
# Empieza de cero: sin base, sin registro y sin índice roto.
dobles_restore_reiniciar() { : > "${DOBLE_DIR}/evt"; rm -f "${DOBLE_DIR}/docker.log" "${DOBLE_DIR}/indice-roto"; }
