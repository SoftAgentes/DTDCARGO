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
- Dependencia: SDD-0468 ya mergeada en esta rama (`93b87608`); su PR #129 sigue en draft.

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
| `vitest` document-import (4 archivos) | **PASÓ** — 63 pruebas |
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

1. Las 6 suites de la allowlist que faltan: `service`, `jobs`, `access`, `http`, `export`, `estimate`.
2. `DocumentImportPanel` (zona de carga como primer paso, chips de formato, cámara en móvil) y
   `DocumentCalculator`; cablear los 7 puntos de UI; recién ahí encender el flag.
3. Harness de QA visual 0473 y `/ui-check`.
4. `pnpm verify` reportando cada SKIP, y el recorrido con documentos reales anonimizados.

Cerrado en esta sesión: `DOCUMENT_IMPORT_*` documentadas en `.env.example`
(`ENABLED`, `MODEL`, `RATE_SECRET`, `ALLOWED_ORIGINS`), con el aviso de no encender el flag
antes de que exista la UI.

Riesgos abiertos anotados en el código: recursión sin guarda en `service.ts:74`; el checkbox de
incidencia resuelta en `DocumentEditor` nunca se ve marcado porque `confirmationIssues` ya filtra
`!resolved`; `document_group_boxes` sin `on delete cascade`; el cron drena 1 job por invocación.

**No encender `DOCUMENT_IMPORT_ENABLED` antes del punto 4**: el 409 dejaría al proveedor sin
ninguna vía para enviar su packing list.

## FUERA DE ALCANCE DETECTADO

Ninguno nuevo. El handoff de 0468 ya registra 11 warnings de lint preexistentes que no se tocaron
y la capa de conocimiento en PENDING/STALE, diferida a después de la integración autorizada.

## HANDOFF AL DIRECTOR

Trabajo activo, claim de esta sesión. Impacto documental: SDD y handoff al día; runbook operativo
por escribir. Graphify/Archify/preview Obsidian pendientes; sin publicación de conocimiento
compartido. PR #129 (SDD-0468) en revisión para integrarse antes que esta rama.
