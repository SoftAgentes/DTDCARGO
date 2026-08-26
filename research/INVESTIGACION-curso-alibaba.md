# Inventario — Curso "Cómo comprar en Alibaba" (SDD-0099)

> **Medido el 2026-08-25** contra `origin/main` (`2e477aba`) desde el worktree aislado
> `DTD-worktrees/curso-alibaba` (rama `research/curso-alibaba`). Todo lo de abajo se
> **midió** (grep del árbol entero + `git log` + `curl` a producción), no se recordó.
> Este documento es advisory: inventaría, no cambia nada.

## ✅ Qué se arregló el 2026-08-25 (rama `research/curso-alibaba`, sin pushear)

| # | Estaba | Quedó |
|---|---|---|
| 2.3 | PDF, print-master y guion maestro con la dirección pre-SDD-0264 (Destinatario `DTD Cargo - MARK`, Ciudad `义乌市`, sin Distrito) | Los tres al modelo medido: `林冠` + MARKBOX · Ciudad `金华市` · Distrito `义乌市` · `详细地址` · atajo de autorrelleno · aviso del rótulo físico. **PDF regenerado**: 9 → 12 págs |
| — | La dirección solo aparecía en el Paso 7, cuando ya ibas a despachar | **Tarjeta copiar-por-campo también en el Paso 1** (al crear la cuenta), con el MARKBOX compartido entre las dos |
| — | La guía no nombraba ni uno de los 20 servicios del catálogo | **10 bloques de servicio** en 7 etapas + sección completa en el PDF, con las 14 siglas de inspección |
| 2.9 | Cabecera con marcadores `{{...}}` que ya no aplicaban | Reemplazada por la nota real de dónde salen los datos |
| — | Pie: *"Puerta a puerta desde 2010"* — 2010 no es un claim de "operando desde" | *"En el comercio con China desde 2008, operando en Venezuela desde 2015"* |
| — | Copy con la palabra "responsabilidad" (regla del founder 2026-06-09) | "hasta dónde llega el servicio" |
| — | El checklist decía `DTD-XXXX` aunque el cliente ya hubiera escrito su mark | Token `{MARK}` sustituido en render |

**Verificación:** 16/16 asserts en verde con Playwright (recorrido completo de las 9 etapas), cero errores de
consola, y la tabla del PDF revisada contra captura. La dirección **no se cambió**: se auditó campo por campo
contra `CONTACT.cn` y los 10 coinciden, teléfono `18606891419` incluido.

**Sigue pendiente:** 2.1 (huérfana), 2.2 (0/6 del runbook), 2.4 (PDF sin distribuir), 2.5 (videos),
2.6 (curso gratis), 2.7 (`syncLead`), 2.8 (markbox al widget del portal) y el **"Tu foto aquí"** de 2.0.

---

## Resumen en una línea

El **contenido está completo y la guía interactiva está VIVA en producción** — pero
**nadie puede llegar a ella** (cero enlaces, cero sitemap), **no está enchufada a la
Academia** (los 6 pasos del runbook siguen sin hacerse), **los 10 mini-videos nunca se
grabaron** y el **PDF quedó con la dirección vieja que SDD-0264 declaró rota**.

---

## 1 · Lo que EXISTE (medido)

### 1.1 Contenido — `docs/specs/0099-guia-comprar-alibaba/assets/`

| Archivo | Tamaño | Qué es | Estado |
|---|---|---|---|
| `guia-comprar-alibaba.md` | 12,8 KB | Guion maestro, 10 pasos (0–9) + FAQ | ✅ completo · ⚠️ dirección vieja |
| `guion-mini-videos.md` | 8,6 KB | Los 10 mini-videos (gancho + contenido + CTA + texto en pantalla), 40–60 s c/u | ✅ completo · ❌ sin grabar |
| `guia-comprar-alibaba.html` | 28,8 KB | Print-master DTD-branded (fuente del PDF) | ✅ existe · ⚠️ dirección vieja |
| `guia-comprar-alibaba.pdf` | 559 KB | PDF A4 ~9 págs, branded | ✅ existe · ⚠️ dirección vieja · ❌ sin distribuir |
| `outline-curso-academia.md` | 4,3 KB | Curso + 4 módulos + 11 lecciones para sembrar | ✅ completo · ❌ sin sembrar |

