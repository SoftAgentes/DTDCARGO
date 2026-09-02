# Cierre local · SDD-0329 · caché E2E aislada

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`
Base remota auditada: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`

## Resultado

El paso E2E de `scripts/verify.mjs` ya no comparte `.next` con el servidor de
desarrollo normal. `scripts/check-e2e.mjs` usa `.next-verify-e2e`, elimina sólo
esa salida antes y después de Playwright, y restaura `tsconfig.json` byte por
byte si Next añade el `distDir` temporal.

El exit `2` queda reservado para fallos del wrapper o de su limpieza. El
absolvedor de `verify.mjs` sólo acepta el exit `1` de Playwright cuando el
reporte prueba que todos los tests pasaron, de modo que un fallo del arnés no
puede confundirse con el teardown conocido de WebKit.

## Evidencia ejecutada

- Contratos focales: `14/14` en
  `scripts/__tests__/{check-e2e,verify-e2e}.test.mjs`.
- Smoke real por el wrapper: `2/2` casos de `/acceso` en Chromium, sin retry.
- Hash de `tsconfig.json` antes/después del smoke:
  `abbb264672e3ae1d261a3370e4db9d2e039e35f0`.
- `.next-verify-e2e` y `.next-verify` ausentes al terminar.
- `node scripts/verify.mjs`: exit `0`, sin fallos:
  - lint, frontera RSC, typecheck y Edge Functions: OK;
  - Vitest: `511` archivos, `5.945` tests;
  - documentación: `321` specs; numeración sin colisiones nuevas;
  - componentes y gobernanza: OK;
  - SQL: `141` contratos;
  - reconstrucción: `397` migraciones inventariadas, `379` ejecutables,
    `18` sólo-ledger, `219` tablas y `2` tenants;
  - E2E: `150` pasaron, `18` Tier 3 omitidos por falta de seed, `0` fallos;
  - build de producción: `158` rutas, OK.
- `migrations-applied`: único paso no medido, porque este worktree no contiene
  credenciales Cloud. No se sustituyó esa evidencia con escrituras externas.
- `git diff --check`: limpio.

## Límites conservados

- No se borró ni alteró `.next`.
- No se aplicaron migraciones.
- No hubo escrituras en Supabase Cloud, Vercel o Producción.
- No hubo push ni integración a `main`.

## Gate pendiente

El commit local puede publicarse únicamente cuando el founder autorice de forma
literal el push de `codex/saneamiento-integral` al remoto ya auditado.
