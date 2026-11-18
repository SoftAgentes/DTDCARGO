# SDD-0583: líneas de los canales en los logs de Chatwoot (handoff)

Rama `codex/0587-logs-chatwoot-instagram`, worktree `DTD-worktrees/0587-logs-chatwoot-instagram`. Encargo del Director General, 2026-11-05. La rama lleva el número de donde se detectó (SDD-0587); el filtro es de SDD-0583, paso 1.7. Todo lo medido es sobre la imagen `chatwoot/chatwoot:v4.19.1-ce`, digest `sha256:04895c7bd055…`: la que corre en el VPS y la de la prueba local.

## Autorización

Sam, en el chat del Director General; lo registra el Subdirector:

- A «¿Arreglamos ya que el registro de Chatwoot guarde esos mensajes?»: **«Sí, arréglalo ya»**.
- Lo que vio antes de contestar: cambio pequeño en el filtro, con PR propia; instalarlo en el VPS y reiniciar Chatwoot unos segundos; lo ya escrito no se borra solo, y si quiere borrarlo antes se le prepara el comando y lo corre Sam.
- Según el Director General, cubre PR, fusión e instalación de ese filtro con su reinicio. No cubre borrar líneas viejas, ni el cron o la alarma del token.
- **La instalación la corre el Director General**, después de fusionar.

## Qué se tapa

Las dos primeras son el encargo. El resto apareció al buscar la misma clase: remitente o texto en los canales que se usan.

| Línea en la imagen | Nivel | Qué escribía | Queda |
|---|---|---|---|
| `app/jobs/webhooks/instagram_events_job.rb:53` | info | cada entrante de Instagram entero: remitente, destinatario y texto | `Instagram Events Job Messaging: [REDACTADO]` |
| `app/services/instagram/base_send_service.rb:65` | error | destinatario y texto de un envío fallido | `Instagram response: <código> - <error de Meta> : [REDACTADO]` |
| **`Parameters:` de cada webhook de Instagram y WhatsApp** (log de Rails, sin Lograge) | info | `sender`, `wa_id`, `recipient_id` en cada pedido; `message` ya salía filtrado | `"entry" => "[FILTERED]"` |
| `app/services/instagram/test_event_service.rb:7` | info | el evento de prueba de Meta entero | `Processing Instagram test webhook event, [REDACTADO]` |
| `app/services/instagram/message_text.rb:67` y la excepción de `:70` | warn y error | el código de la persona (`ig_scope_id`) | el resto de la línea |
| `config/initializers/facebook_messenger.rb:55` y `:60` | info | los acuses de Messenger, con el remitente | `Recieved … status [REDACTADO]` |
| `app/services/whatsapp/incoming_message_service_helpers.rb:80` | warn | el remitente de un evento con error | el título del error |
| `app/services/whatsapp/oneoff_campaign_service.rb:55`, `:64`, `:86`, `:90`, `:114` | info y error | nombre y teléfono en campañas | el motivo |
| `app/services/whatsapp/user_id_rotation_service.rb:136` y `:185` | warn | teléfono o BSUID al rotar la identidad | los ids de contacto |
| `app/builders/contact_inbox_builder.rb:70` | info | teléfono o código de la persona en una carrera, en cualquier canal | los ids de contacto y bandeja |

El filtro anterior solo tapaba teléfonos con `+` o que empiezan por 58 u 86. Por eso un `wa_id` de otro país salía entero.

## Qué se revisó y se dejó igual

Búsqueda en la imagen de `logger.(info|debug|warn|error|fatal)`, en una y en varias líneas, en `app/jobs/webhooks`, `app/jobs/inboxes`, `app/services/{instagram,whatsapp,facebook,imap}`, `app/builders/messages`, `app/mailboxes`, `lib/integrations/facebook` y `config/initializers`, y por palabra clave (`params`, `body`, `content`, `payload`, `contact`, `phone`, `email`, `sender`, `from`…) en el resto de `app`, `lib` y `enterprise/app`.

