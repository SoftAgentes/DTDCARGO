# Handoff SDD-0328 · RPC de verificación detrás del throttle

- Rama: `codex/saneamiento-integral`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Base observada: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Migración local: `0400_revoke_public_verify_rpc_execute.sql`
- Cambio: revoca Data API directo para `anon/authenticated` y conserva
  `service_role` para `/verificar` después de su throttle.
- Cloud/Producción: NO aplicada; sin lecturas de PII ni escrituras remotas.
- Estado SDD: `in-progress` hasta aplicar y verificar nominalmente en Producción.

## Evidencia

- Supabase CLI `2.108.0`; archivo inicial creado con
  `supabase migration new` y normalizado al correlativo canónico `0400`.
- Fuentes oficiales revisadas: changelog, seguridad del Data API, funciones de
  base de datos y seguridad de productos; sin breaking change aplicable al ACL.
- SQL focal/integral: 141 contratos verdes, incluido
  `0400_revoke_public_verify_rpc_execute.test.sql`.
- Advisor de seguridad local: no medido porque no había stack Supabase local;
  falló al conectar antes de consultar. No se usó `--linked` ni Cloud.
- `pnpm typecheck` y ESLint focal: verdes.
- `pnpm verify`: exit 0; 14/15 gates medidos.
  - 510 archivos / 5.943 pruebas unitarias: verdes;
  - docs y numbering: 320 specs / 397 migraciones;
  - 141 contratos SQL: verdes;
  - rebuild: 379 migraciones ejecutables + 18 sólo-ledger, 219 tablas y 2
    tenants: verde;
  - E2E: 148 aprobados, 2 flaky que pasaron en retry, 18 skips declarados y
    cero fallos finales; un worker WebKit fue forzado a cerrar a 300 s;
  - los 2 flaky fueron `/acceso` por `__webpack_require__.C` en el bundle de
    desarrollo, ruta no tocada por este slice. Tras eliminar sólo la caché
    ignorada `.next`, la reproducción focal Chromium pasó 2/2 sin retry;
  - build: 158 páginas estáticas, verde; `tsconfig.json` restaurado;
  - único gate no medido: `migrations-applied`, sin credenciales de Producción.
