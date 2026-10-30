# Runbook · Chatwoot en el VPS del ERP · SDD-0583

**SDD:** [0583](../specs/0583-chatwoot-vps-e1/spec.md) (etapa E1 del programa [0582](../specs/0582-chatwoot-piloto/spec.md))
**Estado:** **en producción desde el 2026-10-29** en `https://chat.dtdcargo.com`:
- **P1** (despliegue): hecha.
- **P2** (DNS con proxy de Cloudflare y certificado): hecha.
- **P4** (Platform App y cuenta): hecha.
- **Marca de DTD** (§6 bis): aplicada.
- **P3** (acceso web a `/super_admin`): pospuesta. Hoy se administra por consola; Cloudflare Access está preparado en §4.1.

Registro al final.
**Relacionados:** [respaldo y restauración](chatwoot-respaldo-restauracion.md) · [vigilancia](chatwoot-vigilancia.md) · [servidor Contabo](servidor-contabo.md) · [revisión de datos personales](../legal/privacidad/revision-chatwoot-e1-2026-10-29.md)

## 1 · Qué se instala y dónde

Chatwoot CE `v4.19.1-ce` en el mismo VPS que la producción de DTD (decisión E0-D1), como proyecto de Compose aparte:

```
/srv/chatwoot/                 ← copia de infra/chatwoot/ (sin pruebas/)
├── compose.yml                ← prepare, rails, sidekiq, postgres (pgvector), redis
├── .env                       ← 0600; generado aquí (§2); NUNCA en git
├── rails/zz_dtd_redaccion_logs.rb · rails/zz_dtd_correo.rb
├── correo/views/              ← plantillas de correo de DTD (§2 ter)
├── respaldo.sh · restaurar.sh · vigilar.sh
└── data/                      ← postgres/, redis/, storage/ (adjuntos)
/srv/backups/chatwoot/         ← respaldos cifrados locales, 7 días
```

| Servicio | Límite CPU | Límite memoria | Red |
|---|---|---|---|
| rails (Puma, 5 hilos, sin workers) | 1,0 | 1,5 GiB | `chatwoot_edge` + `interna` |
| sidekiq (5 hilos) | 0,75 | 1,25 GiB | `interna` + `salida` |
| postgres 16 + pgvector 0.8.1 | 0,75 | 768 MiB | `interna` |
| redis 7.2.11 | 0,25 | 192 MiB | `interna` |
| prepare (solo al desplegar) | 1,0 | 1,5 GiB | `interna` |

Todos llevan `cpu_shares: 512` (DTD conserva el doble de peso con la CPU disputada) y `oom_score_adj: 500` (el kernel mata primero a Chatwoot si falta memoria). El porqué de cada número está en la spec (E1-D2) y el consumo medido en el [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md).

## 2 · Generar el `.env` (en el servidor, dentro de la puerta P1)

```bash
cd /srv/chatwoot
install -m 600 /dev/null .env && cp .env.example .env && chmod 600 .env
# Secretos aleatorios, sin que pasen por la pantalla ni el historial:
for v in CHATWOOT_SECRET_KEY_BASE:64 CHATWOOT_POSTGRES_PASSWORD:32 CHATWOOT_REDIS_PASSWORD:32; do
  n="${v%%:*}"; b="${v##*:}"; s="$(openssl rand -hex "$b")"
  sed -i "s|^$n=.*|$n=$s|" .env; unset s
done
# Claves de cifrado de columnas: las imprime la propia imagen; se pegan en el .env.
docker run --rm --entrypoint "" chatwoot/chatwoot:v4.19.1-ce bundle exec rails db:encryption:init 2>/dev/null \
  | awk '/primary_key:/ {print "CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=" $2}
         /deterministic_key:/ {print "CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=" $2}
         /key_derivation_salt:/ {print "CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=" $2}' >/dev/shm/cw-ar.env
while IFS='=' read -r n s; do sed -i "s|^$n=.*|$n=$s|" .env; done </dev/shm/cw-ar.env; rm -f /dev/shm/cw-ar.env
grep -c '<generar' .env      # tiene que dar 0
```

Después, a mano: `CHATWOOT_SMTP_USERNAME` y `CHATWOOT_SMTP_PASSWORD` (la casilla que Sam indique), y las URL Push de Uptime Kuma (§[vigilancia](chatwoot-vigilancia.md) 2). **El mismo día, Sam guarda una copia del `.env` en su gestor de contraseñas:** sin `SECRET_KEY_BASE` y las tres claves de cifrado, un respaldo no se puede leer entero (lo prueba el control R4 del ensayo).

