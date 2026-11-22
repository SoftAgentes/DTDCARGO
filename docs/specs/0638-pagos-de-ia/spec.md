---
sdd: "0638"
title: "Pagos de IA: estado de cada proveedor, errores de cobro y recordatorio de renovación"
status: approved
author: "Claude (Worker pagos-de-ia)"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0020", "0146", "0473", "0505", "0588", "0611", "0618", "0626", "0637", "0639"]
confidencialidad: interno
---

# SDD-0638 — Pagos de IA

> Varias funciones del ERP dependen de proveedores de IA pagados. Si una cuenta se queda sin saldo o
> se suspende, la función se cae o se degrada, y hoy el error no dice por qué. Esta spec propone tres
> cosas: una pantalla con el estado de cada proveedor, una regla para que los errores de cobro digan
> «falta de pago», y un recordatorio periódico al equipo de lo que hay que tener pagado.
>
> **Estado: approved (como plan, sin implementar).** Sam aprobó la spec el 2026-11-17 con «Sí, las
> dos», en respuesta a «¿apruebo las dos especificaciones de IA para que entren a main?» (SDD-0638 y
> SDD-0639, por el chat del DG). No trae código, migraciones ni cambios de configuración. La
> implementación se programa después de la ronda actual, y antes Sam decide las D-1 a D-7 (§9).
> **v0.2:** corregida con la revisión de Codex del 2026-11-16 (§12).

**Etiquetas de evidencia:** **C** código leído en esta tarea · **D** documento del repo · **I**
inferencia · **NV** no verificado, por confirmar con Sam. Base: `main` `4a3046745` (2026-11-16).

**Límite del repo público.** Aquí no van montos, fechas de pago, correos de cuentas, llaves ni
saldos. La spec nombra variables de entorno **solo por su nombre**. Los montos y las fechas de
renovación los carga Sam en la pantalla (§4.4) y quedan en la base, no en Git.

## 1. Lo que pidió Sam

1. Un lugar en el Studio, en la sección de IA y configuración, donde se vea el estado de cada IA.
2. Que cuando algo falle por falta de pago se entienda que esa es la causa.
3. Un recordatorio periódico al equipo de lo que hay que tener pagado.

**Cambiar de modelo o proveedor desde la misma pantalla** (pregunta de Sam del 2026-11-16) va en su
propia spec, la **SDD-0639**, enlazada desde esta pantalla (§10).

## 2. Inventario de uso de IA (verificado el 2026-11-16)

Búsqueda en el repo por proveedor (Anthropic, Z.AI/GLM, DeepSeek, OpenAI, OpenRouter, Gemini,
Cloudflare Workers AI, Groq) y por variable (`*_API_KEY`, `*_URL`, `*MODEL*`, `*_GLM_*`). OpenAI,
Gemini y Groq **no se llaman directamente** desde el código del ERP: Gemini solo aparece como opción
sin elegir en la SDD-0618; Groq se descartó porque bloquea Venezuela (`.env.example`, SDD-0146).

«Degrada» significa que la función sigue, pero sin IA. «Cae» significa que la función no entrega
nada. **Simulado** es el modo de prueba que se usa cuando no hay llave o `LLM_FORCE_MOCK=1`: la
función responde, pero no con la IA real. La pantalla tiene que distinguirlo de un servicio sano (§4.2).

### 2.1 Proveedores que llama el ERP (servidor web)

