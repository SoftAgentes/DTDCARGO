---
sdd: "0584"
title: "Protección de /register y /deregister de WhatsApp en Chatwoot (paso 4.2 de SDD-0582)"
status: in-progress
author: "Claude Worker «0582 4.2» (Sam)"
created: 2026-10-29
updated: 2026-10-29
supersedes: null
superseded_by: null
related: ["0582", "0583"]
confidencialidad: interno
---

# SDD-0584 — Protección de `/register` y `/deregister` de WhatsApp en Chatwoot

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), paso **4.2** del [checklist](../0582-chatwoot-piloto/checklist.md) («Protección de `/register`»). Va apilada sobre la [SDD-0583](../0583-chatwoot-vps-e1/spec.md) (E1), que es donde vive `infra/chatwoot/`. **No despliega nada:** montar el inicializador en el VPS es otra puerta, con OK nominal de Sam.

## Contexto

- **Decisión B de SDD-0582:** el número principal de WhatsApp se comparte con Kommo, no se migra. Kommo es hoy el único socio del número y lo registró en Meta con su PIN. Están prohibidos `/deregister`, reintentar `/register` y crear la bandeja del número principal sin este paso probado.
- **CW-1, verificado en la etiqueta v4.19.1** de `chatwoot/chatwoot` (commit `caab07a8f000`, leído con `git show`):
  - `app/services/whatsapp/webhook_setup_service.rb`: `perform` llama a `register_phone_number if should_register_phone_number?`. Si la consulta de verificación falla, `phone_number_verified?` cae en `rescue StandardError … false`; entonces `should_register_phone_number?` da `true` y `register_phone_number` llama a `/register` con un PIN aleatorio propio (`fetch_or_create_pin`). Solo se salva si `@is_coexistence` es verdadero o si la salud dice `is_on_biz_app`.
  - `register_phone_number` rescata cualquier error y sigue (`Phone registration failed but continuing`); el error queda en `registration_error`, que `ManualSetupService` muestra.
  - `app/services/whatsapp/webhook_teardown_service.rb`: al borrar una bandeja con `source == 'embedded_signup'`, llama a `/deregister`. **`/deregister` aplica.**
  - Las dos llamadas salen de `app/services/whatsapp/facebook_api_client.rb` (`register_phone_number` y `deregister_phone_number`) con HTTParty. No hay otra llamada a `/register` ni `/deregister` en `app/`, `lib/`, `enterprise/` ni `config/` (`git grep`).
- E1 (SDD-0583) ya tiene Chatwoot en el VPS sin bandejas de WhatsApp.

## Alcance

| Entregable | Dónde |
|---|---|
| Inicializador de Rails montado en solo lectura, en dos redes: (1) `prepend` sobre `Whatsapp::FacebookApiClient#register_phone_number` y `#deregister_phone_number`; (2) `prepend` sobre `HTTParty::Request#perform` para todo `POST` a `/<id>/register` o `/<id>/deregister` | `infra/chatwoot/rails/zz_dtd_proteccion_register.rb` |
| Variable `DTD_WHATSAPP_IDS_PROTEGIDOS` (vacía por defecto) y montaje del inicializador | `infra/chatwoot/compose.yml`, `infra/chatwoot/.env.example` |
| Prueba local en Docker con servidor falso de Graph API y control sin el inicializador | `infra/chatwoot/pruebas/{prueba-register.sh,sonda-register.rb,compose.register.yml,compose.sin-proteccion.yml}` |
| Runbook §8: qué hace, cómo cargar el ID en el VPS, qué hacer ante un bloqueo, vuelta atrás | `docs/runbooks/chatwoot-servidor.md` |

## Fuera de alcance

- Desplegar el inicializador o escribir el ID real en el `.env` del VPS (puerta de abajo).
- Tocar Meta o Kommo, leer el ID real o crear cualquier bandeja de WhatsApp (4.1, 4.3, 4.5).
- Otras llamadas de Chatwoot que cambian el número en Meta: el override del webhook por número (`override_phone_number_callback`, CW-2) y la suscripción de la app a la WABA. Las cubre la lectura por API y la vuelta atrás de 4.5, no este paso.

## Decisiones

