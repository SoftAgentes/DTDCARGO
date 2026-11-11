# Handoff · SDD-0584 · protección de `/register` (paso 4.2 de SDD-0582)

- **Fecha:** 2026-10-29
- **Worker:** Claude (sesión lanzada por la sesión del programa SDD-0582)
- **Rama:** `codex/0582-e4-register`, apilada sobre `codex/0582-e1-chatwoot-vps` (PR #329) en `b1dc337af`
- **Worktree:** `DTD-worktrees/0582-e4-register` (claim `local_ac877be6-0582-e4-register`)
- **Reserva:** SDD-0584, local: `codex/sdd-reserve-0584-chatwoot-proteccion-register` y `refs/dtd/reservations/0584` (`53550af7d`). Sin publicar, igual que la 0583. El stub nunca se fusiona.
- **Spec:** [`docs/specs/0584-chatwoot-proteccion-register/spec.md`](../../docs/specs/0584-chatwoot-proteccion-register/spec.md)

## Qué quedó

| Archivo | Qué |
|---|---|
| `infra/chatwoot/rails/zz_dtd_proteccion_register.rb` | Inicializador con dos redes: `prepend` sobre `Whatsapp::FacebookApiClient#register_phone_number` y `#deregister_phone_number`, y sobre `HTTParty::Request#perform` para todo `POST /<id>/(de)register`. Lee `DTD_WHATSAPP_IDS_PROTEGIDOS`; falla cerrado; logs con huella SHA-256 de 8 caracteres |
| `infra/chatwoot/compose.yml` | Variable `DTD_WHATSAPP_IDS_PROTEGIDOS: ${CHATWOOT_WHATSAPP_IDS_PROTEGIDOS:-}` y montaje `:ro` en prepare, rails y sidekiq |
| `infra/chatwoot/.env.example` | `CHATWOOT_WHATSAPP_IDS_PROTEGIDOS=` (vacía) con su explicación |
| `infra/chatwoot/pruebas/prueba-register.sh` + `sonda-register.rb` + `compose.register.yml` + `compose.sin-proteccion.yml` | Prueba local con servidor falso de Graph API dentro del contenedor (`prepare`, red `interna` sin internet) y control sin el inicializador |
| `docs/runbooks/chatwoot-servidor.md` | §8 nuevo; §1, §7 y registro |
| `docs/specs/0582-chatwoot-piloto/checklist.md` | Fila 4.2 → `entregado`, 0,4 d reales, restante 0 |

## Evidencia

**C (código de Chatwoot, etiqueta v4.19.1, commit `caab07a8f000`, leído con `git show` en un clon superficial del scratchpad):**
- CW-1 confirmado tal cual: `webhook_setup_service.rb`, `phone_number_verified?` con `rescue StandardError … false` y `register_phone_number` con PIN aleatorio propio, que Meta toma como PIN de verificación en dos pasos (no el código del SMS; 10 `/register` cada 72 h; SDD-0582 V3-3).
- `/deregister` **sí aplica**: `webhook_teardown_service.rb` lo llama al borrar una bandeja con `source == 'embedded_signup'`.
- Las dos llamadas salen solo de `facebook_api_client.rb`, con HTTParty 0.24.0. Rails 7.2.3.1, Ruby 3.4.4.

**R (prueba local, `PRUEBA_TRABAJO=C:/tmp/cw-register bash infra/chatwoot/pruebas/prueba-register.sh`, 2026-10-29 17:37Z, exit 0):**

| Comprobación | Resultado |
|---|---|
| L0 inicializador con 1 ID, log de arranque sin el ID | PASÓ |
| L1 `/register` protegido: Bloqueado, 0 llamadas | PASÓ |
| L2 error con huella; ningún log `[DTD]` ni mensaje con el ID | PASÓ |
| L3 `/register` de otro número: 1 llamada | PASÓ |
| L4 `/deregister`: protegido 0, otro 1 | PASÓ |
| L5 HTTParty directo: Bloqueado | PASÓ |
| L6 CW-1 de punta a punta: 0 `/register`, webhook sí, `registration_error` Bloqueado | PASÓ |
| L7 CW-1 con otro número: sí registra | PASÓ |
| L8 lectura de la variable (11 entradas malas → cerrado; lista con espacios → 2) | PASÓ |
| V1–V2 variable vacía: modo cerrado, 0 llamadas | PASÓ |
| I1–I2 variable inválida (`<id>,abc`): modo cerrado, 0 llamadas | PASÓ |
| C1 control: sin inicializador el `/register` del protegido llega (directo y por CW-1) | PASÓ |
| C2 control rojo: 7 de 9 exigencias de L fallan sin el inicializador | PASÓ |

Ejemplo de log (ID sintético): `[DTD] /register bloqueado (Phone Number ID protegido; huella 11d77ab5). El número lo opera otro socio…`. Chatwoot lo envuelve en `[WHATSAPP] Phone registration failed but continuing: …`. Limpieza al final: 0 contenedores y 0 redes del proyecto `chatwoot-register`.

## Validación por check

| Check | Estado |
|---|---|
| `prueba-register.sh` (Docker, v4.19.1-ce por digest) | PASÓ (16/16) |
| `docker compose --env-file .env.example config -q` | PASÓ |
| `docs:check` (índice regenerado, 567 specs) | PASÓ |
| `sdd:check` (`check-numbering.mjs`) | PASÓ (sin números repetidos; avisos históricos de siempre) |
| `bash -n prueba-register.sh` | PASÓ |
| `ensayo-local.sh` completo de E1 con el montaje nuevo | NO EJECUTADO: es una corrida pesada de ~15 min con Traefik. El inicializador se cargó y aplicó en el mismo arranque de Rails que usan rails y sidekiq (L0, L1). Riesgo bajo; conviene correrlo antes del despliegue |
| `pnpm verify` | NO APLICA: el cambio es infraestructura de Chatwoot y docs; no toca la app de DTD |

Avance del programa: 5,0 % al entregar; **5,8 %** con 4.2 aceptado (2026-10-29).

## Pendiente de esta tarea

1. ~~Aceptación de 4.2~~: **aceptado** por Sam el 2026-10-29 («Acepto todo», en la sesión del programa). No autoriza el despliegue (punto 2).
2. **Puerta de despliegue (OK nominal de Sam, antes de 4.5):** copiar `rails/zz_dtd_proteccion_register.rb` y el `compose.yml` nuevo a `/srv/chatwoot`, escribir el Phone Number ID del número principal en el `.env` con `read -s` (runbook §8) y `docker compose up -d`. Comprobar dos líneas `activa: 1 ` y ninguna `modo cerrado`. Mientras no se despliegue, el VPS no tiene el inicializador, pero tampoco tiene bandejas de WhatsApp.
3. Integración: la PR va sobre `codex/0582-e1-chatwoot-vps`; se integra después de la #329.

## FUERA DE ALCANCE DETECTADO

- **Override del webhook por número (CW-2).** Con la protección, `WebhookSetupService` sigue llamando a `override_phone_number_callback` sobre el número protegido (L6 lo mide: 1 llamada). Si ese override afecta solo a la app de Chatwoot o también a lo que recibe Kommo está **NV** (I: Meta lo documenta por app, pero no está medido en la cuenta de DTD). La decisión B y la fila 4.5 ya lo prevén (lectura por API de suscripciones y overrides, y vuelta atrás). Sigue siendo el riesgo grande de 4.5; no lo cubre este paso.
- **`subscribe_app_to_waba`** reescribe `subscribed_fields` de la app de Chatwoot en la WABA. Con una app propia de DTD (4.1) no toca la de Kommo, pero conviene comprobarlo en la lectura de 4.5.