Comprobar sin imprimir valores (regla de la casa: nombre y largo, nunca el valor):

```bash
awk -F= '/^CHATWOOT_/ { printf "%-45s %3d\n", $1, length($2) }' .env
docker compose config -q && echo config-ok
```

## 2 bis · Correo saliente (SMTP de Hostinger)

Chatwoot manda tres correos: restablecer la contraseña, invitar agentes y avisar de asignaciones. Sin SMTP no manda ninguno.

- **Buzón:** `notificaciones@dtdcargo.com`, creado el 2026-10-29 en hPanel → Emails → dtdcargo.com → Buzones (plan Premium Business Email, 2 de 2 en uso). `info@` no sirve: es un alias de `vzla@` y no puede iniciar sesión. La clave la creó Sam y vive en su gestor.
- **Respuestas al buzón:** tiene una respuesta automática de Hostinger (hPanel → Respuesta automática, creada el 2026-10-29 a pedido de Sam, sin fecha de fin). Remitente «DTD Cargo», asunto «Buzón solo de notificaciones». El texto dice que el buzón solo envía notificaciones y que la información se manda a `vzla@dtdcargo.com`. Hostinger manda una sola por remitente cada 24 h.
- **En el `.env`:** `CHATWOOT_MAILER_SENDER_EMAIL="DTD Cargo <notificaciones@dtdcargo.com>"` (el remitente es el mismo buzón que inicia sesión; si no, Hostinger lo rechaza). `smtp.hostinger.com`, 587, STARTTLS, `login`.
- **Pegar usuario y clave:** el guion [`pegar-smtp.sh`](../../infra/chatwoot/pegar-smtp.sh) se copia a `/root/pegar-smtp.sh` (0700) y Sam lo corre desde su PC con `ssh.exe -t root@217.216.54.70 'bash /root/pegar-smtp.sh'`, o con el lanzador `.ps1` que solo hace esa llamada.
  - El usuario trae `notificaciones@dtdcargo.com` por omisión: Enter lo acepta, así nadie pega nada visible.
  - La clave se pide dos veces y no se ve.
  - Solo escribe si las dos líneas están vacías.
  - Rechaza comillas simples y espacios.
  - Escribe la clave entre comillas simples, que compose lee literales (`$` y `#` no se tocan; comprobado con `docker compose config`).
  - Al final muestra solo los largos.
- **No pasar lógica entre comillas por PowerShell 5.1:** se come las comillas internas que recibe `ssh`. Por eso el `.ps1` solo llama al guion del servidor.
- **Aplicar:** primero copia `cp -p .env .env.antes-smtp` (0600), después `docker compose up -d --wait`, que recrea `rails` y `sidekiq` con las mismas labels de Traefik y sin certificado nuevo.
- **Probar:** desde `rails`, con un `ActionMailer::Base.mail(...).deliver_now` dirigido a `hailuway.com@gmail.com` (`</dev/null` dentro de guiones remotos).

## 2 ter · Correos con la marca de DTD Cargo

Pedido de Sam (2026-10-30): que los correos salgan «personalizados con DTD Cargo… con la firma y todo», no con el diseño del CRM.

- **En Hostinger no hay nada que configurar para esto.** El dominio ya tiene MX, SPF (`include:_spf.mail.hostinger.com`), las tres DKIM `hostingermail-a/b/c` y DMARC `p=none` (consultado en 1.1.1.1 el 2026-10-30). La firma del webmail de Hostinger solo se agrega a lo que se escribe en el webmail; Chatwoot manda por SMTP y no la usa.
- **Qué traía Chatwoot:** diseño propio (barra azul `#2781F6`, sin logo), pie «This email was sent by DTD Cargo» y textos y asuntos en inglés («Time to save the world…», «A new conversation [ID - 12] has been assigned to you»).
- **Qué cambia:**
  - [`correo/views/`](../../infra/chatwoot/correo/views): el diseño general (`layouts/mailer/base.liquid`) con logo, barra y botón vino, la firma (lema, dirección, teléfono, WhatsApp y web de `CONTACT` en `lib/design-tokens.ts`) y la nota «este buzón no lee respuestas, escríbenos a `vzla@dtdcargo.com`». Además, en español: contraseña, invitación y confirmación de correo (Devise); avisos de conversación nueva, asignada, mención y mensajes nuevos; canal de WhatsApp, Instagram, Facebook o correo desconectado; y el correo de prueba.
  - [`rails/zz_dtd_correo.rb`](../../infra/chatwoot/rails/zz_dtd_correo.rb): antepone esas vistas a las de la imagen y pone los asuntos en español con «· DTD Cargo». Lo que no está en la lista sale con el asunto de Chatwoot, pero igual con el diseño de DTD.
  - El compose monta los dos en solo lectura (`/app/dtd-correo/views` y `config/initializers`). Sin esas dos líneas vuelve todo lo de Chatwoot.
