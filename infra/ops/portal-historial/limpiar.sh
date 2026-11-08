#!/usr/bin/env bash
# infra/ops/portal-historial/limpiar.sh — SDD-0586 10.7 (P4): borra de /dev/shm lo que haya quedado de la
# carga (preparado.ndjson con datos de clientes y vinculos.ndjson). Se corre si la carga no terminó.
#
# Uso:  bash limpiar.sh   (o DIR=/dev/shm/<otro> bash limpiar.sh)
set -euo pipefail
DIR="${DIR:-/dev/shm/portal-historial}"
case "$DIR" in
  *..*) echo "HECHO error=dir_fuera_de_dev_shm" >&2; exit 2 ;;
  /dev/shm/?*) ;;
  *) echo "HECHO error=dir_fuera_de_dev_shm" >&2; exit 2 ;;
esac
rm -rf -- "$DIR"
echo "HECHO borrado=$DIR"
