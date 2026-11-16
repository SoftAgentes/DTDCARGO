---
sdd: "0638"
title: "Pagos de IA: estado de cada proveedor, errores de cobro y recordatorio de renovación"
status: proposed
author: "Claude (Worker pagos-de-ia)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0020", "0146", "0473", "0505", "0588", "0611", "0618", "0626", "0637"]
confidencialidad: interno
---

# SDD-0638 — Pagos de IA

> Varias funciones del ERP dependen de proveedores de IA pagados. Si una cuenta se queda sin saldo
> o se suspende, la función se cae y hoy el error no dice por qué. Esta spec propone tres cosas: una
> pantalla con el estado de cada proveedor, una regla para que los errores de cobro digan «falta de
> pago», y un recordatorio periódico al equipo de lo que hay que tener pagado.
>
> **Estado: proposed.** Es un plan. No trae código, migraciones ni cambios de configuración. Sam
> decide las D-1 a D-8 (§9) antes de que se implemente.

**Etiquetas de evidencia:** **C** código leído en esta tarea · **D** documento del repo · **I**
inferencia · **NV** no verificado, por confirmar con Sam. Base: `main` `4a3046745` (2026-11-16).

**Límite del repo público.** Aquí no van montos, fechas de pago, correos de cuentas, llaves ni
saldos. La spec nombra variables de entorno **solo por su nombre**. Los montos y las fechas de
renovación los carga Sam en la pantalla (§4.3) y quedan en la base, no en Git.

## 1. Lo que pidió Sam

1. Un lugar en el Studio, en la sección de IA y configuración, donde se vea el estado de cada IA.
2. Que cuando algo falle por falta de pago se entienda que esa es la causa.
3. Un recordatorio periódico al equipo de lo que hay que tener pagado.

## 2. Inventario de uso de IA (verificado el 2026-11-16)

Búsqueda en el repo por proveedor (Anthropic, Z.AI/GLM, DeepSeek, OpenAI, OpenRouter, Gemini,
Cloudflare Workers AI, Groq) y por variable (`*_API_KEY`, `*_URL`, `*MODEL*`, `*_GLM_*`). OpenAI,
Gemini y Groq **no se llaman directamente** desde el código del ERP: Gemini solo aparece como opción
sin elegir en la SDD-0618; Groq se descartó porque bloquea Venezuela (`.env.example`, SDD-0146).

### 2.1 Proveedores que llama el ERP (servidor web)

