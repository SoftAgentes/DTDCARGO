# Runbook · Ensayo y aplicación de la 0520 (`chatwoot_portal_vuelta`, SDD-0586 paso 10.5, PR 1b)

> **Preparado y NO corrido.** Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del Director General, comunicado por el Subdirector de Chatwoot.
>
> Sigue el formato del de la 0519 (`chatwoot-portal-0519-ensayo.md`), con las correcciones N1 a N9 de la revisión independiente de la #433 ya aplicadas.
>
> - Cada paso que toca un host lo corre el Director General, con el OK nominal de Sam para ese host, que nombre la `0520`: primero prueba y después producción.
> - **La 0520 todavía no tiene OK de Sam.** Se lo pregunta el DG.
> - Nada de este documento enciende `chatwoot_portal`, crea la bandeja, carga variables ni fija el corte.
> - Sigue `docs/runbooks/aplicar-migraciones-prod.md` y `docs/runbooks/entorno-prueba.md` §4. Lo que aquí se dice de sus scripts sale de esos runbooks, del código de `infra/ops/migraciones/` y del apply de la 0519 del 2026-11-08.

## 0 · Qué es y en qué orden

La 0520 es la vuelta de Chatwoot al portal y destrabar. Crea `chatwoot_portal_respuesta`, solo para `service_role`, y `chatwoot_portal_destrabar()`, para `authenticated` con el admin del tenant comprobado dentro. Viene en la #434, que **no se fusiona sin la 0520 aplicada en producción** (regla del DG, 2026-11-08). Por eso el orden es **migrate-first** (§5 del runbook de producción), al revés que con la 0519:

1. La #434 trae `main` con la #435 (el cierre de la 0519) y queda con su **cabeza final**. Esa cabeza es la que se prepara.
2. Se aplica en prueba y después en producción, desde esa cabeza.
3. El DG fusiona la #434 **segundos después** del COMMIT de producción, con `gh pr merge 434 --merge --match-head-commit <sha del paquete>`. Fusionar es publicar.
4. El cierre (`retirar-espera.mjs`) va en una rama propia (§5).

Si la cabeza de la #434 cambia después de preparar el paquete, se prepara otra vez: `previa.sql`, `verificar.sql` e `IDENTIDAD.txt` llevan el SHA, y `--match-head-commit` exige ese SHA exacto.

**Requisito:** la 0519 aplicada, y ya lo está desde el 2026-11-08 en los dos proyectos. Lo mide A1.

## 1 · Identidad

