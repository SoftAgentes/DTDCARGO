# Handoff 0484 — Reportes de pago frente a una factura ya pagada

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión**, sin publicar. La
  0464 **NO está aplicada**: requiere el OK nominal de Sam y la aplica el Director.
  La SDD queda `in-progress` hasta que se aplique.
- Owner / sesión: `claude-worker-reporte-pago-factura-pagada` (Claude Opus 5,
  Worker, sesión «Revisar confirmación de pagos en facturas ya pagadas»).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/reporte-pago-factura-pagada`.
- Rama: `codex/reporte-pago-factura-pagada`, desde `origin/main` = `1d80c18a`.
  Main ya avanzó a `cc15e48c` (#145); traerlo toca en el turno de integración
  que asigne el Director.
- SDD: [0484](../../docs/specs/0484-reporte-pago-factura-pagada/spec.md). La
  reservó el Director en `codex/sdd-reserve-0484-reporte-pago-factura-pagada`
  (441f4834 + f220cea0, traídos por cherry-pick). Migración asignada: `0464`,
  porque 0462 y 0463 son de otra tarea.
- Aislamiento: `harness-worktree start`, `guard` → `Guard OK` y claim adquirido
  antes de editar.
- Permisos del encargo: commits en esta rama; reportar al Director antes de abrir
  la PR. **No merge.** Nada de producción, salvo leer catálogo. En esta sesión no
  hubo conector Supabase, así que no se leyó nada de producción.

## OBJETIVO ORIGINAL

Verificar y, si se confirmaban, corregir dos defectos de los comandos de reportes
de pago de 0421, aplicada en producción (ledger `20260913224126`):

1. el chequeo de estado de la línea 263 no mira si la factura ya está pagada;
2. el motivo de cancelación no se guardaría en ninguna parte.

La 0421 no se edita: el arreglo va en una migración nueva con preflight del cuerpo
vigente. La regla de negocio la decide Sam, con pruebas SQL en PGlite y control
rojo.

## COMPLETADO

- **Hallazgo 1: CONFIRMADO.** Confirmar sobre una factura pagada sumaba y la
  dejaba en 1100/1000. El mismo pago reportado dos veces llegaba a 1980/1000, en
  PGlite y con dos sesiones reales en `postgres:17`. Ningún otro punto del flujo
  lo impide; la evidencia con archivo y línea está en la spec.
- **Hallazgo 2: DESCARTADO tal como está escrito.** El motivo se guarda en
  `entity_audit_log.reason` y la auditoría lo exige. Pero ningún rol de la app
  puede leerlo, y el portal lo pierde al recargar porque lo lee de
  `resolution_reason`, que la cancelación no escribía.
- **Decisiones de Sam** (AskUserQuestion; se transcribe la opción elegida):
  - factura pagada → «Rechazar (Recomendado)»;
  - excedente sobre el saldo → «Rechazar el excedente (Recomendado)»;
  - motivo de cancelación → «Mostrarlo en el reporte».
- **Migración 0464** (`0464_reporte_pago_factura_pagada.sql`, sin aplicar):
  - `create or replace` sólo de `payment_private.run_report_command`, con el
    cuerpo de 0421 copiado textual y tres cambios: la regla de pagada
    (`PAYMENT_INVOICE_PAID`), la del saldo (`PAYMENT_EXCEEDS_BALANCE`) y el
    motivo en `resolution_reason` al cancelar;
  - preflight del cuerpo vigente, que acepta md5 exacto `7814b391…` o sin
    espacios `c5ab13c2…`, más owner, ACL, columna, CHECK y guard;
  - postflight con las cuatro firmas que exige 0422 y el md5 del cuerpo nuevo
    `c3aab7fc…`;
  - `lock_timeout` 5 s y `statement_timeout` 30 s.
- **Contrato** `supabase/tests/0464_reporte_pago_factura_pagada.test.sql`: 45
  aserciones. La fixture es la de 0421 en modo transacción, y su contrato no se
  toca.
- **Prueba PGlite** `lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts`:
  - el contrato 0464 en verde;
  - el control rojo;
  - cinco mutantes;
  - los contratos completos de 0422 y 0423 con la 0464 antes, entre y después;
  - el preflight: segunda aplicación, ACL y guard;
  - la misma función con CRLF, que se acepta;
  - los locks.
- **App:** `lib/portal/payment-report-commands.ts` traduce los dos códigos, con
  sus pruebas. Las pantallas no cambian, porque ya leen `resolution_reason` como
  «Motivo».
- **Carrera:** `scripts/qa/payment-report-confirm-race.mjs` corre en
  `postgres:17` desechable y es determinista (advisory lock más
  `pg_stat_activity`, sin sleeps).
- **Espera** de 0464 en `supabase/migrations-baseline.json › pendingBelowCutoff`,
  con lo que el operador debe leer antes de aplicar.

## VALIDACIÓN

Base observada: `1d80c18a` + los commits de esta rama. CPU saturada por otras
sesiones: sólo se corrieron pruebas focales con `--pool=threads`, como pidió el
Director.

| Comprobación | Resultado |
| --- | --- |
| `vitest run lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts --pool=threads` (PGlite) | **PASÓ**: 15/15 (65,9 s) |
| Control rojo del contrato 0464 (`apply_fix=false`) | **PASÓ** (falla donde debe): `TEST 0464: confirmar sobre factura pagada: se esperaba rechazo PAYMENT_INVOICE_PAID` |
| Contrato 0464 con `psql` real en `postgres:17` desechable, igual que `run-sql-tests` | **PASÓ**: `TEST 0464 GREEN: 45 aserciones`. Con `-v apply_fix=false` falla en la línea 113 con el mismo mensaje del rojo |
| Mutantes de 0464 (5) | **5 muertos**: sin regla de pagada, sin regla de saldo, `>=`, sin motivo y motivo sin recortar |
| Contratos existentes en PGlite: 0421 (400), 0422 (301), 0423 y 0423 Cloud | **PASÓ** sin 0464. Con 0464 antes, entre o después de 0422/0423: **PASÓ** |
| `vitest run payment-report-commands/consumers/actions --pool=threads` | **PASÓ**: 281/281 |
| Control rojo del mapa TS (quitar las dos entradas) | **PASÓ** (falla donde debe): fallan exactamente las 4 pruebas nuevas; archivo restaurado |
| `node scripts/qa/payment-report-confirm-race.mjs` | **PASÓ**: S2 esperó `transactionid` y se rechazó con `PAYMENT_INVOICE_PAID`; pagado 1000, 1 confirmado, 1 recibo |
| `… --sin-0464` (control de la carrera) | **PASÓ**: reproduce la doble acreditación, 1980/1000 |
| `… --migracion <mutante sin FOR UPDATE>` | **FALLÓ, como se esperaba**: dos confirmados, pagado 1000 (actualización perdida) |
| Locks de 0464 en PGlite y `postgres:17` | ACCESS EXCLUSIVE sobre el objeto función; SHARE UPDATE EXCLUSIVE sobre `payment_reports`; ninguno sobre `invoices` ni recibos |
| `node scripts/check-pending-migration-symbols.mjs` | **PASÓ**: 0 ROJO · 0 AMARILLO |
| `pnpm docs:index` / `docs:check` / `sdd:check` | **PASÓ** |
| `pnpm typecheck` | **PASÓ** en la segunda corrida. La primera **FALLÓ** por `notice.message` (`string \| undefined`) en la prueba nueva; se corrigió con `?? ""` |
| `eslint` de los 4 archivos TS/MJS tocados | **PASÓ** |
| `vitest run scripts/check-migrations-applied.test.mjs scripts/check-pending-migration-symbols.test.mjs` | **PASÓ**: 42/42. Con `node --test` da un falso rojo porque son archivos de Vitest |
| `pnpm governance:check` / `git diff --check` | **PASÓ** |
| `pnpm verify` | **NO EJECUTADO**: el Director pidió no correr suites completas con la CPU saturada |
| `migrations-applied` | **NO EJECUTADO**: da SKIP en worktrees sin credenciales, y la 0464 está declarada como espera |

## COMMITS

Sobre `1d80c18a`, en este orden:

- `a9fcc14d`: reserva SDD-0484, cherry-pick de `441f4834` del Director.
- `014742f3`: el stub pasa `docs:check`, cherry-pick de `f220cea0`.
- `dfa51b39` `feat(studio)`: migración 0464, su contrato SQL, la prueba PGlite,
  `scripts/qa/payment-report-confirm-race.mjs` y la espera en
  `migrations-baseline.json`.
- `fda76c80` `feat(studio)`: los dos códigos nuevos en `REJECTIONS` y sus pruebas.
- `9a907f51` `docs(SDD-0484)`: la spec y el índice regenerado.
- El commit que contiene este documento: `docs(handoff)`.

Identidad del archivo a aplicar: `0464_reporte_pago_factura_pagada.sql`, md5
`44fabe4d2643844fbe489e2ba88fa4fb`, 22209 bytes, LF. Cuerpo de la función:
md5(prosrc) `c3aab7fcb10e3bf5de0fa40cc562a45d`.

## PR / BRANCH

Sin PR. Rama `codex/reporte-pago-factura-pagada`, base `main`. Sin push hasta que
el Director dé el turno.

## PENDIENTES DE ESTA TAREA

- Que el Director revise y dé el turno de integración: traer `origin/main`
  (`cc15e48c` o posterior) y repetir las pruebas afectadas.
- `pnpm verify` completo cuando la CPU lo permita.
- Release, fuera del Worker: desplegar la app primero; después, con OK nominal de
  Sam, aplicar la 0464 leyendo antes en producción `md5(prosrc)` de
  `run_report_command`.

## FUERA DE ALCANCE DETECTADO

1. **Cobranzas pisa confirmaciones concurrentes.** Detectado por lectura de
   código, sin reproducir. `registerCollectionFor` lee la factura sin lock
   (`lib/studio/collections-actions.ts:105-109`) y después escribe `paid_amount`
   como valor absoluto (`:174-182`). Si una confirmación de reporte, u otro
   cobro, entra entre la lectura y la escritura, su suma se pierde. El cobro,
   además, se valida contra un saldo viejo y puede pasar por encima de la regla
   de 0464. `identifyPaymentFor` tiene el mismo patrón: lectura en `:378-383`
   y escritura absoluta en `:429-436`.
2. **Studio ofrece «Confirmar pago» sin conocer la factura**
   (`StudioInvoicePaymentReports.tsx:173-182`). Ya pasaba con `anulada` y
   `borrador`, y con 0464 el servidor rechaza con un mensaje claro. Queda la
   no conformidad de SGE-00.05/.06 en la UI.
3. **El alta del portal no limita el monto al saldo** (`reportar/actions.ts`,
   `0421:209-216`). Con 0464, un reporte mayor que el saldo nunca se podrá
   confirmar; conviene avisarlo al cliente al crear. Requiere decisión de Sam.
4. **La RPC heredada `confirm_payment_report`** (0359) confirma sin estas reglas
   hasta que se aplique la 0422. Tampoco mira si la factura está `anulada`: suma
   `paid_amount` en cualquier estado. La 0422 la retira.
5. **No existe el saldo a favor.** Un sobrepago real no tiene dónde registrarse.
6. **Motivos de cancelaciones anteriores a la 0464:** quedan sólo en la
   auditoría, que la app no lee. Rellenarlos exige leer y escribir filas de
   negocio.
7. **Sin purga ni plazos** para los textos libres de los reportes (nota y
   motivo). Es preexistente (SDD-0365) y esta tarea agrega una copia del motivo.

## HANDOFF AL DIRECTOR

- Revisar la spec (orden de release y gobernanza) y el diff. Cambios compartidos:
  `supabase/migrations-baseline.json`, que usa el driver de merge del repo, y
  `docs/specs/README.md`, que es generado.
- La 0464 no bloquea L14 en ningún orden. El orden que propongo es: despliegue de
  la app con el mapa de errores y, después, la 0464.
- Sesiones consumidoras: ninguna fuera de esta.
- Ownership: el claim `claude-worker-reporte-pago-factura-pagada` sigue
  **retenido**. Falta escribir en el turno de integración: traer main y
  publicar la rama. Se libera al terminar esa escritura.

## Impacto documental y conocimiento

- **Canónicos:** la spec 0484, antes stub de reserva, y `docs/specs/README.md`,
  regenerado por script (468 specs). La documentación en código está en la
  cabecera de la 0464, los `comment on` de función y columna, y la espera en
  `migrations-baseline.json`.
- **No aplica:** `BRAND.md` y `docs/design/**`, porque no hay UI ni componentes y
  por eso no corre `/ui-check`; `docs/marketing/**`; `docs/governance/**`, porque
  la clasificación va en la spec, sin política nueva. No se editó ningún handoff
  histórico.
- **`knowledge:status`** (revisión `014742f3`, Graphify 0.9.61): el estado
  estructural es INVALID porque el worktree es nuevo y no tiene `graphify-out`.
  **`graphify update .` no se ejecutó**: con la CPU saturada, el Director pidió
  sólo pruebas focales. Queda pendiente para cuando haya máquina, o para el
  refresco del Director desde main después de integrar.
- **Semántica:** ninguna de las 16 fuentes de `semanticPilot` está en el diff,
  así que esta tarea no debe recibo. La cobertura global sigue PENDING (1.104).
- **Archify:** no aplica, porque sus fuentes no cambiaron. En este worktree está
  `ARCHIFY_RUNTIME_MISSING`: el paquete no se descargó.
- **Obsidian:** la preview no se generó, porque depende del grafo estructural.
  Queda pendiente junto con `graphify update .`.
