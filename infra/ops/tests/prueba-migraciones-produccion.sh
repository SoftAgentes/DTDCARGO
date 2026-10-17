#!/usr/bin/env bash
# infra/ops/tests/prueba-migraciones-produccion.sh — prueba de infra/ops/migraciones/ con dobles (SDD-0546).
#
#   bash infra/ops/tests/prueba-migraciones-produccion.sh               # la prueba
#   bash infra/ops/tests/prueba-migraciones-produccion.sh --mutantes    # control rojo + mutantes
#   MUTANTES_SOLO="candado|md5" bash … --mutantes                       # solo los que nombran alguno
#
# Nada real: `docker`, `ssh` y `scp` son dobles en una carpeta temporal (ssh corre
# el comando en local; scp copia en local), el repositorio y las migraciones son
# inventados y el proyecto de «producción» se llama zz546 (PROD_COMPOSE_PROJECT),
# así que ni un doble roto alcanzaría un contenedor de verdad. Comprueba:
#   · preparar.mjs: rechazos y que aplicar.sql sea byte a byte mig_envolver;
#   · aplicar.sh: guardas (--confirm, migración, md5, SHA256SUMS, solo lectura,
#     envoltorio, created_by, autorización nominal, candado), en seco, el orden
#     previa → apply → verificación, los códigos 5/6/7 y la evidencia;
#   · aplicar-remoto.sh: los scripts del servidor tienen que ser los del checkout,
#     el lote para en la primera falla y no toca las siguientes, ssh caído (255).
# Las consultas SQL generadas se prueban contra PostgreSQL embebido en
# infra/ops/tests/migraciones.test.mjs.
set -uo pipefail
unset MSYS_NO_PATHCONV
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS="${MIGRACIONES_OPS_PRUEBA:-${S}}"

