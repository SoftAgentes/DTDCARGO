# Runbook · Ensayo y aplicación de la 0519 (`chatwoot_portal`, SDD-0586 paso 10.5)

> **Corrido el 2026-11-08.** Lo corrió el Director General con el OK nominal de Sam: «Sí, prueba y producción», hacia las 02:05Z. Los datos los comunicó el Subdirector de Chatwoot, y el cierre es la #435.
>
> - **Prueba (`dtd-cargo-staging`):** COMMIT a las 02:09:22Z, `version` `20261108020922`.
> - **Producción (`dtd-cargo`):** COMMIT a las 02:11:18Z, `version` `20261108021118`.
> - **Mediciones**, en los dos: A1 a A5 dieron 0, 0, 23 (`f`, `t`), 0 y 1. D1 a D7 dieron lo esperado.
>
> Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del Director General, comunicado por el Subdirector de Chatwoot. **Decisión del DG: aplicar la 0519**, salida (a) de §0. **Las correcciones N1 a N9 de la revisión independiente de la #433 llegaron después del apply** (#435). Valen para la próxima vez y para el guion de la 0520. El apply del 2026-11-08 corrió con el texto anterior.
>
> - Cada paso que toca un host lo corre el Director General, con el OK nominal de Sam para ese host: primero prueba y después producción, como con la 0514 y la 0515.
> - Nada de este documento enciende `chatwoot_portal`, crea la bandeja, carga variables ni fija el corte.
> - Sigue `docs/runbooks/aplicar-migraciones-prod.md` y `docs/runbooks/entorno-prueba.md` §4. Lo que aquí se dice de sus scripts sale de esos runbooks, del código de `infra/ops/migraciones/` y del handoff de la 0606 (`.agents/handoffs/sdd-0606-previa-y-ensayo.md`).

## 0 · Por qué ahora

La #424 se fusionó con la 0519 en espera (`main` en `caca3438b`). `publicar-web.sh` no publica una imagen si falta en el ledger una migración que el commit exige, **esperas incluidas** (§10 del runbook de producción). Por eso ninguna publicación posterior entra hasta aplicar la 0519.

El 2026-11-08 a las 00:33Z el DG midió que la publicación está congelada (`CONGELADO` puesto y el timer apagado). Hoy no frena nada, pero sí frenaría la próxima tanda. La otra salida, `publicar-web.sh aceptar-pendiente 0519_chatwoot_portal`, queda descartada por la decisión del DG.

## 1 · Identidad

Medida con `infra/ops/migraciones/preparar.mjs` sobre `caca3438b08c53c44a94693a7fcef7df67496a51` (`main`, 2026-11-08), sin tocar ninguna base. El blob no cambia mientras nadie toque el archivo. **`aplicar.sql` no lleva el SHA**: `envolver()` en `preparar.mjs` recibe solo el texto, el nombre y `created_by`. Su md5 cambia solo si cambia el blob o `created_by`, y por eso es distinto en prueba y en producción. El SHA lo llevan `previa.sql` y `verificar.sql`, en su comentario de cabecera, e `IDENTIDAD.txt`. **El día del apply se prepara otra vez sobre el `main` de ese día, y se copian los valores de esa salida.**

| Qué | Producción (`dtd-cargo`) | Prueba (`dtd-cargo-staging`) |
|---|---|---|
| Archivo | `supabase/migrations/0519_chatwoot_portal.sql` | el mismo |
| Blob | `02b9d160285f640bdc6b2be63481119584a76f54` | el mismo |
| Bytes y md5 del blob | 30710 · `f613559d5ca34b2932995c8ff051e97e` | los mismos |
| md5 de `aplicar.sql` (no depende del SHA) | `d9e4c9c66d6b716d0c5f003bbb136464` | `61780c9ba1a357fba31d81e1b5756512` |
| `created_by` | `servidor-propio:psql:SDD-0586` | `servidor-propio:psql:prueba:SDD-0586` |
| Lectura previa | ledger, sesiones esperando locks, deriva de 5 funciones y el bloque `$preflight$` de la 0519 | igual |
| Verificación | una fila, md5 y bytes del ledger, y cuerpo vivo de las 5 funciones | igual |

