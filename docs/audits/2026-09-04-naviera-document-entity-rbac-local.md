# Documentos de Naviera · SDD-0410 / 0442 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

Después de 0441, `consolidation` y `booking` no figuraban en el contrato
entidad/módulo y caían en la compatibilidad abierta. Un usuario Comercial activo
del tenant recibía `true` para vista y edición aunque la matriz sólo concede el
módulo Naviera a Operaciones y Contabilidad.

## Correctivo preparado

0442 añade ambas entidades al módulo `naviera`, con `operations` y `accounting`
como defaults de vista/edición y Administrador con acceso total. Los overrides
tenant-aware pueden abrir o cerrar otros roles; Soporte nunca edita.

El cambio amplía únicamente `document_entity_module_contract(text)`. Policies,
bucket, reservas, restauraciones, guards y el autorizador público permanecen en
una sola cadena de decisión; el mapa interno continúa sin `EXECUTE` para roles
de API.

## Evidencia ejecutada

- RED causal: Comercial conserva `consolidation` y `booking` tras 0441.
- GREEN focal: defaults de Operaciones/Contabilidad, Administrador, usuario
  desactivado, overrides positivos/negativos y Soporte sólo lectura.
- Regresión: Proveedores, Envíos, tipos financieros, tenant inyectado y acción
  desconocida.
- SQL completo: 184/184 contratos con rollback total.
- Rebuild: 439 migraciones inventariadas, 421 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- Numeración revalidada contra 15 refs: spec 0410 y migración 0442 libres.

## Estado y límites

- Local: **CORRECTO** para documentos de Naviera.
- Producción: **NO VERIFICABLE**; 0442 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente documental sigue abierto.
- Migraciones locales preparadas: 42 (0401–0442), tomando 0400 como último
  ledger alojado verificado previamente.
