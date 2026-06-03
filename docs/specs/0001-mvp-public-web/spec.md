---
sdd: "0001"
title: "Sitio web público MVP de DTD·CARGO"
status: done
author: "founder"
created: 2026-05-19
updated: 2026-06-02
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# DTD-0001 — Sitio web público MVP de DTD·CARGO

## 1. Resumen en una línea

Sitio multipágina público (`dtdcargo.com`) que convierte visitas en leads y permite a clientes existentes cotizar y trackear envíos contra el ERP HailuWay, en proyecto totalmente aislado del ERP.

## 2. Problema

DTD·CARGO opera carga DDP China → Venezuela desde 2008, apoyado en el ERP HailuWay, pero no tiene un sitio web propio. Dolores concretos:

- Prospectos llegan por WhatsApp en frío. El operador repite las mismas explicaciones a diario (DDP, inspección, tiempos, qué servicio elegir).
- Clientes existentes piden tracking por WhatsApp porque no hay un sitio donde meter su código BL / AWB / DTDU.
- Cero presencia comercial buscable. Cada cliente nuevo es por referido.

El sitio resuelve los 3 dolores de una.

## 3. Audiencia

- **Importador pyme/individual (Venezuela)** — Llega por Google, IG o referido. 90% móvil. No técnico, escéptico, evalúa confianza visual primero. Idioma: español Venezuela.
- **Cliente existente DTD·CARGO** — Ya envió antes. Vuelve solo para trackear o cotizar un envío nuevo. Quiere autoservicio rápido.
- **Operador DTD·CARGO (interno)** — Recibe leads del sitio en el CRM del ERP HailuWay. No usa el sitio público directamente.

## 4. User stories

- **Cuando** un prospecto entra a `dtdcargo.com` desde un anuncio de IG, **quiero** que en menos de 5 segundos vea "DE CHINA / A TU PUERTA. / SIN INTERMEDIARIOS." y los 5 servicios, **para** que entienda al instante qué hace DTD·CARGO.
- **Cuando** un prospecto quiere precio orientativo, **quiero** mostrarle un cotizador con origen (Yiwu, Guangzhou…) y destino (Puerto Cabello, Valencia…), **para** capturarlo como lead antes de que pida por WhatsApp.
- **Cuando** un cliente ya envió antes, **quiero** que pueda pegar su BL/AWB/DTDU en la home y vea su timeline (Inspección → Carga → Embarque → Tránsito → Arribo → Entrega), **para** no tener que escribirle al operador.
- **Cuando** un visitante envía un formulario de contacto, **quiero** que cree un lead en el CRM del ERP HailuWay y que reciba confirmación por WhatsApp Business, **para** que el operador lo trabaje sin doble carga.

## 5. Solución propuesta (alto nivel)

**Sitio Next.js 16 + Tailwind v4** desplegado en Vercel bajo `dtdcargo.com`, **en carpeta totalmente separada del ERP** (`~/Desktop/DTDCargo/`). Sin código compartido — solo HTTP a las APIs públicas de HailuWay.

**Páginas (MVP, 5 rutas):**

1. **`/` (Home)** — Hero ("DE CHINA / A TU PUERTA. / SIN INTERMEDIARIOS.") + buscador de origen→destino + cotizador inline + 5 servicios + cómo trabajamos (4 pasos) + tracking inline + footer.
2. **`/servicios`** — Detalle de los 5 servicios. Tiempos, qué incluye, cuándo elegir cada uno.
3. **`/cotizar`** — Cotizador completo (origen, destino, modo, peso, volumen, datos lead). Devuelve estimación y crea lead en el ERP.
4. **`/track/[code]`** — Tracking. Consume `GET {ERP}/api/public/track/[code]`. Acepta BL, AWB o DTDU.
5. **`/contacto`** — Oficinas Venezuela + China, WhatsApp directo, mapa, formulario backup.

**Catálogo de servicios (extraído del Brochure DTD Cargo China-Venezuela):**

14 servicios agrupados por sede ejecutora. Tagline oficial: **"Puente Logístico entre China y América Latina"**.

**🇨🇳 Yiwu, China — 8 servicios:**

