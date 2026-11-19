# Runbook · Subida de Chatwoot v4.19.1-ce → v4.20.0-ce en producción · SDD-0679

**SDD:** [0679](../specs/0679-chatwoot-4-20/spec.md). **Procedimiento general:** [versiones](chatwoot-versiones.md) (SDD-0588); este documento lo concreta para este salto y **reemplaza su paso 5** (`docker compose pull` + `up -d --wait`): en `/srv/chatwoot` **nunca** se corre un `docker compose up` general.
**Estado:** escrito el 2026-11-19. **No se ha corrido.** Lo ejecuta el DG o la sesión que designe, con el **OK nominal de Sam** para esta versión y la **hora acordada**. Sin la fase A del ensayo en verde no se pide ese OK.
**Se apoya en:** [servidor](chatwoot-servidor.md), [respaldo y restauración](chatwoot-respaldo-restauracion.md), [vigilancia](chatwoot-vigilancia.md), [Bandeja](chatwoot-bandeja.md).

| | |
|---|---|
| Imagen nueva | `chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be` |
| Imagen vieja (vuelta atrás) | `chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf` |
| Qué se recrea | `rails` y `sidekiq`. `prepare` corre **una vez**, como contenedor de una sola vez. `postgres`, `redis` y `acceso` **no se tocan** |
| Corte visible | **~5–10 min** (§7) |
| Ventana total | **~45 min** con el smoke; **+15 min** si hay vuelta atrás (b) |

## 0 · Antes del día

1. **PR aprobada** con la fase A del ensayo en verde (SDD-0679 §5) y, si se hizo, la fase B medida.
2. **OK nominal de Sam**, que nombra: la versión (`v4.20.0-ce` y su digest), la hora, el smoke (§5) y **las diferencias de `sidekiq`** del paso 3 de abajo. El pedido de «Actualizaciones» de Studio no es el OK.
3. **Fecha y hora.** Sam pidió el **viernes 20 o el sábado 21**. El runbook de versiones dice «lunes a jueves, 21:00–23:00 de Caracas, no el viernes»: si va el viernes o el sábado, el DG confirma con Sam que al día siguiente hay quien atienda. La hora real se mide con `date -u` (Caracas = UTC − 4).
4. **Sam disponible durante toda la ventana.** La vuelta atrás (b) necesita la clave privada `age` del respaldo, que solo pega Sam (§6).
5. **Medir las diferencias de `sidekiq` y `rails`** (en el VPS, solo lectura, la víspera o al empezar). El `compose.yml` del VPS **no es** el de `main`, y el `sidekiq` que corre **no es igual** a su compose. Cambiar la imagen obliga a recrearlos y, al recrearlos, entra todo lo que difiera. Se compara por **nombres** y por huella, sin imprimir valores:

   ```bash
   cd /srv/chatwoot
   # «NOMBRE huella8» por línea, sin valores. Lee líneas NOMBRE=valor de la entrada.
   huellas() { while IFS= read -r l; do printf '%s %s\n' "${l%%=*}" "$(printf %s "${l#*=}" | sha256sum | cut -c1-8)"; done | sort; }
   for s in rails sidekiq; do
     c="$(docker compose ps -q "$s")"
     # Las variables que pone la propia imagen (PATH, RUBY_*, NODE_VERSION…) no son del compose: se descartan.
     docker image inspect "$(docker inspect -f '{{.Image}}' "$c")" -f '{{range .Config.Env}}{{println .}}{{end}}' | sed 's/=.*//' | sed '/^$/d' >/dev/shm/env-imagen.txt
     echo "== $s · variables: < solo en el contenedor, > entran al recrear (nombre y huella)"
     diff <(docker inspect "$c" -f '{{range .Config.Env}}{{println .}}{{end}}' | sed '/^$/d' | grep -vf <(sed 's/^/^/; s/$/=/' /dev/shm/env-imagen.txt) | huellas) \
          <(docker compose config --format json \
              | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const e=JSON.parse(d).services[process.argv[1]].environment||{};for(const[k,v]of Object.entries(e))console.log(k+"="+(v??""))})' "$s" \
              | huellas) \
       | grep '^[<>]' | awk '{print $1, $2}'
     echo "== $s · montajes (destino)"
     diff <(docker inspect "$c" -f '{{range .Mounts}}{{println .Destination}}{{end}}' | sed '/^$/d' | sort) \
          <(docker compose config --format json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{for(const v of JSON.parse(d).services[process.argv[1]].volumes||[])console.log(v.target)})' "$s" | sort)
   done
   shred -u /dev/shm/env-imagen.txt
   ```

   - `<` = está en el contenedor y no en el compose; `>` = entra al recrear. Un nombre en las dos columnas con huella distinta = el valor cambia. Se anota **solo el nombre** de cada diferencia en el handoff, nunca la huella junto al nombre de un secreto en un canal público.
   - Si una variable del compose coincide en nombre con una de la imagen (`RAILS_ENV`, por ejemplo), sale como `>`: es la misma, se descarta a mano.
   - En `rails` se espera **ninguna** diferencia (se recreó el 2026-11-19 y se comparó). En `sidekiq`, al menos `DTD_CHATWOOT_SERVICIO_ID`, `SEARCH_TIME_RANGE_LIMIT_DAYS` y montajes de `rails/` y `correo/` (medido el 2026-11-19 por otra sesión).
   - **La lista va en el pedido de OK.** El día, si aparece una diferencia que no está en la lista aprobada, **no se sigue**.
   - Si `node` no está en el host, se hace con `docker compose config sidekiq` a mano y se comparan solo los nombres.

