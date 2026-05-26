---
sdd: "0032"
title: "Críticos v1.5 + cross-links cliente · MARKBOX validation + email bienvenida + drawer cross-links"
status: approved
author: "founder"
created: 2026-05-25
updated: 2026-05-25
supersedes: null
superseded_by: null
related: ["0006", "0010", "0018", "0026", "0031"]
---

# DTD-0032 — Críticos v1.5 + cross-links cliente

> **Fase 3b del bundle Claude Design v1.6** (release v1.5 críticos +
> quick wins). 3 mini-features atadas al módulo `/studio/clientes`:
> validación de formato MARKBOX server-side, email de bienvenida real
> al crear cliente, y 2 cross-links nuevos en el detalle de cliente
> (Estado de cuenta + Etiquetas).
>
> El cuarto feature del bundle v1.5 (**QR queue real-time sync**) queda
> diferido a **SDD-0033** porque requiere crear el módulo `/studio/cola-qr`
> desde cero (no existe en el repo).

---

## 1. Resumen en una línea

Al crear un cliente desde `/studio/clientes`:
1. El form valida formato MARKBOX antes y después del RPC (defensive).
2. Si el cliente tiene email, se dispara `sendWelcomeEmailAction` que
   renderiza el template `m-05 · Bienvenida MARKBOX`, registra el envío
   en `mail_logs` (`status='queued'`) y deja el wire listo para Resend
   en V2.
3. El detalle del cliente muestra 2 botones nuevos: **"Etiquetas"**
   (link a `/studio/etiquetas?id={markbox}` · ya wireable desde SDD-0031)
   y **"Estado de cuenta"** (disabled placeholder · pantalla todavía no
   portada).

---

## 2. Scope

### Incluye

#### Schema (migración 0026)

- Seed/upsert del template `mail_templates` con `slug='welcome_markbox'`:
  - `name`: "Bienvenida MARKBOX"
  - `category`: `cliente`
  - `channel`: `email`
  - `subject`: `Bienvenido a DTD-Cargo · tu código es {{markbox}}`
  - `body_html`: HTML simple con saludo + MARKBOX en bloque destacado +
    explicación del uso + link al portal
  - `variables`: `['client_name', 'markbox', 'portal_link']`
  - `active`: true
- Se aplica a TODOS los tenants existentes (loop sobre `tenants`).
- Idempotente: `on conflict (tenant_id, slug) do nothing`.

#### Server-side helpers

- `lib/studio/markbox-utils.ts`:
  - `validateMarkboxFormat(code: string): boolean` — regex `/^DTD-\d{4,5}$/`
  - `MARKBOX_REGEX` exportada para reuso
- `lib/studio/welcome-email.ts`:
  - `renderTemplate(body: string, vars: Record<string, string>): string`
    — reemplaza `{{var_name}}` por valor.
  - `sendWelcomeEmailAction(client: { markbox, name, email })` —
    server action que:
    - Resuelve tenant del usuario logueado
    - Lee `mail_templates` slug='welcome_markbox' del tenant
    - Renderiza subject + body con vars `client_name`, `markbox`,
      `portal_link = 'https://portal.dtdcargo.com/{markbox.toLowerCase()}'`
    - Inserta en `mail_logs` con `status='queued'`, `template_slug='welcome_markbox'`,
      `to_email`, `subject`, `rendered_variables`
    - Devuelve `{ ok: true, log_id }` o `{ error }`
    - **NO envía email real** (V1 sin Resend). En V2 cuando esté configurado,
      pasar `status='sent'` + `resend_message_id`.

#### Wire en `createClientAction`

- Después del insert exitoso, si `input.email` está set:
  - Llamar `sendWelcomeEmailAction({ markbox, name, email })`
  - Failure no rompe creación (logueo + warning en `ClientActionState.warning`).

#### UI changes

- `ClientDetailClient`:
  - Agregar 2 botones ghost antes de "Editar cliente":
    - **"Etiquetas"** → `<Link href={'/studio/etiquetas?id=' + markbox}>` (nueva pestaña)
    - **"Estado de cuenta"** → button disabled con tooltip "Próximamente · SDD futuro"
- `ClientDrawer` (create mode): si la creación devolvió `warning`, mostrar
  banner amarillo "Cliente creado pero email de bienvenida falló: {warning}".

### Fuera de scope

- QR queue real-time sync → **SDD-0033** (módulo nuevo desde cero).
- Envío real via Resend → V2 (cuando esté configurado en `.env`).
- Pantalla "Estado de cuenta del cliente" → SDD futuro (port del
  estado-cuenta.jsx del bundle v1.1).
- HMAC en cookie del operario → V2 SDD futuro.

---

## 3. Decisiones de diseño

### D1 · Reusar `mail_logs` del SDD-0026, no crear `email_log` nuevo

El SDD-0026 ya seteó `mail_logs` con shape completo (template_id +
template_slug denorm + rendered_variables jsonb + status enum + resend
fields). Es exactamente lo que necesita la bienvenida. Cero migration
nueva para schema, solo seed del template.

### D2 · MARKBOX validator client-side defensivo, RPC sigue siendo source-of-truth

El RPC `next_markbox(tenant_id)` ya garantiza formato `DTD-NNNN` con
padding 4. Mi helper TS es **doble check defensivo** post-RPC: si el RPC
devuelve algo malformed (improbable), el frontend rechaza antes del
insert. Misma idea que el bundle v1.5 propuso.

