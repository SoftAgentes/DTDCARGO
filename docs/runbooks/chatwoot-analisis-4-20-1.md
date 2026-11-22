# Análisis · Chatwoot v4.20.0-ce → v4.20.1-ce

**Pedido de Sam (2026-11-22), textual:** «Actualización de Chatwoot: revísame para instalar la actualización de Chatwoot y analiza qué podemos hacer, sus riesgos, cómo mitigar esos riesgos, qué conviene actualizar y por qué».
**Estado:** análisis escrito el 2026-11-22. **No toca producción ni el VPS y no instala nada.** La subida sigue el [runbook de versiones](chatwoot-versiones.md) (SDD-0588) y su forma corta de la [subida a la 4.20.0](chatwoot-subida-4-20.md) (SDD-0679), con el **OK nominal de Sam**.
**Sin secretos ni datos:** este archivo solo cita código público de `chatwoot/chatwoot` y código de este repo.

## Etiquetas de evidencia

- **C**: leído en el código. Del lado de Chatwoot, en `GET /repos/chatwoot/chatwoot/compare/v4.20.0...v4.20.1` (API pública de GitHub) y en las notas de la release. Del lado de DTD, en `main` a `8c15a4bb0`.
- **R**: leído en el registro de Docker Hub (índice y configuración de la imagen), sin bajar la imagen.
- **I**: inferencia, no probada.
- **NV**: no verificado; lo cierra el ensayo (§5) o el smoke de la subida.

## 1 · De dónde salen las versiones del panel

El panel «Análisis del salto» es **Studio › Administración › Actualizaciones** (`app/studio/(app)/admin/actualizaciones/`). (C)

