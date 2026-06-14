# Norte · CHANGELOG (handoffs de Cloud Design)

> Historial humano de las cargas del **Norte visual** (protocolo NORTE-SYNC).
> El detalle técnico vive en `git log` / tags `norte-vX.Y`. El mockup vigente está en `_norte/`.
> Regenerar índice: `node scripts/norte.mjs` · servir: `npx serve docs/design/studio/_norte -l 3010` → http://localhost:3010/_norte

## v4.2 · carga 2026-06-14 — **marca sincronizada a Brand Book v4.2 · sync 2026-06-14**

> *Hecho en ventana secundaria (worktree `feat/norte-v42`). NO mergeado ni pusheado — queda para la
> ventana de coordinación.* El ZIP se extrajo **fuera del repo** (regla anti-drift de marca).

Fuente: `Downloads/DTD-Cargo (3).zip` (251 MB crudo, 1123 entradas → **797 archivos / 21.9 MB** a git tras
exclusiones de regla). Trae su propio **`SYNC-NORTE-2026-06-14.md`** (instrucciones de Cloud Design) —
aplicado. **Versión UNIFICADA:** por primera vez marca y producto comparten un único número visible →
**v4.2**. El HANDOFF salta **v2.5 → v4.2**; el Brand Book **v3.7 → v4.2**. `scripts/norte.mjs`
`NORTE_VERSION` y punteros del índice actualizados; `SYNC-NORTE-2026-06-10.md` reemplazado.

**Gobernanza book único:** `Brand Book DTD v3.7.html` eliminado del Norte; queda solo `Brand Book DTD v4.2.html`.

**Estructura nueva (SYNC §2):** **Brand Hub** (índice solo-marca) vs **DTD Apps · Launcher** (índice
solo-producto) — no se mezclan. Ambos agregados al índice navegable.

**Nuevos mockups de producto (SYNC §4, NO construidos → candidatos a SDD futuros):** Inventario de
Consolidación (WMS por Shipping Mark), Reclamos y Siniestros (incidencias + seguro), Academia DTD
(LMS → diplomas), Scorecard de Proveedores, Dashboard Ejecutivo. + calculadora CBM con estimado
`E-2026-XXXX` y puente de tarifa `dtd-tarifa-cbm` (una sola fuente del $/CBM).

**Nuevo colateral de marca (SYNC §3):** Packlist (Packing List + Factura bilingüe), Cotización DDP,
Plantilla de Presentación, Asistente de Contenido, Diplomas, Kit de Bienvenida, Reels y Logo Sonoro,
tarjeta de presentación editable, Ciclo del Cliente (variantes).

**Exclusiones (regla "pesado/ruido fuera de git"):** previas — `uploads/`, `_archivo/uploads/` (79 MB),
`scraps/`, `screenshots/`, `backend/prisma/`. **Nuevas a `.gitignore` esta carga** — `fondos/` (70 MB
wallpapers), `trello/` (12 MB), `para-enviar/` (standalone base64 + plano fachada),
`.design-canvas.state.json`, `.thumbnail`.

**Brand-to-web (regla founder):** isólogos `assets/` == `public/brand/` (byte-idénticos, sin cambio).
Tokens sin cambios este ciclo (SYNC §5). ⚠️ El `favicon-pack/` del ZIP **difiere** de los favicons del
sitio (`public/brand/favicon*`, distinto tamaño) — **NO se swapearon** (cambio muy visible, fuera del
alcance de un Norte-sync) → decisión del founder si se propaga.

**Flags para coordinación (NO resueltos en esta ventana):**
1. ⚠️ **Book v4.2 NO publicable a la web** (`/marca/brand-book` sigue v3.7): Cloud Design mandó
   `Brand Book DTD v4.2.html` con 74 refs externas (0.2 MB, NO autocontenido); `para-enviar/` quedó con
   el standalone **v3.7** (stale). Falta que Cloud Design genere `Brand Book DTD v4.2 · standalone.html`.
2. ⚠️ **MARKBOX:** el SYNC pide quitar MARKBOX del lenguaje visual (Norte/ERP ya en Shipping Mark). El
   **sitio público** usa MARKBOX por decisión founder 2026-06-13 — NO se tocó código público. Decisión
   del founder si el público se alinea.
3. **Hero Ciclo del Cliente** (SYNC §3) ya vive en `feat/hero-ciclo` (otra ventana) — no duplicado.

## v2.5 · carga 2026-06-10 — **marca sincronizada a Brand Book v3.7 · sync 2026-06-10**

