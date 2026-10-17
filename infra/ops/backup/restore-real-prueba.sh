#!/usr/bin/env bash
# infra/ops/backup/restore-real-prueba.sh (en el VPS: /srv/ops/backup/) — restaura el ÚLTIMO respaldo real de dtd-cargo en una
# base desechable en memoria (restore-test.sh) con la llave age privada de Sam (SDD-0505).
# La llave se pega (no se muestra), vive en /dev/shm con permisos 600 y se borra al salir.
# No toca producción: restore-test.sh levanta su propio contenedor en una red interna.
set -euo pipefail
B=/srv/backups/dtd-cargo
OPS=/srv/ops
d="$(ls -t "$B"/dtd-cargo-*.dump.age | head -1)"; base="${d%.dump.age}"
c="$(ls -t "$B"/config/*.tar.age 2>/dev/null | head -1 || true)"
[[ -f "$d" && -f "${base}-roles.sql.age" && -f "${base}-acl.sql.age" ]] || { echo "faltan archivos del respaldo en $B"; exit 2; }
k="$(mktemp -p /dev/shm age-id.XXXXXX)"; chmod 600 "$k"
trap 'shred -u "$k" 2>/dev/null || rm -f "$k"; echo; echo "llave borrada de la memoria: $([ -e "$k" ] && echo NO || echo sí)"' EXIT
echo "Respaldo a probar: $(basename "$d") ($(du -h "$d" | cut -f1)) · configuración: $(basename "${c:-ninguna}")"
echo
key=""
for intento in 1 2 3; do
  read -rs -p "Pega tu llave privada age (empieza por AGE-SECRET-KEY-1) y pulsa Enter: " key < /dev/tty || key=""
  echo
  # Quita espacios, retornos y las marcas que agrega la terminal al pegar.
  key="$(printf '%s' "$key" | tr -d ' \r\t' | sed -E 's/\x1b\[[0-9;:<=>?]*[ -\/]*[@-~]//g')"
  if [[ "$key" == AGE-SECRET-KEY-1* ]]; then
    printf '%s\n' "$key" > "$k"
    pub="$(age-keygen -y "$k" 2>/dev/null || true)"
    if [[ -n "$pub" ]] && grep -qxF "$pub" "$OPS/backup/age-recipients.txt"; then
      echo "Llave correcta: es la que cifra los respaldos (huella $(printf '%s' "$pub" | sha256sum | cut -c1-16))."
      break
    fi
    echo "Esa llave no corresponde a los respaldos de este servidor. Intento $intento de 3."
  else
    echo "Eso no parece una llave privada age (largo ${#key}). Intento $intento de 3."
  fi
  : > "$k"; key=""
done
unset key
[[ -s "$k" ]] || { echo "Sin llave válida: no se prueba nada."; exit 2; }
ev="$OPS/evidencias/restore-real-$(date -u +%Y%m%dT%H%M%SZ).txt"
args=(--file "$d" --roles "${base}-roles.sql.age" --acl "${base}-acl.sql.age" --age-identity "$k" --evidence "$ev")
[[ -n "$c" ]] && args+=(--config "$c" --vault-readable)
echo
bash "$OPS/backup/restore-test.sh" "${args[@]}"
echo "evidencia: $ev"
