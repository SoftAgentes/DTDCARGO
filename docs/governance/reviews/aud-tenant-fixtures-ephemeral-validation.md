# Validación efímera y teardown de SDD-0172

| Control | Valor |
|---|---|
| Revisión | REV-AUD-019 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Runbook | [E2E con Supabase efímero](../../runbooks/e2e-supabase-efimero.md) |
| Fecha | 2026-07-29 |
| Resultado | bloqueado fail-closed; teardown terminal verificado |

## 1. Preflight

- proyecto padre: `xpfuzqombmjmxvprjgmi`;
- estado padre: `ACTIVE_HEALTHY`;
- ramas previas: únicamente `main`;
- costo confirmado por el control plane: USD 0,01344 por hora;
- branch solicitado: `sdd-0172-ephemeral-20260729`;
- producción de datos: desactivada (`with_data=false`);
- lectura de filas de negocio o PII: ninguna.

## 2. Identidad efímera

| Campo | Valor |
|---|---|
| `branch_id` | `89181245-7fb0-47fe-add1-20f1b2e63acf` |
| `project_ref` | `zemkubdbodzbbumndbrr` |
| Creado | 2026-07-29T13:03:48.935288Z |
| Padre | `xpfuzqombmjmxvprjgmi` |
| Persistente | no |

No se registraron claves, contraseñas, URLs firmadas ni payloads.

## 3. Resultado del replay

El branch pasó de `CREATING_PROJECT` a `MIGRATIONS_FAILED`. Su ledger contiene
32 migraciones y termina en:

```text
20260526212625 back_content_admin
```

La siguiente migración presente en el ledger de Producción es:

```text
20260526213130 seed_team_invitation_template
```

El resultado reproduce la deuda ya descrita en
[SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md): ese seed
histórico depende de datos que no existen en una base fresca.

## 4. Decisión fail-closed

No se ejecutaron:

- `seed:e2e`;
- creación de usuarios Auth;
- fixture SDD-0168;
- SQL correctivo o migraciones manuales;
- reset, rebase o merge del branch;
- lectura de filas de Producción;
- Vercel.

El recorrido de aceptación SDD-0172 no queda aprobado. Un branch parcial no
tiene el schema requerido y no sirve para validar `0268` ni el lifecycle del
fixture.

## 5. Teardown terminal

El control plane eliminó únicamente el `branch_id` efímero y devolvió
`success=true`. La consulta posterior de ramas devolvió solo:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y el `project_ref` efímeros quedaron ausentes. Esto satisface la
evidencia terminal del teardown; no satisface el seed/E2E pendiente.

## 6. Veredicto técnico

REV-AUD-019 aprueba el comportamiento fail-closed y el teardown terminal del
intento. Rechaza cerrar SDD-0172 hasta resolver SDD-0118 en un gate propio y
repetir el recorrido completo sobre un entorno nuevo.

No se autoriza editar migraciones históricas, crear otra rama, aplicar SQL a
Producción ni abrir D1 o D2–D5 mediante esta revisión.

## 7. Segundo intento después de `0271`

Después de aplicar y verificar individualmente
`0271_repair_branch_replay_history`, se creó un entorno totalmente nuevo:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r2` |
| `branch_id` | `9c4d596b-02de-4759-ac1f-59fde07504de` |
| `project_ref` | `efnbhwrbdpgwlgtynacw` |
| Creado | 2026-07-29T13:53:18.736494Z |
| Datos de Producción | no |

El replay avanzó de 32 a 63 entradas. Su última migración confirmada fue:

```text
20260528060006 · 0027_qr_print_orders
```

PostgreSQL registró después:

```text
20260528060007 · 0031_fix_studio_invite_gen_random_bytes
ERROR: function name "public.studio_invite_user" is not unique
```

La causa es el `COMMENT ON FUNCTION` sin firma de `0031`: el historial ya
había creado el overload vigente de tres parámetros. No se ejecutaron seed,
Auth, fixtures, reset, rebase ni SQL correctivo.

## 8. Teardown terminal R2

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y `project_ref` R2 quedaron ausentes. La corrección propuesta
se documenta en
[REV-AUD-022](aud-sdd-0118-branch-replay-followup.md).
