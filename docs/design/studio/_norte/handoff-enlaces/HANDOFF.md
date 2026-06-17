# Handoff a Producción · Hub de Enlaces (link-in-bio de Instagram) · DTD Cargo

> **Para Claude Code / Norte.** Este paquete contiene el **link-in-bio oficial** de DTD Cargo
> (el "linktree" que va en la bio de Instagram). Es **activo de marca**, no módulo de producto.
> Antes de tocar estilos validá contra `CLAUDE.md` (tokens, fuentes, sin AI slop).

---

## 1 · Qué es

Página **mobile-first** que agrupa todos los enlaces de DTD bajo **una sola URL** (Instagram
solo permite un link en la bio). Diseño inmersivo: hero navy con foto real + isólogo `reverse`,
wordmark "DTD Cargo", tagline de marca, CTA primario a WhatsApp y accesos rápidos.

Reemplaza por completo las exploraciones anteriores (variantes A/B/C — **eliminadas**). Esta es
la **única** versión vigente.

## 2 · Dónde vive (ubicación en Norte)

- **Marca → Brand Hub · sección Mensajería/Redes** (índice de marca, junto a las plantillas
  sociales). No va en el Launcher de producto.
- Se publica en una **URL corta y estable**:
  - Recomendado: `dtdcargo.com/enlaces`  (o subdominio `link.dtdcargo.com`).
  - **Esa** URL es la que se pega en el campo "sitio web" de la bio de Instagram.
- Enlazar desde el Brand Hub para que el equipo lo encuentre y edite.

## 3 · Archivos del paquete

```
Enlaces · DTD-Cargo.html        ← la página (fuente)
erp/tokens.css                  ← tokens de marca (NO duplicar: usar el del repo)
assets/foto-contenedor-real.jpg ← foto del hero
assets/dtdcargo-isologo-reverse.png  ← isólogo sobre navy (hero)
assets/dtdcargo-isologo-primary.png  ← favicon / apple-touch-icon
assets/og-enlaces.png           ← preview social 1200×630 (og:image)
```

> En Norte, **reusar** el `erp/tokens.css` y los `assets/dtdcargo-isologo-*` que ya existen;
> no crear copias. Solo son nuevos: `Enlaces · DTD-Cargo.html`, `assets/og-enlaces.png` y
> (si aún no está) `assets/foto-contenedor-real.jpg`.

## 4 · Cómo se gestionan los enlaces (sin tocar el diseño)

Todo vive en el bloque **`CONFIG`** arriba del `<script>`:

- `PRIMARY` → el CTA grande (hoy: Cotizar DDP por WhatsApp).
- `LINKS[]` → accesos rápidos (icono, label, sub, href).
- `SOCIAL[]` → Instagram / TikTok / YouTube.
- Números de WhatsApp en `WA` (ventas / administración / crm).

Para agregar/quitar un enlace: editar el array. El render se reconstruye solo.

## 5 · Atribución (ya integrada)

- **WhatsApp** (`waLink`): el mensaje pre-cargado termina con
  `\n\n(Vía: dtdcargo.com/enlaces · <origen>)` → el CRM sabe de qué enlace vino el contacto.
- **Web** (`webLink`): añade UTM `utm_source=instagram&utm_medium=bio&utm_campaign=enlaces&origen=<…>`
  a los enlaces a `dtdcargo.com/...` → analítica del link-in-bio.
- Los enlaces locales del prototipo (`Portal del Cliente.html`) en producción apuntan a la URL
  real del portal (`dtdcargo.com/portal` o el rastreo). Ajustar al cablear.

## 6 · Preview social (og:image)

- `assets/og-enlaces.png` (1200×630) ya está hecho y referenciado en los meta `og:`/`twitter:`.
- Servirlo en la ruta **absoluta** `https://dtdcargo.com/assets/og-enlaces.png` (los crawlers de
  WhatsApp/IG/FB requieren URL absoluta; las relativas no se previsualizan).
- Si cambia la URL de hosting, actualizar `og:url` y `canonical` en el `<head>`.

## 7 · Analítica de clics (para producción)

El prototipo no trackea clics por sí solo. En producción, sumar **GA4** o **Plausible** y
disparar un evento por clic (los UTM ya etiquetan el origen). Esto da la única ventaja real que
tendría un Linktree de pago, sin costo recurrente ni marca de terceros.

## 8 · Guardrails de marca (no romper)

- Solo tokens `var(--*)` de `tokens.css`. Cero hex inventados.
- Fuentes: wordmark/tagline → **Archivo / Archivo Black** (capa branding). Cuerpo → tokens del
  sistema. **JetBrains Mono** para la URL/folios. Nada de Inter/Roboto/etc.
- Único gradiente permitido: navy → ink (el del hero). Sin gradientes coloridos, sin
  glassmorphism decorativo, sin emojis.
- Wordmark siempre **"DTD Cargo"** (dos palabras), nunca "DTDCARGO".
- Datos de contacto reales: RIF `J-50648869-8`, Av. Bolívar Norte 14 (Valencia),
  `info@dtdcargo.com`, `+58 241 414 7886`.

## 9 · Checklist de publicación

- [ ] Subir `Enlaces · DTD-Cargo.html` y servir en `dtdcargo.com/enlaces`.
- [ ] Subir `assets/og-enlaces.png` a la ruta absoluta y confirmar `og:image`.
- [ ] Reemplazar los `href` locales (`Portal del Cliente.html`) por las URLs reales.
- [ ] Confirmar handles de redes y números de WhatsApp en `CONFIG`.
- [ ] Poner `dtdcargo.com/enlaces` en la bio de Instagram (y TikTok/YouTube si aplica).
- [ ] Conectar GA4/Plausible para métricas de clic.
- [ ] Enlazar la pieza desde el Brand Hub (Mensajería/Redes).
- [ ] Registrar en el changelog de Norte (marca sincronizada · Hub de Enlaces).
