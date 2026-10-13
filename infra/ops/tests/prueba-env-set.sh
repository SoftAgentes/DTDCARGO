#!/usr/bin/env bash
# infra/ops/tests/prueba-env-set.sh — prueba de migrate/env-set.sh (SDD-0505).
# Proyecto inventado en un directorio temporal, claves inventadas: nada real.
# Corre en el VPS (python3 y docker compose): bash infra/ops/tests/prueba-env-set.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ES="${S}/migrate/env-set.sh"
T="$(mktemp -d)"; trap 'docker network rm zz-envset_default >/dev/null 2>&1; rm -rf "${T}"' EXIT
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass+1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail+1)); }
P="${T}/zz-envset"; mkdir -p "${P}" "${T}/evid"
# Las evidencias de la prueba van al temporal, no a /srv/ops/evidencias.
export ENV_SET_EVIDENCE_DIR="${T}/evid"
cat > "${P}/.env" <<'EOF'
POSTGRES_PASSWORD=x
JWT_SECRET=viejo
ANON_KEY=viejo
SERVICE_ROLE_KEY=viejo
NEXT_PUBLIC_SUPABASE_ANON_KEY=viejo
SUPABASE_SERVICE_ROLE_KEY=viejo
############
# App
############
# ── Integraciones de la app ─────────
RESEND_API_KEY=
TELEGRAM_BOT_TOKEN=
ANTHROPIC_API_KEY=ya-tenia
############
# Otro bloque
############
OTRA=1
EOF
chmod 600 "${P}/.env"
run() { bash "${ES}" --project zz-envset --project-dir "${P}" "$@"; }
val() { grep -E "^$1=" "${P}/.env" | cut -d= -f2-; }

# --name con caracteres que compose interpretaría ($, #, espacio)
printf '%s\n' 'abc$HOME #no-comentario y espacio' | run --name RESEND_API_KEY > "${T}/n.log" 2>&1
[ "$(val RESEND_API_KEY)" = "'abc\$HOME #no-comentario y espacio'" ] && ok "--name guarda el valor literal entre comillas simples" || ko "--name: $(val RESEND_API_KEY)"
grep -q 'abc\$HOME' "${T}/n.log" && ko "--name mostró el valor" || ok "--name no muestra el valor"
[ "$(stat -c %a "${P}/.env")" = 600 ] && ok ".env sigue en 600" || ko "permisos $(stat -c %a "${P}/.env")"
mkdir -p "${T}/c"; printf 'services:\n  x:\n    image: alpine:3.20\n    env_file: %s/.env\n' "${P}" > "${T}/c/compose.yml"
# `compose config` reescapa `$` como `$$` al imprimir: se pregunta al contenedor.
leido="$(docker compose -f "${T}/c/compose.yml" -p zz-envset run --rm --no-deps -T x printenv RESEND_API_KEY 2>/dev/null)"
[ "${leido}" = 'abc$HOME #no-comentario y espacio' ] && ok "el contenedor recibe el valor literal (sin interpolar \$ ni cortar en #)" || ko "el contenedor recibió '${leido}'"

# --name: comilla simple rechazada sin tocar el archivo
antes="$(sha256sum "${P}/.env")"
printf "%s\n" "con'comilla" | run --name OTRA > /dev/null 2>&1; rc=$?
[ $rc -eq 2 ] && [ "$(sha256sum "${P}/.env")" = "${antes}" ] && ok "comilla simple: rechaza (2) y no toca el .env" || ko "comilla simple rc=$rc"

# --integraciones: solo las vacías del bloque (RESEND ya tiene, ANTHROPIC ya tenía)
printf '%s\n' 'tg-123' | run --integraciones > "${T}/i.log" 2>&1; rc=$?
[ $rc -eq 0 ] && [ "$(val TELEGRAM_BOT_TOKEN)" = "'tg-123'" ] && [ "$(val ANTHROPIC_API_KEY)" = "ya-tenia" ] && [ "$(val OTRA)" = "1" ] \
  && grep -q '1 de 3 variables' "${T}/i.log" && ok "--integraciones pide solo las vacías del bloque y guarda" || { ko "--integraciones rc=$rc"; cat "${T}/i.log"; }

# --integraciones --todas: pide las tres, Enter conserva (TELEGRAM y ANTHROPIC) y una se cambia
printf '%s\n\n\n' 're-nueva' | run --integraciones --todas > "${T}/t.log" 2>&1; rc=$?
[ $rc -eq 0 ] && [ "$(val RESEND_API_KEY)" = "'re-nueva'" ] && [ "$(val TELEGRAM_BOT_TOKEN)" = "'tg-123'" ] && [ "$(val ANTHROPIC_API_KEY)" = "ya-tenia" ] \
  && grep -q 'Las 3 variables' "${T}/t.log" && grep -c 'conserva el valor actual' "${T}/t.log" | grep -q 2 && ok "--integraciones --todas: pide todas, Enter conserva, y reemplaza la que se pega" || { ko "--todas rc=$rc"; cat "${T}/t.log"; }