- **Respuestas de error de Meta, sin datos del cliente hasta donde se puede leer en el código:** `whatsapp/providers/base_service.rb:45`, `facebook/send_on_facebook_service.rb:30` y `:41`, `instagram/user_details_service.rb:24` y `:31`, `instagram/refresh_oauth_token_service.rb:61`, `concerns/instagram_concern.rb:52` y `:60`, `instagram/messenger/message_text.rb:32`, `:41`, `:42` y `:47`. Lo que Meta devuelve en cada caso real es **NO VERIFICABLE** desde aquí. Se quedan porque son el único diagnóstico de un envío fallido.
- **El número propio, no el del cliente:** `webhooks/whatsapp_events_job.rb:12`, `webhooks/whatsapp_controller.rb:8`, `whatsapp/embedded_signup_service.rb:77` y `:80`.
- **Correos:** `imap/base_fetch_email_service.rb`, `imap/imap_mailbox.rb:15`, `application_mailbox.rb:36`, `conversation_reply_mailer.rb:53`, `notification/push_notification_service.rb:70` y `:122`. Los tapa el patrón general de correos, que no cambia. No se volvieron a medir aquí.
- **Canales que no se usan:** Telegram, Line, Twilio, Twitter, SMS, TikTok.
- **Sentry:** apagado en el VPS (`SENTRY_DSN` vacío, medido sin imprimir el valor), así que `ChatwootExceptionTracker` solo escribe al log.

**Límite:** la prueba cubre las líneas que conoce. Una línea nueva de una versión futura no la ve; por eso §4 del [runbook de versiones](../../docs/runbooks/chatwoot-versiones.md) pide revisar la lista contra la versión.

## Evidencia

`bash infra/chatwoot/pruebas/prueba-redaccion-canales.sh`, local, 2026-11-05 de 14:02 a 14:04Z, sobre la imagen real, con valores inventados: **0 fallas, 44 PASÓ**.

| Comprobación | Resultado |
|---|---|
| T0: valores inventados en la salida, con el inicializador | PASÓ, 0 de 24 |
| T1: cada línea queda como dice la tabla de arriba | PASÓ, 16 de 16 |
| T1w: `Parameters:` de los dos webhooks de Meta, con `entry` tapado | PASÓ, respuestas 401 sin firma: la línea sale antes de revisar la firma |
| T2: el resto del log sigue igual | PASÓ, 4 de 4 |
| R1: la sonda de la receta | PASÓ: 0, 1, 1 y 1 |
| C1: control sin el inicializador | PASÓ: aparecen los 24 valores |
| M0: con el filtro entero, sobre 65 líneas del control | PASÓ: 0 valores |
| 17 mutantes, un patrón menos a la vez | PASÓ: cada valor reaparece |
| `pnpm verify` | NO EJECUTADO: el cambio es de infra y documentos, y el CI de la PR es el que cuenta |

- **Sin `entry` en `filter_parameters`, la misma prueba salió roja** a las 13:33Z: T0 encontró `sender`, `wa_id` y `recipient_id` inventados. Esa corrida es la que convierte la fuga de `Parameters:` en medición.
- **Los mutantes** corren sin arrancar Rails, sobre las líneas que escribió la imagen en el control. Su primera versión daba M6 y M6b verdes por otra razón: las líneas `with arguments:` de ActiveJob ya traían esos valores. M0 lo detectó y esas líneas salieron de la base.
- **Logs reales de hoy, solo conteo por nombre de línea, sin leer contenido** (`chatwoot-rails-1`, desde las 00:00Z del 2026-11-05, encargo del Director General): líneas `Parameters:` con `sender` 3, con `wa_id` 0, con `recipient_id` 0; webhooks de Instagram 3, de WhatsApp 0.
- **Sin probar:** el reinicio y la sonda en el VPS, que corren con la receta; un entrante real con el filtro, que mide el paso 6.

## Receta de instalación

La corre el Director General, después de fusionar, con su `SHA` de `main`.

**Lo que hay hoy en vivo, medido el 2026-11-05 a las 13:30Z:**

- `rails/zz_dtd_redaccion_logs.rb` con huella `10c24f5c2c5de738`, igual a `main`.
- `rails` monta también `zz_dtd_correo.rb`, `zz_dtd_proteccion_register.rb`, `zz_dtd_revocar_sesiones.rb`, `correo/views` y `marca`. `sidekiq` monta lo mismo **menos** `zz_dtd_revocar_sesiones.rb`.
- `compose.yml` del VPS (`6722ce94fde5948a`) **no es** el de `main` (`d62e648b9c8dcee2`).
- `sidekiq` corre desde el 2026-10-30 y `rails` desde el 2026-11-04, y el `.env` cambió el 2026-11-04.

**Por eso:** se cambia un solo archivo y se usa `docker restart`. **Nunca `docker compose up`, `down` ni `--force-recreate`, y no se copia `compose.yml` ni el resto de `infra/chatwoot`.** Recrear cambiaría montajes y entorno, y además **borraría el log actual**, que es lo que Sam no autorizó.