`scripts/build-guia-pdf.mjs` regenera el PDF desde el print-master con Chromium headless
(Playwright). Corre directo: `node scripts/build-guia-pdf.mjs`. **No** está en `package.json`.

### 1.2 La guía interactiva — `public/guias/comprar-en-alibaba.html`

**821 líneas, 114.744 bytes. VIVA en producción** — medido con `curl`:
`https://dtdcargo.com/guias/comprar-en-alibaba.html` → **HTTP 200, 114.744 bytes**
(byte por byte la misma que está en el repo).

Qué trae:

- **9 etapas** con insignias, candado, confeti y persistencia en `localStorage`
  (`dtd_guia_alibaba_v1`): Inicio · Registro · Buscar · Verificar · Negociar · Muestras ·
  Pago · A almacén · ¡Llegó!
- **Selector de perfil** al inicio: *Agente de compras* (bloques `PRO`) vs *Emprendedor*.
- **3 calculadoras embebidas**: CBM (volumen), Landed Cost (costo real puesto en VE) y
  Scorecard de proveedor.
- **Captura progresiva de lead**: perfil → nombre → WhatsApp, con opción de saltar.
- **Datos reales cableados**: WhatsApp CRM `584121668021`, dirección de Yiwu, email
  `info@dtdcargo.com`, teléfono CN `18606891419`.
- **Modo portal**: lee `?mark=` y `?name=`; sanitiza el mark (`A-Z0-9-`, antepone `DTD-`),
  precarga el campo MARKBOX, arma el Destinatario solo (`林冠 DTD-1042`) y saluda por
  nombre. Sin `?mark=` cae a modo público con `DTD-XXXX` + CTA a `/registro`.
- **Al día con SDD-0264**: la tarjeta de dirección copiar-por-campo trae los 10 campos con
  Ciudad = `金华市` (Jinhua), Distrito = `义乌市` (Yiwu), el atajo de "Rellenar
  automáticamente la dirección" y el aviso de que el rótulo físico lleva SOLO el MARKBOX.

### 1.3 Lo que sí está enchufado en el producto

- **`components/AlibabaAddressGuide.tsx`** — widget de dirección (otro artefacto, no la
  guía del curso). Montado en `/faq`, `/shipping-mark`, `/portal/proveedores` y en la
  lección con `widget='alibaba_address'` del portal.
- **Migración `0149`** habilita `academy_lessons.widget` con **un solo** valor permitido:
  `'alibaba_address'`.
- **`scripts/seed-academia.ts`** siembra 4 cursos; la lección *"Tu dirección de envío: la
  bodega DTD en Yiwu"* lleva el widget y `freePreview: true`.

---

## 2 · Lo que NO está construido

### 2.0 🔴 Hay un placeholder "Tu foto aquí" VIVO en producción

`public/guias/comprar-en-alibaba.html:540` pinta, en el **primer bloque de la primera
etapa** y al lado de *"Sam — DTD Cargo. Vivo entre China y Venezuela"*, un recuadro con el
texto literal **"Tu foto aquí"**. Verificado en vivo el 2026-08-25 leyendo el DOM de
`https://dtdcargo.com/guias/comprar-en-alibaba.html`. Es el arreglo más barato de toda esta
lista: una foto y un `<img>`.

### 2.1 🔴 La guía interactiva es una URL huérfana

`grep` de `comprar-en-alibaba` y de `/guias/` en **todo** `app/`, `components/` y `lib/`:
**cero resultados**. Tampoco está en `app/sitemap.ts` ni aparece en el
`sitemap.xml` de producción.

**Está viva y no hay una sola forma de llegar a ella sin conocer la URL de memoria.**

### 2.2 🔴 Los 6 pasos del runbook de la Academia: 0 de 6 hechos

