#!/usr/bin/env bash
# infra/ops/tests/prueba-traslado-y-respaldos.sh — prueba de integración de infra/ops (SDD-0505).
#
# Las cuatro condiciones previas a exportar producción (revisión del traslado,
# docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md §5):
#   C1 dump cifrado con age (pg-dump-to-s3.sh, restore.sh)
#   C2 respaldo de configuración con la raíz de Vault (config-backup.sh, restore-test.sh)
#   C3 traslado desde "Cloud" (import-from-cloud.sh, vault-set-secret.sh) contra un
#      supabase/postgres desechable sembrado como producción: default privileges
#      cerrados, public y ledger creados por postgres
#   C4 staging efímero (destroy-staging.sh)
#   CORTE import-from-cloud --corte contra una «producción» falsa (c4p): confirmación
#      escrita, logs con datos, pg_cron como en Cloud y Vault copiado y verificado
#   DR permisos de public en un restore sobre la base de la imagen (lib/acl.sh,
#      restore.sh, restore-test.sh --dr): control rojo sin igualar y verde igualando
#
# Corre como root en un host Linux con Docker (el VPS), NUNCA con datos reales: todo
# es sintético y desechable (contenedores/redes/volúmenes c4*, /srv/ops/bench/c4 y
# /dev/shm/c4key) y se borra al terminar. Instala `age` y la CLI de Supabase fijada
# (sha256 verificado) si faltan. Uso: bash infra/ops/tests/prueba-traslado-y-respaldos.sh
# Termina con «RESULTADO: N PASÓ · M FALLÓ»; sale 1 si algo falló.
set -uo pipefail
T=/srv/ops/bench/c4
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K=/dev/shm/c4key
IMG=supabase/postgres:17.6.1.136
RC=rclone/rclone:1.75.1
CLI_VER=2.118.0
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
ip_of() { docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"; }
wait_ready() {
  local streak=0
  for i in $(seq 1 150); do
    if docker exec "$1" psql -U postgres -h localhost -Atc "select 1 from pg_roles where rolname='supabase_admin'" 2>/dev/null | grep -q 1; then
      streak=$((streak+1)); [ $streak -ge 5 ] && return 0
    else streak=0; fi
    sleep 1
  done
  return 1
}
asadmin() { docker exec -i "$1" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -Atq "${@:2}"; }
# Contenedores de corridas de ESTA prueba (valor de la etiqueta c4… o restore-test…):
# un import, backup o restore real que corra en el mismo host no se toca ni se cuenta.
runs() { # $1 etiqueta · $2 "vivos" para contar solo los que están corriendo
  docker ps -a --filter "label=$1" --format "{{.ID}} {{.State}} {{.Label \"$1\"}}" \
    | awk -v vivos="${2:-}" '$3 ~ /^(c4|restore-test)/ && (vivos == "" || $2 == "running") {print $1}'
}
nuke() {
  docker ps -aq --filter name=c4 | xargs -r docker rm -f -v >/dev/null 2>&1
  runs dtd.backup.run | xargs -r docker rm -f >/dev/null 2>&1
  runs dtd.restore.run | xargs -r docker rm -f >/dev/null 2>&1
  runs dtd.import.run | xargs -r docker rm -f >/dev/null 2>&1
  docker ps -aq --filter label=com.docker.compose.project=c4-staging | xargs -r docker rm -f >/dev/null 2>&1
  docker volume ls -q | grep -E '^c4' | xargs -r docker volume rm >/dev/null 2>&1
  docker network ls --format '{{.Name}}' | grep -E '^(c4|restore-test-)' | xargs -r docker network rm >/dev/null 2>&1
  rm -rf $T/out $T/out-kill $T/remote $T/rclone $T/rclone-muerto $T/proj $T/srv $T/backups $T/*.txt $T/*.log $T/alterado $T/solo $K
  rm -rf /dev/shm/pg-dump-c4* /dev/shm/restore-c4* /dev/shm/restore-restore-test-* /dev/shm/restore-test-* /dev/shm/config-c4* /dev/shm/import-c4*
}

echo "== preparación =="
command -v age >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y age >/dev/null
nuke
mkdir -p $T/out $T/remote/backups $T/rclone $T/proj/c4-src; chmod 700 $T
mkdir -m 700 $K
age-keygen -o $K/key.txt 2>/dev/null; age-keygen -y $K/key.txt > $T/recipients.txt; age-keygen -o $K/otra.txt 2>/dev/null
PW1=$(openssl rand -hex 16)
docker network create c4-src_internal >/dev/null
docker volume create c4-src_db-config >/dev/null
docker run -d --name c4-src-db --network c4-src_internal --network-alias db -v c4-src_db-config:/etc/postgresql-custom \
  -e POSTGRES_PASSWORD=$PW1 $IMG postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
docker run -d --name c4-s3 -v $T/remote:/remote $RC serve s3 /remote --addr :8080 --auth-key testkey,testsecret >/dev/null
wait_ready c4-src-db && echo "origen listo" || { echo "origen no arrancó"; docker logs --tail 30 c4-src-db; exit 1; }
S3IP=$(ip_of c4-s3); echo "s3 de prueba en $S3IP"
printf '[testr2]\ntype = s3\nprovider = Rclone\nendpoint = http://%s:8080\naccess_key_id = testkey\nsecret_access_key = testsecret\n' "$S3IP" > $T/rclone/rclone.conf
MARK="marcador-$(openssl rand -hex 4)"
asadmin c4-src-db <<SQL
create table public.prueba (id int primary key, nota text);
insert into public.prueba values (1, '$MARK'), (2, 'otra fila');
insert into auth.users (instance_id, id, aud, role, email) values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '$MARK@example.test');
select vault.create_secret('secreto-$MARK', 'prueba_bk');
SQL
# Permisos como los de producción: default privileges de postgres cerrados en public,
# una tabla que solo authenticated lee y una función que solo service_role ejecuta.
asadmin c4-src-db <<SQL >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
SQL
docker exec -i c4-src-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -Atq <<SQL >/dev/null
create table public.tenants (id int primary key, nombre text);
insert into public.tenants values (1, 'A'), (2, 'B');
grant select on public.tenants to authenticated;
create function public.solo_servicio() returns int language sql security definer set search_path = '' as \$\$ select 1 \$\$;
grant execute on function public.solo_servicio() to service_role;
SQL
echo "permisos del origen: tenants=$(asadmin c4-src-db -c "select string_agg(grantee || '=' || privilege_type, ',' order by 1) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tenants' and grantee in ('anon', 'authenticated')") · solo_servicio() anon=$(asadmin c4-src-db -c "select has_function_privilege('anon', 'public.solo_servicio()', 'execute')")"
N_USERS=$(asadmin c4-src-db -c "select count(*) from auth.users")
N_VAULT=$(asadmin c4-src-db -c "select count(*) from vault.secrets")
echo "semilla: $MARK · auth.users=$N_USERS · vault.secrets=$N_VAULT · raíz origen $(docker run --rm -v c4-src_db-config:/c:ro --entrypoint sha256sum $IMG /c/pgsodium_root.key | cut -c1-16)…"

echo; echo "== C1 · dump cifrado =="
PGPASSWORD=$PW1 bash $S/backup/pg-dump-to-s3.sh --project c4-src --network c4-src_internal --remote testr2:backups/db \
  --age-recipients $T/recipients.txt --out $T/out --rclone-config $T/rclone > $T/c1.log 2>&1; rc=$?
tail -2 $T/c1.log | sed 's/^/   /'
[ $rc -eq 0 ] && ok "pg-dump-to-s3 salió 0" || { ko "pg-dump-to-s3 salió $rc"; cat $T/c1.log; }
n_plain=$(find $T/remote $T/out -type f ! -name '*.age' ! -name '*.sha256' | wc -l)
[ "$n_plain" = 0 ] && ok "remoto y disco: solo .age y .sha256" || ko "$n_plain archivos sin cifrar"
DUMP=$(find $T/remote -name '*.dump.age' | head -1); ROLES=$(find $T/remote -name '*-roles.sql.age' | head -1)
ACLF=$(find $T/remote -name '*-acl.sql.age' | head -1)
[ -n "$ACLF" ] && [ "$(head -c 21 "$ACLF")" = "age-encryption.org/v1" ] && grep -q 'permisos de public: huella [0-9]*:[0-9a-f]\{32\}' $T/c1.log \
  && ok "permisos de public en el respaldo: cifrados y con huella ($(grep -o 'huella [0-9]*:' $T/c1.log | head -1))" || ko "falta el -acl.sql.age o su huella"
[ "$(age -d -i $K/key.txt "$ACLF" | head -1 | grep -c '^-- huella-acl: ')" = 1 ] && ok "el -acl.sql descifrado empieza con la huella" || ko "el -acl.sql no trae la huella"
[ "$(head -c 21 "$DUMP")" = "age-encryption.org/v1" ] && ok "cabecera age en el dump remoto" || ko "dump remoto no es age"
docker run --rm -i $IMG pg_restore --list < "$DUMP" >/dev/null 2>&1 && ko "pg_restore leyó el cifrado" || ok "pg_restore no lee el .dump.age"
grep -aq "CREATE ROLE" "$ROLES" && ko "roles en claro" || ok "roles remotos ilegibles"
[ "$(ls -A /dev/shm | grep -c '^pg-dump-c4')" = 0 ] && ok "nada en /dev/shm" || ko "quedó pg-dump-* en /dev/shm"
(cd "$(dirname "$DUMP")" && sha256sum -c --quiet *.sha256) && ok "sha256 del remoto" || ko "sha256 del remoto"
PGPASSWORD=x bash $S/backup/pg-dump-to-s3.sh --project c4-src --network n --remote testr2:backups/db --dry-run >/dev/null 2>&1; [ $? -eq 2 ] && ok "sin destinatarios: 2 (también en dry-run)" || ko "sin destinatarios"
cp $K/key.txt $T/mala.txt; bash $S/backup/pg-dump-to-s3.sh --project c4-src --network n --remote testr2:backups/db --age-recipients $T/mala.txt --dry-run >/dev/null 2>&1; [ $? -eq 2 ] && ok "clave privada como destinatario: 2" || ko "clave privada aceptada"; rm -f $T/mala.txt
: > $T/vacio.txt; bash $S/backup/pg-dump-to-s3.sh --project c4-src --network n --remote testr2:backups/db --age-recipients $T/vacio.txt --dry-run >/dev/null 2>&1; [ $? -eq 2 ] && ok "destinatarios vacío: 2" || ko "destinatarios vacío aceptado"
PGPASSWORD=mala bash $S/backup/pg-dump-to-s3.sh --project c4-src --network c4-src_internal --remote testr2:backups/db --age-recipients $T/recipients.txt --out $T/out --rclone-config $T/rclone >/dev/null 2>&1; rc=$?
[ $rc -ne 0 ] && [ "$(ls -A /dev/shm | grep -c '^pg-dump-c4')" = 0 ] && ok "contraseña mala: falla ($rc) y limpia" || ko "contraseña mala rc=$rc"
mkdir -p $T/alterado; cp "$DUMP" "$ROLES" "$(dirname "$DUMP")"/*.sha256 $T/alterado/
A=$T/alterado/$(basename "$DUMP"); printf 'X' | dd of="$A" bs=1 seek=200 conv=notrunc 2>/dev/null
PGPASSWORD=x bash $S/backup/restore.sh --file "$A" --age-identity $K/key.txt --project c4-dst --network c4-src_internal --target otra >/dev/null 2>&1; [ $? -eq 5 ] && ok "cifrado alterado: 5, no descifra" || ko "cifrado alterado"
PGPASSWORD=$PW1 bash $S/backup/restore.sh --file "$DUMP" --age-identity $K/otra.txt --project c4-dst --network c4-src_internal --target otra >/dev/null 2>&1; rc=$?
[ $rc -ne 0 ] && [ "$(ls -A /dev/shm | grep -c '^restore-c4')" = 0 ] && ok "clave equivocada: falla ($rc) y limpia" || ko "clave equivocada rc=$rc"
[ "$(asadmin c4-src-db -c "select count(*) from pg_database where datname='otra'")" = 0 ] && ok "ningún fallo creó la base 'otra'" || ko "se creó 'otra'"
# kill a mitad de la subida contra un remoto muerto
mkdir -p $T/rclone-muerto; sed "s#endpoint = .*#endpoint = http://10.255.255.1:8080#" $T/rclone/rclone.conf > $T/rclone-muerto/rclone.conf
PGPASSWORD=$PW1 bash $S/backup/pg-dump-to-s3.sh --project c4-src --network c4-src_internal --remote testr2:backups/db \
  --age-recipients $T/recipients.txt --out $T/out-kill --rclone-config $T/rclone-muerto > $T/kill.log 2>&1 &
KP=$!
for i in $(seq 1 60); do grep -q '7/9' $T/kill.log && break; sleep 1; done; sleep 4
nb=$(runs dtd.backup.run vivos | wc -l)
t_kill=$(date +%s); kill -TERM $KP; wait $KP; rc=$?; t_kill=$(( $(date +%s) - t_kill ))
sleep 2; na=$(runs dtd.backup.run vivos | wc -l)
echo "   kill: rc=$rc en ${t_kill}s · contenedores antes=$nb después=$na"
[ "$nb" -ge 1 ] && [ "$na" = 0 ] && [ "$(ls -A /dev/shm | grep -c '^pg-dump-c4')" = 0 ] && [ $t_kill -le 15 ] && ok "kill en la subida: corta en ${t_kill}s, baja rclone y limpia /dev/shm" || ko "kill en la subida"

echo; echo "== C2 · respaldo de configuración (raíz de Vault) =="
printf 'PROYECTO=c4-src\nPOSTGRES_PASSWORD=%s\nJWT_SECRET=secreto-de-prueba-%s\nVAULT_ENC_KEY=esta-es-la-de-supavisor\n' "$PW1" "$MARK" > $T/proj/c4-src/.env; chmod 600 $T/proj/c4-src/.env
CB="bash $S/backup/config-backup.sh --project c4-src --project-dir $T/proj/c4-src --remote testr2:backups/db --age-recipients $T/recipients.txt --out $T/out --rclone-config $T/rclone"
$CB > $T/c2.log 2>&1; rc=$?
cat $T/c2.log | sed 's/^/   /' | tail -4
[ $rc -eq 0 ] && ok "config-backup salió 0" || { ko "config-backup salió $rc"; cat $T/c2.log; }
CFG=$(find $T/remote -path '*c4-src-config*' -name '*.tar.age' | head -1)
[ -n "$CFG" ] && ok "respaldo en el prefijo propio: ${CFG#$T/remote/}" || ko "no hay respaldo de configuración en el remoto"
grep -aqE "JWT_SECRET|POSTGRES_PASSWORD|$MARK" "$CFG" && ko "config legible en claro" || ok "config remota ilegible sin la clave"
fp_log=$(grep -o 'pgsodium_root.key: [0-9a-f]*' $T/c2.log | head -1 | awk '{print $2}')
fp_real=$(docker run --rm -v c4-src_db-config:/c:ro --entrypoint sha256sum $IMG /c/pgsodium_root.key | cut -d' ' -f1)
[ -n "$fp_log" ] && [ "$fp_log" = "$fp_real" ] && ok "la huella impresa es la de la raíz real" || ko "huella '$fp_log' ≠ '$fp_real'"
n1=$(find $T/remote -path '*c4-src-config*' -name '*.tar.age' | wc -l)
$CB > $T/c2b.log 2>&1; n2=$(find $T/remote -path '*c4-src-config*' -name '*.tar.age' | wc -l)
grep -q 'sin cambios' $T/c2b.log && [ "$n1" = "$n2" ] && ok "sin cambios: no sube otro respaldo" || ko "segunda corrida sin cambios subió algo ($n1→$n2)"
sleep 1; $CB --force > /dev/null 2>&1; n3=$(find $T/remote -path '*c4-src-config*' -name '*.tar.age' | wc -l)
[ "$n3" = $((n2+1)) ] && ok "--force sube uno nuevo" || ko "--force: $n2→$n3"
docker volume create c4-vacio >/dev/null
bash $S/backup/config-backup.sh --project c4-src --project-dir $T/proj/c4-src --volume c4-vacio --remote testr2:backups/db --age-recipients $T/recipients.txt --out $T/out --rclone-config $T/rclone >/dev/null 2>&1; [ $? -eq 2 ] && ok "volumen sin pgsodium_root.key: 2" || ko "volumen sin raíz aceptado"
[ "$(ls -A /dev/shm | grep -c '^config-c4')" = 0 ] && ok "config-backup no dejó nada en /dev/shm" || ko "quedó config-* en /dev/shm"
age -d -i $K/key.txt "$CFG" | tar -tf - | sort | tr '\n' ' ' | sed 's/^/   contenido: /'; echo

echo; echo "== C1+C2 · restore-test (mensual, contenedor desechable) =="
bash $S/backup/restore-test.sh --file "$DUMP" --roles "$ROLES" --age-identity $K/key.txt \
  --expect public.prueba=2 --expect auth.users=$N_USERS > $T/rt1.log 2>&1; rc1=$?
sed 's/^/   /' $T/rt1.log | tail -22
[ $rc1 -eq 0 ] && ok "restore-test sin raíz: comprobaciones de filas PASÓ" || ko "restore-test sin raíz salió $rc1"
grep -q "vault: 0 de $N_VAULT" $T/rt1.log && ok "control: sin la raíz respaldada, Vault NO se lee (0 de $N_VAULT)" || ko "control de Vault: $(grep 'vault:' $T/rt1.log)"
bash $S/backup/restore-test.sh --file "$DUMP" --roles "$ROLES" --age-identity $K/key.txt --config "$CFG" --vault-readable \
  --expect public.prueba=2 --expect auth.users=$N_USERS > $T/rt2.log 2>&1; rc2=$?
sed 's/^/   /' $T/rt2.log | grep -E 'raíz|vault|PASÓ|FALLÓ|RTO' | tail -10
[ $rc2 -eq 0 ] && ok "restore-test con --config: Vault legible y filas iguales" || ko "restore-test con --config salió $rc2"
[ "$(docker ps -aq --filter label=dtd.restore-test | wc -l)" = 0 ] && ok "no quedó ningún contenedor desechable" || ko "quedaron contenedores restore-test"
[ "$(ls -A /dev/shm | grep -cE '^restore-(c4|restore-test|test-)')" = 0 ] && ok "no quedó nada en /dev/shm" || ko "quedó restore* en /dev/shm: $(ls -A /dev/shm)"
grep -q 'PASÓ  · permisos de public iguales' $T/rt1.log && ok "restore-test en base nueva: permisos iguales al origen" || ko "restore-test sin la comprobación de permisos: $(grep 'permisos' $T/rt1.log | tail -1)"

echo; echo "== DR · permisos de public sobre la base de la imagen =="
bash $S/backup/restore-test.sh --file "$DUMP" --roles "$ROLES" --age-identity $K/key.txt --dr --acl-verify-only \
  --expect public.tenants=2 > $T/dr0.log 2>&1; rc=$?
sed 's/^/   /' $T/dr0.log | grep -E 'DR:|permisos de public:|FALLÓ' | tail -5
[ $rc -eq 7 ] && grep -q 'DISTINTOS' $T/dr0.log && ok "control rojo: en el DR sin igualar, la huella delata permisos distintos al origen" || ko "control rojo del DR: rc=$rc"
bash $S/backup/restore-test.sh --file "$DUMP" --roles "$ROLES" --age-identity $K/key.txt --dr \
  --expect public.tenants=2 --expect public.prueba=2 > $T/dr1.log 2>&1; rc=$?
sed 's/^/   /' $T/dr1.log | grep -E 'permisos de public:|PASÓ|FALLÓ|RTO' | tail -8
[ $rc -eq 0 ] && grep -q ' · iguales' $T/dr1.log && ok "DR: restore.sh iguala los permisos y la huella coincide con el origen" || ko "DR igualando: rc=$rc"
mkdir -p $T/solo && cp "$DUMP" $T/solo/
PGPASSWORD=x bash $S/backup/restore.sh --file $T/solo/$(basename "$DUMP") --age-identity $K/key.txt --project c4-dst --target postgres --i-know-this-destroys-prod < /dev/null > $T/dr2.log 2>&1; rc=$?
[ $rc -eq 3 ] && grep -q 'archivo de permisos' $T/dr2.log && ok "destino destructivo sin archivo de permisos: rechaza (3) antes de pedir confirmación" || { ko "destructivo sin permisos rc=$rc"; tail -2 $T/dr2.log; }
[ "$(docker ps -aq --filter label=dtd.restore-test | wc -l)" = 0 ] && [ "$(ls -A /dev/shm | grep -cE '^restore-(c4|restore-test|test-)')" = 0 ] && ok "DR: no quedó contenedor ni nada en /dev/shm" || ko "DR dejó restos"

echo; echo "== C4 · destroy-staging =="
SD=$T/srv/c4-staging; mkdir -p $SD/data/db $SD/data/storage/stub $T/backups/c4-staging $T/srv/c4b-staging
printf 'DTD_DATA_DIR=./data\n' > $SD/.env; echo "fila" > $SD/data/db/archivo; echo "foto" > $SD/data/storage/stub/x.jpg; echo x > $T/backups/c4-staging/c4-staging-1.dump.age
printf 'DTD_DATA_DIR=/srv/dtd-cargo/data\n' > $T/srv/c4b-staging/.env
mkdir -p /dev/shm/import-c4-staging-abc123
L=com.docker.compose.project
docker volume create --label $L=c4-staging c4-staging_db-config >/dev/null
docker network create --label $L=c4-staging c4-staging_net >/dev/null
docker run -d --name c4-staging-db --label $L=c4-staging --network c4-staging_net --entrypoint sleep $IMG 600 >/dev/null
docker run -d --name c4-otro --label $L=c4-otro --entrypoint sleep $IMG 600 >/dev/null
D="bash $S/staging/destroy-staging.sh"
$D --project dtd-cargo --confirm dtd-cargo >/dev/null 2>&1; [ $? -eq 3 ] && ok "producción: rechaza (3)" || ko "producción no rechazada"
$D --project c4-prod --confirm c4-prod >/dev/null 2>&1; [ $? -eq 3 ] && ok "sin -staging: rechaza (3)" || ko "sin -staging no rechazado"
$D --project c4-staging --confirm otra-cosa --project-dir $SD >/dev/null 2>&1; [ $? -eq 3 ] && ok "--confirm distinto: rechaza (3)" || ko "--confirm distinto aceptado"
$D --project c4b-staging --confirm c4b-staging --project-dir $T/srv/c4b-staging >/dev/null 2>&1; [ $? -eq 3 ] && ok "DTD_DATA_DIR de producción: rechaza (3)" || ko "DTD_DATA_DIR de producción aceptado"
$D --project c4-staging --confirm c4-staging --project-dir $SD --backups $T/backups --dry-run >/dev/null 2>&1; rc=$?
[ $rc -eq 0 ] && [ -f $SD/data/db/archivo ] && [ "$(docker ps -aq --filter label=$L=c4-staging | wc -l)" = 1 ] && ok "dry-run: 0 y no borra nada" || ko "dry-run rc=$rc o borró algo"
$D --project c4-staging --confirm c4-staging --project-dir $SD --backups $T/backups --evidence $T/destroy-evidencia.txt > $T/c4.log 2>&1; rc=$?
sed 's/^/   /' $T/c4.log | grep -E 'antes|después|destruido|QUEDÓ'
[ $rc -eq 0 ] && ok "destroy-staging salió 0" || ko "destroy-staging salió $rc"
[ ! -e $SD/data ] && [ ! -e $T/backups/c4-staging ] && [ ! -e /dev/shm/import-c4-staging-abc123 ] && ok "datos, dumps y restos en memoria borrados" || ko "quedaron datos"
[ "$(docker ps -aq --filter label=$L=c4-staging | wc -l)$(docker volume ls -q --filter label=$L=c4-staging | wc -l)$(docker network ls -q --filter label=$L=c4-staging | wc -l)" = "000" ] && ok "contenedores, volúmenes y redes del staging: 0" || ko "quedó algo de docker"
[ "$(docker ps -q --filter name=c4-otro | wc -l)" = 1 ] && ok "no tocó otro proyecto (c4-otro sigue vivo)" || ko "borró otro proyecto"
[ -f $SD/.env ] && ok "conserva el .env sin --purge-config" || ko "borró el .env"
[ -s $T/destroy-evidencia.txt ] && ok "evidencia escrita ($(wc -l < $T/destroy-evidencia.txt) líneas)" || ko "sin evidencia"

echo; echo "== C3 · import-from-cloud (mecánica, sin Storage) =="
if ! command -v supabase >/dev/null || ! supabase --version 2>/dev/null | grep -q "$CLI_VER"; then
  cd /tmp && rm -f supabase_${CLI_VER}_linux_amd64.deb checksums.txt
  curl -fsSLO https://github.com/supabase/cli/releases/download/v${CLI_VER}/supabase_${CLI_VER}_linux_amd64.deb
  curl -fsSLO https://github.com/supabase/cli/releases/download/v${CLI_VER}/checksums.txt
  if grep " supabase_${CLI_VER}_linux_amd64.deb\$" checksums.txt | sha256sum -c --quiet; then
    dpkg -i supabase_${CLI_VER}_linux_amd64.deb >/dev/null && ok "CLI de Supabase v${CLI_VER} instalada con sha256 verificado"
  else ko "sha256 de la CLI no coincide: no se instala"; fi
  rm -f supabase_${CLI_VER}_linux_amd64.deb checksums.txt; cd - >/dev/null
fi
echo "   $(supabase --version 2>&1 | head -1)"
PW3=$(openssl rand -hex 16); PW4=$(openssl rand -hex 16)
# el Cloud real está en internet: el falso va en la red por defecto, que alcanza cualquier docker run
docker run -d --name c4-cloud-db -e POSTGRES_PASSWORD=$PW3 $IMG postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
IS=$T/srv/c4i-staging; mkdir -p $IS
printf 'POSTGRES_PASSWORD=%s\nS3_PROTOCOL_ACCESS_KEY_ID=x\nS3_PROTOCOL_ACCESS_KEY_SECRET=y\n' "$PW4" > $IS/.env
docker network create --internal c4i-staging_dtd_internal >/dev/null
docker run -d --name c4i-staging-db --network c4i-staging_dtd_internal --network-alias db -e POSTGRES_PASSWORD=$PW4 $IMG postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
wait_ready c4-cloud-db && wait_ready c4i-staging-db && echo "   cloud falso y staging listos" || { echo "no arrancaron"; exit 1; }
CIP=$(ip_of c4-cloud-db)
# Default privileges como los de producción (medidos el 2026-10-08: postgres en public
# concede solo a postgres y service_role), ANTES de crear tablas.
asadmin c4-cloud-db <<SQL >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
SQL
echo "   cloud falso: default privileges con anon/authenticated = $(asadmin c4-cloud-db -c "select count(*) from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclacl::text ~ '(^|[{,])(anon|authenticated)='")"
# Como en Cloud: public y el ledger los crea postgres (las migraciones corren como postgres);
# auth, storage, cron y vault son de la plataforma.
docker exec -i c4-cloud-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -Atq <<SQL >/dev/null
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0001','base'), ('0239','applied_migrations_rpc'), ('0471','ultima');
create or replace function public.applied_migration_names() returns table (version text, name text) language sql security definer set search_path = '' stable
  as \$\$ select m.version, m.name from supabase_migrations.schema_migrations m order by m.version \$\$;
create table public.tenants (id uuid primary key default gen_random_uuid(), nombre text);
insert into public.tenants (nombre) values ('A'), ('B');
revoke all on public.tenants from anon, authenticated; grant select on public.tenants to authenticated;
create table public.embarques (id serial primary key, nota text);
insert into public.embarques (nota) select 'embarque ' || g from generate_series(1,5) g;
create table public.mail_logs (id serial primary key, para text);
insert into public.mail_logs (para) values ('$MARK@example.test'), ('b@example.test'), ('c@example.test');
SQL
asadmin c4-cloud-db <<SQL >/dev/null
insert into auth.users (instance_id, id, aud, role, email) values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'u1@example.test'), ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'u2@example.test');
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text);
insert into storage.buckets (id, name) values ('client-docs','client-docs'), ('bug-replays','bug-replays');
insert into storage.objects (bucket_id, name, owner_id) values ('client-docs', 'a.pdf', 'u1'), ('client-docs', 'b.pdf', null), ('bug-replays', 'r.json', 'u2');
create extension if not exists pg_cron;
select cron.schedule('job-prueba', '0 3 * * *', 'select 1');
select vault.create_secret('secreto-kommo-$MARK', 'kommo_cron_key');
SQL
echo "   cloud falso sembrado: $(asadmin c4-cloud-db -c "select count(*) from auth.users")u · $(asadmin c4-cloud-db -c "select count(*) from public.mail_logs") mail_logs · $(asadmin c4-cloud-db -c "select count(*) from cron.job") cron"
URL="postgresql://postgres:$PW3@$CIP:5432/postgres"
IMP="bash $S/migrate/import-from-cloud.sh --project c4i-staging --project-dir $IS --skip-storage --expect-auth-users 2"
echo "$URL" | $IMP --evidence $T/imp-guard.txt > $T/imp0.log 2>&1; rc=$?
[ $rc -eq 3 ] && grep -q 'default privileges' $T/imp0.log && ok "staging con default privileges abiertos: rechaza (3)" || { ko "guarda de default privileges rc=$rc"; tail -3 $T/imp0.log; }
asadmin c4i-staging-db <<SQL >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
SQL
# storage-api crea estas tablas en el staging real; aquí se simulan
asadmin c4i-staging-db <<SQL >/dev/null
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text);
SQL
asadmin c4i-staging-db -c "create table public.sobra (id int)"
echo "$URL" | $IMP --evidence $T/imp-guard.txt > $T/imp1.log 2>&1; rc=$?
[ $rc -eq 3 ] && grep -q 'ya tiene' $T/imp1.log && ok "staging no vacío: rechaza (3)" || { ko "guarda de staging vacío rc=$rc"; tail -3 $T/imp1.log; }
asadmin c4i-staging-db -c "drop table public.sobra"
bash $S/migrate/import-from-cloud.sh --project dtd-cargo --skip-storage < /dev/null > /dev/null 2>&1; [ $? -eq 3 ] && ok "proyecto de producción sin --corte: rechaza (3)" || ko "producción no rechazada"
bash $S/migrate/import-from-cloud.sh --project c4i-staging --project-dir $IS --corte < /dev/null > /dev/null 2>&1; [ $? -eq 3 ] && ok "--corte sobre un staging: rechaza (3)" || ko "--corte sobre staging aceptado"
# Modo contraseña (--cloud-user/--cloud-host), el que usa Sam: tres pegados mal
# hechos se rechazan antes de conectar, y el bueno arma la cadena.
CP="--cloud-user postgres --cloud-host $CIP"
printf '[%s]\n' "$PW3" | $IMP $CP --evidence $T/imp-guard.txt > $T/imp-b1.log 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'corchetes' $T/imp-b1.log && ! grep -q "$PW3" $T/imp-b1.log && ok "contraseña entre corchetes: rechaza (2), lo explica y no la muestra" || { ko "contraseña entre corchetes rc=$rc"; tail -2 $T/imp-b1.log; }
echo "postgresql://postgres:[$PW3]@$CIP:5432/postgres" | $IMP --evidence $T/imp-guard.txt > $T/imp-b2.log 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'corchetes' $T/imp-b2.log && ok "cadena con la contraseña entre corchetes: rechaza (2)" || { ko "cadena con corchetes rc=$rc"; tail -2 $T/imp-b2.log; }
echo "$URL" | $IMP $CP --evidence $T/imp-guard.txt > $T/imp-b3.log 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'SOLO la contraseña' $T/imp-b3.log && ok "cadena entera donde va la contraseña: rechaza (2)" || { ko "cadena en modo contraseña rc=$rc"; tail -2 $T/imp-b3.log; }
# Corrida buena: contraseña entre corchetes (1), contraseña equivocada (2), la buena (3).
printf '[%s]\nmala-%s\n%s\n' "$PW3" "$PW3" "$PW3" | $IMP $CP --evidence $T/imp-evidencia.txt > $T/imp2.log 2>&1; rc=$?
grep -q 'corchetes' $T/imp2.log && grep -q 'Cloud no aceptó la conexión' $T/imp2.log && grep -q 'conexión a Cloud: OK' $T/imp2.log \
  && ok "contraseña: rechaza corchetes, prueba la conexión y vuelve a pedir hasta que entra" || ko "reintentos de contraseña: $(grep -E '✗|OK' $T/imp2.log | head -3)"
grep -q 'la contraseña no es la de la base' $T/imp2.log && ! grep -q "mala-$PW3" $T/imp2.log && ok "contraseña equivocada: dice que es la contraseña (no la red) y no la muestra" || ko "diagnóstico de la contraseña: $(grep -E 'no aceptó' $T/imp2.log | head -1)"
grep -q "contraseña recibida (${#PW3} caracteres)" $T/imp2.log && grep -q "cadena recibida: postgres@$CIP:5432/postgres" $T/imp2.log && ok "modo contraseña: arma la cadena y la confirma sin mostrarla" || ko "modo contraseña: $(grep -E 'recibida' $T/imp2.log | head -2)"
echo "   import salió $rc"; sed 's/^/   /' $T/imp2.log | grep -vE '^   $' | tail -40
[ $rc -eq 0 ] && ok "import-from-cloud: todas sus comprobaciones PASÓ" || ko "import-from-cloud salió $rc"
SQ() { docker exec c4i-staging-db psql -U supabase_admin -h localhost -d postgres -Atc "$1" 2>&1; }
[ "$(SQ 'select count(*) from public.mail_logs')" = 0 ] && ok "minimización: mail_logs llegó vacía" || ko "mail_logs: $(SQ 'select count(*) from public.mail_logs')"
[ "$(SQ 'select count(*) from public.embarques')" = 5 ] && ok "embarques: 5 filas" || ko "embarques: $(SQ 'select count(*) from public.embarques')"
[ "$(SQ "select count(*)::text || ':' || count(*) filter (where active)::text || ':' || string_agg(username, ',') from cron.job")" = "1:0:supabase_admin" ] \
  && ok "cron: 1 job recreado, inactivo, con el usuario de Cloud" || ko "cron: $(SQ "select count(*)::text || ':' || count(*) filter (where active)::text || ':' || coalesce(string_agg(username, ','), '-') from cron.job")"
echo "   grants de tenants en Cloud: $(asadmin c4-cloud-db -c "select string_agg(grantee || '=' || privilege_type, ',' order by 1) from information_schema.role_table_grants where table_schema='public' and table_name='tenants' and grantee in ('anon','authenticated')") · staging: $(SQ "select string_agg(grantee || '=' || privilege_type, ',' order by 1) from information_schema.role_table_grants where table_schema='public' and table_name='tenants' and grantee in ('anon','authenticated')")"
grep -qE "$PW3|$MARK" $T/imp-evidencia.txt && ko "la evidencia tiene la contraseña o un dato personal" || ok "la evidencia no tiene contraseña ni datos personales"
grep -q "$PW3" $T/imp2.log && ko "la salida del import muestra la contraseña" || ok "la salida del import no muestra la contraseña"
[ "$(ls -A /dev/shm | grep -c '^import-c4')" = 0 ] && ok "import no dejó nada en /dev/shm" || ko "quedó import-* en /dev/shm"
echo "   vault tras el import: $(SQ "select count(*) from vault.secrets") secretos · legibles $(SQ "select count(*) from vault.decrypted_secrets where decrypted_secret is not null")"
ID0=$(SQ "select id from vault.secrets where name = 'kommo_cron_key'")
VS="bash $S/migrate/vault-set-secret.sh --project c4i-staging --project-dir $IS --network c4i-staging_dtd_internal"
NUEVO="valor-nuevo-$(openssl rand -hex 6)"
echo "$NUEVO" | $VS --name kommo_cron_key > $T/vault.log 2>&1; rc=$?
sed 's/^/   /' $T/vault.log
[ $rc -eq 0 ] && [ "$(SQ "select (decrypted_secret = '$NUEVO')::text from vault.decrypted_secrets where name = 'kommo_cron_key'")" = true ] && ok "vault-set-secret reescribe kommo_cron_key y descifra" || ko "vault-set-secret kommo_cron_key rc=$rc"
echo "   kommo_cron_key antes de escribir: '${ID0:-no existía: el dump no trae vault.secrets}'"
ID1=$(SQ "select id from vault.secrets where name = 'kommo_cron_key'"); OTRO="otro-$(openssl rand -hex 6)"
echo "$OTRO" | $VS --name kommo_cron_key > /dev/null 2>&1; rc=$?
[ $rc -eq 0 ] && [ -n "$ID1" ] && [ "$(SQ "select id from vault.secrets where name = 'kommo_cron_key'")" = "$ID1" ] \
  && [ "$(SQ "select (decrypted_secret = '$OTRO')::text from vault.decrypted_secrets where name = 'kommo_cron_key'")" = true ] \
  && ok "segunda escritura: update sobre el mismo id y descifra el valor nuevo" || ko "segunda escritura rc=$rc id '$ID1'"
grep -q "$NUEVO" $T/vault.log && ko "el valor aparece en la salida" || ok "el valor no aparece en la salida"
echo "https://supabase-staging.example.test/functions/v1" | $VS --name functions_base_url > /dev/null 2>&1; rc=$?
[ $rc -eq 0 ] && [ "$(SQ "select count(*) from vault.decrypted_secrets where name = 'functions_base_url' and decrypted_secret like 'https://%'")" = 1 ] && ok "vault-set-secret crea functions_base_url" || ko "functions_base_url rc=$rc"
printf '\n' | $VS --name otro > /dev/null 2>&1; [ $? -eq 2 ] && ok "valor vacío: no escribe (2)" || ko "valor vacío aceptado"

echo; echo "== CORTE · import-from-cloud --corte contra una producción falsa (c4p) =="
PW5=$(openssl rand -hex 16); CPD=$T/srv/c4p; mkdir -p $CPD
printf 'POSTGRES_PASSWORD=%s\n' "$PW5" > $CPD/.env
docker network create --internal c4p_dtd_internal >/dev/null
docker run -d --name c4p-db --network c4p_dtd_internal --network-alias db -e POSTGRES_PASSWORD=$PW5 $IMG postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
wait_ready c4p-db || { echo "c4p no arrancó"; exit 1; }
asadmin c4p-db <<SQL >/dev/null
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text);
SQL
IMPC="bash $S/migrate/import-from-cloud.sh --project c4p --project-dir $CPD --expect-auth-users 2"
printf 'CORTE c4p\n%s\n' "$PW3" | $IMPC $CP --corte --evidence $T/corte-guard.txt > $T/corte0.log 2>&1; rc=$?
[ $rc -eq 3 ] && grep -q 'solo para el proyecto de producción' $T/corte0.log && ok "--corte en un proyecto que no es el de producción: rechaza (3)" || { ko "corte en no-producción rc=$rc"; tail -2 $T/corte0.log; }
printf 'corte c4p\n%s\n' "$PW3" | PROD_COMPOSE_PROJECT=c4p $IMPC $CP --corte --evidence $T/corte-guard.txt > $T/corte1.log 2>&1; rc=$?
[ $rc -eq 3 ] && grep -q 'confirmación del corte incorrecta' $T/corte1.log && ! grep -q 'contraseña recibida' $T/corte1.log \
  && ok "confirmación mal escrita: rechaza (3) sin pedir la contraseña ni conectar" || { ko "confirmación mal escrita rc=$rc"; tail -2 $T/corte1.log; }
printf 'CORTE c4p\n%s\n' "$PW3" | PROD_COMPOSE_PROJECT=c4p $IMPC $CP --corte --evidence $T/corte.txt > $T/corte2.log 2>&1; rc=$?
sed 's/^/   /' $T/corte2.log | grep -E 'CORTE|Vault|FALLÓ|RESULTADO' | tail -8
[ $rc -eq 0 ] && ok "corte: import-from-cloud --corte con todas sus comprobaciones PASÓ" || ko "corte salió $rc"
CQ() { docker exec c4p-db psql -U supabase_admin -h localhost -d postgres -Atc "$1" 2>&1; }
[ "$(CQ 'select count(*) from public.mail_logs')" = 3 ] && ok "corte: las tablas de log viajan con datos (mail_logs 3)" || ko "corte mail_logs: $(CQ 'select count(*) from public.mail_logs')"
[ "$(CQ "select count(*)::text || ':' || count(*) filter (where active)::text from cron.job")" = "1:1" ] && ok "corte: pg_cron como en Cloud (1 job, activo)" || ko "corte cron: $(CQ "select count(*)::text || ':' || count(*) filter (where active)::text from cron.job")"
[ "$(CQ "select (decrypted_secret = 'secreto-kommo-$MARK')::text from vault.decrypted_secrets where name = 'kommo_cron_key'")" = true ] && ok "corte: el secreto de Vault viaja y descifra con la raíz del servidor" || ko "corte vault: $(CQ "select count(*) from vault.secrets")"
grep -qE "secreto-kommo|$PW3" $T/corte2.log $T/corte.txt && ko "corte: el secreto o la contraseña aparecen en la salida" || ok "corte: ni el secreto ni la contraseña aparecen en la salida ni en la evidencia"
[ "$(ls -A /dev/shm | grep -c '^import-c4')" = 0 ] && ok "corte: nada quedó en /dev/shm" || ko "corte: quedó algo en /dev/shm"

echo; echo "== limpieza =="
nuke
echo "restos: $(ls -A /dev/shm | wc -l) en /dev/shm · $(docker ps -a --format '{{.Names}}' | grep -cE '^(c4|restore-test)' || true) contenedores de prueba · $(docker volume ls -q | grep -c '^c4' || true) volúmenes"
echo; echo "RESULTADO: $pass PASÓ · $fail FALLÓ"
[ "$fail" = 0 ]
