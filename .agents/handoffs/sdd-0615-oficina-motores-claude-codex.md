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
| Mutantes | PASÓ: 29 de 29 mueren en Linux, en el VPS de la oficina |
| `docs:check` | PASÓ, con el índice regenerado |
| `sdd:check` | PASÓ. Solo aparecen los choques históricos ya conocidos |
| `git diff --check` | PASÓ |
| Búsqueda de llaves, IP y correos en los archivos nuevos | Sin coincidencias |
| `pnpm verify` | NO APLICA: no hay producto |
| Pruebas en Linux | PASÓ: 20, sin saltos, en el VPS de la oficina con Python 3.12.3 |

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

## Instalación en el VPS de la oficina (2026-11-06, 21:39 UTC; Sam: «Sí, instálalos»)

- **Origen y respaldo:** se instaló desde el commit `fca430685`. El respaldo está en
  `/root/respaldo-sdd-0615-20261106T213957Z`, con los cuatro archivos reemplazados y las ACL
  previas.
- **Antes de tocar nada** se comprobó que el paquete y la base viva coincidían con sus sha256.
- **Paquete del sistema:** se instaló `acl` 2.3.2-1build1.1, que no estaba. No se reinició
  ningún servicio.
- **Usuarios nuevos:** `agentes-alfred` (uid 994) y `agentes-auxiliar` (uid 993), sin el grupo
  `oficina`.
- **Carpetas:**
  - staging `ceo` y `auxiliar` con permisos 2750;
  - `trabajo/auxiliar` con git, su `AGENTS.md` y la skill `paperclip` en su `.codex/skills`;
  - `CLAUDE.md` en `trabajo/ceo`;
  - `settings.json` en `~agentes-alfred/.claude`.
- **Permisos de paso:** ACL `--x` en `trabajo` y `rwX` de `agentes-alfred` en `ceo`. `ceo`
  sigue siendo de `agentes-run`.
- **Huellas sha256 instaladas:**

  | Archivo | sha256 |
  |---|---|
  | `dtd-motor` | `948f7d64…` |
  | `dtd-agente-run` | `d8ec6a32…` |
  | `dtd-claude` | `210c507f…` |
  | `dtd-codex` | `0b3d6b03…` |
  | sudoers | `52ade946…` |
  | `settings.json` | `33ea1a45…` |

- **Comprobaciones en verde:**
  - Hermes responde con los perfiles `ceo` y `seo`;
  - Claude 2.1.304 y Codex 0.163.0 corren a través de sus envoltorios;
  - un perfil ajeno da 64;
  - `agentes-run` no entra a lo nuevo;
  - sudo registra 0 llamadas a `dtd-agente-run`;
  - Paperclip responde 200.
- **Corrida real de ALFRED con Hermes por Paperclip después de la instalación:** verificada el
  2026-11-07. El latido diario (corrida `c12ec8de`) pasó en 62 s y cerró su tarea.
- **Volver atrás:** copiar los cuatro archivos del respaldo, borrar
  `/usr/local/libexec/dtd-motor` y correr `visudo -c`. Los usuarios, las ACL y las carpetas
  nuevas no afectan a Hermes.

## Rutinas de ALFRED (F7, 2026-11-07 00:25 UTC)

- **Causa (MEDIDO):** Paperclip corría con `HEARTBEAT_SCHEDULER_ENABLED=false` en
  `~agentes/.config/paperclip/paperclip.env`. Se puso así el 2026-10-20 «hasta que existan
  agentes» (handoff `2026-10-20-sdd-0564-vps-paso-4-paperclip.md`) y nunca se levantó. Con eso
  el servicio de latidos queda en `null` y el tick de rutinas no corre. Los dos disparadores
  seguían con `next_run_at` del 21 y el 23 de octubre, `last_fired_at` vacío y 0
  `routine_runs`.
- **Antes de tocar se midió:**
  - los 8 agentes activos tienen el latido propio apagado;
  - no había corridas vivas ni en cola;
  - las dos rutinas usan `skip_missed`;
  - ALFRED tenía 2 tareas en revisión.
