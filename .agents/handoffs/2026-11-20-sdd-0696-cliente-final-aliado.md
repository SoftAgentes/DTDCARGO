# Handoff — SDD-0696 dirección de entrega del cliente final de un aliado

- **Owner:** el Worker `datos-duplicados-9e6364`, una sesión hija de Dir_DTD.
- **Ruta:** `DTD-worktrees/sdd-0696-cliente-final-aliado`.
- **Rama:** `codex/sdd-0696-cliente-final-aliado`, sobre la reserva `codex/sdd-reserve-0696` (e9a0aa2aa).
- **Objetivo:** el pedido de Sam del 2026-11-20. Que el aliado cargue la dirección de sus clientes en la
  marca blanca, o que les mande un enlace con su marca para que la llenen ellos.
- **SDD:** la 0696, asignada por Dir_DTD. Va después de la 0695 (PR #728) y depende de la 0694 (PR #725) y
  de la 0666.
- **Permisos:**
  - solo la spec;
  - la rama y una PR en borrador;
  - ni código, ni migraciones, ni producción.

## Hecho

- Medición del modelo de aliados en `main` (e9a0aa2aa):
  - el cliente final es una ficha de `clients` con `aliado_id`;
  - el aliado tiene su ficha ancla;
  - no hay modo de entrega construido;
  - la 0666 y la 0255 prohíben hoy que el aliado cambie direcciones.
- La spec `docs/specs/0696-direccion-cliente-final-aliado/spec.md`, en estado `proposed`: el modo de
  entrega por aliado, la fuente única de siempre, la carga por RPC, el enlace de un solo uso con la marca
  del aliado, el aviso al aliado, las fases, la aceptación y las preguntas P-1 a P-7.

## Pendientes de esta tarea

1. Las respuestas de Sam a P-1 a P-7.
2. Al aprobarse, las notas de cambio en la 0666 (§2.1, §4.3 y D2) y en la 0255 §8.4 (spec §4.7).
3. La cláusula de la 0255 §8.5 y el aviso de privacidad del enlace (P-7). Los ve el abogado de Sam antes de
   la F-2.

## Fuera de alcance detectado

- Ninguno nuevo. Lo de la 0695 está en su handoff.

## Impacto documental

- La spec nueva y el índice `docs/specs/README.md`. Las enmiendas a la 0666 y la 0255 quedan pendientes de la
  aprobación.
