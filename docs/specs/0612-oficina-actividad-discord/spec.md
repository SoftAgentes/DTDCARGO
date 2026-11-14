---
sdd: "0612"
title: "Avisos de Paperclip a #actividad-oficina y resumen diario de la oficina"
status: proposed
author: "Claude Worker «Oficina actividad» (Sam)"
created: 2026-11-06
updated: 2026-11-14
supersedes: null
superseded_by: null
related: ["0605", "0607", "0609"]
confidencialidad: interno
---

# SDD-0612 — Avisos de Paperclip a `#actividad-oficina` y resumen diario de la oficina

> Propone cómo alimentar el canal `#actividad-oficina` de Discord con lo que pasa en Paperclip:
> tareas asignadas, tareas terminadas, agentes con error o trabados y aprobaciones pendientes.
> También propone un resumen diario de quién hizo qué y quién está trabado.
>
> **Esta SDD es solo spec.** No trae código, no toca el VPS de la oficina ni Discord y no
> necesita migración. El código y el runbook ejecutable vienen en una PR posterior, después de
> que Sam decida lo que lista la sección «Decisiones de Sam».

## Pedido

La sesión que coordina el plan de la oficina hizo este encargo el 2026-11-06. Pidió decidir:

- cómo engancharse a Paperclip;
- si conviene una extensión de Paperclip o un proceso aparte;
- qué lleva cada aviso;
- cómo funcionan la cola y la entrega incierta;
- si conviene el resumen diario, con su hora, su formato y su fuente;
- el runbook.

Límites del encargo: sin código, sin tocar ningún VPS ni Discord, PR en borrador sin fusionar.

## Contexto

- La oficina de agentes (Paperclip + Hermes) corre en un VPS propio, que no es el de producción.
  Desde el 2026-11-05 conversa con Sam por Discord, a través de ALFRED, en la categoría privada
  «Oficina» ([runbook del corte](../../runbooks/oficina-corte-discord.md)).
- El canal `#actividad-oficina` (ID `1567954709820473446`) existe, pero todavía no publica nada.
- El [plan maestro](../../organizacion/plan-maestro-oficina.md) dice que ese canal «se alimenta
  con una extensión propia de Paperclip». Esta SDD revisa esa idea con la documentación pública y
  recomienda otro camino. Si Sam lo aprueba, la PR del código corrige esa línea del plan.
- El puente de ALFRED ([SDD-0607](../0607-oficina-puente-discord/spec.md)) ya resolvió en código
  cómo publicar por un webhook de Discord sin perder ni duplicar avisos. Esta SDD reutiliza ese
  criterio.
- Paperclip instalado: **v2026.1012.0**, publicada el 2026-10-12.

## Qué dice Paperclip (documentación pública, leída el 2026-11-06)

**Ojo:** la documentación pública describe la versión actual de Paperclip, no necesariamente la
v2026.1012.0. Las notas de esa versión solo dicen que existe una bitácora de altas, pausas y bajas
de agentes, como «groundwork for plugin hooks». El primer paso del runbook confirma en la
instancia lo que aquí se da por documentado.

### Extensiones (plugins)

- El SDK permite suscribirse a eventos del servidor con `ctx.events.on(...)`. La documentación
  menciona, como ejemplos, `issue.created` y `agent.run.completed`, pero no publica la lista
  completa de eventos.
- Las llamadas del worker al servidor pasan por permisos que declara el manifiesto
  («capability-gated»). Hay un solo worker por extensión para toda la instancia.
- La guía para escribir extensiones dice: «Treat plugin workers and plugin UI as trusted code». La
  interfaz de una extensión corre como JavaScript del mismo origen, dentro de la app de Paperclip,
  y los permisos del manifiesto no la aíslan.
- Instalar una extensión es una operación de administrador de la instancia.
- El entorno de extensiones está en **alfa**: «The SDK still ships breaking changes between
  Paperclip releases». La documentación pide fijar versiones y releer la guía en cada
  actualización.

### API

