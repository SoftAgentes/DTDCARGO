# Aplicar migraciones a producción · servidor propio

Dueño: ingeniería (Director) · Estado: vigente desde la integración de la
[SDD-0546](../specs/0546-migraciones-servidor-propio/spec.md) · Actualizado: 2026-10-19 (candado de la
[SDD-0561](../specs/0561-candado-migraciones-aplicadas/spec.md)) · review-by: 2027-01-17

Cómo se aplica una migración de `supabase/migrations/` en la base de producción,
que desde el corte del 2026-10-14 (02:00Z) es el Supabase propio del VPS
(`servidor-contabo.md` §3.6). Lo de Supabase Cloud quedó como **histórico** al
final (§13): no lo uses para aplicar.

> ⚠️ **Nunca es automático.** Aplicar exige el **OK nominal de Sam**: un mensaje
> suyo que **nombre cada migración** y el servidor. «Ok», «dale» o «avanza» no
> alcanzan. Una autorización que Sam le dio a otra sesión se registra a nombre de
> esa sesión, no se toma prestada. Fusionar una PR **no** autoriza aplicar su
> migración, y aplicar no autoriza fusionar: son dos OK distintos.

## 0 · Dónde vive producción

| Qué | Valor |
|---|---|
| Servidor | VPS de Contabo `217.216.54.70`; se entra con la llave del agente de Windows |
| Proyecto compose | `dtd-cargo`, en `/srv/dtd-cargo` |
| Base | contenedor `dtd-cargo-db-1`; `psql -U postgres -d postgres` dentro del contenedor |
| Rol | `postgres`: no es superusuario, pero es dueño de las funciones y del ledger |
| Ledger | `supabase_migrations.schema_migrations` (`version`, `statements`, `name`, `created_by`, `idempotency_key`, `rollback`) |
| Scripts | `infra/ops/migraciones/` del repo; en el servidor, `/srv/ops/migraciones/` y `/srv/ops/lib/migracion.sh` |
| Evidencia | `/srv/ops/evidencias/apply-NNNN-dtd-cargo-<ts>/` (y `previa-NNNN-…` para una lectura previa sola) |

## 1 · Las piezas

| Pieza | Dónde corre | Qué hace |
|---|---|---|
| `infra/ops/migraciones/preparar.mjs` | tu checkout (node + git) | Arma el paquete desde el blob **exacto** del SHA: `migracion.sql`, `previa.sql`, `aplicar.sql`, `verificar.sql`, `IDENTIDAD.txt` y `SHA256SUMS`. No toca ninguna base |
| `infra/ops/migraciones/aplicar-remoto.sh` | tu equipo (Git Bash o Linux) | Comprueba los paquetes, comprueba que el servidor tenga instalados los scripts de tu checkout (sha256), copia cada paquete por scp y corre `aplicar.sh` por ssh, de a una, parando en la primera falla |
| `infra/ops/migraciones/aplicar.sh` | el VPS | Revisa el paquete y corre con psql la lectura previa, el apply y la verificación. Deja la evidencia |
| `infra/ops/lib/migracion.sh` | el VPS (y el entorno de prueba) | El envoltorio: la migración y su fila del ledger en una sola transacción. Lo comparten el reset de prueba (SDD-0540) y estos scripts |
| `infra/ops/migraciones/retirar-espera.mjs` | tu checkout | Después de aplicar, saca la migración de `pendingBelowCutoff` y de las declaraciones de símbolos, la **sella** en el candado con el md5 aplicado y lista las pruebas que afirman la espera |
| `scripts/migrations-lock.mjs` | tu checkout y el CI | El candado de las migraciones aplicadas (`supabase/migrations.lock.json`, SDD-0561): falla si una migración sellada cambia, se borra o se renombra. Sella una nueva (`sellar`), registra un cambio aceptado (`excepcion`) y marca contra un volcado del ledger cuáles coinciden con su fila (`ledger`, §7) |

