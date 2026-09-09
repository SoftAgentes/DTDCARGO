---
sdd: "0426"
title: Observabilidad estructurada en acciones de Perfil Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0138", "0145", "0151", "0384", "0394", "0425"]
confidencialidad: interno
---

# SDD-0426 · Observabilidad estructurada en acciones de Perfil Portal

## Problema

Direcciones, avatar, documento de identidad y solicitudes de cambio conservan
doce logs libres. Esos flujos manejan datos personales y objetos privados, por
lo que un error crudo no debe poder registrar rutas, contenido postal ni datos
del cliente.

## Contrato acotado

- Adoptar el logger canónico dentro de las acciones de Perfil.
- Reemplazar doce logs libres por eventos con operación y etapa.
- Reusar el correlador del logger en el fallo visible del borrado de dirección.
- Mantener validación, scopes, rollbacks, mensajes y revalidación existentes.

## Fuera de alcance

- Cambios de formularios, captura, retención, permisos o políticas RLS.
- Subidas, borrados, solicitudes o datos reales.
- Migraciones, Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `address-actions.ts`, `avatar-actions.ts` y `actions.ts` de Perfil Portal.
- Sus suites existentes, contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma doce logs libres en tres módulos.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Direcciones, documentos, rutas, Shipping Mark e identidad quedan fuera.
- [x] El borrado conserva un correlador retornado sin aceptar el del formulario.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico por acción.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; PII e identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
