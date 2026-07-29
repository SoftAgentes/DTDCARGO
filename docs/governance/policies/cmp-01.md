# CMP-01 v1.0 — Ciclo de vida de componentes

| Control | Valor |
|---|---|
| Estado | aprobada — registro ejecutable pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-006 |
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