- **Estilo:** Sam eligió la estructura del diseño de Chatwoot (lo vio en una invitación): tarjeta redondeada, etiqueta en píldora, título grande, recuadro de datos y botón ancho. Se mantuvo esa estructura con los colores de DTD. Los avisos a agentes llevan el mismo recuadro (conversación y bandeja).
- **Logo para modo oscuro:** `marca/dtdcargo-isologo-correo.png` es el primary sobre una ficha blanca opaca, de 128×128, generado con [`correo/generar-logo.mjs`](../../infra/chatwoot/correo/generar-logo.mjs). Gmail y Outlook en modo oscuro oscurecen el fondo, pero no las imágenes: con el PNG transparente, el primary quedaría sobre oscuro, y `BRAND.md` lo prohíbe. Se sirve en `/dtd-marca/` porque la carpeta `marca/` ya está montada.
- **Avisos generados:** las plantillas liquid de agentes, canales y prueba salen de [`correo/generar-avisos.sh`](../../infra/chatwoot/correo/generar-avisos.sh), porque Liquid no tiene parciales en Chatwoot. Para cambiarlas, se edita el generador y se corre otra vez; no se editan a mano en `views/`.
- **Minimización** (`revisar-datos-ve`): los avisos a agentes ya no copian el nombre del contacto ni el texto de los mensajes, que Chatwoot sí ponía. Llevan el número de conversación, la bandeja y el botón para abrirla. El correo de los agentes queda fuera del chat (Gmail personal, teléfonos), por eso no se duplica ahí lo que dice el cliente.
- **Fuera:** el desbloqueo de cuenta (la instalación no tiene la ruta `unlock`: la plantilla original tampoco se puede armar), los avisos SLA (edición Enterprise), las respuestas a clientes de una bandeja de correo (usan otro diseño salvo con la función premium `branded_email_templates`) y los avisos de importación, exportación y borrado de cuenta (siguen en inglés, con el diseño de DTD).
- **Vista previa sin enviar nada** ([`correo/vista-previa.rb`](../../infra/chatwoot/correo/vista-previa.rb)): arma los 14 correos con datos inventados y objetos sin guardar, con entregas apagadas, y deja HTML y asuntos en `/tmp/dtd-correo/salida` del contenedor. Revisa diseño, «Chatwoot», restos en inglés, asunto con la marca y remitente. Antes de montar, toma las plantillas de `/tmp/dtd-correo`:
  ```bash
  # desde la PC: tar con dtd-correo/{views,zz_dtd_correo.rb,vista-previa.rb}
  ssh.exe root@217.216.54.70 "cd /srv/chatwoot && docker compose exec -T rails sh -c 'rm -rf /tmp/dtd-correo && tar xf - -C /tmp'" < paquete.tar
  ssh.exe root@217.216.54.70 "cd /srv/chatwoot && docker compose exec -T rails bundle exec rails runner /tmp/dtd-correo/vista-previa.rb </dev/null"
  ```
  Ya montado, se copia solo el guion (`docker compose cp correo/vista-previa.rb rails:/tmp/vista-previa.rb`) y toma las plantillas montadas.
