# FRM-01 v1.0 — Formularios, validación y conservación

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-004 |
| Depende de | SGE-00, BTN-01, ERR-01 y NUM-01 |

## Contrato

- Un formulario tiene objetivo, título y acción final inequívocos.
- Labels persisten; placeholder es ejemplo, no etiqueta.
- Campos se agrupan por decisión y se ordenan como la tarea, no como la tabla DB.
- Obligatorio/opcional se comunica de forma consistente.
- Validación de formato ocurre al salir o al enviar; no regaña por un valor aún incompleto.
- Validación entre campos y de negocio se repite en servidor.
- El primer error bloqueante recibe foco y existe resumen cuando hay varios.
- Cambios sin guardar se conservan, autoguardan o advierten antes de perderse.
- Pending bloquea doble submit; cerrar durante una mutación crítica no está permitido.
- Datos sensibles indican propósito y no reaparecen innecesariamente.
- Móvil usa teclado/inputmode correcto y no oculta acción/error con teclado virtual.

## Gate

Probar vacío, datos válidos, múltiples errores, error de negocio, pendiente,
doble submit, cerrar/navegar, recuperación, teclado, 200 % zoom y móvil.
