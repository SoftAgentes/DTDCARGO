#!/usr/bin/env bash
# infra/ops/migrate/vault-set-secret.sh — escribe un secreto de Vault en un proyecto del VPS (SDD-0505).
#
# Para después de import-from-cloud.sh: los secretos de Vault llegan cifrados con la
# raíz de Cloud, que no se exporta, así que se reescriben aquí (kommo_cron_key se
# genera de nuevo; kommo_token_dtd_v1 lo vuelve a emitir Sam en Kommo). También
# crea los que faltan (functions_base_url de la migración 0472).
#
#   · El valor se pide con `read -s` (sin eco, fuera del historial) y viaja al
#     contenedor de psql por entorno: nunca por argumento ni en un archivo.
#   · Si el secreto existe, `vault.update_secret` sobre su id (conserva el id que
#     usan las funciones); si no, `vault.create_secret`.
#   · Al final comprueba que el secreto descifra a lo que se escribió e imprime
#     solo `true`/`false`, nunca el valor.
#
# Uso (como root en el VPS):
#   vault-set-secret.sh --project <proyecto> --name <nombre> \
#       [--project-dir /srv/<proyecto>] [--network <proyecto>_dtd_internal] [--host db]
set -euo pipefail
umask 077

PROJECT=""
NAME=""
PROJECT_DIR=""
NETWORK=""
HOST="db"
PG_IMAGE="supabase/postgres:17.6.1.136"

die() {
  echo "vault-set-secret: $*" >&2
  exit 2
}

setopt() {
  local name="$1" value="${2-}"
  if [[ -n "${value}" ]]; then
    printf -v "${name}" '%s' "${value}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --name) setopt NAME "${2-}"; shift 2 ;;
    --project-dir) setopt PROJECT_DIR "${2-}"; shift 2 ;;
    --network) setopt NETWORK "${2-}"; shift 2 ;;
    --host) setopt HOST "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done

[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${NAME}" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || die "--name inválido: '${NAME}' (minúsculas, dígitos y _)"
PROJECT_DIR="${PROJECT_DIR:-/srv/${PROJECT}}"
NETWORK="${NETWORK:-${PROJECT}_dtd_internal}"
[[ -f "${PROJECT_DIR}/.env" ]] || die "no existe ${PROJECT_DIR}/.env"
PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "${PROJECT_DIR}/.env" | tail -n1 | cut -d= -f2- || true)"
PGPASSWORD="${PGPASSWORD%\"}"; PGPASSWORD="${PGPASSWORD#\"}"
[[ -n "${PGPASSWORD}" ]] || die "POSTGRES_PASSWORD vacío en ${PROJECT_DIR}/.env"
export PGPASSWORD

tty_in=/dev/stdin
if { : < /dev/tty; } 2>/dev/null; then
  tty_in=/dev/tty
fi
read -rs -p "Valor de ${NAME} (no se muestra): " SECRETO < "${tty_in}" || true
echo
[[ -n "${SECRETO}" ]] || die "valor vacío: no se escribe nada"
export SECRETO

# \getenv toma el valor del entorno del contenedor; :'v' lo cita como literal.
result="$(docker run --rm -i --network "${NETWORK}" -e PGPASSWORD -e SECRETO "${PG_IMAGE}" \
  psql -h "${HOST}" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -v nombre="${NAME}" -Atq <<'SQL'
\getenv valor SECRETO
select exists (select 1 from vault.secrets where name = :'nombre') as existe \gset
\if :existe
select vault.update_secret((select id from vault.secrets where name = :'nombre'), :'valor');
\else
select vault.create_secret(:'valor', :'nombre');
\endif
select (decrypted_secret = :'valor')::text from vault.decrypted_secrets where name = :'nombre';
SQL
)"
unset SECRETO
verdict="$(printf '%s\n' "${result}" | tail -n1)"
echo "vault-set-secret: ${NAME} en ${PROJECT} · descifra igual a lo escrito: ${verdict}"
[[ "${verdict}" == "true" ]] || exit 1
