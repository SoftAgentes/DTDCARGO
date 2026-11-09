# infra/ops/lib/storage-lista.sh — la lista por archivo del respaldo del Storage (SDD-0620).
#
# La usan storage-backup.sh y storage-restore.sh: los dos tienen que escribirla
# EXACTAMENTE igual para que la comparación del restore signifique algo.
#
# Formato, una línea por archivo regular: «<sha256> <bytes> <ruta>», con la ruta
# relativa tal como la guarda `tar -C <origen> -cf - .` («./tenant/bucket/…»).
# Las rutas pueden llevar nombres de personas (el Storage guarda cédulas, fotos y
# comprobantes): la lista se cifra igual que el tar y nunca se escribe en claro.

# Para `tar -xf - --to-command=…`: GNU tar corre el comando por cada archivo
# regular del flujo (directorios y enlaces se ignoran), con el contenido en la
# entrada y TAR_FILENAME/TAR_SIZE en el entorno. Así la lista sale de los mismos
# bytes que se cifran, sin escribir ningún archivo.
# shellcheck disable=SC2016
STORAGE_LISTA_CMD='h=$(sha256sum | cut -c1-64) && printf "%s %s %s\n" "$h" "$TAR_SIZE" "$TAR_FILENAME"'

# La misma lista, leída de una carpeta restaurada.
storage_lista_de_carpeta() {
  (cd "$1" && find . -type f -print0 | while IFS= read -r -d '' f; do
    printf '%s %s %s\n' "$(sha256sum < "$f" | cut -c1-64)" "$(stat -c %s -- "$f")" "$f"
  done)
}
