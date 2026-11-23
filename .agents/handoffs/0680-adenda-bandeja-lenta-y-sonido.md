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

- La reconciliación sigue tardando decenas de segundos en el servidor: escribe una por una y Chatwoot lista las páginas en 1-5 s. Convendría hacerla por lotes o en paralelo.
- El prefetch masivo del menú del Studio al entrar (GET de 5 a 20 s) recarga el servidor web.
- Sam pidió aparte cambiar el nombre «Conversaciones del portal» y dar color a los íconos de los canales dentro de Chatwoot. Eso lo atiende la sesión original.
