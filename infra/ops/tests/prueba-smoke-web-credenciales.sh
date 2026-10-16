#!/usr/bin/env bash
# infra/ops/tests/prueba-smoke-web-credenciales.sh — prueba de smoke-web.sh --credenciales (SDD-0540, Fase 1).
#
# Dobles de curl, openssl y date en una carpeta temporal: ninguna red, ningún
# servidor. El doble de curl contesta como una web sana (200, 307 al login,
# webp, GA en un chunk, CSP) y anota cada llamada; con DOBLE_SOLO_CON_CLAVE=1
# contesta 401 a toda llamada sin `-K`, como la puerta del entorno de prueba.
#
#   bash infra/ops/tests/prueba-smoke-web-credenciales.sh
#
# Condiciones de la sesión de Contabo (dueña del script) que se comprueban:
#   · sin --credenciales la conducta es la de siempre: curl nunca recibe -K, no
#     se crea ningún archivo y la salida es la misma que con la opción, salvo el
#     «con credenciales: sí» del resumen;
#   · con la opción, TODAS las llamadas de curl llevan -K y la clave nunca está
#     en argv ni en la salida; los openssl s_client no la usan;
#   · archivo que falta, que no es un archivo, ilegible o mal formado: sale 2.
# Controles rojos: dos copias del script rotas a propósito (una manda -K sin la
# opción; otra pasa la clave con -u) tienen que hacer fallar las comprobaciones.
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SW="${S}/web/smoke-web.sh"
T="$(mktemp -d)"; trap 'chmod -R u+rwx "${T}" 2>/dev/null; rm -rf "${T}"' EXIT
pass=0; fail=0; nv=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
nover() { echo "NO VERIFICADO · $*"; nv=$((nv + 1)); }
HOST="prueba.example.test"
export DOBLE_DIR="${T}/doble" DOBLE_HOST="${HOST}"
mkdir -p "${DOBLE_DIR}/bin" "${T}/tmp"
# Los temporales del script van a una carpeta propia: así se ve si quedó algo.
export TMPDIR="${T}/tmp"

cat > "${DOBLE_DIR}/bin/curl" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/curl.log"
url=""; fmt=""; cabeceras=0; conf=""; prev=""
for a in "$@"; do
  case "${prev}" in
    -w) fmt="${a}" ;;
    -K) conf="${a}"; cat -- "${a}" >> "${DOBLE_DIR}/curl-config-visto" 2>/dev/null ;;
  esac
  case "${a}" in https://*) url="${a}" ;; -I) cabeceras=1 ;; esac
  prev="${a}"
done
h="${url#https://}"; h="${h%%/*}"
p="${url#https://${h}}"; p="${p%%\?*}"; [[ -n "${p}" ]] || p="/"
codigo=200
[[ "${DOBLE_SOLO_CON_CLAVE:-0}" == 1 && -z "${conf}" ]] && codigo=401
if (( cabeceras )); then
  printf 'HTTP/2 %s\r\ncontent-security-policy: default-src %s; connect-src %s https://supabase.dtdcargo.com wss://supabase.dtdcargo.com\r\n\r\n' "${codigo}" "'self'" "'self'"
  exit 0
fi
if [[ -n "${fmt}" ]]; then
  case "${fmt}" in
    *time_starttransfer*) printf '  ttfb 0.100s total 0.200s\n' ;;
    *redirect_url*)
      if [[ "${codigo}" == 401 ]]; then printf '401 '
      elif [[ "${h}" == www.* ]]; then printf '301 https://%s%s?x=1' "${h#www.}" "${p}"
      else printf '307 https://%s/studio/login' "${h}"; fi ;;
    *content_type*) [[ "${codigo}" == 401 ]] && printf '401 text/plain 17' || printf '200 image/webp 1500' ;;
    *) printf '%s' "${codigo}" ;;
  esac
  exit 0
fi
[[ "${codigo}" == 401 ]] && { printf '401 Unauthorized\n'; exit 0; }
case "${p}" in
  /) printf '<html><script src="/_next/static/chunks/aaa.js"></script><script src="/_next/static/chunks/bbb.js"></script></html>' ;;
  *.js) [[ "${p}" == */bbb.js ]] && printf 'gtag("config","G-25CD7BZH98")' || printf 'console.log(1)' ;;
esac
DOBLE
cat > "${DOBLE_DIR}/bin/openssl" <<'DOBLE'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOBLE_DIR}/openssl.log"
cat > /dev/null
if [[ "${1-}" == x509 ]]; then
  echo "issuer=C = US, O = Let's Encrypt, CN = R11"
  [[ " $* " == *" -ext "* ]] && echo "X509v3 Subject Alternative Name: DNS:www.${DOBLE_HOST}, DNS:${DOBLE_HOST}"
