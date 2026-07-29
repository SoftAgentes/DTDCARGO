# Follow-up del historial de invitaciones supersedido

| Control | Valor |
|---|---|
| Revisión | REV-AUD-022 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Candidata | `0272_skip_superseded_invite_history` |
| Fecha | 2026-07-29 |
| Resultado | aplicada y verificada; tercer branch pendiente |

## 1. Evidencia del replay

El branch R2 superó el bloqueo original y llegó a 63 migraciones. Falló en:

```text
20260528060007 · 0031_fix_studio_invite_gen_random_bytes
ERROR: function name "public.studio_invite_user" is not unique
```

El log PostgreSQL prueba que el `CREATE OR REPLACE` de dos parámetros se
ejecutó, pero su `COMMENT ON FUNCTION public.studio_invite_user` no pudo
resolver entre los overloads de dos y tres parámetros.

`0031` y `0032` son fixes históricos supersedidos: la migración real de
`user_invitations_region` ya eliminó el overload antiguo y creó
`studio_invite_user(text,text,text)` con el qualifier de `gen_random_bytes` y
el retorno no ambiguo.

## 2. Decisión

`0272` restaura en esas dos entradas los comments post-hoc originales. No
edita la función para conservar un overload obsoleto y no altera producto.

Precondiciones:

- versión y nombre exactos;
- un statement por entrada;
- digest igual al payload restaurado por `0271` o al comment final.

Postcondiciones:

- un statement por entrada;
- digest exacto del comment no-op;
- segunda ejecución sin cambios.

## 3. Evidencia local

| Gate | Resultado |
|---|---|
| SHA-256 | `5aa89ccb01db8aefeada9625ec08c8d7ba6dd90e17d4a16013e4a819e476ccea` |
| Generación determinista | verde |
| Vitest | 4/4 |
| PostgreSQL 15 | verde · 2 updates + segunda ejecución + rollback |
| PostgreSQL 17 | verde · 2 updates + segunda ejecución + rollback |
| Contenedores propios residuales | cero |

## 4. Veredicto

REV-AUD-022 aprueba técnicamente `0272`. Su aplicación individual y
postflight están registrados en
[REV-AUD-023](aud-sdd-0118-branch-replay-followup-application.md). El tercer
branch sólo se crea después de ese postflight.

`0270`, CMP-01 v1.1, D1, slices de adopción, D2–D5, Vercel y PLG-P3
permanecen fuera de alcance.