- **Arreglo:** la línea pasó a `true`, con respaldo
  `paperclip.env.bak-sdd0615-20261107T002534Z`, y se reinició `paperclip.service`. La salud dio
  200 a los 15 s.
- **Resultado:**
  - las dos rutinas vencidas salieron una vez cada una, `triggered: 2`;
  - el próximo latido es el 2026-11-07 a las 11:00 UTC y el próximo parte, el 2026-11-13 a las
    18:00 UTC;
  - ALFRED (Hermes) tomó las dos tareas.
- **Volver atrás:** copiar el respaldo sobre `paperclip.env` y reiniciar `paperclip.service`.

## ALFRED pasa a Claude Code (2026-11-07, 04:12–04:40 UTC)

Sam pidió «¿Puedes entrar tú y configurarlo?». Lo configuré desde su Chrome, por el túnel.

- **Conexión (cambio respecto del plan, MEDIDO):**
  - El inicio de sesión que ofrece Paperclip («ai-local-logins») deja la sesión en una carpeta
    de `agentes`. En cada corrida, Paperclip lee de ahí solo el `accessToken`, sin el
    `refreshToken`, y borra esa carpeta cuando vence el intento (`local-ai-login.js`,
    `local-ai-credentials.js`).
  - Además, `dtd-agente-run` fija `CLAUDE_CONFIG_DIR` a la casa de `agentes-alfred`.
  - **Se dejó sin conexión administrada** («Existing authentication — not managed by
    Connections»). Sam inició sesión directo como `agentes-alfred`
    (`claude auth login` con `HOME` y `CLAUDE_CONFIG_DIR` de ese usuario).
  - Resultado: `loggedIn: true`, `authMethod: claude.ai`, `subscriptionType: max`.
    `.credentials.json` es 600 de `agentes-alfred`; `agentes` y `agentes-run` no pueden
    leerlo.
- **Harness guardado** (leído en la base):
  - `claude_local`, `engine: cli`, `command: /usr/local/bin/dtd-claude`;
  - `cwd: /srv/oficina/trabajo/ceo`, `DTD_PERFIL=ceo`;
  - `claude-fable-5-1` con `effort: high`;
  - 80 vueltas, 1800 s, 20 s de gracia;
  - heartbeat apagado, wake on demand encendido, 1 corrida a la vez.
- **Pruebas:**
  - El «Run test» de Paperclip pasó. Revisa carpeta, comando y que no haya
    `ANTHROPIC_API_KEY`; se salta el «hola» porque el comando no es `claude`.
  - Una corrida directa por `dtd-claude` como `agentes` terminó con `end_turn`.
- **Instructions:** `AGENTS.md` reemplazado por el bloque de `ceo/AGENTS-claude.md` (2409
  bytes, la lista del ciclo con 5 puntos). El texto anterior quedó en el scratchpad de la
  sesión y en Revisions de Paperclip.
- **Skills:** solo `paperclip` y `paperclip-converting-plans-to-tasks`.
- **Permisos:** `standard`; asignar sí, crear agentes no, crear skills no.
- **NO VERIFICADO:** una corrida real de ALFRED con Claude dentro de Paperclip. La primera será
  la que lo despierte, o el latido de las 11:00 UTC.
- **Volver atrás:** pegar la fila de `alfred-agente-antes.json` (Hermes) en Harness y
  restaurar el `AGENTS.md` anterior desde Revisions.

## Pendientes de esta tarea

1. **Publicar la rama y abrir la PR.** Hace falta el OK de Sam.
2. **Instalación:** hecha y comprobada con una corrida real de ALFRED.
3. **ALFRED en Claude Code:** hecho el 2026-11-07 (sección anterior). Falta de Sam: iniciar la
   sesión de Codex como `agentes-auxiliar` y crear al Auxiliar (o pedirme que lo cree en
   pantalla).
4. **Rutinas de ALFRED:** arregladas el 2026-11-07 (sección anterior).
5. **Probar el ciclo por ramas** (paso 7 de la spec) y la pregunta de control.
6. **Temporales con salida cruda de la base:** borrados el 2026-11-06.

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
