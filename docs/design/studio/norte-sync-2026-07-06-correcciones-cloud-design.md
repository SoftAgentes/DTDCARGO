# NORTE-SYNC · 2026-07-06 — Correcciones al Design System de Cloud Design

> **De:** Claude Code (repo `DTDCargo`) · **Para:** Cloud Design · **Vía:** el founder pega este doc tal cual.
> **Base auditada:** export del DS (`DTD-Cargo-Design-System.md`, `README.md`, `colors_and_type.css`, `ui_kits/`, `preview/`) contra la verdad del repo al 2026-07-06.

---

## 1 · Qué es esto y cómo usarlo

Auditamos tu Design System contra el código en producción y los docs canónicos del repo. Encontramos **14 discrepancias** (2 rojas que violan reglas duras del founder) y **4 hallazgos de contraste medidos** sobre tus propios tokens. Además, el repo acaba de incorporar a `BRAND.md` una capa nueva de **contraste & legibilidad** que tu DS no tiene — te la entregamos completa en la sección 5, lista para pegar.

Cómo usarlo:

1. Aplica las correcciones de las secciones 2–4 y 6. Cada una trae el formato **❌ DS dice → ✅ debe decir → 📎 fuente**. El texto de cada ✅ es final: cópialo tal cual.
2. Pega las ADICIONES de la sección 5 en tu material (son las mismas secciones que entran a `BRAND.md`, con ratios verificados dos veces).
3. Usa el checklist de la sección 7 como gate del próximo export del DS y del próximo NORTE-SYNC.

Prioridades: 🔴 viola una regla dura del founder · 🟡 desalineado con producción/canon · 🟢 mejora de precisión.

---

## 2 · Correcciones de NEGOCIO e identidad

### 2.1 🔴 Razón social incorrecta

- ❌ **DS dice:** "DTD CARGO · Doortudoor Services" presentado como razón social / legal name (`DTD-Cargo-Design-System.md:6` + `README.md:3`).
- ✅ **Debe decir:** quita el paréntesis "(razón social …)" por completo. Ese string es el **sello de marca del footer**, no la razón social legal — el propio código lo comenta: "NO es la razón social legal" (`lib/design-tokens.ts`, `CONTACT.legalName`). La razón social legal real existe, pero por regla del founder va **SOLO en el schema JSON-LD** del sitio (`legalName`/`taxID` en `app/layout.tsx`) — **nunca** en texto visible, piezas de diseño ni material de marca. Si necesitas dejar contexto en el DS, escribe exactamente: *"Razón social: solo en schema (JSON-LD) — no usar en piezas."* Recuerda además: **DoorTuDoor** = sello de herencia + nombre del ERP interno; no es parte de ningún nombre legal.
- 📎 Fuente: `docs/marketing/identidad.md:11-16,25-26` + `lib/design-tokens.ts:156-167`.

### 2.2 🟡 "Operando desde 2008" a secas + eyebrow/login desactualizados

- ❌ **DS dice:** "operando desde 2008, DDP puerta a puerta desde 2015" (`DTD-Cargo-Design-System.md:6` + `README.md:19-20`); kit front con eyebrow "Logística end-to-end · Desde 2008" (`ui_kits/front/components.jsx:72`); login ERP "De China a tu puerta · desde 2008" (`ui_kits/erp/app.jsx:40`).
- ✅ **Debe decir:** usa el matiz canónico de 3 fechas: **2008** = orígenes comerciales en China (fundación canónica) · **2010** = empresa de carga formalizada · **2015** = expansión a Venezuela / DTD Services LCL. El eyebrow del hero en producción es **"Logística China → Venezuela · Desde 2015"** (el año es el del corredor a Venezuela, decisión del founder 2026-06-13); el 2008 vive solo en el KPI "En el comercio con China desde 2008". Actualiza el eyebrow del kit front y el subtítulo del login ERP con ese criterio.
- 📎 Fuente: `docs/marketing/identidad.md:18` + `AGENTS.md:127` + `lib/design-tokens.ts:791-799`.

### 2.3 🟢 Módulos del ERP: "30+" → son 55 reales

- ❌ **DS dice:** el ERP tiene "30+ modules" (`README.md:43`, citando además una carpeta muerta como fuente).
- ✅ **Debe decir:** **"55 módulos en producción"**. Conteo real en `app/studio/(app)/`: 57 carpetas, de las cuales 2 son infra (`_actions/`, `_components/`) → 55 módulos reales (academia, admin, ajustes, bitácora, bugs, calendario, clientes, club, cn, cobranzas, cola-qr, contabilidad, conversaciones, costing, cotizador, dashboard, debug, despacho, dirección, documentos, embarques, etiquetas, facturación, fidelización, financiero-china, fiscal, gastos, inspecciones, inventario, kommo, leads, legal, mailing, marketing, menciones, mis-bugs, naviera, no-olvidar, nómina, operarios, órdenes-compra, órdenes-venta, proveedores, reclamos, rendiciones, reportes, resumen, seniat, servicios, tarifas, tesorería, tms, tracking, usuarios, ve).
- 📎 Fuente: conteo directo de `app/studio/(app)/` (57 dirs − 2 infra = 55).

### 2.4 🟢 Modelo de negocio incompleto: faltan los 4 productos y el copy DDP