if [ "${1:-}" = --mutantes ]; then
  # Cada mutante quita una garantía. Si la suite sigue verde, falta una prueba
  # (o sobra el código): mutante que sobrevive.
  M="$(mktemp -d)"; trap 'rm -rf "${M}"' EXIT
  vivos=0; muertos=0
  armar() { rm -rf "${M}/ops"; mkdir -p "${M}/ops/migraciones" "${M}/ops/lib"; cp "${S}"/migraciones/* "${M}/ops/migraciones/"; cp "${S}/lib/migracion.sh" "${M}/ops/lib/"; }
  correr_suite() { MIGRACIONES_OPS_PRUEBA="${M}/ops" bash "${BASH_SOURCE[0]}" > "${M}/suite.log" 2>&1; }
  armar
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/ops/migraciones/aplicar.sh"
  printf '#!/usr/bin/env bash\nexit 0\n' > "${M}/ops/migraciones/aplicar-remoto.sh"
  if correr_suite; then echo "CONTROL ROJO FALLÓ: la suite pasa contra scripts que no hacen nada"; exit 1; fi
  echo "control rojo: contra scripts vacíos la suite falla ($(grep -c '^FALLÓ' "${M}/suite.log") FALLÓ)"
  mutar() { # $1 = nombre, $2 = archivo (en migraciones/), $3 = texto exacto, $4 = reemplazo
    local n s hay=0
    IFS='|' read -ra solos <<< "${MUTANTES_SOLO:-}"
    [ "${#solos[@]}" = 0 ] && hay=1
    for s in "${solos[@]}"; do case "$1" in *"${s}"*) hay=1 ;; esac; done
    [ "${hay}" = 1 ] || return
    n="$(perl -0ne 'BEGIN { $a = shift } $c = () = /\Q$a\E/g; print $c' -- "$3" "${S}/migraciones/$2")"
    [ "${n}" = 1 ] || { echo "MUTANTE MAL ARMADO «$1»: el texto aparece ${n} veces en $2"; vivos=$((vivos + 1)); return; }
    armar
    perl -0pe 'BEGIN { $a = shift; $b = shift } s/\Q$a\E/$b/' -- "$3" "$4" "${S}/migraciones/$2" > "${M}/ops/migraciones/$2"
    if correr_suite; then
      echo "VIVO   · $1"; vivos=$((vivos + 1))
    else
      echo "MUERTO · $1 ($(grep '^FALLÓ' "${M}/suite.log" | head -1 | cut -c1-100))"; muertos=$((muertos + 1))
    fi
  }
  A=aplicar.sh; R=aplicar-remoto.sh; G=preparar.mjs
  mutar "preparar envuelve un archivo con CR" "${G}" 'if (motivos.length) throw new Rechazo(motivos.join("; "));' 'if (false) throw new Rechazo(motivos.join("; "));'
  mutar "preparar acepta un preflight que escribe" "${G}" 'if (conEscritura.length) {' 'if (false) {'
  mutar "preparar pisa una carpeta" "${G}" 'if (fs.existsSync(o.salida)) throw' 'if (false) throw'
  mutar "sin --confirm" "${A}" '[[ "${CONFIRM}" == "${PROYECTO}" ]] || refuse' 'true || refuse'
  mutar "acepta cualquier proyecto" "${A}" '[[ "${PROYECTO}" == "${PROD}" || "${PROYECTO}" == *-staging ]] || refuse' 'true || refuse'
  mutar "sin autorización en producción" "${A}" '[[ -n "${AUTORIZACION}" ]] || refuse "aplicar en producción' 'true || refuse "aplicar en producción'
  mutar "autorización que no nombra" "${A}" '|| refuse "la autorización no nombra la ${NUM}' '|| true "la autorización no nombra la ${NUM}'
  mutar "autorización con número contenido" "${A}" 'grep -qE "(^|[^0-9A-Za-z])${NUM}([^0-9A-Za-z]|$)"' 'grep -qE "${NUM}"'
  mutar "sin SHA256SUMS" "${A}" '|| integridad "SHA256SUMS no coincide en ${PAQUETE}"' '|| true'
  mutar "paquete de otra migración" "${A}" '[[ "$(ident nombre)" == "${MIGRACION}" ]] || refuse' 'true || refuse'
  mutar "paquete de otro proyecto" "${A}" '[[ "$(ident proyecto)" == "${PROYECTO}" ]] || refuse' 'true || refuse'
  mutar "created_by de otro destino" "${A}" '[[ "$(ident created_by)" == "${esperado}" ]] || refuse' 'true || refuse'
  mutar "sin md5" "${A}" '[[ "${real}" == "${MD5}" ]] || integridad' 'true || integridad'
  mutar "previa que escribe" "${A}" '[[ "${primera}" == "begin transaction read only;" && "${ultima}" == "rollback;" ]] || refuse' 'true || refuse'
  mutar "sin envoltorio" "${A}" '[[ "$(mig_md5 "${tmp_env}")" == "${real}" ]] || refuse' 'true || refuse'
  mutar "sin candado" "${A}" 'mkdir -- "${CANDADO}" 2> /dev/null || refuse' 'true || refuse'
  mutar "el en seco toca la base" "${A}" 'if (( EN_SECO )); then' 'if false; then'
  mutar "aplica aunque la previa falle" "${A}" '  cerrar; exit 5' '  true'
  mutar "previa sin su marca" "${A}" '|| ! grep -qF "PREVIA ${MIGRACION} OK" "${EVID}/previa.out"; then' '; then'
  mutar "apply sin COMMIT" "${A}" '! mig_salida_ok "${EVID}/aplicar.out" COMMIT ||' ''
  mutar "apply sin fila del ledger" "${A}" '|| ! grep -qx '"'"'INSERT 0 1'"'"' "${EVID}/aplicar.out"; then' '; then'
  mutar "verificación que no frena" "${A}" '  cerrar; exit 7' '  true'
  mutar "sin VERBOSITY terse" "${A}" ' -v VERBOSITY=terse' ''
  mutar "evidencia sin SHA256SUMS" "${A}" 'xargs sha256sum -- > SHA256SUMS' 'true'
  mutar "el remoto no compara los scripts" "${R}" 'if [[ "${r_aplicar}" != "${LOCAL_APLICAR}" || "${r_lib}" != "${LOCAL_LIB}" ]]; then' 'if false; then'
  mutar "el lote sigue tras una falla" "${R}" '    exit "${rc}"' '    true'
  mutar "el remoto no nombra cada una" "${R}" '|| refuse "la autorización no nombra la ${n}' '|| true "la autorización no nombra la ${n}'
  mutar "el remoto acepta otra migración" "${R}" '[[ "${nombre}" == "${e}" ]] || refuse' 'true || refuse'
  mutar "el remoto en seco conecta" "${R}" 'if (( EN_SECO )); then' 'if false; then'
  mutar "ssh caído como falla normal" "${R}" '  if (( rc == 255 )); then' '  if false; then'
  echo "RESULTADO MUTANTES: ${muertos} muertos · ${vivos} vivos"
  [ "${vivos}" = 0 ]; exit
fi

T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
md5() { md5sum < "$1" | cut -c1-32; }
export PROD_COMPOSE_PROJECT=zz546 DOBLE_DIR="${T}/doble" MIGRACIONES_CANDADO="${T}/candado"
P=zz546
mkdir -p "${DOBLE_DIR}" "${T}/bin"

# ── Dobles ─────────────────────────────────────────────────────────────────────
cat > "${T}/bin/docker" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/docker.log"
case "${1-}" in
  inspect) [[ -e "${DOBLE_DIR}/caido" ]] && exit 1; echo true; exit 0 ;;
  exec)
    n=$(( $(cat "${DOBLE_DIR}/n" 2>/dev/null || echo 0) + 1 )); echo "${n}" > "${DOBLE_DIR}/n"
    s="${DOBLE_DIR}/stdin-${n}.sql"; cat > "${s}"
    if [[ -n "${DOBLE_FALLA-}" ]] && grep -qF -- "${DOBLE_FALLA}" "${s}"; then
      echo BEGIN; echo "psql:<stdin>:9: ERROR:  falla del doble (${DOBLE_FALLA})" >&2; exit 3
    fi
    marca="$(grep -oE "'(PREVIA|VERIFICACIÓN) [0-9a-z_]+ OK'" "${s}" | head -n1 | tr -d "'")"
    if grep -q '^begin transaction read only;$' "${s}"; then
      echo BEGIN; echo SET; [[ -n "${DOBLE_SIN_MARCA-}" ]] || printf ' %s\n' "${marca}"; echo ROLLBACK; exit 0
    fi
    if grep -q '^insert into supabase_migrations.schema_migrations' "${s}"; then
      echo BEGIN; echo "CREATE FUNCTION"; [[ -n "${DOBLE_SIN_INSERT-}" ]] || echo "INSERT 0 1"
      if [[ -n "${DOBLE_SIN_COMMIT-}" ]]; then echo ROLLBACK; else echo COMMIT; fi
      exit 0
    fi
    exit 0 ;;
esac
exit 0
DOBLE
cat > "${T}/bin/ssh" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/ssh.log"
while [[ "${1-}" == -* ]]; do case "$1" in -o) shift 2 ;; *) shift ;; esac; done
shift # host
if [[ -n "${DOBLE_SSH_CAE-}" && "$*" == *"${DOBLE_SSH_CAE}"* ]]; then exit 255; fi
exec bash -c "$*"
DOBLE
cat > "${T}/bin/scp" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/scp.log"
a=()
while [[ $# -gt 0 ]]; do case "$1" in -o) shift 2 ;; -q|-r|-p) shift ;; *) a+=("$1"); shift ;; esac; done
d="${a[${#a[@]}-1]}"; unset 'a[${#a[@]}-1]'
cp -- "${a[@]}" "${d#*:}"
DOBLE
chmod +x "${T}/bin/docker" "${T}/bin/ssh" "${T}/bin/scp"
export PATH="${T}/bin:${PATH}"
llamadas() { [[ -f "${DOBLE_DIR}/$1.log" ]] && wc -l < "${DOBLE_DIR}/$1.log" | tr -d '[:space:]' || echo 0; }
limpiar() { rm -f "${DOBLE_DIR}"/*.log "${DOBLE_DIR}"/stdin-*.sql "${DOBLE_DIR}/n"; }
primeras() { for f in "${DOBLE_DIR}"/stdin-*.sql; do [[ -f "${f}" ]] && awk 'NF && $0 !~ /^[[:space:]]*(--|\\)/ { print; exit }' "${f}"; done | tr '\n' '|'; }

# ── Repositorio inventado ──────────────────────────────────────────────────────
FX="${T}/repo"; mkdir -p "${FX}/supabase/migrations"
cat > "${FX}/supabase/migrations/0901_zz_base.sql" <<'SQL'
create or replace function public.zz_f() returns int language sql as $$ select 1 $$;
SQL
cat > "${FX}/supabase/migrations/0902_zz_buena.sql" <<'SQL'
-- 0902 · SDD-0546 — prueba. ⚠️ NO APLICADA A PRODUCCIÓN.
set lock_timeout = '5s';
do $preflight$
begin
  if to_regprocedure('public.zz_f()') is null then
    raise exception '0902 requiere public.zz_f()';
  end if;
end;
$preflight$;
create or replace function public.zz_f() returns int language sql as $$ select 2 $$;
create function public.zz_g() returns text language plpgsql as $function$
begin
  return 'g';
end;
$function$;
reset lock_timeout;
SQL
cat > "${FX}/supabase/migrations/0903_zz_otra.sql" <<'SQL'
-- 0903 · SDD-0546 — prueba. ⚠️ NO APLICADA A PRODUCCIÓN.
create table public.zz_otra (id int primary key);
SQL
cat > "${FX}/supabase/migrations/0904_zz_preflight_escribe.sql" <<'SQL'
do $preflight$
begin
  update public.zz_otra set id = id;
end;
$preflight$;
SQL
printf 'create table public.zz_cr (id int);\r\n' > "${FX}/supabase/migrations/0905_zz_cr.sql"
cat > "${FX}/supabase/migrations-baseline.json" <<'JSON'
{
  "cutoff": 238,
  "pendingBelowCutoff": {
    "0902_zz_buena": "PENDIENTE DE APLICAR — prueba"
  }
}
JSON
git -C "${FX}" init -q
git -C "${FX}" config core.autocrlf false
git -C "${FX}" add -A && git -C "${FX}" -c user.email=prueba@example.test -c user.name=prueba commit -qm fixture
SHA="$(git -C "${FX}" rev-parse HEAD)"
prep() { node "${OPS}/migraciones/preparar.mjs" --repo "${FX}" --sha "${SHA}" --sdd 0546 "$@"; }

echo "== preparar.mjs"
prep --migracion 0902_zz_buena --salida "${T}/p2" > "${T}/p2.log" 2>&1; rc=$?
[[ ${rc} -eq 0 ]] && ok "prepara 0902 (0)" || { ko "preparar 0902 rc=${rc}"; cat "${T}/p2.log"; }
( cd "${T}/p2" 2>/dev/null && sha256sum --check --quiet --strict SHA256SUMS ) && ok "SHA256SUMS del paquete" || ko "SHA256SUMS del paquete"
cmp -s "${T}/p2/migracion.sql" "${FX}/supabase/migrations/0902_zz_buena.sql" && ok "migracion.sql es el blob exacto" || ko "migracion.sql distinto del blob"
( source "${S}/lib/migracion.sh"; mig_envolver "${T}/p2/migracion.sql" 0902_zz_buena "servidor-propio:psql:SDD-0546" "${MIG_VERSION_RELOJ}" "${T}/env-bash.sql" )
cmp -s "${T}/env-bash.sql" "${T}/p2/aplicar.sql" && ok "aplicar.sql es byte a byte el mig_envolver de lib/migracion.sh" || ko "aplicar.sql distinto de mig_envolver"
grep -qx 'created_by=servidor-propio:psql:SDD-0546' "${T}/p2/IDENTIDAD.txt" && grep -qx 'espera_declarada=sí' "${T}/p2/IDENTIDAD.txt" \
  && grep -qx 'preflight_propio=incluido' "${T}/p2/IDENTIDAD.txt" && grep -qx 'funciones_reemplazadas=public.zz_f,public.zz_g' "${T}/p2/IDENTIDAD.txt" \
  && ok "IDENTIDAD: created_by de producción, espera declarada, preflight propio y funciones" || { ko "IDENTIDAD.txt"; cat "${T}/p2/IDENTIDAD.txt"; }
grep -q "md5 de aplicar.sql: $(md5 "${T}/p2/aplicar.sql")" "${T}/p2.log" && grep -qx "aplicar_md5=$(md5 "${T}/p2/aplicar.sql")" "${T}/p2/IDENTIDAD.txt" \
  && ok "la salida y la identidad dan el md5 de aplicar.sql" || ko "md5 de aplicar.sql"
grep -qF "raise exception '0902 requiere public.zz_f()';" "${T}/p2/previa.sql" && grep -qF 'do $deriva$' "${T}/p2/previa.sql" \
  && ok "la lectura previa lleva la deriva y el preflight propio" || ko "previa sin deriva o sin preflight"
prep --migracion 0903_zz_otra --salida "${T}/p3" > /dev/null 2>&1 && ok "prepara 0903 (0)" || ko "preparar 0903"
prep --migracion 0902_zz_buena --salida "${T}/p2s" --proyecto zz546-staging > /dev/null 2>&1 && grep -qx 'created_by=servidor-propio:psql:prueba:SDD-0546' "${T}/p2s/IDENTIDAD.txt" \
  && ok "para un -staging, created_by de prueba" || ko "created_by de staging"
prep --migracion 0902_zz_buena --salida "${T}/r1" --proyecto zz-otro > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && ! -e "${T}/r1" ]] && ok "proyecto que no es producción ni -staging: rechaza (3)" || ko "proyecto ajeno rc=${rc}"
prep --migracion 0905_zz_cr --salida "${T}/r2" > "${T}/r2.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && ! -e "${T}/r2" ]] && grep -q 'CR' "${T}/r2.log" && ok "archivo con CR: rechaza (3)" || ko "CR rc=${rc}"
prep --migracion 0904_zz_preflight_escribe --salida "${T}/r3" > "${T}/r3.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && ! -e "${T}/r3" ]] && grep -q 'update' "${T}/r3.log" && ok "preflight propio con escritura: rechaza (3)" || ko "preflight que escribe rc=${rc}"
prep --migracion 0904_zz_preflight_escribe --salida "${T}/r3b" --sin-preflight-propio > /dev/null 2>&1 && grep -qx 'preflight_propio=omitido (--sin-preflight-propio)' "${T}/r3b/IDENTIDAD.txt" \
  && ! grep -q 'update public' "${T}/r3b/previa.sql" && ok "--sin-preflight-propio lo omite y lo deja en IDENTIDAD" || ko "--sin-preflight-propio"
prep --migracion 0902_zz_buena --salida "${T}/r4" --acepta-deriva public.zz_otra_cosa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "--acepta-deriva de una función que no crea: rechaza (3)" || ko "acepta-deriva ajena rc=${rc}"
prep --migracion 0999_no_existe --salida "${T}/r5" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "migración que no existe en el sha: rechaza (3)" || ko "no existe rc=${rc}"
node "${OPS}/migraciones/preparar.mjs" --repo "${FX}" --sha abc --migracion 0902_zz_buena --sdd 0546 --salida "${T}/r6" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "sha corto: uso inválido (2)" || ko "sha corto rc=${rc}"
prep --migracion 0902_zz_buena --salida "${T}/p2" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "carpeta de salida que ya existe: uso inválido (2)" || ko "salida existente rc=${rc}"

# ── aplicar.sh ─────────────────────────────────────────────────────────────────
AP="${OPS}/migraciones/aplicar.sh"
MD5_2="$(md5 "${T}/p2/aplicar.sql")"
printf 'Sam, literal: «autorizo aplicar 0902_zz_buena en el servidor propio»\n' > "${T}/ok-0902.txt"
printf 'Sam, literal: «autorizo aplicar 0902_zz_buena y 0903_zz_otra en el servidor propio»\n' > "${T}/ok-ambas.txt"
printf 'Sam, literal: «aplica la 09021 y la 10902»\n' > "${T}/ok-contenido.txt"
printf 'Sam: «dale»\n' > "${T}/ok-suelto.txt"
ap() { bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0902_zz_buena --paquete "${T}/p2" --md5 "${MD5_2}" "$@"; }

echo "== aplicar.sh: guardas (ninguna llega a docker)"
limpiar
bash "${AP}" --proyecto "${P}" --migracion 0902_zz_buena --paquete "${T}/p2" --md5 "${MD5_2}" --paso previa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "sin --confirm: rechaza (3)" || ko "sin --confirm rc=${rc}"
ap --confirm otro --paso previa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "--confirm distinto del proyecto: rechaza (3)" || ko "--confirm distinto rc=${rc}"
bash "${AP}" --proyecto zz-otro --confirm zz-otro --migracion 0902_zz_buena --paquete "${T}/p2" --md5 "${MD5_2}" --paso previa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "proyecto que no es producción ni -staging: rechaza (3)" || ko "proyecto ajeno rc=${rc}"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0903_zz_otra --paquete "${T}/p2" --md5 "${MD5_2}" --paso previa > "${T}/g0.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'el paquete es de 0902_zz_buena, no de 0903_zz_otra' "${T}/g0.log" && ok "paquete de otra migración que la esperada: rechaza (3) y lo dice" || ko "migración cruzada rc=${rc}"
# Un paquete adulterado para un proyecto que no es producción ni -staging (preparar no lo arma).
cp -r "${T}/p2s" "${T}/p2-ajeno"; sed -i 's/^proyecto=.*/proyecto=zz-otro/' "${T}/p2-ajeno/IDENTIDAD.txt"
( cd "${T}/p2-ajeno" && sha256sum migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt > SHA256SUMS )
bash "${AP}" --proyecto zz-otro --confirm zz-otro --migracion 0902_zz_buena --paquete "${T}/p2-ajeno" --md5 "$(md5 "${T}/p2-ajeno/aplicar.sql")" --paso previa --evidencias "${T}/ev-ajeno" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && ! -e "${T}/ev-ajeno" ]] && ok "paquete adulterado para otro proyecto (ni producción ni -staging): rechaza (3)" || ko "proyecto ajeno con paquete propio rc=${rc}"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --paquete "${T}/p2" --md5 "${MD5_2}" --paso previa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "sin --migracion: uso inválido (2)" || ko "sin --migracion rc=${rc}"
ap --md5 0123456789abcdef0123456789abcdef --paso previa > "${T}/g1.log" 2>&1; rc=$?
[[ ${rc} -eq 4 ]] && grep -q 'el md5 de aplicar.sql es' "${T}/g1.log" && ok "md5 que no coincide: integridad (4)" || ko "md5 malo rc=${rc}"
bash "${AP}" --proyecto "${P}-staging" --confirm "${P}-staging" --migracion 0902_zz_buena --paquete "${T}/p2" --md5 "${MD5_2}" --paso previa > "${T}/g00.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q "se preparó para ${P}, no para ${P}-staging" "${T}/g00.log" && ok "paquete de producción en un -staging: rechaza (3) y lo dice" || ko "paquete cruzado de proyecto rc=${rc}"
cp -r "${T}/p2" "${T}/p2-alterado"; printf ' ' >> "${T}/p2-alterado/previa.sql"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0902_zz_buena --paquete "${T}/p2-alterado" --md5 "${MD5_2}" --paso previa > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 4 ]] && ok "SHA256SUMS que no coincide: integridad (4)" || ko "SHA256SUMS roto rc=${rc}"
resumar() { ( cd "$1" && sha256sum migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt > SHA256SUMS ); }
cp -r "${T}/p2" "${T}/p2-escribe"; sed -i 's/^begin transaction read only;$/begin;/' "${T}/p2-escribe/previa.sql"; resumar "${T}/p2-escribe"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0902_zz_buena --paquete "${T}/p2-escribe" --md5 "${MD5_2}" --paso previa > "${T}/g2.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'no es de solo lectura' "${T}/g2.log" && ok "previa.sql que no es de solo lectura: rechaza (3)" || ko "previa que escribe rc=${rc}"
cp -r "${T}/p2" "${T}/p2-otro"; printf 'drop table public.clientes;\n' >> "${T}/p2-otro/aplicar.sql"
M_OTRO="$(md5 "${T}/p2-otro/aplicar.sql")"; sed -i "s/^aplicar_md5=.*/aplicar_md5=${M_OTRO}/" "${T}/p2-otro/IDENTIDAD.txt"; resumar "${T}/p2-otro"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0902_zz_buena --paquete "${T}/p2-otro" --md5 "${M_OTRO}" --paso previa > "${T}/g3.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'no es el envoltorio de migracion.sql' "${T}/g3.log" && ok "aplicar.sql que no es el envoltorio del blob: rechaza (3)" || ko "envoltorio alterado rc=${rc}"
cp -r "${T}/p2" "${T}/p2-cb"; sed -i 's/^created_by=.*/created_by=servidor-propio:psql:prueba:SDD-0546/' "${T}/p2-cb/IDENTIDAD.txt"; resumar "${T}/p2-cb"
bash "${AP}" --proyecto "${P}" --confirm "${P}" --migracion 0902_zz_buena --paquete "${T}/p2-cb" --md5 "${MD5_2}" --paso previa > "${T}/g4.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'created_by' "${T}/g4.log" && ok "created_by de prueba en producción: rechaza (3)" || ko "created_by cruzado rc=${rc}"
ap > "${T}/g5.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'exige --autorizacion' "${T}/g5.log" && ok "aplicar en producción sin autorización: rechaza (3)" || ko "sin autorización rc=${rc}"
ap --autorizacion "${T}/ok-suelto.txt" > "${T}/g6.log" 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && grep -q 'no nombra la 0902' "${T}/g6.log" && ok "un «dale» no nombra la migración: rechaza (3)" || ko "autorización suelta rc=${rc}"
ap --autorizacion "${T}/ok-contenido.txt" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "«09021» o «10902» no nombran la 0902: rechaza (3)" || ko "número contenido rc=${rc}"
ap --autorizacion "${T}/no-existe.txt" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 ]] && ok "autorización que no existe: rechaza (3)" || ko "autorización inexistente rc=${rc}"
[[ "$(llamadas docker)" == 0 ]] && ok "ninguna guarda llamó a docker" || ko "una guarda llamó a docker: $(cat "${DOBLE_DIR}/docker.log")"

