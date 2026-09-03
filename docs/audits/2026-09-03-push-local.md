---
title: Push - frontera local de suscripción y entrega
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Push · SDD-0373 · evidencia local

## Resultado

SEC-02 tiene correctivo local en cuatro POST y ambos emisores; no se envió
ninguna notificación real. Conservado en el commit local c1e44555.
Validación compartida en entrada y salida,
incluyendo filas antiguas y fallback legacy. Sin migración ni nueva dependencia.

RED de emisores: 45 fallos esperados / 14 positivos. RED de rutas:
101 fallos / 56 positivos. Los fakes observaron que destinos ajenos llegaban
a sendNotification y que los POST persistían entradas inválidas.
No es prueba de conexión interna real, porque DB, VAPID y red están simulados.

GREEN inicial: 294/294. La revisión encontró tres formatos de autoridad
ambiguos: WHATWG los normalizaba de forma distinta a url.parse usado por
web-push. Se reprodujeron tres negativos causales y se corrigió la frontera.
GREEN final: 321/321 en cinco suites; los tres formatos se prueban además en
entradas y emisores. ESLint de implementación y seis archivos de prueba: OK.
Typecheck detectó una aridad de callback en un test; corregida retirando la
columna no utilizada. Typecheck del gate conjunto final pasó. Suite completa
del árbol final: 6.926/6.926 en 543 archivos. No se confundió Vitest con tipos.

Gate completo final: exit 0 con reservas, 14/15 pasos medidos. 167 contratos SQL,
rebuild de 422 migraciones y build de 158 páginas correctos. E2E: 150 aprobados/18 omitidos y dos
timeouts globales de 480 s, aceptados con aviso por el arnés; Cloud omitido.
No equivale a cierre verde completo ni a entrega Push real.

## Contrato observado

| Control | Evidencia |
|---|---|
| Parser unknown y proyección mínima | lib/studio/notify/push-subscription.ts:59 |
| Destinos y claves validados antes de cuatro escrituras | cuatro rutas subscribe/resubscribe de la allowlist |
| Tabla/legacy revalidados al enviar | lib/studio/notify/send-user-push.ts:46 y :73 |
| Tabla no vacía no activa fallback por contener inválidos | lib/studio/notify/send-user-push.ts:59 |
| Operario inválido se conserva sin falso éxito | lib/studio/notify/send-operario-push.ts:76 y :90 |
| Socket timeout de diez segundos | ambos sendNotification; TTL originales conservados |
| No filtrar mensajes del proveedor a logs | errores contienen sólo categoría/status numérico, no endpoint/keys/ID |

Controles positivos: sesión determina identidad/tenant, rebind y rotación
vigentes, lectura legacy sólo con opt-in, cleanup sólo 404/410, fallos
transitorios conservados y contados, éxitos de dispositivos válidos.
Fixtures P256 y auth completamente sintéticos; no suscripciones del usuario.

## Fuentes y límites

La lista de dominios se apoya en fuentes primarias:
[Google](https://web.dev/articles/push-notifications-overview?hl=en),
[Mozilla](https://mozilla-services.github.io/autopush-rs/http.html),
[Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
y [Microsoft WNS](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/wns-overview).
WNS documenta su dominio, no demuestra qué dispositivos del proyecto lo usan.

[web-push](https://github.com/web-push-libs/web-push) documenta un timeout de
socket, no un deadline total. Se confirmó en la dependencia instalada:
src/web-push-lib.js usa url.parse/https.request y destruye la petición al
timeout; no se interpretó un límite de socket como cota del trabajo completo.

No verificado ni corregido por este slice:

- Entrega real y compatibilidad con dispositivos/proveedores actualmente registrados.
- Pertenencia matemática del punto P256: se valida formato, longitud y prefijo.
- Límite total de filas, concurrencia, tamaño global del body o deadline completo.
- Atomicidad/ownership del rebind o borrado global por old_endpoint: comportamiento
  previo conservado, no una auditoría integral de autorización Push.
- Distribución de datos en Cloud, configuración VAPID y estado de producción.

## Revisión de datos

CORRECTO técnico: parser minimiza el objeto; los emisores no imprimen
endpoint/keys ni mensajes externos que puedan contenerlos. Los registros
inválidos no se borran automáticamente. NO VERIFICABLE: retención/proveedores
y recepción efectiva en producción. Aplicación acotada de revisar-datos-ve,
sin declaración de cumplimiento legal.

Release, nuevo push, main, despliegue y pruebas con datos reales conservan
sus autorizaciones independientes. El contador histórico 56/106 no se aumenta
por estas pruebas: SEC-02 pertenece a la auditoría posterior.
