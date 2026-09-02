# Handoff · SDD-0344 · Contexto privado de Soporte acotado

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal/soporte` ya no importa ni construye `service_role`.
- `getPortalSupportPrivateContext()` no recibe ids: deriva cliente, reclamos y
  envíos desde la sesión antes de consultar evidencia y conversación internas.
- Evidencia usa únicamente ids de reclamos RLS-visibles; hilo, id realtime y
  resúmenes usan únicamente el client id recién resuelto.
- Si la elevación falla, conserva reclamos/envíos/asesor de sesión y devuelve
  evidencia, hilo y resúmenes vacíos.
- El baseline RSC baja de 5 rutas / 10 construcciones a 4 / 9.

## Evidencia

- Focales: 2 archivos / 6 pruebas verdes.
- Suite completa: 519 archivos / 5.924 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.

## Gates alojados

Este slice no crea migración ni requiere escrituras alojadas. No se hizo push,
deploy, Cloud o Producción.
