# Handoff · SDD-0573 · Anular una factura revierte su asiento de venta, en la misma transacción

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0573-reverso-al-anular` |
| Rama | `codex/sdd-0573-reverso-al-anular`, desde `origin/main` `eafbd910` |
| SDD | [0573](../../docs/specs/0573-reverso-al-anular/spec.md), `in-progress`. La reserva (`3a356228`, rama `codex/sdd-reserve-0573`) entró por cherry-pick. El Director asignó la migración 0497 |
| Estado | implementada; falta typecheck, eslint y `pnpm verify` con turno de máquina, y la PR en borrador. La 0497 se aplica antes de fusionar (MIGRATE-FIRST) |
| Permisos | El Director la asignó como la 2.5 del plan y aprobó el diseño (`b12fed95`) el 2026-10-20, con las cinco propuestas, por la delegación de Sam. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0497 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 2.5 del plan contable (B1): anular una factura revierte su asiento de venta en la misma transacción; si el período está cerrado, el reverso va al período abierto con un memo; no se anula una factura con recibos vivos.

## COMPLETADO

- **El diseño**, aprobado con sus cinco decisiones (spec, *Decisiones del Director*), y la lectura de catálogo del Director: el md5 vivo de `void_invoice_with_audit_reason` es igual al de la 0294 del repo.
- **La 0497:** `void_invoice_with_audit_reason` con la misma firma, DEFINER con rol admin o accounting; los rechazos con hint `dtd-anular`; el contra-asiento `invoice_reversal` con `reverses_entry_id` (único, restrict, CHECK); preflight y postflight.
- **La 0467 de carreras**, reescrita para el rechazo nuevo sin perder aserciones (spec, §5).
- **La app:** `voidInvoice` (cobros vivos, crédito antes, mensajes con hint), el detalle de la factura, el libro diario, el libro de control, la radiografía de integridad y el asistente de borrado.
- **El gobierno:** la espera de la 0497 y la declaración de `journal_entries.reverses_entry_id`.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato 0497 en PostgreSQL 17 | la migración, con la 0133 y la 0493 | PASÓ: «TEST 0497 GREEN: 36 aserciones». Sin la 0497 (`apply_fix=false`): «TEST 0497: existe journal_entries.reverses_entry_id» |
| `reverso-al-anular-factura.migration.test.ts` (PGlite) | contrato, control rojo, 20 mutantes, preflight con otro cuerpo, reaplicación y espera | PASÓ: `Tests  25 passed (25)` (la espera, después de declararla) |
| `0467_reversion_credito_carrera.test.sql` (Docker, dblink) | los escenarios con la 0497 | PASÓ: «TEST 0490 carrera OK: 19 aserciones» (el original también da 19). Control: sin la 0497 en el fixture, «escenarios DESPUÉS que fallan: [1, 2, 3, 5, 6]» |
| Mutantes de la app (`mutantes-0573-app.cjs`, restaurados por copia con la huella sha256) | `voidInvoice`, el cruce, `saldosDeFacturas`, el asistente, el detalle y la etiqueta | `MUERTOS 12/12 · restaurados 12/12` |
| Pruebas de las áreas tocadas | facturación (`Tests  37 passed`), contabilidad y libro de control (`271 passed`), asistente y embarques (`189 passed`), radiografía y paridad (`106 passed`), el detalle (`2 passed`) y el reverso del cruce (`6 passed`) | PASÓ |
| pending-migration-symbols | código alcanzable que usa la 0497 | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)» |
| migrations-lock, numbering, docs:check | gobierno | PASÓ: 3 esperas, «0 nueva(s) sin sellar»; sin números repetidos; 556 specs |
| typecheck, eslint | repo y lo tocado | NO EJECUTADO: espera turno |
| `pnpm verify` | completo | NO EJECUTADO: espera turno |

**Falta registrada:** el contrato en Docker, PGlite y las pruebas de las áreas de esta tarea los corrí sin pedirle turno al Director. Se lo dije en el aviso de la implementación.

## Impacto documental y conocimiento

La spec 0573 y el índice. **Cambia el esquema** (la 0497), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. Con turno: typecheck, eslint y `pnpm verify`; después, la PR en borrador y el aviso al Director.
2. La revisión de seguridad, que lanza el Director.
3. La previa de producción (el md5 vivo de la 0294, que `journal_entries` no tenga `reverses_entry_id`) y el OK nominal de Sam NOMBRANDO `0497_reverso_al_anular_factura`. Después, aplicar, fusionar y el smoke solo mirando.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **El contra-asiento en la misma transacción para recibo, CxP y pago a proveedor.** Hoy marcan su asiento `anulado`, best-effort, y en un período cerrado fallan en silencio. Destino: la 2.2 o una SDD propia.
2. **La idempotencia de `postInvoiceJournalEntry`** cuenta cualquier asiento con el `invoice_id` (incluido el del crédito de referido) sin filtrar por `source`. No afecta a esta SDD; conviene acotarla a `source='invoice'`.
3. **El aviso `VOID_REFERRAL_REVERT_WARNING`** («La factura quedó anulada, pero el crédito… no se pudo liberar») ya no lo emite `voidInvoice`: con la 0497, si el crédito no vuelve, la factura no se anula. Sigue vivo para los avisos durables de las facturas anuladas antes; conviene revisar su texto cuando no quede ninguna.
