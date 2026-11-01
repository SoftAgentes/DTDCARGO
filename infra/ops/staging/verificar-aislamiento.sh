#!/usr/bin/env bash
# infra/ops/staging/verificar-aislamiento.sh — prueba no comparte nada con producción (SDD-0540, Fase 1).
#
# Corre antes de cada despliegue a prueba y al crearla. Compara el .env de prueba
# con el de producción SIN IMPRIMIR NINGÚN VALOR: solo nombres de variables,
# cantidades y huellas internas que nunca salen del script.
#
# Comprobaciones (cada una da PASÓ, FALLÓ o AVISO):
#   1. Ningún valor del .env de prueba es igual, por sha256, a un secreto de
#      producción (cualquier variable cuyo nombre lleve KEY, SECRET, TOKEN,
#      PASS, JWKS o USERNAME, o de la lista explícita). Atrapa también una clave
#      de producción copiada con otro nombre.
#   2. Hosts, URLs, cookie de sesión y carpeta de datos distintos de producción;
#      ningún valor apunta al host de producción ni a la ref de Supabase Cloud.
#   3. APP_ENV=staging, DISABLE_SIGNUP=true y sin usuarios anónimos.
#   4. Las claves de integración (bloque «Integraciones de la app» del
#      .env.example más las de la lista de abajo) no existen o están vacías,
#      salvo las que se permitan con --permitir.
#   5. El .env no tiene líneas `X=` vacías ni marcas `<...>`: con "" el `??` de
#      la app no cae al respaldo (runbook servidor-contabo §3.6, 2026-10-15).
#   6. La puerta del web (PRUEBA_WEB_USUARIOS) tiene usuarios con bcrypt.
#   7. La imagen es `ghcr.io/softagentes/dtdcargo:prueba-sha-<40 hex>`.
#   8. Vault de prueba sin kommo_cron_key, kommo_token_dtd_v1 ni
#      functions_base_url, y sin filas en kommo_connections (salvo --sin-base).
#   9. El bundle de la imagen nombra el host de prueba y no el de producción ni
#      la ref de Cloud, y lleva la anon de este .env (salvo --sin-bundle): una
#      imagen construida con otra anon da 401 en el navegador. Google Analytics y
#      Ads: decide /app/.next/static, que es lo único que llega al navegador. Si
#      están ahí, sale AVISO, o FALLÓ con --exigir-sin-ga (imagen de la Fase 2,
#      SDD-0544). Si solo los nombra el código del servidor, sale PASÓ con un
#      aviso, y se confirma en el HTML con smoke-web.sh --sin-ga.
#
# Uso (en el VPS):
#   verificar-aislamiento.sh --env /srv/dtd-cargo-staging/.env --prod-env /srv/dtd-cargo/.env \
#       [--project dtd-cargo-staging] [--example /srv/dtd-cargo-staging/.env.example] \
#       [--image ghcr.io/softagentes/dtdcargo:prueba-sha-<sha>] \
#       [--permitir CLAVE]… [--sin-base] [--sin-bundle] [--exigir-sin-ga] [--evidence <archivo>]
#
# Códigos: 0 todo PASÓ (puede haber AVISO) · 1 algo FALLÓ · 2 uso inválido.
set -uo pipefail
umask 077

ENV_FILE=""
PROD_ENV=""
PROJECT="dtd-cargo-staging"
EXAMPLE=""
IMAGE=""
PERMITIDAS=()
SIN_BASE=0
SIN_BUNDLE=0
EXIGIR_SIN_GA=0
EVIDENCE=""
PROD_PROJECT="${PROD_COMPOSE_PROJECT:-dtd-cargo}"
IMAGE_REPO="ghcr.io/softagentes/dtdcargo"
CLOUD_REF="xpfuzqombmjmxvprjgmi"

