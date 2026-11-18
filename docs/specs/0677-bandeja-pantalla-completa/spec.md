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

- **C**: leído en el código de este repo (archivo:línea, en `main` a `bab0dafcc`).
- **R**: resultado medido antes, citado de otra spec con su ID.
- **I**: inferencia. No se probó.
- **NV**: no verificado. Hace falta mirar los logs del VPS o de Chatwoot, con permiso del DG.

No se leyó producción, ni filas de negocio, ni los logs del VPS.

## 1. Diagnóstico

### Cómo abre hoy la Bandeja a Chatwoot

1. La página decide el estado en el servidor. Si existe la marca `dtd_cw_sso` y es del usuario, pasa `inicioUrl = panelUrl`: el iframe abre el panel **sin SSO** y confía en que la sesión de Chatwoot del navegador sigue viva. (C: `app/studio/(app)/bandeja/page.tsx:60-62`; `lib/studio/chatwoot/sso-cookie.ts:25-27`)
2. Sin marca, el cliente pide un enlace SSO de un solo uso por server action y lo pone en el iframe. El servidor deja la marca. (C: `app/studio/(app)/bandeja/_components/BandejaClient.tsx:64-87`; `app/studio/(app)/bandeja/actions.ts:86-116`)
3. La marca es una cookie de sesión del navegador, sin `maxAge`. Solo la borra `signOut`. (C: `sso-cookie.ts:11`, `sso-cookie.ts:17-22`; `app/studio/(app)/actions.ts:23-24`)
4. El pedido del enlace es **un solo intento**. Cualquier falla de red, timeout o 5xx de Chatwoot termina en el código `service`. (C: `lib/studio/chatwoot/platform-api.ts:70-80`; `actions.ts:103-107`)
5. Con `service`, la Bandeja muestra «No pudimos abrir la bandeja / El servidor de mensajes no respondió» y un botón «Reintentar». No reintenta sola. (C: `BandejaClient.tsx:133-147`; `lib/i18n/es-VE/bandeja.ts:22-24`, `:112`)
6. Cuando el iframe carga, Studio lo da por «abierto» con el `onLoad`, sea el panel, la pantalla de inicio de sesión de Chatwoot, la de «demasiadas sesiones» o una página de error del proxy. El marco es de otro origen y Studio no puede leer qué cargó. (C: `BandejaClient.tsx:163`)
7. El script del panel (`DASHBOARD_SCRIPTS`) solo responde a `dtd:cerrar-sesion` y a la guía. No avisa a Studio si el panel quedó sin sesión. (C: `infra/chatwoot/panel/dashboard-scripts.html:42-56`)

Las cabeceras no son la causa:
- Studio manda `frame-src` del chat solo en `/studio/bandeja`. (C: `next.config.ts:329-341`)
- Traefik borra el `X-Frame-Options` de Chatwoot y pone `frame-ancestors 'self' <Studio>`. (C: `infra/chatwoot/compose.yml:248-252`)
- `www` redirige a la raíz antes de llegar a Studio, así que el marco siempre se pide desde `https://dtdcargo.com`. (C: `infra/dtd-cargo/compose.yml:104`; R: E2-T2)
- Las cookies no son de terceros: `chat.dtdcargo.com` dentro de `dtdcargo.com` es el mismo sitio, y las cookies `Lax` viajan. (R: E2-R2, E2-D1, E2-D29)

### Causas, de más a menos probable

