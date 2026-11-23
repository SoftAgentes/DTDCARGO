# Handoff · SDD-0680, adenda 2026-11-23: la Bandeja tarda en abrir y no suena

Rama: `claude/jovial-mcclintock-b08932` · Worker: Claude (sesión hija de Dir_DTD) · Fecha: 2026-11-23.

## Diagnóstico (evidencia, VPS en solo lectura)

- Chatwoot está sano: rails y sidekiq healthy, CPU por debajo del 7 %, host 87 % ocioso (load 5,8 con 8 vCPU). `/app/login` responde en 0,7 s y `/api` en 0,48 s.
- El SSO de plataforma (`/platform/api/v1/users/N/login`) responde entre 27 y 267 ms (log de rails).
- En el log de acceso de Traefik, los POST de server actions en `/studio/bandeja` tardan 16,2 s (15:57Z), 51,7 s (19:37Z) y 42,8 s (19:39Z), y hay un 499 por recarga.
- El POST largo es `reconciliarBandeja`: token del agente y 4 páginas de `/api/v1/accounts/1/conversations` (de 1 a 5 s cada una, unas 280 queries por página, ~10 s en total), y después las escrituras en Supabase, una por conversación (~30 s).
- Causa: Next corre las server actions del cliente en una sola cola. El SSO («Abrir de nuevo» o la entrada) queda detrás de la reconciliación, vence `PLAZO_ENLACE_MS = 15 s` y sale «no respondió a tiempo». La salida anterior, recargar la página, volvía a trabarse en la carga siguiente.
- Inferencia (sin medir): al entrar, el Studio precarga todo el menú y algunas GET tardan de 5 a 20 s, lo que suma carga al servidor web en ese momento.

## Cambio

Lo detalla la spec (`docs/specs/0680-bandeja-rediseno/spec.md` § Adenda 2026-11-23):
1. Rutas `POST /studio/bandeja/sso` y `POST /studio/bandeja/reconciliar`, con candado de origen y `no-store`. El cliente las llama por `fetch` desde `_components/pedidos.ts`.
2. El pedido que vence el plazo se corta con AbortController y se reintenta en silencio (3 intentos). Se retiraron `recargarPagina` y la cola trabada. El texto de `bandeja.recover.timeout` cambió.
3. La reconciliación sale cuando el marco ya cargó.
4. Iframe con `allow="microphone; autoplay"`, y `autoplay=(self <chat>)` en la Permissions-Policy de la ruta.

## Pruebas

- `BandejaClient.test.tsx`: mock de `pedidos`; corte y reintento silencioso; los 3 vencidos muestran el aviso y «Abrir de nuevo» vuelve a pedir sin recargar; la reconciliación espera al `load` del marco; `allow` con autoplay.
- `rutas-bandeja.test.ts` (nuevo): candado de origen, cuerpo y caché de las dos rutas.
- `actions.test.ts` › «rutas de la Bandeja con las comprobaciones de las actions» corre las rutas contra las actions reales. Sin permiso del módulo, con el flag apagado o sin sesión: `denied`, sin enlace ni marca. Con el vínculo de otro tenant: `unlinked`. La reconciliación sin permiso no pide el token del agente. Con permiso, el token no sale ni en la respuesta ni en `console.*`.
- `next-config.test.ts`: `autoplay` delegado al chat.
- **Local: NO EJECUTADO.** El worktree no tiene `node_modules`, e instalar o correr vitest pide turno a Dir_DTD. La validación es el CI de la PR.

## Pasos para Sam: sonido en Chatwoot 4.20.1

1. En la Bandeja, abre tu avatar (abajo a la izquierda) › **Configuración del perfil**.
2. Baja a **Alertas de audio**:
   - **Eventos de alerta**: «Todas las conversaciones», o «Conversaciones asignadas» si solo quieres las tuyas.
   - **Tono de alerta**: elige uno y pruébalo.
   - **Condiciones**: desmarca «Enviar alertas de audio solo si la ventana del navegador no está activa» si quieres que suene también mientras miras el Studio.
3. Guarda. Después de publicar esta PR, recarga el Studio y haz un clic dentro de la Bandeja una vez: el navegador exige una interacción antes de reproducir sonido.

## Pendientes de esta tarea

- CI verde y la revisión independiente (la lanza Dir_DTD; carril con revisión previa porque toca la integración con Chatwoot).
- Después de publicar: medir en el navegador de Sam el tiempo de entrada y confirmar que suena.

## FUERA DE ALCANCE DETECTADO

- **Mejora aparte (pedida por Dir_DTD), sin hacer:** la reconciliación sigue tardando decenas de segundos en el servidor. `reconciliarBandeja` (`actions.ts`, el `for … await aplicarConversacion`) escribe una conversación a la vez, y cada una pasa por la RPC de la 0504 con service_role. Se puede hacer en lotes con tope (por ejemplo `enLotes` de a 5, como `agentesDeCuenta`) o con una RPC que reciba el arreglo. Además, Chatwoot lista cada página en 1-5 s.
- **Mejora aparte (revisión de Dir_DTD), sin hacer:** si la sesión del Studio vence, el `fetch` de `pedidos.ts` sigue la redirección del proxy al login, recibe HTML y el aviso dice «el servidor no respondió» en vez de «tu sesión venció». Arreglo posible: `redirect: "manual"` o mirar `content-type`/`response.redirected` y mapear a un código propio con su texto.
- El prefetch masivo del menú del Studio al entrar (GET de 5 a 20 s) recarga el servidor web.
- Sam pidió aparte cambiar el nombre «Conversaciones del portal» y dar color a los íconos de los canales dentro de Chatwoot. Eso lo atiende la sesión original.
