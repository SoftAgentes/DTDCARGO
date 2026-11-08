# Runbook · La carga P4 del chat del portal a Chatwoot y el encendido: las cinco puertas (SDD-0586 §10.5.10)

> Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del DG comunicado por el Subdirector de Chatwoot. Las partes de `cargar.sh`, de la copia y del ensayo son de E5, adaptadas a este formato. **E5 revisa las puertas 3 y de la 4.5 a la 4.7 antes de publicar.**
>
> **Qué junta.** El guion que estaba repartido entre la spec 0586 §10.5.10, el README de `infra/ops/portal-historial/` y `chatwoot-portal-encendido.md`. Desde aquí, esos lugares apuntan a este runbook.
>
> **Este runbook no corre nada.** Cada puerta la abre el DG con el **OK nominal de Sam para esa puerta.** Un OK no cubre la siguiente, ni otro entorno, ni otros comandos que los de su puerta. Los sub-pasos marcados **⛔ OK propio** piden además su OK aparte.
>
> **Marcas:**
> - **«medido en el VPS por el DG»:** el DG lo midió.
> - **«según main, sin medir en el VPS»:** sale del repo, y el compose del VPS no es el de `main`.
> - **‹por confirmar›:** todavía no está.

## Antes de la primera puerta

| Condición | Cómo se comprueba |
|---|---|
| La 0508, la 0519, la 0520, la 0521, la 0523 y la 0524 aplicadas en producción | En el ledger `supabase_migrations.schema_migrations` (`aplicar-migraciones-prod.md:22`), dentro de `dtd-cargo-db-1`: `select name from supabase_migrations.schema_migrations where name in ('0508_chatwoot_bajas_purga', '0519_chatwoot_portal', '0520_chatwoot_portal_vuelta', '0521_chatwoot_portal_estado', '0523_chatwoot_portal_carga', '0524_chatwoot_portal_puerta4');`. Tiene que dar seis filas |
| La #462, la #463 y la #464 en `main`: el `grant` de `vincular.sh`, y el `-O` con el `! -L` de `extraer.sh` | `git log origin/main` incluye el merge del tren 6 |
| La PR 2b de E5 en `main`: `cargar.sh`, `cargar-portal.rb`, `ensayo-portal.sh` y las listas de columnas con su prueba | `git log origin/main` |
| T1 a T4 publicados, y la 1c-1 y la 1c-1b en producción | `chatwoot-portal-encendido.md` §0 |
| El equipo sabe que **entre la foto (4.4) y el encendido (puerta 5) no responde desde Studio** | El DG avisa al equipo, con la hora |

**Los contenedores,** medidos en el VPS por el DG:
- `dtd-cargo-db-1`, la base de Studio;
- `dtd-cargo-web-1`;
- `dtd-cargo-cron-1`;
- `chatwoot-rails-1`;
- `chatwoot-postgres-1`.

**Las variables de `cargar.sh`,** todas números:
- `CUENTA`, la cuenta de Chatwoot;
- `BANDEJA`, que es `CHATWOOT_INBOX_PORTAL_ID` y sale de la puerta 2. `cargar.sh` la cruza con el nombre «Conversaciones del portal», y si no coinciden no carga;
- `AGENTE_SERVICIO`, el usuario de Chatwoot que firma los salientes sin vínculo de agente. **Es el usuario de servicio de E10** (el del `CHATWOOT_ROUTER_TOKEN`), y tiene que ser de la cuenta 1, porque si no el cargador se niega. Su id se lee en la puerta 2, en solo lectura: `docker exec -i chatwoot-rails-1 bundle exec rails runner 'u = User.find_by(email: "<correo del usuario de servicio>"); puts "HECHO agente_servicio=#{u&.id} en_cuenta=#{u && AccountUser.exists?(account_id: 1, user_id: u.id)}"'`. El correo no va a la evidencia, solo el id y `en_cuenta=true`.

**Los códigos de salida de `cargar.sh`:**
- **0:** bien.
- **1:** el cargador no dio `carga=ok`, o falló el traslado de los vínculos.
- **2:** uso o archivos: falta el preparado, ya hay vínculos o falta el contenedor.
- **4:** el contenedor no quedó limpio.

---

## Puerta 1 · Producción a la copia efímera del ensayo: dos OK, primero Chatwoot y después Studio

**La decidió el DG** siguiendo la spec 0586 §10.5.10 y el diseño de la 2b de E5. El ensayo de la puerta 3 corre sobre una **copia mínima de producción**, y la puerta 1 es la lectura que la arma. **Nunca es un `pg_dump` entero:** son el esquema, más `COPY (SELECT <lista explícita> …)` filtrado, en una transacción `read only`. Los datos pasan por un tubo entre los contenedores, sin archivo en el disco del VPS. El diseño está en las notas compartidas: `0586-p4-2b-columnas-copia-studio.md`.

**Reglas comunes a la 1a y la 1b:**
- **Nada sale del VPS:** ni volcados, ni copias a la PC, ni al repo. La evidencia es solo `HECHO`, con conteos y md5.
- **Adónde:** a tmpfs del VPS, con una red `internal` y sin puertos publicados. **Quién lo ve:** solo root. **Cuánto dura:** lo que dura la corrida del ensayo.
- **Producción** se mide antes y después, y tiene que quedar sin cambios (P1 a P3 del ensayo).
- **El `trap`** borra la copia también si algo falla, y sale con 4 si no puede terminar la limpieza.
- **Cómo se prueba el borrado:**
  - `HECHO limpieza=contenedores:0,volumenes:0,redes:0`;
  - la carpeta de la copia, ausente;
  - `test ! -e /dev/shm/portal-historial`;
  - nada en `/tmp` del Chatwoot de producción.
- **Las columnas que no están en la lista** quedan en NULL o en su valor por defecto. Las NOT NULL que no hacen falta van sintéticas. **Una prueba con mutantes demuestra que no sale ninguna otra.**

### 1a · Chatwoot de producción a la copia efímera