| # | Función del ERP | Proveedor · modelo | Variables (solo nombre) | Tope o freno | Si el proveedor deja de cobrar | Ev. |
|---|---|---|---|---|---|---|
| A1 | **Noticias web manuales** (Marketing › Noticias web: redactar, reescribir, traducir) | Anthropic · `claude-sonnet-4-6` fijo en código | `ANTHROPIC_API_KEY` | Ninguno propio | El botón de IA falla; publicar a mano sigue | C `app/studio/(app)/marketing/noticias-web/actions.ts` |
| A2 | **Brief diario del CEO** por Telegram (cron diario) | Anthropic · `claude-sonnet-4-6` fijo | `ANTHROPIC_API_KEY` | Ninguno | El brief no llega; el cron lo registra como error genérico | C `lib/news/ceo-brief.ts`, `app/api/cron/ceo-brief/` |
| A3 | **Actas de Bitácora** y **escucha** | Anthropic · `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL` (por defecto `claude-sonnet-4-6`) | `ANTHROPIC_API_KEY`, `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL`, `LLM_FORCE_MOCK` | Ninguno | No se genera el acta; pegar texto sigue | C `lib/studio/bitacora/extract.ts`, `escucha-extract.ts` |
| A4 | **Resúmenes de conversaciones** (cron `conversation-digests`) | Anthropic · `CONVERSATION_DIGEST_MODEL` → acta → por defecto | `ANTHROPIC_API_KEY`, `CONVERSATION_DIGEST_MODEL` | Ninguno | Los resúmenes no se generan | C `lib/studio/conversaciones/digest-extract.ts` |
| A5 | **Lectura asistida de documentos** (prealertas, packing list) | Anthropic · `DOCUMENT_IMPORT_MODEL` | `ANTHROPIC_API_KEY`, `DOCUMENT_IMPORT_MODEL`, `DOCUMENT_IMPORT_ENABLED` | Límite por petición (migración 0457); sin tope de gasto | Responde «no se pudo leer el documento»; el llenado manual sigue. Hoy 401/403 → `configuration_invalid`, el resto → `extraction_unavailable` | C `lib/studio/document-import/anthropic.ts` |
| A6 | **Agentes y Skills** (SDD-0020, Administración › Agentes) | Anthropic · modelo por agente (`AGENT_MODELS`) | `ANTHROPIC_API_KEY`, `LLM_FORCE_MOCK` | Sí: `budget_usd_monthly` contra `spend_usd_mtd` por agente | Las corridas fallan; sin llave cae al simulado | C `lib/studio/agents/runtime/` |
| A7 | **Transcripción de audio** de Bitácora | Cloudflare Workers AI · Whisper (`CF_WHISPER_MODEL`) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CF_WHISPER_MODEL` | Ninguno | Sin audio; pegar texto sigue | C `lib/studio/bitacora/transcribe.ts` |
| A8 | **«Analizar con IA»** en Administración › Actualizaciones de Chatwoot (SDD-0588) | Z.AI · GLM (por defecto `glm-4.6`, API de pago) | `DTD_CHATWOOT_IA_GLM_KEY`, `DTD_CHATWOOT_IA_GLM_URL`, `DTD_CHATWOOT_IA_GLM_MODELO` | Tope en el panel del proveedor (SDD-0588 E3-D15), no en código | El análisis sale «sin IA» (solo la lista de archivos) | C `lib/studio/chatwoot/analisis-motor.ts` |
| A9 | **Panel de salud** `/studio/debug` | Revisa Anthropic y OpenRouter con `GET /models` (sin gasto) | `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | — | Hoy marca 401 como «API key inválida»; un 402 sale como `HTTP 402` | C `lib/studio/integration-health.ts`, `lib/studio/env-status.ts` |
| A10 | **OpenRouter** | Ninguna función lo llama hoy; solo el panel de salud | `OPENROUTER_API_KEY` | — | Nada se cae | C (búsqueda sin otros usos) |

### 2.2 Funciones que pasan por la Oficina (Hermes, en el VPS)

El ERP llama al runtime de la Oficina por HTTP (`OFICINA_RUNTIME_URL`, `OFICINA_RUNTIME_TOKEN`).
Hermes elige el proveedor. El ERP **no ve** el error del proveedor: hoy recibe
`ErrorDelRuntime("http_<status>")` del runtime (C `lib/studio/oficina/runtime-cliente.ts`).

| # | Función | Proveedor · modelo | Dónde está la llave | Tope o freno | Si deja de cobrar | Ev. |
|---|---|---|---|---|---|---|
| H1 | **Despachador del cable** (SDD-0626 Paso 3a), agente `soporte-chatwoot`: redacta borradores | Z.AI · `glm-5.3` (plan de código de tarifa plana); respaldo DeepSeek `deepseek-chat` **quitado** el 2026-11-16 hasta que Sam cree una llave propia | `.env` del perfil en el VPS (fuera del repo) | Sí: `OFICINA_TOPE_MENSUAL_USD`, auto-pausa al 80 %, topes por corrida (`OFICINA_TOPE_LLAMADAS_CORRIDA`, `OFICINA_TOPE_TOKENS_CORRIDA`) | No hay borradores; sin respaldo, cae entero | D `docs/specs/0626-oficina-runtime/spec.md`, `docs/runbooks/oficina-cable.md` §10 |
| H2 | **Noticias automáticas** (SDD-0611): redactor y revisor son perfiles de la Oficina | Por confirmar con Sam | VPS | Por confirmar | No se publican noticias automáticas; quedan en revisión | D `docs/specs/0611-…`, **NV** |
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
- Qué otras suscripciones de IA paga el equipo fuera del ERP (por ejemplo herramientas de
  programación). La pantalla las puede listar como «manuales» (§4.3).

### 2.5 Lo que ya existe y se reutiliza

- `/studio/debug` ya tiene `getEnvStatus()` (variable presente o no, **sin valores**) y
  `integration-health.ts` (sondeo sin gasto de Anthropic y OpenRouter, con
  `METERED_INTEGRATIONS`). Se reutilizan; no se duplican.
