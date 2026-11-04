# Guion de publicación de la tanda A de Chatwoot

Lo preparó el Subdirector el 2026-11-04. Vale para `M` = `fe35eb2d1db84e83ec974a9b15fb2b833a8b7ea9`.

**Ejecutado el mismo día.** `M` quedó publicada a las 12:41:54Z, y sus pasos 6 y 7 dieron 0 fallas. Del paso 8, W1 a W3 pasaron y W4 pasó según Sam; W5 y W6 siguen pendientes. El resultado está al final de la SDD-0587. Lo de abajo es el plan tal como se escribió antes de la ventana, salvo donde dice otra cosa.

- **Quién hace qué:** DG es el Director General, Sub es el Subdirector y Sam es Sam.
- **Producción ya tenía, antes de la ventana:** las 6 migraciones, las 6 variables sin secreto, y `rails` de Chatwoot recreado con la regla de «olvidé mi clave» y el inicializador de revocación.
- **La web publicada** seguía en `dac99762e`, y no usaba nada de eso.

## Decisiones de Sam

Registradas según el Director General, 2026-11-04, por el selector de su chat.

- **Número de la prueba:** «El 5202». Es la bandeja 2, «Clientes», y crea la tarjeta con fuente `whatsapp_clientes` sin cambiar ninguna variable.
- **Hora:** «A las 8:45 a. m.», es decir **12:45Z**, si las pruebas salen bien.
- **Clave de la puerta de prueba:** se rota al final, después de los navegadores. La corre el Director General.

**Descartado:** escribir al 5938, «WhatsApp · prueba 0582». Esa bandeja no está en `CHATWOOT_INBOX_LEADS_ID` ni en `CHATWOOT_INBOX_CLIENTES_ID`, así que no crea tarjeta. La prueba habría dado un falso fallo, y la regla manda quitar el webhook si falla la tarjeta. Tampoco se pone `CHATWOOT_INBOX_LEADS_ID=1`: esa variable queda vacía hasta el corte.

## Antes de la ventana

| # | Quién | Paso | Comprobación |
|---|---|---|---|
| A1 | DG | Fusionar la #369 y fijar `M`, los 40 hex | **Hecho:** `fe35eb2d1`, con la cola congelada hasta publicar |
| A2 | DG | `verify` sobre `M`, y la imagen `sha-M` de `build-image.yml` | **Hecho:** exit 1 solo por `test`, 3 rojos que aislados pasan (según el Director General). Digest de `sha-M`: `sha256:d307d1ac6e1532b622842fc1e957bc8ee72316a05ee67b02674781298c333aba` |
| A3 | Sub | Desplegar `M` en prueba | **Hecho:** imagen `sha256:d5b0f657a9b1…`, 7 de 7 en la puerta |
| A4 | Foco | Smoke con sesión de #349, #350 y #353 en prueba | Reporte de su sesión |
| A5 | Sub | Registro completo en prueba con `M`, con un cliente de correo `.test` y `?utm_source=…` | **Hecho:** 0 fallas. `DTD-9042`, una tarjeta `web_registro` con sus UTM, y la fecha nueva en `/privacidad` |

Prueba tiene la cuenta 2 de Chatwoot suspendida y el webhook borrado. A5 no los necesita.

## La ventana

**A las 12:45Z, las 8:45 a. m. en Venezuela,** si las pruebas salen bien. Sam tiene que estar disponible para los pasos 4 y 8. Es hora de oficina: la ventana de 404 importa más que de madrugada, así que los pasos 4 y 5 van seguidos.

**Correr los pasos del VPS dentro de `tmux`:** el SSH desde la PC se cayó dos veces hoy, a las 11:50Z. Un corte no debe dejar a medias `publicar-web.sh` ni `build cron`. El paso 4.2 de Sam lleva `ssh -t`: si se corta antes de «Escrito en…», no escribió nada, y se puede repetir.

