# Handoff · SDD-0567 · El crédito de referido no nace sin venta ni se aplica dos veces

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0567-credito-referido-candado` |
| Rama | `codex/sdd-0567-credito-referido-candado`, desde `origin/main` `be746707`, con `main` mezclado después (`b3283623`) |
| SDD | [0567](../../docs/specs/0567-credito-referido-candado/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0567` (`99957208`, con `sdd:next --reserve credito-referido-candado --number 0567 --push`) y entró por cherry-pick. El Director asignó la migración 0494 |
| Estado | implementada; falta correr el contrato, PGlite y el verify con turno de máquina; la 0494 se aplica antes de fusionar (MIGRATE-FIRST), con el OK nominal de Sam |
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
| Contrato `supabase/tests/0494_credito_referido_candado.test.sql` en Docker | la migración | NO EJECUTADO: sin turno de máquina todavía |
| `credito-referido-candado.migration.test.ts` (PGlite: contrato, control rojo, 24 mutantes, deriva, preflight, reaplicación, espera) | la migración | NO EJECUTADO: sin turno |
| `radiografia-referidos.test.ts` | la radiografía versionada | NO EJECUTADO: sin turno |
| `vitest run` de Fidelización, typecheck y eslint | la app | NO EJECUTADO: sin turno |
| `pnpm verify` | completo | NO EJECUTADO: sin turno |

## Impacto documental y conocimiento

La spec 0567 y el índice. **Cambia el esquema** (la 0494), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. Con turno de máquina: el contrato en Docker, PGlite con los mutantes, la radiografía, la app y después `pnpm verify`.
2. **Que el Director confirme el `qual` vivo** de «referrals by tenant»: si no tiene `deleted_at is null`, es una deriva y la SELECT nueva cambia lo que se ve de los borrados (hoy hay 0).
3. La previa de producción del Director, con las cuatro huellas y la policy, y el OK nominal de Sam NOMBRANDO `0494_credito_referido_candado`. Después, aplicar, hacer el smoke de la espera y fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **`referrals` no entra en `entity_audit_log`.** La acreditación manual guarda el motivo y el autor en la fila, pero los cambios de estado no quedan en la auditoría D2.
2. **La reversión falsa por `service_role`**, como riesgo aceptado: el guardián no distingue una reversión real (que baja el pagado) de un UPDATE de código de servidor que limpie el rastro. Cerrarla exige reescribir el cuerpo de `revert_referral_credits` para que deje un permiso, como la excepción de la 0566.
3. **El descuento de USD 60 al referido** (B20 a) y si el premio es contra-ingreso o gasto (decisión 16) siguen en la 2.8.
4. **La ficha de un cliente eliminado pide el saldo y muestra un error** (lo encontró el Director en el smoke de la 0558). Destino: «SDD chica de la ficha», después de la 2.11.
