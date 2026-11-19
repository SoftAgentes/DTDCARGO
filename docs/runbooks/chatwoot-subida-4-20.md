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
2. **OK nominal de Sam.** Para esta subida se dio el 2026-11-19 en el chat del DG, con la frase literal citada en el paso 5: la subida es el mismo día, y se recrean `rails` y `sidekiq`. El pedido de «Actualizaciones» de Studio no es el OK. La reactivación de la cuenta 2 para V7 tiene su propio OK, citado en el §9. **La fase B (§9) se omitió** por decisión del DG: el tráfico entra casi todo por Kommo y el respaldo del §3 cubre la vuelta atrás. Por eso el corte del §7 queda sin medir con datos reales.
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
   - **`rails`:** ninguna diferencia (se recreó y comparó el 2026-11-19). La imagen cambia en §4, no aquí.
   - **`sidekiq`:** se espera **exactamente** esta diferencia, que entra con la subida. La nombra el OK nominal de Sam del 2026-11-19, literal: «OK, sube Chatwoot a 4.20.0 hoy, recreando rails y sidekiq (sidekiq toma DTD_CHATWOOT_SERVICIO_ID, SEARCH_TIME_RANGE_LIMIT_DAYS y el montaje de revocar sesiones)».
     - `> DTD_CHATWOOT_SERVICIO_ID`;
     - `> SEARCH_TIME_RANGE_LIMIT_DAYS`;
     - `MAX_USER_SESSIONS` con huella distinta (5 → 10). No sale en la frase de arriba porque Sam la autorizó antes, el 2026-11-19 en el chat del DG: «Subir a 10 y contar (Recomendado)». Quedó aplicada en `rails` a las 00:48Z. `sidekiq` no la usa (C): en la 4.20.0 solo la lee `app/controllers/devise_overrides/sessions_controller.rb:116`, al iniciar sesión por HTTP;
     - montaje `> /app/config/initializers/zz_dtd_revocar_sesiones.rb`.
   - **Si aparece cualquier otra diferencia, en `rails` o en `sidekiq`, no se sigue**: recrear la aplicaría sin que nadie la aprobara. Se avisa al DG.
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

> **Por `ssh … 'bash -s' < guion.sh`:** todo `docker compose exec`, `run` o `docker exec` del guion lleva `</dev/null`. Sin eso el contenedor lee el stdin, que es el resto del guion, y lo que falta no se ejecuta, sin error a la vista. Pasó en el §2 de la subida del 2026-11-19. Las variables entre tramos (`EV`, `SELLO`) se guardan en un archivo 600 (`/root/.cw0679.env`) y se cargan al empezar cada tramo.

```bash
date -u
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"; EV="/srv/ops/evidencias/chatwoot-0679-$SELLO"; install -d -m 700 "$EV"
sha256sum compose.yml rails/*.rb | tee "$EV/huellas-antes.txt"
docker compose images rails sidekiq | tee "$EV/imagenes-antes.txt"
cp -p compose.yml "$EV/compose.yml.antes"
# Las 15 migraciones de la 4.20.0 (SDD-0679 §6). Dos tienen fecha ANTERIOR al schema de 4.19.1
# (2026_10_19_143116): max(version) no dice si migró. Se cuentan estas, de a una.
V420="'20261006212107','20261019130258','20261021105045','20261026062035','20261027115208','20261029104503','20261103142055','20261104085110','20261104085633','20261104104833','20261107075626','20261111031108','20261113073350','20261113115701','20261116211055'"
migradas() { docker compose exec -T postgres psql -U chatwoot -d chatwoot_production -Atc "select count(*) from schema_migrations where version in ($V420)"; }
migradas | sed 's/^/migradas_4_20_antes=/' | tee "$EV/schema-antes.txt"     # 0. Si no es 0, se para y se avisa al DG
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
systemctl start chatwoot-respaldo.service; tail -n 20 /var/log/chatwoot-respaldo.log
systemctl show -p Result --value chatwoot-respaldo.service | sed 's/^/resultado=/' | tee "$EV/respaldo.txt"   # resultado=success
N="$(ls -1 /srv/backups/chatwoot | grep '^chatwoot-[0-9]\{8\}T[0-9]\{6\}Z$' | sort | tail -n 1)"
if [[ "$N" > "chatwoot-$SELLO" ]]; then
  echo "respaldo=$N (posterior a $SELLO)" | tee -a "$EV/respaldo.txt"
  printf '%s\n' "$N" >"$EV/respaldo-sello.txt"          # SOLO el nombre: lo lee la vuelta atrás (b) del §6
else
  echo "NO HAY RESPALDO NUEVO: NO SE SIGUE"
fi
```

