# CMP-01 v1.1 — Ciclo de vida de componentes

| Control | Valor |
|---|---|
| Estado | aprobada — ciclo canonical/deprecated verificado |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-017 |
| Depende de | SGE-00 y políticas de patrón |

## Estados

| Estado | Uso permitido |
|---|---|
| experimental | Prototipo acotado; no se replica sin revisión. |
| proposed | API/documentación listas para prueba en uno o dos consumidores. |
| canonical | Patrón aprobado, accesible, probado y recomendado para nuevos usos. |
| deprecated | Sigue funcionando; nuevos usos prohibidos y migración documentada. |
| retired | Sin consumidores; removido con trazabilidad al reemplazo. |

## Registro mínimo

Nombre, propósito, owner, estado, políticas que implementa, API, tokens,
accesibilidad, breakpoints, ejemplos correctos/incorrectos, pruebas,
consumidores, reemplazo y fecha de revisión.

## Promoción

Experimental → proposed exige problema real y no duplicar un canónico. Proposed
→ canonical exige revisión de diseño, teclado/lector, mobile/dark, tests y al
menos un consumidor verificado. Deprecar exige reemplazo y plan; retirar exige
búsqueda cero consumidores.

El catálogo del futuro plugin lee este registro. Crear un componente no lo hace
canónico automáticamente.

## Estado de implementación

`ConfirmDialog` recorrió `proposed → canonical` mediante
[REV-SGE-012](../reviews/cmp-confirm-dialog-canonical.md).
[REV-SGE-017](../reviews/cmp-01-v1-1-deprecated.md) corrige las dos
limitaciones del schema v1.0, registra `SegmentedControl` como `canonical` y
`LLMModeToggle` como `deprecated` con reemplazo y plan acotado.

El registro se considera estable para abrir el scaffold read-only de PLG-01:
schema positivo/negativo, agregado reproducible, referencias `A11Y-01`,
promoción canónica y deprecación real quedan verificadas. La instalación,
marketplace y capacidades de escritura conservan gates separados.
