# Handoff · SDD-0567 · El crédito de referido no nace sin venta ni se aplica dos veces

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0567-credito-referido-candado` |
| Rama | `codex/sdd-0567-credito-referido-candado`, desde `origin/main` `be746707`, con `main` mezclado después (`b3283623`) |
| SDD | [0567](../../docs/specs/0567-credito-referido-candado/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0567` (`99957208`, con `sdd:next --reserve credito-referido-candado --number 0567 --push`) y entró por cherry-pick. El Director asignó la migración 0494 |
| Estado | lista para revisión: PR en borrador, `pnpm verify` 16/17 sin fallos sobre `dac24360`; la 0494 se aplica antes de fusionar (MIGRATE-FIRST), con la previa del Director y el OK nominal de Sam |
| Permisos | El Director la asignó como la 2.11 del plan, en la cola después de la 0566, y aprobó el diseño el 2026-10-20. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0494 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 2.11 del plan contable: «las transiciones de `referrals` pasan a la base con un trigger guardián ("aplicado" solo sale por la reversión; "acreditado" solo nace de una venta real, por el trigger o por una RPC con motivo); el monto queda inmutable después de acreditar; se quita el UPDATE directo a `authenticated`; al anular la factura del referido, el crédito vuelve a espera si no se aplicó». Es el riesgo alto B20 (b): un crédito podía aplicarse dos veces.

## COMPLETADO

- **La radiografía de producción**, en solo lectura y con la autorización literal de Sam, dio **0 filas** en todos los chequeos. La validé antes en Docker, sobre el esquema completo de `main`: vacía, limpia, sucia y control rojo. Ahora está versionada en `scripts/qa/`.
- **El diseño**, en `c1190ae3`, lo aprobó el Director con las seis propuestas.
- **La migración 0494:**
  - sin UPDATE ni DELETE de `referrals` para `authenticated`, con una policy de SELECT y otra de INSERT;
  - apply y revert pasan a DEFINER con ALTER, sin cambiar su cuerpo;
  - el guardián, para todos los roles;
  - el disparador de la 0250 guarda la venta que acreditó;
  - la venta anulada: el crédito sin aplicar pasa a otra venta o vuelve a `registrado`, y uno aplicado queda marcado;
  - tres RPC: acreditar con motivo (solo admin), avanzar de paso y enlazar el asiento;
  - el preflight acepta la deriva de la 0250 (el cuerpo vivo, sin comentarios).