| | |
|---|---|
| **Qué lee o escribe** | **Lee producción en solo lectura:** `COPY (SELECT <lista> … WHERE account_id = :cuenta …)`. **El esquema lo crea la imagen de Chatwoot fijada por digest,** con `db:chatwoot_prepare` en el stack efímero. **Las otras cuentas no entran nunca:** la consulta ya filtra la cuenta. No escribe nada en producción |
| **Qué va** | <ul><li>solo la bandeja del portal;</li><li>el usuario de servicio y los agentes vinculados, con correo y nombre **sintéticos**;</li><li>los contactos `dtd-portal:`, **sin teléfono, correo ni `additional_attributes`**, y con el nombre sintético;</li><li>sus `contact_inboxes`;</li><li>las conversaciones y los mensajes **de la bandeja del portal, sin `content`**;</li><li>los webhooks de la cuenta, con la URL **sintética**;</li><li>la secuencia `conv_dpid_seq_<cuenta>`, por `setval`.</li></ul>**No va:** nada de WhatsApp ni de Instagram, el `hmac_token`, la URL real de un webhook, `access_tokens`, `inbox_members` ni adjuntos |
| **Tablas y columnas** | Las de la lista de la 2b ‹por confirmar hasta que la 2b esté en `main`› |
| **Comando** | El de `ensayo-portal.sh`, la 2b ‹por confirmar› |
| **Para seguir** | Sale con 0. La otra cuenta tiene 0 filas en todas las tablas de la copia, medido antes de cualquier otro paso. Producción queda sin cambios |
| **Evidencia** | `HECHO`, con conteos y md5, sin datos de personas |
| **Vuelta atrás** | Borrar la copia, con el `trap` o con `ensayo-portal.sh --limpiar`, y la prueba de borrado |
| **OK nominal** | «¿Autorizas copiar de Chatwoot de producción, en solo lectura y filtrado a la cuenta 1, las tablas y columnas de la lista de la 2b (solo la bandeja del portal, sin teléfonos, correos, textos ni secretos) a una copia efímera en tmpfs del VPS (red interna, sin puertos, solo root, mientras dura el ensayo), que se borra al terminar?» |

### 1b · Studio de producción a la copia efímera mínima

| | |
|---|---|
| **Qué lee o escribe** | **Lee producción en solo lectura, filtrado al tenant:** `COPY (SELECT <lista> … WHERE tenant_id = :tenant …)`. **El esquema sale de las migraciones del repo,** aplicadas en el Postgres efímero. No viaja ningún `pg_dump --schema-only` de producción. No escribe nada en producción |
| **Qué va** | <ul><li>**Los únicos datos personales: `clients.name` y `conversation_messages.body`**, este último solo de los hilos `portal`.</li><li>`clients` va **sin `phone`, `email`, cédula, RIF ni el `markbox` real**, y el `markbox` va sintético.</li><li>`conversation_messages` va **sin `author_name`**.</li><li>Lo demás son ids, estados y fechas: `tenants`, `conversations` del portal, los `chatwoot_portal_*`, `chatwoot_conversations`, `chatwoot_agent_links`, los `id` de `auth.users`, `feature_flags` (`chatwoot_portal`), y los `id` del CRM de C-7 y de `chatwoot_webhook_events`.</li></ul> |
| **Tablas y columnas** | Las de la lista de la 2b ‹por confirmar hasta que la 2b esté en `main`› |
| **Comando** | El de `ensayo-portal.sh`, la 2b ‹por confirmar› |
| **Para seguir** | Sale con 0. Producción queda sin cambios. Los conteos de la copia son los del tenant (C-1) |
| **Evidencia** | `HECHO`, con conteos y md5, sin datos de personas |
| **Vuelta atrás** | Igual que la 1a |
| **OK nominal** | «¿Autorizas copiar de Studio de producción, en solo lectura y filtrado al tenant, las tablas y columnas de la lista de la 2b (de datos personales, solo el nombre de la ficha y el texto de los mensajes del portal; sin teléfono ni correo) a la misma copia efímera, que se borra al terminar?» |

**Contexto:** el conteo del 2026-11-07 dio 24 hilos y 73 mensajes del portal. La carga vuelve a contar al extraer (C-1).

## Puerta 2 · Crear la bandeja «Conversaciones del portal» en la cuenta 1

| | |
|---|---|
| **Qué lee o escribe** | **Antes, lee** los conteos de administradores y agentes de la cuenta 1, sin nombres. **Después, escribe en el Chatwoot vivo:** crea la bandeja |
| **Comando, la lectura** | `docker exec -i chatwoot-rails-1 bundle exec rails runner 'a = Account.find(1); puts "HECHO administradores=#{a.account_users.administrator.count} agentes=#{a.account_users.agent.count}"'` |
| **Comando, la verificación de China** | **La hace Sam, con su sesión en el panel** (decisión del DG). **El DG no usa el navegador con la sesión de Sam.** El DG le lleva desde el VPS el conteo de administradores y agentes de la cuenta 1, y el de la bandeja nueva, por rol y sin nombres. Sam confirma en el panel (Ajustes → Agentes) que **ninguno es del equipo de China**. Un administrador ve todas las bandejas, y ahí aplicaría la PIPL. **En la evidencia** queda solo «verificado por Sam, 0 del equipo de China», con la hora |
| **Comando, la bandeja** | Panel de la cuenta 1: Ajustes → Bandejas → Nueva → canal **API**. **Va sin `webhook_url`,** sin saludo, sin asignación automática y sin encuesta (§10.5.9, puerta 3). La guarda G1 del cargador rechaza una bandeja con `webhook_url`. Los miembros son el usuario de servicio de E10 y **solo agentes de Venezuela** (E10-D36) |
| **Comando, después** | `docker exec -i chatwoot-rails-1 bundle exec rails runner 'puts "HECHO miembros=#{Inbox.find(<id>).inbox_members.count}"'`. Se anota el id de la bandeja |
| **Para seguir** | 0 del equipo de China, la bandeja sin `webhook_url`, y los miembros que el DG espera |
| **Evidencia** | `/srv/ops/evidencias/p4-bandeja-<UTC>/`: los conteos, «verificado, 0 del equipo de China», el id de la bandeja y su configuración, sin nombres |
| **Vuelta atrás** | Borrar la bandeja desde el panel, mientras no tenga conversaciones. Si ya las tiene, la de la puerta 4 |
| **OK nominal** | «¿Autorizas crear la bandeja "Conversaciones del portal" en la cuenta 1 de Chatwoot, con la verificación de administradores?» |

