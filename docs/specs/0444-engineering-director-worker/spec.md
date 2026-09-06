---
sdd: "0444"
title: "Harness Codex con Director, Workers y PR como frontera"
status: done
author: "Codex"
created: 2026-09-05
updated: 2026-09-05
supersedes: null
superseded_by: null
related: ["0020", "0349"]
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
- .github/workflows/quality.yml y scripts/__tests__/ci-workflow-contract.test.mjs
  (CI extraída en SDD-0349 y ampliada para ejecutar harness:test).
- docs/specs/0349-ci-calidad-sin-secretos/spec.md y
  .agents/handoffs/2026-09-05-ci-quality-extract.md (incorporados por merge local A).
- components/DestinoCombobox.tsx y components/DestinoCombobox.test.tsx;
  docs/specs/0360-destino-combobox-focus-race/spec.md y
  .agents/handoffs/2026-09-05-destino-focus-extract.md (dependencia correctiva
  puntual autorizada, incorporada a través de A; ver SDD-0360).
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
release; nunca aplicar una migración solo para aprobar una PR. CI se extrae
selectivamente de #21 como SDD-0349, sin sus cambios de producto. La corrección
añade harness:test explícito a ese job, además del gate local verify.

La reserva 0444 fue creada desde inventario de refs, PRs y trabajo sin commit.
La ref local conserva el commit stub; la spec completa viaja en esta rama.
Publicación/integración del PR y despliegue son estados separados de esta aceptación
de implementación. Integración y producción permanecen sin autorización.

## Evidencia

[Auditoría y validación](../../audits/2026-09-05-codex-engineering.md).
[Handoff](../../../.agents/handoffs/2026-09-05-engineering-director-worker.md).

## Corrección de recepción — 2026-09-05

La auditoría de #32 sobre 2db92f9979ef3380cc608d2f5ea8ce3d4bfaac2c exige
restaurar C3 y conectar las pruebas Node al CI efectivo. Corrección local
terminada y validada; done no significa publicación ni integración aprobada.
Autorización específica de esta revisión: solo trabajo y commits locales; no
push, publicación/actualización de PR, merge main, producción ni protecciones.
Esta restricción sustituye el permiso de publicación del encargo inicial.

- [x] C3 exige RLS habilitado para toda tabla nueva y tratamiento explícito del
  DDL destructivo con default/respaldo y estrategia segura, sin permiso productivo.
- [x] Workflow de calidad ejecuta pnpm harness:test sin condición ni bypass.
- [x] Contrato de CI prueba rechazo de omisión y formas de ocultar el gate.
- [x] Combinación local con A validada, con fallos y SKIPs de main separados
  de la corrección y sin importar arreglos de producto.

Evidencia: 6188 pruebas Vitest, 12 Node del harness, 16 contratos de CI dentro
de Vitest y build con 158 páginas. El contrato focal falló antes del paso nuevo
y pasó después. Build requirió un reintento por una descarga fallida de Google Fonts; los
demás gates de B pasaron sin SKIPs. Detalle y límites en el handoff.

La integración futura de #21 continúa pendiente: sus contratos runWorktreeCommand
y finish y sus cambios de AGENTS no son intercambiables con #32.

## Dependencia correctiva SDD-0360 — 2026-09-05

El CI publicado de #32/c36d7e26 falló en la carrera de foco del componente
público ya presente en main, antes de ejecutar harness:test. Se incorpora el
arreglo selectivo ef99fca5 a través de A, conservando el workflow y todos los
gates. No se incorpora #21 completa. B concentra verify de producto y el
harness; A/extracción reutilizan suite/build solo con árboles de producto
equivalentes, más comprobaciones propias. Evidencia y SHA en handoff SDD-0360.
La publicación/actualización de #32 queda a cargo del Director; esta sesión
solo prepara commits y merges locales para su revisión.
