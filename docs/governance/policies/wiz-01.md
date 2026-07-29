# WIZ-01 v1.0 — Procesos y formularios por pasos

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-005 |
| Depende de | FRM-01, PRG-01 y SGE-00 |

## Cuándo usar

Usar wizard cuando existen etapas lógicas con dependencias, revisión o carga
cognitiva que no caben en un formulario legible. No dividir un formulario corto
solo para aparentar simplicidad.

## Contrato

- Muestra total, paso actual, nombres y qué pasos son revisables.
- Siguiente valida el paso; Atrás no borra datos ni dispara mutación.
- Guardado entre pasos es durable o se declara local; cerrar explica conservación.
- No se salta una obligación sin indicarlo.
- El paso final resume consecuencias antes de la acción BTN-01.
- Error server-side vuelve al paso/field correcto conservando lo demás.
- URL/estado permite retomar cuando el proceso es largo o multi-sesión.
- Móvil mantiene el indicador compacto sin esconder total/estado.

## Gate

Probar adelante/atrás, salto permitido, refresh, cerrar/volver, error por paso,
finalización, doble submit, datos sensibles, teclado y móvil.

Alias histórico: WIZ-01 se conserva para wizards; PRG-01 gobierna progreso en general.
