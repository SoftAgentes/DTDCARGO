# Cierre SDD-0327 · Cookie autenticada de operario

- Rama: `codex/saneamiento-integral`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Base observada: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Alcance: token AEAD para `dtd_op`, tenant y vencimiento sellados, rechazo del
  UUID V1, pruebas y documentación.
- Cloud/Producción: sin escrituras, migraciones ni deploy.
- Efecto de rollout: las sesiones móviles preexistentes se invalidan una vez y
  los operarios deben ingresar de nuevo su PIN.
- Gate de publicación: pendiente de la autorización literal del remoto y del
  preflight final de toda la rama de saneamiento.

## Evidencia

- Focal: 2 archivos, 7 pruebas, todo verde.
- `pnpm typecheck`: verde.
- ESLint focal: verde.
- `pnpm verify`: exit 0; 14/15 gates medidos.
  - lint, frontera RSC, typecheck y 4 Edge Functions: verdes;
  - 510 archivos / 5.943 pruebas unitarias: verdes;
  - docs, numbering (319 specs / 396 migraciones), componentes y gobernanza:
    verdes;
  - 140 contratos SQL: verdes;
  - rebuild: 378 migraciones ejecutables + 18 sólo-ledger, 219 tablas y 2
    tenants: verde;
  - E2E: 150 aprobados, 18 skips declarados, cero fallos; un worker WebKit fue
    forzado a cerrar a 300 s por el problema conocido de teardown en Windows;
  - build: 158 páginas estáticas, verde; `tsconfig.json` restaurado por el
    harness;
  - único gate no medido: `migrations-applied`, sin credenciales de Producción
    en este worktree. No es un cierre verde alojado.