- ❌ **DS dice:** lista 5 servicios (LCL, consolidación FCL, reserva FCL, aduana, transporte nacional) sin enmarcar los productos canónicos (`ui_kits/front/components.jsx:127-133`), y en todo el export no aparece el copy comercial DDP de cara al cliente.
- ✅ **Debe decir:** agrega al DS la sección de negocio con los **4 productos canónicos: consolidación · DDP · reserva FCL · terrestre**, con la nota **"LCL = 95% del negocio"**. Y la regla de copy DDP: de cara al cliente siempre **"Pagas al llegar"**; la palabra "prepago" va **SOLO** en Términos y Condiciones, nunca en piezas comerciales.
- 📎 Fuente: modelo de producto canónico del founder + regla de terminología DDP (memoria del proyecto; refleja el copy vigente del sitio).

---

## 3 · Correcciones de VOZ

### 3.1 🔴 Voseo permitido / "español rioplatense" — VIOLA regla dura

- ❌ **DS dice:** "español neutro venezolano/rioplatense. Voseo permitido donde encaje (vos, sos, arrancá, mirá)" (`DTD-Cargo-Design-System.md:27` + `README.md:53`), y tiene voseo REAL en copy del kit: "Cuando consolidás varios proveedores" (`ui_kits/front/components.jsx:129`).
- ✅ **Debe decir:** reemplaza la línea completa por: *"Idioma: español venezolano neutro, TUTEO (tú recibes / rastrea / cotiza / confirma). CERO voseo (nunca vos/sos/arrancá/mirá/cotizá) — regla dura del founder 2026-06-08."* Y corrige el copy del kit a: **"Cuando consolidas varios proveedores"**. El voseo es argentino, no se habla en Venezuela — cualquier aparición es un bug, no una opción estilística.
- 📎 Fuente: `BRAND.md:197` (sección ✍️ Voz) + `AGENTS.md:128`.

### 3.2 🟡 "MARKBOX" como etiqueta visible en la UI del ERP

- ❌ **DS dice:** el kit ERP muestra "MARKBOX" como label de columna, placeholder de búsqueda y texto del buscador global: "MARKBOX / DTDU", "Buscar por MARKBOX, empresa…", "Buscar embarques, clientes, MARKBOX…" (`ui_kits/erp/app.jsx:80,192,194` + `ui_kits/erp/shell.jsx:105` + `ui_kits/erp/README.md:13`).
- ✅ **Debe decir:** el split de terminología es por superficie (SDD-0065 + decisión Norte 2026-06-10): **web pública = "MARKBOX"** · **Studio / Portal / Móvil = "Shipping Mark"** como nombre visible (opcionalmente con 唛头 de cara al proveedor chino). En los kits ERP cambia todas las etiquetas visibles a **"Shipping Mark"** — **sin renombrar las claves de datos** (`markbox` sigue siendo el identificador interno en props/columnas/RPCs; tu `data.jsx` ya lo usa bien).
- 📎 Fuente: `BRAND.md:150` + `docs/design/studio/_norte/CLAUDE.md` § "Terminología · Shipping Mark".

---

## 4 · Correcciones de MARCA y diseño

### 4.1 🟡 Tagline con casing viejo "Con confianza,"

- ❌ **DS dice:** "Con confianza, de China a tu puerta." (c minúscula) en `DTD-Cargo-Design-System.md:8,35` + `README.md:8,61` + `ui_kits/front/components.jsx:74` + `ui_kits/erp/app.jsx:43` + `preview/type-display.html:8`.
- ✅ **Debe decir:** **"Con Confianza,"** con **C mayúscula** en TODAS las apariciones — casing oficial autorizado por el founder el 2026-06-05 ("Confianza" es palabra-valor de marca; aplica en UI, portal, emails, brand book, piezas sociales y metadata SEO). El sub-claim ("Construyendo confianza cliente a cliente…") sí sigue en minúscula — eso el DS ya lo tiene bien.
- 📎 Fuente: `BRAND.md:69-77` + `lib/design-tokens.ts:812,820`.

### 4.2 🟡 Sources del DS apuntan a rutas MUERTAS del repo

- ❌ **DS dice:** cita como fuentes `docs/design/studio/v1.7-claude-design/project/erp/*`, `public/marca/brand-book-v3.2.html`, `docs/design/brand-book/v3.0/` y `public/marca/erp/tokens.css` (`README.md:41,43,45` + header "Mirrors" de `colors_and_type.css:8` + `ui_kits/erp/README.md:4`). Ninguna existe — se eliminaron del working tree el 2026-06-10.
- ✅ **Debe decir:** fuentes vigentes: **`docs/design/studio/_norte/`** (Brand Book DTD **v4.5**; tokens ERP en `_norte/erp/tokens.css`, espejados en `app/studio/tokens.css`) · brand book publicado (con login) = `private/marca/brand-book-v4.5.html`. El book vigente es UNO solo: el de mayor versión en `_norte/`.
- 📎 Fuente: `BRAND.md:22-24` + verificación de existencia en el repo (las 4 rutas citadas = MISSING; existen `docs/design/studio/_norte/erp/tokens.css` y `private/marca/brand-book-v4.5.html`).

### 4.3 🟡 Hero del kit front congelado en copy pre-SDD-0064