**Sub-paso 2a · ⛔ OK propio · Las variables de la web y recrearla.**
- **Las variables:** `CHATWOOT_INBOX_PORTAL_ID` (el id de la puerta 2), `CHATWOOT_ROUTER_TOKEN`, `CHATWOOT_ACCOUNT_ID=1`, `CHATWOOT_TENANT_ID` y `CHATWOOT_URL`, en `/srv/dtd-cargo/.env`.
  - **No se imprimen:** se anota solo el nombre y el largo, o un sha256 corto.
- **Recrear la web:** `cd /srv/dtd-cargo && docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web`.
  - Es el comando que usa `publicar-web.sh`, medido en el VPS por el DG.
  - **Sin `--force-recreate`:** compose recrea solo si cambió el `.env`.
- **Para seguir:**
  - el contenedor **fue recreado:** `docker inspect -f '{{.Created}}' dtd-cargo-web-1` da una hora nueva. **Si no cambió, se para;**
  - la web queda healthy;
  - la tarjeta «Portal → Chatwoot» de `/studio/bandeja` muestra la bandeja configurada.
- **La vuelta atrás:** vaciar `CHATWOOT_INBOX_PORTAL_ID` y correr el mismo `up -d --no-deps web`. La cola queda en `omitido: "sin_configurar"`.

**Sub-paso 2b · ⛔ OK propio · El webhook de la cuenta 1, con `message_created`.**
- **Es el de E2, que ya existe. Se mira, no se crea:** que la URL termine en `/api/chatwoot/webhook` y que esté suscrito a `message_created`.
- **Si le falta `message_created`,** agregarlo es un cambio en el Chatwoot vivo y pide este OK.
- **La evidencia:** la salud del webhook en Studio, que es de solo lectura.

---

## Puerta 3 · El ensayo, en la copia efímera

> **La PR 2b de E5 todavía no está escrita.** Lo que sigue es su contrato: el guion copia las guardas de `kommo-historial/ensayo-archivo.sh`. La 2b fija las opciones y los nombres de la evidencia, y este texto se actualiza cuando entre en `main`.

**Sub-paso 3.0 · ⛔ OK propio · Crear `/srv/ops/portal-historial` y poner los scripts.**
- **El punto de partida,** medido en el VPS por el DG: `/srv/ops/portal-historial` no existe, y `/srv/ops/kommo-historial` sí.
- **Qué escribe:** crea la carpeta y copia `infra/ops/portal-historial/` de `main`.
- **La lista que se compara por sha256:**
  - `extraer.sh`, `vincular.sh`, `limpiar.sh`, `reservar.sql`, `extraer.sql` y `controles-studio.sql`;
  - de la 2b: `cargar.sh`, `cargar-portal.rb`, `ensayo-portal.sh` y los archivos que sume, como la lista de columnas;
  - de la 2c: `deshacer.sh` y su `.rb`;
  - en Studio, desde `supabase/cargas/portal-historial-deshacer/`: `deshacer-vinculos.sql` y `deshacer-vinculos.sh`, que van a la misma carpeta del VPS con su propio `scp` y su sha256.
  - **La lista crece con cada PR,** y se escribe aquí cuando entra en `main`.
  - El `scp -r` copia también `pruebas/`, que trae solo datos inventados. No está en la lista y no se usa en el VPS.
- **Comando:** `scp -r infra/ops/portal-historial root@217.216.54.70:/srv/ops/ && ssh root@217.216.54.70 chmod -R go-rwx /srv/ops/portal-historial`. Es el patrón del Archivo Kommo (`infra/ops/kommo-historial/README.md:9` y `:41`).
- **Para seguir:** el `sha256sum` de cada archivo de la lista en el VPS es igual al de `git show origin/main:infra/ops/portal-historial/<archivo> | sha256sum`, y `stat -c %a` de la carpeta da `700`.
- **La evidencia:** las dos listas de sha256 y el commit de `main`.
- **La vuelta atrás:** `rm -r /srv/ops/portal-historial`. No guarda datos.

### 3.1 · Correr el ensayo

| | |
|---|---|
| **Qué lee o escribe** | **Usa la copia de la puerta 1** (la 1a y la 1b). **Escribe solo en la copia efímera,** con red interna, en tmpfs y con la marca de la copia. **En producción no escribe nada** |
| **Comando** | **Las entradas:** `TENANT=<uuid>`, `CUENTA=1`, `BANDEJA=<id de la puerta 2>` y `AGENTE_SERVICIO=<id>`. `bash /srv/ops/portal-historial/ensayo-portal.sh`, con las opciones de la 2b. **El ensayo no corre si `/dev/shm/portal-historial` ya existe,** para no pisar una carga real a medias, ni al revés. **Se niega con `DB_CW=chatwoot-rails-1`** o con cualquier contenedor que no sea de la copia: es una guarda de la 2b, con su mutante. Corre como unidad de systemd con su `TimeoutStopSec`, igual que el ensayo del Archivo Kommo. En la copia corre `extraer.sh`; `cargar.sh` con `MODO=seco` y después con `MODO=cargar`; `vincular.sh`; y `controles-studio.sql` antes y después |
| **Para seguir** | <ul><li>el ensayo sale con 0;</li><li>pasan C-1 a C-14;</li><li>C-6 y C-7 dan igual antes y después;</li><li>C-8 trae un espejo por hilo vinculado;</li><li>`conversaciones_estado_actualizado=0`;</li><li>la limpieza deja 0 contenedores, 0 volúmenes y 0 redes;</li><li>producción sigue igual (P1 a P3);</li><li>**la evidencia dice que `DB_CW` era el contenedor de la copia, con su nombre y su red interna;**</li><li>**al terminar, `test ! -e /dev/shm/portal-historial && echo vacio`.**</li></ul>**Los casos provocados:**<ul><li>(a) un `vinculos.ndjson` con un mensaje menos, que da 22023 sin escribir;</li><li>(B1) `contacto_id` nulo y `source_id` vacío a la vez, que da 22023, «id de contacto inválido»;</li><li>(B2) solo el `source_id` vacío, que da 22023, «falta el source_id del contacto»;</li><li>(c) después de (a), repetir desde la extracción: no queda nada doble en Chatwoot, y en Studio queda un solo corte.</li></ul> |
| **Evidencia** | Las líneas `HECHO` con conteos y md5, sin datos de personas, y `HECHO ensayo_codigo=0`. **El DG la recibe antes de la puerta 4** |
| **Vuelta atrás** | Borrar la copia (`ensayo-portal.sh --limpiar`, o lo que fije la 2b). En producción no hay nada que deshacer |
| **OK nominal** | «¿Autorizas correr el ensayo de la carga P4 en la copia efímera?» |

