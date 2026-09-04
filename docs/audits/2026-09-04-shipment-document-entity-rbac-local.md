# Documentos de envíos · SDD-0407 / 0439 · evidencia local

Fecha: 2026-09-04

Alcance: Server Actions de Tracking, Hub documental, tabla legacy y Storage local

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgos reproducidos

- Subir y borrar en `tracking/[id]/document-actions.ts` no ejecutaban el guard de
  edición antes de autenticar y consultar el dominio.
- `shipment` caía en el permiso compatible del helper posterior a 0438; Marketing
  podía leer y mutar el documento genérico si compartía tenant.
- `shipment_documents` y `shipment-docs` permitían CRUD interno por tenant sin
  aplicar la matriz de Tracking.

La policy `shipment_documents portal self read` de 0416 sí estaba ligada a
principal, cliente, envío y tenant. No era un hallazgo y no se reemplazó.

## Correctivo preparado

Las dos Server Actions ahora ejecutan `moduleEditDenial(client, "tracking")`
antes de tocar autenticación de dominio, filas o Storage.

0439 extiende `document_entity_authorized` mediante un contrato módulo/defaults:
conserva `expense`, añade `shipment → tracking` y sigue tratando los cuatro tipos
financieros como bloqueados. La policy interna `ALL` de `shipment_documents` se
divide por operación; el bucket exige `view` para leer y `edit` para insertar o
borrar. La policy Portal permanece aditiva y SELECT-only.

## Evidencia ejecutada

- RED de aplicación: dos fallos causales; las acciones seguían hasta tenant/fila.
- RED SQL: Marketing veía Hub, tabla legacy y bucket y obtenía edición.
- GREEN focal: 63/63 pruebas de Tracking y contrato documental.
- GREEN SQL: defaults, overrides positivos/negativos, `support` read-only,
  usuario desactivado, tenant inyectado, policy Portal y `service_role`.
- SQL completo: 181/181 contratos con rollback total.
- Rebuild: 436 migraciones inventariadas, 418 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- TypeScript y lint: verdes.
- Numeración revalidada contra 15 refs: spec 0407 y migración 0439 libres.

## Estado y límites

- Local: **CORRECTO** para las dos familias de documentos de envío.
- Producción: **NO VERIFICABLE**; 0439 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente documental permanece abierto
  para clientes, proveedores, Naviera, Bitácora y documentos sin transacción.
- Migraciones locales preparadas: 39 (0401–0439), tomando 0400 como último
  ledger alojado verificado previamente.
