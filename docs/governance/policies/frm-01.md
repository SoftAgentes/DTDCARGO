# FRM-01 v1.1 — Formularios, validación y conservación

| Control | Valor |
|---|---|
| Estado | aprobada — adopción pendiente |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-014 |
| Depende de | SGE-00, BTN-01, ERR-01 y NUM-01 |

## Contrato

- Un formulario tiene objetivo, título y acción final inequívocos.
- Labels persisten; placeholder es ejemplo, no etiqueta.
- Campos se agrupan por decisión y se ordenan como la tarea, no como la tabla DB.
- Obligatorio/opcional se comunica de forma consistente.
- Un campo intacto no muestra error mientras la persona escribe por primera
  vez. La primera validación de formato ocurre al salir o al enviar.
- Después del primer error, el campo revalida durante la corrección y retira el
  aviso apenas se resuelve. El ciclo explícito es
  `pristine → blur/submit → invalid → live correction → resolved`.
- Submit siempre ejecuta validación completa y conserva la validación
  server-side; blur/live no la sustituyen.
- Un estado positivo se anuncia sólo cuando confirma información útil o una
  regla de negocio, no como check verde ornamental en cada campo.
- Validación entre campos y de negocio se repite en servidor.
- El primer error bloqueante recibe foco y existe resumen cuando hay varios.
- Cambios sin guardar se conservan, autoguardan o advierten antes de perderse.
- Pending bloquea doble submit; cerrar durante una mutación crítica no está permitido.
- Datos sensibles indican propósito y no reaparecen innecesariamente.
- Móvil usa teclado/inputmode correcto y no oculta acción/error con teclado virtual.

## Gate

Probar vacío, datos válidos, múltiples errores, error de negocio, pendiente,
doble submit, cerrar/navegar, recuperación, teclado, 200 % zoom y móvil.