| # | Servicio | Beneficio | Destacado |
|---|---|---|---|
| 1 | Reserva de contenedores FCL/LCL | Control total, precios competitivos | |
| 2 | **Consolidación en bodega Yiwu** | Optimización de espacio y costos | ⭐ |
| 3 | Chequeo de mercancía al recibir | Cero sorpresas a destino | |
| 4 | Verificación de proveedores | Mitigación de riesgo comercial | |
| 5 | Auditoría y control de calidad | Cumplimiento normativo | |
| 6 | Compra asistida | Ahorro de tiempo, acceso directo | |
| 7 | Asesoría en pagos | Seguridad financiera | |
| 8 | Registro de marca (CNIPA) | Protección legal anti-falsificación | |

**🇻🇪 Valencia, Venezuela — 6 servicios:**

| # | Servicio | Beneficio | Destacado |
|---|---|---|---|
| 1 | **DTD Services — Carga puerta a puerta (LCL)** | Promesa door-to-door cumplida | ⭐ (nacida 2015) |
| 2 | Gestión de trámites de visado chino | Cero burocracia | |
| 3 | Registro de marca CN (coordinación) | Tu marca protegida sin viajar | |
| 4 | Documentos de importación | Tu carga entra sin contratiempos | |
| 5 | Tránsito de aduana y desaduanaje | Nacionalización sin demoras | |
| 6 | Trámites logísticos nacionales (last mile) | Desde el puerto hasta tu puerta | |

Matriz cruzada de responsabilidades en `lib/design-tokens.ts` constant `SERVICES_MATRIX`.

**Cómo trabajamos (4 pasos):**

1. **Cotizá DDP** — Mandanos link de Alibaba o ficha del producto. Cotización cerrada en 24 hs incluyendo todo.
2. **Inspección** — Nuestro equipo en China visita fábrica, audita calidad y envía reporte fotográfico.
3. **Consolidamos** — Recogemos en fábrica, consolidamos en depósito Yiwu o Shenzhen y embarcamos.
4. **Entregamos** — Aduana e impuestos a nuestro nombre. Entregamos en tu puerta con factura final.

**Ruta principal:** China (**Yiwu**, **Guangzhou**, **Shenzhen**, **Ningbo**, **Shanghai**) → Venezuela (**Puerto Cabello**, **Valencia**, **Caracas**, **Maracaibo**).

**Historia (5 hitos, 2008 → 2016)** y **6 ventajas estratégicas de Yiwu** documentadas en `lib/design-tokens.ts` constants `TIMELINE` y `YIWU_ADVANTAGES`. Ambas secciones aparecen en home.

**Filosofía / tono de marca:** "Construimos nuestra reputación cliente a cliente. Sin campañas ruidosas, sin promesas exageradas: paso a paso, contenedor a contenedor." (Brochure § Nuestra Filosofía).

**Tracking states:** Inspección de fábrica → Carga en depósito → Embarque (ETD) → En tránsito → Arribo (ETA) → Entrega puerta (DDP cerrado).

**Integraciones (HTTP a HailuWay):**

- `GET {ERP}/api/public/track/[code]` — tracking (SDD-0008 del ERP, ya existe).
- `POST {ERP}/api/public/cotizar` — cotizador (a desarrollar en el ERP, **fuera de scope de esta spec**).
- `POST {ERP}/api/public/leads` — crea lead en CRM del ERP (a desarrollar en el ERP).
- WhatsApp Business API — botón flotante con `wa.me` + envío de confirmación post-cotización (webhook en el ERP, no en este sitio).

## 6. Sistema de marca (desde Brand Book DTD oficial)

Fuente canónica: [`_handoff_preview/dtd-cargo/project/Brand Book DTD.html`](../../../_handoff_preview/dtd-cargo/project/Brand Book DTD.html) (5139 líneas, 11 secciones: Sistema de marca, Construcción del logo, Flota, Uniforme, Papelería, Digital, Lockup bilingüe ES/中文, Corredor CN→VEN, Iconografía, Interacción & motion).

### Paleta (CSS custom properties)

```css
--wine:      #7F0F1A;   /* primary brand */
--wine-deep: #5E0A12;   /* hover/pressed */
--wine-soft: #C2747F;   /* accent, dark surfaces */

--ink:       #0F1E3D;   /* primary text + dark surfaces (navy) */
--grey-900:  #1F1F1F;
--grey-700:  #333333;
--grey-500:  #6B6B6B;   /* body secondary */
--grey-300:  #C9C5BE;
--grey-200:  #E8E6E2;   /* borders */
--grey-100:  #F2F0EC;   /* fills */
--paper:     #FBFAF7;   /* section alt background */
--white:     #FFFFFF;
```

