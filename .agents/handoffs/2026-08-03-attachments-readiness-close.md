# Handoff · 2026-08-03 · Cierre autónomo de readiness de adjuntos

**Rama:** `codex/attachments-readiness-close-20260803`
**Worktree:** `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\attachments-readiness-close-20260803`
**Alcance:** SDD-0224, únicamente worker/preflight, pruebas y documentación operativa. Cero cambios visuales, de diseño o de migraciones.

## Resultado

- El worker de antivirus/backup ya no puede reclamar trabajos solo por tener credenciales: exige `DTD_ATTACHMENTS_WORKER_ALLOW=1`.
- En Producción exige además piloto y confirmación activos, endpoints HTTPS y evidencia reciente de firmas AV, EICAR, Object Lock y restore drill.
- El preflight y sus errores exponen nombres de controles, nunca valores secretos.
- Se agregó el comando `pnpm attachments:preflight` y se actualizó el runbook/allowlist.

## Commits

- `78777843` — implementación fail-closed y 8 pruebas unitarias.
- El commit operativo que contiene este handoff, el comando y la documentación se registra como el commit siguiente de esta rama.

## Validación

- `pnpm build`: verde.
- Vitest completo: 397 archivos, 4.692 pruebas verdes.
- SQL: 72 contratos verdes.
- Schema rebuild: 335 migraciones reconstruidas; 219 tablas y 2 tenants verificados.
- E2E contra servidor preconstruido con variables Supabase cargadas solo en proceso: 72 verdes, 18 omitidas por requerir seed; Mobile Safari y CBM verdes.
- `pnpm verify`: todos los pasos propios verdes; único rojo externo en `migrations-applied` por `0342_kommo_contact_link` y `0343_kommo_unsorted_mirror`, pertenecientes a otro carril y no aplicadas en esta sesión.

## Pendientes externos

- No activar el worker ni el piloto hasta contratar/configurar el proveedor AV y el almacenamiento inmutable, ejecutar EICAR y restore drill reales y registrar evidencia vigente.
- Las migraciones `0342_kommo_contact_link` y `0343_kommo_unsorted_mirror` requieren autorización nominal y aplicación individual por su carril; este trabajo no depende de ellas.
- La rama queda local, sin push, integración ni deploy. No se tomó ningún número SDD o de migración.
