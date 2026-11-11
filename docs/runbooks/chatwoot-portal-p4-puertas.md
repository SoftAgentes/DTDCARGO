# Runbook · La carga P4 del chat del portal a Chatwoot y el encendido: las cinco puertas (SDD-0586 §10.5.10)

> Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del DG comunicado por el Subdirector de Chatwoot. Las partes de `cargar.sh`, de la copia y del ensayo son de E5, adaptadas a este formato. **E5 revisó la puerta 3 y los pasos 4.5 a 4.7, y dio su visto bueno** (2026-11-08).
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
| La 0508, la 0519, la 0520, la 0521, la 0523 y la 0524 aplicadas en producción | En el ledger `supabase_migrations.schema_migrations` (`aplicar-migraciones-prod.md:26`), dentro de `dtd-cargo-db-1`: `select name from supabase_migrations.schema_migrations where name in ('0508_chatwoot_bajas_purga', '0519_chatwoot_portal', '0520_chatwoot_portal_vuelta', '0521_chatwoot_portal_estado', '0523_chatwoot_portal_carga', '0524_chatwoot_portal_puerta4');`. Tiene que dar seis filas |
| La #462, la #463 y la #464 en `main`: el `grant` de `vincular.sh`, y el `-O` con el `! -L` de `extraer.sh` | `git log origin/main` incluye el merge del tren 6 |
| `cargar.sh` y `cargar-portal.rb` en `main` (desde la #455 y la #461), y la PR 2b de E5: `ensayo-portal.sh` y las listas de columnas con su prueba | `git log origin/main` |
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
- `AGENTE_SERVICIO`, el usuario de Chatwoot que firma los salientes sin vínculo de agente. **Es el usuario de servicio de E10** (el del `CHATWOOT_ROUTER_TOKEN`), y tiene que ser de la cuenta 1, porque si no el cargador se niega. Su id se lee en la puerta 2, dentro de su OK.

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
- **Quién tiene root en el VPS mientras corre el ensayo:** Medido por el DG el 2026-11-09 ~02:10Z: root solo por la clave del DG; agentes aislados sin /srv/ops ni docker; consola del proveedor fuera de alcance.
  - **El detalle:**
    - solo `root` tiene uid 0, y entra solo por clave, sin contraseña;
    - `ubuntu` tiene sudo y 0 claves, y no entra con contraseña (`passwordauthentication no`, medido por el DG);
    - las cuentas de agentes tienen `ForceCommand` y `NoNewPrivileges`, sin grupos, y no llegan a `/srv/ops` (root:root 700) ni a docker;
    - `orca-*` no tiene sudo ni docker.
  - **Si eso cambia antes del ensayo**, el DG lo vuelve a medir. Si alguien del equipo de China tuviera root, aplicaría la PIPL a la copia (revisión `revisar-datos-ve` de la 2b), y la puerta 1 no sigue hasta que el DG lo resuelva con Sam.
- **Producción** se mide antes y después, y tiene que quedar sin cambios (P0, P2 y P3 del ensayo: P0 es la foto de antes, y P2 y P3 son Studio y Chatwoot después. P1 es la prueba que levanta las copias, no una foto de producción).
- **El `trap`** borra la copia también si algo falla, y sale con 4 si no puede terminar la limpieza.
- **Cómo se prueba el borrado:**
  - `HECHO limpieza=contenedores=0,volumenes=0,redes=0`, `HECHO limpieza_carpetas=ausente,ausente` y `HECHO limpieza_completa=si` (medido en `main`, en `b5669b1a5`);
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
| **Evidencia** | `HECHO` con las filas por tabla y el md5 de la lista de columnas. Sin datos de personas |
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
| **Evidencia** | `HECHO` con las filas por tabla y el md5 de la lista de columnas. Sin datos de personas |
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
| **Comando, el id de `AGENTE_SERVICIO`** | Solo lectura: `docker exec -i chatwoot-rails-1 bundle exec rails runner 'u = User.find_by(email: "<correo del usuario de servicio>"); puts "HECHO agente_servicio=#{u&.id} en_cuenta=#{u && AccountUser.exists?(account_id: 1, user_id: u.id)}"'`. El correo no va a la evidencia, solo el id y `en_cuenta=true` |
| **Para seguir** | 0 del equipo de China **entre los administradores y entre los agentes de la cuenta 1**: los dos conteos de la lectura, y es la condición de la #455. Además, la bandeja sin `webhook_url`, los miembros que el DG espera, y `AGENTE_SERVICIO` con `en_cuenta=true` |
| **Evidencia** | `/srv/ops/evidencias/p4-bandeja-<UTC>/`: los conteos, «verificado, 0 del equipo de China», el id de la bandeja y su configuración, sin nombres |
| **Vuelta atrás** | Borrar la bandeja desde el panel, mientras no tenga conversaciones. Si ya las tiene, la de la puerta 4 |
| **OK nominal** | «¿Autorizas crear la bandeja "Conversaciones del portal" en la cuenta 1 de Chatwoot, con la verificación de que ningún administrador ni agente de la cuenta 1 es del equipo de China, y la lectura del id del usuario de servicio?» |

---

## Puerta 3 · El ensayo, en la copia efímera

> **La PR 2b de E5 es la #473, en `main` desde `b5669b1a5` (tren #487).** El guion copia las guardas de `kommo-historial/ensayo-archivo.sh`. Las citas de su código son de `main` en `b5669b1a5`.

**Sub-paso 3.0 · ⛔ OK propio · Crear `/srv/ops/portal-historial` y poner los scripts.**
- **El punto de partida,** medido en el VPS por el DG: `/srv/ops/portal-historial` no existe, y `/srv/ops/kommo-historial` sí.
- **Qué escribe, todo en el VPS:**
  1. crea `/srv/ops/portal-historial/` y copia ahí, **por nombre**, los scripts de la lista de abajo, sin `README.md` ni `pruebas/`;
  2. crea `/srv/ops/portal-historial/migraciones/` con `install -d -m 700` y copia ahí las 10 migraciones con un `scp` aparte;
  3. copia `deshacer-vinculos.sql` y `deshacer-vinculos.sh`, de `supabase/cargas/portal-historial-deshacer/`, con su propio `scp`;
  4. deja el `system_identifier` de producción en `sistema-produccion`, root 0600, sin imprimirlo;
  5. al final, deja todo sin permisos de grupo ni de otros con `chmod -R go-rwx`.

  Ninguna otra cosa se escribe en el VPS. El OK cubre los cinco pasos.
- **Desde dónde se copia:** desde un checkout limpio de `main` en el SHA que se anota, nunca desde una carpeta con archivos sin seguimiento. Los `ssh` y `scp` de este 3.0 se corren **dentro de esa carpeta** (`cd ../portal-3-0`); su creación, abajo, y su cierre, al final, **desde la carpeta del repo**:

  ```bash
  git fetch origin && git worktree add --detach ../portal-3-0 origin/main
  ```

  ```bash
  git -C ../portal-3-0 rev-parse HEAD && git -C ../portal-3-0 status --porcelain --ignored | wc -l
  ```

  El primero da el SHA que va en la evidencia, y el segundo tiene que dar `0`. El checkout se cierra en este mismo paso, al final (debajo).
- **La lista que se compara por sha256:**
  - `extraer.sh`, `vincular.sh`, `limpiar.sh`, `reservar.sql`, `extraer.sql` y `controles-studio.sql`;
  - `conteo-portal.sql` (4.2) y `cola-y-flag.sql` (4.3), las dos lecturas de la puerta 4;
  - `cargar.sh` y `cargar-portal.rb`, que ya están en `main` desde la #455 y la #461;
  - de la 2b (#473, en `main` desde `b5669b1a5`): `ensayo-portal.sh`, `copia-columnas.tsv` y `ensayo-studio-esquema.sql`, en `/srv/ops/portal-historial/`;
  - **las 10 migraciones que exige la guarda G0 de `ensayo-portal.sh`**, copiadas de `supabase/migrations/` a `/srv/ops/portal-historial/migraciones/`. Esa carpeta es el valor por defecto de la variable `MIGRACIONES` del guion, y la copia del esquema las aplica con `\i` desde `ensayo-studio-esquema.sql`, montadas en solo lectura. La G0, `MIGRACIONES` y el montaje son de la #473. Las 10 migraciones sí están en `main`. Son estas:
    - `supabase/migrations/0006_clients.sql`
    - `supabase/migrations/0106_conversaciones.sql`
    - `supabase/migrations/0337_feature_flags_seed_and_trigger.sql`
    - `supabase/migrations/0503_chatwoot_bandeja.sql`
    - `supabase/migrations/0504_chatwoot_eventos.sql`
    - `supabase/migrations/0508_chatwoot_bajas_purga.sql`
    - `supabase/migrations/0519_chatwoot_portal.sql`
    - `supabase/migrations/0520_chatwoot_portal_vuelta.sql`
    - `supabase/migrations/0523_chatwoot_portal_carga.sql`
    - `supabase/migrations/0524_chatwoot_portal_puerta4.sql`;
  - de la 2c (#478) ‹por confirmar hasta que la #478 esté en `main`›: `deshacer.sh` y `deshacer-carga.rb`. Se copian por nombre con su propio `scp` (debajo), y van en esta misma lista, con su sha256, bajo el mismo OK;
  - en Studio, desde `supabase/cargas/portal-historial-deshacer/`: `deshacer-vinculos.sql` y `deshacer-vinculos.sh`, que van a la misma carpeta del VPS con su propio `scp` (debajo) y su sha256.
  - **La lista crece con cada PR,** y se escribe aquí cuando entra en `main`.
  - **No se copian** `README.md` ni `pruebas/`: la copia va por nombre, y en el VPS queda solo lo de esta lista.
- **Comando, la carpeta y los scripts, por nombre** (nunca `scp -r`, que se llevaría `README.md` y `pruebas/`). El `chmod` va al final, después de las migraciones.

  ```bash
  ssh root@217.216.54.70 install -d -m 700 /srv/ops/portal-historial
  ```

  ```bash
  scp infra/ops/portal-historial/extraer.sh infra/ops/portal-historial/vincular.sh infra/ops/portal-historial/limpiar.sh infra/ops/portal-historial/reservar.sql infra/ops/portal-historial/extraer.sql infra/ops/portal-historial/controles-studio.sql infra/ops/portal-historial/conteo-portal.sql infra/ops/portal-historial/cola-y-flag.sql infra/ops/portal-historial/cargar.sh infra/ops/portal-historial/cargar-portal.rb root@217.216.54.70:/srv/ops/portal-historial/
  ```

  Los tres del ensayo, de la #473 (en `main` desde `b5669b1a5`), en el mismo destino:

  ```bash
  scp infra/ops/portal-historial/ensayo-portal.sh infra/ops/portal-historial/copia-columnas.tsv infra/ops/portal-historial/ensayo-studio-esquema.sql root@217.216.54.70:/srv/ops/portal-historial/
  ```

  ‹por confirmar hasta que la #478 esté en `main`›, los dos de la 2c:

  ```bash
  scp infra/ops/portal-historial/deshacer.sh infra/ops/portal-historial/deshacer-carga.rb root@217.216.54.70:/srv/ops/portal-historial/
  ```
- **Las migraciones, con un comando aparte:**

  ```bash
  ssh root@217.216.54.70 install -d -m 700 /srv/ops/portal-historial/migraciones
  ```

  ```bash
  scp supabase/migrations/0006_clients.sql supabase/migrations/0106_conversaciones.sql supabase/migrations/0337_feature_flags_seed_and_trigger.sql supabase/migrations/0503_chatwoot_bandeja.sql supabase/migrations/0504_chatwoot_eventos.sql supabase/migrations/0508_chatwoot_bajas_purga.sql supabase/migrations/0519_chatwoot_portal.sql supabase/migrations/0520_chatwoot_portal_vuelta.sql supabase/migrations/0523_chatwoot_portal_carga.sql supabase/migrations/0524_chatwoot_portal_puerta4.sql root@217.216.54.70:/srv/ops/portal-historial/migraciones/
  ```

  Sus sha256 se comparan con `git show origin/main:supabase/migrations/<archivo> | sha256sum`.
- **Los dos archivos de deshacer, con su propio comando:**

  ```bash
  scp supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh root@217.216.54.70:/srv/ops/portal-historial/
  ```

- **El archivo de `SISTEMA`** (‹por confirmar hasta que la #480 esté en `main`›): en el VPS, el DG lee el `system_identifier` de producción una sola vez, sin imprimirlo, y lo deja en `/srv/ops/portal-historial/sistema-produccion`, root 0600.

  ```bash
  ssh root@217.216.54.70 "umask 077; docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'select system_identifier from pg_control_system()' | tr -d '\n' > /srv/ops/portal-historial/sistema-produccion.parcial && chmod 0600 /srv/ops/portal-historial/sistema-produccion.parcial && mv -f /srv/ops/portal-historial/sistema-produccion.parcial /srv/ops/portal-historial/sistema-produccion"
  ```

  **El archivo tiene que traer solo las cifras.** `tr -d '\n'` quita el salto de línea final, y no puede quedar ningún otro carácter: ni CR ni espacios. Solo así da lo mismo que la fórmula del DG, `printf '%s' "$v" | sha256sum | cut -c1-10`. Se comprueba sin imprimir el valor; tiene que dar `solo_cifras`:

  ```bash
  ssh root@217.216.54.70 'grep -qxE "[0-9]+" /srv/ops/portal-historial/sistema-produccion && echo solo_cifras || echo no_son_solo_cifras'
  ```

  Su sha corto, con la fórmula del DG; tiene que dar `b4fbe1b236`:

  ```bash
  ssh root@217.216.54.70 'v=$(cat /srv/ops/portal-historial/sistema-produccion); printf "%s" "$v" | sha256sum | cut -c1-10'
  ```

  **Si no da `b4fbe1b236`, o si no dio `solo_cifras`, se PARA y se borra el archivo.** No se sigue con el 3.0, y se avisa al DG:

  ```bash
  ssh root@217.216.54.70 rm -f /srv/ops/portal-historial/sistema-produccion
  ```

- **Al final, los permisos de todo lo copiado:**

  ```bash
  ssh root@217.216.54.70 chmod -R go-rwx /srv/ops/portal-historial
  ```
- **El cierre del checkout limpio,** después del `scp` y de comparar los sha256, en la PC del DG. **Se corre desde la carpeta del repo,** la misma desde la que se creó, y nunca desde adentro de `../portal-3-0`: desde adentro, en Windows, sale con 255 y la carpeta queda.

  ```bash
  git worktree remove ../portal-3-0
  ```

  ```bash
  test ! -e ../portal-3-0 && echo borrado
  ```

- **Para seguir:** el `sha256sum` de cada archivo de la lista en el VPS es igual al de `git show origin/main:<ruta> | sha256sum`, con `<ruta>` bajo `infra/ops/portal-historial/`, `supabase/migrations/` o `supabase/cargas/portal-historial-deshacer/`. Además, `stat -c %a` da `700` en `/srv/ops/portal-historial` y en `migraciones/`. En `migraciones/` están las 10. `ssh root@217.216.54.70 ls -A /srv/ops/portal-historial` lista solo los archivos de la lista, `migraciones/` y `sistema-produccion`, sin `README.md` ni `pruebas/`. El sha corto de `sistema-produccion` dio `b4fbe1b236`. `find /srv/ops/portal-historial -perm /077 | wc -l` da `0`: ningún archivo ni carpeta con permisos de grupo u otros. Al final, `git worktree list` ya no muestra `portal-3-0`, y `test ! -e ../portal-3-0 && echo borrado` da `borrado`.
- **Lo que el CI no puede probar y se comprueba a mano en el VPS antes de 3.1:**
  - **La unidad de systemd del ensayo tiene `TimeoutStopSec` de 300 s o más.** La guarda G1 se niega con menos (`TIMEOUT_STOP_MIN_S=300` en `ensayo-portal.sh`).
  - **Los nombres reales de producción** son los valores por defecto del guion: `dtd-cargo-db-1` (Studio), `chatwoot-postgres-1` (Chatwoot) y `/srv/chatwoot`. Si alguno no coincide, se para y se avisa al DG; no se cambia por una variable sin su OK.
  - **Están las 10 migraciones** en `/srv/ops/portal-historial/migraciones/`. **Si falta alguna, la G0 se niega** y el ensayo no arranca.
  - **Están los cuatro inicializadores de Rails que la G0 también exige,** en `$CHATWOOT_DIR/rails/` (por defecto `/srv/chatwoot/rails/`): `zz_dtd_redaccion_logs.rb`, `zz_dtd_proteccion_register.rb`, `zz_dtd_revocar_sesiones.rb` y `zz_dtd_correo.rb`. **Si falta alguno, la G0 se niega.** Se comprueba con `ls`, sin abrirlos.
- **La evidencia:** las dos listas de sha256 y el SHA de `main` del checkout limpio.
- **La vuelta atrás:** se borra todo lo que copió el 3.0, **menos `deshacer/`**. **Borra también `sistema-produccion`:** su valor es de este 3.0, y si se repite el 3.0 se vuelve a leer y a comparar con `b4fbe1b236`.

  ```bash
  ssh root@217.216.54.70 'find /srv/ops/portal-historial -mindepth 1 -maxdepth 1 ! -name deshacer -exec rm -r -- {} +'
  ```

  Si después no queda `deshacer/`, la carpeta vacía también se quita: `ssh root@217.216.54.70 rmdir /srv/ops/portal-historial`. Si queda, se deja.

  **`deshacer/` no se borra aquí.** Es la copia durable del 4.6b, y sale solo con `limpiar.sh --cierre-4-6b` o con `limpiar.sh --abandono-4-6b` ‹por confirmar hasta que la #480 esté en `main`›. Si no existe, no hay nada que cuidar.
- **OK nominal:** «¿Autorizas crear `/srv/ops/portal-historial` en el VPS y copiar ahí, desde un checkout limpio de `main` en el SHA <SHA>, los scripts de `infra/ops/portal-historial/` (los de la lista de arriba, cada uno con su sha256), las 10 migraciones en `migraciones/` y `deshacer-vinculos.sql` y `deshacer-vinculos.sh`, todos copiados por nombre y comparados por sha256, sin `README.md` ni `pruebas/`; dejar el `system_identifier` de producción en `sistema-produccion`, root 0600, sin imprimirlo y con su sha corto comparado con la nota del DG; y dejarlo todo sin permisos de grupo ni de otros? No se escribe nada más en el VPS.»

### 3.1 · Correr el ensayo

| | |
|---|---|
| **Qué lee o escribe** | **Usa la copia de la puerta 1** (la 1a y la 1b). **Escribe solo en la copia efímera,** con red interna, en tmpfs y con la marca de la copia. **En producción no escribe nada.** **Además, en el VPS escribe:**<ul><li>la evidencia `HECHO` en `/srv/ops/portal-historial/`;</li><li>las imágenes de los contenedores de la copia: `chatwoot/chatwoot:v4.19.1-ce`, `pgvector/pgvector:0.8.1-pg16` y `redis:7.2.11-alpine`, fijadas por digest, y `postgres:17`, sin digest (medido en `main`, en `b5669b1a5`);</li><li>la unidad transitoria de systemd del ensayo.</li></ul> |
| **Comando** | **Las entradas:** `TENANT=<uuid>`, `CUENTA=1`, `BANDEJA=<id de la puerta 2>` y `AGENTE_SERVICIO=<id>`. `bash /srv/ops/portal-historial/ensayo-portal.sh`, con las opciones de la 2b. **El ensayo no corre si `/dev/shm/portal-historial` ya existe,** para no pisar una carga real a medias, ni al revés. **Se niega con `DB_CW=chatwoot-rails-1`** o con cualquier contenedor que no sea de la copia: es una guarda de la 2b, con su mutante. Corre como unidad de systemd con su `TimeoutStopSec`, igual que el ensayo del Archivo Kommo. En la copia corre `extraer.sh`; `cargar.sh` con `MODO=seco` y después con `MODO=cargar`; `vincular.sh`; y `controles-studio.sql` antes y después |
| **Para seguir** | <ul><li>el ensayo sale con 0;</li><li>`HECHO limpieza_completa=si`;</li><li>`HECHO unidad` no es `ninguna`: corrió como unidad de systemd;</li><li>salen en `PASÓ` todas las comprobaciones del ensayo, y ninguna en `FALLÓ` (la lista, debajo de esta tabla);</li><li>C-6 y C-7 dan igual antes y después;</li><li>C-8 trae un espejo por hilo vinculado;</li><li>`conversaciones_estado_actualizado=0`;</li><li>la limpieza deja 0 contenedores, 0 volúmenes y 0 redes;</li><li>producción sigue igual (P0, P2 y P3);</li><li>**la evidencia dice que `DB_CW` era el contenedor de la copia, con su nombre y su red interna;**</li><li>**al terminar, `test ! -e /dev/shm/portal-historial && echo vacio`.**</li><li>**si el ensayo murió por KILL o sin que corriera su `trap`** (la unidad terminó por `SIGKILL`, o no salió la línea `HECHO ensayo_codigo`): no se sigue hasta correr `ensayo-portal.sh --limpiar` y repetir la prueba de borrado. Esa prueba es 0 contenedores, 0 volúmenes y 0 redes del proyecto del ensayo, más el `test ! -e` de arriba.</li></ul>**Los casos provocados:**<ul><li>(a) un `vinculos.ndjson` con un mensaje menos, que da 22023 sin escribir;</li><li>(B1) `contacto_id` nulo y `source_id` vacío a la vez, que da 22023, «id de contacto inválido»;</li><li>(B2) solo el `source_id` vacío, que da 22023, «falta el source_id del contacto»;</li><li>(c) después de (a), repetir desde la extracción: no queda nada doble en Chatwoot, y en Studio queda un solo corte.</li></ul> |
| **Evidencia** | Las líneas `HECHO` con conteos y md5, sin datos de personas, y `HECHO ensayo_codigo=0`. **El DG la recibe antes de la puerta 4** |
| **Vuelta atrás** | Borrar la copia con `ensayo-portal.sh --limpiar` y hacer la prueba de borrado. **Nunca `--limpiar` durante la puerta 4,** mientras en `/dev/shm/portal-historial` está la carga real. El guion lo cuida: un `--limpiar` sin un ensayo que limpiar no toca `/dev/shm/portal-historial` (medido en `main`, en `b5669b1a5`). Aun así, no se corre en la puerta 4. **El código 6** (`ensayo-portal.sh` en `main` desde `b5669b1a5`, `:131-141`): un `--limpiar` con Docker sin responder no borra nada, tampoco `/dev/shm/portal-historial`, y deja `HECHO error=docker_no_responde` y `HECHO ensayo_codigo=6`. **Con el código 6 no se sigue:** apenas Docker vuelva a responder, se corre `ensayo-portal.sh --limpiar` otra vez y la prueba de borrado, antes de cualquier otro paso. **Si el ensayo murió por KILL, el `trap` no corrió:** las copias siguen en tmpfs, dentro de contenedores vivos, hasta el `--limpiar` o un reinicio. Por eso el `--limpiar` y la prueba de borrado van siempre antes de cualquier otro paso (revisión `revisar-datos-ve` de la 2b). En producción no hay nada que deshacer |
| **OK nominal** | «¿Autorizas correr el ensayo de la carga P4 en la copia efímera, con su evidencia en `/srv/ops/portal-historial/`, las imágenes de la copia y una unidad transitoria de systemd?» |

**3.1 · Qué mide el ensayo, qué se comprueba aparte y qué queda solo declarado.** Los ids son los que imprime `ensayo-portal.sh`, por ejemplo `PASÓ  V10 — C-10: …`. Se midieron en `main`, en `b5669b1a5`. Los C-1 a C-14 son los de la spec 0586 §10.5.10.

- **Lo mide el ensayo, sobre las copias:**
  - `P0`, `P2` y `P3`: la foto de producción antes, y Studio y Chatwoot de producción iguales después.
  - `A1` a `A7`: el aislamiento. La red es `internal`, los contenedores están solo en ella, sin puertos y con nombres propios, ninguno está en una red de producción, no llegan a los contenedores de producción y no salen a internet.
  - `S1` y `S2`: el esquema de las dos copias.
  - `D2`: los datos copiados con la lista.
  - `O1`: ninguna otra cuenta ni otro tenant en las copias.
  - `E0`: los contenedores son los de la copia.
  - `E1`: el seco no escribe, no encola, no deja trabajos ni correos, y hay 0 conversaciones existentes y 0 actualizadas.
  - `E2`: la carga trae lo mismo que el seco (conversaciones, mensajes y contactos), la secuencia avanza eso, no deja trabajos ni correos, y los vínculos quedan en 0600. Es C-2 en conteos, C-5 dentro de la copia y la primera mitad de C-9.
  - `V10`: **una parte de C-10**, los contactos de la bandeja sin teléfono ni correo, y 0 huérfanos.
  - `V12`: C-12, el orden de los mensajes de cada hilo, igual al del preparado.
  - `V13`: **una parte de C-13**, el estado de cada conversación, igual al del preparado. Ahí los archivados van `resolved`.
  - `CA`, `B1` y `B2`: los casos provocados (a), (B1) y (B2). Vincular se niega y Studio no cambia.
  - `C1`, `C2` y `C3`: (c), repetir desde la extracción. No entra nada nuevo, queda un solo corte y no hay nada doble en Chatwoot. Es C-3.
  - `K1`, `K2` y `K3`: C-6, C-7 y C-8, con `controles-studio.sql` antes y después.
- **Se comprueba aparte, y dónde:**
  - **C-1, los conteos de Studio:** con `conteo-portal.sql`, en producción, en 4.2.
  - **C-10, «uno por cliente», y C-13, «los archivados con su nota», además de la nota por hilo archivado de C-2:** en el contrato de la 0523 (`supabase/tests/`), que prueba la reserva estable, los estados y la nota del archivado. **El ensayo no los mide.**
- **Queda solo declarado:** ni el ensayo ni un contrato lo miden.
  - **C-4, los webhooks a Studio durante la carga.** En la copia no hay un Studio que los reciba (`A1` a `A7`), y el ensayo no mira el log del proxy. Lo declara la carga, que usa `insert_all` sin callbacks.
  - **C-5 en producción,** las filas nuevas en `outbox_push_events` de Studio. El ensayo mide trabajos y correos solo en la copia.
  - **La segunda mitad de C-9,** «una conversación creada después no choca».
  - **C-11, lo que ya había en Chatwoot.** En la primera carga la bandeja está vacía (`E1` exige 0 conversaciones existentes), así que no hay nada que comparar.
  - **C-14, el panel y la búsqueda.** La copia no tiene panel.

---

## Puerta 4 · Producción

**Antes de la puerta 4** (condición del DG, 2026-11-08): **las dos vueltas atrás dirigidas, la de Studio (`supabase/cargas/portal-historial-deshacer/`) y la de Chatwoot (la pieza de E5), en `main` y ensayadas** por el DG con `rollback`. No hace falta para las puertas 1 a 3. Sin ellas, el DG no le pide a Sam la puerta 4.

**Y, antes de la puerta 4, la prevención del log** (aprobada por el DG, 2026-11-08). Son dos condiciones, y sin las dos la puerta no sigue:
- **El cargador tiene la prevención en `main`:** `SET LOCAL log_min_error_statement = 'panic'` y `SET LOCAL log_error_verbosity = 'terse'` dentro de su transacción, y no carga si no puede fijarlos. **Confirmada:** entró con la #470, en el tren 9 (#476, `e74cde6fc`). El run verde del árbol de `main` es el 42542272642, sobre `0b749ac74`, cuyo árbol es idéntico al de `e74cde6fc`, con L1 a L3 y M35 a M38 en PASÓ. En `cargar-portal.rb`, `bajar_detalle_del_log!` fija con `SET LOCAL`, dentro de la transacción, los dos valores de `DETALLE_DEL_LOG`. Después los lee de vuelta con `SHOW`, y si no coinciden no carga. Se puede volver a comprobar con `git show origin/main:infra/ops/portal-historial/cargar-portal.rb`, buscando `log_min_error_statement`.
- **El rol de Rails es superusuario,** porque esos dos parámetros lo piden. En `chatwoot-postgres-1`: `docker exec -i chatwoot-postgres-1 psql -X -At -v ON_ERROR_STOP=1 -U chatwoot -c 'SELECT rolsuper FROM pg_roles WHERE rolname = current_user'`. **Tiene que dar `t`;** si da `f`, la puerta no sigue. El DG midió `t` el 2026-11-08.

**Todo seguido, el mismo día y con el DG, con `chatwoot_portal` apagado.** Se corre en el VPS como root, desde `/srv/ops/portal-historial/` (3.0).

**Entre la foto (4.4) y el encendido (puerta 5), el equipo no responde desde Studio.** La cola solo manda entrantes, y lo que el equipo escriba ahí no llegaría a Chatwoot. Se cruza con la 1c-4, el modo de respaldo.

| Paso | Qué lee o escribe | Comando | Para seguir | Evidencia | Vuelta atrás |
|---|---|---|---|---|---|
| **4.1 · Respaldo** | Escribe dos respaldos, cifrados con age, en el VPS y en B2, y anota la **hora de 4.1**. Se corren antes de 4.2 | **Studio:** `/srv/dtd-cargo/backup.sh`. Envuelve `pg-dump-to-s3.sh`, que sube a B2 aunque el nombre diga S3, y `config-backup.sh`. Deja el dump cifrado en `/srv/backups/dtd-cargo/` y lo sube a `b2:dtdcargo-respaldos/db`. **Chatwoot:** `systemctl start chatwoot-respaldo.service && tail -n 20 /var/log/chatwoot-respaldo.log`. Su `ExecStart` es `/srv/chatwoot/respaldo.sh --dir /srv/chatwoot --out /srv/backups/chatwoot`, y sube a `b2:dtdcargo-respaldos/chatwoot`. Lo midió el DG el 2026-11-09 hacia las 04:55Z, sin leer credenciales. **El plan de recuperación es este respaldo propio, externo en B2 (Backblaze) y cifrado con age.** El Auto Backup de Contabo no cuenta mientras su restauración esté degradada: Contabo avisa de problemas de rendimiento en US-east, como vio el DG el 2026-11-09 | **Cada uno sale con 0,** y su archivo local tiene una fecha posterior al inicio de la ventana. Los dos se pueden leer | El nombre, el tamaño y el sha256 de cada uno, y la hora | No hace falta |
| **4.2 · Lectura previa** | Lee | `docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> -U postgres -d postgres -f - < controles-studio.sql` (C-6, C-7 y C-8). Y el conteo de la spec 0586 §10.5.10, con md5 `a5da12512b23b4662678e6eb5926c632`: `docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> -U postgres -d postgres -f - < conteo-portal.sql`. **Sin `ON_ERROR_STOP`, psql sale con 0 aunque fallen todas las consultas** | Sale con 0 | La salida, con conteos y md5 | No hace falta |
| **4.3 · La cola nunca corrió y el flag nunca se encendió** | Lee | `docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> -U postgres -d postgres -f - < cola-y-flag.sql`, con el archivo `infra/ops/portal-historial/cola-y-flag.sql`. Imprime una sola línea HECHO, descrita debajo de esta tabla. Su prueba, sobre el esquema real, es `lib/studio/__tests__/portal-historial-lecturas.test.ts`. La auditoría está en `entity_audit_log`: la escribe `append_audit_event` (`0289:890-910`), y la columna `after_data` es de la `0267:306`. **`audit_d1_operations.result_data` guarda solo `{entity_id}` (`0289:654`)** | **`cola_y_flag=ok`, que exige las cuatro juntas: `salida=0`, `flag_encendido=0`, `encendidos_auditados=0` y `corte=nulo`.** Un `UPDATE` por SQL no deja auditoría, por eso no basta con mirar `entity_audit_log`. **Si alguna no da, no se extrae y se le avisa al DG** | La salida | No hace falta |
| **4.4 · Extraer** | **Escribe** la reserva en Studio, y deja `preparado.ndjson` en `/dev/shm/portal-historial` (0600) | `DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> bash extraer.sh` | Código 0, `HECHO reservados=…` y `HECHO lineas=…` | Las líneas `HECHO` | `limpiar.sh`. La reserva no se deshace: una repetición la reusa |
| **4.5 · Cargar en seco** | **Lee** el preparado, por la entrada estándar de `docker exec -i` y sin copiarlo al contenedor, y la base de Chatwoot. **No escribe nada en Chatwoot:** solo copia el `.rb` a `/tmp/cargar-portal.rb` y crea `/dev/shm/portal-historial` en el contenedor, y el `trap` borra las dos cosas | `DB_CW=chatwoot-rails-1 CUENTA=1 BANDEJA=<id> AGENTE_SERVICIO=<id> MODO=seco bash cargar.sh` | <ul><li>código 0, `carga=ok` y `contenedor_limpio=si`;</li><li>`leidas` es igual a la cabecera del preparado;</li><li>**`conversaciones_existentes` y `conversaciones_estado_actualizado` no aparecen, o dan 0;**</li><li>`secuencia` no avanza (`X->X`);</li><li>`trabajos_nuevos=ninguno` y `correos_enviados=0`;</li><li>**en la primera corrida, con la bandeja vacía, los números son exactos:** `contactos_nuevos`, `conversaciones_nuevas` y `mensajes_nuevos` son los del preparado, y `notas_nuevas`, los hilos archivados. Si algo no coincide, había algo antes en la bandeja, y se para.</li></ul> | La salida entera, solo con `HECHO` | No hace falta. Si da `contenedor_limpio=no` (código 4): `docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb`, y se comprueba como en 4.9 |
| **4.6 · Cargar** | **Escribe en Chatwoot,** con `insert_all` y sin callbacks: <ul><li>los contactos `dtd-portal:<identificador>`, sin teléfono ni correo;</li><li>sus `contact_inbox`, con `pubsub_token`;</li><li>las conversaciones y los mensajes;</li><li>la nota de cada hilo archivado.</li></ul>Toma un candado: no corren dos cargas a la vez. **En el VPS** deja `vinculos.ndjson` (0600, solo ids), que trae con `docker exec … cat` | El de 4.5, con `MODO=cargar` | <ul><li>código 0, `carga=ok` y `contenedor_limpio=si`;</li><li>`*_nuevos` es igual a lo que dijo el seco;</li><li>`conversaciones_existentes` y `conversaciones_estado_actualizado` siguen sin aparecer;</li><li>`secuencia` avanza exactamente `conversaciones_nuevas`;</li><li>`trabajos_nuevos=ninguno` y `correos_enviados=0`;</li><li>`vinculos_lineas` es igual a 1 + contactos + conversaciones + mensajes.</li></ul> | La salida `HECHO`, y `stat -c %a /dev/shm/portal-historial/vinculos.ndjson`, que da `600` | **1 · Repetir 4.6, sin limpiar, que no duplica.** El cargador reconoce lo cargado por `dtd-portal:`, por `dtd_hilo` y por `source_id`, y devuelve los mismos ids. **Aquí no se corre `limpiar.sh`:** con `carga=error` no queda `vinculos.ndjson`, y el preparado sigue ahí. Si la carga entró y falló el traslado (código 1, `error=no_se_pudo_traer_los_vinculos`), también se repite 4.6. **2 · Si se abandona sin restaurar:** `limpiar.sh`. Lo cargado queda sin vincular, y la próxima corrida lo reconoce. **3 · Si la carga quedó mal: la vuelta atrás dirigida, sub-paso 4.6b.** **4 · Último recurso: restaurar el respaldo de Chatwoot de 4.1** (`chatwoot-respaldo-restauracion.md` §3), con el DG y su OK. **El costo:** se lleva también todo lo que entró por WhatsApp e Instagram entre la hora de 4.1 y la restauración. Esa ventana se anota en la evidencia |
| **4.7 · Vincular** | **Escribe en Studio** los vínculos, el `cargado` de cada mensaje y el corte. Todo o nada | `DB=dtd-cargo-db-1 TENANT=<uuid> bash vincular.sh`, **sin pausa después de 4.6** | Código 0. `HECHO contactos=… hilos=… mensajes=…`, con los números del preparado. `HECHO borrado=/dev/shm/portal-historial` | Las líneas `HECHO` | **Si falla, Studio no cambió,** pero `vincular.sh` deja el preparado y los vínculos en `/dev/shm`. Hay dos caminos. **Correr `limpiar.sh` y después repetir desde 4.4.** Sin limpiar, `extraer.sh` se niega (`ya_hay_un_preparado`) y `cargar.sh` también (`ya_hay_vinculos_borrar_con_limpiar`), con código 2. En la repetición, la reserva da el mismo identificador y el cargador reconoce lo cargado. En la repetición, `conversaciones_existentes` es igual a lo cargado antes, y `conversaciones_estado_actualizado` solo puede dar más que 0 si el estado cambió en Studio entre las dos corridas; eso va a la evidencia con su motivo. **O correr `limpiar.sh` y no repetir.** Repetir dentro de la puerta 4 se confirma con el DG |
| **4.8 · Los conteos** | Lee | `docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> -U postgres -d postgres -f - < controles-studio.sql`, otra vez | C-6 y C-7 iguales a 4.2. C-8: `hilos_vinculados` igual a las conversaciones cargadas, y `salida_cargado` igual a los mensajes | La salida | No hace falta |
| **4.9 · El cierre de los archivos** | Lee | `test ! -e /dev/shm/portal-historial && echo vacio` y `docker exec chatwoot-rails-1 sh -c 'test ! -e /dev/shm/portal-historial && test ! -e /tmp/cargar-portal.rb && echo limpio'` | `vacio` y `limpio` | Las dos líneas | Si no da `vacio`, `limpiar.sh`. Si no da `limpio`, `docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb`, y otra vez |
| **4.10 · El log de Postgres de Chatwoot** | **Solo lee.** El cargador previene que la fila llegue al log con sus `SET LOCAL`, en `main` desde la #470, y las dos condiciones se comprueban antes de la puerta 4. Este paso comprueba que no aparece nada | Ver el bloque «4.10, el conteo del log», debajo de esta tabla. Cuenta **`Failing row`, `DETAIL:  Key` y `STATEMENT:  INSERT`** en el intervalo de la carga, con `grep -c` y sin copiar las líneas | **El número es 0,** y el paso termina en «revisado, 0 líneas». **El sub-paso 4.10a se abre solo si 4.6 dio `carga=error` y el conteo da más de 0** en la ventana. Con `carga=ok` no se abre aunque haya líneas: esas son errores ajenos a la carga | «Revisado; N líneas», solo el número | No hace falta |

**4.3, la cola y el flag:** el SQL está en `infra/ops/portal-historial/cola-y-flag.sql`. Imprime una sola línea:

```text
HECHO salida=N flag_encendido=N encendidos_auditados=N corte=fijado|nulo cola_y_flag=ok|NO
```

Para seguir, tiene que decir `cola_y_flag=ok`. Es solo lectura (`begin transaction read only` … `rollback`) y no imprime la hora del corte, solo si está fijado o es nulo. **4.2** usa `infra/ops/portal-historial/conteo-portal.sql`, que es el bloque literal de la spec 0586 §10.5.10 con md5 `a5da12512b23b4662678e6eb5926c632`. Antes de correrlo se comprueba ese md5. Los dos se suben al VPS en 3.0.

**4.10, el conteo del log.** Va fuera de la tabla a propósito: dentro de una celda, el `|` tiene que ir escapado, y al copiar el texto crudo ese `\|` quedaría como un pipe literal. El `grep` contaría 0 y daría un falso «revisado» (observación de E5).

```bash
# 1. Dónde escribe Postgres su log.
docker exec -i chatwoot-postgres-1 psql -X -At -U chatwoot -c 'SHOW logging_collector'

# 2, caso «off»: el log es la salida del contenedor. Se cuentan las líneas desde la hora de 4.4, sin copiarlas.
# El patrón es el del DG: Postgres pone dos espacios después de «DETAIL:» y de «STATEMENT:», de ahí el « +».
docker logs --since <hora de 4.4, en UTC> chatwoot-postgres-1 2>&1 | grep -c -E 'Failing row|DETAIL: +Key|STATEMENT: +INSERT'

# 2, caso «on»: los archivos de log_directory dentro de PGDATA, en el intervalo de la carga.
docker exec -i chatwoot-postgres-1 sh -c 'cat "$PGDATA/$(psql -X -At -U chatwoot -c "SHOW log_directory")"/*' | grep -c -E 'Failing row|DETAIL: +Key|STATEMENT: +INSERT'
```

El número tiene que ser 0. Va a la evidencia solo el número. **El caso «on» supone que `log_directory` es relativo a `PGDATA`,** que es lo de serie (`log`). Si `SHOW log_directory` da una ruta absoluta, se usa esa. **Ojo con el caso «on»:** cuenta todo lo que hay en esos archivos, no solo el intervalo de la carga. Si da más que 0, antes de abrir el 4.10a se mira la hora de las líneas, sin copiarlas.

**Sub-paso 4.6b · ⛔ OK propio · La vuelta atrás dirigida de la carga.** Es la vuelta atrás principal de 4.6 (decisión del DG). **Es un borrado permanente: lo corre Sam. El DG lo prepara y lo ensaya con rollback.**
- **El orden lo imponen los archivos `.hecho`** (secuencia aprobada por el DG el 2026-11-09, escrita por E5 y revisada por el Subdirector). Cada paso exige la salida 0 del anterior y su `.hecho`, y **se niega si falta la evidencia** o si no trae el mismo sha256 del `.ndjson` y el mismo tenant. Las piezas son la 2c de E5 (`deshacer.sh`, ‹por confirmar hasta que la #478 esté en `main`›) y el desarme y el cierre del Worker de la 10.5 (`deshacer-vinculos.sh` y `limpiar.sh --cierre-4-6b`, ‹por confirmar hasta que la #480 esté en `main`›).
- **Los archivos** van en `/dev/shm/portal-historial/`, en 0600, escritos con `.parcial` + `mv`. Cada `.hecho` es una línea `HECHO <paso>=ok conservados_sha256=<64 hex> tenant=<uuid> …`; los de Chatwoot llevan además `cuenta` y `bandeja`. Solo llevan ids, uuid seudónimos y hashes.
- **La copia durable** (la opción (a) de Sam, «si protegidos»): `/srv/ops/portal-historial/deshacer/`, root 0700, archivos 0600. **La crea el paso 3:** antes de borrar, el `.ndjson`, `chatwoot-seco.hecho` y `studio-ensayo.hecho`; después del borrado, `chatwoot-borrar.hecho`. **El paso 4 le agrega `studio-aplicar.hecho`,** para que el 5 sobreviva a un reinicio entre el 4 y el 5. **Nada antes del paso 3 toca el disco** (decisión del DG). **Si el VPS se reinicia entre el 3 y el 4,** el tmpfs se pierde y el paso 4 usa la copia durable, con el mismo sha256. El paso 5 borra las dos.
  - **El plazo, una regla del DG:** si el paso 4 no corre dentro de las 24 h siguientes al paso 3, el DG avisa a Sam y deciden juntos si reintentar el 4 o cerrar. El plazo empieza en el `utc=` de `chatwoot-borrar.hecho`. **La copia durable nunca se borra sin que el 4 haya salido con 0.**
  - **Los respaldos,** medidos por el DG el 2026-11-09 hacia las 04:30Z:
    - los respaldos programados del VPS no incluyen `/srv/ops/portal-historial/`: `dtd-cargo-backup` y `config-backup.sh` respaldan la base, el `.env` y `db-config`, y `chatwoot-respaldo` respalda el dump y `/app/storage`;
    - **el Auto Backup de Contabo está activado** (Sam: «Sí, está activado»), así que la copia durable también queda ahí hasta que caduque;
    - es un riesgo que ya existía, sin aumento material: ese respaldo es del disco entero y ya contiene las bases de producción con los datos reales, y la copia solo agrega uuid seudónimos e ids que ya están en ellas;
    - **la retención del Auto Backup de Contabo:** NO VERIFICABLE desde el VPS.

| Paso | Quién | Qué hace | Qué exige | Si falla |
|---|---|---|---|---|
| **1 · El seco de Chatwoot** (‹por confirmar hasta que la #478 esté en `main`›) | El DG: no borra | Cuenta lo que se borraría, comprueba que no haya nada ajeno y escribe `contactos-conservados.ndjson` (los contactos `dtd-portal:` con otra bandeja, que no se borran) y `chatwoot-seco.hecho` | En Studio, en solo lectura (`deshacer.sh` de la #478, en `e64bfef65`, `:191-196`): que el tenant tenga la fila del flag `chatwoot_portal`; que no esté encendido ni se haya encendido alguna vez (`feature_flags` y `entity_audit_log`); que la cola no haya corrido (ninguna salida que no sea `cargado`); que haya hilos vinculados; y que todos sus espejos sean de esta bandeja. Si no lo puede comprobar, no corre. En Chatwoot, que no haya nada ajeno (debajo) | No cambió nada. Se corre `limpiar.sh` y se repite |
| **1b · El ensayo de Chatwoot, opcional** (‹por confirmar hasta que la #478 esté en `main`›) | El DG, **solo antes del paso 3** | Hace todo y termina en ROLLBACK; no escribe `.hecho` | El `.ndjson` del paso 1 y la misma guarda de Studio del paso 1. **Después del paso 3 se niega:** si en la durable hay `chatwoot-borrar.hecho` o `chatwoot-borrar.inicio`, o en tmpfs un `chatwoot-borrar.hecho`, sale con `ya_hay_un_borrado_en_la_copia_durable` y no borra nada (`deshacer.sh` en `e64bfef65`, `:134-137`) | No cambió nada |
| **2 · El ensayo de Studio** (‹por confirmar hasta que la #480 esté en `main`›) | El DG: rollback | Lee el `.ndjson`, ensaya el desarme y escribe `studio-ensayo.hecho`, solo en tmpfs | `chatwoot-seco.hecho` con el mismo sha256, el tenant, la cuenta y la bandeja | No cambió nada. Se repite |
| **3 · El borrado de Chatwoot** (‹por confirmar hasta que la #478 esté en `main`›) | **Sam:** borrado permanente | Deja la copia durable, escribe ahí `chatwoot-borrar.inicio` antes de abrir su transacción, recalcula los conservados, borra y escribe `chatwoot-borrar.hecho` en las dos copias. El `.inicio` se queda al lado del `.hecho` (`deshacer.sh` en `e64bfef65`, `:231`) | Los dos `.hecho` en `=ok`, el mismo sha256 en los dos y en el `sha256sum` actual del `.ndjson`, y el mismo tenant. Que no haya ya un borrado: ni `chatwoot-borrar.hecho` ni `chatwoot-borrar.inicio` en la durable (`:134-137`). **El ensayo de Studio con `entorno=produccion`:** si no, sale con `el_ensayo_de_studio_no_es_de_produccion` (`:218`). **La huella `SISTEMA` de Studio** (debajo, `:220-227`), antes de escribir nada: un ensayo sobre una copia no habilita borrar Chatwoot de producción | Con un ROLLBACK comprobado, retira el `.inicio` y Chatwoot queda igual: se repite el 3. Si queda `.inicio` sin `.hecho`, ver «`chatwoot-borrar.inicio` sin `chatwoot-borrar.hecho`», debajo |
| **4 · Studio aplica** (‹por confirmar hasta que la #480 esté en `main`›) | **Sam:** borrado permanente | Desarma los vínculos y escribe `studio-aplicar.hecho` en tmpfs y en la durable | `chatwoot-seco.hecho`, `studio-ensayo.hecho` (el mismo `entorno`) y `chatwoot-borrar.hecho` (`fin=commit`), con el mismo sha256 y el mismo tenant, y los de Chatwoot con la misma cuenta y bandeja. Usa la copia de tmpfs, o la durable si falta; si las dos están y no son iguales, se niega | Chatwoot ya está vacío y Studio sigue vinculado, sin daño con el flag apagado. **Se repite el 4 con el mismo `.ndjson`, sin volver a correr Chatwoot.** **Regla del DG: `chatwoot_portal` no se enciende hasta que el 4 salga con 0** |
| **5 · El cierre** (‹por confirmar hasta que la #480 esté en `main`›) | **Sam** | Borra el `.ndjson` y los `.hecho` de las dos carpetas y comprueba que no quedó ninguna | `studio-aplicar.hecho` con `fin=commit`, en tmpfs o en la durable, y el sha256 del `.ndjson` que quede | Se repite el 5 |

- **Lo ajeno, que aborta antes de borrar nada:**
  - un mensaje con `source_id` que no es `dtd:%`;
  - una conversación sin `dtd_hilo`;
  - un `contact_inbox` con `source_id` que no empieza con `dtd-portal:`;
  - el flag `chatwoot_portal` encendido alguna vez.
- **Antes del ensayo, la comprobación previa de la guarda de entorno de Studio:**
  - **Lo medido por el DG el 2026-11-08,** que es solo metadata: en producción y en prueba, `postgres` tiene `rolsuper = f`, pero **`pg_control_system()` y `pg_db_role_setting` sí se pueden leer**. Así, la guarda de entorno del desarme funciona sin cambios.
  - **El comando:** `docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'select system_identifier is not null from pg_control_system()'`. **Tiene que dar `t`.** No se imprime el identificador.
  - **Si da 42501, se para:** sin esa lectura, el desarme aborta en `produccion`.
- **Los comandos,** en el VPS como root. Los conteos `ESPERADOS_*` salen de la lectura de 4.2. Los de Chatwoot (pasos 1, 1b y 3) son los de la cabecera de `deshacer.sh` de la #478 ‹por confirmar hasta que la #478 esté en `main`›, con los cinco valores. Ni `DB_CW` ni `DB` tienen valor por defecto (`deshacer.sh` de la #478 en `e64bfef65`, `:52`). Si falta `DB`, `deshacer.sh` se niega con `falta_db` (`:96`), y `deshacer-vinculos.sh` también se niega (`:44`). Si falta `DB_CW`, `deshacer.sh` se niega con `falta_db_cw` (`:98`). Sin `DB`, `DB_CW`, `TENANT`, `CUENTA` o `BANDEJA` sale con 2. **Antes de copiar, se comparan con la cabecera del `deshacer.sh` que quedó en el VPS en 3.0.** El paso 3 es el borrado permanente de Sam: se corre tal como está escrito.

  **`SISTEMA`** (aprobado por el DG; `deshacer-vinculos.sh` de la #480 en `1e2c94b93` y `deshacer.sh` de la #478 en `e64bfef65`, ‹por confirmar hasta que las dos estén en `main`›): **no se lee en la shell de Sam ni va en el comando.**
  - **Lo leen los pasos 2 y 4, en `produccion`, y el paso 3,** de `/srv/ops/portal-historial/sistema-produccion`, el archivo que deja el 3.0. Si llega `SISTEMA=` por el entorno, se niegan con `sistema_va_en_el_archivo_no_en_el_entorno`.
  - **El archivo:** tiene que ser root 0600, uid 0, de este usuario y sin enlace, y traer solo cifras. Si no:
    - `sin_archivo_de_sistema_0600`, si falta, no es un archivo, es un enlace o no está en 0600;
    - `archivo_de_sistema_no_es_de_root`, si no es de uid 0;
    - `archivo_de_sistema_no_es_un_numero`, si trae otra cosa que cifras.
  - **Lo que imprimen:** solo `HECHO sistema_sha256_corto=<10>`, con la fórmula del DG: `printf '%s'` sin salto de línea, `sha256sum` y los 10 primeros caracteres. El valor entra a psql por la entrada (`\set sistema`), no por un argumento que se vea en `ps`.
  - **El sha corto, antes de psql:** si no es `b4fbe1b236`, los tres se niegan con `sistema_no_es_el_de_produccion` y salen con 2. `deshacer.sh` imprime además `HECHO sistema_esperado=b4fbe1b236`.
  - **La base misma, en el paso 3:** `deshacer.sh` compara el valor con el `pg_control_system()` de la base de Studio (`DB`) e imprime `HECHO studio_es_produccion=si`. Si no es la de producción, se niega con `la_base_de_studio_no_es_la_de_produccion` y sale con 1. Todo esto pasa antes de la copia durable y del `.inicio`, así que, si se niega, no escribió nada.
  - **Para seguir, en el paso 2, en el 3 y otra vez en el 4:** el sha corto que imprime cada uno es el de la nota de control del DG, `b4fbe1b236` en producción y `76ebba046a` en prueba. Se compara contra esa nota, fuera del VPS, y no solo contra la evidencia del VPS. Si no coincide, se para.
  - El valor nunca se imprime ni entra en Git; en la evidencia, en `/srv/ops/evidencias` (root 0700, archivos 0600), va solo el sha corto.
  - `limpiar.sh --cierre-4-6b` y `--abandono-4-6b` borran el archivo y escriben `HECHO sistema=borrado`.

  Paso 1, el DG (‹por confirmar hasta que la #478 esté en `main`›):

  ```bash
  DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=seco bash /srv/ops/portal-historial/deshacer.sh
  ```

  Paso 1b, opcional, el DG (‹por confirmar hasta que la #478 esté en `main`›):

  ```bash
  DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=borrar CONFIRMAR=no bash /srv/ops/portal-historial/deshacer.sh
  ```

  Paso 2, el DG (‹por confirmar hasta que la #480 esté en `main`›):

  ```bash
  DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> ESPERADOS_SALIDA=<n> ESPERADOS_HILOS=<n> ESPERADOS_CONTACTOS=<n> ESPERADOS_ESPEJO=<n> ENTORNO=produccion MODO=ensayo bash /srv/ops/portal-historial/deshacer-vinculos.sh
  ```

  Paso 3, Sam (‹por confirmar hasta que la #478 esté en `main`›):

  ```bash
  DB_CW=chatwoot-rails-1 DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> MODO=borrar CONFIRMAR=si bash /srv/ops/portal-historial/deshacer.sh
  ```

  Paso 4, Sam (‹por confirmar hasta que la #480 esté en `main`›):

  ```bash
  DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> ESPERADOS_SALIDA=<n> ESPERADOS_HILOS=<n> ESPERADOS_CONTACTOS=<n> ESPERADOS_ESPEJO=<n> ENTORNO=produccion MODO=aplicar bash /srv/ops/portal-historial/deshacer-vinculos.sh
  ```

  Después del 4, la comprobación del flag, en solo lectura. Tiene que dar `flag_encendido=0` y `encendidos_auditados=0`:

  ```bash
  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant=<uuid> -U postgres -d postgres -f - < /srv/ops/portal-historial/cola-y-flag.sql
  ```

  Paso 5, Sam (‹por confirmar hasta que la #480 esté en `main`›):

  ```bash
  bash /srv/ops/portal-historial/limpiar.sh --cierre-4-6b
  ```

  `limpiar.sh` sin opción sigue siendo para abandonar una carga: borra solo tmpfs y no toca la durable.

  **Si el paso 4 confirmó pero no quedó `studio-aplicar.hecho`** (un corte entre su COMMIT y la escritura): `--cierre-4-6b` se niega. Para salir:
  1. **El DG comprueba en solo lectura** que Studio quedó desarmado, con los conteos del desarme del tenant:
     - salidas `cargado`, hilos y espejos: los tres en 0;
     - contactos con `chatwoot_contact_id`: **exactamente los conservados**, el `contactos` de la cabecera del `.ndjson`. El desarme no les quita el id; no dan 0.
  2. **Con el OK nominal de Sam,** se repite el paso 4 con `ESPERADOS_SALIDA=0 ESPERADOS_HILOS=0 ESPERADOS_CONTACTOS=<contactos de la cabecera del .ndjson> ESPERADOS_ESPEJO=0`. No borra nada, porque ya no queda qué. Reescribe el `updated_at` de `chatwoot_portal_estado`, y escribe `studio-aplicar.hecho` en las dos carpetas. Si un conteo no da lo esperado, el desarme se niega y se para.
     - **El OK nominal:** «¿Autorizas repetir el paso 4 del 4.6b con los conteos de solo lectura (salidas, hilos y espejos en 0, y los contactos iguales a los conservados de la cabecera), para que quede `studio-aplicar.hecho`? No borra nada; solo reescribe el `updated_at` del estado del portal.»
  3. Después, el paso 5.

  **Si en la durable hay `chatwoot-borrar.inicio` sin `chatwoot-borrar.hecho`:** el paso 3 empezó y no se sabe si confirmó; pudo haber un corte entre el COMMIT y el `.hecho`. Mientras tanto, `deshacer.sh` se niega a correr otro `MODO=borrar` (`ya_hay_un_borrado_en_la_copia_durable`), y `limpiar.sh --abandono-4-6b` se niega del todo (`borrado_de_chatwoot_empezado_ver_runbook`) y no toca nada. Los comandos son los de E5, para `deshacer.sh` de la #478 en `e64bfef6533e504d5543016ab109059f115d5262` (‹por confirmar hasta que la #478 esté en `main`›).

  **1. La comprobación de solo lectura, que corre el DG.** Lee la bandeja del portal en Chatwoot y compara el sha256 del `.ndjson` de la durable con el del `.inicio`. Saca solo conteos y hashes:

  ```bash
  D=/srv/ops/portal-historial/deshacer
  echo "sha_ndjson=$(sha256sum "$D/contactos-conservados.ndjson" | cut -c1-64)"
  echo "sha_inicio=$(sed -n 's/.* conservados_sha256=\([^ ]*\).*/\1/p' "$D/chatwoot-borrar.inicio")"
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' chatwoot-postgres-1 \
    psql -X -q -At -v ON_ERROR_STOP=1 -U chatwoot -d chatwoot_production -v bandeja=<BANDEJA> -f - <<'SQL'
  select 'bandeja=conversaciones:' || (select count(*) from public.conversations where inbox_id = :bandeja)
    || ',mensajes:' || (select count(*) from public.messages where inbox_id = :bandeja)
    || ',contact_inboxes:' || (select count(*) from public.contact_inboxes where inbox_id = :bandeja);
  SQL
  ```

  **Cómo se lee:**
  - **`sha_ndjson` distinto de `sha_inicio`:** se para y se avisa al DG. La durable no es la de ese borrado.
  - **`bandeja=conversaciones:0,mensajes:0,contact_inboxes:0`:** el COMMIT pasó. Hay que cerrar el `.hecho`: es el camino A.
  - **La bandeja con los mismos conteos del seco:** el borrado no confirmó. Los conteos del seco están en la línea `HECHO antes=` de la salida del paso 1, que va en su evidencia; `chatwoot-seco.hecho` no la trae. Hay que retirar el `.inicio`: es el camino B.
  - **Otra cosa:** se para y se avisa al DG. El borrado es atómico, así que una bandeja a medias no es de este guion.

  **2. Lo que corre Sam después, con su OK nominal, según lo que salió.**

  **Camino A: el COMMIT pasó.** Se escribe `chatwoot-borrar.hecho` en la durable, y también en `/dev/shm/portal-historial` si todavía existe, con el formato del paso 3. Después se sigue con el paso 4.

  ```bash
  D=/srv/ops/portal-historial/deshacer
  S="$(sha256sum "$D/contactos-conservados.ndjson" | cut -c1-64)"
  L="HECHO chatwoot_borrar=ok conservados_sha256=$S tenant=<TENANT> cuenta=1 bandeja=<BANDEJA> fin=commit utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for d in "$D" /dev/shm/portal-historial; do
    [ -d "$d" ] || continue
    ( umask 077; printf '%s\n' "$L" >"$d/chatwoot-borrar.hecho.parcial" ) && mv -f -- "$d/chatwoot-borrar.hecho.parcial" "$d/chatwoot-borrar.hecho"
  done
  ```

  **Camino B: el borrado no confirmó.** Se retira el `.inicio` de la durable. Después se repite el paso 3 (`MODO=borrar CONFIRMAR=si`), con los mismos `.hecho` del 1 y del 2. **Si el VPS se reinició,** el tmpfs está vacío y el paso 3 no los encuentra: se repiten antes el paso 1 y el paso 2.

  ```bash
  rm -f -- /srv/ops/portal-historial/deshacer/chatwoot-borrar.inicio
  ```

  **La evidencia:** solo la salida de la comprobación, con conteos y hashes, y cuál de los dos caminos se tomó.

  **Los OK nominales:**
  - **Camino A:** «¿Autorizas escribir `chatwoot-borrar.hecho` en la copia durable, con la bandeja del portal vacía según la comprobación de solo lectura, para seguir con el paso 4?»
  - **Camino B:** «¿Autorizas retirar `chatwoot-borrar.inicio` de la copia durable, con la bandeja del portal igual a la del seco, y repetir el paso 3?»

  **Si el 4.6b se abandona antes de que el paso 3 confirme** (el 3 falló, o no se corrió), Sam corre el abandono (‹por confirmar hasta que la #480 esté en `main`›). Borra las dos carpetas **solo si no hay `chatwoot-borrar.hecho`** en ninguna **ni `chatwoot-borrar.inicio`** en la durable. Con el `.hecho`, Chatwoot ya borró: se niega con `chatwoot_ya_borro_hay_que_terminar_el_paso_4`, y hay que terminar el 4. Con el `.inicio`, se niega con `borrado_de_chatwoot_empezado_ver_runbook`: ver «`chatwoot-borrar.inicio` sin `chatwoot-borrar.hecho`».

  ```bash
  bash /srv/ops/portal-historial/limpiar.sh --abandono-4-6b
  ```

  Para seguir: `HECHO abandono_4_6b=ok tmpfs=vacio durable=vacio`.
- **Para seguir:** cada paso sale con 0 y deja su `HECHO … =ok`. Los conteos de después dan 0 en lo borrado, **salvo los contactos conservados, que son exactamente los del archivo.** C-6 y C-7 quedan iguales a 4.2. El flag sigue apagado (`flag_encendido=0`). Al final, `HECHO cierre_4_6b=ok tmpfs=vacio durable=vacio`.
- **La evidencia:** solo conteos.
- **Los OK nominales de Sam,** uno por paso que borra:
  - **Paso 3:** «¿Autorizas borrar de forma permanente, en la cuenta 1 de Chatwoot, las conversaciones, los mensajes y los `contact_inboxes` de la bandeja del portal y los contactos `dtd-portal:` sin otra bandeja, dejando antes la copia durable en `/srv/ops/portal-historial/deshacer/`?»
  - **Paso 4:** «¿Autorizas deshacer de forma permanente en Studio los vínculos de la carga P4, con el mismo `.ndjson` del ensayo y del borrado de Chatwoot?»
  - **Paso 5:** «¿Autorizas borrar el `.ndjson` y los `.hecho` de `/dev/shm/portal-historial/` y de `/srv/ops/portal-historial/deshacer/`, después de que el paso 4 salió con 0?»
  - **El abandono:** «¿Autorizas abandonar la vuelta atrás 4.6b y borrar el `.ndjson` y los `.hecho` de `/dev/shm/portal-historial/` y de `/srv/ops/portal-historial/deshacer/`, sabiendo que el paso 3 no confirmó el borrado en Chatwoot?»
  - Los pasos 1, 1b y 2 los corre el DG sin OK de Sam, porque no borran.

**Sub-paso 4.10a · ⛔ OK propio · Limpiar el log de Postgres de Chatwoot.**
- **Es el respaldo de la prevención,** solo para errores que pasen fuera de la transacción del cargador, donde no rige su `SET LOCAL`.
- **Cuándo se abre:** solo si 4.6 dio `carga=error` **y** 4.10 contó más de 0 líneas en la ventana de la carga. Con `carga=ok` no se abre aunque haya líneas, porque esas son errores ajenos a la carga.
- **Por qué pide OK:** borrar líneas o truncar el log de un Postgres de producción es **escribir en producción**.
- **Ojo:** editar el archivo de log de docker (`LogPath`) con el contenedor corriendo **no es seguro**.
- **El procedimiento se define con el DG en el momento,** y aquí no va un comando que se pueda copiar. **Nunca se trunca el log de docker con el contenedor corriendo** sin decidirlo ahí.
- **La evidencia:** cuántas líneas, y que se limpiaron. Nunca las líneas.

**Por qué `conversaciones_estado_actualizado=0` y `conversaciones_existentes=0` en la primera corrida (4.5 y 4.6).**
- En la primera carga de producción, la bandeja del portal no tiene ninguna conversación cargada (`dtd_hilo`), así que no hay nada que reconocer ni que actualizar.
- **Si cualquiera de los dos da más que 0,** ya hubo una carga antes en esa bandeja, o `BANDEJA` apunta a otra. **Ahí se para,** no se sigue con 4.6 y se avisa al DG.
- La actualización de estado, con sus guardas (sin mensajes ajenos, sin asignar y sin `snoozed`), existe solo para repetir la carga después de una vinculación fallida.

**Supresión mientras tanto.** Hasta que exista la pieza aparte, suprimir una ficha incluye borrar en Chatwoot su contacto `dtd-portal:<identificador>` y sus conversaciones de la bandeja del portal.
- **Es un borrado permanente, y lo corre Sam.**
- Se registra cuántos y cuándo, sin nombres.

**El OK nominal de la puerta 4:** «¿Autorizas la carga P4 en producción: respaldo, lectura previa, extraer, cargar y vincular seguidas, y los conteos?». Cubre de 4.1 a 4.10, **pero no la 4.10a.**

---

## Puerta 5 · Encender `chatwoot_portal`

**Antes de encender, en este orden:** 5a, las variables y la web, y 5b, el webhook. El encendido va después, y 5c, el smoke, al final.

**Sub-paso 5a · ⛔ OK propio · Las variables de la web y recrearla.** Va antes de encender, porque es parte del encendido.
- **Las variables:** `CHATWOOT_INBOX_PORTAL_ID` (el id de la bandeja de la puerta 2), `CHATWOOT_ROUTER_TOKEN`, `CHATWOOT_ACCOUNT_ID=1`, `CHATWOOT_TENANT_ID` y `CHATWOOT_URL`, en `/srv/dtd-cargo/.env`.
  - **No se imprimen:** se anota solo el nombre y el largo, o un sha256 corto.
- **Recrear la web:** `cd /srv/dtd-cargo && docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web`.
  - Es el comando que usa `publicar-web.sh`, medido en el VPS por el DG.
  - **Sin `--force-recreate`:** compose recrea solo si cambió el `.env`.
- **Para seguir:**
  - el contenedor **fue recreado:** `docker inspect -f '{{.Created}}' dtd-cargo-web-1` da una hora nueva. **Si no cambió, se para;**
  - la web queda healthy;
  - la tarjeta «Portal → Chatwoot» de `/studio/bandeja` muestra la bandeja configurada.
- **La vuelta atrás:** vaciar `CHATWOOT_INBOX_PORTAL_ID` y correr el mismo `up -d --no-deps web`. La cola queda en `omitido: "sin_configurar"`.

**Sub-paso 5b · El webhook de la cuenta 1, con `message_created`.** Va antes de encender, igual que la E.3 del anexo.
- **Es el de E2, que ya existe.** En el panel de la cuenta 1 → Ajustes → Integraciones → Webhooks: que la URL termine en `/api/chatwoot/webhook` y que esté marcado `message_created`. **Mirarlo no pide OK.**
- **⛔ Cambiarlo sí pide OK propio.** Si le falta `message_created`, agregarlo es un cambio en el Chatwoot vivo: «¿Autorizas agregar `message_created` al webhook de la cuenta 1?».
- **La evidencia:** «URL termina en `/api/chatwoot/webhook`, `message_created` marcado», sin la URL completa, y la salud del webhook en Studio en verde.

**El encendido:**

| | |
|---|---|
| **Qué lee o escribe** | **Escribe** el flag del tenant, con auditoría |
| **Comando** | **Solo desde el panel:** Studio → Admin → Feature flags → «Conversaciones del portal en Chatwoot», con la **sesión de platform admin de Sam** (policy `feature_flags_platform_admin_update`, de la 0355). **El `update` por SQL en producción queda ⛔** (`chatwoot-portal-encendido.md` §2) |
| **Para seguir** | `select tenant_id, enabled, updated_at from public.feature_flags where key = 'chatwoot_portal';` da `enabled = true` para el tenant. Hay una fila nueva en `entity_audit_log`, con `after_data->>'enabled' = 'true'` |
| **Evidencia** | La hora, la fila de auditoría y la lectura del flag |
| **Vuelta atrás** | El mismo interruptor del panel, en `false` (`chatwoot-portal-encendido.md` §5) |
| **OK nominal** | «¿Autorizas encender `chatwoot_portal` en producción desde el panel?» |

**Sub-paso 5c · ⛔ OK propio · El smoke con un cliente real.** Va después de encender.
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
| **Para seguir** | 0 del equipo de China entre los administradores y entre los agentes de la cuenta 1 (condición de la #455), la bandeja sin `webhook_url` y los miembros que el DG espera |
| **Evidencia** | Los conteos, «verificado por Sam, 0 del equipo de China» con la hora, y el id de la bandeja. Sin nombres |
| **Vuelta atrás** | Borrar la bandeja desde el panel, mientras no tenga conversaciones |
| **OK nominal** | «¿Autorizas crear la bandeja "Conversaciones del portal" en la cuenta 1 de Chatwoot, con la verificación de que ningún administrador ni agente de la cuenta 1 es del equipo de China?» |

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
- **Los comandos de 4.6b:** llegan con la #478 (Chatwoot, pasos 1, 1b y 3) y la #480 (Studio y el cierre, pasos 2, 4 y 5). Hasta entonces van marcados.
- **El procedimiento de 4.10a:** se define con el DG.
- **Los argumentos del respaldo externo a B2** (`pg-dump-to-s3.sh`, que sube a B2 aunque el nombre diga S3).

## De dónde sale cada cosa

- **El guion y las condiciones:** la spec 0586 §10.5.10, las revisiones de la #455 y la #456, y la 0524.
- **`cargar.sh`, la copia y el ensayo:** E5, en `0586-p4-runbook-seccion-e5.md` y `0586-p4-2b-columnas-copia-studio.md`, en las notas compartidas.
- **Lo medido en el VPS:** el DG, el 2026-11-08, comunicado por el Subdirector.
- **El encendido y los conteos de la cola:** `chatwoot-portal-encendido.md`.
- **Los scripts:** `infra/ops/portal-historial/`. Su README apunta aquí.
