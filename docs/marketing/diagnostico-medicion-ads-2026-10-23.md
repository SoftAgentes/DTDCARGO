# Diagnóstico local de medición Ads y CSP

Dueño: ingeniería/marketing. Fecha: 2026-10-23. Estado: implementado y validado localmente; sin publicar.
SDD-0581; base `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.

## Inventario comprobado por lectura

| Recurso | Fuente | Función y frontera |
|---|---|---|
| gtag.js directo | `components/Analytics.tsx:499` | Un loader de Google Tag Manager, sin contenedor GTM. GA y Ads comparten carga. |
| Inicialización y consentimiento | `components/Analytics.tsx:508` | Default de cuatro señales v2 antes de config; elección local en cookie. |
| page_view | `components/Analytics.tsx:298` | Vistas públicas iniciales/SPA, URL saneada; config GA desactiva page_view automático. |
| conversion y whatsapp_click | `components/Analytics.tsx:367` | Click efectivo WhatsApp; descarta expansión cancelada y enlace de compartir. |
| generate_lead | `components/Analytics.tsx:399` | Captura de contacto/estimado/registro; distinta de conversión Ads. |
| Exclusiones | `components/Analytics.tsx:78` | Rutas privadas/acceso, queries no aprobadas y fragmentos sensibles; History apaga tags antes del cambio. |
| Apagado | `components/Analytics.tsx:45` | `NEXT_PUBLIC_GA_ID=off` elimina GA y Ads del build. Vacío en release conserva respaldo. |
| Banner y actualización | `components/CookieConsentBanner.tsx`, `lib/cookie-consent.ts:93` | Aceptar/rechazar mueve juntas las cuatro señales. |
| CSP | `next.config.ts:63` | Hosts clásicos GA/Ads; público release sin unsafe-eval. Media, WSS y excepciones por ruta independientes. |

Sin contenedores GTM, Meta Pixel ni Cloudflare Insights encontrados en el código
de esta base. Eso no verifica inyecciones externas de un proxy o cuenta remota.
Las afirmaciones históricas de recepción en el README no son prueba de estado vivo.

La conversión Ads se dispara al click efectivo a WhatsApp y lleva `value: 1.0`
y `currency: USD` fijos (`components/Analytics.tsx:367`): es un valor configurado
para esa señal, no ingresos ni una venta comprobada. `whatsapp_click` es el espejo
GA4 de esa interacción y `generate_lead` señala una captura de contacto/estimado/
registro. Son señales distintas. La cola local no acredita cómo la cuenta las
cuenta, cuáles son primarias, cuáles se importan o si una venta ocurrió. Esta
entrega conserva IDs, valores y definiciones; no permite concluir ROAS real ni
que exista duplicación en las cuentas.

## Criterio de corrección

La [guía oficial CSP de Google](https://developers.google.com/tag-platform/security/guides/csp)
describe capacidades adicionales de Ads, iframe y dominios regionales. Su ausencia
en una lista no demuestra un fallo de los flujos que realmente usa este sitio.
No se añaden comodines, unsafe-eval ni servicios sin necesidad reproducida.

Hay un pendiente CSP específico: la [descripción oficial de Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
documenta `pagead2.googlesyndication.com` como ejemplo de dominio alterno cuando
`ad_storage=denied`, para evitar enviar cookies previas de terceros. Ese modo
denied sí está configurado aquí. Los probes locales confirman que connect/img a
ese host quedan bloqueados. Es una sospecha plausible de pérdida de señales sin
consentimiento, con respaldo documental; todavía no demuestra qué endpoint elige
el tag real de esta propiedad hoy, porque deliberadamente no se ejecutó Google.
Falta una traza controlada del recurso/iniciador real antes de abrir CSP según
el umbral del plan P3. No se descarta como servicio inútil ni se declara toda la
CSP correcta o Ads sin incidencias. La corrección de hoy se limita a la cookie.

La [guía oficial de consentimiento](https://developers.google.com/tag-platform/security/guides/consent)
requiere defaults antes de config/event y actualización al decidir. El modo
avanzado permite señales restringidas con denied: no equivale a cero peticiones.

Se confirmó un defecto de lectura local de consentimiento con cookies sintéticas:
la propia denied más una ajena `other_dtd_cookie_consent=granted` inicializaba
las cuatro señales concedidas. Solo la cookie ajena también concedía permiso.
Una propia `granted-synthetic` se aceptaba tanto en init como helper. Chromium y
WebKit reprodujeron ocho fallos y cuatro controles válidos; no se observaron datos
reales ni una fuga a Google porque el loader fue inerte y toda salida estaba cerrada.

Director aprobó ampliar el slice exclusivamente para leer nombre y valor completos
en init/helper, con regresión de ambas lecturas. Valores inválidos o varias cookies
visibles del mismo nombre conservan denied al iniciar; no se cambia el modelo v2,
la UI, los IDs ni la definición de las conversiones. Es la única corrección de
producto justificada hasta ahora. La CSP se conserva.

## Validación y límites

Evidencia local detallada en `docs/qa/0581-medicion-ads-csp-offline.md`: 267 focales,
32 E2E Chromium/WebKit y 12.294 pruebas generales aprobadas, con sus omisiones e
incidencias de la envoltura de ensayo declaradas por separado.
El ensayo no accede a cuentas ni ejecuta scripts reales del proveedor. No puede
certificar recepción Google, atribución, cookies internas, duplicados de acciones
configuradas en las cuentas ni resultados comerciales.