| # | Causa | Qué ve Sam | Evidencia | Etiqueta |
|---|---|---|---|---|
| H1 | **Sesiones acumuladas: el 409 de Chatwoot.** Con `MAX_USER_SESSIONS=5`, el sexto login de navegador da 409 y Chatwoot muestra, **dentro del iframe**, la pantalla para elegir qué sesión cerrar. Cada SSO es un login nuevo. La marca vive solo mientras el navegador no se cierre, así que cada vez que se abre el navegador, se usa otra PC o se entra desde otro navegador, hay otro SSO y otra sesión. Las sesiones viejas duran hasta 2 meses (`token_lifespan`). El cierre de sesión en el navegador (E2-D48) solo cierra la sesión si la persona sale con «Cerrar sesión» de Studio, y depende del script del panel instalado en el VPS. Quien solo cierra el navegador deja la sesión viva. | Una pantalla de Chatwoot con un error o una lista de sesiones, sin que Studio diga nada | C: `infra/chatwoot/compose.yml:67`, `sso-cookie.ts:4-11`; R: E2-R7, E2-C3, E2-D13, E2-D48 | C + R; que pase en producción: **NV** |
| H2 | **Marca vieja con la sesión del panel ya muerta.** Si la marca existe, Studio abre el panel sin SSO. Si la sesión de Chatwoot de ese navegador ya no existe, el panel cae en su pantalla de inicio de sesión. Puede morir porque un login sin «Mozilla» en el agente (la app móvil, por ejemplo) desaloja la sesión más vieja en silencio, porque la sesión venció, o por una baja y alta del agente. | La pantalla de inicio de sesión de Chatwoot dentro de la Bandeja | C: `page.tsx:60-62`; R: E2-C3 (desalojo sin «Mozilla») | C + R; que pase en producción: **NV** |
| H3 | **Chatwoot reiniciándose o lento.** El enlace se pide una sola vez, con timeout. Si Chatwoot se está reiniciando (actualización de versión, `docker restart`, memoria del VPS), sale el error `service` y no hay reintento automático. Si Chatwoot responde el enlace pero no carga el panel, el proxy pinta su propia página de error dentro del marco. | «No pudimos abrir la bandeja. El servidor de mensajes no respondió», o una página de error dentro del marco | C: `platform-api.ts:70-80`, `actions.ts:103-107`, `BandejaClient.tsx:133-147` | C; cuándo reinicia: **NV** (logs del VPS) |
| H4 | **Tope de logins de rack-attack.** Chatwoot corta a 5 `POST /auth/sign_in` por IP cada 5 minutos. Si detrás de Cloudflare la IP que ve es la de Cloudflare, o si toda la oficina sale por la misma IP, cinco aperturas juntas de varias personas bastan para que la sexta reciba 429. | Un error de «demasiados intentos» dentro del marco | R: E2-C4; I: E2-I3 | I, **NV** |
| H5 | **Enlace de un solo uso reusado.** El enlace solo entra una vez (R: E2-R2, S3). Hoy el iframe se monta con `key={src}` y el enlace no se reusa al recargar la página, porque al recargar la marca ya existe y se abre el panel sin token. **No es la causa** con el código actual, pero el rediseño no debe volver a montar el iframe al cambiar de modo, o reusaría un enlace ya gastado. | — | C: `BandejaClient.tsx:156-157`, `page.tsx:60-62` | C (descartada) |

### El arreglo anterior que recuerda Sam

Lo que se corrigió antes fue en SDD-0585:
- **E2-D5 y E2-D12**: SSO solo cuando hace falta, con la marca `dtd_cw_sso`, para no gastar un login en cada visita y no llegar al 409.
- **E2-D48 y E2-D51 (paso 2.7)**: cerrar la sesión del panel al salir de Studio y revocar las sesiones en la baja.

**Por qué volvió o no lo cubre:**
- La marca reduce los logins por visita, pero no los logins por sesión del navegador. Quien cierra el navegador sin «Cerrar sesión» suma una sesión de Chatwoot cada día. A los cinco días hábiles llega al 409 (H1).
- La misma marca causa H2: Studio cree que hay sesión, y no la hay.
- Ninguno de los dos arreglos tocó la recuperación: un intento, un error genérico y un «Reintentar» manual (H3). Studio no tiene forma de saber qué pantalla cargó el marco.

