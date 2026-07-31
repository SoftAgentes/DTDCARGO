# Diseño técnico D5 — cobertura residual

## Decisión

D5 combina nueve triggers residuales con un workflow durable para Auth/correo.
Los triggers no copian PII, texto libre, URLs, tasas ni montos. El contacto de
cliente registra únicamente si correo/teléfono estaban presentes antes y
después.

Los efectos externos usan:

```text
intención durable
  → claim
  → Auth o correo
  → succeeded / failed / reconciliation_required
  → reconciliación con la misma operation_key
```

No existe promesa ACID entre PostgreSQL, Supabase Auth y Resend. Un estado
`in_progress` después de un efecto exitoso pero sin confirmación se considera
reconciliación pendiente, nunca éxito silencioso.

## Allowlist exacta

1. `supabase/migrations/0293_audit_d5_residual_and_writer_retirement.sql`
2. `supabase/tests/0293_audit_d5_residual_and_writer_retirement.test.sql`
3. `lib/studio/audit/external-effect-adapter.ts`
4. `lib/studio/audit/__tests__/external-effect-adapter.test.ts`
5. `app/studio/(app)/admin/portal-backfill-actions.ts`
6. inventario, diseño, revisión, spec, registro y línea base D5.

Los demás callers residuales no cambian: sus tablas reciben la frontera en
PostgreSQL sin alterar contratos de formulario.

## Aceptación

- nueve triggers habilitados;
- intención y transición externas idempotentes;
- lease, contador y reintento impiden claims concurrentes;
- reconciliación reutiliza la clave durable;
- PII ausente del evento;
- fallo del writer revierte mutación;
- `service_role` sin INSERT directo;
- schema reconstruible y fixture con rollback;
- TypeScript, lint y tests del adapter.
