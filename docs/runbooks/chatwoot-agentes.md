# Runbook · Agentes de Chatwoot: altas, bajas, permisos y salud

SDD-0585, pasos 2.5 y 2.7. Explica:
- cómo Studio da de alta y de baja a los agentes de la Bandeja;
- cómo les fija los permisos con la matriz que aprobó Sam;
- cómo cierra sus sesiones;
- cómo avisa si la cuenta de Chatwoot queda en mal estado.

> **Estado:** el código está en la rama `codex/0582-e2-poc` y todavía no en producción. Nada de esto se ejecutó contra el Chatwoot del VPS. La 0503, la 0504 y la 0508 no están aplicadas.

## Matriz de permisos (aprobada por Sam el 2026-10-30)

| Rol de Studio | Rol en Chatwoot | Bandejas | Equipos |
|---|---|---|---|
| `admin` | `administrator` | Clientes y Leads | Clientes y Leads |
| `commercial` | `agent` | Leads | Leads |
| `support` | `agent` | Clientes | Clientes |
| Otro rol con override de la Bandeja | `agent` | Ninguna | Ninguno |
| Sin la Bandeja | Sin cuenta | — | — |

**Las bandejas:**
- **Clientes** es el número nuevo, +58 412-1605202, y ya está en Chatwoot.
- **Leads** es el número viejo, que llega de Kommo en el corte. Hasta entonces `CHATWOOT_INBOX_LEADS_ID` queda vacío, y comercial no tiene bandeja.

**Studio manda.** El cron diario corrige lo que se cambie a mano en Chatwoot:
- el rol;
- quién está en cada bandeja y equipo.

Saca de una bandeja a quien se agregó sin vínculo. No lo saca de la cuenta: la salud lo cuenta.

## Qué hace Studio

| Cuándo | Qué pasa |
|---|---|
| Un admin usa Bandeja › Vínculos › «Dar de alta» | 1. Crea o adopta el usuario de Chatwoot con el nombre y el correo de Studio.<br>2. Si no es admin de Studio, le pone una **clave aleatoria nueva** que nadie conoce.<br>3. Lo mete en la cuenta con el rol de la matriz y lo vincula.<br>4. La matriz le pone sus bandejas y equipos |
| Un admin vincula a mano un agente existente | Lo mismo desde el paso 2. Si Chatwoot no deja cambiar la clave porque el usuario no lo creó Studio, avisa y el vínculo queda |
| En Usuarios, alguien se desactiva o cambia a un rol sin Bandeja | Su agente se da de baja en ese momento. Si Chatwoot falla, lo reintenta el cron |
| En Usuarios, alguien cambia de rol y sigue con la Bandeja | La matriz le cambia el rol y las bandejas |
| Todos los días a las 12:30 UTC (08:30 en Caracas) | El cron `chatwoot-agentes` revisa todos los vínculos, aplica la matriz, mide la salud y, si hay alertas, avisa por push a los admins de Studio |
| Cada 5 minutos | El cron `chatwoot-reintentos` borra de Chatwoot el usuario de una baja de más de 12 meses (con la 0508) |

### La baja, paso a paso

1. Lo saca de la cuenta.
2. **Cierre forzado,** con la ruta privada `dtd_revocar_sesiones` del inicializador `rails/zz_dtd_revocar_sesiones.rb`:
   - vacía todas sus sesiones del panel;
   - rota su `pubsub_token` (el tiempo real se corta a los 30 s) y su token de API.

   Studio comprueba después que el token cambió y que no quedó ninguna sesión. El navegador del agente vuelve al login en su próximo clic.

   **Mientras el inicializador no esté instalado** (la ruta da 404), Studio usa la API de perfil de Chatwoot:
   - abre una sesión propia por SSO;
   - le pone una clave aleatoria, con lo que queda solo esa sesión;
   - borra todas las sesiones y rota el token.
3. Anota la fecha de la baja (0508).
4. Borra el vínculo.

