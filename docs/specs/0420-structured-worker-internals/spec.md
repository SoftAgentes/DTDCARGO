---
sdd: "0420"
title: Observabilidad estructurada en internals de workers
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0091", "0146", "0156", "0414", "0415", "0419"]
confidencialidad: interno
---

# SDD-0420 · Observabilidad estructurada en internals de workers

## Problema

Los bordes HTTP de push, avisos al cliente y workflows ya están correlacionados,
pero sus cinco componentes internos conservan trece logs libres. Los fallos de
Web Push pueden exponer datos de la suscripción o del proveedor, y los drains
inline pierden el correlador de la solicitud que los originó.

## Contrato acotado

- Propagar el logger del cron por los tres drains y sus helpers de Web Push.
- Reemplazar logs libres por eventos estructurados con etapa, estado y conteos.
- Mantener cleanup sólo para 404/410, reintentos, claim, fallback legacy,
  best-effort y resultados agregados.
- Las llamadas fuera del cron usan `createComponentLogger` y no quedan mudas.

## Fuera de alcance

- Worker de bugs, productores de workflow u otros módulos legacy.
- Enviar push, procesar colas reales o consultar Cloud/datos.
- Migraciones, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- Los cinco módulos internos de push/avisos/workflow nombrados.
- Las tres rutas cron correspondientes.
- Sus cinco suites existentes y el contrato fuente nuevo.
- Esta spec, acta, índice y checklist general.

## Aceptación

- [x] RED confirma trece logs libres y falta de propagación en tres rutas.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Endpoints, claves, IDs, payloads y errores crudos no llegan a logs.
- [x] Los contratos de cleanup/reintento y best-effort permanecen verdes.
- [x] Suite completa, TypeScript, ESLint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico inyectado.
- `AUD-01` / `AUD-02`: cumplimiento; fallos correlacionados y agregados.
- `SEC-01`: cumplimiento; secretos de Web Push fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