**Condición de parada: si sale `NO HAY RESPALDO NUEVO` o `resultado=` distinto de `success`, aquí se termina la ventana.** No se pasa al §4; se avisa al DG. El bloque no usa `exit` a propósito: en una sesión SSH interactiva cerraría la terminal. **No se sigue** sin `resultado=success`, sin una carpeta con sello **posterior** a `$SELLO` (es la de esta ventana, no la diaria de las 06:30) y sin `rclone check` en verde en el log. Ese sello es el de la vuelta atrás (b).

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
- `prepare` ≠ 0: se mira `"$EV/prepare.txt"` y se corre `migradas`. Con `0`, vuelta atrás (a). Con cualquier otro número, vuelta atrás (b). **No se reintenta en caliente.**

```bash
# 4.4 Recrear SOLO rails y sidekiq con la imagen nueva. --no-deps: no toca postgres, redis, acceso ni prepare.
docker compose up -d --no-deps --force-recreate rails
docker compose up -d --no-deps --force-recreate sidekiq
for i in $(seq 1 24); do s="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q rails)")"; echo "rails $s"; [ "$s" = healthy ] && break; sleep 10; done
date -u | tee "$EV/corte-fin.txt"

# 4.5 Las 15 migraciones de la 4.20.0, aplicadas
migradas | sed 's/^/migradas_4_20_despues=/' | tee "$EV/schema-despues.txt"    # 15
```

Un número entre 1 y 14 con `prepare=0` no debería pasar; si pasa, es vuelta atrás (b).

`rails` tardó 41–70 s en quedar sano en las recreaciones anteriores; con Rails 8.0 puede variar (NV). Si a los 4 min no está `healthy`, vuelta atrás (b).

## 5 · Verificación

Primero **S1–S13 de [§6 del runbook de versiones](chatwoot-versiones.md#6--paso-a-producción-y-smoke)**, tal cual, con su resultado en el handoff. Un rojo en S1–S7 es vuelta atrás inmediata. Después, lo propio de esta versión:

| # | Comprobación | Exigencia |
|---|---|---|
| V1 | `curl -s https://chat.dtdcargo.com/api` | `"version":"4.20.0"`; `queue_services` y `data_services` en `ok` |
| V2 | `docker compose images rails sidekiq` | los dos con `v4.20.0-ce` y el digest nuevo |
| V3 | Inicializadores cargados **una vez por proceso**: `docker compose logs rails sidekiq \| grep -c '\[DTD\] redacción de logs activa'`, `… 'protección de /register activa: '`, `… 'revocación de sesiones activa'` | `2` cada uno (S2, S4, S6 los miden por separado); `0` en `revocar sesiones: faltan` y en `modo cerrado` |
| V4 | `rails` y `sidekiq` ahora iguales a su compose: repetir la comparación de §0 paso 5 | sin diferencias (la de `sidekiq` entró). Sale `RAILS_ENV` en los dos: está en el compose y en la imagen con el mismo valor, y se descarta (nota del §0) |
| V5 | WhatsApp sin app secret: `docker compose logs --since 15m rails \| grep -c WHATSAPP_APP_SECRET_PENDING` | Un número, sin abrir las líneas. **No es rojo**: dice qué bandejas esperan el secreto. Lo carga Sam cuando decida; nadie más |
| V6 | Sidekiq recupera: los cuatro números del paso 2 | encolados bajan a 0 en minutos; `muertos` no crece |
| V7 | Prueba en Studio (cuenta 2, **fase C** de la SDD): SSO y Bandeja, Ficha DTD y un mensaje de prueba a la bandeja 11 | todos en verde |
| V8 | La web de DTD: `infra/ops/web/smoke-web.sh` | igual que antes |

**Cuenta 2 (V7).** La cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable.

Uptime Kuma: el monitor «Chatwoot · versión» se cambia a `4.20.0` **después** de V1.

Aviso de cierre a «Cable Paso 3b» y al equipo (§1).

## 6 · Vuelta atrás

| Situación | Qué se hace | Tiempo |
|---|---|---|
| **a)** `prepare` falló y `migradas` da **0** | volver la línea de la imagen y recrear `rails` y `sidekiq` | ~3–5 min |
| **b)** Rojo y `migradas` da **más de 0**, o `rails` no queda sano | restaurar el respaldo del paso 3 con la imagen vieja | **~15 min** (restauración de 200 s medida en P5, más preparar la carpeta, la clave y S1–S9) |
| **c)** La 4.20.0 anda pero un inicializador no carga y no se arregla en la ventana | (a) o (b). **No** se deja corriendo sin el candado de `/register` ni sin la revocación | — |