### Tipografía

- **Display:** Archivo Black 900 (`'Archivo Black', sans-serif`), tracking `-0.025em`, line-height `0.92`.
- **UI / body:** Archivo 300-900 (`'Archivo', sans-serif`), system-ui fallback.
- **CJK:** Noto Sans SC 400-900 (para lockup bilingüe ES/中文).
- Carga vía Google Fonts.

### Brand mark

- Texto: `<span class="b-dtd">DTD</span><span class="b-cargo">CARGO</span>` — "DTD" en wine, "CARGO" en ink. Archivo Black, sin espacio, tracking -0.01em.
- Símbolo: ícono provisional `assets/dtdcargo-icon-navy.png` (38px × auto). **PENDIENTE versión final** (ver § 9 preguntas abiertas).

### Layout

- Max width: `1280px`
- Gutter responsive: `clamp(20px, 4vw, 64px)`
- Border radius: `8px` (botones), `14px` (search), `18px` (cards), `24px` (track-card hero)
- Breakpoints: `1200px`, `1080px`, `720px`

### Componentes documentados en el Brand Book

Hero · Search bar (origen+destino+CTA) · Marquee trust bar · Stats (4 KPI) · Services grid (4 o 5 cards) · Service card (light + dark variants) · Steps timeline (4 pasos) · Track card (input + timeline) · Brand board · Container app preview · Sidebar navigator (⌘K palette) · Footer 5-col.

## 7. Identidad operativa (datos reales)

**Slogan principal:** "DE CHINA / A TU PUERTA. / SIN INTERMEDIARIOS."
**Tagline corporativo (brochure):** "Puente Logístico entre China y América Latina"
**Eyebrow tagline:** "Logística end-to-end · Desde 2008"
**Diferenciadores:** Tarifa cerrada DDP · Inspección incluida · **Equipo propio en Yiwu & Valencia** (corregido vs Brand Book que decía "Yiwu & Guangzhou")

**Tono editorial:** **tú neutro latam** unificado en todo el sitio. NO usar voseo argentino (`cotizá`, `pegá`, `mandanos`) NI usted formal (`confíe`, `deje`, `su mercancía`). Usar: `cotiza`, `pega`, `envíanos`, `confía`, `deja`, `tu mercancía`.

**Stats (`STATS` en design-tokens):**

| # | Valor | Label | Fuente |
|---|---|---|---|
| 1 | `11 AÑOS` | Operando entre China y Venezuela | Calculado: 2026 − 2015 (expansión VE) |
| 2 | `9.4k+` | Contenedores DDP entregados | **TBD — número placeholder, founder debe confirmar** |
| 3 | `24 HS` | Cotización cerrada garantizada | Brand Book + brochure (promesa) |
| 4 | `2 BASES` | Equipo propio en Yiwu & Valencia | Brochure (corregido vs Brand Book) |

**Contacto:**

| Canal | Venezuela | China |
|---|---|---|
| Teléfono fijo | +58 241 414 7886 | — |
| WhatsApp | +58 412 166 8021 | — |
| Email sede | Vzla@dtdcargo.com | China@dtdcargo.com |
| Email general | info@dtdcargo.com (footer + /contacto) | |
| Instagram | @doortudoor_ (footer) — **inconsistencia con dominio dtdcargo.com**, ver §11 | |
| Dirección | Edificio Kokuy, Av. Bolívar Norte. Valencia, Carabobo. | Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11), Yiwu City. |
| Horarios | Lun a Vie · 8:00 – 17:00 GMT-4 | Lun a Sáb · 9:00 – 18:00 GMT+8 |

**Web canónica:** `www.dtdcargo.com` (brochure decía `doortudoor.com`, founder confirmó mantener `dtdcargo.com`).
**Código tracking ejemplo:** `DTDU-472816-22G1` (prefijo `DTDU`, formato `DTDU-XXXXXX-XX##`)

## 8. Criterios de aceptación

