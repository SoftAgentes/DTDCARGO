# Respuesta automática de `notificaciones@dtdcargo.com`

Parte de SDD-0583. El buzón `notificaciones@dtdcargo.com` (Hostinger Mail, plan Premium Business Email) envía los avisos de Chatwoot y del sistema. Tiene una respuesta automática que remite a `vzla@dtdcargo.com`, creada el 2026-10-29 (T-34 de [la investigación](../../../docs/specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md)). Hasta ahora era texto plano. Sam pidió el 2026-10-31 una versión con la marca.

[`vista-previa.html`](vista-previa.html) es la fuente: trae el asunto, la versión con formato (opción A), la versión solo texto (opción B), botones para copiar cada una y los pasos para pegarlas. Se abre con doble clic en Chrome.

## Qué acepta el editor de Hostinger

| Punto | Estado | Fuente |
| --- | --- | --- |
| Mensaje en «texto enriquecido o sin formato» | Documentado | [Hostinger, respuesta automática (ES)](https://www.hostinger.com/es/support/?p=722) e [inglés](https://www.hostinger.com/support/1583449-how-to-set-up-an-automatic-reply-for-hostinger-email/) |
| Sin emojis en asunto ni mensaje: si los hay, no guarda | Documentado | mismas páginas |
| Campos: dirección, asunto, fechas de inicio y fin («Sin fecha límite»), mensaje | Documentado | mismas páginas |
| Una vez por remitente cada 24 h | Visto en hPanel el 2026-10-29 (T-34); la ayuda no lo dice | investigación de SDD-0583 |
| Editor de código HTML | NO VERIFICADO: la ayuda no lo menciona | — |
| Qué formato conserva al pegar (color, negrita, enlaces, imagen) | NO VERIFICADO: se ve al pegar en el editor | — |
| Límite de largo del mensaje | NO VERIFICADO: la ayuda no da uno | — |
| El campo `body` de la API de correo acepta HTML | NO VERIFICADO; además pide un token de la API, que no se usa en esta tarea | espejo de la documentación de la API, no la página oficial |

Por eso la opción A usa solo párrafos, negritas, color y enlaces. Son los elementos que un editor de texto enriquecido suele conservar al pegar. No lleva tablas, botones ni la tarjeta de los correos de Chatwoot. El logo va como imagen remota (`chat.dtdcargo.com/dtd-marca/dtdcargo-isologo-correo.png`, el mismo de [`base.liquid`](../../chatwoot/correo/views/layouts/mailer/base.liquid)). Si el editor lo quita, el mensaje queda completo.

## Diseño

- Mismos tokens y firma que el layout de correo de Chatwoot: wine `#7F0F1A`, ink `#0F1E3D`, secundario `#6B6B6B`, y los datos de `CONTACT` de `lib/design-tokens.ts`.
- Tagline según `BRAND.md`: «Con Confianza,» en vino y «de China a tu puerta.» en ink.
- Tuteo, igual que la nota al pie de los correos de Chatwoot. El texto viejo usaba «usted».
- Sin emojis. En el asunto se usa «|» en vez de «·» para no arriesgar el guardado. El mensaje con formato sí lleva «·» en la firma; si Hostinger se niega a guardar, se cambian por «|».

## Pasos para aplicarla

Los aplica Sam en hPanel, o una sesión solo con su OK nominal. Están también al pie de la vista previa.

1. Abrir `vista-previa.html` en Chrome y entrar a hPanel: **Emails → dtdcargo.com → Administrar → Respuesta automática**.
2. En **Administrar respuestas automáticas**, menú **⋮** de la de `notificaciones@dtdcargo.com` → **Editar**.
3. **Asunto:** borrar el actual («Buzón solo de notificaciones»), pulsar «Copiar asunto» y pegar.
4. **Mensaje:** borrar el texto actual, pulsar «Copiar mensaje con formato» y pegar con **Ctrl+V**. Ctrl+Shift+V quita el formato.
5. Revisar en el editor el logo, «DTD» en vino y el enlace a vzla@. Si todo quedó sin formato, borrar y pegar la opción B.
6. Dejar las fechas (desde 2026-10-29, sin fecha límite) y pulsar **Guardar**.
7. Probar: escribir a `notificaciones@dtdcargo.com` desde un correo que no le haya escrito en las últimas 24 h y mirar cómo llega, en el celular y en la computadora.

Para volver atrás, el texto anterior era: «Este correo es solamente para enviar notificaciones y no recibe respuestas. Si desea enviarnos alguna información, escríbanos a vzla@dtdcargo.com. Gracias, DTD Cargo.»

## Pendiente de decidir

- La firma pone el WhatsApp terminado en 8021 (`CONTACT.ve.whatsapp`), igual que los correos de Chatwoot. Según la enmienda del 0.8 de SDD-0582, ese número queda para leads y los clientes pasan al terminado en 5202. Si la firma de los correos cambia de número, esta respuesta cambia con ella.
