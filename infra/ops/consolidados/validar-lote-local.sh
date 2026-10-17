#!/usr/bin/env bash
# infra/ops/consolidados/validar-lote-local.sh — corre un lote de consolidados (SDD-0543) ENTERO
# contra un postgres:17 local con el esquema reconstruido, antes de mandarlo al servidor.
#
# Cada corrida en el servidor destapa sólo el siguiente error del bloque DO (sesión,
# guards, alias…): acá se ven todos de una vez en ~40 s. Mismo método que
# scripts/check-schema-rebuild.mjs: stubs de plataforma + migraciones en orden
# LC_ALL=C saltando las LEDGER_ONLY; después una semilla mínima (el cliente
# sintético de la semilla de prueba y el admin ficticio) y la secuencia:
#
#   un lote:   previa → simulacro → aplicar → verificar → previa (conflictos) →
#              aplicar (aborta) → deshacer → aplicar (aborta: códigos ocupados) →
#              purgar → aplicar → verificar → purgar → conteo cero
#   dos lotes: aplicar A → verificar A → aplicar B → verificar B → purgar A (debe
#              ABORTAR: B depende de A) → purgar B → purgar A → conteo cero.
#              Es el caso de dos contenedores del mismo aliado (61 y 62 en prueba).
#
# Reglas: contenedor con nombre propio, sin puerto publicado, sin volumen con
# nombre, borrado con `docker rm -fv` al final (nada de prune global). Docker es
# una corrida pesada: pide turno al Director. La salida no lleva nombres: sólo
# códigos, conteos y NOTICEs; los literales entre «» se tapan.
#
# Uso:
#   infra/ops/consolidados/validar-lote-local.sh <carpeta del lote> [<carpeta del lote que depende>]
# Variables: REPO (checkout con supabase/, por defecto el del script), CONTENEDOR (dtd-0543-local).
set -uo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"   # Git Bash no debe convertir /sb/... a rutas de Windows
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REPO="${REPO:-${S}}"
LOTE="${1:?carpeta del lote}"; LOTE2="${2-}"
C="${CONTENEDOR:-dtd-0543-local}"
OUT="${LOTE}/local-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${OUT}"
log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "${OUT}/corrida.log"; }
tapar() { sed -E 's/«[^»]*»/«…»/g' | cut -c1-220; }
fallos=0