| # | Función del ERP | Proveedor · modelo | Variables (solo nombre) | Tope o freno | Si el proveedor deja de cobrar | Ev. |
|---|---|---|---|---|---|---|
| A1 | **Noticias web manuales** (Marketing › Noticias web): ocho acciones con IA: intención, enrutamiento, categoría, palabras clave, titulares, viñetas, esquemas y artículo | Anthropic · `claude-sonnet-4-6` fijo en código | `ANTHROPIC_API_KEY` | Ninguno propio | **Cae** cada acción; guardar y publicar a mano siguen. El resultado vuelve directo, sin registro de la llamada | C `app/studio/(app)/marketing/noticias-web/actions.ts:313`, `:424`, `:578`, `:636`, `:699`, `:770`, `:832`, `:918` |
| A2 | **Brief diario del CEO** por Telegram (cron diario) | Anthropic · `claude-sonnet-4-6` fijo | `ANTHROPIC_API_KEY` | Ninguno | **Degrada:** el brief llega igual, armado solo con los números del día (`buildFallbackBrief`). Nadie se entera de que faltó la IA | C `lib/news/ceo-brief.ts:208-212` |
| A3 | **Actas de Bitácora** y **escucha** | Anthropic · `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL` (por defecto `claude-sonnet-4-6`) | `ANTHROPIC_API_KEY`, `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL`, `LLM_FORCE_MOCK` | Ninguno | **Cae** el acta; pegar texto sigue. Sin llave pasa al modo simulado. Hoy el mensaje de error incluye el texto crudo del proveedor | C `lib/studio/bitacora/extract.ts:246`, `:294-296` |
| A4a | **Resumen interno de conversaciones** (cron `conversation-digests`) | Anthropic · `CONVERSATION_DIGEST_MODEL` → modelo del acta → por defecto | `ANTHROPIC_API_KEY`, `CONVERSATION_DIGEST_MODEL` | Ninguno | **Cae:** la conversación se salta y queda en logs | C `lib/studio/conversaciones/digest-extract.ts:72`, `:115`; `monthly-digest.ts:98-107` |
| A4b | **Resumen para el cliente en el portal** (mismo cron, llamada aparte) | Igual que A4a | Igual que A4a | Ninguno | **Degrada:** se guarda el interno y el portal no muestra resumen. Falla independiente de A4a | C `lib/studio/conversaciones/monthly-digest.ts:109-112` |
| A5 | **Lectura asistida de documentos** (PDF y hojas de cálculo: prealertas, packing list) | Anthropic · `DOCUMENT_IMPORT_MODEL` | `ANTHROPIC_API_KEY`, `DOCUMENT_IMPORT_MODEL`, `DOCUMENT_IMPORT_ENABLED`, `DOCUMENT_IMPORT_DAILY_JOBS`, `DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET` | Sí, en tokens, no en dinero: trabajos por día y presupuesto diario de tokens (`reserveLimit`) | **Cae** la lectura («no se pudo leer el documento»); el llenado manual sigue. Hoy 401/403 → `configuration_invalid` y el resto → `extraction_unavailable` | C `lib/studio/document-import/anthropic.ts:37-56`, `jobs.ts:90-92`, `extract.ts:464` |
| A6 | **Agentes y Skills** (SDD-0020, Administración › Agentes) | Anthropic · modelo por agente (`AGENT_MODELS`) | `ANTHROPIC_API_KEY`, `LLM_FORCE_MOCK` | Sí: `budget_usd_monthly` contra `spend_usd_mtd` por agente. Las tarifas de cada modelo están fijas en código | **Cae** la corrida; sin llave pasa al modo simulado | C `lib/studio/agents/runtime/llm-client-factory.ts`, `llm-client-anthropic.ts:38-46`, `policy-gates.ts:46` |
| A7 | **Transcripción de audio** de Bitácora | Cloudflare Workers AI · Whisper (`CF_WHISPER_MODEL`) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CF_WHISPER_MODEL` | Ninguno | **Cae** el audio; pegar texto sigue | C `lib/studio/bitacora/transcribe.ts` |
| A8 | **«Analizar con IA»** en Administración › Actualizaciones de Chatwoot (SDD-0588) | Z.AI · GLM (por defecto `glm-4.6`, API de pago) | `DTD_CHATWOOT_IA_GLM_KEY`, `DTD_CHATWOOT_IA_GLM_URL`, `DTD_CHATWOOT_IA_GLM_MODELO` | Sí: máximo 5 análisis al día por tenant, caché de 30 días y un análisis a la vez; además, el tope del panel del proveedor (SDD-0588 E3-D15) | **Degrada:** sale «sin IA» (solo la lista de archivos). Hoy cualquier respuesta no exitosa se vuelve `motor_no_responde`, sin el status | C `lib/studio/chatwoot/analisis-motor.ts:37`, `:139`, `:145` |
| A9 | **Panel de salud** `/studio/debug` | Revisa Anthropic y OpenRouter con `GET /models` (sin gasto) | `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | — | Hoy marca un 401 como «API key inválida» y un 402 como `HTTP 402`. `GET /models` **no prueba** que haya saldo ni que la generación funcione | C `lib/studio/integration-health.ts:249-267` |
| A10 | **OpenRouter** | Ninguna función lo llama; solo el panel de salud | `OPENROUTER_API_KEY` | — | Nada se cae | C (búsqueda sin otros usos) |

