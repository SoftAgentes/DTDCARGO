#!/usr/bin/env bash
# infra/chatwoot/restaurar.sh — restauración CONJUNTA de un respaldo de Chatwoot (SDD-0583 · paso 1.5).
#
# Restaura las tres piezas de respaldo.sh en un proyecto de Compose VACÍO:
#   1. comprueba los sha256 contra el manifiesto;
#   2. descifra el .env (claves) en la carpeta destino, 0600, y aplica --sobrescribir;
#   3. levanta solo postgres y redis;
#   4. descifra el dump DIRECTO a pg_restore (sin copia en claro en disco);
#   5. descifra los adjuntos DIRECTO a tar dentro del volumen de rails;
#   6. levanta todo (prepare migra si hiciera falta) y espera a que rails esté sano;
#   7. compara conteos de la base y número de adjuntos con el manifiesto;
#   8. comprueba que las claves abren las columnas cifradas (Chatwoot no avisa si no).
# Imprime los segundos de cada fase: es la parte medible del RTO.
#
# Nunca restaura encima de algo: si el destino ya tiene contenedores o un .env, se
# niega (salvo --forzar, que solo permite reutilizar un .env preexistente).
#
# La clave PRIVADA age entra por --identidad y debe vivir en /dev/shm mientras dura
# la restauración (runbook §3); este script no la copia a ningún lado.
#
# Uso:
#   restaurar.sh --desde <carpeta chatwoot-SELLO> --identidad /dev/shm/clave.txt \
#       --dir <carpeta del compose destino> [--project <nombre>] \
#       [--sobrescribir VAR=valor]... [--usar-env-destino] [--forzar]
#
#   --sobrescribir  cambia una variable del .env restaurado. Para un ENSAYO en el
#                   mismo host son obligatorias CHATWOOT_HOST, CHATWOOT_FRONTEND_URL y
#                   CHATWOOT_DATA_DIR distintas: con el mismo Host, Traefik repartiría
#                   el tráfico real entre producción y el ensayo.
#   --usar-env-destino  no descifra env.age: usa el .env que ya está en el destino
#                   (solo para el control negativo del ensayo: claves equivocadas).
set -euo pipefail
umask 077

DESDE=""
IDENTIDAD=""
DIR=""
PROJECT=""
FORZAR=0
USAR_ENV_DESTINO=0
SOBRESCRIBIR=()
AGE_BIN="${AGE_BIN:-age}"

usage() { sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "restaurar: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --desde) DESDE="$2"; shift 2 ;;
    --identidad) IDENTIDAD="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --sobrescribir) SOBRESCRIBIR+=("$2"); shift 2 ;;
    --usar-env-destino) USAR_ENV_DESTINO=1; shift ;;
    --forzar) FORZAR=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "opción desconocida: $1 (ver --help)" ;;
  esac
done

[ -d "$DESDE" ] || die "falta --desde (carpeta chatwoot-SELLO)"
[ -f "$IDENTIDAD" ] || die "falta --identidad (clave privada age, en /dev/shm)"
[ -f "$DIR/compose.yml" ] || die "no hay compose.yml en --dir $DIR"
for f in db.dump.age storage.tar.age env.age manifiesto.txt; do
  [ -f "$DESDE/$f" ] || die "falta $DESDE/$f: el respaldo está incompleto"
done

# Desde la carpeta del compose: Compose toma su compose.yml, su .env y, si existe,
# compose.override.yml (solo la prueba local lo trae; el servidor no).
compose() { (cd "$DIR" && docker compose ${PROJECT:+-p "$PROJECT"} "$@"); }
descifrar() { "$AGE_BIN" -d -i "$IDENTIDAD" <"$1"; }
manifiesto() { sed -n "s/^$1=//p" "$DESDE/manifiesto.txt" | head -n 1; }
ahora() { date +%s; }

T0="$(ahora)"

# 1. Integridad.
(cd "$DESDE" && grep -E ' [ *](db\.dump|storage\.tar|env)\.age$' manifiesto.txt | sha256sum -c --quiet -) \
  || die "los sha256 no coinciden con el manifiesto"
echo "restaurar: integridad OK ($(manifiesto sello), versión $(manifiesto version))"

# 2. Destino vacío y claves.
[ -z "$(compose ps -a -q 2>/dev/null)" ] || die "el proyecto destino ya tiene contenedores; elige otro --project o bájalo antes"
if [ "$USAR_ENV_DESTINO" = 1 ]; then
  [ -f "$DIR/.env" ] || die "--usar-env-destino sin .env en $DIR"
