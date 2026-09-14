# director-ola-post-bloque-c — Ola de cuatro Workers tras el cierre del bloque C

- Fecha: 2026-09-14.
- Owner / sesión escritora: `director-ola-post-bloque-c-20260914` (Claude Code; Fable 5.1 hasta la revisión de W1, Opus 5 desde la ejecución nocturna), sesión Director.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree de coordinación: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/director-ola-post-bloque-c-20260914`.
- Rama: `codex/director-ola-post-bloque-c-20260914`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`.
- Estado de tarea: lista-para-revision (coordinación): los cuatro Workers cerraron y sus PRs están revisadas; falta la autorización de Sam para integrar.
- SDD: no aplica a esta rama. Reservas nuevas de esta sesión: SDD-0465 y SDD-0466.
- Permisos del encargo (Sam, 2026-09-14, texto literal: «dale con W1 a W4 en paralelo»): ejecutar los
  cuatro Workers del briefing de esta fecha con los prompts tal como se presentaron, que incluyen
  publicar cada rama propia y abrir su PR en borrador. **Sin merge, sin despliegue, sin aplicar
  migraciones, sin smokes, sin limpieza, sin borrar ramas.** Esta rama de coordinación todavía no
  tiene permiso de publicación; queda local.
- Autorización en bloque (Sam, 2026-09-14, textos literales, después del mensaje del Director que
  enumeraba merges, migraciones, limpieza y publicación): «CONTIA AVANZA» y «hagas todas las tareas
  continuas sin detenerte. Me voy a ir a dormir, pero tú sigue trabajando en todos los pendientes,
  Director.» Alcance y exclusiones en la sección «Ejecución nocturna».

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

## Gate humano pendiente (no tocado en esta sesión; guion en el archivo de smokes)

| Smoke | Migración que destraba |
|---|---|
| Cobranzas: vista previa de recordatorios con accounting y admin | `0415_mail_logs_read_rbac` |
| Reportes de pago del Portal: alta, cancelación, confirmación y rechazo, con replay | `0422_payment_report_command_boundary`, luego `0423_payment_report_historical_identity` |
| Por roles: Fidelización, CRM y Reportes; Conversaciones; drawer de Órdenes de venta; facturas del Portal | `0414_invoices_read_rbac` |

Cada aplicación exige OK nominal de Sam por nombre y el runbook; después, retirar su espera en una
rama propia, como con 0451 y 0452.

## Limpieza propuesta al inicio de la sesión (estado antes de la ejecución nocturna; lo ejecutado y lo conservado está en «Ejecución nocturna»)

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

## Ejecución nocturna — autorización en bloque del 2026-09-14

**Interpretación registrada.** Los dos mensajes de Sam llegan justo después del mensaje del Director que
enumeraba, en orden y por nombre, lo que necesitaba autorización. Se tratan como autorización en bloque de
ESA lista, con el mismo criterio que la del 2026-09-13 (`.agents/handoffs/0451-aplicacion-prod-20260913.md`),
y quedan fuera los ítems con gate humano:

| Ítem enumerado | Tratamiento |
|---|---|
| 1 · Merges #113 → #115 → #116, con despliegue por Vercel | autorizado; cada merge sobre head revisado, check requerido verde y rama al día (el ruleset exige `strict`) |
| 1 · #114 | FUERA: depende del smoke de L14 y de 0422 y 0423 |
| 2 · 0415, 0422 y 0423, 0414 | FUERA: gate humano (smokes con cuentas reales) |
| 2 · 0453 y sus dos lecturas previas sin filas | lecturas hechas; aplicación NO ejecutada por los hallazgos de abajo |
| 3 · Limpieza nombrada | ejecutada solo donde hay evidencia de cero pérdida; el resto se conserva por la regla del runbook |
| 4 · Publicación de esta rama con PR en borrador | autorizada; al final de la noche, con todo escrito antes del push |
| 5 · Decisiones de dirección | FUERA: son de Sam |

### Merges

| PR | Head revisado | Merge commit | Hora (UTC) | Vercel en el merge |
|---|---|---|---|---|
| #113 | `bc40762581de19cc518a89242237635877eda8cc` | `832c0370a2369b9a85a92b4236836977e4871183` | 2026-09-14T06:58:26Z | success, vía estado de GitHub; ID de deployment no verificado |
| #116 | `a10efa93ac88ed0970b95c55098108818e339813` (puesta al día de `831799a3`) | `7cd50f4a451e10117f94f857cf4a7176b4a007a4` | 2026-09-14T07:20:02Z | se registra al confirmarse |

- #115: puesta al día con `main` `832c0370` por la API de GitHub (`update-branch` con
  `expected_head_sha` `d6006f7b`; head nuevo `d224613d`). **Retenida**: vuelve a W2 en ronda 4.
