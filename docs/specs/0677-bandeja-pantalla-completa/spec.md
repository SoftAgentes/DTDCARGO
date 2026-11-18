---
sdd: "0677"
title: "Bandeja: pantalla completa y abrir Chatwoot sin error"
status: proposed
author: "Claude (Worker)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0585", "0648", "0655", "0671", "0675"]
confidencialidad: interno
---

# SDD-0677 — Bandeja: pantalla completa y abrir Chatwoot sin error

## Pedido

Sam, literal (2026-11-18):

> necesito que me rediseñes la bandeja, que sea compacta pero que se amplíe a toda la pantalla cuando se abra, porque se ve pequeña. Realmente la bandeja está abriendo Chatwoot, pero necesito que se abra completo. Además, hay veces que lo abro y me sale error, y yo creo que eso ya lo habíamos corregido antes. ¿Cómo hacemos para que siempre esté activa cuando esté ahí, o qué hay que hacer para que la bandeja siempre abra Chatwoot y no me dé ese error?

Dos partes: (1) por qué falla a veces; (2) la Bandeja a pantalla completa y que se recupere sola.

## Etiquetas de evidencia

- **C**: leído en el código de este repo, en `main` a `bab0dafcc`. Se cita por archivo y símbolo (función, clave o bloque), no por línea, para que la cita no se venza al fusionar. Lo que esta spec cambia se marca «antes de 0677».
- **R**: resultado medido antes, citado de otra spec con su ID.
- **I**: inferencia. No se probó.
- **NV**: no verificado. Hace falta mirar los logs del VPS o de Chatwoot, con permiso del DG.

No se leyó producción, ni filas de negocio, ni los logs del VPS.

## 1. Diagnóstico

### Cómo abre hoy la Bandeja a Chatwoot

1. La página decide el estado en el servidor. Si existe la marca `dtd_cw_sso` y es del usuario, pasa `inicioUrl = panelUrl`: el iframe abre el panel **sin SSO** y confía en que la sesión de Chatwoot del navegador sigue viva. (C: `app/studio/(app)/bandeja/page.tsx` › `BandejaPage`, el cálculo de `inicioUrl`; `lib/studio/chatwoot/sso-cookie.ts` › `ssoVigentePara`)
2. Sin marca, el cliente pide un enlace SSO de un solo uso por server action y lo pone en el iframe. El servidor deja la marca. (C: `app/studio/(app)/bandeja/_components/BandejaClient.tsx` › `pedir` y el efecto «un solo pedido automático por montaje», antes de 0677; `app/studio/(app)/bandeja/actions.ts` › `pedirEnlaceSso`)
3. La marca es una cookie de sesión del navegador, sin `maxAge`. Solo la borra `signOut`. (C: `sso-cookie.ts` › `SSO_COOKIE_OPTIONS`; `app/studio/(app)/actions.ts` › `signOut`)
4. El pedido del enlace es **un solo intento**. Cualquier falla de red, timeout o 5xx de Chatwoot termina en el código `service`. (C: `lib/studio/chatwoot/platform-api.ts` › `obtenerEnlaceSso` y `pedir`; `actions.ts` › `pedirEnlaceSso`, la rama `!enlace.ok`)
5. Con `service`, la Bandeja muestra «No pudimos abrir la bandeja / El servidor de mensajes no respondió» y un botón «Reintentar». No reintenta sola. (C: `BandejaClient.tsx`, la rama `fase.tipo === "error"`, antes de 0677; `lib/i18n/es-VE/bandeja.ts`, las claves `bandeja.state.error.*` (retiradas por esta spec) y `bandeja.error.service`)
6. Cuando el iframe carga, Studio lo da por «abierto» con el `onLoad`, sea el panel, la pantalla de inicio de sesión de Chatwoot, la de «demasiadas sesiones» o una página de error del proxy. El marco es de otro origen y Studio no puede leer qué cargó. (C: `BandejaClient.tsx`, el `onLoad` del iframe)
7. El script del panel (`DASHBOARD_SCRIPTS`) solo responde a `dtd:cerrar-sesion` y a la guía. No avisa a Studio si el panel quedó sin sesión. (C: `infra/chatwoot/panel/dashboard-scripts.html`, el escuchador de `message` que atiende `dtd:cerrar-sesion`)

