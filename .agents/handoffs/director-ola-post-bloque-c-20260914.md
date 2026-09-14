# director-ola-post-bloque-c — Ola de cuatro Workers tras el cierre del bloque C

- Fecha: 2026-09-14.
- Owner / sesión escritora: `director-ola-post-bloque-c-20260914` (Claude Code, Fable 5.1), sesión Director.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree de coordinación: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/director-ola-post-bloque-c-20260914`.
- Rama: `codex/director-ola-post-bloque-c-20260914`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`.
- Estado de tarea: en-progreso (coordinación); el producto se ejecuta en cuatro Workers aislados.
- SDD: no aplica a esta rama. Reservas nuevas de esta sesión: SDD-0465 y SDD-0466.
- Permisos del encargo (Sam, 2026-09-14, texto literal: «dale con W1 a W4 en paralelo»): ejecutar los
  cuatro Workers del briefing de esta fecha con los prompts tal como se presentaron, que incluyen
  publicar cada rama propia y abrir su PR en borrador. **Sin merge, sin despliegue, sin aplicar
  migraciones, sin smokes, sin limpieza, sin borrar ramas.** Esta rama de coordinación todavía no
  tiene permiso de publicación; queda local.

## OBJETIVO ORIGINAL

Tras el cierre del objetivo único del bloque C (PR #112), el briefing del 2026-09-14 encontró cero
trabajo en progreso y propuso cuatro Workers paralelos sobre hallazgos registrados como FUERA DE
ALCANCE por L07, L14 y facturas del Portal, más un análisis de la rama de SDD-0235. Sam autorizó
los cuatro en paralelo.

## Estado de partida verificado

- `main` = `origin/main` = `b07ad98b` (merge de la PR #112, 2026-09-14T03:20Z). Cero PRs abiertas.
- CI: «Calidad continua» verde en los últimos seis commits de `main`; check «Calidad local sin
  secretos» verde en `b07ad98b`. Vercel, vía `gh api …/status`: success en `b07ad98b` y en los seis
  merges de código #103 a #108; el ID de deployment no se verificó en Vercel.
- Ledger de producción (`list_migrations`, solo metadatos, sin filas): termina en
  `0451_aliados_cadena_mismo_tenant` (`20260913224613`); `0414`, `0415`, `0422` y `0423` ausentes.
- `supabase/migrations-baseline.json`: cutoff 238; `pendingBelowCutoff` = 0415, 0414, 0422, 0423;
  `degradations` vacío.
- `corepack pnpm sdd:next`: spec siguiente 0465, migración siguiente 0453. `sdd:check` y `docs:check`
  PASARON (452 specs, 449 migraciones). Colisiones ADVISORY históricas sin cambios.
- Sesiones de la app: 8 listadas, ninguna corriendo. Un solo worktree registrado al inicio (el
  checkout principal, limpio). `git ls-remote`: 89 ramas remotas; las refs locales estaban al día.
- Lint en `b07ad98b`: 0 errores, 8 warnings (los mismos registrados por el cierre del bloque C).

## Asignaciones

Worktrees creados con `node scripts/harness-worktree.mjs start <slug>` desde `origin/main`
`b07ad98b`, sin copia de entorno ni instalación. Cada Worker reclama su propio claim.

| W | Task ID | Worktree (`DTD-worktrees/`) | Rama | SDD | Migración | Owner del claim | E2E_PORT |
|---|---|---|---|---|---|---|---|
| W1 | facturas-borradas-lectores-financieros | `facturas-borradas-lectores-financieros` | `codex/facturas-borradas-lectores-financieros` | 0465 nueva | ninguna | `worker-w1-facturas-borradas-20260914` | 3101 |
| W2 | portal-helpers-principal-determinista | `portal-helpers-principal-determinista` | `codex/portal-helpers-principal-determinista` | 0466 nueva | 0453 si hace falta | `worker-w2-portal-helpers-20260914` | 3102 |
| W3 | portal-reportes-principal-0390-0397 | `portal-reportes-principal-0390-0397` | `codex/portal-reportes-principal-0390-0397` | reutiliza 0390 y 0397 | ninguna | `worker-w3-portal-reportes-20260914` | 3103 |
| W4 | analisis-audit-hardening-0235 | `analisis-audit-hardening-0235` | `codex/analisis-audit-hardening-0235` | no aplica | ninguna | `worker-w4-analisis-0235-20260914` | no corre e2e |

Los prompts completos son los del briefing del 2026-09-14, con el bloque de aislamiento añadido
(worktree fijo, guard y claim, `corepack pnpm`, puerto e2e propio, sin credenciales). Los cuatro
corren como agentes en segundo plano de esta sesión Director, cada uno en su worktree; no comparten
árbol ni archivos entre sí.

## Reservas SDD de esta sesión

| SDD | Rama local de reserva | Commit stub | Destino |
|---|---|---|---|
| 0465 | `codex/sdd-reserve-0465-facturas-borradas-lectores-financieros` | `fd11416711913df5f4f271fc5ac84f9c586a0c98` | W1 la incorpora por cherry-pick |
| 0466 | `codex/sdd-reserve-0466-portal-helpers-principal-determinista` | `e8531e07c40f6b10865ef25745d4892be2c8d88b` | W2 la incorpora por cherry-pick |

Reservas locales, sin `--push`: otras máquinas no las ven hasta que se publique la rama numérica
con la forma create-only del runbook, lo que requiere permiso. Migración 0453 coordinada para W2;
si W2 concluye que no hace falta SQL, 0453 queda libre y se registra aquí.

## Matriz y orden de integración

| Tarea | Archivos / contratos | Migración | SDD | Clasificación |
|---|---|---|---|---|
| Smokes y 0415, 0422, 0423, 0414 | producción; esperas del baseline | las cuatro | 0357, 0358, 0365, 0366 | DEBE ESPERAR el smoke de Sam |
| W1 | `lib/studio/*-queries.ts`, `lib/studio/costing/queries.ts`, `app/studio/(app)/facturacion/actions.ts` | ninguna | 0465 | PARALELIZABLE |
| W2 | `supabase/migrations/0453_*`, `supabase/tests/` | 0453 si hace falta | 0466 | PARALELIZABLE |
| W3 | `lib/portal/payment-report-queries.ts`, `app/portal/(app)/facturas/[code]/aceptar/actions.ts`, tests | ninguna | 0390, 0397 | PARALELIZABLE en desarrollo; REQUIERE INTEGRACIÓN PREVIA del smoke de L14 y de 0422 y 0423 |
| W4 | `docs/audits/` | ninguna | no aplica | PARALELIZABLE, solo lectura |
| Retiro de esperas | `supabase/migrations-baseline.json`, notas de spec | tras cada aplicación | 0357, 0358, 0365, 0366 | DEPENDIENTE de cada aplicación |
| Higiene de estados SDD | `docs/specs/*/spec.md` | ninguna | muchas | DEPENDIENTE: después de W3 y del retiro de esperas |

Orden de integración previsto, sujeto a revisión de cada PR sobre su head final: W4 (docs) y W2
(SQL preventivo) en cuanto pasen revisión; W1 después; W3 solo después de que Sam cierre el smoke
de L14 y se apliquen 0422 y 0423, para no mover la superficie que se prueba. Dependencia semántica:
W2 puede cambiar lo que `get_portal_client_markbox()` devuelve a las policies que W3 lee; ambas son
preventivas con un solo tenant y se resuelven integrando W2 primero.

## Gate humano pendiente (no tocado en esta sesión)

| Smoke | Migración que destraba |
|---|---|
| Cobranzas: vista previa de recordatorios con accounting y admin | `0415_mail_logs_read_rbac` |
| Reportes de pago del Portal: alta, cancelación, confirmación y rechazo, con replay | `0422_payment_report_command_boundary`, luego `0423_payment_report_historical_identity` |
| Por roles: Fidelización, CRM y Reportes; Conversaciones; drawer de Órdenes de venta; facturas del Portal | `0414_invoices_read_rbac` |

Cada aplicación exige OK nominal de Sam por nombre y el runbook; después, retirar su espera en una
rama propia, como con 0451 y 0452.

## Limpieza pendiente de autorización (nada se borró)

- Remotas: 79 ramas ancestro de `main`, todas con PR MERGED salvo `feat/sdd-0255-aliados-white-label`,
  que es ancestro sin PR. Tabla completa en el anexo. Las 9 con contenido propio conservan el
  dictamen del 2026-09-12.
- Locales: 12 stubs de reserva (`codex/sdd-reserve-0444/0451/0452/0456…0464`) que `-d` rechaza;
  seis ramas de tarea: `codex/c-integracion-ola1` (12 merges, sin commits propios),
  `codex/pr33-schema-validation-20260907` (1 merge, sin commits propios),
  `codex/profile-integration-validation-20260906` (dos commits de docs sobre un handoff que ya existe
  en `main`; equivalencia de texto no comparada), `codex/remove-agentation-20260910` y
  `codex/pr28-e2e-harness-validation-20260906` (sin remoto, descartadas por dictamen) y
  `codex/portal-colors-reception-integration-20260906` (REVISIÓN PROPIA).
- `stash@{0}` del checkout principal («Director adoption: preserve local AGENTS before main
  74bb52ab», AGENTS.md, 17 líneas más y 14 menos) y `DTD-worktrees/_pr-bodies-backup/pr80-body-antes-ronda2.md`.

## Decisiones pendientes de Sam

Resto de la PR #21 (111 archivos mezclados, 39 colisiones); barrido «DDP» a «Puerta a Puerta»;
E2E hospedado con secretos en CI o aceptar SDD-0440 sin ese criterio; ocho entradas de terceros en
`skills-lock.json`; destino de las cuatro ramas CONSERVAR y las dos de descarte del dictamen del 12;
hallazgos menores de L07 sin encargo (ingresos por asesor que tragan el error, consultas por orden en
Órdenes de venta con SDD-0322 sin código, `getReceivableHistory` sin gate de módulo, mock débil en
`route-auth.test.ts`).

## COMPLETADO

- Briefing de las seis secciones con evidencia y matriz, entregado a Sam.
- Reservas SDD-0465 y SDD-0466 creadas con plumbing, sin tocar el árbol de `main`.
- Cinco worktrees creados desde `b07ad98b`: cuatro de Workers y este de coordinación.
- Cuatro Workers lanzados en paralelo con prompts completos y aislamiento fijo.

## VALIDACIÓN

- PASÓ: `git fetch origin` (dos veces), `node scripts/director-status.mjs`, `git ls-remote --heads origin`.
- PASÓ: `corepack pnpm sdd:next`, `corepack pnpm sdd:check`, `corepack pnpm docs:check`.
- PASÓ: `corepack pnpm lint` en `b07ad98b`: 0 errores, 8 warnings.
- PASÓ: `list_migrations` del proyecto de producción, solo metadatos; ninguna fila de negocio leída.
- PASÓ: guard y claim de este worktree.
- NO EJECUTADO: `corepack pnpm verify` sobre esta rama, que solo contiene documentación de dirección.
- PASÓ: verificación independiente de la PR #113 (blobs idénticos y `--find-object` sobre `main`, subconjunto de la spec 0235, textos desfasados en `main`).
- NO VERIFICADO: ID de deployment en Vercel; resultados de W1, W2 y W3 hasta que cierren.

## COMMITS

- `fcab70f0` — handoff inicial de la ola (asignaciones, reservas, matriz, anexo de ramas).
- Commit que contiene esta actualización (revisión de la PR #113 y método de blobs); SHA en la PR cuando se publique.

## PR / BRANCH

Rama `codex/director-ola-post-bloque-c-20260914` sobre base `main` `b07ad98b`, local, sin PR:
publicación pendiente de permiso.

## PENDIENTES DE ESTA TAREA

- Recibir el cierre de cada Worker, revisar su PR completa (diff, alcance, SDD, tests, omisiones)
  sobre el head final y registrar aquí el SHA revisado y el veredicto.
- Registrar si W2 usó 0453 o la liberó.
- Pedir a Sam, en bloque, las autorizaciones que siguen abiertas: smokes y OK nominal por
  migración, limpieza remota y local, publicación de esta rama de coordinación y decisiones.

## FUERA DE ALCANCE DETECTADO

- `.env.local` del checkout principal es un directorio, no un archivo; no se revisó su contenido.
- Las deudas de dirección ya listadas arriba; ninguna se convierte en pendiente propio.

## HANDOFF AL DIRECTOR

Sesión Director activa con claim sobre este worktree. Siguiente acción: revisar los cuatro cierres
a medida que lleguen y preparar el bloque de autorizaciones para Sam.

## Revisión de PRs de esta ola

### W4 · PR #113 · `codex/analisis-audit-hardening-0235` · SHA revisado `bc40762581de19cc518a89242237635877eda8cc`

- Alcance: dos archivos, solo documentación (`docs/audits/analisis-audit-hardening-0235.md`, 137 líneas,
  y el handoff del Worker, 74 líneas). Sin producto, sin SQL, sin cambio de estado de la spec 0235.
- Veredicto del Worker: 42 archivos de `origin/codex/audit-hardening-20260801` (head `ec7adeb9`):
  17 IDÉNTICOS por blob, 25 SUPERADOS, 0 VIGENTES, 0 EN CONFLICTO. La rama entró a `main` por otra
  vía (hotfix `1955474e` y carril Gobernanza 9, merge `76b242bd`); `git cherry` no lo ve porque los
  patch-id difieren.
- Verificación independiente del Director sobre `b07ad98b`: 17 blobs idénticos (coincide); de los 25
  distintos, 20 blobs exactos de la rama aparecen en la historia de `main` con `git log
  --find-object` (re-aterrizajes del 2026-08-01 al 2026-09-11); los 5 restantes son documentos
  (`.env.example`, spec 0235, `mapa-de-borrado.md`, `registro-tratamiento.md`, handoff histórico) y
  la tabla los justifica línea a línea. Comprobado además que la spec 0235 de la rama es subconjunto
  estricto de la de `main` (0 líneas quitadas, 10 agregadas) y que `main` todavía dice en
  `mapa-de-borrado.md` §8 que 0326–0329 «siguen fuera de Producción», contra el ledger
  (`20260803091250` a `20260803091410`): el hallazgo documental C1 es real.
- Handoff del Worker con las ocho secciones; claim `worker-w4-analisis-0235-20260914` liberado;
  `finish` informa árbol limpio y sin claim. `docs:check` y `sdd:check` PASARON según el Worker;
  `verify` NO EJECUTADO por ser documental, aceptado.
- Checks de la PR al revisar: «Calidad local sin secretos» en curso, Vercel preview SUCCESS.
- **Veredicto Director: APROBADA para integración**, sujeta a autorización de merge de Sam y al check
  verde sobre `bc407625`. Sin efecto productivo de código; un merge a `main` redespliega el mismo
  código (Vercel no excluye `.agents/`), efecto a cubrir en la autorización.
- Corrección del dictamen del 2026-09-12 §3: `codex/audit-hardening-20260801` pasa de CONSERVAR a
  **descarte recomendado** (C2), pendiente de autorización; único blob sin equivalente, el handoff
  histórico `6cf1f32a`, preservable con un tag si Sam lo quiere.
- Lotes propuestos por W4 que quedan como decisiones de Sam: C1 cierre documental de SDD-0235
  (estado de la spec y tres textos desfasados); C2 borrado de la rama remota; R1 retención de
  `public_track_log` (política de retención primero; spec nueva).

### Método de blobs aplicado a las demás ramas del dictamen (Director, 2026-09-14)

`git diff --name-only main...rama`; por archivo, blob idéntico en `main`, blob presente en la historia
de `main` (`--find-object`) o sin equivalente. Mide contenido, no commits.

| Rama | Archivos | Idénticos | Blob en historia de main | Sin equivalente | Lectura |
|---|---|---|---|---|---|
| `codex/governance-final-100` | 101 | 71 | 27 | 3 (`docs/governance/README.md`, spec 0226, índice de specs) | producto íntegro en `main`; revisar solo dos documentos antes de descartar |
| `codex/portal-colors-reception-integration-20260906` | 101 | 76 | 19 | 6 (su handoff, specs 0441 y 0443 con allowlist y qa, índice) | producto íntegro en `main`; revisar si las notas de QA de 0441/0443 aportan algo antes de descartar |
| `feat/no-olvidar` | 52 | 0 | 0 | 52 | trabajo propio real (SDD-0025 `approved`); la migración 0017 sí está aplicada en producción desde el 2026-09-10; rescate por lotes es decisión de Sam |
| `feat/sdd-0286-api-alcance-por-modulo` | 10 | 1 | 0 | 9 | versiones más viejas de archivos que `main` ya reescribió (SDD-0286 `done`); descarte recomendado tras comparación línea a línea |
| `claude/jolly-proskuriakova-3da0aa` | 24 | 0 | 2 | 22 | barrido DDP real; decisión de marca |
| `preview/portal-nueva-compra` | 1 | 0 | 0 | 1 | SOLO-PREVIEW, no integrable por diseño |

## Anexo · ramas remotas ancestro de `main` (79)

| Rama remota | PR | Ancestro de main |
|---|---|---|
| `claude/quizzical-dijkstra-809aae` | #99 merged 2026-09-12 | sí |
| `claude/stoic-thompson-6ef73b` | #94 merged 2026-09-12 | sí |
| `claude/youthful-driscoll-120aae` | #97 merged 2026-09-12 | sí |
| `codex/0017-aplicada-prod` | #54 merged 2026-09-10 | sí |
| `codex/0445-functional-remediation` | #26 merged 2026-09-10 | sí |
| `codex/0447-aplicada-prod` | #53 merged 2026-09-10 | sí |
| `codex/0448-baseline-post-aplicacion` | #36 merged 2026-09-09 | sí |
| `codex/0448-replay-0223-history` | #29 merged 2026-09-09 | sí |
| `codex/0450-codigo-contra-migraciones-eximidas` | #44 merged 2026-09-10 | sí |
| `codex/a5-1-direccion-bodega-cn-visible` | #42 merged 2026-09-10 | sí |
| `codex/a5-2-recepcion-movil-errores` | #45 merged 2026-09-10 | sí |
| `codex/a5-4-referencias-colgantes-0435` | #41 merged 2026-09-10 | sí |
| `codex/a53-hallazgos-ingenieria` | #46 merged 2026-09-10 | sí |
| `codex/aliado-tenant-coherence` | #87 merged 2026-09-11 | sí |
| `codex/analytics-privacy` | #24 merged 2026-09-09 | sí |
| `codex/brand-semantic-colors` | #31 merged 2026-09-10 | sí |
| `codex/c-0409-aplicada-prod` | #85 merged 2026-09-11 | sí |
| `codex/c-0418-aplicada-prod` | #92 merged 2026-09-11 | sí |
| `codex/c-analisis-bloque-c` | #62 merged 2026-09-11 | sí |
| `codex/c-fix-pending-symbols-utf16` | #79 merged 2026-09-11 | sí |
| `codex/c-l01-portal-marca` | #82 merged 2026-09-12 | sí |
| `codex/c-l02-portal-visibilidad` | #76 merged 2026-09-12 | sí |
| `codex/c-l03-portal-asesor` | #83 merged 2026-09-12 | sí |
| `codex/c-l04-portal-referidos` | #78 merged 2026-09-12 | sí |
| `codex/c-l05-portal-perfil-privado` | #75 merged 2026-09-12 | sí |
| `codex/c-l06-portal-documentos` | #77 merged 2026-09-12 | sí |
| `codex/c-l08-mailing-rbac` | #74 merged 2026-09-11 | sí |
| `codex/c-l09-bank-reconciliation-rbac` | #63 merged 2026-09-11 | sí |
| `codex/c-l11-portal-prealertas-servicios` | #81 merged 2026-09-11 | sí |
| `codex/c-l12-portal-academia-tenant` | #64 merged 2026-09-11 | sí |
| `codex/c-l13-portal-reclamos` | #67 merged 2026-09-11 | sí |
| `codex/c-l15-portal-club` | #73 merged 2026-09-11 | sí |
| `codex/c-l16-portal-direcciones` | #68 merged 2026-09-11 | sí |
| `codex/c-l17-verificar-throttle` | #80 merged 2026-09-12 | sí |
| `codex/c-l18-portal-principal` | #66 merged 2026-09-11 | sí |
| `codex/c-l19-portal-mensajes` | #69 merged 2026-09-11 | sí |
| `codex/c-l20-portal-cajas-bodega` | #72 merged 2026-09-11 | sí |
| `codex/c-l21-portal-realtime-mensajes` | #70 merged 2026-09-11 | sí |
| `codex/c-l22-portal-addons` | #84 merged 2026-09-11 | sí |
| `codex/c-nota-specs-importadas` | #65 merged 2026-09-11 | sí |
| `codex/c-registro-0425-0427` | #71 merged 2026-09-11 | sí |
| `codex/c-registro-lote-20260911` | #95 merged 2026-09-12 | sí |
| `codex/c2-bloque-d-document-entity-rbac` | #50 merged 2026-09-10 | sí |
| `codex/c2-prerequisito-0416-portal-shipments` | #47 merged 2026-09-10 | sí |
| `codex/cambios-portales` | #33 merged 2026-09-10 | sí |
| `codex/ci-quality-extract-20260905` | #34 merged 2026-09-06 | sí |
| `codex/d1-bucle-modulos-m-erp` | #58 merged 2026-09-10 | sí |
| `codex/d1-d3-evidencia-arnes` | #48 merged 2026-09-10 | sí |
| `codex/d2-webkit-auth-cors` | #59 merged 2026-09-10 | sí |
| `codex/d4-hidratacion-diagnostico` | #49 merged 2026-09-10 | sí |
| `codex/declarar-0447-pendiente` | #39 merged 2026-09-10 | sí |
| `codex/deudas-cola-20260910` | #60 merged 2026-09-10 | sí |
| `codex/e1-archivos-generados-serializan` | #51 merged 2026-09-10 | sí |
| `codex/e2e-harness-general-20260905` | #28 merged 2026-09-09 | sí |
| `codex/e3-gate-no-pude-comprobar` | #52 merged 2026-09-10 | sí |
| `codex/engineering-director-worker` | #32 merged 2026-09-06 | sí |
| `codex/fix-choque-0435-specs` | #38 merged 2026-09-10 | sí |
| `codex/handoff-0457-integrada` | #96 merged 2026-09-12 | sí |
| `codex/mailing-test-template-admin-guard` | #91 merged 2026-09-11 | sí |
| `codex/medicion-tokens-a53-a56` | #43 merged 2026-09-10 | sí |
| `codex/merge-driver-baseline-removal` | #93 merged 2026-09-11 | sí |
| `codex/merge-driver-symbol-declarations` | #88 merged 2026-09-11 | sí |
| `codex/pending-symbols-do-blocks` | #90 merged 2026-09-11 | sí |
| `codex/portal-claridad-botones-mensajes` | #30 merged 2026-09-10 | sí |
| `codex/portal-profile-privacy-remediation` | #27 merged 2026-09-10 | sí |
| `codex/pr21-bloque-a-specs-0316-0400` | #37 merged 2026-09-09 | sí |
| `codex/pr28-transport-v3-20260907` | #56 merged 2026-09-10 | sí |
| `codex/principal-sin-inferir` | #98 merged 2026-09-12 | sí |
| `codex/purge-public-verify-throttle` | #86 merged 2026-09-11 | sí |
| `codex/push-endpoint-hardening-20260904` | #22 merged 2026-09-05 | sí |
| `codex/recover-applied-migrations-0399-0445` | #25 merged 2026-09-04 | sí |
| `codex/rescate-dtd-0441-proveedor-20260910` | #57 merged 2026-09-10 | sí |
| `codex/revertir-recepcion-cn` | #40 merged 2026-09-10 | sí |
| `codex/sanitizer-formato-actual-de-claves` | #61 merged 2026-09-11 | sí |
| `codex/sdd0380-publication-review-20260907` | #35 merged 2026-09-10 | sí |
| `codex/skills-agentation-retirar` | #100 merged 2026-09-12 | sí |
| `codex/verify-e2e-watchdog` | #89 merged 2026-09-11 | sí |
| `feat/sdd-0255-aliados-white-label` | sin PR (ancestro igual) | sí |
| `portalcliente` | #23 merged 2026-09-10 | sí |
