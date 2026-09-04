# Documentos de factura · SDD-0403 / 0435 · evidencia local

Fecha: 2026-09-04

Alcance: código y PostgreSQL desechable con datos exclusivamente sintéticos

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

Facturación está bloqueada a Contabilidad/Admin, pero el Hub DMS autorizaba
filas y objetos sólo por tenant. Un usuario Comercial del mismo tenant pudo ver
el metadato de una factura, enumerar su objeto privado y leer tanto su reserva
de subida como su solicitud de restauración.

La inspección de consumidores encontró un segundo borde: cinco operaciones
autenticadas sobre documentos corren mediante RPC `SECURITY DEFINER`. Por eso
una corrección limitada a `documents` RLS habría sido incompleta.

## Correctivo preparado

- Helper booleano `document_entity_allowed_for_current_role(text)`: sólo
  `invoice` se restringe a `accounting`/`admin`; el resto permanece igual.
- RLS de `documents`, `document_upload_intents` y
  `document_restore_outbox` ligada a ese helper.
- Policies INSERT/SELECT/DELETE del bucket `documents` ligadas al segundo
  segmento del path canónico `{tenant}/{entity}/...`.
- Tres guards de trigger cubren mutaciones de filas, reservas y restauraciones
  hechas desde RPC privilegiadas sin retirar sus caminos legítimos.
- `service_role`, workers, policies de servicio, ACL de borrado lógico,
  versionado, retención y tipos distintos de factura no cambian.

## Evidencia ejecutada

- RED causal: `commercial` vio metadato, binario y ambas colas de factura.
- GREEN focal: Comercial obtiene cero en las cuatro superficies y no puede
  subir ni mutar factura, tampoco mediante dobles `SECURITY DEFINER`.
- GREEN legítimo: Contabilidad conserva lectura y mutación; otro tenant no
  cruza; usuario desactivado ve cero; `shipment` conserva acceso; servicio ve
  las tres filas y los tres objetos.
- SQL completo: 177/177 contratos con rollback total.
- Rebuild: 432 migraciones inventariadas, 414 aplicadas desde cero, 18
  sólo-ledger y aislamiento verificado sobre 219 tablas y dos tenants.
- El primer rebuild rechazó únicamente una precondición incorrecta del fixture
  local de Storage. Se corrigió el preflight para no administrar la bandera RLS
  de una tabla del proveedor y mantener el control por inventario de policies.

## Estado y límites

- Local: **CORRECTO** para el tipo documental `invoice`.
- Producción: **NO VERIFICABLE**; 0435 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %). La casilla RBAC sigue abierta porque
  faltan los demás tipos documentales; este slice no crea una casilla nueva.
- Migraciones locales preparadas: 35 (0401–0435), tomando como último ledger
  verificado el 0400.