NO replicamos `isMarkboxUnique` del bundle porque el constraint UNIQUE
`(tenant_id, markbox)` ya cubre el caso.

### D3 · Estado de cuenta disabled, no link a 404

La pantalla "Estado de cuenta detallado del cliente" del bundle vive en
`/nuevo/pantallas/estado-cuenta.jsx` standalone HTML. Portarla requiere
otro SDD (mocks ACCOUNT_PROFILES + integración con invoices/payments +
aging chart + 4 sub-secciones). Por ahora, botón disabled con tooltip
explicativo evita un link roto.

### D4 · Email de bienvenida no falla la creación de cliente

Si el cliente se crea pero el `sendWelcomeEmail` falla (template no
existe, error de DB, etc.), la creación queda OK y el founder ve un
warning en el UI. Nunca queremos perder un cliente porque falló el email.

### D5 · Sin Resend en V1

El SDD-0026 dejó el wiring de Resend pero no necesariamente configurado.
V1 de este SDD solo registra en `mail_logs` con `status='queued'`. Cuando
el founder configure `RESEND_API_KEY` en `.env`, basta cambiar el
`status='queued'` por una llamada real a la API y actualizar a `status='sent'`.

---

## 4. Schema (migración 0026_welcome_email_template_seed.sql)

```sql
-- Seed/upsert del template m-05 Bienvenida MARKBOX
-- Para TODOS los tenants existentes.

do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'welcome_markbox',
      'Bienvenida MARKBOX',
      'cliente',
      'email',
      'Bienvenido a DTD-Cargo · tu código es {{markbox}}',
      $html$<p>¡Bienvenido <b>{{client_name}}</b>!</p>
<p>Tu cuenta en DTD-Cargo está activa.</p>
<p><b>Tu código MARKBOX:</b> <code style="background:#FBFAF7;padding:4px 10px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace">{{markbox}}</code></p>
<p>Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén.</p>
<p><b>Acceso al portal:</b> <a href="{{portal_link}}">{{portal_link}}</a></p>
<p>Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px">DTD-Cargo · Servicio puerta a puerta China-Venezuela</p>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;
```

---

## 5. State del flujo

```
Admin abre /studio/clientes → "+ Nuevo cliente"
  → form completa (name, email, phone, tier, ...)
  → submit

createClientAction:
  1. validateClientInput (existente)
  2. resolve tenant_id (existente)
  3. next_markbox RPC → 'DTD-NNNN' (existente)
  4. validateMarkboxFormat(markbox) → defensive check
  5. INSERT clients (existente)
  6. if input.email:
       sendWelcomeEmailAction({ markbox, name, email })
         → SELECT mail_templates WHERE slug='welcome_markbox'
         → renderTemplate(subject, vars)
         → renderTemplate(body_html, vars)
         → INSERT mail_logs (status='queued', template_id, template_slug,
                             to_email, subject, rendered_variables)
       on error: state.warning = '...'
  7. revalidatePath('/studio/clientes')
  8. return { ok, createdMarkbox, warning? }

UI muestra:
  - Si warning: banner amarillo "Email no enviado: {warning}. Cliente OK."
  - Cliente nuevo en la lista con MARKBOX visible
```

---

## 6. Casos borde

| Caso | Comportamiento |
|---|---|
| Cliente sin email | sendWelcomeEmail no se llama. Creación OK silenciosa. |
| Template m-05 no seedeado en tenant | sendWelcomeEmail devuelve `{ error: "template no encontrado" }`. Cliente OK con warning. |
| Email inválido pasa validación TS pero RPC falla | sendWelcomeEmail devuelve error. Cliente OK con warning. |
| MARKBOX devuelto por RPC malformed (`DTD-X`) | `validateMarkboxFormat` rechaza. createClientAction devuelve error "MARKBOX inválido generado." (improbable defensivo) |
| Cliente creado pero pierde conexión antes del email | Cliente OK, email queda pendiente. V2: job que detecta clientes sin welcome_log y reintenta. |
| Click "Etiquetas" en cliente con markbox inválido | `/studio/etiquetas?id=XXX` cae al primer cliente del tenant con `console.warn` (cubierto por SDD-0031 §6). |

---

## 7. Open questions

1. **¿Resend ya configurado en `.env`?** Si sí, V1 puede enviar real. Si no, sigue queued.
2. **¿Falla del email es crítica?** Mi propuesta es warning silencioso. Alternativa: hacer un banner persistente en `/studio/mailing/logs`.
3. **¿Re-enviar bienvenida manual?** Botón en el cliente detail "Reenviar bienvenida". Útil pero V2.

---

## 8. Origen y trazabilidad

- **Bundle:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Briefs:**
  - `BRIEFS/03-markbox-validation.md`
  - `BRIEFS/04-email-bienvenida.md`
  - `BRIEFS/05-cross-links-cliente.md`
- **Source JSX:**
  - `source/erp/data-bridge.jsx` (helpers MARKBOX + sendWelcomeEmail)
  - `source/portal/registro.jsx` (consumer original)
  - `source/erp/modules/clients.jsx` (cross-links del drawer)
- **Releases:** v1.5 críticos + quick wins del sandbox.
