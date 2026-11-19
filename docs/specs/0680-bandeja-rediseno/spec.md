---
sdd: "0680"
title: "Bandeja: abre sola al entrar y rediseño de la pantalla"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0585", "0655", "0677", "0679"]
confidencialidad: interno
---

# SDD-0680 — Bandeja: abre sola al entrar y rediseño de la pantalla

## Pedido

Sam (2026-11-19, por el DG): que la Bandeja abra Chatwoot sola apenas entras, sin error y sin depender del botón «Abrir de nuevo», que hoy no funciona. Y un rediseño completo de esa pantalla, porque no le gusta.

Dos PR, en este orden:

- **PR 1 (esta parte de la spec): el bug.** Causa raíz, prueba que lo reproduce y arreglo.
- **PR 2: el rediseño.** Primero una propuesta visual con 2 o 3 variantes; Sam elige; después se implementa la elegida. Lo de adentro del iframe es Chatwoot y no se rediseña. La Ficha DTD (la app de panel dentro de Chatwoot), si cambia, va en otra SDD.

## Etiquetas de evidencia

- **C**: leído en el código de este repo, en `main` a `f9ae0b678`, o en `next@16.4.6` instalado. Se cita por archivo y símbolo.
- **O**: observado por el DG en producción el 2026-11-19 (03:3xZ).
- **I**: inferencia. No se probó.
- **NV**: no verificado.

## Parte 1 · por qué no abre sola

### Lo observado

- **O**: la primera carga de `/studio/bandeja` quedó en «Abriendo la bandeja…». El POST a `/studio/bandeja` (la server action `pedirEnlaceSso`) salió `net::ERR_ABORTED`. Al pulsar «Abrir de nuevo» cargó una vez.
- Sam: «Abrir de nuevo» tampoco la abre y sigue saliendo el aviso de error.

### Causa raíz

1. **El rechazo de la action no tenía salida.** (C: `BandejaClient.tsx` › `pedirConReintentos`, antes de 0680.) La llamada `await pedirEnlaceSso(...)` no estaba en `try`. La llamada a una server action es un `fetch` POST (C: `next/dist/client/components/router-reducer/reducers/server-action-reducer.js` › `fetchServerAction`): si el POST se aborta, si la red falla o si el servidor no reconoce la action tras un despliegue, la promesa **rechaza**. El rechazo escapaba del `void pedirConReintentos()` y la fase quedaba en `pidiendo` para siempre:
   - el texto es «Abriendo la bandeja…» (`bandeja.state.loading`), justo lo que vio el DG;
   - el vigilante de 20 s solo mira la fase `abriendo`, no `pidiendo`;
   - el «Abrir de nuevo» de la franja está `disabled` mientras la fase es `pidiendo`. No había forma de salir sin recargar.

   Una promesa que no vuelve nunca da el mismo cuadro: no había plazo para el pedido.
2. **El freno gastaba cupo con intentos que no abrieron nada.** (C: `BandejaClient.tsx` › `pedirConReintentos` y `reservarAperturaExclusiva`, antes de 0680; SDD-0677 §6.) La marca del freno (3 aperturas cada 5 min) se ponía **antes** de pedir el enlace. Un pedido que terminó en `service`, que rechazó o que se colgó contaba igual. Con la carga colgada y dos recargas, el cupo se acababa; desde ahí «Abrir de nuevo» solo mostraba «Chatwoot frena los ingresos repetidos» durante 5 minutos. Es lo que Sam describe: el botón no abre y el aviso sigue. La propia SDD-0677 §1 dice que pedir el enlace no gasta un login (el login lo hace el navegador al cargarlo), así que contar el pedido no protegía nada.
3. **La reconciliación salía antes que el SSO.** (C: `BandejaClient.tsx`, los dos efectos de montaje; `next/dist/client/components/app-router-instance.js` › `dispatchAction`.) Next pone todas las server actions en **una sola cola** y las corre de a una. La reconciliación (`reconciliarBandeja`: token del agente, lista de conversaciones y una RPC por conversación) se despachaba primero y el enlace esperaba detrás de ella, con la pantalla en «Abriendo…». No es la causa del cuelgue, pero alarga la espera de cada carga y la ventana en que el POST puede abortarse.

### Lo que no se pudo confirmar

- **NV**: qué abortó el POST en el navegador del DG. Leído `next@16.4.6`: la llamada a la action no lleva `AbortSignal` (solo el refresco de HMR, que no corre en producción). Quedan como candidatos una recarga o navegación de la pestaña durante el pedido, la red, o una pestaña abierta desde antes de un despliegue (la action deja de existir y Next lanza `UnrecognizedActionError`). El arreglo no depende de cuál fue: cualquier rechazo o cuelgue ahora termina en un reintento o en el aviso con salida.
- `MAX_USER_SESSIONS` (hoy 10, SDD-0677 H1) no explica este cuadro: el 409 de Chatwoot se pinta **dentro** del iframe, con el marco ya cargado, y Studio no queda en «Abriendo…».

### El arreglo (PR 1)

1. **`pedirConPlazo`.** Cada pedido del enlace corre con plazo (`PLAZO_ENLACE_MS = 15 s`; el servidor corta el suyo a 10 s en `platform-api.ts`). Si la llamada rechaza, vuelve algo que no es un resultado o no vuelve a tiempo, el resultado es `service`. Con `service` sigue lo de SDD-0677: dos reintentos (1,5 s y 4 s) y después el aviso «La bandeja no abrió» con «Abrir de nuevo» habilitado.
2. **El freno cuenta el enlace que se carga, no el pedido.** Antes de pedir solo se mira si queda cupo (con el tope lleno no se pide, como antes). La marca se pone cuando el enlace llega y se va a cargar en el marco, bajo el mismo candado entre pestañas. Si en ese momento ya no hay cupo, el enlace no se carga y se muestra el freno. Enmienda SDD-0677 §6 en una sola cosa: «una apertura que termina en `service` cuenta una vez» pasa a «no cuenta». El tope (3 cada 5 min), las marcas futuras, el respaldo en memoria y el candado no cambian.
3. **El SSO va primero.** La reconciliación espera a que la fase deje de ser `pidiendo`. Con la marca `dtd_cw_sso` (el marco abre directo) reconcilia al montar, como antes.

### Aceptación de la PR 1

1. Prueba que falla antes del arreglo y pasa después: si la action rechaza (`TypeError: Failed to fetch`), la Bandeja reintenta y abre; no queda en «Abriendo la bandeja…».
2. Con tres rechazos, el aviso aparece y «Abrir de nuevo» está habilitado y abre.
3. Con un pedido que no vuelve, al vencer el plazo se reintenta.
4. Tres cargas fallidas seguidas no dejan marcas en el freno; la cuarta abre. El enlace que sí se carga deja una marca.
5. Sin marca de SSO, la reconciliación no sale hasta que termina el pedido del enlace.
6. Las pruebas de SDD-0585, 0655 y 0677 de `BandejaClient.test.tsx` siguen en verde sin tocarlas.

## Parte 2 · rediseño (PR 2)

Pendiente de la elección de Sam entre las variantes de la propuesta visual. Se completa en la PR 2 con la variante elegida, la revisión `/ui-check` y la regla BTN-01 (los botones no cambian de ancho).

## Fuera de alcance

- Lo de adentro del iframe (Chatwoot).
- La Ficha DTD: si Sam quiere cambiarla, otra SDD.
- `MAX_USER_SESSIONS`, rack-attack y el aviso `dtd:sin-sesion` del panel (SDD-0677, opciones a y c): config del VPS.
