# infra/ops/tests/dobles-prueba.sh — dobles de docker, curl y getent para las pruebas del entorno de prueba (SDD-0540).
#
# Se carga con `source` desde las pruebas de infra/ops/tests. `dobles_instalar <dir>`
# escribe los tres ejecutables en <dir>/bin y lo pone primero en el PATH: ninguna
# prueba llega al docker real. Cada llamada queda en <dir>/docker.log (una línea
# por invocación) y cada script que llega a `docker exec -i … psql` por la entrada
# estándar queda en <dir>/stdin-<n>.sql.
#
# Cómo contesta el doble de docker:
#   inspect          true / healthy (o falla si existe <dir>/caido-<contenedor>)
#   pull, compose    código DOBLE_PULL_RC / DOBLE_COMPOSE_RC (0 por defecto)
#   run              las nueve cuentas del bundle: DOBLE_BUNDLE ("3 0 0 2 1 1 1 2 1": host de prueba, producción, ref de Cloud, GA, Ads, anon y cookie en /app/.next; GA y Ads en /app/.next/static)
#   ps/volume/network nada (destroy-staging no encuentra qué borrar)
#   exec … psql -c   consultas de una línea (Vault, kommo_connections, pg_roles,
#                    filas del ledger, RLS de cron)
#   exec -i … psql   según el script: bcrypt de clave-web, lectura previa y
#                    verificación (BEGIN … ROLLBACK), envoltorio de migración
#                    (BEGIN · INSERT 0 1 · COMMIT, y suma una fila al ledger),
#                    plataforma y semilla. Con DOBLE_FALLA=<texto>, el script que
#                    lo contenga falla como psql con ON_ERROR_STOP (sale 3).

dobles_instalar() {
  local d="$1"
  mkdir -p "${d}/bin"
  export DOBLE_DIR="${d}"
  cat > "${d}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/docker.log"
case "${1-}" in
  inspect)
    nombre="${4-}"
    [[ -e "${DOBLE_DIR}/caido-${nombre}" ]] && exit 1
    case "${3-}" in *Health*) echo healthy ;; *) echo true ;; esac
    exit 0 ;;
  pull) exit "${DOBLE_PULL_RC:-0}" ;;
  compose) exit "${DOBLE_COMPOSE_RC:-0}" ;;
  run) echo "${DOBLE_BUNDLE:-3 0 0 2 1 1 1 2 1}"; exit 0 ;;
  ps|volume|network) exit 0 ;;
  exec)
    shift
    [[ "${1-}" == "-i" ]] && shift
    shift # contenedor
    args=" $* "
    if [[ "${args}" == *" -c "* || "${args}" == *" -Atc "* ]]; then
      case "${args}" in
        *vault.secrets*) echo "${DOBLE_VAULT:-0}" ;;
        *kommo_connections*) echo "${DOBLE_KC:-0}" ;;
        *pg_roles*) echo 1 ;;
        *schema_migrations*) cat "${DOBLE_DIR}/ledger" 2>/dev/null || echo 0 ;;
        *"enable row level security"*) echo "ALTER TABLE"; echo "ALTER TABLE" ;;
      esac
      exit 0
    fi
    n=$(( $(cat "${DOBLE_DIR}/n" 2>/dev/null || echo 0) + 1 )); echo "${n}" > "${DOBLE_DIR}/n"
    s="${DOBLE_DIR}/stdin-${n}.sql"
    cat > "${s}"
    if [[ -n "${DOBLE_FALLA:-}" ]] && grep -qF -- "${DOBLE_FALLA}" "${s}"; then
      echo BEGIN; echo "ERROR:  falla del doble (${DOBLE_FALLA})" >&2; exit 3
    fi
    if grep -qF "extensions.crypt(:'clave'" "${s}"; then
      printf '%s\n' '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0'; exit 0
    fi
    if grep -q 'begin transaction read only' "${s}"; then
      echo BEGIN; echo "ledger_filas|$(cat "${DOBLE_DIR}/ledger" 2>/dev/null || echo 0)"; echo ROLLBACK; exit 0
    fi
    if grep -q '^insert into supabase_migrations.schema_migrations' "${s}"; then
      l=$(( $(cat "${DOBLE_DIR}/ledger" 2>/dev/null || echo 0) + 1 )); echo "${l}" > "${DOBLE_DIR}/ledger"
      echo BEGIN; echo "INSERT 0 1"; echo COMMIT; exit 0
    fi
    if grep -q 'semilla_conteo' "${s}"; then
      echo BEGIN; echo " semilla_conteo | 2 | 1 | 1 | 1 | 2 | 1 | 1"; echo COMMIT; exit 0
    fi
    exit 0 ;;
esac
exit 0
DOBLE
  cat > "${d}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/curl.log"
clave=0; cabeceras=0; url=""; prev=""
for a in "$@"; do
  [[ "${prev}" == "-K" ]] && cp -- "${a}" "${DOBLE_DIR}/curl-config-visto" 2>/dev/null
  case "${a}" in -K) clave=1 ;; -D) cabeceras=1 ;; https://*) url="${a}" ;; esac
  prev="${a}"
done
if [[ "${url}" == *"/auth/v1/"* ]]; then codigo="${DOBLE_CURL_API:-401}"
elif (( clave )); then codigo="${DOBLE_CURL_CON:-200}"
else codigo="${DOBLE_CURL_SIN:-401}"; fi
if (( cabeceras )); then printf 'HTTP/2 %s\r\nx-robots-tag: %s\r\n\r\n' "${codigo}" "${DOBLE_ROBOTS:-noindex, nofollow}"; exit 0; fi
printf '%s' "${codigo}"
DOBLE
  cat > "${d}/bin/getent" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/getent.log"
echo "${DOBLE_IP:-217.216.54.70}   STREAM ${2-}"
DOBLE
  chmod +x "${d}/bin/docker" "${d}/bin/curl" "${d}/bin/getent"
  export PATH="${d}/bin:${PATH}"
  export PRUEBA_ESPERA_PASO=0
}

# Cuántas veces se llamó al doble de docker (0 = no se tocó nada).
dobles_llamadas() { [[ -f "${DOBLE_DIR}/docker.log" ]] && wc -l < "${DOBLE_DIR}/docker.log" | tr -d '[:space:]' || echo 0; }
dobles_limpiar_log() { rm -f "${DOBLE_DIR}/docker.log" "${DOBLE_DIR}/curl.log" "${DOBLE_DIR}"/stdin-*.sql "${DOBLE_DIR}/n" "${DOBLE_DIR}/ledger" "${DOBLE_DIR}/curl-config-visto"; }