- [ ] `dtdcargo.com` responde HTTP 200 en `/`, `/servicios`, `/cotizar`, `/track/[code]`, `/contacto`.
- [ ] Home carga en < 2s en 4G móvil. Lighthouse Performance ≥ 90.
- [ ] Cotizador acepta inputs (origen, destino, peso/volumen, email/WhatsApp) y crea lead en el ERP vía `POST /api/public/leads`.
- [ ] Buscador de tracking acepta BL/AWB/DTDU y redirige a `/track/[code]` que consume el ERP.
- [ ] Los **14 servicios reales** del brochure aparecen en `/servicios` agrupados por sede (8 CN + 6 VE) con tabla cruzada. El home muestra 5 destacados (`SERVICES_FEATURED`).
- [ ] Los 4 pasos "Cómo trabajamos" aparecen tal como están en el Brand Book.
- [ ] Tono editorial unificado en **tú neutro latam** (cero voseo, cero usted). Verificable: `grep -nE "(Cotizá|Mandanos|Pegá|Confíe|Deje|Querés|necesitás|escribinos|Probá|Ingresá|Contactanos|Contanos|describí|consultá)" .` → 0 matches.
- [ ] Paleta exportada a `lib/design-tokens.ts` 1:1 desde el Brand Book (`--wine`, `--ink`, etc.).
- [ ] Fonts Archivo + Archivo Black + Noto Sans SC cargadas vía `next/font/google` (no `<link>` directo).
- [ ] Slogan hero idéntico al Brand Book.
- [ ] Botón WhatsApp flotante visible en todas las páginas → `wa.me/584121668021`.
- [ ] El sitio NO importa código de `hailuway-erp/`. Verificable: `grep -r "hailuway-erp" .` → 0 matches.
- [ ] El sitio NO se conecta directo a Supabase del ERP. `grep -r "@supabase" .` → 0 matches.
- [ ] El logo provisional `dtdcargo-icon-navy.png` está aislado en UN solo componente `<BrandMark />` — sustituible por el logo final con un único cambio de archivo.
- [ ] Responsive perfecto en móvil 375px.
- [ ] SEO mínimo: meta tags, OG image, sitemap.xml, robots.txt.

## 9. Fuera de alcance

- ❌ Portal de cliente con login (vive en el ERP o spec futura).
- ❌ Pagos online (cobro lo gestiona el operador fuera del sitio).
- ❌ Multi-idioma (solo español Venezuela). El lockup bilingüe ES/中文 del Brand Book es decorativo en MVP.
- ❌ Blog / SEO largo (fase 2).
- ❌ Calculadora aduanera detallada (fase 2).
- ❌ Cambios en el ERP HailuWay para exponer `cotizar` y `leads` — **requieren su propia spec en el repo del ERP**. Mientras tanto, mockear respuestas en el sitio.
- ❌ Implementar las secciones de Brand Book 03-Flota, 04-Uniforme, 05-Papelería en el sitio público (son material interno de identidad).
- ❌ Animaciones/motion de la sección 10 del Brand Book (fase 2 de polish).

## 10. Edge cases

- **Tracking no encontrado:** ERP devuelve 404 → página amigable "No encontramos tu código" con CTA WhatsApp.
- **ERP caído:** cotizador/tracking degradan a "intenta nuevamente o escríbenos por WhatsApp", nunca pantalla blanca.
- **Lead duplicado:** mismo email/WhatsApp en 5 min → ERP deduplica, sitio confía y muestra OK.
- **Rate limiting (429):** mensaje "intenta en unos segundos" + botón disabled 30s.
- **Volumen vs peso:** cotizador pide ambos. Peso volumétrico (factor 6000 aire / 1000 mar) lo calcula el ERP.
- **Sin JS:** páginas estáticas (`/`, `/servicios`, `/contacto`) renderizan sin JS. Cotizador y tracking requieren JS.
- **Logo provisional vs final:** el ícono actual no es lockup completo. Mientras llega el final, `<BrandMark />` muestra ícono + wordmark CSS ("DTD" wine + "CARGO" ink). Cambio futuro = reemplazar 1 archivo PNG/SVG.

## 11. Preguntas abiertas

**Resueltas** (cerradas con decisión del founder):

