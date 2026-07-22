---
sdd: "0167"
title: "Actualidad — centro editorial público"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-22
updated: 2026-07-22
supersedes: null
superseded_by: null
related: ["0088", "0089"]
confidencialidad: interno
---

# DTD-0167 — Actualidad · centro editorial público

## 1. Decisión aprobada

`/noticias` conserva su URL canónica y pasa a presentarse como **Actualidad** en
la navegación principal. La portada usa el título aprobado **“Actualidad, guía
y noticias”** y reúne guías permanentes, noticias logísticas, análisis y casos
reales. No se crea `/blog` ni un segundo CMS.

## 2. Alcance de esta implementación

- mover Actualidad fuera del menú Ayuda;
- rediseñar la portada con hero compacto, categorías no vacías, destacado,
  últimas publicaciones y archivo;
- mostrar el buscador al alcanzar ocho publicaciones;
- paginar el archivo cada 12 publicaciones;
- usar fotografías operativas locales como respaldo;
- adaptar artículos con portada 16:9, respuesta directa, índice, autoría,
  revisión opcional, relacionados y newsletter al final;
- emitir `BlogPosting`, `NewsArticle` o `Article` según el tipo de contenido;
- dejar de emitir `FAQPage` automáticamente;
- consumir publicaciones por `lib/public/`, sin importar el backend del ERP
  desde componentes públicos.

## 3. Compatibilidad sin migración

La UI funciona con el esquema actual de `news_posts`. Mientras no se apruebe la
migración editorial, deriva el tipo desde `tipo` y `categoria`, usa la fecha de
publicación como referencia y asigna una fotografía operativa por categoría.

Campos futuros, todos opcionales para la web:

- `content_kind`: `guide`, `news`, `analysis` o `case`;
- `cover_image_url` y `cover_alt`;
- `featured`;
- `reviewer_name` y `reviewer_role`;
- `updated_at` ya existe y se cablea como fecha de modificación.

La migración para estos campos no forma parte de esta autorización y debe
aprobarse por separado.

## 4. Newsletter

El newsletter es exclusivamente por email. La implementación local agrega:

1. tabla privada `newsletter_subscribers` con RLS y sin lectura anónima;
2. endpoint `/api/newsletter/subscribe` con validación, honeypot, throttle,
   lista de exclusión e idempotencia;
3. baja firmada extendida para audiencia `newsletter`, independiente de
   `clients`;
4. formulario activo en `/noticias` y artículos, sin opción de WhatsApp.

El envío administrativo se implementa como un flujo deliberadamente manual:

1. el equipo de Marketing crea y edita un borrador con vista previa;
2. el borrador pasa a revisión;
3. solo un administrador puede aprobarlo y congelar la audiencia;
4. antes de enviar se puede mandar una prueba al correo interno de Mailing;
5. solo un administrador inicia cada lote real, con máximo 100 destinatarios;
6. si quedan destinatarios, el siguiente lote requiere otro clic explícito;
7. se bloquea una tercera campaña dentro del mismo mes calendario;
8. publicar una noticia nunca crea ni envía una campaña.

La migración `0260_newsletter_campaigns.sql` crea campañas y snapshots de
destinatarios privados, RLS fail-closed y un RPC `service_role` para reclamar
lotes de forma atómica. Cada lote usa una clave idempotente de Resend y cada
correo incluye baja visible y encabezados RFC 8058. Entregas, aperturas, clics,
rebotes y quejas se sincronizan desde el webhook existente.

Las migraciones `0259_newsletter_subscribers.sql` y
`0260_newsletter_campaigns.sql` ya fueron aplicadas. La 0260 fue verificada el
2026-07-22 contra objetos reales: tablas con RLS, sin grants directos para
`anon`/`authenticated`, RPC de lotes exclusivo de `service_role`, RPC de lectura
limitado a roles autorizados y sin asesores nuevos para estas tablas.

Preview de validación:
`https://dtdcargo-pkge69mpf-hailu-wey.vercel.app` (deployment
`dpl_4r5asFg25bp1pLfFfrPCQNfDqpuC`, READY). El 2026-07-22 se validó con una
sesión administrativa real el flujo borrador → prueba interna → revisión →
aprobación. La aprobación congeló una audiencia de un suscriptor, conservó el
hash del contenido aprobado y creó un solo destinatario pendiente. No se inició
ningún lote real: la campaña de prueba quedó `cancelled`, con cero envíos y su
destinatario marcado `skipped` para impedir un despacho accidental. Activar
campañas reales todavía requiere:

El mismo día se ejecutó un lote controlado: un destinatario interno enviado y
confirmado como `delivered`, un destinatario externo omitido antes del despacho,
cero envíos externos y cero fallos. Al abrir la baja firmada, el correo del
Preview dirigió al dominio público, cuya ruta todavía usa el flujo anterior de
marketing: mostró la confirmación de marketing y no actualizó
`newsletter_subscribers`. El registro interno se reparó a `unsubscribed` después
del consentimiento explícito, pero este gate técnico sigue abierto.

La corrección quedó construida y validada visualmente en el Preview
`https://dtdcargo-jnag8kgv4-hailu-wey.vercel.app` (deployment
`dpl_2R4EQ46zLmJ7WjfLdqZvdQFWwvqR`, READY) el 2026-07-22. Los correos generados
en Preview ahora usan el hostname exacto del deployment, mientras producción
conserva el canonical público. El endpoint procesa la baja y redirige a
`/email/baja` sin dejar el token ni el correo en la URL. La pantalla de marca
incluye estados separados para Actualidad, marketing, enlace inválido y error,
con `noindex`; se verificó en 1440 y 390 px, en tema claro y oscuro. También se comprobó en el Preview
que un token inválido termina en `estado=invalido` sin exponer el token.

El 2026-07-22 se repitió la prueba desde ese deployment con el suscriptor interno
reactivado mediante el formulario público. Se creó exactamente un `mail_log`
nuevo para `vzla@dtdcargo.com`, Resend lo confirmó como `delivered` y la ventana
de auditoría registró cero destinatarios externos. El enlace sí abrió
`/api/email/unsubscribe` en el hostname exacto del Preview y retiró el token al
redirigir, pero terminó en `estado=invalido`: la firma no fue aceptada y
`newsletter_subscribers.status` permaneció en `subscribed`. No hubo reparación
manual. Por tanto, el gate firmado sigue **fallido** y campañas reales continúan
bloqueadas.

El diagnóstico sin PII se desplegó después en el Preview
`https://dtdcargo-j6tgb6pxy-hailu-wey.vercel.app`. La huella emitida y la huella
del enlace recibido en el correo coincidieron, pero la solicitud que llegó al
endpoint registró `tokenPresent = false`: Outlook retiró la consulta
`?token=...` antes de abrir la ruta. El suscriptor permaneció `subscribed`; no se
reparó manualmente ni se habilitaron campañas reales.

La corrección reemplaza los tokens nuevos por un valor opaco cifrado y
autenticado que viaja dentro de `/api/email/unsubscribe/[token]`. El payload ya
no deja correo ni tenant legibles en la URL o en los access logs. La ruta
anterior con `?token=` y los tokens HMAC históricos permanecen compatibles para
los correos ya enviados. No requiere migración y debe validarse primero en un
nuevo Preview antes de repetir una única prueba interna.

El gate que falta es:

1. desplegar y validar la nueva ruta dinámica en un Preview autorizado;
2. repetir una única prueba exclusivamente interna y confirmar que la respuesta
   menciona Actualidad y persiste `status = 'unsubscribed'` sin reparación manual;
3. autorizar por separado la publicación a producción.

Publicar un artículo nunca envía una campaña automáticamente.

## 5. Criterios de aceptación

- menú principal visible como Actualidad y Ayuda sin Noticias;
- canonical permanece en `/noticias`;
- estados con cero, una y múltiples publicaciones no rompen la página;
- categorías vacías no aparecen;
- búsqueda tolera acentos y mayúsculas;
- fotografías tienen texto alternativo en artículos;
- cuerpo de lectura con ancho aproximado de 65 caracteres;
- foco visible, targets móviles y reflujo en 390, 768 y 1440 px;
- newsletter por email valida consentimiento explícito y no usa WhatsApp;
- endpoint no revela si un correo ya existe o está bloqueado;
- tabla de suscriptores no tiene lectura directa anónima ni autenticada;
- campañas y snapshots de destinatarios tampoco tienen lectura directa pública;
- un editor no puede aprobar ni enviar y un admin no puede enviar contenido alterado;
- el modo prueba bloquea el envío real y solo permite el correo interno;
- cada lote tiene máximo 100 destinatarios e idempotencia por ejecución;
- TypeScript, lint, unitarias, build y prueba visual en verde.

## 6. Gates externos

- las migraciones 0259 y 0260 ya están aplicadas y verificadas; cualquier nueva
  migración requiere autorización separada;
- no activar campañas reales hasta repetir desde el nuevo Preview la prueba firmada
  sin reparación manual;
- Preview autorizado y desplegado; no hacer push ni producción sin autorización separada;
- validar datos estructurados en Rich Results Test después de Preview.