- La Junta entra con su sesión o con una llave de Junta, que tiene todo el poder.
- Los agentes usan llaves de larga duración, atadas a su compañía. Según una copia de la
  documentación (no la oficial), un agente no puede aprobar contrataciones ni estrategias, ni
  crear o revocar llaves.
- **No hay llaves de solo lectura documentadas.** Lo único con alcances de lectura es la API MCP
  del asistente, que es experimental y usa OAuth de usuario.
- `GET /api/companies/{id}/issues` lista las tareas, con filtros por `status` y
  `assigneeAgentId`, y con `limit`. Estados de una tarea: `backlog`, `todo`, `in_progress`,
  `in_review`, `blocked`, `done` y `cancelled`.
- `GET /api/companies/{id}/agents` lista los agentes. Estados: `active`, `paused`, `idle`,
  `running`, `error`, `pending_approval` y `terminated`.
- `GET /api/companies/{id}/approvals?status=pending` lista las aprobaciones pendientes. La
  documentación no dice si una llave de agente puede leerlas.
- `GET /api/companies/{id}/activity` devuelve la actividad, de la más nueva a la más vieja, **sin
  paginar**.

## Decisión 1 — Cómo engancharse: proceso aparte, no extensión ⭐

Se compararon las dos opciones.

| | Extensión de Paperclip | Proceso aparte (recomendado) |
|---|---|---|
| Poder | Código de confianza, dentro de Paperclip. Su interfaz corre con la sesión de quien la abre, que es Sam con todo el poder de la Junta. Los permisos del manifiesto limitan las llamadas del worker, pero no aíslan el proceso: por **inferencia**, corre en la misma máquina que Paperclip | Una llave de agente que no aprueba, no contrata y no crea llaves, más un cliente que solo hace `GET` |
| Estabilidad | Entorno en alfa, con cambios incompatibles entre versiones. Hay que revisarla en cada actualización de Paperclip | Usa rutas comunes de la API. Una actualización de Paperclip puede romperla, pero falla de forma visible y no dentro de Paperclip |
| Lista de eventos | Sin documentar completa: hay que leer `PLUGIN_EVENT_TYPES` en el código de la versión instalada | No depende de eventos. Compara fotos del estado |
| Latencia | Inmediata | Hasta 60 segundos |
| Herramientas | Node y el SDK de Paperclip, un paquete nuevo que mantener | Python con la biblioteca estándar, igual que el puente. Las pruebas corren en el harness |
| Instalación | Como administrador de Paperclip | Como servicio de systemd, con su usuario y su credencial |
| Vuelta atrás | Desinstalar la extensión | Detener el servicio y revocar la llave |

**Recomendación: proceso aparte**, `dtd-actividad`, en el VPS de la oficina, junto al puente. Pesa
lo siguiente:

1. Una falla o una dependencia comprometida en una extensión actúa **dentro** de Paperclip. En el
   proceso aparte, lo peor que puede hacer la llave queda limitado a lo que puede un agente.
2. Un canal de avisos no necesita latencia de un segundo. Un minuto alcanza.
3. El puente ya probó este mismo patrón y sus pruebas corren en el harness.

**Cuándo volver a mirar la extensión:** si se construye la «oficina dibujada» del plan, que sí
necesita páginas dentro de Paperclip, o si Paperclip saca el entorno de extensiones del alfa.

## Decisión 2 — Con qué llave lee

**No existe una llave de solo lectura.** La opción menos poderosa que da Paperclip es la llave de
un agente. Propuesta:

- Un agente dedicado, **«Vigía»**, que nunca trabaja: pausado, sin tareas y sin herramientas. Su
  llave lleva el nombre `dtd-actividad`. Ver tareas, agentes y aprobaciones no le sirve para
  actuar, porque no tiene ejecuciones.
- El cliente del servicio solo acepta `GET`. Otro método lanza un error antes de salir a la red, y
  una prueba lo exige. Las rutas también salen de una lista fija.
- La llave vive como credencial de systemd, legible solo por el servicio, como la del puente.
- **Si la llave se filtra,** quien la tenga puede hacer lo que haga un agente de la compañía: leer
  y comentar tareas. No puede aprobar, contratar ni crear llaves. Se revoca desde Paperclip.
