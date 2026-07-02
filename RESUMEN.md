# RESUMEN · lane `enlaces-instagram`

**Rama:** `feat/enlaces-instagram` (off `main`) · **worktree:** `DTD-worktrees/enlaces-instagram`
**Commits (3):**
- `68e3f019` — `feat(enlaces): hub link-in-bio de Instagram → ruta pública /enlaces`
- `0e5e2c12` — `fix(enlaces): a11y del hub (wordmark, isólogo, RIF JetBrains Mono)`
- `721d1648` — `feat(enlaces): fila "Cómo llegar" — mapas nativos por plataforma`
**Estado:** ✅ listo para merge (NO pusheado — gate del Director).
**Review:** `ui-ux-designer` ✅ — port fiel del handoff, sin bloqueadores; contraste WCAG AA
en toda la superficie navy; sus fixes menores ya aplicados (commit `0e5e2c12`).

## Qué hice

Llevé a producción el **Hub de Enlaces** (el "link de la bio" de Instagram) que estaba
diseñado y aprobado en el Norte pero sin construir:
`docs/design/studio/_norte/handoff-enlaces/`.

Ahora vive en la ruta pública **`/enlaces`** — esa URL es la que se pega en el campo
"sitio web" de la bio de Instagram (y sirve para TikTok/YouTube).

## Archivos tocados (4 · commit selectivo)

- `app/enlaces/page.tsx` — **nuevo**. Server component standalone (sin nav/footer del sitio),
  navy inmersivo, mobile-first. Hero con foto + isólogo reverse + wordmark + tagline;
  CTA primario a WhatsApp; accesos rápidos (calculadora, portal, rastreo, atención, servicios,
  **Cómo llegar**); redes; footer NAP. Datos desde `lib/design-tokens` (CONTACT).
- `app/enlaces/MapsRow.tsx` — **nuevo**. Isla cliente para "Cómo llegar": abre mapas NATIVOS
  por plataforma (Apple Maps en iPhone/iPad, Google Maps con el pin verificado de DTD en el
  resto). SSR trae el pin de Google; en iOS el efecto reescribe el href sobre el DOM (sin
  setState). La página sigue estática.
- `app/globals.css` — **+1 bloque** `.enlaces-*` namespaced (patrón `.brochure-*`), tokens
  `var(--color-*)` + tokens locales de superficie navy (como `--hero-*` del portal).
- `public/brand/enlaces-hero.jpg` — foto del hero (copiada del handoff).
- `public/brand/og-enlaces.png` — preview social 1200×630 (copiada del handoff).

## Decisiones

- **WhatsApp único = 0412-166-8021** (`CONTACT.ve.whatsappRaw`), no el 0412-454-5325 del
  mock del handoff (decisión del founder en esta sesión). Ambos CTAs de WhatsApp usan el mismo
  número; el **origen** (`cotizar-ddp` / `atencion`) los distingue en el mensaje para el CRM.
- **Atribución:** WhatsApp → sufijo `(Vía: dtdcargo.com/enlaces · <origen>)` en el mensaje.
  Web → UTM `utm_source=instagram&utm_medium=bio&utm_campaign=enlaces&origen=<…>` para GA4.
- **Links reales** (no los `.html` del prototipo): `/calculadora`, `/portal`, `/track`, `/servicios`.
- **NAP** desde `CONTACT` (RIF, dirección, email, teléfono) — fuente única del sitio.
- **og:image absoluta** vía `metadataBase` → `https://dtdcargo.com/brand/og-enlaces.png` (los
  crawlers de WhatsApp/IG la exigen absoluta).

## Gates

- `tsc --noEmit` ✓ · ESLint (incl. frontera público↔ERP) ✓ · `next build` ✓ (exit 0).
- `/enlaces` se generó como **página estática** (`.next/server/app/enlaces.html`, 88 KB);
  og/twitter/canonical/theme-color verificados en el HTML.
- Frontera pública respetada: cero imports de `@/lib/studio` / `@/lib/db` / `@supabase/*`.

## Pendiente (secundario · post-merge, no bloquea la ruta)

- [ ] Poner `dtdcargo.com/enlaces` en la bio de Instagram (y TikTok/YouTube).
- [ ] Conectar el evento de clic a GA4 (`G-25CD7BZH98`) — los UTM ya etiquetan el origen.
- [ ] Enlazar la pieza desde el Brand Hub interno (Mensajería/Redes).
- [ ] Registrar en el changelog del Norte ("marca sincronizada · Hub de Enlaces").
- [x] Check `ui-ux-designer` — hecho; sin bloqueadores, fixes menores aplicados.

## Merge sugerido (lo hace el Director, con OK del founder)

```bash
# desde el repo principal, tras cerrar el push actual:
git merge --no-ff feat/enlaces-instagram
node scripts/verify.mjs && pnpm build
# luego push a main → Vercel prod
node scripts/harness-worktree.mjs finish enlaces-instagram --delete-branch
```
