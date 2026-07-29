# Revisión del diseño correctivo del Corte B

| Control | Valor |
|---|---|
| Revisión | REV-AUD-007 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Inventario | [Corte B · B0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-b-2026-07-28.md) |
| Diseño | [Contrato aditivo y append-only v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-b.md) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado |
| Estado | diseño aprobado; B1 abierto posteriormente y revisado en REV-AUD-008 |
| Decisión | Instrucción explícita de Sam (founder) + revisión técnica Codex |

## 1. Veredicto

Se aprueba la versión 1.0 del diseño B0 para preparar un futuro Gate B1 local.
La aprobación cubre contrato de columnas, validación, writer común, índice y
matriz ACL. No aprueba una migración porque `0267` todavía no existe.

La aprobación incorpora una corrección obligatoria respecto de la propuesta
0.1: B1 no cambia la FK de tenant ni modifica `scripts/cleanup-e2e.ts`.
`ON DELETE CASCADE` permanece como excepción transitoria documentada y evita
introducir una función destructiva de purga sin SDD propio.

## 2. Defecto bloqueante encontrado y resuelto

La versión 0.1 proponía:

1. cambiar la FK de tenant a `ON DELETE RESTRICT`;
2. revocar `DELETE` sobre `entity_audit_log` a `service_role`;
3. pedir a `scripts/cleanup-e2e.ts`, que usa `service_role`, borrar primero los
   eventos fixture.

Los pasos 2 y 3 son incompatibles. El cleanup no podría borrar los eventos y
el tenant tampoco podría eliminarse. Resolverlo mediante una función
`SECURITY DEFINER` de purga agregaría a producción un camino destructivo fuera
del contrato de Corte B.

La versión 1.0 elimina esa contradicción:

- B1 garantiza inmutabilidad directa sobre la tabla;
- conserva la FK sin drift;
- registra el cascade como brecha explícita;
- delega ciclo de vida de tenant/fixtures a diseño separado antes del cierre
  global de SDD-0166.

## 3. Contraste normativo

| Fuente | Resultado |
|---|---|
| AUD-01 | conserva historia, añade contrato mínimo y no presenta best-effort como atomicidad |
| AUD-02 | reduce privilegios, mantiene RLS y separa writer/lector |
| SDD-0166 §5.1 | cubre las ocho columnas con defaults legacy honestos |
| SDD-0166 §6.3 | writer `SECURITY DEFINER`, `search_path=''`, sin ejecución pública |
| SDD-0166 §7.1 | writer común limitado a bajo riesgo o transacción ya gobernada |
| SDD-0166 §8 Corte B | revoca mutación directa y conserva `INSERT service_role` temporal |
| SDD-0166 §15 | forward-fix; no reabre permisos como rollback |

No se atribuye al Corte B:

- atomicidad de los ocho writers TypeScript;
- consulta admin-only/redacted;
- retiro de `SELECT authenticated`;
- exportación, hold, retención o purga;
- cierre absoluto de la brecha de ciclo de vida del tenant.

## 4. Seguridad PostgreSQL

El diseño aprobado aplica:

- mínimo privilegio por tabla y función;
- `REVOKE ALL` antes de grants exactos;
- `service_role` reducido temporalmente a `INSERT`;
- `authenticated` reducido temporalmente a `SELECT`;
- `anon` y `PUBLIC` sin privilegios;
- retiro de `entity_audit_log_service_role_all`;
- conservación de RLS como segunda capa;
- constraints estables e idempotencia comprobable por `pg_constraint`;
- transacción corta con `lock_timeout` y `statement_timeout`;
- cero SQL dinámico;
- ejecución del writer solo por `service_role` y owner.

La matriz final de B es coherente con el diseño aprobado de Corte A y con el
hecho de que `service_role` omite RLS.

## 5. Contrato y compatibilidad

La aprobación exige:

- defaults `legacy_unknown` solo para callers directos heredados;
- writer nuevo sin `legacy_unknown`;
- `correlation_id` limitado por regex exacta;
- JSON objeto o `NULL`;
- claves prohibidas verificadas recursivamente sin distinguir mayúsculas;
- motivo obligatorio mediante predicado explícito;
- actor extendido a `agent` e `integration`, sin falsificar `system`;
- `entity_type` activo para el writer;
- conservación de las siete funciones SQL actuales;
- conservación temporal de los ocho writers TypeScript;
- Realtime y viewer sin cambios.

## 6. Índice

Se aprueba únicamente:

```text
entity_audit_log_tenant_correlation_idx
(tenant_id, correlation_id, occurred_at DESC, id DESC)
WHERE correlation_id IS NOT NULL
```

El orden respeta igualdad antes de rango/cursor y la condición parcial excluye
historia legacy sin correlación. Los índices actuales por entidad y
tenant/fecha ya muestran uso. `source`, `result` y `sensitivity` no reciben
índices especulativos antes del contrato de consulta del Corte C.

## 7. Condiciones de la aprobación

Antes de crear B1:

1. repetir `fetch`, estado de worktrees y búsqueda de `0267`;
2. mantener el basename solo si continúa libre;
3. no añadir `scripts/cleanup-e2e.ts` ni cambios de FK a la allowlist;
4. redactar migración y prueba como archivos separados;
5. probar PostgreSQL 15 y 17;
6. demostrar ACL, writer, constraints, siete funciones SQL y rollback;
7. no consultar ni imprimir payload/PII;
8. someter la migración a otra revisión técnica
   (`REV-AUD-008`/`aud-corte-b1.md`);
9. conservar commit, integración y Cloud como gates separados.

## 8. Límite de autorización

REV-AUD-007 aprueba únicamente el diseño B0.

Esta revisión por sí sola no:

- crea ni reserva `0267`;
- autoriza implementar B1;
- autoriza commit, push o integración;
- aplica cambios Cloud;
- abre Cortes C–E;
- aprueba una función de purga;
- marca Corte B o SDD-0166 como completados.

Una autorización posterior abrió B1 local. Su implementación y revisión
técnica están registradas en [REV-AUD-008](aud-corte-b1.md), sin cambiar el
alcance histórico de esta aprobación B0.