6. **Bajar la imagen antes de la ventana** (no corta nada; ~750 MB):

   ```bash
   docker pull chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be
   docker image inspect --format '{{json .RepoDigests}}' chatwoot/chatwoot:v4.20.0-ce   # incluye @sha256:03cc2004…
   df -h /                                                                               # espacio después del pull
   ```

## 1 · Avisos

| Cuándo | A quién | Qué |
|---|---|---|
| Al fijar la hora | sesión **«Cable Paso 3b»** | «Chatwoot se sube a la 4.20.0 el <día> a las <hora> UTC. Corte de ~10 min: la Bandeja, la Ficha DTD y los envíos por Chatwoot se detienen. No lancen envíos ni aprobaciones entre <hora> y <hora + 45 min>.» |
| Al empezar (antes del paso 2) | «Cable Paso 3b» y el equipo que atiende | «Empieza el corte de Chatwoot.» |
| Al cerrar (después del smoke) | ídem | «Chatwoot vuelve, en la 4.20.0» o «Chatwoot vuelve, en la 4.19.1 (vuelta atrás)». |

Durante el corte, los webhooks de Meta reciben error y Meta los reintenta por su cuenta (plazo NV). Los webhooks de Chatwoot a Studio que no salgan **no se reintentan**: al volver, la reconciliación corrige el contador al abrir la Bandeja.

## 2 · El día: estado y drenaje

En el VPS, `cd /srv/chatwoot`. Cada salida, con su hora, en el handoff. Las evidencias en `/srv/ops/evidencias/chatwoot-0679-<sello>/` (700).

```bash
date -u
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"; EV="/srv/ops/evidencias/chatwoot-0679-$SELLO"; install -d -m 700 "$EV"
sha256sum compose.yml rails/*.rb | tee "$EV/huellas-antes.txt"
docker compose images rails sidekiq | tee "$EV/imagenes-antes.txt"
cp -p compose.yml "$EV/compose.yml.antes"
# El log del contenedor se pierde al recrearlo; se guarda (ya va redactado) y se deja en el VPS.
for s in rails sidekiq; do docker compose logs --no-color "$s" >"$EV/log-$s-antes.txt" 2>&1; done; chmod 600 "$EV"/log-*

# Drenaje: Sidekiq deja de tomar trabajos nuevos y termina los que tiene.
docker compose kill -s TSTP sidekiq
docker compose exec -T rails bundle exec rails runner '
  require "sidekiq/api"
  20.times { busy = Sidekiq::Workers.new.size; break if busy.zero?; sleep 15 }
  print "ocupados=", Sidekiq::Workers.new.size,
        " encolados=", Sidekiq::Queue.all.sum(&:size),
        " reintentos=", Sidekiq::RetrySet.new.size,
        " programados=", Sidekiq::ScheduledSet.new.size,
        " muertos=", Sidekiq::DeadSet.new.size' | tee "$EV/sidekiq-antes.txt"
```

`ocupados=0` para seguir. Los encolados no se pierden (Redis `appendonly` + `noeviction`).

## 3 · Respaldo conjunto en el momento

```bash
systemctl start chatwoot-respaldo.service && tail -n 20 /var/log/chatwoot-respaldo.log
ls -1 /srv/backups/chatwoot | tail -1 | tee "$EV/respaldo.txt"     # sello del punto de vuelta
```

Sin `respaldo.sh` en 0 y con `rclone check` en verde **no se sigue**. Ese sello es el de la vuelta atrás (b).

## 4 · Cambio de imagen, migraciones y recreación

