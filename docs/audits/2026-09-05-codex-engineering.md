# Auditoría del harness Codex — 2026-09-05

Dueño: Director de ingeniería · Estado: revisado · Confidencialidad: interno.

## Estado observado antes de modificar

Repo: hailuwaycom-sketch/DTDCARGO; main y origin/main en
b8294664a1b4f9e25c423dd814f4813fa5b1be8f. Cuatro worktrees:
checkout principal, cambios-portales, portal-claridad-botones-mensajes y
DTDCARGO-brand-semantics. main tenía AGENTS.md modificado y un runbook de
restauración con assets sin seguimiento. Su diff de AGENTS incluía formato y
ajuste de 15–20 a 5–10 ventanas: no se copió a la rama de migración.
cambios-portales tenía spec 0443 staged; durante la auditoría siguió trabajando.
No se restauró, movió, commiteó ni eliminó trabajo de esos árboles.

Se creó exclusivamente DTD-worktrees/engineering-director-worker, rama
codex/engineering-director-worker desde origin/main. Codex CLI 0.153.4,
Node 24.19.0 y gh autenticado. No había config .codex versionada ni overrides
AGENTS adicionales en las rutas afectadas. .codex está ignorado. Existían dos
skills repo de Agentation y plugin de gobernanza read-only, además del harness
Claude leader/implementer/reviewer, /feature, checkpoints y hook Stop.

Lecturas: AGENTS completo, CLAUDE puente, docs/README, runbooks multiventana,
handoff previo, package/scripts de worktree, numeración, verify, checkpoints,
agentes/command/settings Claude y manifiesto del plugin de gobernanza.
docs/agents corresponde al runtime de producto SDD-0020; se conservó.

## GitHub y pipeline

Nueve PR abiertas: #21, #23, #24, #26, #27, #28, #29, #30 y #31.
#21/#30 draft; #27 base portalcliente, otras main. Cero issues abiertas en la
consulta. Protección main devuelve 404 «Branch not protected»; rulesets vacíos.
Auto-merge y auto-delete desactivados; merge/squash/rebase permitidos. Cuenta
actual con capacidad administrativa: roles del harness no separan credenciales.

CI «Calidad local sin secretos» vive en PR #21 (codex/saneamiento-integral), no
en main. Vercel ERROR en #23 al auditar; otros contextos Vercel no prueban gate
completo. #28 y #29 usan 0440 en título: señal a investigar, no prueba de colisión.
Inventario encontró variantes de spec 0435 entre ramas (structured-user-actions /
portal-cliente-edicion-de-perfil), además de variantes históricas; revisión del
Director debe distinguirlas. Ninguna se renumeró como parte de esta tarea.

verify original tiene 15 pasos, incluido build. Devuelve 0 con SKIPs identificados.
migrations-applied consulta ledger real y falla por migración todavía no aplicada:
se conserva como reconciliación de release, no autorización de escritura.
Esta migración agrega el paso harness, sin cambiar criterios de checks anteriores.

vercel.json decide ignoreCommand por HEAD^ HEAD, con exclusiones docs/Markdown
y excepción docs/marketing. Configuración efectiva del proyecto Vercel y SHA servido
NO VERIFICADOS; no hubo consulta a datos de negocio ni despliegue productivo.
Merge que dispare deploy debe contar previamente con autorización para ese efecto.
Rollback global no probado; existe ejemplo particular en deploy-orden-venta-0072.

## Arquitectura elegida

Dos skills nativas .agents/skills, AGENTS corto y reglas técnicas extraídas sin
perder conocimiento de dominio. Sin plugin nuevo: no aporta instalación global
para dos workflows de este repo. Wrappers Claude y runbooks antiguos remiten al
procedimiento vigente. Source of truth: Git/PR/SDD y handoffs existentes por tarea.

Director-status es lectura, sin fetch ni mutaciones; GitHub paginado, incertidumbre
explícita. Snapshot real: 5 worktrees (incluido este), 38 refs, 9 PRs, 21 pares con
archivos compartidos, GitHub disponible. Un solapamiento no demuestra conflicto
y ausencia de solapamiento no prueba independencia semántica.

Worktree start no copia .env ni instala dependencias. Guard/claim bloquean
cooperativamente edición en main/principal/detached y reclamo de otro owner.
finish no borra; la limpieza documentada exige evidencia adicional y no fuerza Git.

Next-number conserva helpers y escanea refs, PRs/forks y worktrees dirty.
Reserva local atomic create de ref + lock numérico; push create-only de rama
numérica con expected-empty lease. Dos clones no pueden sobrescribir la misma
reserva por accidente. Offline o inventario incompleto cancela reserva.

## Validación observada

- PASÓ: 12 pruebas Node (repos Git temporales, sin red) de inventario, guard,
  ownership, cleanup no destructivo y numeración con carreras local/remota.
- PASÓ: 8 unitarios heredados Vitest de next-number.
- PASÓ: quick_validate.py oficial sobre Director y Worker. Python del runtime
  no traía PyYAML: instalado solo en carpeta temporal para ejecutar el validador.
- PASÓ: ejecución real de director-status contra repo y GitHub.
- PASÓ: revisión independiente conceptual de los ocho escenarios del encargo.
  Hallazgos corregidos: autorización del efecto productivo del merge,
  puntero de cleanup vigente y explicación del CAS create-only.
- NO EJECUTADO: build/E2E/SQL/ledger/producto completo, porque este cambio solo
  modifica harness y documentación; sin credenciales Cloud en este worktree.
  La integración final deberá verificar los checks aplicables a su SHA combinado.

La validación de docs/numbering, lint focalizado, diff y revisión final se registra
en el handoff de entrega. Tests de escenarios son evaluación conceptual separada
de pruebas ejecutables; no se afirma que fueran ocho sesiones Codex reales.

## Recomendaciones fuera de alcance

Integrar/revisar CI de #21 antes de exigirla, protecciones PR/checks/aprobación/
conversaciones resueltas/anti-force/anti-delete, credenciales Worker sin admin.
CODEOWNERS con responsables reales. No activar auto-delete hasta adoptar cleanup.
Merge queue queda condicionada a necesidad, plan y soporte merge_group.
No cambiar estas políticas durante esta migración.

El aviso check-unpublished existente mide ausencia en origin/main, no ausencia
de respaldo en otra rama remota: no usar su etiqueta «sin publicar» como prueba de
pérdida. Director-status y PRs distinguen estados. No se cambió ese aviso histórico.
