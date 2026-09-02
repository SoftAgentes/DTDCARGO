# Handoff · SDD-0346 · Listado privado de envíos acotado

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal/envios` ya no importa ni construye `service_role`.
- `getPortalShipmentsHubPrivateContext()` no recibe ids ni tenant del caller:
  resuelve cliente, envíos, prealertas, proveedores, visibilidad y documentos
  mediante sesión/RLS.
- Un único admin recibe sólo ids recién derivados para packing online y
  consolidaciones, y obtiene el próximo zarpe con el tenant del cliente propio.
- Si falla la elevación, el hub conserva los datos RLS y vacía exclusivamente
  packing online, consolidaciones y zarpe.
- El baseline RSC baja de 3 rutas / 7 construcciones a 2 / 4.

## Evidencia

- Focales: 3 archivos / 10 pruebas verdes.
- Suite completa: 521 archivos / 5.932 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.

## Gates alojados

Este slice no crea migración ni modifica datos. No se hizo push, deploy, Cloud
o Producción.