- ❌ **DS dice:** hero viejo — H1 = tagline en 2 líneas "Con confianza, / de China a tu puerta.", subtítulo "Carga suelta DDP puerta a puerta, agente de compra en territorio, registro de marca y visa de negocios. Tu operación China-LATAM con un único responsable." y badge circular "360° / Puerta a puerta" (`ui_kits/front/components.jsx:73-78,99-100` + `DTD-Cargo-Design-System.md:35` + `README.md:61`).
- ✅ **Debe decir:** espeja el hero de producción (`HERO` en `lib/design-tokens.ts`):
  - **H1:** "Con Confianza," (línea 1, wine) + "desde China hasta tu puerta." (línea 2, ink).
  - **Subtítulo:** "Servicio puerta a puerta hacia Venezuela con recepción, inspección, consolidación, aduana, impuestos y entrega final coordinados por un solo equipo responsable."
  - **Microcopy DDP** (separado, bajo el CTA): "Aduana e impuestos gestionados según tu cotización (modalidad DDP)."
  - **Badge del contenedor:** "Puerta a puerta / China → Venezuela" — el "360°" abstracto se ELIMINÓ el 2026-06-13 porque no comunicaba nada.
- 📎 Fuente: `lib/design-tokens.ts:799-858` (`HERO.title` / `subtitle` / `microcopy` / `badge`).

### 4.4 🟡 Stats con claims que prometen más que producción

- ❌ **DS dice:** "24 HS · Cotización cerrada garantizada" · "11 AÑOS · Nos respaldan en Venezuela" · "18" hardcodeado · "Inspección gratis +20 CBM" (`ui_kits/front/components.jsx:94,111`).
- ✅ **Debe decir:** espeja `STATS` y `trustMarks` de `lib/design-tokens.ts`:
  - **"24 HS · Cotización inicial estimada"** — el DS promete un compromiso comercial ("cerrada garantizada") que la empresa no publica.
  - **"2015 · Operando en Venezuela"** — el formato doble-años ("11 AÑOS") se eliminó por confuso (auditoría ui-ux).
  - Los años de comercio con China se **calculan** (hoy 18, desde 2008) para que el KPI no quede viejo — en el DS documenta "calculado desde 2008", no un número fijo.
  - **"Inspección sin costo +20 CBM"** (no "gratis").
- 📎 Fuente: `lib/design-tokens.ts:845-849` (trustMarks) + `:866-896` (`aniosComercioChina()`, STATS).

### 4.5 🟡 Falta TODA la capa de contraste/legibilidad + tema oscuro fuera del archivo canónico

- ❌ **DS dice:** nada — no hay umbrales WCAG, ni lista de tokens que NO son texto, ni reglas de relleno+texto, ni paridad light/dark, ni scrim sobre imagen, ni "no solo color". Y `colors_and_type.css` (tu "single source of truth") **no incluye el bloque `[data-theme="dark"]`** — los dark tokens viven solo en `ui_kits/erp/index.html:21-34`, así que cualquier pieza que enlace solo el CSS canónico se queda sin tema oscuro.
- ✅ **Debe decir:** pega la sección ♿ completa de la sección 5.1 de este doc (misma que entra a `BRAND.md`) y **mueve el bloque dark a `colors_and_type.css`** con los valores correctos: espejo de `app/studio/tokens.css:130-180` (que a su vez espeja `_norte/erp/tokens.css`), incluyendo `--ink-mute` dark `#6E7896`, `--ink-inv`, bordes y semánticos dark.
- 📎 Fuente: `app/studio/tokens.css:130-180` + `docs/design/studio/_norte/erp/tokens.css` (`:root` + `[data-theme="dark"]`).

### 4.6 🟢 Nomenclatura de fuentes: `--f-display: 'Archivo' @900` vs `'Archivo Black'`

- ❌ **DS dice:** `--f-display: 'Archivo', system-ui, sans-serif` (weight 900) y `--f-brand-display: 'Archivo'`, con un comentario que aliasa Archivo@900 como "Archivo Black" (`colors_and_type.css:13-14,64,73-74`).
- ✅ **Debe decir:** armoniza a la declaración del repo: `--f-display: 'Archivo Black', 'Archivo', sans-serif`. Mismo resultado visual cuando Archivo@900 está cargada, pero si una pieza no la carga, el alias cae a **faux-bold** (el navegador engorda la regular) — la familia explícita evita ese riesgo. Si prefieres mantener el alias, documéntalo como equivalencia oficial en ambos lados; la declaración canónica sigue siendo la del repo.
- 📎 Fuente: `BRAND.md:142` + `app/globals.css:43` + `app/studio/tokens.css:120`.

### 4.7 🟢 El token `--danger` del DS no es el del sitio público

- ❌ **DS dice:** unifica `--danger: #A8323E` para ambas superficies y su header afirma "Mirrors: DTDCargo/app/globals.css" (`colors_and_type.css:8,56`).
- ✅ **Debe decir:** documenta el split: **marketing/web pública → danger `#C2353F`** (`--color-status-danger` en `app/globals.css` / `DTD.statusDanger` en `lib/design-tokens.ts`) · **ERP/Portal → danger `#A8323E`** (`app/studio/tokens.css`). Tal como está, una pieza de marketing generada desde el DS usaría el rojo equivocado. Alternativa: agrega un token aparte `--status-danger-web: #C2353F`.
- 📎 Fuente: `app/globals.css:31` + `lib/design-tokens.ts:37` + `app/studio/tokens.css:38`.

### 4.8 Hallazgos de contraste MEDIDOS sobre tus tokens (corrígelos en el próximo Norte)