**(a)**

```bash
cp -p "$EV/compose.yml.antes" compose.yml && sha256sum compose.yml        # igual a huellas-antes.txt
docker compose up -d --no-deps --force-recreate rails
docker compose up -d --no-deps --force-recreate sidekiq
curl -s https://chat.dtdcargo.com/api                                      # "version":"4.19.1"
```

Luego S1–S9.

**(b)** Una base migrada no se usa con la imagen vieja. `restaurar.sh` exige un destino vacío y levanta el proyecto entero con el compose de esa carpeta: es el único paso de este runbook que arranca todo, y es la recuperación del runbook de respaldo. Sam lo autorizó el 2026-11-19, en el chat del DG, **solo en emergencia**; respuesta literal: «Sí, solo en emergencia (Recomendado)».

```bash
cp -p "$EV/compose.yml.antes" compose.yml
docker compose down                                    # SIN -v
mv data "data.fallida-$SELLO"                          # se conserva hasta que Sam decida; no sale del VPS
mv .env "$EV/env.fallida" && chmod 600 "$EV/env.fallida"   # restaurar.sh descifra el del respaldo
read -rs K && umask 077 && printf '%s\n' "$K" >/dev/shm/clave.txt && unset K   # Sam pega la clave age
R="/srv/backups/chatwoot/$(cat "$EV/respaldo-sello.txt")"; ls "$R/manifiesto.txt"    # existe: la ruta es buena
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
| Vuelta atrás (b) | **+15 min** | restauración de 200 s en P5, más preparar y S1–S9 |

Si la fase B midió `prepare`, se reemplaza la línea del corte con ese número.

## 8 · Cierre

En el handoff de la subida: hora de inicio y fin del corte, la comparación de `sidekiq` y `rails` (sin diferencias), `prepare.txt` (solo la cola y el código de salida), `schema-version.txt`, sello del respaldo, S1–S13 y V1–V8, y los números de Sidekiq antes y después. Después, en una PR aparte (SDD-0679, aceptación 8):

- fila nueva en el **Registro** de [versiones](chatwoot-versiones.md#registro);
- `IMAGEN_CHATWOOT` de `infra/ops/kommo-historial/ensayo-archivo.sh` y `infra/ops/portal-historial/ensayo-portal.sh` a la imagen nueva;
- cabecera «medido en la imagen …» de los cuatro inicializadores, **sin otro cambio**, y su copia al VPS con `docker restart`;
- `version` de `lib/studio/guia/chatwoot-selectores.json`, con el resultado de `smoke-guia.mjs`;
- la imagen vieja se borra del VPS (`docker image rm`) recién cuando Sam dé por cerrada la subida;
- `data.fallida-<sello>/` (si la hubo) la decide Sam.

## 9 · Fase B: copia aislada en el VPS (opcional, para próximas subidas)

> **En la subida a la 4.20.0 no se corrió:** el DG la omitió el 2026-11-19. Queda como receta para un salto con migraciones largas o con más tráfico en Chatwoot.

**OK de Sam (2026-11-19, en el chat del DG, literal).** A «¿Autorizas levantar en el servidor una copia temporal y aislada de Chatwoot, sin dominio ni acceso desde afuera, con el respaldo de hoy, para ensayar la subida y después borrarla?», respondió «Sí, copia aislada (Recomendado)». Ese OK cubre **esto y nada más**: no toca `/srv/chatwoot`, la copia no tiene host ni puerto, y se borra al terminar.

**Cuenta 2 (V7).** La cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable. OK previo de Sam, del 2026-11-19, literal: a «¿autorizas reactivar un rato la cuenta de prueba de Chatwoot (la 2) para probar la Bandeja, la Ficha, el webhook y el chat del portal, y suspenderla al terminar?», respondió «Sí, reactiva y suspende (Recomendado)».

**Qué mide:** cuánto tarda `prepare` con la base real de 4.19.1 (las 15 migraciones), cuánto tarda `rails` 4.20.0 en quedar sano y si los inicializadores cargan con datos reales. Ese número reemplaza la línea del corte en §7.

**Aislamiento, y por qué así:** la copia lleva los tokens reales de Meta, el SMTP y el webhook a Studio. Si `sidekiq` arrancara con salida a internet, podría mandar correos, refrescar tokens o entregar webhooks como si fuera producción. Por eso:

- `sidekiq` **no arranca**: tiene un perfil que nadie activa.
- `rails` y `prepare` quedan solo en la red `interna` (`internal: true`): sin `chatwoot_edge`, sin salida a internet y sin etiquetas de Traefik.
- El perfil `cf-access` va apagado (`COMPOSE_PROFILES` vacío).
- No hay ningún `ports:`.

Lo corre el DG, con SSH. La clave privada `age` la pega Sam, como en P5. Cada salida va al handoff con su hora. Las evidencias van a `/srv/ops/evidencias/chatwoot-0679-ensayo-<sello>/`.

**0 · Condiciones.** Compose ≥ 2.24.4 (por `!override`), memoria libre ≥ 3 GB, sin restos de un ensayo anterior y producción sana.

```bash
date -u; docker compose version; free -m; df -h /srv
docker ps -a --filter label=com.docker.compose.project=chatwoot-ensayo -q | wc -l      # 0
[ ! -e /srv/chatwoot-ensayo ] && echo "carpeta libre"
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"; EV="/srv/ops/evidencias/chatwoot-0679-ensayo-$SELLO"; install -d -m 700 "$EV"
R="/srv/backups/chatwoot/$(ls -1 /srv/backups/chatwoot | tail -1)"; echo "$R" | tee "$EV/respaldo.txt"   # el de hoy
grep -iE '^(fecha|version)' "$R/manifiesto.txt"                                        # 4.19.1, hoy
```

**1 · Carpeta del ensayo.** El compose y los archivos montados de **producción** (todavía con la 4.19.1), más el overlay de aislamiento, que `docker compose` carga solo por llamarse `compose.override.yml`.

```bash
install -d -m 700 /srv/chatwoot-ensayo
cp -a /srv/chatwoot/compose.yml /srv/chatwoot/rails /srv/chatwoot/marca /srv/chatwoot/correo /srv/chatwoot/cf-access /srv/chatwoot-ensayo/
printf '%s\n' \
  '# SDD-0679 · copia aislada: sin Traefik, sin internet, sin sidekiq. Se borra al terminar.' \
  'name: chatwoot-ensayo' \
  'services:' \
  '  prepare:' \
  '    networks: !override [interna]' \
  '  rails:' \
  '    networks: !override [interna]' \
  '    labels: !override ["traefik.enable=false"]' \
  '  sidekiq:' \
  '    profiles: ["nunca-en-el-ensayo"]' \
  >/srv/chatwoot-ensayo/compose.override.yml

