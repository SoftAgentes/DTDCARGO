#!/usr/bin/env bash
# infra/ops/tests/prueba-storage-from-cloud.sh — prueba de storage-from-cloud.sh en un staging del VPS (SDD-0505).
# «Cloud» falso (rclone serve s3) y un bucket de prueba zz-prueba-sfc con archivos inventados:
# nada real, y se borra todo al final. Uso, como root en el VPS:
#   bash infra/ops/tests/prueba-storage-from-cloud.sh /srv/ops/migrate/storage-from-cloud.sh
set -uo pipefail
SFC="$1"
cd /srv/dtd-cargo-staging
envget() { grep -E "^${1}=" .env | tail -n1 | cut -d= -f2-; }
P="$(envget POSTGRES_PASSWORD)"
B=zz-prueba-sfc
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
q() { docker exec -e PGPASSWORD="$P" dtd-cargo-staging-db-1 psql -U supabase_admin -h localhost -d postgres -At -c "$1"; }
export RCLONE_CONFIG_S_TYPE=s3 RCLONE_CONFIG_S_PROVIDER=Other RCLONE_CONFIG_S_FORCE_PATH_STYLE=true RCLONE_CONFIG_S_REGION="$(envget REGION)" \
  RCLONE_CONFIG_S_ACCESS_KEY_ID="$(envget S3_PROTOCOL_ACCESS_KEY_ID)" RCLONE_CONFIG_S_SECRET_ACCESS_KEY="$(envget S3_PROTOCOL_ACCESS_KEY_SECRET)" \
  RCLONE_CONFIG_S_ENDPOINT="https://$(envget SUPABASE_PUBLIC_HOST)/storage/v1/s3"
rs() { docker run --rm --network dtd_edge -v /root/zzfc:/src:ro -e RCLONE_CONFIG_S_TYPE -e RCLONE_CONFIG_S_PROVIDER -e RCLONE_CONFIG_S_FORCE_PATH_STYLE \
  -e RCLONE_CONFIG_S_REGION -e RCLONE_CONFIG_S_ACCESS_KEY_ID -e RCLONE_CONFIG_S_SECRET_ACCESS_KEY -e RCLONE_CONFIG_S_ENDPOINT rclone/rclone:1.75.1 "$@" 2>&1 | grep -v 'rclone.conf" not found'; }
limpiar() {
  rs delete "S:$B" >/dev/null; rs rmdirs "S:$B" >/dev/null
  docker rm -f zz-fakecloud >/dev/null 2>&1; rm -rf /root/zzfc
}
limpiar
# «Cloud» falso con dos archivos (uno en subcarpeta, un PDF de mentira).
mkdir -p "/root/zzfc/$B/sub"; printf 'hola prueba' > "/root/zzfc/$B/a.txt"; head -c 3000 /dev/urandom > "/root/zzfc/$B/sub/b.pdf"
docker run -d --name zz-fakecloud --network dtd_edge -v /root/zzfc:/data rclone/rclone:1.75.1 serve s3 /data --addr :8080 --auth-key kprueba,sprueba >/dev/null
sleep 2
# Staging como lo deja el import: bucket y filas con dueño y fecha de Cloud, sin archivos.
rs mkdir "S:$B" >/dev/null; rs copy "/src/$B" "S:$B" >/dev/null
q "update storage.objects set owner_id = 'dueno-de-cloud', created_at = '2020-01-01' where bucket_id = '$B'" >/dev/null
find data/storage -path "*$B*" -type f -delete
echo "preparado: $(q "select count(*) from storage.objects where bucket_id = '$B'") filas · $(find data/storage -path "*$B*" -type f | wc -l) archivos en disco"
REF=abcdefghijklmnopqrst
export CLOUD_S3_ENDPOINT=http://zz-fakecloud:8080

echo "== claves equivocadas y secreto vacío: vuelve a pedir y corta sin copiar"
printf 'k1\n\nk2\ns2\n' | bash "$SFC" --project dtd-cargo-staging --cloud-ref $REF --evidence /root/sfc-mal.txt > /root/sfc-mal.log 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'Secret access key no llegó bien' /root/sfc-mal.log && grep -q 'no aceptó esas claves' /root/sfc-mal.log \
  && [ "$(find data/storage -path "*$B*" -type f | wc -l)" = 0 ] && ok "claves malas: rc 2, explica y no copia nada" || { ko "claves malas rc=$rc"; tail -3 /root/sfc-mal.log; }
grep -q 'intento 1' /root/sfc-mal.txt && ok "el intento fallido quedó en la evidencia" || ko "sin intentos en la evidencia"

echo "== corrida buena"
printf 'kprueba\nsprueba\nrevocada\n' | bash "$SFC" --project dtd-cargo-staging --cloud-ref $REF --evidence /root/sfc-bien.txt > /root/sfc-bien.log 2>&1; rc=$?
grep -E 'PASÓ|FALLÓ|RESULTADO|total' /root/sfc-bien.txt | sed 's/^2026-[0-9-]*T//' | cut -c1-190
[ $rc -eq 0 ] && ok "storage-from-cloud salió 0" || { ko "storage-from-cloud salió $rc"; tail -12 /root/sfc-bien.log; tail -5 /root/sfc-bien.txt; }
[ "$(find data/storage -path "*$B*" -type f | wc -l)" = 2 ] && ok "los 2 archivos están en el disco" || ko "archivos en disco: $(find data/storage -path "*$B*" -type f | wc -l)"
[ "$(q "select count(*) from storage.objects where bucket_id = '$B' and owner_id = 'dueno-de-cloud' and created_at = '2020-01-01'")" = 2 ] && ok "dueño y fecha de Cloud conservados" || ko "dueño/fecha cambiaron"
[ "$(rs cat "S:$B/a.txt")" = "hola prueba" ] && ok "el archivo se lee por S3 con su contenido" || ko "lectura por S3"
grep -qE 'kprueba|sprueba' /root/sfc-bien.log /root/sfc-bien.txt && ko "las claves aparecen en la salida" || ok "las claves no aparecen en la salida ni en la evidencia"
[ "$(ls /dev/shm | grep -c '^storage-')" = 0 ] && ok "nada quedó en /dev/shm" || ko "quedó algo en /dev/shm"

echo "== limpieza"
limpiar
rm -f /root/sfc-mal.* /root/sfc-bien.*
echo "quedan: $(q "select count(*) from storage.buckets where id = '$B'") bucket · $(q "select count(*) from storage.objects where bucket_id = '$B'") filas · $(find data/storage -path "*$B*" -type f | wc -l) archivos · buckets reales: $(q "select count(*) from storage.buckets") · filas reales: $(q "select count(*) from storage.objects")"
echo "RESULTADO: $pass PASÓ · $fail FALLÓ"
