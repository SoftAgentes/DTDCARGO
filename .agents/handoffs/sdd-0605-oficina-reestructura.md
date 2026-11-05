# Handoff — SDD-0605 · Reestructura de la oficina de agentes (solo documentos)

Fecha: 2026-11-05. Task ID: `sdd-0605-oficina-reestructura`.
Owner / sesión escritora: `claude-strange-jepsen-c4a225-oficina-reestructura` (Worker Claude Code,
iniciada por la sesión que armó el plan de la oficina con Sam).

Estado de la tarea: **lista para revisión, con PR en borrador contra `main`.** Sam autorizó
publicar el 2026-11-05 (ver «Permisos»). Sigue en borrador porque falta que Sam confirme tres
nombres de puestos. La integra el Director.

- **Worktree:** `.claude/worktrees/strange-jepsen-c4a225`, sin `node_modules`.
- **Rama:** `claude/strange-jepsen-c4a225`, desde `main` `49bdba2e5`.
- **SDD:** `docs/specs/0605-oficina-reestructura/spec.md`, estado `proposed`. Reservada con
  `sdd:next --reserve --expect 0605`: rama `codex/sdd-reserve-0605-oficina-reestructura` y ref
  `refs/dtd/reservations/0605`, las dos **solo locales**. El stub entró a la rama por cherry-pick.
- **Permisos:** el encargo dio commits locales y dejó la publicación sujeta a Sam. **Autorización
  de Sam, literal, el 2026-11-05 en esta sesión: «Sí, publícala»,** en respuesta a «¿Autorizas
  publicar la rama y abrir la PR de la SDD-0605?». Cubre publicar esta rama y abrir su PR. No
  cubre merge, VPS, Paperclip, Discord ni producción, ni publicar la rama de reserva.

## OBJETIVO ORIGINAL

Dejar escrita en el repositorio, como SDD documental, la reestructura de la oficina de agentes que
Sam aprobó el 2026-11-05: spec con allowlist; organigrama y plan maestro con los 13 agentes, el
orden de entrada de los expertos, la Vigía de mejoras, el modelo por agente y Discord como central
con sus roles; cuatro archivos de biblioteca; identidades de los perfiles nuevos y ajuste de los
renombrados; cierre con `docs:index`, `docs:check` y `sdd:check`.

## COMPLETADO

- **Spec SDD-0605** con el alcance, 11 decisiones de Sam fechadas (D1 a D11), 9 pendientes (P1 a
  P9), la lista de lo medido el 2026-11-05 y una allowlist de 20 archivos.
- **Organigrama** (`organigrama-paperclip.md`): sección 9 nueva (qué cambia y qué no, los 13
  agentes con perfil, modelo y línea de reporte, diagrama, forma de trabajo, marketing por turnos,
  Revisor, Vigía, modelos, Discord con roles, decisión contra pendiente). Avisos fechados en §2.3,
  §2.4 y §4.4, que quedan como historia.
- **Plan maestro** (`plan-maestro-oficina.md`): sección 7 nueva (lo medido, qué le falta a cada
  agente, orden de entrada, Vigía, modelo por perfil con sus condiciones, Discord con canales,
  roles, configuración, reglas, privacidad y migración, orden de ejecución, decisiones, riesgos y
  verificación). Avisos en la cabecera, en §2 y en §4.
- **Biblioteca:** `04-marketing.md`, `05-seo-geo-aeo.md`, `06-noticias.md` y
  `07-quien-hace-que.md`, más su índice.
- **Identidades nuevas:** `revisor`, `director-contenido`, `seo`, `tiktok`, `youtube`.
- **Identidades de los renombrados:** `gabinete` y `contenido` ajustadas, con un párrafo «Mi
  historia». `community` no tenía identidad en el repositorio: se escribió nueva, con su historia.
- **Índices:** `docs/organizacion/README.md` y `oficina-agentes/README.md` (tabla de qué tiene
  cada perfil en Git y qué falta).

Decisiones propias de redacción, para que quien revise las vea:

- Las **líneas de reporte** van como PROPUESTA: el plan da áreas, no una jerarquía completa.
- Los **nombres** «Coordinador de procesos y seguimiento», «Revisor» y «Director de contenido» se
  usan como decididos, según el encargo; el plan los lista por confirmar (pendiente P2 de la spec).