`getEnvStatus()` (`lib/studio/env-status.ts:56`) hoy solo mira Anthropic y OpenRouter entre los de IA.
Falta sumar GLM, Cloudflare y la Oficina (fase 1).

### 2.2 Funciones que pasan por la Oficina (Hermes, en el VPS)

El ERP llama al runtime de la Oficina por HTTP (`OFICINA_RUNTIME_URL`, `OFICINA_RUNTIME_TOKEN`).
Hermes elige el proveedor. El ERP **no ve** el error del proveedor: solo recibe
`ErrorDelRuntime("http_<status>")` del runtime, sin cuerpo (C `lib/studio/oficina/runtime-cliente.ts:77-79`).

| # | Función | Proveedor · modelo | Dónde está la llave | Tope o freno | Si deja de cobrar | Ev. |
|---|---|---|---|---|---|---|
| H1 | **Despachador del cable** (SDD-0626 Paso 3a), agente `soporte-chatwoot`: redacta borradores | Z.AI · `glm-5.3` (plan de código de tarifa plana). Según el runbook, el respaldo DeepSeek `deepseek-chat` se **quitó** el 2026-11-16 hasta que Sam cree una llave propia | `.env` del perfil en el VPS (fuera del repo) | Sí: `OFICINA_TOPE_MENSUAL_USD`, auto-pausa al 80 %, topes por corrida (`OFICINA_TOPE_LLAMADAS_CORRIDA`, `OFICINA_TOPE_TOKENS_CORRIDA`) | No hay borradores. Sin respaldo, cae entero | D `docs/runbooks/oficina-cable.md` §10. **NV:** es lo que dice el documento, no el estado medido en el VPS. La SDD-0626 todavía nombra el respaldo en §3.5 y §8 (`spec.md:207`, `:399`) y lo quita en `:252` |
| H2 | **Noticias automáticas** (SDD-0611): el redactor y el revisor son perfiles de la Oficina | Por confirmar con Sam | VPS | Por confirmar | No se publican noticias automáticas; quedan en revisión | D `docs/specs/0611-…`, **NV** |
| H3 | **Hermes como asistente personal / superagente** (DeepSeek, Anthropic) | DeepSeek y otros; **por confirmar con Sam** | VPS y cuentas personales | Por confirmar | Por confirmar | D `docs/oficina/contexto-oficina.md` §6, **NV** |

### 2.3 Funciones planeadas (no están en `main`)

| # | Función | Proveedor | Variables previstas | Tope previsto | Ev. |
|---|---|---|---|---|---|
| P1 | **Faro**, asistente de ayuda del Studio (SDD-0637, PR abierta) | Principal: Anthropic directo; respaldo: segundo modelo directo o la Oficina | `FARO_MODELO`, `FARO_MODELO_RESPALDO`, llave por variable | `FARO_TOPE_USD_MES` con pausa automática | D rama `claude/lumi-3ff50d`, spec §6.5 |
| P2 | **Agentes propios de Chatwoot** (`dtd-bot`, SDD-0618) | Sin elegir: Gemini con GLM de respaldo, o solo GLM (decisión 7.5) | Por definir | `topeMensualUsd` en `lib/studio/chatwoot/bot/frenos.ts` (con rango permitido) | C `lib/studio/chatwoot/bot/motor.ts`, `frenos.ts` |

### 2.4 Lo que no se pudo verificar (por confirmar con Sam)

