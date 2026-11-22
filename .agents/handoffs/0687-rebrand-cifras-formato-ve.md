# Handoff — SDD-0687, cifras `1.234,50` (spec)

Fecha: 2026-11-22 · Rama: `claude/sdd-0687-cifras-53a450` · Base: `origin/main` `27d8b46d9` · Alcance: **solo la spec**, nada implementado.

## Hecho

- `docs/specs/0687-rebrand-cifras-formato-ve/spec.md` (estado `proposed`): retoma el texto de la rama local `claude/sdd-0687-cifras-formato-ve` (2026-11-20) y lo mide de nuevo sobre `main`.
- Conteos nuevos (por texto, son techo): 40 importadores de `lib/money.ts`; 78 archivos con `en-US`; 111 con `toFixed(`; 127 con `toLocaleString`/`Intl.NumberFormat`; 45 con `<NumericInput>`; 46 con `type="number"`; 26 con `replace(",", ".")` a mano; 37 pruebas con `1,234.50`.
- §4.2: helper único propuesto, `lib/shared/cifras.ts` (la web pública no puede importar de `lib/studio`), con `lib/money.ts` como fachada.
- §5.1: pantallas y salidas afectadas (Facturación, Cobranzas, Portal, `/tarifas` y calculadoras, móvil, PDF, correos, CSV y Excel).
- §5.2: choques anotados, sin editar nada ahí: la rama `claude/sdd-0686-fase3-movil-noticias` (cinco archivos de `app/m`) y la 0704 F1-B (no hay coincidencias; la fase 4 espera).
- §9: nueve decisiones como opciones A/B para dibujar con `show_widget` antes de preguntar a Sam.
- Riesgos de CSV/Excel y de campos de entrada: §2, §6 y §7 (R1, R2, R7).

## Pendiente de esta tarea

- Aprobación de Sam sobre la spec (y, vistas, las decisiones de §9). Dibujarlas es el siguiente paso de quien coordine.
- Enmienda de NUM-01 (v1.1 → v1.2): va en la fase 1, con aprobación de Sam.
- Revisión previa (toca montos) y revisión independiente específica de la interpretación de cifras.

## Verificación

- `pnpm docs:check` y `pnpm sdd:check`: ver el cierre de la PR. No se corrió vitest ni `pnpm verify` (solo documentos).

## FUERA DE ALCANCE DETECTADO

- `fmtUsd` pinta `$0.00` cuando recibe `NaN` o infinito, lo que esconde errores de datos (decisión 8 de la spec).
- Montos que el caso 2.2 pudo guardar mil veces menores en el pasado no se pueden detectar por formato; sería una consulta aparte con autorización nominal de Sam (no se hizo).
- El comportamiento de `<input type="number">` por navegador no se midió.

## Impacto documental

Spec nueva e índice de specs regenerado. NUM-01 y `lib/money.ts` (cabecera) se actualizan en las fases 1 y 3, no aquí.
