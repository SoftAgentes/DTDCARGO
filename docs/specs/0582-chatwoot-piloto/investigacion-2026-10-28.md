# Registro de evidencia — SDD-0582 (2026-10-28/29)

## Etiquetas

- **C**: el código lo permite.
- **D**: el proveedor lo documenta.
- **T**: la cuenta de DTD lo tiene.
- **R**: probado en runtime.
- **I**: inferencia.
- **NV**: no verificado.

**A la fecha no hay ninguna afirmación T ni R.**

## Fuentes

- **Chatwoot:** repositorio `chatwoot/chatwoot` en `f785783022ab` (v4.19.1, 2026-10-24). Rutas leídas con `git show HEAD:<ruta>`.
- **Repo DTD:** `main` `ec5786bb8`.
- **Documentación externa:** consultada el 2026-10-28.
- **Revisiones:** 4 investigaciones de solo lectura con verificador adversarial, más una segunda revisión independiente de Codex (CLI 0.165.0, solo lectura), cuyas correcciones se incorporaron.

Este registro no contiene datos personales.

## Chatwoot (código)

| ID | Afirmación | Fuente | Etiqueta | Límite |
|---|---|---|---|---|
| CW-1 | Si la consulta de verificación del número falla, `phone_number_verified?` devuelve `false` y `should_register_phone_number?` dispara `/register` con un PIN propio | `app/services/whatsapp/webhook_setup_service.rb` (`should_register_phone_number?`, `phone_number_verified?` con `rescue … false`, `register_phone_number`) | C | Motiva el paso 4.2 |
| CW-2 | Borrar la bandeja solo vacía el override por número; no restaura el anterior | `app/services/whatsapp/webhook_teardown_service.rb` (`clear_phone_number_override`) | C | Motiva guardar los valores previos en 0.3 |
| CW-3 | Un agente ve una conversación por bandeja **o** por equipo | `app/policies/conversation_policy.rb` (`inbox_access? \|\| team_access?`) | C | Contactos: `app/policies/contact_policy.rb` |
| CW-4 | El job del agent bot registra el payload completo en los reintentos | `app/jobs/agent_bots/webhook_job.rb:13` (`payload=#{payload.to_json}`) | C | Motiva la redacción de logs en 1.7 |
| CW-5 | Una bandeja API puede enviar correo de continuidad si está activada `email_continuity_on_api_channel` | `app/services/messages/send_email_notification_service.rb` (`email_reply_enabled?`) | C | Motiva el modo sin efectos de 5.5 |
| CW-6 | `X-Frame-Options` no se configura en `config/`: es el valor por defecto de Rails; solo el widget y el portal lo quitan | `git grep` en `config` y `app`: `widgets_controller.rb:90` y `public/api/v1/portals/base_controller.rb:68` | C | Rails permite `default_headers`, pero la imagen no lo expone |
| CW-7 | El panel admite un script propio por `DASHBOARD_SCRIPTS`, excepto en rutas sensibles | `app/controllers/dashboard_controller.rb:56` y `config/installation_config.yml:343` | C | Base de la guía dentro de Chatwoot (9.4) |
| CW-8 | `set_agent_bot` asigna o quita el bot de la bandeja y no cancela trabajos en curso | `app/controllers/api/v1/accounts/inboxes_controller.rb:69-77` | C | Motiva comprobar el modo antes de enviar (7.6) |
| CW-9 | Los webhooks incluyen mensajes salientes, y las notas privadas son mensajes salientes | `app/models/concerns/message_filter_helpers.rb` (`webhook_sendable?`) | C | Motiva el filtro de autor y privacidad |
| CW-10 | Una respuesta humana no abre una conversación `pending` | `app/models/message.rb:418` (solo reabre las pospuestas) | C | El bot hace el traspaso |
| CW-11 | El token SSO dura 5 minutos y después se crea una sesión de agente | `app/models/concerns/sso_authenticatable.rb:4-7` y `app/controllers/devise_overrides/sessions_controller.rb:83-94` | C | Revocación en 2.7 |
| CW-12 | IMAP lee solo `INBOX` y, por defecto, desde ayer | `app/services/imap/base_fetch_email_service.rb:135-161` | C | Prueba de caída en 4.8 |
| CW-13 | `GET /api` da la versión, y existe un job que avisa de versiones nuevas | `config/schedule.yml` (`internal_check_new_versions_job`) | C | Vigilante de 3.2 |

## Proveedores (documentación)