**Cuánto dura:** no son segundos. En su último arranque, `rails` tardó 41 s en cargar los inicializadores y `sidekiq` 53 s, y Traefik no enruta a `rails` hasta que pasa el healthcheck, que corre cada 30 s (inferencia a partir de `compose.yml`). Cuenta con **1 a 2 minutos sin panel ni webhooks**. Meta reintenta las entregas fallidas, según su documentación; no se midió aquí. Evitar las 06:30Z, por el respaldo. `vigilar.sh` corre cada 5 minutos y puede avisar si coincide.

**1 · Llevar el archivo, desde la PC.**

```bash
MSYS_NO_PATHCONV=1 git show "$SHA:infra/chatwoot/rails/zz_dtd_redaccion_logs.rb" | "/c/Windows/System32/OpenSSH/ssh.exe" root@217.216.54.70 'cat > /dev/shm/zz_dtd_redaccion_logs.nuevo'
```

**2 · Comprobar antes de tocar, en el VPS.**

```bash
cd /srv/chatwoot
sha256sum rails/zz_dtd_redaccion_logs.rb | cut -c1-16              # 10c24f5c2c5de738; si es otro, parar
sha256sum /dev/shm/zz_dtd_redaccion_logs.nuevo | cut -c1-16        # caf1430ddfba9368
docker exec -i chatwoot-rails-1 ruby -c </dev/shm/zz_dtd_redaccion_logs.nuevo   # Syntax OK
for s in rails sidekiq; do docker inspect -f '{{.Id}}' chatwoot-$s-1; done >/dev/shm/ids-antes.txt
```

**3 · Instalar y reiniciar.**

```bash
cp -p rails/zz_dtd_redaccion_logs.rb rails/zz_dtd_redaccion_logs.rb.antes-0583-logs
install -m 644 -o root -g root /dev/shm/zz_dtd_redaccion_logs.nuevo rails/zz_dtd_redaccion_logs.rb
T="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "$T"
docker restart -t 30 chatwoot-sidekiq-1
for i in $(seq 1 40); do [ "$(docker inspect -f '{{.State.Health.Status}}' chatwoot-sidekiq-1)" = healthy ] && break; sleep 5; done
docker restart -t 30 chatwoot-rails-1
for i in $(seq 1 40); do [ "$(docker inspect -f '{{.State.Health.Status}}' chatwoot-rails-1)" = healthy ] && break; sleep 5; done
for s in rails sidekiq; do docker inspect -f '{{.State.Health.Status}}' chatwoot-$s-1; done   # healthy y healthy
```

`-t 30` porque Sidekiq espera hasta 25 s a sus trabajos antes de devolverlos a la cola.

**4 · Comprobar que cargó, sin abrir ninguna línea.** `--since "$T"` no lee lo anterior y `grep -c` solo cuenta.

```bash
for s in rails sidekiq; do docker inspect -f '{{.Id}}' chatwoot-$s-1; done | cmp - /dev/shm/ids-antes.txt && echo mismos-contenedores
for s in rails sidekiq; do docker exec chatwoot-$s-1 sha256sum /app/config/initializers/zz_dtd_redaccion_logs.rb | cut -c1-16; done   # caf1430ddfba9368 dos veces
for s in rails sidekiq; do docker logs chatwoot-$s-1 --since "$T" 2>&1 | grep -c 'redacción de logs activa'; done   # 1 y 1
for s in rails sidekiq; do docker logs chatwoot-$s-1 --since "$T" 2>&1 | grep -c 'protección de /register activa'; done   # 1 y 1
docker logs chatwoot-rails-1 --since "$T" 2>&1 | grep -c 'revocación de sesiones activa'   # 1; sidekiq no lo monta hoy
for s in rails sidekiq; do docker exec chatwoot-$s-1 test -d /app/dtd-correo/views && echo correos-montados; done
curl -s https://chat.dtdcargo.com/api | cut -c1-200   # 4.19.1, queue_services y data_services en ok
```

**5 · Línea sintética.** Es el `rails runner` de S5b del [runbook de versiones](../../docs/runbooks/chatwoot-versiones.md). Corre en un proceso aparte, y su log no entra a `docker logs`.