# Antes de restaurar: lo que levantaría el compose. Todavía no hay .env, así que se usa uno FICTICIO
# con los nombres obligatorios del compose y el valor «ficticio» (ningún secreto). Validado en local
# el 2026-11-19, con su control: sin el overlay aparecen sidekiq, chatwoot_edge y traefik.enable=true.
cd /srv/chatwoot-ensayo
F=/dev/shm/ensayo-ficticio.env
{ grep -o '\${[A-Z_]*:?' compose.yml | sed 's/^\${//; s/:?$//' | sort -u | sed 's/$/=ficticio/'; echo 'COMPOSE_PROFILES='; } >"$F"
docker compose -p chatwoot-ensayo --env-file "$F" config >/dev/shm/ensayo-config.yml && head -n 1 /dev/shm/ensayo-config.yml   # name: chatwoot-ensayo
for p in 'sidekiq' 'chatwoot_edge' 'traefik.enable: "true"|traefik.enable=true' '^ *ports:' '/srv/chatwoot/'; do
  printf '%s → %s\n' "$p" "$(grep -cE "$p" /dev/shm/ensayo-config.yml)"; done | tee "$EV/config-aislamiento.txt"   # todos → 0
shred -u "$F" /dev/shm/ensayo-config.yml
```

Si alguno no da `0`, **no se sigue**: se borra `/srv/chatwoot-ensayo` y se revisa el overlay.

**2 · Restaurar** con la imagen 4.19.1 del compose copiado. `restaurar.sh` descifra el `.env` del respaldo, le aplica los `--sobrescribir` e imprime los segundos de cada fase.

```bash
read -rs K && umask 077 && printf '%s\n' "$K" >/dev/shm/clave.txt && unset K          # Sam pega la clave
/srv/chatwoot/restaurar.sh --desde "$R" --identidad /dev/shm/clave.txt \
  --dir /srv/chatwoot-ensayo --project chatwoot-ensayo \
  --sobrescribir CHATWOOT_HOST=chat-ensayo.invalid \
  --sobrescribir CHATWOOT_FRONTEND_URL=https://chat-ensayo.invalid \
  --sobrescribir CHATWOOT_DATA_DIR=/srv/chatwoot-ensayo/data \
  --sobrescribir COMPOSE_PROFILES= 2>&1 | tee "$EV/restaurar.txt"
