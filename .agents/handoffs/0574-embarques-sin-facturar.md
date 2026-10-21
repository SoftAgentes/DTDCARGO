# Handoff · SDD-0574 · Embarques sin facturar (4.5 del plan contable)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `fase4-carril-adelantado` / sesión Worker «carril del embarque» (Claude, `claude-peaceful-franklin-a3831e`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0574-embarques-sin-facturar` |
| Rama | `codex/sdd-0574-embarques-sin-facturar`, creada con `harness-worktree start --from claude/peaceful-franklin-a3831e` (`2e94bccc`), más la reserva `codex/sdd-reserve-0574` (`aeeace19`, sobre `origin/main` reciente) |
| SDD | [0574](../../docs/specs/0574-embarques-sin-facturar/spec.md), `in-progress`. Número asignado por el Director el 2026-10-20; reserva con `sdd:next --reserve embarques-sin-facturar --number 0574 --push` |
| Dependencia | **Apilada sobre la SDD-0571 (PR #307)**: lee `shipment_rate_snapshots`. Se integra después de la #307 |
| Permisos | Commits, push de la rama propia y PR en borrador; no fusionar. Lectura de `invoices` autorizada por el Director (solo lectura, BASELINE, aviso a «Contabilidad») |

## OBJETIVO ORIGINAL

La 4.5: reporte «Embarques sin facturar» y tarjetas en Dirección.

## COMPLETADO

- Regla pura y lectura en `lib/studio/rate-snapshots/sin-facturar.ts` (detalle en la spec).
- Página `/studio/reportes/embarques-sin-facturar` (layout de Reportes: accounting + admin) y enlace desde Reportes › Contables.
- Tarjeta «Por facturar» en Dirección (admin), con los tres estados enlazados al reporte.
- Lector nuevo de `invoices` justificado en el BASELINE de `invoice-read-boundary` (19 → 20 archivos, 44 → 45 lecturas).
- Aviso de columnas leídas a la sesión «Contabilidad» (2026-10-20): `id, invoice_code, shipment_id, client_markbox, status, deleted_at`.
- Comprobé que las ramas `sdd-0572` y `sdd-0573` de Contabilidad no tocan Reportes, Dirección ni el BASELINE.
- `/ui-check` en línea: sin hallazgos bloqueantes.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `sin-facturar.test.ts` | regla (facturada, normalización en los dos lados, otro cliente, borrador, anulada, estados, días, orden, fuera) y lectura (borradas, huérfanas, facturas borradas, tarifas reemplazadas, sin la 0496) | PASÓ: 10/10 |
| Mutantes a mano (copia y `cmp` de restauración) | sin normalizar el Shipping Mark de la factura · borrador como facturado · sin excluir el envío cancelado | los 3 MUERTOS; el primero sobrevivió a la primera versión de la prueba y se agregó el caso inverso |
| `invoice-read-boundary.test.mjs` | inventario de lectores de `invoices` | PASÓ |
| `tsc --noEmit` | repo | PASÓ (0 errores) |
| eslint de lo tocado | — | PASÓ |
| `docs:check` | 557 specs | PASÓ |
| `pnpm verify` | completo | NO EJECUTADO: va después del verify final de la 0571, con turno del Director |

## COMMITS

- `aeeace19` reserva SDD-0574.
- `3a837756` reporte, tarjetas, regla, pruebas, BASELINE y spec.
- El commit que contiene este documento.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` (turno del Director), push y PR en borrador, base `main`, declarando que va apilada sobre la #307.
2. Después de la 4.2: cruzar la factura por el envío por cliente, sin Shipping Mark.

## FUERA DE ALCANCE DETECTADO

- La auto-factura de la orden de venta (0128) liga la factura a la prealerta y no al envío: el reporte no la reconoce como cobertura. SDD-0284 midió 0 de 8 compras con orden de venta.

## HANDOFF AL DIRECTOR

- Integrar después de la #307 (lee su tabla). No toca archivos de Contabilidad.
- Ownership: claim de `claude-peaceful-franklin-a3831e`, vigente.
