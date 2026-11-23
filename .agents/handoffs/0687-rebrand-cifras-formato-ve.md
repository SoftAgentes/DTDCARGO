# Handoff — SDD-0687, cifras `1.234,50` (spec)

Fecha: 2026-11-22 · Rama: `claude/sdd-0687-cifras-53a450` · PR: #769 · Base: `origin/main` `27d8b46d9` · Alcance: **solo la spec**, nada implementado.

## Hecho

- `docs/specs/0687-rebrand-cifras-formato-ve/spec.md` (estado `proposed`), retomada de la rama local `claude/sdd-0687-cifras-formato-ve` (2026-11-20) y medida de nuevo sobre `main`.
- **§4.2** modo y precisión por tipo de campo (dinero 2, tasa 8 al teclear y 4 al mostrar, porcentaje 2, medida). Un separador único con tres cifras en dinero (`1.234`, `1,234`, `10,000`) se rechaza: es norma, no decisión.
- **§4.3** helper único `lib/shared/cifras.ts`; `parseNumero(texto, modo)` cubre los cuatro modos; `lib/money.ts` queda como fachada.
- **§5.1** pantallas y salidas (Facturación, Cobranzas, Portal, `/tarifas` y calculadoras, móvil, PDF con sus cinco formateadores, correos, CSV y Excel). **§5.2** choques: rama `claude/sdd-0686-fase3-movil-noticias` (cinco archivos de `app/m`, la fase 6 espera) y 0704 F1-B (sin coincidencias). **§5.3** lo que viaja a otro sistema sigue numérico. **§5.4** dependencia de ICU y negativo `-$1.234,50`.
- **§9** diez decisiones A/B para dibujar con `show_widget` antes de preguntar a Sam. Las fases 1 y 2 esperan la 2, la 5 y la 6.
- Revisión independiente: dos rondas `CHANGES_REQUESTED` (B1 y M1 a M7, y luego diez ajustes de coherencia), resueltas en la misma rama.

## Pendiente de esta tarea

- Re-revisión de la cabeza nueva, aprobación de Sam y dibujar las decisiones de §9.
- Enmienda de NUM-01 (v1.1 → v1.2): va en la fase 1, con aprobación de Sam.

## Verificación

`pnpm docs:check` y `pnpm sdd:check` pasaron en local. No se corrió vitest ni `pnpm verify` (solo documentos).

## FUERA DE ALCANCE DETECTADO

- `fmtUsd` pinta `$0.00` con `NaN` o infinito, lo que esconde errores (decisión 8).
- Montos que el caso 2.2 pudo guardar mil veces menores no se detectan por formato; sería una consulta aparte con autorización nominal de Sam (no se hizo).
- `<input type="number">` por navegador no se midió.
- `0497_reverso_al_anular_factura.sql:795` usa `to_char` en un mensaje de error (migración aplicada, no se toca).

## Impacto documental

Spec nueva e índice de specs regenerado. NUM-01 y la cabecera de `lib/money.ts` se actualizan en las fases 1 y 3.
