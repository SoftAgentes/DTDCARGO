# Handoff · SDD-0540 · Entorno de prueba («prueba/DTD Cargo») con base separada (diseño)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, de 07:00 a 07:40 UTC aprox. (Caracas: 03:00 a 03:40) |
| Task ID / owner | `0540-entorno-prueba-staging` / subagente Worker lanzado por la sesión Director, claim `claude-worker-0540-staging` |
| Claim del harness | `claude-worker-0540-staging` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a3485995997ab5c0f` |
| Rama | `worktree-agent-a3485995997ab5c0f` |
| Base | `origin/main` `6da8aebc` (merge de la #244) |
| SDD | [0540](../../docs/specs/0540-entorno-prueba-staging/spec.md), `proposed`. Reserva **local** `codex/sdd-reserve-0540-entorno-prueba-staging` y candado `refs/dtd/reservations/0540` (`e74bfab9`), sin push; el stub entró a esta rama por fast-forward |
| Estado de la tarea | lista para revisión (diseño). Las fases 1 a 5 de la spec esperan las decisiones de Sam |
| Permisos | commits selectivos, push de la rama propia y PR en borrador contra `main`, sin fusionar (main congelado por el corte). Sin producción, SSH, DNS, Vercel ni secretos. Sin `pnpm verify` ni suites pesadas |

## OBJETIVO ORIGINAL

Pedido de Sam, citado por el Director: «Necesitamos un link o entorno de prueba … desarrollarlos y probarlos primero en local y, una vez aprobados ahí, autorizar subirlos al VPS.» Y «Acuérdate que estamos en prueba».

El encargo pide una SDD de **diseño**, sin implementar infraestructura. Tiene que cubrir:
- la situación actual con evidencia;
- la propuesta con alternativas y una recomendación: stack en el mismo VPS, datos, acceso, camino de una rama, migraciones y migrate-first, integraciones, RAM y disco, costo y ciclo de vida;
- un plan por fases que separe Worker, sesión de Contabo y Sam;
- las decisiones de Sam con su recomendación.

## COMPLETADO

- **Número.** `sdd:next` propuso **0539** (inventario de 385 refs y worktrees: «spec siguiente: 0539; migración siguiente: 0491»). El encargo reserva la 0539 para otra sesión, así que **no se tomó**. Se reservó la **0540** en local con la misma función atómica del script (`prepareReservation("0540", "entorno-prueba-staging")` de `scripts/next-number.mjs`: create-only del candado y de la rama), sin push.
- **Spec** `docs/specs/0540-entorno-prueba-staging/spec.md` (`proposed`):
  - §1 situación actual: producción en el VPS y web en traslado; Preview de Vercel escribiendo en producción; staging de la Fase 2 destruido; imagen solo de `main` y con los valores de producción adentro; los modos mock que la app ya trae; seis filtraciones posibles hacia producción; lista de lo no verificado.
  - §2 propuesta:
    - lugar: cinco alternativas comparadas, recomendada A, proyecto compose `dtd-cargo-staging` en el mismo VPS, hosts `prueba` y `supabase-prueba`;
    - datos: pasados por `revisar-datos-ve`, recomendados los sintéticos, rechazada la copia seudonimizada, copia real solo por excepción;
    - acceso: cuatro puertas comparadas, recomendada la clave en el web mientras haya solo datos sintéticos;
    - camino de una rama: workflow `build-image-prueba.yml`, solo `workflow_dispatch`, variables `PRUEBA_*` con guard y etiqueta `prueba-sha-*`; `desplegar-prueba.sh` lo corre la sesión de Contabo;
    - migraciones: primero en prueba, con base reseteable a `main`, y el migrate-first ensayado con app vieja y base nueva;
    - integraciones: tabla canal por canal, más `verificar-aislamiento.sh`;
    - RAM y disco: límites por servicio, 3.072 MiB contra 9.728 de producción, y tope de disco de 5 GB;
    - costo y ciclo de vida.
  - §3 plan en seis fases (0 a 5), con aceptación medible y separado por actor.
  - §4 once decisiones con su recomendación.
  - §6 fuera de alcance.
- **Índice** `docs/specs/README.md` regenerado con `pnpm docs:index`: 525 specs. Marca la 0539 como hueco porque todavía no existe en ninguna ref; se resuelve cuando entre la 0539.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `corepack pnpm docs:check` | worktree en `e74bfab9` + spec + índice | **PASÓ**: «índice sincronizado con 525 specs» |
| `corepack pnpm sdd:check` | ídem | **PASÓ**: `[OK] numbering: sin números repetidos`; solo los choques históricos ya conocidos (0057, 0058, 0243, …), que no se renumeran |
| `git diff --check` | ídem | **PASÓ** (exit 0) |
| Voseo en la spec | `grep` de formas voseantes frecuentes | **PASÓ**: 0 coincidencias |
| `corepack pnpm knowledge:status` | worktree | **NO DISPONIBLE**: `structural` y `semantic` `UNAVAILABLE`, «Respuesta inválida del adaptador Graphify» (este worktree no tiene los derivados) |
| `pnpm verify`, Vitest, Docker | — | **NO EJECUTADO**: la tarea es solo de docs y el encargo lo excluye. No aplica: no cambia código, migraciones ni infra |
| `knowledge:visual` / `knowledge:visual:check` | — | **NO EJECUTADO**: el encargo limita el cierre a `docs:check`, `sdd:check` y `git diff --check`; la spec no está en `semanticPilot` (`scripts/knowledge-policy.json:4-24`) |

Nota: el primer `corepack pnpm` del worktree instaló las dependencias (pnpm 12.3.4, con el lockfile; `git status` no mostró cambios en él).

## COMMITS

- `e74bfab9` · `chore(sdd): reserva SDD-0540 — entorno-prueba-staging` (stub de la reserva, por fast-forward).
- `docs(sdd): SDD-0540 — diseño del entorno de prueba con base separada` (spec + índice).
- El commit que contiene este documento (`docs(handoff): SDD-0540 …`). Los hashes finales van en la PR.

## PR / BRANCH

- Rama `worktree-agent-a3485995997ab5c0f`, base `main`, worktree de arriba.
- PR en borrador: se anota en la descripción de la PR y en el reporte al Director.

## PENDIENTES DE ESTA TAREA

- Las **decisiones D1 a D11** de Sam (spec §4) y su registro literal en el §8. Después, el Director pasa la spec a `approved`.
- Nada más dentro del alcance de diseño. Las fases 1 a 5 son encargos nuevos con sus propias autorizaciones.

## FUERA DE ALCANCE DETECTADO

1. **GA y Ads no se pueden apagar en un build.** `components/Analytics.tsx:36-38`: en un build de producción, el ID vacío cae a `G-25CD7BZH98` y carga Ads `AW-561290482` (`:46-47`). Cualquier imagen no productiva (prueba, Preview, un Docker local) contamina los reportes y las conversiones. La spec lo pone como requisito de la Fase 2.
2. **`build-image.yml` publica `sha-<sha>` de una rama con los valores de producción** cuando se dispara a mano (`:18-22,66-68`; precedente `sha-09cf4f3c…`, handoff 0505:649). Por la etiqueta no se distingue de una imagen de `main`.
3. **`0472_kommo_functions_base_url.sql:112-114`.** Sin `functions_base_url`, las llamadas a Kommo caen a la URL de Supabase Cloud: es un respaldo abierto hacia un Cloud congelado.
4. **`infra/dtd-cargo/.env.example:274` deja `DISABLE_SIGNUP=false` para producción**, aunque las altas de la app usan la API admin (`app/registro/actions.ts:347`). El valor real del servidor está NO VERIFICADO. Hay que confirmar si el registro público de GoTrue debe estar abierto.
5. **`app/robots.ts` no distingue el entorno** (`:3-4,31`).
6. **Visibilidad de GHCR contradictoria.** `build-image.yml:15-16` habla de «imagen pública»; `servidor-contabo.md:288-292` pide `docker login` con `read:packages`.
7. **Ya conocido, se registra solo como dependencia:** `docs/runbooks/aplicar-migraciones-prod.md` sigue con el conector de Cloud (handoff 0505:609; `servidor-contabo.md:831-835`).
8. **Para el Director (conocimiento, inferencia):** con el corte, el merge a `main` construye la imagen pero ya no despliega solo (`build-image.yml:9-11`). Si Vercel quedó en pausa, la regla «merge a main despliega a producción» cambió. NO VERIFICADO desde esta sesión.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- **Documentos canónicos actualizados:** ninguno fuera de la spec nueva y del índice generado. El runbook `servidor-contabo.md` **no** se tocó: su sección «Entorno de prueba» es un entregable de la Fase 1.
- **Conocimiento nuevo propuesto, no convertido en regla:** «toda PR con migración pasa por prueba antes de producción», con destino en AGENTS o en `project-rules.md`. Lo decide Sam (D6) y lo propone el Director (spec §3, Fase 5).
- **Graphify, Archify y Obsidian:** no se ejecutaron (ver VALIDACIÓN). La spec no pertenece al piloto semántico. Cuando se integre, el Director publica los derivados desde `main`.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la PR en borrador y llevarle a Sam las decisiones D1 a D11 (spec §4).
- **Número.** Se usó la 0540, no la 0539. Después de esta reserva local, `pnpm sdd:next` propone **0541**, porque calcula máximo + 1 y no rellena huecos. La sesión de la 0539 tiene que reservarla con el número explícito; con `--reserve` le saldría la 0541.
- **Cambios compartidos.** Solo `docs/specs/README.md`, que es generado. Si entra antes otra spec, hay conflicto en el índice: el driver lo regenera (memoria «merge de main con índice de specs»).
- **Sin efecto en producción ni en el servidor.** No se leyó nada de producción.
- **Ownership.** Se libera el claim `claude-worker-0540-staging` al terminar la escritura. El worktree y la rama se conservan.