- **Aplicar** (con OK de Sam; hecho, ver abajo): copiar `correo/`, `rails/zz_dtd_correo.rb`, `marca/dtdcargo-isologo-correo.png` y `compose.yml` a `/srv/chatwoot` (antes `cp -p compose.yml compose.yml.antes-correo`), `docker compose up -d --wait` (recrea `rails` y `sidekiq`, unos 3 min sin chat), correr la vista previa con las plantillas montadas y mandar un correo de prueba a `hailuway.com@gmail.com`.
- **Aplicado el 2026-10-30** (registro T-45 y T-46). El `compose.yml` del VPS ya traía el cambio de SDD-0584: no se reemplazó el archivo, se le agregaron las 4 líneas después del montaje de `marca/` y se comprobó con `diff` y `config -q`. Mientras las ramas no estén juntas, en el VPS se editan líneas; no se copia el `compose.yml` de una sola rama.
- **Vuelta atrás:** restaurar `compose.yml.antes-correo` y `docker compose up -d --wait`.
- **Al subir de versión (E3):** comparar las plantillas nuevas de la imagen con las de `correo/views` (mismos nombres) y volver a correr la vista previa: si Chatwoot cambia los parámetros de los enlaces, hay que copiarlos.

## 3 · Red y Traefik (puerta P1)

El Traefik compartido (`ops-traefik-traefik-1`) solo ve las redes edge a las que está conectado. Chatwoot usa la suya:

```bash
docker network create chatwoot_edge
docker network connect chatwoot_edge ops-traefik-traefik-1    # en caliente: Traefik NO se reinicia
```

Para que sobreviva a una recreación de Traefik, agregar `chatwoot_edge` (external) a `services.traefik.networks` y a `networks:` en `/srv/ops/traefik/compose.yml` (y en `infra/ops/traefik/compose.yml`, en la PR que lo despliegue). Recrear Traefik corta todos los sitios unos segundos: **no** se hace en el despliegue de Chatwoot.

Routers que declara `rails` (labels en `compose.yml`, prefijo = nombre del proyecto):

| Router | Regla | Middlewares | Access log |
|---|---|---|---|
| `chatwoot-chat` | `Host(chat.dtdcargo.com)` | `chatwoot-marco`, `security-headers@file` | apagado |
| `chatwoot-admin` (prioridad 1000) | mismo host y `/super_admin`, `/monitoring` o `/installation` | `tailscale-only@file`, `chatwoot-marco`, `security-headers@file` | apagado |

`chatwoot-marco` borra `X-Frame-Options` (Rails manda `SAMEORIGIN`) y fija `Content-Security-Policy: frame-ancestors 'self' <CHATWOOT_FRAME_ANCESTORS>`. Chatwoot 4.19.1 no manda CSP propia (`config/initializers/content_security_policy.rb` vacío), así que la de Traefik no pisa nada. El otro lado del iframe (la `frame-src` y `Permissions-Policy` de Studio) es de E2.

**TLS:** el resolver `letsencrypt` del Traefik compartido, con desafío HTTP-01. Funciona con o sin proxy de Cloudflare.

**Sin DNS, Traefik intenta igual.** Al aparecer el router, Traefik pidió el certificado y Let's Encrypt lo rechazó (2026-10-29 15:52Z: «Unable to obtain ACME certificate for domains»). Traefik no reintenta solo; tras crear el DNS (P2) se fuerza un intento nuevo recreando `rails` (`docker compose up -d --force-recreate rails`), que vuelve a publicar el router. No recrear `rails` antes del DNS: cada intento fallido cuenta para el límite de Let's Encrypt de 5 fallas por hora y por dominio. Mientras tanto, Traefik sirve su certificado por defecto; las pruebas van con `curl -k --resolve chat.dtdcargo.com:443:217.216.54.70`.

## 4 · DNS (puerta P2) y administración (puerta P3)

**DNS, en Cloudflare** (el DNS de `dtdcargo.com` está ahí, C-1 del registro E0): registro `A chat → 217.216.54.70`, creado el 2026-10-29 16:11Z sin proxy y pasado **a proxy (nube naranja) a las 16:49Z** (P2, «Sí, actívalo» / «Confirmo» de Sam). Certificado de Let's Encrypt emitido a las 16:52Z. Por qué con proxy:

- **El origen solo acepta 80/443 desde Cloudflare.** Desde el 2026-10-22, `/usr/local/sbin/cloudflare-origin-firewall` pone la cadena `CF-WEB-ORIGIN` en `DOCKER-USER` y descarta todo lo que no venga de los rangos de Cloudflare por `eth0`. Sin proxy, Let's Encrypt no llega («Timeout during connect», 16:28Z) y los navegadores tampoco. ufw muestra 80/443 abiertos, pero Docker no pasa por ufw.
- Con proxy, Cloudflare termina TLS y ve cada mensaje. Ya ve todo el tráfico de la web y de Supabase de DTD, con datos de clientes; Chatwoot le suma las conversaciones (revisión de datos E1, H9).
- Con proxy, Rails ve la IP de Cloudflare y Rack::Attack mete a todos en la misma bolsa, porque `TRUSTED_PROXY_CIDRS` del Traefik no incluye los rangos de Cloudflare. Con dos personas atendiendo no muerde; queda anotado.
- Abrir 80/443 a todos para que funcione sin proxy le quitaría la protección a todos los sitios del VPS: no se recomienda.
- Por Tailscale (otra interfaz, no `eth0`) la regla no aplica: `/super_admin` sigue funcionando como en el párrafo de abajo.

**`/super_admin` y `/monitoring`:** solo desde `100.64.0.0/10`. **El VPS no tiene Tailscale** (comprobado el 2026-10-29), así que hoy nadie entra por web, ni siquiera Sam. Mientras tanto, lo de super admin se hace por consola sobre SSH:

```bash
cd /srv/chatwoot
docker compose exec rails bundle exec rails runner 'p GlobalConfigService.account_signup_enabled?'   # false
docker compose exec rails bundle exec rails c      # consola, solo si hace falta
```

**Decisión del 2026-10-29 (Sam, «Cerrado y consola»):** se queda así, sin acceso web, hasta que haga falta; entonces, preferiblemente con Cloudflare Access (con la verificación de `Cf-Access-Jwt-Assertion` en el origen, porque el firewall acepta cualquier IP de Cloudflare, también las de otras cuentas). La alternativa con Tailscale, para referencia: con Tailscale instalado (runbook servidor-contabo §1.5), Sam entra a `https://chat.dtdcargo.com/super_admin` desde su equipo resolviendo `chat.dtdcargo.com` a la IP de Tailscale del VPS (línea en su `hosts`, o DNS dividido de la tailnet). El certificado es el mismo, y Traefik ve la IP `100.x` y deja pasar. Que la regla deja pasar a la tailnet y frena a internet lo prueba el ensayo local (C4). Que la IP de origen llegue sin NAT por la interfaz de Tailscale está **NO VERIFICADO**: se comprueba al instalarla.

### 4.1 · `/super_admin` con Cloudflare Access (P3 sin Tailscale)

**Activo desde el 2026-10-29 (~19:15Z).** Sam dijo «ok avanza cludefare» en la sesión del programa y confirmó aquí con «Confirmo Access». En Zero Trust (equipo `dawn-mud-1d9d`, plan Free, ya activo):
- app self-hosted «Chatwoot · super admin», con destino `chat.dtdcargo.com/super_admin` y sesión de 6 h (no hay opción de 8 h);
- política «chatwoot-super-admin-sam»: Allow, Include Emails = `hailuway.com@gmail.com`;
- AUD `1593e415…d4d0` (no es secreta).

En el VPS, el `.env` (copia en `.env.antes-access`) lleva `CHATWOOT_CF_ACCESS_*`, `CHATWOOT_ADMIN_ALLOWLIST_MIDDLEWARE=chatwoot-cf-access@docker` y `COMPOSE_PROFILES=cf-access`. El super admin de Chatwoot es `hailuway.com@gmail.com`, id 2, creado con `/root/crear-super-admin.sh`; la contraseña la escribió Sam sin eco y la guarda en su gestor.

No se tocó la otra app de Access que ya existía. Probado en local antes (`cf-access/verificador.node-test.mjs` y la fase D de `pruebas/ensayo-local.sh`) y en el VPS después: registro T-30 a T-32.

**Cómo entra Sam (dos puertas, a propósito):**
1. Abre `https://chat.dtdcargo.com/super_admin`.
2. Cloudflare pide su correo y le manda un código. Esa sesión dura 6 h: mientras no venza, no vuelve a pedirla.
3. Aparece el login propio de super admin de Chatwoot: el mismo correo y la contraseña del super admin.

La primera puerta decide quién puede siquiera ver la pantalla; la segunda, quién es super admin. El trabajo diario (`/app`, y la bandeja dentro de Studio en E2) no pasa por Cloudflare Access.

