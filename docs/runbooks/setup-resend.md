# Runbook · Setup Resend para DTD-CARGO

> Habilita el envío real de emails del Studio (invitaciones, welcome,
> notificaciones Bug Reporter, etc.). Sin este setup, los `mail_logs`
> quedan en `status='queued'` y los emails NO se mandan.

Tiempo estimado: **20 minutos**. Costo: free tier de Resend cubre los
primeros 3,000 emails/mes y 100/día. Perfecto para arranque.

---

## 1. Crear cuenta + verificar dominio

1. Ir a https://resend.com/signup
2. Sign up con `comercial@dtdcargo.com` (o el email que prefieras como owner)
3. En el dashboard: **Domains** → **Add Domain**
4. Ingresar: `dtdcargo.com`
5. Resend te muestra 4 records DNS que tenés que agregar al panel del dominio:
   - 1× MX (Resend mail server)
   - 1× TXT SPF (`v=spf1 include:_spf.resend.com ~all`)
   - 1× CNAME DKIM (clave pública para firmar)
   - 1× TXT DMARC (opcional pero recomendado: `v=DMARC1; p=none;`)
6. Agregar los 4 records donde tengas el DNS (Cloudflare, Namecheap, etc.)
7. Click **Verify** en Resend (puede tardar 5-30 min en propagar)
8. Cuando los 4 records estén ✅ verde, el dominio está listo

---

## 2. Generar API Key

1. Dashboard Resend → **API Keys** → **Create API Key**
2. Nombre: `DTDCargo Production` (o similar)
3. Permission: **Sending access** (suficiente para enviar). Con esa llave el
   correo entrante de Conversaciones no puede bajar el contenido de los mensajes
   (ver `setup-resend-inbound.md`): necesita **Full access**. `/studio/debug`
   lo indica (ver Troubleshooting).
4. Domain: `dtdcargo.com`
5. Copy la key (formato `re_xxxxxxxxxxxxxxxxxxxx`) — **NO se vuelve a mostrar**

---

## 3. Configurar webhook (delivery events)

Los webhooks le dicen al Studio cuándo un email se entregó, rebotó,
abrió, etc. Esto permite que `/studio/mailing/logs` muestre estado real.

1. Dashboard Resend → **Webhooks** → **Add Endpoint**
2. URL: `https://dtdcargo.com/api/webhooks/resend`
   (en dev local: usar un túnel tipo ngrok o saltarse esto)
3. Events a suscribirse (todos):
   - email.sent
   - email.delivered
   - email.delivery_delayed
   - email.bounced
   - email.complained
   - email.opened
   - email.clicked
   - email.failed
4. Save · Resend genera un **Signing Secret** formato `whsec_xxxxxxxxxxxxxxxxxx`
5. Copy el secret — **NO se vuelve a mostrar**

---

## 4. Agregar env vars en Vercel (production)

Dashboard Vercel → Settings → Environment Variables:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=https://dtdcargo.com
```

Marca cada una para **Production** (y opcionalmente Preview).

Redeploy el proyecto desde Vercel para que las vars se carguen.

---

## 5. Agregar env vars en local (`.env.local`)

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Cuidado**: si `RESEND_API_KEY` está set en local, vas a mandar emails
> REALES desde tu máquina. Para evitarlo:
> - Opción A: comentar `RESEND_API_KEY` en local (mock mode)
> - Opción B: asegurar `mail_config.test_mode = true` para tu tenant (redirige
>   todos los emails a `internal_test_email`)

---

## 6. Actualizar `mail_config` en prod

Por defecto se seedea con `test_mode=true` apuntando a `comercial@dtdcargo.com`.
Cuando estés listo para mandar emails reales a clientes:

```sql
update public.mail_config
set
  test_mode = false,
  domain_verified = true,
  from_email = 'noreply@dtdcargo.com',
  from_name = 'DTD-Cargo'