echo "== aplicar.sh: en seco y lectura previa sola"
ap --autorizacion "${T}/ok-0902.txt" --en-seco --evidencias "${T}/ev0" > "${T}/s1.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(llamadas docker)" == 0 && ! -e "${T}/ev0" ]] && grep -q 'EN SECO' "${T}/s1.log" && grep -q "docker exec -i ${P}-db-1 psql" "${T}/s1.log" \
  && ok "--en-seco: comprueba todo, imprime los comandos y no toca docker ni la evidencia" || { ko "en seco rc=${rc}"; cat "${T}/s1.log"; }
limpiar
ap --paso previa --evidencias "${T}/ev1" > "${T}/s2.log" 2>&1; rc=$?
EV1="$(ls -d "${T}"/ev1/previa-0902-"${P}"-* 2>/dev/null | head -n1)"
[[ ${rc} -eq 0 && -n "${EV1}" && "$(primeras)" == "begin transaction read only;|" ]] && ok "--paso previa: solo la lectura previa, sin autorización, evidencia previa-0902-…" || { ko "previa sola rc=${rc}"; cat "${T}/s2.log"; }
[[ -n "${EV1}" ]] && ( cd "${EV1}" && sha256sum --check --quiet SHA256SUMS ) && [[ ! -e "${EV1}/aplicar.sql" ]] && ok "la evidencia de la previa tiene SHA256SUMS y no lleva el apply" || ko "evidencia de la previa"

