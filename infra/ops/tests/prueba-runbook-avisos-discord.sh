#!/usr/bin/env bash
# infra/ops/tests/prueba-runbook-avisos-discord.sh — corre, tal cual, dos bloques de
# docs/runbooks/avisos-servidor-discord.md contra carpetas temporales (SDD-0609):
#   <!-- bloque:instalar-guiones -->  § 3 paso 2, instalar los dos guiones nuevos;
#   <!-- bloque:volver-env -->        § 6, volver atrás publicar.env o el .env de la app.
#
#   bash infra/ops/tests/prueba-runbook-avisos-discord.sh
#
# Lo que cuida:
#   - instalar: al primer PARAR no se instala nada más; con el paquete alterado no se
#     instala nada; no quedan temporales;
#   - volver: elige el respaldo por la huella del paso 1 (no por nombre), avisa que se
#     pierden los cambios intermedios, guarda el archivo de ese momento y, si falta la
#     huella o el respaldo, para sin tocar nada.
# `install -o root -g root` es un doble que copia (la prueba no corre como root).
# Corre en Linux y en Git Bash.
set -uo pipefail
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNBOOK="${RUNBOOK_AVISOS:-${R}/docs/runbooks/avisos-servidor-discord.md}"

T="$(mktemp -d)"; trap 'rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }

# El bloque: el primer ```bash después de la marca, hasta su ``` de cierre.
awk '/<!-- bloque:instalar-guiones -->/ { m = 1; next } m && /^```bash$/ { b = 1; next } b && /^```$/ { exit } b { print }' "${RUNBOOK}" > "${T}/bloque.sh"
n="$(grep -c . "${T}/bloque.sh")"
# Piso: un bloque vacío o recortado daría verde sin probar nada.
[ "${n}" -ge 10 ] && grep -q 'instalar_guiones' "${T}/bloque.sh" && grep -q 'PARAR en' "${T}/bloque.sh" \
  && ok "el bloque del paso 2 se encuentra por su marca (${n} líneas)" || { ko "no encuentro el bloque del paso 2 (${n} líneas)"; echo "RESUMEN: ${pass} PASÓ · ${fail} FALLÓ"; exit 1; }

