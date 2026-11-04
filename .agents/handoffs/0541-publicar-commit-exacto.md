# Handoff — SDD-0541 · commit exacto, marcha atrás y valores por defecto

Fecha: 2026-11-02 UTC. Owner: `claude-0541-compose-softagentes`, sesión Worker abierta por el Director.
Worktree: `.claude/worktrees/funny-chatterjee-390769`. Rama: `claude/0541-compose-softagentes`.
Base: `1c2286f1f`. Estado: **IMPLEMENTADO Y VALIDADO LOCALMENTE; integración e instalación pendientes**.

Autorización, transmitida por el Director: Sam dijo, literal, «Sí, corrígelos», sobre lo que halló la segunda revisión de Codex. No cubre instalar en el VPS, descongelar ni publicar. Nada de eso se hizo.

## OBJETIVO ORIGINAL

1. Decir si el script ya permite publicar un SHA o digest exacto con el timer apagado y encenderlo después, como paso aparte.
2. Identificar, solo lectura y sin leer `.env`, las imágenes de los dos caminos de marcha atrás, y proponer cómo conservarlas, sin presentarlo como recuperación completa.
3. Repuntar `infra/dtd-cargo/compose.yml:47` e `infra/dtd-cargo/.env.example:36` con una prueba de los dos literales, quitar la mención al bot de deploy (líneas 60-61) y describir la ventana.
4. Sumado por el Director el 2026-11-02: la imagen de `storage` pasa a `DTD_STORAGE_IMAGE` en esta misma PR, en borrador y sin instalar nada.

## COMPLETADO

### 1. Commit exacto: ya se puede, sin cambiar el script

`publicar-web.sh publicar <sha40> --aunque-congelado` baja `sha-<sha>`, exige que su etiqueta de revisión sea ese commit, pasa las mismas puertas y fija `…:sha-<sha>@<digest>`. `CONGELADO` no se toca. El hallazgo de Codex es correcto para `descongelar` más timer: `vigilar` sigue `:publicable`. El procedimiento quedó en el runbook, sección «Publicar un commit exacto y encender después».

Límites:

- `publicar` no recibe el digest: lo resuelve al bajar `sha-X`, y volver a correr `build-image.yml` sobre `X` movería esa etiqueta. Se controla comparando el digest de `revisar X` con el de `estado`.
- `publicar` no mira el CI. Por eso `X` debe ser lo que `revisar`, sin sha, da como `:publicable`.
- Al encender entra lo que diga `:publicable` en ese momento, salvo que esté rechazada.

### 2. Marcha atrás, medido el 2026-11-02 00:14Z

| Camino | Imagen | ID | Revisión | Disco | Registro |
|---|---|---|---|---|---|
| Falla la publicación: `DTD_WEB_IMAGE` previo | `sha256:cd041ea4…` (`.Config.Image` del contenedor), etiqueta `manual-node-release/dtd:sha-929cabf51…` | `cd041ea4405858c1…` | `929cabf51`, Node 24.22.1 | Sí | **No**: `manifest unknown` en `softagentes` y en `hailuwaycom-sketch`. Única copia |
| `volver` hoy: `estado/anterior` | `ghcr.io/hailuwaycom-sketch/dtdcargo:sha-f9b86db1…@sha256:1ce9a254…` | `1ce9a254d61e009a…` | `f9b86db1b`, Node 24.21.0 | Sí, sin etiqueta | Con ese nombre, no. `ghcr.io/softagentes/dtdcargo:sha-f9b86db1…`, sí |

- `volver` deja de apuntar a `hailuwaycom-sketch` con la primera publicación que sale bien: `estado/anterior` pasa a `sha256:cd041ea4…`. Lo cubre una prueba nueva.
- Si la publicación falla y vuelve sola, `estado/anterior` no cambia, y `volver` bajaría la web a `f9b86db1b`. Queda escrito en el runbook.
- `f9b86db1b` está 4 commits detrás de `929cabf51`, sin migraciones de diferencia.
- Nada automático borra `cd041ea4…`: `limpiar_imagenes` solo toca la dirección nueva, y una búsqueda en `/etc/cron*`, `/etc/systemd/system`, `/var/spool/cron`, `/usr/local/bin` y `/srv/ops` no halló `prune`. Un `prune -a` a mano sí la borraría en cuanto deje de correr.
- La propuesta para conservarla está en el runbook: `docker save` con su hash antes de publicar y una copia fuera del servidor. Ahora incluye también la imagen de `storage`. **No está hecha**: es una escritura en el VPS y espera el OK de Sam. La restauración está **NO PROBADA**.

Queda escrito que no es una recuperación completa. Con la web `929cabf51` sobre la base con la 0497, una factura emitida queda sin asiento, y la prueba rápida 14/0 no lo ve: `smoke-web.sh` no inicia sesión ni escribe. El efecto en facturas viene del informe del ensayo de la SDD-0573; esta tarea no lo volvió a medir.

