# Handoff — SDD-0710 · Embarques: fila con insignia de rastreo

- **Owner:** Claude (Worker) para Dir_DTD · **Rama:** `sdd-0710-embarques-insignia-rastreo` · **Worktree:** `.claude/worktrees/chatwoot-analisis-actualizacion-ffdb7d`
- **Spec:** `docs/specs/0710-embarques-fila-insignia-rastreo/spec.md` (reserva: rama + `refs/dtd/reservations/0710`)
- **Objetivo:** opción A de Sam (2026-11-23): quitar «Abrir ›» grande, código como enlace de acción, insignia «Rastrear», aviso de bloqueo de una línea con candado y «Ver los pasos» como enlace corto.
- **Permisos:** push de la rama propia y PR; no fusionar ni publicar. Sin migraciones.

## Estado

| Pieza | Estado |
|---|---|
| Spec con allowlist | hecha |
| Implementación (`EmbarquesClient.tsx`, `motivo-corto.ts`, `studio.css`) | hecha |
| Pruebas (contrato sin «Abrir», insignia, motivo corto, borrado ajustado) | escritas |
| `pnpm install`, vitest, tsc, lint, build | **NO EJECUTADO** (espera turno de PC de Dir_DTD) |
| `docs:check` | PASÓ tras regenerar el índice |
| Revisión visual claro/oscuro y contraste medido | pendiente (requiere servidor) |

## Decisiones

- La fila pasó de `<button>` a `<div>` con clic de ratón para no anidar el código (botón) ni la insignia (enlace) dentro de otro botón. Cambia `closest("button")` por `closest("[data-fila-datos]")` en dos pruebas.
- No se usó `<Aviso>` por fila (un `role="status"` por fila sería ruido); se mantiene el `<p id>` descrito por la casilla, con texto completo solo para lectores.
- La insignia se muestra siempre, igual que el enlace a Tracking del detalle (no se distingue quien no tiene módulo `tracking`; **I**: el destino ya hace su propia comprobación).

## Impacto documental

`docs/specs/README.md` regenerado. Sin cambios a AGENTS ni a la política BTN-01.

## FUERA DE ALCANCE DETECTADO

- Otros listados conservan botones «Abrir» (Conciliación, Plan de cuentas, Cobranzas, Conversaciones): candidatos a una pasada análoga si Sam la pide.