- #116: puesta al día igual (`expected_head_sha` `831799a3`; head nuevo `a10efa93`). #113 no toca el
  índice de specs, así que no hizo falta regenerarlo. Antes del merge se verificó que el merge de puesta al día
  solo trae los dos archivos de #113 y que el delta propio de la PR frente a su base es idéntico por patch-id
  al revisado sobre `831799a3`. Check requerido «Calidad local sin secretos» SUCCESS sobre `a10efa93`.
  Integra la regla de producto autorizada con el merge: solo los borradores se eliminan; el resto se anula.

### 0453 — lecturas previas en producción (autorizadas, sin filas) y decisión

Proyecto `xpfuzqombmjmxvprjgmi`, 2026-09-14, solo catálogo y agregados.

- `get_user_tenant_id()`: cuerpo normalizado igual al de 0200; SECURITY DEFINER, estable, owner postgres,
  `proconfig` `{search_path=public}`, ACL `{postgres=X/postgres,authenticated=X/postgres}`.
- `get_portal_client_markbox()`: cuerpo normalizado igual al de 0080; mismo perfil, ACL
  `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`.
- `client_delivery_addresses_validate_client()`: **el cuerpo NO es el del archivo 0198**, le falta el comentario
  interno de tres líneas. md5(prosrc) `7db6f812a549df579f2d7d0d6cd72298`; volátil; ACL
  `{postgres=X/postgres,service_role=X/postgres}`. El trigger `client_delivery_addresses_validate_trg` está vivo
  (tgtype 23, habilitado).
- Conteos: 0 usuarios con más de una membresía activa; **1 vínculo `client_users` activo con cliente borrado**;
  0 vínculos activos con tenant distinto.

**Decisión: 0453 no se aplica esta noche.** Su preflight compara el cuerpo normalizado con la forma de 0198 del
repo y abortaría sin cambiar nada. Además, el vínculo con cliente borrado cambia el impacto con que se pidió la
autorización («hoy no puede pasar»): ese principal pasaría a recibir NULL de la helper. La app ya lo rechaza
(`lib/portal/portal-queries.ts:93` exige cliente vivo y `app/portal/(app)/layout.tsx:40` lo manda a `/entrar`),
así que no pierde nada visible, pero la autorización tiene que darse con ese dato a la vista. Ronda 4 pedida a W2:
aceptar en el preflight la forma Cloud de 0198 (precedente de 0423), probarla en el contrato y registrar la deriva
y los conteos en la spec y en la espera. La foto de advisors de seguridad tomada antes quedó fuera de Git y no se
usó: se repite antes de aplicar.

### Limpieza

