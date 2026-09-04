# Documentos de asientos · SDD-0405 / 0437 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental y PostgreSQL desechable

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

El estado posterior a 0436 negaba factura, CxP y órdenes de pago a Comercial,
pero devolvía `true` para `journal_entry`. Eso mantenía los documentos de
asientos fuera del candado del módulo Contabilidad.

## Correctivo preparado

0437 añade únicamente `journal_entry` al conjunto `accounting`/`admin` del
helper documental. Las policies de filas, bucket, reservas y restauración, así
como los tres guards que cubren RPC privilegiadas, ya dependen de ese único
punto y no se recrean.

El preflight exige el contrato exacto SDD-0404 y los grants esperados; ante
drift aborta antes de reemplazar la función.

## Evidencia ejecutada

- RED causal: `commercial` conserva `journal_entry` tras 0436.
- GREEN focal: Comercial pierde factura, CxP, pago y asiento;
  `accounting`/`admin` conservan los cuatro; usuario desactivado no accede y
  `shipment` permanece compatible.
- SQL completo: 179/179 contratos con rollback total.
- Rebuild: 434 migraciones inventariadas, 416 aplicadas desde cero, 18
  sólo-ledger y aislamiento sobre 219 tablas y dos tenants.

## Estado y límites

- Local: **CORRECTO** para `journal_entry` y los cuatro tipos financieros.
- Producción: **NO VERIFICABLE**; 0437 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); la autorización documental sigue
  abierta para entidades con matrices distintas.
- Migraciones locales preparadas: 37 (0401–0437), tomando 0400 como último
  ledger alojado verificado.
