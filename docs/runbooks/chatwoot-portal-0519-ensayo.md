# Runbook · Ensayo y aplicación de la 0519 (`chatwoot_portal`, SDD-0586 paso 10.5)

> **Preparado y NO corrido.** Lo armó el Worker de la 10.5 el 2026-11-08, por pedido del Director General, comunicado por el Subdirector de Chatwoot. **Decisión del DG: aplicar la 0519**, salida (a) de §0.
>
> - Cada paso que toca un host lo corre el Director General, con el OK nominal de Sam para ese host: primero prueba y después producción, como con la 0514 y la 0515.
> - Nada de este documento enciende `chatwoot_portal`, crea la bandeja, carga variables ni fija el corte.
> - Sigue `docs/runbooks/aplicar-migraciones-prod.md` y `docs/runbooks/entorno-prueba.md` §4. Lo que aquí se dice de sus scripts sale de esos runbooks y del handoff de la 0606 (`.agents/handoffs/sdd-0606-previa-y-ensayo.md`); **no se midió en el VPS**.

## 0 · Por qué ahora

La #424 se fusionó con la 0519 en espera (`main` en `caca3438b`). `publicar-web.sh` no publica una imagen si falta en el ledger una migración que el commit exige, **esperas incluidas** (§10 del runbook de producción). Por eso ninguna publicación posterior entra hasta aplicar la 0519.

El 2026-11-08 a las 00:33Z el DG midió que la publicación está congelada (`CONGELADO` puesto y el timer apagado). Hoy no frena nada, pero sí frenaría la próxima tanda. La otra salida, `publicar-web.sh aceptar-pendiente 0519_chatwoot_portal`, queda descartada por la decisión del DG.

## 1 · Identidad

Medida con `infra/ops/migraciones/preparar.mjs` sobre `caca3438b08c53c44a94693a7fcef7df67496a51` (`main`, 2026-11-08), sin tocar ninguna base. El blob no cambia mientras nadie toque el archivo, pero `aplicar.sql` lleva el SHA. **El día del apply se prepara otra vez sobre el `main` de ese día, y se copian los valores de esa salida.**

| Qué | Producción (`dtd-cargo`) | Prueba (`dtd-cargo-staging`) |
|---|---|---|
| Archivo | `supabase/migrations/0519_chatwoot_portal.sql` | el mismo |
| Blob | `02b9d160285f640bdc6b2be63481119584a76f54` | el mismo |
| Bytes y md5 del blob | 30710 · `f613559d5ca34b2932995c8ff051e97e` | los mismos |
| md5 de `aplicar.sql` en `caca3438b` | `d9e4c9c66d6b716d0c5f003bbb136464` | `61780c9ba1a357fba31d81e1b5756512` |
| `created_by` | `servidor-propio:psql:SDD-0586` | `servidor-propio:psql:prueba:SDD-0586` |
| Lectura previa | ledger, sesiones esperando locks, deriva de 5 funciones y el bloque `$preflight$` de la 0519 | igual |
| Verificación | una fila, md5 y bytes del ledger, y cuerpo vivo de las 5 funciones | igual |

- **Funciones que crea o reemplaza:** `chatwoot_portal_tomar`, `chatwoot_portal_marcar`, `chatwoot_portal_vincular`, `chatwoot_portal_rezagados` y `feature_flag_catalog()`. Esta última se redefine desde la 0503, y su preflight aborta si el catálogo vivo ya no es el de la 0503.
- **Locks:** objetos nuevos, el `create or replace` del catálogo y un `insert … on conflict do nothing` en `feature_flags`, con `lock_timeout = 5s`. No hay locks largos sobre tablas de negocio.
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

Antes de seguir: el blob, sus bytes y su md5 tienen que ser los de §1. Si cambió el md5 de `aplicar.sql` porque cambió `$H`, se usa el nuevo. Las mediciones son `docs/runbooks/chatwoot-portal-0519-antes.sql` y `docs/runbooks/chatwoot-portal-0519-despues.sql`: solo lectura, sin filas de negocio.

