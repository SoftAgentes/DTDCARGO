---
sdd: "0421"
title: Observabilidad estructurada en notificaciones de bugs
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0036", "0146", "0271", "0415", "0420"]
confidencialidad: interno
---

# SDD-0421 · Observabilidad estructurada en notificaciones de bugs

## Problema

El cron de reintentos de bugs ya tiene un borde HTTP correlacionado, pero no
propaga su logger al outbox. El notificador multicanal conserva diez logs libres
y el outbox otros dos, con riesgo de exponer folios, errores del proveedor o
contenido de notificaciones.

## Contrato acotado

- Propagar el logger del cron al drain de email/Telegram y sus escrituras.
- Adoptar el mismo logger estructurado en los tres notificadores de eventos.
- Reemplazar doce logs libres por eventos con etapa, operación y conteos.
- Mantener preferencias, deduplicación, outbox, reintentos y best-effort.

## Fuera de alcance

- `write-inapp`, otros productores o módulos legacy.
- Envíos, reintentos o filas reales; Cloud y datos de negocio.
- Migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/bug-email-notify.ts`.
- `lib/studio/notify/bug-notif-outbox.ts`.
- `app/api/cron/bug-notifications-drain/route.ts`.
- Sus pruebas existentes, contrato nuevo, acta, índice y checklist general.

## Aceptación

- [x] RED confirma doce logs libres y ausencia de correlación interna.
- [x] Cero `console.*` libre queda en los dos módulos.
- [x] Folios, destinatarios, chats, payloads y errores crudos quedan fuera.
- [x] Reintentos, preferencias y decisiones de canal permanecen verdes.
- [x] Suite completa, TypeScript, ESLint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico inyectado.
- `AUD-01` / `AUD-02`: cumplimiento; fallos correlacionados y agregados.
- `SEC-01`: cumplimiento; destinatarios y contenido fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
