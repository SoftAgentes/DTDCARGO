---
sdd: "0423"
title: Observabilidad estructurada en agenda de avisos del Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0156", "0282", "0283", "0389", "0420", "0422"]
confidencialidad: interno
---

# SDD-0423 · Observabilidad estructurada en agenda de avisos del Portal

## Problema

La programación de avisos, sus cuatro fanouts y el marcado de no entregado
conservan diez logs libres. Algunos interpolan IDs de regla o códigos de ancla y
el drain inline no hereda un correlador del productor.

## Contrato acotado

- Adoptar el logger canónico en programación, fanout y marcado no entregado.
- Propagar el correlador por fanout → agenda → drain inline.
- Reemplazar diez logs libres por eventos con etapa y conteos seguros.
- Mantener anclas, compatibilidad pre-0389, idempotencia y best-effort.

## Fuera de alcance

- Queries de historial/configuración y productores fuera de estos tres módulos.
- Procesar agenda, proveedores o datos reales; Cloud.
- Migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/notifications/schedule-client-notifications.ts`.
- `lib/studio/notifications/schedule-fanout.ts`.
- `lib/studio/notifications/mark-notification-undelivered.ts`.
- Sus pruebas, contrato nuevo, acta, índice y checklist general.

## Aceptación

- [x] RED confirma diez logs libres y el drain inline sin correlación.
- [x] Cero `console.*` libre queda en los tres módulos.
- [x] Reglas, anclas, Shipping Marks, payloads y errores crudos quedan fuera.
- [x] Contratos de agenda/fanout/no-entregado permanecen verdes.
- [x] Suite completa, TypeScript, ESLint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico inyectado.
- `AUD-01` / `AUD-02`: cumplimiento; fallos correlacionados.
- `SEC-01`: cumplimiento; identificadores de cliente fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
