-- ─────────────────────────────────────────────────────────────
-- 0051: Brand v3.0 — wordmark canónico en mail_templates
--
-- La regla v3.0 canónica del wordmark es "DTD Cargo" (dos palabras
-- separadas por espacio, "Cargo" capitalizado). Los templates
-- seedeados en migraciones anteriores usaban "DTD-Cargo" (con
-- guion), formato no oficial que precedía al rebrand.
--
-- Esta migración es idempotente: aplica replace() solo a filas
-- que contienen el literal viejo. Re-corrida no hace nada.
--
-- ⚠ NO toca URLs `dtdcargo.com` ni el dominio en sí — solo el
-- wordmark de marca cuando aparece como texto.
-- ─────────────────────────────────────────────────────────────

update public.mail_templates
set subject = replace(subject, 'DTD-Cargo', 'DTD Cargo')
where subject like '%DTD-Cargo%';

update public.mail_templates
set body_html = replace(body_html, 'DTD-Cargo', 'DTD Cargo')
where body_html like '%DTD-Cargo%';
