# SDD-0599: reintentar un envío del portal no lo duplica

- **Fecha:** 2026-11-02, cerrado el 2026-11-03. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/reintento-no-duplica`. **Rama:** `codex/reintento-no-duplica`. **Base:** `main`. #358 y #360 ya entraron.
- **SDD:** 0599, reservada con `sdd:next --reserve`, sin publicar: `codex/sdd-reserve-0599-reintento-no-duplica`, `refs/dtd/reservations/0599`. **Migración:** 0512, confirmada por el Director General. La próxima libre es la 0513.
- **Límite:** esta sesión no fusiona ni aplica. **La 0512 está aplicada en prueba y en `dtd-cargo`:** la aplicó el Director General con el mandato de Sam, cuyo texto está en su nota `mandato-fases-2-3-4.md`.
- **Reporta a:** Director General, `local_25e2dded-103b-4eaa-b10e-6527564b9cad`.
- **`node_modules`:** propio desde el 2026-11-03, instalado sin red, con los 1.768 enlaces dentro del worktree. Antes era una junction, y `next build` no sirve con una.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que reintentar un envío del portal no lo duplique"».

Decisión de Sam, literal: «Sí, con candado», a «¿Apruebas el diseño con candado en la base?», con la propuesta y su alternativa a la vista.

## Resultado

Un reintento con el mismo identificador devuelve la compra, cotización, reclamo o mensaje del primer envío, sin crear otro. Causa, decisión y límites en `docs/specs/0599-reintento-no-duplica/spec.md`.

**Hoy en producción:** la base ya tiene la 0512, y la web todavía no tiene este código hasta que entre esta PR.

## COMPLETADO

- Migración `0512_portal_intento_sin_duplicar.sql`: columna e índice único en `prealertas`, `quotes` y `client_claims`, y la firma `portal_post_message(text, uuid)`.
- `useActionKeepingDraft` con `{ requestId: true }`, y `lib/shared/client-request.ts`.
- Las cinco acciones responden `replayed`, sin otro correlativo ni otro aviso. Adjuntos, evidencia y direcciones se comparan por contenido.
- Avisos y pantallas de éxito actualizados en los cinco formularios.
- Datos personales clasificados con `revisar-datos-ve`, en la spec. `/ui-check` del diff, sin hallazgos.
- Cierre de la 0512 según el runbook §6: espera retirada, declaración quitada y migración sellada.

## APLICACIÓN

Datos del Director General, que la ejecutó. Esta sesión no leyó producción.

| Dato | Valor |
|---|---|
| OK de Sam, literal | «Doy el mandato». El punto 2 del mandato nombra la 0512 |
| COMMIT en `dtd-cargo` | 2026-11-04 00:24:55Z |
| Verificación | PASÓ: una fila, md5 `bdf2326d98f8fe993aedc19235d7ae00`, 11817 bytes, blob `f906e8a52015` |
| Evidencia en el VPS | `previa-0512-dtd-cargo-20261104T002230Z`, `ensayo-0512-prueba-20261104`, `apply-0512-dtd-cargo-staging-20261104T002356Z`, `apply-0512-dtd-cargo-20261104T002454Z` |
| Conteo previo en producción | `prealertas` 63, `quotes` 29, `client_claims` 6 |
| Ensayo en prueba, con triggers y RLS vivos y todo deshecho | El mensaje repetido responde `replayed` true y deja 1 fila. La firma vieja sigue viva. Compra, cotización y reclamo chocan en su índice. `anon` no ejecuta |

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Contrato en PGlite, con los `.sql` reales | PASÓ, 39 aserciones |
| Control rojo, 8 mutantes de la migración, postflight, preflight | PASÓ, 12 de 12 casos |
| `next dev` con Server Action real, sobre `2204318f5`, ruta temporal sin commit | PASÓ: `lanza`, `error` y `ok` llevan el mismo identificador, y el envío siguiente a `ok` lleva otro. El POST antes de hidratar llega sin identificador, como dice el diseño. Sin base: esto no prueba el candado |
| `pnpm verify` sobre `d3dd68c73` | **Exit 1, por `test`.** 56,2 min, mínimo de 738 MB libres, 16 de 17 pasos medidos |
| Esos pasos: `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions`, `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols`, `schema-rebuild`, `build` | PASÓ |
| `test`, primer intento | FALLÓ: 1 de 13.603. `infra/ops/tests/migraciones.test.mjs`, 600 s agotados |
| `test`, reintento | FALLÓ: 4 de 13.603. `migraciones.test.mjs` y `entorno-prueba-scripts.test.mjs`, 600 s agotados. `anon-privilegios-residuales.migration.test.ts`, 60 s agotados. `cierre-excepcion-cajon-asiento.test.tsx`: no encontró «Superclave del cierre» en su espera, con el cajón todavía enviando; que sea por carga es inferencia |
| Esos 4 archivos aislados, sobre el mismo SHA, de a uno y con `--maxWorkers=1` | PASÓ: 59 de 59, en 4, 42, 123 y 98 s. Ninguno está en el diff. No se relanzó `verify` |
| `sql-tests` | PASÓ: 252 contratos, incluido `0512_portal_intento_sin_duplicar.test.sql` en `supabase/postgres` |
| `e2e` | PASÓ: 228 pasaron y 20 omitidas. 1 inestable: `e2e/auth.spec.ts:81` en chromium, `ERR_ABORTED` en el primer intento y verde en el reintento |
| `migrations-applied` | NO EJECUTADO, SKIP: el worktree no tiene `.env.local` |
| 66 mutantes de las acciones, el hook y los formularios | Primera corrida: 48 muertos y 18 vivos. Con 18 pruebas nuevas: **66 de 66 muertos**, sobre `7c1a248d1` |
| `reintento-no-duplica.test.ts` | PASÓ, 43 de 43 |
| `tsc` limitado a las pruebas tocadas y `client-request.ts` | Sin errores |
| Cierre: `retirar-espera.mjs --md5`, `migrations-lock.mjs` | PASÓ, exit 0, `revisarAMano` vacío. Quedan las esperas 0422 y 0423, ajenas |
| `check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO` |
| `0512_portal_intento_sin_duplicar.sql` después del cierre | Sin cambios: md5 `bdf2326d98f8fe993aedc19235d7ae00`, 11817 bytes, blob `f906e8a52015` |
| Check obligatorio de la PR | Lo lee el Director General |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica la dirección desde main |

Lo que se agregó después de `d3dd68c73`: el cierre de la 0512, pruebas, documentos y `main`. No se volvió a medir con `verify`.

**Sin medir:** `next start`, lector de pantalla, portal con sesión real, corte real contra una de estas acciones.

## COMMITS

- `27efd2641`: la propuesta.
- `fix(portal): SDD-0599 — reintentar un envío del portal no lo duplica`.
- `e17cf08ad`: cierre de la 0512.
- `1a5d970ee`: la prueba del foco espera al efecto.
- `7c1a248d1`: lo que los mutantes dejaron vivo.
- El commit que contiene esta versión no se autorreferencia.

## PR / BRANCH

Rama `codex/reintento-no-duplica`, PR #362 en borrador contra `main`.

## PENDIENTES DE ESTA TAREA

1. Integrar y publicar: lo hace el Director General.
2. Otra migración retira la firma vieja de `portal_post_message`.
3. Smoke en el portal con sesión real: reintentar una compra con adjuntos tras cortar la red.

## FUERA DE ALCANCE DETECTADO

1. **Fila borrada entre un intento y otro:** el índice no mira `deleted_at`, y la búsqueda sí. El reintento gasta un correlativo y responde el error de siempre, como «No pudimos registrar la compra. Prueba de nuevo.». Sigue fallando hasta recargar, porque el identificador sólo cambia tras `ok`. No duplica, no pierde lo escrito y recargar lo resuelve. `reintento-no-duplica.test.ts` lo fija como límite conocido. Corregirlo pide cambiar el código o el índice.
2. **Candados de proveedor, referido y registro:** leen y después escriben; dos intentos simultáneos podrían pasar.
3. **Aviso al asesor si el primer envío murió antes de avisar:** sin una cola de avisos no se puede garantizar.

## HANDOFF AL DIRECTOR

- **Migrate-first:** la 0512 ya está aplicada. Falta fusionar. El blob al fusionar tiene que seguir siendo `f906e8a52015`.
- **Prueba corregida de #360, ya en `main`:** `use-action-keeping-draft.test.tsx` comprobaba el foco sin esperar al efecto. Dio rojo 2 de 23 corridas. Hasta que entre esta PR, puede salir como rojo intermitente en `main`.
- **Mutantes:** los scripts están en la carpeta de notas del Subdirector, `mutantes-0599.cjs`.

### Impacto documental

Spec 0599 nueva e índice regenerado. Candado de migraciones con la 0512. No cambian políticas.