- **No se usa una llave de Junta.** Daría a un servicio de avisos todo el poder de Sam.

Queda por medir en la instancia: si una llave de agente pausado puede leer las aprobaciones y la
lista de agentes. El paso 0 del runbook lo mide. Si no puede, ese aviso se cae y se le avisa a Sam:
no se sube de llave.

## Decisión 3 — Qué eventos y cómo se detectan

El servicio toma cada 60 segundos una foto de las tareas abiertas, los agentes y las aprobaciones
pendientes. La compara con la anterior, guardada en su base SQLite, y de esa diferencia salen los
avisos:

| Aviso | Cómo se detecta |
|---|---|
| Tarea asignada | Una tarea aparece con un agente asignado, o cambia de agente |
| Tarea terminada | Una tarea abierta pasa a `done`. Si sale de la lista de abiertas, se consulta por su id para saber si terminó o se canceló. Una cancelada solo entra al resumen |
| Tarea bloqueada | Una tarea pasa a `blocked` |
| Agente con error | Un agente pasa a `error` |
| Agente trabado | Una tarea `in_progress` o `todo` asignada que no cambia en 24 horas, medidas por el propio servicio. Se avisa una vez por tarea |
| Aprobación pendiente | Aparece una aprobación con estado `pending` |

**Por qué fotos y no el registro de actividad.** El registro no se pagina, y si el servicio se cae
un rato puede perder entradas. La foto, en cambio, siempre dice cómo está todo ahora: al volver,
avisa el cambio neto y no repite lo viejo. Además, no depende de nombres de acciones que la
documentación solo da como ejemplo.

**Primera corrida.** Toma la foto y la guarda sin avisar nada. Si no fuera así, publicaría como
«nuevo» todo lo que ya existe.

**Límite conocido.** Una tarea que se crea y se termina dentro del mismo minuto no genera aviso en
vivo. Sí aparece en el resumen, si sigue en la lista.

## Decisión 4 — Qué lleva cada aviso

La regla es la corrección **A1 de Codex**, la misma del puente:

- **Sí:** el identificador de la tarea (`HAI-123`), su estado nuevo, el nombre del agente y el
  enlace a Paperclip (`http://localhost:3100/HAI/issues/HAI-123`, que abre por el túnel de Sam).
  Para un agente, su nombre y su estado. Para una aprobación, su tipo y el enlace.
- **No:** el título de la tarea, el texto de los comentarios, el mensaje de error de un agente ni
  el contenido de una aprobación. Pueden traer datos de clientes, rutas o llaves.

Esto se hace cumplir en el código: cada aviso se arma con una lista cerrada de campos, y una prueba
mete un título y un comentario con datos falsos de un cliente y exige que no aparezcan en lo
enviado. Los nombres de los agentes no son datos personales: son roles de la oficina, como
«ALFRED» o «Editor de contenido».

**Ejemplo de mensaje.** Los cambios de un mismo minuto van en un solo mensaje, para no gastar
envíos:

```text
HAI-123 · asignada a Editor de contenido · http://localhost:3100/HAI/issues/HAI-123
HAI-118 · terminada por ALFRED · http://localhost:3100/HAI/issues/HAI-118
Agente Jefe de gabinete · con error · http://localhost:3100/HAI/agents/jefe-de-gabinete
Aprobación pendiente · contratar agente · http://localhost:3100/HAI/approvals
```

Si una tanda pasa de 20 líneas, se publican las primeras 20 y una línea «y N cambios más: ver
Paperclip». El formato de los enlaces de agente y de aprobación se confirma en el paso 0 del
runbook.

## Decisión 5 — Envío, cola y entrega incierta

Se aplica el criterio del `discord_sender` del puente
([`bridge.py`](../../../infra/oficina/dtd-alfred/bridge.py), SDD-0607), punto por punto:

- `POST` a la dirección del webhook con `?wait=true`, armada con `urllib.parse`, para recibir el
  id del mensaje.