Medida con `infra/ops/migraciones/preparar.mjs` sobre `32e858800ec76ebfe8f325d814b84f68d080fea1` (la cabeza de la #434 el 2026-11-08), sin tocar ninguna base. **El día del apply se prepara otra vez sobre la cabeza final de la #434, y se copian los valores de esa salida.**

| Qué | Producción (`dtd-cargo`) | Prueba (`dtd-cargo-staging`) |
|---|---|---|
| Archivo | `supabase/migrations/0520_chatwoot_portal_vuelta.sql` | el mismo |
| Blob | `29a3bbeaf3b01c85a85961653bffcedd902322e7` | el mismo |
| Bytes y md5 del blob | 12500 · `03bcee54616204644a6981d33ec7764c` | los mismos |
| md5 de `aplicar.sql` (no depende del SHA) | `31ea8f030b5c45b91d555f4d6ac21801` | `2d66435c95755a5507008583d9945db8` |
| `created_by` | `servidor-propio:psql:SDD-0586` | `servidor-propio:psql:prueba:SDD-0586` |
| Lectura previa | ledger, sesiones esperando locks, deriva de las 2 funciones (nuevas: no tienen cuerpo anterior) y el bloque `$preflight$` de la 0520 | igual |
| Verificación | una fila, md5 y bytes del ledger, y el cuerpo vivo de las 2 funciones | igual |

- **`aplicar.sql` no lleva el SHA**, porque `envolver()` recibe solo el texto, el nombre y `created_by`. Su md5 cambia solo si cambia el blob o `created_by`, y por eso es distinto en prueba y en producción. Si el día del apply sale otro md5, cambió el blob: se para.
- **Funciones que crea:** `chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)` y `chatwoot_portal_destrabar()`. No reemplaza ninguna. Su preflight aborta si ya existen («no se reaplica»), si falta algo de la 0519, de la 0503, de la 0019 o de la 0386, o si el índice de `external_msg_id` no es el de la 0106.
- **Locks:** la 0520 no crea tablas ni claves foráneas: solo dos funciones y sus permisos. No toma locks sobre tablas de negocio, solo sobre el catálogo, y corre con `lock_timeout = 5s` y `statement_timeout = 30s`. Aun así, conviene aplicarla en un momento de poco tráfico, como todo apply.

## 2 · Comandos comunes (en el checkout del DG, Git Bash)

```bash
git fetch origin && H=$(git rev-parse origin/codex/0586-e10-5-1b-vuelta)
node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0520_chatwoot_portal_vuelta --sdd 0586 --proyecto dtd-cargo-staging --salida <carpeta-0520-prueba>
node infra/ops/migraciones/preparar.mjs --sha $H --migracion 0520_chatwoot_portal_vuelta --sdd 0586 --salida <carpeta-0520-prod>
```

```bash
export MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe
export MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe
```

Antes de seguir: el blob, sus bytes y su md5 tienen que ser los de §1, y el md5 de `aplicar.sql` también. `$H` tiene que ser la cabeza que el DG va a fusionar.

**Las mediciones** son `docs/runbooks/chatwoot-portal-0520-antes.sql` y `docs/runbooks/chatwoot-portal-0520-despues.sql`. Son de solo lectura y **no leen ninguna tabla de negocio ni de personas**. Miran el ledger, el catálogo de funciones, lo que exige el preflight, las filas del flag `chatwoot_portal` (configuración) y el conteo de `chatwoot_portal_salida` (estado de integración). El pedido de OK a Sam no tiene que nombrar ninguna lectura de negocio (N9).

- **D2 mide todos los privilegios.** La única permisión de una función es EXECUTE, y D2 la mira para `public`, `anon`, `authenticated` y `service_role` (N8).
- **D2 normaliza `search_path`:** `search_path_vacio` compara el texto `search_path=""`, y `config_texto` lo muestra sin el arreglo crudo de Postgres.
- **En `destrabar`, `service_role` se anota.** Los privilegios por defecto de Supabase pueden darle EXECUTE, y no lo usa.

**Las mediciones, probadas en PGlite** el 2026-11-08, con un worker y en un solo proceso. Corrieron sobre el fixture del contrato de la 0520, que trae la 0519 aplicada y su fila en un ledger falso de la misma forma (`version`, `statements`, `name`, `created_by`):

- **Antes:** A1 a A5 dieron lo esperado: la 0519 en el ledger y la 0520 no; ninguna de sus funciones; los ocho requisitos del preflight en `t`; el flag apagado en sus 2 filas, una por cada tenant del fixture; y la cola en ceros.
- **Después,** con la 0520 aplicada y su fila con el archivo exacto, D1 a D5 dieron lo esperado:
  - D1: md5 `03bcee54…` y 12500 bytes;
  - D2: `respuesta` definer, con `search_path` vacío y solo para `service_role`; `destrabar` definer, con `search_path` vacío, para `authenticated` y no para `anon` ni `public`;
  - D3: las 4 RPC de la 0519 y 24 flags;
  - D4: el flag apagado, con las mismas filas;
  - D5: la cola igual.
- **Control 1:** el «después» sin la 0520 no da D1 ni D2, porque no hay filas.
- **Control 2:** el «antes» con la 0520 aplicada ya no da lo esperado: 1 fila y 2 funciones.
- **Control 3:** un `grant execute … to anon` de más sobre `destrabar` aparece en D2.

**NO VERIFICADO**, porque PGlite no lo reproduce:

- **Los roles de Supabase reales.** En el servidor `postgres` no es superusuario, y los privilegios por defecto los fijan las migraciones viejas. Por eso `service_role` en `destrabar` se anota y no se exige.
- **El ledger real.** Sus columnas `idempotency_key` y `rollback` no están en el falso.
- **Que el md5 de D1 dé igual** con el envoltorio de `lib/migracion.sh`. Lo compara además la verificación de `aplicar.sh`.

**Verificado en el host:** el contenedor de prueba es `dtd-cargo-staging-db-1`, confirmado por el DG con `docker ps` el 2026-11-08. El de producción, `dtd-cargo-db-1`, es el que usó el apply de la 0519 ese mismo día.

## 3 · Prueba (`dtd-cargo-staging`, `prueba.dtdcargo.com`): con el OK de Sam para prueba

**Lo corre el DG**, en el host que nombre Sam, como `usuario@servidor`. La base de prueba ya tiene la 0519 (2026-11-08, `version` `20261108020922`).

1. **Previa** (solo lectura):

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prueba> --paso previa
   ```

2. **Antes:** se copian las dos mediciones, una vez. Se comprueba con sha256 que llegaron iguales y se corre la de antes.

   ```bash
   "$MIGRACIONES_SCP" docs/runbooks/chatwoot-portal-0520-antes.sql docs/runbooks/chatwoot-portal-0520-despues.sql <usuario>@<servidor>:/srv/ops/paquetes/
   ```

   ```bash
   (cd docs/runbooks && sha256sum chatwoot-portal-0520-antes.sql chatwoot-portal-0520-despues.sql) | "$MIGRACIONES_SSH" <usuario>@<servidor> "cd /srv/ops/paquetes && tr -d '\r' | sha256sum -c -"
   ```

   Las dos líneas tienen que decir `OK`. Si alguna dice `FAILED`, no se corre nada: se copia otra vez.

   ```bash
   "$MIGRACIONES_SSH" <usuario>@<servidor> "mkdir -p /srv/ops/evidencias/ensayo-0520-dtd-cargo-staging && docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0520-antes.sql > /srv/ops/evidencias/ensayo-0520-dtd-cargo-staging/antes.out"
   ```

   A1 tiene que dar `1, 0`. Si la 0519 no está, se para: la 0520 no se aplica sin ella, y su preflight también lo frenaría.

3. **En seco**, y después el **apply**:

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prueba> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host <usuario>@<servidor> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prueba>
   ```

   Si `scp` corta la conexión (pasó con la 0515), no se aplicó nada: se repite el comando. Los códigos de salida están en §4.
4. **Después:**

   ```bash
   "$MIGRACIONES_SSH" <usuario>@<servidor> "docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0520-despues.sql > /srv/ops/evidencias/ensayo-0520-dtd-cargo-staging/despues.out"
   ```

   Se anotan el md5 de D1 y el `service_role` de `destrabar` en D2.
5. **Smoke** (§6). Sam dice «aprobado en prueba».

## 4 · Producción (`dtd-cargo`): con el OK nominal de Sam que nombre `0520`

**Lo corre el DG.** El OK literal de Sam se guarda en un archivo con la herramienta de escritura, no con un heredoc: `aplicar.sh` lo exige y se niega si no nombra `0520`.

1. **Previa:**

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prod> --paso previa
   ```

2. **Antes.** Las mediciones se copian como en prueba, con `"$MIGRACIONES_SCP"`, a `root@217.216.54.70:/srv/ops/paquetes/`. Se comprueban con el mismo `sha256sum -c` de §3, y las dos líneas tienen que decir `OK`.

   ```bash
   "$MIGRACIONES_SSH" root@217.216.54.70 "mkdir -p /srv/ops/evidencias/ensayo-0520-dtd-cargo && docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0520-antes.sql > /srv/ops/evidencias/ensayo-0520-dtd-cargo/antes.out"
   ```

3. **En seco** y **apply**, en un momento de poco tráfico (§1, «Locks»):

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prod> --autorizacion <archivo con el OK literal> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0520_chatwoot_portal_vuelta --paquete <carpeta-0520-prod> --autorizacion <archivo con el OK literal>
   ```

   Códigos de salida (§4 del runbook de producción):
   - **0:** listo.
   - **2:** uso inválido. No se tocó nada; se corrige el comando.
   - **3:** rechazado por una guarda. Puede ser el proyecto, el `--confirm`, la autorización que no nombra la `0520`, el paquete de otra migración, el candado tomado, scripts del servidor distintos del checkout, o `ssh` o `scp` que no conectan. Pasa antes de tocar la base: no se aplicó nada.
   - **4:** integridad. `SHA256SUMS` no coincide, o el md5 de `aplicar.sql` no es el de `IDENTIDAD.txt`. También pasa antes de tocar la base: no se aplicó nada. Se prepara otra vez el paquete.
   - **5:** falló la lectura previa. No se aplicó nada.
   - **6:** el apply falló y psql deshizo la transacción. No se aplicó nada.
   - **7:** se aplicó, pero la verificación no coincide. **No se repite**; se lee `verificar.err` y se avisa.
   - **255:** `ssh` se cayó durante el apply y no se sabe si llegó al COMMIT. Se corre `--paso previa`: si dice «ya está en el ledger», se aplicó.
4. **Fusionar la #434**, segundos después del COMMIT y con la autorización de merge del DG: `gh pr merge 434 --merge --match-head-commit <sha del paquete>`. Fusionar publica la web cuando la publicación no esté congelada.
5. **Después:**

   ```bash
   "$MIGRACIONES_SSH" root@217.216.54.70 "docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0520-despues.sql > /srv/ops/evidencias/ensayo-0520-dtd-cargo/despues.out"
   ```

   El md5 de D1 tiene que ser **el mismo que dio prueba**.
6. **Smoke** (§6).

## 5 · Cierre: retirar la espera (en una rama de cierre, nunca en `main`)

```bash
node infra/ops/migraciones/retirar-espera.mjs 0520_chatwoot_portal_vuelta --md5 <blob_md5 de IDENTIDAD.txt de la evidencia de producción>
node scripts/migrations-lock.mjs
node scripts/check-pending-migration-symbols.mjs
```

- Saca la 0520 de `pendingBelowCutoff` y su grupo `sdd-0586-portal-vuelta` de `pending-migration-symbol-declarations.json`, y la sella en `supabase/migrations.lock.json`. `--en-seco` muestra lo que haría.
- Cambia a mano la prueba que afirma la espera: `lib/studio/__tests__/chatwoot-portal-vuelta.migration.test.ts`, en «la 0520 está declarada como espera». Además se buscan a mano otras afirmaciones, porque `revisarAMano` no alcanza. La cabecera «NO APLICADA» del `.sql` **no** se corrige: cambiaría el md5 del ledger.
- En la SDD y en el handoff quedan registrados: la hora del COMMIT, la `version` del ledger, el md5 y los bytes, la ruta de la evidencia y el OK literal.
- Si el cierre entra en un `main` que todavía no tiene la #434, se mide con `merge-tree`. «El driver revive esperas selladas»: después de traer `main`, se corren otra vez el candado y el gate.

## 6 · Smoke, con el flag apagado (en prueba y en producción)

Hasta que se publique la web de la #434, el código que llama a las dos funciones no corre: no hay smoke con sesión de lo nuevo. Con la web publicada:

| Rol | Dónde | Esperado |
|---|---|---|
| Admin de Studio | `/studio/bandeja` | La página abre como antes. Sin `CHATWOOT_INBOX_PORTAL_ID`, la tarjeta «Portal → Chatwoot» no aparece. La salud muestra, si faltan, las alertas nuevas del webhook de cuenta (`docs/runbooks/chatwoot-bandeja.md`) |
| Admin de Studio | Admin → Feature flags | «Conversaciones del portal en Chatwoot» sigue apagado |
| Cliente del portal (en prueba, uno de prueba; en producción, solo si Sam lo nombra) | `/portal/soporte`, el chat | Manda un mensaje y aparece sin error, igual que antes |
| Cron, **en prueba** | `curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-reintentos` desde el contenedor del cron | 200 |
| Cron, **en producción** | **No se dispara.** Se lee la próxima corrida programada, que el crontab lanza cada 5 minutos (`infra/dtd-cargo/cron/crontab:26`), en el log del contenedor del cron: `docker logs --since 10m <contenedor del cron>`; el nombre se confirma con `docker ps` | La corrida respondió 200 |
| Cron diario `chatwoot-agentes` | Su próxima corrida | 200. Si faltara el webhook de cuenta, sus alertas nuevas llegan a los admins por push |
| Base | `chatwoot-portal-0520-despues.sql` otra vez | D4 y D5 iguales |

**Resultado inválido:** un 500, un error de función desconocida (PGRST202) o un cambio en D4 o D5.

**Por qué el cron no se dispara a mano en producción** (N1). Cada corrida de `/api/cron/chatwoot-reintentos` también **purga**: `purgarBajasVencidas` **borra en Chatwoot el usuario de un agente dado de baja hace más de 12 meses**, y además corren `purgarBandejaChatwoot` y `purgarEnrutamientoChatwoot`. La corrida programada hace lo mismo, sola, a los 5 minutos. Que la salida del crontab quede en `docker logs` es **NO VERIFICADO**: se confirma el día del smoke.

## 7 · Vuelta atrás

| Situación | Qué se hace |
|---|---|
| Rechazo antes de tocar la base (2, 3 o 4) | Nada que deshacer. Se lee el mensaje (`RECHAZADO` o `INTEGRIDAD`), se corrige el comando o se prepara otra vez el paquete |
| Falla antes del COMMIT (5 o 6) | Nada que deshacer. Se lee `previa.err` o `aplicar.err` |
| Se aplicó y la verificación no coincide (7) | No se repite. Se lee `verificar.err` y se avisa a Sam. **La #434 no se fusiona** |
| Se aplicó y la web nueva falla | `publicar-web.sh volver`, que no toca la base. La 0520 solo agrega dos funciones: la web vieja no las llama |
| Hay que sacar la 0520 | **Se recomienda no deshacerla:** con el flag apagado queda inerte. Si igual se decide, va una migración nueva y numerada de desarme, con su PR, sus pruebas y este mismo procedimiento. Borraría las dos funciones. **No está escrita ni ensayada** |

**Nunca** se borra ni se edita la fila del ledger, ni se reaplica con otro nombre.

## 8 · Evidencia que queda

| Dónde | Qué |
|---|---|
| `/srv/ops/evidencias/apply-0520-dtd-cargo-staging-<ts>/` y `apply-0520-dtd-cargo-<ts>/` | Lo que deja `aplicar.sh`: los cuatro scripts, `IDENTIDAD.txt`, `AUTORIZACION.txt` (en producción), los `.out` y `.err` de psql, `registro.txt` y `SHA256SUMS` |
| `/srv/ops/evidencias/ensayo-0520-dtd-cargo-staging/` y `ensayo-0520-dtd-cargo/` | `antes.out` y `despues.out` |
| SDD-0586 y el handoff de la 1b | Lo de §5, más los resultados del smoke por rol |

## 9 · Lo que este ensayo NO hace

- No crea la bandeja ni carga `CHATWOOT_INBOX_PORTAL_ID`, que es la puerta 3 de §10.5.9.
- No enciende `chatwoot_portal`, que es la puerta 6. Exige T1 a T4 publicados, la 0520 aplicada y la vía del atascado publicada. Sin la 0520, encenderlo rompe la vuelta, con PGRST202 hasta descartar el evento.
- No fija el `corte` ni corre la carga P4.
- No corre `chatwoot_portal_destrabar`: con el flag apagado no hay atascados (A5 y D5).
