# Handoff Worker — bloque RBAC documento-entidad

Fecha: 2026-09-10 · Estado: bloqueada por dependencia SQL fuera de alcance.
Owner/claim: `codex-worker-c2-bloque-d-document-entity-rbac-20260910`.
Task ID: `c2-bloque-d-document-entity-rbac`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c2-bloque-d-document-entity-rbac`.
Rama: `codex/c2-bloque-d-document-entity-rbac`.
Base asignada: `main@8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`.
Origen selectivo: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (cabeza publicada de PR #21).

## OBJETIVO ORIGINAL

Llevar a `main`, mediante una sola PR draft, el bloque «RBAC documento-entidad»
extraído de PR #21: diez specs SDD-0403–0412, diez migraciones 0435–0444 y sus
diez contratos SQL, sin importar el resto de #21 ni aplicar nada a producción.

## CONTRATO DE TAREA

- SDD asignadas: `0403` a `0412`, sin renumeración.
- Alcance permitido: los 30 archivos fuente; entradas nuevas únicamente en
  `pendingBelowCutoff` de `supabase/migrations-baseline.json`; índice regenerado
  `docs/specs/README.md`; este handoff.
- Exclusiones: `app/**`, `lib/**`, cualquier otra spec/migración de #21, cambio
  de `cutoff`, PR #21, ruleset, merge, deploy, Cloud y producción.
- Dependencias duras: ninguna. Archivos compartidos con otras ramas:
  `docs/specs/README.md` y `supabase/migrations-baseline.json`; cualquier
  conflicto futuro se resuelve regenerando índice y uniendo entradas del baseline.
- Autorizado: commits locales selectivos, push de esta rama y una PR draft a
  `main`. No autorizado: merge, aplicación de migraciones, producción ni cleanup.

## ACEPTACIÓN

- [x] Los 30 archivos están presentes e idénticos al objeto `ea9952a4`.
- [x] Diez entradas exactas nuevas en `pendingBelowCutoff`; `cutoff` sigue en 238.
- [x] `pnpm sdd:check` y `pnpm docs:check` pasan; índice regenerado por comando.
- [x] Diez contratos SQL pasan en PostgreSQL local desechable.
- [ ] Reconstrucción de esquema desde cero pasa con las diez migraciones.
- [ ] `pnpm verify` se ejecuta y cada gate/SKIP queda clasificado sin fallos.
- [x] No se consultan filas reales, no se escribe Cloud y no se aplica migración.
- [ ] Rama publicada y PR draft lista explícitamente las diez migraciones y
  declara que fusionar no autoriza aplicarlas.

## COMPLETADO

- Se leyeron enteras las diez specs y las diez migraciones. La correspondencia
  por dominio quedó confirmada: 0403↔0435 invoice, 0404↔0436 treasury,
  0405↔0437 accounting, 0406↔0438 expense, 0407↔0439 shipment,
  0408↔0440 client, 0409↔0441 supplier, 0410↔0442 naviera,
  0411↔0443 bitacora y 0412↔0444 unlinked.
- Se copiaron los 30 paths exactos desde
  `ea9952a47f4adf14c48c91e6d0147597beb94aa7`; 30/30 hashes de blob del
  working tree coinciden con ese objeto.
- Se añadieron diez claves exactas a `pendingBelowCutoff`, una por migración,
  con qué hace, motivo de espera, consecuencia mientras espera, autorización
  nominal de Sam e idempotencia/prerrequisito. El JSON parsea, contiene 15
  esperas totales y conserva `cutoff: 238`.
- `docs/specs/README.md` fue regenerado exclusivamente con `pnpm docs:index`.
- No se importó ningún archivo `app/**`, `lib/**` ni otro archivo de PR #21.
- No se consultó el ledger ni ninguna fila de negocio: no hay `.env.local` ni
  variables Supabase. No hubo escritura Cloud ni aplicación de migraciones.

## VALIDACIÓN

- **PASÓ** — `corepack pnpm install --frozen-lockfile`: Node 24.20.0,
  pnpm 12.3.4, 813 paquetes; lockfile sin cambios.
- **PASÓ** — identidad de origen al cierre: 30 paths presentes y 0 diferencias
  de blob contra `ea9952a4`.
- **PASÓ** — `corepack pnpm docs:index`: índice regenerado, 405 specs y 44 huecos.
- **PASÓ** — `corepack pnpm sdd:check`: 405 specs, 413 migraciones, sin números
  repetidos nuevos; sólo avisos históricos eximidos por el propio gate.
- **PASÓ** — `corepack pnpm docs:check`.
- **PASÓ** dentro de `pnpm verify`: harness 12/12; lint con 0 errores y 8
  warnings preexistentes; frontera RSC; TypeScript; 4 Edge Functions;
  Vitest 513 archivos / 6496 pruebas; docs; numbering; feature constants;
  components y governance.
- **NO DISPONIBLE** dentro de `pnpm verify`: `migrations-applied` emitió SKIP
  por ausencia de `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
  No se consultó el ledger real.
- **PASÓ** dentro de `pnpm verify`: 155/155 contratos SQL en `postgres:17`,
  rollback total. Los diez contratos 0435–0444 aparecen individualmente como
  PASÓ.
- **FALLÓ** dentro de `pnpm verify`: `schema-rebuild` murió en
  `0439_shipment_document_entity_rbac.sql:75` tras 384 de 413 migraciones:
  `0439: policies de shipment_documents ausentes o con drift`.
- **EVIDENCIA DEL BLOQUEO**: `0439` líneas 40–59 exige que
  `shipment_documents portal self read` contenga `client_users`, `auth.uid()`
  y `tenant_id`. En la base 8ee41f19, 0086 conserva la policy histórica basada
  en `get_portal_client_markbox()`. La migración que la endurece es
  `0416_portal_shipments_tenant_boundary.sql` de PR #21; no existe en
  `8ee41f19` ni en `origin/main`, y sólo está en `refs/dtd/pr/21` y
  `origin/codex/saneamiento-integral`. El test 0439 crea sintéticamente la policy
  endurecida en sus líneas 199–215, por eso el contrato focal pasa aunque el
  rebuild real falle.
- **FALLÓ / INTERRUMPIDO** — E2E general de `pnpm verify`: produjo fallos de
  rutas autenticadas por falta de URL/clave pública Supabase y no emitió resumen
  terminal. Tras más de dos minutos sin salida, la inspección mostró cero
  procesos Node/Playwright; se cerró la PTY colgada con Ctrl+C. No se atribuye
  cobertura E2E completa ni un conteo final.
- **PASÓ** — `corepack pnpm build` ejecutado aparte porque `verify` no llegó a
  su último gate: compilación, TypeScript y 160 páginas generadas. Los mensajes
  por Supabase ausente fueron fallbacks no fatales; exit 0.
- **PASÓ** — revisión final de alcance: 33 paths cambiados, todos dentro del
  allowlist (30 fuentes + índice + baseline + handoff), `git diff --check` en 0
  y sin whitespace terminal detectado. `sdd:check` y `docs:check` se repitieron
  en verde después del handoff/baseline final.

## COMMITS

Ninguno. La validación falló antes del commit; no se creó un commit conocido
como incapaz de reconstruir el esquema.

## PR / BRANCH

Rama local `codex/c2-bloque-d-document-entity-rbac`, base y `origin/main` en
`8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`. No se publicó y no se abrió PR:
la aceptación de rebuild está roja y la corrección exige cambiar el alcance u
orden de integración. PR #21 no fue modificada ni cerrada.

## PENDIENTES DE ESTA TAREA

Decisión del Director sobre la dependencia dura `0416`:

1. Recomendado: extraer primero, en otra PR/orden, el trío exacto
   `docs/specs/0359-portal-shipments-tenant-boundary/spec.md`,
   `supabase/migrations/0416_portal_shipments_tenant_boundary.sql` y
   `supabase/tests/0416_portal_shipments_tenant_boundary.test.sql`, incluida su
   espera nominal en el baseline. Tras integrarlo a main, actualizar esta rama
   por merge de `origin/main` y repetir validación. Así C2 conserva sus 30
   archivos verbatim.
2. Alternativa que cambia este alcance: autorizar esos tres archivos y su
   entrada baseline dentro de C2. El conjunto dejaría de ser de 30 archivos.
3. Alternativa incompatible con “verbatim”: reescribir 0439 para migrar desde la
   policy histórica. No se ejecutó.

Después de la decisión faltan rebuild verde, `pnpm verify` sin fallos,
revalidación de identidad/scope, commits selectivos, push y PR draft.

## FUERA DE ALCANCE DETECTADO

- Las specs verbatim 0406, 0407 y 0412 conservan referencias a guardias de
  aplicación de su PR original. El recorte ordenado excluye esos archivos y no
  se reinterpretó el estado histórico `done`; este PR no re-certifica el alcance
  de aplicación original.
- Ocho warnings lint preexistentes en pruebas de Compras y componentes CRM.
- E2E general depende de configuración Supabase no presente en este worktree.

## HANDOFF AL DIRECTOR

El bloque está preparado dentro del allowlist, pero no es integrable todavía:
`0439` tiene una dependencia comprobada de 0416 que contradice “ninguna dura”.
El Director debe escoger el orden/alcance anterior; no se debe publicar ni
integrar esta rama hasta conseguir rebuild verde. No hubo merge, deploy,
producción, lectura de filas reales ni cambios a PR #21. El claim se libera al
terminar esta escritura; rama y worktree se conservan.