**Instalar en el servidor** (una vez después de cada merge que cambie
`infra/ops/migraciones/aplicar.sh` o `infra/ops/lib/migracion.sh`; lo hace quien
opera el servidor, con su OK): copiar esos dos archivos **desde `main`** a
`/srv/ops/migraciones/aplicar.sh` y `/srv/ops/lib/migracion.sh`, con permisos
`755` y `644` (o `700`, porque solo root los usa: así quedó `lib/migracion.sh` el 2026-10-17), y comparar `sha256sum` con el checkout. `aplicar-remoto.sh` se niega
a correr si no coinciden: así el servidor corre lo revisado, o no corre.

En Windows, el ssh que usa la llave del agente es el de System32:

```bash
export MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe
export MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe
```

No exportes `MSYS_NO_PATHCONV` para estos scripts (el scp de Windows necesita
las rutas convertidas).

## 2 · Antes de pedir el OK

1. **La PR** trae la migración con su espera declarada en
   `supabase/migrations-baseline.json › pendingBelowCutoff` (motivo, orden
   migrate-first y «Requiere OK nominal de Sam») y el CI en verde. Lee la línea del
   gate de símbolos: tiene que decir `0 ROJO` y los amarillos solo de esa migración.
2. **El ensayo en prueba**, cuando la migración lo amerita: SDD-0540 y
   `docs/runbooks/entorno-prueba.md` §4. El md5 del ledger de prueba tiene que ser
   el mismo que tendrá producción.
3. **La hora real.** Mira `date -u` y resta 4 h para Caracas. Elige un momento de
   poco tráfico si la migración toma locks fuertes (lo dice su cabecera).
4. **El paquete**, desde el SHA de la **cabeza de la PR** (el blob que se va a
   fusionar):

   ```bash
   node infra/ops/migraciones/preparar.mjs --sha <40 hex de la cabeza> \
       --migracion 0492_algo --sdd <NNNN de la SDD de la migración> --salida <carpeta nueva>
   ```

   Imprime el blob, su md5 y sus bytes, el `created_by`
   (`servidor-propio:psql:SDD-NNNN`), las funciones que reemplaza, si trae
   preflight propio y el md5 de `aplicar.sql`. **Copia los valores de identidad de
   esta salida, sobre la cabeza final**, nunca de una medición anterior: si la PR
   cambia, prepara otra vez.

   Se niega (código 3) si el archivo tiene CR, una línea que empieza con barra
   invertida (psql la tomaría como meta-comando), su propio `begin`/`commit`, el
   delimitador `$migNNNN$`, o un bloque `$preflight$` que escribe. En ese último
   caso, revísalo a mano y usa `--sin-preflight-propio` (queda en `IDENTIDAD.txt`).

5. **La lectura previa** (solo lectura; no necesita el OK de aplicar, solo lee el
   ledger y el catálogo):

   ```bash
   infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 \
       --proyecto dtd-cargo --confirm dtd-cargo \
       --esperada 0492_algo --paquete <carpeta> --paso previa
   ```

   Corre `previa.sql` en `begin transaction read only … rollback`:
   - el ledger: filas, última versión y que la migración **no** esté ya;
   - sesiones esperando locks y transacciones de más de un minuto;
   - la **deriva** de cada función que la migración crea o reemplaza (§9);
   - el bloque `do $preflight$ … $preflight$;` de la migración, tal cual.

   Si falla (código 5) no se aplicó nada: lee `previa.err` en la evidencia.

## 3 · El pedido del OK

El pedido a Sam nombra, por migración: el archivo exacto, la SDD y la PR, el md5 y
los bytes del blob, el resultado de la lectura previa (con la ruta de su
evidencia), el ensayo en prueba si lo hubo, el orden (migrate-first: «aplico y
fusiono la PR enseguida») y cómo se vuelve atrás (§8). Si hay smoke, nombra las
pantallas y los roles.

Guarda la respuesta **literal** de Sam en un archivo (con la herramienta de
escritura, no con un heredoc). `aplicar.sh` exige ese archivo en producción y se
niega si **no nombra el número** de cada migración (`0492`, o `0240b` para una con
letra; `09921` no nombra la `0992`). Si Sam aprobó una lista que escribió el
Director, el archivo lleva la lista citada y la respuesta de Sam.

## 4 · Aplicar