**Comprobador de los pasos 6, 7 y 8:** `/srv/ops/paquetes/ventana-pasos-6-7-8.sh seis|siete|ocho <desde>`. Solo lee. Ensayado a las 11:56Z contra la web de hoy: cae en la imagen, la frase y la fecha, las 3 que tienen que caer antes de publicar. `siete` no se pudo ensayar: necesita secretos, webhook y la imagen nueva.

### 1. Respaldo (DG)

```bash
/srv/dtd-cargo/backup.sh
```

Comprobar con `ls -t /srv/backups/dtd-cargo/ | head -3` que hay uno nuevo. El del 2026-11-04 a las 06:00Z ya incluye las 6 migraciones. Las opciones de `backup.sh` no las leí: usar las de la última publicación.

### 2. Instalar el cron (DG)

**Solo cambia `cron/crontab`.** Medido contra `d62b06f6b`: los compose de `/srv/dtd-cargo` y `cron/Dockerfile` y `entrypoint.sh` ya son iguales al repo.

| Archivo | VPS | `main` |
|---|---|---|
| `cron/crontab` | `58efccebb75cdc85` | `f2c6bce4a54bd036` |

```bash
cd /srv/dtd-cargo
cp -p cron/crontab crontab.bak-tanda-a
# Copiar desde un checkout en M, por scp: infra/dtd-cargo/cron/crontab → cron/crontab
sha256sum cron/crontab                                                      # tiene que dar f2c6bce4a54bd036…
docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml build cron
docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps cron
```

- **Agrega 2 rutas:** `chatwoot-reintentos` cada 5 min y `chatwoot-agentes` a las 12:30Z. Hasta publicar responden 404, y `curl -f` solo lo deja en el log del cron.
- **Efecto en prueba:** `dtd-cargo-cron:local` es la misma imagen en los dos proyectos. El próximo `up` de `cron` en prueba toma este crontab. No hace daño: sus tokens ya están revocados.
- **`.env.example`:** solo avisa. Copiarlo también para que `revisar` no lo diga.

### 3. Puertas (DG)

```bash
/srv/ops/web/publicar-web.sh revisar "$M"
```

Tiene que decir «PUERTAS: pasan». Anotar el digest de la línea «imagen». Responde con la primera que encuentre cerrada, así que hay que repetirlo hasta que pase.

**No sigas** si pide otra cosa fuera de lo de arriba.

### 4. Secretos y webhook (Sam)

Van antes de publicar, para que `web` los lea en una sola recreación. Los mensajes que entren mientras tanto llegan a la web vieja, que responde 404: Chatwoot no reintenta, y su tarjeta nacería con el siguiente mensaje de esa persona.

**4.1. Crear el webhook, en `https://chat.dtdcargo.com`, cuenta «DTD Cargo»:**
1. Ajustes → Integraciones → Webhooks → Agregar.
2. URL, exacta: `https://dtdcargo.com/api/chatwoot/webhook`
3. Marca solo estos 4 eventos: **conversación creada, conversación actualizada, estado de conversación cambiado y mensaje creado**.
4. Guarda. No copies el secreto: lo toma el guion.

**4.2. Cargar los 3 secretos, en una terminal de tu PC:**

```bash
ssh -t root@217.216.54.70 'bash /srv/chatwoot/pegar-secretos-web.sh produccion'
```

Te pregunta tres veces. **En las tres, solo pulsa Enter:** toma el valor del servidor y no lo muestra. Si prefieres pegarlos, pega cuando lo pida; no se ve lo que pegas.

| Te pregunta | Lo que tiene que salir |
|---|---|
| `CHATWOOT_PLATFORM_TOKEN` | `del servidor, largo N, sha256 xxxxxxxx` |
| `CHATWOOT_ROUTER_TOKEN` | Lo mismo. Tarda hasta un minuto |
| `CHATWOOT_WEBHOOK_SECRET` | Lo mismo |

Al final: `Escrito en /srv/dtd-cargo/.env`, y exit 0.