Medimos con luminancia relativa WCAG 2.1 (`ratio = (L1+0.05)/(L2+0.05)`) sobre los tokens vigentes de `_norte/erp/tokens.css`. Estos 4 son accionables de tu lado:

#### 4.8.1 🔴 Focus ring en dark rompe WCAG 1.4.11

- ❌ **DS/Norte dice:** `:focus-visible { outline: 2px solid var(--wine); … }` sin distinción de tema (`_norte/erp/tokens.css:230`).
- ✅ **Debe decir:** en light pasa sobrado (wine `#7F0F1A` / bg-base = **10.13**), pero en dark el wine remapeado `#A8323E` da **2.79** sobre `--bg-base` y **2.26** sobre `--bg-surface` — el indicador de foco no llega al 3:1 de no-texto (WCAG 1.4.11). En dark el ring debe ser **`--wine-soft #D89AA4`** (7.93 sobre bg-base) o **`--ink`**. Y sobre el sidebar navy, wine es directamente invisible (**1.56**) — ahí el foco necesita otro token (p. ej. cream `#F2F0EC`).
- 📎 Fuente: `docs/design/studio/_norte/erp/tokens.css:230` + matriz verificada (sección 5.2).

#### 4.8.2 🔴 Badge warning en light es ilegible

- ❌ **DS/Norte dice:** patrón badge = texto `--warning #B8893A` sobre `--warning-bg rgba(184,137,58,.12)` (`_norte/erp/tokens.css:53-54`; tus kits lo replican).
- ✅ **Debe decir:** ese par compositado sobre blanco da **2.79** — falla hasta el umbral de texto grande, y los badges son texto chico (~10–12px). En light: success 3.83 e info 4.20 tampoco llegan a body; solo danger (5.61) y neutral (4.68) pasan. Opciones dentro del sistema: usar `--ink` como texto del badge (con el `*-bg` como relleno de estado + dot/ícono semántico), u oscurecer el texto del badge. En dark el mismo patrón sí funciona mejor (success 5.77, warning 5.50, neutral 5.43 pasan body).
- 📎 Fuente: `docs/design/studio/_norte/erp/tokens.css:53-54` + matriz verificada (sección 5.2).

#### 4.8.3 🟡 En dark, blanco sobre relleno semántico NO se hereda del patrón light

- ❌ **DS/Norte dice:** (implícito en los kits) texto blanco sobre rellenos semánticos, heredado del patrón light.
- ✅ **Debe decir:** los semánticos dark son pasteles claros: blanco/`--success` dark `#5BCFA0` = **1.93** ❌ · blanco/`--danger` dark `#E07785` = **2.94** ❌. El texto sobre relleno semántico en dark debe ser **`--ink-inv #0F1E3D`** (success 8.54 ✅ · warning 7.92 ✅ · danger 5.61 ✅). Excepción: `--wine` dark `#A8323E` sí acepta blanco (6.58).
- 📎 Fuente: `docs/design/studio/_norte/erp/tokens.css:147,155-163` + matriz verificada (sección 5.2).

#### 4.8.4 🟡 `--ink-mute` dark tampoco es texto body

- ❌ **DS/Norte dice:** nada — el rol de `--ink-mute` dark `#6E7896` no está documentado.
- ✅ **Debe decir:** mismo rol que en light: **placeholder/disabled decorativo, NUNCA texto body** (4.18 sobre bg-base · 3.40 sobre bg-surface · **2.97 sobre bg-elevated** — ahí falla incluso como texto grande). Documéntalo junto al token en el bloque dark.
- 📎 Fuente: `docs/design/studio/_norte/erp/tokens.css:146` + matriz verificada (sección 5.2).

---

## 5 · ADICIONES — texto final listo para pegar en tu material

> Todo lo de esta sección es el MISMO contenido que entra a `BRAND.md` del repo. Pégalo en tu DS tal cual (ajusta solo el nivel de heading si hace falta).

### 5.1 · Sección nueva: ♿ Contraste & legibilidad (WCAG 2.2 AA)

## ♿ Contraste & legibilidad (WCAG 2.2 AA)

**Umbrales (WCAG 1.4.3 + 1.4.11):**

- Texto normal: **≥ 4.5:1**.
- Texto grande: **≥ 3:1** — "grande" = **≥ 24px**, o **≥ 18.66px en negrita** (18pt / 14pt bold; NO son 18px/14px). Con el body del ERP en 14px, casi nada del Studio califica como "grande": el umbral operativo real es 4.5:1.
- No-texto (íconos informativos, bordes de componente, indicadores de foco y estado): **≥ 3:1** contra colores adyacentes (WCAG 1.4.11). Sin redondeo: 2.999 FALLA.

**Tokens que NO son texto de párrafo (medido):**

- `--ink-mute` #9B9B9B → **2.78:1** sobre blanco. Solo disabled y decoración. **El placeholder NO está exento de WCAG 1.4.3**: si el placeholder informa (formato esperado, ejemplo), necesita ≥4.5:1 → usa `--ink-soft`, o duplica la info en el label/helper.
- `--wine-soft` light #C2747F → **3.44:1**: solo texto grande.
- `--warning` #B8893A → **3.14:1**: solo texto grande.
- `--success` #1F8A5B → **4.33:1**: bajo el umbral body; texto grande o relleno.

**Semánticos = relleno/estado (en LIGHT):** como texto chico sobre blanco no alcanzan AA (salvo `--danger` 6.58 e `--info` 4.78). En DARK la relación se invierte: los cinco semánticos pasan body (6.24–9.50). La paridad NO se hereda — verificar por tema.

