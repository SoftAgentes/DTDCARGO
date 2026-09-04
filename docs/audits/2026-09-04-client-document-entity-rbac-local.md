# Documentos de clientes · SDD-0408 / 0440 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

Después de 0439, `client` no figuraba en el contrato entidad/módulo y caía en la
compatibilidad abierta. Un usuario Marketing activo del tenant recibía `true`
para vista y edición aunque la matriz no le concede el módulo Clientes.

## Correctivo preparado

0440 añade `client → clients` con el default exacto de la aplicación:
`commercial`, `operations`, `accounting` y `support` para vista; edición para los
tres primeros, nunca para `support`. Almacén y Marketing quedan fuera por default,
pero un override válido puede abrirlos; un override negativo puede cerrar un rol
incluido por default.

Las policies de metadatos, bucket, reservas y restauraciones y los guards de RPC
ya consumen `document_entity_authorized`, por lo que no se duplican ni recrean.

## Evidencia ejecutada

- RED causal: Marketing conserva `client` en el estado posterior a 0439.
- GREEN focal: defaults de siete roles, admin, usuario desactivado, tres overrides,
  `support` read-only, tenant inyectado y acción desconocida.
- Regresión: `expense`, `shipment`, cuatro tipos financieros y compatibilidad de
  entidad aún no clasificada permanecen iguales.
- SQL completo: 182/182 contratos con rollback total.
- Rebuild: 437 migraciones inventariadas, 419 aplicadas desde cero, 18
  sólo-ledger, 219 tablas y dos tenants del arnés.
- Numeración revalidada contra 15 refs: spec 0408 y migración 0440 libres.

## Estado y límites

- Local: **CORRECTO** para documentos de clientes.
- Producción: **NO VERIFICABLE**; 0440 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); el frente documental sigue abierto.
- Migraciones locales preparadas: 40 (0401–0440), tomando 0400 como último
  ledger alojado verificado previamente.
