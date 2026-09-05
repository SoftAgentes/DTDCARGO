---
sdd: "0444"
title: "Harness Codex con Director, Workers y PR como frontera"
status: done
author: "Codex"
created: 2026-09-05
updated: 2026-09-05
supersedes: null
superseded_by: null
related: ["0020"]
confidencialidad: interno
---

# SDD-0444 — Harness de ingeniería Codex

## Objetivo y autorización

Migrar metodología de ingeniería a Director que coordina y Workers autónomos
aislados, conservando dominio, gobernanza y SDD. El encargo del 2026-09-05 autoriza
auditar, implementar, probar, commitear y publicar rama/PR propios. No autoriza
merge, producción, cambios de protecciones ni eliminación de trabajo preexistente.

La SDD-0020 describe agentes del producto Studio; se enlaza para distinguirla,
no se sustituye ni cambia su runtime. Esta spec afecta exclusivamente ingeniería.

## Requisitos y aceptación

- [x] Director conserva rol y redirige solicitudes de producto a Worker.
- [x] Worker ejecuta un objetivo con aislamiento, ownership y cierre durable.
- [x] main/checkout principal/detached son rechazados por guard; start no copia secretos.
- [x] AGENTS compacto remite al conocimiento técnico conservado y a skills nativas.
- [x] Briefing reconstruye Git/worktrees/PRs/checks/SDD/handoffs; distingue offline.
- [x] Planificación considera archivos y contratos semánticos, no maximiza agentes.
- [x] Reserva SDD inspecciona refs/PRs/worktrees dirty y usa creación atómica de refs;
      publicación solo en rama de reserva, nunca main.
- [x] PR es frontera; revisión por head/base, integración serial y autorización.
- [x] Cleanup es informe por defecto; eliminación manual requiere evidencia de sesiones,
      respaldo, integración y datos ignorados.
- [x] Legacy Claude/runbooks no instruyen publicación directa ni bloqueos por fase.
- [x] Validación oficial de skills, tests reales de scripts y ocho escenarios revisados.
- [x] No se cambió producto ni política remota; entrega en rama/PR para revisión.

## Alcance exacto

- AGENTS.md y extracción docs/engineering/project-rules.md.
- .agents/skills/{director,worker}/SKILL.md y agents/openai.yaml.
- .agents/handoffs/2026-09-05-engineering-director-worker.md.
- docs/runbooks/codex-engineering.md; wrappers de los tres runbooks multiventana.
- docs/README.md, esta spec e índice generado docs/specs/README.md.
- .claude/commands/feature.md, .claude/agents/{leader,implementer,reviewer}.md.
- .harness/CHECKPOINTS.md.
- scripts/harness-worktree.mjs, scripts/next-number.mjs, scripts/director-status.mjs.
- scripts/tests/{harness-worktree,director-status}.node.mjs,
  scripts/tests/next-number.integration.node.mjs; traslado del test previo de
  scripts/__tests__/harness-worktree.test.mjs al runner Node.
- scripts/verify.mjs (añade gate harness), package.json (comandos harness).
- docs/audits/2026-09-05-codex-engineering.md.

## Decisiones y límites

Skills repo-scoped sin plugin adicional: descubrimiento nativo, sin instalación
global ni caché adicional. Dos roles, un runbook compartido; no nuevo gestor de tareas.
Handoffs por tarea reutilizan carpeta existente. Claim cooperativo por worktree;
sin protecciones remotas no es un límite de seguridad absoluto.

Se conserva verify y sus checks de producto. Ledger producción se clasifica como
release; nunca aplicar una migración solo para aprobar una PR. No se duplica CI
en revisión #21. Nueva prueba harness queda conectada al gate local.

La reserva 0444 fue creada desde inventario de refs, PRs y trabajo sin commit.
La ref local conserva el commit stub; la spec completa viaja en esta rama.
Publicación/integración del PR y despliegue son estados separados de esta aceptación
de implementación. Integración y producción permanecen sin autorización.

## Evidencia

[Auditoría y validación](../../audits/2026-09-05-codex-engineering.md).
[Handoff](../../../.agents/handoffs/2026-09-05-engineering-director-worker.md).