---

## Puerta 4 · Producción

**Antes de la puerta 4** (condición del DG, 2026-11-08): **las dos vueltas atrás dirigidas, la de Studio (`supabase/cargas/portal-historial-deshacer/`) y la de Chatwoot (la pieza de E5), en `main` y ensayadas** por el DG con `rollback`. No hace falta para las puertas 1 a 3. Sin ellas, el DG no le pide a Sam la puerta 4.

**Y, antes de la puerta 4, la comprobación de la prevención del log** (aprobada por el DG, 2026-11-08). En `chatwoot-postgres-1`, con el usuario de Rails: `docker exec -i chatwoot-postgres-1 psql -X -At -U chatwoot -c 'SELECT rolsuper FROM pg_roles WHERE rolname = current_user'`. **Tiene que dar `t`:** el cargador fija `SET LOCAL log_min_error_statement = 'panic'` y `log_error_verbosity = 'terse'`, que piden superusuario. **Si da `f`, la puerta no sigue.** El DG midió `t` el 2026-11-08.

**Todo seguido, el mismo día y con el DG, con `chatwoot_portal` apagado.** Se corre en el VPS como root, desde `/srv/ops/portal-historial/` (3.0).

**Entre la foto (4.4) y el encendido (puerta 5), el equipo no responde desde Studio.** La cola solo manda entrantes, y lo que el equipo escriba ahí no llegaría a Chatwoot. Se cruza con la 1c-4, el modo de respaldo.