`docs/runbooks/academia-guia-alibaba-interactiva.md` (escrito el 2026-06-21, actualizado el
2026-08-14) describe cómo enchufar la guía como lección. `grep alibaba_curso` en el árbol
entero devuelve **solo el runbook y los docs** — cero código, cero migración.

| Paso del runbook | Estado |
|---|---|
| 1 · Migración que suma `'alibaba_curso'` al CHECK de `academy_lessons.widget` | ❌ no existe |
| 2 · Tipos: `lib/studio/academia/types.ts` (`LessonWidget`) + `LessonSeed` | ❌ ambos siguen con `"alibaba_address"` solo |
| 3 · `components/AlibabaCursoGuide.tsx` (iframe) | ❌ el archivo no existe |
| 4 · Rama de render en el reproductor del portal | ❌ solo está la de `alibaba_address` |
| 5 · Sembrar la lección en `curso-0-guia-rapida` | ❌ el seed no la tiene |
| 6 · Subir el PDF a Storage + `asset_path` | ❌ ver 2.4 |

### 2.3 🔴 El PDF, el print-master y el guion maestro quedaron con la dirección ROTA

La guía interactiva se corrigió el **2026-08-14** (`344ddd98`, SDD-0264). Los otros tres
artefactos **no se tocaron desde el 2026-06-20** — y llevan justo el error que el founder
reportó: *"el cliente no puede terminar el formulario de Alibaba"*.

| Campo | PDF / print-master / guion (viejo) | SDD-0264 · medido contra el formulario real |
|---|---|---|
| `收货人` Destinatario | `DTD Cargo - [TU MARKBOX]` | **`林冠` + MARKBOX** (Alibaba exige chino) |
| `市` Ciudad | `义乌市` (Yiwu) | **`金华市`** (Jinhua) — Yiwu no aparece en ese selector |
| `区/县` Distrito | *no existe el campo* | **`义乌市`** (Yiwu) — obligatorio |
| `林冠` | figura como "contacto de bodega" | es el **nombre del destinatario** |
| Atajo de autorrelleno | — | falta |
| Aviso del rótulo físico (solo MARKBOX) | — | falta |

Archivos: `assets/guia-comprar-alibaba.html:382-388` · `assets/guia-comprar-alibaba.md:182-186`
· el PDF regenerado de ese HTML.

### 2.4 🔴 El PDF no se distribuye por ningún lado

Vive **solo** en `docs/specs/0099-guia-comprar-alibaba/assets/`. No está en `public/`, no
está en Supabase Storage, y **el reproductor del portal ni siquiera puede mostrarlo**:
`PortalLessonView.lesson` (en `lib/portal/portal-academy-queries.ts`) **no expone
`asset_path`** — la columna existe desde la migración `0144` y el Studio sí la lee
(`lib/studio/academia/queries.ts:31`), pero el portal la ignora. No hay botón de descarga.

### 2.5 🔴 Los 10 mini-videos: guionizados, nunca grabados

`grep` de `video_url` / `youtube` en el seed y en los assets del 0099: **cero**. El
reproductor del portal, sin `video_url`, pinta *"El video de esta lección estará disponible
pronto."* El catálogo de producción de video de marketing
(`docs/marketing/assets/produccion-videos-dtd.html`) es el de las infografías de servicios —
**los mini-videos del curso no están en ninguna cola de producción**.

### 2.6 🟠 El curso `comprar-en-alibaba` del outline nunca se creó

El outline pide un curso propio (`slug: comprar-en-alibaba`, `tier: gratis`, 4 módulos,
11 lecciones). El seed tiene otros 4 cursos (`curso-0-guia-rapida`, `curso-1-domina-yiwu`,
`curso-2-de-0-a-contenedor`, `masterclass-1688`) y **ninguno es ese**. La lección del widget
terminó dentro de `curso-1-domina-yiwu`, que es **`tier: "inicial"` (de pago)** — no en el
gratis. Además todos los cursos entran `status: 'proximamente'`.

### 2.7 🟠 `syncLead()` sigue siendo un `console.log`