shred -u /dev/shm/clave.txt
```

**3 · Comprobar el aislamiento antes de seguir.** Si aparece `sidekiq`, `acceso`, una red que no sea la interna o un puerto: paso 6 y no se sigue.

```bash
cd /srv/chatwoot-ensayo; P="docker compose -p chatwoot-ensayo"
$P ps -a --format '{{.Service}} {{.State}}' | tee "$EV/servicios.txt"     # prepare exited, rails, postgres, redis; NO sidekiq ni acceso
docker inspect "$($P ps -q rails)" -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}'   # solo chatwoot-ensayo_interna
docker inspect "$($P ps -q rails)" -f 'traefik={{index .Config.Labels "traefik.enable"}} puertos={{json .HostConfig.PortBindings}}'   # traefik=false puertos={}
```

**4 · Imagen nueva, migraciones y arranque**, con tiempos.

```bash
sed -i 's#chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf#chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be#' compose.yml
diff /srv/chatwoot/compose.yml compose.yml                                    # UNA línea
$P stop -t 30 rails
T0=$(date +%s); $P run --rm --no-deps prepare >"$EV/prepare.txt" 2>&1; echo "prepare=$? $(( $(date +%s) - T0 )) s" | tee -a "$EV/medidas.txt"
T0=$(date +%s); $P up -d --no-deps --force-recreate rails
for i in $(seq 1 36); do s="$(docker inspect -f '{{.State.Health.Status}}' "$($P ps -q rails)")"; [ "$s" = healthy ] && break; sleep 5; done
echo "rails=$s $(( $(date +%s) - T0 )) s" | tee -a "$EV/medidas.txt"
```

**5 · Qué quedó**, sin abrir datos: la versión, la migración más nueva y conteos de líneas.

```bash
$P exec -T rails wget -qO- --header 'X-Forwarded-Proto: https' http://127.0.0.1:3000/api | grep -o '"version":"[^"]*"' | tee -a "$EV/medidas.txt"   # 4.20.0
V420="'20261006212107','20261019130258','20261021105045','20261026062035','20261027115208','20261029104503','20261103142055','20261104085110','20261104085633','20261104104833','20261107075626','20261111031108','20261113073350','20261113115701','20261116211055'"
$P exec -T postgres psql -U chatwoot -d chatwoot_production -Atc "select count(*) from schema_migrations where version in ($V420)" | sed 's/^/migradas_4_20=/' | tee -a "$EV/medidas.txt"   # 15
grep -ciE 'error|abort' "$EV/prepare.txt" | sed 's/^/errores_prepare=/' | tee -a "$EV/medidas.txt"                                          # 0
for m in 'redacción de logs activa' 'protección de /register activa: ' 'revocación de sesiones activa' 'revocar sesiones: faltan' 'modo cerrado'; do
  printf '%s=%s\n' "$m" "$($P logs rails 2>&1 | grep -c "$m")"; done | tee -a "$EV/medidas.txt"                                              # 1 1 1 0 0