# La lista LEDGER_ONLY se lee con sed, no con node: con MSYS_NO_PATHCONV node no entiende /c/… .
LEDGER_ONLY="$(sed -n '/const LEDGER_ONLY = new Set(\[/,/\]);/p' "${REPO}/scripts/check-schema-rebuild.mjs" | grep -oE '"[0-9]{4}_[^"]+\.sql"' | tr -d '"' | tr '\n' ' ')"
[[ -n "${LEDGER_ONLY}" ]] || { echo "no pude leer LEDGER_ONLY de scripts/check-schema-rebuild.mjs" >&2; exit 5; }

limpiar() { docker rm -fv "${C}" >/dev/null 2>&1 || true; }
trap limpiar EXIT
limpiar
log "levantando ${C} (postgres:17, sin puerto, sin volumen con nombre)"
docker run --rm -d --name "${C}" -e POSTGRES_PASSWORD=postgres -v "${REPO}/supabase:/sb:ro" postgres:17 -c fsync=off -c full_page_writes=off >/dev/null || { log "FALLÓ docker run"; exit 5; }
for _ in $(seq 1 120); do
  [[ "$(docker exec "${C}" psql -U postgres -q -t -A -c 'select 1' 2>/dev/null)" == "1" ]] && break
  sleep 0.6
done
docker exec "${C}" sh -c 'for e in supabase_vault pg_net pgsodium pg_cron http; do d=$(pg_config --sharedir)/extension; printf "default_version = '"'"'1.0'"'"'\ncomment = '"'"'stub'"'"'\nrelocatable = true\n" > $d/$e.control; printf -- "-- stub\n" > $d/$e--1.0.sql; done'
docker exec "${C}" psql -U postgres -q --single-transaction -v ON_ERROR_STOP=1 -f /sb/tests/_supabase-platform-stubs.sql > "${OUT}/stubs.out" 2>&1 || { log "FALLÓ stubs: $(grep -m1 -E 'ERROR|error' "${OUT}/stubs.out" | tapar)"; exit 5; }
docker exec "${C}" sh -c "SKIP=\"${LEDGER_ONLY}\"; ok=0; for f in \$(ls /sb/migrations/*.sql | LC_ALL=C sort); do b=\$(basename \$f); case \" \$SKIP \" in *\" \$b \"*) continue;; esac; if psql -U postgres -q --single-transaction -v ON_ERROR_STOP=1 -f \"\$f\" >/tmp/o.txt 2>&1; then ok=\$((ok+1)); else echo \"FALLA_EN|\$b|\$ok\"; grep -m1 'ERROR:' /tmp/o.txt; exit 1; fi; done; echo \"OK|\$ok\"" > "${OUT}/migraciones.out" 2>&1
grep -q "^OK|" "${OUT}/migraciones.out" || { log "FALLÓ la reconstrucción: $(tail -2 "${OUT}/migraciones.out" | tapar)"; exit 5; }
log "esquema reconstruido: $(grep '^OK|' "${OUT}/migraciones.out" | cut -d'|' -f2) migraciones"

docker exec -i "${C}" psql -U postgres -q -v ON_ERROR_STOP=1 > "${OUT}/semilla.out" 2>&1 <<'SQL' || { log "FALLÓ semilla: $(grep -m1 ERROR "${OUT}/semilla.out" | tapar)"; exit 5; }
insert into public.clients (id, tenant_id, markbox, name, email, notes)
select '05400000-0000-4000-8000-000000000101'::uuid, t.id, 'DTD-9001', 'Cliente PRUEBA C.A.', 'cliente@prueba.example.test', 'Cliente sintético (validación local)'
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do nothing;
insert into auth.users (id, email) values ('05400000-0000-4000-8000-000000000001'::uuid, 'admin@prueba.example.test')
on conflict (id) do nothing;
SQL

lote_id() { sed -nE 's/^[[:space:]]*"lote":[[:space:]]*"([^"]+)".*$/\1/p' "$1/manifiesto.json" | head -1; }
paso() { # $1 carpeta, $2 nombre, $3 cierre esperado
  local dir="$1" n="$2" cierre="$3" rc primera ultima tag
  tag="$(basename "${dir}")-${n}"
  docker exec -i "${C}" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < "${dir}/${n}.sql" > "${OUT}/${tag}.out" 2> "${OUT}/${tag}.err"; rc=$?
  primera="$(awk 'NF { print; exit }' "${OUT}/${tag}.out")"; ultima="$(awk 'NF { l = $0 } END { print l }' "${OUT}/${tag}.out")"
  if [[ ${rc} -ne 0 ]]; then
    log "FALLÓ ${tag} (psql ${rc}): $(grep -m1 -E 'ERROR|FATAL' "${OUT}/${tag}.err" | tapar)"; fallos=$((fallos + 1)); return 1
  fi
  if [[ "${primera}" != "BEGIN" || "${ultima}" != "${cierre}" ]]; then log "FALLÓ ${tag}: salida ${primera}…${ultima}"; fallos=$((fallos + 1)); return 1; fi
  log "PASÓ ${tag} · ${cierre} · $(grep -E 'NOTICE' "${OUT}/${tag}.err" | tail -1 | sed -E 's/^.*NOTICE:  //' | tapar)"
}
debe_abortar() { # $1 carpeta, $2 nombre, $3 texto esperado en el ERROR
  local dir="$1" n="$2" esperado="$3" rc tag
  tag="$(basename "${dir}")-${n}-aborta"
  docker exec -i "${C}" psql -U postgres -X -v ON_ERROR_STOP=1 < "${dir}/${n}.sql" > "${OUT}/${tag}.out" 2> "${OUT}/${tag}.err"; rc=$?
  if [[ ${rc} -ne 0 ]] && grep -q -- "${esperado}" "${OUT}/${tag}.err"; then
    log "PASÓ ${tag} · abortó como debía: $(grep -m1 ERROR "${OUT}/${tag}.err" | tapar)"
  else
    log "FALLÓ ${tag}: rc=${rc}, se esperaba un ERROR con «${esperado}»"; fallos=$((fallos + 1))
  fi
}
restantes() { # $1 id del lote
  docker exec "${C}" psql -U postgres -q -t -A -c "select (select count(*) from public.invoices where notes like '%$1%') || ' fact · ' || (select count(*) from public.warehouse_receipts_cn where notes like '%$1%') || ' rec · ' || (select count(*) from public.shipments where notes like '%$1%') || ' env · ' || (select count(*) from public.consolidations where notes like '%$1%') || ' cons · ' || (select count(*) from public.clients where notes like 'Creado por la carga $1%') || ' cli · ' || (select count(*) from public.aliados where agreement_notes like 'Creado por la carga $1%') || ' ali · ' || (select count(*) from public.expenses where note like '%$1%') || ' gastos · ' || (select count(*) from public.entity_audit_log where correlation_id = '$1') || ' audit'"
}

A="$(lote_id "${LOTE}")"
if [[ -z "${LOTE2}" ]]; then
  paso "${LOTE}" previa ROLLBACK
  paso "${LOTE}" simulacro ROLLBACK && log "tras simulacro: $(restantes "${A}")"
  paso "${LOTE}" aplicar COMMIT && log "tras aplicar: $(restantes "${A}")"
  paso "${LOTE}" verificar ROLLBACK
  debe_abortar "${LOTE}" aplicar "preflight:"
  paso "${LOTE}" deshacer COMMIT && log "tras deshacer: $(restantes "${A}")"
  debe_abortar "${LOTE}" aplicar "BORRAD"
  paso "${LOTE}" purgar COMMIT && log "tras purgar: $(restantes "${A}")"
  paso "${LOTE}" aplicar COMMIT && paso "${LOTE}" verificar ROLLBACK
  paso "${LOTE}" purgar COMMIT && log "tras la segunda purga: $(restantes "${A}")"
else
  B="$(lote_id "${LOTE2}")"
  paso "${LOTE}" aplicar COMMIT && paso "${LOTE}" verificar ROLLBACK && log "A cargado: $(restantes "${A}")"
  paso "${LOTE2}" aplicar COMMIT && paso "${LOTE2}" verificar ROLLBACK && log "B cargado sobre A: $(restantes "${B}")"
  debe_abortar "${LOTE}" purgar "purga ese lote primero"
  paso "${LOTE2}" purgar COMMIT && log "tras purgar B: $(restantes "${B}")"
  paso "${LOTE}" purgar COMMIT && log "tras purgar A: $(restantes "${A}")"
fi
limpiar; trap - EXIT
log "docker ps -a (${C}): $(docker ps -a --format '{{.Names}}' | grep -c "^${C}$" || true) · docker volume ls (${C}): $(docker volume ls -q | grep -c "${C}" || true)"
log "fin · ${fallos} FALLÓ · evidencia local sin nombres en ${OUT}"
[[ ${fallos} -eq 0 ]]