**Relleno + texto (CTAs/badges):**

- Sobre `--wine` / `--danger` → texto blanco (10.58 / 6.58 ✅).
- Sobre `--warning` → texto `--ink` (5.24 ✅), **nunca blanco**.
- Sobre `--success` → `--ink` o texto grande/bold (blanco = 4.33, no alcanza body).
- **En dark, texto sobre relleno semántico = `--ink-inv` #0F1E3D, nunca blanco** (blanco/success 1.93 ❌ · blanco/danger 2.94 ❌). Excepción: `--wine` dark sigue aceptando blanco (6.58).

**Rol de `--wine` en dark:** como TEXTO falla en todas las superficies (2.79 base · 2.26 surface · 1.98 elevated) → en dark `--wine` es **RELLENO** (blanco encima 6.58). El acento de TEXTO en dark = `--wine-soft` #D89AA4 (7.93 sobre bg-base). Los tokens dark completos (`--ink-mute` #6E7896, `--ink-inv`, bordes, semánticos) se toman de `_norte/erp/tokens.css` — no se inventan.

**Foco visible (2.4.7 + 1.4.11):** el ring estilizado debe dar ≥3:1 contra adyacentes. Light: `--wine` ✅ (10.13). Dark: `--wine` ❌ (2.79) → usar `--wine-soft` o `--ink`. Sobre sidebar navy: `--wine` es invisible (1.56) → usar cream. Red flag grep-able: `outline: none` sin `:focus-visible` de reemplazo.

**Badges (texto semántico sobre su `*-bg` tenue):** en light, warning falla hasta como texto grande (2.79) y success/info no llegan a body (3.83 / 4.20) → texto del badge en `--ink` con el `*-bg` de relleno + dot/ícono semántico, o texto más oscuro. En dark el patrón pasa body salvo danger (4.21) e info (4.41), que quedan solo-grande/bold.

**Bordes como única frontera:** `--border` y `--border-strong` son decorativos (1.25–1.49, exentos de 1.4.11 como separadores). Pero si el borde es la ÚNICA señal de un componente interactivo (input sin fondo diferenciado), falla → inputs con fondo propio (`--bg-surface` sobre `--bg-base`) + focus ring visible.

**Paridad light/dark:** todo par texto/fondo pasa el umbral en AMBOS temas; no asumir herencia (los casos medidos arriba lo prueban en las dos direcciones).

**Fondo variable:** texto sobre imagen/gradiente → scrim/overlay oscuro; nunca texto directo sobre foto. **No solo color** (WCAG 1.4.1, nivel A): estados/links/errores llevan ícono, texto o subrayado; un link dentro de prosa sin subrayado necesita 3:1 contra el texto circundante Y un cue en hover/focus.

### 5.2 · Matriz de contraste DTD · VERIFICADA 2026-07-06 (recómputo independiente, 24/24 ratios confirmados)

Método: luminancia relativa WCAG 2.1 · `ratio = (L1+0.05)/(L2+0.05)`. Fuentes hex: `BRAND.md` + `docs/design/studio/_norte/erp/tokens.css`. Los `rgba` se compositaron sobre su fondo real antes de medir.

#### LIGHT · texto sobre fondo

| Texto | Fondo | Ratio | Veredicto |
|---|---|---|---|
| `--ink` #0F1E3D | white #FFFFFF | 16.49 | ✅ body |
| `--ink` #0F1E3D | `--bg-base` #FBFAF7 | 15.80 | ✅ body |
| `--ink` #0F1E3D | `--bg-elevated` #F2F0EC | 14.49 | ✅ body |
| `--ink-soft` #6B6B6B | white | 5.33 | ✅ body |
| `--ink-soft` #6B6B6B | `--bg-base` | 5.11 | ✅ body |
| `--ink-soft` #6B6B6B | `--bg-elevated` | 4.68 | ✅ body (justo) |
| `--ink-mute` #9B9B9B | white | 2.78 | ❌ FALLA (ni grande) |
| `--ink-mute` #9B9B9B | `--bg-base` | 2.66 | ❌ FALLA |
| `--ink-mute` #9B9B9B | `--bg-elevated` | 2.44 | ❌ FALLA |
| `--wine` #7F0F1A | white | 10.58 | ✅ body |
| `--wine` #7F0F1A | `--bg-base` | 10.13 | ✅ body |
| `--wine-deep` #5E0A12 | white | 13.74 | ✅ body |
| `--wine-soft` #C2747F | white | 3.44 | ⚠️ solo grande |
| `--wine-soft` #C2747F | `--bg-base` | 3.30 | ⚠️ solo grande |

#### LIGHT · semánticos como TEXTO

| Texto | /white | /bg-base | Veredicto |
|---|---|---|---|
| `--success` #1F8A5B | 4.33 | 4.15 | ⚠️ solo grande |
| `--warning` #B8893A | 3.14 | 3.01 | ⚠️ solo grande (3.01 = margen 0.01) |
| `--danger` #A8323E | 6.58 | 6.31 | ✅ body |
| `--info` #2A6FDB | 4.78 | 4.58 | ✅ body |
| `--neutral` #6B6B6B | 4.68* | — | ✅ body (*sobre neutral-bg compuesto) |

#### LIGHT · texto sobre relleno (CTAs)

