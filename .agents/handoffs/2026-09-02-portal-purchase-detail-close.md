# Handoff · SDD-0343 · Detalle operativo de compra acotado

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal/compras/[code]` ya no importa ni construye `service_role`.
- `getPortalPurchaseOperationalDetail()` acepta sólo el código, resuelve el
  principal, vuelve a leer la compra mediante sesión/RLS y sólo entonces eleva.
- Recepciones, fotos y packing list comparten un único cliente interno acotado al
  id y Shipping Mark recién comprobados.
- Código vacío, principal no Portal, compra ajena o elevación fallida devuelven
  un resumen sin datos.
- El baseline RSC baja de 6 rutas / 12 construcciones a 5 / 10.

## Evidencia

- Focales: 2 archivos / 7 pruebas verdes.
- Suite completa: 518 archivos / 5.920 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.
- El verificador canónico inmediatamente anterior, posterior a SDD-0342, pasó
  14/15 gates; sólo `migrations-applied` quedó no medido por falta deliberada de
  credenciales.

## Gates alojados

Este slice no crea migración ni requiere escrituras alojadas. No se hizo push,
deploy, Cloud o Producción.
