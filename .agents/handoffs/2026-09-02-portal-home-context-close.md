# Handoff · SDD-0347 · Contexto privado del home acotado

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal` ya no importa ni construye `service_role`.
- `getPortalHomePrivateContext()` resuelve cliente y activación mediante sesión;
  una cuenta pendiente no carga el dashboard ni construye admin.
- En una cuenta activa, dashboard, envíos, perfil, actividad, visibilidad y
  asesor se obtienen mediante sesión/RLS.
- Un único admin recibe exclusivamente client id, Shipping Mark y shipment id
  recién derivados para facturas pendientes, snapshot naviero y próximo zarpe.
- Si falla la elevación, el dashboard conserva todo el contexto de sesión y
  vacía sólo facturas pendientes, naviera y zarpe.
- El baseline RSC baja de 2 rutas / 4 construcciones a 1 / 1.

## Evidencia

- Focales: 2 archivos / 6 pruebas verdes.
- Suite completa: 522 archivos / 5.936 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.

## Gates alojados

Este slice no crea migración ni modifica datos. No se hizo push, deploy, Cloud
o Producción.