| Paso | Qué lee o escribe | Comando | Para seguir | Evidencia | Vuelta atrás |
|---|---|---|---|---|---|
| **4.1 · Respaldo** | Escribe dos respaldos, y anota la **hora de 4.1** | **Chatwoot:** `systemctl start chatwoot-respaldo.service && tail -n 20 /var/log/chatwoot-respaldo.log`. Su `ExecStart` es `/srv/chatwoot/respaldo.sh --dir /srv/chatwoot --out /srv/backups/chatwoot`, medido en el VPS por el DG. **Studio:** `/srv/dtd-cargo/backup.sh`, el que el DG ya probó en las tandas. El externo a S3 (`pg-dump-to-s3.sh`) va aparte, con sus argumentos ‹por medir› | Los dos respaldos existen y se pueden leer | El nombre, el tamaño y el sha256 de cada uno, y la hora | No hace falta |
| **4.2 · Lectura previa** | Lee | `docker exec -i dtd-cargo-db-1 psql -X -q -At -U postgres -d postgres -f - < controles-studio.sql` (C-6, C-7 y C-8), y el conteo de la spec 0586 §10.5.10, con md5 `a5da12512b23b4662678e6eb5926c632` | Sale con 0 | La salida, con conteos y md5 | No hace falta |
| **4.3 · La cola nunca corrió y el flag nunca se encendió** | Lee | `begin transaction read only;` → `select (select count(*) from public.chatwoot_portal_salida where tenant_id = :'tenant') as salida, (select count(*) from public.feature_flags where tenant_id = :'tenant' and key = 'chatwoot_portal' and enabled) as flag_encendido, (select corte from public.chatwoot_portal_estado where tenant_id = :'tenant') as corte;` → `select count(*) filter (where after_data->>'enabled' = 'true') as encendidos from public.entity_audit_log where tenant_id = :'tenant' and entity_type = 'feature_flag' and event_type = 'feature_flag_changed' and after_data->>'key' = 'chatwoot_portal';` → `rollback;`. La auditoría está en `entity_audit_log`: la escribe `append_audit_event` (`0289:890-910`), y la columna `after_data` es de la `0267:306`. **`audit_d1_operations.result_data` guarda solo `{entity_id}` (`0289:654`)** | **Las cuatro juntas: `encendidos = 0`, `flag_encendido = 0`, `salida = 0` y `corte` nulo.** Un `UPDATE` por SQL no deja auditoría, por eso no basta con mirar `entity_audit_log`. **Si alguna no da, no se extrae y se le avisa al DG** | La salida | No hace falta |
| **4.4 · Extraer** | **Escribe** la reserva en Studio, y deja `preparado.ndjson` en `/dev/shm/portal-historial` (0600) | `DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> bash extraer.sh` | Código 0, `HECHO reservados=…` y `HECHO lineas=…` | Las líneas `HECHO` | `limpiar.sh`. La reserva no se deshace: una repetición la reusa |
| **4.5 · Cargar en seco** | **Lee** el preparado, por la entrada estándar de `docker exec -i` y sin copiarlo al contenedor, y la base de Chatwoot. **No escribe nada en Chatwoot:** solo copia el `.rb` a `/tmp/cargar-portal.rb` y crea `/dev/shm/portal-historial` en el contenedor, y el `trap` borra las dos cosas | `DB_CW=chatwoot-rails-1 CUENTA=1 BANDEJA=<id> AGENTE_SERVICIO=<id> MODO=seco bash cargar.sh` | <ul><li>código 0, `carga=ok` y `contenedor_limpio=si`;</li><li>`leidas` es igual a la cabecera del preparado;</li><li>**`conversaciones_existentes` y `conversaciones_estado_actualizado` no aparecen, o dan 0;**</li><li>`secuencia` no avanza (`X->X`);</li><li>`trabajos_nuevos=ninguno` y `correos_enviados=0`;</li><li>**en la primera corrida, con la bandeja vacía, los números son exactos:** `contactos_nuevos`, `conversaciones_nuevas` y `mensajes_nuevos` son los del preparado, y `notas_nuevas`, los hilos archivados. Si algo no coincide, había algo antes en la bandeja, y se para.</li></ul> | La salida entera, solo con `HECHO` | No hace falta. Si da `contenedor_limpio=no` (código 4): `docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb`, y se comprueba como en 4.9 |
| **4.6 · Cargar** | **Escribe en Chatwoot,** con `insert_all` y sin callbacks: <ul><li>los contactos `dtd-portal:<identificador>`, sin teléfono ni correo;</li><li>sus `contact_inbox`, con `pubsub_token`;</li><li>las conversaciones y los mensajes;</li><li>la nota de cada hilo archivado.</li></ul>Toma un candado: no corren dos cargas a la vez. **En el VPS** deja `vinculos.ndjson` (0600, solo ids), que trae con `docker exec … cat` | El de 4.5, con `MODO=cargar` | <ul><li>código 0, `carga=ok` y `contenedor_limpio=si`;</li><li>`*_nuevos` es igual a lo que dijo el seco;</li><li>`conversaciones_existentes` y `conversaciones_estado_actualizado` siguen sin aparecer;</li><li>`secuencia` avanza exactamente `conversaciones_nuevas`;</li><li>`trabajos_nuevos=ninguno` y `correos_enviados=0`;</li><li>`vinculos_lineas` es igual a 1 + contactos + conversaciones + mensajes.</li></ul> | La salida `HECHO`, y `stat -c %a /dev/shm/portal-historial/vinculos.ndjson`, que da `600` | **1 · Repetir 4.6, sin limpiar, que no duplica.** El cargador reconoce lo cargado por `dtd-portal:`, por `dtd_hilo` y por `source_id`, y devuelve los mismos ids. **Aquí no se corre `limpiar.sh`:** con `carga=error` no queda `vinculos.ndjson`, y el preparado sigue ahí. Si la carga entró y falló el traslado (código 1, `error=no_se_pudo_traer_los_vinculos`), también se repite 4.6. **2 · Si se abandona sin restaurar:** `limpiar.sh`. Lo cargado queda sin vincular, y la próxima corrida lo reconoce. **3 · Si la carga quedó mal: la vuelta atrás dirigida, sub-paso 4.6b.** **4 · Último recurso: restaurar el respaldo de Chatwoot de 4.1** (`chatwoot-respaldo-restauracion.md` §3), con el DG y su OK. **El costo:** se lleva también todo lo que entró por WhatsApp e Instagram entre la hora de 4.1 y la restauración. Esa ventana se anota en la evidencia |
| **4.7 · Vincular** | **Escribe en Studio** los vínculos, el `cargado` de cada mensaje y el corte. Todo o nada | `DB=dtd-cargo-db-1 TENANT=<uuid> bash vincular.sh`, **sin pausa después de 4.6** | Código 0. `HECHO contactos=… hilos=… mensajes=…`, con los números del preparado. `HECHO borrado=/dev/shm/portal-historial` | Las líneas `HECHO` | **Si falla, Studio no cambió,** pero `vincular.sh` deja el preparado y los vínculos en `/dev/shm`. Hay dos caminos. **Correr `limpiar.sh` y después repetir desde 4.4.** Sin limpiar, `extraer.sh` se niega (`ya_hay_un_preparado`) y `cargar.sh` también (`ya_hay_vinculos_borrar_con_limpiar`), con código 2. En la repetición, la reserva da el mismo identificador y el cargador reconoce lo cargado. En la repetición, `conversaciones_existentes` es igual a lo cargado antes, y `conversaciones_estado_actualizado` solo puede dar más que 0 si el estado cambió en Studio entre las dos corridas; eso va a la evidencia con su motivo. **O correr `limpiar.sh` y no repetir.** Repetir dentro de la puerta 4 se confirma con el DG |
| **4.8 · Los conteos** | Lee | `controles-studio.sql` otra vez | C-6 y C-7 iguales a 4.2. C-8: `hilos_vinculados` igual a las conversaciones cargadas, y `salida_cargado` igual a los mensajes | La salida | No hace falta |
| **4.9 · El cierre de los archivos** | Lee | `test ! -e /dev/shm/portal-historial && echo vacio` y `docker exec chatwoot-rails-1 sh -c 'test ! -e /dev/shm/portal-historial && test ! -e /tmp/cargar-portal.rb && echo limpio'` | `vacio` y `limpio` | Las dos líneas | Si no da `vacio`, `limpiar.sh`. Si no da `limpio`, `docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb`, y otra vez |
| **4.10 · El log de Postgres de Chatwoot** | **Solo lee.** El cargador previene que la fila llegue al log: dentro de su transacción fija `SET LOCAL log_min_error_statement = 'panic'` y `SET LOCAL log_error_verbosity = 'terse'`, y si no puede, no carga. Lo aprobó el DG; la condición `rolsuper = t` se comprueba antes de la puerta 4. Este paso comprueba que no aparece nada | `SHOW logging_collector` en `chatwoot-postgres-1`. En el intervalo de la carga se cuentan **`Failing row contains`, `DETAIL:` y `STATEMENT:`**, con `grep -c` y sin copiar las líneas. Si `logging_collector` está apagado: `docker logs --since <hora de 4.4> chatwoot-postgres-1 2>&1 \| grep -c -E 'Failing row contains\|DETAIL:\|STATEMENT:'`. Si está encendido, lo mismo sobre los archivos de `log_directory` | **El número es 0,** y el paso termina en «revisado, 0 líneas». **Si no es 0,** se abre el sub-paso 4.10a | «Revisado; N líneas», solo el número | No hace falta |

