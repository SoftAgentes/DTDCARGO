# DAT-01 v1.0 — Selector de fecha y rango

| Control | Valor |
|---|---|
| Estado | aprobada — adoptada en planificación de embarques |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-005 |
| Depende de | CAL-01, A11Y-01 y FRM-01 |

## Contrato

- Campo permite escribir y abrir calendario; ambos representan el mismo valor.
- Presets aparecen solo si son reales para la tarea: hoy, esta semana, últimos N días.
- Rango muestra inicio/fin, continuidad entre meses e inclusividad.
- Fecha inválida no corrige silenciosamente; conserva texto y explica formato.
- Min/max, días bloqueados y timezone se aplican en UI y servidor.
- Teclado sigue patrón grid/date picker: flechas, cambio de mes, Escape y retorno de foco.
- Móvil usa sheet/dialog con targets touch y acción Aplicar; no depende de hover.
- Borrar fecha es una acción explícita y no equivale a “hoy”.

## Gate

Probar escritura, locale, rango inverso, cruce de mes/año, leap day, timezone,
día bloqueado, presets, teclado, móvil y 200 % zoom. Referencia:
[WAI Date Picker](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/).

DAT-01 conserva el código histórico para selección de fechas; CAL-01 gobierna
el calendario operativo completo.

## Adopción verificada

SDD-0223 usa `datetime-local`: acepta escritura y selector nativo, funciona con
teclado y selector móvil, permite borrar explícitamente y mantiene la zona IANA
visible. Antes de persistir, el servidor valida zona, orden cronológico,
permiso y versión. El control no corrige fechas inválidas ni las reemplaza por
“hoy”. Los rangos y presets no aplican a esta tarea de tres hitos discretos.
