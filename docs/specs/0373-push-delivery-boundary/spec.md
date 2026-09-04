---
sdd: "0373"
title: Validación de destinos y suscripciones Web Push
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0146", "0148"]
confidencialidad: interno
---

# SDD-0373 — Frontera local de entrega Web Push

## Objetivo y límites

Cerrar SEC-02: las entradas Push aceptaban cualquier endpoint no vacío y los
emisores lo entregaban a `web-push`. La corrección debe validar el contrato
antes de persistir y volver a validarlo antes de cualquier envío, sin consultar
DNS ni destinos proporcionados por usuarios.

El alcance es local: no cambia proveedor, dependencias, tablas, policies,
outbox ni UI. No usa VAPID real, suscripciones reales, datos de negocio, Cloud,
migraciones, publicación o despliegue.

La numeración reutiliza la SDD-0373 ya preparada para el mismo hallazgo en la
rama local `codex/saneamiento-integral`; no crea una segunda identidad de spec
ni reserva remota. La implementación se traslada como commit atómico, sin
incorporar los demás cambios de esa rama.

## Contrato

- Parser compartido de `unknown`: rechaza `null`, arrays, campos y claves
  inválidos.
- Endpoint HTTPS de hasta 4096 caracteres, sin credenciales, fragmento,
  controles, espacios ni puerto no estándar. Hosts permitidos:
  `fcm.googleapis.com`, `updates.push.services.mozilla.com`, subdominios de
  `push.apple.com` y de `notify.windows.com`. La comparación usa fronteras de
  hostname; nunca substring sobre la URL completa.
- Claves base64url canónicas: `p256dh` de 65 bytes no comprimidos (prefijo 04)
  y `auth` de 16 bytes. `expirationTime` puede faltar, ser `null` o un número
  finito no negativo.
- Sólo se conservan `endpoint`, `keys` y `expirationTime`; los campos extra no
  llegan a persistencia.
- La validación ocurre antes de toda escritura de las rutas Portal, Studio,
  móvil y resubscribe, y antes de ambos emisores. La identidad y el tenant
  siguen saliendo de la sesión.
- Un registro persistido inválido no se envía, no se borra y no se marca como
  exitoso. Se emite un diagnóstico sin endpoint, claves, usuario ni mensaje del
  proveedor.
- Cada llamada a `web-push` conserva su TTL y recibe timeout de socket de
  10 000 ms. Este timeout no se presenta como deadline total del fanout.
- Se conservan el fallback legacy y el cleanup exclusivo para 404/410. Los
  fallos transitorios no eliminan suscripciones.

## Estrategia de pruebas

- RED causal sobre `origin/main`: un endpoint HTTPS local persistido llega al
  mock de `web-push` y cuenta como entrega.
- Unitarios del parser con orígenes admitidos, esquemas/autoridades engañosos,
  longitud máxima, claves y `expirationTime`.
- Contratos de las cinco formas de entrada de los cuatro POST: datos inválidos
  producen 4xx antes de cualquier escritura; los válidos conservan identidad y
  compatibilidad.
- Emisores con mezclas de destinos válidos/inválidos, fallback legacy, 404/410,
  fallos transitorios, TTL y timeout.
- VAPID, Supabase y `sendNotification` siempre simulados; cero tráfico externo.
- Cierre: pruebas enfocadas, lint, typecheck, suite completa, `verify.mjs` y
  build local.

## Allowlist exacta

- `docs/specs/0373-push-delivery-boundary/spec.md`
- `docs/specs/README.md` (generado)
- `docs/audits/2026-09-04-push-local.md`
- `lib/studio/notify/push-subscription.ts`
- `lib/studio/notify/send-user-push.ts`
- `lib/studio/notify/send-operario-push.ts`
- `app/api/portal/push/subscribe/route.ts`
- `app/api/studio/push/subscribe/route.ts`
- `app/api/m/push/subscribe/route.ts`
- `app/api/m/push/resubscribe/route.ts`
- `lib/studio/notify/__tests__/push-subscription-fixture.ts`
- `lib/studio/notify/__tests__/push-subscription.test.ts`
- `lib/studio/notify/__tests__/send-user-push.test.ts`
- `lib/studio/notify/__tests__/send-user-push-boundary.test.ts`
- `lib/studio/notify/__tests__/send-operario-push.test.ts`
- `app/api/studio/push/__tests__/subscribe-identity.test.ts`
- `app/api/studio/push/__tests__/subscribe-boundary.test.ts`

## Gobernanza aplicable

- `SGE-00.05/.06`: cumplimiento esperado mediante negativos antes de DB/red.
- `SGE-00.02/.07`: conservar registros inválidos y no anunciar entrega exitosa.
- `SGE-00.01/.08/.09/.11`: parser único, flujo compatible y errores sin secretos.
- `SGE-00.03/.04`: no se crea nueva permanencia ni operación financiera; el
  cleanup 404/410 existente no se amplía.
- `AUD-01/AUD-02`: no copiar secretos a logs ni cambiar retención o consulta.
- `ERR-01`: rechazo seguro antes de mutación.
- `SGE-00.10`: no aplica; no hay cambio visual ni de interacción.
- `SGE-00.12`: las compuertas externas permanecen separadas.

## Criterios de cierre

- [x] RED causal reproducido con fixture sintético y sin red.
- [x] La frontera compartida bloquea destinos y claves inválidos en entrada y salida.
- [x] Los orígenes documentados y el comportamiento compatible permanecen cubiertos.
- [x] TTL existente y timeout de socket de 10 s están verificados por contrato.
- [x] Gates locales deterministas y recibo técnico finalizados; los E2E que
  requieren entorno quedan identificados, no ocultos.

## Privacidad

Se minimiza el objeto que ya se capturaba; no se crea un dato o destinatario
nuevo. Endpoint y claves son sensibles y no se imprimen. Los registros
incompatibles se conservan para revisión en vez de borrarse automáticamente.
Este cierre técnico no declara cumplimiento legal ni estado de producción.