```bash
infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 \
    --proyecto dtd-cargo --confirm dtd-cargo \
    --esperada 0492_algo --paquete <carpeta> \
    --autorizacion <archivo con el OK literal>
```

Primero prueba con `--en-seco`: comprueba todo en local e imprime los comandos,
sin ssh.

En el servidor, `aplicar.sh`:

1. Comprueba el paquete antes de tocar la base: `SHA256SUMS`, que `IDENTIDAD.txt`
   sea de esa migración y de `dtd-cargo`, el md5 de `aplicar.sql`, que
   `aplicar.sql` sea **exactamente** el envoltorio de `migracion.sql` (lo rehace
   con `lib/migracion.sh` y compara), que `previa.sql` y `verificar.sql` abran
   `begin transaction read only` y cierren con `rollback`, y que `created_by` sea
   el de producción.
2. Toma el candado `/run/lock/dtd-migraciones.lock.d`: una aplicación a la vez.
3. **Repite la lectura previa** justo antes. Si falla, no aplica (código 5).
4. **Aplica** `aplicar.sql`: `\set ON_ERROR_STOP on`, `begin;`, el texto exacto
   del archivo, el `insert` de su fila en el ledger y `commit;`. Un error en
   cualquier punto deshace todo: ni objeto ni fila (código 6).
5. **Verifica** en solo lectura (código 7 si algo no coincide):
   - una sola fila con ese `name`;
   - `md5(array_to_string(statements, ''))` y los bytes iguales al blob;
   - el cuerpo vivo (`md5(prosrc)`) de cada función que crea, igual al del archivo;
   - y reporta `SECURITY DEFINER`, `search_path` y `EXECUTE` de `anon` y
     `authenticated`.

psql corre con `-X -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never`:
un error no copia en la evidencia el `DETAIL` (que puede traer valores de filas)
ni el contexto.

**Códigos de salida:** 0 listo · 2 uso inválido · 3 rechazado por una guarda
(también: candado tomado, scripts del servidor distintos de tu checkout, ssh o scp
que no conectan) · 4 integridad · 5 la lectura previa falló, no se aplicó nada ·
6 el apply falló, se deshizo · 7 **se aplicó** pero la verificación no coincide ·
255 ssh se cayó durante el apply: **no se sabe** si llegó al COMMIT.

Con 7 o 255 **no repitas** el apply. Para el 255, corre `--paso previa`: si dice
«ya está en el ledger», se aplicó; la evidencia está en `/srv/ops/evidencias/`.

### Varias migraciones (lote)

Repite `--esperada … --paquete …` en el orden de aplicación. Cada una va en **su**
transacción y con **su** evidencia, de a una, nunca en bundle: si la 0236 falla
sola, su error señala su dependencia; un bundle atómico habría devuelto un error
que no explica nada (así se encontró la 0228, §13). El lote para en la primera
falla y no copia ni toca las siguientes. El archivo de autorización tiene que
nombrar cada una.

## 5 · Inmediatamente después: fusionar

Migrate-first: la base nueva convive con la web vieja hasta que la web nueva entra.
Por eso el Director fusiona la PR **segundos después** del COMMIT, con su propia
autorización de merge y `gh pr merge <n> --merge --match-head-commit <sha del
paquete>`. Fusionar es publicar: la web entra sola en el VPS (~6 min, SDD-0541).

Si el OK de aplicar todavía no llegó, la PR **se publica (push) con la espera
declarada** y se queda sin fusionar: un solo CI sirve para los dos caminos. No la
fusiones sin aplicar: la puerta de migraciones frena toda publicación siguiente
(§10).

## 6 · El cierre

