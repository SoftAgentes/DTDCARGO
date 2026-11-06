# SDD-0606 — Lectura previa y ensayo en prueba de las migraciones 0514 y 0515

**Corridos el 2026-11-06: la lectura previa en producción y el ensayo de la base en prueba (ver «Resultados»). En producción no se aplicó nada.** La lectura previa contra producción necesita la confirmación del Director General. El ensayo en prueba necesita que Sam nombre el host. Aplicar en producción necesita el OK nominal de Sam para cada número, de a una, pasando por el Director General.

- PR: [SoftAgentes/DTDCARGO#380](https://github.com/SoftAgentes/DTDCARGO/pull/380), rama `claude/gracious-kapitsa-213515`.
- Procedimientos: `docs/runbooks/aplicar-migraciones-prod.md` §2 a §8 (producción) y `docs/runbooks/entorno-prueba.md` §3 a §5 (prueba).

## Resultados (2026-11-06)

Lo pidió Sam en la sesión Worker de la SDD-0606, a la pregunta «¿En qué host del entorno de prueba hago el ensayo de la 0514 y la 0515?», respuesta «prueba.dtdcargo.com»; y a «¿Corro ahora la lectura previa contra producción de la 0514 y la 0515? Solo lee el ledger y el catálogo, en una transacción de solo lectura, sin filas de negocio.», respuesta «Sí, córrela». A «¿Autorizas aplicar las migraciones 0514 y 0515…?» no eligió ninguna opción: en esta sesión **no hay autorización registrada para producción**. La que el Director General recibió por su selector a las 17:35Z la registra él; el control de permisos de esta sesión no me dejó escribirla a partir del aviso de otra sesión.

**Producción: lectura previa PASÓ, nada aplicado.** Cabeza `f65ca1c3c`.

| Lectura | Resultado | Evidencia en el VPS |
|---|---|---|
| Previa del runbook, 0514 | PASÓ: ledger 512 filas, última `20261104211129`, la 0514 no está; 0 sesiones esperando locks; 0 transacciones largas; preflight propio OK | `/srv/ops/evidencias/previa-0514-dtd-cargo-20261106T174847Z` |
| Previa del runbook, 0515 | PASÓ: ídem para la 0515 | `/srv/ops/evidencias/previa-0515-dtd-cargo-20261106T175030Z` |
| Esquema (`sdd-0606-previa-esquema.sql`) más la ACL de `user_profiles` | Todo lo esperado (abajo) | `/srv/ops/evidencias/previa-esquema-0606-dtd-cargo-20261106T175047Z` (`previa-esquema.out`, `acl.out`, `SHA256SUMS`) |

Lo que salió en la de esquema:
- `user_profiles` no tiene `discord_user_id` ni el CHECK; 15 columnas; sin triggers; 56 kB.
- La policy de UPDATE es `user_profiles_owner_update` con `user_id = auth.uid()`.
- `authenticated` tiene UPDATE **de tabla** (`relacl` `authenticated=rw/postgres`) y ninguna columna con ACL propia: la columna nueva lo hereda y el perfil podrá guardar el ID.
- `studio_alert_outbox` no existe; `tenants` con su PK y `extensions.gen_random_uuid()` existen; los cuatro roles existen, `service_role` con `bypassrls`.
- Los privilegios por defecto de lo que crea `postgres` en `public` son sólo para `postgres` y `service_role`; los de `supabase_admin` no aplican.
- Existe `ensure_rls` (activa RLS en tablas nuevas); ninguna publicación es `FOR ALL TABLES`.
- El ledger no tiene ni la 0514 ni la 0515.

**Prueba (`dtd-cargo-staging`, el de `prueba.dtdcargo.com`): ensayo de la base PASÓ, de a una.** La base ya estaba al nivel de `main` (ledger 500, última 0513): no se reseteó. Web de prueba sin tocar (imagen `prueba-sha-55a65a60…`). Sin llaves ni datos de producción.

| Paso | Resultado | Evidencia |
|---|---|---|
| 0514 | PASÓ previa, apply (COMMIT con la fila del ledger) y verificación: ledger md5 `fb6d4d68b0ed528ab4803ae974571966`, 3766 bytes | `/srv/ops/evidencias/apply-0514-dtd-cargo-staging-20261106T175351Z` |
| Esquema antes → después de la 0514 | Sólo `user_profiles.discord_user_id` (text, nullable), el CHECK `user_profiles_discord_user_id_formato` y la fila del ledger | `diff-0514.txt` |
| 0515 | El primer intento no copió el paquete (`scp: Connection closed`): no aplicó nada, ledger sin la 0515. El segundo PASÓ previa, apply y verificación: ledger md5 `1ae7c1ac3cfbd9381285595e82f8a3e3`, 5766 bytes | `/srv/ops/evidencias/apply-0515-dtd-cargo-staging-20261106T180623Z` |
| Esquema después de la 0514 → después de la 0515 | Sólo la tabla `studio_alert_outbox` (RLS activada, ACL `postgres` y `service_role`), su PK, el índice de pendientes, 12 columnas, la FK a `tenants`, 7 CHECK y la fila del ledger. Ninguna función, policy, trigger ni publicación nueva | `diff-0515.txt` |
| Privilegios de la tabla nueva | `anon` sin acceso, `authenticated` sin acceso, `service_role` con acceso; 0 policies | `ledger-y-privilegios.txt` |

Fotos, diffs y `SHA256SUMS` del ensayo: `/srv/ops/evidencias/ensayo-0606-dtd-cargo-staging-20261106T175149Z`. El md5 del ledger de prueba es el que tiene que dar producción.

**Smokes A y B: NO EJECUTADOS.** El A pide la web de `main` en prueba y la que corre es otra imagen (`55a65a60…`); el B pide construir y desplegar la imagen de la #380 y entrar con la clave de prueba. Desplegar en prueba y usar la clave no entró en lo que Sam nombró.

## Identidad de cada migración

Medida con `infra/ops/migraciones/preparar.mjs` sobre `8c6cf9f58` (2026-11-06). El blob de cada archivo no cambia mientras nadie toque la migración, pero `aplicar.sql` lleva el SHA: **hay que volver a preparar sobre la cabeza final de la PR** y copiar los valores de esa salida.

| Migración | Blob | Bytes | md5 del blob | md5 de `aplicar.sql` en `8c6cf9f58` | Funciones que reemplaza | Preflight propio |
|---|---|---|---|---|---|---|
| `0514_user_profiles_discord_user_id` | `d5fcb158e7e6` | 3766 | `fb6d4d68b0ed528ab4803ae974571966` | `fefe7c3b9c37e86552ddcc53fe44999e` | 0 | sí, sólo lee y aborta |
| `0515_studio_alert_outbox` | `e4d67d01a498` | 5766 | `1ae7c1ac3cfbd9381285595e82f8a3e3` | `f9073b5ab16280066568ec492a7a7ccf` | 0 | sí, sólo lee y aborta |

`created_by`: `servidor-propio:psql:SDD-0606`. Ninguna de las dos es migrate-first: el código tolera que falten, así que el orden entre aplicar y fusionar es libre. Se aplican **de a una**, 0514 primero.

## 1 · Lectura previa contra producción (NO CORRER sin el Director General)

Dos piezas, las dos de sólo lectura:

1. **La del runbook**, que arma `preparar.mjs`: ledger (filas, última versión, que la migración no esté), sesiones esperando locks, deriva de funciones (no hay) y el bloque `$preflight$` de cada migración tal cual.

   ```bash
   H=$(git rev-parse HEAD)   # la cabeza final de la PR
   node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0514_user_profiles_discord_user_id --sdd 0606 --salida <carpeta-0514>
   node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0515_studio_alert_outbox --sdd 0606 --salida <carpeta-0515>
   ```

   ```bash
   export MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe
   export MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0514_user_profiles_discord_user_id --paquete <carpeta-0514> --paso previa
   ```

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0515_studio_alert_outbox --paquete <carpeta-0515> --paso previa
   ```

2. **La de esquema** de esta tarea: [`sdd-0606-previa-esquema.sql`](sdd-0606-previa-esquema.sql). Sólo `information_schema` y `pg_catalog`, en `begin transaction read only … rollback`; ninguna fila de negocio (`reltuples` es la estimación del planificador). Probada una vez en PostgreSQL embebido con un esquema de juguete: corre entera sin error. No se probó contra el Postgres del servidor.

   ```bash
   scp.exe .agents/handoffs/sdd-0606-previa-esquema.sql root@217.216.54.70:/srv/ops/paquetes/
   ```

   ```bash
   ssh.exe root@217.216.54.70 "docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/sdd-0606-previa-esquema.sql"
   ```

### Qué tiene que salir para seguir

| Bloque | Esperado | Si sale otra cosa |
|---|---|---|
| 0514.1 | No hay `discord_user_id` | Si existe y es `text`, la migración es idempotente; si es de otro tipo, su preflight aborta: no aplicar y avisar |
| 0514.2 | No hay `user_profiles_discord_user_id_formato` | Si existe con otra definición, revisar antes |
| 0514.3 | Decenas de filas estimadas | Si son miles, el CHECK tarda más; mirar la hora de poco tráfico |
| 0514.4 | Una policy de UPDATE para `authenticated` con `user_id = auth.uid()` en `using` y `with check` (en el repo es `user_profiles_owner_update`, migr 0019) | **Si no hay policy de UPDATE propia**, el campo del perfil no podrá guardar el ID: la spec dice que se hereda esa policy (D4). No bloquea aplicar, pero el perfil daría el aviso genérico de error |
| 0514.5 / 0514.6 | `UPDATE` de tabla para `authenticated`, sin privilegios por columna | Si hay privilegios por columna, la columna nueva no los hereda: hace falta un `GRANT UPDATE (discord_user_id)` en otra migración |
| 0514.7 | Ningún trigger que reescriba columnas del perfil | Leer su definición antes de aplicar |
| 0515.1 | `null` | Si existe, el preflight decide: con `mention_user_ids` sigue (idempotente), sin ella aborta |
| 0515.2 | Las tres no nulas | Si falta `extensions.gen_random_uuid()`, el `create table` falla dentro de la transacción y no cambia nada |
| 0515.3 | Los cuatro roles; `service_role` con `bypassrls` | Si falta `service_role`, el `grant` final falla y no cambia nada |
| 0515.4 | Puede haber ACL por defecto con `anon` y `authenticated` | Es lo esperado en Supabase: la migración los revoca después de crear la tabla. La verificación del contrato 3 lo mide en prueba |
| 0515.5 | Si existe el disparador que activa RLS (migr 0277), RLS queda activada igual | Ninguno que bloquee `create table` |
| 0515.6 | Ninguna publicación con `puballtables = true` | Si la hay, la cola entraría a realtime: avisar antes de aplicar |
| 0515.7 | `postgres_puede_crear = true` | Si no, el `create table` falla y no cambia nada |
| L | Ninguna fila | Si aparece, ya está aplicada: **no repetir** |

## 2 · Ensayo en el entorno de prueba (NO CORRER sin que Sam nombre el host)

Sigue `entorno-prueba.md` §4. La evidencia vale para **un SHA**: si la PR cambia una migración o su código, se repite desde el paso 1.

1. **Base de prueba igual a `main`** (§5, reset al SHA de `main`).
2. **App vieja con base nueva.** Desplegar la imagen de prueba de `main` (§3) y aplicar la 0514 y después la 0515, cada una con su paquete. Con el mismo envoltorio de producción:

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <host que nombre Sam> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0514_user_profiles_discord_user_id --paquete <carpeta-0514>
   ```

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <host que nombre Sam> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0515_studio_alert_outbox --paquete <carpeta-0515>
   ```

   O con `infra/ops/migrate/aplicar-migracion.sh --project dtd-cargo-staging` (§4 del runbook de prueba). Anotar el md5 del ledger de prueba de cada una: después tiene que ser el mismo en producción.

   **Smoke A** (app de `main`, base nueva): la web vieja no usa ninguna de las dos.
   - Studio, rol `admin`: abrir **Clientes**, **Conversaciones**, **Bugs** y **Ajustes › Alertas de Telegram** (todavía con el nombre viejo). Esperado: cargan igual que antes.
   - Studio, rol `commercial`: abrir el **perfil › Preferencias** y guardar el nombre. Esperado: guarda.
   - Resultado inválido: cualquier error 500 o de columna desconocida.
3. **App nueva con base nueva.** Desplegar la imagen del head de la #380 (§3).

   **Smoke B** (por rol). En prueba Discord queda **apagado** aunque haya variables (`APP_ENV=staging`, D7): ningún aviso sale a Discord, a propósito.
   - `admin`: **Ajustes › Alertas del equipo**. Esperado: las cinco categorías dicen «Apagado en el entorno de prueba»; la matriz de Telegram abajo.
   - `admin` y `commercial`: **perfil › Preferencias › Menciones en Discord**. Pegar un ID de 18 dígitos y guardar: dice «ID guardado». Recargar: sigue ahí. «Quitar»: dice «ID quitado». Pegar `sam`: no deja escribir letras; pegar `1234`: dice que son 17 a 20 dígitos.
   - Un usuario **no puede cambiar el ID de otro**: lo cubre el contrato de la 0514; en pantalla no hay forma de intentarlo.
   - Cola: con Discord apagado no entra ninguna fila. Lo que se mide es que el cron de cada 5 min responda con `alertas` en ceros:

     ```bash
     curl -fsS -H "Authorization: Bearer <CRON_SECRET de prueba>" https://prueba.dtdcargo.com/api/cron/bug-notifications-drain
     ```

     Esperado: `"alertas":{"processed":0,…}` y ningún error.
   - Sam dice «aprobado en prueba».

## 3 · Volver atrás

Según §8 del runbook. Las dos son aditivas y el código las tolera ausentes:

- Si falla antes del COMMIT, no hay nada que deshacer.
- Si hay que deshacerlas después, es una **migración nueva** con su PR y su OK: para la 0514, `drop constraint user_profiles_discord_user_id_formato` y `drop column discord_user_id` (se pierden los ID que el personal haya pegado); para la 0515, `drop table studio_alert_outbox` (se pierden los avisos que estén esperando en la cola). Con la web nueva publicada, sin la columna el perfil vuelve a decir que no se puede guardar, y sin la tabla lo que Discord no guarda vuelve a caer a Telegram.
- Nunca borrar ni editar la fila del ledger.

## 4 · El pedido del OK (lo arma el Director)

Por migración: el archivo exacto, SDD-0606, la #380, el md5 y los bytes del blob de la tabla de arriba, el resultado de la lectura previa con la ruta de su evidencia, el ensayo en prueba con sus smokes, «no es migrate-first: el orden con la fusión es libre» y cómo se vuelve atrás. La respuesta de Sam se guarda literal y tiene que nombrar `0514` y `0515`.
