# Handoff 0477 · seguimiento — El SKIP LOCKED de la 0460, probado con sesiones reales

- Fecha: 2026-09-18 (Caracas; 2026-09-19 UTC). Estado de la tarea: **lista para revisión**. Se
  publica con este head, en un solo push, y la PR se abre lista para revisión.
- Owner/sesión: `worker-carrera-skip-locked-0460-20260919` (Claude Opus 5, Worker, sesión
  «Automatizar la prueba de carrera del for update de 0459» [7a0aa1], que siguió con esta tarea a
  pedido de Sam). Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-skip-locked-0460`, creado
  con `harness-worktree start`.
- Rama: `codex/carrera-skip-locked-0460`, desde `origin/main` = `3f810366` (ya incluye la #149).
- SDD: [0477](../../docs/specs/0477-retencion-vinculo-portal-revocado/spec.md), como seguimiento y
  sin número nuevo, por decisión del Director. Alcance: solo la 0460. La evidencia manual de la
  0421/0427 y `check-public-verify-concurrency.mjs` quedan para después.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de los commits se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama; push de la rama propia y PR contra `main` después de
  reportarle al Director. **No merge. No producción.** La 0460 está aplicada (ledger
  `20260918170451`) y no se edita: md5 `d86cf096e91c58546dc7c90b032d0bc2`, igual antes y después
  de esta tarea.

## OBJETIVO ORIGINAL

Cubrir con una prueba de comportamiento el `FOR UPDATE OF cu SKIP LOCKED` de
`erase_revoked_portal_access_data()` (0460). El contrato de la 0460 corre en una sola sesión, y la
spec 0477 lo declaraba en «Riesgos y límites»: «SKIP LOCKED sin prueba de comportamiento». El
mutante que lo quitaba solo moría por la aserción sobre el texto de la RPC.

## COMPLETADO

- **`supabase/tests/0460_retencion_carrera_skip_locked.test.sql`**, un contrato más de la suite SQL
  local (paso `sql-tests` de `verify`). Usa el mismo patrón que la #149 (`0459_relevo_carrera_for_update`):
  `dblink` contra una base propia (`dtd_carrera_0460`), barrera por `pg_blocking_pids` sin
  `sleep`, limpieza protegida ante cualquier error, guarda de clúster desechable y control en la
  misma corrida.
- **Sesiones:** `s` prepara y observa. `a` tiene filas tomadas con la transacción abierta: una
  primera corrida del cron con tope 2, o el founder reinvitando un vínculo. `b` es una segunda
  corrida del cron como `service_role`, en asíncrono. El coordinador mira si `b` termina o si
  `pg_blocking_pids(b)` ya contiene a `a`.
- **Fixture:** es el mismo del contrato 0460. El test lee de ese archivo la sección entre `begin;` y
  «Utilidades», reemplaza cada `\ir` por la migración que incluye y agrega la 0460 entera. Así los dos
  prueban sobre la misma base y no hay 175 líneas duplicadas que puedan desviarse. Si el contrato
  cambia de forma o trae otro meta-comando de psql, el test falla con un mensaje claro en vez de
  probar sobre otra cosa.
- **Casos con la 0460 real**, con cuatro vínculos revocados hace 61 a 64 días:
  1. **Dos corridas a la vez:** la segunda no espera a la primera y borra solo las dos filas libres.
     Al confirmar las dos queda un evento `portal_access_data_erased` por fila.
  2. **La primera se revierte:** las dos filas que la segunda saltó siguen con sus datos y sin
     evento, y la corrida siguiente las borra. Saltar no es perder.
  3. **Reinvitación en curso** con el `portal_invite_client` real, como el founder desde el Studio:
     la corrida no lo espera y no borra ese vínculo, que al confirmar queda `invited` con su correo.
- **Control en la misma corrida**, con la función instalada derivada de `pg_get_functiondef`:
  - Sin `skip locked`, la segunda corrida **espera** en los casos 1 y 3, así que el escenario sí
    ejerce el bloqueo. No duplica eventos, porque el `FOR UPDATE` relee la fila y la descarta.
  - Sin ningún bloqueo, en el caso 1 espera igual (en el `UPDATE`) y **repite** el borrado y el
    evento de las dos filas de la primera. El bloqueo es lo que evita eventos duplicados.
  - Si un control no se cumple, el test falla: el verde no puede ser vacío.
- **Spec 0477:** una línea fechada en «Riesgos y límites», que dice que el hueco quedó cubierto, y
  dos filas en la allowlist exacta (el test y este handoff), como pidió el Director.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| El archivo solo, con los flags de Docker del runner (26 aserciones) | **PASÓ.** Tarda de 10 a 15 s de sesión psql con la máquina cargada (CPU de 68 a 100 % por otras sesiones), según el log del servidor. El fixture del contrato se lleva 1,4 s. Cada corrida concurrente del cron tarda de 40 a 310 ms |
| **Control rojo por el runner real:** la 0460 sin `skip locked` (el diff es solo el renglón 377) | **FALLÓ, como tenía que fallar.** ✗ con «dos corridas: la segunda corrida esperó a la primera (¿falta el skip locked?)», con un evento por fila. El contrato 0460 también cae, por su aserción sobre el texto de la RPC |
| **Control rojo por el runner real:** la 0460 sin el renglón del bloqueo | **FALLÓ, como tenía que fallar.** ✗ con el mismo mensaje, y el estado muestra 2 eventos en la fila 1: el borrado se repite. El contrato 0460 también cae |
| El mismo andamiaje con la 0460 intacta | **PASÓ**: ✓ en los dos archivos |
| Huella tras un fallo (bases, roles, extensiones y sesiones del clúster después del archivo) | **PASÓ en los cinco modos.** Rojo, contrato sin su marca «Utilidades», fixture roto (la 0454 terminada en una función inexistente) y corte a mitad de carrera (con `a` abierta y `b` en vuelo): queda `postgres,template0,template1`, sin roles, solo `plpgsql` y 0 sesiones. Guarda (el clúster ya tenía `service_role`): aborta antes de tocar nada y **conserva** el rol |
| Identidad de la 0460 | Sin cambios: md5 `d86cf096…`, el del ledger |
| Ningún Vitest recorre `supabase/tests/*.test.sql` | **PASÓ.** En `main`, el único que los recorre es `scripts/run-sql-tests.mjs`. La PR #151 (abierta) lee sus contratos por nombre (0465, 0422, 0423) |
| `docs:check` / `sdd:check` / `governance:check` / `git diff --check` | **PASÓ** — 469 specs, sin números repetidos, cápsula vigente |
| Suite SQL completa por el runner real (`node scripts/run-sql-tests.mjs`), en el turno de máquina del Director, sobre `faf5fc8a` | **PASÓ** — 201 de 201 ✓, 0 ✗, exit 0, 108 s. Los dos archivos nuevos y sus vecinos (0459 carrera, contrato 0460, 0461) en verde |
| `pnpm verify` completo | **NO EJECUTADO**, por decisión del Director: el cambio es un `.test.sql` y documentación. Basta la suite SQL completa, y el CI cubre el resto de los gates |
| CI alojado | **NO EJECUTADO todavía**: la rama no está publicada |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `353f6a08` | `test(db)`: el contrato de concurrencia |
| `faf5fc8a` | `docs(SDD-0477)`: la línea fechada y la allowlist |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/carrera-skip-locked-0460`, base `main` (`3f810366`, que no se movió), worktree de
  arriba. Se publica con el head que contiene este documento, en un solo push, y la PR se abre
  lista para revisión. Su número, el SHA y el CI van por mensaje, para no mover el head revisado.

## PENDIENTES DE ESTA TAREA

1. El push y la PR, justo después de este commit. El Director ya dio el turno, con el reporte
   previo hecho.
2. Reportar por mensaje el número de la PR, el SHA y «Calidad local sin secretos» sobre el head
   publicado.
3. Integrar: lo hace el Director.

## FUERA DE ALCANCE DETECTADO

1. **La 0421 y la 0427 siguen dependiendo de evidencia manual de bloqueo**, y `verify` no corre
   `scripts/check-public-verify-concurrency.mjs` (SDD-0375). El Director los dejó para después.
2. **Este test y el contrato 0460 comparten el fixture por lectura de archivo.** Si alguien
   reestructura la sección entre `begin;` y «Utilidades» del contrato, este test falla con un
   mensaje que lo nombra. Es deliberado, pero conviene saberlo al editar el contrato.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0477, con una línea fechada en «Riesgos y límites» y dos filas en la
  allowlist. El índice `docs/specs/README.md` no cambia (`docs:check` en verde).
- **Documentación en código:** la cabecera del `.test.sql`.
- **No aplica:** `BRAND.md` y `docs/design/**` (no hay UI), `docs/marketing/**` y
  `docs/governance/**` (no hay política nueva). Tampoco `revisar-datos-ve`: el test no cambia qué
  datos personales se capturan, mueven o borran; usa fixtures ficticios (`@example.invalid`) en una
  base desechable.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`, igual que en la #149.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff.

## Control rojo reproducible (fuera del repo)

Los mutantes no viven en el repo. Este script arma en una carpeta nueva una copia de
`supabase/migrations` y de los dos archivos que usa el test (el contrato 0460, del que sale el
fixture, y el test de la carrera), con la 0460 mutada, y la pasa por el runner real. El contrato
0460 corre también, porque el runner corre todo `*.test.sql`.

```bash
VARIANTE=sin-skip    bash rojo-0460.sh "<worktree>" "<carpeta-nueva-fuera-del-repo>"   # ✗
VARIANTE=sin-bloqueo bash rojo-0460.sh "<worktree>" "<otra-carpeta-nueva>"             # ✗
VARIANTE=verde       bash rojo-0460.sh "<worktree>" "<otra-carpeta-nueva>"             # ✓
```

```bash
#!/usr/bin/env bash
# Control rojo de supabase/tests/0460_retencion_carrera_skip_locked.test.sql, fuera del repo.
# Arma una copia de supabase/ con las migraciones y los dos archivos que usa el
# test (el contrato 0460, del que sale el fixture, y el test de la carrera), con
# la 0460 mutada, y la pasa por el runner real (scripts/run-sql-tests.mjs).
#   VARIANTE=sin-skip     la 0460 con `for update of cu` en vez de `... skip locked` → ✗
#   VARIANTE=sin-bloqueo  la 0460 sin el renglón del bloqueo                         → ✗
#   VARIANTE=verde        la 0460 intacta                                            → ✓
# El contrato 0460 corre también, porque el runner corre todo *.test.sql; con un
# mutante cae por su aserción sobre el texto de la RPC.
# Uso: VARIANTE=<v> bash rojo-0460.sh <worktree> <carpeta-destino-nueva>
set -euo pipefail
W="$1"
D="$2"
V="${VARIANTE:?VARIANTE=sin-skip|sin-bloqueo|verde}"
mkdir "$D"   # falla si ya existe: nunca se reutiliza ni se borra nada
mkdir -p "$D/supabase/tests"
cp -r "$W/supabase/migrations" "$D/supabase/migrations"
cp "$W/supabase/tests/0460_retencion_vinculo_portal_revocado.test.sql" \
   "$W/supabase/tests/0460_retencion_carrera_skip_locked.test.sql" "$D/supabase/tests/"
M=0460_retencion_vinculo_portal_revocado.sql
case "$V" in
  sin-skip)    sed 's/^      for update of cu skip locked$/      for update of cu/' "$W/supabase/migrations/$M" > "$D/supabase/migrations/$M" ;;
  sin-bloqueo) sed '/^      for update of cu skip locked$/d' "$W/supabase/migrations/$M" > "$D/supabase/migrations/$M" ;;
  verde)       ;;
  *) echo "VARIANTE desconocida: $V" >&2; exit 2 ;;
esac
echo "== diff de la 0460 ($V):"
diff "$W/supabase/migrations/$M" "$D/supabase/migrations/$M" || true
cd "$D"
start=$(date +%s%3N)
set +e
node "$W/scripts/run-sql-tests.mjs"
rc=$?
set -e
echo "== runner exit $rc en $(( $(date +%s%3N) - start )) ms"
exit $rc
```

Corridas registradas el 2026-09-18 sobre este worktree: `sin-skip` dio el diff
`377c377` y los dos archivos en ✗ (exit 1); `sin-bloqueo` dio el diff `377d376` y los dos en
✗ (exit 1); `verde` dio el diff vacío y los dos en ✓ (exit 0).

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR cuando se abra e integrarla en su turno.
- **Cambios compartidos:** un archivo nuevo en `supabase/tests/`, que el runner descubre solo, y
  dos cambios en la spec 0477 (la línea fechada y la allowlist). Ningún archivo de producto.
- **Dependencias:** `dblink` en la imagen del runner (`postgres:17`) y el contrato
  `0460_retencion_vinculo_portal_revocado.test.sql`, del que sale el fixture. Sin `dblink`, el
  archivo falla en vez de hacer SKIP, porque sin él la propiedad no se mide.
- **Conocimiento:** Graphify, Archify y la bóveda quedan para la publicación del Director desde
  `main`.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; worktree y rama
  se conservan.