fi
exit 0
DOBLE
cat > "${DOBLE_DIR}/bin/date" <<'DOBLE'
#!/usr/bin/env bash
echo "2026-10-16T00:00:00Z"
DOBLE
chmod +x "${DOBLE_DIR}/bin/curl" "${DOBLE_DIR}/bin/openssl" "${DOBLE_DIR}/bin/date"
export PATH="${DOBLE_DIR}/bin:${PATH}"

limpiar() { rm -f "${DOBLE_DIR}/curl.log" "${DOBLE_DIR}/openssl.log" "${DOBLE_DIR}/curl-config-visto"; }
correr() { # $1 script, $2 salida, resto: argumentos
  local s="$1" out="$2"; shift 2
  limpiar
  bash "${s}" --host "${HOST}" --ip 10.0.0.1 "$@" > "${out}" 2>&1
}

CLAVE="$(printf 'clave-de-prueba-%s' "${RANDOM}${RANDOM}")"
printf 'sam:%s\n' "${CLAVE}" > "${T}/cred.txt"; chmod 600 "${T}/cred.txt"

# Comprobaciones de la conducta SIN la opción (también sirven para los rojos).
revisar_sin_opcion() { # $1 salida · imprime los problemas, uno por línea
  grep -qE -- '(^| )-K ' "${DOBLE_DIR}/curl.log" && echo "curl recibió -K sin --credenciales"
  grep -qi 'credenciales' "$1" && echo "la salida menciona credenciales"
  [[ -z "$(ls -A "${TMPDIR}")" ]] || echo "quedaron temporales en TMPDIR"
  return 0
}
revisar_con_opcion() { # $1 salida
  local n_curl n_k
  n_curl="$(wc -l < "${DOBLE_DIR}/curl.log" | tr -d ' ')"
  n_k="$(grep -cE -- '(^| )-K ' "${DOBLE_DIR}/curl.log")"
  [[ "${n_curl}" -gt 10 && "${n_k}" == "${n_curl}" ]] || echo "solo ${n_k} de ${n_curl} llamadas de curl llevan -K"
  grep -qF -- "${CLAVE}" "${DOBLE_DIR}/curl.log" && echo "la clave viajó en argv de curl"
  grep -qF -- "${CLAVE}" "$1" && echo "la clave aparece en la salida"
  grep -qF -- "${CLAVE}" "${DOBLE_DIR}/openssl.log" && echo "openssl recibió la clave"
  grep -q -- '-K' "${DOBLE_DIR}/openssl.log" && echo "openssl recibió -K"
  grep -qxF "user = \"sam:${CLAVE}\"" "${DOBLE_DIR}/curl-config-visto" 2>/dev/null || echo "curl no recibió la clave en su archivo -K"
  [[ -z "$(ls -A "${TMPDIR}")" ]] || echo "quedó el archivo -K en TMPDIR"
  [[ "$(tail -n1 "$1")" == *"· con credenciales: sí" ]] || echo "el resumen no dice «con credenciales: sí»"
  return 0
}

echo "== sin --credenciales: la conducta de siempre"
correr "${SW}" "${T}/sin.out"; rc=$?
cp "${DOBLE_DIR}/curl.log" "${T}/sin-curl.log"
problemas="$(revisar_sin_opcion "${T}/sin.out")"
[[ ${rc} -eq 0 && -z "${problemas}" ]] && ok "sale 0, curl nunca recibe -K, no menciona credenciales ni deja temporales" || { ko "sin opción rc=${rc}: ${problemas}"; cat "${T}/sin.out"; }
grep -q '^RESUMEN: 12 PASÓ · 0 FALLÓ$' "${T}/sin.out" && ok "resumen de siempre: «RESUMEN: 12 PASÓ · 0 FALLÓ»" || ko "resumen sin opción: $(tail -n1 "${T}/sin.out")"

echo "== con --credenciales: todas las llamadas de curl, nunca por argv"
correr "${SW}" "${T}/con.out" --credenciales "${T}/cred.txt"; rc=$?
cp "${DOBLE_DIR}/curl.log" "${T}/con-curl.log"
problemas="$(revisar_con_opcion "${T}/con.out")"
[[ ${rc} -eq 0 && -z "${problemas}" ]] && ok "las $(wc -l < "${T}/con-curl.log" | tr -d ' ') llamadas de curl llevan -K; la clave no está en argv, salida ni openssl; no quedan temporales" \
  || { ko "con opción rc=${rc}: ${problemas}"; cat "${T}/con.out"; }
diff <(sed '$d' "${T}/sin.out") <(sed '$d' "${T}/con.out") > /dev/null \
  && [[ "$(tail -n1 "${T}/con.out")" == "$(tail -n1 "${T}/sin.out") · con credenciales: sí" ]] \
  && ok "la salida es la misma salvo «· con credenciales: sí» en el resumen" || { ko "la salida cambia con la opción"; diff "${T}/sin.out" "${T}/con.out"; }