echo "== aplicar.sh: aplicar"
limpiar
ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev2" > "${T}/a1.log" 2>&1; rc=$?
EV2="$(ls -d "${T}"/ev2/apply-0902-"${P}"-* 2>/dev/null | head -n1)"
[[ ${rc} -eq 0 && -n "${EV2}" ]] && grep -q 'PASÓ apply: COMMIT con la fila del ledger' "${T}/a1.log" && grep -q 'PASÓ verificación' "${T}/a1.log" \
  && ok "aplicar: previa, apply y verificación PASÓ (0)" || { ko "aplicar rc=${rc}"; cat "${T}/a1.log"; }
[[ "$(primeras)" == "begin transaction read only;|begin;|begin transaction read only;|" ]] && ok "orden en la base: lectura previa, apply, verificación" || ko "orden $(primeras)"
grep -q "exec -i ${P}-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never" "${DOBLE_DIR}/docker.log" \
  && ok "psql como postgres en ${P}-db-1, sin psqlrc, ON_ERROR_STOP, VERBOSITY terse y SHOW_CONTEXT never" || ko "comando de psql: $(cat "${DOBLE_DIR}/docker.log")"
cmp -s "${DOBLE_DIR}/stdin-2.sql" "${T}/p2/aplicar.sql" && ok "a la base le llega aplicar.sql tal cual" || ko "el apply no es aplicar.sql"
[[ -n "${EV2}" ]] && ( cd "${EV2}" && sha256sum --check --quiet --strict SHA256SUMS ) && [[ -f "${EV2}/AUTORIZACION.txt" && -f "${EV2}/registro.txt" && -f "${EV2}/aplicar.out" && -f "${EV2}/verificar.out" ]] \
  && ok "evidencia apply-0902-${P}-<ts>/ con autorización, registro, salidas y SHA256SUMS" || ko "evidencia incompleta"
