---
sdd: "0514"
title: "Portal: aviso de seguimiento en construcción"
status: in-progress
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0042", "0132", "0170", "0307", "0505"]
confidencialidad: interno
---

# SDD-0514 — Portal: aviso de seguimiento en construcción

> Mientras el almacén de China registre la mercancía en Excel, el Portal le dice
> al cliente que el seguimiento está en construcción y que pronto estará
> disponible. El aviso se apaga con una sola constante.

## Contexto

Los clientes cargan sus pre-alertas en el Portal, pero la bodega de China todavía
recibe la mercancía en Excel y no en el sistema. Lo que sigue a la pre-alerta
(recepción en bodega, envío, tracking) sale vacío y los clientes creen que el
Portal «no funciona».

Pedido de Sam (2026-10-14): «quiero que en el portal del cliente diga que esto
está en construcción y que pronto lo tendremos disponible … Los usuarios están
haciendo sus prealertas y no ven la información que sigue ni el tracking … Hay que
ponerles que está en construcción y que pronto estará disponible, para que en el
portal del cliente se vea que ya estamos por activar esta herramienta.»

## Objetivo

Un aviso informativo («Seguimiento en construcción») en las pantallas donde hoy
falta esa información, que se sume a lo que ya se muestra sin esconder nada, y
que se apague cambiando un solo valor.

## Decisión

- **Dónde va.** Portada (`/portal`, que muestra el próximo arribo y «Tus
  envíos»), Envíos (lista y vista «Seguimiento total»), detalle de un envío
  (arriba del stepper) y detalle de una compra (arriba de «¿llegó todo?»). No va
  en el layout ni en las demás pantallas del Portal.
- **Interruptor.** `TRACKING_EN_CONSTRUCCION` en
  `lib/portal/tracking-en-construccion.ts`, hoy `true`. Sólo lo lee el
  componente. No es variable de entorno: el 2026-10-15 la web se muda de Vercel
  al VPS y una variable nueva quedaría sin configurar en uno de los dos lados.
  Queda declarado en `scripts/feature-constants.json`, como toda constante que
  cambia lo que ve el cliente: al apagarlo, se cambia también ahí en el mismo
  commit. Si se olvida, el paso `feature-constants` de `pnpm verify` sale rojo y
  nombra el archivo. La declaración no cambia el comportamiento.
- **Tono.** Información (BRAND.md, estados 2026-09-05): no es riesgo ni error.
  Borde izquierdo e ícono en `--portal-info` (tinta neutra), título en ink,
  texto en grey-700. Mismo armazón que `PortalMaintenanceNotice` y
  `ProfilePendingBanner`. `role="status"`.
- **Copy.** Título «Seguimiento en construcción». Texto: «Estamos activando el
  registro de tu mercancía en nuestra bodega de China. Muy pronto vas a ver aquí
  cada paso de tu carga. Tus pre-alertas quedan guardadas y nuestro equipo las
  recibe.» Enlace «¿Dudas? Escríbenos en Soporte» a `/portal/soporte` (Mensajes
  redirige ahí desde SDD-0147). Sin fecha prometida y sin CTA de venta.
  Ajustes sobre el copy de partida: «bodega» en vez de «almacén» (así lo dice el
  resto del Portal), «carga» en vez de «envío» (también aplica a una compra que
  todavía no viaja) y «nuestro equipo las recibe» en vez de «las estamos
  recibiendo», que podía leerse como «estamos recibiendo tu mercancía».

