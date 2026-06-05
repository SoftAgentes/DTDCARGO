# Runbook · Setup Resend Inbound (email entrante → Conversaciones)

> Habilita la **ingesta de email entrante** del Studio (SDD-0056 Fase 2): un
> cliente le escribe por email a una casilla de DTD y el mensaje cae en su hilo
> de `/studio/conversaciones`. Sin este setup, el código está listo y testeado
> (con mocks) pero NO entra ningún email real.

Tiempo estimado: **20-30 minutos** (+ propagación DNS). Prerequisito: el dominio
de **envío** ya verificado en Resend (ver `setup-resend.md`).

> ⚠️ **Plan:** la recepción de email (Inbound) puede requerir un **plan de pago
> de Resend** y/o tener la feature habilitada en tu cuenta. Confirmá en el
> dashboard (sección **Receiving** / **Webhooks → email.received**) antes de
> avanzar. El código no depende del plan; solo el flujo real en runtime.

---

## 1. Elegir un subdominio receptor (NO pisar el MX de envío)

El MX de recepción **convive mal** con el de envío en el mismo dominio raíz. Por
eso se usa un **subdominio dedicado** para recibir:

- Sugerido: `inbound.dtdcargo.com` (o `soporte.dtdcargo.com`).
- Los clientes escribirán a `cualquier-cosa@inbound.dtdcargo.com` → todos esos
  emails llegan al webhook. (Resend recibe para **cualquier** address del
  dominio/subdominio receptor; filtramos/ruteamos por el campo `to`.)

> Si ya tenés MX en la raíz (`dtdcargo.com`) para otra cosa, **NO lo toques**.
> Usá el subdominio. Resend lo documenta como la práctica recomendada.

---

## 2. Agregar el dominio receptor en Resend

1. Dashboard Resend → **Domains** → **Add Domain**.
2. Ingresar el subdominio: `inbound.dtdcargo.com`.
3. Resend muestra un record **MX** para la recepción. Agregalo en tu DNS:
   - Host/Name: `inbound` (o `inbound.dtdcargo.com` según el panel)
   - Type: `MX`
   - Value: el mail server que indique Resend (ej. `inbound.resend.com`)
   - **Priority: la más baja / la que indique Resend** (no debe competir con el
     MX de envío del dominio raíz).
4. Click **Verify**. Puede tardar 5-30 min en propagar.

---

## 3. Configurar el webhook `email.received`

1. Dashboard Resend → **Webhooks** → **Add Webhook**.
2. URL del endpoint:
   ```
   {SITE_URL}/api/conversaciones/email
   ```
   En prod: `https://dtdcargo.com/api/conversaciones/email`.
3. Event type: **`email.received`** (solo ese; este endpoint ignora el resto).
4. **Add** → Resend genera un **signing secret** (formato `whsec_xxx`).
5. Copiá el secret.

> Para probar local: tunelizá tu `localhost:3000` con `ngrok` o VS Code Port
> Forwarding y usá esa URL pública como endpoint temporal.

---

## 4. Env vars

Agregar en Vercel (Production) y en `.env.local` para dev:

```bash
# Secret del webhook inbound (firma Svix). Si no está, el endpoint responde 503.
RESEND_INBOUND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# RESEND_API_KEY ya debería existir (setup-resend.md). Se reusa para bajar el
# cuerpo del email por la Received Emails API. Necesita permiso de lectura.
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

Notas:
- Si `RESEND_INBOUND_WEBHOOK_SECRET` no está set, el endpoint cae al
  `RESEND_WEBHOOK_SECRET` del webhook de delivery (podés compartir el valor en
  el dashboard si querés un solo secret). Si tampoco está → **503** y no procesa.
- Si `RESEND_API_KEY` no está, el webhook **acepta** el evento (200) pero no baja
  el cuerpo (no rompe; queda logueado). Para ingestar de verdad, la key es
  obligatoria.

---

## 5. Cómo funciona (para entender los logs)

1. El webhook `email.received` trae **solo metadata** (`email_id`, `from`, `to`,
   `subject`, `message_id`). El cuerpo NO viene en el webhook.
2. El endpoint baja el cuerpo con `GET https://api.resend.com/emails/receiving/{email_id}`
   (Bearer `RESEND_API_KEY`).
3. Resuelve el **cliente** por `clients.email` (case-insensitive) y threadea al
   hilo `channel='email'` del cliente. Idempotente por `email_id`.

Estados que vas a ver en la respuesta (todos devuelven **200** para que Resend no
reintente en loop):

| status      | significado |
|-------------|-------------|
| `ingested`  | entró un mensaje nuevo al hilo del cliente |
| `duplicate` | reintento de Resend (mismo `email_id`) → no se duplicó |
| `unmatched` | el remitente **no** matchea ningún cliente → se descarta + log `warn`. (Crear lead/cliente desde un remitente desconocido es decisión futura del founder.) |
| `ambiguous` | el mismo email existe en **>1 tenant** → no se adivina → log `warn` |

Solo devuelve `!= 200` si el webhook está mal configurado (sin secret → 503),
la firma es inválida (401) o falla bajar el cuerpo (502, Resend reintenta).

---

## 6. Reply threading (saliente)

Cuando el agente responde desde la bandeja, si el hilo nació de un email
entrante, la respuesta sale por Resend con headers `In-Reply-To` / `References`
apuntando al `message_id` del primer email del cliente (guardado en
`conversations.external_ref`). Así el cliente ve la respuesta en el **mismo hilo**
de su casilla. No requiere setup adicional.

---

## 7. Checklist de verificación

- [ ] Subdominio receptor verificado en Resend (MX ✅).
- [ ] Webhook `email.received` apuntando a `{SITE_URL}/api/conversaciones/email`.
- [ ] `RESEND_INBOUND_WEBHOOK_SECRET` en Vercel + `.env.local`.
- [ ] `RESEND_API_KEY` con permiso de lectura.
- [ ] Migración `0106` aplicada a prod (tablas `conversations` ya existen).
- [ ] Smoke test: mandá un email desde una casilla cuyo `from` matchee un
      `clients.email` real → debe aparecer en `/studio/conversaciones`.
- [ ] Smoke test negativo: email desde un remitente desconocido → log `unmatched`,
      sin crear hilo.