### 3. `compose.yml` y `.env.example`

- `compose.yml:47` y `.env.example:36` pasan a `ghcr.io/softagentes/dtdcargo:main`. Esa etiqueta responde en el registro (`docker manifest inspect`, 2026-11-02).
- El comentario de `compose.yml:60-61` ya no nombra el bot. Sigue en dos líneas, así que no corre ninguna referencia.
- `infra/ops/tests/publicable.test.mjs`: dos literales y `infra/dtd-cargo` en la lista de carpetas limpias.
- Ventana: runbook, sección «Instalar `compose.yml`, `compose.supabase.yml` y `.env.example`».

### 4. `compose.supabase.yml`: `DTD_STORAGE_IMAGE`

Hallazgo de esta tarea, y decisión del Director del 2026-11-02. Medido con `huellas-fuera-de-imagen.sh servidor /srv/dtd-cargo` contra la etiqueta de `:publicable` (`1c2286f1f`): `compose.supabase.yml` da `482f540c7e0e61f0` en la etiqueta y `a00bd8adfa66438a` en el servidor. Las otras ocho rutas coinciden.

- **Diferencia:** una línea, la imagen de `storage`. El servidor tiene `sha256:7ec9901d34a3…`, editado el 2026-10-25 03:51Z; el repo tenía `supabase/storage-api:v1.77.6`.
- **Esa imagen:** `node-runtime-patch:c99920016d60-24.22.1-no-refresh`, derivada de la oficial, 1,48 GB, armada el 2026-10-25 03:36Z. `docker image history` muestra dos agregados sobre la oficial.
- **Node:** `node -v` dentro de `dtd-cargo-storage-1` da `v24.22.1`, aunque la imagen declara `NODE_VERSION=24.21.0`.
- **`ENV DB_ALLOW_MIGRATION_REFRESH=false`:** no estaba en el análisis del Director ni en el mío de antes. Según `internal/database/migrations/migrate.js` de la imagen, si los hashes de `storage.migrations` no coinciden, con `false` no arranca; sin ella, los reescribe en la base al arrancar. Los tres contenedores la tienen, y no está en ningún compose ni en el repo: vive solo en la imagen.
- **Solo está en el disco del VPS.** La etiqueta es local, y `docker manifest inspect` no responde. La oficial también está en el disco. La hermana `node-runtime-patch:c99920016d60-24.22.1` (`ee760a6d2788`) tiene Node pero no esa variable: no la reemplaza.
- **Por qué no salió en V6:** `puertas()` para en la primera cerrada, y «faltan 2 de 258» tapó esta. Al aplicar la 0496 y la 0497, `revisar` dirá «el servidor no tiene la misma copia», y su mensaje manda a copiar el archivo del repo.
- **Motivo del parche:** inferido. El handoff de Node 24.22.1 dice que los parches locales de Contabo se conservan; el informe del parche no se encontró. Por qué se agregó la variable: NO VERIFICADO.

Qué cambia:

- `image: ${DTD_STORAGE_IMAGE:-supabase/storage-api:v1.77.6}`, sin correr líneas: el comentario sigue en tres.
- `.env.example` la documenta comentada. Un servidor nuevo usa la oficial.
- `prueba-resetear-base-efimera.sh` leía el compose con `image: supabase/storage-api:`, y con la variable se quedaba sin imagen. Ahora la encuentra, y hay prueba de eso.

| Huella | Antes en el servidor | Ahora en el repo |
|---|---|---|
| `compose.yml` | `1a67944a24958c08` | `483f923fd4339358` |
| `compose.supabase.yml` | `a00bd8adfa66438a` | `8510b279049ca345` |
| `.env.example` | `c63acb8bf8a1f7e8` | `4945f3f0ee5bf29d` |
| Las otras seis | | Sin cambios |

Medido en el VPS el 2026-11-02 a las 02:28Z, solo lectura:

| Proyecto | Archivo que lee | Hash de `storage` igual a su etiqueta | ¿Le afecta? |
|---|---|---|---|
| `dtd-cargo` | `/srv/dtd-cargo/compose.supabase.yml` | `c62280716fed4bab…` | Sí, en la ventana |
| `dtd-cargo-staging` | Su copia, con la misma huella y el mismo id | `1f74912975489e72…` | Cuando se copie `infra/dtd-cargo` ahí: antes hace falta la misma línea en su `.env` |
| `loop-3d` | Su propio `/srv/loop-3d/compose.yml:387`, con el id escrito | No medido | No. Solo comparte la imagen |