| ID | Afirmación | Fuente | Etiqueta | Límite |
|---|---|---|---|---|
| D-1 | El modelo nuevo de cuentas de Meta permite compartir un número entre integraciones | developers.meta.com/resources/videos/whatsapp-account-model-evolution | D | NV para la cuenta de DTD; la recepción doble es I |
| D-2 | Kommo expone `GET /api/v4/talks/{talk_id}/messages` con el alcance «External chat history» | developers.kommo.com/reference/get-conversation-messages | D | Plan y permisos de DTD: NV; se prueba en 0.6 |
| D-3 | Sin método de pago, ciertos mensajes dejan de entregarse al superar la franquicia | support.kommo.com/docs/whatsapp-business-pricing-rules | D | Motiva el pago propio en 0.7 |
| D-4 | Los alias de Hostinger no envían desde aplicaciones externas | hostinger.com/support/4469114 | D | Qué es `info@` en DTD: NV (0.5) |
| D-5 | Rails permite configurar `config.action_dispatch.default_headers` | guides.rubyonrails.org/v7.2/configuring.html | D | — |
| D-6 | La API de OpenAI no lista a Venezuela | developers.openai.com/api/docs/supported-countries | D | Fecha de consulta: 2026-10-28 |
| D-7 | La política de regiones de Anthropic, vigente desde el 2026-11-12, no lista a Venezuela | anthropic.com/legal/supported-regions | D | Afecta al runtime de agentes del ERP (fuera de alcance) |
| D-8 | Gemini lista a Venezuela; sus términos de pago permiten conservación temporal y tratamiento internacional | ai.google.dev/gemini-api/docs/available-regions y ai.google.dev/gemini-api/terms | D | «No entrena» no es «no conserva» |
| D-9 | El DPA de Z.ai dice tratamiento «generalmente» en Singapur | docs.z.ai/legal-agreement/privacy-policy | D | No hay residencia exclusiva |
| D-10 | El GLM Coding Plan incluye trabajo de oficina, pero restringe herramientas y escenarios | docs.z.ai/devpack/overview y docs.z.ai/devpack/faq | D | El uso concreto se comprueba en 3.4 y 7.1 |
| D-11 | OpenCode Go exige tráfico de agentes de programación; OpenCode Server autentica y expone sesiones y configuración | opencode.ai/v2/docs/console/go y opencode.ai/docs/server | D | Si se usa, va aislado (3.4) |
| D-12 | Chatwoot pide acceso avanzado de permisos para Messenger en producción | developers.chatwoot.com/self-hosted/configuration/features/integrations/facebook-channel-setup | D | Qué nivel necesita DTD: NV (4.4) |

## Repo DTD

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| R-1 | Kommo aparece en 209 archivos fuera de docs (2.965 coincidencias) | `rg -i kommo` excluyendo docs, `.agents`, `graphify-out`, `*.md` y `.harness` | C |
| R-2 | El módulo CRM es `kommo` | `lib/studio/modules.ts:128` | C |
| R-3 | El alta empuja a Kommo con `kommo-push-client` | `app/registro/actions.ts:441-460` | C |
| R-4 | El cotizador encola writeback de valor y de etapa | `app/studio/(app)/cotizador/actions.ts:339,349` | C |
| R-5 | El reporte por asesor y el KPI de leads leen el espejo de Kommo | `lib/studio/reports/queries.ts:589-692` y `lib/studio/dashboard/dashboard-kpi-queries.ts:243` | C |
| R-6 | El cron `kommo-contact-status` corre en Vercel y en el VPS | `vercel.json:18` y `infra/dtd-cargo/cron/crontab:10` | C |
| R-7 | Las preferencias por usuario viven en la base, con RLS por dueño | `supabase/migrations/0233_user_dashboard_prefs.sql` | C |
| R-8 | Contrato de hidratación de preferencias del navegador | `app/studio/_components/__tests__/browser-preference-hydration-contract.test.ts` | C |
| R-9 | En Studio no hay una librería de recorridos guiados | búsqueda de `driver.js`, `shepherd`, `react-joyride`, `coachmark` y `walkthrough` | C |
| R-10 | Existe una outbox persistente de writeback a Kommo | `lib/studio/kommo-writeback.ts` y la migración 0136 | C |

## Inferencias y no verificados (pendientes de E0)

| ID | Afirmación | Etiqueta | Se resuelve en |
|---|---|---|---|
| I-1 | Kommo y Chatwoot reciben a la vez el mismo número | I | 4.5 |
| I-2 | Costo del bot: US$3–15 al mes; ahorro frente a hoy: US$19,50–31,50 al mes | I | 7.1 y 7.5 |
| I-3 | Calendario: 15–19 semanas; mínimo de 60 días | I | Reestimación al cerrar E0 |
| NV-1 | Configuración privada de Meta de DTD (propiedad, apps, tokens, callbacks, 2FA, pago, 2.º número) | NV | 0.3 |
| NV-2 | Disponibilidad general del modelo nuevo de Meta, tope de 10 registros cada 72 h y alcance de los 20 mensajes por API | NV | 0.3 |
| NV-3 | Elegibilidad de TikTok en Venezuela, Human Agent y Business AI por canal | NV | 0.7 y 4.4–4.7 |
| NV-4 | Plan y permisos de Kommo, volumen, adjuntos, exportación del conocimiento, 15 Salesbots y renovación | NV | 0.2, 0.4 y 0.6 |
| NV-5 | Qué es `info@`, el producto de correo de Hostinger y qué flujo de Resend Inbound está activo | NV | 0.5 |
| NV-6 | Cuotas de Gemini y Z.ai, términos de Kimi Code y Entity List | NV | 7.1 |
| NV-7 | Precio y recursos efectivos del VPS, costo de B2 y capacidad bajo carga | NV | 0.2 y 1.6 |
| NV-8 | Iframe y SSO en navegadores reales, imagen `v4.19.1-ce`, restauración, importación y tráfico real | NV | 1.5, 2.1 y 5.6 |
