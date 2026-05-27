# Brief · Email de bienvenida real (v1.5)

> Helper `sendWelcomeEmail(client)` que renderiza el template `m-05 · Bienvenida MARKBOX` con substituciones reales, persiste el envío al bridge para Mailing → Logs, y deja entry en audit log.

---

## Problema y para quién

Hasta v1.4 el flujo de registro mostraba un texto "te enviamos un email" pero **no enviaba nada** (era ficción visual). El template oficial `m-05` ya existía en `erp/data.jsx > MAIL_TEMPLATES` pero nadie lo disparaba.

**Resuelve:**
- Dejar trazabilidad real del envío (audit + Mailing Logs)
- Reusar el template oficial (que ya está aprobado en ES/EN/ZH)
- Stub que en prod se reemplaza por SMTP/SES/SendGrid sin tocar el frontend

### Roles servidos

| Rol | Acceso |
|---|---|
| **Cliente final** (portal registro) | Recibe el email (en mock solo persiste · en prod se manda real) |
| **Admin DTD-Cargo** | Ve el envío en Mailing → Logs (real-time, gracias a la subscribe del bridge) · ve entry en audit log |
| **Operaciones / compliance** | Auditoría completa: quién mandó qué a quién y cuándo |

---

## Flujo end-to-end

```
[1] Cliente completa portal/registro.jsx
    → click "Confirmar y generar MARKBOX"

[2] submit():
    a. nextMarkbox() → 'DTD-XXXX' válido
    b. bridge.clients.write([newClient, ...])
    c. sendWelcomeEmail(newClient)
       │
       ├─ Lee template m-05 de ERPData.MAIL_TEMPLATES
       ├─ Substituye {{client_name}}, {{markbox}}, {{portal_link}}
       │     (portal_link = `https://portal.dtdcargo.com/${markbox.lower}`)
       ├─ Crea entry { id, to, toName, template, templateName,
       │              subject, body, sentAt, status:'sent',
       │              markbox, channel:'email' }
       ├─ bridge.emailsSent.write([entry, ...prev].slice(0, 500))
       │     (cap de 500 entries)
       └─ Pushea audit log entry a dtd_audit_log_v1
             { id, ts, action:'auto', module:'Mailing',
               actor:{id:'system', name:'Sistema · auto'},
               target:{kind:'email', id, label},
               detail:`Email m-05 enviado a ${email}` }

[3] setEmailSent(!!entry) en el state del registro
    → UI cambia a card verde "Email enviado a {email}"

[4] Admin ve la subscription del bridge en Mailing → Logs:
    → window.DTDData.emailsSent.subscribe(cb)
    → cb mergea con seed mock
    → fila nueva al tope con "recién"
```

---

## Reglas de negocio

### Template `m-05 · Bienvenida MARKBOX`

Ya está en `erp/data.jsx` línea ~280 con:
- **Subject:** `Bienvenido a DTD-Cargo · tu código es {{markbox}}`
- **Body ES:**
  ```
  ¡Bienvenido {{client_name}}!

  Tu cuenta en DTD-Cargo está activa.

  **Tu código MARKBOX:** `{{markbox}}`

  Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja.

  **Acceso al portal:** [{{portal_link}}]({{portal_link}})

  Dudas o ayuda → respondé este correo.
  ```
- **Langs:** ES (default) + EN + ZH disponibles · el helper hoy solo usa ES

### Substitución de variables

Sintaxis `{{var_name}}`. El helper `renderTemplate(body, vars)` hace `body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] != null ? vars[k] : '{{' + k + '}}')`.

Si una var no existe en `vars`, se deja el placeholder visible para debug.

### Cap del log

El store `emailsSent` se capea a **500 entries** vía `[entry, ...prev].slice(0, 500)`. En prod el cap se mueve al backend con paginación.

### Audit log entry

Se escribe al mismo `localStorage` key (`dtd_audit_log_v1`) que el módulo Audit Log v1.1 usa. El módulo Audit Log no se incluye en este bundle (es v1.1 ya portado) pero la entry queda esperándolo.

Si Claude Code todavía no portó Audit Log: el helper hace `try/catch` defensivo, no falla aunque el key no exista.

---

## State machine

```
emailEntry.status:
  'queued' → 'sent' → 'opened' → 'clicked' (futuro tracking)
                   ↘ 'bounced' / 'failed' (rebote SMTP)
```

Hoy todos los entries se crean con `status: 'sent'` directamente. En prod habría delay async + status update vía webhook del proveedor SMTP.

---

## Permisos por rol

| Acción | Quién |
|---|---|
| Llamar `sendWelcomeEmail` | Sistema (auto) · admin (futuro · resend desde detail cliente) |
| Leer `emailsSent` | Admin · operaciones · compliance |
| Borrar entry | TODO: solo admin con sesión "modo seguro" desbloqueado (audit_log_v1 pattern) |

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Template m-05 no encontrado | `console.warn` + retorna `null` · el submit() sigue, solo `emailSent` queda false |
| Cliente sin email | Entry se crea igual con `to: undefined` (no crashea, pero queda inválido) · **TODO:** validar email en form |
| Cliente sin name | Vars fallback: `client.company` → `'cliente'` |
| Audit log no portado | `try/catch` silencioso · no afecta el envío |
| `clipboard` no disponible | N/A (este helper no usa clipboard) |
| Render template con var faltante | Deja `{{var}}` visible en el body (debug-friendly) |

---

## Dependencias

- **Lee de:** `window.ERPData.MAIL_TEMPLATES` (seed con template m-05)
- **Escribe a:** `window.DTDData.emailsSent` (bridge) + `localStorage['dtd_audit_log_v1']` (audit)
- **Llamado por:** `portal/registro.jsx` `submit()` (hoy) · futuro: admin crear cliente · resend manual

### TODO al portar a backend real

1. **SMTP real**: integrar SendGrid / AWS SES / proveedor configurado en `SMTP_PROVIDERS`. El helper queda como wrapper: llama al backend `/api/email/send`, backend hace el envío real, devuelve `entry`.
2. **Webhook status update**: backend recibe webhooks de bounces/opens del proveedor SMTP, actualiza `entry.status` en DB. Frontend re-renderea via subscribe.
3. **i18n**: hoy hardcodeado a ES. Detectar idioma del cliente (`client.lang` o navegador) y usar `template.body[lang]`.
4. **Adjuntos**: el template m-05 menciona "guía de nomenclatura adjunta" — actualmente no se adjunta nada. Generar PDF del bloque `Guide` de `registro.jsx` y adjuntarlo.

---

## Archivos

| Archivo | Líneas |
|---|---|
| `erp/data-bridge.jsx` | ~112-160 (helper + store) |
| `portal/registro.jsx` | ~80-100 (llamada + state) |
| `erp/modules/mailing-logs.jsx` | ~5-60 (lee del bridge) |