- El encargo cita «un aviso de créditos en status» de la SDD-0603. **No se encontró**: la spec de la
  0603 y el código del Studio no tienen ningún aviso de créditos ni saldo (búsqueda de «crédito»,
  «saldo», «credit», «balance», «insufficient» en `app/`, `lib/`, `components/` y
  `docs/specs/0603-*`). Si Sam se refiere a otra pantalla, se ajusta esta sección (D-8).
- Cada motor nuevo ya anota proveedor, modelo, tokens, costo y resultado por llamada
  (`chatwoot_bot_llamadas`, tablas de la Oficina, `asistente_mensajes` de Faro). Esta spec agrega
  **una clasificación común del error**, no un registro paralelo.

## 3. Mapa de dependencias: si cae un proveedor, qué se cae

| Proveedor que deja de cobrar | Se cae | Sigue funcionando |
|---|---|---|
| **Anthropic** | A1 botones de IA de noticias, A2 brief diario, A3 actas y escucha, A4 resúmenes de conversaciones, A5 lectura de documentos, A6 Agentes y Skills; mañana P1 Faro | Publicar noticias a mano, pegar texto en Bitácora, llenar documentos a mano |
| **Z.AI (GLM), llave del ERP** | A8 análisis de actualizaciones de Chatwoot | La lista de archivos cambiados |
| **Z.AI (GLM), llave de la Oficina** | H1 despachador (sin respaldo hoy); probablemente H2 noticias automáticas (NV); mañana P2 si se elige GLM | El ERP entero; la Bandeja de Chatwoot con atención humana |
| **DeepSeek** | Hoy nada del ERP (respaldo quitado). Cuando vuelva: el respaldo de H1. H3 por confirmar | — |
| **Cloudflare Workers AI** | A7 transcripción de audio | Pegar texto |
| **OpenRouter** | Nada (A10) | — |
| **Gemini** | Nada hoy; mañana P2 si se elige | — |

Ningún proveedor de IA tumba operaciones, cobros, portal ni tracking. **I:** lo que más se nota es
Anthropic, porque toca seis funciones del Studio a la vez.

## 4. Pantalla «Estado de la IA»

### 4.1 Dónde va

El Studio no tiene hoy una sección llamada «IA y configuraciones». Lo más cercano es
**Sistema › Administración**, grupo **PRO**, donde ya están «Agentes y Skills» (SDD-0020) y
«Actualizaciones de Chatwoot» (SDD-0588). Se propone una tarjeta nueva en ese grupo,
**«Estado de la IA»**, con ruta `/studio/admin/ia`. La alternativa es una sección nueva en la barra
lateral (D-1).

Acceso: solo administradores del equipo (`requireModuleView("admin")` y rol admin), igual que el
resto de Administración. La pantalla **nunca muestra valores de llaves**, solo si la variable existe.

### 4.2 Qué muestra, por proveedor

Una fila por proveedor (Anthropic, Z.AI del ERP, Z.AI de la Oficina, DeepSeek, Cloudflare Workers
AI, OpenRouter, y los manuales que agregue Sam):

| Columna | De dónde sale |
|---|---|
| **Estado**: Activo · Falta de pago · Llave inválida · Otro error · Sin configurar · Sin uso reciente | El último resultado clasificado (§5) y el sondeo sin gasto |
| **Funciones que dependen** | El mapa de §3, fijo en código (un catálogo, `lib/studio/ia/catalogo.ts`) |
| **Último uso** y **último error** | La última llamada anotada de cada función (fecha y clase de error, nunca el texto del proveedor) |
| **Llave presente** | `getEnvStatus()`: sí o no |
| **Renovación** (fecha, frecuencia, responsable, nota) | Lo carga Sam en la misma pantalla (§4.3) |

Estados según `BRAND.md` (Estados y mensajes, 2026-09-05): «Activo» con icono verde y texto neutro;
«Falta de pago» como **error** (rojo localizado en icono y borde, cuerpo neutro) con la acción
«Recargar en el panel del proveedor»; «Renovación próxima» como **atención** (dorado, texto
`--on-warning`); «Sin configurar» como información. Ningún estado solo por color: siempre texto e
icono. Sin tarjetas recoloreadas. La UI pasa por `/ui-check` antes de su PR.