| Si sale | Qué significa |
|---|---|
| Exit 3 | Falta la 0505 o el `.env`. No debería pasar: avisa al DG |
| Exit 4 | Un valor no sirve, y no se escribió nada |
| Exit 5 | Falta el webhook del 4.1: créalo y corre otra vez con `produccion CHATWOOT_WEBHOOK_SECRET` |
| «ya tiene valor: no lo toco» | Normal si lo corres dos veces |

**Comprobación del DG, sin ver valores:**

```bash
grep -cE '^CHATWOOT_(PLATFORM_TOKEN|ROUTER_TOKEN|WEBHOOK_SECRET)=.' /srv/dtd-cargo/.env   # 3
```

### 5. Publicar (DG)

```bash
/srv/ops/web/publicar-web.sh publicar "$M" --aunque-congelado
/srv/ops/web/publicar-web.sh estado
```

Tiene que salir 0 y decir «PUBLICADA», con `corre` igual a `…:sha-M@<digest del paso 3>`. El timer sigue apagado y `CONGELADO` puesto: encender es otro paso, con su propio OK.

**Si la fecha ya no es el 4 de noviembre,** `/privacidad` dice «4 de noviembre de 2026» aunque se publique después. Si importa, corregirla en `M`, antes del paso 2. El texto aprobado no cambia.

### 6. Comprobar portal y registro (DG o Sub)

`smoke-web.sh` no mira `/registro`, `/api/registro/check` ni `/portal`, y son lo único con clientes reales. Va de inmediato, antes de la prueba de WhatsApp.

**Sin sesión, desde el VPS:**

```bash
H=https://dtdcargo.com
c() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
echo "/registro $(c $H/registro)"                                   # 200
echo "/entrar $(c $H/entrar)"                                       # 200
echo "/portal $(c $H/portal)"                                       # 307
curl -s -o /dev/null -D - --max-time 20 $H/portal | grep -i '^location' # a /entrar
echo "/privacidad $(c $H/privacidad)"                               # 200
curl -s --max-time 20 $H/privacidad | grep -c 'También guardamos la campaña por la que llegaste, si el enlace la trae.' # 1
curl -s --max-time 20 $H/privacidad | grep -c '4 de noviembre de 2026'                                                 # 1 o más
curl -s --max-time 20 -X POST -H 'Content-Type: application/json' -d '{"kind":"persona","document":"V-99999999"}' $H/api/registro/check # {"exists":false}
docker logs --since 10m dtd-cargo-web-1 2>&1 | grep -ciE 'error|unhandled'   # mirar si sube
```

`V-99999999` es un número fuera del rango en uso, para no consultar el de una persona. Sin la letra, o con un documento mal formado, la ruta responde `false` sin mirar la base, y eso no prueba nada. No lo medí en producción.

**Con sesión, en el navegador de Sam, sin crear ni borrar nada:**

| Pantalla | Qué mirar |
|---|---|
| `/registro` | Carga, y el paso a paso avanza sin enviar. **No enviar:** crearía un cliente real |
| `/registro?utm_source=prueba&utm_campaign=tanda-a` | Se ve igual: los UTM no se muestran |
| `/entrar` | Pedir el enlace con tu correo: llega, y entra a `/portal` |
| `/portal` | Carga con tus datos y sin errores. Abrir un envío y `/portal/documentos` |
| `/studio/login` → `/studio/crm?tab=embudos` | Carga. El encabezado ya no dice «solo lectura» |
| `/studio` con el menú | Sigue sin «Bandeja» a la vista: `chatwoot_inbox` está apagado |

El bloque 7 de `.agents/handoffs/smokes-app-l14-0454-0472-guion.md` tiene más detalle, de otra tanda.

**Registro real en producción:** no se corre en este guion. Se prueba en A5. Si Sam quiere hacerlo igual, hay que decidir antes qué pasa con ese cliente, porque borrarlo es un borrado físico que corre Sam.

**Si algo de esto falla:** `publicar-web.sh volver` lleva a `dac99762e`, la imagen anterior. Las migraciones son aditivas y esa imagen ya corre sobre ellas. Comprobar antes con `estado` que `anterior` sea esa, y seguir «Marcha atrás» abajo.

