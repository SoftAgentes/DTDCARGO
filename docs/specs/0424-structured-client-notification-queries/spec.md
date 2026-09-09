---
sdd: "0424"
title: Observabilidad estructurada en consultas de avisos del Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0156", "0309", "0420", "0423"]
confidencialidad: interno
---

# SDD-0424 · Observabilidad estructurada en consultas de avisos del Portal

## Problema

Las consultas de adopción, historial, estado staff y reglas conservan ocho logs
libres. Aunque retornan fallbacks seguros, los errores crudos pueden incluir
detalles de consulta o identificadores de tenant/cliente.

## Contrato acotado

- Adoptar el logger canónico en las cuatro capas de consulta/configuración.
- Reemplazar ocho logs libres por eventos con operación, etapa y conteos.
- Mantener fallbacks, límites, validación y mensajes funcionales existentes.
- Conservar compatibilidad mediante un correlador local por defecto.

## Fuera de alcance

- UI/actions que consumen estas queries y otros módulos legacy.
- Consultas o mutaciones contra datos reales; Cloud.
- Migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- Las cuatro queries de notificaciones nombradas en el contrato.
- Sus cuatro suites existentes, contrato nuevo, acta, índice y checklist general.

## Aceptación

- [x] RED confirma ocho logs libres en cuatro módulos.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Tenant, cliente, reglas, payloads y errores crudos quedan fuera de logs.
- [x] Los cuatro contratos funcionales permanecen verdes.
- [x] Suite completa, TypeScript, ESLint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico inyectado.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
