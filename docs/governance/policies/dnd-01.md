# DND-01 v0.1 — Drag and drop y Kanban

| Control | Valor |
|---|---|
| Estado | redactada — pendiente de aprobación |
| Depende de | MOT-01, A11Y-01, AVS-01 y AUD-01 |

## Contrato

- Pickup muestra tarjeta tomada, origen y destinos válidos sin mover todavía el dato.
- Placeholder reserva la posición exacta; destino inválido explica por qué.
- Drop ejecuta una transición de negocio autorizada, no solo una animación.
- Mientras guarda, la tarjeta queda pendiente; éxito asienta y fallo vuelve al
  origen con mensaje recuperable.
- Conflicto concurrente refresca y explica el estado real.
- Cambio reversible ofrece Deshacer cuando el backend puede garantizarlo.
- Todo drag tiene alternativa de click/tap sin arrastre y control por teclado.
- Lector de pantalla recibe elemento tomado, destino y resultado.
- Móvil no intenta emular HTML5 drag: usa menú/botón/sheet de cambio de estado.

## Estado actual

Bitácora usa drag HTML5 en escritorio y un botón de avance como fallback touch;
no permite elegir cualquier destino por teclado/touch. Bugs Kanban abre detalle
y no arrastra. Falta feedback completo de pickup/inserción, optimistic rollback,
undo y auditoría uniforme.

## Gate

Probar mouse, touch, teclado, single-pointer alternative, destino inválido,
permiso, red lenta, fallo, conflicto, undo y reduced motion. WCAG 2.2 exige una
[alternativa que no dependa de arrastrar](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
