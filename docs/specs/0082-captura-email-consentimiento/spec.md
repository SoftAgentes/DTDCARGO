---
sdd: "0082"
title: "Captura de email + consentimiento de marketing (implementa SDD-0062 Slice D)"
status: in-progress
author: "Claude Code (ventana crm-email-captura) + founder"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0062", "0026", "0042", "0046", "0078"]
confidencialidad: interno
---

# DTD-0082 — Captura de email + consentimiento de marketing

> Implementa el **Slice D de SDD-0062**: la BASE para hacer email marketing legalmente. Trackea el
> consentimiento, captura el opt-in donde el email entra al ERP, centraliza la validación/dedup de
> email y deja el evento de reactivación cableado. **Cero escritura a Kommo. Cero envío automático.**

## Contexto

El motor de mailing (SDD-0026, Resend) ya existe. El embudo de Kommo es un cementerio y el canal
correcto para reactivar a los dormidos es **email** (sin ventana de 24h ni riesgo de ban). Pero hoy:
- Solo **5,5%** de los contactos tiene email (techo de reactivación).
- **No hay columnas de opt-in** en `clients` (la `0117` que proponía SDD-0062 nunca se creó; 0117 fue
  otra cosa).
- Mandar marketing sin **consentimiento + unsubscribe** es riesgo legal.
- El email se guarda **sin validar ni canonicalizar** en varias rutas de alta.

> **Reality-check (founder 2026-06-14):** el blast al cementerio NO es viable hoy — además del 5,5%,
> el espejo **no linkea lead↔contacto**, así que ni se puede targetear a los leads dormidos. Por eso
> este slice construye la **base de captura/consentimiento**, no el envío. Crecer el 5,5% pasa por dos
> gates fuera de este código: **WhatsApp Flow de captura en Kommo** (config) y **Sign-in-with-Google**
> (Supabase Auth, open question #9 de SDD-0062).

## Alcance (esta ventana)

1. **Migración `0134`** — consentimiento trazable en `clients` (aditiva, nullable, hereda RLS por
   `tenant_id`; sin policies nuevas, estilo `0108`):
   - `email_marketing_optin_at timestamptz` · `email_optin_source text` ·
     `whatsapp_marketing_optin_at timestamptz`.
   - Índice parcial `clients_email_optin_idx` para el segmento alcanzable (con email + opt-in, vivo).
2. **`lib/studio/email-utils.ts`** — `EMAIL_RE` (fuente única) + `isValidEmail` + `canonicalizeEmail`
   (trim+lower+valida→`null` si inválido) + `EmailOptinSource` (unión TS, validación en app, no CHECK).
   Reusa `normalizeEmail` de `estimado-linking.ts` (no se mueve). Testeado.
3. **Captura de opt-in en `/registro`** — checkbox **explícito** (default OFF) de consentimiento de
   marketing. Si marcado → `email_marketing_optin_at = now()`, `email_optin_source = 'portal_register'`.
   Email transaccional (welcome/factura) NO depende del opt-in.
4. **Unsubscribe** (prerequisito legal) — token HMAC server-side (`EMAIL_UNSUBSCRIBE_SECRET`, fallback
   a `SUPABASE_SERVICE_ROLE_KEY` → sin gate nuevo) + API route pública `GET /api/email/unsubscribe`
   que verifica el token y **revoca SOLO el consentimiento de marketing** (limpia
   `email_marketing_optin_at`). **NO toca `mail_blacklist`** a propósito: esa lista bloquea TODO envío
   (incl. transaccional), y la baja es de marketing — el sender de campañas filtra por el opt-in. Cero
   anon SQL, cero RPC.
5. **Evento `lead_dormant_reengagement`** cableado (migr `0135` enum `mail_rule_event` + tipo TS en
   `mail-types.ts` + plantilla seed con footer de unsubscribe). **Sin sender** — un admin puede crear la
   regla; el envío real es follow-up.

## Fuera de alcance (diferido)
Envío/campaña real · link lead↔contacto en el sync (para alcanzar el cementerio) · WhatsApp Flow en
Kommo · Sign-in-with-Google · dedup duro por email (no se agrega unique a `clients.email`: data viva
puede tener duplicados legítimos; el dedup es por canonicalización + chequeo en app).

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. tests de `email-utils` + unsubscribe token).
- [ ] `pnpm build` (turbopack) verde.
- [ ] Migr `0134`/`0135` quedan como ARCHIVO en la rama (no aplicadas a prod).
- [ ] `/registro` captura el opt-in; el alta sigue funcionando sin marcarlo.
- [ ] `GET /api/email/unsubscribe?token=…` con token válido → opt-out + blacklist; token inválido → 400.
- [ ] Cero escritura a Kommo · frontera público↔ERP intacta.

## Gates para coordinación / founder
- Aplicar migr `0134` + `0135` a prod (con los 2 skills Supabase + advisors).
- (Opcional) setear `EMAIL_UNSUBSCRIBE_SECRET` en prod (si no, usa el service-role key).
- Decidir **Sign-in-with-Google** y el **WhatsApp Flow** de Kommo (crecer el 5,5%).
- Crear la regla de mailing + construir el sender de la campaña (otro slice).
