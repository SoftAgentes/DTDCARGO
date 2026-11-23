# Handoff · Ícono propio del chat (Chatwoot) = «Conversaciones»

- Owner: Worker (Claude), pedido directo de Sam el 2026-11-23: «cuando abra el chat DTD, el icono ya no es el de DoorTuDoor; el chat de conversaciones tiene su propio icono. Lo habíamos puesto en Discord». Rama `claude/chat-icono-conversaciones`, base `main` e81e3a04d.
- COMPLETADO: `infra/chatwoot/marca/chat-conversaciones.png` (la imagen que pasó Sam, 512×512, sha256 0de7890d…); `aplicar-marca.rb` con `LOGO_THUMBNAIL` → esa imagen; runbook `chatwoot-servidor.md` §6 bis con cómo aplicarlo y cómo volver.
- VALIDACIÓN: en Chatwoot 4.20.1 (VPS, solo lectura) `LOGO_THUMBNAIL` se usa en el `<link rel="icon" sizes="512x512">` de `vueapp.html.erb`, en `Logo.vue` (logo chico del panel), en `Branding.vue` y en el pie del portal de ayuda. Pruebas de producto: NO APLICA (solo infra y documentos).
- PENDIENTES: OK nominal de Sam para aplicarlo en el VPS (copiar el PNG a `/srv/chatwoot/marca/` y correr `aplicar-marca.rb`; no reinicia contenedores). Revisión independiente (la lanza Dir_DTD).
- FUERA DE ALCANCE DETECTADO: la imagen viene de una captura pegada en el chat (RGB, sin transparencia); si existe el original del Discord en mejor calidad, se reemplaza el PNG con el mismo nombre.