`public/guias/comprar-en-alibaba.html:355-360`. La guía captura perfil, nombre, WhatsApp,
producto, resultados de las 3 calculadoras y la etapa máxima alcanzada — y **lo tira a la
consola del navegador**. El marcador `=== ENVIAR A SUPABASE/KOMMO ===` está puesto; el
endpoint no. Se dispara en 9 eventos distintos (`perfil`, `contacto_guardado`,
`contacto_skip`, `cbm`, `landed`, `scorecard`, `etapa_completada_N`).

### 2.8 🟡 El widget de dirección del portal no recibe el MARKBOX

`app/portal/(app)/academia/[courseId]/[lessonId]/page.tsx:82` monta
`<AlibabaAddressGuide />` **sin props**, aunque el componente acepta `markbox`
(`components/AlibabaAddressGuide.tsx:48`) y `/portal/proveedores` sí se lo pasa
(`SuppliersClient.tsx:132`). El cliente logueado tiene que escribir a mano un dato que el
portal ya conoce.

### 2.9 🟡 Residuos y desfases menores

- La guía interactiva conserva en su cabecera (líneas 21-24) las instrucciones
  *"REEMPLAZA ESTOS MARCADORES `{{...}}`"* — ya no aplica, los datos están cableados.
- `public/guias/comprar-en-alibaba.html:337` muestra en la etapa Inicio la dirección como
  string único `浙江省义乌市…` — sin `金华市`. La tarjeta copiar-por-campo sí está bien;
  es solo el texto de presentación el que quedó con el modelo viejo.
- El índice SDD marca **0099 como `done`** aunque el runbook de integración esté 0/6, y
  **0264 sigue `in-progress`** aunque su corrección ya viajó a producción.
- La `MATRIZ_CONTENIDO_ALIBABA` que el spec cita como fuente **no está en el repo**.

---

## 3 · Rutas — todo en un lugar

```
docs/specs/0099-guia-comprar-alibaba/spec.md                       # el spec (done)
docs/specs/0099-guia-comprar-alibaba/assets/guia-comprar-alibaba.md    # guion maestro
docs/specs/0099-guia-comprar-alibaba/assets/guion-mini-videos.md       # los 10 videos
docs/specs/0099-guia-comprar-alibaba/assets/guia-comprar-alibaba.html  # print-master
docs/specs/0099-guia-comprar-alibaba/assets/guia-comprar-alibaba.pdf   # PDF
docs/specs/0099-guia-comprar-alibaba/assets/outline-curso-academia.md  # outline
docs/runbooks/academia-guia-alibaba-interactiva.md                 # el handoff, 0/6 hecho
docs/specs/0264-direccion-alibaba-en-chino/spec.md                 # la correccion de direccion
public/guias/comprar-en-alibaba.html                               # LA GUIA (viva, huerfana)
scripts/build-guia-pdf.mjs                                         # regenera el PDF
scripts/seed-academia.ts                                           # el seed de cursos
components/AlibabaAddressGuide.tsx                                 # widget de direccion
app/portal/(app)/academia/[courseId]/[lessonId]/page.tsx           # reproductor
lib/portal/portal-academy-queries.ts                               # queries del portal
supabase/migrations/0149_academia_lesson_progress.sql              # el CHECK del widget
```

## 4 · Historial

| Fecha | Commit | Qué pasó |
|---|---|---|
| 2026-06-20 | `31dd7da5` | Contenido del curso (guion + mini-videos + outline) |
| 2026-06-20 | `5617b887` | Print-master + PDF branded + `build-guia-pdf.mjs` |
| 2026-06-20 | `3a7df20d` | Guía interactiva DTD-branded (re-skin del prototipo v2) |
| 2026-06-21 | `6709b72c` | Guía servible en `public/guias/` + runbook de handoff |
| 2026-06-21 | `582db13a` | Insignias + candado + persistencia |
| 2026-06-21 | `506f3acd` | Dirección copiar-por-campo (espejo del FAQ) |
| 2026-06-21 | `27fc28bd` | MARKBOX automático por `?mark=` + saludo |
| 2026-08-14 | `344ddd98` | SDD-0264: dirección medida contra el formulario real — **solo en la guía interactiva** |

Desde el 2026-06-21 no se avanzó ni un paso de la integración con la Academia.