| Par | Ratio | Veredicto |
|---|---|---|
| white / `--wine` | 10.58 | ✅ |
| white / `--danger` | 6.58 | ✅ |
| white / `--success` | 4.33 | ⚠️ solo grande/bold |
| `--ink` / `--warning` | 5.24 | ✅ (nunca blanco sobre warning) |

#### LIGHT · badges (texto semántico sobre su `*-bg` compositado en white)

| Badge | bg compuesto | Ratio | Veredicto |
|---|---|---|---|
| success #1F8A5B / rgba(31,138,91,.10) | #E9F3EF | 3.83 | ⚠️ falla body — solo grande/bold |
| warning #B8893A / rgba(184,137,58,.12) | #F6F1E7 | **2.79** | ❌ FALLA hasta grande |
| danger #A8323E / rgba(168,50,62,.10) | #F6EAEC | 5.61 | ✅ body |
| info #2A6FDB / rgba(42,111,219,.10) | #EAF1FB | 4.20 | ⚠️ falla body por poco |
| neutral #6B6B6B / rgba(107,107,107,.10) | #F0F0F0 | 4.68 | ✅ body |

#### NAVY sidebar light (#0F1E3D)

| Par | Ratio | Veredicto |
|---|---|---|
| cream #F2F0EC / sidebar | 14.49 | ✅ |
| `--ink-side` rgba(255,255,255,.85) comp | 12.14 | ✅ |
| `--ink-side-soft` rgba(255,255,255,.55) comp | 5.83 | ✅ body |
| `--ink-soft` #6B6B6B / sidebar | 3.09 | ⚠️ solo grande — NO body sobre navy |
| `--wine` #7F0F1A / sidebar | 1.56 | ❌ invisible (regla del logo primary sobre navy confirmada) |

#### DARK · texto sobre fondo

| Texto | Fondo | Ratio | Veredicto |
|---|---|---|---|
| `--ink` #F2F0EC | `--bg-base` #0B1428 | 16.12 | ✅ body |
| `--ink` #F2F0EC | `--bg-surface` #16264A | 13.08 | ✅ body |
| `--ink` #F2F0EC | `--bg-elevated` #1F3055 | 11.44 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-base` | 8.45 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-surface` | 6.86 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-elevated` | 6.00 | ✅ body |
| `--ink-mute` #6E7896 | `--bg-base` | 4.18 | ⚠️ solo grande — NO body |
| `--ink-mute` #6E7896 | `--bg-surface` | 3.40 | ⚠️ solo grande |
| `--ink-mute` #6E7896 | `--bg-elevated` | **2.97** | ❌ falla hasta grande (por 0.03) |
| `--wine` #A8323E TEXTO | `--bg-base` | 2.79 | ❌ FALLA — wine en dark es RELLENO |
| `--wine` #A8323E TEXTO | `--bg-surface` | 2.26 | ❌ FALLA |
| `--wine` #A8323E TEXTO | `--bg-elevated` | 1.98 | ❌ FALLA |
| `--wine-soft` #D89AA4 | `--bg-base` | 7.93 | ✅ body — acento de TEXTO en dark |
| `--wine-soft` #D89AA4 | `--bg-surface` | 6.44 | ✅ body |
| `--wine-soft` #D89AA4 | `--bg-elevated` | 5.63 | ✅ body |
| white / `--wine` relleno | — | 6.58 | ✅ (CTA wine dark OK) |

#### DARK · semánticos como TEXTO

| Texto | /bg-base #0B1428 | /bg-surface #16264A | Veredicto |
|---|---|---|---|
| `--success` #5BCFA0 | 9.50 | 7.71 | ✅ body |
| `--warning` #DCAB6B | 8.80 | 7.15 | ✅ body |
| `--danger` #E07785 | 6.24 | 5.07 | ✅ body |
| `--info` #6FA0E8 | 6.87 | 5.58 | ✅ body |
| `--neutral` #A8B0C4 | 8.45 | 6.86 | ✅ body |

⭐ Asimetría clave: en LIGHT los semánticos como texto chico fallan (salvo danger/info); en DARK todos pasan body. La paridad NO se hereda — verificar por tema.

#### DARK · texto sobre relleno semántico (TRAMPA)

| Par | Ratio | Veredicto |
|---|---|---|
| white / `--success` #5BCFA0 | **1.93** | ❌ NUNCA blanco |
| white / `--danger` #E07785 | **2.94** | ❌ NUNCA blanco |
| `--ink-inv` #0F1E3D / success | 8.54 | ✅ |
| `--ink-inv` #0F1E3D / warning #DCAB6B | 7.92 | ✅ |
| `--ink-inv` #0F1E3D / danger | 5.61 | ✅ |

#### DARK · badges (texto semántico sobre su `*-bg` compositado en bg-surface)

| Badge | bg compuesto | Ratio | Veredicto |
|---|---|---|---|
| success #5BCFA0 / rgba(.14) | #203E56 | 5.77 | ✅ body |
| warning #DCAB6B / rgba(.14) | #32394F | 5.50 | ✅ body |
| danger #E07785 / rgba(.14) | #323152 | 4.21 | ⚠️ solo grande/bold |
| info #6FA0E8 / rgba(.14) | #223760 | 4.41 | ⚠️ solo grande/bold |
| neutral #A8B0C4 / rgba(.12) | #283759 | 5.43 | ✅ body |

#### Sidebar/nav dark (#060D1C — el sidebar dark es MÁS oscuro que el navy light)