else
  [ ! -f "$DIR/.env" ] || [ "$FORZAR" = 1 ] || die "$DIR/.env ya existe; no lo piso sin --forzar"
  descifrar "$DESDE/env.age" >"$DIR/.env.restaurando"
  for par in "${SOBRESCRIBIR[@]}"; do
    var="${par%%=*}"; valor="${par#*=}"
    grep -q "^$var=" "$DIR/.env.restaurando" || die "--sobrescribir $var: la variable no está en el .env restaurado"
    # Reemplazo literal (sin sed: el valor puede traer / & o |).
    awk -v v="$var" -v val="$valor" 'index($0, v "=") == 1 { print v "=" val; next } { print }' \
      "$DIR/.env.restaurando" >"$DIR/.env.tmp" && mv "$DIR/.env.tmp" "$DIR/.env.restaurando"
  done
  chmod 600 "$DIR/.env.restaurando"
  mv "$DIR/.env.restaurando" "$DIR/.env"
fi
T1="$(ahora)"

# 3. Base y Redis vacíos.
compose up -d --wait postgres redis
FILAS="$(compose exec -T postgres psql -U chatwoot -d chatwoot_production -At -c \
  "select count(*) from information_schema.tables where table_schema = 'public'")"
[ "$FILAS" = 0 ] || die "la base destino ya tiene $FILAS tablas; no restauro encima"

# 4. Dump → pg_restore, sin pasar por disco.
descifrar "$DESDE/db.dump.age" \
  | compose exec -T postgres pg_restore -U chatwoot -d chatwoot_production --no-owner --exit-on-error
T2="$(ahora)"

# 5. Adjuntos → volumen de rails, sin pasar por disco.
descifrar "$DESDE/storage.tar.age" \
  | compose run --rm --no-deps -T --entrypoint tar rails -C /app/storage -xf -
T3="$(ahora)"

# 6. Todo arriba.
compose up -d --wait
T4="$(ahora)"

# 7. Comparación con el manifiesto.
FALLAS=0
CONTEOS="$(compose exec -T postgres psql -U chatwoot -d chatwoot_production -At -F= -c \
  "select 'cuentas', count(*) from accounts union all select 'usuarios', count(*) from users
   union all select 'contactos', count(*) from contacts union all select 'conversaciones', count(*) from conversations
   union all select 'mensajes', count(*) from messages union all select 'adjuntos', count(*) from active_storage_blobs")"
while IFS='=' read -r nombre valor; do
  esperado="$(manifiesto "$nombre")"
  if [ "$valor" = "$esperado" ]; then echo "  $nombre: $valor OK"; else echo "  $nombre: $valor (manifiesto: $esperado) DISTINTO"; FALLAS=1; fi
done <<<"$CONTEOS"
ARCHIVOS="$(compose exec -T rails sh -c 'find /app/storage -type f | wc -l' | tr -d '[:space:]')"
if [ "$ARCHIVOS" = "$(manifiesto storage_archivos)" ]; then echo "  archivos en storage: $ARCHIVOS OK"
else echo "  archivos en storage: $ARCHIVOS (manifiesto: $(manifiesto storage_archivos)) DISTINTO"; FALLAS=1; fi

# 8. Las claves abren las columnas cifradas. Chatwoot 4.19.1 tiene
#    `support_unencrypted_data = true` (config/application.rb:80): con claves que no
#    coinciden NO lanza error, devuelve el sobre cifrado (`{"p":…`) como si fuera el
#    token. Los canales fallarían sin aviso; por eso se cuenta aquí.
CLAVES="$(compose exec -T rails bundle exec rails runner '
  pares = { "Webhook" => %i[secret], "Channel::Email" => %i[imap_password smtp_password],
            "Channel::FacebookPage" => %i[page_access_token user_access_token],
            "Integrations::Hook" => %i[access_token], "Channel::Whatsapp" => %i[business_management_token] }
  total = 0; sobres = 0
  pares.each do |modelo, columnas|
    clase = modelo.safe_constantize or next
    clase.find_each do |fila|
      columnas.each do |col|
        valor = (fila.public_send(col) rescue nil).to_s
        next if valor.empty?
        total += 1; sobres += 1 if valor.start_with?(%({"p":))
      end
    end
  end
  print "CLAVES total=#{total} sobres=#{sobres}"' 2>/dev/null | grep -o 'CLAVES total=[0-9]* sobres=[0-9]*')"
echo "  columnas cifradas: ${CLAVES:-sin lectura}"
case "$CLAVES" in
  "CLAVES total="*" sobres=0") ;;
  *) echo "  las claves del .env NO abren las columnas cifradas (o no se pudo leer)"; FALLAS=1 ;;
esac
T5="$(ahora)"

echo "restaurar: tiempos (s) claves=$((T1 - T0)) base=$((T2 - T1)) adjuntos=$((T3 - T2)) arranque=$((T4 - T3)) verificación=$((T5 - T4)) total=$((T5 - T0))"
[ "$FALLAS" = 0 ] || die "la restauración no coincide con el manifiesto"
echo "restaurar: OK"