**Sub-paso 4.6b · ⛔ OK propio · La vuelta atrás dirigida de la carga.** Es la vuelta atrás principal de 4.6 (decisión del DG). **Es un borrado permanente: lo corre Sam. El DG lo prepara y lo ensaya con rollback.**
- **El orden,** acordado entre E5 y el Worker de la 10.5 por medio del Subdirector:
  1. **Chatwoot, en seco (la 2c de E5).** Cuenta lo que va a borrar y comprueba que no haya nada ajeno. Después escribe `/dev/shm/portal-historial/contactos-conservados.ndjson`, en 0600 y solo con ids: los contactos `dtd-portal:` que tienen otra bandeja y por eso no se borran. Lo trae con `docker exec … cat` a un `.parcial` del VPS, que después se renombra.
  2. **Studio (`supabase/cargas/portal-historial-deshacer/`, `deshacer-vinculos.sh` con `MODO=ensayo` primero y `MODO=aplicar` después, del Worker de la 10.5).** Lee ese archivo y deshace los vínculos de la carga, en una transacción. A los contactos conservados les deja su `chatwoot_contact_id`.
  3. **Chatwoot borra (la 2c).** Borra solo las conversaciones, los mensajes y los `contact_inboxes` de la bandeja del portal, y los contactos `dtd-portal:` que no tienen otra bandeja. Recalcula los conservados dentro de su transacción, y **aborta si no son los del archivo.**
- **Lo ajeno, que aborta antes de borrar nada:**
  - un mensaje con `source_id` que no es `dtd:%`;
  - una conversación sin `dtd_hilo`;
  - un `contact_inbox` con `source_id` que no empieza con `dtd-portal:`;
  - el flag `chatwoot_portal` encendido alguna vez.
- **Los comandos:** ‹por confirmar hasta que las dos piezas estén en `main`›.
- **Para seguir:** los conteos de después dan 0 en lo borrado, **salvo los contactos conservados, que son exactamente los del archivo.** C-6 y C-7 quedan iguales a 4.2.
- **La evidencia:** solo conteos.
- **El OK nominal:** «¿Autorizas deshacer la carga P4 en Chatwoot y en Studio, con los conteos de antes y de después?»

**Sub-paso 4.10a · ⛔ OK propio · Limpiar el log de Postgres de Chatwoot.**
- **Es el respaldo de la prevención,** solo para errores que pasen fuera de la transacción del cargador, donde no rige su `SET LOCAL`.
- **Cuándo se abre:** solo si 4.10 contó más de 0 líneas.
- **Por qué pide OK:** borrar líneas o truncar el log de un Postgres de producción es **escribir en producción**.
- **Ojo:** editar el archivo de log de docker (`LogPath`) con el contenedor corriendo **no es seguro**.
- **El procedimiento se define con el DG en el momento,** y aquí no va un comando que se pueda copiar. **Nunca se trunca el log de docker con el contenedor corriendo** sin decidirlo ahí.
- **La evidencia:** cuántas líneas, y que se limpiaron. Nunca las líneas.

**Por qué `conversaciones_estado_actualizado=0` y `conversaciones_existentes=0` en la primera corrida (4.5 y 4.6).**
- En la primera carga de producción, la bandeja del portal no tiene ninguna conversación cargada (`dtd_hilo`), así que no hay nada que reconocer ni que actualizar.
- **Si cualquiera de los dos da más que 0,** ya hubo una carga antes en esa bandeja, o `BANDEJA` apunta a otra. **Ahí se para,** no se sigue con 4.6 y se avisa al DG.
- La actualización de estado, con sus guardas (sin mensajes ajenos, sin asignar y sin `snoozed`), existe solo para repetir la carga después de una vinculación fallida.

**Supresión mientras tanto.** Hasta que exista la pieza aparte, suprimir una ficha incluye borrar en Chatwoot su contacto `dtd-portal:<identificador>` y sus conversaciones de la bandeja del portal.
- **Es un borrado permanente, y lo corre Sam** o alguien con su OK nominal.
- Se registra cuántos y cuándo, sin nombres.

**El OK nominal de la puerta 4:** «¿Autorizas la carga P4 en producción: respaldo, lectura previa, extraer, cargar y vincular seguidas, y los conteos?». Cubre de 4.1 a 4.10, **pero no la 4.10a.**

---

## Puerta 5 · Encender `chatwoot_portal`

| | |
|---|---|
| **Qué lee o escribe** | **Escribe** el flag del tenant, con auditoría |
| **Comando** | **Solo desde el panel:** Studio → Admin → Feature flags → «Conversaciones del portal en Chatwoot», con la **sesión de platform admin de Sam** (policy `feature_flags_platform_admin_update`, de la 0355). **El `update` por SQL en producción queda ⛔** (`chatwoot-portal-encendido.md` §2) |
| **Para seguir** | `select tenant_id, enabled, updated_at from public.feature_flags where key = 'chatwoot_portal';` da `enabled = true` para el tenant. Hay una fila nueva en `entity_audit_log`, con `after_data->>'enabled' = 'true'` |
| **Evidencia** | La hora, la fila de auditoría y la lectura del flag |
| **Vuelta atrás** | El mismo interruptor del panel, en `false` (`chatwoot-portal-encendido.md` §5) |
| **OK nominal** | «¿Autorizas encender `chatwoot_portal` en producción desde el panel?» |

**Sub-paso 5a · ⛔ OK propio · El smoke con un cliente real.**
- **Qué se hace:** un cliente real, que sabe del smoke y lo autoriza, escribe desde el portal.
- **Qué se mira:** que el mensaje llegue a la bandeja y que la respuesta del agente vuelva al portal.
- **Qué se lee:** solo los conteos de la cola (`chatwoot-portal-encendido.md` §2), con su OK.
- **La evidencia:** las horas y los estados, sin el texto.

---

## Anexo · Encender sin el historial (camino corto, sin la carga P4)

> **Sam eligió esperar la carga P4 (2026-11-08). Este anexo no se usa salvo que Sam cambie de decisión.** Su respuesta literal fue «Esperar la carga»: el chat del portal se enciende en producción después de P4, con las cinco puertas. Si alguna vez lo reconsidera, tiene que saber lo que dice el ⚠️ de abajo.

**Había dos caminos:**
- **esperar la carga P4**, con las puertas 1 a 5 de arriba: **es el elegido;**
- o **encender sin el historial**, con este anexo.

**Lo que se pierde con el camino corto:** los hilos y mensajes que ya existen (24 hilos y 73 mensajes según el conteo del 2026-11-07, sin archivados) **no van a Chatwoot.** El cliente los sigue viendo en el portal, pero el agente no los ve en la bandeja.

