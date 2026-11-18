# Handoff · B4 de la revisión de la #578: la razón de `toggleFeatureFlagAction` en el guard de RBAC

- **Worker:** 10.5 (E10). Lo encargó el Subdirector Chatwoot, a pedido del DG, el 2026-11-15.
- **Rama:** `codex/rbac-guard-comentario-flags`, desde `origin/main` `57f58f62b`. No trae la #578 ni la toca.
- **Sin SDD:**
  - AGENTS pide SDD y allowlist exacta para los «cambios de comportamiento Studio».
  - Esto es el **texto de una razón** dentro del mapa de excepciones de `lib/studio/rbac-actions-guard.test.ts`. El código de producto no cambia, y la prueba no cambia lo que mide: solo exige que la razón tenga 40 caracteres o más (:428-429).
  - La trazabilidad queda en este handoff y en la PR, que nombran SDD-0633, SDD-0634 y la #578.
- **Sin migraciones.**

## Qué cambió

- **`lib/studio/rbac-actions-guard.test.ts:135`**, la razón de `admin/feature-flags/actions.ts::toggleFeatureFlagAction`.
  - **Lo que decía:** que el control real de los flags era la policy `feature_flags_platform_admin_update` (0355).
  - **Lo que dice ahora:**
    - la guarda es `platformAdminDenial`;
    - la SDD-0633 distingue «no eres» de «no se pudo comprobar»;
    - authenticated ejecuta `is_platform_admin()` desde la 0542;
    - el freno en la base es el disparador de la 0543 (SDD-0634), y mientras la 0543 no esté aplicada, el bloqueo efectivo es esta guarda.
- **Un archivo de handoff que se había agregado aquí se retiró** en un commit posterior, sin reescribir la historia.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Que la prueba solo exige 40 caracteres o más en la razón (`rbac-actions-guard.test.ts:428-429`) | Leído en el código: el cambio no altera conteos ni claves |
| La focal de `rbac-actions-guard.test.ts` | NO EJECUTADO en local. Es la única prueba que no se corrió: el cambio es solo texto y la cubre el CI de Calidad |
| `docs:check` | PASÓ |
| `pnpm verify` | NO EJECUTADO, por orden del DG: el portón es el CI de GitHub más la revisión independiente |

## Pendientes de esta tarea

- Ninguno, salvo el CI.

## FUERA DE ALCANCE DETECTADO

- Nada nuevo.