Si el cierre falla, el vínculo queda, la salud dice «sesiones siguen abiertas» y la próxima corrida lo reintenta.

**Lo que Studio nunca toca:**
- el usuario de servicio (`CHATWOOT_SERVICE_USER_ID`): no le cambia el rol ni lo saca de la cuenta ni de una bandeja;
- el último administrador humano: ni lo saca ni lo degrada. Sin `CHATWOOT_SERVICE_USER_ID` no degrada a nadie.

## Variables (contenedor `web`)

- `CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID`: las de la Bandeja.
- `CHATWOOT_TENANT_ID`: el tenant de Studio dueño de la cuenta, el mismo del webhook.
- `CHATWOOT_SERVICE_USER_ID`: el id del usuario de servicio. Está en `/srv/chatwoot/secretos/platform-app.env` (E1, paso 1.4). Sin él:
  - la salud dice «falta configurar el usuario de servicio»;
  - no se pueden contar los admins humanos ni fijar bandejas y equipos (se usa su token de administrador).
- `CHATWOOT_INBOX_CLIENTES_ID` y `CHATWOOT_INBOX_LEADS_ID`: ids de las bandejas (Ajustes → Bandejas, el número de la URL).
- `CHATWOOT_TEAM_CLIENTES_ID` y `CHATWOOT_TEAM_LEADS_ID`: ids de los equipos (Ajustes → Equipos). Son los mismos que usa E10.

Un id vacío apaga esa parte de la matriz.

## Puertas de integración (cada una con OK de Sam; nada de esto lo hace el código)

1. **Migración 0508** (bajas y purga), después de la 0504, con [aplicar-migraciones-prod.md](aplicar-migraciones-prod.md). Sin ella:
   - la baja funciona igual, pero no se anota la fecha y nadie borra el usuario a los 12 meses;
   - la purga responde `omitido`.
2. **Variables de la matriz** en el `.env` del VPS. Leads, recién en el corte.
3. **Inicializador de revocación** (`rails/zz_dtd_revocar_sesiones.rb`), el cierre forzado de verdad:
   - antes, correr `bash infra/chatwoot/pruebas/prueba-revocar-sesiones.sh` en local: tiene que dar 0 fallas, con el control en rojo;
   - copiar el inicializador y el `compose.yml` nuevos a `/srv/chatwoot` (sha256 igual al repo);
   - cargar en `/srv/chatwoot/.env` `DTD_CHATWOOT_SERVICIO_ID` con el id del usuario de servicio (el mismo de `CHATWOOT_SERVICE_USER_ID`);
   - recrear `rails`;
   - comprobar en el log de arranque «[DTD] revocación de sesiones activa».

   Sin la variable, la ruta responde 503 y Studio deja la baja «pendiente» (no cae al respaldo).
4. **Script del panel** (`DASHBOARD_SCRIPTS`), complemento para que salir de Studio cierre la sesión del chat en ese navegador:
   - en `https://chat.dtdcargo.com/super_admin` (detrás de Cloudflare Access), ir a Settings › «Dashboard Scripts»;
   - pegar el contenido de `infra/chatwoot/panel/dashboard-scripts.html`, comentario incluido;
   - comprobar: abrir la Bandeja, salir de Studio y abrir `chat.dtdcargo.com` en ese navegador. Tiene que pedir login.

   Sin el script, la salida espera 4 s y sigue al login: la sesión del chat queda abierta en ese navegador hasta la próxima entrada a Studio, como antes del 2.7.
5. **Apagar «olvidé mi clave» para los agentes.** CE 4.19.1 no tiene un interruptor por rol. La alternativa es una regla de Traefik de E1 que responda 403 a `POST /auth/password` en `chat.dtdcargo.com`:
   - un admin que olvide su clave la cambia desde el superadmin;
   - **riesgo mientras no esté:** un agente puede pedir una clave nueva a su correo y entrar directo. Ve lo mismo que desde Studio, porque los permisos son de la cuenta, y la baja lo saca igual.