[[ -n "${EV2}" ]] && [[ "$(cd "${EV2}" && LC_ALL=C ls | tr '\n' ' ')" == "AUTORIZACION.txt IDENTIDAD.txt SHA256SUMS aplicar.err aplicar.out aplicar.sql migracion.sql previa.err previa.out previa.sql registro.txt verificar.err verificar.out verificar.sql " ]] \
  && ok "la evidencia lleva solo scripts, salidas de psql, identidad, autorización y registro" || ko "archivos de la evidencia: $(ls "${EV2}" 2>/dev/null | tr '\n' ' ')"
[[ ! -e "${MIGRACIONES_CANDADO}" ]] && ok "el candado se libera al terminar" || ko "quedó el candado"

echo "== aplicar.sh: fallas"
limpiar
DOBLE_FALLA="'PREVIA 0902" ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev3" > "${T}/f1.log" 2>&1; rc=$?
[[ ${rc} -eq 5 && "$(primeras)" == "begin transaction read only;|" ]] && grep -q 'FALLÓ la lectura previa' "${T}/f1.log" && grep -q 'falla del doble' "${T}/f1.log" \
  && ok "lectura previa que falla: sale 5, no aplica y muestra el ERROR" || { ko "previa que falla rc=${rc}"; cat "${T}/f1.log"; }
