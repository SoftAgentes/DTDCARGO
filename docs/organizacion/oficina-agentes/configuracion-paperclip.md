# Cómo se configura un agente en Paperclip

Guía para Sam y para quien configure la oficina. Sale de siete investigaciones de solo lectura
del 2026-11-06 sobre Paperclip v2026.1012.0, Hermes v0.22.2, foros e issues, la base viva de
Paperclip, los planes de los proveedores y el VPS de la oficina. El plan aprobado ese día pone a
ALFRED en Claude Code, agrega un crítico en Codex y deja a los demás en GLM.

Las etiquetas indican de dónde sale cada dato:

- **[DOC]:** documentación oficial.
- **[CÓDIGO]:** leído en el código de la versión instalada.
- **[MEDIDO]:** comprobado en la oficina.
- **[PROPUESTA]:** recomendación que confirma Sam.

## 1. Cinco reglas para cualquier agente

1. **Cada cosa en un solo lugar.**
   - La identidad va en `SOUL.md` (en Claude Code, en `CLAUDE.md`).
   - Lo que le toca y lo que nunca hace va en la pantalla Instructions, en menos de 40
     líneas. La documentación pide no pegar ahí un manual genérico [DOC].
   - El escritorio y los formatos van en el archivo de contexto de su carpeta.
   - Lo que sabe la empresa va en la biblioteca.
