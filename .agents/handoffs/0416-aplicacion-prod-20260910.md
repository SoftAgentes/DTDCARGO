# 0416 aplicada a producción — 2026-09-10

Tarea: aplicar `0416_portal_shipments_tenant_boundary` (SDD-0359). Autorización nominal de Sam
(«aplica la 0416 también»), conforme a `docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**APLICADA.** Ledger de prod: 414 → 415, con el basename exacto.
Reemplaza **tres** policies de lectura Portal: `shipments`, `shipment_documents` y
`shipment_events`. No toca equipo, ACL, datos ni Storage.

## El mismo agujero que la 0428, en tres tablas más

Las tres expresiones anteriores coincidían **solo por markbox, sin comprobar tenant**:

```sql
-- shipments y shipment_documents (idénticas)
(deleted_at IS NULL) AND (client_markbox IS NOT NULL)
AND (client_markbox = get_portal_client_markbox())

-- shipment_events (a través del envío)
(deleted_at IS NULL) AND EXISTS (
  SELECT 1 FROM shipments s
  WHERE s.id = shipment_events.shipment_id
    AND s.client_markbox IS NOT NULL
    AND s.client_markbox = get_portal_client_markbox())
```

**Ese bloque es la vuelta atrás**: la migración hace `drop policy` + `create policy`, así que
la expresión previa no existía en ningún archivo del repo. Se capturó antes de escribir.

Las nuevas exigen un `client_users` activo cuyo cliente comparta markbox **y tenant**, y para
documentos y eventos además atan la fila a su envío por `tenant_id` y `client_markbox`.

## Medición previa: cero regresión de acceso

| tabla | regla vieja | regla nueva |
|---|---|---|
| `shipments` | 12 | **12** |
| `shipment_documents` | 0 | **0** |
| `shipment_events` | 8 | **8** |

19 envíos vivos, **un solo tenant con envíos**. Ningún usuario pierde acceso; la fuga se
cierra antes de que la multi-tenencia la vuelva real.

## Verificación posterior, contra el OBJETO

| comprobación | resultado |
|---|---|
| policies Portal endurecidas | **3 de 3** — contienen `client_users`, `auth.uid()` y `tenant_id`, y ya **no** `get_portal_client_markbox` |
| forma | `SELECT / PERMISSIVE / {authenticated}` — conservada en las tres |
| policies `… by tenant` | **3 de 3 intactas** |
| policies totales en las tres tablas | 6, sin cambio |
| ledger | 414 → **415**, basename exacto |
| datos | 19 envíos · 23 eventos — sin cambio |

La migración trae **preflight y postflight propios**: el primero exige el inventario exacto de
dos policies por tabla y aborta ante deriva; el segundo comprueba que la policy final contenga
el principal y el tenant y ya no el helper de markbox. Ambos corrieron dentro de la misma
transacción.

## Efecto sobre el bloque D

`0439_shipment_document_entity_rbac` espera exactamente esta policy endurecida —fue el
bloqueo que descubrió el Worker del bloque D y el motivo de extraer 0416 en su propia PR—.
Con 0416 aplicada, **el prerrequisito queda satisfecho también en producción**, no solo en el
repositorio.

## Este cambio

Saca `0416_portal_shipments_tenant_boundary` de `pendingBelowCutoff`. Pendientes declarados:
**12 → 11**. **El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.
