---
sdd: "0615"
title: "ALFRED con Claude Code, un crítico con Codex y envoltorios aislados para los motores nuevos"
status: proposed
author: "Claude Worker «Paperclip» (Sam)"
created: 2026-11-06
updated: 2026-11-06
supersedes: null
superseded_by: null
related: ["0564", "0605", "0607", "0612"]
confidencialidad: interno
---

# SDD-0615 — ALFRED con Claude Code, un crítico con Codex y envoltorios aislados

> Cambia el motor de ALFRED, el CEO agente, de Hermes a Claude Code (`claude_local`), con el
> plan de Anthropic de Sam. Agrega al «Auxiliar de ALFRED», un crítico con Codex
> (`codex_local`) y el plan ChatGPT Plus de Sam. Los demás agentes siguen en Hermes con GLM.
> La PR trae los envoltorios que mantienen la regla de aislamiento con los dos motores nuevos,
> sus pruebas, las instrucciones y la guía de configuración de Paperclip.
>
> **No toca el producto ni producción.** La instalación en el VPS de la oficina y los cambios
> en las pantallas de Paperclip se hacen después de que Sam apruebe esta spec.

## Pedido

Sam, 2026-11-06:

- **La pregunta de partida:** cuál es la mejor manera de configurar a los agentes, empezando
  por ALFRED, porque las pantallas de Paperclip (harness, runtime, tools, skills) le hacen
  preguntas que no sabe contestar.
- **Los motores y los planes:** ALFRED con Claude Fable 5 por suscripción, con el esfuerzo
  recomendado. Un crítico, «el que contradice las tareas», con Codex o Astra. El resto de las
  subtareas, con GLM. «Que siempre sean suscripciones y no API.»
- **El flujo:** el director da instrucciones claras, el crítico discute el porqué y se las
  devuelve, el director reestructura y reenvía, y GLM ejecuta con comunicación directa con el
  director. «Al final, la decisión la toma Claude con la perspectiva que le dio Codex como su
  asesor.»
- **Dónde corre:** ALFRED con Claude Code dentro de Paperclip. El modelo se decide después.
  Sam conecta Paperclip con sus planes.

**Decisiones de Sam:**

| Tema | Decisión |
|---|---|
| Cuenta de Claude | Su Max personal |
| Crítico | `gpt-6-astra` con ChatGPT Plus |
| Revisor y Director de contenido | Entran los dos, con GLM |
| GLM | Sigue en Hermes |
| Riesgo de usar suscripciones | Fuera del alcance, por decisión de Sam |

## Contexto medido (2026-11-06, solo lectura)

- **El plan de Anthropic no se puede usar desde Hermes.** El login de Claude en Hermes solo
  gasta créditos extra pagados (`integrations/providers.md:142-148` de Hermes v0.22.2). Con
  `claude_local`, Paperclip lanza el binario oficial de Claude Code y su conexión de IA guarda un
  token de `claude setup-token` (`services/setup-token-session.js`). Ese token llega al proceso
  como `CLAUDE_CODE_OAUTH_TOKEN` (`adapter-claude-local/dist/server/acp.js:668-698`).
- **Codex inicia sesión dentro de su carpeta.** Con `codex_local`, Paperclip guarda el inicio
  de sesión de Codex en una carpeta administrada dentro de su instancia
  (`adapter-codex-local/dist/server/execute.js:405-470`).
- **Ya existen dos envoltorios mínimos.** `/usr/local/bin/dtd-claude` y `dtd-codex` son del
  2026-10-20 y solo cambian de usuario. Su rama en `/usr/local/libexec/dtd-agente-run` no pide
  perfil y comparte una sola carpeta de configuración. En `/home/agentes-run/.codex/auth.json`
  hay un inicio de sesión de Codex de ese mismo día, de dueño desconocido.
- **Los dos motores no pueden leer lo que Paperclip les pasa.** `claude_local` pasa por ruta las
  instrucciones (`--append-system-prompt-file`), las skills (`--add-dir`) y `--mcp-config`
  (`adapter-claude-local/dist/server/execute.js:615-642`). Todo eso vive en
  `/home/agentes/.paperclip`, con permisos 700, y `agentes-run` no puede leerlo. Por eso falló
  `prueba-opencode` el 2026-10-20.
- **El sudoers solo deja pasar `PAPERCLIP_*`, `DTD_PERFIL` y las variables de idioma.** El
  prompt de Hermes viaja como argumento, así que sudo lo copia al registro del sistema.