usage() { sed -n '2,36p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "verificar-aislamiento: $*" >&2; exit 2; }
setopt() { local n="$1" v="${2-}"; [[ -z "${v}" ]] || printf -v "${n}" '%s' "${v}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) setopt ENV_FILE "${2-}"; shift 2 ;;
    --prod-env) setopt PROD_ENV "${2-}"; shift 2 ;;
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --example) setopt EXAMPLE "${2-}"; shift 2 ;;
    --image) setopt IMAGE "${2-}"; shift 2 ;;
    --permitir) [[ "${2-}" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die "--permitir espera un nombre de variable: '${2-}'"; PERMITIDAS+=("$2"); shift 2 ;;
    --sin-base) SIN_BASE=1; shift ;;
    --sin-bundle) SIN_BUNDLE=1; shift ;;
    --exigir-sin-ga) EXIGIR_SIN_GA=1; shift ;;
    --evidence) setopt EVIDENCE "${2-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ -n "${ENV_FILE}" && -f "${ENV_FILE}" ]] || die "--env no existe: '${ENV_FILE}'"
[[ -n "${PROD_ENV}" && -f "${PROD_ENV}" ]] || die "--prod-env no existe: '${PROD_ENV}'"
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ "${PROJECT}" != "${PROD_PROJECT}" && "${PROJECT}" == *-staging ]] || die "--project tiene que ser un proyecto *-staging, no '${PROJECT}'"
EXAMPLE="${EXAMPLE:-$(dirname "${ENV_FILE}")/.env.example}"

