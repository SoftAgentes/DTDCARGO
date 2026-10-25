# Setup Telegram Bot · DTD Studio

> SDD-0036 Fase 5 follow-up · canal Telegram para notificaciones Studio.
> Una vez configurado, cada user puede linkear su Telegram desde
> ProfileModal · Preferencias y recibir avisos de bugs críticos y
> respuestas admin via chat de Telegram.

> ⚠️ **Nota del 2026-10-19 · la web ya no corre en Vercel.** Desde el
> 2026-10-16 la web corre en el servidor propio (VPS de Contabo) y se publica
> sola con el vigilante ([`publicacion-automatica-web.md`](publicacion-automatica-web.md));
> Vercel está en pausa. Donde abajo dice «Vercel producción»:
>
> - **Variables:** `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET` viven en el
>   `.env` del servidor (`/srv/dtd-cargo/.env`, con
>   `infra/ops/migrate/env-set.sh`); `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` va
>   además como Variable del repo en GitHub, porque se fija al construir la
>   imagen ([`servidor-contabo.md`](servidor-contabo.md) §3.1, puntos 2 y 3).
>   Un cambio se aplica recreando el contenedor `web`, no con un redeploy.
> - **Webhook:** el `setWebhook` lo corre la sesión de Contabo con
>   `/srv/ops/web/telegram-webhook.sh set` (`infra/ops/web/telegram-webhook.sh`),
>   que lee el token y el secreto del `.env` sin imprimirlos. Se hizo el
>   2026-10-16 a las 07:06Z (registro en `servidor-contabo.md` §3.6). Para
>   rotar: secreto nuevo en el `.env`, recrear `web` y volver a correr `set`.
> - **Logs:** `docker logs dtd-cargo-web-1`.
>
> Todo eso lo hace la sesión de Contabo con el OK de Sam. Lo de abajo queda como
> registro de cómo se hizo en Vercel.

## 1. Crear el bot con @BotFather

1. Abrí Telegram, buscá `@BotFather` y mandale `/start`.
2. Mandale `/newbot`.
3. Te pide nombre del bot (display): poné `DTD Studio Bot`.
4. Te pide username (debe terminar en `bot`): poné `DTDStudioBot` o similar.
   - Anotá el username (sin `@`) — vas a usarlo en env var.
5. BotFather responde con tu **HTTP API token** (`123456789:ABC-DEF...`).
   - Anotalo · es tu `TELEGRAM_BOT_TOKEN`.
6. Opcional · poné descripción + foto del bot via:
   - `/setdescription` → "Notificaciones de DTD Studio: bugs críticos, respuestas admin, alertas operativas."
   - `/setuserpic` → mandá el logo DTD (160×160 PNG).

## 2. Configurar env vars

### Local (`.env.local`)

```
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=DTDStudioBot
```

⚠️ **El valor de `TELEGRAM_WEBHOOK_SECRET` tiene charset limitado** (SDD-0499):
Telegram acepta entre 1 y 256 caracteres y sólo `A-Z`, `a-z`, `0-9`, `_` y `-`.
`openssl rand -hex 32` cae dentro (son 64 caracteres hex), pero un
`openssl rand -base64 32` **no** — el `+`, el `/` y el `=` los rechaza
`setWebhook`.

### Vercel producción

```
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_TELEGRAM_BOT_USERNAME production
```

(o desde el dashboard de Vercel · Settings → Environment Variables).

Redeploy después de agregar las vars.

## 3. Setear el webhook

Después del primer deploy con las env vars activas. El secreto va en
`secret_token`, **nunca en la URL**: Telegram lo devuelve en el header
`X-Telegram-Bot-Api-Secret-Token` de cada update y eso es lo que compara
`app/api/telegram/webhook/route.ts`.

```bash
TOKEN=123456789:ABC-DEF...
SECRET=<lo que pusiste en TELEGRAM_WEBHOOK_SECRET>

curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://dtdcargo.com/api/telegram/webhook\",\"secret_token\":\"$SECRET\",\"allowed_updates\":[\"message\"]}"
```

Debería responder `{"ok":true,"result":true,"description":"Webhook was set"}`.

Verificá con:

```bash
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

El `url` que devuelve ya no lleva el secreto; `getWebhookInfo` no expone el
`secret_token`.

### Rotación (SDD-0499)

Hasta esta spec el secreto viajaba en el query string, así que **el valor que
esté vivo hoy hay que darlo por comprometido**: quedó en logs de acceso, en
`Referer`, en el historial de proxies y en el `url` que devolvía
`getWebhookInfo` a cualquiera con el token del bot. Rotarlo es una operación de
Sam, no de un agente.

Orden, para que la ventana ciega sea de segundos:

1. Generá un valor nuevo (`openssl rand -hex 32`) y actualizá
   `TELEGRAM_WEBHOOK_SECRET` en Vercel producción.
2. Redeploy.
3. Corré el `setWebhook` de arriba con el valor nuevo.

Entre el paso 2 y el 3 el endpoint responde 403 a todo update. No se pierden:
Telegram reintenta las entregas fallidas, así que un `/start` de esa ventana
entra solo cuando el paso 3 aterriza.

## 4. Smoke test del link flow

1. Abrí `/studio` en producción, abrí `Mi perfil → Preferencias`.
2. En sección "Notificaciones por Telegram" tocá **Conectar Telegram**.
3. Te aparece un link `t.me/DTDStudioBot?start=XXXXXXX`. Tocalo.
4. Se abre Telegram + manda /start automático.
5. El bot responde "Listo · tu cuenta…" + el badge en ProfileModal pasa
   a "conectado" tras ~4-8s (polling auto-refresh).

Si algo falla:
- **Bot no responde**: revisar `TELEGRAM_BOT_TOKEN` en Vercel.
- **"Código inválido"** del bot: el webhook llegó pero no encontró el code
  (el code expira al primer uso · si tocaste el link 2 veces, el 2do falla).
- **No pasa a "conectado" en UI**: revisar logs Vercel del endpoint
  `/api/telegram/webhook` · puede estar fallando el secret o la DB.

## 5. Wiring en el dispatch de notificaciones (pendiente)

El helper `sendTelegramMessage(chatId, text)` ya existe en
`lib/studio/telegram/send-message.ts`. El siguiente paso es wirearlo en
el dispatch del Bug Reporter (junto a email + push) y en cualquier
trigger nuevo que quieras notificar por Telegram.

Patrón recomendado (ejemplo):

```ts
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

const { data: profile } = await admin
  .from("user_profiles")
  .select("telegram_chat_id")
  .eq("user_id", targetUserId)
  .maybeSingle<{ telegram_chat_id: string | null }>();

if (profile?.telegram_chat_id) {
  await sendTelegramMessage(
    profile.telegram_chat_id,
    `🚨 *Bug crítico* · ${bugTitle}\n\n${bugDescription}\n\nhttps://dtdcargo.com/studio/bugs/${bugId}`,
    { parseMode: "MarkdownV2" },
  );
}
```

## 6. Apagar el bot (rollback)

Si necesitás apagar el canal Telegram sin borrar accounts linkeadas:

```bash
TOKEN=123456789:ABC-DEF...
curl -X POST "https://api.telegram.org/bot$TOKEN/deleteWebhook"
```

El bot deja de recibir mensajes nuevos. Las accounts linkeadas mantienen
`telegram_chat_id` en DB y vuelven a funcionar cuando re-seteás el
webhook. Para borrar el bot completo, mandale `/deletebot` a @BotFather.