**⚠️ Este camino cambia una carga P4 posterior:**
- **La puerta 4 se negaría:** al encender, la cola corre y escribe en `chatwoot_portal_salida`. La 4.3 exige que la cola nunca haya corrido y que el flag nunca se haya encendido, así que la carga P4 se niega tal como está escrita.
- **Parte del historial no se cargaría nunca:** un hilo que la cola vincula, porque el cliente escribió después del encendido, ya no se carga (`chatwoot_portal_carga_hilos` excluye los hilos con vínculo). Su historial anterior al corte no llega a Chatwoot.
- **La carga P4 de después pediría un rediseño** (lo decide el DG), por esos dos motivos y por la regla de la cola de la 0524, que acota a los hilos sin vínculo.

**El orden:** E.1 → E.2 → E.3 → E.4 → E.5 → E.6.
- Cada paso tiene su OK nominal de Sam. Un OK no cubre el siguiente.
- **Entre E.4 y E.5,** el equipo responde los hilos del portal desde Studio, como hoy.
- **Desde E.5,** Studio queda en solo lectura para los hilos del portal (la 1c-1), y el equipo responde desde la bandeja de Chatwoot.

### E.1 · La bandeja de la cuenta 1

| | |
|---|---|
| **Qué lee o escribe** | **Antes, lee** los conteos de administradores y agentes de la cuenta 1, por rol y sin nombres. **Después, escribe en el Chatwoot vivo:** crea la bandeja |
| **Comando** | **Conteo:** `docker exec -i chatwoot-rails-1 bundle exec rails runner 'a = Account.find(1); puts "HECHO administradores=#{a.account_users.administrator.count} agentes=#{a.account_users.agent.count}"'`. **China:** el DG le lleva el conteo a Sam, y **Sam verifica en el panel, con su sesión**, que ninguno sea del equipo de China. El DG no usa el navegador con la sesión de Sam. **La bandeja:** panel de la cuenta 1 → Ajustes → Bandejas → Nueva → canal **API**, **sin `webhook_url`**, sin saludo, sin asignación automática y sin encuesta. Los miembros son el usuario de servicio de E10 y solo agentes de Venezuela (E10-D36). **Después:** `… rails runner 'puts "HECHO miembros=#{Inbox.find(<id>).inbox_members.count}"'` |
| **Para seguir** | 0 del equipo de China, la bandeja sin `webhook_url` y los miembros que el DG espera |
| **Evidencia** | Los conteos, «verificado por Sam, 0 del equipo de China» con la hora, y el id de la bandeja. Sin nombres |
| **Vuelta atrás** | Borrar la bandeja desde el panel, mientras no tenga conversaciones |
| **OK nominal** | «¿Autorizas crear la bandeja "Conversaciones del portal" en la cuenta 1 de Chatwoot, con la verificación de administradores?» |

### E.2 · Las variables de la web y recrearla

| | |
|---|---|
| **Qué lee o escribe** | **Escribe** `/srv/dtd-cargo/.env` y recrea `dtd-cargo-web-1` |
| **Comando** | Las variables `CHATWOOT_INBOX_PORTAL_ID` (de E.1), `CHATWOOT_ROUTER_TOKEN`, `CHATWOOT_ACCOUNT_ID=1`, `CHATWOOT_TENANT_ID` y `CHATWOOT_URL`. **No se imprimen:** solo el nombre y el largo, o un sha256 corto. Después, `cd /srv/dtd-cargo && docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web`, el comando de `publicar-web.sh` medido por el DG. Va sin `--force-recreate`: compose recrea si cambió el `.env` |
| **Para seguir** | `docker inspect -f '{{.Created}}' dtd-cargo-web-1` da una hora nueva (**si no cambió, se para**). La web queda healthy, y la tarjeta «Portal → Chatwoot» de `/studio/bandeja` muestra la bandeja |
| **Evidencia** | Los nombres y largos de las variables, el `Created` de antes y el de después |
| **Vuelta atrás** | Vaciar `CHATWOOT_INBOX_PORTAL_ID` y correr el mismo `up -d --no-deps web` |
| **OK nominal** | «¿Autorizas poner las variables de Chatwoot en la web de producción y recrear el contenedor?» |

### E.3 · El webhook de la cuenta 1, con `message_created`

| | |
|---|---|
| **Qué lee o escribe** | **Lee:** el webhook de E2, que ya existe. **Escribe** solo si le falta `message_created` |
| **Comando** | En el panel de la cuenta 1 → Ajustes → Integraciones → Webhooks: que la URL termine en `/api/chatwoot/webhook` y que esté marcado `message_created` |
| **Para seguir** | La URL y la suscripción, y la salud del webhook en Studio en verde |
| **Evidencia** | «URL termina en `/api/chatwoot/webhook`, `message_created` marcado», sin la URL completa |
| **Vuelta atrás** | Si se agregó `message_created`, quitarlo |
| **OK nominal** | Mirarlo no pide OK. Si hay que agregar `message_created`: «¿Autorizas agregar `message_created` al webhook de la cuenta 1?» |

### E.4 · El corte en `now()`

**Sin corte, la cola no manda nada.** Con el corte en `now()`, la cola manda solo lo que el cliente escriba desde ese momento, nada viejo.

**No hay RPC para fijarlo sin la carga:** solo lo fija `chatwoot_portal_vincular_carga` (0523 y 0524). Por eso este paso es una escritura por SQL en producción.

| | |
|---|---|
| **Qué lee o escribe** | **Lee** el corte actual. **Escribe** una fila en `chatwoot_portal_estado`, como superusuario `postgres` y sin auditoría D1 |
| **Comando** | **Lectura:** `docker exec -i dtd-cargo-db-1 psql -X -q -At -U postgres -d postgres -c "select corte from public.chatwoot_portal_estado where tenant_id = '<tenant>';"`. **Si ya hay corte, se anota y no se toca.** Si no hay, la escritura de `chatwoot-portal-encendido.md` §2, que no pisa uno que exista: `insert into public.chatwoot_portal_estado (tenant_id, corte) values ('<tenant>', pg_catalog.now()) on conflict (tenant_id) do update set corte = excluded.corte, updated_at = pg_catalog.now() where public.chatwoot_portal_estado.corte is null returning tenant_id, corte;` |
| **Para seguir** | Devuelve una fila, con el corte de ahora. Si no devuelve ninguna, el corte ya existía y quedó igual |
| **Evidencia** | El corte de antes y el de después, y quién lo corrió y a qué hora |
| **Vuelta atrás** | `update public.chatwoot_portal_estado set corte = null, updated_at = pg_catalog.now() where tenant_id = '<tenant>';`, con el mismo OK y **antes de E.5**. Después de encender, mover el corte cambia qué mensajes salen |
| **OK nominal** | «¿Autorizas fijar el corte de la cola del portal en este momento, en producción, por SQL?» |

