# Guía de verificación — Reestructuración del sitio público (SDD-0064)

> Checklist vivo. Cada fase se da por cerrada solo cuando pasa **todos los chequeos transversales** + los específicos de su fila. Marcar `[x]` al cerrar. Rama `feat/servicios-detalle-publico`, sin push sin OK del founder.

## Chequeos transversales (aplican a TODA fase antes de cerrarla)

**Mensaje**
- [ ] "Puerta a puerta" es el protagonista; "DDP" solo aparece como aclaración técnica secundaria (nunca abre hero/CTA/meta/H1).
- [ ] Cero "sin intermediarios / 0 intermediarios / no somos intermediario / intermediario remoto".
- [ ] Cero promesas absolutas: "cero sorpresas/estafas/burocracia", "garantizamos", "siempre/nunca".
- [ ] "Financiamiento 100%" siempre acompañado de "sujeto a aprobación" (gancho + condición).
- [ ] Año de empresa = 2008 en todo claim (2010 = carga formalizada, 2015 = Venezuela, solo como hitos).

**Marca y voz** (ver `BRAND.md`)
- [ ] Solo tokens `var(--color-*)` / clases brand; cero hex inventado.
- [ ] Solo fuentes Archivo / Archivo Black / JetBrains Mono / Noto Sans SC.
- [ ] Marca editorial = "DTD Cargo" (no "DTD CARGO"/"DTDCARGO"/"DTD·CARGO").
- [ ] Voz tuteo VE, sin voseo (`-á/-é/-í` imperativo, vos/sos/tenés).
- [ ] Cero AI slop (gradientes coloridos, emojis decorativos, glassmorphism); SVG del set, no emoji.

**Coherencia web ↔ FAQ**
- [ ] Lo que dice la web coincide con `lib/faqs.ts` y con el FAQ de Kommo (`docs/specs/0062/.../faq-knowledge-base.md`).
- [ ] Aéreo de carga = suspendido; courier de muestras/documentos = activo (distinción clara).
- [ ] Tránsito = "60-90 días puerta a puerta" (no 30-45/30-40).
- [ ] Datos CN del Excel (dirección, partner, emails) = NO publicados hasta verificación founder↔Claude.

**Técnico**
- [ ] `node node_modules/typescript/bin/tsc --noEmit` → 0.
- [ ] ESLint (incluye frontera público↔ERP) → 0.
- [ ] `node scripts/verify.mjs` → verde.
- [ ] Render sin errores de consola (preview) en las páginas tocadas.

**SEO/GEO** (cuando aplique a la fase)
- [ ] Meta title/description con "puerta a puerta" como gancho.
- [ ] JSON-LD válido (Organization/LocalBusiness/Breadcrumb/FAQPage/Service según página).
- [ ] `public/llms.txt` coherente con el mensaje vigente.

**QA**
- [ ] Desktop OK · [ ] Mobile (<640px) OK · [ ] CTAs a WhatsApp con mensaje correcto.

---

## Por fase

### Fase 0 — Spec + guía + inventario
- [x] SDD-0064 creado · [x] esta guía · [x] inventario file:línea (46 cambios)

### Fase 1 — Mensaje base
- [x] 46 cambios aplicados (DDP→secundario · frases absolutas/intermediarios fuera · financiamiento reencuadrado · voseo · marca editorial)
- [ ] Chequeos transversales verdes
- [ ] OK founder

### Fase 2 — Home (requiere OK de copy)
- [ ] Hero "Importa desde China hasta tu puerta en Venezuela"
- [ ] Barra de confianza: Puerta a puerta · Aduana e impuestos gestionados · MARKBOX · Tracking en vivo · Equipo en Yiwu y Valencia
- [ ] Sección "¿Qué significa puerta a puerta?" (primero concepto, luego DDP)
- [ ] Tabla de transparencia (incluye / puede variar / no aplica)

### Fase 3 — MARKBOX
- [ ] Sección "MARKBOX: tu carga identificada desde China hasta Venezuela" + flujo 8 pasos
- [ ] Encuadre como sistema de marcaje (shipping mark / 唛头), no "código interno"

### Fase 4 — Taxonomía + /servicios
- [ ] Taxonomía aprobada (principal/complementario/mínimo + etapa)
- [ ] /servicios reconstruido por etapa + fichas (entrevista por tandas)

### Fase 5 — Estimación / calculadora / tracking / registro
- [ ] Copy puerta a puerta + privacidad visible en registro + estados de tracking

### Fase 6 — SEO/GEO
- [ ] "Respuesta rápida" por página + JSON-LD + páginas por ciudad; páginas nuevas al final

### Fase 7 — Confianza + QA final
- [ ] Prueba real (fotos/testimonios del founder) + QA completo desktop/mobile/SEO/marca
