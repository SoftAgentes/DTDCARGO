# Revisión técnica local del Corte B1

| Control | Valor |
|---|---|
| Revisión | REV-AUD-008 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Corte B v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-b.md) |
| Migración | [`0267_audit_contract_append_only.sql`](../../../supabase/migrations/0267_audit_contract_append_only.sql) |
| Prueba | [`0267_audit_contract_append_only.test.sql`](../../../supabase/tests/0267_audit_contract_append_only.test.sql) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado para aplicación individual futura |
| Estado operativo | implementado y verificado localmente; no aplicado en Cloud |
| Decisión | Gate B1 local autorizado por Sam (founder) + revisión técnica Codex |

## 1. Veredicto

`0267_audit_contract_append_only` cumple el diseño B0 aprobado y es
técnicamente apta para una futura aplicación individual. Añade el contrato v1,
crea un writer estrecho y reduce privilegios directos sin migrar callers ni
presentar como absoluta una garantía que todavía tiene una excepción por
tenant.

La revisión no autoriza ni ejecuta Cloud, integración o push. Tampoco abre los
Cortes C–E.

## 2. Alcance comprobado

La migración:

1. aborta si A2, ACL, policies, Realtime o la FK de tenant no coinciden con B0;
2. añade las ocho columnas aprobadas con defaults legacy honestos;
3. reemplaza el CHECK de actor para admitir `agent` e `integration`;
4. valida identidad de actor, correlación, origen, resultado, motivo, JSON,
   schema y sensibilidad;
5. detecta recursivamente claves prohibidas, sin distinguir mayúsculas;
6. crea `append_audit_event` como `SECURITY DEFINER`,
   `SET search_path = ''`, owner `postgres` y cero SQL dinámico;
7. limita el writer y su helper JSON a `service_role` y owner;
8. deja la tabla con `SELECT authenticated` e `INSERT service_role`;
9. retira `entity_audit_log_service_role_all`;
10. crea únicamente el índice parcial aprobado por tenant/correlación.

No cambia las nueve columnas históricas, las siete RPC SQL, los ocho writers
TypeScript, el viewer, Realtime, el catálogo A2 ni datos existentes.

## 3. Revisión de seguridad

La matriz final queda:

| Rol | Privilegios directos de tabla |
|---|---|
| `PUBLIC` | ninguno |
| `anon` | ninguno |
| `authenticated` | `SELECT` |
| `service_role` | `INSERT` |
| `postgres`/owner | administrativos |

La migración usa `REVOKE ALL` antes de los grants exactos y comprueba
`pg_class.relacl` mediante `aclexplode`, de modo que un privilegio explícito
adicional también aborta la postcondición. RLS permanece habilitado como
segunda capa y la policy amplia de `service_role` se elimina.

El helper `audit_json_has_forbidden_key(jsonb)` solo devuelve un booleano,
es `IMMUTABLE`, usa `search_path` vacío y no es ejecutable por `PUBLIC`,
`anon` ni `authenticated`. `service_role` conserva `EXECUTE` porque los
CHECK de inserts legacy lo necesitan.

## 4. Ensayo PostgreSQL 15 y 17

La misma prueba contractual se ejecutó en contenedores desechables
`postgres:15` y `postgres:17`. En ambos casos terminó con código `0`,
`ROLLBACK` y:

```text
b1_fixture_rolled_back = true
```

La prueba verificó:

- las nueve columnas históricas sin drift;
- ocho columnas nuevas y doce CHECK validados;
- defaults `legacy_unknown` sobre una fila sintética;
- actores `agent`, `integration` y `system` sin actor ID;
- rechazo de entidad inactiva, actor, evento, source, result, schema y
  sensibilidad inválidos;
- rechazo recursivo de claves prohibidas por writer y por INSERT legacy;
- motivo obligatorio en rechazo, falla y terminaciones gobernadas;
- ACL exacta de tabla, writer y helper;
- fallos de `UPDATE`, `DELETE` y `TRUNCATE` para `service_role`;
- `SELECT authenticated` e `INSERT service_role`;
- operación y definición inalterada de las siete firmas SQL inventariadas;
- FK de tenant todavía `ON DELETE CASCADE`;
- membresía Realtime sin cambio;
- cero objetos o fixtures persistidos al finalizar.

El warning de `wal_level` corresponde al contenedor PostgreSQL estándar y no
afecta la prueba de membresía de publicación. No se inició ni reinició el stack
Supabase del proyecto y no se consultó ni modificó Cloud.

## 5. Límite de append-only

B1 impide mutación directa del log a los roles de aplicación. No impide:

- una migración ejecutada por owner;
- el borrado transitivo causado por
  `entity_audit_log_tenant_id_fkey ON DELETE CASCADE`;
- inserts directos legacy de `service_role` mientras se migran callers.

La FK queda deliberadamente sin cambio. Diseñar el ciclo de vida de
tenant/fixtures continúa siendo obligatorio antes del cierre global de
SDD-0166 y no se resuelve mediante una función de purga improvisada.

## 6. Compatibilidad y deuda explícita

Se conservaron:

- las siete funciones SQL que escriben dentro de sus transacciones;
- los ocho writers TypeScript directos;
- `SELECT authenticated` para el viewer actual;
- la publicación Realtime.

Estas excepciones son compatibilidad transitoria, no conformidad final con
AUD-01/AUD-02. Corte C gobierna consulta/RBAC y Corte D gobierna migración de
writers y atomicidad por dominio.

## 7. Forward-fix

Una falla posterior se corrige hacia adelante:

- las columnas aditivas permanecen;
- un CHECK defectuoso se reemplaza con historia intacta;
- un defecto del writer se corrige sin habilitar ejecución pública;
- no se reabren `UPDATE`, `DELETE` o `TRUNCATE`;
- no se altera la FK de tenant sin un diseño de lifecycle aprobado.

## 8. Gate siguiente

REV-AUD-008 cierra la revisión técnica local de B1. Una aplicación futura
requiere autorización explícita que nombre únicamente
`0267_audit_contract_append_only`, preflight metadata-only fresco, runbook,
aplicación individual, postcondiciones, prueba transaccional y advisors.

Hasta entonces:

- B1 permanece solo en Git;
- Cloud conserva el estado B0;
- Corte B no se declara aplicado;
- SDD-0166 continúa `in-progress`;
- Cortes C–E permanecen cerrados.
