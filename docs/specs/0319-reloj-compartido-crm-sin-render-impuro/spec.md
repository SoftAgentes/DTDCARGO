---
sdd: 0319
title: Reloj compartido CRM sin render impuro
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0288
  - SDD-0313
confidencialidad: interno
---

# SDD-0319 — Reloj compartido CRM sin render impuro

## Problema

El semáforo de conversación tenía dos implementaciones de reloj. El tablero
llamaba `Date.now()` durante render y la tabla llamaba `setState(Date.now())`
sincrónicamente dentro de un efecto. React los reportaba como render impuro y
cascada de render. Seis parámetros sin uso en mocks completaban ocho warnings
persistentes de lint.

## Contrato

1. `PuntoConversacion` es el único dueño del reloj visual.
2. `useSyncExternalStore` entrega `null` durante SSR/hidratación y un timestamp
   compartido a todas las tarjetas en el primer `requestAnimationFrame`.
3. Si no quedan suscriptores, el snapshot se descarta; un montaje posterior
   obtiene un reloj nuevo.
4. La prop opcional `ahoraMs` conserva pruebas y usos deterministas.
5. Tablero y tabla no crean ni mantienen relojes propios para el semáforo; el
   cálculo preexistente de antigüedad de leads queda fuera de este alcance.
6. Los mocks conservan su firma de dos argumentos sin declarar parámetros no
   usados individualmente.

## Aceptación

- El punto continúa montado en las dos vistas.
- Ambas vistas carecen de reloj propio para el semáforo durante render.
- El módulo compartido usa un snapshot único y `requestAnimationFrame`.
- Las pruebas de SDD-0288 siguen verdes.
- `pnpm lint` termina con cero errores y cero warnings.

## Fuera de alcance

- Cambiar colores, umbrales o rótulos del semáforo.
- Cambiar consultas o datos de Kommo.