- `allowed_mentions: {"parse": []}`, sin menciones, y `flags: 4`, sin vista previa de enlaces.
- La dirección tiene que ser `https://discord.com` o `https://discordapp.com`, con ruta
  `/api/webhooks/{id}/{token}`, sin consulta ni fragmento. User-Agent
  `DiscordBot (https://dtdcargo.com, 1.0)`.
- Mensajes de hasta 1.900 unidades UTF-16, por debajo del tope de 2.000, cortados en un salto de
  línea.
- Ante un 429, se espera lo que diga `Retry-After` o, si falta, `retry_after` del cuerpo, y se
  corta la tanda.
- Un 400 descarta ese mensaje y deja una línea en el registro del servicio, sin el contenido.
- Cola **estricta** en SQLite: si un mensaje no sale, los de atrás esperan, como aceptó Sam para
  el puente el 2026-11-05.
- **Entrega incierta.** Si el pedido salió y no volvió respuesta, el mensaje queda marcado. No se
  reenvía, no frena la cola y el servicio espera un minuto antes de seguir. Una conexión que no
  llegó a abrirse sí se reintenta.
- **La dirección del webhook es una llave.** No va al repositorio, a un registro, a un error ni a
  un chat. Se enmascara si aparece en un texto.

**Reutilizar el criterio, no el archivo.** El servicio trae su propio emisor, para no tener que
reinstalar el puente al cambiarlo. Una prueba del harness pasa los mismos casos (429 con cabecera
y con cuerpo, 400, entrega incierta, dirección malformada, UTF-16) por los dos emisores y exige el
mismo resultado. Así no se separan sin que nadie lo note.

**Otro webhook.** `#actividad-oficina` tiene su propio webhook, «Oficina · actividad», distinto del
de `#alfred`. Revocar uno no apaga el otro.

## Decisión 6 — Resumen diario

**Recomendación: sí**, generado por código y no por un agente: no gasta tokens y no inventa nada.

- **Hora:** 18:00 de Venezuela (22:00 UTC), al cierre del día de trabajo.
- **Días:** solo los días con algún cambio. Un día sin movimiento no publica nada.
- **Fuente:** la bitácora de cambios que el propio servicio guarda en su base, de las últimas 24
  horas, más la foto del momento. No llama a ningún modelo.
- **Formato** (mismas reglas de contenido que los avisos, sin títulos):

```text
Resumen de la oficina · jueves 6 de noviembre
Terminadas hoy: 4 (Editor de contenido 3, ALFRED 1)
Abiertas: 5 en curso, 2 en revisión, 3 por empezar
Trabadas: 2
  HAI-41 · bloqueada · Jefe de gabinete · desde hace 2 días
  HAI-57 · sin cambios hace 26 h · Puente de ingeniería
Agentes con error: ninguno
Aprobaciones pendientes: 1 · http://localhost:3100/HAI/approvals
```

- **Diferencia con el parte del viernes.** El parte es de ALFRED: trae avance, atrasos y su
  recomendación. El resumen es un conteo mecánico, sin opiniones, y no reemplaza al parte.

## Dónde vive

`infra/oficina/dtd-actividad/`, al lado del puente: `actividad.py`, sus pruebas, un README y un
enganche al harness en `scripts/tests/`. El runbook va en
`docs/runbooks/oficina-actividad-discord.md`. Todo eso entra en la PR del código, no en esta.

## Runbook propuesto

Se ejecuta con Sam presente. Los pasos 1, 2, 4 y 5 los hace Sam con su mano. Las llaves no pasan
por el chat de ninguna sesión.

**0. Medir, solo lectura.** Es lo primero, antes de escribir el código final.

- Versión de Paperclip y su `GET /api/openapi.json`, para confirmar las rutas de tareas, agentes y
  aprobaciones y el formato de los enlaces.
- Con una llave de prueba del Vigía: qué devuelven esas tres rutas, y si un `POST` de prueba sobre
  una tarea de prueba se acepta. Esto último mide el riesgo real de la llave.