- **No hay un revisor que solo aconseje.** En Paperclip v2026.1012.0, `executionPolicy` cierra la
  tarea cuando el revisor aprueba. La tarjeta `request_confirmation` no bloquea y, con
  `continuationPolicy: wake_assignee`, despierta al dueño tanto si se acepta como si se rechaza
  (`routes/issues.ts:2555-2620` del tag).
- **Una llave de agente no puede fijar `command`, `cwd` ni `env`.** Paperclip responde con un
  403: ALFRED lo recibió a las 19:08 UTC al intentar contratar. La llave de Junta del perfil
  `director` está vencida.

## Decisión 1 — ALFRED pasa a `claude_local`

ALFRED conserva su identidad en Paperclip: el mismo id, el puente de Discord y la llave
`cce798a2`. Sam le cambia el motor en la pantalla Harness:

- `engine: cli` y `command: /usr/local/bin/dtd-claude`;
- `cwd: /srv/oficina/trabajo/ceo` y `env.DTD_PERFIL: ceo`;
- su conexión de IA es el plan de Sam;
- `effort: high`, el recomendado para Fable 5.1;
- el modelo lo elige Sam (candidato: `claude-fable-5-1`);
- límites: `maxTurnsPerRun: 80`, `timeoutSec: 1800`, `graceSec: 20`;
- `dangerouslySkipPermissions: true`, porque corre sin root y el freno está en `settings.json`;
- `chrome: false`.

El runtime queda con el heartbeat apagado, *wake on demand* encendido y una corrida a la vez.

Su identidad y lo que sabe de Sam pasan a `CLAUDE.md`, en su carpeta. Sus instrucciones de
Paperclip son las de `docs/organizacion/oficina-agentes/ceo/AGENTS-claude.md`.

El perfil `ceo` de Hermes no se borra: es la vuelta atrás. Volver es pegar en Harness el JSON
que se guarda antes del cambio.

## Decisión 2 — Auxiliar de ALFRED con `codex_local`

Lo crea Sam en la pantalla, porque una llave de agente no puede fijar los campos de aislamiento.

- **Puesto:** reporta a ALFRED.
- **Motor:** `engine: cli`, `command: /usr/local/bin/dtd-codex`,
  `cwd: /srv/oficina/trabajo/auxiliar`, `env.DTD_PERFIL: auxiliar`.
- **Modelo:** `gpt-6-astra`, con `modelReasoningEffort: high`.
- **Sandbox:** `dangerouslyBypassApprovalsAndSandbox: false` y `search: false`.
- **Permisos:** no asigna, no contrata y no crea skills.

Sam inicia sesión con su Plus dentro del usuario del Auxiliar:
`sudo -u agentes-auxiliar env CODEX_HOME=/home/agentes-auxiliar/.codex codex login --device-auth`.
Codex renueva ese inicio de sesión en el mismo lugar. No se usa la carpeta administrada de
Paperclip ni se copia ningún `auth.json`.

Su identidad y sus instrucciones están en `docs/organizacion/oficina-agentes/auxiliar/`.

## Decisión 3 — La crítica es una subtarea propia del Auxiliar

1. ALFRED escribe el documento `plan`.
2. ALFRED crea una subtarea hija, «Crítica del plan vN», asignada al Auxiliar.
   - Solo puede haber una abierta por tarea.
   - Mientras siga abierta, ALFRED no crea subtareas de trabajo.
3. El Auxiliar escribe el documento `critica` en su propia subtarea y la cierra con «sin
   objeciones mayores» u «otra vuelta: motivo».
4. Al cerrarse, ALFRED despierta con el resumen de las subtareas hijas
   (`issue_children_completed`). Decide, anota en el plan «Vuelta N» y reescribe.
   - Hace como máximo 2 vueltas.
   - Si la crítica sigue abierta en el siguiente latido, o Sam pide seguir, la cancela y lo
     anota.
5. Las subtareas de trabajo también son hijas de su tarea y despiertan a ALFRED cuando terminan
   todas.

**Por qué no hay tarjeta `request_confirmation`.** La revisión de Codex del 2026-11-06 encontró
dos problemas:

- Escribir un documento en la tarea de ALFRED exige poder modificarla, y el Auxiliar no puede
  (`routes/issues.ts:10139` y `:5297` del tag).
- Aceptar una confirmación sobre `plan` cambia la tarea de `planning` a `standard` y abre una
  sesión nueva (`issue-thread-interactions.ts:2267`).

La subtarea usa solo mecánica estándar.

Lo de marketing pasa además por el Revisor, con GLM. Lo hace en una etapa de `executionPolicy`
con `maxReviewRounds: 3`.

## Decisión 4 — Envoltorios

