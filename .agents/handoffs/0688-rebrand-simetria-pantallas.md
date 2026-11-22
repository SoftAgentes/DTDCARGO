# Handoff · SDD-0688 fase 1 (reglas)

Worker · 2026-11-22 · rama `claude/sdd-0688-fase1-reglas-ae198b` · solo documentos, sin código.

Pedido de Sam: «Rebrand: arranca la fase 1 de la simetría de pantallas (reglas)».

## Hecho
- `docs/governance/policies/btn-01.md` → v1.3: reglas 1 a 6 (Studio y Portal). La 4 entró pendiente y quedó vigente el 2026-11-22 (BD-077).
- AVS-01 → enmienda v1.1 (reglas 7 a 9) en `docs/specs/0165-.../spec.md` §17. Es su documento canónico: no existe `policies/avs-01.md`.
- Medidas (reglas 10 y 11) en `app/studio/CLAUDE.md` (Drawers) junto a un resumen de las reglas de botones y mensajes.
- `docs/governance/README.md` (filas BTN-01 y AVS-01) y cápsula regenerada (`pnpm governance:index`).
- Spec 0688: allowlist y fila AVS-01 con la ruta localizada.

## Comprobaciones
docs:check PASÓ · sdd:check PASÓ (solo choques históricos conocidos) · governance:check PASÓ. vitest NO EJECUTADO (pedido). `pnpm verify` NO EJECUTADO (solo documentos).

## Opciones para Sam (A/B, dibujables; no decididas)
1. **Regla 4 (BRAND-CHECK, `BRAND.md:324`) — CERRADA: Sam, «regla a» (opción A), 2026-11-22; BD-077.** A: confirma la excepción con sus palabras → se registra en `BRAND-DECISIONS.md` y la regla pasa a vigente. B: se retira o se reduce a variantes que ya existen (relleno `danger` + contorno `ghost` rojo si ya existe).
2. **Dónde vive AVS-01.** A (hecho): enmienda en SDD-0165 §17, sin tocar la cápsula. B: extraer el texto a `policies/avs-01.md` v1.1; entraría a la cápsula como política nueva (más ceremonia, L3).

## Pendientes de esta tarea
- Aprobación del carril: es PR con revisión previa (gobernanza), no carril rápido.

## FUERA DE ALCANCE DETECTADO
- `governance:check` y `README` mantienen `sourceCommit` de la cápsula; se actualizó solo por regeneración.
- Impacto documental: al abrir las fases 3, 4 y 10, actualizar «aún sin código» de `app/studio/CLAUDE.md`.
