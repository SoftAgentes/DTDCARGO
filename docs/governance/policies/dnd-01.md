# DND-01 v1.0 — Drag and drop y Kanban

| Control | Valor |
|---|---|
| Estado | aprobada — Bitácora verificada; adopción por flujo |
| Aprobación | 2026-07-29 · Sam (founder) · REV-SGE-005 |
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

Bitácora quedó verificada por
[SDD-0216](../../specs/0216-dnd-bitacora-accessible/spec.md):

- drag HTML5 conserva pickup visible, destinos válidos y placeholder;
- cada tarjeta ofrece un selector de cualquiera de los cuatro estados mediante
  teclado, click o touch;
- un live region anuncia pickup y destino;
- el cliente actualiza optimistamente y revierte ante error;
- la Server Action condiciona la escritura al estado esperado y reporta el
  conflicto concurrente antes de refrescar;
- una transición exitosa ofrece Deshacer con la misma guarda de concurrencia.

La evidencia cubre este tablero, no todos los Kanban del ERP. Bugs Kanban abre
detalle y no arrastra, por lo que DND-01 no le aplica.

## Gate

Probar mouse, touch, teclado, single-pointer alternative, destino inválido,
permiso, red lenta, fallo, conflicto, undo y reduced motion. WCAG 2.2 exige una
[alternativa que no dependa de arrastrar](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
