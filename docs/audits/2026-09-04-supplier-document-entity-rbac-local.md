# Documentos de proveedores · SDD-0409 / 0441 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

Después de 0440, `supplier` no figuraba en el contrato entidad/módulo y caía en
la compatibilidad abierta. Un usuario Contabilidad activo del tenant recibía
`true` para vista y edición aunque la matriz sólo concede Proveedores a
Comercial y Operaciones.

## Correctivo preparado

0441 añade `supplier → suppliers` con los defaults exactos de la aplicación:
`commercial` y `operations` para vista y edición; Administrador conserva acceso
total. Un override válido puede abrir otro rol y uno negativo puede cerrar un rol
incluido por default; Soporte nunca edita.

El mapa entidad/módulo se extrae a
`document_entity_module_contract(text)`, una función interna sin `EXECUTE` para
`anon`, `authenticated` ni `service_role`. Policies, bucket, reservas,
restauraciones y guards continúan usando exclusivamente
`document_entity_authorized`.

## Evidencia ejecutada

- RED causal: Contabilidad conserva `supplier` en el estado posterior a 0440.
- GREEN focal: defaults de Comercial y Operaciones, Administrador, usuario
  desactivado, overrides positivos/negativos y Soporte sólo lectura.
- Regresión: `client`, `expense`, `shipment`, tipos financieros, tenant
  inyectado, acción desconocida y compatibilidad aún no clasificada.
- Grants: el mapa interno no es ejecutable por los tres roles de API.
- SQL completo: 183/183 contratos con rollback total.
- Rebuild: 438 migraciones inventariadas, 420 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- Numeración revalidada contra 15 refs: spec 0409 y migración 0441 libres.

## Estado y límites

- Local: **CORRECTO** para documentos de proveedores.
- Producción: **NO VERIFICABLE**; 0441 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente documental sigue abierto.
- Migraciones locales preparadas: 41 (0401–0441), tomando 0400 como último
  ledger alojado verificado previamente.