- **Funciones que crea o reemplaza:** `chatwoot_portal_tomar`, `chatwoot_portal_marcar`, `chatwoot_portal_vincular`, `chatwoot_portal_rezagados` y `feature_flag_catalog()`. Esta última se redefine desde la 0503, y su preflight aborta si el catálogo vivo ya no es el de la 0503.
- **Locks.** Las cuatro tablas nuevas tienen claves foráneas a `tenants`, `clients`, `conversations` y `conversation_messages`. Crear una FK toma SHARE ROW EXCLUSIVE sobre la tabla referenciada y lo **retiene hasta el COMMIT**: mientras dura la transacción, esas cuatro tablas no aceptan INSERT, UPDATE ni DELETE, aunque las lecturas siguen. Se suman el `create or replace` del catálogo y un `insert … on conflict do nothing` en `feature_flags`. Todo corre con `lock_timeout = 5s`: si un lock no llega en 5 s, aborta sin aplicar nada (código 6). Por eso se aplica en un momento de poco tráfico, porque el portal escribe en `conversations` y `conversation_messages` con cada mensaje.
- **Orden:** la PR ya está en `main`, y lo que destraba la publicación es aplicar. No hay merge después.

## 2 · Comandos comunes (en el checkout del DG, Git Bash)

```bash
git fetch origin && H=$(git rev-parse origin/main)
node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0519_chatwoot_portal --sdd 0586 --proyecto dtd-cargo-staging --salida <carpeta-0519-prueba>
node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0519_chatwoot_portal --sdd 0586 --salida <carpeta-0519-prod>
```

```bash
export MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe
export MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe
```

Antes de seguir: el blob, sus bytes y su md5 tienen que ser los de §1, y el md5 de `aplicar.sql` también. Ese md5 no cambia con `$H`; si cambió, cambió el blob o `created_by`, y se para. Las mediciones son `docs/runbooks/chatwoot-portal-0519-antes.sql` y `docs/runbooks/chatwoot-portal-0519-despues.sql`. Son solo de lectura y no traen filas de personas. **Leen una tabla de negocio, `public.tenants`, y solo cuentan sus filas (A5 y D3): el pedido de OK a Sam tiene que nombrarlo** («y contar cuántos tenants hay, solo el número»).

**Cómo leer D4 y D6** (lo que dejó el apply del 2026-11-08):

- **D4 es parcial.** Mira SELECT e INSERT para `anon`; SELECT, INSERT, UPDATE y DELETE para `authenticated`; y solo SELECT para `service_role`. No mira TRUNCATE, REFERENCES ni TRIGGER. El resto lo cubren el postflight de la 0519 y el contrato en PGlite (§2 «Acceso y datos» de `supabase/tests/0519_chatwoot_portal.test.sql`). El guion de la 0520 lo mide completo.
- **D6** muestra `config` como un arreglo de texto de Postgres. `{"search_path=\"\""}` quiere decir `search_path=""`, es decir, vacío: es lo esperado. Las comillas de afuera son del arreglo y las `\"` escapan las del valor.

**Las mediciones, probadas en PGlite** el 2026-11-08, con el turno del Subdirector y un worker. Se corrieron sobre el fixture del contrato de la 0519, con un ledger falso de la misma forma (`version`, `statements`, `name`, `created_by`):

- **Antes:** A1 a A5 dieron lo esperado (0, 0, 23 sin portal y con inbox, 0, 2 tenants).
- **Después**, con la 0519 aplicada y su fila con el archivo exacto: D1 a D7 dieron lo esperado (md5 `f613559d…` y 30710 bytes; 24 flags con el portal apagado; 2 filas de 2 tenants, ninguna encendida; 4 tablas con RLS y solo `service_role`; 4 políticas de `service_role`; 4 RPC definer con `search_path` vacío; la cola en ceros).
- **Control 1:** el «después» sin la 0519 falla (`relation "public.chatwoot_portal_estado" does not exist`).
- **Control 2:** el «antes» con la 0519 aplicada ya no da lo esperado (4 tablas, 24 flags y 2 filas).

