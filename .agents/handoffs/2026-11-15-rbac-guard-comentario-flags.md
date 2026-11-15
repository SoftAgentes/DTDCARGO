# Handoff · B4 de la revisión de la #578: la explicación de `toggleFeatureFlagAction` en el guard de RBAC

- **Worker:** 10.5 (E10). Lo encargó el Subdirector Chatwoot, a pedido del DG, el 2026-11-15.
- **Rama:** `codex/rbac-guard-comentario-flags`, en el worktree `DTD-worktrees/rbac-guard-comentario-flags`, desde `origin/main` `57f58f62b`. No trae la #578 ni la toca.
- **Sin SDD:**
  - AGENTS pide SDD y allowlist exacta para los «cambios de comportamiento Studio».
  - Esto es el **texto de una razón** dentro del mapa de excepciones de `lib/studio/rbac-actions-guard.test.ts`. El código de producto no cambia, y la prueba no cambia lo que mide: solo exige que la razón tenga 40 caracteres o más (:428-429).
  - La trazabilidad queda en este handoff y en la PR, que nombran SDD-0633, SDD-0634 y la #578.
- **Sin migraciones.**

## Qué cambió

- **`lib/studio/rbac-actions-guard.test.ts:135`**, la razón de `admin/feature-flags/actions.ts::toggleFeatureFlagAction`.
  - **Lo que decía:** que el control real de los flags era la policy `feature_flags_platform_admin_update` (0355).
  - **Por qué es falso:** la escritura va por `audit_d1_execute` (0289, DEFINER de postgres), que escribe como dueño, y la policy no la alcanza.
  - **Lo que dice ahora:**
    - la guarda es `platformAdminDenial`;
    - la SDD-0633 distingue «no eres» de «no se pudo comprobar»;
    - authenticated ejecuta `is_platform_admin()` desde la 0542;
    - el freno en la base es el disparador de la 0543 (SDD-0634), y mientras la 0543 no esté aplicada, el bloqueo efectivo es esta guarda.

## Además, en esta PR: el análisis de `membership.invite`

- Es solo un documento: `.agents/handoffs/2026-11-15-membership-invite-analisis.md`.
- Recoge el hueco, su impacto, los caminos y las opciones con su costo, y una recomendación para Sam.
- No es una corrección del código ni una migración.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Que la prueba solo exige 40 caracteres o más en la razón (`rbac-actions-guard.test.ts:428-429`) | Leído en el código: el cambio no altera conteos ni claves |
| La focal de `rbac-actions-guard.test.ts` | NO EJECUTADO en la PC: el worktree no tiene `node_modules` y el cambio es solo texto. La corre el CI de Calidad |
| `pnpm verify` | NO EJECUTADO, por orden del DG: el portón es el CI de GitHub más la revisión independiente |

## Pendientes de esta tarea

- La focal queda para el CI de Calidad.
- Publicar la rama y abrir la PR.

## FUERA DE ALCANCE DETECTADO

- **`membership.invite`:** invitar como admin sin ser superadmin. Ver el análisis aparte. Lo decide Sam.
