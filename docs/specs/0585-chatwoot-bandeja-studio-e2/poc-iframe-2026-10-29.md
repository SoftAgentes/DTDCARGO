# SDD-0585 · Registro de la PoC del iframe (paso 2.1) — 2026-10-29

Evidencia de la prueba de concepto «Chatwoot dentro de Studio»: iframe, SSO y micrófono. Etiquetas del programa: **C** (el código lo permite), **D** (el proveedor lo documenta), **T** (la cuenta de DTD lo tiene), **R** (probado en runtime), **I** (inferencia), **NV** (no verificado).

**Todo lo R es local.** Corre en Docker con datos sintéticos (`infra/chatwoot/pruebas/iframe-poc/`). No se tocó el VPS, ni el Chatwoot de producción, ni Studio en producción. Las lecturas T son `curl -I` anónimos a páginas públicas.

## Resultado

**Sí al iframe.** Funciona en Chrome y Edge de escritorio, en las tres capacidades. En el WebKit de Playwright (indicador de Safari), el iframe y el SSO pasan.

Una condición manda sobre todo lo demás: **Studio y Chatwoot tienen que ser del mismo sitio** (`dtdcargo.com`). Hoy lo son. Desde otro sitio, el SSO no entra en ninguno de los motores probados (S4).

## Banco de pruebas

| Pieza | Qué es | Equivalente en producción |
|---|---|---|
| `levantar.sh` | El `compose.yml` real de E1 con el overlay local, `FORCE_SSL=true` y `CHATWOOT_FRAME_ANCESTORS` con dos orígenes de prueba. Detrás va el Traefik de `compose.traefik-poc.yml`: misma imagen y mismos middlewares de archivo que producción. Crea la Platform App y, **por la Platform API**, la cuenta y la agente (rol `agent`). Siembra una conversación sintética | VPS: `/srv/chatwoot`, Traefik `ops` |
| `frente.mjs` :18443 | TLS con un certificado autofirmado y proxy a Traefik con `X-Forwarded-Proto: https`; pasa los websockets | Cloudflare delante del VPS |
| `frente.mjs` :18444 | Página `/bandeja` con un iframe y las cabeceras de Studio que pide cada caso | `https://dtdcargo.com/studio/…` |
| `matriz.mjs` | Playwright 1.60 con Chrome y Edge instalados y el WebKit de Playwright; micrófono falso | — |

**Orígenes.** `*.localtest.me` resuelve a 127.0.0.1 en DNS público, y `localtest.me` es un dominio registrable común. Por eso `chat.localtest.me` y `studio.localtest.me` son **el mismo sitio**, igual que `chat.dtdcargo.com` y `dtdcargo.com`. `localhost` y `127.0.0.1` sirven de controles de otro sitio.

**Cabeceras de Studio en la prueba** (`frente.mjs`):
- **CSP de hoy:** la de `next.config.ts` reducida a lo que decide el marco, es decir, `default-src 'self'` y sin `frame-src`.
- **Propuesta:** la misma más `frame-src https://chat…`.
- **Permissions-Policy:** la de hoy (`microphone=()`) o la propuesta (`microphone=(self "https://chat…")`).
- **Iframe:** con `allow="microphone"` o sin él.

## Matriz navegador × capacidad

Corrida final: 2026-10-29T19:35Z. Archivo: `matriz-chrome-edge-webkit-firefox.json` (en la carpeta de trabajo, fuera de Git).

| Capacidad | Comprobación | Chrome 156.0.8078.73 | Edge 156.0.4314.50 | Firefox | Safari (WebKit 26.4 de Playwright, Windows) |
|---|---|---|---|---|---|
| **Iframe** | I1 · el panel carga desde el origen permitido | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| | I2 · control `frame-ancestors`: origen fuera de la lista → bloqueado | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| | I3 · control `frame-src`: con la CSP de Studio de hoy → bloqueado | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| **SSO** | S1 · el enlace de un solo uso, dentro del iframe, abre el panel de la cuenta | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| | S2 · un iframe nuevo sin token sigue en el panel (cookie del chat dentro del marco) | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| | S3 · el mismo enlace, otra vez → no entra | PASÓ | PASÓ | NO DISPONIBLE | PASÓ |
| | S4 · control de sitio: el mismo flujo desde otro sitio | no entra, sin cookies | no entra, sin cookies | NO DISPONIBLE | no entra, sin cookies |
| **Micrófono** | M1 · `getUserMedia` en el panel y botón de nota de voz de Chatwoot dentro del iframe | PASÓ | PASÓ | NO DISPONIBLE | NO DISPONIBLE |
| | M2 · control: iframe sin `allow="microphone"` → `NotAllowedError` | PASÓ | PASÓ | NO DISPONIBLE | NO DISPONIBLE |
| | M3 · control: `microphone=()` de Studio de hoy → `NotAllowedError` | PASÓ | PASÓ | NO DISPONIBLE | NO DISPONIBLE |
| Servidor | S5 · `MAX_USER_SESSIONS=5`: el 6.º login de navegador recibe 409 | PASÓ (no depende del navegador) | | | |

**Por qué cada NO DISPONIBLE:**
- **Firefox:** no está instalado en la máquina, ni el de escritorio ni el de Playwright (`firefox-1522`). Descargarlo pide un OK explícito de Sam que no se dio («listo avanza con lo demás» no lo autoriza). La matriz lo corre en cuanto exista: `node matriz.mjs <poc.json> firefox`.
- **Safari:** no hay macOS ni iOS. El WebKit de Playwright para Windows (WinCairo) es un **indicador**, no Safari: no tiene ITP de Safari, informa `sameSite=None` en todas las cookies y no tiene `navigator.mediaDevices`. Por eso M1–M3 dan NO DISPONIBLE y no FALLÓ.

