# Setup Telegram Bot · DTD Studio

> SDD-0036 Fase 5 + SDD-0326 · canal Telegram para notificaciones Studio.
> El webhook usa el header oficial de Telegram; nunca lleva el secreto primario
> en la URL.

## 1. Crear el bot con @BotFather

1. Abre Telegram, busca `@BotFather` y envía `/start`.
2. Envía `/newbot`.
3. Usa `DTD Studio Bot` como nombre visible.
4. Escoge un username terminado en `bot`, por ejemplo `DTDStudioBot`, y guarda
   el nombre sin `@`.
5. Guarda el HTTP API token entregado por BotFather como
   `TELEGRAM_BOT_TOKEN`. Nunca lo copies al repositorio ni a un ticket.
6. Opcionalmente configura descripción y foto mediante `/setdescription` y
   `/setuserpic`.

## 2. Configurar variables

`TELEGRAM_WEBHOOK_SECRET` debe tener 1–256 caracteres y usar únicamente letras,
números, `_` o `-`. Un valor hexadecimal aleatorio de 64 caracteres cumple el
contrato.

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=DTDStudioBot
```

Guárdalas en `.env.local` para desarrollo o en el secret manager de Vercel para
Producción. Agregar, rotar o eliminar variables de Producción y desplegar son
gates externos separados que requieren autorización del founder.

## 3. Migrar un webhook que todavía usa `?secret=`

No despliegues SDD-0326 sobre el webhook viejo sin este orden: el endpoint nuevo
ya no acepta el secreto primario por query string.

1. Copia el secreto vigente en la variable temporal de Producción
   `TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET`, sin cambiar todavía
   `TELEGRAM_WEBHOOK_SECRET`.
2. Despliega el código de SDD-0326. El webhook viejo sigue entrando únicamente
   por la variable legacy separada.
3. Genera un secreto primario nuevo con el contrato indicado, actualiza
   `TELEGRAM_WEBHOOK_SECRET` y despliega esa rotación.
4. Configura Telegram con URL limpia y `secret_token` usando las variables del
   entorno; no escribas valores reales en el historial de la terminal:

```powershell
$telegramWebhookBody = @{
  url = "https://dtdcargo.com/api/telegram/webhook"
  secret_token = $env:TELEGRAM_WEBHOOK_SECRET
  allowed_updates = @("message")
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/setWebhook" `
  -ContentType "application/json" `
  -Body $telegramWebhookBody
```

5. Verifica el estado sin imprimir secretos. La URL devuelta debe ser exactamente
   `https://dtdcargo.com/api/telegram/webhook`, sin query string:

```powershell
$telegramWebhookInfo = Invoke-RestMethod `
  -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/getWebhookInfo"
$telegramWebhookInfo.result |
  Select-Object url, pending_update_count, last_error_message
```

6. Ejecuta el smoke del enlace descrito abajo.
7. Elimina `TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET` de Producción, vuelve a
   desplegar y repite `getWebhookInfo` y el smoke. Éste es el estado final.

No uses `drop_pending_updates` durante la migración: podría descartar mensajes
reales. Si cualquier paso falla, conserva temporalmente el secreto legacy y
revisa los logs sin copiar URLs ni headers completos.

## 4. Configurar un bot nuevo

Después del primer deploy con las variables activas, ejecuta directamente el
paso 4 de la sección anterior. Un bot nuevo nunca necesita
`TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET`.

Telegram debe responder `ok: true`. Confirma además que `getWebhookInfo` enseña
la URL limpia y cero errores recientes.

## 5. Smoke test del enlace

1. Abre `/studio` en Producción y entra en `Mi perfil → Preferencias`.
2. En “Notificaciones por Telegram”, pulsa **Conectar Telegram**.
3. Abre el enlace `t.me/DTDStudioBot?start=XXXXXXX`.
4. Telegram envía `/start` y el bot debe responder con la confirmación.
5. El badge del perfil debe pasar a “conectado” después del refresco.

Diagnóstico:

- Si el bot no responde, revisa el token, `getWebhookInfo` y los logs del
  endpoint sin imprimir secretos.
- Si responde “Código inválido”, genera otro código; cada código es de un solo
  uso.
- Si la UI no cambia, revisa la base de datos y el polling del perfil.
- Si el panel de salud marca “secreto en la URL”, el corte sigue incompleto.

## 6. Apagar el bot

`deleteWebhook` detiene la recepción de mensajes nuevos, pero no borra los
`telegram_chat_id` ya enlazados. Es una escritura externa y requiere autorización
específica. No pases `drop_pending_updates` salvo que el founder autorice
descartar explícitamente la cola.

## 7. Wiring de notificaciones

El helper `sendTelegramMessage(chatId, text)` y el ruteo por categorías ya viven
en `lib/studio/telegram/`. Toda integración nueva debe respetar el opt-in, evitar
duplicados y tratar el envío como best-effort sin bloquear la transacción de
negocio.