### E.5 · Encender `chatwoot_portal` desde el panel

| | |
|---|---|
| **Qué lee o escribe** | **Escribe** el flag del tenant, con auditoría en `entity_audit_log` |
| **Comando** | Studio → Admin → Feature flags → «Conversaciones del portal en Chatwoot», con la **sesión de platform admin de Sam**. **El `update` por SQL en producción queda ⛔** |
| **Para seguir** | `select enabled from public.feature_flags where tenant_id = '<tenant>' and key = 'chatwoot_portal';` da `true`. Hay una fila nueva en `entity_audit_log` con `after_data->>'enabled' = 'true'` |
| **Evidencia** | La hora, la fila de auditoría y la lectura del flag |
| **Vuelta atrás** | El mismo interruptor, en `false` (`chatwoot-portal-encendido.md` §5) |
| **OK nominal** | «¿Autorizas encender `chatwoot_portal` en producción desde el panel?» |

### E.6 · El smoke con un cliente real

| | |
|---|---|
| **Qué lee o escribe** | **Lee:** los conteos de la cola (`chatwoot-portal-encendido.md` §2). El cliente escribe en el portal: no es una escritura del DG |
| **Comando** | Un cliente real, que sabe del smoke y lo autoriza, escribe desde el portal. Se mira que el mensaje llegue a la bandeja, y que la respuesta del agente vuelva al portal. Después, los conteos de la cola por estado |
| **Para seguir** | El mensaje llega a la bandeja, la respuesta vuelve al portal, y la cola queda con el mensaje `enviado` y 0 atascados |
| **Evidencia** | Las horas y los estados, sin el texto |
| **Vuelta atrás** | Apagar el flag (E.5) |
| **OK nominal** | «¿Autorizas el smoke con un cliente real, y leer los conteos de la cola?» |


---

## Datos personales · `revisar-datos-ve` sobre este runbook

Es una revisión con el método de `.claude/skills/revisar-datos-ve/SKILL.md`. **No es asesoría legal.**

| Qué | Dónde vive | Cuánto | Estado |
|---|---|---|---|
| **El nombre de la ficha** (`clients.name`) y **el texto de los mensajes** del portal | Puerta 1: la copia efímera. Puerta 4: `preparado.ndjson` en `/dev/shm/portal-historial` y, al final, Chatwoot de la cuenta 1 | Unos 24 clientes y 73 mensajes, según el conteo del 2026-11-07 | **CORRECTO (diseño):** es la finalidad del chat de Soporte, y la carga no agrega campos |
| **Teléfono, correo, cédula, RIF, Shipping Mark y `author_name`** | No salen: ni la extracción (la 0523 y la 0524) ni el cargador los llevan. La 1b manda `clients` sin ellos y con el `markbox` sintético | — | **CORRECTO** en la extracción. **NO VERIFICABLE** en la copia hasta la lista de la 2b, con su prueba y sus mutantes |
| **WhatsApp e Instagram de la cuenta 1** (contactos con teléfono, conversaciones y textos), y los secretos de Chatwoot (`hmac_token`, la URL real de los webhooks, los tokens) | La 1a filtra la cuenta y la bandeja, va sin `content`, y lleva sintéticos los nombres, los correos y la URL | — | **Diseño cerrado** (`0586-p4-2b-columnas-copia-studio.md`); **NO VERIFICABLE** hasta que la 2b esté en `main` |
| **Los archivos temporales** | Solo en tmpfs (`/dev/shm`), con 0700 y 0600. Nunca en disco ni en Git | — | **CORRECTO** en los scripts de `main`: la prueba de los `.sh` cubre el `-O`, el `! -L` y el nombre fijo. **NO VERIFICABLE** en la copia del ensayo hasta la 2b |
| **Las salidas y la evidencia** | Solo `HECHO`, con conteos y md5 | — | **CORRECTO** |
| **El log de Postgres de Chatwoot,** si un `insert_all` falla | Registra la fila completa | — | **ENCONTRADO, con procedimiento:** se revisa en 4.10 y se limpia en 4.10a, que tiene su OK y está por definir con el DG |
| **El equipo de China** como administrador de la cuenta 1 (PIPL) | El panel de Chatwoot | — | **NO VERIFICABLE desde el repo:** se verifica en la puerta 2 |
| **La supresión de una ficha** | No llega a Chatwoot | — | **ENCONTRADO:** es manual, un borrado permanente que corre Sam, mientras no exista la pieza aparte |

**Fuera de alcance, para el abogado:** si el aviso de `/privacidad` del 8 de noviembre cubre los mensajes anteriores a esa fecha, leído como aviso de un tratamiento que sigue.

**Segunda opinión:** se sugiere que otro modelo revise este runbook.

## Lo que falta confirmar

- **Las listas de tablas y columnas de la 1a y la 1b,** con su prueba: las cierra la 2b.
- **Los comandos de 4.6b:** salen de la pieza de E5, en Chatwoot, y de la del Worker de la 10.5, en Studio.
- **El procedimiento de 4.10a:** se define con el DG.
- **Los argumentos del respaldo externo a S3.**

## De dónde sale cada cosa

- **El guion y las condiciones:** la spec 0586 §10.5.10, las revisiones de la #455 y la #456, y la 0524.
- **`cargar.sh`, la copia y el ensayo:** E5, en `0586-p4-runbook-seccion-e5.md` y `0586-p4-2b-columnas-copia-studio.md`, en las notas compartidas.
- **Lo medido en el VPS:** el DG, el 2026-11-08, comunicado por el Subdirector.
- **El encendido y los conteos de la cola:** `chatwoot-portal-encendido.md`.
- **Los scripts:** `infra/ops/portal-historial/`. Su README apunta aquí.