## 3 · Prueba (`dtd-cargo-staging`, `prueba.dtdcargo.com`): con el OK de Sam para prueba

**Lo corre el DG**, en el host que nombre Sam. Si la base de prueba ya está al nivel de `main`, como pasó con la 0606, no se resetea; si no, se resetea al SHA de `main` (§5 de `entorno-prueba.md`). La imagen de `main` ya trae el código de la #424, inerte sin la 0519.

1. **Previa** (solo lectura):

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <host> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba> --paso previa
   ```

2. **Antes:** se copian las dos mediciones, una vez, y se corre la de antes. El contenedor de prueba es `dtd-cargo-staging-db-1`; es inferencia por el nombre del proyecto, así que se confirma con `docker ps`. La salida queda en la carpeta del ensayo.

   ```bash
   scp.exe docs/runbooks/chatwoot-portal-0519-antes.sql docs/runbooks/chatwoot-portal-0519-despues.sql <host>:/srv/ops/paquetes/
   ```

   ```bash
   ssh.exe <host> "mkdir -p /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging && docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-antes.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging/antes.out"
   ```

3. **En seco**, y después el **apply**:

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host <host> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host <host> --proyecto dtd-cargo-staging --confirm dtd-cargo-staging --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prueba>
   ```

   Si `scp` corta la conexión (pasó con la 0515), no se aplicó nada: se repite el comando.
4. **Después:**

   ```bash
   ssh.exe <host> "docker exec -i dtd-cargo-staging-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-despues.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo-staging/despues.out"
   ```

   Se anotan el md5 del ledger de prueba (D1) y el número de tenants (A5 y D3).
5. **Smoke** (§6), con la imagen de `main`. Sam dice «aprobado en prueba».

## 4 · Producción (`dtd-cargo`): con el OK nominal de Sam que nombre `0519`

**Lo corre el DG.** El OK literal de Sam se guarda en un archivo con la herramienta de escritura, no con un heredoc: `aplicar.sh` lo exige y se niega si no nombra `0519`.

1. **Previa:**

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --paso previa
   ```

2. **Antes** (las mediciones se copian como en prueba, a `root@217.216.54.70:/srv/ops/paquetes/`):

   ```bash
   ssh.exe root@217.216.54.70 "mkdir -p /srv/ops/evidencias/ensayo-0519-dtd-cargo && docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-antes.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo/antes.out"
   ```

3. **En seco** y **apply**, en un momento de poco tráfico: los locks son cortos, pero el catálogo lo lee el panel de flags.

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --autorizacion <archivo con el OK literal> --en-seco
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo --esperada 0519_chatwoot_portal --paquete <carpeta-0519-prod> --autorizacion <archivo con el OK literal>
   ```

   Códigos de salida (§4 del runbook de producción):
   - **0:** listo.
   - **5 o 6:** no se aplicó nada.
   - **7:** se aplicó, pero la verificación no coincide. **No se repite**; se lee `verificar.err` y se avisa.
   - **255:** no se sabe si llegó al COMMIT. Se corre `--paso previa`: si dice «ya está en el ledger», se aplicó.
4. **Después:**

   ```bash
   ssh.exe root@217.216.54.70 "docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < /srv/ops/paquetes/chatwoot-portal-0519-despues.sql > /srv/ops/evidencias/ensayo-0519-dtd-cargo/despues.out"
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
| Cron | `curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-reintentos` desde el contenedor del cron | 200, con `portal` y `avisoPortal` con `omitido: "sin_configurar"` (sin `CHATWOOT_INBOX_PORTAL_ID`) o `"apagado"` |
| Base | `chatwoot-portal-0519-despues.sql` otra vez | D7 en ceros también después del mensaje del smoke |

**Resultado inválido:** un 500, un error de columna o función desconocida, o cualquier fila en D7.

## 7 · Vuelta atrás

| Situación | Qué se hace |
|---|---|
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
