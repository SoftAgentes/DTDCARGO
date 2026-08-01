---
sdd: "0218"
title: "Runner y reinstalación reproducible de PLG-01"
status: done
author: "Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0178"]
confidencialidad: interno
---

# SDD-0218 · Runner y reinstalación reproducible de PLG-01

## 1. Problema

PLG-01 0.1.2 validaba read-only, 27 políticas y cuatro componentes, pero su
cache podía quedar vieja después de una reinstalación/cachebuster. La ejecución
directa de tests desde cache requería Vitest y podía crear un `node_modules`
transitorio allí.

El riesgo es R2 operativo: una skill puede consultar evidencia obsoleta. No hay
datos de negocio, Cloud ni capacidad de escritura del plugin.

## 2. Diseño

- DTDCargo continúa como única fuente normativa;
- `run-forward-tests.mjs` usa `node:assert` y ejecuta siete casos sin paquetes;
- `reinstall-plugin.mjs` resuelve el worktree activo por Git;
- la versión se toma del manifest y la ruta de cache se valida bajo
  `.codex/plugins/cache/dtdcargo/<plugin>/<version>`;
- `--install` regenera el registry, copia el paquete derivado, compara hashes y
  ejecuta validador + runner desde cache;
- `--check` es read-only y falla ante archivo faltante o hash distinto;
- `node_modules` se ignora al comparar y nunca se usa como fuente;
- no se elimina cache ni se toca otra versión/plugin.

## 3. Allowlist

- `docs/specs/0218-governance-plugin-reproducible/spec.md`
- `docs/specs/README.md`
- `package.json`
- `.agents/plugins/plugins/erp-studio-governance/scripts/run-forward-tests.mjs`
- `.agents/plugins/plugins/erp-studio-governance/scripts/reinstall-plugin.mjs`
- `.agents/plugins/plugins/erp-studio-governance/scripts/__tests__/policy-registry.test.mjs`
- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `docs/governance/reviews/plg-01-durable-runner-2026-07-31.md`
- `docs/governance/policies/plg-01.md`
- `docs/governance/README.md`
- `docs/governance/generated/governance-capsule.json`

Efecto local autorizado fuera de Git: actualización de la cache instalada
0.1.2 mediante el script versionado. No se borra ninguna ruta.

## 4. SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 01 claridad | cumple | tres comandos nombran test/sync/check |
| 02 trabajo | cumple | un cachebuster se recupera desde el repo |
| 03 riesgo | cumple | R2, sin efectos externos |
| 04 auditoría | no aplica | no muta negocio ni Cloud |
| 05 autoridad | cumple | destino fijo y path validado |
| 06 contexto | cumple | solo plugin dtdcargo 0.1.2 |
| 07 estado real | cumple | hashes + validador + runner, no éxito asumido |
| 08 recuperación | cumple | error identifica archivo/cache; fuente permanece intacta |
| 09 consistencia | cumple | mismos builders canónicos |
| 10 accesibilidad | no aplica | infraestructura local sin UI |
| 11 adaptación | cumple | Windows/PowerShell vía Node sin shell intermedio |
| 12 autoridad humana IA | cumple | skills continúan read-only |

## 5. Criterios

- fuente y cache coinciden archivo por archivo;
- validador instalado reporta read-only, 27 políticas y cuatro componentes;
- runner directo reporta 7/7;
- NumericInput aparece canonical;
- los tres casos prohibidos fallan;
- cero dependencia de `node_modules` del cache;
- cero capacidades externas nuevas.
