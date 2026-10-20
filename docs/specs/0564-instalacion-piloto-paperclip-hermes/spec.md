---
sdd: "0564"
title: "Instalación piloto de Paperclip y Hermes en un VPS aislado"
status: approved
author: "Claude Worker «Oficina Paperclip» (Sam)"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0020", "0505", "0541"]
confidencialidad: interno
---

# SDD-0564 — Instalación piloto de Paperclip y Hermes en un VPS aislado

> Cómo se instala la oficina de agentes del organigrama
> ([`docs/organizacion/organigrama-paperclip.md`](../../organizacion/organigrama-paperclip.md))
> en un VPS nuevo de Contabo, **separado del servidor de DTD Cargo**, para la ola 1: el CEO
> agente y tres agentes que solo leen y redactan. Esta SDD **no instala nada**. Describe la
> máquina, el aislamiento, la configuración, los topes de gasto, la evidencia y la aceptación.
> La instalación se ejecuta después, paso por paso, con el OK de Sam.

## Pedido de Sam

- 2026-10-19, después de comprar el VPS: «Sí, arranca la SDD de instalación de Paperclip y
  Hermes en el VPS nuevo: pídele el número al Director y escríbela. Todavía no instales nada.»
- 2026-10-19: «Recuerda desactivar la telemetría de […] paperclip. En el tema de la
  seguridad, recuerda que hay una parte […] en la que me recomendaste instalar algo para tener
  más seguridad. Recuerda tener esos temas de seguridad y pendientes.» Lo que se recomendó
  instalar es **Tailscale** (§D2).

- 2026-10-19, respuestas a las preguntas del organigrama (literal, extractos): modelos —
  «Z.AI, que es un GLM. Suscripción mensual que está activa: ahí vamos a poner a Hermes a
  trabajar con GLM y Paperclip. Podemos arrancarlo con Claude, pero realmente van a trabajar
  con GLM»; máquina — «ya compré el VPS en Contabo […] ¿No sé si ponemos a Hermes y a
  Paperclip en el mismo Docker? Tienes que decirme qué es mejor aquí»; adaptadores — «vamos a
  conectar Claude Code, Codex y también GLM, pero principalmente GLM»; personas — «Ahora solo
  voy a entrar yo, que soy el owner»; datos — «En Paperclip no importa que haya datos
  personales y montos por cliente […] Mientras mantengamos el tema de la seguridad»; parte —
  «por Telegram y correo solamente cuando sea necesario»; agentes — «La creación de agente la
  puede hacer el CEO»; CRM — «Ahorita vamos a tratar de que funcione Kommo».

Número asignado por el Director el 2026-10-19 («Te asigno la 0564»), con estas condiciones,
que esta SDD cumple: es otro servidor; por defecto ningún acceso a la base de producción, a
GitHub ni a claves, y cada acceso propuesto se nombra, se justifica y lo aprueba Sam; los
secretos nunca van al repo; si se leen datos de clientes pasa por `revisar-datos-ve`; el costo
de modelos tiene tope.

## Contexto

