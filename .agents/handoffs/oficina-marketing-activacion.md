# Handoff · Activación del departamento de marketing de la oficina (continuación de SDD-0605)

- **Owner:** Worker `local-busy-keller-1d36df`, iniciado por la sesión coordinadora
  `local_61442abe` (pedido de Sam del 2026-11-06).
- **Ruta:** `.claude/worktrees/busy-keller-1d36df` · **Rama:** `claude/oficina-marketing-activacion`
  · **Base:** `main` `3d17292a4`.
- **SDD:** ninguna nueva. Es lo que la [SDD-0605](../../docs/specs/0605-oficina-reestructura/spec.md)
  dejó en «Qué no entra» para escribir al preparar las contrataciones: `hermes.md` de los perfiles
  nuevos, `AGENTS-paperclip.md` e identidad del CEO.
- **Permisos del encargo:** solo documentación; publicar la rama y abrir la PR en borrador sí;
  fusionar no. Sin VPS, sin llaves, sin IP, sin datos de clientes.

## Objetivo

Dejar en el repositorio todo lo que falta para activar los agentes nuevos de marketing y el
Revisor: contexto de trabajo, instrucciones de Paperclip, identidad del CEO e ingeniería y un plan
de entrenamiento de dos semanas.

## Completado

| Archivo | Cambio |
|---|---|
| `oficina-agentes/{revisor,director-contenido,seo,tiktok,youtube}/hermes.md` | Nuevos: escritorio, biblioteca (incluye 04 a 07), formato de entrega y regla de internet |
| `oficina-agentes/community/hermes.md` | Nuevo. No estaba pedido explícito, pero el perfil entra en el turno 1 del entrenamiento y no tenía contexto |
| `oficina-agentes/contenido/hermes.md` | Redactor de noticias; el calendario pasa al Director de contenido |
| `oficina-agentes/gabinete/hermes.md` | Coordinador de procesos y seguimiento; suma `seguimiento.md` |
| `oficina-agentes/ceo/hermes.md` | Equipo de 13, Discord `#alfred`, revisión del Revisor, Vigía en el parte |
| `oficina-agentes/ceo/SOUL.md` | Única puerta, Discord, equipo nuevo, historia |
| `oficina-agentes/ingenieria/SOUL.md` y `hermes.md` | Rutina semanal Vigía de mejoras (plan v1 §2c) con plantilla; no actualiza nada |
| `oficina-agentes/AGENTS-paperclip.md` | Común a todos; CEO sin el límite de 8 agentes; bloques nuevos de Revisor, Director, IG/FB, SEO, TikTok, YouTube; renombrados Coordinador y Redactor; cadencias con día fijo marcadas PROPUESTA |
| `oficina-agentes/entrenamiento.md` | Nuevo: orden de entrada, quién necesita web, aprobación de memoria y skills por Sam, qué se mide, 3 tareas y pregunta de control por agente |
| `oficina-agentes/README.md` | Tabla con columna de instrucciones de Paperclip y estado al 2026-11-06 |
| `organizacion/plan-maestro-oficina.md` | Una línea: la propuesta de web para perfiles nuevos apunta al entrenamiento §2 |

## Validación

| Comprobación | Resultado |
|---|---|
| `docs:check` (`node scripts/build-docs-index.mjs --check`) | PASÓ |
| `sdd:check` (`node scripts/check-numbering.mjs`) | PASÓ (solo choques históricos conocidos) |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: solo documentos |
| `knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en este worktree (sin `node_modules` ni Graphify) |
| Búsqueda de IP, `sbp_`, `sk-` en `oficina-agentes/` | Sin coincidencias |

## Decisiones tomadas aquí (propuestas, no de Sam)

- Turno 0 con Revisor y Director de contenido antes de IG/FB y SEO, porque el flujo los necesita.
- Web propuesta para `seo`, `tiktok`, `youtube` e `ingenieria` (solo Vigía). No para Revisor ni
  Director.
- Días fijos (lunes SEO, martes tendencias, jueves Vigía, lunes seguimiento) marcados PROPUESTA.
- Las tres tareas por agente se ofrecen como las «tres tareas reales» del pendiente P6.

## Pendientes de esta tarea

1. **Nombre del perfil `director-contenido`.** La sesión coordinadora iba a confirmar si Hermes lo
   acepta o si se crea como `dircontenido`. Al cerrar no llegó el mensaje; las rutas usan
   `director-contenido`, como el resto de documentos de `main`. Si cambia, hay que renombrar la
   carpeta y las rutas de `hermes.md`, entrenamiento, organigrama §9.2, plan maestro y `07`.
2. Revisión de la PR y decisiones de Sam: orden de entrada (P3), web por perfil, días de las
   rutinas.

## Impacto documental

Documentos canónicos actualizados: los de `docs/organizacion/oficina-agentes/` y una línea del
plan maestro. La biblioteca `oficina-conocimiento/` no cambia. Graphify estructural y semántico:
NO DISPONIBLE en este worktree; queda para el Director al integrar.

## FUERA DE ALCANCE DETECTADO

- `oficina-conocimiento/04-marketing.md` («Cómo se ve») pide leer `BRAND.md` y la pauta editorial,
  que están en el repositorio y no en la biblioteca del VPS: un agente no los puede abrir.
- `#actividad-oficina` todavía no se alimenta (runbook del corte); la Vigía llega por comentario
  y por el parte del viernes hasta que exista esa extensión.
- Las identidades e instrucciones de `asesor`, `crm` y `operaciones` siguen sin versionar.
- Cómo se revisa y borra una memoria o skill en Hermes v0.22.2: NO VERIFICADO; lo comprueba una
  persona con acceso al VPS antes del turno 0.

## Handoff al Director

PR en borrador, solo documentos, sin migraciones ni SDD nueva. No toca archivos de las PR #388
(0610) ni #389 (0611). Fusionar es del Director General.