**NO VERIFICADO**, porque PGlite no lo reproduce:

- **Los roles de Supabase reales.** En el servidor, `postgres` no es superusuario y los privilegios por defecto los fijan las migraciones viejas; en PGlite corre como superusuario.
- **El ledger real.** Sus columnas `idempotency_key` y `rollback` no están en el falso.
- **Que el md5 de D1 dé igual** con el envoltorio de `lib/migracion.sh`. Lo compara además la verificación de `aplicar.sh`.

**Verificado en el host:** el contenedor de la base de prueba es `dtd-cargo-staging-db-1`. Lo confirmó el Director General con `docker ps` en el VPS el 2026-11-08, cerca de las 00:55Z.

## 3 · Prueba (`dtd-cargo-staging`, `prueba.dtdcargo.com`): con el OK de Sam para prueba

**Lo corre el DG**, en el host que nombre Sam. Si la base de prueba ya está al nivel de `main`, como pasó con la 0606, no se resetea; si no, se resetea al SHA de `main` (§5 de `entorno-prueba.md`). La imagen de `main` ya trae el código de la #424, inerte sin la 0519.

1. **Previa** (solo lectura):

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba> --paso previa
   ```

   El host va siempre como `usuario@servidor`, el que nombre Sam, igual que el `root@217.216.54.70` de §4.

2. **Antes:** se copian las dos mediciones, una vez, se comprueba con sha256 que llegaron iguales y se corre la de antes. El contenedor de prueba es `dtd-cargo-staging-db-1`, confirmado con `docker ps` por el Director General el 2026-11-08 (§2). La salida queda en la carpeta del ensayo.

   ```bash
   "$MIGRACIONES_SCP" docs/runbooks/chatwoot-portal-0519-antes.sql docs/runbooks/chatwoot-portal-0519-despues.sql <usuario>@<servidor>:/srv/ops/paquetes/
   ```

   ```bash
   (cd docs/runbooks && sha256sum chatwoot-portal-0519-antes.sql chatwoot-portal-0519-despues.sql) | "$MIGRACIONES_SSH" <usuario>@<servidor> "cd /srv/ops/paquetes && tr -d '\r' | sha256sum -c -"
   ```

   Las dos líneas tienen que decir `OK`. Si alguna dice `FAILED`, no se corre nada: se copia otra vez.

   ```bash
   "$MIGRACIONES_SSH" <usuario>@<servidor> "mkdir -p /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging && docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-antes.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging/antes.out"
   ```

3. **En seco**, y después el **apply**:

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba>
   ```

   Si `scp` corta la conexión (pasó con la 0515), no se aplicó nada: se repite el comando. Los códigos de salida son los de §4.
4. **Después:**

   ```bash
   "$MIGRACIONES_SSH" <usuario>@<servidor> "docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-despues.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging/despues.out"
   ```

   Se anotan el md5 del ledger de prueba (D1) y el número de tenants (A5 y D3).
5. **Smoke** (§6), con la imagen de `main`. Sam dice «aprobado en prueba».

## 4 · Producción (`dtd-cargo`): con el OK nominal de Sam que nombre `0519`

**Lo corre el DG.** El OK literal de Sam se guarda en un archivo con la herramienta de escritura, no con un heredoc: `aplicar.sh` lo exige y se niega si no nombra `0519`.