```bash
# 4.1 Solo la línea de la imagen. No se copia el compose de main (el del VPS es otro).
VIEJA='chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf'
NUEVA='chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be'
grep -c "$VIEJA" compose.yml                                # 1 (la del ancla x-imagen)
sed -i "s#$VIEJA#$NUEVA#" compose.yml
diff "$EV/compose.yml.antes" compose.yml                    # UNA línea cambiada y nada más
docker compose config -q && echo "compose válido"
sha256sum compose.yml | tee "$EV/huellas-despues.txt"

# 4.2 Corte: se paran los dos procesos de la versión vieja (Sidekiq espera hasta 25 s a sus trabajos).
date -u | tee "$EV/corte-inicio.txt"
docker compose stop -t 30 sidekiq rails

# 4.3 Migraciones, una sola vez, con la imagen nueva y sin tocar postgres ni redis (ya corren).
T0=$(date +%s)
docker compose run --rm --no-deps prepare 2>&1 | tee "$EV/prepare.txt"; echo "prepare=${PIPESTATUS[0]} $(( $(date +%s) - T0 )) s" | tee -a "$EV/prepare.txt"
```

- `prepare=0`: sigue en 4.4.
- `prepare` ≠ 0: se mira `"$EV/prepare.txt"`. Si **no** aplicó ninguna migración (§4.5 da la versión vieja), vuelta atrás (a). Si aplicó alguna, vuelta atrás (b). **No se reintenta en caliente.**

```bash
# 4.4 Recrear SOLO rails y sidekiq con la imagen nueva. --no-deps: no toca postgres, redis, acceso ni prepare.
docker compose up -d --no-deps --force-recreate rails
docker compose up -d --no-deps --force-recreate sidekiq
for i in $(seq 1 24); do s="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q rails)")"; echo "rails $s"; [ "$s" = healthy ] && break; sleep 10; done
date -u | tee "$EV/corte-fin.txt"

# 4.5 Última migración aplicada (debe ser la de la 4.20.0)
docker compose exec -T postgres psql -U chatwoot -d chatwoot_production -Atc \
  "select max(version) from schema_migrations" | tee "$EV/schema-version.txt"      # 20261116211055
```

`rails` tardó 41–70 s en quedar sano en las recreaciones anteriores; con Rails 8.0 puede variar (NV). Si a los 4 min no está `healthy`, vuelta atrás (b).

## 5 · Verificación

Primero **S1–S13 de [§6 del runbook de versiones](chatwoot-versiones.md#6--paso-a-producción-y-smoke)**, tal cual, con su resultado en el handoff. Un rojo en S1–S7 es vuelta atrás inmediata. Después, lo propio de esta versión:

| # | Comprobación | Exigencia |
|---|---|---|
| V1 | `curl -s https://chat.dtdcargo.com/api` | `"version":"4.20.0"`; `queue_services` y `data_services` en `ok` |
| V2 | `docker compose images rails sidekiq` | los dos con `v4.20.0-ce` y el digest nuevo |
| V3 | Inicializadores cargados **una vez por proceso**: `docker compose logs rails sidekiq \| grep -c '\[DTD\] redacción de logs activa'`, `… 'protección de /register activa: '`, `… 'revocación de sesiones activa'` | `2` cada uno (S2, S4, S6 los miden por separado); `0` en `revocar sesiones: faltan` y en `modo cerrado` |
| V4 | `sidekiq` ahora igual a su compose: repetir la comparación de §0 paso 5 | sin diferencias |
| V5 | WhatsApp sin app secret: `docker compose logs --since 15m rails \| grep -c WHATSAPP_APP_SECRET_PENDING` | Un número, sin abrir las líneas. **No es rojo**: dice qué bandejas esperan el secreto. Lo carga Sam cuando decida; nadie más |
| V6 | Sidekiq recupera: los cuatro números del paso 2 | encolados bajan a 0 en minutos; `muertos` no crece |
| V7 | Prueba en Studio (cuenta 2, **fase C** de la SDD), solo con el OK de Sam para reactivarla: SSO y Bandeja, Ficha DTD, `prueba-punta-a-punta.sh 2` (webhook firmado al ERP) y un mensaje del chat del portal de prueba | todos en verde; al terminar se **suspende** la cuenta 2 otra vez (no se borra) |
| V8 | La web de DTD: `infra/ops/web/smoke-web.sh` | igual que antes |

Uptime Kuma: el monitor «Chatwoot · versión» se cambia a `4.20.0` **después** de V1.

Aviso de cierre a «Cable Paso 3b» y al equipo (§1).

## 6 · Vuelta atrás

| Situación | Qué se hace | Tiempo |
|---|---|---|
| **a)** `prepare` falló **sin** migrar (§4.5 da la versión vieja) | volver la línea de la imagen y recrear `rails` y `sidekiq` | ~3–5 min |
| **b)** Rojo y `prepare` **sí** migró, o `rails` no queda sano | restaurar el respaldo del paso 3 con la imagen vieja | ~10–15 min (restauración de 200 s medida en P5, más preparar) |
| **c)** La 4.20.0 anda pero un inicializador no carga y no se arregla en la ventana | (a) o (b). **No** se deja corriendo sin el candado de `/register` ni sin la revocación | — |

