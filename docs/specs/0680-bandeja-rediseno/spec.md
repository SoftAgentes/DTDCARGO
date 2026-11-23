---
sdd: "0680"
title: "Bandeja: abre sola al entrar y rediseño de la pantalla"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-19
updated: 2026-11-23
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

### Segundo bug · la Ficha DTD sale en blanco dentro de la Bandeja

- **O** (DG, 2026-11-19): con el OK de Sam, el DG registró la Dashboard App «Ficha DTD» en el Chatwoot de producción (cuenta 1, id 1, URL `https://dtdcargo.com/studio/ficha-chat`). La pestaña aparece, pero dentro de `/studio/bandeja` sale en blanco. La consola: «Framing 'https://dtdcargo.com/' violates the following Content Security Policy directive: "frame-ancestors https://chat.dtdcargo.com"».
- **Causa** (C: `next.config.ts` › `fichaChatHeaders`): la ficha queda enmarcada dos veces, `dtdcargo.com` › `chat.dtdcargo.com` › `dtdcargo.com/studio/ficha-chat`. `frame-ancestors` revisa todos los ancestros, y el de arriba, Studio, no estaba en la lista.
- **Arreglo:** la CSP de `/studio/ficha-chat`, y solo esa ruta, pasa a `frame-ancestors 'self' https://chat.dtdcargo.com`. Sigue sin `X-Frame-Options`. El resto de Studio queda con `'none'` y `DENY`.
- **Aceptación:** 7. La prueba de cabecera de `lib/runtime/__tests__/next-config.test.ts` exige `'self'` y el origen del chat en esa ruta; las rutas vecinas (`/studio/ficha-chats`, `/studio/ficha-chat/otra`) siguen sin dejarse enmarcar. El runbook `docs/runbooks/chatwoot-ficha-dtd.md` registra la app como registrada y explica el doble marco.

## Parte 2 · rediseño (PR 2)

### Propuesta y elección

Maqueta con variantes (Artifact privado de Sam, 2026-11-19): para la Bandeja, A (sin barra, todo en la barra de Studio), B (riel lateral de iconos) y C (acciones en la fila del CRM); para Usuarios › Bandeja, que el DG sumó al alcance por pedido de Sam, 1 (tabla y dos tarjetas separadas) y 2 (lista y «Agregar persona» en dos pasos).

**Sam eligió la C y la 1** (2026-11-19, literal: «c y agente a»; la «a» se tomó como la primera del panel, la 1, que era la que tenía seleccionada en la maqueta).

### Bandeja · variante C

1. **Una sola fila** arriba: «CRM» (el único `h1`), las pestañas del CRM, el estado y las acciones. Sin la cabecera grande del CRM («Comercial / CRM. / bajada») y sin el texto de ayuda fijo.
   - Estado: «Abriendo la bandeja…», «Conectando con la bandeja… (intento n de 3)» o «Conectada», con `role="status"`. Con aviso no hay estado: lo dice el aviso.
   - Acciones: «Abrir de nuevo» (icono y texto), abrir en pestaña aparte (solo icono, con `aria-label` y `title`) y, al admin, «Agentes» (icono y texto; el título dice «Agentes vinculados»).
2. **El panel sin marco**, pegado a la fila, de borde a borde del área de contenido (anula el relleno de `.studio-content`) y con todo el ancho (`data-ancho-completo`). El alto llega al borde de abajo de la ventana: se mide en el navegador y se vuelve a medir al cambiar el tamaño o al aparecer un aviso; mínimo 480 px.
3. **Se retira la pantalla completa de SDD-0677** («Reducir», Esc, la capa fija, el `inert` del fondo, el bloqueo del desplazamiento y la preferencia `dtd.bandeja.ampliada`). La variante C deja visible el menú de Studio y le da a Chatwoot todo lo demás. Se retiran también las marcas `data-capa-fondo` del layout.
4. **Los avisos** (error, lento, freno) siguen como en SDD-0677, entre la fila y el panel, con «Abrir de nuevo» como acción principal (salvo en el freno).
5. **BTN-01 §5:** «Abrir de nuevo» y «Abriendo…» van en la misma celda de una rejilla; la que no toca queda con `visibility: hidden`. El botón no cambia de ancho, queda deshabilitado y con `aria-busy` mientras pide.

### Usuarios › Bandeja · variante 1