diff <(sed -E 's/ -K [^ ]+//' "${T}/con-curl.log") "${T}/sin-curl.log" > /dev/null \
  && ok "las llamadas de curl son las mismas, más el -K" || { ko "llamadas de curl distintas"; diff <(sed -E 's/ -K [^ ]+//' "${T}/con-curl.log") "${T}/sin-curl.log" | head; }

echo "== detrás de la puerta (401 sin clave)"
DOBLE_SOLO_CON_CLAVE=1 correr "${SW}" "${T}/puerta-sin.out"; r1=$?
DOBLE_SOLO_CON_CLAVE=1 correr "${SW}" "${T}/puerta-con.out" --credenciales "${T}/cred.txt"; r2=$?
[[ ${r1} -eq 1 && ${r2} -eq 0 ]] && grep -q 'FALLÓ GET / → 401' "${T}/puerta-sin.out" \
  && ok "sin la clave falla con 401 (1); con --credenciales pasa (0)" || ko "puerta: sin=${r1} con=${r2}"
DOBLE_SOLO_CON_CLAVE=1 correr "${SW}" "${T}/www.out" --credenciales "${T}/cred.txt" --www; rc=$?
[[ ${rc} -eq 0 && "$(grep -cE -- '(^| )-K ' "${DOBLE_DIR}/curl.log")" == "$(wc -l < "${DOBLE_DIR}/curl.log" | tr -d ' ')" ]] \
  && ok "--www también usa la clave en su llamada de curl" || { ko "--www rc=${rc}"; cat "${T}/www.out"; }

echo "== archivos inválidos: sale 2 sin pedir nada"
for caso in "no-existe:${T}/no-existe.txt" "carpeta:${T}"; do
  nombre="${caso%%:*}"; f="${caso#*:}"
  correr "${SW}" "${T}/inv.out" --credenciales "${f}"; rc=$?
  [[ ${rc} -eq 2 && ! -s "${DOBLE_DIR}/curl.log" ]] && ok "${nombre}: sale 2 y no llama a curl" || ko "${nombre}: rc=${rc}"
done
printf 'sin-dos-puntos\n' > "${T}/mal1.txt"
printf 'sam:con"comilla\n' > "${T}/mal2.txt"
printf '' > "${T}/mal3.txt"
for f in mal1 mal2 mal3; do
  correr "${SW}" "${T}/inv.out" --credenciales "${T}/${f}.txt"; rc=$?
  [[ ${rc} -eq 2 && ! -s "${DOBLE_DIR}/curl.log" ]] && ! grep -qF 'con"comilla' "${T}/inv.out" && ok "${f}.txt mal formado: sale 2 sin mostrarlo" || ko "${f}.txt: rc=${rc}"
done
correr "${SW}" "${T}/inv.out" --credenciales; rc=$?
[[ ${rc} -eq 2 ]] && ok "--credenciales sin archivo: sale 2" || ko "--credenciales vacío rc=${rc}"
cp "${T}/cred.txt" "${T}/cerrado.txt"; chmod 000 "${T}/cerrado.txt"
if [[ -r "${T}/cerrado.txt" ]]; then
  nover "archivo ilegible: este usuario lo lee igual (root o NTFS)"
else
  correr "${SW}" "${T}/inv.out" --credenciales "${T}/cerrado.txt"; rc=$?
  [[ ${rc} -eq 2 && ! -s "${DOBLE_DIR}/curl.log" ]] && ok "archivo ilegible: sale 2" || ko "ilegible rc=${rc}"
fi

echo "== controles rojos: las comprobaciones sí ven un script roto"
sed 's|^pedir() { curl -s|pedir() { curl -K /dev/null -s|' "${SW}" > "${T}/roto-k.sh"
grep -q 'curl -K /dev/null -s' "${T}/roto-k.sh" || ko "no se pudo armar el rojo de -K"
correr "${T}/roto-k.sh" "${T}/roto-k.out"
[[ -n "$(revisar_sin_opcion "${T}/roto-k.out")" ]] && ok "rojo: un script que manda -K sin la opción no pasa la comprobación" || ko "el rojo de -K pasó"
sed 's|curl -s --max-time 30 --resolve "${HOST}:443:${IP}" ${CRED_K\[@\]+"${CRED_K\[@\]}"} "\$@"|curl -s --max-time 30 --resolve "${HOST}:443:${IP}" -u "$(cat "${CREDENCIALES}")" "$@"|' "${SW}" > "${T}/roto-u.sh"
grep -q -- '-u "$(cat' "${T}/roto-u.sh" || ko "no se pudo armar el rojo de -u"
correr "${T}/roto-u.sh" "${T}/roto-u.out" --credenciales "${T}/cred.txt"
[[ -n "$(revisar_con_opcion "${T}/roto-u.out")" ]] && ok "rojo: un script que pasa la clave con -u no pasa la comprobación" || ko "el rojo de -u pasó"

echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ · ${nv} NO VERIFICADO"
[[ "${fail}" == 0 ]]
