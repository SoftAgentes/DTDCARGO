# Cierre — recuperación reproducible de 0223

## Resultado

- Rol: worker aislado.
- Rama: `codex/0448-replay-0223-history`.
- PR: #29 contra `main`.
- Objetivo cumplido: añadir una migración idempotente nueva que reproduce el estado final de `0223` sin SQL ad hoc ni contenido de #21 o #23.

## Rutas propias

- `supabase/migrations/0448_restore_calculator_settings_0223_history.sql`
- `supabase/tests/0448_restore_calculator_settings_0223_history.test.sql`
- `.agents/handoffs/2026-09-05-restore-0223-history-close.md`

## Evidencia

- Contratos SQL: 140/140 verdes en PostgreSQL 17 desechable.
- Reconstrucción completa del schema: verde con 399 archivos de migración.
- Numeración: `0448` sin colisión.
- RPC pública de Producción, consulta read-only: HTTP 200 y exactamente las diez claves públicas esperadas.
- Checks alojados de la PR: Vercel Deployment, Vercel Agent Review y Preview Comments verdes antes de este handoff documental.

## Gates no cruzados

- La PR #29 no fue fusionada.
- `0448` no fue aplicada a Supabase Cloud.
- No se creó ni cobró un nuevo Supabase efímero.
- No se modificaron ni integraron las PR #26, #27 o #28.

## Siguiente responsable

Un integrador, en una tarea exclusiva, debe revisar y fusionar #29 sólo con autorización explícita. La aplicación nominal de `0448` a Cloud requiere una autorización independiente posterior. Después corresponde autorizar otro Supabase efímero para repetir los 168 E2E de #28.
