# Handoff · SDD-0671 — CRM: tarjetas sin botón Abrir y Bandeja visible para la oficina

Fecha: 2026-11-18 · Rama `claude/sdd-0671-crm-tarjeta-bandeja` · Reserva `refs/dtd/reservations/0671`.

## Hecho

- Tarjeta del tablero sin botón «Abrir»: toda la tarjeta abre la ficha, salvo el menú; el nombre es la
  parada de teclado («Abrir ficha de …»). `CrmTableroKanban.tsx` y su prueba.
- Diagnóstico de la Bandeja en la spec §2, con archivo:línea: hacen falta cuatro condiciones (rol con
  `bandeja`, flag, vínculo de agente y bandejas de Chatwoot por rol). `bandeja` no se puede conceder por
  persona, y el ciclo de agentes saca de Chatwoot a quien no la tiene por rol.

## Evidencia

- Primera cabeza (ceeaef7d2): el CI falló en `claridad-t5d-contract.test.ts`, porque el contrato del tramo
  5d fijaba el diseño viejo. Se enmendó de forma explícita (spec §1.1), con mutantes nuevos.
- Vitest local con turno del DG: `claridad-t5d-contract.test.ts` y `CrmTableroKanban.test.tsx` PASARON
  (51/51). ESLint de los tres archivos: PASÓ.
- `/ui-check`: ver el cuerpo de la PR.
- Proceso: el worktree `crm-0671-tarjeta-bandeja` que creé para esta tarea lo retiré sin commits con
  `worktree remove`. Un hook de la sesión impide escribir fuera de su worktree, y el trabajo se llevó con un
  patch al worktree de la sesión.

## Pendiente de esta tarea

- Decisiones de Sam (spec §3.3): qué bandejas debe ver esa persona y si se cambia su rol o se abre la SDD de
  accesos por persona para la Bandeja.
- CI verde y revisión independiente (la lanza el DG).

## FUERA DE ALCANCE DETECTADO

- `bandeja` como acceso adicional por persona (opción D): requiere tocar el ciclo de agentes y la matriz de
  Chatwoot.
- El foco del nombre usa `.studio-link-quiet:focus-visible` (color y subrayado), sin anillo propio. Basta
  para WCAG 2.4.7, pero conviene un anillo común para botones de texto en el Studio.