1. **Previa:**

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --paso previa
   ```

2. **Antes.** Las mediciones se copian como en prueba, a `root@217.216.54.70:/srv/ops/paquetes/`, con `"$MIGRACIONES_SCP"`. Antes de correrlas se comprueban con el mismo `sha256sum -c` de §3, y las dos líneas tienen que decir `OK`.

   ```bash
   "$MIGRACIONES_SSH" root@217.216.54.70 "mkdir -p /srv/ops/evidencias/ensayo-0519-dtd-cargo && docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-antes.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo/antes.out"
   ```

3. **En seco** y **apply**, en un momento de poco tráfico. Hasta el COMMIT, las FK nuevas bloquean las escrituras en `tenants`, `clients`, `conversations` y `conversation_messages` (§1), y el portal escribe en las dos últimas con cada mensaje.

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --autorizacion <archivo con el OK literal> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --autorizacion <archivo con el OK literal>
   ```

   Códigos de salida (§4 del runbook de producción):
   - **0:** listo.
   - **2:** uso inválido. No se tocó nada; se corrige el comando.
   - **3:** rechazado por una guarda. Puede ser el proyecto, el `--confirm`, la autorización que no nombra la `0519`, el paquete de otra migración, el candado tomado, scripts del servidor distintos del checkout, o `ssh` o `scp` que no conectan. Pasa antes de tocar la base: no se aplicó nada.
   - **4:** integridad. `SHA256SUMS` no coincide, o el md5 de `aplicar.sql` no es el de `IDENTIDAD.txt`. También pasa antes de tocar la base: no se aplicó nada. Se prepara otra vez el paquete.
   - **5 o 6:** no se aplicó nada.
   - **7:** se aplicó, pero la verificación no coincide. **No se repite**; se lee `verificar.err` y se avisa.
   - **255:** no se sabe si llegó al COMMIT. Se corre `--paso previa`: si dice «ya está en el ledger», se aplicó.
4. **Después:**

   ```bash
   "$MIGRACIONES_SSH" root@217.216.54.70 "docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-despues.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo/despues.out"
   ```

   El md5 de D1 tiene que ser **el mismo que dio prueba**.
5. **Smoke** (§6).
6. **Destrabe de la publicación:** cuando el DG quite `CONGELADO`, la próxima imagen ya no frena por la 0519. Se mira en el aviso de `publicar-web.sh`.

## 5 · Cierre: retirar la espera (en una rama de cierre, nunca en `main`)

```bash
node infra/ops/migraciones/retirar-espera.mjs 0519_chatwoot_portal --md5 <blob_md5 de IDENTIDAD.txt de la evidencia de producción>
node scripts/migrations-lock.mjs
```

- Saca la 0519 de `pendingBelowCutoff` y su grupo `sdd-0586-portal-ida` de `pending-migration-symbol-declarations.json`, y la sella en `supabase/migrations.lock.json`. `--en-seco` muestra lo que haría.
- Cambia a mano la prueba que afirma la espera: `lib/studio/__tests__/chatwoot-portal.migration.test.ts`, en «la 0519 está declarada como espera». La cabecera «NO APLICADA» del `.sql` **no** se corrige.
- En la SDD y en el handoff quedan registrados: la hora del COMMIT, la `version` del ledger, el md5 y los bytes, las filas del ledger, la ruta de la evidencia y el OK literal.

## 6 · Smoke, con el flag apagado (en prueba y en producción)

| Rol | Dónde | Esperado |
|---|---|---|
| Cliente del portal (en prueba, uno de prueba; en producción, solo si Sam lo nombra) | `/portal/soporte`, el chat | Manda un mensaje y aparece, sin error, igual que antes |
| Admin de Studio | Conversaciones | El mensaje está en su hilo y se responde como hoy |
| Admin de Studio | Admin → Feature flags | «Conversaciones del portal en Chatwoot» apagado, con «Al apagar: se detiene una integración del servidor» |
| Cron, **en prueba** | `curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-reintentos` desde el contenedor del cron | 200, con `portal` y `avisoPortal` con `omitido: "sin_configurar"` (sin `CHATWOOT_INBOX_PORTAL_ID`) o `"apagado"` |
| Cron, **en producción** | **No se dispara.** Se lee la próxima corrida programada: el crontab la lanza cada 5 minutos (`infra/dtd-cargo/cron/crontab:26`). Se lee en el log del contenedor del cron, con `docker logs --since 10m <contenedor del cron>`; el nombre se confirma con `docker ps` | La corrida del log respondió 200, con lo mismo de arriba |
| Base | `chatwoot-portal-0519-despues.sql` otra vez | D7 en ceros también después del mensaje del smoke |