Los archivos están en `infra/oficina/envoltorios/`. El detalle, en su
[README](../../../infra/oficina/envoltorios/README.md).

- **Un usuario por motor de suscripción.** ALFRED corre como `agentes-alfred` y el Auxiliar como
  `agentes-auxiliar`, los dos aparte de `agentes-run`. Ningún agente GLM puede leer sus
  credenciales, su configuración ni el entorno de sus procesos. Esto corrige la gravedad ALTA
  número 3 de la revisión de Codex: separar carpetas dentro del mismo usuario no separa nada.
- **`dtd-motor`** corre como `agentes`. Hace cuatro cosas:
  1. revisa una lista cerrada que solo admite `claude:ceo`, que corre como `agentes-alfred`, y
     `codex:auxiliar`, que corre como `agentes-auxiliar`;
  2. copia a `/srv/oficina/staging/<perfil>/run.*` toda ruta que exista dentro de
     `/home/agentes/`, reescribe el argumento y sigue los enlaces. La carpeta del perfil la crea
     la instalación con dueño `agentes`, el grupo del usuario del motor y permisos 2750, y sin
     ella el envoltorio sale con 65;
  3. quita `--mcp-config` y su valor, y conserva `--strict-mcp-config`;
  4. borra las corridas de más de 3 horas y ejecuta `sudo -n -u <usuario> dtd-agente-run`.