# --claves-supabase: claves firmadas con un secreto inventado
read -r SEC ANON SRK OTRO_ANON < <(python3 - <<'PY'
import base64, hashlib, hmac, json, secrets
def b(x): return base64.urlsafe_b64encode(x).rstrip(b"=").decode()
def jwt(secret, role):
    h = b(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); p = b(json.dumps({"iss": "supabase", "ref": "zzprueba", "role": role}).encode())
    return f"{h}.{p}.{b(hmac.new(secret.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest())}"
s = secrets.token_hex(32); o = secrets.token_hex(32)
print(s, jwt(s, "anon"), jwt(s, "service_role"), jwt(o, "anon"))
PY
)
antes="$(sha256sum "${P}/.env")"
printf '%s\n%s\n%s\n' "${SEC}" "${OTRO_ANON}" "${SRK}" | run --claves-supabase > "${T}/s1.log" 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'firma NO coincide' "${T}/s1.log" && [ "$(sha256sum "${P}/.env")" = "${antes}" ] && ok "anon firmada con otro secreto: rechaza y no guarda nada" || { ko "claves incoherentes rc=$rc"; tail -3 "${T}/s1.log"; }
printf '%s\n%s\n%s\n' "${SEC}" "${SRK}" "${ANON}" | run --claves-supabase > "${T}/s2.log" 2>&1; rc=$?
[ $rc -eq 2 ] && grep -q 'role service_role (se esperaba anon)' "${T}/s2.log" && ok "keys cruzadas (anon ↔ service_role): rechaza" || ko "keys cruzadas rc=$rc"
printf '%s\n%s\n%s\n' "${SEC}" "${ANON}" "${SRK}" | run --claves-supabase > "${T}/s3.log" 2>&1; rc=$?
[ $rc -eq 0 ] && [ "$(val JWT_SECRET)" = "'${SEC}'" ] && [ "$(val ANON_KEY)" = "'${ANON}'" ] && [ "$(val NEXT_PUBLIC_SUPABASE_ANON_KEY)" = "'${ANON}'" ] \
  && [ "$(val SERVICE_ROLE_KEY)" = "'${SRK}'" ] && [ "$(val SUPABASE_SERVICE_ROLE_KEY)" = "'${SRK}'" ] && ok "claves coherentes: guarda las cinco variables" || { ko "claves coherentes rc=$rc"; tail -3 "${T}/s3.log"; }
grep -qE "${SEC}|${ANON}|${SRK}" "${T}/s1.log" "${T}/s2.log" "${T}/s3.log" && ko "alguna clave apareció en la salida" || ok "ninguna clave aparece en la salida"
[ "$(grep -c '^JWT_SECRET=' "${P}/.env")" = 1 ] && ok "sin líneas duplicadas" || ko "JWT_SECRET duplicado"
ls "${P}"/.env.* >/dev/null 2>&1 && ko "quedó un temporal .env.*" || ok "no quedaron temporales"

# Reintentos y evidencia: un secreto mal pegado (los puntos del panel) y después el bueno.
mkdir -p "${T}/evid"
antes="$(sha256sum "${P}/.env")"
printf '%s\n%s\n%s\n%s\n%s\n%s\n' "••••••••••••" "${ANON}" "${SRK}" "${SEC}" "${ANON}" "${SRK}" | ENV_SET_EVIDENCE_DIR="${T}/evid" run --claves-supabase > "${T}/s4.log" 2>&1; rc=$?
[ $rc -eq 0 ] && grep -q 'intento 1' "${T}/s4.log" && grep -q 'se copiaron los puntos' "${T}/s4.log" && grep -q 'guardadas' "${T}/s4.log" \
  && ok "secreto mal pegado y después el bueno: explica, reintenta y guarda" || { ko "reintento rc=$rc"; tail -4 "${T}/s4.log"; }
printf '%s\n%s\n%s\n' "otro" "${ANON}" "${SRK}" "otro" "${ANON}" "${SRK}" "otro" "${ANON}" "${SRK}" | ENV_SET_EVIDENCE_DIR="${T}/evid" run --claves-supabase > "${T}/s5.log" 2>&1; rc=$?
despues="$(sha256sum "${P}/.env")"
[ $rc -eq 2 ] && grep -q '3 intentos' "${T}/s5.log" && [ "$(val JWT_SECRET)" = "'${SEC}'" ] && ok "tres veces mal: corta (2) y conserva lo que ya estaba guardado" || { ko "tres intentos rc=$rc"; tail -3 "${T}/s5.log"; }
ev="$(ls "${T}"/evid/env-set-zz-envset-supabase-*.txt 2>/dev/null | tail -1)"
[ -n "${ev}" ] && grep -q 'firma NO coincide' "${ev}" && grep -q '✗' "${ev}" && [ "$(stat -c %a "${ev}")" = 600 ] \
  && ok "la evidencia registra los fallos y el corte (600)" || ko "evidencia: ${ev:-ninguna}"
grep -qE "${SEC}|${ANON}|${SRK}" "${T}"/evid/*.txt && ko "la evidencia tiene una clave" || ok "la evidencia no tiene ninguna clave"
echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
