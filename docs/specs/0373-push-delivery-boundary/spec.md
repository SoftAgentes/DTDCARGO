---
sdd: "0373"
title: Validación de destinos y suscripciones Web Push
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0146", "0148", "0371", "0372"]
confidencialidad: interno
---

# SDD-0373 — Frontera local de entrega Web Push

## Fuente y límites

SEC-02 de AUDIT-2026-09-03.md: cuatro entradas aceptan endpoint no vacío y
dos emisores lo entregan a web-push. No se demostró acceso a red interna real.
Slice local autorizado en la cola continua; sin Cloud, VAPID real, envío,
datos reales, publicación o despliegue. No cambia proveedor ni dependencias.

Numeración: pnpm sdd:next consultó15 refs y devuelve 0371/0425. Al unir las refs
con 0371/0372 ya ocupados por esta misma sesión,0373 está libre. Sin reserva
remota; revalidar antes de integrar.

## Contrato

- Parser compartido de unknown: rechaza null, arrays, campos/claves inválidos.
- Endpoint HTTPS de hasta4096 caracteres, sin credenciales, fragmento, controles,
  espacios ni puerto no estándar. Hosts permitidos: fcm.googleapis.com,
  updates.push.services.mozilla.com, subdominios de push.apple.com y de
  notify.windows.com. Comparación por hostname con frontera de etiqueta,
  nunca substring ni regex sobre la URL completa. No habilitar hosts nuevos
  automáticamente. No consultar DNS ni endpoints de usuarios para validar.
- Claves base64url canónicas: p256dh65 bytes no comprimidos (prefijo04),
  auth16 bytes. expirationTime opcional, null o número finito no negativo.
  Sólo conservar endpoint, keys y expirationTime; descartar campos adicionales.
- Aplicar antes de toda escritura de los cuatro POST y antes de ambos envíos,
  incluyendo fallback legacy. Identidad/tenant siguen proviniendo de sesión.
- Registros persistidos inválidos no se envían, borran ni marcan exitosos.
  Conservar filas y aviso diagnóstico sin endpoint/keys; no silencioso.
- Socket timeout10000ms por intento; no es deadline total ni soluciona por
  sí solo acumulación de suscripciones. Se conserva fanout y TTL existentes.
- Mantener limpieza únicamente404/410, contador de fallo transitorio, opt-in
  legacy, rebind y rotación actuales. No cambiar policies/tablas/outbox/UI.

## Fuentes primarias

- Google: https://web.dev/articles/push-notifications-overview?hl=en
- Mozilla: https://mozilla-services.github.io/autopush-rs/http.html
- Apple: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Microsoft (dominio WNS; no prueba una suscripción real del proyecto):
  https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/wns-overview
- web-push (timeout de socket, no duración total):
  https://github.com/web-push-libs/web-push

Lista inicial basada en documentación; compatibilidad de dispositivos reales
permanece no verificada, sin ampliar el alcance a leer endpoints productivos.

## Allowlist exacta

- lib/studio/notify/push-subscription.ts (nuevo parser; principal).
- app/api/portal/push/subscribe/route.ts
- app/api/studio/push/subscribe/route.ts
- app/api/m/push/subscribe/route.ts
- app/api/m/push/resubscribe/route.ts
- lib/studio/notify/send-user-push.ts
- lib/studio/notify/send-operario-push.ts
- lib/studio/notify/__tests__/push-subscription.test.ts (agente de pruebas).
- lib/studio/notify/__tests__/push-subscription-fixture.ts (agente de pruebas).
- lib/studio/notify/__tests__/send-user-push.test.ts (agente de pruebas).
- lib/studio/notify/__tests__/send-operario-push.test.ts (agente de pruebas).
- app/api/studio/push/__tests__/subscribe-identity.test.ts (agente de pruebas).
- app/api/studio/push/__tests__/subscribe-boundary.test.ts (agente de pruebas).
- Esta spec, docs/specs/README.md generado, docs/audits/2026-09-03-push-local.md
  y docs/audits/2026-09-02-codex-arranque-checklist.md (principal).

## Gobernanza aplicable

SGE-00.05/.06: cumplimiento esperado con negativos antes de DB/red.
SGE-00.02/.07: conservar registros inválidos y no anunciar entrega exitosa.
SGE-00.01/.08/.09/.11: mismo flujo, parser único y error recuperable sin secretos.
SGE-00.03/.04: no aplica nueva permanencia/operación financiera; cleanup
404/410 existente sin ampliar. AUD-01/02: no copiar secretos a logs ni cambiar
retención/consulta de auditoría. ERR-01: rechazo seguro antes de mutación.
SGE-00.10: no aplica cambio visual/interacción. SGE-00.12: gates externos
conservados. No constituye aprobación global del legado de Push.

## Plan

- [x] RED causal con rutas y emisores existentes, sin llamadas de red.
- [x] Implementación y GREEN; validar positivos sintéticos de cada proveedor.
- [ ] Suite, typecheck, lint y documentación de límites.
- [ ] Release y smoke de dispositivos reales: permisos independientes.

## Privacidad

Se minimiza el objeto ya capturado; no se crea dato ni destinatario nuevo.
Endpoints y claves son sensibles, nunca imprimirlos. No limpiar registros
incompatibles automáticamente. Límites técnicos, no declaración legal.