```bash
docker exec chatwoot-rails-1 bundle exec rails runner 'Rails.logger.info(%q(Instagram Events Job Messaging: {"text" => "SONDA-CANALES"})); Rails.logger.error(%q(Instagram response: 100 - sonda : {"text" => "SONDA-CANALES"})); p ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters).filter("entry" => [{"sender" => {"id" => "SONDA-CANALES"}}])' </dev/null >/dev/shm/sonda-canales.txt 2>&1
grep -c 'SONDA-CANALES' /dev/shm/sonda-canales.txt                                       # 0
grep -c 'Instagram Events Job Messaging: \[REDACTADO\]' /dev/shm/sonda-canales.txt       # 1
grep -c 'Instagram response: 100 - sonda : \[REDACTADO\]' /dev/shm/sonda-canales.txt     # 1
grep -c '"entry" => "\[FILTERED\]"' /dev/shm/sonda-canales.txt                           # 1
shred -u /dev/shm/sonda-canales.txt /dev/shm/zz_dtd_redaccion_logs.nuevo; rm -f /dev/shm/ids-antes.txt
```

**6 · Con el primer entrante real, solo contar.**

```bash
docker logs chatwoot-sidekiq-1 --since "$T" 2>&1 | grep -c 'Instagram Events Job Messaging: {'              # 0, siempre
docker logs chatwoot-sidekiq-1 --since "$T" 2>&1 | grep -c 'Instagram Events Job Messaging: \[REDACTADO\]'  # sube con cada entrante
docker logs chatwoot-rails-1 --since "$T" 2>&1 | grep -c '"entry" => \['                                     # 0, siempre
docker logs chatwoot-rails-1 --since "$T" 2>&1 | grep -c '"entry" => "\[FILTERED\]"'                         # sube con cada webhook
```

**Volver atrás.** Vuelve la fuga, así que es solo si Chatwoot no arranca o se rompe algo.

```bash
cd /srv/chatwoot
install -m 644 -o root -g root rails/zz_dtd_redaccion_logs.rb.antes-0583-logs rails/zz_dtd_redaccion_logs.rb
sha256sum rails/zz_dtd_redaccion_logs.rb | cut -c1-16   # 10c24f5c2c5de738
docker restart -t 30 chatwoot-sidekiq-1
docker restart -t 30 chatwoot-rails-1
```

## Lo ya escrito

No se abrió ninguna línea vieja. Por tamaño de archivo, medido el 2026-11-05 (inferencia, no se midió la rotación):

- `chatwoot-sidekiq-1`: 47,9 MB de un tope de 50 MB (10 MB × 5), en 6 días. Las líneas de Instagram salen solas en unos 6 días después de instalar.
- `chatwoot-rails-1`: 4,1 MB desde que se recreó el 2026-11-04 a las 08:29Z, así que sus líneas `Parameters:` empiezan ahí. Saldrían solas en unas 2 semanas. Llevan `sender`, `wa_id` y `recipient_id`, sin texto, porque `message` ya estaba filtrado.

Borrarlas antes lo decide y lo corre Sam. No está preparado aquí.

## Impacto documental

- En esta rama: spec de SDD-0583 (allowlist y seguimiento), H1 bis de la revisión de E1, y §4 y S5b del runbook de versiones.
- El registro de la instalación va en el seguimiento de esta spec, cuando la corra el Director General.
- Graphify y Obsidian: los revisa el Director General al cierre.

## Pendiente de esta tarea

- ~~CI y fusión de la PR, e instalación, por el Director General.~~ **Hecho el 2026-11-05:** #375 fusionada a las 16:08:16Z (`49bdba2e5`). Instalación de 16:09Z a 16:12Z, código 0, mismos contenedores, huella `caf1430ddfba9368`, sonda 0, 1, 1 y 1. Sidekiq tardó 1 min 55 s y Rails 56 s. Evidencia en `/srv/ops/evidencias/filtro-chatwoot-20261105T160907Z`, según el Director General. Registrado en el seguimiento de la spec.
- **El conteo del paso 6 con el primer entrante real, todavía sin hacer.** `T` es la hora de la instalación, 2026-11-05T16:12Z. Se mide con los cuatro `grep -c` de la receta: solo conteos, sin abrir líneas.

## FUERA DE ALCANCE DETECTADO

- **Borrar las líneas viejas:** lo decide Sam; ver «Lo ya escrito».
- **Nivel de log:** `LOG_LEVEL=info` y Lograge apagado siguen igual. Pasar Rails a `warn` quitaría esta clase entera de líneas, a cambio de menos diagnóstico. Es una decisión aparte.
- **Retención dentro de Chatwoot:** sigue sin definir (SDD-0587, §14.3, punto 8).
- **`docs/runbooks/chatwoot-versiones.md`, S6:** pide `≥ 2` para la revocación, y hoy `sidekiq` no monta ese inicializador, así que en vivo da 1. El `compose.yml` de `main` sí lo monta en los dos.