limpiar
DOBLE_SIN_MARCA=1 ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev4" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 5 && "$(primeras)" == "begin transaction read only;|" ]] && ok "previa que termina en ROLLBACK sin «PREVIA … OK»: sale 5 y no aplica" || ko "previa sin marca rc=${rc}"
limpiar
DOBLE_FALLA="insert into supabase_migrations" ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev5" > "${T}/f2.log" 2>&1; rc=$?
[[ ${rc} -eq 6 && "$(primeras)" == "begin transaction read only;|begin;|" ]] && grep -q 'FALLÓ el apply' "${T}/f2.log" \
  && ok "apply que falla: sale 6 y no corre la verificación" || { ko "apply que falla rc=${rc}"; cat "${T}/f2.log"; }
limpiar
DOBLE_SIN_INSERT=1 ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev6" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && ok "COMMIT sin «INSERT 0 1» (sin fila del ledger): sale 6" || ko "sin insert rc=${rc}"
limpiar
DOBLE_SIN_COMMIT=1 ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev6b" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 6 && "$(primeras)" == "begin transaction read only;|begin;|" ]] && ok "psql sale 0 pero termina en ROLLBACK: sale 6 y no verifica" || ko "sin COMMIT rc=${rc}"
limpiar
DOBLE_FALLA="'VERIFICACIÓN 0902" ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev7" > "${T}/f3.log" 2>&1; rc=$?
[[ ${rc} -eq 7 ]] && grep -q 'SE APLICÓ' "${T}/f3.log" && ok "verificación que falla: sale 7 y avisa que ya se aplicó" || { ko "verificación que falla rc=${rc}"; cat "${T}/f3.log"; }
limpiar
mkdir "${MIGRACIONES_CANDADO}"
ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev8" > "${T}/f4.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(llamadas docker)" == 0 && -d "${MIGRACIONES_CANDADO}" ]] && grep -q 'otra aplicación en curso' "${T}/f4.log" \
  && ok "candado tomado: rechaza (3), no toca docker y no borra el candado ajeno" || ko "candado rc=${rc}"
