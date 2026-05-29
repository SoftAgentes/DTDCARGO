-- ─────────────────────────────────────────────────────────────
-- SDD-0032: Seed del template "Bienvenida MARKBOX" (welcome_markbox)
--
-- Upsert idempotente del template para todos los tenants existentes.
-- Si más tenants se crean después, agregar trigger o seed en alta de tenant.
--
-- Usado por:
--   - sendWelcomeEmailAction (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--
-- Schema base: mail_templates (SDD-0026, migración 0018_mailing.sql).
-- ─────────────────────────────────────────────────────────────

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
      'Bienvenido a DTD Cargo · tu código es {{markbox}}',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu código MARKBOX:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Servicio puerta a puerta China-Venezuela</p>
</div>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox seedado por SDD-0032 para email de bienvenida automático al crear cliente con email.';
