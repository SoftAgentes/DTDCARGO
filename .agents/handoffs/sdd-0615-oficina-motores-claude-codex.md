# Handoff · SDD-0615 · ALFRED con Claude Code, el crítico con Codex y envoltorios aislados

- **Sesión:** Worker «Paperclip», abierta el 2026-11-06 por el Subdirector de SEO, GEO y AEO
  (el co-CEO) a pedido de Sam.
- **Rama:** `claude/wonderful-galileo-8a5d0b`, en el worktree
  `.claude/worktrees/wonderful-galileo-8a5d0b`.
- **Base:** `main` `60c5dc902`.
- **SDD:** 0615. Está reservada con `refs/dtd/reservations/0615` y
  `codex/sdd-reserve-0615-oficina-motores-claude-codex`, las dos solo en local.
- **Plan aprobado por Sam:**
  `C:\Users\AKX generator\.claude\plans\system-reminder-linked-sessions-now-majestic-gem.md`.
- **Resolución 3.1 enviada al co-CEO:** `paperclip-resolucion-3-1.md`, en la carpeta compartida
  de la sesión.

## Decisiones de Sam (2026-11-06)

| Tema | Decisión |
|---|---|
| ALFRED | Claude Code dentro de Paperclip, con su Max personal. El modelo lo elige después; el candidato es Fable 5.1 con `high` |
| Crítico | El Auxiliar de ALFRED, con `gpt-6-astra` y ChatGPT Plus |
| Revisor y Director de contenido | Entran los dos, con GLM |
| GLM | Sigue en Hermes |
| Riesgo de usar suscripciones | Fuera del plan |
| Revisión del plan | Pasar el plan por Codex. Se hizo; el veredicto fue «ejecutar con correcciones» y se aplicaron |

## Completado en el repositorio

| Archivo | Qué |
|---|---|
| `docs/specs/0615-oficina-motores-claude-codex/spec.md` | La SDD: decisiones, orden de instalación, la revisión de Codex con sus 14 hallazgos y qué se hizo con cada uno, y la allowlist |
| `docs/organizacion/oficina-agentes/configuracion-paperclip.md` | La guía: las pantallas, el Harness por motor, el ciclo con el crítico y las hojas de alta |
| `docs/organizacion/oficina-agentes/ceo/AGENTS-claude.md` y `CLAUDE.md` | Las instrucciones de ALFRED con Claude Code y su escritorio |
| `docs/organizacion/oficina-agentes/auxiliar/SOUL.md` y `AGENTS.md` | La identidad y las instrucciones del Auxiliar |
| `infra/oficina/envoltorios/` | `dtd-motor`, `dtd-claude`, `dtd-codex`, `dtd-agente-run`, `91-agentes-run`, el README y las pruebas con mutantes |
| `scripts/tests/oficina-envoltorios.node.mjs` | El harness, con un piso de 20 pruebas. En Linux no se salta ninguna |

## Validación

| Comprobación | Resultado |
|---|---|
| Pruebas de los envoltorios (Windows) | PASÓ: 20 pruebas, 18 corridas y 2 saltadas (enlaces y permisos, que solo corren en Linux) |
| `node --test scripts/tests/oficina-envoltorios.node.mjs` | PASÓ |
| Mutantes | PASÓ: 27 de 27 mueren. Los 2 que solo corren en Linux quedan NO EJECUTADOS |
| `docs:check` | PASÓ, con el índice regenerado |
| `sdd:check` | PASÓ. Solo aparecen los choques históricos ya conocidos |
| `git diff --check` | PASÓ |
| Búsqueda de llaves, IP y correos en los archivos nuevos | Sin coincidencias |
| `pnpm verify` | NO APLICA: no hay producto |
| Pruebas en Linux | NO EJECUTADO localmente. Las corre el CI de la PR |

## Medido en el VPS de la oficina (2026-11-06, solo lectura)

**Huellas sha256 de lo que se reemplaza** (base para comparar antes de instalar):