## Registro

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| E2-T1 | `https://chat.dtdcargo.com/app/login` responde sin `X-Frame-Options`, con `content-security-policy: frame-ancestors 'self' https://dtdcargo.com`, sin `Permissions-Policy`, y con `_chatwoot_session` en `secure; httponly; samesite=lax` | `curl -sI`, 2026-10-29 | T |
| E2-T2 | Studio vive en `https://dtdcargo.com/studio`. `https://www.dtdcargo.com/studio` da 301 a ese origen. No existe un `studio.` aparte | `curl -sI`, 2026-10-29 | T |
| E2-T3 | Studio manda hoy `Permissions-Policy: … microphone=() …`, `X-Frame-Options: DENY` y una CSP con `default-src 'self'` y sin `frame-src`. Bitácora es la excepción: `/studio/bitacora` lleva `microphone=(self)` | `curl -sI /studio/login`; `next.config.ts` | T, C |
| E2-C1 | El panel guarda su sesión en la cookie `cw_d_session_info`, escrita por JavaScript (`js-cookie`) **sin atributo SameSite**, así que el navegador la trata como Lax. La sesión de Rails es `same_site: :lax` | `app/javascript/dashboard/store/utils/api.js:31-37`; `config/initializers/session_store.rb:8` (imagen 4.19.1) | C |
| E2-C2 | El SSO: `GET /platform/api/v1/users/{id}/login` → `/app/login?email=…&sso_auth_token=…`. El panel hace `POST /auth/sign_in` con el token, que se consume en el primer uso | `devise_overrides/sessions_controller.rb:65-108` | C |
| E2-C3 | Con `MAX_USER_SESSIONS` sesiones vivas, un login cuyo agente de usuario contiene «Mozilla» recibe **409** con la lista de sesiones para elegir cuál cerrar (también por SSO). Sin «Mozilla», se desaloja la más vieja en silencio | `sessions_controller.rb:115-197` | C |
| E2-C4 | rack-attack limita `POST /auth/sign_in` a 5 por IP cada 5 min y a 10 por correo cada 15 min. Cada apertura por SSO cuenta | `config/initializers/rack_attack.rb:151-163` | C |
| E2-R1 | I1–I3 (tabla): `frame-ancestors` de Traefik y `frame-src` de Studio se cumplen en los tres motores. La consola de Chrome nombra la directiva que bloquea en cada control | `matriz.mjs` | R |
| E2-R2 | S1–S3: el SSO de un solo uso funciona dentro del iframe, la sesión queda en las cookies del chat (`cw_d_session_info`, `user.id`, `user.expires_at`, `_chatwoot_session`, todas Lax en Chromium) y el enlace reusado no entra | `matriz.mjs` | R |
| E2-R3 | **S4:** desde otro sitio (`https://localhost:18444`, permitido en `frame-ancestors`), el `POST /auth/sign_in` crea la sesión en el servidor, pero el navegador no guarda las cookies Lax en un marco de otro sitio: el panel vuelve a `/app/login`. Pasa en Chrome, Edge y WebKit. Además, deja una sesión huérfana en el servidor | `matriz.mjs`; E2-C1 | R |
| E2-R4 | M1: dentro del iframe, `getUserMedia({audio:true})` se concede, y el **botón de nota de voz de Chatwoot** consigue el micrófono (la llamada se interceptó: «concedido», con el botón de parar) en Chrome y Edge | `matriz.mjs` | R |
| E2-R5 | M2–M3: sin `allow="microphone"`, o con `microphone=()` en Studio, `getUserMedia` da `NotAllowedError`. Hacen falta **las dos** cosas, el atributo y la cabecera | `matriz.mjs` | R |
| E2-R6 | Falso verde evitado: en WebKit, sin `navigator.mediaDevices`, Chatwoot **igual** muestra el botón de parar. El ícono de «grabando» no prueba que haya micrófono; por eso M1 intercepta la llamada | `matriz.mjs`, corrida intermedia | R |
| E2-R7 | S5: con `MAX_USER_SESSIONS=5` (valor del VPS), cinco logins de navegador dan 200 y el sexto **409**. Sin «Mozilla», 200 (desalojo). Durante la PoC, Edge recibió el 409 sin buscarlo después de seis logins de las corridas anteriores | `matriz.mjs` | R |
| E2-I1 | Firefox: la Total Cookie Protection separa las cookies por **sitio** de primer nivel. Un iframe de `chat.dtdcargo.com` dentro de `dtdcargo.com` es del mismo sitio y usa el tarro normal; el resultado esperado es el de Chromium. Sin probar | Inferencia sobre E2-C1 y E2-R3 | I |
| E2-I2 | Safari: ITP bloquea las cookies de terceros, pero un subdominio del mismo sitio no es tercero. Safari admite `allow="microphone"` en iframes. Sin probar en Safari real | Inferencia | I, NV |
| E2-I3 | El `req.ip` de rack-attack detrás de Cloudflare y Traefik podría ser la IP de Cloudflare y no la del usuario, y entonces el tope de 5 logins por IP sería compartido. Sin medir | Inferencia sobre E2-C4 | I, NV |
| E2-NV1 | `allow="clipboard-write"` (copiar en el panel), `autoplay` (sonido de mensaje nuevo) y el websocket de ActionCable dentro del iframe no se midieron. Pasan a 2.2 y 2.3 | — | NV |
