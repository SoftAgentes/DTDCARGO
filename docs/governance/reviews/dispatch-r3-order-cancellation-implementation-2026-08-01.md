# REV-SGE-045 · Cancelación R3 gobernada de orden de despacho

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Spec | SDD-0234 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0324_dispatch_order_cancellation_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La cancelación directa desde el drawer fue reemplazada por una decisión
canonical. El RPC resuelve membresía activa, rol y tenant, bloquea la OD,
valida el estado observado y cambia estado, motivo, actor, fecha y AUD-01 en una
sola transacción. Cero filas afectadas, carreras y replay ya no se presentan
como éxito nuevo.

Un trigger bloquea la cancelación directa y sella el hito terminal. La UI exige
motivo y presión sostenida, conserva la request ref, expone pending/error y
declara que los paquetes vuelven a la cola elegible sin borrar su relación.

## Evidencia local

- 9/9 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- UI check liviano: consecuencia visible, motivo obligatorio, presión
  sostenida, alternativa accesible, foco seguro y tokens existentes.
- 59/59 contratos SQL en PostgreSQL 17 efímero, incluido 0324.
- El contrato 0324 demuestra anti-bypass, roles, membresía, tenant, estado,
  replay, liberación por estado y rollback total ante falla de AUD-01.
- Reconstrucción verde: 320 archivos evaluados, 303 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, cuatro componentes y plugin read-only quedan sujetos al
  cierre del slice antes del commit.
- El registry distribuido se regenera con el sincronizador oficial; la caché
  instalada no recibe edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificaron creación, asignación, salida, entrega, cierre, paquetes,
  rutas, camiones o aplicación móvil.
- No se eliminó el `DELETE` interno usado por el rollback de creación; retirarlo
  requiere rediseñar esa compensación en otro slice.
- No se aplicó 0324 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316–0323 permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida una decisión R3 representativa de Despacho. No promueve el
módulo completo a `VA`: las demás mutaciones conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0324_dispatch_order_cancellation_governance`. Esa autorización no se infiere
de la autorización general de commits ni de los gates 0316–0323.
