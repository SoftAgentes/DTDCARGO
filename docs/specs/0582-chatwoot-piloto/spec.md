---
sdd: "0582"
title: "Piloto de Chatwoot con WhatsApp Cloud API y salida de Kommo por fases"
status: proposed
author: "Claude Worker «Chatwoot piloto» (Sam)"
created: 2026-10-28
updated: 2026-10-28
supersedes: null
superseded_by: null
related: ["0020", "0056", "0089", "0147", "0326", "0535", "0564"]
confidencialidad: interno
---

# SDD-0582 — Piloto de Chatwoot con WhatsApp Cloud API y salida de Kommo por fases

> Esta SDD **no instala nada ni toca producción, Kommo ni Meta**. Describe cómo probar Chatwoot
> autohospedado como bandeja de atención con WhatsApp y un bot propio, y bajo qué condiciones DTD
> Cargo deja Kommo. Cada fase tiene su propia puerta de autorización de Sam.

## Pedido de Sam

- 2026-10-28, tras el análisis comparativo de DTD Cargo y Chatwoot: «Piloto de Chatwoot».
- 2026-10-28, mismo hilo (literal, extractos): «Vamos a hacer el piloto de Chatwoot. […] ¿Cómo
  tengo que conectar WhatsApp con esta aplicación? […] Realmente quiero ya pasarme y salirme de
  Kommo, porque la IA de Kommo me sale demasiado costosa.» «Lo único que podría pagar acá es cuando
  genere los bots que voy a generar, que los pueda conectar.» Preguntas: «¿Puedo crear un número
  nuevo y hacer el cambio online?» y «¿puedo agregar en Chatwoot dos canales, dos WhatsApp
  diferentes?»

## Contexto

### Hoy (verificado en `main` ec5786bb8, 2026-10-28)

- **Kommo** es la bandeja real de WhatsApp, Instagram y Facebook y el CRM de leads. El ERP lo
  replica con las Edge Functions `kommo-webhook`, `kommo-sync`, `kommo-writeback` y
  `kommo-push-client` (`supabase/functions/`), las tablas `kommo_contacts`/`kommo_leads` y la
  lógica de atención de `lib/studio/kommo-atencion.ts` y `lib/studio/kommo-conversacion.ts`.
- Costo de Kommo según `docs/marketing/kommo-estado-y-pendientes.md:68-86`: plan Pro US$45 por
  licencia al mes más créditos de IA. El uso real estimado (15.000-18.000 créditos al mes) cae
  entre el paquete de 5.000 (US$29) y el de 50.000 (US$99); no hay escalón intermedio. Los cuatro
  agentes de IA atienden **solo WhatsApp** (l.93).
- El ERP **no usa** la Cloud API de WhatsApp: solo enlaces `wa.me` (`lib/design-tokens.ts:149`,
  `components/WhatsAppFAB.tsx`, `components/Footer.tsx`).
- La bandeja propia de SDD-0056 cubre portal y correo; su Fase 3 (WhatsApp) está diferida por el
  trámite de Meta (`docs/specs/0056-conversaciones/spec.md:135`).
- Fuentes para un bot de estado: RPC `public_track_shipment` (migración 0326, con throttle y
  minimización) y la skill `tracking-concierge` del runtime de agentes (`lib/studio/agents/`).
  El tracking sigue incompleto: `TRACKING_EN_CONSTRUCCION = true`
  (`lib/portal/tracking-en-construccion.ts:69`).
- Servidor de producción: Contabo VPS 8 (24 GB), compartido con otros dos proyectos; la suma de
  límites no debe pasar de 20 GB (`docs/runbooks/servidor-contabo.md`).

### Chatwoot (observado el 2026-10-28, v4.19.1 del 2026-10-24, commit `f785783022ab`)

- Licencia MIT fuera de `enterprise/`. Son de pago en producción, entre otros: Captain (IA), SLA,
  auditoría, roles a medida, SAML y llamadas de voz (`config/features.yml`, `premium: true`).
  **Bots propios, API, webhooks, automatizaciones, macros y widget son MIT.**
