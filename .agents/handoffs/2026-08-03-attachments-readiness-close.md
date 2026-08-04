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
- `b825a270` — comando operativo, documentación y este handoff.
- Rama publicada y sincronizada en `origin/codex/attachments-readiness-close-20260803`.
- Integración a `main` autorizada el 2026-08-03; la selección de proveedor y el
  gate específico de GuardDuty viajan en el commit final de este carril.

## Validación

- `pnpm build`: verde.
- Vitest completo: 397 archivos, 4.692 pruebas verdes.
- SQL: 72 contratos verdes.
- Schema rebuild: 335 migraciones reconstruidas; 219 tablas y 2 tenants verificados.
- E2E contra servidor preconstruido con variables Supabase cargadas solo en proceso: 72 verdes, 18 omitidas por requerir seed; Mobile Safari y CBM verdes.
- El primer `pnpm verify` dejó como único rojo externo las migraciones Kommo
  `0342`/`0343`; `main` avanzó después y el gate se repite antes de integrar.

## Pendientes externos

- Infraestructura seleccionada: AWS S3 + GuardDuty en `us-east-1`, con
  contratación y conexión todavía bloqueadas por contrato/PIPL y evidencia real.
- Implementar el adapter GuardDuty EventBridge/SQS; el preflight bloquea el
  provider id `aws-guardduty-s3` hasta que exista.
- Ejecutar EICAR, Object Lock, restore drill y RPO/RTO reales antes del piloto.
- No se tomó ningún número SDD o de migración.