| ID | Decisión | Por qué |
|---|---|---|
| R-D1 | Bloquear en el cliente de Meta y, además, en HTTParty por ruta | El cliente da el error más claro; la red de HTTParty cubre una versión futura que llame a Meta sin el cliente. Ruta sin mirar el host: el `POST /<dígitos>/register` no existe en otra API que use Chatwoot |
| R-D2 | **Falla cerrado.** Variable vacía, ausente o con un elemento mal formado → bloqueo para todos los números; sin listas a medias | Un error al escribir el `.env` no puede dejar al número principal sin protección. Hoy no hay bandejas de WhatsApp: el bloqueo total no rompe nada |
| R-D3 | Levantar `DtdProteccionRegister::Bloqueado` en vez de saltarse la llamada en silencio | Chatwoot ya rescata el error en los dos servicios: la bandeja sigue, el webhook se configura y la configuración manual muestra el motivo |
| R-D4 | En logs y mensajes, huella SHA-256 de 8 caracteres del ID; nunca el ID ni el teléfono | Correlación operativa sin dejar identificadores de Meta en los logs (instrucciones de SDD-0582: valores de Meta fuera de Git y de los logs) |
| R-D5 | Si faltan los métodos del cliente, el arranque se cae con `[DTD] protección de /register: faltan …` | Una subida de versión que los renombre no puede dejar la protección apagada en silencio; la prueba de E3 lo ve antes del VPS |
| R-D6 | El cliente se toca dentro de `config.to_prepare` y HTTParty al cargar el archivo | `Whatsapp::FacebookApiClient` es código de la app (Zeitwerk, Rails 7.2.3.1): cargarlo en un inicializador está prohibido; HTTParty 0.24.0 es una gema |

## Allowlist exacta

- `infra/chatwoot/rails/zz_dtd_proteccion_register.rb`
- `infra/chatwoot/compose.yml` (variable y montaje)
- `infra/chatwoot/.env.example` (sección de WhatsApp)
- `infra/chatwoot/pruebas/{prueba-register.sh,sonda-register.rb,compose.register.yml,compose.sin-proteccion.yml}`
- `docs/runbooks/chatwoot-servidor.md` (§1, §7, §8 y registro)
- `docs/specs/0584-chatwoot-proteccion-register/spec.md`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 4.2)
- `docs/specs/README.md` (índice regenerado)
- `.agents/handoffs/0584-chatwoot-proteccion-register.md`

## Aceptación

1. `infra/chatwoot/pruebas/prueba-register.sh` sale 0 con todas las comprobaciones en PASÓ, con la imagen `chatwoot/chatwoot:v4.19.1-ce` fijada por digest y sin tocar Meta:
   - lista válida: el `/register` y el `/deregister` del número protegido no llegan al servidor falso; los de otro número sí; CW-1 de punta a punta no llega a `/register` y sí configura el webhook; un `POST` de HTTParty directo también se bloquea; el error y los logs `[DTD]` no llevan el ID;
   - variable vacía e inválida: modo cerrado, ninguna llamada llega;
   - **control rojo:** sin el inicializador, el `/register` del protegido llega y las exigencias de la lista válida fallan.
2. `docker compose config -q` sigue validando con `.env.example`.
3. Ningún ID real de Meta en Git: los de la prueba son sintéticos (`100000000000001`, `100000000000002`).
4. Fila 4.2 en `entregado` en el mismo commit que el cambio.

## Puertas

| Puerta | Qué cubre | Quién |
|---|---|---|
| Despliegue del inicializador en el VPS | Copiar `rails/zz_dtd_proteccion_register.rb` y el `compose.yml` nuevo a `/srv/chatwoot`, escribir el Phone Number ID del número principal en el `.env` (runbook §8) y recrear | OK nominal de Sam, antes de 4.5 |
| Aceptación del paso 4.2 | Pasar la fila a `aceptado` | Sam (o el Director, si Sam lo delega) |

Ninguna puerta de esta SDD cubre tocar Meta, Kommo ni la base de DTD.

## Evidencia

Corrida local en el registro de seguimiento de abajo y en el handoff `.agents/handoffs/0584-chatwoot-proteccion-register.md`. Etiquetas del programa: **C** para el código de Chatwoot leído en la etiqueta, **R** para la prueba en Docker.

## Seguimiento

- **2026-10-29:** reserva, inicializador, prueba y runbook. `prueba-register.sh` (17:37Z, Docker 29.9.1, imagen por digest `04895c7b…`): **16/16 PASÓ**. Lista válida L0–L8, vacía V1–V2, inválida I1–I2; control sin el inicializador: 7 de 9 exigencias de L fallan y el `/register` del protegido llega al servidor falso, directo y por CW-1 (C1, C2). Fila 4.2 en `entregado`. Detalle en el handoff.
- **2026-10-29 18:58Z:** merge de `codex/0582-e1-chatwoot-vps` (`16546aa2d`, marca 1.3 y Cloudflare Access). Conflicto en `compose.yml` resuelto conservando los dos montajes (marca y protección); `prueba-register.sh` copia también `marca/`. Prueba repetida sobre el merge: **16/16 PASÓ**, control rojo 7 de 9.
