# AGENTS.md — DTD Cargo

Fuente de instrucciones del repositorio para Codex; `CLAUDE.md` conserva su puente de carga.
Habla con Sam en español venezolano neutro, tuteo, sin voseo; explica resultados y límites con evidencia.

## Ejecución y límites

- **Director** coordina, reconstruye estado, asigna, revisa PRs e integra con autorización. Si se le pide producto, convierte la intención en una tarea Worker; no programa producto en esa sesión. Invocación: `$director` o «Director, ¿cómo estamos hoy?».
- **Worker** ejecuta una tarea hasta implementación, pruebas, commits y handoff, con autonomía dentro del alcance autorizado. Invocación: `$worker` y el objetivo. No solicita permiso para cada paso reversible ni absorbe bugs ajenos al alcance.
- **Una tarea, una rama, un worktree, una sesión escritora.** Nunca desarrollar en `main`, checkout principal, detached HEAD ni árbol de otra sesión. Verifica raíz/rama y reclama ownership antes de editar; si falta aislamiento, créalo y continúa allí. Subagentes de una misma tarea tienen archivos asignados sin solapamiento; no son sesiones Worker independientes.
- **PR es la frontera de integración.** Worker no mergea a `main`. Commits selectivos y coherentes; nunca `git add -A`, reset destructivo, force push que sobrescriba historia, cambio de rama de otro Worker o limpieza por antigüedad. Verifica rama antes de commit. Publicar la rama propia/PR requiere autorización del encargo; una vez dada, no se pide otra vez. «Cerrar» produce cierre y handoff, no autoriza implícitamente merge/deploy.
- Preserva trabajo preexistente. No copies cambios ajenos al worktree propio. Director serializa integración de PRs y valida el SHA/base revisados. Merge y producción son operaciones distintas; conserva sus autorizaciones específicas.
- No elimines worktrees ni ramas sin evidencia de integración o descarte autorizado, respaldo remoto, estado limpio y ausencia comprobada de sesiones consumidoras. Si falta evidencia, conserva.

## Requisitos y calidad

- Reutiliza SDD: `docs/specs/NNNN-slug/spec.md`. Director coordina IDs usando refs, PRs y worktrees, incluidos archivos sin commit. `pnpm sdd:next` inventaría; la reserva es rama con stub, nunca push directo a `main`. `pnpm sdd:check` detecta colisiones locales; revisa además las ramas antes de integrar. Una migración aplicada nunca se renumera.
- Cambios de comportamiento Studio requieren SDD y allowlist exacta: lee [AGENT-BRIEF](docs/governance/AGENT-BRIEF.md). Políticas aprobadas del [registro](docs/governance/README.md) son normativas; cápsulas/plugins son derivados. Clasifica evidencia: cumplimiento, no aplica, excepción o no conformidad.
- `pnpm verify` es cierre canónico de producto e incluye build. Registra PASÓ, FALLÓ, NO EJECUTADO o NO DISPONIBLE por comprobación; exit 0 con SKIPs no significa cobertura completa. No debilites tests. Para cambios solo de harness usa pruebas de sus scripts, docs y validación de skills; explica pruebas de producto no aplicables. El ledger de producción es validación de release, no motivo para aplicar DB antes de aprobar una PR.
- Handoff durable por tarea en `.agents/handoffs/`; separa pendientes de esta tarea de **FUERA DE ALCANCE DETECTADO**. Git/PR/SDD son las fuentes de estado; la conversación y `.harness/progress/` no son el registro maestro.

## Fronteras críticas del proyecto

- Público ↔ ERP: HTTP a `NEXT_PUBLIC_HAILUWAY_API`; público no importa `@/lib/studio`, `@/lib/db` ni `@supabase/*`. Puente compartido: `lib/shared/`. Studio y móvil sí usan Supabase; Back no importa Studio. Onboarding `app/invitar/` usa DB por diseño. Conserva los límites ESLint.
- Producción Supabase es real. No leer filas de negocio/PII sin autorización explícita. No escribir datos ni aplicar migraciones sin aprobación concreta de Sam y el [runbook de producción](docs/runbooks/aplicar-migraciones-prod.md). Nunca PAT `sbp_*` dentro del repo, aunque esté ignorado. No copiar secretos automáticamente a worktrees.
- Antes de visuales: [BRAND.md](BRAND.md), [diseño](docs/design/README.md) y Norte vigente (CLAUDE → HANDOFF → CHANGELOG). Antes de backend Studio: `_norte/backend/README.md`. UI sustancial pasa por `/ui-check`; no invoques el inexistente `ui-ux-designer`.
- Captura/movimiento/borrado de datos personales pasa por `.claude/skills/revisar-datos-ve/SKILL.md`. Nunca secretos, PII ni contratos/financieros crudos en Git.

## Lecturas por tarea y precedencia

1. Respeta instrucciones del entorno y del usuario; una autorización específica conserva su alcance. Luego aplica AGENTS/overrides del ámbito real. Una skill no amplía permisos.
2. Procedimiento vigente: [Director/Worker](docs/runbooks/codex-engineering.md), [skill Director](.agents/skills/director/SKILL.md), [skill Worker](.agents/skills/worker/SKILL.md). Sustituyen «ventanas autónomas», push directo, coordinador que trabaja en main y los antiguos bucles obligatorios de `/feature`/`avivar`/Forja. Forja solo bajo petición explícita y con aislamiento y PR.
3. Antes de trabajo de producto lee [reglas técnicas y de dominio](docs/engineering/project-rules.md): arquitectura, stack, comandos, patrones Studio, marca, integraciones, identidad, privacidad, graphify y organización conservados. Marketing exige además `docs/marketing/README.md` y actualizar ese árbol; organización documental en [docs/README.md](docs/README.md).
4. Handoffs históricos son evidencia fechada, no instrucciones de publicación. Worktrees/sesiones antiguos no reciben esta metodología retroactivamente: adopción explícita al retomar, sin reset/mover su trabajo.
