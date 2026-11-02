# Handoff — SDD-0541 · commit exacto, marcha atrás y valores por defecto

Fecha: 2026-11-02 UTC. Owner: `claude-0541-compose-softagentes`, sesión Worker abierta por el Director.
Worktree: `.claude/worktrees/funny-chatterjee-390769`. Rama: `claude/0541-compose-softagentes`.
Base: `1c2286f1f`. Estado: **IMPLEMENTADO Y VALIDADO LOCALMENTE; integración e instalación pendientes**.

Autorización, transmitida por el Director: Sam dijo, literal, «Sí, corrígelos», sobre lo que halló la segunda revisión de Codex. No cubre instalar en el VPS, descongelar ni publicar. Nada de eso se hizo.

## OBJETIVO ORIGINAL

1. Decir si el script ya permite publicar un SHA o digest exacto con el timer apagado y encenderlo después, como paso aparte.
2. Identificar, solo lectura y sin leer `.env`, las imágenes de los dos caminos de marcha atrás, y proponer cómo conservarlas, sin presentarlo como recuperación completa.
3. Repuntar `infra/dtd-cargo/compose.yml:47` e `infra/dtd-cargo/.env.example:36` con una prueba de los dos literales, quitar la mención al bot de deploy (líneas 60-61) y describir la ventana.

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
- La propuesta para conservarla está en el runbook: `docker save` con su hash antes de publicar y una copia fuera del servidor. **No está hecha**: es una escritura en el VPS y necesita OK. La restauración está **NO PROBADA**.

Queda escrito que no es una recuperación completa. Con la web `929cabf51` sobre la base con la 0497, una factura emitida queda sin asiento, y la prueba rápida 14/0 no lo ve: `smoke-web.sh` no inicia sesión ni escribe. El efecto en facturas viene del informe del ensayo de la SDD-0573; esta tarea no lo volvió a medir.

### 3. `compose.yml` y `.env.example`

- `compose.yml:47` y `.env.example:36` pasan a `ghcr.io/softagentes/dtdcargo:main`. Esa etiqueta responde en el registro (`docker manifest inspect`, 2026-11-02).
- El comentario de `compose.yml:60-61` ya no nombra el bot. Sigue en dos líneas, así que no corre ninguna referencia.
- `infra/ops/tests/publicable.test.mjs`: dos literales y `infra/dtd-cargo` en la lista de carpetas limpias.
- Huellas de `huellas-fuera-de-imagen.sh repo .`: cambian `compose.yml` (`1a67944a24958c08` → `483f923fd4339358`) y `.env.example` (`c63acb8bf8a1f7e8` → `c7960019fb74accb`). Las otras siete no.
- Ventana: runbook, sección «Instalar `compose.yml` y `.env.example` con la dirección nueva».

### Hallazgo que no estaba en el encargo: `compose.supabase.yml` bloquea

Medido con `huellas-fuera-de-imagen.sh servidor /srv/dtd-cargo` contra la etiqueta de `:publicable` (`1c2286f1f`):

| Ruta | Etiqueta | Servidor |
|---|---|---|
| `compose.supabase.yml` | `482f540c7e0e61f0` | `a00bd8adfa66438a` **DIFIERE** |
| Las otras ocho | | Iguales |

- **Diferencia:** una línea, la imagen de `storage`. El servidor tiene `sha256:7ec9901d34a3…`, editado el 2026-10-25 03:51Z; el repo, `supabase/storage-api:v1.77.6`.
- **Esa imagen:** `node-runtime-patch:c99920016d60-24.22.1-no-refresh`, derivada de la oficial, con la etiqueta `local.node-runtime.version=24.22.1`. La usan `dtd-cargo-storage-1`, `dtd-cargo-staging-storage-1` y `loop-3d-storage-1`.
- **Por qué no salió en V6:** `puertas()` para en la primera cerrada, y «faltan 2 de 258» tapó esta. Al aplicar la 0496 y la 0497, `revisar` dirá «el servidor no tiene la misma copia», y su mensaje manda a copiar el archivo del repo. Eso quitaría el parche en el próximo `up` de `storage`.
- **Motivo del parche:** NO VERIFICADO. El handoff de Node 24.22.1 solo dice que los parches locales de Contabo se conservan.
- Opciones en el runbook. **Recomiendo la variable** `DTD_STORAGE_IMAGE`, como en `web`. No la hice: amplía el encargo y añade una línea al `.env` en la ventana.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `vitest run infra/ops/tests/publicable.test.mjs --pool=threads`, con los literales viejos | ROJO esperado: 3 fallos, los tres de esta tarea |
| Lo mismo, con el cambio | PASÓ, 41 de 41 |
| Vitest de `infra-env-example`, `entorno-prueba-compose`, `entorno-prueba-semilla` y `ci-workflow-contract` | PASÓ, 82 de 82 en 4 archivos |
| `prueba-publicar-web.sh` en Git Bash, con sustitutos locales de `flock` e `install` | 209 PASÓ y 5 FALLÓ, todos fuera de los bloques nuevos. Los dos bloques nuevos: 14 de 14 |
| Los 5 rojos de esa corrida | `permisos del .env: 644`, `candado rc=0` y `escribió sin el candado` son del entorno Windows. `lector: sin salida` (dos veces, parser del Studio) no tiene causa comprobada: decide el CI en Linux |
| Mutantes de esta tarea, contados contra esa línea base | MUERTOS los 3: `--aunque-congelado no alcanza` (8 rojos nuevos), `publicar a mano descongela` (3), `publicar no registra la anterior` (10). En Git Bash el código de salida no los distingue; en el CI, sí |
| `prueba-publicar-web.sh` en Linux | PENDIENTE: lo corre el CI «Calidad continua» de la PR. Docker Desktop está apagado y no tiene turno aquí |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio de producto es nulo y la máquina es compartida; lo mide el CI |

## COMMITS

Se listan en la PR.

## PR / BRANCH

`claude/0541-compose-softagentes`, en borrador contra `main`. No se fusiona desde aquí.

## PENDIENTES DE ESTA TAREA

1. Decisión sobre `compose.supabase.yml`: del Director o de Sam.
2. Integrar la PR. El merge arma imagen y mueve `:publicable`, sin tocar la web.
3. La ventana, con su OK: conservar la imagen, instalar los archivos y publicar `X`.

Encender el timer es un paso aparte, con su propio OK.

## FUERA DE ALCANCE DETECTADO

- `infra/dtd-cargo/.env.example:193` sigue nombrando `VERCEL_API_TOKEN`. Es la misma huella: corregirlo aquí no suma ventana.
- `infra/dtd-cargo/compose.yml:44-46` y `.env.example:33-35` todavía describen el despliegue como `docker compose pull` a mano. También es la misma huella.
- `.Config.Image` y `estado/publicada` no coinciden: `publicada` quedó en `8e9e0f505`, porque `929cabf51` se puso a mano. Lo corrige la primera publicación por el script.
- Kuma es el único aviso de una falla: el Director midió `Telegram: SIN CONFIGURAR`.

## HANDOFF AL DIRECTOR

Antes de pedir el OK de publicar, resolver `compose.supabase.yml` y repetir la comparación de huellas. `revisar` no alcanza mientras falten migraciones. El detalle y la evidencia están en la nota de la carpeta compartida, `0541-commit-exacto-worker.md`.
