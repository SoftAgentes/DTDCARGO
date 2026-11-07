#!/usr/bin/env bash
# infra/ops/tests/prueba-runbook-avisos-discord.sh — corre, tal cual, el bloque del
# paso 2 de docs/runbooks/avisos-servidor-discord.md (instalar los dos guiones nuevos
# en el VPS), marcado con <!-- bloque:instalar-guiones -->, contra carpetas temporales
# (SDD-0609).
#
#   bash infra/ops/tests/prueba-runbook-avisos-discord.sh
#
# Lo que cuida: al primer PARAR no se instala nada más; con el paquete alterado no se
# instala nada; no quedan temporales. `install -o root -g root` es un doble que copia
# (la prueba no corre como root). Corre en Linux y en Git Bash.
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

echo "RESUMEN: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
