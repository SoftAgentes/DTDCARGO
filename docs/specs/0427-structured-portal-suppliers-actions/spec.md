---
sdd: "0427"
title: Observabilidad estructurada en Proveedores y Prealertas Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0057", "0098", "0173", "0388", "0389", "0426"]
confidencialidad: interno
---

# SDD-0427 · Observabilidad estructurada en Proveedores y Prealertas Portal

## Problema

El archivo de acciones de proveedores, compras, adjuntos y add-ons conserva
quince logs libres. Los errores crudos pueden incluir rutas privadas de Storage,
datos de proveedor, Shipping Mark, códigos de compra o contenido del formulario.

## Contrato acotado

- Adoptar un logger canónico por acción pública.
- Propagar el mismo correlador por adjuntos, solicitudes y workflow internos.
- Reemplazar quince logs libres por eventos con operación y etapa.
- Mantener validaciones, scopes, retries, rollbacks y semántica best-effort.

## Fuera de alcance

- Cambios de formularios, datos capturados, permisos, RLS o Storage.
- Subidas, compras, proveedores, servicios, workflows o datos reales.
- Migraciones, Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `app/portal/(app)/proveedores/actions.ts`.
- Sus tres suites de scope existentes, contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma quince logs libres en el módulo.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Datos, rutas, archivos e identificadores quedan fuera de logs.
- [x] Los helpers reciben el correlador originado en la acción.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador propagado por el flujo.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; PII, rutas e identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