**Cómo funciona.** Cloudflare Access pide el login (código por correo o Google) antes de dejar pasar `chat.dtdcargo.com/super_admin*`, y agrega a cada petición la cabecera `Cf-Access-Jwt-Assertion`, firmada por el *team domain*. En el VPS, Traefik pregunta por cada pedido a `/super_admin`, `/monitoring` e `/installation` al servicio `acceso` (forwardAuth). Ese servicio verifica:
- la firma RS256 con las claves públicas de `<team>/cdn-cgi/access/certs`;
- la AUD de la app y el `iss`;
- que el token no esté vencido;
- y que el correo esté en la lista.

Si algo falla o el verificador no responde, Traefik **no** abre. Hace falta verificar en el origen porque el firewall del VPS deja pasar cualquier IP de Cloudflare, también las de otras cuentas: sin esa comprobación, alguien con su propia cuenta de Cloudflare podría apuntar a la IP del VPS y saltarse Access. `/monitoring` e `/installation` no están en la app de Access y siguen cerradas (sin token → 403).

**Qué cambia en la cuenta de Cloudflare de Sam (Zero Trust):**
1. Activar Zero Trust y elegir el nombre del equipo (`<equipo>.cloudflareaccess.com`), plan Free. **NO VERIFICADO:** si pide tarjeta para el plan gratis.
2. Método de login: «One-time PIN» (código por correo), que ya viene activo; Google, opcional.
3. Access → Applications → Add → **Self-hosted**: nombre «Chatwoot · super admin», dominio `chat.dtdcargo.com`, ruta `super_admin`, sesión de 8 h.
4. Política «Allow»: Include → Emails → el correo de Sam. Nada más.
5. Copiar la «Application Audience (AUD) Tag».

No cambia ningún registro DNS, el modo SSL de la zona ni otra app.

**Qué cambia en el VPS** (sin tocar DTD ni el compose de Traefik):
1. Copiar a `/srv/chatwoot` el `compose.yml` nuevo y `cf-access/verificador.mjs`.
2. Agregar al `.env`: `CHATWOOT_CF_ACCESS_TEAM_DOMAIN`, `CHATWOOT_CF_ACCESS_AUD`, `CHATWOOT_CF_ACCESS_EMAILS` (el correo de Sam), `CHATWOOT_ADMIN_ALLOWLIST_MIDDLEWARE=chatwoot-cf-access@docker` y `COMPOSE_PROFILES=cf-access`.
3. `docker compose up -d --wait`: arranca `acceso` (Node 24 en solo lectura, sin capacidades, 96 MB) y recrea `rails` por los labels nuevos (unos 40 s sin Chatwoot; Traefik no se reinicia).
4. Crear el super admin de Chatwoot por consola con el correo de Sam; la contraseña la pega Sam en una ventana oculta. Hoy no existe ninguno.

**Comprobaciones:**
- Desde afuera sin sesión: `/super_admin/sign_in` lleva al login de Cloudflare.
- Con la sesión de Sam: se ve el login de Chatwoot.
- Desde el VPS, saltándose Cloudflare: `curl -k --resolve chat.dtdcargo.com:443:127.0.0.1 https://chat.dtdcargo.com/super_admin/sign_in` da 403, sin cabecera y con un token inventado.
- `/monitoring/sidekiq` da 403.
- `docker compose logs acceso` muestra solo «permitido» o «denegado: <razón>».

**Vuelta atrás:** quitar `CHATWOOT_ADMIN_ALLOWLIST_MIDDLEWARE` y `COMPOSE_PROFILES` del `.env` y correr `docker compose up -d --remove-orphans`. Todo vuelve a cerrado (`tailscale-only@file`). En Cloudflare se borra la app.

## 5 · Desplegar (puerta P1)

```bash
# Desde el equipo de Sam: copiar la carpeta, sin pruebas/
scp -r infra/chatwoot/{compose.yml,.env.example,.gitignore,README.md,respaldo.sh,restaurar.sh,vigilar.sh,rails,systemd} root@217.216.54.70:/srv/chatwoot/
# En el VPS:
cd /srv/chatwoot && chmod 700 respaldo.sh restaurar.sh vigilar.sh
mkdir -p data/postgres data/redis data/storage /srv/backups/chatwoot
# (§2: .env) y (§3: red y Traefik)
docker compose pull
docker compose up -d --wait                       # prepare crea la base y migra; después rails y sidekiq
# EN SEGUIDA, antes del DNS: cerrar el onboarding. Una instalación nueva manda todo a
# /installation/onboarding, donde el PRIMER visitante crea el super admin
# (onboarding_controller.rb). Traefik ya bloquea /installation desde internet; esto
# lo cierra también en Rails.
docker compose exec -T rails bundle exec rails runner \
  'Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING); print "onboarding=", Redis::Alfred.get(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING).inspect'
curl -s https://chat.dtdcargo.com/api             # {"version":"4.19.1",…,"queue_services":"ok","data_services":"ok"}
```

