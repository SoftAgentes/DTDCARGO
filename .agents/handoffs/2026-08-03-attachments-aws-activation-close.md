# Handoff · SDD-0224 · infraestructura AWS de adjuntos

**Fecha:** 2026-08-03
**Rama:** `codex/attachments-aws-activation-20260803`
**Worktree:** `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\attachments-aws-activation-20260803`
**Rol:** worker aislado
**Estado:** listo para publicar en rama; integración y AWS pendientes

## Alcance cerrado

- Adaptador GuardDuty EventBridge/SQS con autenticidad contextual,
  idempotencia y fallo cerrado.
- Plantilla CloudFormation para scan temporal, GuardDuty, SQS/DLQ, SSE-KMS,
  backup Object Lock `COMPLIANCE`, alarmas y presupuesto.
- Runner sintético para EICAR, denegación de borrado, restore y RPO/RTO.
- Deploy y postflight automatizados con identidad STS y receipts externos.
- Gate de activación para contrato, PIPL, antivirus, Object Lock y restore.
- Expediente contractual AWS, evaluación PIPL, consentimiento separado y
  evaluación de impacto preparados sin almacenar documentos sensibles en Git.

No se tocó diseño, Kommo, Supabase Cloud, Vercel ni Producción. No se creó ni
aplicó ninguna migración y no se reservó ningún correlativo.

## Commits propios

- `8ffaa0a9` · adaptador e infraestructura AWS.
- `7a567dd4` · expediente AWS y PIPL.
- `157a9255` · deploy y postflight verificables.
- `68c81784` · contrato y PIPL conectados al postflight.

`519d87a4` integra `origin/main` dentro del carril sin conflictos.

## Rutas propias

- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `infra/attachments-aws/cloudformation.json`
- `scripts/attachments-aws-*.mjs`
- `scripts/attachments-guardduty-adapter.mjs`
- `scripts/attachments-pilot-{preflight,worker}.mjs`
- `scripts/__tests__/attachments-{aws-*,guardduty-*,pilot-preflight}.test.mjs`
- `lib/studio/attachments/pilot-gate.ts`
- `lib/studio/attachments/__tests__/pilot-gate.test.ts`
- `docs/specs/0224-adjuntos-seguros-reanudables/{spec.md,pilot-gastos-allowlist.md}`
- `docs/legal/privacidad/{README.md,inventario-terceros.md,evaluacion-proveedor-respaldo-externo.md,aws-adjuntos-expediente-contractual.md,pipl-aws-adjuntos.md}`
- `docs/runbooks/adjuntos-backup-antivirus-restore.md`
- este handoff.

## Verificación ejecutada

- `uvx cfn-lint infra/attachments-aws/cloudformation.json` · verde.
- 36 pruebas AWS focalizadas · verdes.
- `pnpm build` · verde.
- `pnpm verify` · verde: 404 archivos, 4.737 tests, 73 contratos SQL,
  reconstrucción de 337 migraciones y 72/90 E2E.
- E2E serial adicional · 72 aprobados, 18 omitidos, cierre natural en 38,4 s.
- `git diff --check` · verde.

## Bloqueo externo conservado

No existe cuenta/perfil AWS autenticado, account ID, receipts contractuales o
PIPL ni evidencia alojada. Por ello antivirus, worker y piloto permanecen
apagados. No deben activarse con fechas o archivos fabricados.

## Siguiente responsable

Una tarea integradora exclusiva debe revisar este handoff, integrar la rama a
`main`, ejecutar el gate final y publicar. Después, Sam debe habilitar una
cuenta AWS corporativa y un rol temporal para ejecutar deploy, simulacro y
postflight. Solo un postflight `ok: true` autoriza activar antivirus y piloto.

**Tiempo/tokens:** expuestos por la plataforma únicamente en el goal; no se
copian al repositorio.