Botón **«Probar ahora»** por proveedor: sondeo sin gasto (`GET /models` donde exista). Para la
Oficina, una llamada a un punto de salud del runtime que diga qué proveedor responde (D-5).

### 4.3 Datos que carga Sam (no van en Git)

Tabla nueva `ia_suscripciones` (una migración, en su fase): proveedor, cuenta (alias, no correo),
tipo de pago (prepago, mensual, tarifa plana, gratuito), fecha de próxima renovación, frecuencia,
responsable (usuario del Studio), nota libre corta, y **monto opcional** si Sam quiere verlo. RLS:
solo admin del tenant. Es la única fuente de montos y fechas; el repo no los tiene.

**I:** el monto es dato comercial del tenant, no dato personal. Si Sam prefiere no cargarlo, la
pantalla funciona igual (D-4).

## 5. Errores de cobro: decir «falta de pago»

### 5.1 Clasificador común

Un módulo puro, `lib/studio/ia/clasificar-error.ts`, recibe el status HTTP y el cuerpo **ya
recortado** y devuelve una clase:

| Clase | Regla | Mensaje para el equipo |
|---|---|---|
| `falta_de_pago` | HTTP 402; o cuerpo con código o texto de saldo (p. ej. `insufficient_quota`, `insufficient_balance`, `credit balance is too low`, «余额不足» u otros que liste el catálogo de cada proveedor) | «El proveedor X rechazó la llamada por falta de pago o saldo. Recarga en su panel.» |
| `cuenta_suspendida` | HTTP 401 o 403 **con** código o texto de cuenta suspendida, desactivada o de facturación | «La cuenta de X está suspendida. Revisa la facturación.» |
| `llave_invalida` | HTTP 401 sin señal de cobro | «La llave de X no es válida o se revocó.» |
| `limite_de_uso` | HTTP 429 sin señal de cobro | «X está limitando el uso. Se reintenta.» |
| `proveedor_caido` | 5xx, 529, tiempo agotado, conexión | «X no respondió.» |
| `otro` | El resto | «Error de X (código).» |

Reglas de diseño:

- **El catálogo de señales por proveedor** vive en un solo archivo, con pruebas. Los textos exactos
  de cada proveedor se confirman en su documentación al implementar; esta spec no los da por
  verificados (**NV**). Un 429 de Anthropic con «credit balance» y uno de DeepSeek con 402 tienen
  que caer en `falta_de_pago`.
- **Ni el cuerpo ni la llave salen del clasificador**: solo la clase y el status. El cuerpo puede
  traer datos de la cuenta.
- Cada motor (A1 a A8, H1, P1, P2) llama al clasificador en su `catch` y anota la clase en su
  registro existente. Los mensajes que ya ve el usuario (por ejemplo «no se pudo leer el
  documento») suman la causa cuando la clase es `falta_de_pago` o `cuenta_suspendida`.
- `integration-health.ts` usa el mismo clasificador: hoy un 402 sale como «HTTP 402».

### 5.2 Cuando el error viene de la Oficina

El ERP solo ve el status del runtime de Hermes. Hace falta que el runtime devuelva la clase del
proveedor de fondo, o al menos el status original, en una cabecera o un campo del error (D-5). Sin
eso, H1 y H2 solo pueden decir «la Oficina no respondió». **NV:** qué expone Hermes v0.23.1 en sus
errores; se mide antes de la fase 3.

### 5.3 Aviso inmediato

La primera vez que una función recibe `falta_de_pago` o `cuenta_suspendida` en el día, se avisa a
los administradores por el canal de alertas del equipo que elija Sam (D-3), con proveedor, función y
hora. Sin repetir el aviso cada llamada: uno por proveedor y día.

## 6. Recordatorio periódico

- Un cron (`/api/cron/ia-recordatorio`) arma la lista de `ia_suscripciones` con renovación en los
  próximos N días, más los proveedores con error de cobro abierto.
- **Canal y frecuencia los decide Sam (D-2, D-3).** Opciones que ya existen en el ERP: Discord
  (`DISCORD_WEBHOOK_EQUIPO`, SDD-0606), Telegram (Alertas del equipo, bot ya operativo), correo
  (Resend) o aviso dentro del Studio (SDD-0628).
- El mensaje dice proveedor, para qué sirve, fecha y responsable. **El monto solo va si Sam lo pide
  (D-4)**, porque Discord y Telegram salen del Studio.