- Pila: Rails 7.2 + Sidekiq + Postgres 16 con pgvector + Redis 7. Mínimo recomendado: 4 núcleos y
  4 GB para unas 10.000 conversaciones al día.
- WhatsApp: proveedores `whatsapp_cloud` (Meta directo) y `default` (360dialog); Twilio aparte.
  `Channel::Whatsapp` valida `phone_number` **único en la instalación** y no hay tope de bandejas
  en el núcleo: cada número es una bandeja.
- Bot de agente: Chatwoot hace POST firmado (HMAC) a una URL propia en cada mensaje; el bot
  responde por la Application API y pasa la conversación de `pending` a `open` para dar paso a un
  humano.
- Datos: todo en su Postgres; solo cifra credenciales, no mensajes ni contactos; sin retención
  automática; al borrar un contacto se borran sus conversaciones.

### WhatsApp: reglas de Meta que condicionan el diseño

Fuentes: documentación de Meta for Developers consultada el 2026-10-28 (migración de números,
Embedded Signup, coexistencia). Lo marcado INFERENCIA no está comprobado.

1. **Un número solo puede estar registrado en Cloud API una vez.** Dos plataformas no pueden
   atender el mismo número a la vez por API.
2. **Número nuevo:** se registra en la cuenta de WhatsApp (WABA) del portfolio de Meta de DTD,
   necesita nombre visible aprobado y no puede estar activo en la app de WhatsApp. Empieza con
   límites de envío bajos y calidad desconocida.
3. **Mover el número actual:** Meta conserva nombre visible, calidad, límite de mensajes y
   plantillas elegibles (estas vuelven a calidad UNKNOWN) si el número cambia de WABA; exige
   apagar la verificación en dos pasos. **El historial de chats no se migra**: hay que exportarlo
   de Kommo antes. Meta está cambiando su modelo de cuentas (beta) y la migración por Embedded
   Signup no aplica a las cuentas del modelo nuevo.
4. **Si la WABA ya es de DTD** (y Kommo solo tiene acceso compartido), Chatwoot puede conectarse
   a la misma WABA con una app de Meta propia y un token de usuario del sistema, sin migrar
   nada: el corte es desconectar Kommo y registrar el número en la app nueva. INFERENCIA: hay
   que confirmar en Meta Business Suite quién es el dueño de la WABA.
5. **Coexistencia** (app WhatsApp Business + API en el mismo número) exige ser Solution Partner o
   Tech Provider de Meta. Queda fuera del piloto.
6. Cobro de Meta por mensaje: lo paga DTD en cualquier plataforma; no es costo de Chatwoot.

## Alcance

**Dentro:** diseño de la instalación del piloto, del canal de WhatsApp de prueba, del bot de
estado, de la evidencia y de las puertas de decisión para retirar Kommo.

**Fuera:** instalar en producción, tocar Kommo, Meta o la base de producción, Captain o cualquier
función Enterprise, campañas de marketing por WhatsApp, Instagram y Facebook (fase 3), y retirar
las Edge Functions de Kommo del ERP (otra SDD).

## Diseño por fases

### Fase 0 — Instalación aislada (puerta: OK de Sam a la máquina)

- **Máquina:** propuesta por defecto, una máquina distinta del VPS 8 de producción para no
  acercarse al tope de 20 GB. Opciones en «Decisiones para Sam».
- **Contenedores:** `rails`, `sidekiq`, `postgres` (pgvector/pg16) y `redis` del
  `docker-compose.production.yaml` oficial, con **tag de versión fijo** (no `:latest`), base
  propia (nunca la de DTD) y `ACTIVE_RECORD_ENCRYPTION_*` configurado.
- Dominio con TLS (p. ej. `chat.dtdcargo.com`), cuentas solo para Sam y quien él nombre,
  registro público cerrado (`ENABLE_ACCOUNT_SIGNUP=false`), respaldo diario de Postgres y del
  almacenamiento.
- SMTP de salida por Resend para avisos a agentes. Correo entrante: fuera del piloto.

### Fase 1 — WhatsApp de prueba y bot (puerta: OK de Sam al número y a Meta)

- **Número nuevo** dedicado al piloto (línea que reciba SMS o llamada y no esté en WhatsApp),
  registrado en la WABA de DTD con app de Meta propia y proveedor `whatsapp_cloud`.