rmdir "${MIGRACIONES_CANDADO}"
touch "${DOBLE_DIR}/caido"
ap --autorizacion "${T}/ok-0902.txt" --evidencias "${T}/ev9" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 && ! -e "${MIGRACIONES_CANDADO}" ]] && ok "contenedor caído: sale 2 y libera el candado" || ko "contenedor caído rc=${rc}"
rm -f "${DOBLE_DIR}/caido"

# ── aplicar-remoto.sh ──────────────────────────────────────────────────────────
echo "== aplicar-remoto.sh"
SRV="${T}/srv/ops"
instalar() { rm -rf "${SRV}"; mkdir -p "${SRV}/migraciones" "${SRV}/lib" "${SRV}/evidencias"; cp "${OPS}/migraciones/aplicar.sh" "${SRV}/migraciones/"; cp "${OPS}/lib/migracion.sh" "${SRV}/lib/"; }
export MIGRACIONES_OPS_REMOTO="${SRV}"
RM="${OPS}/migraciones/aplicar-remoto.sh"
rem() { bash "${RM}" --host root@zz.invalid --proyecto "${P}" --confirm "${P}" "$@"; }
instalar; limpiar
rem --esperada 0902_zz_buena --paquete "${T}/p2" --esperada 0903_zz_otra --paquete "${T}/p3" --autorizacion "${T}/ok-ambas.txt" --en-seco > "${T}/x0.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(llamadas ssh)" == 0 && "$(llamadas scp)" == 0 ]] && grep -q 'EN SECO' "${T}/x0.log" && ok "remoto --en-seco: sin ssh ni scp" || { ko "remoto en seco rc=${rc}"; cat "${T}/x0.log"; }
rem --esperada 0902_zz_buena --paquete "${T}/p2" --esperada 0903_zz_otra --paquete "${T}/p3" --autorizacion "${T}/ok-0902.txt" > "${T}/x1.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(llamadas ssh)" == 0 ]] && grep -q 'no nombra la 0903' "${T}/x1.log" && ok "remoto: la autorización tiene que nombrar cada una, antes de conectar (3)" || ko "remoto autorización parcial rc=${rc}"
rem --esperada 0903_zz_otra --paquete "${T}/p2" --autorizacion "${T}/ok-ambas.txt" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(llamadas ssh)" == 0 ]] && ok "remoto: paquete de otra migración que la esperada (3)" || ko "remoto cruzado rc=${rc}"
rem --esperada 0902_zz_buena --paquete "${T}/p2" --paquete "${T}/p3" --autorizacion "${T}/ok-ambas.txt" > /dev/null 2>&1; rc=$?
[[ ${rc} -eq 2 ]] && ok "remoto: un --paquete sin su --esperada es uso inválido (2)" || ko "remoto desalineado rc=${rc}"
printf '\n# instalado a mano\n' >> "${SRV}/migraciones/aplicar.sh"
rem --esperada 0902_zz_buena --paquete "${T}/p2" --autorizacion "${T}/ok-0902.txt" > "${T}/x2.log" 2>&1; rc=$?
[[ ${rc} -eq 3 && "$(llamadas scp)" == 0 && "$(llamadas docker)" == 0 ]] && grep -q 'no son los de este checkout' "${T}/x2.log" \
  && ok "remoto: si el servidor no tiene el aplicar.sh de este checkout, no copia ni aplica (3)" || { ko "remoto scripts distintos rc=${rc}"; cat "${T}/x2.log"; }