- Qué proveedores usa hoy cada perfil de Hermes en el VPS, y con qué cuenta. No se leyó el `.env`
  del servidor, por regla.
- Si la cuenta de Anthropic del ERP es de prepago con créditos o de factura mensual. Cambia qué
  error se ve al acabarse (§5).
- Si Cloudflare Workers AI corre en plan gratuito o pagado.
- Qué otras suscripciones de IA paga el equipo fuera del ERP (por ejemplo, herramientas de
  programación). La pantalla las puede listar como «manuales» (§4.4).

### 2.5 Lo que ya existe y se reutiliza

- `/studio/debug` ya tiene `getEnvStatus()` (variable presente o no, **sin valores**) y
  `integration-health.ts` (sondeo sin gasto de Anthropic y OpenRouter, con
  `METERED_INTEGRATIONS`). Se reutilizan y se amplían; no se duplican.
- El «aviso de créditos en status» de la SDD-0603 (#589, `bd873493e`) trata de **créditos de clientes
  sin liberar en facturación**, no de créditos de IA. No tiene relación con esta spec.
- Algunos motores ya anotan proveedor, modelo, tokens, costo y resultado por llamada
  (`chatwoot_bot_llamadas`, las tablas de la Oficina, `spend_usd_mtd` de Agentes, `asistente_mensajes`
  de Faro). **No todos:** las noticias (A1), el brief (A2), Bitácora (A3) y los resúmenes (A4) no
  dejan registro. Por eso la fase 2 crea un registro mínimo común (§5.3).

## 3. Mapa de dependencias: si cae un proveedor, qué se cae

| Proveedor que deja de cobrar | Cae | Se degrada (sigue sin IA) | Sigue igual |
|---|---|---|---|
| **Anthropic** | A1 acciones de IA de noticias, A3 actas y escucha, A4a resumen interno, A5 lectura de documentos, A6 Agentes y Skills; mañana P1 Faro | A2 brief (llega solo con números), A4b resumen del portal (no se muestra) | Publicar noticias a mano, pegar texto en Bitácora, llenar documentos a mano |
| **Z.AI (GLM), llave del ERP** | — | A8 análisis de actualizaciones (sale solo la lista de archivos) | El resto |
| **Z.AI (GLM), llave de la Oficina** | H1 despachador (sin respaldo hoy); probablemente H2 noticias automáticas (NV); mañana P2 si se elige GLM | — | El ERP entero; la Bandeja de Chatwoot con atención humana |
| **DeepSeek** | Hoy nada del ERP (respaldo quitado, NV). Cuando vuelva: el respaldo de H1. H3 por confirmar | — | — |
| **Cloudflare Workers AI** | A7 transcripción de audio | — | Pegar texto |
| **OpenRouter** | Nada (A10) | — | — |
| **Gemini** | Nada hoy; mañana P2 si se elige | — | — |

Ningún proveedor de IA tumba la operación, los cobros, el portal ni el tracking. **I:** lo que más se
nota es Anthropic, porque toca siete funciones del Studio a la vez. Las degradaciones silenciosas (A2,
A4b, A8) son las más peligrosas: nadie se entera de que faltó la IA. La pantalla tiene que mostrarlas.

## 4. Pantalla «Estado de la IA»

### 4.1 Dónde va

El Studio no tiene hoy una sección llamada «IA y configuraciones». Lo más cercano es
**Sistema › Administración**, grupo **PRO**, donde ya están «Agentes y Skills» (SDD-0020) y
«Actualizaciones de Chatwoot» (SDD-0588) (C `app/studio/(app)/admin/page.tsx`). Se propone una
tarjeta nueva en ese grupo, **«Estado de la IA»**, con ruta `/studio/admin/ia`. La alternativa es una
sección nueva en la barra lateral (D-1).

Acceso: solo administradores del equipo (`requireModuleView("admin")` y rol admin), igual que el
resto de Administración. La pantalla **nunca muestra valores de llaves**, solo si la variable existe.

### 4.2 Estados: cada evidencia por separado

Un sondeo de `GET /models` no prueba que haya saldo. Una llave puesta no prueba que funcione. Por eso
la pantalla no junta todo en un solo «activo». Guarda cinco evidencias por **proveedor, cuenta,
entorno y función**:

| Evidencia | Qué prueba | Fuente |
|---|---|---|
| Llave presente | Que la variable existe | `getEnvStatus()` |
| Modo simulado | Que la función está respondiendo con el simulado, no con la IA | Configuración (sin llave o `LLM_FORCE_MOCK`) |
| Sondeo exitoso | Que la llave autentica | «Probar ahora» (§4.3) |
| Última generación real | Que la IA respondió de verdad, con fecha | Registro común (§5.3) |
| Último error clasificado | La clase (§5.1) y la fecha | Registro común |

Y de ahí sale **un estado visible**, con esta precedencia (gana el primero que se cumpla):

1. **Falta de pago** o **Cuenta suspendida**: el último error de cobro es más nuevo que la última
   generación real.
2. **Llave inválida**.
3. **Sin configurar**: no hay llave.
4. **Simulado**: responde, pero sin la IA real.
5. **Activo**: hay una generación real en los últimos N días (N lo fija la fase 4).
6. **Desconocido**: hay llave, pero no hubo uso reciente ni sondeo. No se pinta como «activo».

**Recuperación:** un estado de cobro se limpia solo cuando hay una generación real exitosa posterior.
Un sondeo exitoso no lo limpia, porque `/models` puede responder aunque no haya saldo.

Por fila se muestran también las **funciones que dependen** (el mapa de §3, en un catálogo fijo,
`lib/studio/ia/catalogo.ts`), y la **renovación** que carga Sam (§4.4).

Los colores siguen `BRAND.md` (Estados y mensajes, 2026-09-05):
- «Activo» lleva icono verde y texto neutro.
- «Falta de pago» se muestra como **error**: rojo en el icono y el borde, cuerpo neutro, y la acción
  «Recargar en el panel del proveedor».
- «Renovación próxima» se muestra como **atención**: dorado, con texto `--on-warning`.
- «Sin configurar», «Simulado» y «Desconocido» se muestran como información.

Ningún estado se distingue solo por el color: siempre lleva texto e icono, y no se recolorean
tarjetas. La UI pasa por `/ui-check` antes de su PR.

### 4.3 «Probar ahora»

Por proveedor, un sondeo sin gasto (`GET /models` donde exista). En pantalla se rotula como «la llave
autentica», no como «hay saldo». Para la Oficina, depende de la fase 3: hasta entonces la fila de la
Oficina muestra solo lo que el ERP ve (`http_<status>` del runtime).

### 4.4 Datos que carga Sam (no van en Git)

Tabla nueva `ia_suscripciones` (una migración, en su fase) por tenant y cuenta. Campos:
- proveedor;
- cuenta (un alias, no el correo);
- entorno;
- tipo de pago (prepago, mensual, anual, tarifa plana o gratuito);
- fecha de próxima renovación, **opcional** (una cuenta de prepago no tiene);
- frecuencia;
- responsable (usuario del Studio);
- una nota corta;
- **monto, opcional**, si Sam quiere verlo.

RLS: solo el admin del tenant. Es la única fuente de montos y fechas; el repo no los tiene.

**I:** el monto es un dato comercial del tenant, no un dato personal. Si Sam prefiere no cargarlo,
la pantalla funciona igual (D-4).

## 5. Errores de cobro: decir «falta de pago»

### 5.1 Contrato del clasificador

Un módulo puro, `lib/studio/ia/clasificar-error.ts`. Recibe:
- `proveedor`;
- `operacion` (la función, por ejemplo `A5`);
- `status` HTTP o tipo de fallo (tiempo agotado, conexión);
- el **código estructurado** del cuerpo (`error.type`, `error.code`), si lo hay;
- un extracto **corto** del texto, solo para buscar señales.

Devuelve:
- `{ clase, proveedor, operacion, status, codigo }`. **Nunca** el cuerpo ni el texto.

La precedencia es fija: se evalúa primero el código estructurado, luego el status y por último el
texto.

| Clase | Regla | Mensaje para el equipo |
|---|---|---|
| `falta_de_pago` | HTTP 402; o un código o texto de saldo del catálogo del proveedor (por ejemplo, `insufficient_quota`, `insufficient_balance`, «credit balance is too low», «余额不足»), **aunque el status sea 400 o 429** | «X rechazó la llamada por falta de saldo o de pago. Revisa la cuenta en su panel.» |
| `cuenta_suspendida` | 401 o 403 **con** un código o texto de cuenta suspendida, desactivada o de facturación | «La cuenta de X está suspendida o desactivada. Revisa la cuenta y la facturación.» No afirma que haya deuda |
| `llave_invalida` | 401 sin señal de cobro | «La llave de X no es válida o se revocó.» |
| `limite_de_uso` | 429 sin señal de cobro | «X está limitando el uso.» Se reintenta **solo** donde la función ya reintenta |
| `proveedor_caido` | 5xx, 529, tiempo agotado o error de conexión | «X no respondió.» |
| `otro` | El resto | «Error de X (código).» |

- **El catálogo de señales** de cada proveedor vive en un solo archivo, con pruebas. Los textos y
  códigos exactos se confirman en la documentación de cada proveedor al implementar. Esta spec no los
  da por verificados (**NV**).
- **Ni el cuerpo ni la llave salen del clasificador.** El cuerpo puede traer el id o el correo de la
  cuenta.

### 5.2 Clasificar antes de descartar

Hoy varios lugares pierden la causa antes de que alguien pueda clasificarla:
- **A8:** convierte toda respuesta no exitosa en `motor_no_responde`, sin el status (C `analisis-motor.ts:139`).
- **H1:** `runtime-cliente.ts` solo deja `http_<status>` del runtime, no el del proveedor (C `:77-79`).
- **A3:** pone el texto crudo del proveedor en el mensaje al usuario (C `bitacora/extract.ts:294-296`).
- **A4:** registra el texto crudo en el log (C `digest-extract.ts:115`).

La regla: cada motor llama al clasificador **en su `catch` o en el `!res.ok`**, antes de descartar el
status o el cuerpo. Desde ahí solo viaja la clase. Los mensajes al usuario y a los logs pasan a usar
la clase, no el texto crudo.

### 5.3 Registro mínimo común

Tabla `ia_eventos`, por tenant. Campos:
- fecha y hora;
- proveedor, cuenta y entorno;
- operación;
- resultado: `ok` o una clase;
- status y código.

No guarda ni texto, ni pregunta, ni respuesta. Sirve para la «última generación real» y el «último
error» de §4.2, y para el aviso de §5.5. Los motores que ya tienen registro propio (Agentes, Oficina,
`dtd-bot`, Faro) escriben además aquí una fila mínima, o la pantalla lee su registro con una vista;
eso se decide en la fase 2. Se purga a los 90 días.

### 5.4 Cuando el error viene de la Oficina

El ERP solo ve el status del runtime de Hermes. Hace falta que el runtime devuelva la clase del
proveedor de fondo, o al menos su status y su código, en una cabecera o un campo del error (D-5). Sin
eso, H1 y H2 solo pueden decir «la Oficina no respondió». **NV:** qué expone Hermes v0.23.1 en sus
errores; se mide antes de la fase 3.

### 5.5 Aviso inmediato

La primera vez que una función recibe `falta_de_pago` o `cuenta_suspendida` se avisa a los
administradores por el canal que elija Sam (D-3), con proveedor, función y hora. El aviso no se
repite en cada llamada: sale uno por proveedor, cuenta y día. La deduplicación se guarda en la base,
no en memoria, porque el servidor se reinicia.

## 6. Recordatorio periódico

- Un cron (`/api/cron/ia-recordatorio`) arma, por tenant, tres listas:
  - **vencidas:** fecha de renovación pasada y sin marcar «renovado»;
  - **por renovar:** las que vencen en los próximos N días;
  - **prepago:** cuentas sin fecha, con un error de cobro abierto o con un recordatorio fijo de
    «revisar saldo».
- **Las fechas van en la hora de Caracas** (America/Caracas). Al marcar «renovado», la próxima fecha
  avanza según la frecuencia; ese paso lo da una persona, no el cron.
- **El canal y la frecuencia los decide Sam (D-2, D-3).** Los canales que ya existen en el ERP:
  - Discord (`DISCORD_WEBHOOK_EQUIPO`, SDD-0606);
  - Telegram (Alertas del equipo, con el bot que ya opera);
  - correo (Resend);
  - aviso dentro del Studio (SDD-0628).
- El mensaje dice proveedor, para qué sirve, fecha y responsable. **El monto solo va si Sam lo pide
  (D-4)**, porque Discord y Telegram salen del Studio.
- **Entrega idempotente:**
  - cada envío se anota con su tenant, cuenta, periodo y canal, así que una segunda corrida no
    repite el aviso;
  - si el canal falla, se reintenta en la corrida siguiente y el intento queda anotado.
- Nace apagado, con un interruptor propio, como el resto de los crons nuevos.

## 7. Fases

| Fase | Qué entrega | Necesita |
|---|---|---|
| **0 · Esta spec** | Inventario, mapa y plan | Aprobación de Sam |
| **1 · Clasificador** | `clasificar-error.ts` con su catálogo y pruebas; `integration-health.ts` lo usa; `getEnvStatus()` suma GLM, Cloudflare y la Oficina | Nada de base |
| **2 · Motores del ERP** | Migración `ia_eventos`. A1 a A8 clasifican antes de descartar (§5.2), registran el evento y muestran la causa. Las degradaciones silenciosas (A2, A4b, A8) quedan anotadas | Fase 1 |
| **3 · Oficina** | El runtime pasa la clase del proveedor; H1 y H2 la registran | Fase 1, D-5, sesión de la SDD-0626 |
| **4 · Pantalla** | `/studio/admin/ia` con los estados de §4.2, «Probar ahora» y migración `ia_suscripciones`. Las filas de la Oficina muestran solo el status del runtime hasta que termine la fase 3 | Fases 1 y 2, D-1, D-4; `/ui-check`; `revisar-datos-ve` |
| **5 · Avisos** | Aviso inmediato de cobro y recordatorio periódico con entrega idempotente | Fase 4, D-2, D-3 |

Faro (P1) y `dtd-bot` (P2) adoptan el clasificador y el registro cuando se construyan.

## 8. Pruebas previstas

- **Clasificador:**
  - una tabla de casos por proveedor: 402; 400 o 429 con código de saldo; 401 de suspensión frente a
    401 de llave; 429 de ritmo; 5xx; tiempo agotado; cuerpo vacío;
  - casos de precedencia: el código estructurado le gana al texto;
  - una prueba de propiedad: el resultado nunca contiene el cuerpo ni algo con forma de llave.
- **Motores:** cada uno recibe un 402 simulado y se verifica la clase registrada, el mensaje y que el
  texto crudo no llegue ni al usuario ni al log. A2 y A4b registran la degradación.
- **Estados:** la tabla de precedencia de §4.2, con fechas simuladas. Un sondeo exitoso no limpia
  «falta de pago»; una generación real posterior sí.
- **Pantalla:**
  - sin variables, todo sale «Sin configurar»;
  - con `LLM_FORCE_MOCK`, sale «Simulado»;
  - un valor de variable nunca aparece en el HTML: la prueba siembra una llave falsa y la busca en la
    salida.
- **Base:** la RLS de `ia_suscripciones` e `ia_eventos` en PGlite (solo el admin del tenant).
- **Recordatorio:**
  - con fechas simuladas en la hora de Caracas: vencidas, por renovar y prepago;
  - una segunda corrida no repite el aviso;
  - si el canal falla, se reintenta;
  - apagado, no hace nada.
- Cada fase de producto cierra con `pnpm verify`.

## 9. Decisiones abiertas para Sam

- **D-1 · Ubicación.** Tarjeta «Estado de la IA» en Administración › PRO (propuesta), o sección
  nueva «IA» en la barra lateral.
- **D-2 · Frecuencia del recordatorio.** Mensual (el día que elijas), quincenal o N días antes de
  cada renovación. Propuesta: 7 días antes, más un resumen el día 1 de cada mes.
- **D-3 · Canal.** Discord del equipo, Telegram, correo o aviso en el Studio; uno o varios. También
  a quién: solo a ti o a los administradores.
- **D-4 · Montos.** ¿Cargas el monto en la pantalla? ¿Va en el recordatorio o solo en el Studio?
- **D-5 · Oficina.** ¿Autorizas tocar el runtime de Hermes para que devuelva la causa del error del
  proveedor? Lo coordina la sesión de la SDD-0626.
- **D-6 · Lista de proveedores.** Confirma cuáles usa hoy Hermes en el VPS (GLM, DeepSeek, otros) y
  qué suscripciones de fuera del ERP quieres ver en la lista (herramientas de programación, etc.).
- **D-7 · Respuesta ante falta de pago.** Solo avisar (propuesta), o además pausar la función hasta
  que alguien marque «recargado». Cambiar a otro proveedor es la SDD-0639.

## 10. Fuera de alcance

- **Cambiar de modelo o de proveedor** desde la pantalla, a mano o de forma automática: **SDD-0639**.
  Esta pantalla solo le deja el lugar y el enlace.
- Pagar o recargar desde el ERP. La pantalla solo enlaza al panel de cada proveedor.
- Leer saldos por la API de los proveedores. Pocos lo permiten y piden otra llave. Puede ser una
  fase posterior, proveedor por proveedor.
- Leer el `.env` del VPS o el de producción.

## 11. Privacidad y seguridad

- Sin datos personales de clientes. `ia_suscripciones` guarda un alias de la cuenta y un responsable
  (usuario del Studio). No guarda correos ni datos de tarjeta. `ia_eventos` no guarda texto.
- El clasificador no deja pasar el cuerpo del error, que puede traer el id o el correo de la cuenta.
  La fase 2 retira el texto crudo del proveedor de los mensajes y los logs donde está hoy (§5.2).
- La pantalla y el recordatorio nunca muestran llaves, ni siquiera truncadas.
- La captura de `ia_suscripciones` pasa por `revisar-datos-ve` en la fase 4, por el campo
  «responsable».

## 12. Revisión de Codex (2026-11-16) y qué cambió

Codex revisó la v0.1 en modo de solo lectura contra el código. Cada hallazgo se verificó en el código
antes de corregirlo:

| Hallazgo | Cambio en v0.2 |
|---|---|
| A2: el brief no deja de llegar; manda un resumen solo con números (`ceo-brief.ts:208-212`) | A2 pasa a «degrada» en §2.1 y §3 |
| A8: sí tiene freno en código (5 al día, caché, un análisis a la vez) | Corregido en §2.1 |
| A5: tiene límite diario de trabajos y presupuesto de tokens, y lee también hojas de cálculo | Corregido en §2.1 |
| A1: son ocho acciones, no «redactar y traducir» | Corregido en §2.1 |
| A4: son dos resúmenes con fallas independientes | Dividido en A4a y A4b |
| El modo simulado no se distinguía del servicio real | Estado «Simulado» en §4.2 |
| `GET /models` no prueba saldo ni generación | Evidencias separadas, precedencia y recuperación (§4.2) |
| El clasificador no tenía proveedor, operación, código estructurado ni precedencia | Contrato en §5.1 |
| La causa se pierde antes de clasificarla (A8, H1) y hay texto crudo en mensajes y logs (A3, A4) | §5.2 |
| La fase 2 suponía registros que no existen | Registro mínimo `ia_eventos` (§5.3) |
| Al recordatorio le faltaban vencidas, prepago, zona horaria, deduplicación y reintentos | §6 |
| La fase 4 ofrecía la Oficina sin la fase 3 | Corregido en §4.3 y §7 |
| El respaldo de la Oficina es evidencia documental, y la SDD-0626 se contradice | Marcado NV en H1 |
| Cambiar de proveedor: viable, pero en una spec aparte | SDD-0639 (§10) |
