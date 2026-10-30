# Runbook · Agentes de Chatwoot: altas, bajas y salud

SDD-0585, paso 2.5. Explica cómo Studio da de alta y de baja a los agentes de la Bandeja y cómo avisa si la cuenta de Chatwoot queda en mal estado.

> **Estado:** el código está en la rama `codex/0582-e2-poc` y todavía no en producción. Nada de esto se ejecutó contra el Chatwoot del VPS.

## Qué hace Studio

| Cuándo | Qué pasa |
|---|---|
| Un admin usa Bandeja › Vínculos › «Dar de alta» | Crea o adopta el usuario de Chatwoot con el nombre y el correo de Studio, lo mete en la cuenta como **agente** y lo vincula. Solo para quien ve la Bandeja |
| En Usuarios, alguien se desactiva o cambia a un rol sin Bandeja | Su agente sale de la cuenta de Chatwoot y se borra el vínculo, en ese momento. Si Chatwoot falla, lo reintenta el cron |
| Todos los días a las 12:30 UTC (08:30 en Caracas) | El cron `chatwoot-agentes` revisa todos los vínculos, mide la salud y, si hay alertas, avisa por push a los admins de Studio |

**Lo que Studio nunca saca de la cuenta:**
- el usuario de servicio (`CHATWOOT_SERVICE_USER_ID`);
- el último administrador humano.

Tampoco borra usuarios de Chatwoot: la baja solo los saca de la cuenta.

## Variables (contenedor `web`)

- `CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID`: las de la Bandeja.
- `CHATWOOT_TENANT_ID`: el tenant de Studio dueño de la cuenta, el mismo del webhook.
- `CHATWOOT_SERVICE_USER_ID`: el id del usuario de servicio. Está en `/srv/chatwoot/secretos/platform-app.env` (E1, paso 1.4). Sin él, la salud dice «falta configurar el usuario de servicio» y no puede contar a los admins humanos.

## Alertas de salud y qué hacer

| Alerta | Qué significa | Qué hacer |
|---|---|---|
| El servidor de mensajes no responde | La Platform API no contestó | Revisar el contenedor de Chatwoot (`chatwoot-servidor.md`) |
| La cuenta no tiene ningún administrador humano | El único `administrator` es el usuario de servicio | Crear o ascender a una persona a administrador desde Chatwoot (Ajustes → Agentes), con OK de Sam |
| Falta configurar el usuario de servicio | No está `CHATWOOT_SERVICE_USER_ID` | Cargarlo en el `.env` del VPS, con OK de Sam |
| Hay vínculos a agentes que ya no están en la cuenta | Alguien sacó al agente desde Chatwoot | Darlo de alta otra vez o desvincularlo en Bandeja › Vínculos |
| Una baja quedó bloqueada | Se desactivó en Studio al último admin humano de la cuenta | Agregar otro administrador humano; la baja se completa en la próxima corrida |

## Cómo comprobarlo después del despliegue

1. Correr el cron a mano desde el VPS:

   ```bash
   curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000/api/cron/chatwoot-agentes
   ```

   Sin la 0503, responde `{"ok":true,"omitido":true}`. Con la 0503 aplicada, devuelve conteos y `alertas`.
2. Abrir Bandeja › Vínculos como admin y mirar «Salud de la bandeja».

## Límites conocidos

- La Platform API de 4.19.1 no revoca sesiones. El agente que sale de la cuenta pierde el acceso a ella, aunque su sesión del panel siga viva (E2-D13).
- El usuario de Chatwoot de alguien dado de baja sigue existiendo, con su nombre y correo. El plazo para borrarlo se decide en 2.6 o 2.7.
- Los usuarios creados fuera de Studio (como `vzla@`) solo se ven por id y rol: la Platform API no deja leer su correo.