- El usuario y el formato de credenciales que usa la unidad del puente, para copiar el patrón.

**1. Webhook (Sam).** En `#actividad-oficina`: Ajustes del canal → Integraciones → Webhooks →
nuevo, «Oficina · actividad». Sam copia la dirección y la guarda en el VPS con el script que ya
existe para eso, desde PowerShell en su PC:

```powershell
Get-Clipboard | ssh.exe <host> sudo /usr/local/sbin/dtd-guardar-llave-discord webhook
```

El script valida la llave contra Discord y solo imprime el largo y una huella; el paso confirma
que el `channel_id` sea `1567954709820473446`. Ese script vive en el VPS y no está en el
repositorio. Si no admite una segunda credencial o un destino propio, la PR del código lo resuelve
antes de este paso.

**2. Vigía (Sam).** En Paperclip, como Junta: crea el agente «Vigía» pausado, sin herramientas ni
tareas, y genera su llave `dtd-actividad`. Paperclip la muestra una sola vez. Sam la pega en el VPS
de la misma forma que el webhook.

**3. Instalar.** Copia de `infra/oficina/dtd-actividad/` a `/usr/local/lib/dtd-actividad/`. Unidad
`dtd-actividad.service` con su propio usuario sin acceso a la consola y las dos credenciales por
`LoadCredential`. Arranca y toma la foto inicial sin avisar.

**4. Ida (Sam).** `dtd-actividad --probar` publica una línea de prueba. Sam confirma que la vio en
`#actividad-oficina` y que no apareció en otro canal.

**5. Vuelta (Sam).** Sam crea en Paperclip una tarea «Prueba de actividad», sin datos de clientes,
y se la asigna al Vigía. Como está pausado, no trabaja. Lo que se espera ver:

- en menos de dos minutos, el aviso «asignada»;
- al marcarla terminada, el aviso «terminada»;
- con `dtd-actividad --resumen-ahora`, el resumen del día.

Se confirma que ningún mensaje trae el título de la tarea. Después se cancela la tarea.

**6. Vuelta atrás**, en este orden:

1. `systemctl disable --now dtd-actividad`.
2. Borrar el webhook en Discord: así se revoca la dirección.
3. Revocar la llave del Vigía en Paperclip.
4. Borrar las dos credenciales del VPS.

Ninguna otra pieza depende de este servicio: el puente y la recepción siguen igual.

## Privacidad

No mueve datos personales. Los avisos llevan identificadores de tareas, estados, nombres de
agentes y enlaces. Discord es un tercero en EE. UU., pero ahí no llega nada de clientes. Lo hace
cumplir la lista cerrada de campos, con su prueba (Decisión 4). La PR del código pasa la revisión
de `.claude/skills/revisar-datos-ve/SKILL.md` para confirmarlo.

## Decisiones de Sam

**Respuestas de Sam del 2026-11-14.** Dadas en la pantalla del Subdirector SEO y relatadas al Director
General, que las reconfirma con Sam. Se transcribe la opción elegida, textualmente.

| # | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Proceso aparte o extensión de Paperclip? | ⭐ Proceso aparte |
| D2 | No hay llave de solo lectura. ¿Se acepta la llave de un agente «Vigía» pausado, con un cliente que solo lee? | ⭐ Sí. Nunca una llave de Junta |
| D3 | ¿Los avisos llevan solo tarea, estado, agente y enlace (A1), o también el título? Es la decisión 1 pendiente del plan v2 | ⭐ Sin título |
| D4 | ¿Los seis avisos en vivo de la Decisión 3, con «trabado» a las 24 horas? | ⭐ Sí, 24 horas |
| D5 | ¿Resumen diario? Es la decisión 3 pendiente del plan v2 | ⭐ Sí: 18:00 de Venezuela, solo los días con cambios |
| D6 | ¿Cuándo se instala? | Después de fusionar la PR del código, con Sam presente para los pasos 1, 2, 4 y 5 |