### 7. El webhook entrega (Sub)

```bash
curl -4 -s -X POST -H 'Content-Type: application/json' \
  -H "x-chatwoot-timestamp: $(date +%s)" -H 'x-chatwoot-signature: sha256=00' -d '{}' \
  -w ' %{http_code}\n' https://dtdcargo.com/api/chatwoot/webhook
```

Tiene que dar `{"ok":false,"error":"firma"} 401`. Si da 503 `no_configurado`, `web` no tiene los secretos: no sigas.

También a mano, desde el contenedor `cron`:
- `chatwoot-reintentos`: `ok:true`.
- `chatwoot-agentes`: `ok:true`, `revisados:0`, sin alertas. Medido: la cuenta 1 tiene 1 administrador humano y 0 vínculos. Si sale alguna alerta, le llega un push a los administradores de Studio a las 12:30Z de cada día: revisar cuál es.

### 8. La prueba de WhatsApp (Sam y Sub)

Sam escribe desde su teléfono; Sub mide con conteos. Lo único que se lee de una persona es la fila de Sam.

| # | Sam hace | Sub mide | Tiene que dar |
|---|---|---|---|
| W1 | Escribe «Hola, prueba» al **5202**, desde su teléfono | `chatwoot_webhook_events`: `conversation_created` o `message_created` | `procesado`, 0 fallidos |
| W2 | — | `crm_tarjetas`, la más reciente | Fuente `whatsapp_clientes`, con `phone_last10`, y etapa según su segmento. Sale una sola fila |
| W3 | — | `chatwoot_conversations` | Bandeja 2, `unread_count` ≥ 1 |
| W4 | Mira `/studio/crm?tab=embudos` | — | Ve su tarjeta. Sin `chatwoot_inbox` no hay aviso push: es lo esperado |
| W5 | En Embudos, mueve su tarjeta a **Perdido**, con motivo | `crm_historial_etapas` | Una fila nueva |
| W6 | Escribe otro mensaje | `crm_tarjetas` y `crm_tareas` | Vuelve a **Registrado / recontacto**, y una tarea «Volvió a escribir: recontactar» |
| W7 | Otro mensaje más | `crm_tarjetas` | Sigue una sola tarjeta |
| W8 | En el panel de Chatwoot se le asigna a un agente vinculado, si hay | `crm_tarjetas.asesor_id` | Si no hay vínculos, no aplica: ya está probado en prueba |

**BSUID: no se puede cubrir aquí.** Solo se guarda de un usuario **sin** teléfono, y el teléfono de Sam lo trae. Queda en `NO VERIFICABLE` hasta que escriba alguien con username de WhatsApp.

**Instagram:** apenas el webhook esté activo, un mensaje real a `dtdcargo.ve` también crea tarjeta, con fuente `instagram` y el nombre visible. Es lo diseñado. Mirar el primero que llegue: confirma de paso que Instagram sigue recibiendo después del corte de `rails`. **Actualización del 2026-11-04, 19:50Z:** todavía no llega ninguno. Lo que hubo fueron salientes, y uno de ellos creó una tarjeta: es el pendiente de E6 de la SDD-0587.

**Consulta de W2**, sin datos de otras personas:

```sql
select fuente, etapa_leads, phone_last10 is not null as con_telefono, bsuid is not null as con_bsuid,
       chatwoot_contact_id is not null as con_contacto, created_at
from public.crm_tarjetas order by created_at desc limit 1;
```

### Si falla la tarjeta: se quita el webhook

Es la condición de Sam. Se quita en cuanto W1 a W3 fallen y no se explique en 5 minutos.

**Sam, en el panel:** Ajustes → Integraciones → Webhooks → borrar.

**O Sub, con el OK de Sam en el momento:**

```bash
docker exec chatwoot-rails-1 bundle exec rails runner \
  'n = Webhook.where(account_id: 1, url: "https://dtdcargo.com/api/chatwoot/webhook"); puts n.count; n.destroy_all; puts Webhook.count'
```

