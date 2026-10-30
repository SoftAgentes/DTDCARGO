# Runbook · Subir de versión Chatwoot · SDD-0588

**SDD:** [0588](../specs/0588-chatwoot-versiones-e3/spec.md), paso 3.1 del programa [0582](../specs/0582-chatwoot-piloto/checklist.md) (decisión H).
**Estado:** escrito el 2026-10-30. **No se ha usado todavía:** el VPS sigue en `v4.19.1-ce`.
**Se apoya en:** [servidor](chatwoot-servidor.md) (§5 despliegue, §8 `/register`), [respaldo y restauración](chatwoot-respaldo-restauracion.md) y [vigilancia](chatwoot-vigilancia.md).

Chatwoot está fijado por etiqueta **y** digest (`infra/chatwoot/compose.yml`, servicio base `x-chatwoot`). Una versión nueva entra **solo** por este runbook, en una rama propia con PR. **Nunca** con `docker compose pull` suelto ni con `:latest`. Lo que puede romperse en una subida es **lo propio de DTD**, no lo de Chatwoot:

| Pieza propia | Archivo | Si deja de cargar |
|---|---|---|
| Candado de `/register` y `/deregister` (paso 4.2) | `rails/zz_dtd_proteccion_register.rb` | Chatwoot puede llamar a `/register` sobre el número que comparte con Kommo (CW-1): PIN nuevo, cupo de 10 cada 72 h, número desconectado de Kommo |
| Redacción de logs (paso 1.7) | `rails/zz_dtd_redaccion_logs.rb` | los logs vuelven a guardar correos, teléfonos y mensajes completos (CW-4) |
| Marca de DTD | `marca/aplicar-marca.rb` | solo cosmético |
| Integración con Studio | SSO (Platform API), webhook firmado, Dashboard App | la Bandeja, el contador o la ficha dejan de andar |

Los dos initializers se montan en **solo lectura** sobre `/app/config/initializers/`. Una imagen nueva no los borra, pero **sí** puede dejarlos sin efecto en silencio: un método renombrado (`Whatsapp::FacebookApiClient#register_phone_number`), un formateador de Sidekiq cambiado o una carga en otro orden. Por eso §4 los comprueba **por comportamiento**, con sus controles en rojo, y no solo por la línea de arranque.

> **Dependencia.** El candado vive en la PR de SDD-0584 (paso 4.2, `codex/0582-e4-register`) y al 2026-10-30 **no está montado en el VPS**. Mientras no lo esté, S2 y S3 de §6 se registran como **NO APLICA (candado no desplegado)**, y la corrida `prueba-register.sh` de §4 se hace igual sobre la rama de 4.2. Desde que la bandeja del número principal exista (paso 4.5), una subida sin S2 y S3 en verde **no se cierra**.

## 1 · Cuándo y quién

| | |
|---|---|
| Aviso | Studio › Ajustes › **Actualizaciones** (paso 3.3) muestra la versión instalada y la publicada, y guarda cada «Pedir actualización». El vigilante (3.2) corre una vez al día |
| Decisión | **Sam**, con OK nominal de despliegue para esa versión (puerta «despliegue» de SDD-0582). El pedido de Studio no es el OK |
| Ejecuta | Worker con su SDD hija o rama `codex/chatwoot-vX.Y.Z`, PR en borrador. El Director serializa la ventana con los demás despliegues |
| Ritmo | No se persigue cada versión. Se sube por **seguridad** (aviso de vulnerabilidad en las notas → en la semana), por una **función que DTD necesita** o **cada ~3 meses** para no acumular saltos. Solo versiones `-ce` estables, nunca `rc`, `beta` ni `develop` |
| Saltos | De a **una versión menor** por vez (4.19 → 4.20 → 4.21). Si el salto pasa por una versión con migraciones largas o cambios de Postgres/Redis anunciados en las notas, ese salto lleva su propio ensayo |

## 2 · RPO, RTO y ventana