instalar; limpiar
rem --esperada 0902_zz_buena --paquete "${T}/p2" --esperada 0903_zz_otra --paquete "${T}/p3" --autorizacion "${T}/ok-ambas.txt" > "${T}/x3.log" 2>&1; rc=$?
n_ev="$(ls -d "${SRV}"/evidencias/apply-090[23]-"${P}"-* 2>/dev/null | wc -l | tr -d ' ')"
[[ ${rc} -eq 0 && "${n_ev}" == 2 ]] && grep -q '2 de 2 · paso aplicar PASÓ' "${T}/x3.log" && ok "remoto: lote de dos, cada una con su evidencia (0)" || { ko "remoto lote rc=${rc} evidencias=${n_ev}"; cat "${T}/x3.log"; }
[[ "$(primeras)" == "begin transaction read only;|begin;|begin transaction read only;|begin transaction read only;|begin;|begin transaction read only;|" ]] \
  && ok "remoto: de a una, en orden (previa, apply y verificación de la 0902 y después de la 0903)" || ko "orden del lote $(primeras)"
ls "${SRV}"/paquetes/migraciones/0902_zz_buena-*/AUTORIZACION.txt > /dev/null 2>&1 && ok "remoto: la autorización viaja con el paquete" || ko "sin AUTORIZACION.txt en el servidor"
instalar; limpiar
DOBLE_FALLA='array[$mig0902$' rem --esperada 0902_zz_buena --paquete "${T}/p2" --esperada 0903_zz_otra --paquete "${T}/p3" --autorizacion "${T}/ok-ambas.txt" > "${T}/x4.log" 2>&1; rc=$?
[[ ${rc} -eq 6 ]] && grep -q 'PARADO en 0902_zz_buena' "${T}/x4.log" && ! ls "${SRV}"/paquetes/migraciones/0903_zz_otra-* > /dev/null 2>&1 \
  && ok "remoto: si falla la primera (6), para y no copia ni aplica la segunda" || { ko "remoto lote con falla rc=${rc}"; cat "${T}/x4.log"; }
instalar; limpiar
DOBLE_SSH_CAE="--paso aplicar" rem --esperada 0902_zz_buena --paquete "${T}/p2" --autorizacion "${T}/ok-0902.txt" > "${T}/x5.log" 2>&1; rc=$?
[[ ${rc} -eq 255 ]] && grep -q 'no se sabe si se aplicó' "${T}/x5.log" && ok "remoto: ssh caído (255) avisa que no se sabe si se aplicó" || { ko "ssh caído rc=${rc}"; cat "${T}/x5.log"; }
instalar; limpiar
rem --esperada 0902_zz_buena --paquete "${T}/p2" --paso previa > "${T}/x6.log" 2>&1; rc=$?
[[ ${rc} -eq 0 && "$(primeras)" == "begin transaction read only;|" ]] && ok "remoto --paso previa: sin autorización, solo la lectura previa" || { ko "remoto previa rc=${rc}"; cat "${T}/x6.log"; }

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[[ "${fail}" == 0 ]]
