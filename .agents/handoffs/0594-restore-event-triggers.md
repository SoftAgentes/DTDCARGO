# Handoff — SDD-0594 · restore.sh recrea ensure_rls y compara los event triggers

- **Owner:** Claude Worker, lanzado por el Director de la sesión `local_535053f4-40c2-4124-a280-63f4fc882820`; claim `festive-bhabha-3208b1`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\festive-bhabha-3208b1`
- **Rama:** `claude/festive-bhabha-3208b1`, desde `origin/main` en `7be2ed9e5`
- **SDD:** 0594, asignada por el Director. Reserva local `codex/sdd-reserve-0594-restore-event-triggers` + `refs/dtd/reservations/0594`; la spec reemplaza al stub, sin cherry-pick
- **Permisos de esta tarea:** spec, PR en borrador y handoff. Sin restaurar en producción ni en prueba, sin instalar en el VPS, sin fusionar. Lecturas del VPS solo sin terminal

## OBJETIVO ORIGINAL

Que una restauración recree `ensure_rls`, con el dueño y la función correctos, o termine en error claro, y que la verificación compruebe los event triggers esperados. Quien revisa no debe poder ver éxito sin ese trigger. Además: comparar la fuente con lo instalado, pruebas con dobles y control rojo, inventario de lo que se pierde igual y runbook actualizado.

## COMPLETADO

**1. Fuente contra lo instalado: no difieren.** Medido por `ssh -T`, solo lectura, 2026-11-02. Los md5 coinciden en `/srv/ops` y en `infra/ops` de `7be2ed9e5`:

| Archivo | md5 |
|---|---|
| `backup/restore.sh` | `7dc767d439c97046ba9d932d4470bc26` |
| `backup/restore-test.sh` | `9cfd1fb62c4596d96142a53ae1e69a54` |
| `backup/restore-real-prueba.sh` | `843f27e5803c1dcacb6cd08686573166` |
| `backup/pg-dump-to-s3.sh` | `d8203d2f0853fdb25b53fcc89695a706` |
| `lib/acl.sh` | `f823268f16066a03447f5bd4583bdd1f` |

**2. `restore.sh`** (`infra/ops/lib/event-triggers.sh` es nuevo):

- Lee el índice del dump, sin red y antes de tocar el destino. Si no se lee, sale 2.
- Se lo da a `pg_restore -L` sin `ensure_rls`, y lo quita antes del destino si ya lo tiene.
- Lo recrea con `set role postgres`.
- Compara la base contra el índice: cada trigger con su dueño, y `ensure_rls` exacto.
- Si falta algo, escribe `FALTAN <nombres>` y **sale 9**. No hay opción para saltárselo.
- Se exige `ensure_rls` si el dump trae el trigger o su función. Un proyecto sin ninguno de los dos no cambia.

**3. `restore-test.sh`** suma cuatro comprobaciones:

- Event triggers «iguales», leído de la línea de `restore.sh`. Si no informó, es FALLÓ.
- El dump trae `ensure_rls` si trae su función.
- Una tabla nueva de `public` nace con RLS, medido como `postgres` con rollback.
- Acepta el código 9 en «terminó» para que falle la comprobación que lo nombra. Un 8 no tapa la falta del trigger.

**4. Prueba con dobles:** `infra/ops/tests/prueba-restore-event-triggers.sh`, agregada al CI en `pruebas-linux.sh`.

**5. Inventario y runbook:** `docs/runbooks/backup-restore-servidor.md` §3, «Event triggers» y «Qué no se restaura igual». Resumen:

- De los 7 event triggers de producción, **solo `ensure_rls` se pierde**: es el único con función de un rol no superusuario.
- **`pg_cron` se pierde en base nueva y con `--dr`**, y se restaura en `--target postgres`. Por eso `--expect cron.job=N` no puede pasar en la prueba mensual, aunque el runbook lo sugería. Corregido.
- **No viajan en el dump:** `app.settings.jwt_exp`, que lo pone `jwt.sql` con el `.env`, y la ACL y el comentario de la base, que los trae la imagen.
- Suscripciones, FDW, lenguajes propios, tablespaces y etiquetas de seguridad: 0 en producción.

Criterios de aceptación 1 a 10 de la spec: cumplidos con dobles y con la imagen real, salvo lo marcado NO EJECUTADO abajo.

## VALIDACIÓN

Salvo lo indicado, sobre el árbol de trabajo final, base `7be2ed9e5`.

| Comprobación | Resultado |
|---|---|
| `prueba-restore-event-triggers.sh`, Git Bash | PASÓ · 78 PASÓ · 0 FALLÓ |
| Misma prueba en `node:24`, sin red | PASÓ · 78 PASÓ · 0 FALLÓ, 22 s |
| `pruebas-linux.sh` con esa prueba, en `node:24` | PASÓ · 9 s |
| Control rojo: `restore.sh` y `restore-test.sh` de `7be2ed9e5` con la prueba nueva | PASÓ como control · 30 PASÓ · 47 FALLÓ (versión de 77 comprobaciones) |
| Control del doble: pg_restore a secas da los 2 errores del 29-oct y deja 6 triggers | PASÓ |
| Mutantes | PASÓ · 30 de 30 muertos en su última corrida (ver nota) |
| Vitest: `ci-workflow-contract`, `pruebas-linux.test`, `spec-migration-refs` | PASÓ · 3 archivos, 63 pruebas |
| `docs:check`, `sdd:check`, `governance:check` | PASÓ |
| `git diff --check`, 0 CR en los archivos nuevos | PASÓ |

**Mutantes.** En la primera corrida murieron 26 de 27. El que sobrevivió delató un defecto real: el `grep` de `restore-test.sh` tomaba el mensaje final en vez de la línea de cuenta, y la evidencia decía «no verificados» en vez de nombrar lo que falta. Corregido y fijado con una prueba. Repetí los 6 que el cambio afecta, 3 de ellos nuevos: 6 de 6 muertos. Los otros 24 no se repitieron tras ese cambio y el de la medición de RLS, porque esas dos líneas de `restore-test.sh` no los afectan.

**Ensayo con la imagen real**, Docker local, `supabase/postgres:17.6.1.136`, datos sintéticos:

| Corrida | Resultado |
|---|---|
| `restore.sh` de antes, `--target postgres`, base nueva de la imagen | Sale 4 · 2 errores, los del 29-oct · 6 triggers, sin `ensure_rls` |
| `restore.sh` nuevo, mismo caso | Sale 0 · 0 errores · 7 triggers · `ensure_rls` exacto · `cron.job` restaurado |
| Otra vez encima de esa base | Sale 0 · 0 errores |
| `restore-test.sh`, base nueva | 8 PASÓ · 0 FALLÓ |
| `restore-test.sh --dr` | 8 PASÓ · 0 FALLÓ |
| Tabla nueva en `public` | Con RLS como `postgres`, **sin RLS como `supabase_admin`** |

El ensayo encontró un segundo defecto que los dobles no veían: `postgres` no puede crear tablas en `restore_test` porque no es dueño. Corregido, y ahora el doble lo reproduce. Para probar `--target postgres` sin terminal usé una copia de los scripts con la guarda de terminal quitada. La guarda real no se tocó.

**Turno de Docker del Director, con una falta mía.** Antes de la primera parte medí 5,67 GB libres, 0 corridas pesadas y 0 contenedores. Antes de la segunda lancé la medición **en paralelo** con el ensayo, no antes: dio 3,01 GB libres y **2 procesos según mi filtro de corridas pesadas**. No lo vi hasta después, así que esa parte no cumplió tu condición de no arrancar. A las 15:46:44Z el filtro daba 0 y no pude identificar esos dos. El primer `restore-test.sh` de esa parte tardó 108 s contra 36 s antes, lo que sugiere que hubo contención. Todo salió verde y sin errores de memoria. En total fueron unos 7 minutos, entre 15:39Z y 15:46Z.

Condiciones del turno: cada `docker run` llevó `--memory=1g`, sin puertos publicados. Corrió una base a la vez, más los clientes `psql` cortos de `restore.sh`, que no se pueden evitar. `--network none` en el origen y en la prueba de dobles; red interna donde `restore.sh` necesita llegar a la base. Quedaron 0 contenedores y 0 redes. Sigue en la máquina la imagen bajada, de unos 1,7 GB.

**NO EJECUTADO:**

- `pnpm verify`: no aplica. El diff es de scripts bash de ops y documentación, y el código de producto no cambia.
- `prueba-traslado-y-respaldos.sh`: su origen sintético no usa `ensure_rls`, y por lectura debería seguir pasando. Corre en el VPS como root.
- `prueba-respaldo-b2.sh`: va contra el bucket real.
- Un dump **de producción** con el script nuevo: está cifrado con la llave de Sam y restaurar quedó fuera de esta tarea. Ver pendientes.
- Graphify: lo publica el Director desde main.

**NO DISPONIBLE:** `knowledge:status` y `knowledge:visual:check` responden «Respuesta inválida del adaptador Graphify» en este worktree: estructural y semántico UNAVAILABLE. Ninguna fuente tocada está en `semanticPilot` (comprobado contra `scripts/knowledge-policy.json`).

**Impacto documental:** actualizados `docs/runbooks/backup-restore-servidor.md` e `infra/ops/README.md`. Cubierto por el índice de specs regenerado. Mapa Archify y publicación en Obsidian no ejecutados, por el NO DISPONIBLE de arriba.

## COMMITS

Los hashes finales están en la PR.

- `fix(DTD-0594)`: `restore.sh`, `restore-test.sh`, `lib/event-triggers.sh`
- `test(DTD-0594)`: doble, prueba y entrada en el CI
- `docs(DTD-0594)`: spec, runbook, README, índice y el commit que contiene este documento

## PR / BRANCH

PR en borrador contra `main`; la URL está en el reporte al Director y en la PR misma. Rama `claude/festive-bhabha-3208b1`, worktree `festive-bhabha-3208b1`.

## PENDIENTES DE ESTA TAREA

1. **Revisión de la PR** e integración, por el Director.
2. **Instalar en el VPS, con autorización y después de que Sam termine de restaurar prueba:** los 3 archivos `backup/restore.sh`, `backup/restore-test.sh` y `lib/event-triggers.sh`. Si falta la lib, `restore.sh` aborta al arrancar sin tocar nada.
3. **Primera corrida real**, con `restore-real-prueba.sh` y la llave de Sam. Esperar `event triggers: esperados 7 · restaurada 7 · iguales` y 8 PASÓ. `restore.sh` debería seguir saliendo 4 en base nueva por `pg_cron`: 19 errores, ya sin los 2 de `ensure_rls`.

**Ojo al instalar:** `restaurar-prueba.sh` (`/srv/ops/evidencias/rehacer-prueba-20261102/`) y `rehacer-paso-2.sh` recrean `ensure_rls` a mano con `ON_ERROR_STOP` después de `restore.sh`. Con el script nuevo ese `create` falla por «already exists» y el primero vuelve atrás con código 5. El paso en curso de Sam no se afecta mientras no se instale. Si se reutilizan después, hay que quitarles esa línea.

## FUERA DE ALCANCE DETECTADO

1. **Nada vigila `ensure_rls` en producción entre restauraciones.** `restore-test.sh` delata la pérdida solo en la prueba mensual.
2. **Solo los event triggers tienen comparación automática.** Una publicación o una extensión perdida sin error no la detecta ninguna comprobación.
3. **Nunca se restauró un dump de producción sobre `--target postgres`.** `--dr` no lo reemplaza, porque ahí `pg_cron` falla.
4. **El runbook §3, paso 1, usa un remoto viejo:** `r2:dtdcargo-backups/db/…`, cuando §2.3 dice que el real es `b2:dtdcargo-respaldos/db`.
5. **El registro §8 del runbook sigue en «pendiente»** y la prueba del 2026-10-29 no está registrada, aunque su evidencia existe.
6. **Línea de log de `restore.sh`:** `permisos: ${ACL:+…}${ACL:-sin archivo}` imprime el nombre y además la ruta entera, pegados.
7. **`pg_restore --jobs` a veces duplica el prefijo de un error** en la evidencia. Cosmético; el conteo por `grep` lo deja fuera, por eso varía de 15 a 17 en el ensayo.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR. No hay migraciones, ni datos, ni cambios en el VPS.
- **Turno de Docker: libre.** Lee arriba la falta en la segunda medición.
- **Cambio compartido:** `infra/ops/tests/pruebas-linux.sh` suma una prueba al check obligatorio. En `node:24` tarda 9 s; en Git Bash, unos 2,5 min.
- **Sesiones consumidoras:** ninguna. La sesión del rehacer de prueba no depende de esta rama.
- **Ownership:** claim liberado al terminar la escritura.
