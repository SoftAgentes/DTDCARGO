# Handoff · cierre de la 0536 aplicada en producción (SDD-0631)

Fecha: 2026-11-14 · Rama: `claude/cierre-0536` · PR #543 · Director General

## Hecho

- El 2026-11-14 la 0536 se aplicó en producción con el OK nominal de Sam: «Sí, aplícala». El
  conteo previo, también autorizado, dio 0 CxP vivas con embarque.
  - COMMIT: 05:14:00Z.
  - Ledger: `version` 20261114051359, md5 `bf7b3204624423d5a576404c59bbf087`, 7708 bytes.
    Pasó de 529 a 530 filas.
  - Evidencia en `/srv/ops/evidencias/`:
    - lectura previa: `previa-0536-dtd-cargo-20261114T051320Z`
    - apply: `apply-0536-dtd-cargo-20261114T051359Z`
- `retirar-espera.mjs` quitó la espera de `pendingBelowCutoff` y una declaración de símbolos.
  También selló la migración en `migrations.lock.json` con forma `ledger` exacta.
- La spec SDD-0631 tiene el registro del §6.3 en su sección 6.
- `module-sdd-map.md` y `docs/runbooks/cxp-aliado-de-espacio.md` dejaron de condicionar su
  contenido a «cuando esté aplicada».
- El handoff `0631-cxp-ligada-contenedor.md:84` («Aplicar la 0536») queda cumplido con este
  cierre. Es evidencia fechada, por eso no se editó.

## Comprobaciones

- `node scripts/migrations-lock.mjs`: PASÓ (exit 0, 518 selladas, 3 esperas: 0422, 0423
  y 0537).
- `node scripts/check-pending-migration-symbols.mjs`: PASÓ (0 ROJO, 2 AMARILLO de la 0537).
- `node scripts/build-docs-index.mjs --check`: PASÓ.
- `pnpm verify`: NO EJECUTADO. El cambio es de datos de migración y docs; el portón es el CI.

## Pendiente de esta tarea

- Smoke en el Studio con una cuenta de contabilidad: Tesorería › nueva CxP con contenedor, y
  Costing › margen del contenedor. Va con un monto de prueba y la CxP se anula al terminar.

## FUERA DE ALCANCE DETECTADO

- Las ramas de degradación «la base todavía no tiene la 0536», en `costing/queries.ts`,
  `treasury/cost-link-queries.ts`, `treasury-actions.ts` y `CostingClient.tsx`, se dejan como
  defensa. Se pueden retirar más adelante en una tarea aparte.