| Archivo | sha256 |
|---|---|
| `/usr/local/libexec/dtd-agente-run` | `cdc4372bacdce1f96a37550bdd82791d351c224a1dca3436a6dce67666c57849` (modificado el 2026-11-06 a las 15:22 UTC) |
| `/usr/local/bin/dtd-claude` | `cb2f8054dc2e0f2137c309ba0cd56bed17e5ee83c4d42e641e3f905f6819b4f6` |
| `/usr/local/bin/dtd-codex` | `e0d41ec1ca7c9d499d4ae30ebc7eabb42a0a5a7b31f92c34f8c3607ae80f1a17` |
| `/etc/sudoers.d/91-agentes-run` | `8276720e40568c94a3190c964468d778ff0d17af2ac14572400bb6000ee135cc` |

**Estado de usuarios y carpetas:**

- `agentes` está en los grupos `agentes`, `users` y `oficina`.
- `agentes-alfred` y `agentes-auxiliar` todavía no existen.
- `/srv/oficina/trabajo` es `agentes-run:oficina 2770`.
- `/srv/oficina/conocimiento` es `root:root 2755`.

**Versiones de la base:** Claude Code 2.1.304, Codex 0.163.0 y sudo 1.9.15p5.

**ALFRED en Paperclip, antes del cambio** (es la vuelta atrás):

- **Adaptador:** `hermes_local`.
- **`adapterConfig`:**
  - `hermesCommand`: `/usr/local/bin/dtd-hermes`;
  - `cwd`: `/srv/oficina/trabajo/ceo`, con `env.DTD_PERFIL=ceo`;
  - `model`: `glm-5.3`, `provider`: `zai`;
  - `timeoutSec`: 1200, `graceSec`: 20, `maxTurnsPerRun`: 60;
  - `toolsets`: `file,terminal,memory,session_search,skills,todo`;
  - `persistSession`: true, instrucciones en modo administrado.
- **`runtimeConfig`:** heartbeat apagado, `wakeOnDemand` encendido, `maxConcurrentRuns` 1.
- **Permisos:** `standard`, con asignar, contratar y crear skills encendidos.

## Pendientes de esta tarea

1. **Publicar la rama y abrir la PR.** Hace falta el OK de Sam.
2. **Instalar en el VPS de la oficina,** siguiendo el orden de la spec. Está autorizado en el
   plan, pero el diseño cambió después de la revisión de Codex con usuarios nuevos y sudoers, y
   Sam tiene que confirmarlo.
3. **Sam:** conectar el plan de Claude en Paperclip, iniciar la sesión de Codex como
   `agentes-auxiliar`, cambiar ALFRED en Harness, crear al Auxiliar y elegir el modelo.
4. **Las rutinas de ALFRED nunca corrieron.** Hay que diagnosticarlas y arreglarlas antes de
   probar el ciclo.
5. **Probar el ciclo por ramas** (paso 7 de la spec) y la pregunta de control.
6. **Borrar los temporales de esta sesión** que tienen salida cruda de la base: `tasks\bvz5si6qz.output`
   y `tasks\bikpp9f8l.output` en `%TEMP%\claude\…\6479d2c0…`.

## FUERA DE ALCANCE DETECTADO

- **El plan maestro.** Corregir §2, §7.2 y §7.5 (modelos, contrataciones por pantalla y no
  actualizar a 1023) lo hace el co-CEO en `oficina-resolucion-3-1`. Aquí no se tocó.
- **La PR #397** sigue abierta. `AGENTS-paperclip.md` no cambia en esta rama.
- **El prompt de Hermes** sigue visible con `ps`, porque viaja como argumento.
- **Datos de la base de Paperclip:**
  - la empresa Loop3D está activa sin aprobación de la Junta;
  - hay 7 agentes terminados con políticas de presupuesto huérfanas;
  - 89 instrucciones dan `INSTRUCTION_COLLECTION_UNAVAILABLE`;
  - un secreto tiene en el nombre algo que parece una llave;
  - la llave de Junta `hermes-director` está vencida y sin revocar.
- **Los agentes GLM:**
  - Hermes corre con `--yolo` y sin reglas `deny`;
  - los 7 subordinados pueden contratar y crear skills;
  - las skills de Paperclip no llegan a los perfiles de Hermes;
  - `persistSession` no guarda sesión.
- **El plan GLM Coding de Z.AI** no lista a Hermes entre sus herramientas. Sam aceptó el riesgo.

## Impacto documental

Hay documentos nuevos en `docs/organizacion/oficina-agentes/` y una SDD nueva. La biblioteca
`oficina-conocimiento/` no cambia. Graphify y Archify quedan sin correr en este worktree, para el
Director al integrar.