| | Objetivo | Por qué |
|---|---|---|
| **RPO de la subida** | **0 mensajes perdidos** de lo que ya estaba en Chatwoot | respaldo conjunto **en el momento** (§5 paso 3), después del drenaje: no es el diario de las 06:30 |
| **RTO de la subida** | **≤ 30 min** del corte a Chatwoot respondiendo, con la versión nueva o la vieja | `prepare` migra en el `up`; si falla, §7 vuelve a la imagen anterior con el mismo `data/` (sin migraciones irreversibles) o restaura el respaldo de §5 (~4 min medidos en P5 con datos reales, 200 s) |
| **RTO de desastre** | ≤ 2 h | el del [respaldo](chatwoot-respaldo-restauracion.md#4--rpo-y-rto): sin cambios |
| **Corte visible** | ≤ 10 min | `prepare` + arranque de `rails` (142 s en P5) + smoke |

**Ventana:** de lunes a jueves, **entre las 21:00 y las 23:00 de Caracas** (01:00–03:00 UTC), lejos del respaldo de Chatwoot (06:30 UTC) y del de DTD (06:00 UTC). No el viernes: si algo sale mal, al día siguiente tiene que haber quien atienda. Antes de empezar, la hora real con `date -u` (Caracas = UTC − 4).

**Mientras Kommo siga operando (hasta E8)**, el corte de Chatwoot no deja a clientes sin respuesta: los mensajes también entran por Kommo. Se avisa al equipo que atiende **por Kommo** durante la ventana.

## 3 · Antes de la ventana: preparación en la rama

En la rama de la subida, **nada en el VPS todavía**:

1. **Leer las notas** de cada versión del salto (GitHub `chatwoot/chatwoot`, releases) y buscar estas palabras: `migration`, `postgres`, `redis`, `sidekiq`, `whatsapp`, `facebook_api_client`, `webhook`, `platform`, `sso`, `dashboard app`, `logger`, `breaking`, `security`. Anotar en el handoff qué toca la superficie de DTD.
2. **Diff de la superficie.** Con el código de Chatwoot clonado **fuera del repo**, comparar entre las dos etiquetas los archivos de los que dependen los initializers y la integración:

   ```bash
   git -C /ruta/chatwoot diff --stat v4.19.1 vX.Y.Z -- \
     app/services/whatsapp/ app/jobs/agent_bots/webhook_job.rb config/initializers/sidekiq.rb \
     config/initializers/filter_parameter_logging.rb app/controllers/platform/ \
     app/controllers/api_controller.rb app/models/channel/whatsapp.rb config/routes.rb
   ```

   Si cambió `facebook_api_client.rb`, `webhook_setup_service.rb` o `webhook_teardown_service.rb`, **el candado se revisa a mano** antes de seguir: los nombres de método que intercepta están en su cabecera.
3. **Imagen nueva por digest.** `docker buildx imagetools inspect chatwoot/chatwoot:vX.Y.Z-ce` y copiar el digest `linux/amd64`. Cambiar en `compose.yml` **la etiqueta y el digest juntos**. Revisar si las notas cambian las imágenes de `pgvector` o `redis` (no se suben en el mismo salto salvo que la versión lo exija).
4. **Actualizar las versiones esperadas** de las pruebas, que hoy dicen `4.19.1`: `pruebas/ensayo-local.sh` (C1 y la comprobación tras restaurar), la cabecera de los dos initializers («medido en la imagen …») y el monitor «Chatwoot · versión» de Uptime Kuma (§6, paso 6).
5. **Ensayo local completo** (§4). Sin los tres en verde **no se pide el OK**.
6. PR en borrador con: notas leídas, diff de la superficie, digest, resultados de §4 y la hora propuesta de la ventana. **Ahí se pide el OK nominal a Sam**, nombrando la versión, la ventana y el smoke de §6.

## 4 · Prueba en copia (local, nunca en el VPS)

Tres corridas pesadas de Docker, **una a la vez** y con turno del Director. Solo datos sintéticos.

| Corrida | Qué demuestra | Exigencia |
|---|---|---|
| `bash infra/chatwoot/pruebas/ensayo-local.sh` | la imagen nueva arranca con el compose real: versión (C1), registro cerrado (C2), cabeceras del iframe (C3), `/super_admin` cerrado (C4), **redacción de logs con su control sin redacción (A1 y C6)**, respaldo y restauración conjuntos (R1–R4b) | 0 fallas. **A1 tiene que seguir encontrando la fuga sin el initializer**: si A1 sale en verde sin fuga, la prueba ya no sabe detectarla y C6 no vale |
| `bash infra/chatwoot/pruebas/prueba-register.sh` | el candado intercepta `/register` y `/deregister` del ID protegido (L1–L8), falla cerrado con la variable vacía o inválida (V, I) | 0 fallas. **El control C (sin el initializer) tiene que salir en rojo y el `/register` tiene que llegar al servidor falso**: si el control sale verde, la versión nueva ya no pasa por el método que el candado intercepta |
| Restauración del respaldo de la versión vieja sobre la imagen nueva | `prepare` migra una base real de 4.19.1 (la de P5, en otro proyecto) | `restaurar.sh` sale 0; `sobres=0`; `GET /api` da la versión nueva |

La tercera es la «prueba en copia» de verdad: una copia de la base de producción **no** sale del VPS. Se hace **en el VPS, en el proyecto `chatwoot-ensayo`** (el mismo procedimiento de la puerta P5, §3b del [respaldo](chatwoot-respaldo-restauracion.md#3--restauración)), con la imagen nueva en su `compose.yml`, **sin Traefik y sin DNS**, y se baja con `down -v` al terminar. Es otra puerta: lleva su propio OK, que se pide junto con el de la subida. Mide cuánto tarda `prepare` con los datos reales: ese número decide si la ventana alcanza.

## 5 · El día: drenaje y respaldo conjunto

En el VPS, `cd /srv/chatwoot`. Cada paso con su salida en el handoff.

```bash
date -u                                                   # 1. hora real; dentro de la ventana
git -C /ruta/repo rev-parse HEAD                           #    el commit de la PR aprobada
sha256sum compose.yml rails/*.rb                           #    lo que hay hoy (para volver)
docker compose images rails sidekiq                       #    etiqueta y digest actuales → handoff

# 2. Drenaje. Sidekiq deja de tomar trabajos nuevos (TSTP = quiet) y termina los que tiene.
docker compose kill -s TSTP sidekiq
docker compose exec -T rails bundle exec rails runner '
  require "sidekiq/api"
  20.times { busy = Sidekiq::Workers.new.size; break if busy.zero?; sleep 15 }
  print "ocupados=", Sidekiq::Workers.new.size,
        " encolados=", Sidekiq::Queue.all.sum(&:size),
        " reintentos=", Sidekiq::RetrySet.new.size,
        " programados=", Sidekiq::ScheduledSet.new.size'
```

- `ocupados=0` es la condición para seguir. Los **encolados** no se pierden: Redis está en `appendonly` + `noeviction` y la versión nueva los toma al arrancar. Se anotan los cuatro números para compararlos en §6.
- Si después de 5 min sigue habiendo `ocupados`, se mira cuál es (`Sidekiq::Workers.new.map { |_, _, w| w["payload"]["class"] }`, solo la clase, nunca los argumentos) y se decide: esperar otros 5 min o seguir (el trabajo vuelve a la cola al parar).

```bash
# 3. Respaldo conjunto EN EL MOMENTO (no el de las 06:30): base, adjuntos, claves, manifiesto, B2.
systemctl start chatwoot-respaldo.service && tail -n 20 /var/log/chatwoot-respaldo.log
ls -1 /srv/backups/chatwoot | tail -1                     #    el sello de este respaldo → handoff
```

Sin `respaldo.sh` en 0 y con `rclone check` en verde **no se sigue**. Este respaldo es el punto de vuelta (§7 b).

## 6 · Paso a producción y smoke

```bash
# 4. Copiar SOLO lo que cambió en la PR (compose.yml y, si cambiaron, rails/ y marca/), y comprobarlo.
scp infra/chatwoot/compose.yml root@217.216.54.70:/srv/chatwoot/compose.yml     # desde el equipo de Sam
sha256sum compose.yml rails/*.rb                           # igual a los del commit de la PR

# 5. Bajar la imagen y recrear. prepare migra antes de que arranquen rails y sidekiq.
docker compose pull rails sidekiq prepare
docker compose up -d --wait
docker compose logs prepare | tail -n 20                  # migraciones aplicadas, sin error
```

**Smoke.** Todos con su resultado en el handoff. Un rojo en **S1–S5** es vuelta atrás inmediata (§7); no se depura en caliente.

| # | Comprobación | Exigencia |
|---|---|---|
| S1 | `curl -s https://chat.dtdcargo.com/api` | la versión **nueva**, `queue_services` y `data_services` en `ok` |
| S2 | **Candado de `/register` cargado:** `docker compose logs rails sidekiq \| grep -c 'protección de /register activa: 1 '` y `… \| grep -c 'modo cerrado'` | `2` y `0` (una por proceso, rails y sidekiq). Con la bandeja del número principal ya creada (desde 4.5) esto **no es opcional**: un `0` en la primera es vuelta atrás |
| S3 | **Candado por comportamiento**, en el contenedor y sin salir a Meta: `docker compose exec -T rails bundle exec rails runner 'c = Whatsapp::FacebookApiClient; p c.instance_method(:register_phone_number).owner, c.instance_method(:deregister_phone_number).owner, HTTParty::Request.ancestors.include?(DtdProteccionRegister::PeticionHttp)'` | `DtdProteccionRegister::Cliente` dos veces y `true`: las dos redes del candado (el cliente de Meta y HTTParty) están delante de Chatwoot. Si sale `Whatsapp::FacebookApiClient` o el método ya no existe, la versión cambió la superficie y §4 tenía que haberlo cazado: vuelta atrás |
| S4 | **Redacción de logs cargada:** `docker compose logs rails sidekiq \| grep -c 'redacción de logs activa'` | ≥ 2 |
| S5 | **Redacción por comportamiento:** `docker compose exec -T rails bundle exec rails runner 'Rails.logger.info("sonda payload={\"x\":1} correo=sonda@ejemplo.test"); p ActiveJob::Base.log_arguments?' 2>&1 \| tee /dev/shm/sonda.txt`, luego `grep -c 'sonda@ejemplo.test' /dev/shm/sonda.txt` y `shred -u /dev/shm/sonda.txt`. El log del `runner` sale por su propia salida, no por `docker compose logs` | `false` y `0`; la línea de la sonda sale con `[REDACTADO]`. Es una sonda: no reemplaza el control A1 de §4, que es el que prueba que la redacción sabe detectar la fuga |
| S6 | Registro cerrado y `/super_admin`: las comprobaciones 2 y 4 de §5 del [servidor](chatwoot-servidor.md#5--desplegar-puerta-p1) | `false`; `403` en `/super_admin/sign_in`, `/monitoring/sidekiq` y `/installation/onboarding`; `200` en `/app/login` |
| S7 | Iframe: `curl -sI https://chat.dtdcargo.com/app/login` | sin `X-Frame-Options`, con `frame-ancestors 'self' https://dtdcargo.com` |
| S8 | Studio: abrir **Bandeja** con un usuario vinculado (SSO), ver una conversación, mandar una respuesta de prueba **a la bandeja de prueba**, nunca a un cliente | entra sin pedir clave; la respuesta sale |
| S9 | Ficha DTD dentro de Chatwoot y contador de Studio | la ficha carga; el contador se mueve con la respuesta de S8 |
| S10 | La web de DTD: `infra/ops/web/smoke-web.sh` y Uptime Kuma de DTD | igual que antes |

```bash
# 6. Uptime Kuma: el monitor «Chatwoot · versión» busca "version":"4.19.1". Se cambia en su UI a la
#    versión nueva DESPUÉS de S1; si no, avisa en rojo (que es justo para lo que está).
```

## 7 · Recuperación del tráfico

**Sidekiq.** La versión nueva arranca sin `quiet`. Comparar contra los números de §5:

```bash
docker compose exec -T rails bundle exec rails runner '
  require "sidekiq/api"
  print "encolados=", Sidekiq::Queue.all.sum(&:size), " reintentos=", Sidekiq::RetrySet.new.size,
        " muertos=", Sidekiq::DeadSet.new.size'
```

- Los encolados bajan a 0 en minutos. Los **muertos** no crecen respecto del valor previo; si crecen, se mira la clase del trabajo (no sus argumentos) antes de cerrar la ventana.

**Meta y los demás canales.** Durante el corte, los webhooks que Meta mandó a `chat.dtdcargo.com` recibieron error y Meta los **reintenta** por su cuenta (plazo y ritmo según la documentación de Meta, **NV aquí**). Se comprueba que llegan: en la bandeja de prueba, mandar un mensaje desde un teléfono de DTD durante el corte y verlo aparecer después del `up`. Kommo los recibe en paralelo, así que no hay pérdida para el cliente.

**Studio.** El webhook de Chatwoot a Studio (paso 2.3) guarda cada evento y reintenta lo pendiente con el cron `chatwoot-reintentos` (cada 5 min). Después de la subida, el contador de Studio y la reconciliación quedan al día en ≤ 10 min. Si no, se revisan los pendientes por conteo (nunca el contenido).

**Cierre de la ventana:** el handoff con S1–S10, los conteos de Sidekiq antes y después, el sello del respaldo, la versión y el digest nuevos, y una fila en el **Registro** de abajo. Studio deja de mostrar la versión como pendiente en la siguiente corrida del vigilante.

### Vuelta atrás

| Situación | Qué se hace | Tiempo |
|---|---|---|
| a) Rojo en S1–S7 y `prepare` **no** aplicó migraciones (la versión nueva no tenía) | volver `compose.yml` al commit anterior (etiqueta y digest viejos) y `docker compose up -d --wait`; repetir S1–S7 | ~5 min |
| b) Rojo y `prepare` **sí** migró | una base migrada no se usa con la imagen vieja. `docker compose down` (sin `-v`), mover `data/` a `data.fallida-<sello>/` y restaurar el respaldo de §5 con la imagen vieja: `restaurar.sh --desde … --dir /srv/chatwoot` (§3a del [respaldo](chatwoot-respaldo-restauracion.md#3--restauración)) | ~5–10 min (200 s medidos en P5) |
| c) La versión nueva anda pero un initializer no carga y no se arregla en la ventana | (a) o (b). **No** se deja corriendo sin el candado de `/register`, aunque «parezca andar» | — |

`data.fallida-<sello>/` se conserva hasta que Sam decida; tiene datos reales y no se copia fuera del VPS.

## Registro

| Fecha | De → a | Ensayo local | Copia en el VPS | Ventana | Resultado | Quién |
|---|---|---|---|---|---|---|
| — | `v4.19.1-ce` (instalada el 2026-10-29) | — | — | — | — | — |