| Par | Ratio | Veredicto |
|---|---|---|
| `--ink-side` rgba(255,255,255,.88) comp #E1E2E4 | 14.97 | ✅ |
| `--ink-side-soft` rgba(255,255,255,.55) comp #8F9299 | 6.23 | ✅ body |
| `--ink-nav-soft` dark rgba(255,255,255,.5) sobre bg-nav #0F1E3D | 5.02 | ✅ body |

#### No-texto (WCAG 1.4.11 · ≥3:1)

| Par | Ratio | Veredicto |
|---|---|---|
| Focus ring light: `--wine` #7F0F1A / bg-base | 10.13 | ✅ |
| Focus ring dark: `--wine` #A8323E / bg-base #0B1428 | **2.79** | ❌ FALLA 1.4.11 |
| Focus ring dark: `--wine` / bg-surface | **2.26** | ❌ FALLA 1.4.11 |
| `--border` light #E8E6E2 / white | 1.25 | ❌ como única frontera de input |
| `--border-strong` light #D8D4CE / white | 1.48 | ❌ ídem |
| `--border` dark rgba(255,255,255,.08) comp #1F2739 / bg-base | 1.23 | ❌ ídem |
| `--border-strong` dark rgba(.14) comp #2D3546 / bg-base | 1.49 | ❌ ídem |

(Bordes decorativos/separadores están exentos de 1.4.11; el fallo aplica solo cuando el borde es la ÚNICA señal que identifica el componente, p. ej. inputs sin fondo diferenciado.)

#### ::selection

| Tema | Par | Ratio |
|---|---|---|
| light | white / `--wine` #7F0F1A | 10.58 ✅ |
| dark | white / `--wine` #A8323E | 6.58 ✅ |

### 5.3 · Sección nueva: 📖 Legibilidad de lectura

## 📖 Legibilidad de lectura

- **Measure:** 45–75 caracteres por línea (66 óptimo) → `max-width: 65ch` en prosa.
- **Body:** ≥ 16px (18px en lectura larga).
- **Interlineado:** body 1.5–1.75 · títulos 1.0–1.25.

### 5.4 · Sección nueva: 🎚️ Perfil de densidad por superficie

## 🎚️ Perfil de densidad por superficie

- **Público** = espacioso · **Studio/ERP** = denso (tablas, KPIs) · **Portal/Móvil** = medio.
- Calibra el juicio de spacing SIN romper la escala de 4px: una tabla ERP densa correcta no es "demasiado apretada".
- Nota WCAG (1.4.10 Reflow): una tabla de datos con scroll horizontal propio NO es una falla de reflow (las tablas de datos están exentas del layout 2D); lo que sí debe reflow a 320px es el chrome de la página (nav, filtros, formularios).

### 5.5 · Sección nueva: ✅ Estados obligatorios

## ✅ Estados obligatorios

- **Interactivos:** hover · focus (visible) · active · disabled.
- **Datos:** empty · loading · error · success — al mismo cuidado que el happy path.
- **Pre-flight:** sin Lorem/placeholder ni `TODO: brand-review` sin resolver en pantallas vivas.

### 5.6 · Regla dura #6 — actualiza "5 reglas" a "6 reglas" en TODO el material del Norte

El resumen ejecutivo de marca pasa de **"5 reglas que NO se rompen"** a **"6 reglas que NO se rompen"**. La nueva:

> **6. Todo texto se lee.** Contraste AA: normal ≥ 4.5:1, grande ≥ 3:1 (grande = ≥ 24px o ≥ 18.66px negrita). Un color de marca que no alcanza el ratio sobre su fondo real no se usa como texto (ver ♿).

**Pedido explícito:** actualiza la regla en TU material del Norte (brand book, HANDOFF, kits, prompts internos) para que el próximo NORTE-SYNC ya venga alineado con las 6 — el repo (`BRAND.md`, `AGENTS.md`, `/ui-check`) ya las lleva.

### 5.7 · Trigger BRAND-CHECK — bullet nuevo

Agrega a la lista de "cosas que disparan BRAND-CHECK":

> - Texto que no alcanza el contraste AA sobre su fondo real (ej. `--ink-mute` como body, `--warning` como texto chico) → ❌ rompe legibilidad

---

## 6 · Fix puntual en `colors_and_type.css`

### 6.1 🟡 Comentario de `--ink-mute` (mismo bug ya corregido en el repo)

- ❌ **DS dice:** `--ink-mute: #9B9B9B; /* caption / placeholder */` (`colors_and_type.css:47` + `DTD-Cargo-Design-System.md:96`).
- ✅ **Debe decir:** `--ink-mute: #9B9B9B; /* placeholder / disabled decorativo — NO texto legible (2.78:1); ver ♿ */` — y ojo: por WCAG 1.4.3 el placeholder informativo tampoco es un uso válido (ver sección 5.1); reserva `--ink-mute` para disabled y decoración.
- 📎 Fuente: `BRAND.md:106` (comentario ya corregido en el repo).

### 6.2 🟡 Migra los hints/captions de los kits que hoy usan `--ink-mute` como texto real

Tus kits usan `--ink-mute` **20 veces** como texto de verdad (hints de Input, prefix/suffix, subs de KPI, counts) a 11–13px (`ui_kits/erp/components.jsx:40,43,45,123,201` entre otros). A 2.78:1 nada de eso es legible. Migra esos usos a **`--ink-soft`** (5.33:1 ✅).

