#!/usr/bin/env bash
# Prueba de infra/chatwoot/pegar-secretos-web.sh con un `docker` falso y un .env temporal.
# No toca el VPS. Uso: bash infra/chatwoot/pruebas/prueba-pegar-secretos-web.sh [guion]
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
GUION="${1:-$RAIZ/infra/chatwoot/pegar-secretos-web.sh}"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
cat > "$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *psql*) printf '%s\n' "${STUB_0505:-1}" ;;
  *access_token*) printf 'ruido de arranque\nDTDVALOR=%s' "${STUB_ROUTER:-routerDelServidor1234567}" ;;
  *Webhook*) [ -n "${STUB_WEBHOOK:-}" ] && printf 'DTDVALOR=%s' "$STUB_WEBHOOK" ;;
esac
exit 0
EOF
chmod +x "$T/bin/docker"
mkdir -p "$T/secretos"
cat > "$T/secretos/platform-app.env" <<'EOF'
CHATWOOT_PLATFORM_TOKEN=platformDelArchivo123456
CHATWOOT_SERVICE_USER_ID=1
EOF

FALLAS=0
ok() { echo "ok    $1"; }
mal() { echo "FALLA $1"; FALLAS=$((FALLAS + 1)); }
correr() { # $1 = stdin; el resto, argumentos. Deja salida en $T/salida y código en $CODIGO
  local entrada="$1"; shift
  printf '%b' "$entrada" | PATH="$T/bin:$PATH" PEGAR_ENV_WEB="$T/.env" PEGAR_SECRETOS="$T/secretos" \
    bash "$GUION" "$@" > "$T/salida" 2>&1
  CODIGO=$?
}
nuevo_env() { printf 'OTRA=1\nCHATWOOT_ROUTER_TOKEN=\nFINAL=2\n' > "$T/.env"; }

nuevo_env; correr '' desconocido
[ "$CODIGO" = 2 ] && ok "entorno inválido sale con 2" || mal "entorno inválido: $CODIGO"

nuevo_env; correr '' prueba CHATWOOT_OTRA
[ "$CODIGO" = 2 ] && ok "nombre desconocido sale con 2" || mal "nombre desconocido: $CODIGO"

nuevo_env; antes=$(cat "$T/.env"); STUB_0505=0 correr 'pegadoAquiNoEntra123456\n' prueba
[ "$CODIGO" = 3 ] && [ "$(cat "$T/.env")" = "$antes" ] && ok "sin la 0505 no toca nada" || mal "sin la 0505: $CODIGO"

nuevo_env
STUB_WEBHOOK=secretoDelWebhook123456 correr '\n\033[200~pegadoDelRouter1234567\033[201~\r\n\n' produccion
s=$(cat "$T/salida")
case "$s" in
  *"not found"* | *"no se encontr"*) mal "el guion intentó correr un comando que no existe" ;;
  *"El contenedor web los lee"*) ok "avisa que web los lee al recrearse" ;;
  *) mal "falta el aviso de recrear web" ;;
esac
[ "$CODIGO" = 0 ] && ok "carga las tres" || mal "carga las tres: $CODIGO · $s"
grep -qx "CHATWOOT_PLATFORM_TOKEN='platformDelArchivo123456'" "$T/.env" && ok "Enter toma el del archivo" || mal "token del archivo"
grep -qx "CHATWOOT_ROUTER_TOKEN='pegadoDelRouter1234567'" "$T/.env" && ok "lo pegado entra sin marcas de pegado ni \\r" || mal "token pegado"
grep -qx "CHATWOOT_WEBHOOK_SECRET='secretoDelWebhook123456'" "$T/.env" && ok "Enter toma el del webhook" || mal "secreto del webhook"
[ "$(grep -c '^CHATWOOT_ROUTER_TOKEN=' "$T/.env")" = 1 ] && ok "la línea vacía se reemplaza, sin duplicar" || mal "línea duplicada"
grep -qx 'OTRA=1' "$T/.env" && grep -qx 'FINAL=2' "$T/.env" && ok "las otras líneas siguen" || mal "otras líneas"
case "$s" in
  *platformDelArchivo* | *pegadoDelRouter* | *secretoDelWebhook*) mal "un valor salió por pantalla" ;;
  *) ok "ningún valor sale por pantalla" ;;
esac

antes=$(cat "$T/.env"); correr 'otroValorQueNoEntra123456\n' prueba CHATWOOT_ROUTER_TOKEN
[ "$CODIGO" = 0 ] && [ "$(cat "$T/.env")" = "$antes" ] && ok "con valor no lo toca" || mal "pisó un valor: $CODIGO"

nuevo_env; antes=$(cat "$T/.env"); correr "con espacios\nque'comilla\ncorto\n" prueba CHATWOOT_ROUTER_TOKEN
[ "$CODIGO" = 4 ] && [ "$(cat "$T/.env")" = "$antes" ] && ok "tres valores malos: sale con 4, sin escribir" || mal "valores malos: $CODIGO"

nuevo_env; correr '\n\n\n' produccion
[ "$CODIGO" = 5 ] && grep -q '^CHATWOOT_PLATFORM_TOKEN=' "$T/.env" && ! grep -q '^CHATWOOT_WEBHOOK_SECRET=' "$T/.env" \
  && ok "sin webhook carga lo demás y sale con 5" || mal "sin webhook: $CODIGO · $(cat "$T/salida")"

nuevo_env; STUB_ROUTER='no sirve' correr '\n\n' produccion CHATWOOT_ROUTER_TOKEN
grep -q '^CHATWOOT_ROUTER_TOKEN=.' "$T/.env" && mal "aceptó un valor malo del servidor" || ok "un valor malo del servidor no entra"

nuevo_env; correr '\n\n' prueba CHATWOOT_PLATFORM_TOKEN CHATWOOT_ROUTER_TOKEN
[ "$CODIGO" = 5 ] && ! grep -q '^CHATWOOT_PLATFORM_TOKEN=.' "$T/.env" && ! grep -q '^CHATWOOT_ROUTER_TOKEN=.' "$T/.env" \
  && ok "prueba no toma los tokens de producción" || mal "prueba tomó tokens de producción: $CODIGO"

printf 'CHATWOOT_PLATFORM_TOKEN=platformDePrueba1234567\n' > "$T/secretos/platform-app-prueba.env"
nuevo_env; correr '\n' prueba CHATWOOT_PLATFORM_TOKEN
grep -qx "CHATWOOT_PLATFORM_TOKEN='platformDePrueba1234567'" "$T/.env" && ok "prueba toma el de su archivo" || mal "archivo de prueba: $CODIGO"

echo "fallas: $FALLAS"
[ "$FALLAS" = 0 ]
