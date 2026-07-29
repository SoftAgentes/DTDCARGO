# Revisión del diseño de ciclo de vida tenant/fixtures

| Control | Valor |
|---|---|
| Revisión | REV-AUD-010 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Ciclo de vida tenant/fixtures v1.0](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-ciclo-vida-tenant-fixtures.md) |
| Fecha | 2026-07-28 |
| Resultado técnico | aprobado |
| Estado | diseño aprobado; implementación no abierta |
| Decisión | Instrucción de Sam (founder) + revisión técnica Codex |

## 1. Veredicto

Se aprueba técnicamente la versión 1.0. El diseño resuelve la contradicción
identificada en B0 sin crear una puerta de purga en Producción:

- tenants de negocio se suspenden o archivan;
- fixtures persistidas solo viven en Supabase efímero;
- el teardown elimina el entorno, no filas individuales;
- la FK audit tiene como objetivo `ON DELETE RESTRICT`;
- `service_role` debe perder `DELETE` sobre `tenants`.

La aprobación es documental. No autoriza código, DDL, Cloud ni C–E.

## 2. Evidencia revisada

| Evidencia | Resultado |
|---|---|
| Ruta de producto para borrar tenant | no encontrada |
| Caller local de DELETE tenant | solo `scripts/cleanup-e2e.ts` |
| DELETE audit heredado | presente en `scripts/seed-e2e.ts`; incompatible con ACL B1 |
| Escape hatch de Producción | presente; debe retirarse |
| FK directas a tenants en Cloud | 192/192 con CASCADE |
| DELETE `service_role` sobre tenants | permitido |
| Policies/funciones de DELETE tenant | 0/0 |
| Residuo fixture SDD-0168 | 0 tenant, memberships, eventos y objetos Storage |

El inventario fue metadata-only y usó contadores del fixture sintético
conocido. No leyó payload, PII ni filas de negocio.

## 3. Razones de aprobación

1. no usa una bandera mutable `is_fixture` como autorización destructiva;
2. elimina el escape hatch que hoy permite seed en Producción;
3. cubre Postgres, Auth y Storage mediante un solo lifecycle de entorno;
4. preserva fixtures SQL transaccionales con `ROLLBACK`;
5. separa decommission de negocio y teardown de pruebas;
6. mantiene purga, retención y hold fuera de este gate;
7. exige SDD, migración y prueba propios antes de cambiar la FK;
8. no confunde append-only directo con supervivencia al borrado del tenant.

## 4. Riesgos residuales

- hasta implementar el diseño, `service_role` todavía puede borrar tenants;
- las 192 FK directas conservan `CASCADE`;
- `scripts/cleanup-e2e.ts` conserva el camino destructivo;
- `scripts/seed-e2e.ts` conserva el escape hatch de Producción y un DELETE
  directo que ya no tiene privilegio;
- la destrucción de proyectos efímeros depende de evidencia terminal del
  proveedor;
- retención de backups y borrado extraordinario requieren Corte E o SDD propio.

Estos riesgos están delimitados; no justifican abrir C–E ni aplicar un parche
sin diseño de implementación.

## 5. Condiciones del futuro SDD

El siguiente SDD debe:

- iniciar con inventario read-only fresco de repo, CI, Preview y Cloud;
- probar primero el camino efímero;
- retirar DML destructivo de seed/cleanup;
- asignar el basename solo después de comprobar colisiones;
- probar PostgreSQL 15/17;
- aplicar una sola migración por gate;
- verificar objetos y advisors, no solo ledger;
- mantener C, D y E fuera de alcance.

## 6. Límite

REV-AUD-010 satisface el requisito de **diseñar** el ciclo de vida
tenant/fixtures antes del cierre global, pero no satisface su implementación.
SDD-0166 permanece `in-progress` y los Cortes C, D y E permanecen pendientes.