| Rama local borrada con `-D` | SHA | Evidencia de cero pérdida |
|---|---|---|
| `codex/c-integracion-ola1` | `67d9ad58d3eaf736396ea3baa3b7a48d2d759d4a` | 61 archivos: 37 idénticos y 21 con su blob en la historia de `main`; solo difieren tres registros generados (índice de specs, baseline y declaraciones de símbolos) |
| `codex/pr33-schema-validation-20260907` | `a427c755c0b83ee50df47ec38f21865b7a2b1a0f` | 39 archivos, todos idénticos o con su blob en la historia de `main` |
| `codex/profile-integration-validation-20260906` | `50bb5f1b7f5670ddfb6c1ab17496004801983b85` | 25 archivos; solo difiere el índice de specs, que es generado |
| `codex/remove-agentation-20260910` | `0e49cd42ac2ccc4db0b82a7c7c26a25f38ff8763` | contenido propio respaldado en GitHub por `refs/pull/55/head` (PR #55 cerrada) |
| `codex/sdd-reserve-0444-engineering-director-worker` | `b7874e9623646097e88625516c1dd8519f175721` | spec 0444 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0451-d1-bucle-recarga-ruta-movil-erp` | `29e2d614c9b85fd6971fc9c8ccdd6079bd1a9c43` | spec 0451 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0452-sanitizer-formato-actual-de-claves` | `20ac7f6d52e17ed772c83d9e811202ca23145c83` | spec 0452 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0456-aliado-tenant-coherence` | `efde200193597f2f5e3711247db275b79d6fccad` | spec 0456 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0457-harness-spawn-enobufs` | `6eb27f6731e172e38ea78b6bf073d4b30dcb2837` | spec 0457 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0458-harness-finish-claude-worktrees` | `ce4cf4526c8bde8f90dafbc926e4eb6e18fc21c2` | spec 0458 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0459-principal-sin-inferir` | `5c65270ab655fdfcfb044d442409fed8b167c941` | spec 0459 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0460-harness-worktrees-bare-locked` | `e2c5f43d7a2fde3bb8ee9aebcc04b93aba3a52a8` | spec 0460 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0461-aliados-cadena-tenant` | `3818905bdae1efb04cc05c81bdcbadf361b3cd30` | spec 0461 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0462-portal-facturas-tenant` | `cf03dad73cc57151d2aff9a01ad164b8b15c7e65` | spec 0462 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0463-portal-facturas-rls` | `63fadfc918b480a0e835ea150cc2428f6a69a25a` | spec 0463 en `main`; el stub es una plantilla superada |
| `codex/sdd-reserve-0464-harness-gate-simbolos-por-relacion` | `0c523c21f0e5091ea653dd7258f64741f3aa9042` | spec 0464 en `main`; el stub es una plantilla superada |

- **Remotas:** 78 ramas borradas con `git push origin --delete`: las del anexo de ramas ancestro salvo
  `feat/sdd-0255-aliados-white-label`. Re-verificación inmediata antes de borrar, rama por rama: PR MERGED con
  ese nombre, head ancestro de `origin/main`, sin PR abierta y sin worktree. Excluidas: 0. SHAs en el anexo
  de recuperación.
- **Conservadas y por qué:**
  - `feat/sdd-0255-aliados-white-label` (remota): ancestro de `main`, pero sin PR; el runbook exige PR MERGED.
  - `codex/pr28-e2e-harness-validation-20260906` (local): su handoff y el índice no tienen equivalente en
    `main` ni ref de PR que los respalde.
  - `codex/portal-colors-reception-integration-20260906` (local y remota), `codex/governance-final-100`,
    `codex/audit-hardening-20260801` y `feat/sdd-0286-api-alcance-por-modulo` (remotas): tienen documentos o
    archivos sin equivalente en `main` y sin otro respaldo remoto. Descartarlas es decisión de Sam.
  - `stash@{0}` del checkout principal: su `AGENTS.md` no existe en la historia de `main`.
  - `DTD-worktrees/_pr-bodies-backup/pr80-body-antes-ronda2.md`: fuera del repo y ajeno a esta sesión, sin
    evidencia de equivalencia.
  - Reservas 0465 y 0466 y los cinco worktrees de esta ola: sus PRs todavía no están todas integradas.

### Guion de smokes

`.agents/handoffs/director-ola-post-bloque-c-20260914-smokes.md`: bloques A (Cobranzas → 0415), B (reportes de
pago → 0422 y 0423, y después #114), C (roles → 0414), D (verificación de #116) y E (estado de 0453), con el
mensaje modelo para autorizar por nombre.

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
- PASÓ: revisión de la PR #114 (identidad de blobs con #21, columnas tenant_id en el esquema, grep de escrituras).
- PASÓ: revisión de la PR #115 (SQL completo, precedente de esperas en #103 y #108, columnas y redefiniciones históricas).
- PASÓ: revisión de la PR #116 (diff de los lectores y de `softDeleteInvoice`, gate de SDD-0357, spec 0465).
- NO VERIFICADO: ID de deployment en Vercel; checks de #115 (`d6006f7b`) y #116 (`831799a3`) en curso al cerrar esta actualización.

## COMMITS

- `fcab70f0` — handoff inicial de la ola (asignaciones, reservas, matriz, anexo de ramas).
- Commit que contiene esta actualización (revisión de la PR #113 y método de blobs); SHA en la PR cuando se publique.

## PR / BRANCH

Rama `codex/director-ola-post-bloque-c-20260914` sobre base `main` `b07ad98b`, local, sin PR:
publicación pendiente de permiso.

## PENDIENTES DE ESTA TAREA

- Los cuatro cierres recibidos y revisados (PRs #113, #114, #115 y #116, SHAs en cada sección). Al integrar, cada
  rama que quede detrás de `main` vuelve al Worker para ponerse al día (índice de specs y baseline se regeneran
  con sus scripts) y el Director revalida el delta antes del merge.
- W2 usó 0453 (registrado); espera declarada en el baseline y spec alineada (rondas 2 y 3 revisadas).
- Pedir a Sam, en bloque, las autorizaciones que siguen abiertas: smokes y OK nominal por
  migración, limpieza remota y local, publicación de esta rama de coordinación y decisiones.

## FUERA DE ALCANCE DETECTADO

- `.env.local` del checkout principal es un directorio, no un archivo; no se revisó su contenido.
- Las deudas de dirección ya listadas arriba; ninguna se convierte en pendiente propio.

## HANDOFF AL DIRECTOR

Sesión Director activa con claim sobre este worktree. Siguiente acción: bloque de autorizaciones para Sam
(merges en orden #113, #115, #116 y, tras el smoke de L14 y 0422/0423, #114; smokes y OK nominal por migración,
incluida 0453 con sus dos lecturas previas; limpieza; publicación de esta rama; decisiones de dirección).

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
- Checks de la PR: «Calidad local sin secretos» SUCCESS sobre `bc407625` (verificado después de la revisión); Vercel preview SUCCESS.
- **Veredicto Director: APROBADA para integración**, sujeta a autorización de merge de Sam; el check
  requerido ya está verde sobre `bc407625`. Sin efecto productivo de código; un merge a `main` redespliega el mismo
  código (Vercel no excluye `.agents/`), efecto a cubrir en la autorización.
- Corrección del dictamen del 2026-09-12 §3: `codex/audit-hardening-20260801` pasa de CONSERVAR a
  **descarte recomendado** (C2), pendiente de autorización; único blob sin equivalente, el handoff
  histórico `6cf1f32a`, preservable con un tag si Sam lo quiere.
- Lotes propuestos por W4 que quedan como decisiones de Sam: C1 cierre documental de SDD-0235
  (estado de la spec y tres textos desfasados); C2 borrado de la rama remota; R1 retención de
  `public_track_log` (política de retención primero; spec nueva).

### W3 · PR #114 · `codex/portal-reportes-principal-0390-0397` · SHA revisado `b071a90fdc00419b712dec663d7a2d3ebfa3f4e8` (producto en `3f0d59ac`)

- Alcance: 11 archivos, todos dentro de la allowlist: `lib/portal/payment-report-queries.ts`,
  `lib/portal/shipment-events-queries.ts`, `app/portal/(app)/facturas/[code]/aceptar/actions.ts`,
  cinco tests de `lib/portal` y de `aceptar/`, las specs 0390 y 0397 (nota de extracción fechada
  bajo el H1, `status: done` y `updated` intactos, mismo precedente que las notas de L14) y el
  handoff del Worker. Sin migración, sin `supabase/`, sin Studio, sin esperas.
- Identidad: los ocho archivos de producto y tests son byte a byte el blob del head de la PR #21
  (`refs/dtd/pr/21`, `ea9952a4`); comprobado por el Director con `git rev-parse` por ruta.
- SDD-0390: `listMyInvoiceReports`, `listMyShipmentEvents` y `listMyRecentActivity` dejan la RPC
  `get_portal_client_markbox()` y resuelven `getPortalClientPrincipal()`; filtran `tenant_id` y
  Shipping Mark, más `shipments.tenant_id` en los eventos. Columnas verificadas en el esquema de
  `main`: `shipment_events.tenant_id` (0002/0003, índice 0013) y `payment_reports.tenant_id` (0195).
- SDD-0397: `registerAcceptanceAction` toma tenant y Shipping Mark del principal de sesión y
  desaparece la relectura `admin.from("clients").select("tenant_id")`. Test histórico ajustado y
  `portal-invoice-actions-principal-scope.test.ts` pasa del recorte de L14 a la versión completa.
- Escrituras: `git grep` sobre `lib/portal` y `app/portal` sin tests solo encuentra `select` sobre
  `payment_reports`; ninguna vuelta a DML directo ni a `confirm_payment_report`; los comandos siguen
  por los wrappers de 0421.
- Validación del Worker: vitest focal 52 archivos / 833 pruebas PASÓ; typecheck PASÓ; ESLint focal
  PASÓ; docs, numbering y símbolos pendientes PASÓ; `E2E_PORT=3103 corepack pnpm verify` sobre
  `3f0d59ac` FALLÓ solo por el e2e ambiental (watchdog, sin Supabase, dos verify ajenos en
  paralelo) y `migrations-applied` NO DISPONIBLE sin credenciales, aceptado porque la PR no trae
  migración; el resto de pasos PASÓ, build incluido.
- Claim `worker-w3-portal-reportes-20260914` liberado; `finish` informa árbol limpio y sin claim.
- Checks de la PR: «Calidad local sin secretos» SUCCESS sobre `b071a90f` (verificado después de la revisión); Vercel preview SUCCESS.
- **Veredicto Director: APROBADA técnicamente. REQUIERE INTEGRACIÓN PREVIA**: se integra solo
  después de que Sam cierre el smoke de reportes de pago de L14 y se apliquen 0422 y 0423, para no
  mover la superficie que se prueba; con autorización de merge y check verde sobre el head final.
  Un merge a `main` despliega código del Portal: la autorización debe cubrirlo.
- FUERA DE ALCANCE que deja W3, sin encargo: lecturas del Portal que siguen solo por Shipping Mark
  (`listMyShipments`, `getMyShipment`, `portal-academy-queries.ts`, `academia/actions.ts`,
  `proveedores/actions.ts`), candidatas a un slice propio; `getReportById` sin llamador; auditorías
  y handoffs del saneamiento de #21 que las specs citan y no están en `main`; contención de
  `verify` concurrentes en la misma máquina (cuelgue recurrente del e2e en mobile-safari).

### W2 · PR #115 · `codex/portal-helpers-principal-determinista` · SHA revisado `015182525c545a8ea021cfab7b5941732029d7a2` (migración en `1fdfe9fb`)

- Alcance: cinco archivos, todos dentro de la allowlist: `supabase/migrations/0453_portal_helpers_principal_determinista.sql`
  (382 líneas), `supabase/tests/0453_*.test.sql` (866 líneas, 113 aserciones, control RED con
  `-v apply_fix=false`), la spec 0466 (`done`, `created` y `updated` 2026-09-14), el índice de specs
  regenerado (453) y el handoff del Worker. Cero cambios en `app/` y `lib/`.
- SQL revisado línea a línea por el Director:
  - Timeouts de sesión (`lock_timeout` 5 s, `statement_timeout` 30 s) al inicio y `reset` al final,
    como 0422.
  - Preflight que falla cerrado: RLS y columnas de las cuatro tablas; forma de las tres funciones
    (retorno, lenguaje, SECURITY DEFINER, volatilidad) y ACL (anon sin EXECUTE, authenticated con
    EXECUTE en las dos helpers, nadie en la función del trigger); cuerpo normalizado igual al
    histórico (0200 / 0080 / 0198, últimas definiciones en `main`) o al final; trigger
    `client_delivery_addresses_validate_trg` vivo con la forma de 0198; huella md5 del catálogo
    dependiente (ACL y dueño de las tres, funciones y policies que las nombran, trigger).
  - `get_user_tenant_id()`: tenant de la única membresía activa, NULL con cero o más de una
    (`array_agg … having count(*) = 1`). `get_portal_client_markbox()`: Shipping Mark del único
    vínculo activo cuyo cliente vive y comparte tenant, NULL en otro caso. Trigger: con principal,
    membresía activa en el tenant del cliente o vínculo activo a ese mismo cliente, si no 42501;
    sin principal conserva el sellado de 0198. `create or replace` conserva oid, dueño y ACL.
  - Postflight: cuerpos finales exactos con `search_path` vacío, huella idéntica, y las dos helpers
    devuelven NULL sin principal.
- Riesgo semántico que debe conocer Sam: con dos membresías activas un usuario queda sin tenant y
  el Studio se le muestra vacío sin mensaje (`getStudioAccess`). Hoy no puede ocurrir: producción
  tiene un solo tenant y `user_tenants` tiene PK `(user_id, tenant_id)`; `client_users` conserva
  `unique (auth_user_id)`. Es una frontera preventiva y fail-closed, coherente con 0430 y 0452.
- Validación del Worker: contrato GREEN 113 aserciones sobre PostgreSQL 17 efímero, control RED,
  30 mutantes muertos, locks medidos (solo AccessShareLock, 26,6 ms); `E2E_PORT=3102 corepack pnpm
  verify` sobre `aa083acb` FALLÓ solo por el e2e ambiental, con sql-tests (194), schema-rebuild y
  build en verde; `migrations-applied` SKIP sin credenciales.
- Claim `worker-w2-portal-helpers-20260914` liberado; `finish` sin claim.
- Checks de la PR al revisar: «Calidad local sin secretos» en curso sobre `01518252`; Vercel preview
  SUCCESS.
- **Omisión detectada: la PR no declara la espera de 0453 en `pendingBelowCutoff`**, a diferencia
  de las PRs #103 (0451) y #108 (0452). Con credenciales, `migrations-applied` saldría rojo al
  fusionar. Corrección devuelta a W2 el 2026-09-14 con allowlist ampliada solo a
  `supabase/migrations-baseline.json` (una entrada nueva, sin subir el cutoff ni tocar las otras
  cuatro esperas).
- Ronda 2 recibida y verificada por el Director: head `15ea0316`; frente a `01518252` cambian solo el
  baseline (una entrada nueva `0453_portal_helpers_principal_determinista`, 4543 caracteres, cutoff 238 y las
  otras cuatro esperas intactas, JSON válido) y el handoff del Worker. Ronda 3 pedida, solo texto: la spec 0466
  debe listar el baseline en «Alcance» y «Allowlist exacta» limitado a esa espera.
- Ronda 3 recibida y verificada: head `d6006f7b`; frente a `15ea0316` cambian solo la spec 0466 («Alcance» y
  «Allowlist exacta» incluyen `supabase/migrations-baseline.json` limitado a la espera de 0453; `status` y
  `updated` sin cambio) y el handoff del Worker. La PR toca exactamente seis archivos y todos figuran en la
  allowlist de la spec. Claim liberado.
- **Veredicto Director: APROBADA para integración**, sujeta a autorización de merge de Sam y al check
  «Calidad local sin secretos» verde sobre `d6006f7b` (en curso al cerrar la revisión). Un merge a `main`
  no cambia código desplegado: solo agrega el archivo SQL, su contrato, la spec y la espera. Aplicar 0453
  es una autorización aparte. Integración con autorización de merge y check verde sobre el head final.
  Aplicar 0453 a producción es una autorización aparte (OK nominal por nombre y runbook), precedida
  de la lectura sin filas de `pg_get_functiondef` de las tres funciones y de los dos conteos
  agregados, ambos con autorización de Sam.
- FUERA DE ALCANCE que deja W2: `current_studio_role()`, `get_portal_client_id()`,
  `get_portal_client_tenant()` y `get_portal_person_id()` comparten el `limit 1`; policies del
  Portal que comparan solo el Shipping Mark (patrón 0080); `getStudioAccess` sin mensaje ante dos
  membresías; `unique (auth_user_id)` sin comentario que declare sus dependientes;
  `_norte/backend/README.md` vive en `docs/design/studio/_norte/backend/README.md`, no en la raíz.

### W1 · PR #116 · `codex/facturas-borradas-lectores-financieros` · SHA revisado `831799a353a14a2ab5c60c346b6cdcec379e115c` (producto en `fed55e04` y `5787a62f`)

- Alcance: 16 archivos. Dentro de la allowlist asignada: los cinco lectores (`lib/studio/invoice-queries.ts`,
  `lib/studio/payment-queries.ts`, `lib/studio/dashboard/dashboard-kpi-queries.ts`,
  `lib/studio/costing/queries.ts`, `lib/studio/fidelizacion/referral-credit-queries.ts`; dos rutas difieren
  de las citadas en el encargo pero son las mismas funciones), `app/studio/(app)/facturacion/actions.ts`,
  seis archivos de tests (30 casos nuevos, ninguna aserción existente cambiada), la spec 0465 (`done`,
  `updated` 2026-09-14), el índice de specs y el handoff. **Fuera de la allowlist asignada, con
  justificación en la spec:** `scripts/__tests__/invoice-read-boundary.test.mjs`, el gate de SDD-0357 que
  congela los callers de `invoices`: +1 en `facturacion/actions.ts` (10 → 11) y total 45 → 46 por la
  lectura previa de `softDeleteInvoice`. **Aprobado por el Director**: la lectura va detrás de
  `moduleEditDenial("invoices")` con el cliente de sesión bajo RLS, y la alternativa sin lectura previa
  perdería el mensaje por estado del criterio 4. La spec 0465 lista el archivo en su tabla de alcance.
- Lectores: cada `from("invoices")` de los cinco archivos lleva ahora `.is("deleted_at", null)`
  (verificado por conteo en la rama); comentarios explican que la RLS de equipo no oculta borradas desde
  0230 y por qué cada lector las excluye. `receivablesQueue` cambia a quién se le escribe el recordatorio:
  solo facturas vivas (SDD-0306/0353/0358); RPC `collections_mail_context` y 0410/0415 intactas.
- `softDeleteInvoice`: lee `id, status, invoice_code, deleted_at`; rechaza «ya eliminada»; rechaza todo
  estado distinto de `borrador` con mensaje que remite a anular con motivo (`anulada` se conserva como
  registro); el UPDATE repite `status = borrador` y `deleted_at is null` como guarda de carrera y responde
  si no matchea; revalida lista y detalle. **Regla de producto nueva: solo los borradores se eliminan;
  emitidas, parciales, pagadas y vencidas se anulan.** Justificada en la spec con MP-01 (P2/R2 borrador,
  P3/R3 emitido), asiento de venta (SDD-0040), recibos (SDD-0041), créditos de referido (SDD-0137), libro
  de ventas (SDD-0073) y `void_invoice_with_audit_reason` (0294). Sam debe cubrir esta regla al autorizar.
- Validación del Worker sobre `b5f05179`: `E2E_PORT=3101 corepack pnpm verify` con 15 pasos PASÓ (harness,
  lint, rsc-boundary, typecheck, edge-functions, test 558 archivos / 7256, docs, numbering, feature-constants,
  components, governance, símbolos pendientes, sql-tests, schema-rebuild, build); `migrations-applied`
  NO DISPONIBLE sin credenciales (no hay migración); e2e FALLÓ solo por los 15 ambientales conocidos
  (`auth.spec.ts` × 12, `global-search.spec.ts` × 3), sin watchdog. Vitest focal 77 tests PASÓ.
- Claim `worker-w1-facturas-borradas-20260914` liberado; `finish` sin claim, árbol limpio.
- Checks de la PR al revisar: «Calidad local sin secretos» en curso sobre `831799a3`; Vercel preview
  pendiente.
- **Veredicto Director: APROBADA para integración**, sujeta a autorización de merge de Sam que cubra la
  regla de producto (solo borradores se eliminan) y el despliegue (toca código de Studio), y al check
  verde sobre `831799a3`. Sin migración. Conflicto esperado con #115 en `docs/specs/README.md`: se
  regenera con `docs:index` al poner la rama al día, no a mano.
- FUERA DE ALCANCE que deja W1, sin encargo: `InvoiceDrawer.tsx` solo actúa sobre `result.ok` y no muestra
  un rechazo del servidor (solo alcanzable por carrera); no existe papelera ni restauración de facturas,
  que MP-01 §2 exige para P2; otros lookups de `invoices` por id sin filtro de `deleted_at`
  (`collections-actions.ts`, `cobranzas/actions.ts`, recibo, `fidelizacion/actions.ts`,
  `referral-credit-posting.ts`, `kommo-contact-status.ts`, `costing/queries.ts`, `renditions/queries.ts`),
  ninguno agrega ni escribe correo por sí solo; un guard en `registerCollectionFor`, `identifyPayment` y
  `applyReferralCredit` cerraría la frontera; la base sigue exponiendo borradas a `accounting`/`admin`
  por PostgREST directo desde 0230, por diseño.

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

## Anexo de recuperación · SHAs de las 78 ramas remotas borradas el 2026-09-14

Todas son ancestros de `main`: se recrean con `git push origin <sha>:refs/heads/<rama>`.

```text
f2c470914dc882f1b36e20f02e63506aa178aa21  claude/quizzical-dijkstra-809aae
902620f84f609241016cdc52ad4362f6f3e5067b  claude/stoic-thompson-6ef73b
0ac9d8a3c6b63447e9703551bb789850e0d7322e  claude/youthful-driscoll-120aae
23618a6ad29192b0b3b980990c777cf8f459b0d8  codex/0017-aplicada-prod
9ae7f34c1fe2c50f470e0b9c1d15d30919364c9c  codex/0445-functional-remediation
f24d09d35c5c5282b4a344ba057449ec1338db7d  codex/0447-aplicada-prod
8aa025943faaf32583975d0adddf5794fa0e8f48  codex/0448-baseline-post-aplicacion
f0677e8b794aed598b3a76973ac855f2da922410  codex/0448-replay-0223-history
870858b8707ae656e85f1e471408b74ca93f5a81  codex/0450-codigo-contra-migraciones-eximidas
f6d72046d84d34033c03c2996ef99cd78578dcdd  codex/a5-1-direccion-bodega-cn-visible
e191386632279b616d5031fb2e9da74d52ea265e  codex/a5-2-recepcion-movil-errores
661726520b39b82b77303c836d9ca75f3a76dadd  codex/a5-4-referencias-colgantes-0435
7ea3ecf2146d89fb06a903d98229718bc23f65c2  codex/a53-hallazgos-ingenieria
50fc1242db78844fc0b72f28e4d34c18dcff9642  codex/aliado-tenant-coherence
a16282bafcc562cd6c1f2b72c1a15d1ae5adfe9d  codex/analytics-privacy
34471f1ec19faf04ea3de0cec582b50e12deba77  codex/brand-semantic-colors
203f06c877519cf522ae2b84223fc957481e44b2  codex/c-0409-aplicada-prod
82e3e8ce52a4d87f70963d31238d23d7a6599a24  codex/c-0418-aplicada-prod
01a3efda84d80244b99ae5709590ab1add078a35  codex/c-analisis-bloque-c
a6910e38efa6ae6a3a805a857fa6a077378ebc22  codex/c-fix-pending-symbols-utf16
684f3e3d1912003476798d9c172d5916f3acc3d1  codex/c-l01-portal-marca
a5435b1da8d31e540310ac0a5d28d75b4a921746  codex/c-l02-portal-visibilidad
3b4c5ea1421bc39d1e2d8bf6434a441225eaae4b  codex/c-l03-portal-asesor
61fbcc30ef859d6f533e9e358b123c574fbaba5b  codex/c-l04-portal-referidos
f8af05666687404b3e43ac6b5c2a76c99219df79  codex/c-l05-portal-perfil-privado
6602b9baca1ac923a51ee39d71807453027aa084  codex/c-l06-portal-documentos
d2cf1cc298a07fa65071f0d62b950a7b00bd6c82  codex/c-l08-mailing-rbac
f2ddae2086fca0a3cc10027bdb57d6628227426d  codex/c-l09-bank-reconciliation-rbac
fb093040e87ed96b6128ba020e81fb6ebd49adb1  codex/c-l11-portal-prealertas-servicios
fd27810fc864287c5b28198fa0e8fc68be80dc66  codex/c-l12-portal-academia-tenant
b67f54f4e29c838d44393295bed1045012fc7ecf  codex/c-l13-portal-reclamos
0ac82dd91ff5386bd2c184a38aa16d76d9d11a05  codex/c-l15-portal-club
7e1077adc3541b62325aef03033b576e981800c9  codex/c-l16-portal-direcciones
2fadc0df62d558a5cf1b7cd30fe1a6f5456e222c  codex/c-l17-verificar-throttle
32087718a490a97b6b2b2faca4ac1cb854943d04  codex/c-l18-portal-principal
38c27056a464e28743fc2cd2abe76167ed4f2e54  codex/c-l19-portal-mensajes
bbf328d2a8ba8f1580fe309f33e9084c635187aa  codex/c-l20-portal-cajas-bodega
3c915cd5c08a9be51478b41c12e5dc774e4bc427  codex/c-l21-portal-realtime-mensajes
79298160fb8dcd9c8a141fac5ce5e704aa7b2b1d  codex/c-l22-portal-addons
37c5c00b82ea1d723713459f505c713d3394ad63  codex/c-nota-specs-importadas
d0ba937ee605e4092312f6ce368e058d7260ab43  codex/c-registro-0425-0427
75644395519e26894d88f8a6817df3174b2c1dde  codex/c-registro-lote-20260911
db7815bf998968630aa0584df1881bf774cf24cf  codex/c2-bloque-d-document-entity-rbac
c615227a79df0dc87de4a409152a518376c73944  codex/c2-prerequisito-0416-portal-shipments
9d504468604987c960f0b7e695a1b9ab91ff6295  codex/cambios-portales
2c5afe79ebd8f176179a8f68a31bd4932a81ed7e  codex/ci-quality-extract-20260905
b985250487bd31f3cffca8e02792f24a39a63eb7  codex/d1-bucle-modulos-m-erp
d8101c8acf7bf7c3df27bb563a27fd14c9eb2244  codex/d1-d3-evidencia-arnes
cd10e6f673e5bef090d2180ceec42b7d5203cece  codex/d2-webkit-auth-cors
c4f440a40ace645f28213b972ae253a84e301b84  codex/d4-hidratacion-diagnostico
6485df4db148e0c047b065f40bb9c91044a37a26  codex/declarar-0447-pendiente
4de236f30f771aa6f32a6c9f7712e3e06c1835fb  codex/deudas-cola-20260910
0db0c9581caa175e549f1c89ef0ccef8dce9a8fe  codex/e1-archivos-generados-serializan
f01b3f1d6ff9a799d598dc820ac536fef6370a71  codex/e2e-harness-general-20260905
84ae8f3032e7b90f1cbe5c84466c92cd9edbb48a  codex/e3-gate-no-pude-comprobar
2c01fbdf98168b6231c6348b30d7b80040c7a569  codex/engineering-director-worker
b031a527e3f3f443c77f5ff451ca235a7a841e31  codex/fix-choque-0435-specs
4cdeb07b1c991170871be8101479a3c24e87eeb4  codex/handoff-0457-integrada
f2aa85b96636de1676ee7db27819b62d4f47a41a  codex/mailing-test-template-admin-guard
e44338dfed9c1f09e78a79c1a94595d9c5f54992  codex/medicion-tokens-a53-a56
0a4b73a8408395e39d0bfc8eeaf1e275b995d9da  codex/merge-driver-baseline-removal
7769e4b469e04eb075e2f133db902f6f7f2f8bd4  codex/merge-driver-symbol-declarations
3df095ea759ff7d165fa119054f5d62db787200e  codex/pending-symbols-do-blocks
49bce19abb4a07136d846e7afbae2aed7fcac35c  codex/portal-claridad-botones-mensajes
c1a3a1f65d06c8a25b9f41819b4cb96cbe2c27df  codex/portal-profile-privacy-remediation
384218c2a95d8f07f5b839b73f2a48c9f1b5c753  codex/pr21-bloque-a-specs-0316-0400
391010b2d50e3419a82b7fb5a6f9a50e0186f7c3  codex/pr28-transport-v3-20260907
8643a903b62340acbee5cb15eea89c43c5ff7faf  codex/principal-sin-inferir
01f07e0b76b61a86b57c803e038441c262bec120  codex/purge-public-verify-throttle
5ee520ad5858adaa380d871d1cfdd8602c98886c  codex/push-endpoint-hardening-20260904
79b52bc3b3d9b65af5e891f2ed22e2d01460cadd  codex/recover-applied-migrations-0399-0445
7586c8a9e81aebb5e725763291c619fd2324d307  codex/rescate-dtd-0441-proveedor-20260910
189f498650d15fbcad9b2c9b59d1fb432b01302d  codex/revertir-recepcion-cn
1acf55f727be1e1de2676c5d11dc279c2b6c1e9a  codex/sanitizer-formato-actual-de-claves
7259d24dcda278432028e31f991cbc292f969d6d  codex/sdd0380-publication-review-20260907
cf2342697266e71d329ebbb516ba7ce7a8e47fde  codex/skills-agentation-retirar
db9daa46ccbb3b3f0fcf899836259c0b8112e308  codex/verify-e2e-watchdog
1cf2819c4e3bd690e0e564fa177461baa7c1f5d3  portalcliente
```
