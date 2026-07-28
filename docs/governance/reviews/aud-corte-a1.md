# Revisión de aplicación individual del Corte A1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-003 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Corte A v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-a.md) |
| Archivo | [`0258_audit_entity_catalog.sql`](../../../supabase/migrations/0258_audit_entity_catalog.sql) |
| Fecha | 2026-07-22 |
| Resultado técnico | aprobado para aplicación individual |
| Estado operativo | no autorizado para ejecutar; no aplicado |
| A2 | excluido |
| Decisión | Revisión solicitada por Sam (founder) + veredicto técnico Codex |

## 1. Veredicto

`0258_audit_entity_catalog` es técnicamente apta para aplicarse como una única
migración A1. No se detectaron bloqueantes de seguridad, compatibilidad,
integridad ni operación dentro de su alcance.

Esta revisión **no ejecuta ni autoriza por sí sola la escritura en Cloud**. El
gate de producción continúa requiriendo una instrucción explícita que nombre el
basename exacto y la ejecución del runbook. A2 no puede incluirse, redactarse ni
aplicarse bajo esta decisión.

## 2. Alcance comprobado

La migración solamente:

1. ejecuta un preflight fail-closed;
2. crea `public.audit_entity_types` con RLS y sin privilegios de aplicación;
3. carga 16 tipos conocidos y cualquier clave histórica válida ausente;
4. comprueba la unión antes de tocar la relación;
5. añade `entity_audit_log_entity_type_fkey` como `NOT VALID`;
6. conserva `entity_audit_log_entity_type_check` para A2.

No valida la FK, no retira el CHECK, no cambia grants/policies/Realtime de
`entity_audit_log`, no toca payloads y no modifica writers ni viewer.

## 3. Preflight Cloud metadata-only

Comprobado el 2026-07-22 a las 12:06 UTC, sin DDL ni DML:

| Comprobación | Resultado |
|---|---|
| `entity_audit_log` | existe |
| `audit_entity_types` | no existe |
| CHECK de `entity_type` | existe exactamente uno |
| FK objetivo | no existe |
| Tipos históricos distintos | `consolidation` |
| Filas con formato de clave inválido | 0 |
| Tamaño total estimado | 64 KiB; 3 filas estimadas |
| Índice compatible | `entity_audit_log_entity_idx (entity_type, entity_id, occurred_at desc)` |
| Locks en espera | 0 |
| Roles requeridos | `anon`, `authenticated` y `service_role` existen |
| Ledger Cloud 0257/0258 | sin coincidencias |

El ledger vacío para 0257/0258 no permite agrupar migraciones. Si se autoriza
A1, se aplica exclusivamente `0258_audit_entity_catalog`; 0257 conserva su
propio gate independiente.

## 4. Ensayo transaccional local

El stack local disponible no contiene `entity_audit_log`, por lo que se creó
una fixture mínima equivalente dentro de una sola transacción. Sobre ella se
ejecutó el archivo A1 completo y se comprobó:

- 16 filas de catálogo;
- `rendition` activa;
- FK presente como `NOT VALID`;
- CHECK original preservado;
- cero privilegios efectivos del catálogo para `anon`, `authenticated` y
  `service_role`;
- sintaxis y postcondiciones completas en verde.

La transacción terminó en `ROLLBACK`; tanto la fixture como el catálogo quedaron
ausentes al finalizar. No se alteró la base local persistente.

## 5. Condiciones del gate de aplicación

Antes de escribir en Cloud se debe:

1. recibir autorización explícita para **aplicar
   `0258_audit_entity_catalog` en Cloud**;
2. confirmar el mecanismo de backup/recuperación vigente;
3. repetir inmediatamente el preflight de existencia, constraints, tipos y
   locks;
4. aplicar solo ese basename mediante el runbook;
5. comprobar catálogo, RLS, ACL, 16 tipos mínimos, FK no validada y CHECK
   preservado;
6. comparar grants de `entity_audit_log` antes/después;
7. ejecutar advisors de seguridad y performance;
8. registrar el resultado sin presentar A1 como Corte A completo.

Si el catálogo/FK aparece, desaparece el CHECK, surge una clave histórica con
formato inválido o hay locks en espera, la aplicación debe abortar y volver a
revisión.

## 6. Decisión registrada

REV-AUD-003 cierra la revisión técnica de A1 con resultado **aprobado para
aplicación individual**. La migración permanece no aplicada. A2, 0257 y la
matriz ACL no forman parte de este gate.