Las cabeceras no son la causa:
- Studio manda `frame-src` del chat solo en `/studio/bandeja`. (C: `next.config.ts` › `headers()`, el bloque «Bandeja de Chatwoot (SDD-0585, E2-D2/E2-D14)»)
- Traefik borra el `X-Frame-Options` de Chatwoot y pone `frame-ancestors 'self' <Studio>`. (C: `infra/chatwoot/compose.yml`, el middleware `${COMPOSE_PROJECT_NAME}-marco`)
- `www` redirige a la raíz antes de llegar a Studio, así que el marco siempre se pide desde `https://dtdcargo.com`. (C: `infra/dtd-cargo/compose.yml`, el middleware `-www-a-raiz`; R: E2-T2)
- Las cookies no son de terceros: `chat.dtdcargo.com` dentro de `dtdcargo.com` es el mismo sitio, y las cookies `Lax` viajan. (R: E2-R2, E2-D1, E2-D29)

### Causas, de más a menos probable

| # | Causa | Qué ve Sam | Evidencia | Etiqueta |
|---|---|---|---|---|
| H1 | **Sesiones acumuladas: el 409 de Chatwoot.** Con `MAX_USER_SESSIONS=5`, el sexto login de navegador da 409 y Chatwoot muestra, **dentro del iframe**, la pantalla para elegir qué sesión cerrar. Cada SSO es un login nuevo. La marca vive solo mientras el navegador no se cierre, así que cada vez que se abre el navegador, se usa otra PC o se entra desde otro navegador, hay otro SSO y otra sesión. Las sesiones viejas duran hasta 2 meses (`token_lifespan`). El cierre de sesión en el navegador (E2-D48) solo cierra la sesión si la persona sale con «Cerrar sesión» de Studio, y depende del script del panel instalado en el VPS. Quien solo cierra el navegador deja la sesión viva. | Una pantalla de Chatwoot con un error o una lista de sesiones, sin que Studio diga nada | C: `infra/chatwoot/compose.yml` › `x-entorno`, `MAX_USER_SESSIONS`; el comentario de cabecera de `sso-cookie.ts`; R: E2-R7, E2-C3, E2-D13, E2-D48 | C + R; que pase en producción: **NV** |
| H2 | **Marca vieja con la sesión del panel ya muerta.** Si la marca existe, Studio abre el panel sin SSO. Si la sesión de Chatwoot de ese navegador ya no existe, el panel cae en su pantalla de inicio de sesión. Puede morir porque un login sin «Mozilla» en el agente (la app móvil, por ejemplo) desaloja la sesión más vieja en silencio, porque la sesión venció, o por una baja y alta del agente. | La pantalla de inicio de sesión de Chatwoot dentro de la Bandeja | C: `page.tsx` › `BandejaPage`, `inicioUrl`; R: E2-C3 (desalojo sin «Mozilla») | C + R; que pase en producción: **NV** |
| H3 | **Chatwoot reiniciándose o lento.** El enlace se pide una sola vez, con timeout. Si Chatwoot se está reiniciando (actualización de versión, `docker restart`, memoria del VPS), sale el error `service` y no hay reintento automático. Si Chatwoot responde el enlace pero no carga el panel, el proxy pinta su propia página de error dentro del marco. | «No pudimos abrir la bandeja. El servidor de mensajes no respondió», o una página de error dentro del marco | C: `platform-api.ts` › `obtenerEnlaceSso`; `actions.ts` › `pedirEnlaceSso`; la rama de error de `BandejaClient.tsx` antes de 0677 | C; cuándo reinicia: **NV** (logs del VPS) |
| H4 | **Tope de logins de rack-attack.** Chatwoot corta a 5 `POST /auth/sign_in` por IP cada 5 minutos. Si detrás de Cloudflare la IP que ve es la de Cloudflare, o si toda la oficina sale por la misma IP, cinco aperturas juntas de varias personas bastan para que la sexta reciba 429. | Un error de «demasiados intentos» dentro del marco | R: E2-C4; I: E2-I3 | I, **NV** |
| H5 | **Enlace de un solo uso reusado.** El enlace solo entra una vez (R: E2-R2, S3). Hoy el iframe se monta con `key={src}` y el enlace no se reusa al recargar la página, porque al recargar la marca ya existe y se abre el panel sin token. **No es la causa** con el código actual, pero el rediseño no debe volver a montar el iframe al cambiar de modo, o reusaría un enlace ya gastado. | — | C: `BandejaClient.tsx`, el `key={src}` del iframe; `page.tsx` › `BandejaPage`, `inicioUrl` | C (descartada) |