- **`dtd-agente-run`** parte del `dtd-agente-run` vivo, medido el 2026-11-06 a las 15:22 UTC.
  - Hay una tabla cerrada de herramienta, perfil y usuario. `claude` corre solo con el perfil
    `ceo` y el usuario `agentes-alfred`; `codex`, solo con `auxiliar` y `agentes-auxiliar`.
    `hermes` y `opencode` corren solo como `agentes-run`.
  - `HOME`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME` y las carpetas XDG salen del usuario.
  - La carpeta de trabajo de Claude y de Codex la fija el envoltorio.
  - Hace `unset` de `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` y `OPENAI_API_KEY`, y solo
    Claude recibe `CLAUDE_CODE_OAUTH_TOKEN`.
  - La rama `hermes` no cambia.
- **El sudoers suma dos cosas:**
  - `CLAUDE_CODE_OAUTH_TOKEN` en `env_keep`;
  - `!log_allowed` y los dos usuarios nuevos como destino.

**Lo que no se resuelve aquí:**

- **`!log_allowed` solo evita que sudo copie el prompt al registro.** Los agentes de Hermes
  siguen recibiendo el prompt por argumento (`-q`), y cualquier usuario lo puede ver con `ps`.
  Ocultarlo pide cambiar el adaptador u ocultar los procesos (`hidepid`). Queda como pendiente
  aparte.
- **Los agentes GLM siguen compartiendo `agentes-run` entre ellos**, como hoy
  (`hermes-oficina.md` §6).
- **Codex conserva la red** dentro de su sandbox porque la necesita para hablar con Paperclip.
  No tiene búsqueda web, y su usuario no tiene nada sensible fuera de su propio inicio de
  sesión.

## Decisión 5 — Configuración de los agentes GLM

La guía es `docs/organizacion/oficina-agentes/configuracion-paperclip.md`. Para todos los
agentes GLM:

- **Despertar:** heartbeat apagado, *wake on demand* encendido y una corrida a la vez.
- **Permisos:** no contratan ni crean skills, y sí asignan.
- **Perfil de Hermes:** `disabled_toolsets` y `approvals.deny`.
- **Aprobación:** las skills nuevas, siempre; la memoria, solo en los que tienen web.
- **Versiones:** no se actualiza Paperclip a v2026.1023.0 mientras siga abierto el #18956, ni
  Hermes a 0.22.4 o más mientras siga abierto el #18314.

## Dónde vive

| Pieza | Repositorio | VPS de la oficina |
|---|---|---|
| Envoltorios y sudoers | `infra/oficina/envoltorios/` | `/usr/local/bin`, `/usr/local/libexec` y `/etc/sudoers.d` |
| Instrucciones e identidades | `docs/organizacion/oficina-agentes/{ceo,auxiliar}/` | Pantalla Instructions de Paperclip, más `CLAUDE.md` y `AGENTS.md` en cada carpeta de trabajo |
| Guía | `docs/organizacion/oficina-agentes/configuracion-paperclip.md` | — |

## Decisiones de Sam

1. **Aprobar esta spec.** Es el requisito para instalar los envoltorios en el VPS de la oficina.
2. **Elegir el modelo de ALFRED.** El candidato es Fable 5.1 con `high`.
3. **Quién pega las instrucciones:** ⭐ Sam, en la pantalla, porque así queda en el historial de
   Paperclip.

## Orden de instalación

Sigue el orden que corrigió la revisión de Codex. Si alguna comprobación queda NO VERIFICADA,
se para ahí.

1. **Preparar sin tocar a ALFRED.**
   - Crear `agentes-alfred` y `agentes-auxiliar`, cada uno con su grupo y sin el grupo
     `oficina`. La biblioteca es legible por todos, y ese grupo abre las carpetas de los GLM.
   - Crear `/srv/oficina/trabajo/auxiliar` y las carpetas de staging, que no lee `agentes-run`.
     El paso por `/srv/oficina/trabajo` y el acceso de ALFRED a `ceo` van con ACL, sin cambiar
     el dueño de `ceo`. Así la vuelta atrás a Hermes no toca permisos.
   - Instalar los envoltorios y el sudoers, con respaldo y `visudo -cf`.
   - Copiar `CLAUDE.md` y `settings.json` (que el agente no puede escribir) y la skill
     `paperclip` del Auxiliar.
2. **Comprobar el aislamiento,** sin leer valores:
   - `agentes-run` no puede abrir las carpetas de los usuarios nuevos ni ver sus procesos;
   - `--version` pasa por cada envoltorio;
   - sudo deja de registrar el prompt.
3. **Conectar los planes.**
   - Sam conecta Claude en la pantalla de conexiones de IA.
   - Se comprueba el modo de la conexión y el usuario responsable que resuelve una corrida que
     abre el puente de Discord, que entra con la identidad de agente. Si no resuelve, no se
     amplía la audiencia de la credencial: se elige el modo correcto.
   - Sam inicia sesión de Codex como `agentes-auxiliar`.
4. **Guardar la vuelta atrás completa:** `adapterType`, `adapterConfig`, `runtimeConfig`
   (incluida `aiConnection`), instrucciones, skills y sesión.
5. **Cambiar a ALFRED.** Sam lo hace en Harness y crea al Auxiliar con su hoja. Después se
   reinicia la sesión de ALFRED.
6. **Arreglar las rutinas antes de la prueba,** porque el plazo de la crítica depende del
   latido.
7. **Probar el ciclo por ramas:**
   - crítica aceptada;
   - crítica rechazada con una segunda vuelta;
   - Auxiliar sin responder;
   - hermana bloqueada;
   - reintento sin subtareas duplicadas.

   Además se comprueban tres reglas: `requireBoardApprovalForNewAgents` sigue encendido, un
   agente no puede contratar y no hay credenciales de producción en la oficina.

## Lo que no se pudo comprobar

- **El token de Claude.** No sé si la conexión de IA inyecta `CLAUDE_CODE_OAUTH_TOKEN` cuando el
  motor es `cli`: el código que leí es el de ACP. Se prueba en el paso 3 con una corrida real
  que abra Paperclip.
- **La carpeta de Codex.** No sé si `codex_local` acepta un `CODEX_HOME` que no administra o se
  niega porque no ve credenciales en la suya (`execute.js:259-265`). Se prueba en el paso 3. Si
  se niega, se fija `env.CODEX_HOME` y se mira de nuevo.
- **El sandbox de Codex.** Falta saber si funciona en ese VPS, por AppArmor y espacios de
  nombres de usuario.
- **Las reglas `deny`.** No sé si las de `settings.json` aguantan
  `--dangerously-skip-permissions`. El freno real es el usuario aparte.
- **El aviso al Revisor.** Puede no llegarle la notificación de revisión (#17474). Afecta solo a
  la etapa de marketing.
- **Las rutinas de ALFRED.** El planificador las llama (`server/dist/index.js:1369-1378`), pero
  nunca disparan. No sé por qué; se mira en el paso 6.

## Revisión de Codex (2026-11-06)

Veredicto: «ejecutar con correcciones». 14 hallazgos.

| # | Gravedad | Hallazgo | Qué se hizo |
|---|---|---|---|
| 1 | ALTA | El Auxiliar no puede escribir `critica` en la tarea de ALFRED | Crítica en una subtarea propia (Decisión 3) |
| 2 | ALTA | Aceptar la tarjeta sobre `plan` cambia el modo de la tarea | Sin tarjeta (Decisión 3) |
| 3 | ALTA | Las suscripciones quedaban al alcance de los procesos de `agentes-run` | Usuarios propios (Decisión 4) |
| 4 | ALTA | Las carpetas de credenciales fijas rompen la renovación | Una sola vía por motor: la conexión para Claude y el inicio de sesión propio para Codex. Sin copiar credenciales |
| 5 | ALTA | Saltarse los permisos y poner reglas `deny` no aísla | El freno es el usuario aparte. `settings.json` va en la configuración del usuario y no se puede escribir |
| 6 | ALTA | Codex tiene red por defecto | Se acepta, documentado: hace falta para Paperclip, va sin búsqueda y su usuario no tiene nada sensible |
| 7 | ALTA | El plazo de 2 horas no despierta a nadie | El plazo es el siguiente latido, y las rutinas se arreglan antes de la prueba |
| 8 | ALTA | El staging se pensó solo para los argumentos de Claude | Codex recibe las instrucciones por stdin y su skill se instala en su `CODEX_HOME`. Staging por perfil con grupo propio, que crea la instalación. La carpeta de trabajo la fija el envoltorio |
| 9 | MEDIA | No se comprueba el usuario responsable de la conexión | Paso 3 de la instalación |
| 10 | MEDIA | Faltan estados, idempotencia y respuestas viejas | Una crítica abierta por tarea, «Vuelta N» en el plan y subtareas de trabajo solo con la crítica cerrada |
| 11 | MEDIA | Fases en orden inverso y vuelta atrás incompleta | Orden de instalación y vuelta atrás completa (pasos 1 a 5) |
| 12 | MEDIA | La prueba no cubre las ramas | Paso 7 |
| 13 | MEDIA | Silenciar sudo no esconde el prompt de `ps` | Documentado como pendiente (Decisión 4) |
| 14 | MEDIA | Lista de agentes mal contada | Lista nominal por fase, en la guía, y el perfil se prepara antes de cada alta |

## Allowlist exacta de esta PR

- `docs/specs/0615-oficina-motores-claude-codex/spec.md`
- `docs/specs/README.md` (índice)
- `docs/organizacion/oficina-agentes/configuracion-paperclip.md`
- `docs/organizacion/oficina-agentes/ceo/AGENTS-claude.md`
- `docs/organizacion/oficina-agentes/ceo/CLAUDE.md`
- `docs/organizacion/oficina-agentes/auxiliar/SOUL.md`
- `docs/organizacion/oficina-agentes/auxiliar/AGENTS.md`
- `infra/oficina/envoltorios/{README.md,dtd-motor,dtd-claude,dtd-codex,dtd-agente-run,91-agentes-run,claude-settings.json}`
- `infra/oficina/envoltorios/tests/{test_envoltorios.py,mutantes.py}`
- `scripts/tests/oficina-envoltorios.node.mjs`
- `.agents/handoffs/sdd-0615-oficina-motores-claude-codex.md`

## Criterios de aceptación

1. Los envoltorios rechazan con 64 todo perfil o motor que no esté en la lista cerrada.
2. Ninguna ruta de `/home/agentes/` llega a `agentes-run`. Llega una copia legible por el grupo
   y no por los demás.
3. Claude y Codex nunca reciben `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` ni `OPENAI_API_KEY`.
   Solo Claude recibe `CLAUDE_CODE_OAUTH_TOKEN`.
4. Las pruebas pasan sin saltos en Linux, con un piso de 20, y todos los mutantes mueren.
5. La guía y las instrucciones no traen llaves, IP ni datos de clientes.

## Validación de esta PR

- Pruebas de los envoltorios: 20 en Linux (VPS de la oficina, Python 3.12.3), sin saltos; en Windows corren 18 y se saltan las 2 de enlaces y permisos. Mutantes: 29 de 29 mueren en Linux.
- Mutantes.
- `docs:check`, `sdd:check` y `git diff --check`.
- `pnpm verify` no aplica: no hay código de producto.

## Riesgos

- **La cuota de Astra en Plus puede no alcanzar.** Si pasa, ALFRED sigue sin crítica y lo
  anota.
- **Los bugs abiertos de Paperclip, #17474 y #9668, pueden cortar el ciclo.** Si eso pasa, la
  crítica pasa a una subtarea asignada al Auxiliar.
- **Un cambio de versión puede romper los envoltorios.** Paperclip o Claude Code podrían pasar
  nuevas rutas por argumento. `dtd-motor` copia cualquier ruta protegida, pero no las que van
  dentro de un archivo de configuración.

## Qué no autoriza

- Instalar en el VPS ni cambiar las pantallas de Paperclip. Eso viene después de aprobar.
- Crear llaves de Junta ni apagar `requireBoardApprovalForNewAgents`.
- Actualizar Paperclip o Hermes.
- Tocar producción o el VPS de producción.
- Contratar o aprobar en nombre de Sam.
