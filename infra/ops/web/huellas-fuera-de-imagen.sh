#!/usr/bin/env bash
# Huellas de lo que DTD Cargo necesita y que NO viaja dentro de la imagen
# (SDD-0541, publicación automática de la web).
#
#   huellas-fuera-de-imagen.sh repo <raíz-del-repo>           # en GitHub, al construir la imagen
#   huellas-fuera-de-imagen.sh servidor <dir-del-proyecto>    # en el VPS (/srv/dtd-cargo)
#   ... --etiqueta                                            # una sola línea, para la etiqueta
#
# Los compose, el cron y las Edge Functions son copias del repo en /srv/dtd-cargo:
# cambiar la imagen no los actualiza. GitHub guarda estas huellas en la etiqueta
# `org.dtdcargo.fuera-de-imagen` de la imagen y el VPS las recalcula sobre sus
# copias antes de publicar (publicar-web.sh). Si difieren, el servidor quedó
# atrás del repo en ese commit.
#
# Salida: una línea `ruta sha256` por entrada, en este orden fijo. Un archivo o
# una carpeta que no existe da `ausente`. Una carpeta da el sha256 de su
# manifiesto (`sha256  ruta-relativa` por archivo, orden de bytes): detecta
# archivos cambiados, nuevos y borrados.
#
# `functions/` en el repo es la misma unión que arma el README de infra/dtd-cargo
# al desplegar: primero el router del upstream (supabase/volumes/functions) y
# encima las funciones del repo (supabase/functions).
set -euo pipefail
export LC_ALL=C

MODO="${1:-}"; RAIZ="${2:-}"; FORMATO="${3:-lineas}"
uso() { sed -n '2,8p' "$0" >&2; exit 2; }
[ -n "$MODO" ] && [ -n "$RAIZ" ] || uso
[ -d "$RAIZ" ] || { echo "no existe: $RAIZ" >&2; exit 2; }
case "$FORMATO" in lineas|--etiqueta) ;; *) uso ;; esac

archivo() { # $1 = ruta → sha256 o «ausente»
  if [ -f "$1" ]; then sha256sum "$1" | cut -d' ' -f1; else echo ausente; fi
}
carpeta() { # $1 = carpeta, $2 = subcarpeta a excluir (opcional) → sha256 del manifiesto
  local d="$1" fuera="${2:-}"
  [ -d "$d" ] || { echo ausente; return; }
  (
    cd "$d"
    if [ -n "$fuera" ]; then
      find . -type f ! -path "./${fuera}/*" -print0
    else
      find . -type f -print0
    # `sha256sum` de Git Bash escribe `hash *./ruta` (modo binario) y el de Linux
    # `hash  ./ruta`: se normaliza a `hash  ruta` para que la huella no dependa de
    # dónde se calcula.
    fi | sort -z | xargs -0 -r sha256sum | sed -E 's|^([0-9a-f]{64}) [ *]\./|\1  |'
  ) | sha256sum | cut -d' ' -f1
}

case "$MODO" in
  repo)
    D="${RAIZ}/infra/dtd-cargo"
    [ -f "${D}/compose.yml" ] || { echo "no parece la raíz del repo: falta infra/dtd-cargo/compose.yml" >&2; exit 2; }
    UNION="$(mktemp -d)"; trap 'rm -rf "$UNION"' EXIT
    [ -d "${D}/supabase/volumes/functions" ] && cp -R "${D}/supabase/volumes/functions/." "$UNION/"
    [ -d "${RAIZ}/supabase/functions" ] && cp -R "${RAIZ}/supabase/functions/." "$UNION/"
    FUNCIONES="$UNION"
    ;;
  servidor)
    D="$RAIZ"
    FUNCIONES="${HUELLAS_FUNCTIONS_DIR:-${D}/functions}"
    ;;
  *) uso ;;
esac

{
  echo "compose.yml $(archivo "${D}/compose.yml")"
  echo "compose.supabase.yml $(archivo "${D}/compose.supabase.yml")"
  echo "cron/Dockerfile $(archivo "${D}/cron/Dockerfile")"
  echo "cron/crontab $(archivo "${D}/cron/crontab")"
  echo "cron/entrypoint.sh $(archivo "${D}/cron/entrypoint.sh")"
  echo ".env.example $(archivo "${D}/.env.example")"
  echo "supabase/templates/ $(carpeta "${D}/supabase/templates")"
  echo "supabase/volumes/ $(carpeta "${D}/supabase/volumes" functions)"
  # Vacía (sin archivos) cuenta como ausente: así una carpeta recién creada en
  # el servidor no pasa por igual a una unión vacía del repo.
  if [ -n "$(find "$FUNCIONES" -type f -print -quit 2>/dev/null)" ]; then
    echo "functions/ $(carpeta "$FUNCIONES")"
  else
    echo "functions/ ausente"
  fi
} | if [ "$FORMATO" = --etiqueta ]; then
  # v1:<n>:ruta=sha,ruta=sha… — el conteo deja ver una etiqueta truncada.
  awk 'BEGIN { ORS = "" } { l[NR] = $1 "=" $2 } END { print "v1:" NR ":"; for (i = 1; i <= NR; i++) { if (i > 1) print ","; print l[i] } print "\n" }'
else
  cat
fi
