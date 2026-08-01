# Cierre · SDD-0235 hardening de auditoría, datos y adjuntos

## Identidad

- Fecha: 2026-08-01
- Rol: worker aislado
- Rama: `codex/audit-hardening-20260801`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\audit-hardening-20260801`
- Base verificada: `origin/main@c13dfa8cd30dd5095abdcad32f28245569c47c56`
- Tiempo/tokens: n/a

## Alcance propio

- SDD-0235, allowlist, runbook de antivirus/backup/restore y tres documentos de privacidad.
- Migraciones y contratos SQL `0325`–`0329`.
- Hardening de PIN móvil, tracking público, grants internos, asignación de camionero y perfiles multi-tenant.
- Auth/RBAC de APIs y acciones Studio, login uniforme del portal, escape JSON-LD y rrweb fail-closed.
- Gate del piloto de adjuntos condicionado a AV, Object Lock y restore verificables.

El conjunto exacto de rutas es el diff `origin/main...5be7b06d895700b148c8609efcf109207cf3f128`.
No se incluyó Nómina 0316 ni trabajo de otros carriles.

## Verificación

- `pnpm test --run`: 378 archivos y 4.474 tests verdes.
- `node scripts/run-sql-tests.mjs`: 63 contratos verdes.
- `node scripts/check-schema-rebuild.mjs`: 324 migraciones procesadas, 307 aplicadas desde cero, 17 sólo-ledger y 219 tablas con aislamiento verificado.
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`, `pnpm governance:check`, `pnpm components:check`: verdes.
- `pnpm build`: verde con Next.js 16.2.11.
- `npm.cmd run test:critical`: no ejecutable porque el repositorio no define ese script; la cobertura crítica quedó sustituida por la suite completa, SQL, reconstrucción y build anteriores.
- E2E con Supabase: bloqueado en este worktree limpio por ausencia deliberada de credenciales; no se apuntó a Producción.

## Commits

- `a87a1d71aefda247a2f01449785c8a9fbf6e6dc8` · documentación.
- `ac6d5f2e19ca3ae0e0882318f44bfafd0a05a6cd` · migraciones y contratos.
- `5be7b06d895700b148c8609efcf109207cf3f128` · aplicación y pruebas.

## Publicación y gates externos

- Push completado por la orden literal `cerrar`: `origin/codex/audit-hardening-20260801`.
- La publicación inicial alcanzó `7f12627a`; el remoto de la rama quedó configurado como upstream.
- Durante el cierre `origin/main` avanzó a `87217301` por un recibo documental de Gobernanza. No se fusionó durante este cierre.
- Integración a `main`: pendiente de un integrador exclusivo; otra tarea activa usa el checkout principal.
- Supabase Cloud: no tocado. `0325`–`0329` requieren autorización nominal, una por vez.
- Vercel/Producción: no tocados.
- Proveedor externo, antivirus, Object Lock y restore drill: no configurados; el piloto permanece fail-closed.

## Siguiente responsable

Integrador exclusivo: consumir esta rama publicada, reconciliarla con el `origin/main` vigente, ejecutar el gate proporcional y publicar `main`. Después, solicitar por separado cada autorización Cloud y conservar los gates de proveedor/restore.