1. En una rama de cierre (nunca en `main`):

   ```bash
   node infra/ops/migraciones/retirar-espera.mjs 0492_algo --md5 <md5 del ledger>
   node scripts/migrations-lock.mjs
   ```

   Quita la entrada de `pendingBelowCutoff` y sus declaraciones de
   `pending-migration-symbol-declarations.json`, sin reformatear los archivos, y
   **sella la migración** en `supabase/migrations.lock.json` (SDD-0561) con el
   sha256, el md5 y los bytes del archivo, marcada `ledger` exacta. El `--md5` es el `blob_md5=` de
   `IDENTIDAD.txt` en la evidencia del apply, el que la verificación comparó con el
   ledger (código 0), copiado de ahí. Si el archivo no tiene ese md5, sale con 3 y no escribe nada: o el
   archivo cambió después del apply o el md5 es de otra migración. También lista las
   pruebas que nombran la migración junto con `pendingBelowCutoff`: cámbialas a mano
   para que dejen de afirmar la espera (ejemplo: la de la 0491 en el commit
   `2bb0c817`). `--en-seco` muestra lo que haría. La segunda línea comprueba el
   candado: tiene que salir con 0.

   Si dos cierres chocan en `migrations.lock.json`, toma el candado de `main` y
   vuelve a correr `node scripts/migrations-lock.mjs sellar <nombre> --md5 <md5>`
   para la tuya. No edites los hashes a mano.
2. **La cabecera «NO APLICADA A PRODUCCIÓN» del `.sql` no se corrige**: el ledger
   del servidor propio guarda el texto exacto y la identidad se prueba por md5. Desde la SDD-0561 el
   candado lo hace cumplir: cambiar un byte de una migración sellada hace caer
   `scripts/tests/migrations-lock.node.mjs` en el CI y en `pnpm verify`. Los
   comentarios de código en condicional («mientras X esté en pendingBelowCutoff…»)
   que viven **fuera** del `.sql` sí se reescriben al comportamiento vigente.
3. Registra en la SDD y en el handoff: hora del COMMIT, `version` del ledger, md5
   y bytes, filas del ledger, ruta de la evidencia, el OK literal y la hora del
   merge.

## 7 · Ledger y evidencia

- `name` = basename exacto del archivo, sin `.sql`. Es lo que leen el gate
  `migrations-applied` y la puerta de `publicar-web.sh`.
- `version` = la hora real del apply en UTC (`YYYYMMDDHH24MISS`), calculada por el
  servidor dentro de la transacción.
- `statements` = un solo elemento con el archivo exacto, **con** su salto final.
  En filas viejas de Cloud la convención varió (la 0471 sin el salto, la 0472 con
  él): calcula las dos variantes antes de declarar una diferencia.
- **El candado no es el ledger.** `supabase/migrations.lock.json` fija el archivo del
  repo. Su md5 y sus bytes son los de la fila del ledger solo en las entradas con
  `ledger` ({ fecha, forma }). En el cruce del 2026-10-19 (lectura `READ ONLY` del
  Director) fueron 143 de 483: 95 exactas, 28 sin el salto final y 20 con un CRLF
  agregado. Las demás son filas de Cloud con otro texto (partido o sin comentarios)
  o con otro nombre (SDD-0561 § Cruce con el ledger). Para medir otra vez, guarda la
  salida de la consulta de la SDD-0561 como `[{ name, md5, bytes }]` **fuera del
  repo** y corre `node scripts/migrations-lock.mjs ledger <archivo> --fecha AAAA-MM-DD`:
  marca las coincidencias, no copia md5 del ledger y se niega si contradice una
  marca anterior.
- `created_by` = `servidor-propio:psql:SDD-NNNN` en producción y
  `servidor-propio:psql:prueba:SDD-NNNN` en prueba. Las filas de Cloud llevan el
  correo de la cuenta.
- La evidencia lleva los cuatro scripts, `IDENTIDAD.txt`, `AUTORIZACION.txt`, las
  salidas de psql (`.out`/`.err`), `registro.txt` y `SHA256SUMS`. Las consultas
  leen solo el ledger y el catálogo: ni secretos ni filas de negocio. Lo único
  que viene de la migración son sus `NOTICE`: quien la escribe no imprime datos
  personales en ellos.

## 8 · Volver atrás

No hay vuelta atrás automática ni migraciones «down» globales. Depende de dónde
falló:

| Situación | Qué hacer |
|---|---|
| Falló antes del COMMIT (códigos 5 y 6) | No hay nada que deshacer: la transacción se deshizo entera. Lee `previa.err` o `aplicar.err`, corrige en la PR, prepara otra vez desde el SHA nuevo |
| Se aplicó y la verificación no coincide (7) | No repitas. Lee `verificar.err`: ¿fila duplicada, md5 distinto, cuerpo vivo distinto? Avisa al Director y a Sam antes de fusionar |
| Se aplicó y la PR todavía no se fusionó | Decide con Sam si se fusiona igual. Si la migración rompe la web vieja, fusionar es lo que la arregla |
| Se aplicó y la web nueva falla | `publicar-web.sh volver` devuelve la web a la imagen anterior (no toca la base) y `congelar` para la publicación automática (`publicacion-automatica-web.md`). La base nueva tiene que ser compatible con la web vieja: lo exige migrate-first |
| Hay que deshacer el cambio de la base | Una **migración nueva**, numerada, que revierta, con su PR, sus pruebas y el mismo procedimiento con OK nominal. Evalúa la compatibilidad caso por caso. Hay dos escritos: `docs/runbooks/deploy-orden-venta-0072.md` y, para la 0497, `supabase/desarmes/0497_desarme.sql`, que dice en su cabecera lo que se pierde |
| Último recurso | Restaurar un respaldo (`backup-restore-servidor.md`, `restore.sh` con su guarda): pierde lo escrito desde el dump. Solo con decisión de Sam |

**Nunca**: borrar o editar la fila del ledger para «reintentar», editar una
migración aplicada, renumerarla, ni aplicarla otra vez con otro nombre.

El candado (`supabase/migrations.lock.json`, SDD-0561) hace fallar la prueba si una
migración sellada cambia (`CAMBIADA`), se borra o se renombra (`FALTA`), o si aparece
un archivo nuevo con número viejo (`SIN_SELLO`). Si de verdad hace falta cambiar una
aplicada, por ejemplo un comentario que induce a error, la salida es una **excepción
explícita y revisable**, decidida por Sam o el Director:

```bash
node scripts/migrations-lock.mjs excepcion 0464_algo \
    --motivo "por qué cambia y qué cambia" --autorizacion "quién lo aceptó, cuándo y dónde"
```

La excepción agrega a la entrada la fecha, el motivo, la autorización y la identidad
nueva del archivo. La identidad sellada de la raíz no cambia: es la del archivo al
sellarlo y, si la entrada tiene `ledger`, también la de su fila del ledger (§7). Las
excepciones solo se agregan. Reescribir un sello a mano o
regenerar el candado no es una salida: la prueba lo detecta contra el conjunto
sellado al crearlo y, con `origin/main` a mano, contra el merge-base (`HISTORIA`).

## 9 · Deriva: una función viva distinta del repo

Si una migración hace `create or replace` sobre una función cuyo cuerpo vivo no
es el que el repo cree, puede pisar un arreglo hecho fuera de banda o abortar en
su propio preflight. Pasó: `next_receipt_code` difiere de la 0079 solo en
espacios (handoff 0488); `comment_entity_in_tenant` perdió sus comentarios en
Cloud (handoff 0506) y `client_delivery_addresses_validate_client` también (handoff
0453); `validate_operario_pin_format` tiene otra lista de PIN débiles (SDD-0515).

La lectura previa compara, para cada función que la migración crea, todos los
cuerpos vivos con ese nombre contra los que le dio el repo antes:

| Estado | Qué significa | ¿Frena? |
|---|---|---|
| `nueva` | No existe en vivo ni en el repo | No |
| `igual` | md5 exacto del último cuerpo del repo | No |
| `igual sin espacios` | difiere solo en espacios | No |
| `igual sin comentarios` | difiere en comentarios y espacios (como lo dejaba Cloud) | No |
| `cuerpo anterior del repo` | es un cuerpo que una migración posterior reemplazó: falta aplicar algo | **Sí** |
| `cuerpo desconocido` | no es ningún cuerpo del repo: cambio fuera de banda | **Sí** |
| `falta en vivo` | el repo la define y en vivo no existe | **Sí** |
| `existe sin definición previa en el repo` | existe en vivo y el repo no la había definido | **Sí** |

Si frena:

1. **No apliques.** Lee el cuerpo vivo en solo lectura (catálogo, sin filas):
   `select pg_get_functiondef('public.<función>(<args>)'::regprocedure);`.