2. **Despierta por evento, no por reloj.**
   - Heartbeat apagado y *Wake on demand* encendido.
   - Lo periódico se configura como rutina, y la rutina crea una tarea [DOC].
   - Los heartbeats frecuentes gastan modelo sin que haya trabajo (issue #3401).
3. **Mínimo privilegio en tres capas:**
   - las herramientas de Paperclip;
   - las reglas del motor (`disabled_toolsets` y `approvals.deny` en Hermes, `settings.json`
     en Claude Code, el sandbox en Codex);
   - los permisos de Paperclip.

   Ninguna capa separa de verdad a un perfil de otro, porque todos corren como el mismo
   usuario. Por eso no entra a la oficina ninguna llave de producción ni ningún dato de
   clientes.
4. **Aprender vigilado.** Pocas skills. Las nuevas solo con aprobación. Quien lee internet
   tiene la memoria con aprobación.
5. **Un cambio a la vez.** Respaldo antes, lectura después para comprobar y la pregunta de
   control «¿qué no puedes hacer nunca?». Las versiones quedan congeladas hasta que la Vigía y
   una prueba digan otra cosa.

## 2. Qué es cada pantalla

| Pantalla | Qué es | Qué se pone en la oficina |
|---|---|---|
| **Overview** | Resumen de solo lectura: último run, puesto, motor, modelo y tareas | Nada. Sirve para revisar |
| **Instructions** | El `AGENTS.md` que Paperclip le entrega en cada corrida. Administrado o externo | El texto del puesto, en menos de 40 líneas |
| **Skills** | Las skills de Paperclip asignadas al agente | Solo `paperclip` (ALFRED, además, `paperclip-converting-plans-to-tasks`) |
| **Harness / Runtime** | El motor, el comando, la carpeta, las variables, el modelo, los límites y la política de despertar | Tabla de §3 |
| **Secrets & variables** | Qué secretos de la empresa puede usar | Ninguno |
| **Tools** | Herramientas conectadas | Ninguna |
| **Channels** | Canales de chat donde participa | Ninguno: Sam habla por el puente de Discord |
| **Permissions / Trust** | Nivel de confianza y tres permisos: crear agentes, crear skills y asignar tareas | `standard`. Crear agentes y crear skills: **no** para todos. Asignar: sí, salvo el Auxiliar |
| **API Keys** | Llaves del agente. Se muestran una vez; revocar es permanente | Solo la del puente de ALFRED. No se crean llaves de Junta |

**Valores por defecto que hay que corregir** [CÓDIGO]:

- **Crear agentes y crear skills.** Un agente nuevo nace con los dos permisos encendidos. En la
  oficina se apagan.
- **`maxConcurrentRuns`.** Su valor por defecto es 20; en la oficina se pone en 1.
- **`requireBoardApprovalForNewAgents`.** Por defecto está apagado. En la oficina está
  encendido y **no se apaga nunca** [MEDIDO].

## 3. Harness / Runtime

**Regla de aislamiento.** Todo agente usa su envoltorio, con
`cwd=/srv/oficina/trabajo/<perfil>` y `env.DTD_PERFIL=<perfil>`. Una llave de agente no puede
fijar esos campos: Paperclip responde con un 403, y está bien que lo haga [CÓDIGO + MEDIDO].
Por eso los agentes los da de alta Sam en la pantalla.

**Un usuario de Linux por motor de suscripción.** ALFRED corre como `agentes-alfred` y el
Auxiliar como `agentes-auxiliar`, cada uno aparte de `agentes-run`, que usan los agentes GLM.

Así ningún agente GLM puede leer el token del plan de Sam ni ver esos procesos. Las reglas
`deny` y el sandbox no lo garantizan, porque el agente puede cambiarlos si corre con el mismo
usuario (revisión de Codex del 2026-11-06).

El envoltorio también fija la carpeta de trabajo, sin depender de lo que diga la pantalla
(`infra/oficina/envoltorios/`).

**Credenciales, cada una por una sola vía:**

- **Claude:** usa la conexión de Paperclip. Es un token de `setup-token`, dura un año, no se
  renueva solo y llega como `CLAUDE_CODE_OAUTH_TOKEN`.
- **Codex:** usa el inicio de sesión dentro de su perfil (`codex login --device-auth` como
  `agentes-auxiliar`), y Codex lo renueva en el mismo lugar.

No se mezclan las dos vías ni se copian archivos de credenciales.

**Red de Codex:** con su sandbox, Codex conserva la red, porque la necesita para hablar con
Paperclip. No tiene búsqueda web ni nada sensible en su usuario.

| Campo | ALFRED (`claude_local`) | Auxiliar (`codex_local`) | GLM (`hermes_local`) |
|---|---|---|---|
| Motor | Claude Code, `engine: cli` | Codex, `engine: cli` | Hermes |
| Comando | `/usr/local/bin/dtd-claude` | `/usr/local/bin/dtd-codex` | `/usr/local/bin/dtd-hermes` (`hermesCommand`) |
| Carpeta en Paperclip (`cwd`) | `/srv/oficina/trabajo/ceo` | `/srv/oficina/trabajo/auxiliar` | `/srv/oficina/trabajo/<perfil>` |
| Carpeta donde trabaja el motor | `/srv/oficina/motores/ceo` (la fija `dtd-agente-run`) | `/srv/oficina/motores/auxiliar` (la fija `dtd-agente-run`) | La misma del `cwd` |
| Variables | `DTD_PERFIL=ceo` | `DTD_PERFIL=auxiliar` | `DTD_PERFIL=<perfil>` |
| Modelo | Lo elige Sam. El candidato es `claude-fable-5-1` | `gpt-6-astra` | `glm-5.3`, proveedor `zai` |
| Esfuerzo | `effort: high`, el recomendado para Fable 5.1 [DOC] | `modelReasoningEffort: high` | — |
| Herramientas | `dangerouslySkipPermissions: true` (sin root), con freno en `settings.json`. `chrome: false` | `dangerouslyBypassApprovalsAndSandbox: false`, `search: false` | `file,terminal,memory,session_search,skills,todo`, con `web` solo donde corresponde |
| Límites | `maxTurnsPerRun: 80`, `timeoutSec: 1800`, `graceSec: 20` | `timeoutSec: 1800`, `graceSec: 20` | `maxTurnsPerRun: 60`, `timeoutSec: 1200`, `graceSec: 20` |
| Sesión | Se retoma sola [DOC] | Se retoma sola | `persistSession: true` (ojo: hoy no queda guardada [MEDIDO]) |
| Plan | Anthropic de Sam, conectado en Paperclip | ChatGPT Plus de Sam, con inicio de sesión dentro del perfil | GLM |
| Runtime | Heartbeat apagado, *wake on demand* encendido, 1 corrida a la vez | Igual | Igual |

**Por qué cada valor:**

- **Heartbeat.** Un CEO con heartbeat crea tareas sin fin (issue #3307) y gasta en vacío
  (#3401). El latido diario y el parte del viernes van como rutinas.
- **Timeout.** Fable hace turnos largos. Con 1.800 s alcanza; el valor por defecto de Hermes
  es igual.
- **Paperclip le pasa a Hermes `-m` y `--provider` en cada corrida** [CÓDIGO]. Por eso el
  modelo se cambia en esta pantalla y no solo en el perfil de Hermes.
- **Paperclip no mide el gasto de Hermes** [MEDIDO]. Sus topes en dólares no frenan nada; el
  freno real es la cuota de cada plan.

## 4. El ciclo de ALFRED con el crítico

Paperclip no tiene un revisor que solo aconseje [CÓDIGO]:

- **`executionPolicy` no sirve:** cierra la tarea cuando el revisor aprueba.
- **La tarjeta `request_confirmation` tampoco:** el Auxiliar no podría escribir en la tarea de
  ALFRED. Además, aceptarla sobre el documento `plan` cambia el modo de la tarea
  (`issue-thread-interactions.ts:2267`, revisión de Codex del 2026-11-06).

Por eso la crítica es **una subtarea propia del Auxiliar**:

1. ALFRED escribe el documento `plan` de su tarea.
2. Crea una subtarea hija «Crítica del plan vN», asignada al Auxiliar. Solo puede haber una
   abierta por tarea, y mientras siga abierta no se crean subtareas de trabajo.
3. El Auxiliar escribe el documento `critica` **en su subtarea** y la cierra con «sin
   objeciones mayores» u «otra vuelta: motivo».
4. Al cerrarse la última subtarea abierta, ALFRED despierta con su resumen
   (`issue_children_completed`) [CÓDIGO]. Decide, anota en el plan «Vuelta N: qué tomó y qué
   no» y reescribe.
   - Hace como máximo 2 vueltas.
   - Si la crítica sigue abierta en el siguiente latido, o Sam pide seguir, la cancela y lo
     anota.
   - Por eso el latido diario tiene que funcionar antes de estrenar el ciclo.
5. ALFRED crea las subtareas de trabajo, hijas de su tarea, para los agentes GLM.
   - Cuando terminan todas, despierta con el resumen.
   - Si una se bloquea, lo despierta un comentario [CÓDIGO].
   - Las menciones con @ no despiertan a nadie [DOC].
6. Las entregas de marketing llevan una etapa de revisión del Revisor (`executionPolicy`,
   `maxReviewRounds: 3`).

**Bug abierto que se prueba antes de confiar en el ciclo:** la tarea padre no despierta si una
hermana queda bloqueada (#9668). La prueba cubre por separado cuatro ramas:

- la crítica aceptada;
- la crítica rechazada con segunda vuelta;
- el silencio del Auxiliar;
- una hermana bloqueada.

## 5. Hojas de alta (las llena Sam en la pantalla)

Se aprueba solo si cada campo coincide. Si algo no coincide, se rechaza.

**Runner (desde Paperclip 1106).** Los agentes nuevos de Claude, Codex, OpenCode y Pi nacen en el
Paperclip Runner, y el VPS califica.

- **Por qué no sirve:** el Runner no pasa por `dtd-claude` ni por `dtd-codex`. Correría como
  `agentes`, sin el aislamiento por usuario.
- **En cada alta de Claude o Codex** se elige **Legacy runner** en Advanced.
- **Nunca se presiona «Upgrade runner»** en ALFRED, en el Auxiliar ni en otro agente con
  envoltorio.
- **Los GLM (Hermes) no cambian:** el Runner no los toca.

El detalle está en `actualizacion-paperclip-hermes.md`, §2.3.

### ALFRED: cambio de motor

Antes de empezar se guarda el JSON actual, para poder volver a Hermes.

- **Harness:**
  - motor: Claude Code;
  - runner: **Legacy runner**, en Advanced (desde Paperclip 1106; ver la regla de arriba);
  - `engine`: `cli`;
  - comando: `/usr/local/bin/dtd-claude`;
  - carpeta: `/srv/oficina/trabajo/ceo`;
  - variable `DTD_PERFIL`: `ceo`;
  - conexión de IA: el plan de Anthropic de Sam;
  - modelo: el que elija Sam;
  - `effort`: `high`;
  - `maxTurnsPerRun`: 80, `timeoutSec`: 1800, `graceSec`: 20;
  - `dangerouslySkipPermissions`: sí;
  - `chrome`: no.
- **Runtime:** heartbeat apagado, *wake on demand* encendido, 1 corrida a la vez.
- **Skills:** `paperclip` y `paperclip-converting-plans-to-tasks`.
- **Permisos:** asignar sí, crear agentes no, crear skills no.
- **Instructions:** el bloque de [`ceo/AGENTS-claude.md`](ceo/AGENTS-claude.md).

### Auxiliar de ALFRED (nuevo)

- **Puesto:**
  - nombre: Auxiliar de ALFRED;
  - rol: `general`;
  - reporta a ALFRED.
- **Harness:**
  - motor: Codex;
  - runner: **Legacy runner**, en Advanced (desde Paperclip 1106);
  - `engine`: `cli`;
  - comando: `/usr/local/bin/dtd-codex`;
  - carpeta: `/srv/oficina/trabajo/auxiliar`;
  - variable `DTD_PERFIL`: `auxiliar`;
  - modelo: `gpt-6-astra`;
  - `modelReasoningEffort`: `high`;
  - `dangerouslyBypassApprovalsAndSandbox`: no;
  - `search`: no.
- **Runtime:** igual que ALFRED.
- **Skills:** `paperclip`.
- **Permisos:** asignar no, crear agentes no, crear skills no.
- **Instructions:** el bloque de [`auxiliar/AGENTS.md`](auxiliar/AGENTS.md).

**Cómo se dio de alta (2026-11-07, MEDIDO):**

1. **El alta empieza con Hermes.** El asistente de alta de Codex obliga a conectar OpenAI en la
   carpeta de Paperclip. Por eso el agente se crea con el tipo Hermes, que no pide conexión.
2. **Primero se aprueba.** Paperclip no deja guardar la configuración mientras el alta espera
   aprobación.
3. **Después se pasa a Codex** en Harness, con «Existing authentication»: la sesión de Codex
   de Sam vive en `/home/agentes-auxiliar/.codex`, en archivo y con permisos 600.
4. **El agente lleva una segunda variable,
   `CODEX_HOME=/srv/oficina/staging/auxiliar/codex-home-paperclip`.**
   - Sin un `CODEX_HOME` propio, Paperclip exige credenciales en su carpeta administrada y no
     arranca (`configuration incomplete`).
   - Con uno externo no revisa nada. Escribe ahí su `config.toml` y sus skills como `agentes`.
   - El envoltorio descarta esa variable y Codex usa la casa de `agentes-auxiliar`.
5. **«Can assign tasks» sigue encendido en la pantalla** por la opción general de la
   organización. En la base del agente queda en `false`.

### Revisor, Director de contenido y SEO (GLM)

- **Harness:**
  - motor: Hermes;
  - `hermesCommand`: `/usr/local/bin/dtd-hermes`;
  - carpeta: `/srv/oficina/trabajo/<perfil>`;
  - variable `DTD_PERFIL`: el perfil (`revisor`, `director-contenido` o `seo`);
  - modelo: `glm-5.3`, proveedor `zai`;
  - `persistSession`: sí;
  - `timeoutSec`: 1200, `graceSec`: 20, `maxTurnsPerRun`: 60;
  - herramientas: `file,terminal,memory,session_search,skills,todo`, más `,web` solo en `seo`.
- **Runtime:** heartbeat apagado, *wake on demand* encendido, 1 corrida a la vez.
- **Reporta a:**
  - Revisor: ALFRED;
  - Director de contenido: ALFRED;
  - SEO: el Director de contenido.
- **Skills:** `paperclip`.
- **Permisos:** asignar sí, salvo el Revisor; crear agentes no; crear skills no.
- **Instructions:** la parte común más el bloque del puesto de `AGENTS-paperclip.md` (PR #397).

## 6. Lo que no se hace

- Apagar `requireBoardApprovalForNewAgents`.
- Fijar `command`, `cwd` o `env` por la API.
- Crear llaves de Junta.
- **Actualizar Paperclip o Hermes sin seguir `actualizacion-paperclip-hermes.md`.** Esta regla
  reemplaza a las anteriores, que prohibían Paperclip 1023 o más y Hermes 0.22.4 o más.
  - Hermes 0.23.0 ya está instalado desde el 2026-11-07. El #18314 no frena, porque no hay
    sesiones guardadas.
  - Paperclip 1106 va solo con los cambios A, B y C hechos, con su §6 cumplido el mismo día y con
    el OK de Sam.
- Encender el corte duro de un presupuesto mientras siga abierto el #18956.
- Presionar «Upgrade runner» en un agente con envoltorio.
- Poner llaves de producción o datos de clientes en la oficina.
- Aprobar o contratar en nombre de Sam.