### 6.3 🟡 Agrega el bloque `[data-theme="dark"]` al CSS canónico

`colors_and_type.css` se declara "single source of truth" pero no trae tema oscuro (hoy vive solo en `ui_kits/erp/index.html:21-34`). Agrega el bloque dark completo espejando `app/studio/tokens.css:130-180` / `_norte/erp/tokens.css`, incluyendo `--ink-mute: #6E7896` (con su comentario de rol), `--ink-inv: #0F1E3D`, bordes y los 5 semánticos dark.

---

## 7 · Checklist para el próximo export del DS

Antes de exportar, verifica:

- [ ] **Cero voseo** en md, README, kits y previews (grep: `vos`, `sos`, `consolidás`, imperativos en `-á`/`-é`/`-í`); la regla de voz dice TUTEO venezolano neutro.
- [ ] **"Con Confianza,"** con C mayúscula en todas las apariciones del tagline (el sub-claim sigue en minúscula).
- [ ] **Sin razón social** en texto visible; si hay nota legal, dice "solo en schema — no usar en piezas".
- [ ] Fuentes citadas = `docs/design/studio/_norte/` (Brand Book **v4.5**) + `app/studio/tokens.css` — **cero rutas muertas** (`v1.7-claude-design`, `brand-book-v3.x`, `public/marca/erp/`).
- [ ] Hero y stats espejan `lib/design-tokens.ts` (`HERO`, `STATS`, `trustMarks`): H1 "Con Confianza, / desde China hasta tu puerta.", badge "Puerta a puerta / China → Venezuela", "24 HS · Cotización inicial estimada", "2015 · Operando en Venezuela", "Inspección sin costo +20 CBM", años de China calculados desde 2008.
- [ ] Eyebrow del hero = "Logística China → Venezuela · Desde 2015"; matiz de fechas 2008/2010/2015 donde se hable de historia.
- [ ] ERP = **"55 módulos en producción"**.
- [ ] Sección de negocio con los **4 productos** (consolidación · DDP · reserva FCL · terrestre; LCL 95%) + copy DDP **"Pagas al llegar"** ("prepago" solo T&C).
- [ ] Kits ERP: etiqueta visible **"Shipping Mark"** (claves de datos `markbox` intactas); "MARKBOX" solo en material de web pública.
- [ ] `colors_and_type.css`: comentario `--ink-mute` corregido + bloque `[data-theme="dark"]` completo + split de `--danger` (web #C2353F · ERP #A8323E) documentado.
- [ ] Ningún hint/caption/sub usa `--ink-mute` como texto (todo migrado a `--ink-soft`).
- [ ] `--f-display: 'Archivo Black', 'Archivo', sans-serif` (o alias documentado como equivalencia oficial en ambos lados).
- [ ] Sección ♿ de contraste presente, con el umbral de texto grande correcto (**≥ 24px o ≥ 18.66px bold** — no 18px/14px).
- [ ] Focus ring dark ≠ `--wine` (usar `--wine-soft` o `--ink`; cream sobre sidebar navy).
- [ ] Badges warning light no usan texto #B8893A sobre `--warning-bg`.
- [ ] En dark, texto sobre relleno semántico = `--ink-inv`, nunca blanco (salvo sobre `--wine`).
- [ ] Resumen ejecutivo dice **"6 reglas que NO se rompen"** (la 6 = "Todo texto se lee").

---

## 8 · Recepción — Cloud Design aplicó las correcciones ✅ (2026-07-06 20:41)

Cloud Design reexportó el Design System y **aplicó todo el sync**. Verificado contra el nuevo export:

- ✅ Voseo → **tuteo** (el kit corrige "consolidás"→"consolidas"; regla dura explícita en md + README + kit)
- ✅ **Razón social solo en schema** (aclarado que "Doortudoor Services" es sello de footer, no legal)
- ✅ **"Con Confianza,"** C mayúscula + hero / stats / eyebrow canónicos
- ✅ **3 fechas** (2008 comercio / 2010 empresa / 2015 VE; años calculados)
- ✅ **4 productos** + LCL 95% + copy DDP **"Pagas al llegar"**
- ✅ **MARKBOX** (público) / **"Shipping Mark"** (Studio/portal/móvil)
- ✅ **55 módulos** · **danger por superficie** (#C2353F público / #A8323E ERP)
- ✅ Sección **♿ Contraste & legibilidad WCAG 2.2** completa (umbral 24px/18.66px, paridad light/dark, 1.4.1, scrim)
- ✅ `colors_and_type.css`: comentario `--ink-mute` corregido (light + dark #6E7896) + **bloque `[data-theme="dark"]` añadido** + **focus ring dark = `--wine-soft`**
- ✅ Rutas muertas marcadas "no citar"

**Cloud Design ↔ Claude Code: alineados. El loop de marca queda cerrado.**

**Fixes de producto derivados** (aplicados en el repo, NO en el DS): el nuevo DS prescribe el focus-ring dark = `--wine-soft` y `--ink-soft` para texto → aplicados en el repo: `app/studio/tokens.css` (override focus-ring dark) + ~569 usos de `--ink-mute` como texto migrados a `--ink-soft` en Studio/móvil.

---

*Generado desde el repo `DTDCargo` (auditoría DS vs repo + recómputo independiente de contraste, 2026-07-06). Cualquier duda sobre una fuente: todas las rutas 📎 son relativas a la raíz del repo.*
