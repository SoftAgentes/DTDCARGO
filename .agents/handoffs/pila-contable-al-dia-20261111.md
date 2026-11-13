# Pila contable al día con main (2026-11-11)

- Owner: Worker Claude, sesión del worktree `.claude/worktrees/pila-contable-al-dia-b3a9b7` (claim `pila-contable-b3a9b7`).
- Encargo: Director General (local_25e2dded), por pedido de Sam de vaciar la cola de PR sin romper main.
- Base: main `8f2029a80`. Estado de la tarea: en progreso (una PR por turno; el DG revisa y fusiona en orden).
- Permisos: commits y PR de ramas propias. **Sin** merge, sin aplicar migraciones, sin producción.

## Método
Las ramas `codex/*` de la pila tienen worktrees registrados (DTD-worktrees y `.codex`), así que no se tocan.
Cada paso sale de una rama `claude/…` creada desde la cabeza codex, que trae a la anterior con merge (sin rebase ni force push). La PR nueva reemplaza a la vieja; en la vieja queda un comentario, y cerrarla lo decide el DG.

| Paso | PR vieja | Rama nueva | Migración |
|---|---|---|---|
| 1 | #321 | claude/sdd-0577-diagnostico-go05b (#514) | — |
| 2 | #310 | claude/sdd-0572-conversor-usd-reemplazos | — |
| 3 | #311 | claude/sdd-0572-conversor-usd-sql | 0498 → **0527** |
| 4 | #312 | claude/sdd-0576-fechas-caracas-operaciones | 0499 → **0533** |
| 5 | #313 | claude/sdd-0576-fechas-caracas-anuales | 0500 → **0534** |
| 6 | #314 | claude/sdd-0576-fechas-caracas-movil | — |
| 7 | #317 | claude/sdd-0569-bcv-carga-diaria | 0501 → **0535** |

## Numeración (decisión del DG, 2026-11-11)
Medido hoy: la 0527 está libre. La 0528 la tiene el worktree `endurecer-permisos` (rama `claude/endurecer-permisos-dinero`), de la 0529 a la 0531 la #509 y la 0532 la #512. El DG no mueve esas reservas, así que la serie queda **0527, 0533, 0534, 0535**. La #318 ya no tiene la 0531 reservada: si Sam la aprueba, toma el siguiente número libre cuando le toque. Ninguna de estas migraciones está aplicada; todas quedan declaradas como espera sin aplicar.

## Validación hasta ahora
- #514: `docs:check`, `sdd:check` y `diff --check` PASARON.
- #310: vitest focal de 8 archivos, 283/283 PASÓ (turno pesado del DG). `docs:check` y `sdd:check` PASARON.
- #311 a #317, en local: `migrations-lock verificar`, gate de símbolos (0 rojos), `sdd:check` y `docs:check` PASARON; en la #317 también `build-crontab --check`. Vitest y typecheck de esas ramas: NO EJECUTADOS, quedan para el CI.
- `pnpm verify`: NO EJECUTADO; el portón es el CI de GitHub.

## Pendientes de esta tarea
Publicar de la #311 a la #317, una por turno, después de cada fusión. Antes de publicar cada una hay que traerle main.

## Seguimientos que dejó la revisión de la #516 (Opus, APPROVED)
- (a) Los totales de la 0572-a siguen sumando en coma flotante con `round2`. `sumarEnUsd` (`lib/shared/fx.ts`, suma exacta en centavos) solo lo usan sus pruebas; adoptarlo en los agregadores es una tarea aparte.
- (b) `lib/studio/accounting/subdiario.ts:163` falla abierto a propósito: una CxP histórica sin tasa se suma al nominal para cuadrar con su asiento. Es una decisión declarada en el comentario, no un descuido.

## FUERA DE ALCANCE DETECTADO
- #312: el readback de `issued_at` en `lib/studio/sales-orders/actions.ts` (+1 lectura de invoices con el cliente admin) quedó redundante, porque la RPC atómica de la 0497 ya fecha el asiento con `issued_at` persistido. No lo quité: es una decisión para quien revise.