- Nace apagado con un interruptor propio, como el resto de los crons nuevos.

## 7. Fases

| Fase | Qué entrega | Necesita |
|---|---|---|
| **0 · Esta spec** | Inventario, mapa y plan | Aprobación de Sam |
| **1 · Clasificador** | `clasificar-error.ts` con catálogo y pruebas; `integration-health.ts` lo usa | Nada de base |
| **2 · Motores del ERP** | A1 a A8 anotan la clase y muestran la causa | Fase 1 |
| **3 · Oficina** | El runtime pasa la clase; H1 y H2 la anotan | Fase 1, D-5, sesión de la SDD-0626 |
| **4 · Pantalla** | `/studio/admin/ia` con estado, uso y «Probar ahora»; migración `ia_suscripciones` | Fases 1-2, D-1, D-4; `/ui-check` |
| **5 · Avisos** | Aviso inmediato de cobro y recordatorio periódico | Fase 4, D-2, D-3 |

Faro (P1) y `dtd-bot` (P2) adoptan el clasificador cuando se construyan: sus specs ya anotan
proveedor y costo por llamada.

## 8. Pruebas previstas

- **Clasificador:** tabla de casos por proveedor (402; 401 suspendida frente a 401 llave; 429 con
  texto de saldo frente a 429 de ritmo; 5xx; tiempo agotado; cuerpo vacío). Prueba de propiedad: el
  resultado nunca contiene el cuerpo ni algo con forma de llave.
- **Motores:** cada `catch` pasa un 402 simulado y verifica la clase anotada y el mensaje.
- **Pantalla:** sin variables, todo «Sin configurar»; nunca aparece un valor de variable en el HTML
  (prueba que siembra una llave falsa y la busca en la salida).
- **Base:** RLS de `ia_suscripciones` en PGlite (solo admin del tenant lee y escribe).
- **Recordatorio:** con fechas simuladas, avisa a N días y no repite el mismo día; apagado no hace
  nada.
- Cierre de cada fase de producto con `pnpm verify`.

## 9. Decisiones abiertas para Sam

- **D-1 · Ubicación.** Tarjeta «Estado de la IA» en Administración › PRO (propuesta), o sección
  nueva «IA» en la barra lateral.
- **D-2 · Frecuencia del recordatorio.** Mensual (el día que elijas), quincenal, o N días antes de
  cada renovación (propuesta: 7 días antes, y un resumen el día 1 de cada mes).
- **D-3 · Canal.** Discord del equipo, Telegram, correo o aviso en el Studio. Uno o varios. Y a
  quién: solo tú, o los administradores.
- **D-4 · Montos.** ¿Cargas el monto en la pantalla? ¿Va en el recordatorio o solo en el Studio?
- **D-5 · Oficina.** ¿Autorizas tocar el runtime de Hermes para que devuelva la causa del error del
  proveedor? Lo coordina la sesión de la SDD-0626.
- **D-6 · Lista de proveedores.** Confirma cuáles usa hoy Hermes en el VPS (GLM, DeepSeek, otros) y
  qué suscripciones de fuera del ERP quieres ver en la lista (herramientas de programación, etc.).
- **D-7 · Respuesta ante falta de pago.** Solo avisar (propuesta), o además pausar la función hasta
  que alguien marque «recargado».
- **D-8 · Aviso de créditos de la SDD-0603.** No se encontró en el repo. ¿A qué pantalla te
  referías?

## 10. Fuera de alcance

- Pagar o recargar desde el ERP. La pantalla solo enlaza al panel de cada proveedor.
- Leer saldos por API de los proveedores (pocos lo permiten y piden otra llave). Puede ser una
  fase posterior, por proveedor.
- Cambiar modelos o proveedores de cualquier función.
- Leer el `.env` del VPS o de producción.

## 11. Privacidad y seguridad

- Sin datos personales de clientes. `ia_suscripciones` guarda alias de cuenta y un responsable
  (usuario del Studio); no correos ni datos de tarjeta.
- El clasificador no deja pasar cuerpos de error, que pueden traer el id o el correo de la cuenta.
- La pantalla y el recordatorio nunca muestran llaves, ni truncadas.
- La captura de `ia_suscripciones` pasa por `revisar-datos-ve` en la fase 4 por el campo
  «responsable».