### El arreglo anterior que recuerda Sam

Lo que se corrigió antes fue en SDD-0585:
- **E2-D5 y E2-D12**: SSO solo cuando hace falta, con la marca `dtd_cw_sso`, para no gastar un login en cada visita y no llegar al 409.
- **E2-D48 y E2-D51 (paso 2.7)**: cerrar la sesión del panel al salir de Studio y revocar las sesiones en la baja.

**Por qué volvió o no lo cubre:**
- La marca reduce los logins por visita, pero no los logins por sesión del navegador. Quien cierra el navegador sin «Cerrar sesión» suma una sesión de Chatwoot cada día. A los cinco días hábiles llega al 409 (H1).
- La misma marca causa H2: Studio cree que hay sesión, y no la hay.
- Ninguno de los dos arreglos tocó la recuperación: un intento, un error genérico y un «Reintentar» manual (H3). Studio no tiene forma de saber qué pantalla cargó el marco.

### Medición en el VPS (DG, 2026-11-18, solo conteos y sin datos personales)

- **Reinicios:** `RestartCount=0` en todos los contenedores de Chatwoot. `rails` corre desde el 2026-11-07, `sidekiq` desde el 11-05 y el acceso desde el 11-17. **H3 es improbable en los últimos días**, salvo que el error coincida con un relevo manual.
- **Logs de rails:** en 7 días hay 2 líneas con «sign_in» y ninguna con el código de respuesta. Los 409 y 429 no quedan registrados, así que **por logs no se puede confirmar ni descartar H1, H2 ni H4**.

### H1 y H2 son hipótesis medibles: cómo medirlas

| Medida | Qué confirma | Cómo, sin datos personales | Quién |
|---|---|---|---|
| M1 · Sesiones vivas por agente | H1: un agente de la Bandeja con 5 sesiones o más está en el 409 o al borde | Una consulta de solo lectura en la base de Chatwoot, con OK del DG: el histograma de `count(*)` de `user_sessions` (o de tokens vivos) agrupado por usuario. El resultado sale en números, sin ids ni correos (por ejemplo: «3 agentes con 1, 1 con 5») | DG, en el VPS |
| M2 · Lo que ve Studio al abrir | H2: con la marca, el panel cayó en el inicio de sesión | Requiere (c): el script del panel le avisa a Studio su estado al cargar, y Studio cuenta `abrio_con_marca`, `sin_sesion` y `demasiadas_sesiones` en un log sin usuario ni enlace | PR de seguimiento + puerta del VPS |
| M3 · Código del SSO | H3 y fallas de la Platform API | Studio ya registra `[bandeja] SSO no disponible: <código>` (C: `actions.ts` › `pedirEnlaceSso`, el `console.warn` del SSO), sin enlace ni correo. Contar esas líneas en los logs de Studio por día | DG |
| M4 · 409 y 429 de `/auth/sign_in` | H1 y H4 en el momento del login | Lo pide el navegador a Chatwoot, y Studio no lo ve. Hace falta un access log de Traefik para `chat.` filtrado a esa ruta y a esos códigos, guardando solo conteos. Es config del VPS. **Medido por el DG (2026-11-18):** Traefik no deja el access log en `docker logs` (0 líneas con `/auth/sign_in` en 7 días), así que hoy no hay medida por ahí; habría que encender el access log | DG, con OK de Sam |

El orden que conviene es M1 primero (una consulta y ninguna instalación; el DG se la pide a Sam junto con las opciones a, b y c), y después M3. M2 y M4 dependen de las decisiones de abajo. No se tocan ni la config ni el compose de Chatwoot desde esta spec.

## 2. Diseño

### D1 · Pantalla completa al abrir