> *Nota de reconciliación 2026-06-11:* dos lanes hicieron este sync en paralelo (PR #18 + worktree
> practical-tesla); esta entrada consolida ambos. **Deltas exclusivos del lane B que también
> entraron:** RIF canónico aplicado DENTRO de los 2 `.docx` legales (`legal/DTDCARGO_Acuerdo_
> Operador…` + `…Terminos_Condiciones_DTD_v2.1.docx`, editados en su XML y verificados) · 97
> fixes voseo→tuteo adicionales en `_norte/` (escapes del barrido de Cloud Design) · pack
> "12 redondos"→"17" en `Aplicaciones de Marca` · `_archivo/uploads/` (79 MB) a `.gitignore`.
> **Terminología (resolución final):** archivos/rutas técnicas = `bodeguero/camionero` (como
> `app/m/ve/*`, no se renombran); texto visible de los mockups = "Almacenista/Transportista"
> (sweep de main, 3ª re-aplicación, alineado al dato del SYNC "Almacenista y Transportista =
> misma persona"). ⚠️ Pendiente Cloud Design: espejar RIF/voseo en su origen + regenerar
> PNG/PDF exportados con RIF horneado + frase residual del pack viejo ("se vea redondo").

Fuente: `Downloads/DTD-Cargo.zip` (133.9 MB crudo, 955 entradas → 747 archivos / 21 MB tras exclusiones de regla:
`uploads/`, `_archivo/uploads/`, `backend/prisma/`, `scraps/`, `.design-canvas.state.json`) + `Downloads/Brand Book
DTD v3.7 · standalone.html` (12 MB, autocontenido → publicado a la web, ver abajo). El ZIP trae su propio
`SYNC-NORTE-2026-06-10.md` (instrucciones de Cloud Design) — **aplicado completo**. El HANDOFF no bumpea
versión (sigue v2.5); lo que sube de versión es el **Brand Book: v3.5 → v3.7**.

**Regla de gobernanza nueva (CLAUDE.md del Norte §El Brand Book vigente es UNO solo):** queda únicamente el
book de mayor versión en la raíz (`Brand Book DTD v3.7.html`); los anteriores se eliminan. **`Brand Book DTD
v3.5.html` borrado.** Historial de cambios = changelog interno del book.

**Lenguaje (masivo, hecho por Cloud Design en el Norte):**
- **MARKBOX → Shipping Mark, término ÚNICO en todos los contextos** (decisión founder 2026-06-10; ≈56 archivos).
  Claves de código intactas (`markbox:`, `c.markbox`, `MARKBOX_REGEX`…). Cara a proveedor: "Shipping Mark (唛头)".
- Voseo → tuteo venezolano (≈95 archivos; excepción intencional: ejemplos ❌ del Voice & tone del book).
- Timeline 2026 del book: "12+ modalidades · plataforma digital" (se quitó "ERP propio" — no revelar desarrollo interno).

**Nuevo ⭐:** `Banco de Fotos · DTD-Cargo.html` (slots por categoría para el foto-shoot) · `Colateral Impreso ·
DTD-Cargo.html` (membrete A4 + credencial CR-80 + vinilo camión + roll-up con spec de imprenta) · `Generador
Redes` (flujo red-primero + QR multidestino + generador YouTube) · `Generador Catálogo WhatsApp` · `Uniformes ·
DTD-Cargo.html` (+ `uniforms/*.jsx`) · `WeChat · Perfil DTD-Cargo.html` (+ `wechat/*`) · `erp/modules/
estudio-redes.jsx` (calendario de contenido + seam `dtd-etiquetas-contenido`) · Sticker Pack ahora 17 piezas
con texto (pack de 12 redondos eliminado) · `assets/foto-contenedor-real.jpg`.

**Archivado/eliminado:** `Aceptación T&C · Cotización.html`, `Modo Cliente.html`, `Reporte DTD-Cargo.html` →
`_archivo/` (la lógica vive en el ERP/Portal) · `_icons-partial.html` eliminado · 6 JSON temp de `assets/insp-hab/`.

**Drift recurrente re-aplicado (3ª vez):** la carga volvió a traer Bodeguero/Camionero → **10 archivos
renombrados** (2 HTML + 3 `.jsx`, ×2 por `design_handoff_mobile_app/`) + sweep de texto en **35 archivos**
(0 restos; rutas reales `app/m/ve/bodeguero|camionero` y `CHANGELOG.md` histórico protegidos). Dato nuevo de la
carga: Almacenista y Transportista = la misma persona, `+58 424 950 8848`.

**Índice (`scripts/norte.mjs`):** book → v3.7; Marca + Banco de Fotos + Colateral Impreso; grupo nuevo
"carga 2026-06-10 · marketing · colateral" (`ref:true`); 3 paths re-apuntados a `_archivo/`.

**Brand→web (regla `feedback_norte_brand_to_web`, mismo push):** standalone v3.7 publicado como
`public/marca/brand-book-v3.2.html` → **`brand-book-v3.7.html`** (visor `/marca/brand-book` + hub
`/interno/marca` + zips gateados actualizados). Purga total de copias/referencias pre-3.7 en el repo
(BRAND.md, AGENTS.md, comentarios de código) — gate "cero referencias" permanente en `/radar` (Regla 0.5).

**RIF único `J-50648869-8` (decisión founder 2026-06-10):** se borraron los 4 RIF viejos que traía el
paquete de Cloud Design — `J-410322887` (marca/sello/inspecciones/tarjeta/colateral/CLAUDE.md),
`J-40558712-0` (factura demo/ZPL/comprobante WhatsApp), `J-40551122-3` (forma IVA `fiscal.jsx`),
`J-50220185-8` (acuerdo operador) → **29 reemplazos en 17 archivos de `_norte`** + el book publicado
(`public/marca/brand-book-v3.7.html`). RIF mock de clientes demo intactos. El RIF NO va en texto visible
del sitio público (solo en el schema, regla `identidad.md`); acá aplica al material de marca del Norte.
Pendiente Cloud Design: espejar en origen + regenerar PNG/PDF exportados con el RIF horneado.

**Carpetas históricas ELIMINADAS del working tree (decisión founder 2026-06-10 — la historia vive en git;
recuperar = `git log --oneline -- "<path>"` + checkout):** `docs/design/brand-book/` (v3.0 completo),
`docs/design/studio/v1.7-claude-design/` (22 MB), `docs/design/studio/_archivo-v1.3.1-claude-design/` (45 MB),
`docs/design/studio/_archivo-v1.6-claude-design/`, `docs/design/_archivo-v1-studio/` (21 MB),
`docs/design/handoffs-archive/` (solo README; los ZIPs nunca estuvieron en git), `docs/design/AUDIT-v1.7.md`.
**Excepción conservada:** `docs/design/studio/bug-reporter-v1.4.1/` — handoff del módulo Bug Reporter,
enlazado por la spec SDD-0036 (registro de spec, no copia de marca). Limpieza colateral: `.gitignore`,
`tsconfig.json` y `eslint.config.mjs` sin entradas muertas (`_handoff_preview`, `BANDBOOK V1`, archive zips).

## v2.5 · re-sync 2026-06-08 (handoff posterior · Inspecciones + calc CBM-por-medidas + Brand Book v3.5)

Re-sincronización desde un ZIP posterior de Cloud Design (`Downloads/DTD-Cargo (2).zip`, ~117 MB crudo).
Supersede en contenido a la carga v2.5 del 06-07 (abajo). Hecha desde el worktree `feat/calculadora` y
llevada a main por **rebase + push FF** (commit `d7d8008`; NORTE-SYNC `b1e11b0`). El gate quedó verde.

**Nuevo ⭐:**
- **Inspección de calidad (China):** `Inspección de Fábrica · DTD.html`, `Inspección de Producto · DTD.html`,
  `Inspección de Producto · Baterías · DTD.html`, `Reportes de Inspección · DTD.html` + plantillas
  (`Plantilla · Inspección de {Fábrica,Producto}.html`) + assets `assets/insp-*` y `reportes/`. Agregadas al
  índice (`scripts/norte.mjs`) como grupo **"Inspección de calidad · China (v2.5)"**, `ref` (no cuentan en el %).
- **Calculadora CBM por medidas:** `calc/cbm-variants.jsx` con el **toggle ▶/▼ único** (abre y cierra desde el
  mismo control) + `HANDOFF-CBM-MEDIDAS.md` + `PROMPT-CLAUDE-CODE-CBM-MEDIDAS.md`. → **portado a la web pública**
  (`components/CalculadoraForm.tsx`, mismo push).
- **Brand Book v3.5** ahora es archivo propio `Brand Book DTD v3.5.html` (la carga 06-07 lo tenía dentro de
  `v3.2.html`). El índice apunta a v3.5.

**Exclusión por regla (no a git):** `uploads/`, `_archivo/uploads/` (PDFs de inspección ~12 MB c/u, mp4, PNGs
pegados) y `*.prisma`. Sync vía `tar --exclude` (no hay rsync en git-bash Windows). `_norte/` 14→23 MB.

**⚠️ Deuda introducida por este re-sync (pendiente de limpiar):**
- **Drift de terminología re-introducido:** el ZIP de Cloud Design usa Bodeguero/Camionero; este sync (sin
  re-aplicar el rename) **sobreescribió** los `.jsx` que la carga 06-07 había renombrado a
  Almacenista/Transportista, y **agregó** `Bodeguero VE.html` / `Camionero.html` → ahora **coexisten** con
  `Almacenista VE.html` / `Transportista.html` (duplicados). El índice navegable sigue apuntando a
  Almacenista/Transportista (correcto). **Pendiente:** re-aplicar el rename + borrar los duplicados Bodeguero/Camionero.
- **`Brand Book DTD v3.2.html` huérfano:** quedó en disco al renombrar Cloud Design a v3.5.html (tar sin
  `--delete`). Candidato a borrar.
- `schema.prisma` NO volvió (excluido + bloqueado por `.gitignore`).

## v2.5 — cargada 2026-06-07 (handoff de Cloud Design · Tarjeta de Presentación + celebración MARKBOX + Brand Book v3.5 + nómina)

Fuente: carpeta `Downloads/DTD-Cargo · Proyecto Completo · Handoff v2.5` (extraída, ~70 MB). Supersede v2.4c.
**Cloud Design bumpeó el encabezado:** `HANDOFF.md` tope = `🟢 Estado actual · v2.5 (2026-06-07)`. git (mirror):
rc=3 · **95 nuevos · 68 modificados · 2 borrados · 1 rename** · empaque a la raíz de la carpeta.

**Nuevo ⭐:**
- **Tarjeta de Presentación** (`Tarjeta de Presentación.html`): doble cara 85×55 mm + sangrado, lockup canónico,
  **QR vCard**, 3 perfiles (uno bilingüe 中文), imposición con marcas de corte + descarga `.vcf`. Reusa
  `erp/tokens.css` + isólogos de `assets/`. Entró al Brand Book como pieza **#13**.
- **Celebración del MARKBOX** en `portal/registro.jsx`: al registrar la compra inline, la tarjeta roja muta
  `DTD-XXXX` → `DTD-XXXX-1-1` (markbox·proveedor·compra) con animación (pop + ring `--success`; respeta
  `prefers-reduced-motion`). Nuevo `MarkboxCard`.
- **Brand Book → v3.5** (dentro de `Brand Book DTD v3.2.html`; el nombre de archivo no cambió).
- **Nómina (surface nueva):** `App del Empleado.html` + `HANDOFF-NOMINA.md`.
- **Auditoría calc/cotizador** (entrada 06-06, solo bitácora) → **rename `erp/modules/quotes.jsx` → `estimados.jsx`**
  (lo detectó git como R).
- **Colateral operativo/marketing nuevo:** `Calculadora CBM`, `Etiqueta Bodega ZPL`, `Comprobante WhatsApp`,
  `Reporte`, `Portada Animada FB`, `Portadas Redes`, `Póster Reseñas`, `Sticker Pack`; carpetas nuevas
  `brandbook-icons/ calc/ empleado/ factura-template/ favicon-pack/ marketing/ redes/ zpl-label/`;
  `manifest.webmanifest` + `sw.js` (PWA del prototipo de Cloud Design).

**Removió:** `assets/dtdcargo-icon-navy.png` (verificado: sin refs colgantes). **Purgado por el mirror:**
`CHANGELOG-sesion.md` (estaba consolidado en `CHANGELOG.md` desde hace varias cargas).

**Drift de backend (re-aplicado):** la carga re-introdujo `backend/prisma/schema.prisma` (blueprint Prisma
517 líneas). Decisión founder 2026-06-03 = **backend NATIVO Supabase, NO Prisma** → schema.prisma **re-removido**
y `backend/prisma/` agregado al `.gitignore` (para que no vuelva a trackearse en próximos syncs). Se conservan
los docs buenos `backend/{README,API-CONTRACT}.md`.

**Terminología (drift recurrente):** la carga trajo de vuelta Bodeguero/Camionero → re-aplicado el rename
**Almacenista/Transportista**: **10 archivos renombrados** (2 HTML + 3 `.jsx` ×2 por el duplicado en
`design_handoff_mobile_app/`) + **sweep de texto en 36** (capitalizado/minúscula) + **2 mayúsculas** (badge de
rol `BODEGUERO`→`ALMACENISTA`), **salvo `CHANGELOG.md` histórico**. Paths de código reales (`app/m/ve/bodeguero`)
NO se tocaron.

**`norte.mjs`:** v2.4c→**v2.5**; GROUPS: Marca (**+Tarjeta de Presentación**), **grupo nuevo "Nuevo en v2.5 ·
operativo · nómina · colateral"** (9 pantallas `ref:true` → no diluyen el %). Overlay **50% (10/20)** sin cambio
(las nuevas son referencia/marca).

**Para el radar del founder:** (1) **Brand Book v3.5 → propagar a la web** `/marca/brand-book` (regla
brand-to-web). (2) **App del Empleado + HANDOFF-NOMINA = módulo NÓMINA nuevo del ERP** (candidato a SDD).
(3) `estimados.jsx` (ex `quotes.jsx`) — el cotizador interno cambió de nombre. (4) Tarjeta = pieza imprimible
de marca, no es pantalla de app.

**Peso (fuera de git):** + **Brand Book self-contained v3.2** (carpeta `DTD-Brand-Book-v3.2-selfcontained/`
~19.9 MB + `Brand Book DTD v3.2 - self-contained.html` ~10.8 MB) agregados al `.gitignore`; `uploads/` (25.7 MB),
`scraps/`, `screenshots/` no se copiaron. `_norte/` en disco = **12.3 MB**. Sigue fuera: `_norte.html`, `Brand Book v3.0 Package/`.

---

## v2.4c — cargada 2026-06-02 (handoff de Cloud Design · capa LEGAL + handoff mobile dedicado + Brand Book v3.2)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v2.4c).zip` (~18 MB). Supersede v2.4b. A diferencia
de v2.4b (que fue higiene), v2.4c **agrega contenido**. git (mirror): rc=3 · empaque a la raíz del ZIP.

**Nuevo ⭐:**
- **Capa LEGAL** (`legal/`): **T&C DTD v2.1**, **Acuerdo Operador Consolidación**, **Brief Seguro** —
  bilingüe ES-中文 (.md + .docx, ~13 KB c/u, son **templates** en blanco) + módulo
  `erp/modules/admin-legal.jsx` + pantalla `Aceptación T&C · Cotización.html`. La capa legal/contractual
  entra al diseño.
- **Handoff mobile dedicado** (`design_handoff_mobile_app/`, 33 archivos · 1 MB): bundle de diseño de la
  app operario (su propio `erp/` subset + tokens + screens) + `HANDOFF-MOBILE.md` + `design-canvas.jsx`.
  Pantallas nuevas: `Operario · App.html`, `Login y Sesión · Operario.html`, `App Icon · DTD Cargo.html`,
  `app-spinner/` (gif/lottie/svg).
- **Brand Book v3.1 → v3.2**.

**Removió:** `Brand Book DTD v3.1.html` (+ "· para enviar"), `Operario Multi.html` (→ reemplazado por `Operario · App`).

**Cambios de contenido:** módulos cobranzas/contabilidad/conversaciones/dirección/operarios-pwa, portal
(app/mobile/registro — T&C en cotización/portal), `backend/{API-CONTRACT,README}`, CLAUDE/HANDOFF/CHANGELOG.

**Terminología:** sigue con Bodeguero/Camionero (ahora también en `design_handoff_mobile_app/operario/`) →
rename **Almacenista/Transportista** re-aplicado (34 archivos).

**`norte.mjs`:** v2.4b→**v2.4c**; GROUPS: Móvil (−Operario Multi, +Operario·App +Login·Operario), Marca
(Brand Book **v3.2**), inErp (+Legal·T&C), grupo nuevo (+Aceptación T&C, +App Icon). Overlay **50% (10/20)**.

**Para el radar del founder:** (1) **Brand Book v3.2 → propagar a la web** `/marca/brand-book` (regla brand-to-web).
(2) `admin-legal` + Aceptación T&C = **feature nueva del ERP** (candidato a SDD). (3) Los `legal/` son templates
(en git, livianos); si se vuelven **contratos ejecutados con PII → fuera de git** (regla AGENTS.md).

**Peso (fuera de git):** `uploads/`, `scraps/`, `screenshots/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v2.4b — cargada 2026-06-01 (handoff de Cloud Design · CONSOLIDACIÓN / higiene de repo · supersede v2.4)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v2.4b).zip` (~22 MB). **Supersede el v2.4** de unas
horas antes — es su versión **consolidada/limpia, NO un cambio de diseño ni de datos.** git (mirror):
156 copiados · **89 purgados**.

**Es la consolidación que el HANDOFF siempre prometió** ("cuando el usuario decida consolidar"). El propio
`CHANGELOG.md` de Cloud Design la describe (preocupación #1 del founder: fragmentación de repo):
- **Disolvió `nuevo/`** (staging) → todo a su lugar canónico: `nuevo/modules/*`→`erp/modules/*`,
  `nuevo/pantallas/*`→`pantallas/*`, `nuevo/api/client.jsx`→`erp/api/`, `nuevo/mobile/`→`mobile/`,
  `nuevo/{flujo-*,rates,catalog-lines,feature-flags,search-select}.jsx`→`erp/*`, `nuevo/propuesta/*`→`propuesta/*`.
- **8 bloques de seed** (`// TODO: al consolidar`) → `erp/data.jsx` (`window.ERPData`).
- **Borró código muerto:** `estado-cuenta.jsx` (raíz huérfano), carpetas `handoff/` y `design_handoff_dtd_cargo/`.
- **Consolidó docs (8→2 + bitácora):** `BACKEND-BRIEF.md` + `PROMPT-BACKEND.md` → **`backend/README.md`**;
  `nuevo/CHANGELOG.md` → **`CHANGELOG.md` raíz**; quitó `PROMPT-proxima-sesion.md` / `PROMPT-CLAUDE-CODE.md` / `nuevo/README.md`.
- **Misc:** quitó su `DTD CARGO Nort v2.4.html` + `Brand Assets DTD/`; archivó `Propuesta · Botón Crear` → `_archivo/`.

**schema.prisma:** SIN cambios de modelo — **1 línea** (comentario `BACKEND-BRIEF.md`→`backend/README.md`).
La reconciliación + los módulos construidos (Facturación/Contabilidad/Cobranzas) **NO se afectan**.

**Terminología (drift):** sigue con Bodeguero/Camionero → re-aplicado el rename **Almacenista/Transportista**
(5 archivos + sweep de texto en 23, salvo `CHANGELOG.md` histórico, ahora en la raíz del handoff).

**`scripts/norte.mjs`:** v2.4→**v2.4b**; GROUPS: paths `nuevo/pantallas/*`→`pantallas/*`, quitadas las cards
del índice propio (removido) y de Propuesta · Botón Crear (archivado). Overlay sin cambio real (~47%).

**Peso (fuera de git):** `uploads/`, `scraps/`, `screenshots/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v2.4 — cargada 2026-06-01 (handoff de Cloud Design · índice propio + consolidación de despacho + Brand Assets)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v2.4).zip` (~26 MB, 579 archivos). **Cambio de empaque:** ya NO viene envuelto en `dtd-cargo/project/` — el contenido está en la **raíz** del ZIP. Se omitieron `uploads/`, `scraps/`, `screenshots/`, `Brand Book v3.0 Package/` (ruido gitignoreado). git (mirror): copió 181 · **purgó 13**.

**Nuevo:**
- `DTD CARGO Nort v2.4.html` — el **índice navegable propio de Cloud Design** (su versión del "norte"). Agregado al grupo del índice como `ref`.
- `Brand Assets DTD/` — paquete de logos + `LEEME · uso de logos.txt`.
- `Brand Book DTD v3.1 · para enviar.html` — variante del brand book para compartir.
- `nuevo/mobile/` (1 archivo) + actualización de `_norte/CLAUDE.md`: **nueva sección MARKBOX / Shipping Mark (唛头)** — qué término mostrar según contexto (cliente/público = MARKBOX · proveedor CN = Shipping Mark).

**Removido por Cloud Design (consolidación, NO accidente — git lo recupera si hace falta):**
- **Despacho · Vista 1 y Vista 2** (consolidó a una sola vista; queda "Despacho · Vista 3") + **Admin · Rutas**.
- **Propuesta · Órdenes, Caja y Proveedores** + **Sidebar DTD · Tono** + `nuevo/propuesta/propuesta.jsx`.
- `scripts/norte.mjs` GROUPS actualizado: Despacho → 1 card; grupo de propuestas → sin la card de Órdenes; + card "Índice Cloud Design (Nort v2.4)".

**Terminología (drift recurrente ⚠️):** v2.4 SIGUE trayendo "Bodeguero/Camionero". Re-aplicado el rename **Almacenista/Transportista** (5 archivos movidos + sweep de texto en 24, salvo `nuevo/CHANGELOG.md`). Se repetirá en cada sync hasta que Cloud Design lo adopte en origen.

**Overlay "estás aquí":** **47% construido · 9 listas · 0 en obra · 10 en diseño (19 pantallas-meta)**. Bajó de 55% **NO por regresión**: Cloud Design consolidó/removió 3 pantallas ya construidas (Despacho Vista 1/2 + Admin Rutas) → menos pantallas-meta en el índice. + 9 módulos ERP backlog + 6 referencias v2.3/v2.4.

**Peso (fuera de git):** `uploads/`, `scraps/`, `screenshots/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v2.3 — cargada 2026-05-31 (handoff de Cloud Design · ⭐ ARRANQUE DE BACKEND: blueprint Prisma + contrato REST + seam)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v2.3).zip` (~20.7 MB; el front interno sigue
rotulado v1.9.2, el **paquete** es "v2.3"). Envuelto en `dtd-cargo/project/` → se extrae ese contenido a
`_norte/`. Se omitieron `uploads/`, `scraps/` y la **nueva `screenshots/`** (104 PNG de trabajo, ruido →
gitignorada). git: **26 entradas nuevas** (31 archivos con subcarpetas) · **1 borrado** (Brand Book v3.0)
· 80 M (mayoría ruido LF/CRLF + el rename sweep de abajo).

**⭐ El titular — backend (el "poquito de back" que mencionó el founder).** Cloud Design escribió el
**blueprint del backend**: NO un servidor, sino la *especificación*. Carpeta nueva `backend/`:
- `backend/prisma/schema.prisma` — **18 modelos multi-tenant** derivados 1:1 de los mocks (Tenant, User,
  Client, Supplier, Order, Shipment, Box, Container, WarehouseEvent, Invoice, Quote, Account,
  JournalEntry/Line, ExchangeRate, Comment, ScheduledEmail, TmsIncident, Document, AuditLog). `tenantId`
  en toda tabla operativa, MARKBOX único por tenant, `F-`/`DTDU-` server-side, IVA flag OFF por defecto.
- `backend/API-CONTRACT.md` — contrato REST endpoint→store-mock + regla de oro (`tenantId` SIEMPRE del JWT).
- `nuevo/api/client.jsx` — el *seam* `window.DTDApi`/`window.DTDAuth` (modo mock↔rest) del **prototipo**.
- `PROMPT-BACKEND.md` — instrucciones de arranque (asume Vite+React+TS+Prisma **desde cero**).

**Reconciliación (lo importante para NOSOTROS).** El repo real (Next.js+Supabase) ya está MÁS adelante que
este blueprint en infra (75 tablas, multi-tenant+RLS, auth, 25 módulos). **NO seguimos PROMPT-BACKEND
literal** (ni Prisma ni rebuild): el schema es **SPEC**, no algo a instalar. Mapa entidad-blueprint ↔
tabla real + plan por bloques en **`docs/architecture/schema-reconciliation.md`** (creado en esta carga).
Resumen del cruce de los 18 modelos → **5 ya existen · 6 parciales · 7 faltan** (Supplier, Container y toda
la capa financiera: Invoice/Account/Journal/Comment). El hueco = **la mitad financiera del ERP**.

**Pantallas nuevas (referencia de diseño · `ref:true` → FUERA del %):**
- `Mapa de Proceso.html` + `Guía del Mapa de Proceso.html` — flujo operativo end-to-end navegable.
- `Portal Cliente Mobile.html` — portal del cliente en mobile.
- 3× `Propuesta · …` (Botón Crear · **Órdenes/Caja/Proveedores** · Servicios y Tarifas) — exploraciones de
  features; varias apuntan a las **entidades faltantes** (órdenes, proveedores, caja). `Sidebar DTD · Tono.html`
  llegó pero no se agregó al índice (micro-exploración).

**Terminología (drift recurrente ⚠️).** Cloud Design v2.3 volvió a "Bodeguero/Camionero". Se **RE-APLICÓ**
el rename del repo **Bodeguero→Almacenista · Camionero→Transportista** (5 archivos movidos + sweep de texto
en 25, réplica de commit `edda317`), salvo `nuevo/CHANGELOG.md` (bitácora histórica, intacta). **Esto se
repetirá en cada sync** hasta que Cloud Design adopte los términos en origen.

**Brand Book:** v3.0 → **v3.1** (índice actualizado · `Brand Book DTD v3.1.html`).

**Overlay "estás aquí":** **55% construido · 12 listas · 0 en obra · 10 en diseño (22 pantallas-meta)** —
**sin cambio** vs v1.9.1 (las 6 nuevas son `ref`, no diluyen) + 9 módulos ERP backlog + 6 referencias v2.3.
Se agregó el flag `ref` a `scripts/norte.mjs` (listar referencia sin contar en el %).

**Peso (fuera de git):** `uploads/`, `scraps/`, `screenshots/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v1.9.1 — cargada 2026-05-31 (handoff de Cloud Design · ola finanzas/fiscal + portal unificado)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v1.9.1).zip` (~13.9 MB). El ZIP viene
**envuelto en `dtd-cargo/project/`** (estructura nueva) → se extrae ese contenido a `_norte/`.
Se omitieron `uploads/` y `scraps/` (221 PNGs de trabajo, ruido). git detectó **21 nuevos · 9 borrados**.

**Portal unificado (resuelto en origen):** Cloud Design eliminó el duplicado "· V2" y dejó el nombre
base con el contenido bueno → `Portal del Cliente.html` + `portal/app.jsx` (67→**91 KB**) y
`Registro Cliente.html` + `portal/registro.jsx`. Se borraron los huérfanos "· V2" y `_legacy/portal-v1/`.

**~11 módulos nuevos (mockup, sin código en el repo todavía → 📋 Diseño):**
- **Finanzas/Fiscal:** Cobranzas (CxC vencidas, pipeline con promesa de pago) · Tesorería (pagos a
  proveedores CN) · Fiscal · SENIAT (IVA 16%, retenciones IVA/ISLR, Libro Ventas/Compras, declaración,
  USD+VES@BCV) · Facturación IVA-aware · Toggle IVA/SENIAT (default OFF) · Export CSV real.
- **Reportes (3 fases):** categorización + datos reales (P&L, aging, IVA) · combinados op×finanzas
  (rentabilidad por ruta, margen por cliente, costo/CBM) · constructor interactivo.
- **Operación:** Naviera & Consolidación · Documentos · Hub central (transversal + adjuntos embebidos en
  cada transacción) · Flujo de trabajo (workflow view por rol con badges en vivo).
- **Dirección/CRM:** Tablero ejecutivo ("cabina del dueño") · Conversaciones (bandeja unificada) ·
  Fidelización & Referidos (ERP + portal) · Portal · Reclamos formales.

**Norte:** se agregaron los 9 módulos al índice como grupo "ERP · Módulos nuevos (v1.9.1)" (cards `inErp`
que abren el ERP, sin .html propio), listados como **referencia/backlog FUERA del %** (decisión: no diluir
el progreso con módulos que aún son mockup). Overlay: **55% construido · 12 listas · 0 en obra · 10 en
diseño (22 pantallas-meta navegables)** + 9 módulos del ERP como backlog aparte.

**Detalle:** el ZIP trae también `design_handoff_dtd_cargo/` (tokens/CLAUDE/README · posible reorg del handoff).
**Peso (fuera de git):** `Brand Book v3.0 Package/`, `_norte.html`. `uploads/` y `scraps/` no se extrajeron.

---

## v1.9 — cargada 2026-05-31 (handoff de Cloud Design; el front llegó a v1.9.2)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v1.9).zip` (~13.4 MB, 374 archivos).
El ZIP rotula "v1.9" pero internamente trae tres releases del día (v1.9 · v1.9.1 · v1.9.2, ver `nuevo/CHANGELOG.md`).
**Cero eliminaciones** — v1.9 es superset de v1.8. Lo que git detectó como avance real (ignorando ruido LF/CRLF):
**17 archivos con cambios de contenido (+396 / −53)** + **12 archivos nuevos**.

**Pantallas nuevas (v1.9 · 5 visuales que faltaban):**
- `Modo Cliente.html` (raíz) — barra de impersonación admin sobre un iframe del Portal del Cliente V2 (`?as=DTD-XXXX`).
- `nuevo/pantallas/usuario-perfil.{html,jsx}` + `usuario-perfil-data.jsx` — perfil de usuario interno (presencia, asignados por rol, timeline, contacto corporativo, acceso por ROLE_MODULES).
- `nuevo/pantallas/tu-dia.{html,jsx}` — bandeja personal cross-módulo consciente del rol (tareas derivadas de SHIPMENTS/INVOICES/QUOTES/NOTIFS).
- `nuevo/pantallas/hilo-comentario.{html,jsx}` — hilo de comentarios expandido (respuestas anidadas, @menciones, reacciones).
- `nuevo/pantallas/copilot.{html,jsx}` — AI Copilot conversacional (`window.claude.complete`, haiku, con snapshot de datos como contexto).

**Otros archivos nuevos:**
- `BACKEND-BRIEF.md` ⭐ — **brief técnico de backend + multi-tenant para Claude Code**: modelo de datos con `tenant_id`, auth/JWT, endpoints REST, mapa stores-mock→backend, integraciones externas. Es la hoja de ruta prototipo→producto. **Leer antes de empezar el backend del Studio.**
- `nuevo/modules/mailing-scheduled.jsx` — cola de emails programados (KPIs, cancelar / "enviar ya").

**Wiring al ERP (v1.9) + pulido (v1.9.1/.2) — archivos viejos tocados:** `erp/shell.jsx` (topbar Tu día + Copilot, menú usuario Modo cliente), `erp/modules/{users,comments,mailing,mailing-compose,shipments,invoices,despacho,tms}.jsx`, `erp/components.jsx` (`useFirstLoad`, `useHideValues` global), `nuevo/modules/{wiring,dashboard}.jsx`, `portal/app-v2.jsx` (soporte `?as=`). Destacan `tms.jsx` (+95: editor de incidencias), `wiring.jsx` (+56), `mailing-compose.jsx` (+41: adjuntos + programar).

**Overlay "estás aquí":** 2 construidas · 11 en construcción · 11 en diseño (24 pantallas-meta). Las 5 nuevas entran como 📋 Diseño (mockup sin código todavía). El conteo deriva del `status` del SDD por módulo (regla de 3 estados), no solo de "existe la carpeta".

**Peso (fuera de git):** `uploads/`, `scraps/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v1.8 — cargada 2026-05-30 (handoff de Cloud Design, fechado 2026-05-31)

Primera carga del NORTE-SYNC. Reemplaza la referencia v1.7 que vivía en el repo.
Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v1.8).zip` (13.8 MB).

**Nuevo vs v1.7 (pantallas / carpetas):**
- `Portal del Cliente · V2.html` (nuevo)
- `Registro de cliente · V2.html` (nuevo)
- carpetas `operario/`, `iconos-perfiles/` + `estado-cuenta.jsx`

**Releases que trae el handoff (de `HANDOFF.md` · ESTADO ACTUAL v1.8):**
- **v1.2** — Contabilidad (QuickBooks-like: plan de cuentas, diario/mayor, P&L, balance, lock de período)
- **v1.3** — Mobile ERP (vista móvil admin) + fix dark mode
- **v1.4 / v1.4.1** — Generador de etiquetas PDF bilingüe ES/中文 para suppliers CN
- **v1.5** — Validación MARKBOX server-side + email de bienvenida + Cola QR (storage listener)
- **v1.6** — 9 conexiones wireadas (Adjuntar · Programar · Mi perfil · Cambiar contraseña · Atajos · Generar BL · OAuth · sync HS/AES · Actividad reciente · Mailing Logs)
- **v1.8** — Gestor de columnas reutilizable (6 tablas) + ROLE_MODULES (permisos por rol) + fix render `.erp-route` + Logo Oficial 2 grupos
- **Además:** Plataforma + Super Admin, modo despacho + parciales, alertas de cierre de contenedor/BL a 50 CBM, escaneo por grupo, etiquetado mercancía peligrosa/frágil/marca/licencia, traducción 中文, Operarios PWA, Conciliación bancaria, Vault, perfiles individuales (chofer/camión/agente)

**Overlay "estás aquí":** 13/19 módulos con código en el repo.
**Peso (fuera de git):** `uploads/`, `scraps/`, `Brand Book v3.0 Package/`, `_norte.html`.

<!-- Próximas cargas: agregar la nueva versión ARRIBA de esta. El founder entrega el ZIP completo →
     Claude sobrescribe _norte/ + git diff + nueva entrada aquí. -->
