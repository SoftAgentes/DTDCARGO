# Documentos de Tesorería · SDD-0404 / 0436 · evidencia local

Fecha: 2026-09-04

Alcance: helper documental, PostgreSQL desechable e inventario estático

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

La primera etapa 0435 cerraba exclusivamente `invoice`. El contrato RED
demostró que el mismo principal `commercial` todavía recibía `true` para
`supplier_bill` y `supplier_payment`, aunque ambos tipos apuntan a Tesorería,
módulo exclusivo de Contabilidad/Admin.

No se encontraron consumidores dedicados de esos tipos fuera del Hub genérico.
Las superficies efectivas son las ya conectadas al helper por 0435: filas,
bucket privado, reservas, restauraciones y guards de RPC privilegiadas.

## Correctivo preparado

0436 sustituye únicamente el cuerpo del helper para incluir CxP y órdenes de
pago en el conjunto financiero. No recrea policies, triggers ni grants de
tabla; por eso la misma decisión se propaga sin multiplicar puntos de drift.

El preflight exige el contrato exacto de SDD-0403 y sus grants antes de ampliar
el helper. `PUBLIC` y `anon` siguen sin EXECUTE; `authenticated` y
`service_role` conservan el grant necesario para las policies, mientras los
guards sólo lo hacen vinculante cuando el JWT original es `authenticated`.

## Evidencia ejecutada

- RED causal: `commercial` conserva `supplier_bill` y `supplier_payment` tras
  el estado exacto de 0435.
- GREEN focal: Comercial pierde los tres tipos financieros ya cubiertos;
  `accounting`/`admin` los conservan; usuario desactivado no los obtiene y
  `shipment` no cambia.
- SQL completo: 178/178 contratos con rollback total.
- Rebuild: 433 migraciones inventariadas, 415 aplicadas desde cero, 18
  sólo-ledger y aislamiento sobre 219 tablas y dos tenants.

## Estado y límites

- Local: **CORRECTO** para `supplier_bill` y `supplier_payment`.
- Producción: **NO VERIFICABLE**; 0436 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %); autorización documental sigue abierta.
- Migraciones locales preparadas: 36 (0401–0436), tomando 0400 como último
  ledger alojado verificado.