- **Organigrama** (PR #285, borrador): Junta (Sam), CEO agente, cinco direcciones y dos áreas
  de apoyo. Ola 1 = CEO, Jefe de gabinete, Puente de ingeniería y Editor de contenido, solo
  lectura, 4 semanas. Regla de datos: «Paperclip ve el tablero, no al cliente».
- **Paperclip** (`paperclipai/paperclip`, MIT; última versión vista `v2026.1012.0`): servidor
  Node 24 con PostgreSQL embebido. Riesgos verificados en su documentación el 2026-10-19:
  - el adaptador de Claude Code salta permisos por defecto, también en los MCP;
  - la aprobación de gasto es solo una instrucción al agente; lo único que el sistema hace
    cumplir es el tope de presupuesto;
  - telemetría encendida por defecto;
  - fallas graves ya corregidas, entre ellas CVE-2026-41208 (corregida en 2026.416.0).
- **Hermes Agent** (Nous Research, MIT; versión 0.22.2 del 2026-10-15): agente en Python con
  memoria y mensajería. Paperclip lo trae de fábrica: `hermes_local`, en la misma máquina, y
  `hermes_gateway`, por HTTP. Por defecto ejecuta comandos en la máquina sin aislamiento y con
  todas sus herramientas; su guía de seguridad recomienda el backend Docker y no correr como
  root.
- **El VPS:** Sam lo compró el 2026-10-19 siguiendo la §5.9 del organigrama (Contabo Cloud VPS
  6 en US East). Plan, región, disco e IP exactos: **NO VERIFICADO**; se anotan en la evidencia
  del paso 1. Es una máquina distinta del servidor de DTD Cargo (`217.216.54.70`).

## Alcance

**Entra:** endurecer el VPS nuevo; instalar Paperclip y Hermes con versiones fijadas; crear la
empresa «DTD Cargo» en Paperclip con la ola 1; topes de gasto; evidencia; criterios para
terminar el piloto.

**No entra:** tocar el servidor de DTD Cargo, su base, su `.env` o su red; acceso a GitHub con
escritura; el CRM (Kommo o GoHighLevel); datos de clientes; la ola 2 (necesita su propia SDD
para un tablero de indicadores agregados); mensajería de Hermes hacia clientes; cambiar
`AGENTS.md` o el runbook de ingeniería.

## Diseño

### D1 · Matriz de accesos: por defecto, ninguno

| Acceso | Por defecto | Propuesta | Decide |
|---|---|---|---|
| Base de producción de DTD Cargo (Supabase del servidor propio) | **No** | No. Ni lectura | — |
| Servidor de DTD Cargo (SSH, Docker, `.env`) | **No** | No. El VPS nuevo no guarda llaves SSH hacia él | — |
| Supabase Cloud (copia congelada) | **No** | No | — |
| GitHub | **No** | **A1:** llave de despliegue de **solo lectura** de este repositorio, para que los agentes lean una copia del código y la documentación. Sin escritura, sin `gh`, sin PAT. **Transferencia (Director, 2026-10-19):** con A1 y el motor GLM (A2-b), **todo el contenido del repositorio que lean los agentes es dato que viaja a Z.AI**, incluidos los nombres de titulares de la migración `0204` y los handoffs; se declara como transferencia a un tercero. Es otra razón a favor de A1-b. **Consideración (Director, 2026-10-19):** el repositorio trae handoffs con detalles operativos (IP y rutas del servidor de DTD Cargo, procedimientos de producción), aunque no secretos; si el VPS se compromete, esa copia queda expuesta, y una llave de despliegue da acceso al repositorio entero. **Alternativa A1-b:** una copia filtrada, solo `docs/` y el código, sin `.agents/handoffs/`, que Sam sube a mano (`git archive`) cada semana | Sam |
| Claves del ERP (service role, Resend, Telegram del ERP, Kommo, SeaRates) | **No** | No | — |
| Proveedor de modelos | **No** | **A2 (decidida):** llave **nueva y exclusiva** de Anthropic para el arranque, con límite en su consola. **A2-b (decidida, motor principal):** la suscripción activa de **Z.AI (GLM)** de Sam, con una llave de Z.AI solo para esta máquina. Codex: una cuenta o llave propia para el VPS, nunca el inicio de sesión de ChatGPT de Sam con su correo conectado | Sam |
| CRM, MCP o conectores con datos de clientes | **No** en la instalación | **A4 (pendiente):** conexión a Kommo, porque Sam decidió que los agentes trabajen primero con Kommo y que puedan ver datos de clientes. Se hace **después** de la instalación, con `revisar-datos-ve`, su propia SDD y la política de privacidad corregida. Hasta entonces, ningún MCP ni conector con datos de clientes (riesgo R11) | Sam |
| Mensajería de Hermes (Telegram, WhatsApp…) | **No** | **A3 (aprobada el 2026-10-19):** un bot de Telegram **nuevo** y correo solo cuando haga falta, para que Sam reciba el parte y hable con el CEO; lista de usuarios permitidos = Sam. Nunca el bot del ERP (`@dtdcargobot`) ni WhatsApp | Sam |
| Internet de salida | Sí | Solo lo que necesitan los modelos y la instalación; el Editor de contenido puede leer la web pública | — |

Cada acceso de la columna «Propuesta» se activa solo con un OK de Sam que lo nombre.

### D2 · La máquina

1. **Sistema:** Ubuntu 24.04 limpio. No se usan las imágenes de un clic «Paperclip Server» ni
   «Hermes Agent Server» de Contabo: instalan una versión y una configuración que no
   controlamos.
2. **Tailscale** (lo que Sam recordó como «instalar algo para tener más seguridad»): una red
   privada entre el VPS y los equipos de Sam. El panel de Paperclip y el SSH solo responden
   dentro de esa red.
3. **Cortafuegos (`ufw`):** entrada denegada por defecto; solo la interfaz de Tailscale. El SSH
   público se cierra después de comprobar que el SSH por Tailscale funciona.
4. **SSH:** solo con llave; sin contraseña; sin `root`. Usuario de administración propio.
5. **Usuario `agentes`** sin `sudo`, dueño de Paperclip y de Hermes. Ninguno corre como root
   (Paperclip lo exige y Hermes lo recomienda).
6. **Docker** para el backend aislado de Hermes.

   **¿Hermes y Paperclip en el mismo Docker?** Sam lo preguntó el 2026-10-19. Recomendación:
   **misma máquina, pero no el mismo contenedor.**

   | Opción | Cómo queda | Veredicto |
   |---|---|---|
   | ⭐ **A · Paperclip como servicio del sistema y Hermes llamado por `hermes_local`**, con los comandos de Hermes dentro de un contenedor Docker (su «backend Docker») | Es el camino que documentan los dos proyectos. Lo que ejecutan los agentes queda encerrado en Docker y no toca la máquina | Para la ola 1: menos piezas, menos cosas que fallen |
   | B · Paperclip y Hermes cada uno en su propio contenedor, unidos por `hermes_gateway` en una red interna | Mejor separación: si Hermes se compromete, no ve la llave maestra de Paperclip | Para la ola 2, si el piloto crece. `hermes_gateway` fuera de `localhost` exige HTTPS, Tailscale o VPN: hay que probarlo |
   | C · Los dos dentro de **un solo** contenedor | Una falla en uno expone al otro y se pierde la ventaja de Docker | **No** |
7. **Actualizaciones de seguridad automáticas** del sistema (`unattended-upgrades`).
   Paperclip y Hermes **no** se actualizan solos: versión fijada y actualización a mano
   después de leer sus avisos de seguridad.
8. **Fail2ban** o equivalente sobre el SSH mientras siga abierto en la IP pública.
9. **Respaldo:** el automático de Contabo (se eligió al comprar, **NO VERIFICADO**), un
   snapshot antes de cada actualización y una copia cifrada de la llave maestra de Paperclip
   (`secrets/master.key`) en el gestor de contraseñas de Sam, fuera de la máquina.
10. **Medición del día 1:** disco y CPU antes de instalar nada, como en el runbook del servidor
    propio (§1.2), porque Contabo entrega nodos muy distintos. Si el resultado es malo, se pide
    otro nodo dentro de los primeros días.

### D3 · Paperclip

| Ajuste | Valor |
|---|---|
| Versión | Fijada en una versión ≥ 2026.416.0, la más reciente estable al instalar; se anota en la evidencia |
| Modo | `authenticated` + `private`, escuchando solo en la interfaz de Tailscale. Nunca `local_trusted` ni `public` |
| **Telemetría** | **Apagada**: `PAPERCLIP_TELEMETRY_DISABLED=1` y `DO_NOT_TRACK=1` en el servicio. Se comprueba en la evidencia |
| Base | PostgreSQL embebido |
| Personas | Solo Sam, como Owner. Nadie más en la ola 1 salvo decisión de Sam |
| Auditoría | El permiso para ver detalles de los agentes, solo para Sam |
| Empresa | «DTD Cargo», con la meta interna de 2 contenedores al mes |
| Latidos | Solo el CEO: diario a las 11:00 UTC (7:00 en Caracas) y el parte del viernes. Los demás despiertan solo al asignarles algo. Una ejecución a la vez |

### D4 · Hermes

| Ajuste | Valor |
|---|---|
| Versión | Fijada en la 0.22.x vigente al instalar (≥ 0.22.2); se anota en la evidencia |
| Backend de comandos | **Docker**, nunca `local` |
| Herramientas | Recortadas: archivos y web. Sin terminal en el host ni navegador en la ola 1 |
| Servidor de API (puerto 8642) | Solo en `127.0.0.1` y con clave, o apagado si se usa `hermes_local` |
| Mensajería | Apagada salvo A3 |
| Uso en la ola 1 | **D-H (decidida):** motor del Editor de contenido a través de `hermes_local` |
| Modelo | GLM por la suscripción de Z.AI (A2-b); Claude solo si GLM no alcanza |

### D5 · Agentes de la ola 1

| Agente | Adaptador | Permisos | Latido |
|---|---|---|---|
| CEO | Claude Code (`claude_local`) con `dangerouslySkipPermissions: false` | Lee la copia del repositorio; escribe solo en Paperclip | Diario + viernes |
| Jefe de gabinete | Claude Code, salto apagado | Igual | Al asignarle algo |
| Puente de ingeniería | Claude Code, salto apagado | Igual; lee la salida de `director-status` que Sam le pase | Al asignarle algo |
| Editor de contenido | Hermes (`hermes_local`) o Claude Code, según D-H | Lee la copia del repositorio y la web pública | Al asignarle algo |

**Modelos y adaptadores (decisión de Sam: «principalmente GLM»):**

- **GLM a través de Claude Code:** Z.AI publica la conexión. Se apunta Claude Code a
  `https://api.z.ai/api/anthropic` con la llave de Z.AI, y los modelos `glm-5.3` y
  `glm-5.3-flash` ocupan los lugares de Claude (documentación de Z.AI, consultada el
  2026-10-19). Así se usa el mismo adaptador `claude_local`, con el salto de permisos
  apagado.
- **Claude** con la llave A2, solo para arrancar o comparar.
- **Codex** (`codex_local`) solo con `dangerouslyBypassApprovalsAndSandbox` apagado y con su
  propia cuenta en el VPS. Si no se puede apagar en la versión instalada, Codex no entra en
  la ola 1.
- **Hermes** con GLM, igual que arriba.

**El CEO crea agentes (decisión de Sam).** Se le da el permiso de crear agentes, con estos
límites: cada agente nuevo hereda las reglas de la §4.3 del organigrama; nadie recibe
accesos nuevos de la tabla D1 sin OK de Sam; el tope de la empresa no cambia; como máximo 8
agentes activos en la ola 1; y cada alta aparece en el parte del viernes con su motivo.

Ningún agente escribe en el repositorio, abre PRs, lanza sesiones de ingeniería ni escribe
hacia afuera. Sus instrucciones (`AGENTS.md` de cada agente en Paperclip) copian las reglas
de la §4.3 del organigrama. Son instrucciones, no candados: los candados reales son D1 y D2.

### D6 · Topes de gasto

- **Tope de la empresa en Paperclip con parada dura:** 100 USD al mes (**D-B**, decidido por Sam el 2026-10-19).
- **GLM por suscripción:** el costo es fijo y sus límites son los del plan de Z.AI. Paperclip
  puede calcular un costo «teórico» por tokens que no coincida con lo que se paga
  (**NO VERIFICADO** cómo lo registra); el parte del viernes reporta el uso del plan aparte.
  El tope de 100 USD protege lo que se paga por uso (Anthropic y Codex).
- **Topes por agente:** CEO 40 USD; Jefe de gabinete, Puente de ingeniería y Editor de
  contenido 20 USD cada uno.
- **Límite en la consola del proveedor** de la llave A2, igual o menor al de la empresa. Así,
  aunque un agente se salte Paperclip, el proveedor corta.
- El CEO reporta el gasto en el parte del viernes; al 80 % lo avisa. Subir un tope es siempre
  una decisión de Sam.

### D7 · Secretos

Nunca en el repositorio, en el chat ni en un PR. Viven en la máquina (`~/.paperclip/…`,
`~/.hermes/.env` con permisos 600) y en el gestor de contraseñas de Sam. La evidencia los
nombra por variable y huella corta, nunca por valor.

### D8 · Datos personales

Sam decidió el 2026-10-19 que los agentes **pueden** ver datos personales y montos por
cliente cuando la tarea lo pida. La instalación de esta SDD no conecta todavía ninguna
fuente con datos de clientes, así que `revisar-datos-ve` no aplica a estos pasos. **Antes**
de la conexión a Kommo (A4) o a cualquier otra fuente: se corre la skill sobre esa conexión,
se corrige la política de privacidad (hoy dice que los datos se tratan en Venezuela), se
declara la transferencia a Z.AI y a Anthropic (también la del contenido del repositorio, ver
A1 en §D1), y responder a un cliente queda como I4 de
IA-01 (prepara el agente, aprueba o envía una persona).

### D9 · Orden de ejecución, cada paso con OK de Sam

1. Ficha del VPS (plan, región, disco, IP, respaldo) y medición del día 1.
2. Endurecer: usuario, SSH, Tailscale, cortafuegos, actualizaciones automáticas, fail2ban.
3. Docker y usuario `agentes`.
4. Paperclip fijado, telemetría apagada, modo privado; Sam crea su cuenta de Owner.
5. Hermes fijado, backend Docker, herramientas recortadas.
6. Llave A2 con límite en el proveedor; topes en Paperclip.
7. Acceso al repositorio según A1.
8. Empresa, meta y los cuatro agentes; primera estrategia del CEO, que Sam aprueba.
9. Cuatro semanas de piloto; parte cada viernes.

### D10 · Cambio de A2: suscripciones en vez de llaves de API (2026-10-20)

**Decisión de Sam, con sus literales:**

1. Arranque del paso 6: «Sí, arranca el paso 6 de la SDD-0564: guíame para crear y cargar yo mismo
   las llaves de Z.AI (GLM) y de Anthropic con límite, y configura los topes de gasto.»
2. «Ahora sí vamos a trabajar con Claude Code, prefiero que sea con la suscripción y no con la API.»
3. «Quiero conectar OpenAI. Ábreme lo mismo que hicimos ahorita con la suscripción. Tengo OpenAI.»
4. «Por ahora solo Codex; Claude lo conecto después.»

**Qué cambia:**

| Antes | Ahora |
|---|---|
| A2: llave nueva de Anthropic con límite en su consola | **Suscripciones**: Codex con la cuenta de ChatGPT de Sam (conectado el 2026-10-20) y Claude Code con la suscripción de Sam (pendiente de que inicie sesión) |
| A2-b: GLM de Z.AI como motor principal | **En suspenso.** Z.AI responde con el error 1113 con dos llaves del plan válido de Sam; su FAQ dice que el plan solo vale en herramientas soportadas. Se retoma cuando Sam sepa cómo lo usa su amigo. No se disfraza a Hermes de otra herramienta |
| §D1: «Codex: una cuenta o llave propia para el VPS, **nunca** el inicio de sesión de ChatGPT de Sam con su correo conectado» | **Sam lo cambió a sabiendas** el 2026-10-20 al pedir conectar «lo mismo» con su suscripción. Se le advirtió del aviso GHSA-gqqj-85qm-8qhf (Codex heredaba los conectores de ChatGPT, como Gmail) y se le recomendó revisar los conectores de su cuenta |

**Riesgo que se acepta y queda escrito:**

- El archivo de sesión de Codex (`~agentes/.paperclip/instances/default/ai-local-logins/<id>/auth.json`),
  y después el de Claude, **no es una llave de API con tope: es la sesión de la cuenta personal
  de Sam**.
- Un agente que pueda leer ese archivo y tenga salida a internet puede llevársela.
- Un error de un agente gasta del plan personal de Sam, no de un presupuesto aparte. El límite
  real es el del plan de cada suscripción; **NO VERIFICADO** cómo cuenta Paperclip el costo de una
  suscripción contra su tope.

**Transferencias con A1 activo.** Antes, el contenido del repositorio iba a Z.AI. Ahora el que
leen los agentes viaja a **OpenAI** (Codex, con la suscripción de Sam) y, cuando se conecte, a
**Anthropic** (Claude Code). Eso incluye los handoffs con detalles del servidor de DTD y los nombres
de titulares de la migración `0204`. La alternativa A1-b, la copia filtrada sin `.agents/handoffs/`,
sigue disponible si Sam la prefiere.

**Verificación del aislamiento (2026-10-20, solo lectura, código de Hermes v0.22.2 y estado del VPS):**

| Comprobación | Resultado |
|---|---|
| Montajes del Docker de Hermes | Solo monta en solo lectura archivos de credenciales **relativos a `~/.hermes`**; rechaza rutas absolutas y salidas hacia arriba (`tools/credential_files.py`) y **nunca** monta sus propios almacenes (`.env`, `auth.json`, `mcp-tokens/`). No puede ver `~agentes/.codex`, `~agentes/.claude`, `~agentes/.paperclip` ni `~agentes/.config/paperclip`. `docker_mount_cwd_to_workspace: false`; ninguna `docker_forward_env` configurada |
| Herramienta `file` de Hermes | Opera **dentro del contenedor**: usa el mismo entorno configurado que la terminal (`tools/file_tools.py`, `_create_terminal_env_for_file_ops`), con Docker sin privilegios |
| Codex con el sandbox y el bypass apagado | **NO VERIFICABLE todavía**: aún no hay agentes. Se fija al crearlos (paso 8) y se comprueba en su configuración |
| **Hueco encontrado** | Codex y Claude Code corren **en la máquina** como el usuario `agentes`, que también es dueño de los secretos de Paperclip (`paperclip.env`, `master.key`), de la sesión de la suscripción de Sam y de las llaves en `~/.config/llaves/`. Con el sandbox de Codex encendido, la escritura y la red quedan limitadas, pero **la lectura de esos archivos no**. **No se avanza al paso 8** hasta que Sam decida cómo cerrarlo |

**Opciones para cerrar el hueco** (para decidir antes del paso 8):

- ⭐ **Usuario aparte para los agentes.** Los adaptadores de Paperclip corren como un usuario sin
  acceso a los secretos de Paperclip ni a las llaves. Las sesiones de las suscripciones quedan
  legibles solo por ese usuario. Hay que comprobar si Paperclip permite lanzar adaptadores con otro
  usuario.
- **Sacar los secretos de Paperclip a un archivo de root** leído por un servicio del sistema
  (`systemd` con `User=agentes`). Así no quedan en disco al alcance de `agentes`, pero siguen en el
  entorno del proceso: hay que comprobar qué entorno heredan los hijos.
- Borrar del VPS las llaves que no se usan: la de Anthropic (Sam además la revoca en su consola) y
  la de Z.AI mientras GLM esté en suspenso.

## Decisiones para Sam

Sam, 2026-10-19, literal: «Sí: apruebo A1 (llave de solo lectura de GitHub), A2 (llave nueva de
Anthropic con límite), D-B (tope de 100 USD al mes) y D-H (Hermes como motor del Editor de
contenido). A3 queda para después. Todavía no instales nada.»

| # | Decisión | Estado |
|---|---|---|
| A2-b | Motor principal | **En suspenso (§D10):** GLM no funciona fuera de herramientas soportadas (error 1113); hoy el motor es Codex |
| A4 | Conexión a Kommo con datos de clientes | **Pendiente:** después de la instalación, con `revisar-datos-ve` y su propia SDD |
| A5 | El CEO crea agentes | **Decidida:** sí, con los límites de §D5 |
| A1 | ¿Cómo leen los agentes el repositorio? | **Decidida:** llave de despliegue de solo lectura de GitHub. La alternativa A1-b (copia sin `.agents/handoffs/`) queda descartada por ahora |
| A2 | Llave de modelos nueva y exclusiva, con límite en el proveedor | **Cambiada el 2026-10-20 (§D10):** suscripciones de ChatGPT (Codex) y de Claude, no llaves de API |
| A3 | Bot de Telegram nuevo para hablar con el CEO | **Aprobada** el 2026-10-19: Telegram y correo solo cuando haga falta |
| D-B | Tope mensual de la empresa | **Decidida:** 100 USD al mes con parada dura |
| D-H | Papel de Hermes en la ola 1 | **Decidida:** motor del Editor de contenido, con Docker y sin terminal |

La instalación sigue sin autorizar: cada paso de §D9 necesita su propio OK.

Siguen abiertas además las preguntas 2 a 14 del organigrama. Las que tocan esta SDD son la 7
(adaptadores), la 8 (quién más entra) y la 10 (por dónde llega el parte).

## Pendientes de seguridad (lista viva)

- [ ] Telemetría de Paperclip apagada y comprobada.
- [ ] Tailscale instalado; panel y SSH solo por la red privada; SSH público cerrado.
- [ ] Salto de permisos apagado en cada agente de Claude Code.
- [ ] Hermes con backend Docker y sin terminal en el host.
- [ ] Ningún MCP ni conector con datos de clientes en la máquina.
- [ ] Llave de modelos exclusiva, con límite en el proveedor y topes en Paperclip.
- [ ] Llave maestra de Paperclip respaldada fuera de la máquina.
- [ ] Versiones fijadas anotadas; revisión de avisos de seguridad antes de cada actualización.
- [ ] Ninguna llave del servidor de DTD Cargo ni secreto del ERP en el VPS nuevo.
- [ ] Codex con su bypass apagado y su propia cuenta, o fuera de la ola 1.
- [ ] Bot de Telegram nuevo con lista de usuarios permitidos = Sam.
- [ ] Antes de A4: `revisar-datos-ve`, política de privacidad corregida y SDD propia.

## Fuera de alcance

La ola 2 y su tablero de indicadores; la transición del CRM a GoHighLevel; dejar que Paperclip
despierte Workers en worktrees (necesita otra SDD que cambie el runbook); el entorno de prueba
de DTD Cargo.

## Gobernanza

Cumple IA-01: los agentes trabajan en I0–I2 y nunca en I4. No cambia componentes ni
comportamiento del Studio. No hay migraciones. Seguridad: D1, D2 y D7.

## Aceptación

1. La evidencia de D9 existe, con fecha y sin secretos, en el handoff de la tarea que ejecute.
2. Desde fuera de Tailscale, el panel de Paperclip y el SSH no responden (prueba con fecha).
3. La telemetría de Paperclip consta apagada en la configuración del servicio.
4. Cada agente de Claude Code consta con `dangerouslySkipPermissions: false`; Hermes consta
   con backend Docker.
5. Los topes existen en Paperclip y en el proveedor; una prueba controlada con un tope bajo
   muestra que el agente se detiene.
6. En el VPS no hay llaves ni secretos del servidor de DTD Cargo ni del ERP (inventario con
   nombres, sin valores).
7. Tras 4 semanas, el parte del CEO llegó cada viernes y el gasto quedó dentro del tope. Sam
   decide si sigue, se ajusta o se apaga.

## Allowlist de archivos

- `docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md`
- `docs/specs/README.md` (índice generado)
- `docs/organizacion/organigrama-paperclip.md`
- `docs/organizacion/README.md`
- `docs/organizacion/assets/01-organigrama-dtd-cargo.svg`
- `.agents/handoffs/2026-10-19-oficina-paperclip-organigrama.md`

## Seguimiento

- 2026-10-19: escrita por la sesión «Oficina Paperclip». Estado `proposed`; espera la revisión
  del Director y las decisiones de Sam. Nada instalado.
- 2026-10-19: el Director revisó el diseño y Sam decidió A1, A2, D-B y D-H y pospuso A3.
  Estado `approved` (aprueba el diseño, no la instalación). Nada instalado.
- 2026-10-19: Sam respondió las preguntas del organigrama. Se suman GLM como motor
  principal, la recomendación sobre Docker, Codex con controles, A3 aprobada, el CEO que
  crea agentes y la regla de datos con controles; A4 (Kommo) queda pendiente. Nada instalado.
- 2026-10-20: pasos 6 y 7. Sam cambió A2 por suscripciones (§D10, con sus literales); Codex
  conectado con su cuenta de ChatGPT; GLM en suspenso; llave de GitHub de solo lectura. La
  verificación del aislamiento encontró que los adaptadores corren como `agentes`, dueño de los
  secretos: **el paso 8 espera la decisión de Sam**. Pendientes: revocar la llave de Anthropic (Sam,
  en su consola), los topes del paso 8 y Claude por suscripción cuando Sam inicie sesión.