El super admin de la instancia (para `/super_admin`) se crea por consola cuando haga falta y con Tailscale arriba (`SuperAdmin.create!` en `rails c`); para E1 no hace falta: la Platform App (§6) no lo necesita.

Comprobaciones posteriores (cada una con su resultado en el handoff):

1. `GET /api` da `4.19.1` y los dos servicios `ok`.
2. Registro cerrado: el `rails runner` de §4 imprime `false`, y `POST /api/v1/accounts` no crea cuenta.
3. `curl -sI https://chat.dtdcargo.com/app/login` sin `X-Frame-Options` y con `frame-ancestors 'self' https://dtdcargo.com`.
4. `curl -s -o /dev/null -w '%{http_code}' https://chat.dtdcargo.com/super_admin/sign_in` → `403`; lo mismo con `/monitoring/sidekiq` y `/installation/onboarding`; `/app/login` → `200`.
5. Logs: `docker compose logs rails sidekiq | grep -c 'redacción de logs activa'` ≥ 2.
6. La web de DTD sigue igual: `infra/ops/web/smoke-web.sh` y el monitor de Uptime Kuma de DTD en verde.

**Vuelta atrás:** `docker compose down` (los datos quedan en `data/`), `docker network disconnect chatwoot_edge ops-traefik-traefik-1` y, si hace falta, borrar el registro DNS. Nada de esto toca a DTD.

## 6 · Platform App, cuenta y usuario de servicio (paso 1.4, puerta P4)

Después del despliegue. La Platform API crea cuentas y usuarios sin abrir el registro. El token sale una sola vez y va al gestor de contraseñas de Sam y a los secretos de Studio (E2); nunca a git ni al chat.

```bash
cd /srv/chatwoot
# 1. La Platform App y su token (en /dev/shm, 0600).
# (rails runner también escribe líneas de log en stdout: el token va marcado y se extrae)
docker compose exec -T rails bundle exec rails runner \
  'app = PlatformApp.create!(name: "DTD Studio"); print "TOKEN:" + app.access_token.token' 2>/dev/null \
  | grep -o 'TOKEN:[A-Za-z0-9_-]*' | cut -d: -f2 | tr -d '\n' >/dev/shm/cw-platform-token
chmod 600 /dev/shm/cw-platform-token; wc -c /dev/shm/cw-platform-token     # 24 caracteres en 4.19.1
# 2. La cuenta de DTD por API.
T="$(cat /dev/shm/cw-platform-token)"
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/accounts -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"name":"DTD Cargo","locale":"es"}'
# 3. Usuario de servicio (sin persona detrás) y su rol en la cuenta.
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/users -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"name":"Servicio DTD Studio","email":"servicio-chatwoot@dtdcargo.com","password":"<generar>"}'
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/accounts/<id>/account_users -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"user_id":<id>,"role":"administrator"}'
unset T; shred -u /dev/shm/cw-platform-token
```

Los usuarios de personas (Sam y la persona que atiende, E0-D2) los da de alta Studio en E2.7, no a mano aquí.

## 6 bis · Marca de DTD Cargo (paso 1.3, «Autorizo la marca» de Sam, 2026-10-29)

Pedido de Sam: «Poner un icono al lado del dominio que aparezca el logo de DTD… que ponga usuario y contraseña, y que no salga Chatwoot».

