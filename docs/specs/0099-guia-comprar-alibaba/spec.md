---
sdd: "0099"
title: "Curso de bienvenida gratuito — Cómo comprar en Alibaba (guion + mini-videos + PDF)"
status: in-progress
author: "Claude Code (session context) + founder"
created: 2026-06-20
updated: 2026-06-20
supersedes: null
superseded_by: null
related: ["0088","0093","0074"]
confidencialidad: interno
---

# DTD-0099 — Curso de bienvenida gratuito "Cómo comprar en Alibaba"

> **Contenido** del curso de bienvenida GRATIS de la Academia (SDD-0093): un **guion maestro** + **~10
> mini-videos encadenables** + un **PDF descargable** + un **outline** para que `feat/academia` lo cargue.
> **Entrega = contenido + outline (hand-off).** NO se tocan las tablas `academy_*` ni el portal (carril de
> `feat/academia`); el contenido es DATA/DOCS que esa ventana inserta.

## Contexto

DTD quiere un **curso de bienvenida gratuito** que enseñe al cliente venezolano a comprar en Alibaba y —el
diferenciador— a **enviar su compra a la bodega DTD en Yiwu (China) usando su MARKBOX**, para que DTD la
traiga **puerta a puerta** a Venezuela. Es un **lead magnet**: jala al registro (MARKBOX) y a los cursos
**avanzados (pagos)** de la Academia.

Formato: **mini-videos** (clips cortos para redes — reel/short) que, encadenados, arman **un video grande**
completo. El mismo contenido alimenta el **PDF**.

## Fuentes + principios de adaptación

**Fuentes** (de Sam + repo): 2 videos de YouTube con transcripción TurboScribe (`ZZ33sQx87qc` creador ES ·
`s628PVIfAMQ` "Emilio", vendedor Amazon FBA), `MATRIZ_CONTENIDO_ALIBABA`, el `faq-knowledge-base.md` del
repo, el componente `components/AlibabaAddressGuide.tsx` (widget de dirección) y `CONTACT.cn`
(`lib/design-tokens.ts`, dirección Yiwu canónica).

**Adaptación (se ADAPTA, no se copia):**
1. **De-brandear** TODO el funnel de los creadores (agente "Nicole"/ebook del video 1; "academia/
   entrenamiento Amazon FBA"/canal del video 2). **Cero menciones a terceros/competidores.**
2. **Español de España → venezolano neutro, tuteo** (cero voseo). Localizar ejemplos a Venezuela.
3. **Recentrar en DTD**: *"tu dirección de entrega en Alibaba = NUESTRA bodega en Yiwu + tu MARKBOX"* (widget
   `AlibabaAddressGuide`); el tramo internacional + aduana + last-mile lo hace **DTD**.
4. **Ajuste DTD del flete:** donde los videos piden cotización **DDP/DAP a tu puerta**, nosotros pedimos
   **precio EXW + entrega a la bodega Yiwu** (flete interno China). DTD hace el resto.
5. Diferenciador vs competidores VE: ellos usan **casillero en Miami** (desvío) → DTD recibe **directo en
   Yiwu**. El MARKBOX = el "código de casillero" que el venezolano ya entiende.

## Estructura — ~10 mini-videos (encadenables)

0 Quita el miedo · 1 Cuenta Alibaba (+ registro DTD/MARKBOX) · 2 Buscar (inglés/imagen/filtros/IA) ·
3 Proveedor seguro (Verified + Trade Assurance + años + reviews) · 4 Fabricante vs trading company ·
5 **El correo paso a paso** (EXW/muestra/logo/empaque/lead time) · 6 Pedir muestras (3-5) · 7 Pago seguro
(escrow) · 8 ⭐ **Paso DTD: dirección = bodega Yiwu + MARKBOX** (widget) · 9 Seguimiento + llega al almacén
+ cierre (→ registro + cursos avanzados).

## Entrega (mi carril — contenido/docs)

- `assets/guia-comprar-alibaba.md` — guion maestro (fuente **narrativa** del texto → mini-videos + base del PDF).
- `assets/guion-mini-videos.md` — los ~10 mini-videos (gancho + contenido + CTA + texto en pantalla).
- `assets/guia-comprar-alibaba.html` — **print-master DTD-branded** (tokens de marca + Google Fonts + Noto Sans
  SC para el CJK; logos vía tokens `__LOGO_*__`); es la fuente del PDF.
- `scripts/build-guia-pdf.mjs` — renderiza el HTML a PDF con **Chromium headless (Playwright)**. Inyecta los
  logos como base64 y espera `document.fonts.ready` (el chino renderiza sin cuadritos). Flag `--png` =
  screenshots de control. Se corre directo: `node scripts/build-guia-pdf.mjs`.
- `assets/guia-comprar-alibaba.pdf` — PDF descargable del curso, **generado del HTML** (reemplaza al de
  `make-pdf`, que no permite temática de marca). A4, ~9 págs, logo + wine/navy/cream + tabla de dirección Yiwu.
- `assets/outline-curso-academia.md` — módulos/lecciones para `feat/academia` (tier=`gratis`, `free_preview`,
  `widget='alibaba_address'`, `video_url`, `asset_path`).

## Fuera de alcance

- Tablas `academy_*` + portal `/portal/academia` → **carril `feat/academia`** (yo solo entrego contenido).
- Idea de warehouse/fulfillment en Valencia (ref `gobeeping.com`) → **otra sesión** del founder.
- Cédula→RIF, pagos, white-label.

## Criterios de aceptación

- [ ] Guion maestro + mini-videos + PDF + outline, de-brandeados, en venezolano tuteo, centrados en DTD.
- [ ] El "paso DTD" (dirección Yiwu + MARKBOX, EXW no DDP) es el clímax y reusa el widget existente.
- [ ] **Cero menciones a competidores/terceros**; solo marca/tokens DTD en el PDF.
- [ ] Funnel: cada mini-video/cierre → registro (MARKBOX) + teaser a cursos avanzados.
- [ ] `docs:check` verde; `ui-ux-designer` revisó el PDF. Commit en `feat/guia-comprar-alibaba` (sin push).
