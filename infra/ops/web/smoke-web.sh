#!/usr/bin/env bash
# Smoke sin sesión de la web de DTD Cargo servida por el VPS (SDD-0505, paso 2).
#
#   smoke-web.sh --host nuevo.dtdcargo.com          # ensayo (miércoles 14)
#   smoke-web.sh --host dtdcargo.com                # corte (jueves 15, T+5 y T+20)
#   smoke-web.sh --host dtdcargo.com --ip 1.2.3.4   # otro servidor
#
# Pide todo a la IP del VPS con `--resolve`: mide el servidor aunque el DNS
# público todavía apunte a Vercel o esté a mitad de propagarse. No inicia
# sesión ni escribe nada: el smoke con usuarios (Studio, PWA, subida, Realtime)
# lo hace Sam en el navegador. Sale 1 si algo FALLÓ.
#
# Nació del ensayo del 2026-10-14 (runbook servidor-contabo §3.6): ahí se
# encontraron dos diferencias con Vercel que este script vigila desde entonces,
# Google Analytics apagado en la imagen y /_next/image sin optimizar.
set -uo pipefail

HOST=""
IP="217.216.54.70"
GA_ID="G-25CD7BZH98"
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:-}"; shift 2 ;;
    --ip) IP="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 2 ;;
  esac
done
[ -n "$HOST" ] || { echo "falta --host" >&2; exit 2; }

ok=0; mal=0
pasa() { echo "PASÓ  $1"; ok=$((ok + 1)); }
falla() { echo "FALLÓ $1"; mal=$((mal + 1)); }
pedir() { curl -s --max-time 30 --resolve "${HOST}:443:${IP}" "$@"; }

echo "== ${HOST} en ${IP} · $(date -u +%Y-%m-%dT%H:%M:%SZ) =="

emisor=$(echo | openssl s_client -connect "${IP}:443" -servername "${HOST}" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null)
case "$emisor" in
  *"Let's Encrypt"*) pasa "certificado de Let's Encrypt para ${HOST}" ;;
  *) falla "certificado: emisor «${emisor:-ninguno}» (¿router sin certificado todavía?)" ;;
esac

for p in / /tarifas /studio/login /entrar /m/ve/login /robots.txt /sitemap.xml; do
  c=$(pedir -o /dev/null -w '%{http_code}' "https://${HOST}${p}")
  [ "$c" = 200 ] && pasa "GET ${p} → 200" || falla "GET ${p} → ${c} (esperado 200)"
done

# Sin sesión, el Studio manda al login del MISMO host (si manda a otro, el
# SITE_URL o el router están mal).
r=$(pedir -o /dev/null -w '%{http_code} %{redirect_url}' "https://${HOST}/studio/dashboard")
case "$r" in
  "307 https://${HOST}/studio/login"*) pasa "GET /studio/dashboard sin sesión → 307 al login de ${HOST}" ;;
  *) falla "GET /studio/dashboard sin sesión → ${r}" ;;
esac

# next/image tiene que redimensionar y convertir: en Vercel el isologo a 48 px
# pesa ~1,5 KB en WebP; sin libvips el VPS devolvía el PNG original de 38 KB.
img=$(pedir -o /dev/null -H 'Accept: image/avif,image/webp,*/*' -w '%{http_code} %{content_type} %{size_download}' \
  "https://${HOST}/_next/image?url=%2Fbrand%2Fdtdcargo-isologo-primary.png&w=48&q=75")
read -r ic it is <<<"$img"
if [ "$ic" = 200 ] && [ "$it" = image/webp ] && [ "${is:-999999}" -lt 5120 ]; then
  pasa "/_next/image w=48 → webp de ${is} bytes"
else
  falla "/_next/image w=48 → ${img} (esperado 200 image/webp < 5120 bytes)"
fi

# Google Analytics y la etiqueta de Ads viajan en un chunk de JS, no en el HTML.
html=$(pedir "https://${HOST}/")
ga=0
for s in $(printf '%s' "$html" | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u); do
  if pedir "https://${HOST}${s}" | grep -q "$GA_ID"; then ga=1; break; fi
done
[ "$ga" = 1 ] && pasa "Google Analytics ${GA_ID} en los chunks" || falla "Google Analytics ${GA_ID} no aparece en los chunks de la portada"

csp=$(pedir -I "https://${HOST}/studio/login" | tr -d '\r' | grep -i '^content-security-policy:' | tr ';' '\n' | grep -i 'connect-src')
printf '%s' "$csp" | grep -q 'supabase.dtdcargo.com' && pasa "CSP connect-src con supabase.dtdcargo.com" || falla "CSP connect-src sin supabase.dtdcargo.com"

echo "== tiempos de la portada =="
for _ in 1 2 3; do pedir -o /dev/null -w '  ttfb %{time_starttransfer}s total %{time_total}s\n' "https://${HOST}/"; done

echo "RESUMEN: ${ok} PASÓ · ${mal} FALLÓ"
[ "$mal" = 0 ]