- En `06-noticias.md` las líneas rojas salen del **código** (`LINEAS_ROJAS`), no del resumen del
  plan, porque no coinciden (ver «Fuera de alcance»).
- La **publicación automática de noticias** figura como decidida y **no vigente**: IA-01 sigue
  igual hasta que exista su SDD y su registro.
- En el plan maestro no se copiaron los precios de los planes de pago de Discord ni la ruta del
  código del puente; no hacen falta para ejecutar.

## VALIDACIÓN

Sobre el árbol del commit que contiene este documento.

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs` (`pnpm docs:index`) | PASÓ: índice regenerado, 584 specs |
| `node scripts/build-docs-index.mjs --check` (`pnpm docs:check`) | PASÓ |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ: «numbering: sin números repetidos» |
| `git diff --check` | PASÓ |
| Diff contra la allowlist | PASÓ: 19 archivos más este handoff, todos en la lista |
| Enlaces relativos y anclas de los 19 archivos `.md` tocados | PASÓ: 46 enlaces, 0 rotos (script propio, no versionado) |
| Datos sensibles en biblioteca e identidades (IP, llaves, montos, teléfonos, correos, identificadores de analítica, nombres de CRM o de competidores) | PASÓ: solo aparecen las cuentas públicas `@dtdcargo.ve` |
| Voseo en lo escrito | PASÓ: 0 coincidencias |
| Los 13 agentes en `07-quien-hace-que.md` | PASÓ: 13 filas |
| Prueba de referencias a migraciones en specs (`scripts/__tests__/spec-migration-refs.test.ts`) | NO EJECUTADO: el worktree no tiene `node_modules`. Sustituto: búsqueda de nombres de migración en la spec, 0 coincidencias |
| `pnpm verify` | NO EJECUTADO, no aplica: el diff es solo documentación. No hay código, migraciones, rutas ni textos del sitio; `verify` mide producto y no lee ninguno de estos archivos |
| `pnpm knowledge:status` | Corrió y dio `ok: false`, estructura `INVALID`: este worktree no tiene el grafo, que vive en el checkout principal. No lo causa este cambio. Ninguno de los archivos tocados es fuente del piloto semántico |
| Graphify, Archify y vista de Obsidian | NO EJECUTADO en este worktree; quedan para el Director desde `main` después de integrar |

No se consultó el VPS, Paperclip ni Discord.

## COMMITS

1. `e428d9104` — `chore(sdd): reserva SDD-0605 — oficina-reestructura` (stub de la reserva).
2. `4e7a608fe` — `docs(organizacion): SDD-0605 — …`: spec, organigrama, plan maestro, biblioteca,
   identidades, índices y handoff.
3. El commit que contiene este documento — `docs(sdd): SDD-0605 — …`: anota la autorización de
   Sam y el paso a PR en borrador. Solo cambia este handoff.

## PR / BRANCH

- Rama `claude/strange-jepsen-c4a225`, base `main` `49bdba2e5`, publicada en `origin` con un
  solo push.
- PR en borrador contra `main`; su número y su enlace quedan en la PR misma.
- Worktree `.claude/worktrees/strange-jepsen-c4a225`.

## PENDIENTES DE ESTA TAREA

- [x] **Autorización de Sam para publicar** la rama y abrir la PR: dada el 2026-11-05. El merge
      es del Director.
- [ ] **Que Sam confirme los tres nombres** (P2). Mientras tanto la PR queda en borrador. Si cambia alguno, se corrige en la spec, el
      organigrama, el plan maestro, `07-quien-hace-que.md` y las identidades.
- [ ] **`docs/marketing/agente-seo-noticias.md` no se tocó ni se creó:** no existe en la base de
      esta rama. Vive en la rama `claude/seo-geo-aeo-691c7b` (SDD-0604, sin fusionar). Cuando esa
      rama entre a `main`, falta alinearlo con esta SDD: los nombres «Experto en SEO, GEO y AEO»,
      «Redactor de noticias» y «Revisor», Discord en lugar de Telegram, y el camino de una noticia
      de `06-noticias.md`.
- [ ] **El índice de specs va a chocar** cuando entren la 0603 y la 0604: hoy las lista como
      huecos. Se regenera con `pnpm docs:index` después de traer `main`.
- [ ] Correr la prueba de referencias a migraciones cuando haya `node_modules`, o dejar que la
      corra el CI de la PR.

## FUERA DE ALCANCE DETECTADO

No se tocó nada de esto.

1. **`01-voz-y-atencion.md:49` cita las cuentas viejas** (`@doortudoor_`, `@doortudoor`).
   `docs/marketing/redes.md` dice que migraron a `@dtdcargo.ve` y `@dtdcargo` y que la de Instagram
   ya no existe. Los archivos nuevos usan las vigentes y `04-marketing.md` avisa cuál vale.
2. **El plan y el código no coinciden en las líneas rojas.** El plan las resume como «precios,
   plazos prometidos, nombres de terceros»; `LINEAS_ROJAS` en `lib/news/prompts.ts` dice otra cosa:
   público objetivo, lenguaje de calle, no pedir que compre menos, sensibilizar y no nombrar al
   operador. El filtro «no toca las líneas rojas» de la publicación automática necesita decir cuál
   lista aplica. Es para la SDD de las puertas del Studio.
3. **`lib/news/prompts.ts:468` promete algo que el sitio ya no hace:** le dice al modelo que la
   sección de preguntas genera el marcado de preguntas frecuentes solo. `docs/marketing/seo.md`
   registra que se retiró el 2026-07-22 y una búsqueda en `app/noticias` no lo encuentra.
4. **Quién tiene la herramienta de web no cuadra.** El plan maestro del 2026-10-20 la da a
   `contenido` y `community`; el plan del 2026-11-05 dice que solo un agente la tiene. Hay que
   mirarlo en vivo antes de dársela a los expertos.
5. **La identidad de cuatro perfiles no está en Git:** `community` (hasta este commit), `asesor`,
   `crm` y `operaciones`. Si existe en el VPS, no se versionó.
6. **Documentos de la oficina que quedan atrás de la reestructura:** `AGENTS-paperclip.md` (cubre
   cuatro puestos y limita la ola 1 a 8 agentes), `ceo/SOUL.md` y `ceo/hermes.md` (nombran al
   equipo anterior), `gabinete/hermes.md` y `contenido/hermes.md` (nombre y entregables
   anteriores), `ingenieria/SOUL.md` (sin la Vigía) y `guia-continuar-con-hermes.md` (Telegram).
   Están anotados en `oficina-agentes/README.md`.
7. **`guia-continuar-con-hermes.md` trae la IP del VPS de la oficina** en dos comandos. Es
   anterior a esta tarea.
8. **CRM:** el organigrama y `03-norte-interno.md` hablan de la transición de Kommo a
   GoHighLevel; el plan del 2026-11-05 habla de Chatwoot como CRM. Esta SDD no lo reconcilió.
9. **El «Analista de crecimiento» de la ola 2** se solapa con el Experto en SEO, GEO y AEO. El
   plan no dice qué pasa con él (P9 de la spec).
10. **`docs/marketing/README.md` no menciona** que la biblioteca de la oficina ahora lleva
    extractos de marketing (04, 05 y 06) que hay que mantener al día cuando cambie ese árbol. No se
    tocó porque es fuente del piloto semántico y no está en la allowlist.
11. **El código del puente de ALFRED no está en el repositorio.** Lo dice el plan; versionarlo es
    un pendiente aparte.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** que Sam confirme los tres nombres; con eso la PR sale de borrador y entra
  al turno de integración del Director.
- **Revisión sugerida:** las líneas de reporte (PROPUESTA), los «nunca» de cada identidad nueva y
  que ningún documento presente la reestructura como ejecutada.
- **Dependencias:** ninguna para integrar. No toca archivos de la SDD-0604 ni de los avisos del
  Studio a Discord. Choque esperado solo en `docs/specs/README.md`.
- **Sin migraciones, sin código, sin textos públicos, sin variables.** No se tocó producción, el
  VPS de la oficina, Paperclip ni Discord.
- **Publicar la biblioteca y las identidades en el VPS** es un paso aparte, con su propio encargo.
- **Reserva 0605:** las dos refs locales se pueden borrar cuando la spec esté en `main`.
- **Conocimiento:** impacto documental en `docs/organizacion/` y una spec nueva. Graphify,
  Archify y Obsidian quedan para después de integrar.
- **Ownership:** claim liberado al cerrar esta sesión de escritura. Si se retoma (por ejemplo,
  para cambiar un nombre), se reclama otra vez.