- **Bot de estado** como bot de agente de Chatwoot: un endpoint propio verifica la firma HMAC,
  identifica al cliente por teléfono y responde con datos mínimos del envío. Lee del ERP por un
  camino de solo lectura con el mismo throttle y minimización que la RPC 0326. Pasa a humano
  ante intención no reconocida, reclamo o petición explícita. Modelo: el runtime de agentes ya
  existente (Anthropic/OpenRouter), con tope de gasto mensual.
- Mientras dure el piloto, Kommo sigue intacto con el número principal.

### Fase 2 — Corte del número principal (puerta: OK nominal de Sam con fecha y ventana)

Elegir una de dos rutas según «Decisiones para Sam»:

- **2A, mismo número:** exportar historial y contactos de Kommo; confirmar la propiedad de la
  WABA; apagar la verificación en dos pasos; desconectar en Kommo; registrar en Chatwoot;
  verificar plantillas y webhooks; probar entrada y salida.
- **2B, número nuevo definitivo:** el número de la fase 1 pasa a ser el principal; se cambian
  `wa.me` de la web (`lib/design-tokens.ts:149`), anuncios y perfiles; Kommo queda recibiendo en
  el número viejo con aviso automático del número nuevo hasta su vencimiento.

### Fase 3 — Salida completa de Kommo (puerta: OK de Sam; SDD aparte)

Instagram y Facebook en Chatwoot (requiere app de Meta con revisión de permisos de mensajería),
reemplazo del CRM de leads y retiro de las integraciones `kommo-*` del ERP. Se especifica en una
SDD propia cuando la fase 2 esté estable.

## Decisiones para Sam

1. **Máquina del piloto:** (a) VPS de Hermes, que ya está aislado (6 vCPU, 11 GiB), sumando sus
   contenedores; (b) VPS nuevo pequeño solo para Chatwoot; (c) VPS 8 de producción, solo si se
   acepta acercarse al tope de 20 GB.
2. **Ruta de la fase 2:** 2A (mismo número, sin historial) o 2B (número nuevo con anuncio).
3. **Dueño de la WABA actual:** confirmar en Meta Business Suite si el número de WhatsApp de
   Kommo está en el portfolio de DTD o en el de Kommo.
4. **Tope mensual de gasto del bot** (tokens de IA).

## Gobernanza y privacidad

- Antes de la fase 1 se corre `.claude/skills/revisar-datos-ve/SKILL.md` sobre Chatwoot y el bot,
  se añade Chatwoot y Meta (WhatsApp Cloud) al inventario
  `docs/legal/privacidad/inventario-terceros.md` y se revisa el texto de `/privacidad` sobre el
  país de tratamiento.
- Los datos del piloto son de clientes reales desde que el número de prueba reciba mensajes:
  aplican las mismas reglas de PII que el ERP. Nada de contraseñas, tokens ni PII en Git.
- Ninguna fase lee filas de producción sin autorización explícita.

## Aceptación

- **Fase 0:** Chatwoot responde por HTTPS en la versión fijada; registro público cerrado; un
  respaldo restaurado en prueba; uso de memoria medido 72 h bajo el tope acordado.
- **Fase 1:** el número de prueba recibe y envía; una plantilla aprobada se envía fuera de la
  ventana de 24 h; el bot responde una consulta de estado con datos mínimos, rechaza un código
  ajeno sin revelar datos y pasa a humano; las firmas HMAC inválidas se rechazan; el gasto de
  tokens queda bajo el tope.
- **Fase 2:** checklist de corte firmado por Sam; entrada y salida probadas en el número
  principal; historial exportado y guardado fuera de Git.
- Cada fase registra su evidencia en un handoff fechado.

## Allowlist de archivos

Esta SDD: `docs/specs/0582-chatwoot-piloto/spec.md`, el índice que regenere `docs:check` y
`.agents/handoffs/0582-chatwoot-piloto.md`. El código del bot y la infraestructura se allowlistan
en la PR de cada fase.

## Seguimiento

- 2026-10-28: SDD propuesta. Nada instalado. Puertas abiertas: decisiones 1-4.