- Al quedar lista la Bandeja, el panel se amplía a **toda la ventana**. Una capa fija cubre el menú lateral y la barra de Studio, y arriba queda una franja compacta de 44 px con:
  - el título «Bandeja»;
  - «Abrir de nuevo» (antes «Volver a entrar»);
  - «Abrir en pestaña aparte»;
  - «Reducir», con la pista «Esc».
- «Reducir» o **Esc** vuelve a la vista compacta dentro de la página del CRM. Esa vista conserva la cabecera, las pestañas y un botón «Pantalla completa».
- La preferencia se recuerda en el navegador. Quien redujo la ve reducida la próxima vez. Si el almacenamiento no está disponible, se abre a pantalla completa.
- **El iframe no se vuelve a montar al cambiar de modo**: solo cambia el estilo del contenedor (ver H5). No hay recarga ni un login extra.
- **Foco y teclado:**
  - al ampliar con el botón, el foco va al título de la franja; al reducir, vuelve al botón «Pantalla completa». La primera apertura no mueve el foco;
  - Esc funciona mientras el foco está en Studio. Dentro del panel, el teclado es de Chatwoot, y por eso «Reducir» siempre está a la vista;
  - no hay trampa de foco: el panel tiene que poder recibirlo con Tab. El fondo queda `inert` (D3), así que Tab recorre solo la franja y el panel;
  - el fondo no se desplaza mientras está ampliada;
  - la capa es una `<section>` con nombre (`aria-labelledby`), no un diálogo modal: es la página misma, más grande.
- Los avisos del admin (portal, descartados) quedan en la vista compacta, debajo del panel.

### D2 · Recuperación del error

> **Esto no resuelve H1.** Mientras no se apliquen (a) y (c) (ver más abajo), un agente con 5 sesiones vivas sigue cayendo en el 409. Lo de aquí hace que Studio no lo empeore y que la persona sepa qué hacer.

1. **Reintento automático del enlace.** Con `service`, el cliente reintenta dos veces más, a los 1,5 s y a los 4 s. Pedir el enlace no gasta un login de rack-attack: el login lo hace el navegador al cargar el enlace (R: E2-C2, E2-C4). Mientras reintenta muestra «Conectando con la bandeja… (intento 2 de 3)».
2. **Vigilante de carga.** Si el marco no termina de cargar en 20 s, se muestra el aviso de recuperación. El marco sigue montado por si termina.
3. **Aviso de recuperación, sin error crudo.** Es un `<Aviso>` con el título «La bandeja no abrió», una explicación corta según el caso y los botones «Abrir en pestaña aparte» y «Abrir de nuevo» (el principal, a la derecha). «Abrir de nuevo» pide un SSO nuevo. El texto no atribuye la falla a un reinicio de Chatwoot: la medición del DG lo hace improbable (H3).
4. **Con `error`, el iframe se desmonta**, porque no hay un enlace válido que mostrar. Con «lento» y con el freno sigue montado. Si termina de cargar, el `onLoad` limpia el aviso, también el del freno.
5. **Ayuda solo después de un fallo** (H1, H2, H4: lo que Studio no ve). Si hubo un error, el vigilante saltó, actuó el freno o la persona reabrió a mano, aparece en la franja: «¿Ves la pantalla de inicio de Chatwoot o un error? Oprime «Abrir de nuevo» una vez. Si vuelve a pasar, avísale al equipo de sistemas.» No se muestra junto al aviso, para no repetirlo. Antes de un fallo no hay ayuda fija, para no empujar a repetir el login que en H1 vuelve a fallar.
6. **Freno por navegador.** Como mucho **3 aperturas por SSO cada 5 minutos**, sumando las automáticas (al montar sin marca) y las manuales. Una apertura que termina en `service` cuenta una vez, no una por reintento. Las marcas son solo horas en milisegundos, en `localStorage` (`dtd.bandeja.sso`), dentro de un try/catch: sobreviven a recargar y se comparten entre pestañas. Si el almacenamiento falla al leer **o al escribir**, desde ese momento la página usa solo la memoria. Así el freno no queda en cero leyendo un `localStorage` que ya no se actualiza.
   - **Entre pestañas:** leer y escribir las marcas corre dentro de `navigator.locks` (`dtd.bandeja.sso`), así que dos pestañas no pasan el tope a la vez. Sin `navigator.locks`, o si falla, se reserva igual sin exclusión, y el límite queda en «3 por navegador, salvo carrera entre pestañas».
   - **Marcas futuras:** cuentan. Un reloj que se atrasó no abre el freno. Solo se descarta una marca a más de una ventana (5 min) en el futuro, porque si contara cerraría el freno para siempre. Con el tope lleno no se pide SSO, ni siquiera el automático, y el aviso dice: «Chatwoot frena los ingresos repetidos. Espera unos minutos o ábrela en una pestaña aparte.» Así Studio no empeora un 429 (H4) ni suma sesiones (H1).