Para confirmar H1 a H4 hacen falta los logs de Chatwoot del VPS (códigos 409 y 429 en `/auth/sign_in`, reinicios del contenedor). Se le pide permiso al DG. No se tocan ni la config ni el compose de Chatwoot.

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
  - no hay trampa de foco, porque el panel tiene que poder recibirlo con Tab;
  - el fondo no se desplaza mientras está ampliada;
  - la capa es `role="region"` con nombre, no un diálogo modal: es la página misma, más grande.
- Los avisos del admin (portal, descartados) quedan en la vista compacta, debajo del panel.

### D2 · Recuperación del error

1. **Reintento automático del enlace.** Con `service`, el cliente reintenta dos veces más, a los 1,5 s y a los 4 s. Pedir el enlace no gasta un login de rack-attack: el login lo hace el navegador al cargar el enlace (R: E2-C2, E2-C4). Mientras reintenta muestra «Conectando con la bandeja… (intento 2 de 3)».
2. **Vigilante de carga.** Si el marco no termina de cargar en 20 s, se muestra el aviso de recuperación.
3. **Aviso de recuperación, sin error crudo.** Título «La bandeja no abrió», una explicación corta según la causa conocida y los botones «Abrir de nuevo» (principal) y «Abrir en pestaña aparte». «Abrir de nuevo» pide un SSO nuevo.
4. **Ayuda visible para lo que Studio no puede ver** (H1, H2, H4). Debajo de la franja va una línea fija y discreta: «¿Ves la pantalla de inicio de Chatwoot o un error? Oprime “Abrir de nuevo”.»
5. **Freno contra el tope de logins.** Si en 5 minutos se oprime «Abrir de nuevo» tres veces, el tercero no pide otro SSO. Explica: «Chatwoot frena los ingresos repetidos. Espera unos minutos o ábrela en una pestaña aparte.» Así Studio no empeora un 429 (H4) ni suma sesiones (H1).
6. Los errores que no son pasajeros (`denied`, `unlinked`, `unconfigured`) no se reintentan y conservan su mensaje.

### Fuera de este cambio (decisiones para Sam y el DG)

- **H1 de raíz.** Las opciones, todas fuera de Studio o con un efecto que Sam tiene que aprobar:
  - (a) subir `MAX_USER_SESSIONS` en el VPS: config de Chatwoot, puerta de integración;
  - (b) un botón «Cerrar mis otras sesiones y entrar», que use la revocación de 2.7 antes del SSO: cierra también la app móvil del agente;
  - (c) que el script del panel le avise a Studio `dtd:sin-sesion` o `dtd:demasiadas-sesiones`: cambia `DASHBOARD_SCRIPTS`, también es puerta de VPS. Con (c), Studio podría abrir de nuevo solo, sin que la persona oprima nada.
- **H4.** Medir `req.ip` detrás de Cloudflare (E2-I3) y, si hace falta, `trusted_proxies`. Es config del VPS.

## Aceptación

1. La spec trae la causa con archivo:línea y separa lo probado de lo que no (sección 1).
2. Con la Bandeja lista, el panel ocupa toda la ventana. «Reducir» y Esc vuelven a la vista compacta, y «Pantalla completa» amplía otra vez. El `src` del iframe y el elemento son los mismos antes y después (prueba).
3. El foco va al título al ampliar y vuelve al botón al reducir (prueba).
4. Con `service`, el enlace se reintenta dos veces antes de mostrar el aviso. Con `denied`, no se reintenta (prueba).
5. Si el marco no carga en 20 s, aparece el aviso con «Abrir de nuevo», y oprimirlo pide un SSO nuevo (prueba).
6. El tercer «Abrir de nuevo» en 5 minutos no pide SSO y muestra el aviso del freno (prueba).
7. Los textos en es-VE y zh-CN, sin claves sueltas.
8. `/ui-check` del diff.

## Alcance de archivos

- `app/studio/(app)/bandeja/_components/BandejaClient.tsx`
- `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx`
- `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`
- esta spec, el índice de specs y el handoff

No toca los archivos de la PR #686 (`agentes-ciclo.ts`, matriz, user-module-grants), ni `actions.ts`, ni migraciones, ni la config de Chatwoot.