$P exec -T rails bundle exec rails runner 'p Whatsapp::FacebookApiClient.instance_method(:register_phone_number).owner, HTTParty::Request.ancestors.include?(DtdProteccionRegister::PeticionHttp), Rails.application.routes.recognize_path("/platform/api/v1/users/1/dtd_revocar_sesiones", method: :post)[:controller], RoomChannel.ancestors.include?(DtdRevocarSesiones::Canal), ActiveJob::Base.log_arguments?' 2>&1 | tail -n 5 | tee -a "$EV/medidas.txt"
#   DtdProteccionRegister::Cliente · true · "platform/api/v1/dtd_sesiones" · true · false
```

El `modo cerrado` puede dar 1 si el `.env` del respaldo tiene vacía la lista de IDs protegidos; en ese caso vale lo que diga producción hoy con S2.

**6 · Limpieza**, siempre, también si algo falló. La carpeta tiene el `.env` descifrado y la copia de la base.

```bash
cd /srv && docker compose -p chatwoot-ensayo --project-directory /srv/chatwoot-ensayo down -v --remove-orphans
shred -u /srv/chatwoot-ensayo/.env
rm -rf /srv/chatwoot-ensayo
docker ps -a --filter label=com.docker.compose.project=chatwoot-ensayo -q | wc -l       # 0
docker volume ls --filter label=com.docker.compose.project=chatwoot-ensayo -q | wc -l   # 0
docker network ls --filter label=com.docker.compose.project=chatwoot-ensayo -q | wc -l  # 0
ls /dev/shm | grep -c clave                                                             # 0
curl -s https://chat.dtdcargo.com/api | grep -o '"version":"[^"]*"'                     # producción sigue en 4.19.1
```

- El respaldo se lee **en su lugar** (`/srv/backups/chatwoot/…`, cifrado) y no se copia. `restaurar.sh` no escribe el volcado en claro: lo pasa de `age -d` a `pg_restore` por una tubería. Por eso el único volcado que queda es la base dentro de `/srv/chatwoot-ensayo/data`, y se borra en este paso. Si en lugar del respaldo local se bajó uno de B2 a `/srv/restaurar/`, también se borra aquí: `rm -rf /srv/restaurar/chatwoot-<sello>`.
- `medidas.txt` va completo al handoff y al DG; no tiene datos de personas.
- Un `prepare` ≠ 0 o un inicializador que no carga **es el hallazgo**: se limpia igual y se arregla en la rama antes de pedir el OK de la subida.