1. **Tabla de vínculos:** Persona de Studio · (icono «vinculado con») · Agente en Chatwoot (nombre, `#número`, correo) · Rol · Acción. «Desvincular» va en su columna, alineado a la derecha, con el ConfirmDialog de siempre.
2. **Dos tarjetas separadas:**
   - «Ya tiene agente en Chatwoot: vincularlo»: persona y agente. El agente se elige en una lista «nombre · correo (#número)» con los agentes de la cuenta que no tienen vínculo; el del mismo correo que la persona va primero y queda elegido. Si todos los agentes tienen vínculo, lo dice y manda a crear.
   - «No tiene agente: crearlo en Chatwoot»: persona y «Crear y vincular» (antes «Dar de alta en la bandeja»).
3. **El número a mano solo si Chatwoot no respondió**, con su ayuda: «Escribe el número que sale junto al agente en Chatwoot › Ajustes › Agentes».
4. **De dónde salen los agentes** (C: `lib/studio/chatwoot/agentes-bandeja-admin.ts` › `agentesDeCuenta`): la lista de miembros de la cuenta, la misma de la salud (`listarMiembrosCuenta`), solo trae id y rol. El nombre y el correo salen de `obtenerAgente` por cada miembro, sin el usuario de servicio: lecturas de la Platform API, en la página de Usuarios, que es solo admin. Un agente que no se pudo leer queda fuera; si no se pudo leer ninguno, o hay más de 60, `agentes` es `null` y se pide el número. Nada se guarda: es la misma vista del admin que ya mostraba correos en Usuarios. Las server actions (`vincularAgente`, `altaAgente`, `desvincularAgente`) no cambian: siguen comprobando cuenta y correo en el servidor.
5. **BTN-01 §5** en «Desvincular», «Vincular» y «Crear y vincular»: el mismo recurso de la celda única.

### Aceptación de la PR 2

1. Bandeja: una sola fila con «CRM», las pestañas, el estado y las acciones; sin «Reducir» ni ayuda fija; el panel sin marco, con todo el ancho y hasta el borde de abajo de la ventana (mínimo 480 px). Sin vínculo, la fila sigue con las pestañas.
2. «Abrir de nuevo» no cambia de ancho al pedir (prueba de estructura) y queda deshabilitado con `aria-busy`.
3. Usuarios › Bandeja: tabla con sus cinco columnas y «Desvincular» en la última; vincular y crear en dos regiones con su título; agente elegido por nombre y correo, con el del mismo correo primero; el número solo si Chatwoot no respondió, con ayuda asociada.
4. `agentesDeCuenta` con dobles: lee nombre, correo y rol; deja fuera al de servicio; `null` sin cuenta, sin ningún agente legible o con más de 60.
5. Las pruebas de 0585, 0655, 0677 y la PR 1 siguen; las de la pantalla completa de 0677 se retiran con la función (ver punto 3 de la Bandeja).
6. `/ui-check` del diff sin hallazgos bloqueantes.

### Revisión independiente de la #700 (Opus, APPROVED): lo que entra aquí

- **M1 (media), resuelto en la PR 2.** El plazo de la PR 1 solo resolvía «la action no vuelve» en los dobles: Next 16 corre las server actions de una en una (`next/dist/client/components/app-router-instance.js` › `runRemainingActions` y `dispatchAction`), así que un POST colgado deja en cola cualquier reintento por la action hasta que termine o se recargue la página. Ahora un pedido que vence el plazo no se reintenta: va al aviso y «Abrir de nuevo» **recarga la página** (`recargarPagina`). Prueba: «si la action no vuelve nunca…». **NV** en un navegador real: falta forzar un POST colgado en Next y ver que la recarga lo destraba.
- **B1 (baja), límite anotado.** La marca `dtd_cw_sso` la pone el servidor al devolver el enlace (`actions.ts` › `pedirEnlaceSso`). Puede quedar puesta sin que haya login: si la respuesta llega después del plazo, o si llegó pero el freno no dejó cargar el enlace. En la próxima carga `page.tsx` abre el panel directo, sin SSO, y si Chatwoot no tiene sesión se ve su pantalla de inicio. Ya pasaba antes de 0680 con un POST abortado. Salida: «Abrir de nuevo». Arreglo de fondo: el aviso `dtd:sin-sesion` del panel (SDD-0677, opción c), fuera de esta spec.
- **B2 (baja), resuelto.** Dos pruebas nuevas: «si llega el enlace pero otra pestaña llenó el cupo entretanto, no lo carga y explica el freno» y «una respuesta que llega después del plazo no cambia el marco ni la fase».

### Revisión independiente de la #703 (Opus, APPROVED): bajos, en la PR 3

1. **Texto propio al vencer el plazo.** El aviso decía «no respondió después de 3 intentos», y en ese caso hubo un solo pedido que no volvió. Ahora dice «La bandeja no respondió a tiempo. Oprime «Abrir de nuevo»: la página se vuelve a cargar.» (`bandeja.recover.timeout`).
2. **Lista de agentes incompleta.** `agentesDeCuenta` devuelve `{ agentes, completa }`. Si algún agente no se pudo leer, el selector suma «Otro agente: escribir su número…», que muestra el campo del número (y el selector deja de enviar su valor). Tampoco dice «todos tienen vínculo»: el que faltó puede ser el libre. Si entre los leídos no queda nadie libre, se pide el número directo.
3. **Lecturas en paralelo con tope.** `enLotes` corre las lecturas de a `LECTURAS_EN_PARALELO` (5), conservando el orden; el tope de 60 agentes sigue.
4. **`role="status"` siempre montado** mientras hay panel (sin texto cuando hay aviso): un estado que nace con el texto no siempre se anuncia.
5. **Sin la URL del Artifact** en los handoffs.

### Gobernanza

| Política | Clasificación |
|---|---|
| BTN-01 §5 (ancho en espera) | cumplimiento: celda única en los cuatro botones |
| BTN-01 §7 (icon-only) | cumplimiento: solo «abrir en pestaña aparte» va sin texto (metáfora estándar), con `aria-label` y `title`; «Agentes» lleva texto |
| BTN-01 §4 (fila de tabla) | cumplimiento: una acción por fila, en su columna |
| A11Y-01 | cumplimiento: un `h1`, tabla con `th scope`, regiones con título, ayudas con `aria-describedby`, estado con `role="status"` |
| VIS-01 / BRAND | cumplimiento: tokens del Studio, sin colores nuevos |
| Datos personales | no aplica captura nueva: se muestran a un admin nombre y correo de agentes de su propia cuenta, sin guardarlos |

### Archivos (allowlist)

`app/studio/(app)/bandeja/_components/BandejaClient.tsx`, `app/studio/(app)/bandeja/page.tsx`, `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx`, `app/studio/(app)/crm/_components/CrmPestanas.tsx`, `app/studio/(app)/layout.tsx`, `app/studio/(app)/usuarios/_components/AgentesBandeja.tsx`, `app/studio/(app)/usuarios/_components/UsersClient.tsx`, `app/studio/(app)/usuarios/__tests__/AgentesBandeja.test.tsx`, `lib/studio/chatwoot/agentes-bandeja-admin.ts`, `lib/studio/chatwoot/__tests__/agentes-de-cuenta.test.ts`, `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`, esta spec y el handoff.

## Fuera de alcance

- Lo de adentro del iframe (Chatwoot).
- La Ficha DTD: si Sam quiere cambiarla, otra SDD.
- `MAX_USER_SESSIONS`, rack-attack y el aviso `dtd:sin-sesion` del panel (SDD-0677, opciones a y c): config del VPS.

## Adenda 2026-11-23 (b) · el estado del chat del portal sube a la fila

**Pedido de Sam (textual):** «en la bandeja, en la parte de abajo, se ve muy mal. Hay que hacerlo mucho más estético y más informativo… hay que arreglarlo para que se vea bien visualmente y se entienda qué hace ahí. En algún lado en la parte de arriba, analiza cuál sería la mejor opción.» Se le dibujaron tres variantes (A pastilla en la fila, B aviso solo con problema, C mudarlo a Usuarios › Bandeja) y eligió: «Va la A».

**Lo que había:** la tarjeta «Portal → Chatwoot» (SDD-0586, §10.5.20) iba debajo de un panel que ocupa todo el alto de la ventana: para verla había que bajar más allá de Chatwoot. Casi siempre decía «0» y «0» con cifras de 20 px y un botón deshabilitado, y su texto no decía para qué estaba.

**Cambio:**
1. `PortalChatwoot` pasa de tarjeta a una pastilla en la fila de la Bandeja, junto al estado «Conectada». Muestra cuatro estados, cada uno con icono y texto (nunca solo con color): «Chat del portal al día», «… apagado», «…: N sin llegar» y «…: N atascado(s)».
2. Con atascados, «Reintentar los atascados» queda en la fila, sin abrir nada.
3. Al hacer clic, la pastilla abre un detalle (`role="dialog"`, `aria-expanded`). Se cierra con Escape, devolviendo el foco, o con un clic afuera. El detalle dice qué es: lo que los clientes escriben en Soporte del portal entra a esta Bandeja. También trae los dos números en 14 px y el botón. El resultado del reintento abre el detalle y se lleva el foco.
4. El texto ya no nombra la bandeja «Conversaciones del portal» de Chatwoot. `bandeja.portal.help` deja así de estar atado a ese nombre externo (clase A′ de la SDD-0707), y el renombre de la fase 5 de la 0707 ya no lo arrastra.
5. Se retira `bandeja.portal.atascados_estado` («Requiere acción»), que ya no se usa: el tono de la pastilla da el estado. La fila de la SDD-0686 que lo nombraba queda histórica.

**Gobernanza:** BTN-01 (máximo tres acciones visibles: estado, reintentar y las de siempre; verbo + sustantivo en «Reintentar los atascados»), cumplimiento. A11Y-01 (estado con texto, disparador con `aria-expanded` y `aria-controls`, Escape), cumplimiento. VIS-01 / BRAND (tokens del Studio, `StatusIcon`, sombra `--shadow-md`, sin colores nuevos), cumplimiento. Datos personales: no aplica, solo números.

**Allowlist de la adenda (b):** `app/studio/(app)/bandeja/_components/PortalChatwoot.tsx`, `app/studio/(app)/bandeja/_components/BandejaClient.tsx` (solo dónde se monta), `app/studio/(app)/bandeja/__tests__/PortalChatwoot.test.tsx`, `app/studio/_components/__tests__/kpi-cifra-en-tinta-contract.test.tsx` (sale el caso de la cifra de 20 px que ya no existe), `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`, esta spec y el handoff `.agents/handoffs/0680-adenda-estado-portal-en-fila.md`.