2. Compáralo con el del repo (`git log -p` de la última migración que la define).
3. Devuélvelo al Worker de la migración: o la migración acepta esa forma en su
   preflight y se prueba con ella (PGlite), o se repone el cuerpo del repo con
   otra migración.
4. Solo si Sam decide pisar la versión viva: prepara otra vez con
   `--acepta-deriva esquema.funcion`, una por función. Queda en `IDENTIDAD.txt` y
   en la tabla de la previa.

Límites (detalle en la spec): la comparación es por nombre, no por firma; las
funciones creadas dentro de SQL dinámico no se miran; y `igual sin comentarios`
no frena porque los comentarios no cambian el comportamiento, pero el preflight
propio de la migración sí puede exigir el md5 exacto.

## 10 · La puerta de migraciones de la publicación automática

`infra/ops/web/publicar-web.sh` (SDD-0541) no publica una imagen si falta en el
ledger alguna migración que ese commit exige. La imagen trae la lista en
`org.dtdcargo.migraciones`: **todas** las de número mayor al corte (238),
**incluidas** las esperas de `pendingBelowCutoff` (`publicable.mjs`, «Las esperas
no se eximen»). Consecuencias:

- El orden normal es: aplicar → fusionar → la imagen se construye → se publica.
- Si se fusiona una PR con su migración sin aplicar, **ninguna** publicación
  posterior entra hasta aplicarla, y el aviso dice «faltan en la base …».
- Una espera que de verdad va **después** de la web (0422 y 0423, decisión B1 de
  Sam) se acepta en el servidor una por una:
  `publicar-web.sh aceptar-pendiente <nombre>`, con el OK de Sam.

## 11 · Las esperas y los gates

- `pendingBelowCutoff` es la lista de lo que todavía no se aplica, con su motivo.
  Cada entrada se imprime en cada corrida del gate. Al aplicar, se retira (§6).
- `scripts/check-migrations-applied.mjs` (`migrations-applied` en `pnpm verify`)
  lee el ledger por la RPC `applied_migration_names()` (0239), y solo en
  producción: `NEXT_PUBLIC_SUPABASE_URL` tiene que ser `https://supabase.dtdcargo.com`
  (SDD-0548). Imprime el origen que midió, sin credenciales. Supabase Cloud, que
  quedó congelado en el corte, cualquier otro host, `http`, un puerto o una URL con
  usuario o clave dan SKIP **sin consultarlos**. Sin credenciales también da SKIP,
  y un SKIP **no** es verde: una afirmación de que una migración no está aplicada
  se comprueba contra producción (la lectura previa lo hace) o se escribe NO
  VERIFICADO.
- `scripts/check-pending-migration-symbols.mjs` marca AMARILLO los símbolos
  declarados de una espera: una PR migrate-first sale verde antes de aplicar.
- El reset de la base de prueba salta las esperas (SDD-0540).
- Algunas pruebas de migración afirman la espera (`expect(pendingBelowCutoff[…])`):
  cambian en el cierre.

## 12 · Probar estas piezas

| Prueba | Qué cubre |
|---|---|
| `bash infra/ops/tests/prueba-migraciones-produccion.sh` | Con dobles de docker, ssh y scp: rechazos de `preparar.mjs`, guardas de `aplicar.sh`, en seco, el orden previa → apply → verificación, los códigos 5/6/7, la evidencia, el candado, la autorización nominal, el lote y ssh caído |
| `bash … --mutantes` | Control rojo (scripts vacíos) y cada guarda quitada tiene que hacer caer la suite |
| `pnpm vitest run infra/ops/tests/migraciones.test.mjs` | Las funciones de `preparar.mjs`; paridad byte a byte con `lib/migracion.sh`; contra PostgreSQL embebido (PGlite) la lectura previa, la deriva, el apply y la verificación; el cuerpo extraído igual al `prosrc` en funciones reales; `retirar-espera.mjs`, con el sello y su md5 |
| `node infra/ops/tests/prueba-0497-rol-real.mjs --paquetes <carpeta>` | Docker, **corrida pesada**. La 0496 y la 0497 con el rol de producción (`postgres` sin superusuario, imagen real, esquema completo): paquetes reales, RPC con filas sembradas, salidas con excepción, legado, el desarme y contratos. PGlite y `postgres:17` corren como superusuario y no ven esto |
| `node --test scripts/tests/migrations-lock.node.mjs` (también en `pnpm harness:test`) | El candado sobre el repo real y su ancla de creación; cada regla (`FORMATO`, `FALTA`, `CAMBIADA`, `ESPERA`, `SIN_SELLO`, `HISTORIA`) sobre copias; `sellar`, `excepcion`, `ledger` (exacta, variantes de Cloud, contradicciones), `crear` y los códigos de la CLI |