mkdir -p "${T}/bin"
cat > "${T}/bin/install" <<'DOBLE'
#!/usr/bin/env bash
# Doble de install: ignora -o/-g/-m y copia el origen al destino.
a=(); while [ $# -gt 0 ]; do case "$1" in -o|-g|-m) shift 2 ;; *) a+=("$1"); shift ;; esac; done
cp "${a[0]}" "${a[1]}"
DOBLE
chmod +x "${T}/bin/install"

armar() { # $1 = contenido del 1.º, $2 = del 2.º → carpeta limpia con paquete y SHA256SUMS
  rm -rf "${T}/E"; mkdir -p "${T}/E/paquete" "${T}/E/web"
  printf '%s\n' "$1" > "${T}/E/paquete/aviso-discord.sh"
  printf '%s\n' "$2" > "${T}/E/paquete/guardar-webhook-discord.sh"
  ( cd "${T}/E/paquete" && sha256sum *.sh > SHA256SUMS )
}
correr() {
  ( cd "${T}" && PATH="${T}/bin:${PATH}" E="${T}/E" WEB="${T}/E/web" bash -c 'source "$1"' _ "${T}/bloque.sh" ) > "${T}/salida" 2>&1
  RC=$?
}
hay() { [ -f "${T}/E/web/$1" ]; }
sin_temporales() { [ -z "$(ls -A "${T}/E/web" | grep '^\.')" ]; }
ver() { sed 's/^/      /' "${T}/salida" | head -4; }

BIEN='#!/usr/bin/env bash
echo bien'
MAL='#!/usr/bin/env bash
if then fi ('

armar "${BIEN}" "${BIEN}"; correr
[ "${RC}" = 0 ] && hay aviso-discord.sh && hay guardar-webhook-discord.sh && [ "$(grep -c '^instalado:' "${T}/salida")" = 2 ] && sin_temporales \
  && ok "los dos bien: se instalan los dos y no quedan temporales" || { ko "los dos bien rc=${RC}"; ver; }
armar "${MAL}" "${BIEN}"; correr
[ "${RC}" != 0 ] && ! hay aviso-discord.sh && ! hay guardar-webhook-discord.sh && grep -q 'PARAR en aviso-discord.sh: no se instaló ni este ni los que siguen' "${T}/salida" && sin_temporales \
  && ok "el primero no pasa bash -n: PARAR y el segundo tampoco se instala" || { ko "primero malo rc=${RC}"; ver; }
armar "${BIEN}" "${MAL}"; correr
[ "${RC}" != 0 ] && hay aviso-discord.sh && ! hay guardar-webhook-discord.sh && grep -q 'PARAR en guardar-webhook-discord.sh' "${T}/salida" && grep -q '^instalado: aviso-discord.sh' "${T}/salida" && sin_temporales \
  && ok "el segundo no pasa: el primero quedó instalado y la salida lo dice" || { ko "segundo malo rc=${RC}"; ver; }
armar "${BIEN}" "${BIEN}"; printf '# tocado\n' >> "${T}/E/paquete/aviso-discord.sh"; correr
[ "${RC}" != 0 ] && ! hay aviso-discord.sh && ! hay guardar-webhook-discord.sh && grep -q 'PARAR: el paquete no coincide con SHA256SUMS; no se instaló nada' "${T}/salida" \
  && ok "paquete alterado después del SHA256SUMS: no se instala nada" || { ko "paquete alterado rc=${RC}"; ver; }

echo "== vuelta atrás del .env (§ 6, bloque:volver-env) =="
awk '/<!-- bloque:volver-env -->/ { m = 1; next } m && /^```bash$/ { b = 1; next } b && /^```$/ { exit } b { print }' "${RUNBOOK}" > "${T}/volver.sh"
n="$(grep -c . "${T}/volver.sh")"
[ "${n}" -ge 15 ] && grep -q '^volver_env()' "${T}/volver.sh" && grep -q 'AVISO:' "${T}/volver.sh" \
  && ok "el bloque de la vuelta atrás se encuentra por su marca (${n} líneas)" || ko "no encuentro el bloque volver-env (${n} líneas)"

# Una ventana: el .env del paso 1 (A), la vuelta de Sam 1 (B) y la 2 (C). El guion
# dejó un respaldo por vuelta: el de la 1 trae A y el de la 2 trae B. Por nombre, el
# de B va primero: hay que elegir por la huella de antes.txt, no por el nombre.
VIVO="${T}/V/.env"
ventana() {
  rm -rf "${T}/V"; mkdir -p "${T}/V/E"
  printf 'APP_ENV=production\nCRON_SECRET=a\n' > "${T}/A"
  printf 'APP_ENV=production\nCRON_SECRET=a\nDISCORD_WEBHOOK_REGISTRO=uno\n' > "${T}/B"
  printf 'APP_ENV=production\nCRON_SECRET=a\nDISCORD_WEBHOOK_REGISTRO=uno\nDISCORD_WEBHOOK_BUGS=dos\n' > "${T}/C"
  cp "${T}/A" "${T}/V/.env"; sha256sum "${VIVO}" > "${T}/V/E/antes.txt"
  cp "${T}/A" "${T}/V/.env.antes-0606-20261109T120000Z-zzzzzz"
  cp "${T}/B" "${T}/V/.env.antes-0606-20261109T120000Z-AAAAAA"
  cp "${T}/C" "${T}/V/.env"
}
volver() { # $1 = archivo vivo → $RC, salida en ${T}/salida
  ( cd "${T}" && PATH="${T}/bin:${PATH}" E="${T}/V/E" bash -c 'source "$1"; volver_env "$2"' _ "${T}/volver.sh" "$1" ) > "${T}/salida" 2>&1
  RC=$?
}
archivos() { ls -A "${T}/V" | grep -v '^E$' | LC_ALL=C sort | tr '\n' ' '; }

ventana; volver "${VIVO}"
atras="$(ls -A "${T}/V" | grep '^\.env\.antes-vuelta-[0-9]\{8\}T[0-9]\{6\}Z-[A-Za-z0-9]\{6\}$')"
[ "${RC}" = 0 ] && cmp -s "${VIVO}" "${T}/A" && grep -q "desde .env.antes-0606-20261109T120000Z-zzzzzz" "${T}/salida" \
  && ok "vuelve al .env del paso 1 eligiendo el respaldo por su huella, no el primero por nombre" || { ko "elige rc=${RC}"; ver; }
grep -q '^AVISO: .* vuelve ENTERO a como estaba en el paso 1. Se pierde todo lo que se escribió en él después' "${T}/salida" \
  && ok "avisa que también se pierden los cambios intermedios" || { ko "sin aviso"; ver; }
[ -n "${atras}" ] && cmp -s "${T}/V/${atras}" "${T}/C" && [ -z "$(ls -A "${T}/V" | grep '\.vuelta\.')" ] \
  && ok "guarda el .env de recién como .antes-vuelta-<UTC>-<sufijo> y no deja temporales" || { ko "respaldo de la vuelta: $(archivos)"; ver; }

ventana; rm -f "${T}/V/.env.antes-0606-20261109T120000Z-zzzzzz"; antes="$(archivos)"; volver "${VIVO}"
[ "${RC}" != 0 ] && cmp -s "${VIVO}" "${T}/C" && [ "$(archivos)" = "${antes}" ] && grep -q '^PARAR: ningún respaldo' "${T}/salida" \
  && ok "sin un respaldo con la huella del paso 1: PARAR y no toca nada" || { ko "sin respaldo rc=${RC}"; ver; }
ventana; : > "${T}/V/E/antes.txt"; antes="$(archivos)"; volver "${VIVO}"
[ "${RC}" != 0 ] && cmp -s "${VIVO}" "${T}/C" && [ "$(archivos)" = "${antes}" ] && grep -q '^PARAR: .*no tiene la huella' "${T}/salida" \
  && ok "antes.txt sin la huella del archivo: PARAR y no toca nada" || { ko "sin huella rc=${RC}"; ver; }
ventana; cp "${T}/A" "${VIVO}"; antes="$(archivos)"; volver "${VIVO}"
[ "${RC}" = 0 ] && cmp -s "${VIVO}" "${T}/A" && [ "$(archivos)" = "${antes}" ] && grep -q 'nada que volver' "${T}/salida" \
  && ok "ya está como en el paso 1: no hace nada" || { ko "igual rc=${RC}"; ver; }

echo "RESUMEN: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