where tenant_id = (select id from public.tenants limit 1);
```

---

## 7. Verificar que todo funciona

### Test #1 · Email de invitación
1. Andate a `/studio/usuarios`
2. Click "+ Invitar usuario" · ingresá tu propio email
3. Click "Generar link"
4. **Esperar**: el email te llega en < 1 min al inbox del email que pusiste
5. Verificar que el botón "Aceptar invitación" en el email apunta al link correcto

### Test #2 · Webhook delivery
1. Después del email del Test #1, esperar ~30 seg
2. Andate a `/studio/mailing/logs` (cuando se implemente la UI · Fase 3)
3. O via SQL:
   ```sql
   select status, delivered_at, opened_at, resend_message_id, error
     from public.mail_logs
     order by created_at desc
     limit 5;
   ```
4. Status debería ser `delivered` (después `opened` si abriste el email)

### Test #3 · Bounce automático
1. Invitar a un email inválido tipo `noexiste@dtdcargo.com.invalid`
2. Esperar ~1 min
3. En `mail_logs` → status debería pasar a `bounced`
4. En `mail_blacklist` → debería aparecer una fila auto-INSERT con
   `reason='bounce'`

---

## 8. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `mock_no_key` en `mail_logs.error` | `RESEND_API_KEY` no set | Agregar env var |
| `403 forbidden` desde Resend | Domain no verificado | Esperar DNS o verificar records |
| `/studio/debug` → Resend: «llave inválida o borrada · HTTP 401» | La `RESEND_API_KEY` del entorno se borró en Resend o está mal copiada | Crear una llave nueva en Resend y reemplazar la del entorno (SDD-0527) |
| `/studio/debug` → Resend: «llave solo de envío · el correo entrante de Conversaciones no funcionará» | Llave «Sending access»: envía, pero no puede bajar los correos entrantes | Nada, si no se usa el correo entrante; si se usa, llave con Full access |
| `/studio/debug` → Resend: «acceso completo · N dominio(s) verificado(s)» | Llave con Full access | Nada |
| `/studio/debug` → Resend webhook: «llave inválida o borrada · HTTP 401» (o 403) | La `RESEND_API_KEY` del entorno se borró, está inactiva o mal copiada | Crear una llave nueva en Resend y reemplazar la del entorno. Si la llave existe y es 403, puede estar suspendida: soporte de Resend (SDD-0533) |
| `/studio/debug` → Resend webhook: «secret configurado · llave solo de envío, no puede listar webhooks» | Llave «Sending access»: no puede leer la lista de webhooks | Confirmar en Resend → **Webhooks** que el endpoint existe y está activo |
| Webhook devuelve 401 | `RESEND_WEBHOOK_SECRET` mal copiado | Re-copy del dashboard |
| Webhook devuelve 503 | Secret no set en Vercel | Agregar env var + redeploy |
| Email llega pero no aparece en `mail_logs` | `resend_message_id` mismatch | Ver logs server-side |
| Email no llega pero `status=sent` | Spam folder | Pedir al destino que marque como no-spam |

---

## 9. Costos

Free tier de Resend:
- 3,000 emails/mes
- 100 emails/día
- 1 dominio verificado
- Sin límite de templates

Para DTD-CARGO V1 (1 admin + 3-5 usuarios) eso cubre **fácil 6-12 meses**.

Cuando pase del free tier:
- Pro: $20/mes · 50,000 emails/mes
- Business: $90/mes · 100,000 emails/mes

---

## 10. Archivos del código

- `lib/studio/mail/resend-api.ts` · cliente fetch + verify HMAC webhook
- `lib/studio/mail/send-email.ts` · helper genérico (lee template, render,
  blacklist, log, llama Resend)
- `app/api/webhooks/resend/route.ts` · handler webhook
- `scripts/seed-mail-templates.ts` · 9 templates oficiales
  (quote_sent, quote_accepted, invoice_emitted, invoice_overdue,
  shipment_created, shipment_arrived, customer_welcome,
  no_olvidar_recovery_requested, team_invitation)
- `lib/studio/welcome-email.ts` · helper específico para createClient
  (usa renderTemplate del send-email · backward-compat V1)

---

## 11. Próximos pasos

Una vez Resend esté configurado:

- **SDD-0036 Fase 5** desbloqueado: notificaciones email del Bug Reporter
  (bug resuelto + respuesta admin + critical alert)
- UI de templates en `/studio/mailing/templates` (Fase 3 SDD-0026)
- UI de logs en `/studio/mailing/logs` (Fase 3 SDD-0026)
- UI de reglas en `/studio/mailing/reglas` (Fase 3 SDD-0026)
