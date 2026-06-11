-- ─────────────────────────────────────────────────────────────
-- Brand v3.7 (2026-06-10): el término visible es "Shipping Mark" en TODOS los
-- contextos — MARKBOX queda SOLO como identificador interno (slug, columnas,
-- variables). Además, el body seedeado por 0026 tenía voseo ("respondé",
-- "Usalo") — barrido a tuteo venezolano (regla founder).
--
-- UPDATE idempotente del template `welcome_markbox` para todos los tenants.
-- El slug y las variables NO cambian (identificadores internos, regla v3.7).
--
-- Usado por:
--   - sendWelcomeEmail (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--   - registro self-service (app/registro/actions.ts)
-- ─────────────────────────────────────────────────────────────

update public.mail_templates
set
  name = 'Bienvenida Shipping Mark',
  subject = 'Bienvenido a DTD Cargo · tu Shipping Mark es {{markbox}}',
  body_html = $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu Shipping Mark:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Úsalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja (Shipping Mark / 唛头) antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → responde a este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>$html$
where slug = 'welcome_markbox';

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox (nombre visible "Bienvenida Shipping Mark", brand v3.7) seedado por SDD-0032; body actualizado por 0120 (Shipping Mark + tuteo).';