7. Los errores que no son pasajeros (`denied`, `unlinked`, `unconfigured`) no se reintentan y conservan su mensaje.

### D3 · Fondo inerte y sin destello

- **`inert` en el fondo, solo en ramas explícitas.** En pantalla completa reciben `inert` las ramas marcadas con `data-capa-fondo` que no contienen la capa:
  - el menú lateral y la barra superior del shell (`app/studio/(app)/layout.tsx`, envueltos en `display: contents` para no cambiar el flex);
  - la cabecera y las pestañas del CRM (`bandeja/page.tsx`);
  - lo del admin debajo del panel (`BandejaClient.tsx`).

  **No** se apaga «todo lo de al lado»: el shell cuelga de `div.studio-sys` (`app/studio/layout.tsx`), y `ToastProvider`, `DeniedToast`, el BugFAB y `GuiaStudio` se pintan como hermanos, sin portal. Con el criterio de los hermanos quedaban inertes (lo vio la re-revisión de `f5fc4580e`). Lo que ya tenía `inert` no se toca, y al reducir se devuelve todo.

  **Respaldo seguro:** en un navegador sin `inert`, el atributo no hace nada y la capa sigue funcionando; solo Tab podría llegar al fondo.
- **Hidratación.** La preferencia se lee después de montar, con una lectura diferida y cancelable, como `useColumnConfig`. Hasta entonces la capa está en modo «pendiente», oculta con `visibility: hidden`: el marco ya carga, pero no se pinta en un modo para después saltar al otro.

### Fuera de este cambio (decisiones para Sam y el DG)

- **H1 de raíz.** Las opciones, todas fuera de Studio o con un efecto que Sam tiene que aprobar:
  - (a) subir `MAX_USER_SESSIONS` en el VPS: config de Chatwoot, puerta de integración;
  - (b) un botón «Cerrar mis otras sesiones y entrar», que use la revocación de 2.7 antes del SSO: cierra también la app móvil del agente;
  - (c) que el script del panel le avise a Studio `dtd:sin-sesion` o `dtd:demasiadas-sesiones`: cambia `DASHBOARD_SCRIPTS`, también es puerta de VPS. Con (c), Studio podría abrir de nuevo solo, sin que la persona oprima nada.

  **Recomendación del Worker** (la decide Sam; el DG se la plantea):

  | Opción | Qué resuelve | Costo o riesgo | Recomendación |
  |---|---|---|---|
  | (a) Subir `MAX_USER_SESSIONS` (por ejemplo a 10) | Alivia H1 de inmediato: hacen falta el doble de aperturas para llegar al 409 | Un cambio de una línea en el `.env` del VPS con `docker restart`, nunca `compose up`. Solo pospone el problema, porque las sesiones siguen durando 2 meses. Más sesiones vivas por agente | **Sí, ya**, como alivio |
  | (b) «Cerrar mis otras sesiones y entrar» | Resuelve H1 cuando ya pasó, a pedido de la persona | Cierra también la app móvil y las otras PC del agente. Usa la revocación de 2.7, que cambia el token del agente | **No por defecto.** Solo como último paso del aviso, con confirmación, si (a) y (c) no alcanzan |
  | (c) El panel avisa `dtd:sin-sesion` o `dtd:demasiadas-sesiones` | Studio deja de estar a ciegas (H1 y H2): ve la pantalla de inicio de sesión o el 409 y abre de nuevo **una vez** por su cuenta, o muestra el aviso | Cambia `DASHBOARD_SCRIPTS` en el VPS, con su prueba local. En Studio son unas pocas líneas sobre el puente que ya existe | **Sí, la de fondo.** Es la que cumple «que siempre abra» |

  Orden propuesto: (a) ahora, (c) en una PR de seguimiento, y (b) solo si los conteos del DG muestran 409 frecuentes después de (a) y (c).
