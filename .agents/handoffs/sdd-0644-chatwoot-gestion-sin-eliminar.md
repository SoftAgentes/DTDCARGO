# Handoff · SDD-0644 — Chatwoot: nivel «gestión» (ve y edita todo, no elimina)

- **Owner:** Worker 0644 (claim `local_worker_0644`), carril del Subdirector de Chatwoot.
- **Reporta a:** Subdirector de Chatwoot; el Director General revisa y fusiona.
- **Árbol:** `.claude/worktrees/competent-northcutt-6ba579`
- **Rama:** `claude/competent-northcutt-6ba579`, desde `origin/main` en `b9b29db96`.
- **SDD:** `docs/specs/0644-chatwoot-gestion-sin-eliminar/spec.md`, estado `proposed`.
- **Fecha:** 2026-11-16.

## OBJETIVO ORIGINAL

Reservar la SDD-0644 y entregar su diseño, sin código de producto: cómo lograr en Chatwoot CE
4.19.1 que el equipo de Sam vea y edite todo pero no elimine, con Sam como único administrador
completo, y cómo se enmienda la matriz del paso 2.7 (SDD-0585).

## COMPLETADO

- Reserva del número 0644 con `scripts/next-number.mjs --reserve … --expect 0644 --push`. El
  inventario dio «spec siguiente: 0644». Refs publicados, los dos sobre el commit `d9bf54f3b`:
  - `refs/heads/codex/sdd-reserve-0644`
  - `refs/dtd/reservations/0644`
- Spec de diseño con evidencia etiquetada: permisos de cada rol en CE 4.19.1, cuatro opciones
  con costo y riesgo, opción recomendada (inicializador propio que reserva el borrado), cómo
  se prueba, enmienda a la matriz (tres niveles, permiso «Chat: administrar», candado del
  administrador completo), orden para vincular a los dos agentes actuales y cinco preguntas
  cerradas para Sam.
- No se tocó `lib/studio/chatwoot/matriz.ts` ni ningún código de producto.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ: «índice sincronizado con 625 specs» |
| `pnpm sdd:check` | PASÓ: «numbering: sin números repetidos» |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es solo de documentos y no hay turno para corridas pesadas |
| Prueba local del inicializador | NO APLICA: no hay inicializador todavía; es de la implementación |

## EVIDENCIA Y SUS LÍMITES

- El código de Chatwoot se leyó del repositorio público `chatwoot/chatwoot`, etiqueta `v4.19.1`,
  el 2026-11-16: todas las policies de `app/policies/` y los controladores citados en la spec.
  No se levantó Chatwoot ni se probó nada contra una instancia.
- No se leyó producción ni el VPS. Los hechos de la instalación viva (versión, los dos agentes
  sin vínculo, sus roles en Studio) vienen del encargo del Subdirector.
- Quedan como inferencia, para comprobar en la implementación: la lista exacta de excepciones
  contra `rails routes` de la imagen; que ningún miembro del equipo tenga usuario de
  `super_admin`; que Sam sea superadministrador de Studio; y cómo compara mayúsculas
  `User.from_email`.

## IMPACTO DOCUMENTAL

- Nuevo: la spec 0644 y este handoff. El índice `docs/specs/README.md` se regeneró con
  `pnpm docs:index`.
- Pendiente para la implementación, no ahora: `docs/runbooks/chatwoot-agentes.md` (matriz de
  tres niveles, puerta de instalación y alertas nuevas) y la cabecera de `matriz.ts`.

## PENDIENTES DE ESTA TAREA

- Respuesta de Sam a las cinco preguntas de §9 de la spec. Sin ella no se implementa.
- La reserva `codex/sdd-reserve-0644` se puede borrar cuando la spec esté en `main`.

## FUERA DE ALCANCE DETECTADO

- `pnpm sdd:next` corrió una instalación de dependencias en este árbol antes de inventariar
  (1 min 28 s). No la pedí; quedó hecha. Si las instalaciones van con turno, conviene que el
  script de inventario no dependa de ella.
- El runbook de agentes dice en su «Estado» que el código está en la rama `codex/0582-e2-poc`
  y no en producción; `matriz.ts` ya está en `main`. Ese párrafo parece vencido.

## HANDOFF AL DIRECTOR

PR de documentos contra `main`, sin migraciones ni producto. No fusionar hasta que el Director
General la revise. La implementación es otra tarea y depende de las respuestas de Sam.