`docker ps --filter ancestor=` da solo esos tres contenedores con esa imagen, así que `/srv/loop-3d-staging` no la corre.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `vitest run infra/ops/tests/publicable.test.mjs --pool=threads`, con los literales viejos | ROJO esperado: 3 fallos, los tres de esta tarea |
| Lo mismo, con el cambio | PASÓ, 41 de 41 |
| Vitest de `infra-env-example`, `entorno-prueba-compose`, `entorno-prueba-semilla` y `ci-workflow-contract` | PASÓ, 82 de 82 en 4 archivos |
| `prueba-publicar-web.sh` en Git Bash, con sustitutos locales de `flock` e `install` | 209 PASÓ y 5 FALLÓ, todos fuera de los bloques nuevos. Los dos bloques nuevos: 14 de 14 |
| Los 5 rojos de esa corrida | `permisos del .env: 644`, `candado rc=0` y `escribió sin el candado` son del entorno Windows. `lector: sin salida` (dos veces, parser del Studio) no tiene causa comprobada: decide el CI en Linux |
| Mutantes de esta tarea, contados contra esa línea base | MUERTOS los 3: `--aunque-congelado no alcanza` (8 rojos nuevos), `publicar a mano descongela` (3), `publicar no registra la anterior` (10). En Git Bash el código de salida no los distingue; en el CI, sí |
| Prueba de `storage` en `entorno-prueba-compose.test.mjs`, antes del cambio | ROJO esperado: 3 de 4 fallan. La cuarta, la del overlay, ya era cierta |
| Mutantes de esa prueba | MUERTOS los 9: literal fijo, id fijo, otra versión, otro id por defecto, variable obligatoria, línea activa en el ejemplo, ejemplo sin la línea, patrón viejo de la prueba efímera y overlay que fija la imagen |
| Vitest de `entorno-prueba-compose`, `publicable`, `infra-env-example`, `entorno-prueba-semilla`, `ci-workflow-contract` y `entorno-prueba-scripts` | PASÓ, 129 de 129 en 6 archivos |
| `prueba-compose-prueba.sh`, con `docker compose config` real y un `.env` falso, sin motor de Docker | PASÓ, 10 de 10 |
| Hash de `storage` en local, compose 5.6.0 y `.env` falso | Literal del servidor, literal con la línea y archivo nuevo con la línea dan el mismo. Sin la línea cambia, y es el control rojo. Línea vacía: cae a la oficial |
| `prueba-resetear-base-efimera.sh` | NO EJECUTADO, es una corrida pesada con Docker. Solo se probó que su patrón encuentra la imagen |
| `prueba-publicar-web.sh` en Linux, corrida `41379296547` sobre `9d0758286` | PASÓ: 214 PASÓ, exit 0. Son los 209 de Git Bash más los 5 rojos de allí, así que esos 5, incluidos los dos de `lector: sin salida`, no se reproducen en Linux. El CI solo imprime el total, no cada línea |
| Resto de esa corrida | PASÓ: Unitarios 13241 pasan y 1 se omite, ESLint, TypeScript, Edge Functions, `docs:check`, `sdd:check`, build sin secretos y árbol reproducible |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio de producto es nulo y la máquina es compartida; lo mide el CI |

## COMMITS

Se listan en la PR.

## PR / BRANCH

`claude/0541-compose-softagentes`, en borrador contra `main`. No se fusiona desde aquí.

## PENDIENTES DE ESTA TAREA

1. Integrar la PR. El merge arma imagen y mueve `:publicable`, sin tocar la web.
2. La ventana, con su OK: conservar las dos imágenes, agregar la línea al `.env`, instalar los archivos y publicar `X`.
3. Cuando se copie `infra/dtd-cargo` al entorno de prueba, la misma línea antes en su `.env`.

Encender el timer es un paso aparte, con su propio OK.

## FUERA DE ALCANCE DETECTADO

- `infra/dtd-cargo/compose.yml:44-46` y `.env.example:33-35` todavía describen el despliegue como `docker compose pull` a mano. También es la misma huella.
- `.Config.Image` y `estado/publicada` no coinciden: `publicada` quedó en `8e9e0f505`, porque `929cabf51` se puso a mano. Lo corrige la primera publicación por el script.
- Kuma es el único aviso de una falla: el Director midió `Telegram: SIN CONFIGURAR`.

## HANDOFF AL DIRECTOR

Antes de pedir el OK de publicar, instalar esta PR en la ventana y repetir la comparación de huellas. `revisar` no alcanza mientras falten migraciones.

Decisión del 2026-11-02, respuesta literal en esta sesión: «Sí, déjala fuera». `DB_ALLOW_MIGRATION_REFRESH=false` sigue viviendo solo en la imagen y no entra en esta PR. Declararla en `compose.supabase.yml` cambia el hash de `storage` y lo recrea en el próximo `up`, así que necesitaría su propia ventana. Límite que queda: un servidor con la oficial, como un entorno de prueba con su `.env` nuevo, reescribe los hashes si no coinciden. El detalle y la evidencia están en la nota de la carpeta compartida, `0541-commit-exacto-worker.md`.