- **H4.** Medir `req.ip` detrás de Cloudflare (E2-I3) y, si hace falta, `trusted_proxies`. Es config del VPS.

## Aceptación

1. La spec trae la causa citada por archivo y símbolo, y separa lo probado de lo que no (sección 1).
2. Con la Bandeja lista, el panel ocupa toda la ventana. «Reducir» y Esc vuelven a la vista compacta, y «Pantalla completa» amplía otra vez. Solo Escape reduce, y no con un diálogo de Studio abierto encima. El `src` del iframe y el elemento son los mismos antes y después (prueba).
3. El foco va al título al ampliar y vuelve al botón al reducir, también con Esc (prueba).
4. En pantalla completa quedan `inert` solo las ramas `data-capa-fondo`. Con la estructura real (`div.studio-sys` > shell, toast, BugFAB y guía), el toast, el BugFAB y la guía no quedan inertes, ni al ampliar ni al reducir, y todo se devuelve al reducir. Antes de leer la preferencia no se pinta ningún modo (prueba).
5. Con `service`, el enlace se reintenta dos veces antes del aviso. Con `denied`, no se reintenta. Con `error`, el marco se desmonta (prueba).
6. Si el marco no carga en 20 s, aparece el aviso con «Abrir de nuevo», y oprimirlo pide un SSO nuevo. La ayuda sale solo después de un fallo y nunca junto al aviso (prueba).
7. Freno: 3 aperturas cada 5 minutos por navegador, automáticas y manuales. Las pruebas cubren:
   - que sobrevive al remonte;
   - que una apertura con `service` cuenta una vez;
   - que la ventana vence a los 5 minutos exactos;
   - que las marcas futuras cuentan;
   - que funciona sin almacenamiento, y también con solo `setItem` o solo `getItem` roto;
   - que la reserva corre bajo `navigator.locks`, con respaldo si falla;
   - que el `onLoad` limpia el aviso.
8. Los textos en es-VE y zh-CN, sin claves sueltas ni «se está reiniciando».
9. `/ui-check` del diff, con su evidencia (abajo).

## Evidencia de `/ui-check` (advisory, 2026-11-18)

Se revisaron `BandejaClient.tsx` y los textos contra `BRAND.md` (color, controles BD-037, estados y tono) y las reglas de `app/studio/CLAUDE.md`:

| # | Prioridad | Hallazgo | Estado |
|---|---|---|---|
| 1 ⭐ | alta | Fondo de la capa con `var(--bg)`, un token que no existe en `app/studio/tokens.css` | Corregido: `var(--bg-base)` |
| 2 | media | Un aviso armado a mano (div con borde rojo a la izquierda) en vez de `<Aviso>`; BD-037 pide la franja plana del sistema | Corregido: `<Aviso tono="error" o "atencion" urgente>` |
| 3 | media | Una clase `studio-btn-secondary` que no existe | Corregido: `studio-btn-ghost`, variante oficial |
| 4 | baja | «Abriendo la bandeja…» en `--ink-mute` (#9B9B9B sobre blanco, por debajo de 4,5:1) | Corregido: `--ink-soft` |
| 5 | baja | El primario va a la derecha (regla 8) y los objetivos son de 32 px o más (`studio-btn-sm`) | Cumple |

Sin hex nuevos, sin AI slop y en tuteo. Los anchos no son fijos: no hay nada que medir.

## Alcance de archivos

- `app/studio/(app)/bandeja/_components/BandejaClient.tsx`
- `app/studio/(app)/bandeja/page.tsx` y `app/studio/(app)/layout.tsx`: solo los envoltorios `data-capa-fondo`
- `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx`
- `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`
- esta spec, el índice de specs y el handoff

No toca los archivos de la PR #686 (`agentes-ciclo.ts`, matriz, user-module-grants), ni `actions.ts`, ni migraciones, ni la config de Chatwoot.
