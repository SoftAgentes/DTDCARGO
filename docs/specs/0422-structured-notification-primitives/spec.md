---
sdd: "0422"
title: Observabilidad estructurada en primitivas de notificación
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0036", "0146", "0419", "0420", "0421"]
confidencialidad: interno
---

# SDD-0422 · Observabilidad estructurada en primitivas de notificación

## Problema

La escritura in-app, el envío Telegram genérico y la notificación móvil del
despacho conservan cinco logs libres. Además, el notificador de bugs ya tiene
correlación propia pero todavía no la entrega a la escritura in-app.

## Contrato acotado

- Adoptar el logger canónico en las tres primitivas compartidas.
- Propagar el logger por enqueue/drain de despacho y desde bugs hacia in-app.
- Reemplazar cinco logs libres por eventos con etapa y conteos.
- Mantener deduplicación, consentimiento, best-effort y comportamiento móvil.

## Fuera de alcance

- Productores de Bitácora/change requests y pipeline de agenda del Portal.
- Proveedores, notificaciones o datos reales; Cloud.
- Migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/notify/write-inapp.ts`.
- `lib/studio/notify/send-user-telegram.ts`.
- `lib/studio/notify/notify-dispatch-events.ts`.
- Las tres llamadas in-app de `lib/studio/bug-email-notify.ts`.
- Pruebas, acta, índice y checklist general.

## Aceptación

- [x] RED confirma cinco logs libres y falta de propagación desde bugs.
- [x] Cero `console.*` libre queda en las tres primitivas.
- [x] IDs, payloads, chats, texto y errores crudos quedan fuera de logs.
- [x] Contratos de deduplicación, canales y despacho permanecen verdes.
- [x] Suite completa, TypeScript, ESLint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico inyectado.
- `AUD-01` / `AUD-02`: cumplimiento; fallos correlacionados.
- `SEC-01`: cumplimiento; contenido y destinatarios fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