| Dato | De dónde lo saca | Valor el 2026-11-22 |
|---|---|---|
| Versión instalada | `GET /api` del Chatwoot de producción (`lib/studio/chatwoot/versiones-fuentes.ts`) | **4.20.0** (subida del 2026-11-19, [registro](chatwoot-versiones.md#registro)) |
| Versión publicada | la release estable más nueva de `GET /repos/chatwoot/chatwoot/releases` | **4.20.1** (publicada el 2026-11-20) |
| Diff | `GET /repos/chatwoot/chatwoot/compare/v4.20.0...v4.20.1`, sin token (`lib/studio/chatwoot/analisis-motor.ts`) | 22 commits, 177 archivos |
| Piezas y archivos de los que dependen | `PIEZAS` en `lib/studio/chatwoot/analisis.ts` | las seis filas del informe |

El informe de la captura dice **«Sin IA»** porque el motor no está configurado en el servidor (no hay llave del motor). En ese modo solo compara **nombres de archivo** por prefijo: toda pieza que dependa de `Gemfile.lock` sale en «riesgo medio» apenas cambia cualquier línea del lockfile, aunque la gema que usa la pieza no se haya movido. Por eso la mayoría de las alertas de la captura son falsos positivos, como se ve en §3. (C)

## 2 · Qué trae la 4.20.1

Es una versión **de parche** (4.20.0 → 4.20.1), dos días después de la que instalamos. (C)

| Tema | Qué dice el código | Nos toca |
|---|---|---|
| **Seguridad** | Las notas recomiendan subir «por los arreglos de seguridad recientes, dependencias del runtime parchadas y endurecimiento de la imagen Docker». La PR #16651 de Chatwoot lleva la imagen de 21 hallazgos HIGH/CRITICAL de Trivy (2 críticos) a 0: Ruby 3.4.4 → **3.4.13** (Onigmo, zlib, `net-imap`, `resolv`, `uri`, `erb`), Alpine 3.21 → **3.23** con `apk upgrade` (musl y zlib), y saca `npm`, `npx` y `corepack` de la imagen de producción. **No hay aviso de seguridad (GHSA) nuevo de Chatwoot** para esta versión: los arreglos son del sistema y del runtime, no del código de Chatwoot | **Sí.** Es la razón principal para subir |
| **Migraciones** | **Ninguna.** El diff no toca `db/` | Reversión trivial: volver la línea de la imagen (§4, caso a) |
| **Postgres y Redis** | Sin cambios de requisitos. La PR los probó con pgvector pg16 y Redis 7, lo mismo que corremos | No |
| **Ruby** | 3.4.13 dentro de la imagen. «Non-Docker installations now require Ruby 3.4.13» no nos aplica: usamos la imagen | No |
| **Configuración de la imagen** | Mismo `WorkingDir`, mismo `Cmd`, mismo usuario (root), mismas variables salvo `RUBY_VERSION` (R) | No |
| **Compresión gzip** | `config/application.rb` agrega `Rack::Deflater` para respuestas `application/json`, **solo** si el cliente manda `Accept-Encoding: gzip` | Mínimo, ver §3 fila 4 |
| **Webhooks y Platform API** | El diff no toca `app/listeners/webhook_listener.rb`, `app/jobs/webhooks/`, `app/models/webhook.rb`, `app/controllers/platform/` ni `app/models/dashboard_app.rb` | No |
| **Lo demás** | Llamadas de WhatsApp, Copilot, Captain y Help Center (todo **Enterprise**, no viene en la imagen `-ce`); importaciones de Freshdesk e Intercom; adjuntos por arrastre en el composer nuevo; CC del correo | Solo lo de `-ce`, sin efecto en nuestras piezas |

## 3 · Fila por fila: qué cambió de verdad

| Fila del informe | Archivo marcado | Qué cambió en ese archivo | ¿Rompe lo nuestro? |
|---|---|---|---|
| **Candado de /register y /deregister** (medio) | `Gemfile.lock` | Solo `scout_apm` 5.3.3 → 5.8.0 (necesario para compilar en Alpine 3.23) y la línea `RUBY VERSION`. **HTTParty no cambia.** `app/services/whatsapp/` y `app/models/channel/whatsapp.rb` no cambian. (C) | **No.** Los métodos que intercepta el candado (`register_phone_number`, `deregister_phone_number`) y `HTTParty::Request` siguen iguales. Riesgo real: **bajo**. Igual se mide con `prueba-register.sh` y S2–S3 (NV) |
| **Revocación de sesiones** (medio) | `Gemfile.lock` | Lo mismo. **`devise_token_auth` no cambia.** `app/channels/`, `app/controllers/platform/` y `app/models/user.rb` no cambian. (C) | **No.** Riesgo real: **bajo**. La ruta propia se agrega con `Rails.application.routes.prepend`, así que las rutas nuevas de Chatwoot no la tapan. Se mide con `prueba-revocar-sesiones.sh` y S6–S7 (NV) |
| **Correos de DTD** (medio) | `Gemfile.lock` | Lo mismo. **`mail`, `actionmailer` y `devise` no cambian.** `app/mailers/` y las carpetas de plantillas no cambian. (C) | **No.** Riesgo real: **bajo**. Se mira con la vista previa de [§2 ter del servidor](chatwoot-servidor.md#2-ter--correos-con-la-marca-de-dtd-cargo) (NV) |
| **Integración con Studio: rutas de inboxes** (medio) | `app/controllers/api/v1/accounts/inboxes_controller.rb` | Una línea movida: al **editar** una bandeja, ahora guarda el canal **antes** del horario de atención. (C) | **No.** Studio no edita bandejas: `lib/studio/chatwoot` no llama a `PATCH …/inboxes/:id` (busqué las rutas en el código). (C) |
| **Integración con Studio: miembros** (no lo marca el informe) | `app/models/inbox.rb` y `app/models/team.rb` | Al agregar o quitar miembros de una bandeja o un equipo, Chatwoot ya no refresca su caché de cuenta **si no cambió nada**. (C) | **No (I).** Studio sí fija miembros (`fijarMiembrosBandeja` y el de equipos en `miembros-api.ts`, SDD-0675); cuando hay cambio, la caché se refresca igual que antes. Se confirma en el smoke: cambiar desde Studio los miembros de la bandeja de prueba y ver que el agente la ve (NV) |
| **Integración con Studio: rutas** (medio) | `config/routes.rb` | Dos rutas **nuevas** de llamadas de WhatsApp (`dismiss` y `whatsapp_call_hours`). No quita ni renombra ninguna. (C) | **No.** No usamos llamadas. La ruta de la revocación entra con `prepend` |
| **Integración con Studio: gzip** (no lo marca el informe) | `config/application.rb` | `Rack::Deflater` comprime el JSON si el cliente lo pide. (C) | **No (I).** El `fetch` de Node, el que usan Studio y el puente del cable, pide gzip y descomprime solo. `curl` sin `--compressed` no lo pide y recibe lo mismo que hoy: las pruebas y `vigilar.sh` no cambian. El monitor de versión de Uptime Kuma descomprime. Se confirma con S10, S11 y el monitor (NV) |
| **Redacción de logs** (bajo) | — | Ningún archivo del que depende. (C) | **No.** Se mide igual con A1/C6 y `prueba-redaccion-canales.sh`, porque Ruby cambia de versión |
| **Marca de DTD** (bajo) | — | Ninguno. (C) | **No** |
| **Dashboard App y Ficha DTD** | — | `app/models/dashboard_app.rb` y `vueapp.html.erb` no cambian. (C) | **No** |
| **Guía del panel** (SDD-0589) | — | Ninguno de los `.vue` de los selectores cambia; sí cambia `ActionButtons.vue` del composer **nuevo** de conversación, que la guía no usa. (C) | **No.** S13 lo confirma (NV) |

**Lo único nuevo para nosotros es el salto de Ruby y de Alpine.** Todos los initializers propios se cargan con `prepend` sobre clases de Chatwoot; un cambio de parche de Ruby no cambia cómo funciona `prepend` (I). Por eso el ensayo completo sigue siendo obligatorio: lo exige el runbook y prueba esto por comportamiento, no por lectura.

**Respaldo:** `respaldo.sh` y `restaurar.sh` corren `pg_dump` y `pg_restore` dentro del contenedor **`postgres`**, no del de Chatwoot. El cambio de Alpine no les toca. (C)

## 4 · Riesgos y mitigación

| # | Riesgo | Probabilidad | Mitigación |
|---|---|---|---|
| R1 | Un initializer propio deja de cargar con Ruby 3.4.13 (candado, revocación, redacción o correos) | Baja (I) | Las cuatro corridas del ensayo local (§4 del [runbook](chatwoot-versiones.md#4--prueba-en-copia-local-nunca-en-el-vps)) con sus controles en rojo, y S2–S7 en la ventana. Un rojo en S1–S7 es vuelta atrás inmediata |
| R2 | **El smoke de la 4.20.0 no está cerrado:** V7 y S10–S13 (SSO, Bandeja, Ficha DTD, mensaje de prueba) siguen pendientes desde el 2026-11-19 | — (ya existe) | Cerrarlos **antes** de la ventana (decisión D2). Si no, un rojo después de la 4.20.1 no dice cuál de las dos versiones lo causó |
| R3 | Se cae el tiempo real o algún cliente HTTP no entiende gzip | Muy baja (I) | S10 y S11 con Studio; el monitor de versión de Uptime Kuma |
| R4 | Mensajes perdidos durante el corte | Baja | Drenaje de Sidekiq y respaldo en el momento (§5 del runbook). Meta reintenta los webhooks y, mientras Kommo opere, el cliente igual tiene respuesta |
| R5 | La Oficina responde a medias durante el corte (lee o envía por la API de Chatwoot mientras no está) | Media si no se pausa | Pausarla durante la ventana (D3) con el procedimiento del paso 7 de §6: leer y guardar el estado, pausar, y al final **volver al estado previo**. Avisar a la sesión del cable |
| R6 | La versión nueva no arranca | Baja | **Sin migraciones**: la vuelta atrás es el caso (a) de §6 bis, que vuelve la línea de la imagen a `VIEJA` y recrea `rails` y `sidekiq` (~3–5 min). El respaldo del momento queda solo para emergencia (caso b) |
| R9 | El respaldo del momento no restaura | Baja | **Límite:** con la 4.20.1 la restauración solo se probó en el ensayo local, con datos sintéticos. La última restauración con datos reales es la P5, del 2026-10-29: desde B2, en 200 s, con la 4.19.1 ([respaldo §6](chatwoot-respaldo-restauracion.md)). Sin migraciones, la vuelta atrás normal no la necesita |
| R10 | `sidekiq` tarda en quedar sano al recrearlo | Media (medido) | En el ensayo local (R2), `up --wait` dio `sidekiq` *unhealthy* y diez minutos después estaba sano, con la PC cargada. En la ventana se esperan **4 min**. Si no queda sano en ese tiempo, vuelta atrás (a) |
| R7 | Se queda en 4.20.0 con las fallas del runtime (Ruby, zlib, `net-imap`, musl) | Media (I) | Subir esta semana. No se publican detalles de esas fallas aquí |
| R8 | El panel sigue dando «medio» por `Gemfile.lock` en cada versión | Segura | No es riesgo de la subida. Es una mejora del panel: ver Fuera de alcance |

## 5 · Qué conviene actualizar y por qué

- **Chatwoot a `v4.20.1-ce`. Sí, y pronto.** Es un parche sin migraciones, con arreglos de seguridad del runtime y la imagen, y Chatwoot mismo lo recomienda. Su superficie no toca ninguna pieza propia (§3). La reversión es la más barata posible.
- **Postgres (`pgvector 0.8.1-pg16`) y Redis (`7.2.11`): no.** La versión no lo pide y el runbook no sube en el mismo salto lo que no se exige.
- **Imagen fijada por digest** (R), para el `compose.yml` de la rama de la subida:
  - índice multiplataforma (lo que usa el compose desde la SDD-0679): `sha256:5c88eb71134268cb702ae902bb399a239175c4dc24b3f0c6d6b3a2533a377e43`
  - `linux/amd64`: `sha256:a195245e10aa77bd572415294a8f365ab247f0260415f48363c369c80a7cf321`
  - Se vuelve a leer con `docker buildx imagetools inspect chatwoot/chatwoot:v4.20.1-ce` el día de la rama: si el digest cambió, se para y se pregunta.
- **Lo que sale de la imagen** (`npm`, `npx`, `corepack`): nada nuestro los corre dentro del contenedor de Chatwoot (C, búsqueda en `infra/chatwoot`).

## 6 · Orden de pasos

Nada de esto lo hace este análisis. Lo ejecuta el Director en el VPS, solo desde lo que esté en `main`, con el OK nominal de Sam por el canal del Director. **El OK nominal cubre también la pausa y la vuelta de la Oficina** (pasos 7 y 11).

**Imágenes**, completas:

```bash
VIEJA='chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004299fec8142481a411906947928678fa0e126beb5248962183593f8be'
NUEVA='chatwoot/chatwoot:v4.20.1-ce@sha256:5c88eb71134268cb702ae902bb399a239175c4dc24b3f0c6d6b3a2533a377e43'
```

### Antes de la ventana

1. **Smoke de la 4.20.0** (D2). Cerrado el 2026-11-22. SSO OK, Bandeja OK, nota privada de prueba OK (conversación de prueba #4) y Ficha DTD carga. El contador no se midió.
2. **Ensayo local** en verde, de una corrida a la vez y con turno del Director: `ensayo-local.sh`, `prueba-register.sh`, `prueba-revocar-sesiones.sh`, `prueba-redaccion-canales.sh` y `prueba-correo-sistema.sh`. Exigencias y controles en rojo: [§4 del runbook](chatwoot-versiones.md#4--prueba-en-copia-local-nunca-en-el-vps).
3. **PR de la imagen** (`codex/chatwoot-v4-20-1`) revisada y en `main`.
4. **Sam disponible durante toda la ventana** con la clave privada `age`. La vuelta atrás (b) la necesita y solo la pega Sam ([§0 paso 4 de la 4.20.0](chatwoot-subida-4-20.md#0--antes-del-día)).
5. **Comparar variables y montajes** de `rails` y `sidekiq` contra el compose del VPS, en solo lectura, con el guion de [§0 paso 5 de la 4.20.0](chatwoot-subida-4-20.md#0--antes-del-día). Esta vez se espera **ninguna** diferencia en los dos, porque la 4.20.0 ya los igualó. Con **cualquier** diferencia no se sigue y se avisa al Director.
6. **Bajar la imagen por digest** antes de la ventana. No corta nada:

   ```bash
   docker pull "$NUEVA"
   docker image inspect --format '{{json .RepoDigests}}' chatwoot/chatwoot:v4.20.1-ce   # incluye @sha256:5c88eb71…
   df -h /
   ```

### La ventana

7. **Pausa de la Oficina, al estado previo.** Hoy está **activa**: Sam la reanudó a las 08:22Z del 2026-11-22. Como platform admin ([cable](oficina-cable.md)):
   - leer y **guardar** `select public.office_esta_pausada();` en la evidencia de la ventana (`ANTES=true|false`);
   - si `ANTES=false`: `select public.office_cambiar_pausa(true, 'subida Chatwoot 4.20.1');`
   - avisar a la sesión del cable.
8. **Aviso, drenaje y respaldo conjunto en el momento**, como [§2 y §3 de la 4.20.0](chatwoot-subida-4-20.md#2--el-día-estado-y-drenaje).
9. **Cambio de una sola línea.** No se copia el compose de `main`, porque el del VPS es otro:

   ```bash
   cd /srv/chatwoot && cp -p compose.yml "$EV/compose.yml.antes"
   [ "$(grep -c "$VIEJA" compose.yml)" = 1 ] || { echo "la línea vieja no está una sola vez: parar"; exit 1; }
   sed -i "s|$VIEJA|$NUEVA|" compose.yml
   diff "$EV/compose.yml.antes" compose.yml        # exactamente 1 línea: VIEJA → NUEVA
   ```

   Después: `prepare` una vez y recrear **solo** `rails` y `sidekiq`, como en [§4 de la 4.20.0](chatwoot-subida-4-20.md#4--cambio-de-imagen-migraciones-y-recreación). Si alguno no queda sano en 4 min, vuelta atrás (a).
10. **Smoke de la 4.20.1.** S1–S9 del [runbook de versiones](chatwoot-versiones.md#6--paso-a-producción-y-smoke) y V2–V6 y V8 de la 4.20.0, con `4.20.1`. Además:
    - **N1:** una nota privada **enviada** en la conversación de prueba #4, desde el Studio › Bandeja (SSO);
    - **N2:** el webhook de la Oficina. Un mensaje en la bandeja de prueba del cable (webhook 4, bandeja 11) queda como fila en la bandeja del cable, se mide por conteo;
    - **N3:** correos. `zz_dtd_correo.rb` no escribe una línea al cargar, así que se mide por comportamiento: `docker compose exec -T rails bundle exec rails runner 'p ApplicationMailer < DtdCorreo::Asuntos, ApplicationMailer.view_paths.first.to_s'` da `true` y la carpeta de `correo/views`. Lo mismo en `sidekiq`. Además, la vista previa de [§2 ter del servidor](chatwoot-servidor.md#2-ter--correos-con-la-marca-de-dtd-cargo) sale con la marca de DTD.

    Un rojo en S1–S7 es vuelta atrás (a).
11. **Oficina al estado previo.** Si `ANTES=false`, `select public.office_cambiar_pausa(false, 'fin subida Chatwoot 4.20.1');`. Si `ANTES=true`, no se toca. Nunca se deja «despausada» por defecto.
12. **Cierre:** Uptime Kuma «Chatwoot · versión» a `4.20.1`, fila en el [Registro](chatwoot-versiones.md#registro) y aviso a la sesión del cable.

### 6 bis · Vuelta atrás

- **(a)** Rojo sin migraciones, que es lo esperado en este salto: `cp -p "$EV/compose.yml.antes" compose.yml`, comprobar `grep -c "$VIEJA" compose.yml` = 1 y recrear `rails` y `sidekiq` con `--no-deps --force-recreate`. Luego S1–S9 con `4.20.0`. Toma ~3–5 min.
- **(b)** Solo si algo dañó la base: la restauración de [§6 (b) de la 4.20.0](chatwoot-subida-4-20.md#6--vuelta-atrás), con la clave de Sam. Toma ~15 min.
- La Oficina vuelve igual a su **estado previo** (paso 11).

### Tiempos

| Tramo | Duración |
|---|---|
| Ventana total, con el smoke | **~45 min** |
| Corte visible | ~5–10 min |
| Si hay vuelta atrás (b) | +15 min |

## 7 · Decisiones para Sam

| # | Decisión | A (recomendada) | B |
|---|---|---|---|
| D1 | ¿Cómo se prueba antes? | **Ensayo local completo, sin copia en el VPS**: no hay migraciones que medir con datos reales | Ensayo local **más** copia aislada en el VPS (fase B): un OK más y ~1 h más |
| D2 | ¿Qué pasa con el smoke pendiente de la 4.20.0? | **Cerrarlo antes** de subir: así un rojo se le atribuye a la versión correcta | Hacerlo una sola vez, después de la 4.20.1 |
| D3 | ¿La Oficina durante el corte? | **En pausa** los ~10 min, con aviso a la sesión del cable | Andando; sus llamadas a Chatwoot fallan y se reintentan |
| D4 | ¿Cuándo? | **Esta semana**, en la ventana del runbook (lunes a jueves, de 21:00 a 23:00 de Caracas) | Esperar a la 4.21 y subir las dos juntas: más arreglos por salto, pero las fallas del runtime siguen abiertas mientras tanto |

### Lo que decidió Sam (2026-11-22)

- **D1: A.** Ensayo local completo, sin copia en el VPS. Sam: «Es importante hacer las pruebas».
- **D2: A.** El smoke pendiente de la 4.20.0 se cierra antes de subir.
- **D3: A.** La Oficina, en pausa durante el corte.
- **D4: hoy mismo.** Sam, textual: «hay que hacerlo de una, o sea, todo hoy. Nadie está usando Chatwoot porque todavía no está implementado, así que no nos afecta». Como no hay clientes en Chatwoot, no hace falta la ventana nocturna. Lo que **no** cambia: el ensayo en verde antes del cambio y el OK nominal de Sam, por el canal del Director, para la versión y la hora. **El 2026-11-22 es domingo**, fuera de la regla de lunes a jueves del runbook. Se sube igual con una condición: el Director confirma con Sam que **al día siguiente hay quien atienda**, como se hizo con la 4.20.0.

## Fuera de alcance detectado

- **El informe «sin IA» del panel da falsos positivos con `Gemfile.lock`.** Compara por nombre de archivo y no mira qué gemas cambiaron. Mejora posible: que cada pieza nombre sus gemas (`httparty`, `devise_token_auth`, `mail`) y que el informe solo marque `Gemfile.lock` si cambia una de esas. Va en su propia SDD.
- **El motor de IA del panel no está configurado** en el servidor (por eso «Sin IA»). Encenderlo es una decisión aparte de Sam.