**(a)**

```bash
cp -p "$EV/compose.yml.antes" compose.yml && sha256sum compose.yml        # igual a huellas-antes.txt
docker compose up -d --no-deps --force-recreate rails
docker compose up -d --no-deps --force-recreate sidekiq
curl -s https://chat.dtdcargo.com/api                                      # "version":"4.19.1"
```

Luego S1–S9. Ojo: `sidekiq` vuelve **con** las diferencias del §0 (ya quedaron en el compose del VPS); estaban en el OK.

**(b)** Una base migrada no se usa con la imagen vieja. `restaurar.sh` exige un destino vacío y levanta el proyecto entero con el compose de esa carpeta: es el único paso de este runbook que arranca todo, y es la recuperación del runbook de respaldo.

```bash
cp -p "$EV/compose.yml.antes" compose.yml
docker compose down                                    # SIN -v
mv data "data.fallida-$SELLO"                          # se conserva hasta que Sam decida; no sale del VPS
mv .env "$EV/env.fallida" && chmod 600 "$EV/env.fallida"   # restaurar.sh descifra el del respaldo
read -rs K && umask 077 && printf '%s\n' "$K" >/dev/shm/clave.txt && unset K   # Sam pega la clave age
R="/srv/backups/chatwoot/$(cat "$EV/respaldo.txt")"
/srv/chatwoot/restaurar.sh --desde "$R" --identidad /dev/shm/clave.txt --dir /srv/chatwoot
shred -u /dev/shm/clave.txt
curl -s https://chat.dtdcargo.com/api                  # "version":"4.19.1"
```

- Si `restaurar.sh` se niega por algo que queda en la carpeta, se lee su mensaje; `--forzar` **solo** permite reutilizar un `.env`, no pisa datos.
- Si el respaldo local no sirve, se baja de B2 como dice [§3 del respaldo](chatwoot-respaldo-restauracion.md#3--restauración).
- Luego S1–S9 y la comparación del §0 paso 5.
- Lo que entró a Chatwoot entre el respaldo y la vuelta atrás (mensajes de Meta del corte) se pierde de Chatwoot: Meta lo reintentó contra la 4.20.0. Con el drenaje y el corte, son minutos (I).

## 7 · Duración

| Tramo | Tiempo | Evidencia |
|---|---|---|
| §0 paso 6, `docker pull` | fuera de la ventana | — |
| §2 estado y drenaje | 1–5 min | drenaje de hasta 5 min del runbook de versiones |
| §3 respaldo conjunto | ~3–5 min (I) | `respaldo.sh` diario; medirlo en la fase B |
| **Corte visible** (§4.2 a §4.4) | **~5–10 min** | `prepare` (15 migraciones; NV hasta la fase B) + `rails` 41–70 s + `sidekiq` ~53 s medidos en recreaciones anteriores |
| §5 verificación | ~15 min | S1–S13 y V1–V8 |
| **Total** | **~45 min** | |
| Vuelta atrás (b) | +10–15 min | restauración de 200 s en P5 |

Si la fase B midió `prepare`, se reemplaza la línea del corte con ese número.

## 8 · Cierre

En el handoff de la subida: hora de inicio y fin del corte, diferencias aprobadas de `sidekiq`, `prepare.txt` (solo la cola y el código de salida), `schema-version.txt`, sello del respaldo, S1–S13 y V1–V8, y los números de Sidekiq antes y después. Después, en una PR aparte (SDD-0679, aceptación 8):

- fila nueva en el **Registro** de [versiones](chatwoot-versiones.md#registro);
- `IMAGEN_CHATWOOT` de `infra/ops/kommo-historial/ensayo-archivo.sh` y `infra/ops/portal-historial/ensayo-portal.sh` a la imagen nueva;
- cabecera «medido en la imagen …» de los cuatro inicializadores, **sin otro cambio**, y su copia al VPS con `docker restart`;
- `version` de `lib/studio/guia/chatwoot-selectores.json`, con el resultado de `smoke-guia.mjs`;
- la imagen vieja se borra del VPS (`docker image rm`) recién cuando Sam dé por cerrada la subida;
- `data.fallida-<sello>/` (si la hubo) la decide Sam.