Nada de esto se conecta al servidor ni a una base real.

## 13 · Histórico: Supabase Cloud (hasta el 2026-10-14)

> **HISTÓRICO.** Hasta el corte, producción era el proyecto de Cloud
> `xpfuzqombmjmxvprjgmi`. Cloud quedó como copia del momento del corte, sin las
> migraciones posteriores, y se pausa en la Fase 4 (`servidor-contabo.md` §4). Lo
> de abajo explica el pasado y las trampas que siguen valiendo; **no** es un
> procedimiento vigente.

**Cómo se aplicaba.** Con el conector de Supabase (`apply_migration`), de a una y
con el basename exacto como `name`. El MCP local era de solo lectura; el conector
de claude.ai escribía (medido el 2026-07-30 y el 2026-08-13). La identidad se
probaba por md5 y bytes del ledger contra el blob.

**Por qué existe este runbook.** Dos veces se perdió una migración por el mismo
mecanismo: el conocimiento vivía en un handoff que nadie releyó.

- La **0228** (`suppliers_cn_extended_fields`) estuvo dos rondas perdida: su
  cabecera decía «esperando decisión del founder», llegó a `main`, nadie la
  aplicó, y la ronda siguiente construyó la 0236 encima. Reventó con
  `column s.industry does not exist`.
- La **0169** (`public_verify_throttle`) cayó en la misma trampa y dejó
  `/verificar` sin throttle (fail-open) con `student_name` expuesto. Se aplicó el
  2026-07-16.
- El 2026-08-01 las **0317–0324** llegaron a `main` con su código sin estar en la
  base: el gate leía el checkout atrasado y salió verde por omisión. Desde la
  SDD-0248 mide `origin/main` ∪ el checkout.

Moraleja: una nota en un handoff no es un mecanismo. Por eso existen el gate, las
esperas declaradas y, ahora, la puerta de la publicación automática.

**Trampas que siguen valiendo:**

- **El `name` del ledger fue texto libre** hasta la 0238: 168 coincidían con el
  basename, 44 vivían con otro nombre (`0001_init_tenancy` → `init_tenancy`) y
  ~13 se aplicaron fuera de banda. Por eso el gate usa un corte (238) y no un
  cruce 1:1. El corte no se sube por reflejo.
- **Verifica contra el objeto, no contra el nombre**: `to_regclass`, columnas en
  `information_schema`, `pg_policies`. Una sonda floja engaña: un
  `create or replace` compartido no dice cuál corrió.
- **Los huecos de numeración en disco son normales** (0061–0065, 0089, 0099,
  0111, 0112). No los «arregles».
- **`service_role` no llega al ledger** por PostgREST: por eso la RPC
  `applied_migration_names()` (0239), security definer y solo para
  `service_role`.
- **Un backfill puede ser peor que ninguno** (0238 escribía una fecha inventada).
- **Verifica los tipos contra producción**, no contra el fixture (`date` contra
  `timestamptz`).
- **Califica las extensiones** (`extensions.gen_random_*`), pon `search_path` en
  toda función security definer y haz un `revoke` explícito en toda RPC nueva.
- **Un heredoc puede comerse una barra invertida** (2026-10-15): `\set` quedó en
  `set`, psql juntó la línea con la siguiente y se tragó el
  `begin transaction read only;`. Por eso los `.sql` los genera `preparar.mjs`, y
  `aplicar.sh` exige `\set ON_ERROR_STOP on` en la primera línea útil y que la
  salida empiece en `BEGIN` y termine en `ROLLBACK` o `COMMIT`.
