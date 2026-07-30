# Cierre · SDD-0185 NUM-01

Fecha: 2026-07-30
Rol: ventana autónoma en worktree aislado
Rama: `codex/sdd-0185-num-01-hardening`
Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0185-num-01-hardening`

## Alcance

NUM-01 v1.1 endurece `NumericInput` para conservar el último valor válido ante
una expresión incompleta, evaluar aritmética con decimal reproducible,
normalizar locale por operando y confirmar el total canónico. El único slice
R3 es base/porcentaje de Retenciones.

## Rutas propias

- `__tests__/parse-numeric-expression.test.ts`
- `app/studio/(app)/fiscal/_components/WithholdingDrawer.test.tsx`
- `app/studio/(app)/fiscal/_components/WithholdingDrawer.tsx`
- `app/studio/_components/ui/NumericInput.test.tsx`
- `app/studio/_components/ui/NumericInput.tsx`
- `app/studio/studio.css`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/BASELINE-2026-07-30-05.md`
- `docs/governance/README.md`
- `docs/governance/components/numeric-input.json`
- `docs/governance/generated/component-registry.json`
- `docs/governance/generated/governance-capsule.json`
- `docs/governance/policies/num-01.md`
- `docs/governance/reviews/num-01-v1-1-numeric-input.md`
- `docs/specs/0185-num-01-expresiones-decimales/spec.md`
- `docs/specs/README.md`
- `lib/studio/util/parse-numeric-expression.ts`
- `scripts/__tests__/component-registry.test.ts`

## Verificación

- pruebas focales: 62/62;
- suite Vitest: 4.160/4.160, 319 archivos;
- TypeScript: verde;
- ESLint proporcional: verde, cero warnings;
- `components:check`, `governance:check`, `docs:check`: verdes;
- build de producción Next.js 16.2.6 con Webpack: verde, 152 rutas;
- `git diff --check`: verde.

Turbopack no aceptó el junction externo de `node_modules` del worktree; Webpack,
soportado por Next.js, completó compilación, TypeScript y generación de rutas.

## Commit y publicación

- implementación: `c6cfd757cc33fd73616ae7ea8a1821bf73ab6dd6`;
- publicación confirmada: `origin/main` avanzó
  `0bdc23bd → c6cfd757`;
- migraciones, Supabase, Cloud y Vercel: no aplica;
- limpieza: no ejecutada; el worktree se conserva.

## Siguiente responsable

Ninguno para SDD-0185. Los restantes inputs legacy sólo se migran mediante
SDD y slices independientes.
