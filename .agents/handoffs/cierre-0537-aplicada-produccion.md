# Handoff · cierre de la 0537 aplicada en producción (SDD-0630)

Fecha: 2026-11-14 · Rama: `claude/cierre-0537` · Director General

## Hecho

- El 2026-11-14 la 0537 se aplicó en producción con el OK nominal de Sam: «Sí, aplícala».
  - COMMIT: 06:06:42Z.
  - Ledger: `version` 20261114060642, md5 `0a8205477a1c66722918789483877eab`,
    36185 bytes. Pasó de 530 a 531 filas.
  - Evidencia en `/srv/ops/evidencias/`:
    - lectura previa: `previa-0537-dtd-cargo-20261114T055818Z`
    - apply: `apply-0537-dtd-cargo-20261114T060641Z`
- `retirar-espera.mjs` quitó la espera de `pendingBelowCutoff` y dos declaraciones de
  símbolos. También selló la migración en `migrations.lock.json` con forma `ledger` exacta.
- La spec SDD-0630 tiene el registro del §6.3 y su resumen dejó de decir «en espera».
- Con esto se levanta el candado de publicación: la app de SDD-0630 ya puede publicarse.

## Comprobaciones

- `node scripts/migrations-lock.mjs`: PASÓ (exit 0, 519 selladas, 2 esperas: 0422 y 0423).
- `node scripts/check-pending-migration-symbols.mjs`: PASÓ (0 ROJO, 0 AMARILLO).
- `node scripts/build-docs-index.mjs --check`: ver el commit.
- `pnpm verify`: NO EJECUTADO. El cambio es de datos de migración y docs; el portón es el CI.

## Pendiente de esta tarea

- Smoke de confirmar un reporte con recibo, en el ambiente de prueba (producción no tiene
  facturas). Se repite con la primera factura real.

## FUERA DE ALCANCE DETECTADO

- Las ramas de degradación «sin la 0537 / PGRST202», en `StudioInvoicePaymentReports.tsx`,
  `payment-queries.ts` y `payment-report-commands`, se dejan como defensa. Se pueden
  retirar en una tarea aparte.
- La espera de la 0422 en la baseline todavía no menciona la 0537. Se revisa al pedir el
  OK de la 0422.
