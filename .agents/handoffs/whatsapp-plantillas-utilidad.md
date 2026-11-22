# Handoff — análisis de plantillas de WhatsApp (2026-11-16)

- **Encargo:** del Subdirector de Chatwoot. Es investigación y propuesta para Sam; no se toca
  Meta, Kommo, Chatwoot, producción ni el VPS.
- **Entrega:** [`docs/marketing/whatsapp-plantillas-utilidad.md`](../../docs/marketing/whatsapp-plantillas-utilidad.md)
  y una línea en el índice `docs/marketing/README.md`.
- **Cierre (solo docs):** `pnpm docs:check`. No aplican pruebas de producto: no cambia código.

## Hallazgos principales

- Las plantillas viven en la cuenta de mensajes. Las 5 de Kommo no llegarán a Chatwoot al
  transferir el número: hay que recrearlas o copiarlas con la API de migración de plantillas.
- Esto corrige la inferencia K-21 de E0.
- El MCP de Meta es para agentes de IA con la sesión de una persona. No se conecta a Chatwoot.

## Pendiente de esta tarea

- Las capturas o el listado de plantillas de las dos cuentas de mensajes, que tiene que mandar
  Sam (pregunta 1 del documento).
- Confirmar que las dos cuentas de mensajes son del mismo negocio de Meta.

## FUERA DE ALCANCE DETECTADO

- Comprobar si Chatwoot CE 4.19.1 envía `messaging_account_id` cuando el número está compartido.
  Importa en el corte de «Leads».
- Comprobar si el botón «Sync Templates» existe en CE 4.19.1.