- [x] ~~Dominio:~~ → `dtdcargo.com` confirmado (es nuestro pero sin acceso DNS, ver tarea #16). Brochure decía `doortudoor.com` pero se descartó.
- [x] ~~WhatsApp Business:~~ → MVP usa `wa.me/584121668021`. API real para fase 2 (requiere webhook en ERP).
- [x] ~~Pricing público:~~ → Solo CTA "Cotiza", sin pricing público. DDP es variable, mostrar rango invita disputa.
- [x] ~~Sucursales físicas:~~ → Direcciones reales del brochure aplicadas (VE: Edificio Kokuy · CN: Yiwu Port Phase II).
- [x] ~~México:~~ → Excluido del sitio. Brochure menciona "China-VE-MX" pero founder decidió focus solo en VE.
- [x] ~~Cobertura LATAM:~~ → Backlog. Se mantiene "China-Venezuela" como puente principal. "Terrestre LATAM" del footer del Brand Book descartado.
- [x] ~~Años de trayectoria:~~ → `11 AÑOS` (desde 2015, expansión VE). Brand Book decía "17", brochure "15+", ambos se descartaron.
- [x] ~~Bases:~~ → `Yiwu & Valencia`. Brand Book decía erróneamente "Yiwu & Guangzhou".
- [x] ~~Tono editorial:~~ → Tú neutro latam. Brochure usaba usted formal, Brand Book mezclaba tú con vos.

**Abiertas** (bloqueantes o requieren input del founder):

- [ ] **Logo final SVG:** Sigue ícono provisional `dtdcargo-icon-navy.png` (37KB). Founder debe pasar el lockup vectorial. Hasta que llegue → omitir referencias visuales al logo cortado.
- [ ] **Número real de contenedores entregados:** Stat `9.4k+` es placeholder. Confirmar la cifra real con el founder, o reemplazar por otra métrica verificable.
- [ ] **Handle Instagram `@doortudoor_` vs dominio `dtdcargo.com`:** inconsistencia visible. ¿Migrar IG a `@dtdcargo_` (si está libre)? ¿O registrar `doortudoor.com` como redirect a `dtdcargo.com`?
- [ ] **Acceso DNS de `dtdcargo.com`:** dominio es nuestro pero no tenemos acceso al panel del registrador. Bloquea deploy productivo.
- [ ] **Endpoints públicos del ERP:** `POST /api/public/cotizar` y `POST /api/public/leads` requieren su propia spec **en el repo hailuway-erp** (no en este). MVP usa mocks. No bloquea lanzamiento.
- [ ] **DDP "todo incluido" vs "Tránsito de aduana" como servicio separado:** puede confundir al usuario. Aclarar en copy que el desaduanaje está incluido en el DDP estándar pero lo ejecuta la oficina Valencia operativamente.
- [ ] **Foto/video real del equipo Yiwu** para reemplazar ilustraciones SVG: mejora conversión (proof real) — opcional para MVP.

## 12. Apetito (Shape Up)

- **Apetito:** `Medium (1 semana)` — 5 páginas funcionales, integración tracking real, mocks para cotizador/leads, branding 1:1 del Brand Book, logo provisional reemplazable.

## 13. Métricas de éxito

- ≥ 30 leads/mes vía cotizador o form de contacto en 60 días.
- ≥ 50% de búsquedas de tracking resueltas en el sitio sin escalar a WhatsApp del operador.
- Lighthouse Performance ≥ 90 móvil.
- Bounce rate < 60% en home.
- Tiempo medio en sitio > 1:30 min.

## 14. Estado de assets del handoff

**Material en** [`_handoff_preview/dtd-cargo/`](../../../_handoff_preview/dtd-cargo/) (canónico, copia de `DTD-Cargo-handoff.zip`):

**Referenciados por el Brand Book HTML (úsense):**

- ✅ `project/assets/dtdcargo-icon-navy.png` (37 KB) — ícono provisional, en uso. **Reemplazar cuando llegue el logo final.**
- ✅ `project/assets/container.svg` (5.4 KB) — ilustración del contenedor para Hero.

**Huérfanos del HTML (referencia para diseñador, no usar en sitio):**

- 🟡 `project/assets/dtdcargo-icon-grey.png`, `dtdcargo-icon.png`, `dtdcargo-original.png` — variantes alternativas del ícono.
- 🟡 `project/uploads/*.png`, `*.webp` (27 archivos) — screenshots del proceso de diseño en claude.ai/design. Inservibles para producción.
- 🟡 `project/uploads/TC - Diseño post...LETRAS VINO.png` — render de referencia de letras en wine.

**Externos requeridos en runtime (no faltantes, dependencias):**

- Google Fonts: `Archivo`, `Archivo Black`, `Noto Sans SC` → migrar a `next/font/google`.

## 15. Registro de discrepancias Brand Book vs Brochure

Análisis cruzado entre `Brand Book DTD.html` (handoff de Claude Design, foco diseño) y `Brochure_DTD_Cargo_China_Venezuela.docx` (material comercial, foco contenido). Cuando hubo conflicto, se aplicó decisión del founder.

| # | Tema | Brand Book HTML | Brochure DOCX | Decisión aplicada | Severidad |
|---|---|---|---|---|---|
| 1 | Años de trayectoria | `17 AÑOS` (Stats) + "Desde 2008" (Hero) — inconsistencia interna | "Más de 15 años" | `11 AÑOS` desde 2015 (expansión VE) — refleja puente CN↔VE actual | 🔴 Alta |
| 2 | Bases del equipo | "Yiwu & Guangzhou" (Stats + Hero trust mark) | "Yiwu + Valencia" (oficinas) | `Yiwu & Valencia` (corregido) | 🔴 Alta |
| 3 | Contenedores entregados | `9.4k+` | No menciona | `9.4k+` placeholder con TODO para confirmar | 🟡 Media |
| 4 | Mercados | "China-LATAM" (genérico) + "Operando entre China y Venezuela" | "China — Venezuela — México" | Solo China-VE en el sitio (MX excluido por decisión del founder) | 🟡 Media |
| 5 | Dominio canónico | `www.dtdcargo.com` | `www.doortudoor.com` | `dtdcargo.com` (decisión del founder) | 🟡 Media |
| 6 | Email general | `Vzla@` / `China@` (sin general) | `info@doortudoor.com` | `info@dtdcargo.com` + se mantienen Vzla@ / China@ como sedes | 🟢 Baja |
| 7 | Handle social | (no menciona) | `@doortudoor_` | Se mantiene `@doortudoor_` — inconsistencia visible con dominio, pendiente decisión | 🟡 Media |
| 8 | Catálogo de servicios | 5 servicios "muestra" (Carga DDP, Agente, Inspección, Marca, Visa) | 14 servicios reales agrupados por sede (8 CN + 6 VE) | Los 14 reales del brochure en `/servicios`. Home muestra 5 destacados (`SERVICES_FEATURED`) | 🟢 Resuelto |
| 9 | DDP vs aduana | "DDP todo incluido" en hero | "Tránsito aduana" como servicio Valencia separado | Coexisten (DDP es modalidad estándar; desaduanaje lo ejecuta VE operativamente). Pendiente clarificar copy | 🟡 Media |
| 10 | DDP vs LCL | "Carga suelta DDP" (incoterm) | "DTD Services LCL" (modalidad de carga) | El servicio es **LCL DDP** — son complementarios. Copy actualizado a "Carga puerta a puerta (LCL)" | 🟢 Baja |
| 11 | Tono editorial | Mezcla tú + voseo argentino | Usted formal | **Tú neutro latam** unificado en todo el sitio | 🔴 Alta |
| 12 | Slogans | "DE CHINA / A TU PUERTA. / SIN INTERMEDIARIOS." | "Puente Logístico entre China y América Latina" + "Confíe en los que ya han recorrido el camino" | Los 3 coexisten: slogan publicitario (hero) + tagline (SEO) + cierre (Philosophy) | 🟢 OK |

### Reglas para resolver discrepancias futuras

Cuando aparezca contenido nuevo (brochure v2, ajustes del founder, etc.):

1. **Si el dato afecta** la operativa o las métricas reales → el **brochure** manda (es la fuente verídica del negocio).
2. **Si el dato afecta** la apariencia visual o el sistema de diseño → el **Brand Book** manda (es la fuente del lenguaje visual).
3. **Si afecta tono editorial** → criterio definido en §7 (tú neutro latam), independiente de las dos fuentes.
4. **Si afecta el alcance** (servicios, mercados, sedes) → última palabra del founder, documentar la decisión acá en §15.

---

**Status flow:** `draft` → `proposed` → `approved` → `in-progress` → `done`
**Una spec NO puede pasar a `in-progress` sin estar `approved`.**