**Datos personales:** no aplica. El aviso es texto fijo: no captura, no mueve ni
borra datos personales, y no agrega consultas.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `lib/portal/tracking-en-construccion.ts` | Nuevo. La constante `TRACKING_EN_CONSTRUCCION`. |
| `scripts/feature-constants.json` | Declaración de la bandera nueva (valor `true` y qué significa para el cliente). |
| `app/portal/_components/PortalTrackingEnConstruccion.tsx` | Nuevo. El aviso; devuelve `null` con el interruptor apagado. |
| `app/portal/_components/__tests__/PortalTrackingEnConstruccion.test.tsx` | Nuevo. Componente, portada, Envíos (lista y Seguimiento total) y detalle de envío, prendido y apagado. |
| `app/portal/(app)/compras/[code]/page.test.tsx` | Nuevo. Detalle de compra, prendido, apagado y con una recepción real. |
| `app/portal/(app)/envios/_components/PortalAlertasHub.tsx` | El aviso en la lista y en «Seguimiento total». |
| `app/portal/(app)/envios/[code]/_components/PortalShipmentDetailNorte.tsx` | El aviso arriba del stepper. |
| `app/portal/(app)/compras/[code]/page.tsx` | El aviso arriba del estado de llegada. |
| `app/portal/(app)/_components/PortalDashboardNorte.tsx` | El aviso después del saludo, antes del próximo arribo. |
| `docs/specs/0514-portal-tracking-en-construccion/spec.md` | Esta spec. |
| `docs/specs/0514-portal-tracking-en-construccion/assets/aviso-detalle-envio-claro-movil.png` | Captura con datos ficticios. |
| `docs/specs/0514-portal-tracking-en-construccion/assets/aviso-detalle-envio-oscuro-movil.png` | Captura con datos ficticios. |
| `docs/specs/0514-portal-tracking-en-construccion/assets/aviso-portada-claro-escritorio.png` | Captura con datos ficticios. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0514-portal-tracking-en-construccion.md` | Handoff de la tarea. |

Fuera de alcance: datos, consultas, RLS, migraciones y el copy propio de cada
pantalla. No se tocan `lib/portal/payment-report-queries.ts` ni
`lib/portal/shipment-events-queries.ts` (PR #114).

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, el aviso aparece con `role="status"` en
   la portada, en Envíos (lista y «Seguimiento total»), en el detalle de un envío
   y en el detalle de una compra.
2. Con `TRACKING_EN_CONSTRUCCION = false`, desaparece de esas cinco vistas y cada
   una queda con lo mismo que mostraba antes.
3. El aviso no tapa información real: con hitos con fecha, card de naviera,
   filas, seguimiento por contenedor o recepciones en bodega, todo sigue visible y
   el aviso va antes.
4. El aviso sólo depende de esa constante: ninguna pantalla lo pinta por su
   cuenta (lo prueba el caso apagado de cada pantalla).
5. Texto e íconos pasan AA en claro y oscuro (texto ≥ 4.5:1, ícono y borde ≥ 3:1),
   y el enlace es alcanzable con teclado y tiene foco visible.

## Evidencia

Detalle en el handoff `.agents/handoffs/0514-portal-tracking-en-construccion.md`.

- **Pruebas:** 13 casos nuevos en dos archivos, en verde (criterios 1 a 4).
- **Control rojo:** con las cuatro pantallas de `origin/main` `9a935562` y el
  componente nuevo, fallan los 6 casos «prendido» de pantalla, todos por
  `expected null not to be null` (el aviso no está).
- **Declaración:** `feature-constants` en verde con 6 banderas; con la constante
  en `false` y el JSON sin tocar sale rojo y nombra la bandera.
- **Mutantes:** 7 aplicados, 7 muertos, cada uno en el caso que le corresponde,
  con control verde antes y después.
- **Contraste (criterio 5):** medido con los valores de `app/globals.css`. Claro:
  título 16.49:1, texto 12.63:1, hover del enlace 10.58:1. Oscuro: 13.08:1,
  7.33:1 y 6.44:1. Ícono y borde en `--portal-info`, 16.49:1 y 13.08:1.
- **Capturas** (`assets/`): pantallas reales renderizadas a HTML con datos
  ficticios y el CSS de `globals.css` compilado. Las fuentes del Portal no se
  cargan en ese arnés (salen las del sistema). A 360 px el aviso mide 320×222,
  el enlace 209×44 y no hay desborde horizontal.

## Riesgos y límites

Si el almacén empieza a registrar en el sistema y nadie cambia la constante, el
aviso sigue diciendo «en construcción» con datos reales debajo: hay que apagarlo
en el mismo momento en que se active la bodega.