- **Imágenes.** En `infra/chatwoot/marca/` están las copias sin tocar de `public/brand/`, con la misma huella sha256: `dtdcargo-isologo-primary.png` (`7238dbbb…`, fondo claro), `dtdcargo-isologo-reverse.png` (`e530b4cb…`, fondo oscuro; `BRAND.md`: el primary nunca va sobre navy) y `apple-touch-icon.png` (`a8c3c30e…`, 180×180, ícono de la pestaña). El compose las monta en solo lectura en `/app/public/dtd-marca`, una carpeta aparte para no tapar `brand-assets` de Chatwoot. Las sirve el propio chat.
- **Valores** (`aplicar-marca.rb`, en `InstallationConfig`):
  - `INSTALLATION_NAME` y `BRAND_NAME` = «DTD Cargo»;
  - `BRAND_URL` y `WIDGET_BRAND_URL` = `https://dtdcargo.com`;
  - `TERMS_URL` = `/terminos` y `PRIVACY_URL` = `/privacidad`, las dos en dtdcargo.com;
  - `DISPLAY_MANIFEST` = false: quita los favicons y el manifest de Chatwoot;
  - `LOGO_THUMBNAIL`, `LOGO` y `LOGO_DARK` apuntan a `/dtd-marca/…`.

  El idioma ya era `es` (`CHATWOOT_DEFAULT_LOCALE`). `ConfigLoader` corre en cada `prepare` con `reconcile_only_new: true`, así que no vuelve a poner los valores de Chatwoot.
- **Aplicar o volver a aplicar:**
  ```bash
  cd /srv/chatwoot
  docker compose cp aplicar-marca.rb rails:/tmp/marca.rb
  docker compose exec -T rails bundle exec rails runner /tmp/marca.rb
  ```
- **Comprobado desde afuera** (navegador, 2026-10-29):
  - el título es «DTD Cargo» y el único ícono es `/dtd-marca/apple-touch-icon.png`;
  - la pantalla dice «Iniciar sesión en DTD Cargo», «E-mail», «Contraseña» y «¿Olvidaste tu contraseña?»;
  - «Chatwoot» aparece 0 veces en el texto visible;
  - en modo claro se ve el primary y en oscuro solo el reverse.

  Capturas sin datos personales: [claro](assets/chatwoot-marca-entrada-claro.jpg) y [oscuro](assets/chatwoot-marca-entrada-oscuro.jpg).
- **Lo que no cambia en la edición CE:** el «Powered by Chatwoot» del widget y de los correos (`disable_branding` es premium). La etiqueta del campo dice «E-mail», que es la traducción al español de Chatwoot; cambiarla a «Correo electrónico» exigiría tocar las traducciones de la imagen, y no se hace.
- **Vuelta atrás:** volver a poner los valores anteriores (están en la salida de `aplicar-marca.rb`) y restaurar `compose.yml.antes-marca`.

## 7 · Operación diaria

| Qué | Cómo |
|---|---|
| Estado | `docker compose ps` · `curl -s https://chat.dtdcargo.com/api` |
| Logs | `docker compose logs --since 1h rails sidekiq` (redactados; 10 MB × 5 por contenedor) |
| Consumo | `docker stats --no-stream $(docker compose ps -q)` |
| Reiniciar un servicio | `docker compose restart sidekiq` (no toca a DTD) |
| Subir de versión | **No** con `pull` suelto: es la etapa E3 (runbook de versiones, respaldo antes, ensayo de redacción después) |
| Respaldo | [chatwoot-respaldo-restauracion.md](chatwoot-respaldo-restauracion.md) |
| Vigilancia | [chatwoot-vigilancia.md](chatwoot-vigilancia.md) |

## Registro

| Fecha | Qué | Quién | Evidencia |
|---|---|---|---|
| 2026-10-29 | Configuración escrita y probada en local (`pruebas/ensayo-local.sh`). Nada en el VPS | Worker SDD-0583 | [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md) |
| 2026-10-29 17:0xZ | **P4** («Autorizo P4», Sam): Platform App «DTD Studio», cuenta «DTD Cargo» (id 1) y usuario de servicio administrador; secretos en `/srv/chatwoot/secretos/platform-app.env` (0600) | Worker SDD-0583 | registro T-23 y T-24 |
| 2026-10-29 15:38–16:00Z | **P1** («Autorizo P1», Sam): `/srv/chatwoot` copiado (sha256 igual al repo), `.env` 0600 generado en el servidor, red `chatwoot_edge` y Traefik conectado en caliente (sin reinicio), `up` en 289 s, `rails` unhealthy por `FORCE_SSL` → healthcheck con `X-Forwarded-Proto: https` y `up` de nuevo, onboarding cerrado, comprobaciones 1–6 en verde, primer respaldo a B2, timers y monitores Push #6 y #7. DTD sin cambios | Worker SDD-0583 | registro, filas T-2 a T-12 |