## Alertas de salud y qué hacer

| Alerta | Qué significa | Qué hacer |
|---|---|---|
| El servidor de mensajes no responde | La Platform API no contestó | Revisar el contenedor de Chatwoot (`chatwoot-servidor.md`) |
| La cuenta no tiene ningún administrador humano | El único `administrator` es el usuario de servicio | Dar a una persona el rol `admin` en Studio y vincularla: la matriz la sube. O ascenderla en Chatwoot (Ajustes → Agentes), con OK de Sam |
| Falta configurar el usuario de servicio | No está `CHATWOOT_SERVICE_USER_ID` | Cargarlo en el `.env` del VPS, con OK de Sam |
| Hay vínculos a agentes que ya no están en la cuenta | Alguien sacó al agente desde Chatwoot | La matriz lo vuelve a meter en la próxima corrida. Si no, darlo de alta otra vez o desvincularlo |
| Una baja quedó bloqueada | Se desactivó en Studio al último admin humano de la cuenta | Agregar otro administrador humano; la baja se completa en la próxima corrida |
| Una baja salió de la cuenta, pero sus sesiones siguen abiertas | El cierre forzado falló en algún paso; el aviso del log `[chatwoot-agentes]` dice cuál | Se reintenta solo. Si se repite:<br>- `revocar http_503`: falta `DTD_CHATWOOT_SERVICIO_ID` en Chatwoot;<br>- `revocar http_409`: es el de servicio o el último admin humano;<br>- `entrada http_429` (respaldo): rack-attack, 5 entradas por IP cada 5 min; se resuelve al día siguiente;<br>- `token no_autorizado`: un usuario que no creó Studio; se cierra a mano desde el superadmin |
| Un cambio de rol quedó bloqueado | La matriz iba a bajar al último admin humano a `agent` | Agregar otro administrador humano |
| No se pudieron aplicar todos los permisos | Falló un rol, una bandeja o un equipo | Revisar los logs `[chatwoot-matriz]` del contenedor `web`; se reintenta en la próxima corrida |

## Cómo comprobarlo después del despliegue

1. Correr los crons a mano desde el VPS:

   ```bash
   curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-agentes
   ```

   ```bash
   curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-reintentos
   ```

   - Sin la 0503, `chatwoot-agentes` responde `{"ok":true,"omitido":true}`. Con la 0503 devuelve conteos, `matriz` y `alertas`.
   - Sin la 0508, `chatwoot-reintentos` responde `purgaBandeja` y `purgaBajas` con `omitido`.
2. Abrir Bandeja › Vínculos como admin y mirar «Salud de la bandeja».
3. En Chatwoot (Ajustes → Bandejas → Clientes → Agentes), comprobar que estén los de atención y los admins.

## Plazos de borrado (propuesta del Director sin objeción de Sam, 2026-10-30)

| Qué | Plazo | Dónde |
|---|---|---|
| Eventos del webhook procesados o descartados | 90 días | `chatwoot_purgar_bandeja()` (0508), cada 5 min |
| Conversaciones sin actividad (estado en Studio, no en Chatwoot) | 12 meses | Lo mismo |
| Usuario de Chatwoot de un agente dado de baja | 12 meses desde la baja | `purgarBajasVencidas`, cada 5 min |

**Candados del borrado del usuario:**
- no se borra el de servicio, uno que está en la cuenta ni uno con vínculo;
- sin la lista de la cuenta no se borra a nadie.

**Un usuario que no creó Studio** (la Platform API responde 401) no se puede borrar desde aquí: se suelta la fila y se borra a mano desde el superadmin.

## Límites conocidos

- **Antes de la primera purga real,** comprobar en el Chatwoot local qué hace `DeleteObjectJob` con las conversaciones y mensajes que tenía el usuario. Es 12 meses después de la primera baja.
- Los usuarios creados fuera de Studio (como `vzla@`) solo se ven por id y rol: la Platform API no deja leer su correo.