- **La app:** las acciones de Fidelización usan las RPC y el cajón pide el markbox y el motivo. Sin la 0494, la lista no se rompe.
- **El gobierno:** la espera, los 5 símbolos y el índice.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Radiografía en Docker (postgres:17, 468 migraciones de `main`) | la consulta, antes de correrla en producción | PASÓ: «VALIDACION 2.11: TODO PASÓ» (vacía 0, limpia 3, sucia 8, no escribe, control rojo) |
| Radiografía en producción (el Director, 2026-10-20T06:20:12Z) | solo conteos | 0 filas en todos los chequeos |
| `check-pending-migration-symbols` | código alcanzable que usa la 0494 | PASÓ: «0 ROJO · 2 AMARILLO declarado(s)» (la 0493 y la 0494) |
| `migrations-lock verificar` | candado | PASÓ: la 0494 figura como espera, «0 nueva(s) sin sellar» |
| `docs:check` (554 specs) | documentación | PASÓ |
| Contrato en PostgreSQL 17, primera versión (`620cb2fd` y el ajuste de `search_path`) | la migración | PASÓ: «TEST 0494 GREEN: 55 aserciones». Sin la 0494 (`apply_fix=false`): «TEST 0494: existe public.avanzar_referido(uuid,text,text)» |
| `vitest run` de `credito-referido-candado.migration.test.ts`, `radiografia-referidos.test.ts`, `app/studio/(app)/fidelizacion`, `lib/studio/fidelizacion`, `referral-link` y `rbac-actions-guard` | la migración en PGlite (contrato, control rojo, 24 mutantes, las derivas de la 0250 y de la policy, el preflight, la reaplicación y la espera), la radiografía (vacía, limpia, sucia, control rojo y solo lectura) y la app | PASÓ: `Test Files  13 passed (13)`, `Tests  638 passed (638)` |
| Mutantes de la app, restaurados por copia con la huella sha256 | el hint sin mirar, el motivo corto, registrado sin markbox, acreditar marcado a mano y el enlace por UPDATE directo | `MUERTOS 5/5 · restaurados 5/5` |
| `typecheck`, eslint `--max-warnings=0` (lo tocado) | repo y archivos tocados | PASÓ. El typecheck destapó el helper `ref` de `queries.test.ts` sin los dos campos nuevos; corregido, y esa prueba dio `14 passed` |
| `pnpm verify` sobre `89202323` | completo | NO EJECUTADO hasta el final: lo detuve al llegar la revisión de seguridad, porque cambiaba la migración |
| Confirmación de la revisión, contra la 0494 sin corregir (`89202323`) | B1, B2 e I2 | se confirmaron los tres: `support` insertó un `registrado` con un cliente viejo y una venta acreditó 2 créditos; el premio en 0 hizo fallar la venta con 23514; anular falló con el cliente borrado |
| Contrato en PostgreSQL 17 sobre `dac24360` (las correcciones de la revisión e I2 con `tenant_id`) | la migración | PASÓ: «TEST 0494 GREEN: 78 aserciones». Control rojo en la primera aserción |
| `credito-referido-candado.migration.test.ts` (PGlite) sobre `dac24360` | el contrato, el control rojo, 41 mutantes, las derivas de la 0250 y de la policy, el disparador de 0098 distinto, el preflight, la reaplicación y la espera | PASÓ: `Tests  50 passed (50)` |
| El bloque de la app y la radiografía sobre `5f7dfd23` | PGlite, radiografía, Fidelización, `referral-credit-*`, `referral-link` y `rbac-actions-guard` | PASÓ: `Test Files  15 passed (15)`, `Tests  675 passed (675)`; mutantes de la app `MUERTOS 5/5 · restaurados 5/5`; typecheck y eslint PASÓ |
| **`pnpm verify` sobre `dac24360`** (de 2026-10-20T10:20:56Z a 10:40:23Z) | completo | `VERIFY_EXIT=0`: «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del `verify` sobre `dac24360`, copiado de su salida:
- **PASÓ a la primera:** harness, lint, rsc-boundary, typecheck, edge-functions, test (`Tests  12133 passed | 1 skipped (12134)`), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («[AMARILLO] … avanzar_referido (0494_credito_referido_candado)»), sql-tests («245 contrato(s) de SQL verificado(s) · rollback total», con `0494_credito_referido_candado.test.sql`), schema-rebuild («470 migraciones aplicadas desde cero», el aislamiento de 219 tablas, la radiografía de integridad en 63 filas y «radiografía de referidos verificada sobre el esquema completo (0 filas, conteos)»), e2e (`177 passed (4.3m)`) y build.
- **e2e:** `1 flaky`, `auth.spec.ts:81` (el token inválido de Acceso), el mismo de otras corridas y ajeno a Fidelización.
- **NO DISPONIBLE:** migrations-applied (el worktree no tiene `.env.local`). La 0494 es MIGRATE-FIRST y la aplica el Director.

## Impacto documental y conocimiento

La spec 0567 y el índice. **Cambia el esquema** (la 0494), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. Con turno de máquina: el contrato en Docker, PGlite con los mutantes, la radiografía, la app y después `pnpm verify`.
2. **Hecho:** el Director confirmó la deriva del `qual` vivo (sin `deleted_at is null`). El preflight acepta los dos y la SELECT nueva la corrige (spec).
3. La previa de producción del Director, con las cuatro huellas y la policy, y el OK nominal de Sam NOMBRANDO `0494_credito_referido_candado`. Después, aplicar, hacer el smoke de la espera y fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **`referrals` no entra en `entity_audit_log`.** La acreditación manual guarda el motivo y el autor en la fila, pero los cambios de estado no quedan en la auditoría D2.
2. **La reversión falsa por `service_role`**, aceptada por el Director el 2026-10-20. El guardián no la distingue de la real: la 0471 actualiza el referido antes de bajar el pagado, y el asiento lo anula la app después, fuera de la transacción. El sentido inverso (`acreditado → aplicado` sin subir el pagado, también solo por `service_role`) entra en el mismo riesgo. **Destino: «revert con permiso o disparador diferido»**, para retomarlo cuando haga falta. El análisis y las dos mitigaciones están en la spec (*Riesgos*).
3. **El descuento de USD 60 al referido** (B20 a) y si el premio es contra-ingreso o gasto (decisión 16) siguen en la 2.8.
4. **La ficha de un cliente eliminado pide el saldo y muestra un error** (lo encontró el Director en el smoke de la 0558). Destino: «SDD chica de la ficha», después de la 2.11.