**Resultado inválido:** un 500, un error de columna o función desconocida, o cualquier fila en D7.

**Por qué el cron no se dispara a mano en producción** (N1 de la revisión independiente de la #433). `/api/cron/chatwoot-reintentos` no es solo la cola del portal. Cada corrida también **purga**:

- `purgarBandejaChatwoot`: eventos de más de 90 días y conversaciones sin actividad en 12 meses;
- `purgarBajasVencidas`: **borra en Chatwoot el usuario de un agente dado de baja hace más de 12 meses**;
- `purgarEnrutamientoChatwoot`: BSUID con un año sin actividad y respuestas del bot de más de 30 días.

Dispararlo es correr esos borrados fuera de su horario y con alguien mirando otra cosa. La corrida programada hace lo mismo, sola, a los 5 minutos. En prueba se puede disparar, porque sus datos son de prueba. En el apply del 2026-11-08 el smoke del cron dio 200 en los dos proyectos; cómo se llamó en producción lo sabe el DG. Que la salida del crontab quede en `docker logs` es **NO VERIFICADO**: se confirma el día del smoke.

## 7 · Vuelta atrás

| Situación | Qué se hace |
|---|---|
| Rechazo antes de tocar la base (2, 3 o 4) | Nada que deshacer. Se lee el mensaje (`RECHAZADO` o `INTEGRIDAD`), se corrige el comando o se prepara otra vez el paquete |
| Falla antes del COMMIT (5 o 6) | Nada que deshacer. Se lee `previa.err` o `aplicar.err` |
| Se aplicó y la verificación no coincide (7) | No se repite. Se lee `verificar.err` y se avisa a Sam |
| Se aplicó y la web falla | `publicar-web.sh volver`, que no toca la base. La 0519 es compatible con la web vieja y con la nueva |
| Hay que sacar la 0519 | **Se recomienda no deshacerla**: con el flag apagado, sin `CHATWOOT_INBOX_PORTAL_ID` y sin corte queda inerte. Si igual se decide, va una migración nueva y numerada de desarme, con su PR, sus pruebas y este mismo procedimiento. Tendría que borrar las 4 funciones y las 4 tablas, volver `feature_flag_catalog()` a la de la 0503 y borrar las filas `chatwoot_portal` de `feature_flags`. **No está escrita ni ensayada** |

**Nunca** se borra ni se edita la fila del ledger, ni se reaplica con otro nombre.

## 8 · Evidencia que queda

| Dónde | Qué |
|---|---|
| `/srv/ops/evidencias/apply-0519-dtd-cargo-staging-<ts>/` y `apply-0519-dtd-cargo-<ts>/` | Lo que deja `aplicar.sh`: los cuatro scripts, `IDENTIDAD.txt`, `AUTORIZACION.txt` (en producción), los `.out` y `.err` de psql, `registro.txt` y `SHA256SUMS` |
| Junto a cada una, `antes.out` y `despues.out` | La salida de las dos mediciones |
| SDD-0586 y el handoff de la 10.5 | Lo de §5, más los resultados del smoke por rol |

## 9 · Lo que este ensayo NO hace

- No crea la bandeja ni carga `CHATWOOT_INBOX_PORTAL_ID`, que es la puerta 3 de §10.5.9.
- No enciende `chatwoot_portal`, que es la puerta 6: exige T1 a T4 publicados y la vía de destrabe de la 1b.
- No fija el `corte` ni corre la carga P4.
