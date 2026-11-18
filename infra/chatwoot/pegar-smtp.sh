#!/usr/bin/env bash
# SDD-0583: recibe el usuario y la clave SMTP de Hostinger para Chatwoot y los escribe en
# /srv/chatwoot/.env. El usuario se ve; la clave no (se pide dos veces). Solo escribe si las
# dos lineas siguen vacias. No recrea contenedores: eso va aparte, con el remitente.
# La clave va entre comillas simples: en el .env de compose son literales ($ y # no se tocan).
set -euo pipefail
cd /srv/chatwoot
ENV=.env

if ! grep -qx 'CHATWOOT_SMTP_USERNAME=' "$ENV" || ! grep -qx 'CHATWOOT_SMTP_PASSWORD=' "$ENV"; then
  echo "CHATWOOT_SMTP_USERNAME o CHATWOOT_SMTP_PASSWORD ya tienen valor (o no estan): no toco nada."
  exit 1
fi

# El usuario trae valor por omision: Enter lo acepta, asi no hace falta pegar nada visible.
POR_OMISION=notificaciones@dtdcargo.com
read -r -p "Usuario SMTP [Enter = $POR_OMISION]: " U
U=${U:-$POR_OMISION}
echo "Usuario: $U"
# Lineas vacias se ignoran: si el gestor copia la clave con salto de linea, el pegado ya
# envia la linea y el Enter de mas no cuenta como respuesta. Se quita un \r final.
leer_clave() {
  local v=""
  while [ -z "$v" ]; do read -r -s -p "$1" v; echo >&2; v=${v%$'\r'}; done
  printf '%s' "$v"
}
P=$(leer_clave "Clave SMTP (no se ve): ")
P2=$(leer_clave "Repite la clave: ")

falla() { unset U P P2; echo "$1 No toco nada."; exit 1; }
[ "$P" = "$P2" ] || falla "Las dos claves no coinciden."
[ -n "$U" ] || falla "El usuario esta vacio."
[ -n "$P" ] || falla "La clave esta vacia."
case "$U" in *@*.*) ;; *) falla "El usuario no parece un correo completo." ;; esac
case "$U$P" in *"'"*) falla "Tiene una comilla simple ('): elige una clave sin ella." ;; esac
case "$U$P" in *[[:space:]]*) falla "Tiene espacios: elige una clave sin espacios." ;; esac

umask 077
TMP=$(mktemp /dev/shm/cw-env.XXXXXX)
trap 'rm -f "$TMP"' EXIT
while IFS= read -r linea || [ -n "$linea" ]; do
  case "$linea" in
    CHATWOOT_SMTP_USERNAME=) printf "CHATWOOT_SMTP_USERNAME='%s'\n" "$U" ;;
    CHATWOOT_SMTP_PASSWORD=) printf "CHATWOOT_SMTP_PASSWORD='%s'\n" "$P" ;;
    *) printf '%s\n' "$linea" ;;
  esac
done < "$ENV" > "$TMP"
# cat > conserva el archivo, su dueno y su 0600.
cat "$TMP" > "$ENV"
LU=${#U}; LP=${#P}
unset U P P2

echo "Escrito. Largos: usuario $LU, clave $LP (comparalos con tu gestor)."
stat -c '%a %U %n' "$ENV"