pass=0; fail=0; aviso=0
out() { printf '%s\n' "$*"; [[ -z "${EVIDENCE}" ]] || printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" >> "${EVIDENCE}"; }
ok() { out "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { out "FALLÓ · $*"; fail=$((fail + 1)); }
av() { out "AVISO · $*"; aviso=$((aviso + 1)); }

if [[ -n "${EVIDENCE}" ]]; then : > "${EVIDENCE}" && chmod 600 "${EVIDENCE}" || die "no puedo escribir la evidencia ${EVIDENCE}"; fi
out "verificar-aislamiento · proyecto ${PROJECT} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# El mismo archivo en los dos lados haría pasar todo por la razón equivocada.
real_env="$(readlink -f -- "${ENV_FILE}")"; real_prod="$(readlink -f -- "${PROD_ENV}")"
[[ "${real_env}" != "${real_prod}" ]] || die "--env y --prod-env son el mismo archivo"

# Lee un .env sin `source`: CLAVE=valor, sin las comillas de afuera, la última gana.
declare -A PV=() PRV=()
cargar() { # $1 archivo, $2 nombre del array asociativo
  local -n dst="$2"
  local line k v
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
    k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"
    if [[ "${v}" == \'*\' && ${#v} -ge 2 ]]; then v="${v:1:${#v}-2}"
    elif [[ "${v}" == \"*\" && ${#v} -ge 2 ]]; then v="${v:1:${#v}-2}"; fi
    dst["${k}"]="${v}"
  done < "$1"
}
cargar "${ENV_FILE}" PV
cargar "${PROD_ENV}" PRV

# ── 1. Secretos de producción, por huella ──────────────────────────────────────
# Cada valor va a un archivo propio en una carpeta 700 (en memoria si hay
# /dev/shm) y un solo sha256sum los recorre: una llamada por valor costaba
# minutos. La carpeta se borra al salir; nada se imprime.
SECRETOS_EXPLICITOS=" DASHBOARD_USERNAME CRON_SECRET JWT_KEYS JWT_JWKS SECRET_KEY_BASE REALTIME_DB_ENC_KEY VAULT_ENC_KEY PG_META_CRYPTO_KEY S3_PROTOCOL_ACCESS_KEY_ID MAINTENANCE_BYPASS_SECRET DEBUG_HEALTH_SECRET "
es_secreto() { [[ "$1" =~ (KEY|SECRET|TOKEN|PASS|JWKS|USERNAME) || "${SECRETOS_EXPLICITOS}" == *" $1 "* ]]; }
hdir="$(mktemp -d /dev/shm/verificar.XXXXXX 2>/dev/null || mktemp -d)" || die "no puedo crear una carpeta temporal"
trap 'rm -rf -- "${hdir}"' EXIT
declare -A NOMBRE_DE=() HPROD=()
n_prod=0; n_prueba=0
for k in "${!PRV[@]}"; do
  v="${PRV[${k}]}"
  # Por debajo de 8 caracteres no es un secreto sino un valor de configuración.
  if es_secreto "${k}" && (( ${#v} >= 8 )); then
    printf '%s' "${v}" > "${hdir}/p${n_prod}"; NOMBRE_DE["p${n_prod}"]="${k}"; n_prod=$((n_prod + 1))
  fi
done
for k in "${!PV[@]}"; do
  v="${PV[${k}]}"
  (( ${#v} >= 8 )) || continue
  printf '%s' "${v}" > "${hdir}/q${n_prueba}"; NOMBRE_DE["q${n_prueba}"]="${k}"; n_prueba=$((n_prueba + 1))
done
declare -A HPRUEBA=()
if (( n_prod + n_prueba > 0 )); then
  while read -r h f; do
    # `hash  archivo`, o `hash *archivo` en modo binario (Git Bash).
    f="${f#\*}"; f="${f##*/}"
    if [[ "${f}" == p* ]]; then HPROD["${h}"]=1; else HPRUEBA["${f}"]="${h}"; fi
  done < <(cd "${hdir}" && sha256sum -- *)
fi
iguales=()
for f in "${!HPRUEBA[@]}"; do
  [[ -n "${HPROD[${HPRUEBA[${f}]}]+x}" ]] && iguales+=("${NOMBRE_DE[${f}]}")
done
rm -rf -- "${hdir}"
if (( ${#iguales[@]} )); then
  ko "valores iguales a un secreto de producción (por sha256): $(printf '%s\n' "${iguales[@]}" | sort | tr '\n' ' ')"
else
  ok "ningún valor de prueba coincide con los ${#HPROD[@]} secretos de producción (comparado por sha256)"
fi

# ── 2. Hosts, URLs, cookie y datos distintos de producción ────────────────────
DEBEN_DIFERIR=(DTD_WEB_HOST SUPABASE_PUBLIC_HOST APP_URL NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_PUBLIC_URL API_EXTERNAL_URL SITE_URL NEXT_PUBLIC_SUPABASE_AUTH_COOKIE DTD_DATA_DIR)
for k in "${DEBEN_DIFERIR[@]}"; do
  if [[ -z "${PV[${k}]-}" ]]; then ko "${k} falta en el .env de prueba"
  elif [[ "${PV[${k}]}" == "${PRV[${k}]-}" ]]; then ko "${k} es igual al de producción"
  else ok "${k} propio de prueba"; fi
done
# Hosts de producción: los del .env de producción, con y sin `www.`.
declare -A HOSTS_PROD=()
for k in DTD_WEB_HOST SUPABASE_PUBLIC_HOST; do
  h="${PRV[${k}]-}"; [[ -n "${h}" ]] || continue
  HOSTS_PROD["${h}"]=1; HOSTS_PROD["www.${h}"]=1
done
apuntan=()
for k in "${!PV[@]}"; do
  v="${PV[${k}]}"
  [[ "${v}" == *"${CLOUD_REF}"* ]] && { apuntan+=("${k}(ref de Cloud)"); continue; }
  for h in "${!HOSTS_PROD[@]}"; do
    # Host exacto: «prueba.dtdcargo.com» no es «dtdcargo.com».
    re_host="://${h//./\\.}([/:?#]|\$)"
    if [[ "${v}" == "${h}" || "${v}" =~ ${re_host} ]]; then apuntan+=("${k}"); break; fi
  done
done
if (( ${#apuntan[@]} )); then ko "valores que apuntan a producción: $(printf '%s\n' "${apuntan[@]}" | sort | tr '\n' ' ')"
else ok "ningún valor apunta a los hosts de producción ni a la ref de Supabase Cloud"; fi

# ── 3. Entorno y registro ─────────────────────────────────────────────────────
[[ "${PV[APP_ENV]-}" == "staging" ]] && ok "APP_ENV=staging" || ko "APP_ENV no es staging"
[[ "${PV[DISABLE_SIGNUP]-}" == "true" ]] && ok "DISABLE_SIGNUP=true (sin registro público en GoTrue)" || ko "DISABLE_SIGNUP no es true"
[[ "${PV[ENABLE_ANONYMOUS_USERS]-false}" == "false" ]] && ok "sin usuarios anónimos" || ko "ENABLE_ANONYMOUS_USERS no es false"

# ── 4. Claves de integración vacías o ausentes ────────────────────────────────
INTEGRACIONES_EXTRA=(SMTP_HOST SMTP_USER SMTP_PASS KOMMO_WEBHOOK_SECRET KOMMO_PUSH_DRY_RUN OPENAI_API_KEY
  NEXT_PUBLIC_VAPID_PUBLIC_KEY NEXT_PUBLIC_TELEGRAM_BOT_USERNAME NEXT_PUBLIC_GA_ID NEXT_PUBLIC_HAILUWAY_API
  STORAGE_S3_BUCKET STORAGE_S3_ENDPOINT STORAGE_S3_REGION STORAGE_S3_ACCESS_KEY_ID STORAGE_S3_SECRET_ACCESS_KEY
  BACKUP_HEARTBEAT_URL JWT_KEYS JWT_JWKS ANON_KEY_ASYMMETRIC SERVICE_ROLE_KEY_ASYMMETRIC SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY)
if [[ ! -f "${EXAMPLE}" ]]; then
  ko "no encuentro ${EXAMPLE}: sin el bloque de integraciones no se puede comprobar"
else
  mapfile -t bloque < <(awk '
    /^# ── Integraciones de la app/ { on = 1; next }
    on && /^#{4,}/ { on = 0 }
    on && /^[A-Z_][A-Z0-9_]*=/ { split($0, a, "="); print a[1] }
  ' "${EXAMPLE}")
  if (( ${#bloque[@]} == 0 )); then
    ko "no encontré el bloque «# ── Integraciones de la app» en ${EXAMPLE}"
  else
    encendidas=()
    for k in "${bloque[@]}" "${INTEGRACIONES_EXTRA[@]}"; do
      [[ -n "${PV[${k}]-}" ]] || continue
      permitida=0
      for p in ${PERMITIDAS[@]+"${PERMITIDAS[@]}"}; do [[ "${p}" == "${k}" ]] && permitida=1; done
      (( permitida )) && av "${k} tiene valor y está permitida con --permitir" || encendidas+=("${k}")
    done
    if (( ${#encendidas[@]} )); then ko "integraciones con valor en prueba: $(printf '%s\n' "${encendidas[@]}" | sort | tr '\n' ' ')"
    else ok "las $(( ${#bloque[@]} + ${#INTEGRACIONES_EXTRA[@]} )) claves de integración están vacías o ausentes"; fi
  fi
fi

# ── 5. Ni vacías ni marcas ────────────────────────────────────────────────────
vacias="$(grep -cE "^[A-Z_][A-Z0-9_]*=(''|\"\")?[[:space:]]*$" "${ENV_FILE}" || true)"
marcas="$(grep -cE '^[A-Z_][A-Z0-9_]*=.*<[^>]+>' "${ENV_FILE}" || true)"
[[ "${vacias}" == 0 ]] && ok "sin líneas X= vacías" || ko "${vacias} líneas X= vacías en el .env (bórralas: con \"\" la app no cae al respaldo)"
[[ "${marcas}" == 0 ]] && ok "sin marcas <...> sin resolver" || ko "${marcas} líneas con marcas <...> en el .env"

# ── 6. Puerta del web ─────────────────────────────────────────────────────────
usuarios="${PV[PRUEBA_WEB_USUARIOS]-}"
if [[ -z "${usuarios}" ]]; then
  ko "PRUEBA_WEB_USUARIOS falta: el web quedaría sin clave (el compose no arranca)"
elif [[ "${usuarios}" == "pendiente:sin-clave" ]]; then
  # El marcador de env-prueba.sh: Traefik rechaza toda clave. Vale solo mientras
  # la base no existe; clave-web-prueba.sh lo cambia apenas la base arranca.
  if (( SIN_BASE )); then av "puerta del web cerrada con el marcador inicial (falta clave-web-prueba.sh)"
  else ko "PRUEBA_WEB_USUARIOS sigue con el marcador inicial: nadie puede entrar (corre clave-web-prueba.sh)"; fi
else
  malos=0; n=0
  re_bcrypt='^[a-z0-9._-]+:\$2[aby]\$[0-9]{2}\$.{53}$'
  IFS=',' read -r -a lista <<< "${usuarios}"
  for u in "${lista[@]}"; do
    n=$((n + 1))
    [[ "${u}" =~ ${re_bcrypt} ]] || malos=$((malos + 1))
  done
  (( malos == 0 )) && ok "puerta del web con ${n} usuario(s) bcrypt" || ko "PRUEBA_WEB_USUARIOS: ${malos} de ${n} entradas sin bcrypt (corre clave-web-prueba.sh)"
fi

# ── 7. Imagen ─────────────────────────────────────────────────────────────────
img="${IMAGE:-${PV[DTD_WEB_IMAGE]-}}"
re_img="^${IMAGE_REPO//./\\.}:prueba-sha-[0-9a-f]{40}\$"
if [[ "${img}" =~ ${re_img} ]]; then ok "imagen ${img##*:}"
else ko "la imagen no es ${IMAGE_REPO}:prueba-sha-<40 hex>: '${img:-ninguna}'"; fi

# ── 8. Vault y Kommo en la base de prueba ─────────────────────────────────────
if (( SIN_BASE )); then
  av "Vault y kommo_connections NO VERIFICADOS (--sin-base: la base todavía no existe)"
else
  db="${PROJECT}-db-1"
  if [[ "$(docker inspect -f '{{.State.Running}}' "${db}" 2>/dev/null)" != "true" ]]; then
    ko "el contenedor ${db} no está corriendo: no puedo leer Vault (usa --sin-base solo al crear)"
  else
    n_vault="$(docker exec -i "${db}" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 \
      -c "select count(*) from vault.secrets where name in ('kommo_cron_key','kommo_token_dtd_v1','functions_base_url')" 2>/dev/null)"
    [[ "${n_vault}" == 0 ]] && ok "Vault de prueba sin claves de Kommo ni functions_base_url" || ko "Vault de prueba: ${n_vault:-error} claves de Kommo o functions_base_url"
    n_kc="$(docker exec -i "${db}" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 \
      -c "select case when to_regclass('public.kommo_connections') is null then 0 else (select count(*) from public.kommo_connections) end" 2>/dev/null)"
    [[ "${n_kc}" == 0 ]] && ok "sin filas en kommo_connections" || ko "kommo_connections: ${n_kc:-error} filas"
  fi
fi

# ── 9. Bundle de la imagen ────────────────────────────────────────────────────
if (( SIN_BUNDLE )); then
  av "bundle de la imagen NO VERIFICADO (--sin-bundle)"
elif [[ ! "${img}" =~ :prueba-sha-[0-9a-f]{40}$ ]]; then
  ko "bundle sin comprobar: no hay una imagen de prueba válida"
else
  host_prueba="${PV[SUPABASE_PUBLIC_HOST]-}"
  host_prod="${PRV[SUPABASE_PUBLIC_HOST]-supabase.dtdcargo.com}"
  # La anon de este .env tiene que estar en el bundle: si la imagen se construyó
  # con otra (PRUEBA_SUPABASE_ANON_KEY desfasada), el navegador recibe 401. La anon
  # es pública (viaja en el JavaScript); igual va por entorno y no por argumento.
  anon_prueba="${PV[NEXT_PUBLIC_SUPABASE_ANON_KEY]-sin-anon}"
  # Lo mismo con el nombre de la cookie de sesión: si el bundle trae otro, el
  # navegador y el servidor no se entienden y la sesión no se sostiene.
  cookie_prueba="${PV[NEXT_PUBLIC_SUPABASE_AUTH_COOKIE]-sin-cookie}"
  # Contenedor sin red: solo se leen archivos de la imagen. Los patrones viajan
  # por entorno y se buscan con -F (texto literal).
  cuenta="$(P_PRUEBA="${host_prueba}" P_PROD="${host_prod}" P_REF="${CLOUD_REF}" P_ANON="${anon_prueba}" P_COOKIE="${cookie_prueba}" \
    docker run --rm --network none --entrypoint /bin/sh -e P_PRUEBA -e P_PROD -e P_REF -e P_ANON -e P_COOKIE \
    "${img}" -c 'c() { grep -rlF -- "$1" /app/.next 2>/dev/null | wc -l; }; s() { grep -rlF -- "$1" /app/.next/static 2>/dev/null | wc -l; }; echo "$(c "$P_PRUEBA") $(c "$P_PROD") $(c "$P_REF") $(c G-25CD7BZH98) $(c AW-561290482) $(c "$P_ANON") $(c "$P_COOKIE") $(s G-25CD7BZH98) $(s AW-561290482)"' 2>/dev/null)"
  read -r c_prueba c_prod c_ref c_ga c_ads c_anon c_cookie s_ga s_ads <<< "${cuenta:-x x x x x x x x x}"
  if [[ ! "${c_prueba}" =~ ^[0-9]+$ ]]; then
    ko "no pude leer el bundle de ${img##*:}"
  else
    (( c_prueba >= 1 )) && ok "bundle: ${c_prueba} archivos con el host de prueba" || ko "bundle: 0 archivos con el host de prueba"
    (( c_prod == 0 && c_ref == 0 )) && ok "bundle: 0 archivos con el host de producción y 0 con la ref de Cloud" \
      || ko "bundle: ${c_prod} archivos con el host de producción y ${c_ref} con la ref de Cloud"
    [[ "${c_anon:-0}" =~ ^[0-9]+$ ]] && (( c_anon >= 1 )) && ok "bundle con la anon de este .env" \
      || ko "bundle sin la anon de este .env: la imagen se construyó con otra PRUEBA_SUPABASE_ANON_KEY (reconstrúyela)"
    [[ "${c_cookie:-0}" =~ ^[0-9]+$ ]] && (( c_cookie >= 1 )) && ok "bundle con la cookie de sesión de este .env" \
      || ko "bundle sin la cookie de este .env: PRUEBA_AUTH_COOKIE y NEXT_PUBLIC_SUPABASE_AUTH_COOKIE no coinciden"
    # Lo que decide es .next/static: es lo único que llega al navegador. El resto
    # de /app/.next (el servidor) puede conservar el ID como texto en código que no
    # corre con NEXT_PUBLIC_GA_ID=off; se informa, pero no falla.
    # Sin las dos cuentas de static (otra versión del contenedor), se decide con
    # todo /app/.next, como antes: más estricto, nunca más laxo.
    [[ "${s_ga-}" =~ ^[0-9]+$ && "${s_ads-}" =~ ^[0-9]+$ ]] || { s_ga="${c_ga}"; s_ads="${c_ads}"; }
    if (( s_ga + s_ads == 0 )); then
      ok "bundle del navegador (.next/static) sin Google Analytics ni Ads"
      (( c_ga + c_ads > 0 )) && av "el servidor (.next fuera de static) nombra GA (${c_ga}) o Ads (${c_ads}): no llega al navegador; confirmar en el HTML con smoke-web.sh --sin-ga"
    elif (( EXIGIR_SIN_GA )); then ko "bundle del navegador con Google Analytics (${s_ga}) o Ads (${s_ads})"
    else av "bundle del navegador con Google Analytics (${s_ga}) y Ads (${s_ads}): apagarlos es la Fase 2 de la SDD-0540"; fi
  fi
fi

out "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ · ${aviso} AVISO"
(( fail == 0 ))
