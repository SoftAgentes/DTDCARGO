# Handoff 0473 — Importación documental

- Fecha: 2026-09-16. Estado: en-progreso.
- Owner/sesión: `worker-importacion-0473-claude-20260916` (Claude Code).
- **Adopción:** la sesión previa `worker-importacion-0473-20260916` (Codex) se cortó al agotar su
  límite el 2026-09-16 ~15:58, dejando todo sin commitear. Claim liberado con su propio owner y
  reclamado por esta sesión con el guard del harness; sin reset, sin mover su trabajo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/importacion-documental-0473`.
- Rama: `codex/importacion-documental-0473`. Base main `30a9f890`, stub `069d9e417c06b749cb0749a780187a9c358e3edd`.
- SDD: [0473](../../docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md).
- Migración reservada: `0457_document_import_workspaces.sql` (**no aplicada**).
- Permisos: producto, dependencias, DB efímera, commits. Push propio y PR draft pendientes de pedir.
  No main, no producción, no aplicar migración.
- Dependencia: **SDD-0468 ya está en `main` y en producción**. PR #129 mergeada como `747637e6`
  el 2026-09-17, con despliegue `Production` en estado `success`. Esta rama la integró en `2038dadb`.

## OBJETIVO ORIGINAL

Importar documentos en prealerta y calculadora, revisar documento único, compartir con proveedor,
confirmar despacho, imprimir documento completo/etiquetas y reutilizar logística en estimado DTD.

## COMPLETADO

Backend terminado por la sesión Codex y preservado íntegro en `cce43a9b`:

- Migración 0457: 7 tablas, 4 funciones, bucket privado `document-imports` (15 MB).
  RLS deny-by-default (`revoke all`, cero policies a propósito; el acceso va por funciones).
  `versions` y `commands` append-only real. Incluye
  `alter table packing_list_submissions alter column total_qty drop not null`.
- `lib/shared/document-import.ts`: modelo puro con parser de frontera cerrada.
  `computeDocumentTotals` devuelve `null` antes que sumar parcialmente.
- `extract.ts`: valida el directorio central del ZIP antes de inflar XML (anti zip-bomb, rechaza
  cifrado, `vbaProject` y `externalLinks`) y re-verifica el stream real; CSV RFC4180 propio;
  `.xls` se rechaza pidiendo conversión; no evalúa fórmulas.
- `anthropic.ts`: esquema JSON cerrado; rechaza al modelo si inventa una celda inexistente, si
  emite un número sin evidencia o si se auto-resuelve una incidencia. Sin credenciales no hay mock.
- `estimate.ts`: reutiliza `calcularEnvioLCL` y aplica el mínimo una sola vez sobre el conjunto.
- Cableado: `GET /p/[token]/packlist` exporta desde el workspace; el `POST` legacy devuelve
  `409 shared_document_required`; `etiquetas/page.tsx` monta `documentLabelGate`.

Corregido por esta sesión en `bff39cac`: `formatPackingQuantity` en la capa pura y sus tres
consumidores, que muestran «30 m · 100 pcs» en vez de un total escalar imposible.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Guard/identidad de worktree y claim | **PASÓ** |
| `tsc --noEmit -p tsconfig.json` | **PASÓ** — exit 0, salida vacía, sin tubería |
| `eslint` sobre lo nuevo y lo corregido | **PASÓ** — exit 0 |
| `vitest` document-import completo | **PASÓ** — 256 pruebas, 7 `it.fails` que documentan defectos, 1 skip |
| `vitest` SUITE COMPLETA del repo | **PASÓ archivo por archivo**; en la suite completa esta máquina da 3 rojos intermitentes por saturación de CPU — ver abajo |
| `/ui-check` | **PASÓ** con 3 ajustes menores, los tres aplicados |
| Harness de QA visual, comprobado en navegador | **PASÓ** — «Pendiente kg» y no cero; 5 cajas con dos productos; 375 px sin desbordamiento (scrollWidth 358 = clientWidth 358) |
| `vitest` corpus real (3 XLSX de proveedor) | **PASÓ** — 4 pruebas, con `DOCUMENT_IMPORT_CORPUS` |
| `vitest` panel de carga | **PASÓ** — 9 pruebas, 2 verificadas por mutación |
| `vitest` suite completa | **PASÓ** — 570 archivos, 7.463 pruebas |
| PDF reales (2 proformas) | **NO EJECUTADO** — exige `ANTHROPIC_API_KEY` y modelo |
| `vitest` packlist-form | **PASÓ** — 27 pruebas (6 nuevas del helper) |
| Migración 0457 contra Postgres efímero (PGlite) | **PASÓ** — 8 casos |
| `pnpm verify` completo | **NO EJECUTADO** |
| Migración aplicada / lectura de producción | **NO EJECUTADO** (fuera de autorización) |
| Llamadas reales a la IA con documentos del cliente | **NO EJECUTADO** |
| UI, `/ui-check`, 375/390 px, claro/oscuro, impresión | **NO EJECUTADO** — no existe UI montada |
| Chino operativo y WeChat real | **NO EJECUTADO** |

> Nota de método: en esta sesión se cantaron dos verdes falsos antes de corregirlos.
> `vitest --reporter=basic` no existe en vitest 4 y sale 0 sin correr nada; y `tsc | head`
> devuelve el exit de `head`. El exit code solo acredita algo si viene del proceso que trabaja
> y sin tubería en el medio.

## COMMITS

- `cce43a9b` — rescate íntegro del trabajo de la sesión Codex (punto de retorno).
- `bff39cac` — cantidades por unidad; deja `tsc` en verde.
- `8714f1d1` — `DOCUMENT_IMPORT_*` en `.env.example` y registro de la adopción.
- `6140d606` — `DocumentImportPanel`: la carga de archivos como primer paso.
- `e7937ccb` — tres defectos que sólo aparecieron con proformas reales, y `corpus.test.ts`.
- `e29d800a`, `d2860361` — handoff al día.
- `32c27dd8` — las 6 suites de backend (2.902 líneas), cada una verificada por mutación.
- `dd7078bf` — `DocumentImportEntry`, el envoltorio que apaga todo cuando el flag está apagado.
- `2038dadb` — merge de `origin/main` con SDD-0468 ya integrada.
- `410efb9c` — la carga de documentos abre el paso 2 del portal, y `DOCUMENT_IMPORT_CORPUS`
  documentada en `.env.example` (lo cazó el gate de variables del repo).
- `02e25f72` — pantalla donde el cliente revisa su documento, y el arreglo del checkbox
  de incidencias que las borraba sin vuelta atrás.
- `1bc8330e` — el enlace del proveedor llega precargado, el harness de QA visual y el
  runbook de importación sin IA.

Stub heredado `069d9e417c06b749cb0749a780187a9c358e3edd`.

## PR / BRANCH

Rama `codex/importacion-documental-0473`, **no publicada**. PR pendiente; publicar requiere pedirlo.

## CONTROLES DEL DIRECTOR — verificados contra el código

Los cuatro que `0473-review/review-tracker.md` dejó como «Worker implementando/cambiará» están
implementados. Se comprobó uno por uno, no por lo que declara el tracker:

| Control | Evidencia |
|---|---|
| Contenido de grupo no atribuido entero a cada caja | `0457…sql:217` escribe `jsonb_build_object('scope','group_total',…)`; `migration.test.ts:76` lo afirma |
| Inicialización conserva submission anterior e historial | `create_document_workspace` inserta la versión 0 con `actor_id='legacy-submission:<id>'` y aborta con `legacy_submission_changed` (40001) si la submission dejó de ser vigente |
| Rutas legacy no eluden la revisión confirmada | `app/p/[token]/packlist/route.ts:168` → 409 `shared_document_required` |
| URL firmada no sobrevive a la limpieza anónima | `service.ts:123` rechaza la reserva con menos de `125*60000` ms (2 h 05) de vida útil |

## PENDIENTES DE ESTA TAREA

1. `DocumentCalculator` y su conexión con `TarifasTabs`. El recorrido del cliente y el del
   proveedor ya están completos; falta sólo la calculadora pública.
2. Publicar la rama y abrir su PR.
3. `pnpm verify` reportando cada SKIP.
4. Probar los PDF reales: exige credenciales y presupuesto de IA.
5. El contrato de compra chino (`PO-…`) deriva a IA por no tener fila de encabezados
   detectable. Es derivación legítima; evaluar si conviene un mapeo por posición.

## LOS 3 ROJOS INTERMITENTES NO SON DE ESTA TAREA

La suite completa da 3 fallos que cambian de corrida en corrida, todos por
**timeout de 20 s**, no por lógica. Comprobado, no supuesto:

- Cada archivo, corrido solo, pasa entero.
- El commit `dc0c7401` —el que el CI aprobó en verde con 566 archivos y 7.388
  pruebas— **también falla en esta máquina**, con la misma prueba
  (`PackingListProductsStep`).
- Uno de los rojos es `ClientDrawer.confirm-delete` (SDD-0469), ajeno a este trabajo.

Causa: 22 núcleos ⇒ vitest lanza ~21 workers, y encima corrían el servidor de QA y
el navegador. El CI de GitHub tiene mucha menos concurrencia y pasa.

**FUERA DE ALCANCE DETECTADO:** `PackingListProductsStep.test.tsx` es frágil bajo
carga de CPU. Falla igual en `main`. No se toca desde esta tarea.

## DEFECTOS ABIERTOS, documentados con `it.fails`

Las 6 suites nuevas encontraron 8 defectos. Uno se arregló (`combinedLogistics` sumaba
`totals.cartons ?? 0` y reportaba cajas que ningún documento declaró). Los otros 7 quedan con
una prueba `it.fails` que **se pondrá roja el día que alguien los arregle**, así nadie los
cierra sin enterarse:

| Dónde | Qué pasa | Gravedad |
|---|---|---|
| `access.ts:42` | Un `expires_at` ilegible no niega: `Date.parse` da NaN y la comparación es falsa. Fail-open teórico; hoy la columna es `timestamptz` y PostgREST siempre la serializa en ISO | baja |
| `access.ts:74` | Sin IP resoluble, `resolveRequestIp` devuelve `"unknown"` y todos comparten un solo cupo. Degrada a negar, no a permitir | baja |
| `service.ts:74` | Ante un 23505 se llama a sí misma sin tope de profundidad | media |
| `jobs.ts` | Un archivo cuya lectura falló no se puede reintentar | media |
| `export.ts` (×4) | Redondeo del importe «Sin asignar», cajas de un grupo llamado «Sin asignar», número de caja en blanco, y el pie cuando el borrador sobreasigna un producto | baja |

## CORPUS REAL — lo que reveló

Sam entregó 5 documentos de proveedores de Yiwu (3 XLSX, 2 PDF). Viven fuera de Git y se
apuntan con `DOCUMENT_IMPORT_CORPUS`. **Los tres XLSX fallaban con el código heredado.**
Tres defectos corregidos en `e7937ccb`:

1. El guard de dimensiones medía columnas con **formato** (16.382) en vez de con datos (7),
   y rechazaba proformas de 74 celdas.
2. Faltaban `ITEM` y `DESCRIPCIONES` en el mapa de encabezados: las proformas derivaban a IA
   pudiendo leerse gratis y exactas. Ahora se leen sin IA.
3. Se guardaba la **comisión** como importe declarado del documento — un dato falso.

Cerrado en esta sesión: `DOCUMENT_IMPORT_*` documentadas en `.env.example`
(`ENABLED`, `MODEL`, `RATE_SECRET`, `ALLOWED_ORIGINS`), con el aviso de no encender el flag
antes de que exista la UI.

Riesgos abiertos anotados en el código: recursión sin guarda en `service.ts:74`; el checkbox de
incidencia resuelta en `DocumentEditor` nunca se ve marcado porque `confirmationIssues` ya filtra
`!resolved`; `document_group_boxes` sin `on delete cascade`; el cron drena 1 job por invocación.

**No encender `DOCUMENT_IMPORT_ENABLED` antes de cablear la UI (pendiente 2)**: el 409 dejaría al proveedor sin
ninguna vía para enviar su packing list.

## FUERA DE ALCANCE DETECTADO

Ninguno nuevo. El handoff de 0468 ya registra 11 warnings de lint preexistentes que no se tocaron
y la capa de conocimiento en PENDING/STALE, diferida a después de la integración autorizada.

## HANDOFF AL DIRECTOR

Trabajo activo, claim de esta sesión. Impacto documental: SDD y handoff al día; runbook operativo
por escribir. Graphify/Archify/preview Obsidian pendientes; sin publicación de conocimiento
compartido. PR #129 (SDD-0468) en revisión para integrarse antes que esta rama.
