#!/usr/bin/env bash
# infra/ops/portal-historial/limpiar.sh — SDD-0586 10.7 (P4): borra de /dev/shm lo que haya quedado de la
# carga (preparado.ndjson con datos de clientes y vinculos.ndjson). Se corre si la carga no terminó.
#
# Uso:  bash limpiar.sh   (solo borra /dev/shm/portal-historial: otro DIR se rechaza)
set -euo pipefail
DIR="${DIR:-/dev/shm/portal-historial}"
# Solo el nombre fijo: con un patrón, `/dev/shm//` o `/dev/shm/otro` borraban lo de otros procesos.
if [ "$DIR" != /dev/shm/portal-historial ]; then
  echo "HECHO error=dir_no_es_dev_shm_portal_historial" >&2
  exit 2
fi
rm -rf -- "$DIR"
echo "HECHO borrado=$DIR"
