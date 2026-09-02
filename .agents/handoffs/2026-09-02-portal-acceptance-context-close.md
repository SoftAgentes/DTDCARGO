# Handoff · SDD-0348 · Lectura legal de aceptación acotada

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal/facturas/[code]/aceptar` ya no importa ni construye `service_role`.
- `getPortalAcceptancePrivateContext()` acepta sólo el cliente de sesión y el
  código de factura; tenant, client id y Shipping Mark se resuelven adentro.
- La orden pendiente se valida por tenant + Shipping Mark + código antes de leer
  documentos vigentes o evidencia previa de esa misma orden.
- Sin sesión se conserva el redirect a `/entrar`; orden no disponible, ajena,
  aceptada o fallo privado vuelve a `/portal/facturas` sin entregar datos.
- La Server Action, los dos checkboxes, el hash, el sello, la evidencia, la
  granularidad por orden y la idempotencia no cambiaron.
- El baseline RSC baja de 1 ruta / 1 construcción a 0 / 0.

## Evidencia

- Facade + frontera: 2 archivos / 8 pruebas verdes.
- Acción, queries y round-trip legal: 3 archivos / 30 pruebas verdes.
- Suite completa: 523 archivos / 5.942 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.
- Gate canónico final: 14/15 pasos medidos sin fallos; sólo Cloud quedó `SKIP`.

## Gates alojados

Este slice no crea migración, no cambia `LEGAL_GATE_HARD_BLOCK` y no escribe
aceptaciones. No se hizo push, deploy, Cloud o Producción.