| # | Respuesta de Sam (2026-11-14) |
|---|---|
| D1 | «Proceso aparte (Recomendado)» |
| D2 | «Sí, agente Vigía (Recomendado)» |
| D3 | «Con título». **Pendiente de reconfirmación del Director General:** no es la recomendación (⭐ Sin título). Hasta su respuesta no es una decisión de la spec |
| D4 | «Sí, trabado a 24 h (Recomendado)» |
| D5 | «Sí, 18:00 Venezuela (Recomendado)» |
| D6 | «Tras fusionar la PR del código (Recomendado)» |

## Lo que no se pudo comprobar

- **La versión instalada contra la documentación.** La documentación es la actual; la instancia
  es la v2026.1012.0. Lo confirma el paso 0.
- **Qué puede leer una llave de agente pausado:** aprobaciones, lista de agentes y tareas
  privadas. Sin medir.
- **Cómo corre el worker de una extensión.** Que comparte máquina y usuario con Paperclip es una
  inferencia: la documentación dice «trusted code» y no describe un aislamiento.
- **Discord real.** Los códigos y los límites salen de la documentación y del puente, que ya los
  probó en el corte del 2026-11-05.

## Allowlist exacta de esta PR

| Archivo | Cambio |
|---|---|
| `docs/specs/0612-oficina-actividad-discord/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
| `.agents/handoffs/sdd-0612-oficina-actividad-discord.md` | Nuevo (handoff de la tarea) |

## Criterios de aceptación de esta PR

1. La spec compara la extensión con el proceso aparte, con evidencia de la documentación de
   Paperclip, y recomienda uno.
2. Dice qué lleva y qué no lleva cada aviso, y cómo se hace cumplir.
3. Define la cola, la entrega incierta y el webhook como llave, con el criterio de la SDD-0607.
4. Propone el resumen diario: hora, formato y fuente.
5. Trae el runbook: medición, instalación, ida y vuelta, y vuelta atrás.
6. Lista las decisiones de Sam.
7. `pnpm docs:check` y `pnpm sdd:check` pasan y el diff no sale de la allowlist.

## Criterios de aceptación del código (PR posterior)

1. El cliente de Paperclip solo hace `GET` a una lista fija de rutas. Una prueba lo exige.
2. Ningún aviso ni resumen lleva títulos, comentarios ni mensajes de error. Una prueba con datos
   falsos de un cliente lo exige.
3. La primera corrida no publica nada.
4. Los casos del emisor de la SDD-0607 pasan contra el emisor nuevo y dan el mismo resultado.
5. Las pruebas corren en `pnpm harness:test`, con un piso de pruebas, y no se saltan en el CI.
6. Ningún archivo trae llaves, direcciones de webhook ni la IP del VPS.

## Validación de esta PR

| Comprobación | Aplica | Motivo |
|---|---|---|
| `pnpm docs:check`, `pnpm sdd:check` | Sí | Spec nueva |
| `pnpm verify` y `pnpm harness:test` | **No aplica** | El diff es solo documentación. No toca la aplicación, migraciones ni el harness |

## Riesgos

| Riesgo | Control |
|---|---|
| Que se filtre la llave del Vigía | Puede lo mismo que un agente, no lo que la Junta. Vive como credencial de systemd. Se revoca en Paperclip |
| Que un aviso lleve datos de un cliente | Lista cerrada de campos, con su prueba |
| Que se filtre la dirección del webhook | Llave: no se escribe en archivos, registros ni chats. Se revoca borrando el webhook |
| Que una actualización de Paperclip cambie la API | El servicio falla de forma visible, en su registro, y deja de avisar. No afecta a Paperclip. Se revisa al actualizar |
| Que el canal se llene de ruido | Una tanda por minuto, con tope de 20 líneas. «Trabado» se avisa una vez por tarea |
| Que el servicio se caiga y nadie lo note | Si un día con cambios no llega el resumen, es la señal. La PR del código puede sumarlo a `#salud` |

## Qué no autoriza

No autoriza escribir el código, entrar al VPS, crear el webhook, crear el agente Vigía ni su
llave, ni instalar nada. Cada paso necesita la autorización de Sam que indica el runbook.