Tiene que imprimir `1` y `0`. Con eso no llega nada más a Studio. Chatwoot sigue atendiendo, y la web sigue publicada: los secretos en el `.env` no hacen nada sin webhook. No hace falta volver la imagen. Las tarjetas ya creadas se quedan: borrarlas es otra decisión, de Sam.

### 9. Después (Sub, no bloquea)

| Paso | Detalle |
|---|---|
| Ficha DTD | Registrar la Dashboard App según `docs/runbooks/chatwoot-ficha-dtd.md`: `https://dtdcargo.com/studio/ficha-chat`. No hay ninguna todavía |
| Cierre de sesión | Probar el script del panel y la revocación desde Studio, con un agente que no sea una persona real |
| `verificar-aislamiento.sh` de prueba | Copiar a `/srv/ops/staging/` el de `M`, junto con el `.env.example` de prueba: solo juntos |
| Datos de prueba | La cuenta 2 queda suspendida, y su `.env` conserva secretos sin efecto |
| Registro | **Hecho** en esta rama: la hora de fusión de las PR y de la publicación en las SDD 0585, 0586 y 0587, y la de la #352 en la SDD-0593 |

**No se hace aquí:** encender `chatwoot_inbox` y mostrar la Bandeja, porque pide capacitación; `CHATWOOT_INBOX_LEADS_ID`, `CHATWOOT_TEAM_LEADS_ID`, `WHATSAPP_NUMERO_CLIENTES` y `CRM_ALTA_WEB_SIN_KOMMO`, que van con el corte y sus OK; ni encender el timer. La clave de la puerta de prueba la rota el DG, al final, por lo que decidió Sam.

## Marcha atrás

| Qué falla | Qué hacer |
|---|---|
| Solo la tarjeta o el webhook | Quitar el webhook. La web se queda |
| Portal o registro después de publicar | `publicar-web.sh volver`. Comprobar con `estado` que `corre` sea `dac99762e`, y repetir el paso 6 |
| La publicación falla sola | Vuelve sola al `DTD_WEB_IMAGE` anterior. **Después de eso no corras `volver`:** `estado/anterior` no se reescribe, según el runbook de publicación |
| El cron | No hace falta volverlo: con la imagen vieja, las rutas nuevas solo dan 404 en el log. Si se quiere, `cp -p crontab.bak-tanda-a cron/crontab`, `build cron` y `up -d --no-deps cron`. La puerta de huellas fallará hasta instalar otra vez el de `M` |

**Con la imagen vieja sobre la base nueva:** ya corre así desde las 04:33Z, con `/` y `/registro` en 200. Las migraciones no tienen marcha atrás escrita y no hace falta: son objetos nuevos.

## Lo que este guion no comprobó

- `publicar-web.sh revisar "$M"`: `M` aún no existe, y se corre en el paso 3.
- Las opciones de `backup.sh`, ni que `chatwoot-agentes` salga sin alertas con tokens reales.
- La tarjeta por un mensaje real de WhatsApp, y la vuelta desde «Perdido»: es lo que mide el paso 8.
- Si Meta reintenta los webhooks de Instagram durante un corte: inferencia, no medida.

## PENDIENTES DE ESTA TAREA

- W5 y W6 con Sam, y repetir W7 después. Se miden con conteos desde las 12:37Z y van en un commit aparte, cuando ocurran.
- El primer entrante real de Instagram tras el corte.
- Los pasos de la sección 9 que no dicen «Hecho»: Ficha DTD, cierre de sesión desde Studio y `verificar-aislamiento.sh` de prueba.

## FUERA DE ALCANCE DETECTADO

- Una conversación abierta por un saliente crea una tarjeta de lead. Está en la SDD-0587, «Pendiente de E6». Lo decide Sam y se lo presenta el DG. No se corrigió aquí.

## Impacto documental

- **Corregido:** `docs/runbooks/chatwoot-bandeja.md`, que hablaba de un «número de prueba»; es el 5202.
- **Conocimiento:** sin cambio de estructura ni de reglas. Graphify y Obsidian los revisa el Director al cierre.
