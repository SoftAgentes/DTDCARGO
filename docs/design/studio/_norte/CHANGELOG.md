# Changelog · v1.1+

## 2026-07-11 · 📡 Producto → Norte · corte de realidad (desde Claude Code)

Anotación desde el repo de producción (no es entrega de diseño): fix de un bug de interacción en el panel **"CBM por medidas"** de la Calculadora pública LCL (`/calculadora`; diseño en `HANDOFF-CBM-MEDIDAS.md`). Sin cambios visuales ni de marca; no toca la versión visible.
- **Síntoma:** *"a veces no muestra el cálculo"* — abrir/cerrar el panel de medidas **sin medir** pisaba el CBM escrito a mano con 0 → el estimado desaparecía.
- **Fix:** `cbmDesdeMedidas` solo reemplaza el CBM manual cuando hay medidas reales (`> 0`); abrir el panel por curiosidad ya no borra ni oculta un valor ya escrito. El tag **"auto · medidas"** también se muestra solo cuando el valor de verdad viene de las medidas (antes mentía sobre un CBM manual conservado).
- **Blindaje:** e2e de regresión (`e2e/calculadora.spec.ts`, guard probado rojo→verde) + e2e **cableado al gate** (`scripts/verify.mjs`, reusa el dev server del worktree o levanta el suyo). Barrido adversarial 29/29 (cargas × switches × ciudad × transiciones) contra la lógica de producción — sin bugs nuevos.
- Lo histórico no se reescribe; este corte solo anota realidad de producto sobre el Norte vigente.

## 2026-07-02 · 📡 Producto → Norte · corte de realidad (desde Claude Code)

Anotación desde el repo de producción (no es entrega de diseño): se actualizó el bloque
"🚀 Ya LIVE en producción" de `HANDOFF.md` al corte **2026-07-02**. Sin cambios visuales ni
de marca — versión visible sigue **v4.5**.
- **Shipped desde el corte 2026-06-20** (detalle por SDD en `HANDOFF.md`): Portal (reportar
  pago + hitos + cut-off · registro real · Club DTD · crédito de referido automático · correos
  de Auth brandeados), Studio (Administración 11 secciones · buscador global ⌘K · RBAC
  hardening), empleados/móvil (`/m/emp` + recibo PDF · phone-first), público (`/enlaces` LIVE
  con el diseño `handoff-enlaces` de este Norte).
- **⚠️ Producción SUPERÓ este Norte en dos partes** (para la próxima iteración de diseño):
  1. **Perfil del Portal** — N direcciones de entrega con predeterminada + estimado de entrega
     por dirección + avatar editable (SDD-0138); el prototipo aún muestra una sola dirección.
  2. **Usuarios & Roles** — `warehouse_scope` cn·ve·all (lo que `users.jsx` prometía) + desactivación
     real con anti-lockout + auditoría append-only + capabilities (SDD-0085 h3 + SDD-0139).
- Lo histórico no se reescribe; este corte solo anota realidad de producto sobre el Norte vigente.

## 2026-06-20 · 🔢 v4.4 → v4.5

Rediseño del **Portal del Cliente** + nuevo **Sistema de Movimiento**, consolidado como **v4.5** (marca y producto comparten número visible). Esta entrada va a Norte (Claude Code) — aplicar sobre el repo de producción respetando `CLAUDE.md` §SYNC-NORTE.
- **Versión:** v4.4 → **v4.5** en todo lo visible: Brand Book (renombrado `Brand Book DTD v4.4.html` → `Brand Book DTD v4.5.html`, portada/cover/footer/cierre + fila v4.5 en el changelog interno; se conserva la fila v4.4 como historia), sidebar ERP (`erp/shell.jsx`), títulos de Portal/Registro/Mobile ERP y apps de operario (CN/VE/Bodeguero/Camionero), comentario de `erp/tokens.css`, microsites de marca (Arquitectura, Mensajes, Datos, Accesibilidad, Posicionamiento, Movimiento, Portal·Rediseño), Brand Hub, Launcher, Vistas Móviles, y notas de generadores (Fondos, Reels, Stories). Punteros al Brand Book actualizados (`Brand Hub`, `Arquitectura`, `erp/modules/admin.jsx`, `erp/modules/admin-brand.jsx`).
- **Portal del Cliente · rediseño:** nav reorganizado → Inicio · **Alertas mis envíos** (ciclo Pre-alerta → Alerta → Envío; proveedores y documentos viven adentro, no como menú) · **Finanzas** (facturas como tarjetas + chips Estimados/Cotizaciones) · Referidos · Academia · Soporte. **Nueva compra** (prellenado → prealerta) en pantalla completa, asistente 1-2-3, **combobox de proveedor** (busca interno; Enter en inexistente → alta de proveedor con teléfono +86 por defecto y captura de WeChat obligatoria). **Packing List + Factura embebido** con permisos (Shipping Mark del cliente bloqueado vía `?mb/order/cliente`; nombre/empresa editable; el detalle veraz lo cierra el proveedor). **Seguimiento total** (agrupa por contenedor; consolidados como un solo seguimiento). **Calculadora flotante** (FAB arrastrable + redimensionable, pestañas CBM/Normal, no saca de la vista). Calculadora CBM: header sin logo, hero compacto, "tarifa actual de CBM" editable, multiplicador baterías 1.5 → **1.4** (sin badge), badge "Calculadora de CBM · LCL · DDP".
- **Sistema de Movimiento (nuevo · Brand Book capa de lenguaje):** `Sistema de Movimiento · DTD-Cargo.html` — una sola curva (`--ease`) + tres duraciones (`--dur-fast/--dur/--dur-slow`), principios sí/nunca, motion por capa (marca · producto · avisos) y respeto a `prefers-reduced-motion`.
- **Brand Hub:** reestructurado en **tres ejes** (Sistema · lo normativo / Producto · las plataformas / Herramientas · lo aplicado); nueva capa **Producto** (Portal, ERP, Operario) + doc **Portal · Rediseño 2026-06**.
- **Tuteo:** voz de IA y copy de cliente unificados a tuteo venezolano (Copilot del ERP, detección de ferias, correo de bienvenida, portal); barrido verificado en carpetas de producto; directivas de handoff corregidas para no reintroducir voseo.
- **Snapshots:** `para-enviar/` y `paquete-drive/` regenerados desde la fuente actual (Brand Book standalone v4.5); textos de instrucciones pasados a tuteo.
- **→ Aplicado a Norte (Claude Code) · 2026-06-20:** marca sincronizada al **Brand Book DTD v4.5** (book único — v4.4 borrado de `_norte/` y republicado gateado en `private/marca/brand-book-v4.5.html`); `BRAND-DECISIONS.md` ingestado; bump de versión única v4.5 en el Norte y el sitio; punteros del visor de marca de producción (`app/marca/**`, hub `/interno/marca`, bundle) → v4.5. **Refresh de contenido del prototipo APLICADO** (overwrite de `_norte/` desde el ZIP: ~40 archivos con cambio real — rediseño del Portal `portal/app.jsx`, Sistema de Movimiento + microsites de marca nuevos, barrido de tuteo; junk pesado excluido vía `.gitignore`; el `DECISIONES-WMS-SDD-0080.md` del ZIP se descartó, se mantuvo el `…0081.md` local). Lo histórico no se reescribe.

## 2026-06-19 · 🔢 v4.3 → v4.4

Recursos gráficos chinos recoloreados a la marca, plantillas sociales integradas al Generador de Redes y Packing List bilingüe renovado, consolidado como **v4.4** (marca y producto comparten número visible).
- **Versión:** v4.3 → **v4.4** en todo lo visible: Brand Book (renombrado `Brand Book DTD v4.3.html` → `Brand Book DTD v4.4.html`, portada/cover/footer/cierre/changelog), sidebar ERP, títulos de Portal/Registro/apps de operario, badges de módulo (Scorecard, Academia, Dashboard), tokens, Brand Hub y Launcher, `HANDOFF.md`, `CLAUDE.md`. Lo histórico (entradas previas, comentarios que fechan features) no se reescribe.
- **Recursos gráficos (Brand Book §07):** motivos chinos recoloreados a la paleta — meandro, olas, nube, marco y esquinas sueltas (uso diario); festivos linterna 灯笼 y nudo 中国结 (solo temporada, con BRAND-EXCEPTION del dorado); dragón de herencia en duotono wine/navy. SVG/PNG en `recursos-graficos/`.
- **Plantillas sociales:** Stories/feed (9:16 y 1:1) integradas al `Generador Redes · DTD-Cargo.html` con editor por plantilla, carga de foto, toggles de web/usuario y descarga PNG; carrusel 4:5 con tonos navy/wine/jade/white. `Plantillas base (sin texto)` con export 2× y ZIP.
- **Packing List + Factura:** bilingüe 中/EN (se quitó español), caja mixta (同箱), N.º de caja automático, etiquetas Shipping Mark por cartón, adjuntos plegables (docs + fotos de producto), autoguardado + historial, dirección de bodega copiable, vista móvil. Reglas de ingreso actualizadas (permisología, montacargas Yiwu, marca real).

## 2026-06-17 · 🔢 v4.2 → v4.3

Academia del alumno, Hub de Enlaces y reestructura del registro, consolidado como **v4.3** (marca y producto comparten número visible).
- **Versión:** v4.2 → **v4.3** en todo lo visible: Brand Book (renombrado `Brand Book DTD v4.2.html` → `Brand Book DTD v4.3.html`, portada/cover/footer/cierre/changelog), sidebar ERP, títulos de Portal/Registro/apps de operario, badges de módulo (Scorecard, Academia, Dashboard), tokens, Brand Hub y Launcher, `HANDOFF.md`. Lo histórico (entradas previas, comentarios que fechan features) no se reescribe.
- **Academia DTD (alumno):** `portal/academia-data.jsx` + `portal/academia.jsx` (window.PortalAcademia) · 7 pantallas mobile-first; standalone iPhone (`Portal Academia · Alumno.html`) + pestaña "Academia" en el Portal.
- **Hub de Enlaces:** `Enlaces · DTD-Cargo.html` (link-in-bio de Instagram, canónico) + `assets/og-enlaces.png`; variantes A/B/C eliminadas. Atribución WhatsApp (CRM) + UTM (analítica).
- **Registro (`portal/registro.jsx`):** acceso por correo + contraseña; cédula con prefijo V/E/P; teléfono con selector de código de país + autodetección; foto opcional; tel. oficina "recomendado"; nota de dirección de entrega; guía fusionada; asteriscos obligatorios en rojo (`erp/components.jsx`).
- **Portal:** tarjeta "Próxima salida" de contenedor (Home + eco en Nueva compra, `naviera-data.jsx` cargado) + panel de Tweaks (densidad/titulares/forma).

## 2026-06-14 · 🔢 Versión única del proyecto → v4.2

Sesión de herramientas de marca + módulos de operación, consolidada como **v4.2** (marca y producto comparten número visible).
- **Versión:** v3.7 → **v4.2** en todos lados visible: Brand Book (renombrado `Brand Book DTD v3.7.html` → `Brand Book DTD v4.2.html`, portada/cover/cierre/footer/changelog), sidebar ERP (`erp/shell.jsx`), badges de módulos (Scorecard, Academia, Dashboard), títulos de apps (Bodeguero VE, Camionero), tokens (`erp/tokens.css`), pointers (Brand Hub, admin.jsx, admin-brand.jsx, CLAUDE.md, HANDOFF.md).
- **Branding (Brand Hub):** Brand Hub (índice central de marca) + DTD Apps · Launcher (producto, separado); Packing List + Factura bilingüe; Firma de email; Packaging logístico; Cotización DDP; Plantilla de presentación (deck); Asistente de contenido (IA); Diplomas; Kit de bienvenida; Tarjeta editable por empleado; Reels + logo sonoro; Ciclo del Cliente (variantes) y hero web rediseñado (reemplaza el "360°").
- **Operación / ERP:** Inventario de consolidación (WMS CN/VE), Reclamos y siniestros (incidencias + seguro), Academia/LMS, Scorecard de proveedores, Dashboard ejecutivo. Calculadora del cliente: estimado `E-2026-XXXX` al enviar por WhatsApp (logueado/no logueado + match al registrarse) y tarifa con vigencia desde el ERP (puente `dtd-tarifa-cbm`); cotizador rápido en Cotización y Estimador alineados a la misma tarifa. Ciclo Estimado→Aprobado→Facturado en portal y ERP.
- Lo histórico (entradas previas, comentarios de código que fechan features) NO se reescribe.

## 2026-06-12 · 🔢 Versión única del proyecto → v3.7

Unificación de numeración: marca y producto comparten un solo número visible (**v3.7**).
- Sidebar del ERP: v2.5 → v3.7 (`erp/shell.jsx` + handoff móvil).
- Títulos: Portal del Cliente, Operario VE, Bodeguero VE, Camionero, Mobile ERP: v2.3 → v3.7.
- Comentarios-puntero "heredados del Brand Book v2.4" → v3.7 (`erp/tokens.css`, Logo Oficial, Iconos de Perfil, Aplicaciones de Marca, rates.jsx).
- Brand Book: badges "NUEVO v3.5" retirados (la historia vive en el changelog interno del book).
- `HANDOFF.md`: estado actual → v3.7 + regla de versión única.
- Lo histórico (CHANGELOG, comentarios de código que fechan features) NO se reescribe.

## 2026-06-10 · Estudio de Redes (ERP) + generador unificado

**Archivos nuevos:**
- erp/modules/estudio-redes.jsx — módulo Administración → Marca → Estudio de Redes: **calendario de contenido operativo** (zarpes/llegadas reales de `ERPData.SHIPMENTS` — solo contenedor/ruta/fechas, nunca cliente ni valor — + ferias Cantón/Yiwu, feriados CN/VE y fechas comerciales 2026; botón «Crear pieza» abre el Generador Redes con la plantilla prellenada vía URL params) + **registro pieza→campaña** (lee el seam `localStorage['dtd-piezas-log']`, asigna campañas del mock de Publicidad activa, sin flujo de aprobación).

**Archivos modificados:**
- Generador Redes · DTD-Cargo.html — tab 9 «⊞ Catálogo WhatsApp» (embebe el generador de catálogo con `?embed=1`); `logPieza()` asienta cada PNG descargado en `dtd-piezas-log`; prefill desde URL (`?tab&t&k&badge&eg&dd&mm&cta`).
- Generador Catálogo WhatsApp · DTD-Cargo.html — modo `?embed=1` (oculta header) + registro de descargas en el mismo seam.
- erp/modules/admin.jsx + DTD Studio · ERP.html — sección MARCA «Estudio de Redes» (icon radar) + script tag.
- Brand Book DTD v3.7.html — §08: card «Estudio de Redes · en el ERP»; links del catálogo ahora apuntan al generador unificado.

Cada entrada describe qué se hizo en esta sesión y qué archivos viejos (si alguno) se tocaron.

Formato:

```
## YYYY-MM-DD · <título corto>

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/foo.jsx
- nuevo/pantallas/bar.html

**Archivos viejos modificados (línea + razón):**
- erp/shell.jsx · línea ~140 · agregado ítem de sidebar para "QR Print Queue"
- DTD Studio · ERP.html · línea ~85 · agregado <script src="nuevo/modules/qr-queue.jsx">

**Notas:** ...
```

---

<!-- Las entradas nuevas se agregan acá arriba -->

## 2026-06-08 · ☎️ Actualización de teléfonos de contacto

Directorio de teléfonos cotejado contra el sistema. La mayoría ya coincidía
(`iconos-perfiles/showcase.jsx` es la fuente de los teléfonos por depto; la calculadora
usa el de CRM `+58 412 166 8021`, correcto). Cambios aplicados:

- `iconos-perfiles/showcase.jsx` · **Compras** → `+58 412 454 5325` (antes placeholder).
  El número que tenía el **Sub-CEO** se liberó (era el de Compras); Sub-CEO queda con
  placeholder `+58 412 100 0006` (`// TODO: número real del Sub-CEO pendiente`).
- `factura-template/Factura · DTD-Cargo.html` · footer → oficina `+58 241 414 7886`
  (antes `+58 241-XXX-XXXX`); **Pago móvil** → `0414-887-0000` (Contabilidad, antes
  `0414-XXXXXXX`). ⚠ Confirmar con banco que el pago móvil va a ese número.

**Sin tocar:** teléfonos de empleados/choferes en `nomina-data.jsx` y `bodeguero.jsx`
(data de ejemplo, no contactos reales). **Transporte** se deja en `+58 412 495 0884`
(número real pendiente de confirmar). **RIF** de la factura sigue `J-40558712-0` (decisión
de unificación de RIF aún pendiente, fuera de este cambio).

---

## 2026-06-08 · 🧮 Calculadora CBM por medidas (alto × ancho × largo + cajas)

Feature pedida por el equipo, validada en sandbox y **promovida a producción** (es la
calculadora oficial para avanzar).

### ✅ Hecho en esta sesión

- **Forma alternativa de obtener el CBM (NUEVO):** en `calc/cbm-variants.jsx` (`window.CalcLCL`,
  monta en `Calculadora CBM · DTD-Cargo.html`). Debajo del campo **CBM total** hay un link
  discreto *"¿No sabés tu CBM? Calculalo con las medidas"*, **oculto por defecto**. Al abrir
  despliega un panel (`DimPanel`) con **Alto · Ancho · Largo (cm)** + **Cantidad de cajas**.
  Calcula `(alto×ancho×largo)/1.000.000 = m³/caja`, `× cajas = CBM total`, y **asigna el CBM
  automáticamente** (efecto de un solo sentido: medidas → `cbm`, sin loop). Con el panel activo
  el campo CBM queda `readOnly` con tag `auto · medidas`. Cerrar el panel libera el campo y
  conserva el último valor. El CBM calculado entra al mismo `computeQuote` → respeta punto de
  cruce, tope contenedor (68), densidad (600), excedente de peso, piso $50 y derivación a asesor.

**Archivos nuevos:**
- `HANDOFF-CBM-MEDIDAS.md` · spec de la lógica para Claude Code (queda como referencia; ya integrada).

**Archivos modificados (línea + razón):**
- `calc/cbm-variants.jsx` · helper `computeDims`, componente `DimPanel`, prop `readOnly` en
  `NumField`, estado `showDims/altoStr/anchoStr/largoStr/cajasStr` + `useEffect` de autoasignado,
  y disparador + panel en el render bajo la fila CBM/Peso. Keyframe `dtd-dim-open` en la inyección CSS.

**Borrados (consolidación · single source of truth):**
- `calc/cbm-medidas.jsx` y `Calculadora CBM · Prueba medidas.html` (sandbox de validación, ya mergeado).

**Notas:** copy en **voseo** para igualar el resto de la calculadora (pendiente la decisión global
tuteo vs. voseo del `CLAUDE.md`, que toda la calculadora viola hoy). Autoasignado en vivo (sin botón
"Usar este CBM"), según pedido original. Sin colores/fuentes/tokens fuera del sistema.

---

## 2026-06-07 · 🪪 Tarjeta de presentación + celebración Shipping Mark + branding v3.5 + chequeo de handoff

Sesión de branding + producto + preparación de handoff a Claude Code.

### ✅ Hecho en esta sesión

- **Tarjeta de presentación (NUEVO · pieza oficial de marca):** `Tarjeta de Presentación.html`.
  Doble cara, 85×55 mm con sangrado 3 mm. Frente en Papel DTD con el lockup canónico (isólogo
  `primary` + wordmark Archivo Black: DTD wine / Cargo navy), spine wine a sangre, datos de la
  persona (Sora/Nunito Sans) y contacto en JetBrains Mono. Dorso navy con isólogo `reverse`,
  tagline "Con Confianza, de China a tu puerta." y **QR vCard** (librería qrcode-generator,
  módulos navy sobre tile cream). Plantilla por empleado (3 perfiles, incl. bilingüe ZH con
  Noto Sans SC), selector en vivo, spec de imprenta (tintas CMYK/Pantone de referencia,
  tipografías) e **imposición con marcas de corte** + botón de impresión 1:1 + descarga `.vcf`.
  Reusa `erp/tokens.css` y `assets/dtdcargo-isologo-*.png`. Sin colores/fuentes fuera del sistema.
- **Celebración del Shipping Mark al registrar la compra (producto):** `portal/registro.jsx`.
  En la pantalla de éxito, cuando el cliente registra su compra inline, la **tarjeta roja del
  Shipping Mark de arriba reacciona**: muta de `DTD-XXXX` a `DTD-XXXX-1-1` (markbox·proveedor·compra),
  badge verde de check, eyebrow "compra registrada", send-line ("este es el código que le mandás
  a tu proveedor"), banner de felicitación y animación dentro del sistema (pop + ring `--success`
  + shimmer + swap; respeta `prefers-reduced-motion`). Nuevo componente `MarkboxCard` + estado
  `purchase` lifteado a `StepSuccess` + callback `onRegistered` en `SuccessPurchaseCTA`. El banner
  "faltan pasos" ahora se oculta también cuando la compra se registró inline (`!purchase`).
  Keyframes en `Registro Cliente.html`. Sin emojis en mensajes de éxito (regla de tono).
- **Branding → v3.5:** `Brand Book DTD v3.2.html` subido de v3.4 a **v3.5** (portada, footer, cierre,
  changelog). Tarjeta agregada como pieza **13** del grid de aplicaciones, al índice de recursos
  (badge `TP`) y a "lo que falta consolidar" (✓). CLAUDE.md actualizado con la pieza + datos de
  contacto oficiales.
- **Chequeo de handoff:** auditados links internos `href/src` (todos los `.html`/`.jsx`/`.css`/
  imágenes resuelven a archivos existentes); **sin** marcadores de conflicto (`<<<<<<<`/`=======`/
  `>>>>>>>`); QR del dorso corregido (antes el CSS pintaba fondo + módulos en `--ink` → ilegible).

### ⏳ Pendiente / Backlog

- **Colateral impreso** (comparte layout/sistema con la tarjeta): membrete A4 · credencial/carnet con
  lanyard · uniforme · vinilos de camión · roll-up/banner · sello + firma de correo.
- Carpeta huérfana `tarjeta/` (3 PNGs duplicados de `assets/`, sin HTML que la use) — eliminada en
  esta sesión para limpiar el handoff.

## 2026-06-06 · 🧾 Bitácora · auditoría de calculadoras + backlog del cotizador (sin tocar producto)

Sesión de análisis y registro. **No se modificó producto** (ERP/portal): se relevó el estado de las
calculadoras/cotizadores y se dejó asentado el backlog que surgió de comparar con el sitio web vivo
(`dtdcargo.com/calculadora` y `dtdcargo.com/cotizar`). Commit de continuidad.

### ✅ Hecho / confirmado en esta sesión

- **Inventario de cotizadores existentes (2):**
  1. **Cotizador interno del ERP** — `erp/modules/quotes.jsx · QuoteCalculator`. Staff-facing:
     servicio (LCL DDP / FCL 20' / 40'HC), buscador Cliente·Shipping Mark, origen/destino, dimensiones por
     caja, peso, embalaje, **tarifa $/CBM editable**, servicios adicionales del catálogo, **Total DDP**
     (flete + aduana + impuestos, válida 30 días). **Sin botón de WhatsApp.**
  2. **Cotizador Exprés del Portal (móvil)** — `portal/mobile-extra.jsx · CotizadorScreen`.
     Client-facing: ruta CN→VE, servicio, CBM → **estimado DDP** + tránsito. **Publica al bridge**
     (`pushPortalEvent kind:'cotizacion'`) → entra al ERP como lead/cotización; estado de éxito con
     referencia rastreable `SOL-2026-XXX`. CTA actual = "Solicitar cotización formal" (in-app).
  - Ambos son **marítimos DDP puerta a puerta (CN→VE)**. El lead queda integrado en CRM
    (`source: 'Web · cotizador'`).
- **Verificado** que el cierre Portal→ERP de la sesión previa (v2.3) sigue intacto sobre la base actual
  (v2.5): `portalInbox` + `pushPortalEvent`/`markPortalRead`/`tenantForMarkbox` en `erp/data-bridge.jsx`,
  suscripción + badge numérico + filtro `byTenant` en `DTD Studio · ERP.html` / `erp/shell.jsx`, y los
  tres emisores (registro web+móvil, cotizador, re-compra). Mapeado a backend en `backend/API-CONTRACT.md §5`.

### ⏳ Pendiente / Backlog (priorizar con el usuario)

**Brecha vs. sitio web vivo (2 piezas que el sitio tiene y el proyecto NO):**

1. **`/calculadora` pública con botón de WhatsApp** — calculadora de marketing/atención rápida cuyo CTA
   arma un **deep-link `wa.me` con el mensaje del cliente + los datos calculados**. Hoy NO existe el flujo
   *cotización → WhatsApp prellenado* (lo único con `wa.me` es el share de referidos en `portal/app.jsx`).
   - *Decisiones abiertas:* ¿segundo CTA dentro del **Cotizador Exprés** existente o **landing pública
     `/calculadora`** separada del portal logueado? ¿a qué número cae el `wa.me` (agente del lead vs.
     número central DTD)? ¿también publica al bridge?
2. **`/cotizar` · calculadora de Última Milla (terrestre VE)** — quoting del **tramo terrestre** de cara al
   cliente. Hoy existe la lógica **operativa** de última milla (carga de camión, CBM, ocupación, rutas en
   TMS/Bodeguero) pero **no** una **calculadora de tarifa terrestre**. Las dos calculadoras actuales son
   solo el leg marítimo.
   - *Decisiones abiertas:* variables reales del `/cotizar` (peso/volumen, ciudad origen-destino dentro de
     VE, tipo de vehículo, $/km o tabla por zona). Replicar fiel si se pasa la lógica/screenshot; si no,
     mock realista marcable.

**Mejoras de producto propuestas (de mensaje previo, pendientes de priorización):**

3. **Cotizador y "Pedir re-compra" del móvil al bridge** — ✅ **ya hecho** en v2.3 (queda registrado como
   cerrado; era parte del backlog original).
4. **Badge/aviso en el ERP de registro nuevo del portal** — ✅ **ya hecho** en v2.3 (badge numérico +
   ítems del portal accionables en el Topbar).
5. **#14 Multi-tenant** — ✅ confirmado: el portal móvil respeta el tenant (vista single-client, eventos
   etiquetados por `tenantId` derivado del prefijo Shipping Mark, ERP filtra con `byTenant`).
6. **PWA · "Instalar app" real** — ⏳ **pendiente de DEPLOY** (no codeable acá). Artefactos completos y
   verificados (`manifest.webmanifest`, `sw.js`, `assets/pwa-icon-192/512.png`, `beforeinstallprompt`);
   el prompt + service worker **requieren contexto seguro (HTTPS)** → falta **publicar en hosting HTTPS**.

**Notas:** entrada puramente documental — cero cambios de código, cero riesgo de marca. La próxima sesión
arranca eligiendo 1 y 2 (las brechas reales vs. el sitio); 3/4/5 ya están cerrados, 6 es un paso de infra.



## 2026-06-06 · 🎨 Brand v3.3 · stickers redondos + entregables sociales

Sesión de identidad social y entregables binarios. Sin tocar producto (ERP/portal) salvo enlaces.

**Archivos nuevos:**
- `Portadas Redes · DTD-Cargo.html` — propuestas de cabecera YouTube (2048×1152) + Facebook (851×315), 3 direcciones, áreas seguras, descarga PNG a tamaño real, viabilidad de logo animado por plataforma.
- `Portada Animada FB · DTD-Cargo.html` — video de portada 1250×463 en loop (ruta CN→VE), con botón "Grabar video" que exporta **MP4 nativo** (MediaRecorder) + modo `?embed=1`.
- `assets/portada-fb-poster.png` — póster estático de la portada animada (para el self-contained, offline).
- `favicon-pack/` — set completo (favicon.ico 16·32·48, PNG 16/32/48, apple-touch 180, android 192/512, maskable 512, site.webmanifest, README, preview HTML).
- `Comprobante WhatsApp · DTD-Cargo.html` — comprobante vertical 1080×1920 para mandar como foto.
- `brandbook-icons/*.png` (15) — íconos de perfil reales renderizados (8 roles + 7 grupos) para la sección 07 del Brand Book.

**Archivos modificados:**
- `Aplicaciones de Marca.html` · sección 12 · sticker pack ahora **redondo + transparente** (512×512, aro blanco WhatsApp), spec de formato + export real `.webp`/`.png` (canvas, sin libs). Thumbnail bundler agregado.
- `Brand Book DTD v3.2.html` · versión visible **v3.2 → v3.3** (portada, sidebar, cierre, footer, changelog); sección 07 íconos reales; sección 09 fotográfica completa; "Confianza" mayúscula; enlaces a portadas; íconos de perfil.
- `erp/shell.jsx`, `portal/app.jsx`, `erp/modules/admin.jsx` · migración del isólogo viejo (`dtdcargo-icon-navy.png` + filtros) al sistema oficial v1.0 (primary/reverse por tema, sin filtros).
- `assets/container.svg` · wordmark `CARGO` → `Cargo`.
- `erp/tokens.css` · clases `.dtd-iso-auto`/`.dtd-iso-ondark` + tokens de wordmark por tema.
- Tagline "Con **C**onfianza, de China a tu puerta." propagado a 13 archivos de producto + `CLAUDE.md`.
- Self-contained regenerados (Brand Book + Aplicaciones de Marca).

**Eliminado:** `assets/dtdcargo-icon-navy.png` (raster viejo, ya sin referencias vivas).

**Notas:** los nombres de archivo del Brand Book se mantienen en `v3.2` para no romper enlaces; solo cambió la versión mostrada a v3.3. Pendiente de los 12 entregables binarios: favicon ✓, factura/comprobante ✓, sticker pack ✓ — falta el ZPL (etiqueta de bodega), en curso.



## 2026-06-02 · 🏁 RELEASE v2.5 · Finanzas completas + Nómina + App del Empleado

Consolidación de toda la sesión. Auditoría de integración pasada (cuadre exacto, cero cuentas
faltantes, todos los puentes postean cuadrado). Título del ERP: v2.4 → **v2.5**.

**Incluye (detalle en las entradas de abajo):**
1. **Libros contables reconectados** al plan real + harmonizados con los libros fiscales.
2. **Escritura contable completa:** nuevo asiento, registrar pago/gasto, editar/eliminar asiento,
   editar/inactivar cuentas.
3. **Cierre de ejercicio + diferencia cambiaria automática.**
4. **Activos fijos + depreciación.**
5. **Provisiones fiscales** (ISLR · municipal · ajuste por inflación).
6. **Puentes:** Fiscal→Contabilidad, y subdiario→mayor (cobranzas, tesorería, conciliación).
7. **Nómina:** pago en VES / contabilidad en USD (forex) + comunicaciones RRHH→empleado.
8. **Rol `Empleado`** (RBAC → solo Nómina) + 3 usuarios enlazados a sus fichas.
9. **App del Empleado** (teléfono dedicado): login, recibo, inbox de comunicaciones con "Acuso
   recibo", perfil.

**Auditoría 2026-06-02 (eval_js):** Balance A 220.173 = P 41.628 + Pat 178.545 (ok). Cuentas
referenciadas por todos los builders existen en el plan. Stress test de puentes (pago, ISLR,
depreciación, nómina, conciliación) → todos cuadran y el balance se mantiene.

---

## 2026-06-02 · 📱 v1.0 · App del Empleado (teléfono dedicado)

**Opción B:** app de teléfono propia para el empleado (autoservicio de nómina), espejando el
patrón del Portal del Cliente.

**Archivos nuevos:**
- App del Empleado.html · shell PWA (tokens + react + icons + data + rates + nomina-data + app).
- empleado/app.jsx · `window.EmpleadoApp`: login propio (autentica contra USERS rol Empleado →
  empId), marco de teléfono + status bar + tab bar, y 4 pantallas:
  - **Inicio:** saludo, tarjeta de pago (neto Bs + ref USD/BCV), pendientes por confirmar, accesos.
  - **Recibo:** desglose (asignaciones / deducciones SSO·RPE·FAOV / neto Bs+USD) + compartir WhatsApp.
  - **Mensajes (inbox):** comunicaciones de RRHH (recibo/aviso/llamado/amonestación) con no-leído;
    detalle con "Acuso recibo" (ack) para llamados y amonestaciones.
  - **Perfil:** ficha + cerrar sesión.

**Modelo:** reusa `NominaData` (calcRecibo, commsFor, markComm, waLink) y `ERPRates`. Sesión en
localStorage (`dtd-emp-session` = empId). Login demo con 3 empleados (Yolanda/Daniela/Luis). Pago
en bolívares, referencia en USD. **Pendiente / a definir:** push real, adjuntar PDF del recibo,
historial de períodos anteriores.

---

## 2026-06-02 · 👷 v2.5 · Rol Empleado + Comunicaciones de nómina

**Formalización del autoservicio del empleado** (reusa el RBAC existente):
- erp/data.jsx · `ROLE_MODULES['Empleado'] = ['nomina']` → un usuario con rol Empleado, al
  hacer login, ve SOLO el módulo Nómina y aterriza directo ahí (mecanismo ya soportado por el
  shell: `role !== 'Admin' ? ROLE_MODULES[role] : '*'`). Agregados 3 usuarios-empleado
  (`u-101/102/103`) con `empId` que enlaza `USERS → EMPLOYEES`. Scope `self`.
- erp/modules/users.jsx · rol "Empleado" en la card de Roles y Permisos, el filtro y el form
  de invitación.

**Comunicaciones RRHH → empleado** (le llega a su app):
- erp/modules/nomina-data.jsx · modelo `COMM_*`: tipos recibo / aviso / llamado de atención /
  amonestación, con `commsFor`/`allComms`/`createComm`/`markComm` (read/ack) y `commWaLink`.
- erp/modules/nomina.jsx · pestaña "Comunicaciones" (lado RRHH): historial con estado
  enviado/leído/confirmado + drawer "Nueva comunicación" (empleado, tipo, asunto, mensaje,
  opción de reenviar por WhatsApp).

**Modelo:** el empleado puede o no tener acceso general; con rol Empleado queda acotado a Nómina.
Las comunicaciones se entregan in-app (inbox del empleado) y opcionalmente por WhatsApp.
**Pendiente / a definir con el usuario:** la app del empleado en sí (inbox/recibo del lado del
empleado) — falta decidir si es una vista del ERP acotada por rol o una app de teléfono dedicada
(como el portal del cliente).

---

## 2026-06-02 · 👷 v2.5 · Rol Empleado + Comunicaciones de nómina

**Formalización del autoservicio del empleado** (reusa el RBAC existente):
- erp/data.jsx · `ROLE_MODULES['Empleado'] = ['nomina']` → un usuario con rol Empleado, al
  hacer login, ve SOLO el módulo Nómina y aterriza directo ahí (mecanismo ya soportado por el
  shell: `role !== 'Admin' ? ROLE_MODULES[role] : '*'`). Agregados 3 usuarios-empleado
  (`u-101/102/103`) con `empId` que enlaza `USERS → EMPLOYEES`. Scope `self`.
- erp/modules/users.jsx · rol "Empleado" en la card de Roles y Permisos, el filtro y el form
  de invitación.

**Comunicaciones RRHH → empleado** (le llega a su app):
- erp/modules/nomina-data.jsx · modelo `COMM_*`: tipos recibo / aviso / llamado de atención /
  amonestación, con `commsFor`/`allComms`/`createComm`/`markComm` (read/ack) y `commWaLink`.
- erp/modules/nomina.jsx · pestaña "Comunicaciones" (lado RRHH): historial con estado
  enviado/leído/confirmado + drawer "Nueva comunicación" (empleado, tipo, asunto, mensaje,
  opción de reenviar por WhatsApp).

**Modelo:** el empleado puede o no tener acceso general; con rol Empleado queda acotado a Nómina.
Las comunicaciones se entregan in-app (inbox del empleado) y opcionalmente por WhatsApp.
**Pendiente / a definir con el usuario:** la app del empleado en sí (inbox/recibo del lado del
empleado) — falta decidir si es una vista del ERP acotada por rol o una app de teléfono dedicada
(como el portal del cliente).

---

## 2026-06-02 · 🔗 v2.5 · Conciliación bancaria → mayor

**Archivos modificados:**
- erp/modules/contabilidad-data.jsx · `findEntryByRef`, `reconcileBankMovement` (exportados).
- erp/modules/conciliacion.jsx · al confirmar un match ahora se concilia contra el mayor:
  `confirmMatch` / `postToLedger`, badge "→ AS-XXXX · ligado/creado/borrador posteado" en la
  fila y footer del detalle, botón "Contabilizar al mayor" cuando hace falta desbloquear.

**Modelo (correcto contablemente):** conciliar **liga** el movimiento del extracto a su asiento
existente (match por `ref` bancaria) sin duplicar; si el asiento está en **borrador** lo **postea**
(borrador→contabilizado); y si el movimiento no está en libros **crea** el asiento (crédito → débito
banco 1.04.01 / crédito CxC 1.05.01 · débito → débito CxP 2.01.06 / crédito banco). Crear/postear
requiere "Edición abierta"; ligar no muta el mayor. Verificado: los 3 modos andan y el balance cuadra.

---

## 2026-06-02 · 💵 v2.5 · Nómina (pago en VES · contabilidad en USD)

**Archivos nuevos:**
- erp/modules/nomina-data.jsx · empleados (seed) + cálculo de recibo (sueldo indexado USD,
  deducciones SSO 4% / RPE 0,5% / FAOV 1%), asiento contable y armador de mensaje WhatsApp.
  Expone `window.NominaData`.
- erp/modules/nomina.jsx · `ModuleNomina` con tabs: Nómina del período · Empleados · Envío
  por WhatsApp.

**Archivos modificados:**
- DTD Studio · ERP.html · agregados `<script>` de nomina-data/nomina + `nomina: window.ModuleNomina`
  en el moduleMap.
- erp/shell.jsx · ítem de sidebar `nomina` (grupo FINANZAS).

**Modelo:** sueldos indexados en USD, pago en **bolívares** (neto × BCV), contabilidad en **USD
funcional**. El asiento de nómina: débito `6.09.04` (gasto) · crédito `2.08` (aportes retenidos)
· crédito `1.01.02` (banco VES) por el neto, con `forex` (monto Bs + tasa BCV). Sección WhatsApp:
recibo en bolívares por empleado con link `wa.me` (versión básica). Verificado: asiento cuadra y
el balance se mantiene tras contabilizar. **Pendiente:** detalle adicional de la sección WhatsApp
(a definir por el usuario).

---

## 2026-06-02 · 🧾 v2.5 · Contabilidad: reconexión de libros + escritura

**Resumen:** el módulo de Contabilidad dejó de ser solo lectura. Primero se reconectó el plan
de cuentas real con los asientos/reportes (estaban en cero), y luego se activaron las altas,
ediciones y bajas (asientos, pagos, gastos y cuentas).

**Archivos nuevos:**
- erp/modules/contabilidad-forms.jsx · drawers de escritura (Nuevo asiento manual + edición,
  Registrar pago, Registrar gasto). Expone `window.ContabForms`.

**Archivos modificados (qué + razón):**
- erp/modules/contabilidad-data.jsx
  - Remapeados los 14 patrones de cuenta de los asientos seed al plan real (CxC→1.05.01,
    banco USD→1.04.01, VES→1.01.02, flete marítimo→4.09.03.02, DDP→4.09.02.02,
    costos→5.07.x, gastos→6.02/6.09.04/6.13/6.18.02). Agregada cuenta `2.01.08 IVA DÉBITO FISCAL`.
  - Helpers de saldo reescritos **leaf-aware** (`isLeaf`, `directBalance`, `postedAccounts`,
    `typeTotal`): postean/suman a cualquier nivel sin doble conteo. `accountBalance` recursivo;
    `calculatePL`/`calculateBS` recalculados.
  - **Bug crítico arreglado:** `getAccount` global chocaba con el de `tesoreria-data.jsx`
    (la última definición ganaba) → los saldos daban 0. Renombrado a `cdGetAccount` /
    `tesGetAccount` (claves exportadas intactas).
  - Capa editable del libro diario: `SEED_ENTRIES` (fábrica) + overrides en localStorage
    (`dtd_journal_v25`) → `createEntry`/`updateEntry`/`deleteEntry`/`nextEntryId`.
  - Cuentas nuevas en el plan: `1.18 IVA crédito fiscal`, `2.01.09 IVA por pagar (SENIAT)`,
    `2.01.10 retenciones por pagar`.
  - Helpers de activos fijos: `FIXED_ASSETS` (seed), `assetDepreciation`, `createAsset`,
    `buildDepreciationEntry`.
  - Helpers de provisiones/puentes: `buildProvisionEntry`, `buildRetencionesEntry`,
    `buildIvaSettlementEntry`, `pendingCollections`/`pendingPayments`/`postCollection`/`postPayment`.
  - Helpers de cierre: `foreignPositions`, `buildRevaluationEntry`, `buildClosingEntry`,
    `readClose`/`writeClose` (marcador de período).
  - Edición/inactivación de cuentas: overrides en localStorage (`dtd_coa_overrides_v25`) →
    `updateAccount`/`setAccountActive` (las cuentas del seed no se borran; se inactivan).
- erp/modules/contabilidad.jsx (v1.1 → v2.5)
  - Dashboard: tarjetas de caja por rubro real (1.04/1.01/1.03/1.02) + CxC 1.05 / CxP 2.01.
    CFReport sobre cuentas de caja reales. BSReport reescrito al nuevo shape agrupado por rubro.
    CoA tab muestra saldo por hoja.
  - Cableado de escritura: botón "Nuevo asiento", acciones rápidas "Registrar pago/gasto",
    "Editar"/"Eliminar" en el detalle del asiento (respeta modo seguro), próximo nº dinámico.
  - Plan de cuentas: botón "Editar" por cuenta hoja + `EditAccountDrawer`, filtro
    "Ocultar inactivas", badges "Inactiva"/"Propia".
  - Nueva pestaña **"Cierre & ajustes"** (`CierreTab`): (a) diferencia cambiaria · revalúa las
    cuentas monetarias VES/CNY a tasa de cierre y postea la diferencia a 6.04; (b) cierre de
    ejercicio · cancela ingresos/costos/gastos contra Ganancias Retenidas (3.04). Marcador de
    cierre en localStorage (`dtd_period_close_v25`).  - Nueva pestaña **"Activos fijos"** (`AssetsTab` + `AssetDrawer`): registro de bienes de uso
    con depreciación lineal (costo/acumulada/neto/mensual) y botón "Contabilizar depreciación"
    (débito 6.06 / crédito 1.11). Seed de 4 activos + alta de nuevos.
  - Nueva pestaña **"Por contabilizar"** (`PorContabilizarTab`): puente subdiario→mayor ·
    contabiliza cobros (Cobranzas/Tesorería → débito banco/crédito CxC 1.05.01) y pagos
    (órdenes de Tesorería → débito CxP 2.01.06/crédito banco), con tracking de posteo.
  - `CierreTab` → card **Provisiones fiscales** (`ProvisionesFiscales`): ISLR (6.16/2.01.03),
    municipal (6.14.04/2.01.04), ajuste por inflación (6.14.05/2.01.07).

- erp/modules/fiscal.jsx · `ContabilizarFiscal`: puente Fiscal→Contabilidad en Declaración IVA
  (cuota a 2.01.08/1.18/2.01.09) y Retenciones (a 2.01.06/2.01.10/2.01.03).

- erp/modules/tesoreria-data.jsx · `getAccount`→`tesGetAccount`; campos `coa` actualizados al
  plan real (1.04.01/1.01.02/1.04.02/1.03.02/1.03.01/1.02.01).
- erp/modules/direccion.jsx · `accountBalance('1.1.10')` → `'1.05.01'` (CxC).
- DTD Studio · ERP.html · línea ~114 · agregado `<script src="erp/modules/contabilidad-forms.jsx">`.

**Cuadre verificado:** Activo $198.920 = Pasivo $39.890 + Patrimonio $159.030 · Ingresos
$249.310 · Utilidad neta $159.030. Alta/edición/baja de asientos preservan el cuadre.

**Pendiente (sección contable):** nómina (se hace al final).

**Harmonización libros↔fiscal (2026-06-02):** el seed contable se completó para igualar los libros
fiscales — agregadas las facturas F-2026-0402 (Pereira) y F-2026-0421 (Tech, exento), y desglosado
el IVA crédito (1.18) en las compras gravadas (agente, alquiler, comisiones + licencias de software).
Resultado: IVA débito en libros = $41.628 y crédito = $1.053, idénticos a los libros fiscales; la
"Contabilizar declaración IVA" ahora cancela exactamente 2.01.08 y 1.18 contra IVA por pagar (2.01.09).

---

## 2026-06-02 · 🧹 Auditoría + limpieza + handoff a Claude Code

- **Auditoría completa:** 37 módulos del ERP + todos los entrypoints (portales, apps de
  operario, propuesta, aceptación T&C, marca, mapa) cargan sin errores de consola ni links
  rotos. Todas las refs de `<script>`/`<img>`/`href` resuelven. Único mensaje: warning benigno
  de Babel in-browser (esperado en prototipo).
- **Limpieza:** borrados ~120 screenshots de prueba en `scraps/` (se conserva el sketch
  `.napkin`). Eliminado el huérfano `Brand Book DTD v3.1 · para enviar.html`.
- **Brand Book v3.2:** puntero de fuente de verdad actualizado a `Brand Book DTD v3.2.html`
  (todas las refs vivas ya apuntaban ahí: `admin-brand.jsx`, `CLAUDE.md`, `HANDOFF.md`, `Reporte`).
- **Handoff:** proyecto empaquetado para Claude Code (CLAUDE.md + HANDOFF.md + HANDOFF-MOBILE.md
  + backend/API-CONTRACT.md + legal/ + CHANGELOG.md como front-door).

---

## 2026-06-02 · 🔌 #5 · Contrato de API para backend real (handoff)

Nueva carpeta `backend/`: `API-CONTRACT.md` mapea **cada seam del prototipo**
(`window.DTDData` stores + funciones, `window.DTDFlags`, `window.LegalData`, auth del
`Operario · App`) a su endpoint REST: auth+sesión multi-tenant, clientes/Shipping Mark secuencial,
cotizaciones (cotizador→formal→aceptación, reliquidación CN), **aceptación legal con evidencia
inmutable (IP+hash+timestamp server-side)**, bandeja del portal, facturación + gate, operación
CN + **sync offline** (outbox), config/feature-flags a nivel tenant, notificaciones
(WhatsApp/email/push) + orden de implementación. `backend/README.md` explica el principio
"mismas firmas, otra implementación" y lo no negociable (multi-tenant, sesión revocable,
evidencia inmutable, servidor = frontera de seguridad). Referenciado desde `CLAUDE.md`.
**No se construye el servidor** (fuera del prototipo HTML); es la spec para que devs/Claude
Code lo implementen.

---

## 2026-06-02 · ⚖️ #4 · Panel "Pendiente de revisión legal" (placeholders [..])

`erp/modules/admin-legal.jsx`: helper `legalPlaceholders()` escanea el cuerpo vigente
(`LEGAL_BODY`) y detecta los `[…]` sin definir. En Configuración → Documentos legales se
agregó un panel ámbar "Pendiente de revisión legal" que los lista con doc + sección + texto,
para que el equipo/abogado los resuelva antes de publicar la versión final. Hoy detecta 1
(T&C §11 · jurisdicción). Es dinámico: aparece/desaparece según el texto. La validación en sí
es de abogado (no se inventa contenido legal).

---

## 2026-06-02 · 🧩 Bundle regen + IDs de cotización + "reclamo"→"caso" + estado "en proceso"

- **#6 Bundle handoff** (`design_handoff_mobile_app/`): regenerado. Se quitó `Operario Multi.html`
  (consolidado) y se sumó `Operario · App.html` como entry; refrescados todos los `.html`,
  `operario/*.jsx`, `erp/*` y docs (`CLAUDE.md`, `HANDOFF-MOBILE.md`) a la versión actual.
  README actualizado (entry = Operario · App).
- **#1 IDs de cotización sin contenedor:** en `erp/data.jsx`, los envíos en estado `cotizado`/
  `recibido CN` que aún no tienen contenedor pasaron de `DTDU-…` a **`Q-2026-…`**
  (460118→0188, 461245→1245, 462310→2310, 372110→0110; key del mapa de costos también).
  Una cotización en proceso no muestra número de contenedor hasta que se despacha.
- **#2 Terminología "reclamo" → "caso" (interno, unificado con el cliente):** etiqueta del tipo
  `reclamo` ahora "Caso", KPIs "Casos abiertos" (Conversaciones + Dirección + resúmenes),
  AUT-10 "abre un caso de soporte", guía de flujo y HANDOFF. Identificadores de código
  (`type:'reclamo'`, `openReclamos()`) se mantienen para estabilidad.
- **#3 Estado "en proceso":** la cotización generada por el cotizador exprés entra con
  `quoteStage:'en-proceso'` → en el detalle (web + móvil) muestra "Cotización en proceso ·
  en revisión por tu agente" con botón deshabilitado; **no es aceptable** hasta que el agente
  la finalice. Las cotizaciones formales (sin `quoteStage`) sí son aceptables.
- Verificado en vivo (móvil): generada → en proceso (no aceptable), seed → aceptable.

---

## 2026-06-02 · 🔗 Cierre #4 #1 #3 · calc en propuesta, enlace cotizador, pendientes legales

- **#4 Calculadora en propuesta:** los 10 `<input type="number">` de
  `propuesta/servicios-tarifas.jsx` (tarifa, costo, precio, stock, condiciones…) pasaron a
  `window.ERPUI.CalcInput`. Cierra la regla calculadora en todo el ERP.
- **#1 Enlace cotizador → cotización formal (auto):** nuevo store `dtd-portal-quotes` +
  `pushPortalQuote()` / `clientQuotes()` en `erp/data-bridge.jsx`. El cotizador exprés
  (`portal/mobile-extra.jsx`) ahora **genera automáticamente** la cotización formal, que
  aparece en "Mis envíos" (web `portal/app.jsx` + móvil `portal/mobile.jsx`) en estado
  `cotizado` y se puede aceptar (gate T&C). El filtro "En curso" ahora incluye las
  cotizaciones pendientes. **Fix:** la cotización usa id de cotización **`Q-2026-XXX`**
  (no `DTDU-` de contenedor) — una cotización en proceso aún no tiene contenedor. Se cargó
  `data-bridge.jsx` en `Portal del Cliente.html` (faltaba). Chip de filtro con `nowrap`.
- **#3 Pendientes legales:** los `[…]` (foro/jurisdicción T&C, ley/idioma del Acuerdo,
  exclusión Venezuela en seguro) quedan marcados en `legal/*.md` + `legal/README.md` para
  validación de abogado (sin inventar texto legal).
- Verificado en vivo (web + móvil): cotización generada como `Q-2026-…`, visible y aceptable.

---

## 2026-06-02 · 🔁 Re-aceptación por diferencia de medida (corrección de lógica)

**Bug:** la aceptación se ataba solo al ID de cotización y la evidencia no guardaba la medida,
así que si el cliente aceptaba el estimado en `cotizado` y luego en CN el CBM/peso real difería,
el sistema lo daba por aceptado y nunca pedía re-aceptar (contra la T&C "se reliquida al cierre").

**Fix — la aceptación se ata a la MEDIDA aceptada:**
- Evidencia ahora guarda `cbm`, `weight`, `total` (portal web + móvil + registro ERP).
- Gate `acceptedCurrent` = existe aceptación de ese quote **con la misma medida** que el envío
  actual. Si no, `needsAccept`. Si además hay una aceptación previa con **otra** medida →
  `priorDiff` → estado **re-aceptación**.
- UI: banner "La medida real cambió · re-aceptación requerida" con **antes → después**
  (CBM y $ del estimado tachado vs. medida real) + botón "Revisar y re-aceptar". La factura no
  se emite hasta aceptar la diferencia.
- Seed: `DTDU-462310` (Acindar, recibido CN, medido 9.2 m³/$7,360) + aceptación previa al
  estimado `Q-2026-2310` (7.0 m³/$5,600) en `admin-legal.jsx` para demostrar el caso.
- Verificado en vivo (web): antes→después correcto, gate y factura condicionada.

---

## 2026-06-02 · 🧹 Cierre de pendientes técnicos (#4 #5 #6 #7)

- **#4 Calculadora en inputs de dinero nativos:** nuevo `window.ERPUI.CalcInput`
  (`erp/components.jsx`) — input nativo sin wrapper con la regla calculadora (escribís `100+50`,
  queda `150` al salir). Aplicado a **Cobranzas** (tasa + monto US$/moneda local, `cobranzas.jsx`),
  **Contabilidad** (saldo inicial, `contabilidad.jsx`) y **líneas de factura/cotización**
  (rate, `catalog-lines.jsx`). Los campos de `ERPUI.Input type="number"`/`prefix="$"` ya
  calculaban. (Pendiente cosmético: inputs de `propuesta/servicios-tarifas.jsx`, pantalla de
  propuesta, no productiva.)
- **#5 Emojis de categorías de gasto** (`mobile/app.jsx · EXPENSE_CATS`): 🚕🍽🏨✈🛣⛽📋🤝
  eliminados. Las categorías ahora usan chip de texto + tile con **monograma** en el color del
  `tone` (on-brand, sin pictograma emoji). Verificado: Mobile ERP sin emojis.
- **#6 Terminología** (`operario/avisos.jsx`): "WhatsApp del bodeguero" → "del almacenista".
- **#7 Reclamo interno:** se deja **a propósito** — en el módulo Conversaciones del ERP
  "reclamo" es un tipo de conversación operativa interna (clasificación correcta). Lo de cara
  al cliente ya se unificó a "Soporte/casos" (Portal web + móvil). Sin cambios.

---

## 2026-06-02 · 🔗 T&C única fuente + enlace del cotizador (cierre de pendientes)

- **T&C unificada (1 sola fuente runtime):** `Aceptación T&C · Cotización.html` (demo) ahora
  carga `erp/modules/admin-legal.jsx` y deriva `LEGAL_DOCS` de `window.LegalData.currentDocs()`
  en vez de tener su propia copia hardcodeada. El modal del Portal, el repositorio del ERP y el
  demo leen del mismo origen; cambiar el texto en `admin-legal.jsx` (`LEGAL_BODY`) propaga a todo.
- **Enlace del cotizador:** el cotizador exprés (`portal/mobile-extra.jsx · CotizadorScreen`)
  ya publicaba al ERP (`pushPortalEvent kind:'cotizacion'`); ahora el estado de éxito da una
  **referencia rastreable** (`SOL-2026-XXX`) y explica que la solicitud aparecerá como
  "Cotización en proceso" en Mis envíos y que se avisará cuando esté lista para aceptar —
  cerrando el ciclo solicitud → cotización formal → aceptación.

---

## 2026-06-02 · 📁 Carpeta legal/ · 3 documentos (md canónico + docx original)

Se guardaron los tres documentos legales del negocio en `legal/`, cada uno en **.md**
(canónico, lo lee Claude Code directo) + **.docx** (original para subir a la web / firmar):
- **Terminos-Condiciones-DTD-v2.1** (cliente · v2.1 · 1 may 2026) — texto idéntico al de
  `admin-legal.jsx` y el modal del Portal.
- **Acuerdo-Operador-Consolidacion-ES-ZH** (interno · contrato B2B con el operador, bilingüe).
- **Brief-Seguro-Operador-ES-ZH** (interno · encargo de póliza a aseguradoras CN, bilingüe).
- `legal/README.md` indexa los tres (versión, ámbito cliente/interno, regla de sincronía con
  `admin-legal.jsx`, y los `[…]` legales pendientes de abogado). Referenciado desde `CLAUDE.md`
  para que el handoff a Claude Code los descubra. Texto extraído exacto de los .docx adjuntos;
  nombres de proveedor quedan entre `[corchetes]` en los internos (de cara al cliente: "el
  Operador de Consolidación", sin nombre).

---

## 2026-06-02 · 🧾→✍️ Gate de firma antes de facturar (recepción CN → cotización → aceptación)

Resuelve el hueco: en el modelo puerta a puerta el precio firme solo existe tras medir en
el almacén CN, así que la **cotización vinculante y la firma del cliente deben ocurrir ahí**,
antes de facturar (si no, AUT-04 facturaba sin que el cliente hubiera firmado nunca).

- **`erp/flujo-reglas.jsx`:** nueva regla **AUT-04a** (op-recibir → com-quote): al recibir y
  medir en CN genera/reliquida la cotización formal con CBM/peso real y la manda a aceptar.
  **AUT-04** (facturación) ahora queda **condicionada** a `aceptacion = registrada` — la
  factura no se emite hasta que haya aceptación. Log actualizado.
- **Portal web** (`portal/app.jsx · PortalShipmentDetail`) y **móvil** (`portal/mobile.jsx ·
  PMDetail`): el gate de aceptación ahora cubre `cotizado` **y** `recibido CN` sin aceptación
  previa (`needsAccept`, chequea `window.LegalData.ACCEPTANCES`). Para `recibido CN` muestra
  banner "Tu carga llegó y se midió · falta tu aceptación" con la medida real y la condición
  "la factura no se emite hasta que firmes", y el botón "Aceptar cotización · medida real".
- **Data:** seed `DTDU-461245` (Acindar, `recibido CN`, pendiente de firma) para demostrar el
  caso "compró directo en China → llegó y se midió → cotizá y firmá".
- Verificado en vivo (web): banner + gate + aceptación → `OS-2026-1245` registrada.

---

## 2026-06-02 · 🔗 Aceptación legal cableada en el Portal real (web + móvil)

El modal de aceptación quedó integrado en el Portal sobre las cotizaciones (envíos en
estado `cotizado`), reemplazando el botón suelto y escribiendo en el registro del ERP.
- **Fuente única de contenido:** `erp/modules/admin-legal.jsx` ahora expone `LEGAL_BODY` +
  `window.LegalData.currentDocs()` (versión vigente con cuerpo completo). El modal del
  Portal y el "Ver" del ERP leen lo mismo. Cargado en `Portal del Cliente.html` y
  `Portal Cliente Mobile.html`.
- **Portal web** (`portal/app.jsx`): `PortalAcceptModal` + `PortalDocViewer` +
  `PortalAcuseModal`; en `PortalShipmentDetail`, si `status==='cotizado'` se muestra
  "Aceptar cotización" → casilla obligatoria (gating) → confirma → registra evidencia en
  `window.LegalData.ACCEPTANCES` (unshift) → acuse con `OS-…` + hash; luego "Ver acuse".
- **Portal móvil** (`portal/mobile.jsx`): `PMAcceptFlow` + acuse en `PMDetail`, mismo flujo
  con `U.Modal`.
- **Data:** nuevo envío seed `DTDU-460118` (Acindar `DTD-5452`, `cotizado`) en `erp/data.jsx`
  para que el flujo sea visible por defecto. (Se evitó colisión con `DTDU-419032` existente.)
- Verificado en vivo (web + móvil): gating real, generación de orden, evidencia registrada
  y consultable desde Administración → Aceptaciones T&C.

---

## 2026-06-02 · ⚖️ Aceptación legal de cotizaciones · modal + repositorio + registro

**Modal de aceptación** (`Aceptación T&C · Cotización.html`, nuevo): paso obligatorio entre
"Aceptar cotización" y la generación de la orden. Casilla obligatoria con 2 enlaces (T&C DTD
+ Condiciones del Operador), cada uno abre su visor con versión y vigencia; "Confirmar"
bloqueado hasta marcar; al confirmar registra evidencia (cliente, cotización, doc+versión,
fecha/hora, IP, hash) y genera la orden `OS-…`. Contenido legal **final** (T&C v2.1 · 11
secciones; Operador v1.4 · 9 secciones), texto exacto, sin nombrar proveedores.

**ERP · dos componentes nuevos** (`erp/modules/admin-legal.jsx`, `window.LegalData` +
`window.AdminLegalDocs` + `window.AdminAcceptances`):
- **Configuración → Documentos legales:** repositorio versionado; cada doc con versión
  vigente + fecha de vigencia + histórico (vigente/archivada) + nº de aceptaciones.
- **Configuración → Aceptaciones T&C:** registro consultable (KPIs, buscador, filtro por
  documento, tabla con acuse/cliente/cotización/docs+versión/fecha, badge ámbar si la
  versión aceptada ya no es la vigente, y modal de detalle con toda la evidencia).
- Registradas en `ADMIN_SECTIONS` (grupo INTERMEDIO) + routing en `admin.jsx`; script
  cargado en `DTD Studio · ERP.html`. Verificado en vivo (8 aceptaciones seed, repositorio
  con histórico). **Pendiente:** cablear el modal en el Portal real (web + móvil) sobre las
  cotizaciones, reemplazando el botón actual.

---

## 2026-06-02 · 🚩 Feature flag · Programa de referidos (default OFF → "Próximamente")

Nuevo flag **`referidos`** (default **false**) en `erp/feature-flags.jsx`. Card de toggle
agregada en el admin (`erp/modules/admin.jsx · SectionFeatures`, grupo "Comunicación con
cliente"). Gating de cara al cliente: `portal/app.jsx · PortalReferidos` y
`portal/mobile-extra.jsx · ReferidosScreen` muestran un estado **"Próximamente"** (ícono +
copy) cuando el flag está OFF, y el programa completo cuando está ON. Para que el portal lea
el mismo flag que escribe el admin, se cargó `erp/feature-flags.jsx` en `Portal del Cliente.html`
y `Portal Cliente Mobile.html` (mismo `localStorage dtd_feature_flags_v1`). Verificado en
vivo: OFF→Próximamente, ON→programa. Default queda OFF (reglas del programa aún en definición).

---

## 2026-06-02 · 🎫 Portal · fusión Reclamos + Soporte → "Soporte"

`portal/mobile-extra.jsx` + `portal/mobile.jsx`. Se unificaron las dos subpantallas del
menú "Más" en una sola **Soporte**: el `SoporteScreen` ahora combina el bloque del agente
(Martina · WhatsApp/Email), la lista "TUS CASOS" (lo que eran reclamos → IDs `SP-2026-…`,
con tipo + estado) y el alta "Nuevo caso" (tipo + embarque opcional + descripción).
`ReclamosScreen` eliminado (función + export + routing `sub==='reclamos'`); el menú "Más"
pasa de 2 filas (Reclamos + Soporte) a 1 (Soporte · "Abrí un caso o hablá con tu agente").
**Sin la palabra "tickets"** por pedido — se usa "caso(s)". Verificado en vivo.

**Portal web** (`portal/app.jsx`): misma fusión. Se eliminó el tab "Reclamos" del nav y la
función `PortalReclamos`; `PortalSupport` ahora combina el chat del agente + canales
(WhatsApp/Email) con la lista "Tus casos" (`SP-2026-…`) y el alta "Nuevo caso" (reusa
`NewReclamoForm`/`ReclamoDetail` con textos renombrados reclamo→caso). Verificado: nav sin
Reclamos, Soporte muestra casos + agente, sin la palabra "reclamo" de cara al cliente.

---

## 2026-06-02 · ⏳ Spinner de marca · descargable desde el Brand Book (SVG + Lottie + GIF)

Generado en `app-spinner/`: `spinner.svg` (isólogo con pulse, vector self-contained, ~14KB),
`spinner.lottie.json` (apps móviles) y `spinner.gif` (encoder GIF89a inline, 18 frames,
paleta de marca). En `Brand Book DTD v3.2.html` (sección Aplicaciones, debajo del App icon)
se agregó un bloque con preview SVG animado en vivo + 3 botones de descarga (blob-fetch).
Card "05 · Spinner" del grid actualizada ("SVG · Lottie · GIF ↑"). Verificado: los 3 assets
responden 200.

---

## 2026-06-02 · 🏷 Terminología · Compra = Orden = Prealerta (opción b)

Investigado (couriers puerta-a-puerta US/VE): "prealerta" = el cliente avisa que viene
mercancía. Es el mismo registro que la "Compra" (cliente) y la "Orden" (interno).
`portal/app.jsx · PortalSuppliers`: subtítulo reescrito anclando el concepto ("Cada compra
es una prealerta…"), manteniendo "Nueva compra" como CTA. `CLAUDE.md`: nueva sección de
terminología Compra/Orden/Prealerta (regla por audiencia, como Shipping Mark/Shipping Mark).

---

## 2026-06-02 · 🎨 Brand Book v3.2 · App icon descargable (PNG + ZIP)

`Brand Book DTD v3.2.html` (renombrado desde v3.1, contenido v3.2 —
refs actualizadas en `CLAUDE.md`/`HANDOFF`/`admin-brand.jsx`). En la sección Aplicaciones se agregó el bloque
**App icon · iOS + Android** con preview + botones **Descargar PNG (1024)** (`<a download>`)
y **Descargar ZIP · todos los tamaños** (JSZip vía CDN, empaqueta los 20 PNGs de `app-icon/`
en el navegador). Fila de changelog v3.2 + versión bumpeada (título, sidebar, portada, footer).
Assets reales en `app-icon/` (master 1024 + iOS + Android adaptive), generados de la dirección A.

---

## 2026-06-02 · 🔒 Portal · hint "Es tu cédula" solo post-registro (seguridad)

`portal/app.jsx · PortalLogin`: el hint "💡 Es tu cédula" se mostraba en **cualquier**
primer acceso (`!dtd-portal-visited`) — riesgo de seguridad (revela que la contraseña es la
cédula a quien abra el login). Ahora se muestra **solo** cuando el usuario viene del registro:
gate por `sessionStorage('dtd-from-registro')`, que `portal/registro.jsx` setea en "Ir al
portal" y `PortalLogin` borra al entrar (one-time). En un login normal nunca aparece.

---

## 2026-06-02 · 📱 App "DTD Cargo" · ícono + nombre de instalación + sidebar redimensionable

- **Nombre de app:** la app instalable se llama **DTD Cargo**. Agregadas metas en
  `Operario · App.html` (`apple-mobile-web-app-title`, `application-name`, `…-capable`).
- **Ícono de app** (`App Icon · DTD Cargo.html`, nuevo): un solo ícono iPhone/Android sobre
  el isólogo de marca. 3 direcciones (A navy+cream+glow wine [recomendado], B wine sólido,
  C cream+primary), mock home iOS (squircle + label "DTD Cargo"), adaptive Android
  (círculo/squircle/rounded, marca al 54% safe-zone) y fila de tamaños (120→29) para legibilidad.
- **Sidebar redimensionable** (`erp/shell.jsx`): handle de arrastre en el borde derecho del
  sidebar expandido que reescribe la var CSS `--sb-expanded` (sidebar + contenido se
  sincronizan). Límite **200–280px**; el mínimo 200 es el ancho donde el label más largo
  ("Naviera & Consolidación") aún entra en una línea (debajo se cortaría). Ancho persistido
  en `localStorage` (`dtd-sb-w`); transición desactivada durante el drag para que sea fluido.

---

## 2026-06-02 · 📌 Sidebar v2 · gap real del sticky (modo colapsado)

El fix anterior no alcanzaba en modo colapsado: `sticky top:0` pega el botón "+ Crear"
contra el **content-box** del `<nav>`, dejando el `padding-top:14px` del nav como strip
visible por encima donde se asomaban los íconos. Fix real: se movió el `padding-top` del
`<nav>` (`padding: '0 10px 14px'`) al propio contenedor del botón Crear (`padding: '12px 0 10px'`,
sin `marginTop`). Ahora el sticky pega contra el borde del nav (gap = 0). `erp/shell.jsx`.

---

## 2026-06-02 · 📌 Sidebar · botón "Crear" tapa los ítems al hacer scroll

`erp/shell.jsx · CreateButton`: el botón "+ Crear" es `position: sticky` pero el `<nav>`
tiene `padding-top: 14px`, dejando un strip por encima del botón donde los íconos de los
módulos se asomaban al scrollear. Fix: el contenedor del botón ahora extiende su fondo
(`--bg-nav`) sobre ese padding (`padding-top: 14`, `marginTop: -14`), tapándolos.

---

## 2026-06-02 · 🧹 Consolidación · `Operario · App.html` reemplaza a `Operario Multi.html`

El multimodo quedó unificado en **`Operario · App.html`** (login único → auth → ruteo por
rol → picker multi-rol → modos conectados, con sesión persistente e íconos `window.Icon`).
`Operario Multi.html` era la versión vieja standalone (sin limpieza de emojis) → **eliminado**.
- `erp/modules/operarios-pwa.jsx`: la card `{id:'multi'}` ahora apunta a `Operario · App.html`
  (name "Operario · App").
- `HANDOFF-MOBILE.md`: tabla de ruteo y de apps actualizadas a `Operario · App.html`.
- Quedan referencias **históricas** en `CHANGELOG` (entradas viejas) y menciones cosméticas
  (`Reporte DTD-Cargo.html`, label de dispositivo en `Login y Sesión · Operario.html`) que no
  afectan el producto.

---

## 2026-06-02 · 🧮 Calc en campos de dinero ($) + íconos del home Operario CN

**#4 Calculadora en campos de dinero (ERP web):** `erp/components.jsx · Input` ahora activa
el modo calculadora también cuando `prefix === '$'` (antes solo `type="number"`). Cubre
automáticamente Facturación (base/monto), Tesorería (monto a pagar), Cotización (tarifa CBM),
Tarifas (tarifa/min charge) y Embarques (valor declarado). Pendiente menor: inputs nativos
`<input type="number">` fuera de `ERPUI.Input` (cobranzas pago, contabilidad saldo,
`catalog-lines` qty/rate) — no aceptan `+` por ser nativos; requieren conversión puntual.

**#1 Emojis del home Operario CN → window.Icon:** `operario/app.jsx` — 📷 (Escanear/Tomar
foto/scan/+Foto/Nueva recepción) → nuevo ícono de sistema `camera` (agregado a `erp/icons.jsx`);
✍️ (recibir manual) → `Icon.edit`. Home y flujo de recepción quedan sin emojis.

---

## 2026-06-02 · 🧾 Step4 · resumen incluye alertas de carga (comentario inline)

`operario/app.jsx · Step4Confirm`: el resumen no traía las **alertas de carga** marcadas en
Step3 (Frágil, Peligrosa, etc.). Agregada fila "Alertas" que lista `reception.flags`
(con etiquetas ES/中文) + el comentario `flagNote` si existe. De paso se limpiaron dos emojis
del resumen (📷 Fotos → "Fotos", 🟠 en Cliente huérfana → quitado).

---

## 2026-06-02 · 📐 Fix · MobileInput no desborda en grids (min-width:0)

`operario/app.jsx · MobileInput`: en columnas grid (`1fr 1fr` de Cajas/CBM) el `<input>`
tiene `min-width:auto` por defecto y forzaba el ancho de la columna → el sufijo "m³" se
salía a la derecha. Agregado `minWidth: 0` al `<label>`, al contenedor flex y al `<input>`.
Verificado: el borde derecho del CBM ahora alinea exacto con los campos de ancho completo.

---

## 2026-06-02 · 🧩 Step3Data · descripción ↔ rangos (lógica de herencia, comentario SAM)

`operario/app.jsx · Step3Data`. La descripción de arriba ya no se "pierde" al abrir rangos:
- **Un solo artículo:** se describe en el campo de arriba (sin abrir rangos).
- **Al abrir el primer rango:** `addRange` siembra la descripción de arriba en el rango 1 y
  **limpia** el campo superior; este se oculta y muestra "La descripción quedó desglosada por
  rango abajo". Las descripciones pasan a vivir por rango.
- **Al borrar el último rango:** `delRange` restaura esa descripción al campo de arriba (no se
  pierde el dato del artículo único).
- Helper contextual (sin rangos vs con rangos). Resumen de Step4 muestra la descripción única
  o, si hay rangos, el combinado `1–5: … · 6–10: …`.

---

## 2026-06-02 · 🧮 Regla calculadora system-wide + CBM/peso por rango con prorrateo

**Calculadora (toda entrada numérica/monetaria, web + app):** `erp/components.jsx · Input`
ahora evalúa sumas/restas tipo calculadora — automático con `type="number"` (o prop `calc`):
escribís `32+1`, muestra "= 33" en vivo y colapsa a `33` al salir. Misma mecánica ya en
`operario/app.jsx · MobileInput` (prop `calc`, aplicada a Cajas/CBM/Peso). Regla documentada
en `CLAUDE.md` (Convenciones).

**CBM por rango + prorrateo (`Step3Data`):** cada rango ahora tiene peso **y CBM**, ambos
**opcionales**. Si se dejan vacíos, el sistema **prorratea** el total entre los rangos por
cantidad de cajas (placeholder muestra el valor prorrateado en gris; si el usuario escribe,
sobreescribe). Se revirtió el modelo anterior "total = Σ rangos / read-only": ahora el total
es primario y los rangos son desglose opcional que prorratea. Helper y fila de rango
actualizados (kg + m³ + borrar, `flex-wrap`).

---

## 2026-06-01 · 🧾 Operario CN · Step3Data rediseñado (comentarios de SAM)

`operario/app.jsx · Step3Data` (recepción · datos). Atiende los 4 comentarios:
- **Sin HS code:** se eliminó el campo "HS Code" (del form, del estado `reception.hs`,
  y del resumen de Step4). Reemplazado por una **"Descripción de la mercancía"** de texto
  libre como forma principal de identificar el contenido.
- **Descripción + Rango:** el campo de descripción es primario y, al lado del label, un
  botón **"+ Rango"** desglosa por número de caja (metodología clara que reemplaza el
  confuso bloque "Descripción por rango"). Helper explica el uso. El `data-comment-anchor`
  se movió al nuevo input de descripción.
- **Campos más compactos:** Cajas/CBM perdieron `large` (56→48px, 24→15px); el CBM ya no
  "se sale" del diseño.
- **Regla calculadora:** los rangos son líneas; el **peso de cada rango suma automático**
  al Peso total (que pasa a read-only mostrando "Σ rangos"). Se quitó el botón manual
  "Usar como peso total". Fila de rango recompactada (kg agrupado, `flex-wrap`) — sin overflow.
- `MobileInput` ahora acepta `readOnly` y **`calc`**: en modo calc los campos numéricos
  evalúan sumas/restas tipo calculadora (escribís `32+1`, muestra "= 33" en vivo y colapsa
  a `33` al salir). Aplicado a **Cajas, CBM y Peso total**.

---

## 2026-06-01 · 🔤 Títulos de login robustos + "Bodeguera"→"Almacenista" en el directorio ERP

**Solape de texto (títulos de login):** se confirmó que NO era bug — el render real
(con Sora cargada) tiene gap de ~12px; el solape solo aparecía en el generador de
miniaturas, que no carga la webfont `Sora` (`--f-display`) → fallback más ancho → el
hero parte en 3 líneas y desborda. Igual se reforzaron los títulos de login para ser
robustos ante cualquier fuente: `operario/ve.jsx` ("Entregas DDP Venezuela" → 26px/1.2,
`maxWidth:14ch`, sin `<br/>`), `operario/app.jsx` ("Almacén Yiwu" → 26px/1.3),
`operario/bodeguero.jsx` ("Armar camiones" → 26px/1.3); subtítulos con `marginTop` 8→12.
En el bundle `design_handoff_mobile_app/` se quitaron los thumbnails de login por-app
(02/03/04/06) que el generador renderizaba con el artefacto; el login on-brand queda
representado fielmente en `01-sesion-canvas.png`. README del bundle actualizado.

**Unificación de terminología (directorio ERP):** `erp/modules/operarios-pwa.jsx` —
`op-005` (Yusneidy Rojas) `roleLabel: 'Bodeguera' → 'Almacenista'` y `app: 'Bodeguero'
→ 'Almacenista'`; la app del directorio `{id:'bod'}` `name: 'Bodeguero' → 'Almacenista'`
(archivo `Bodeguero VE.html` y los identificadores de código `BodegueroApp`/`BodegueroFlows`
se mantienen). Verificado en vivo: el directorio muestra "Almacenista", sin rótulos
"Bodeguer". (Pendiente menor, fuera de alcance: prosa "WhatsApp del bodeguero" en
`operario/avisos.jsx` y categorías de gasto con emoji en `mobile/app.jsx`.)

---

## 2026-06-01 · 🎨 Brand cleanup · operario flows on-brand (logo + emojis → window.Icon)

Alineación al `CLAUDE.md` de los archivos que el APK unificado (`Operario · App.html`)
abre por debajo.

- **Logo `invert` → variante oficial:** `<img …icon-navy… filter:'brightness(0) invert(1)'>`
  → `dtdcargo-isologo-reverse.png` (cream nativo) en `operario/bodeguero.jsx` (L92),
  `operario/ve.jsx` (L117), `operario/app.jsx` (L124) y `Operario Multi.html` (L55).
  (Regla CLAUDE.md: nunca invert sobre el isólogo; usar `-reverse` sobre navy.)
- **Emojis decorativos → `window.Icon` o eliminados** en `bodeguero.jsx` y `ve.jsx`:
  títulos/saludos (📦👋🚚 quitados); íconos de acción (📦🚛 → `Icon.box`/`Icon.truck`);
  callouts de estado (ℹ→`Icon.info`, ⚠/⚠️→`Icon.warn` o solo color); stats de ruta
  (📦📊🛣 quitados, las unidades ya rotulan); placeholders de foto (🚛📦 → `Icon.truck`/
  `Icon.box`); botones (💬 Enviar WhatsApp, 🔄 Borrar → sin emoji); marcador GPS en SVG
  (🚛 → punto blanco). Total ~25 spots.
- **Se DEJARON a propósito:** el template del mensaje de WhatsApp (🚛📍📦⏰ — es copy de un
  mensaje real, no UI) y el avatar del canal WhatsApp (💬 sobre verde #25D366), más los
  ✓ checkmarks tipográficos.
- **Cerrado después (misma sesión):** `operario/app.jsx` (Operario CN) — step icons
  (📦✓🏬🚢🌊 → `Icon.box/check/warehouse/box/globe`), íconos de card/lista/drawer/PhotoMock
  (📦🏷📋⚠️ → `Icon.box/tag/doc/warn`), flujo de impresión (🖨🏢 → nuevos `Icon.print` /
  `Icon.building`), y decorativos (📸🖨 quitados, ⚠/ℹ → `Icon.warn`/`Icon.info`); logo
  invert→reverse. `mobile/app.jsx` — logo invert→reverse. **Nuevos íconos de sistema**
  `print` y `building` agregados a `erp/icons.jsx` (aditivo). Verificado: `Operario CN.html`
  carga limpio, sin invert, sin emojis (solo ✓ tipográficos).
- **Pendiente menor:** categorías de gasto con emoji en `mobile/app.jsx` (EXPENSE_CATS,
  🚕🍽🏨…) — ese es el ERP móvil, no la app de operario; queda para otra pasada.
- **Verificado:** `Operario · App.html` (flujos recepción/despacho/entrega renderizan
  con íconos, sin emojis, sin errores), `Bodeguero VE.html` y `Operario VE.html` cargan
  limpios con logo `-reverse`.

---

## 2026-06-01 · 🔑 Operario · App.html — entry unificado (auth → ruteo por rol → sesión)

**`Operario · App.html`** (nuevo) · el **APK único** funcional que cablea la capa que
faltaba: login único → auth → ruteo por rol → home, sin re-login. Hace tangible el
concepto de `HANDOFF-MOBILE.md`.

- **Auth mock** (`DIRECTORY` + `authenticate()`): 4 perfiles demo (rbriceno=multi,
  yrojas=almacenista, jmateran=transportista, wchen=operario_cn), pass `1234`.
  Simula el `POST /auth/login` que devuelve `{ tenant, roles }`. La app NO decide el
  rol — lo trae el perfil.
- **Ruteo por rol** (`homeFor()`): 1 rol almacenista→`bodega`, transportista→`chofer`,
  multi→`picker`; `operario_cn`→`window.location='Operario CN.html'`.
- **Sesión persistente** (`localStorage 'dtd_op_session_v1'`): con "Recordar este
  dispositivo" (ON), al reabrir arranca en **PinUnlock** (PIN 1234; 5 fallos →
  re-login con contraseña). Cerrar sesión limpia la sesión.
- **Homes reusados** del patrón de Operario Multi, parametrizados con el `profile`
  (nombre, iniciales, sitio, vehículo); el menú muestra "Cambiar de modo" solo si
  `roles.length > 1`. Conectados a `window.BodegueroFlows` (rcp/despacho) y
  `window.OperarioVEFlows.DeliveryFlow` (entrega) — sin re-login.
- **On-brand:** login con logo `-reverse` (sin invert), `window.Icon`, Sora/Nunito Sans,
  inputs reales (usuario+contraseña). Átomos prefijados `UA*` para no colisionar con
  el scope global de `bodeguero.jsx`. (Los homes heredan los emojis del patrón Multi —
  pendiente de limpieza a `window.Icon`, ya anotado.)
- **Verificado en vivo:** 3 caminos de ruteo, menú condicional por rol, logout,
  persistencia de sesión + desbloqueo por PIN. Sin errores de consola.

---

## 2026-06-01 · 📱 Login y Sesión · Operario + Handoff Móvil

**`Login y Sesión · Operario.html`** (nuevo) · canvas (design_canvas) con los 6 estados
de la lógica de sesión de la app de teléfono: (1) primer ingreso con "Recordar este
dispositivo", (2) dispositivo vinculado + crear PIN + biometría, (3) desbloqueo diario
por PIN, (4) desbloqueo biométrico, (5) sesión expirada → re-login, (6) reset desde el
ERP (PIN temporal 24 h). On-brand: logo `-reverse` sobre navy (sin `filter: invert`),
`window.Icon`, Sora/Nunito Sans, único gradiente permitido navy→ink. Huella = glifo
iconográfico propio. `DCPostIt` no se usó (no acepta `tone` y es absolute) → se reemplazó
por `NoteCard` (artboards) para las 2 notas de cierre.

**`HANDOFF-MOBILE.md`** (nuevo) · instructivo para Claude Code del **paquete completo del
teléfono**: principio de un APK multi-tenant, detección de rol → ruteo (operario /
almacenista / transportista / multi-rol), modelo de tokens (access + refresh, "grabá la
sesión nunca la contraseña"), PIN/biometría, recuperación por admin, control desde
`operarios-pwa.jsx`, tabla de apps/flujos existentes + seam de reuso (`BodegueroFlows` /
`OperarioVEFlows`, regla IIFE), offline-first, endpoints conceptuales contra `window.DTDApi`,
y orden sugerido de implementación. Enlazado desde `HANDOFF.md` (orden de lectura +
tabla de entrypoints).

---

## 2026-06-01 · 🔗 Operario Multi · shell multi-rol conectado a los flujos reales

Sesión enfocada en **`Operario Multi.html`** (launcher multi-rol, un solo APK). El
mismo operario es a veces **almacenista** (modo Bodega) y a veces **transportista**
(modo Chofer). Se rehízo la lógica de cada modo y se **conectaron los botones a las
pantallas ya existentes** (sin rediseñar ni duplicar).

**Terminología (decisión del usuario):** `bodeguero → almacenista`, `chofer →
transportista` en la auto-identificación del picker y en la línea de rol del header.
Los **nombres de modo** siguen siendo "Bodega"/"Chofer". (Pendiente: el directorio
`erp/modules/operarios-pwa.jsx` aún rotula `op-005` como "Bodeguera" — no se tocó.)

**Reestructura de cada modo (antes mostraban una card "MODO ACTIVO" + botón de cambio):**
- **Modo Almacén** → ahora muestra sus 2 acciones reales: **Recibir contenedor** y
  **Despachar camión** (+ KPIs y agenda).
- **Modo Chofer** → ahora muestra **Rutas asignadas** (órdenes de servicio, "asignadas
  por almacén") + "Iniciar próxima ruta".
- El **cambio de modo** se movió al menú ☰ (cambio directo al otro modo + cerrar sesión).

**Conexión a flujos reales (hallazgo clave: los scripts Babel comparten scope global,
así que dos `.jsx` sin IIFE pisan sus helpers homónimos — `Steps`, `Login`, `MobileHeader`…):**
- `operario/bodeguero.jsx` · final (~líneas 759-782) · agregados wrappers
  `ReceptionFlow` / `DispatchFlow` (manejan el sub-state machine sin el login/home
  propios) y `window.BodegueroFlows = { ReceptionFlow, DispatchFlow }`. `BodegueroApp`
  intacto.
- `operario/ve.jsx` · **envuelto en IIFE** (línea 4 `(function () {` · final `})()`)
  para no contaminar el scope global y chocar con `bodeguero.jsx`. Agregado
  `DeliveryFlow` (s0→s5→done con un `route`) + `window.OperarioVEFlows = { DeliveryFlow }`.
  `window.OperarioVEApp` sigue expuesto (verificado: `Operario VE.html` carga igual).
- `Operario Multi.html`:
  - líneas ~29-31 · cargados `erp/icons.jsx`, `operario/bodeguero.jsx`, `operario/ve.jsx`.
  - `KPI` local renombrado a `ModeKPI` (1 def + 6 usos) para no colisionar con el `KPI`
    global de `bodeguero.jsx`.
  - nuevos `view`: `rcp` / `despacho` → `BodegueroFlows.*` con `onExit → 'bodega'`;
    `entrega` → `OperarioVEFlows.DeliveryFlow` con `onExit → 'chofer'`. `RouteCard`
    ahora acepta `onClick`; agregado keyframe `erp-shimmer` (lo usa el escáner de recepción).

**Mapa final de conexiones:**
| Modo | Acción | Pantalla real |
|---|---|---|
| Almacén | Recibir contenedor | `ReceptionList → ReceptionScan` (bodeguero.jsx) |
| Almacén | Despachar camión | `PickTruck → PickDriver → PickItems → Handoff` (bodeguero.jsx) |
| Chofer | Ruta asignada / Iniciar ruta | `Step0Load → … → Step5POD → Done` (ve.jsx) |

**Verificado:** `Operario Multi`, `Operario VE`, `Bodeguero VE`, `DTD Studio · ERP`
cargan sin errores; navegación de los 3 flujos + back a home confirmada en vivo.
Limpieza: borradas 7 capturas de debug propias en `scraps/`.

**Pendientes menores (no bloqueantes):** (1) solape de texto en el nombre del 1er
cliente en `ve.jsx · Step0Load` (preexistente del diseño); (2) rótulo "Bodeguera" en
`operarios-pwa.jsx` si se quiere unificar a "Almacenista".

---

## 2026-06-01 · v2.4 · ✨ Pulido fino · 8 bloques de seed data `TODO: al consolidar` → `erp/data.jsx`

Cierre de los marcadores `// TODO: al consolidar, mover a erp/data.jsx` dispersos —
deuda menor, mecánica, mismo hilo que `USER_PROFILES`/`THREADS`. Cada bloque de seed
data inline pasó a `erp/data.jsx` y se expone en `window.ERPData`; en el origen quedó
`const X = window.ERPData.KEY` (así las referencias internas de cada archivo no cambian).

| Bloque (antes) | Archivo origen | Ahora en ERPData |
|---|---|---|
| `SEED_ORDERS` | `erp/modules/qr-queue.jsx` | `PRINT_ORDERS` (10) |
| `EXTRA_KPI_VALUES` | `erp/modules/dashboard.jsx` | `KPIS_EXTRA` (8) |
| `AUDIT_ENTRIES` | `erp/modules/audit-log.jsx` | `AUDIT_LOG` (12) |
| `SEED_STATEMENT` | `erp/modules/conciliacion.jsx` | `BANK_STATEMENTS` |
| `ACCOUNT_PROFILES` | `pantallas/estado-cuenta.jsx` | `CLIENT_ACCOUNTS` (6) |
| `TRUCK_PROFILES` | `pantallas/camion-perfil.jsx` | `TRUCK_PROFILES` (7) |
| `DRIVER_PROFILES` | `pantallas/chofer-perfil.jsx` | `DRIVER_PROFILES` (7) |
| `AGENTS_BASE` | `pantallas/agente-perfil.jsx` | `CUSTOMS_AGENTS` (4) |

- Extracción con scanner de llaves balanceadas (respeta strings) + guarda anti-colisión de nombres en `data.jsx`.
- Comentario stale de `USER_PROFILES` (ya estaba movido) limpiado.
- **Único `TODO consolidar` que queda** (a propósito, es otro tema): `erp/rates.jsx` — persistencia de tasas editadas en Admin, no un bloque de data.
- **Verificado:** ERP carga limpio; `qrqueue`, `dashboard`, `audit-log`, `reconcile` renderizan con los datos movidos; las 4 pantallas standalone (`camion-perfil`, `chofer-perfil`, `agente-perfil`, `estado-cuenta`) cargan sin errores leyendo de `ERPData`. Cero marcadores `TODO: al consolidar` en código vivo.

---

## 2026-06-01 · v2.4 · 🧹 Higiene de repo · docs consolidados + bitácora a la raíz + muertos eliminados

Segunda mitad de la sesión de consolidación, enfocada en **fragmentación de repo** (la
preocupación #1 del usuario). Auditoría completa → 3 buckets.

**Bucket A · muerto comprobado (borrado, cero referencias vivas):**
- `estado-cuenta.jsx` (raíz) — copia huérfana de 829 líneas; el vivo es `pantallas/estado-cuenta.jsx` (ningún HTML cargaba el de raíz).
- `handoff/` (carpeta entera) — bundle de handoff viejo con un brandbook duplicado (svg/json/png ya presentes en `assets/` + Brand Book). Sin refs vivas; la única mención apuntaba a una subcarpeta `SDD-2026-05-25-sesion/` ya inexistente.
- `design_handoff_dtd_cargo/` (carpeta entera) — `CHANGELOG.md` auto-declarado obsoleto + `README.md` (arquitectura/mapa de módulos, plegado a `HANDOFF.md`).

**Bucket B · docs consolidados (de 8 dispersos → 2 canónicos + bitácora):**
- **`HANDOFF.md`** (raíz, reescrito) — documento único de orientación. Absorbe `HANDOFF` v1.x (desactualizado), `PROMPT-proxima-sesion.md`, `nuevo/PROMPT-CLAUDE-CODE.md` y `design_handoff_dtd_cargo/README.md`. Estado v2.4 + arquitectura + mapa de módulos (rutas corregidas a su lugar canónico) + tokens + reglas.
- **`backend/README.md`** (nuevo) — consolida `BACKEND-BRIEF.md` + `PROMPT-BACKEND.md`. Rutas stale corregidas: `nuevo/api/client.jsx` → `erp/api/client.jsx`. Apunta a `../HANDOFF.md` y `../CHANGELOG.md`.
- **Bitácora a la raíz:** `nuevo/CHANGELOG.md` → **`CHANGELOG.md`** (raíz). Con esto **desaparece la carpeta `nuevo/`** por completo (su nombre — "lo nuevo" vs "lo viejo" — era en sí el artefacto de fragmentación; la convención se retiró en la primera mitad de v2.4). Se borró también `nuevo/README.md` (convención retirada).
- **Refs corregidas en archivos conservados:** `backend/API-CONTRACT.md` (`nuevo/api/client.jsx` → `erp/api/client.jsx`) y `backend/prisma/schema.prisma` (`BACKEND-BRIEF.md` → `backend/README.md`).

**Bucket C · mockup superado (archivado):**
- `Propuesta · Botón Crear.html` → `_archivo/`. Era la propuesta del botón "+ Crear", ya construido y consolidado en el ERP. Se archiva (no se borra) por ser registro de decisión de diseño. `Propuesta · Servicios y Tarifas.html` **NO** se tocó (su jsx sigue vivo, lo consume el ERP embebido).

**Resultado:** la raíz pasa de 6 `.md` sueltos + 3 carpetas de docs/handoff a **4 docs canónicos** (`CLAUDE.md`, `HANDOFF.md`, `CHANGELOG.md`, `BRAND-MIGRATION-2026-05.md`) + `backend/` (`README.md` + `API-CONTRACT.md` + `prisma/`). Cero carpetas `nuevo/` · `handoff/` · `design_handoff_dtd_cargo/`. Verificado: ERP y apps cargan sin 404.

---

## 2026-06-01 · v2.4 · 🪟 5 pantallas → overlay interno del ERP + datos movidos a `erp/data.jsx` (cierra deuda rec 3)

Se cerró la última pieza grande de la deuda rec 3: las pantallas full-page que abrían con `window.open(..., '_blank')` (pestaña nueva) ahora montan como **overlay interno** del ERP. Sin pestañas, sin recarga.

**Datos movidos a fuente única (`erp/data.jsx` · `window.ERPData`):**
- `USER_PROFILES`, `CORP_LINES`, `PRESENCE` (venían de `pantallas/usuario-perfil-data.jsx`).
- `THREADS` (venía de `pantallas/hilo-comentario.jsx`).
- `usuario-perfil-data.jsx` quedó como thin re-export (`window.UsuarioPerfil_DATA` ← `ERPData`) para no tocar `usuario-perfil.jsx`. `hilo-comentario.jsx` ahora hace `const THREADS = window.ERPData.THREADS`.

**Overlay host (`erp/shell.jsx` · `OverlayHost`, expuesto en `window.ERPShell`):**
- API: `window.__erpOverlay(kind, params)` / `window.__erpCloseOverlay()`. `kind` ∈ `tudia` · `perfil` · `hilo` · `copilot`.
- Full-viewport (z-index 200), scrollable, con botón ✕ flotante + cierre por **Esc**.
- **Intercepta** los links de las pantallas hacia `…DTD Studio · ERP.html#mod`: en vez de recargar, navega el ERP con `__erpGoTo(mod)` y cierra el overlay (un solo handler, sin tocar cada `<a>`).
- Montado en el App (`DTD Studio · ERP.html`) junto a Tweaks/QuickEmail.

**Llamadas reemplazadas (`window.open` → `__erpOverlay`):** `erp/shell.jsx` (Tu día ×2, Copilot, "Ver mi perfil completo", **Modo cliente**), `erp/modules/comments.jsx` (hilo), `erp/modules/users.jsx` (perfil al click de fila), **`erp/modules/clients.jsx` (estado de cuenta)**.

> **Addendum (mismo día):** se sumaron las 2 pantallas que habían quedado fuera, completando las **6**: **`estadocuenta`** (estado de cuenta del cliente · `window.EstadoCuenta`, abre desde el drawer de Clientes) y **`modocliente`** (vista previa del portal). `Modo Cliente.html` se refactorizó: el componente inline `ModoCliente` se extrajo a `pantallas/modo-cliente.jsx` con **estilos inline** (self-contained · ya no depende del `<style>` del HTML), acepta `markbox` + `embedded`, y en modo embebido el botón "Salir del modo" llama a `__erpCloseOverlay` (en standalone sigue siendo link al ERP). El overlay de `modocliente` monta el `<iframe>` al `Portal del Cliente.html?as=Shipping Mark` (verificado: el portal carga dentro del iframe). Ambas IIFE-wrapped. Ya **no queda ningún `window.open` de pantallas** — las 6 viven dentro del ERP.

**Pantallas adaptadas (props + aislamiento):**
- `TuDia`/`UsuarioPerfil` aceptan `userId`; `HiloComentario` acepta `threadKey` + `embedded` (guarda `history.replaceState` en modo embebido). Fallback a URL param cuando no hay prop → el standalone sigue igual.
- **Aislamiento de scope (bug clave):** Babel in-browser transpila a sloppy-mode y las funciones top-level (`TopBar`, etc.) se pisaban entre archivos al cargar las 4 juntas en el ERP → cada componente renderizaba el `TopBar` de otro (la pantalla mostraba el header de Copilot). Solucionado envolviendo cada pantalla en un **IIFE** (`/* @iife */`); solo escapa el `window.X = X`. Los mounts standalone se actualizaron a `<window.X />`.
- Se cargan en el ERP: `pantallas/{usuario-perfil-data,usuario-perfil,tu-dia,hilo-comentario,copilot}.jsx`.

**Bug de paso corregido:** tras el merge v2.4, los back-links de TODAS las pantallas (`../../DTD Studio · ERP.html`) quedaron rotos (sobraba un nivel) → corregidos a `../` en los 8 `.jsx` de `pantallas/`.

**Verificación:** los 4 overlays montan su propio componente (sin colisión), abren/cierran con ✕ y Esc, e interceptan los links internos (probado: link `#shipments` → navega + cierra). Standalone de perfil e hilo siguen renderizando con los datos desde `ERPData`. Consola limpia.

---

## 2026-06-01 · v2.4 · ➕ "+ Crear" adaptado al rol + Frecuentes + wiring de catálogo · (sigue consolidación)

Segunda parte de la sesión de consolidación. Se atacó la deuda de producto del botón **"+ Crear"** y se eliminó código muerto.

**Hallazgo:** convivían DOS componentes de "Crear": `CreateButton` (sidebar · **el vivo**, con un `GROUPS` simple y sin filtro por rol) y `CreateMenu` (mega-menú rico con filtro/eventos · **nunca montado · código muerto**). Además `CreateButton` tenía un bug: el ítem *Lead* navegaba a `'crm'` (módulo inexistente; el id real es `'leads'`).

**Qué se hizo (todo sobre el `CreateButton` vivo):**
- **Filtrado por rol** reusando `ERPData.ROLE_MODULES` (misma fuente que el sidebar). Cada ítem se muestra solo si el rol puede ver su módulo; los grupos que quedan vacíos se ocultan. Verificado: Admin = 5 grupos; Comercial sin "Usuario"; Almacén CN solo "Operación CN→VE" + tarea; Contabilidad con Finanzas completo y Comercial reducido.
- **Sección "Frecuentes"** (máx 4 chips) que aprende los ítems más usados, persistida por usuario en `localStorage` (`dtd-create-freq-<userId>`), filtrada también por rol.
- **Wiring de catálogo completado:** el botón ahora navega a `rates` y dispara `dtd-create-catalog`; el listener ya existía en `propuesta/servicios-tarifas.jsx` (abre el `NewItemDrawer` del tipo). Antes ese evento solo lo emitía el componente muerto → loop roto, ahora cerrado.
- **Bug fix:** `Lead → 'leads'` (antes `'crm'`).
- **Limpieza:** se borró la función `CreateMenu` muerta (140 líneas). Se conservaron `CREATE_GROUPS` y `CATALOG_KINDS` (ahora los consume el botón vivo).

**Archivos:** `erp/shell.jsx` (CreateButton reescrito + CreateMenu eliminado + Sidebar pasa `currentUser`).

**Pendiente de la deuda rec 3 (no abordado en esta sesión · siguiente paso):** consolidar las 5 pantallas que aún abren con `window.open` (`pantallas/{tu-dia,copilot,usuario-perfil,hilo-comentario}.html` + `Modo Cliente.html`) como drawers/rutas internas del ERP, y mover `USER_PROFILES`/`THREADS` a `erp/data.jsx`. Es un refactor mayor y se dejó fuera del alcance de la sesión de limpieza.

---

## 2026-06-01 · v2.4 · 🧹 Sesión de consolidación · entrypoint único + assets/tokens únicos + merge `nuevo/` → estructura canónica

Sesión de housekeeping (sin features nuevas). Objetivo: eliminar duplicación y dejar **una sola fuente de verdad** por cosa, para que Design y Claude Code no editen copias divergentes.

**1 · Entrypoint único del ERP.** Se borró `DTD CARGO Nort v2.4.html` (era copia byte-idéntica de `DTD Studio · ERP.html` salvo el `<title>`). El nombre canónico es **`DTD Studio · ERP.html`**.

**2 · Assets / tokens / CLAUDE / Brand Book únicos.** Se borraron carpetas/archivos duplicados que NO referenciaba ninguna app viva y que además estaban **desactualizados** (revertían la migración tipográfica a Nunito Sans + Sora):
- `Brand Book v3.0 Package/` (carpeta completa · 18 archivos) — snapshot v3.0 viejo con su propio `CLAUDE.md` + `tokens.css` pre-migración.
- `Brand Assets DTD/` (5 archivos) — duplicado puro de los 4 PNG de `assets/`.
- `design_handoff_dtd_cargo/CLAUDE.md` + `design_handoff_dtd_cargo/tokens.css` — copias viejas (drift). Se conservó su `README.md` (lo referencia `PROMPT-BACKEND.md`) y se le actualizaron refs v3.0→v3.1 + nota de fuentes.
- **Únicas fuentes de verdad ahora:** assets → `assets/` · tokens → `erp/tokens.css` · marca → `CLAUDE.md` (raíz) · Brand Book → `Brand Book DTD v3.2.html`.

**3 · Merge `nuevo/` → estructura canónica.** Se retiró el split `erp/` vs `nuevo/`. Todo lo que vivía en `nuevo/` se movió a su lugar definitivo y se reescribieron TODAS las referencias (`<script src>` + `window.open(...)`):
- `nuevo/{search-select,catalog-lines,feature-flags,rates}.jsx` → `erp/`
- `nuevo/api/client.jsx` → `erp/api/client.jsx`
- `nuevo/modules/*.jsx` (26) → `erp/modules/*` — `dashboard.jsx` y `audit-log.jsx` **reemplazaron** a los originales (eran los overrides que ganaban en runtime; ya no se cargan dos veces).
- `nuevo/flujo-*.jsx` (4) → `erp/`
- `nuevo/operario/avisos.jsx` → `operario/avisos.jsx`
- `nuevo/propuesta/servicios-tarifas.jsx` → `propuesta/servicios-tarifas.jsx` (lo consumen tanto `Propuesta · Servicios y Tarifas.html` como el ERP en modo embebido)
- `nuevo/mobile/app.jsx` → `mobile/app.jsx`
- `nuevo/pantallas/*` (jsx+html, 17) → `pantallas/*` — y se ajustó su ref interna `../../erp/` → `../erp/` y `../rates.jsx` → `../erp/rates.jsx`.

**HTML/JSX reescritos:** `DTD Studio · ERP.html`, `Mapa de Proceso.html`, `Guía del Mapa de Proceso.html`, `Mobile ERP.html`, `Portal del Cliente.html`, `Portal Cliente Mobile.html`, `Bodeguero VE.html`, `Camionero.html`, `Operario VE.html`, `Operario CN.html`, `Propuesta · Servicios y Tarifas.html`; y `window.open('pantallas/…')` en `erp/shell.jsx`, `erp/modules/{tms,seniat,clients,comments,users}.jsx`.

**Verificación:** ERP carga sin 404 ni errores de consola (solo el warning estándar de Babel in-browser). Cero referencias `nuevo/` en código/HTML vivos — solo quedan menciones históricas en los docs (`nuevo/CHANGELOG.md`, `HANDOFF.md`, `nuevo/PROMPT-CLAUDE-CODE.md`).

**Nota:** `nuevo/` queda solo como carpeta de **docs** (`CHANGELOG.md` = bitácora única, `README.md`, `PROMPT-CLAUDE-CODE.md`). La convención "todo archivo nuevo va a `nuevo/` primero" queda **retirada**: de aquí en más, archivos nuevos van directo a su lugar canónico (`erp/modules/`, `erp/`, `pantallas/`, etc.).

---

## 2026-05-31 · v2.3 · 🔖 Release consolidado (2 sesiones en paralelo) + única bitácora

> **`graba todo como v2.3`.** Esta fecha tuvo **dos sesiones en paralelo** que se unifican bajo **v2.3**:
> (a) **Portal → ERP en vivo** (cotizador/re-compra publican al bridge + badge de avisos en el ERP — ver entrada v2.3 abajo)
> y (b) **Sidebar · reorganización IA + acordeón** (ver entrada v2.3 · Sidebar abajo). Ambas quedan estampadas como v2.3.
>
> **Enlace roto analizado (antes de grabar):** auditoría automática de los 39 HTML → **cero `src`/`href` rotos** en las apps vivas.
> El "enlace roto" real era de **continuidad de la bitácora**: `design_handoff_dtd_cargo/CHANGELOG.md` era un *fork* congelado en la entrada
> "Cobranzas" (le faltaba todo el arco v2.0→v2.3, ~27 entradas), aunque su propio `README.md` ya declara a **`nuevo/CHANGELOG.md`**
> como única fuente de verdad. **Resuelto:** este archivo (`nuevo/CHANGELOG.md`) es la **única bitácora**; la copia del handoff se reemplazó
> por un puntero a este archivo. (Verificado: el handoff era subconjunto estricto — no se perdió ninguna entrada.)

---

## 2026-05-31 · v2.3 · Sidebar · reorganización IA + acordeón + de-duplicación de íconos

Feedback del usuario: sidebar confuso ("Contabilidad dentro de Contabilidad"), demasiados ítems y
contaminación visual, íconos parecidos.

**Archivos modificados:** `erp/shell.jsx` (MODULES, PARENTS, Sidebar), `erp/icons.jsx` (+16 íconos).

**Cambios:**
- **Acordeón:** un solo grupo abierto a la vez (estado `openGroup` + persistencia + auto-open del
  grupo del módulo activo). Bajó de ~38 filas visibles a ~8-12.
- **Grupo "DIRECCIÓN" eliminado** (era de 1 ítem): "Tablero ejecutivo" se movió a INICIO.
- **Redundancia "Contable → Contabilidad" resuelta APLANANDO** el sub-grupo `contable` (eliminado de
  PARENTS). Ahora Contabilidad, Tesorería, Conciliación y Costing cuelgan directo de FINANZAS.
  - ⚠ Corrección de criterio: NO se renombró el módulo a "Plan de cuentas" — ese ya existe como
    **pestaña** dentro de la suite Contabilidad (`nuevo/modules/contabilidad.jsx`: Flujo · Dashboard ·
    Libro diario · Plan de cuentas · Libro mayor · Reportes · Fiscal · Config). La hoja del sidebar
    se llama **"Contabilidad"** para coincidir con el título de su página.
- **Íconos de-duplicados + 1 roto arreglado.** Antes: invoice×3, tag×3, check×2, truck×2, cog×2,
  chart×2, users×2, cn×2, y `audit-log` usaba `eye` que **no existía** (renderizaba vacío).
  Nuevos íconos en `icons.jsx`: map, gauge, calendar, qr, route, sliders, barchart, cash, ledger,
  wallet, reconcile, margin, **eye**, idcard, hardhat. Reasignados: Mapa de proceso→map, Tablero→gauge,
  Calendario→calendar, Cola QR→qr, TMS→route, Reglas→sliders, Métricas→barchart, Cobranzas→cash,
  Contabilidad→ledger, Tesorería→wallet, Conciliación→reconcile, Costing→margin, Audit log→eye,
  Usuarios→idcard, Operarios→hardhat.

---

## 2026-05-31 · v2.3 · Portal → ERP en vivo: cotizador + re-compra publican al bridge, badge de avisos en el ERP

**Qué se hizo:** se cerró el lazo Portal→ERP para tres flujos del cliente y se le dio al admin
un aviso accionable cuando entra actividad nueva desde el portal.

**1 · Cotizador y "Pedir re-compra" del móvil ahora publican al bridge** (antes solo el registro lo hacía):
- `erp/data-bridge.jsx` · nuevo store `portalInbox` (`dtd-portal-inbox`) + helpers `pushPortalEvent(evt)`,
  `markPortalRead(ids?)` y `tenantForMarkbox(markbox)`. Cada evento se auto-tagea con `id/ts/read/tenantId`
  (el `tenantId` se deriva del prefijo del Shipping Mark vía `ERPData.TENANTS`). Expuestos en `window.DTDData`
  + agregado a `resetAll`.
- `portal/mobile-extra.jsx` · `CotizadorScreen` "Solicitar cotización formal" → `pushPortalEvent({kind:'cotizacion'…})`
  con ruta/servicio/estimado. `ProveedoresScreen` "Pedir re-compra" (antes sin onClick) → `pushPortalEvent({kind:'recompra'…})`
  + estado por fila (`rebought`) que confirma con "Pedido enviado".

**2 · El ERP avisa cuando entra un registro/cotización/re-compra nueva desde el portal:**
- `DTD Studio · ERP.html` · App se suscribe a `DTDData.portalInbox`, mezcla los eventos (filtrados con
  `ERPData.byTenant`) al feed de `notifications` del Topbar; handlers `onPortalAction` (marca leído + navega
  a clients/quotes/suppliers) y `onPortalClear` (marca todo leído).
- `erp/shell.jsx` · `Topbar` ahora muestra un **badge numérico** (en vez de punto) con el conteo de eventos
  del portal; los ítems del portal salen con fondo `wine-tint`, eyebrow "PORTAL DEL CLIENTE" y botón de acción
  ("Aprobar registro" / "Ver cotización" / "Ver compras"). "Marcar leídas" wireado a `onPortalClear`.
- `portal/registro.jsx` + `portal/mobile.jsx` · al publicar el cliente nuevo también emiten un evento
  `kind:'registro'` al inbox (web y móvil).

**3 · Multi-tenant (#14) — el portal móvil respeta el tenant:** confirmado. El portal móvil es vista
single-client (`PM_MARKBOX = DTD-5452`, impersonación `?as=` solo acepta `DTD-####`), así que sus datos ya
están aislados por cliente. Los eventos que emite quedan etiquetados con el `tenantId` derivado del prefijo
del Shipping Mark, y el ERP los filtra con `byTenant` antes de mostrarlos → no hay fuga cross-empresa.

**4 · PWA "Instalar app" — install-ready, falta el hosting HTTPS (no codeable acá):** verificado que están
todos los artefactos (`manifest.webmanifest` válido, `sw.js`, `assets/pwa-icon-192/512.png`, handler
`beforeinstallprompt` + registro del SW en `Portal Cliente Mobile.html`). El prompt de instalación y el
service worker **requieren contexto seguro (HTTPS)**; en `file://`/preview no disparan. Para que "Instalar app"
funcione de verdad hay que **publicar en un hosting HTTPS** (paso de deploy, fuera de este entorno).

**Archivos viejos modificados:**
- `erp/data-bridge.jsx` · store `portalInbox` + `pushPortalEvent`/`markPortalRead`/`tenantForMarkbox` + export + resetAll
- `portal/mobile-extra.jsx` · CotizadorScreen submit publica; ProveedoresScreen re-compra wireada + estado por fila
- `portal/registro.jsx` · ~línea 96 · emite evento `registro` al inbox
- `portal/mobile.jsx` · ~línea 150 · emite evento `registro` al inbox tras aprobación
- `DTD Studio · ERP.html` · suscripción a portalInbox + merge byTenant + props onPortalAction/onPortalClear
- `erp/shell.jsx` · Topbar: badge numérico + render de ítems del portal con acción + "Marcar leídas"

**Notas:** todo dentro del sistema (tokens, `wine`/`wine-tint`, variantes `Btn` `primary`/`soft`/`secondary`,
fuentes del sistema). Cero hex inventados, cero AI slop.

---

## 2026-05-31 · v2.2 · Fix registro móvil atado al backend canónico + consolidación de changelogs

**La falla (encontrada y corregida):** el registro del **Portal Cliente Mobile** generaba el Shipping Mark
con un fallback random local y **NO publicaba el cliente al bridge compartido** — los registros
hechos en el celular nunca llegaban al ERP. Causa raíz: `Portal Cliente Mobile.html` no cargaba
`erp/data-bridge.jsx`, así que `window.DTDData` no existía en esa página.

**Arquitectura correcta (1 backend, 2 UIs):** hay UN solo backend de registro (`window.DTDData`
en `erp/data-bridge.jsx`): `nextMarkbox()` secuencial+validado, store `clients` compartido (lo ve
el ERP) y `sendWelcomeEmail()` (template m-05). Existen DOS interfaces que deben alimentarlo:
- **Web:** `portal/registro.jsx` (3 pasos) — ya lo usaba bien.
- **Móvil:** `portal/mobile.jsx` (registro 2 pasos + verificación) — **ahora también**.

**Cambios:**
- `Portal Cliente Mobile.html` · carga `erp/data-bridge.jsx` (después de data.jsx, antes de components.jsx).
- `portal/mobile.jsx` · al aprobarse la verificación: usa `DTDData.nextMarkbox()`, publica el cliente
  al store `clients` (mismo shape que registro.jsx, con `origin: 'portal-mobile'`) y dispara
  `sendWelcomeEmail()`. Verificado en vivo: DTDData carga, nextMarkbox→DTD-5518, store 18 seed, email OK.
- Footer de la app → **v2.2**.

**Consolidación:** los changelogs sueltos de la raíz (`CHANGELOG-sesion.md` y
`CHANGELOG-calendario-ferias.md`) se **fusionaron al final de este archivo** y se eliminaron los
originales. Este `nuevo/CHANGELOG.md` queda como **única fuente de verdad**.

---

## 2026-05-31 · Cobro → Caja (Cobranzas + Tesorería) · sección B de la propuesta integrada al ERP

Cierra la propuesta `Órdenes, Caja y Proveedores`. El cobro de una factura ahora **aterriza en una
caja real** de Tesorería y baja el saldo de la factura. Soporta multimoneda + abono parcial.

**Archivos viejos modificados:**
- `nuevo/modules/tesoreria-data.jsx` · nueva **capa de depósitos** persistente (`CASH_LS_KEY`):
  `cashDeposits()`, `cashDeposit(entry)`, `accountDepositsUsd/Orig`, `accBalance(acc)` y
  `accBalanceUsd(acc)` (= saldo base + depósitos). `cashByCurrency()` y `totalCashUsd()` ahora usan
  los saldos efectivos. Evento `dtd-tesoreria-changed`. Exportados en `window.TesoreriaData`.
- `nuevo/modules/tesoreria.jsx` · `ModuleTesoreria` escucha `dtd-tesoreria-changed` (re-render);
  `AccountsTab` usa `accBalanceUsd`/`accBalance` para mostrar el saldo con los ingresos sumados.
- `nuevo/modules/cobranzas-data.jsx` · **`cobRegisterPayment(invId, payload)`**: acumula
  `collectedUsd` en el overlay, baja el saldo (parcial/pagado), loguea la gestión y dispara
  `TesoreriaData.cashDeposit`. `cobItems()` ahora descuenta `collectedUsd` del saldo y marca
  parcial/pagado. Exportado.
- `nuevo/modules/cobranzas.jsx` · `CobranzaDrawer` · botón **"Registrar cobro"** (acciones + gestión)
  abre el nuevo **`CobroModal`**: cuenta de caja (USD/VES/USDT, sin CNY), método, **tasa del día**
  auto-editable si la caja no es USD, monto en moneda de caja + equivalente en US$, **comprobante
  obligatorio**, abono parcial; al confirmar muestra el ingreso y actualiza factura + caja.

**Verificado (eval):** cobrar F-2026-0405 ($29.300) → saldo a $0, depósito creado en Mercantil USD
con comprobante+concepto, Mercantil sube 184.260→213.560, total caja sube. "Confirmar" deshabilitado
sin comprobante. Pantalla de éxito OK. Sin errores (solo warning Babel).

**Propuesta `Órdenes, Caja y Proveedores`: A + B + C integradas.** Pendiente backend: el saldo no se
refleja aún en el módulo Facturación (lee `ERPData.INVOICES` directo), y los depósitos viven en
localStorage hasta tener servidor.

---

## 2026-05-31 · Órdenes esperadas (Almacén CN) · sección A de la propuesta integrada al ERP

Bajada al módulo vivo la **sección A** de `Propuesta · Órdenes, Caja y Proveedores`. El núcleo del
flujo: lo que el cliente compra en China entra como **orden esperada** y el almacén solo verifica.

**Archivos viejos modificados:**
- `erp/data.jsx` · nuevo dataset **`ORDERS`** (5 órdenes reales, atadas a cliente + `supplierId`):
  code `Shipping Mark-proveedor-compra` (= grupo WeChat + nº de compra), boxes/cbm/weight declarados,
  flags `packing`/`invoice`, status (`por verificar`/`en camino`/`verificada`), eta, goods.
  Tagged `tenantId` vía `_byClient`. Exportado en `window.ERPData`.
- `erp/modules/cn.jsx`:
  - `ModuleCN` · nuevo **tab `cnTab`** (Recibidas / Esperadas · en camino) tras el PageHeader; toda
    la vista de recepciones quedó envuelta en `{cnTab === 'recibidas' && …}`. Estado nuevo:
    `verifyOrder`, `verifiedCodes` (Set), `orders = byTenant(ORDERS)`, `enCaminoCount`.
  - **NUEVO `OrdersExpected`** · KPIs (en camino / por verificar / CBM esperado / verificadas) +
    banner explicativo del flujo + filtro por estado + `U.Table` (código·goods, cliente→detalle,
    proveedor, declarado, chips de docs, ETA, estado, acción Verificar). Derivado real de SUPPLIERS/
    CLIENTS.
  - **NUEVO `OrderVerifyDrawer`** · rectificar sumatorias (Declarado vs Rectificado, marca diferencias)
    + docs atados al grupo; "Confirmar y pasar a recepción" agrega el code a `verifiedCodes` (pasa a
    estado verificada / "en recepción ✓") con pantalla de éxito.

**Verificado:** tab "Esperadas · en camino 4" lista las 5 órdenes (DTD-5452-1-1 … DTD-5277-1-1),
4 botones Verificar, drawer abre con sumatorias rectificables y docs. Sin errores (solo warning Babel).

**Pendiente de la propuesta:** B · Cobro → Caja (cobranzas/tesorería). Backend: link real
SHIPMENTS↔orden + persistencia de la verificación.

---

## 2026-05-31 · Proveedores de clientes CN · sección C de la propuesta integrada al ERP

Bajada al módulo vivo la **sección C** de `Propuesta · Órdenes, Caja y Proveedores` (era mockup
sin integrar). Es la parte autocontenida (no depende de modelar `ORDERS`).

**Archivos viejos modificados:**
- `erp/data.jsx` · `SUPPLIER_CLIENTS` · agregado campo **`wechatGroup`** a cada relación
  cliente↔proveedor (el grupo WeChat es POR par: cada cliente abre su propio grupo con cada
  supplier). Código `Shipping Mark-N` (N = orden del proveedor en la lista del cliente): `DTD-5452-1`,
  `DTD-5452-2`, etc. Datos reales, deterministas.
- `erp/modules/suppliers.jsx`:
  - `ModuleSuppliers` · **renombrado** el header a "Proveedores de clientes · CN · 客户供应商" +
    subtítulo reformulado + **banner aclaratorio** (wine-tint): estos proveedores son de los
    *clientes*; la deuda de la empresa vive en **Tesorería · CxP**.
  - `SupplierDetail` · la lista de clientes pasó a "{n} CLIENTES DTD · GRUPOS WECHAT"; cada fila
    muestra el **chip del código de grupo WeChat** (`wechatGroup`) junto al Shipping Mark. Grid recompuesto
    (se sacó la columna "desde" para dar lugar al chip).
  - `SupplierForm` · nueva sección **"GRUPO WECHAT · CLIENTE"**: Select de cliente (byTenant) +
    **preview del código auto-generado** (`Shipping Mark-N`, calculado de `SUPPLIER_CLIENTS`). Form ahora
    stateful (`client` + `useMemo`).

**Verificado:** módulo abre, header/banner correctos, drawer de Yiwu Standard muestra 3 clientes con
sus chips `DTD-5452-1 / DTD-5340-1 / DTD-5298-1`. Solo warning normal de Babel.

**Pendiente de la propuesta (no integrado aún):** A · Órdenes esperadas (Almacén CN, requiere
modelar `ORDERS`) · B · Cobro → Caja (cobranzas/tesorería).

---

## 2026-05-31 · v2.2 · Portal Cliente Mobile (APK) · app de teléfono para el cliente externo

**Archivos nuevos:**
- `Portal Cliente Mobile.html` · shell PWA (meta standalone, theme navy, bezel responsive 480px)
- `portal/mobile.jsx` · shell + Bienvenida (PMIntro) + Login + Registro + Verificación + Inicio + Envíos (lista + detalle timeline vertical) + pull-to-refresh + haptics + onboarding
- `portal/mobile-extra.jsx` · primitivos móviles (window.PM: SubHeader/Section/ListRow/Chip/Sheet) + pantallas (Pagar+detalle factura, Comprar en China/Proveedores, Más + subpantallas, Cotizador exprés, NotifSheet)
- `manifest.webmanifest` · `sw.js` (service worker network-first) · `assets/pwa-icon-192.png` + `pwa-icon-512.png` (isólogo reverse sobre navy)

**Funcionalidad:**
- Bottom-nav 5 tabs (Inicio · Envíos · Pagar · Comprar en China · Más). Reusa tokens + ERPUI + ERPData + Icon.
- **Auth de 2 niveles** (pedido del usuario): registro completo → ENTRA al app SIN Shipping Mark; verificación (dirección + cédula/fachada) → estado "en revisión" → Shipping Mark asignado (aprobación simulada ~6s). Cuenta + sesión persistidas en localStorage (sobrevive refresh). Login pre-carga el Shipping Mark guardado.
- **Cotizador exprés** DDP usando `ERPData.RATES`. **Detalle de factura** con desglose + subir comprobante.
- **Gate por Shipping Mark**: "Comprar en China" bloqueado sin verificar / en revisión.

**Feedback de equipo (Sam) aplicado:**
- Verificación: dirección por **cascada estado→ciudad→municipio** vía `ERPUI.SearchSelect` (sin texto libre) + **código postal automático** (dataset VE en `PM_GEO`). Dirección exacta = único campo libre (placeholder "Ej. …"). Explicación de "¿Por qué la fachada?".
- CP alineado al tamaño de los selects (38px / 13px mono).
- Botón de Inicio "Comprar en China · Nueva compra o recompra".
- Intro educativa en "Comprar en China" (seguimiento de compras, registrar proveedor, todo por código, valor de organización, explicación del sistema de codificación Shipping Mark/caja/DTDU). Dismissible + reabrible vía ⓘ.

**Archivos viejos modificados:**
- `Portal Cliente Mobile.html` · carga `nuevo/search-select.jsx` antes de `portal/mobile-extra.jsx`.
- (ninguno del ERP central tocado por esta app; reusa erp/tokens.css, icons.jsx, data.jsx, components.jsx)

**Notas:** Mock. Pagos/SMTP/push y el push del registro al módulo Clientes del ERP (data-bridge) quedan para backend. La aprobación de verificación es un timer simulado.

## 2026-05-31 · Catálogo de Servicios → ERPData + enganche cotizador/facturación (deuda mock #2)

**Catálogo como única fuente de verdad** (antes vivía local en servicios-tarifas):
- `erp/data.jsx` · nuevo **`ERPData.CATALOG`** = `{ ITEMS (14 ítems con tarifa vigente + historial +
  supplierRates), INCOME_ACCTS, EXPENSE_ACCTS, CATEGORIES, AUTHORS, SUPPLIERS_CN, PROVIDERS,
  byCode(), groupTotal(), displayRate(), rateOf(code), lineOptions() }`. `displayRate` resuelve grupos
  como suma de componentes. Agregado al export de `window.ERPData`.
- `nuevo/propuesta/servicios-tarifas.jsx` · ahora lee `ITEMS`/`INCOME_ACCTS`/`EXPENSE_ACCTS`/
  `CATEGORIES`/`AUTHORS`/`SUPPLIERS_CN`/`PROVIDERS` desde `ERPData.CATALOG` (literal local queda como
  fallback por orden de carga).

**Componente reusable de líneas** (`nuevo/catalog-lines.jsx` · `window.ERPUI.CatalogLines`):
- Cada línea referencia un ítem del catálogo y **toma su tarifa vigente** (`CATALOG.displayRate`);
  cantidad + precio editables; calcula importe y subtotal; informa vía `onChange(lines, subtotal)`.
  Se agregan con un `SearchSelect` (`CATALOG.lineOptions()`); "+ Crear servicio nuevo" navega a
  Servicios y Tarifas en modo create. Cargado en `DTD Studio · ERP.html` tras `search-select.jsx`.

**Enganche:**
- `erp/modules/invoices.jsx` · drawer "Nueva factura" suma sección **"Líneas de la factura"** con
  `CatalogLines`; el subtotal **auto-completa** la base imponible (IVA ON) o el Monto (IVA OFF),
  editable. El campo Monto pasó a controlado (`monto` state) — de paso quitó un warning read-only.
- `erp/modules/quotes.jsx` · `QuoteCalculator` suma **"Servicios adicionales"** con `CatalogLines`;
  su subtotal entra al TOTAL DDP con su propia línea en el desglose (`extraSubtotal` state).

**Verificado:** factura abre con "Líneas de la factura" → agregar "Despacho aduanal" trae su tarifa
vigente $120, importe y subtotal correctos. Solo warnings read-only pre-existentes de `U.Input`
(campos date/notas) — no introducidos acá. Falta confirmar visualmente el drawer de cotización
(mismo patrón; compila y la lista renderiza).

**Pendiente mock:** consolidar pantallas 15-19; "+ Crear" filtrado por rol; (opcional) que la línea
guarde la cuenta de ingresos del ítem para el asiento automático cuando exista backend.

---

## 2026-05-31 · SearchSelect en proveedor + líneas (deuda mock #1 cerrada)

**Archivos modificados:**
- `nuevo/propuesta/servicios-tarifas.jsx`:
  - `NewItemDrawer` · "Proveedor sugerido" pasó de `U.Select` a **`ERPUI.SearchSelect`** con
    "+ Crear proveedor" inline (`newSupps` state) — buscable + crear sin salir del drawer.
  - `DetailDrawer` · **se construyó la sección "Proveedores y costos"** que estaba como código
    muerto (`provRates`/`npName`/`npPrice`/`npTo`/`npOpen` declarados pero nunca renderizados):
    lista de proveedores por tarifa (nombre · badge de vencimiento vía `tarifaStatus` · costo /unidad ·
    quitar ×) + form inline "Agregar proveedor" con **`ERPUI.SearchSelect`** (opciones = navieras
    `PROVIDERS` ∪ `SUPPLIERS_CN` ∪ creados) + costo + vigencia. Solo para no-grupo / no-inventario.
  - Se **hoistó `Label`** a scope de módulo (antes solo existía local en `NewItemDrawer`; la local lo
    sombrea, sin conflicto) para que `DetailDrawer` lo use.

**Verificado:** módulo Servicios y Tarifas abre, drawer de SRV-LCL muestra 5 proveedores con
badge+costo, "Agregar proveedor" abre el SearchSelect con "+ Crear proveedor" y la lista. Sin
errores de consola (solo el warning normal de Babel in-browser).

**Pendiente mock:** catálogo de Servicios → `ERPData` + enganche cotizador/facturación;
consolidar pantallas 15-19; "+ Crear" filtrado por rol.

---

## 2026-05-31 · Mapa de Proceso · flujograma global + motor de automatizaciones (página aparte)

Nueva vista **fuera del ERP** (página propia, enlazada desde el sidebar) que dibuja el flujo de
trabajo de DTD-Cargo de extremo a extremo en swimlanes, con las líneas de enlace que atan los
departamentos y un motor de reglas de automatización sobre esos handoffs.

**Archivos nuevos:**
- `Mapa de Proceso.html` · wrapper (tokens + React + carga de datos del ERP + módulos del mapa).
- `nuevo/flujo-mapa.jsx` · app principal. Swimlanes de **4 líneas de negocio** (Comercial · Operatividad ·
  Contabilidad · Servicio al cliente), geometría determinística generalizada a N carriles, conectores
  intra-carril (flujo del depto) + **líneas de enlace punteadas** entre deptos (handoffs, con bow/labelDY
  para bordear nodos). Badges en vivo por nodo (cuentan pendientes de `ERPData`/Tesorería/Naviera/
  Contabilidad/Conversaciones). **Modo foco/acordeón** por carril (otros se compactan, el elegido expande
  tarjetas con detalle). **Panel de resumen** por nodo (2 KPIs + 3-4 registros clickeables + acción).
  **Envío al cliente** (modal de revisión → canal → toast). **Modo Automatizaciones**: chips ⚡ sobre las
  líneas, panel de reglas (crear/editar/eliminar, switches, condiciones, canales), **persistencia en
  localStorage** (`dtd-mapa-rules-v1`) + Restablecer, **Registro de ejecuciones en vivo** + "Ejecutar ahora".
- `nuevo/flujo-resumenes.jsx` · `window.FlowSummaries` — lógica de resumen por nodo (KPIs + registros +
  acción), incluye vínculos cliente↔cotización↔envío y órdenes de pedido sintéticas (estados
  negociación WeChat / confirmada / tránsito / recibida CN).
- `nuevo/flujo-reglas.jsx` · `window.FlowRules` — 11 reglas predefinidas sobre los handoffs (AUT-01..11),
  con trigger/acción/módulos/condiciones/canales + `LOG` de ejecuciones seed.
- `nuevo/flujo-guia.jsx` + `Guía del Mapa de Proceso.html` · hoja de referencia imprimible (4 líneas,
  cómo leer el mapa, set de reglas leído **en vivo** de `FlowRules`, cómo usar Automatizaciones).

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · MODULES (~9) · agregado ítem `mapa-proceso` (grupo INICIO, `href` externo) +
  `renderLeaf` (~185) ahora abre `m.href` en pestaña nueva e indica con ícono ↗.

**Notas:** todo con tokens del sistema; el 4º carril (Servicio) usa el token `warning` (dorado) como
identidad visual por no haber un 4º acento — decisión consensuada con el usuario, no color inventado.
Las reglas creadas viven en localStorage (sesión/equipo), no hay backend. "Ejecutar ahora" simula el
disparo y genera documentos verosímiles (F-/COB-/CXP-/OP-/Q-). Accesos cruzados: ERP → Mapa → Guía → ERP.

---

## 2026-05-31 · CRÍTICO #1 · Arranque de backend (schema Prisma + contrato API + seam de front)

Primer entregable de la pista CRÍTICA (backend), que es lo único codeable sin servidor:
el contrato y el esquema. NO hay servidor corriendo todavía — eso es la sesión de Claude Code
sobre el repo. Acá quedó la base lista para que el backend se enchufe sin tocar la UI.

**Archivos nuevos:**
- `backend/prisma/schema.prisma` · esquema **multi-tenant** completo derivado 1:1 de los shapes
  mock (`window.ERPData`): Tenant, User (tenantId NULL = Plataforma), Client (Shipping Mark único por
  tenant), Supplier, Order (seq por proveedor), Shipment (`DTDU-`), Box (flags), Container,
  WarehouseEvent (fotos S3), Invoice (`F-2026-`, fxRate BCV), Quote, Account (plan jerárquico),
  JournalEntry/Line, ExchangeRate, Comment (threads), ScheduledEmail, TmsIncident, Document, AuditLog.
  Enums de estado por entidad. `tenant.ivaEnabled` OFF por defecto · `markboxSeq` server-side.
- `backend/API-CONTRACT.md` · contrato REST endpoint→store-mock, con regla de oro (tenantId del JWT),
  paginación/filtros estándar y tabla de integraciones externas.
- `nuevo/api/client.jsx` · **seam único** `window.DTDApi` + `window.DTDAuth`. `window.ERPData` sigue
  siendo LA interfaz; toggle `mode:'mock'|'rest'` (flip de una línea: `DTDApi.config({mode:'rest',baseUrl})`).
  En mock espeja el contrato leyendo `ERPData`/`DTDData` (aplica `byTenant`); en rest hace `fetch` con
  `Authorization: Bearer` (tenantId implícito en el token) e hidrata `window.ERPData` al loguear.
  Decodifica `tenantId` del JWT front-side. No invasivo: aditivo, los módulos siguen usando su mock.

**Archivos viejos modificados (línea + razón):**
- `DTD Studio · ERP.html` · ~98 · agregado `<script src="nuevo/api/client.jsx">` tras `data-bridge.jsx`
  (carga el seam; inerte en modo mock).

**Notas:** próximo paso de CRÍTICO ya es servidor real (Postgres/Prisma migrate + auth/JWT + worker
SMTP), fuera de este entorno → handoff `PROMPT-BACKEND.md`. La hidratación real (`DTDApi.hydrate()`)
queda lista esperando endpoints.

---

## 2026-05-31 · Sesión · Servicios&Tarifas integrado, SearchSelect estándar, Crear global, Plan de cuentas real

**Servicios & Tarifas → integrado al ERP** (dejó de ser propuesta)
- `nuevo/propuesta/servicios-tarifas.jsx` con modo `embedded`; expone `window.ModuleServiciosTarifas`. Cargado en `DTD Studio · ERP.html`; `moduleMap.rates → ModuleServiciosTarifas`; sidebar "Tarifas" → **"Servicios y Tarifas"** (`erp/shell.jsx`).
- 5 tipos al crear (Servicio · No inventario · Inventario · Grupo · **Tarifa**); parte contable (cuenta ingresos/gasto, "lo compro", **proveedor sugerido**); **imagen** por ítem; **proveedores múltiples por tarifa** c/vencimiento; **historial con autor** (borrado solo admin); grupos con **toggle de desglose** en factura; pestaña **Tarifas**; menú **"Más"** (categorías/informes/reglas); **motor de reglas de precios** (cliente/volumen/CBM/cantidad + **exceso de peso ≥500 kg/CBM**); "Guardar y cerrar / y nuevo".

**SearchSelect estándar** (`nuevo/search-select.jsx` · `window.ERPUI.SearchSelect`)
- Buscar en vivo + ↑↓/Enter + **"Crear nuevo" en panel lateral** prellenado (no saca del módulo) — `ClienteQuickForm` con Nota. Regla del sistema.
- Aplicado en **Factura** (Cliente + Embarque) y **Cotización** (Cliente). Factura: **Cliente primero**, **embarque opcional/huérfano filtrado por cliente** (evita cruzar códigos).

**Botón "+ Crear" global** (`erp/shell.jsx` · `CreateButton`)
- Arriba del sidebar, **sticky** (sigue el scroll), círculo "+" al colapsar; mega-menú agrupado (Comercial/Operación/Finanzas/Catálogo). Quitado el Crear del topbar (`CreateMenu` desmontado).

**Plan de cuentas REAL** (`nuevo/modules/contabilidad-data.jsx`)
- Reemplazado el mock por las **161 cuentas** del CSV (`uploads/Contactanos.csv`), jerárquico padre→hijo, tipos A/P/PT/I/CGS/G, **sin montos** (saldos 0). Duplicados inglés fusionados; `COMISIONES BANCARIAS`→Gasto bancario, `ALIPAY SAM`→Banco. Sin romper Libro mayor/Reportes.

**Pendiente (próxima sesión):** SearchSelect en **proveedor** y **líneas de producto/servicio**; integrar **Órdenes esperadas (Almacén CN) + Cobro a caja + Proveedores de clientes CN**; mover catálogo de Servicios a `ERPData` y enganchar con cotizador/facturación.

---

## 2026-05-31 · Botón "+ Crear" global · integrado al ERP

El mega-menú "+ Crear" (estilo QuickBooks) dejó de ser propuesta — vive en el Topbar del ERP, en
todos los módulos.

**Archivos viejos modificados:**
- `erp/shell.jsx` · nuevo `CreateMenu` (pill wine "+ Crear" + mega-menú 5 columnas: Comercial ·
  Operación · Finanzas · Catálogo · Equipo). Atajo de teclado **C**. Montado en `Topbar` tras el label
  de módulo. Cada ítem llama `window.__erpGoTo(mod, null, 'create')`; los del catálogo navegan a
  `rates` y emiten `dtd-create-catalog` con el tipo.
- `nuevo/propuesta/servicios-tarifas.jsx` · el módulo embebido escucha `dtd-create-catalog` y abre
  directo el tipo pedido (servicio/inventario/grupo/tarifa).

**Verificado:** "+ Crear → Servicio" navega a Servicios y Tarifas y abre el drawer de creación; los 5
grupos y sus ítems renderizan; sin errores de consola.

**Pendiente:** filtrar ítems del menú por rol/permisos; sección "Frecuentes" que aprenda lo más usado.

---

## 2026-05-31 · Propuesta (sin integrar) · Servicios & Tarifas (lógica QuickBooks)

Mockup de revisión con el sistema real (tokens + ERPUI). **No integrado** — espera OK del usuario.

**Archivos:**
- `Propuesta · Servicios y Tarifas.html` (shell · fuentes Nunito+Sora) + `nuevo/propuesta/servicios-tarifas.jsx`.

**Lógica (QuickBooks adaptada a DTD):**
- **4 tipos** al crear (selector de tarjetas): Servicio (sin stock) · No inventario (cobra, sin stock) ·
  Inventario (con stock + punto de reorden) · Grupo/Paquete (bundle de ítems, ej. DDP Puerta a Puerta).
- **Servicio ≠ Tarifa**: el ítem es estable; la **tarifa** tiene **vigencia** (fecha de corte) y estado
  (vigente / por vencer / vencida) + **historial** de tarifas anteriores. Drawer de detalle permite
  **renovar** (la tarifa actual pasa al historial).
- Catálogo con tabs por tipo, KPIs (ítems, tarifas por vencer, grupos, inventario bajo stock), tabla con
  tarifa vigente + vencimiento. Drawer crear adaptativo por tipo (inventario→stock/costo/reorden,
  grupo→constructor de componentes con suma de tarifa).

**Pendiente de integración:** modelar catálogo en datos, módulo Tarifas real, enganche con cotizador/
facturación (cada línea referencia un ítem + su tarifa vigente).

---

## 2026-05-31 · Barra lateral clara (Papel DTD) · integrada al ERP

La barra de navegación pasa de navy oscuro a **claro** (tono "Papel DTD" `#FBFAF7`), elegido por el
usuario en `Sidebar DTD · Tono.html` (opción 2: Papel DTD + ítem wine-suave + borde sutil). Marca
wine/navy y tipografía intactas.

**Tokens nuevos (no se tocó `--bg-sidebar`, que sigue oscuro para totales/sellos):**
- `erp/tokens.css` · set dedicado a la barra: `--bg-nav` `#FBFAF7`, `--bg-nav-hover` `#F2F0EC`,
  `--bg-nav-active` `var(--wine-tint)`, `--ink-nav` `#0F1E3D`, `--ink-nav-soft` `#6B6B6B`,
  `--ink-nav-active` `var(--wine)`, `--border-nav` `#E8E6E2`, `--nav-brand` `#7F0F1A`. En **dark theme**
  estos tokens se mantienen oscuros (la barra sigue navy en modo oscuro).

**Archivos viejos modificados:**
- `erp/shell.jsx` · `Sidebar` y `DTDLogo` apuntan a `--*-nav` en vez de `--bg-sidebar`/`--ink-side`/
  `#fff` hardcodeado. Ítem activo: fondo wine-tint + texto/ícono/barra wine. Badge activo wine sólido,
  inactivo gris claro. Botones colapsar y labels de grupo re-tonalizados a los tokens nav.

**Motivo de la separación:** `--bg-sidebar` se reutiliza como "superficie oscura" en ~10 módulos
(tesorería, reportes, fiscal, conciliación, estado de cuenta, Mobile ERP…) con texto blanco; aclararlo
los habría roto. Por eso la barra usa tokens propios.

**Selector de tono:** `Sidebar DTD · Tono.html` queda como herramienta para reajustar el tono más
adelante (presets + sliders de claridad/calidez + estilo de ítem activo).

---

## 2026-05-31 · Tipografía del sistema (definitiva) · Nunito Sans + Sora

Decisión cerrada tras explorar 5 combinaciones en `Tipografía del Sistema · Demo.html`. La capa de
**sistema** (ERP, portal, pantallas de producto) pasa a **Nunito Sans** (cuerpo/datos) + **Sora**
(títulos). El **branding** (logo corporativo, wordmark "DTD Cargo", plantillas de correo, firma)
queda en **Archivo / Archivo Black**, intacto.

**Archivos viejos modificados:**
- `erp/tokens.css` · `@import` de Nunito Sans + Sora al tope (un solo punto · cubre los ~25 archivos que
  consumen tokens). `--f-sans` → Nunito Sans, `--f-display` → Sora, `--f-cn` fallback a Nunito.
  Nuevas variables de marca `--f-brand` ('Archivo') y `--f-brand-display` ('Archivo Black').
- `DTD Studio · ERP.html` y `Portal del Cliente.html` · `<link>` de fuentes ampliado con Nunito Sans +
  Sora (preconnect/perf; el `@import` ya las cargaba).
- `CLAUDE.md` · sección Tipografía reescrita + BRAND-EXCEPTION documentada + regla #2 del resumen
  actualizada.

**Reversible en un punto:** igualar `--f-sans`/`--f-display` a `'Archivo'`/`'Archivo Black'` en
`tokens.css`. **Límite conocido y aceptado:** Nunito Sans no trae figuras tabulares → columnas de
montos no alinean perfecto (si molesta, se cambia solo `--f-sans` de datos).

---

## 2026-05-31 · Contabilidad · "Nueva cuenta" (estilo QuickBooks) + métodos de pago

Diseñado y wireado el flujo de **crear cuenta** en el Plan de cuentas (el botón estaba deshabilitado
y sin lógica).

**Lógica (QuickBooks):** Tipo de cuenta → Detalle ("detail type") → Cuenta padre → Nombre + Código
autosugerido (próximo libre bajo el padre, editable). Si el detalle es **Banco** o **Caja**, aparece
**moneda + saldo inicial + métodos de pago vinculados** (checkbox por método; uno **POR DEFECTO**, el
resto opcionales) — para no tener que elegirlos cada vez al cobrar/pagar.

**Archivos viejos modificados:**
- `nuevo/modules/contabilidad-data.jsx` · `PAYMENT_METHODS` (catálogo VE: Wire/Zelle/USDT/Binance/
  Transferencia VES/Pago Móvil/PdV/efectivo), `ACCOUNT_DETAIL_TYPES` por tipo, `nextAccountCode(parent)`,
  `createAccount()` con overlay persistente (`dtd_coa_custom_v1`) fusionado en `CHART_OF_ACCOUNTS` +
  evento `dtd-coa-changed`. Expuestos en `window.ContabilidadData`.
- `nuevo/modules/contabilidad.jsx` · `CoATab` ahora abre `NewAccountDrawer` (botón habilitado, re-render
  por evento). Nuevo componente `NewAccountDrawer` (tipo segmentado, detalle, padre, nombre/código,
  moneda, saldo, métodos con default, preview en vivo, estado de éxito).

**Pendiente sugerido:** que los métodos vinculados a cada banco/caja alimenten el selector del cobro a
caja (propuesta B) para cerrar el círculo.

---

## 2026-05-31 · Feedback de Sam · tenants como empresas + cobro multimoneda + más

**1 · Multi-tenant = empresas separadas (Highway), NO sucursales.**
- `erp/data.jsx` · TENANTS redefinido como EMPRESAS aisladas (`dtd` home + `andes` + `pacifico`);
  toda la data de DTD queda bajo un solo tenant `dtd`. `HOME_TENANT`, `isHomeTenant()`, `COMPANIES`.
  `_initTenant` default `dtd` y descarta ids viejos de sucursal.
- `erp/shell.jsx` · **sacado el selector de tenant del Topbar** (invisible en DTD). Nuevo
  `CompanySwitchModal` ("Cambiar de empresa" en el menú de usuario · salir/entrar) + `CompanyBanner`
  (barra wine cuando operás otra empresa · "Volver a DTD-Cargo"). Exportado en `window.ERPShell`.
- `DTD Studio · ERP.html` · monta `<CompanyBanner/>` entre Topbar y contenido.
- `nuevo/modules/dashboard.jsx` · KPIs/subtitle solo se recalculan para empresas NO-home (la home
  muestra sus números completos). Cambiar a otra empresa → datos aislados (vacíos).

**2 · Cobro multimoneda + comprobante** (`nuevo/propuesta/propuesta.jsx`)
- Si la caja es en otra moneda aparece la **tasa del día** (auto·BCV, editable); doble input
  **En {moneda} / En US$**; el equivalente **siempre en dólares** (la factura se salda en USD).
  Soporta abono parcial. **Comprobante de pago obligatorio** (Confirmar deshabilitado sin adjunto).

**3 · Proveedores** · solo "Grupo WeChat" (sacado WhatsApp) en la propuesta.
**4 · Órdenes** · gestor de columnas (reordenar/ocultar) en la tabla de la propuesta (`U.ColumnManager`).
**5 · Estado de cuenta** (`nuevo/pantallas/estado-cuenta.jsx`) · transacciones en **bolívares** en la
  cuenta corriente principal (chip `Bs … · BCV/paralelo`), dividiendo pagos USD para no alterar saldos.

---

## 2026-05-31 · Propuesta (sin integrar) · Órdenes · Caja · Proveedores

Mockup de revisión con el sistema real (tokens + ERPUI + ERPData). **No integrado** a
los módulos vivos — espera OK del usuario para wirear.

**Archivos nuevos:**
- `Propuesta · Órdenes, Caja y Proveedores.html` (shell: fuentes + tokens + icons/data/components)
- `nuevo/propuesta/propuesta.jsx` (3 secciones interactivas)

**Qué propone (reglas confirmadas por el usuario):**
- **A · Almacén CN → pestaña "Esperadas / en camino"**: las órdenes que el cliente registra al
  comprar en China entran como esperadas (proveedor + packing list + factura que declaran cajas/CBM/
  peso). Drawer **Verificar**: el almacén rectifica sumatorias y confirma docs → la orden pasa a
  "Recibidas". Seguimiento automático. Código `Shipping Mark-proveedor-compra` (ej. `DTD-5452-1-1`) **es** el
  nombre del grupo WeChat.
- **B · Cobranzas → Caja**: al registrar el cobro se elige **cuenta de caja** (USD/USDT/VES) + **método**;
  baja el saldo de la factura y **entra como ingreso** a Tesorería (posición de caja se actualiza).
  Soporta abono parcial.
- **C · Proveedores de clientes · CN**: renombrado (no son acreedores de la empresa — esos viven en
  Tesorería · CxP), nuevo campo **Grupo WhatsApp/WeChat + código**, y **clientes** a los que pertenece.

**Pendiente de integración (cuando el usuario apruebe):** modelar `ORDERS` en `erp/data.jsx`
(atadas a cliente + proveedor CN), pestaña real en `erp/modules/cn.jsx`, cobro→caja en
`nuevo/modules/cobranzas*.jsx` + `tesoreria*`, y campos nuevos en `erp/modules/suppliers.jsx`.

---

## 2026-05-31 · v2.1 · 🏢 #14 Multi-tenant · filtrado real por tenant

Selector de tenant en el Topbar que ahora **filtra datos de verdad** en todos los módulos
(antes era solo visual). Patrón idéntico al ojo `dtd-hide-values` / feature flags.

**Modelo (datos):**
- 3 tenants mock (ids alineados con `users-platform.jsx`): `dtd-ca` (Caracas·Valencia · Enterprise),
  `dtd-zulia` (Maracaibo · Pro), `dtd-occ` (Barquisimeto · onboarding, data escasa a propósito).
- `tenantId` asignado a cada entidad raíz: CLIENTS por ciudad (mapa `CITY_TENANT`), y por linkage de
  markbox a SHIPMENTS · INVOICES · QUOTES · WAREHOUSE_CN/VE · DOCUMENTS · SUPPLIER_CLIENTS; LEADS por
  ciudad; SUPPLIERS por mayoría de clientes que le compran.
- Estado global `window.__currentTenant` (default `'all'` = vista plataforma/super-admin),
  persistido en localStorage `dtd-current-tenant`, evento `dtd-tenant-changed`.
- Helper central `ERPData.byTenant(rows)` (filas sin tenantId pasan = infra compartida) +
  `ERPData.TENANTS`, `currentTenant()`, `setTenant(id)`, `tenant(id)`, `tenantCodePrefix()`.

**Archivos viejos modificados (línea + razón):**
- `erp/data.jsx` · ~+70 líneas antes de `window.ERPData` · modelo de tenants + tagging + API; `Object.assign` al final.
- `erp/shell.jsx` · ~319 · nuevo componente `TenantSwitcher` + montado en el Topbar (al lado del switch de usuario).
- `DTD Studio · ERP.html` · App · estado `tenantTick` + listener `dtd-tenant-changed` + tenant en el `key` de `.erp-route` (remonta módulos al cambiar).
- `nuevo/modules/dashboard.jsx` · `resolveKpiValue` recalcula KPIs derivados (`_tenantKpis()`) sobre data filtrada cuando hay tenant activo; widgets (activos/ETA) + subtitle filtrados.
- `nuevo/modules/cobranzas-data.jsx` · `cobItems()` filtra INVOICES por tenant (cubre lista + totales).
- `erp/modules/shipments.jsx` · `baseShipments = byTenant(SHIPMENTS)` (lista + tabs).
- `erp/modules/clients.jsx` · `baseClients` (lista + subtitle).
- `erp/modules/suppliers.jsx` · `baseSuppliers` (lista + KPIs agregados).
- `erp/modules/invoices.jsx` · `baseInvoices` (lista + KPIs + tabs).
- `erp/modules/costing.jsx` · `byTenant` en data principal, editor y forecast (pipeline + quotes).
- `erp/modules/calendar.jsx` · `byTenant` en eventos y en impacto de feriados.
- `erp/modules/leads.jsx` · `byTenant(LEADS)` (estado inicial + owners/sources).
- `erp/modules/quotes.jsx` · `byTenant(QUOTES)` en la lista.

**Verificado (screenshots):** Dashboard / Clientes / Proveedores / Facturación / Costing cambian sus
números y listas al conmutar `all → dtd-zulia → dtd-occ`. Tenant escaso (`dtd-occ`: 1 cliente,
0 facturas) renderiza empty states sin crashear; Costing OCC muestra 1/1 embarque con margen real.

**Notas / pendiente backend:** TMS (flota/choferes) queda como infra compartida (sin tenantId) a
propósito. Al consolidar, `tenantId` debería venir del backend (`tenant.id`) y `byTenant` ser un
filtro server-side. Cierra el último pendiente del pulido sin backend (#14).

---

## 2026-05-31 · v2.0 · 🔍 Auditoría de interconexiones + cierre de sesión

Antes de cerrar v2 se auditó todo el grafo de navegación e integración del ERP. **Resultado: sano.**

### ✅ Verificado OK
- **Router completo**: los 37 IDs del sidebar (`erp/shell.jsx` · MODULES) están todos presentes en el
  `moduleMap` del bootstrap (`DTD Studio · ERP.html`). Cero "Módulo no encontrado".
- **Overrides bien ordenados**: `nuevo/modules/documentos-hub.jsx` reemplaza `window.ModuleDocuments`
  (carga después de `erp/modules/documents.jsx`); `nuevo/modules/dashboard.jsx` override del dashboard;
  `flujo-trabajo.jsx` expone `window.ModuleInicio` (landing). Todos cargan en orden correcto.
- **Contrato `goTo` consistente**: `window.__erpGoTo(mod, id?, view?)` + prop `goTo` en cada módulo.
  Navegaciones cruzadas verificadas (cliente→embarque, proveedor→embarque histórico, calendario drag).
- **Íconos y helpers**: todos los usados esta sesión existen en el set (`arrowR`, `flow`, `download`,
  `refresh`, `warn`, `info`, `check`, `shield`, `plus`, `chevR`) + `toneColor`/`formatShortDate` en calendar.
- **Apps móviles**: los 5 HTML existen (CN, VE, Bodeguero, Camionero, Multi); avisos wireados en 4
  (Multi es launcher, sin campana a propósito).
- **Links externos**: perfiles standalone (`nuevo/pantallas/*`) linkean a `../../DTD Studio · ERP.html`
  + `mailto:`/`tel:`/`wa.me` correctos. Despacho V1/V2/Admin se enlazan por `window.location.href`.

### 🔧 Corregido en la auditoría
- **`erp/components.jsx` · `Table`** · 🛑 **BUG CRÍTICO de hooks** (destapado por el skeleton de
  Embarques). El componente tenía un `useMemo` **después** de un early return condicional
  (`if (!rows.length) return empty`), violando las reglas de hooks de React. Cuando `rows` pasaba de
  vacío→lleno entre renders (nuevo timing del `useFirstLoad('shipments')`), el conteo de hooks
  cambiaba y tiraba `Rendered more hooks than during the previous render`, **crasheando el árbol
  entero** (todo el ERP quedaba inutilizable hasta recargar). **Fix**: el early return se movió a
  DESPUÉS del `useMemo` — ningún hook queda tras un return condicional. Beneficia a todos los módulos
  que usan `U.Table` (Embarques, Clientes, etc.). Verificado: `Drawer` y `Modal` ya tenían el patrón
  correcto (early return después del `useEffect`).
- **`erp/modules/operarios-pwa.jsx`** · el launcher de apps listaba solo 3 de 5 (faltaban **Camionero**
  y **Operario Multi**). Agregadas las 2 entradas al array `APPS` + grid pasado a `repeat(auto-fill,
  minmax(240px,1fr))` para que las 5 cards fluyan parejas.

### ⚠️ Notas menores (no bloqueантes, para backend/próximo)
- El aviso `act:'route'` del Operario VE asume que existe una ruta en estado `pendiente`; si no hay,
  `onStartRoute(undefined)` no hace nada (no crashea). Cuando el bridge alimente rutas reales, validar.
- Los avisos de las 4 móviles usan seeds locales (no el bridge real todavía) — documentado en su entrada.

---

## 📍 ESTADO AL CIERRE · v2.0 (2026-05-31)

**Versión lanzada: v2.0** — estampada en los 10 HTML + footer del ERP.

**Pulido v2 (sin backend) — 9 de 10 cerrados:**
| ✅ | #6 drag despacho · #7+7b skeletons · #8+8b ojo 👁 · #9 calendario drag · #10 incidencias TMS · #11 costing mes·mes · #12 proveedores histórico · #13 vault export · 🔔 Centro de Avisos en las 4 móviles |
| 🔲 | **#14 Multi-tenant** — único pendiente. Es el arranque de la PRÓXIMA sesión. |

**Próxima sesión → #14 Multi-tenant** (ver `PROMPT-proxima-sesion.md`): selector de tenant que filtre
datos de verdad en CLIENTS / SHIPMENTS / SUPPLIERS y los módulos. Es transversal → sesión dedicada,
verificando módulo por módulo.

---

## 2026-05-31 · v2.0 · Remates de pulido · skeletons + ojo (7b/8b)

Extiende los pendientes #7 (skeletons) y #8 (ocultar valores 👁) a los módulos que faltaban.

**Clientes** (`erp/modules/clients.jsx`)
- `useFirstLoad('clients')` → `LoadingRows` en la primera carga de la tabla.
- `useHideValues()` → columna **Facturado** enmascara (`•••`); en el detalle, KPIs **Facturado** y
  **Adeudado** también respetan el flag.

**Cobranzas** (`nuevo/modules/cobranzas.jsx`)
- `useFirstLoad('cobranzas')` → `LoadingRows` en la primera carga.
- `useHideValues()` → KPIs **Por cobrar / Vencido / En promesa** y la columna **Saldo** enmascaran.

**Costing** (`erp/modules/costing.jsx`)
- `useHideValues()` → KPIs hero **Revenue / Costo / Margen bruto** enmascaran (el conteo de
  embarques y los %s quedan visibles).

**Brand-check:** solo helpers de ERPUI (`useFirstLoad`/`LoadingRows`/`useHideValues`) + tokens. Sin
emoji, sin AI slop. Reactivo al toggle global `dtd-hide-values` (se prende desde el ojo del Dashboard).

**Pendiente menor:** enmascarar los SVG de charts (composición de costos) y los `PeriodMetric` del
Overview; hoy se enmascaran los KPIs y tablas, que es lo más visible.

---

## 2026-05-31 · v2.0 · Calendario · drag de eventos para reprogramar (#9)

Cierra el pendiente #9. En la vista **Mes**, los eventos ETD/ETA/POD se pueden **arrastrar a otro día**
para reprogramarlos, con confirmación y persistencia.

**Archivo modificado:** `erp/modules/calendar.jsx`
- `ModuleCalendar` · store de overrides de fecha por evento en `localStorage['dtd-cal-overrides']`
  (`{ [eventId]: 'YYYY-MM-DD' }`). El armado de eventos aplica el override (`origDate` + flag `moved`).
  Estado `dragEvent` + `pendingMove`. `onDayDrop(day)` abre confirmación; `confirmMove` persiste
  (si la nueva fecha == original, borra el override); `resetOverrides` limpia todo.
- Pista bajo el nav ("Arrastrá un evento… para reprogramarlo") + botón **"N reprogramados ·
  Restablecer"** cuando hay overrides.
- **Modal de confirmación** con badge del tipo, embarque, y comparación **Antes → Nueva fecha**.
- `MonthGrid` · celdas de día con `onDragOver/onDragLeave/onDrop` + highlight wine al pasar por
  encima; chips de evento `draggable` (cursor grab, `onDragStart` setea el evento) con indicador
  **↻ + barra wine** cuando están reprogramados. Los feriados no son arrastrables.

**Brand-check:** solo tokens + ERPUI (`Modal`/`Badge`/`Btn`). Sin emoji, sin AI slop. HTML5 drag&drop
nativo (sin librerías). Persistencia real del reordenamiento de fechas.

**Pendiente (backend):** que reprogramar dispare el update real de ETD/ETA del embarque (hoy es un
override visual del calendario). Drag en vista Semana (hoy solo Mes).

---

## 2026-05-31 · v2.0 · Vault · exportar credenciales a archivo (#13)

Cierra el pendiente #13. El módulo Vault ahora puede **exportar la bóveda a un `.enc`** cifrado simulado.

**Archivo modificado:** `erp/modules/vault.jsx`
- `ModuleVault` · botón **"Exportar"** (icono download) en el PageHeader + estado `exportOpen` +
  render de `<VaultExport>`.
- **NUEVO** `VaultExport` (U.Modal): scope **Toda la bóveda / Categoría actual** (deshabilitada si
  estás en "Todas"), **passphrase** de cifrado opcional, y `Exportar .enc`. Genera el archivo con
  cabecera `-----BEGIN DTD-VAULT ENCRYPTED EXPORT-----`, payload **XOR+base64** (cifrado simulado,
  NO criptografía real) en líneas de 64, y dispara la **descarga** vía Blob + `<a download>`
  (`dtd-vault-{scope}-{fecha}.enc`). Estado de éxito con nombre de archivo + aviso de resguardo.
  Las contraseñas se exportan como `«cifrado»` (no hay claves reales en el mock).

**Brand-check:** solo tokens + ERPUI (`Modal`/`Btn`). Sin emoji, sin AI slop. Descarga nativa del navegador.

**Pendiente (backend):** cifrado real (AES-GCM con la master key derivada), e import/restore del .enc.

---

## 2026-05-31 · v2.0 · Costing · comparativa mes vs mes (#11)

Cierra el pendiente #11. El Overview de Costing ya tenía una comparativa **YTD vs Q4 2025**; se le
agregó un **toggle Trimestre / Mes a mes** y, en modo mes, el **delta % por categoría de costo**.

**Archivo modificado:** `erp/modules/costing.jsx` · `OverviewSection`
- Estado `cmpMode` ('quarter' | 'month') + toggle segmentado en el header de la card de comparativa.
- Modelo mensual **derivado del YTD real** (no hardcode suelto): mes corriente ≈ 21% del acumulado;
  abril se reconstruye por categoría con un factor MoM determinista (`MONTH_VAR`). Revenue/costo/
  margen/margen% de Mayo vs Abril con los mismos `PeriodMetric`.
- Sección **"Delta por categoría de costo · Mayo vs Abril"**: grid de 7 categorías (flete, aduana,
  transporte, handling, seguro, comisión, otros) con valor del mes + delta % coloreado
  (↓ verde = gastás menos / ↑ rojo = alerta, porque son costos). Nuevo componente `MonthCatRow`.

**Brand-check:** solo tokens + ERPUI + JetBrains Mono. Sin emoji, sin AI slop. La semántica de color
respeta que en costos bajar es bueno. Datos derivados del acumulado real del módulo.

**Pendiente (backend):** cuando `SHIPMENT_COSTS` tenga fecha, agregar por mes real en vez del
modelo derivado. La UI y el toggle quedan igual.

---

## 2026-05-31 · v2.0 · Proveedores · tab "Embarques históricos" (#12)

Cierra el pendiente #12 del pulido v2. El drawer de detalle de proveedor (`SupplierDetail`) ahora
es **tabbed**: **Resumen** (todo lo que ya existía) + **Embarques históricos** (nuevo).

**Archivo modificado:** `erp/modules/suppliers.jsx`
- `SupplierDetail` · agregado `useState('resumen')` + `useEffect` que resetea el tab al cambiar de
  proveedor; `<U.Tabs>` arriba del cuerpo (Resumen / Embarques históricos · count = `s.shipments`).
  El contenido previo quedó envuelto en `{tab === 'resumen' && (…)}`.
- **NUEVO** `buildSupplierShipments(s, clients, CLIENTS)` · genera el historial **determinista** del
  proveedor (LCG con semilla = nº del id) a partir de datos reales: clientes que le compran
  (`SUPPLIER_CLIENTS`), `s.shipments` (cap 16 mostrados) y `s.lastDeal` (fechas hacia atrás ~11 meses).
  Estados: el más reciente en `tránsito`, el siguiente en `aduana VE`, resto `entregado` (1 `incidencia`).
- **NUEVO** `SupplierShipments` · KPI strip (embarques / CBM / valor FOB del filtro) + 2 filtros
  (**estado**: todos/entregado/tránsito/aduana/incidencia · **período**: todo/3/6/12 meses) + tabla
  (código DTDU, cliente+Shipping Mark+fecha, CBM, valor, badge de estado). Fila clickeable → `goTo('shipments', id)`.
  EmptyState cuando el filtro no devuelve nada. `ShipKPI` helper.

**Brand-check:** solo tokens + ERPUI (`Tabs`/`Select`/`Badge`/`EmptyState`) + JetBrains Mono en códigos.
Sin emoji, sin AI slop. Datos derivados de fuentes reales del ERP (no inventados de la nada).

**Pendiente (backend):** cuando exista el link real SHIPMENTS↔proveedor, reemplazar
`buildSupplierShipments` por `SHIPMENTS.filter(supplierId)`. La UI y los filtros quedan igual.

---

## 2026-05-31 · v2.0 · Centro de Avisos del operario (mobile) + apertura de línea v2

> **Versión a lanzar: v2.0.** Se abre la línea v2 con la feature insignia móvil. El tema macro
> de v2 sigue siendo el **cierre total de pulido sin backend** (#6–14): esta entrada cierra el
> primero de esa lista para mobile (centro de notificaciones del operario). El resto del pulido
> queda pendiente — ver `PROMPT-proxima-sesion.md`.

### Centro de Avisos · `nuevo/operario/avisos.jsx` (NUEVO · módulo reutilizable)

Bandeja de notificaciones del operario móvil, bilingüe ES/中文, diseñada para clonar a Operario
VE / Bodeguero / Camionero. Expone `window.OperarioAvisos`:

- `Bell({ items, onOpen })` → campana del header con **badge de no-leídos** (wine, "9+" tope).
- `Sheet({ open, onClose, t, lang, items, onAction })` → bottom-sheet con:
  - Header con contador "N sin leer / Todo al día" + **Marcar leído** (marca todo) + cerrar.
  - **Filtros** pill: Todos · Sin leer (con contador) · Operación · Sistema.
  - **Agrupado** Hoy / Ayer.
  - Filas con chip de ícono por tipo (color del token), eyebrow, título, body, code/from y CTA.
  - **Empty state** por filtro.
- `useUnread(items)` → hook reactivo (escucha `dtd-avisos-changed` + `storage`).
- Read-state **persistido** en `localStorage['dtd-op-avisos-read']`. Tap marca leído; si el aviso
  trae `act` (`dispatch`/`print`) navega a esa acción del Home.
- **6 tipos** (sin emoji, íconos del set `window.Icon`): `cierre` (warning·ship),
  `od` (info·truck), `incidencia` (danger·warn), `qr` (wine·tag), `mensaje` (ink·chat),
  `sync` (success·check). Seed de 8 avisos realistas DTD-Cargo (YIW-A1, Shipping Mark, OD, CBM 50).

### Wiring en Operario CN

- `operario/app.jsx` · `Home` · agregada **campana** (`<Avisos.Bell>`) a la izquierda del menú en el
  header + render de `<Avisos.Sheet>`. Estado `avisosOpen`; `avisos = useMemo(seed(t), [lang])`;
  `onAviso(act)` enchufa `dispatch`→modo despacho y `print`→sheet de QR. Footer login `v1.0`→`v2.0`.
- `Operario CN.html` · `<script src="nuevo/operario/avisos.jsx">` antes de `app.jsx`; title → v2.0.

### Bump de versión v1.9.1 → v2.0 (labels visibles)

- Titles de: `Bodeguero VE.html`, `Camionero.html`, `Operario Multi.html`, `Operario VE.html`,
  `Operario CN.html`, `Portal del Cliente.html`, `Registro Cliente.html`, `Mobile ERP.html`,
  `DTD Studio · ERP.html`, `Modo Cliente.html`.
- `erp/shell.jsx` · footer del sidebar `ERP · v1.9.1` → `ERP · v2.0`.

**Brand-check:** solo tokens `var(--*)` + íconos del set + fuentes del sistema. **Sin emoji** en los
avisos (a diferencia del resto del Home, que aún usa emoji heredado — deuda de pulido aparte). Sin
AI slop. Persistencia real del leído/no-leído.

**Pendiente (backend):** alimentar `items` desde el bridge real (`window.DTDBridge` / `data-bridge`)
en vez de los seeds; push real (FCM/APNs); marcar leído server-side; sincronizar el read-state entre
dispositivos. Operario Multi (launcher) no lleva campana a propósito.

### Clonado a las otras 3 móviles (mismo módulo, seed por rol)

- `nuevo/operario/avisos.jsx` · agregados `seedVE()` (chofer: ruta/POD/GPS), `seedBodega()`
  (contenedor por recibir, camión por armar, parcial sin motivo) y `seedCamion()` (ruta activa,
  GPS, WhatsApp del bodeguero). IDs prefijados por rol (`ve-`/`bo-`/`ca-`) → comparten el mismo
  store `dtd-op-avisos-read` sin colisión.
- `operario/ve.jsx` · `Home` · campana + `<Avisos.Sheet>` (es-only, `t=(es)=>es`); `act:'route'`
  inicia la próxima ruta. `Operario VE.html` · script avisos.
- `operario/bodeguero.jsx` · `Home` · campana + sheet; `act:'dispatch'` abre armar camión.
  `Bodeguero VE.html` · script avisos.
- `operario/camionero.jsx` · `Header` acepta `avisos`/`onAvisos` → campana en el cluster derecho
  (junto al toggle de tema); `<Avisos.Sheet>` en el App (hereda `data-theme` del wrapper, anda en
  dark). `Camionero.html` · script avisos.

---

## 2026-05-31 · Cobranzas (cola de CxC vencidas con seguimiento)

Módulo nuevo en FINANZAS: convierte el aging real en un pipeline de cobranza accionable.

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/cobranzas-data.jsx` · deriva los ítems de `ERPData.INVOICES` con saldo, calcula
  días de vencimiento, estados (Al día / Vencido / Contactado / Promesa de pago / Pagado). Gestión
  **persistida en localStorage** (overlay por factura: estado, promesa, bitácora). Helpers
  `cobItems`/`cobSetStage`/`cobAddAction`/`cobTotals`. `window.CobranzasData`.
- `nuevo/modules/cobranzas.jsx` · `ModuleCobranzas`:
  - KPIs (por cobrar, vencido, en promesa, tasa de cobro), filtro por estado, tabla con saldo,
    días de vencido, última gestión y estado (resalta >30d en rojo).
  - Drawer con acciones: **Registrar contacto · Promesa de pago (con fecha) · Enviar recordatorio ·
    Marcar pagado**, + bitácora de gestión con timeline. Links a factura/cliente. Reactivo (evento).

**Archivos viejos modificados:**
- `erp/shell.jsx` · MODULES · `cobranzas` (icono `check`) tras Facturación en FINANZAS.
- `DTD Studio · ERP.html` · `<script>` cobranzas-data + cobranzas; `cobranzas: window.ModuleCobranzas` al moduleMap.
- `erp/data.jsx` · ROLE_MODULES · `cobranzas` agregado a Comercial y Contabilidad.

**Brand-check:** solo tokens + ERPUI. Sin AI slop. Persistencia real de la gestión (localStorage).

**Pendiente (backend):** envío real de recordatorios (WhatsApp/email), escalamiento automático por antigüedad,
registro del pago que baje el saldo real de la factura, reporte de efectividad de cobranza por gestor.

---

## 2026-05-31 · Export CSV real (Constructor + libros fiscales)

Reemplaza los botones "Exportar" placeholder por descarga CSV real.

**Archivos modificados:**
- `nuevo/modules/dtd-config.jsx` · `window.DTDExport.csv(filename, headers, rows)` · genera un Blob
  CSV (con BOM UTF-8, escapado de comas/comillas) y dispara la descarga.
- `erp/modules/reports.jsx` · botón **Exportar** del Constructor → baja el resultado actual
  (grupo, registros, métrica) como CSV.
- `nuevo/modules/fiscal.jsx` · **Libro de Ventas** y **Libro de Compras** → botón "Exportar CSV"
  con todas las columnas (fecha, factura/doc, control, cliente/proveedor, RIF, base, IVA, total).

**Brand-check:** solo tokens + ERPUI. Sin AI slop. Descarga nativa del navegador.

**Pendiente:** Excel (.xlsx) con formato, export del PDF de cada reporte, export de retenciones.

---

## 2026-05-31 · Facturación IVA-aware (cierra el círculo del toggle)

Cuando el toggle **IVA/SENIAT** (Admin) está ON, la Facturación discrimina base + IVA.

**Archivo modificado:** `erp/modules/invoices.jsx`
- `ModuleInvoices` lee `DTDConfig.useCfg('iva')`.
- **Nueva factura:** si IVA ON, en vez de "Monto" pide **Base imponible** y muestra desglose en vivo
  (Base + IVA 16% + Total) con nota de que alimenta el Libro de Ventas; si OFF, "Monto" simple.
- **Detalle de factura:** si IVA ON, agrega card **"Desglose fiscal · IVA 16%"** (base / IVA débito / total)
  derivado del monto.

**Limpieza:** se eliminó el alias duplicado `auditlog` del `moduleMap` en `DTD Studio · ERP.html`
(el ítem real es `audit-log`; nada en runtime usaba el alias).

**Brand-check:** solo tokens + ERPUI. Sin AI slop. Reactivo al toggle (sin recargar).

---

## 2026-05-31 · Reportes Fase 3 (Constructor) + Toggle IVA/SENIAT en Admin

**Fase 3 · Constructor de reportes** (`erp/modules/reports.jsx`)
- Nueva categoría **Constructor** → `ReportsBuilder`: armador interactivo.
  - Fuente (Embarques / Facturas / Clientes / CxP) → Agrupar por → Métrica (conteo / suma / promedio)
    → Filtro opcional → visualización **barras o tabla**.
  - Total + grupos en vivo, **guardar reporte** (localStorage, chips reutilizables) y exportar.
  - `BUILDER_SOURCES` define dims/métricas/filtros por fuente; agrega leyendo `ERPData`/`TesoreriaData`.

**Toggle IVA/SENIAT · desactivado por defecto** (pedido: DTD hoy no maneja IVA)
- `nuevo/modules/dtd-config.jsx` · `window.DTDConfig` (get/set/useCfg, persist localStorage,
  evento `dtd-cfg-changed`; `iva` default **false**) + `AdminFiscalConfig` (sección con switch +
  explicación de qué cambia al activar).
- `erp/modules/admin.jsx` · nueva sección **"Impuestos · IVA/SENIAT"** (grupo BÁSICO) → `AdminFiscalConfig`.
- **Gating reactivo:**
  - `nuevo/modules/contabilidad.jsx` · el tab **Fiscal · SENIAT** solo aparece si IVA está ON (si se
    apaga estando en él, vuelve a "flujo").
  - `erp/modules/reports.jsx` · el reporte **Posición IVA** solo aparece en Contables si IVA está ON.
- `DTD Studio · ERP.html` · `<script>` dtd-config.jsx.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Sin AI slop. Default fiscal OFF = modo actual del negocio.

**Próximo:** export real (Excel/PDF) del constructor; al activar IVA, que Facturación discrimine base+IVA automáticamente.

---

## 2026-05-31 · Reportes · Fase 2 · Combinados (op × finanzas)

Nueva categoría **Combinados** en Reportes: cruces operación × finanzas que ningún otro
módulo hace.

**Archivo modificado:** `erp/modules/reports.jsx`
- Pill de categoría **Combinados** (icono `spark`) con 3 reportes:
  - `ReportsRentRuta` · **Rentabilidad por ruta** CN→VE (ingreso vs costo directo → margen %), con KPIs.
  - `ReportsMargenCliente` · **Margen por cliente** (link al cliente), ordenado por margen.
  - `ReportsCostoCBM` · **Costo/Ingreso por CBM** por ruta (clave para pricing de consolidado).
- Helpers `_shipAgg()` (agrega `ERPData.SHIPMENTS` aplicando ratio de costo directo por ruta) +
  `_MarginTable` reutilizable.

**Brand-check:** solo tokens + ERPUI. Sin AI slop. Reusa SHIPMENTS/ORIGINS/DESTINATIONS reales.

**Próxima fase:** Fase 3 = Constructor de reportes (armador interactivo).

---

## 2026-05-31 · Reportes · Fase 1 · Categorización + cableado a datos reales

Reestructura del módulo Reportes: de 7 tabs planos a **navegación de 2 niveles** (categoría →
reporte), con lo Contable **separado** de lo Operacional y leyendo la fuente de verdad.

**Archivo modificado:** `erp/modules/reports.jsx`
- `ModuleReports` · pills de categoría (nivel 1) + sub-tabs por categoría (nivel 2):
  - **Operacionales:** Overview, Por ruta, Por naviera, Por servicio (existentes).
  - **Comerciales:** Por cliente, Por agente (existentes).
  - **Contables & financieros:** 3 reportes NUEVOS cableados a datos reales + Facturado vs cobrado.
- Nuevos componentes contables:
  - `ReportsPL` · estado de resultados leído de `ContabilidadData.calculatePL()` (no re-mockea):
    ingresos, CGS, utilidad bruta, gastos, operativa, neta + % sobre ingresos.
  - `ReportsAging` · aging real de **CxC** (de `ERPData.INVOICES` con saldo, por días de vencimiento)
    y **CxP** (de `TesoreriaData.openPayables`), en buckets Corriente / 1-30 / 31-60 / 60+, con barras.
  - `ReportsIVA` · posición de IVA leída de `FiscalData.declaracionIVA()` (débito/crédito/cuota/a pagar)
    + equivalente VES @ BCV + link a los libros fiscales.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Elimina el riesgo de números inconsistentes
(los contables ahora salen de la misma fuente que Contabilidad/Tesorería/Fiscal). Sin AI slop.

**Próximas fases:** Fase 2 = Combinados (rentabilidad por ruta/cliente, costo por CBM · cruces op×finanzas);
Fase 3 = Constructor de reportes (armador interactivo: fuente → agrupar → métrica → filtro → visualización).

---

## 2026-05-31 · Fiscal · SENIAT (cumplimiento VE · tab en Contabilidad)

Cierra la rama de cumplimiento: hasta ahora había libros en USD pero no el cumplimiento fiscal
venezolano formal. Nuevo tab **"Fiscal · SENIAT"** en Contabilidad, con montos en USD funcional
+ VES @ BCV (la declaración se presenta en bolívares).

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/fiscal-data.jsx` · IVA 16%, retención IVA 75% / ISLR 3%; Libro de Ventas
  (alimentado por facturas reales F-2026-…), Libro de Compras (proveedores con RIF), Retenciones
  emitidas (IVA + ISLR), helpers de totales y `declaracionIVA()` (débito − crédito − retenciones
  soportadas = a pagar). `window.FiscalData`.
- `nuevo/modules/fiscal.jsx` · `FiscalTab` con 4 sub-tabs:
  - **Declaración IVA:** forma resumen (débito/crédito/cuota/retenciones/IVA a pagar) en USD + VES,
    panel de obligaciones del período y KPIs.
  - **Libro de Ventas / Libro de Compras:** tablas formato SENIAT (fecha, factura/doc, Nº control,
    RIF, base, IVA, total) con totales.
  - **Retenciones:** comprobantes IVA/ISLR emitidos con KPIs.

**Archivos viejos modificados:**
- `DTD Studio · ERP.html` · `<script>` fiscal-data + fiscal (después de documentos-hub).
- `nuevo/modules/contabilidad.jsx` · nuevo tab **"Fiscal · SENIAT"** (entre Reportes y Configuración)
  que renderiza `window.FiscalTab`.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Reusa `ERPRates` (BCV) y los IDs reales de facturas. Sin AI slop.

**Pendiente (backend):** generación de los TXT/XML para el portal SENIAT, calendario real de contribuyentes
especiales, numeración de comprobantes automática, conexión con el módulo de facturación para alimentar el libro en vivo.

---

## 2026-05-31 · Documentos · Hub central + adjuntos embebidos en transacciones

Se reemplazó la tabla plana de Documentos por un **hub central transversal** y se integró
de forma **bidireccional**: cada transacción muestra sus adjuntos en su propio detalle, y todos
ruedan al hub clasificados por carpeta.

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/documentos-data.jsx` · árbol de 5 carpetas (Operacionales, Logísticas, Contables
  & financieras, Aduaneras · SENIAT, Otras) con subcarpetas; 23 documentos seed con extensión,
  carpeta, vínculo a transacción (embarque/factura/pago/asiento/cliente/proveedor), estado y autor.
  Helpers `docsIn`, `folderCount`, `unlinked`, `expiring`, `pending`. `window.DocumentosData`.
- `nuevo/modules/documentos-hub.jsx`:
  - `ModuleDocumentosHub` (override de `window.ModuleDocuments`) · KPIs + **árbol de carpetas**
    expandible con contadores + **explorador** (glifo por extensión, vínculo a transacción navegable,
    fecha/autor, tamaño, estado) + **drawer** con vista previa placeholder, metadatos y bloque
    "Transacción vinculada".
  - `DocsForTransaction({ kind, id })` · **componente embebible** que filtra el hub por una
    transacción y la muestra con botón "Adjuntar" + "Ver en hub". `window.DocsForTransaction`.

**Archivos viejos modificados:**
- `DTD Studio · ERP.html` · `<script>` documentos-data + documentos-hub (override, después de flujo-trabajo).
- `erp/modules/shipments.jsx` · `ShipmentDetail` · la sección DOCUMENTOS ahora usa
  `window.DocsForTransaction kind="embarque"` (fallback a la lista vieja si no está cargado).
- `nuevo/modules/tesoreria.jsx` · `PayableDrawer` · embebido `DocsForTransaction kind="pago"`
  (las remesas USDT/CNY muestran su comprobante adjunto).

**Brand-check:** transversal (no dentro de Contabilidad). Solo tokens + ERPUI + íconos del set. Sin AI slop.

**Pendiente (backend):** subida real de archivos (drag&drop), preview real (PDF/imagen), OCR/auto-clasificación,
versionado, permisos por carpeta, vincular un doc suelto a una transacción desde el drawer.

**Replicado (mismo embed):** `erp/modules/clients.jsx` (`ClientDetail`, `kind="cliente"`) muestra RIF, registro
mercantil, contratos y permisos del cliente; `erp/modules/invoices.jsx` (drawer de detalle, `kind="factura"`)
muestra la factura emitida, comprobante de cobro y retención. Ahora embarque, CxP, cliente y factura tienen su sección de adjuntos.

---

## 2026-05-31 · Flujo de trabajo · "Workflow view" (Inicio por rol + tab en Contabilidad)

Inspirado en el "Map/Workflow view" de QuickBooks pero con **diseño propio DTD** (sin copiar su
look): un mapa de proceso con carriles de nodos conectados por flechas, cada nodo clickeable
(atajo al módulo) y con badge en vivo de pendientes. Reutilizable en dos lugares.

**Archivo nuevo en `nuevo/`:**
- `nuevo/modules/flujo-trabajo.jsx`:
  - `LANES()` · 6 carriles con visibilidad por rol y badges en vivo (leads nuevos, CxP abiertas,
    pagos por vencer, consolidando, embarques en aduana, asientos borrador, conversaciones,
    reclamos) leídos defensivamente de los demás módulos:
    **Venta · Dinero que entra · Operación · Dinero que sale · Cierre & reportes · Servicio.**
  - `WorkflowMap` · componente reutilizable (carril = etiqueta + fila de nodos con conectores).
  - `financeLanes()` · subconjunto (entra/sale/cierre) para Contabilidad.
  - `ModuleInicio` · **pantalla de bienvenida** que saluda al usuario y muestra solo los carriles
    de su rol ("¿Qué querés hacer hoy?"). Es ahora el **landing por defecto** del ERP.

**Archivos viejos modificados:**
- `erp/icons.jsx` · nuevo icono `flow` (nodos conectados, estilo del set).
- `erp/shell.jsx` · MODULES · nuevo grupo **INICIO** al tope con `inicio` (icono `flow`).
- `erp/data.jsx` · `ROLE_MODULES` · agregado `inicio` a todos los roles + se sumaron los módulos
  nuevos a los roles relevantes (Comercial→conversaciones/fidelizacion; Operaciones/Almacén CN→naviera;
  Contabilidad→tesoreria; Soporte→conversaciones) para que el flujo navegue correcto.
- `DTD Studio · ERP.html` · `<script>` flujo-trabajo.jsx (último) + `inicio: window.ModuleInicio` al
  moduleMap + `activeMod` inicial `'inicio'` (landing).
- `nuevo/modules/contabilidad.jsx` · nuevo tab **"Flujo de trabajo"** (primero y default) que renderiza
  `WorkflowMap` con los carriles financieros + intro.

**Brand-check:** diseño original (no clon de QuickBooks). Solo tokens + ERPUI + íconos del set + fuentes del sistema. Sin AI slop.

**Pulido (v1.9.1):** nodos sin pendientes en gris neutro / con pendientes en el tono del carril + badge (estilo activo/inactivo, menos "arcoíris"); cada carril muestra chip verde **"Al día"** cuando no hay pendientes; banner de resumen en Inicio ("Tenés N tareas en M áreas" / "Todo al día").

**Pendiente (backend):** badges con datos en vivo reales, marcar pasos "al día" (check verde) según estado real, personalizar carriles por usuario.

---

## 2026-05-31 · Dirección · Tablero ejecutivo (cabina del dueño)

Vista consolidada de solo-lectura para el dueño/dirección. No agrega datos nuevos: lee y
cruza lo que ya producen los demás módulos (Contabilidad, Tesorería, Naviera, Fidelización,
Conversaciones, CRM) en una sola pantalla con drill-down a cada área.

**Archivo nuevo en `nuevo/`:**
- `nuevo/modules/direccion.jsx` · módulo único (sin data propia):
  - **KPIs financieros:** ingresos del mes (P&L), utilidad neta + margen, caja consolidada, posición neta (caja+CxC−CxP).
  - **Salud financiera:** CxC / CxP / vencido + barra de cobertura de pagos con caja.
  - **Proyección de salidas 4 semanas** (reusa el forecast de Tesorería).
  - **Operación:** embarques activos + valor en ruta, contenedores consolidando + ocupación media, carga suelta CN, próximo cut-off.
  - **Comercial:** pipeline CRM, referidos activos, mini-distribución por tier.
  - **Servicio:** conversaciones abiertas / sin asignar, reclamos abiertos.
  - **Panel de alertas:** vencidos, reclamos, cut-off próximo, sin asignar, carga suelta → cada una linkea al módulo. Cada tarjeta/stat hace drill-down con `goTo`.
  - Lectura defensiva: helper `safe()` con fallback 0/—, tolera que falte cualquier módulo.

**Archivos viejos modificados:**
- `erp/shell.jsx` · MODULES · nuevo grupo **DIRECCIÓN** al tope con `direccion` (icono `dashboard`).
- `DTD Studio · ERP.html` · `<script>` de direccion.jsx cargado **último** (para que toda la data de los demás módulos exista) + entrada `direccion: window.ModuleDireccion` al moduleMap.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Sin AI slop. Solo-admin por ROLE_MODULES (el grupo no aparece para roles sin el módulo).

**Fix de sistema (root-cause):** se agregó el token faltante `--wine-bg` (= `--wine-tint`, sin color nuevo)
en `erp/tokens.css` light + dark. Todos los tonos semánticos (success/warning/danger/info/neutral) tenían
su `-bg` menos wine; el patrón `var(--${tone}-bg)` con tono wine resolvía a transparente. Completar la
convención corrige el hover/fondo en `direccion`, `tesoreria`, `conversaciones`, el portal y módulos
pre-existentes (despacho/dashboard/tms). El `MiniStat` de direccion además usa `--wine-tint` explícito.

**Pendiente (backend):** datos en vivo (hoy mock cruzado), rango de fechas configurable, export real del resumen a PDF, comparativos mes/mes.

---

## 2026-05-31 · Fidelización & Referidos (ERP + Portal · rama de lealtad)

El tier (Platinum/Gold/Silver/Bronze) estaba hardcodeado en `reports.jsx` y "Referido" existía
solo como fuente de lead — sin motor. Se construyó el sistema completo de lealtad: niveles por
facturación + programa de referidos con créditos, en el ERP (gestión) y el Portal (cliente).

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/fidelizacion-data.jsx` · 4 tiers con umbral por facturación anual y beneficios,
  `tierOf`/`nextTier`/`tierProgress`, reglas del programa (crédito $80 al referidor / $60 al
  referido), 8 referidos seed enlazados a clientes reales, código determinístico `REF-XXXX`,
  agregadores (distribución por tier, top referidores, stats del programa). `window.FidelizacionData`.
- `nuevo/modules/fidelizacion.jsx` · módulo ERP con 4 tabs:
  - **Dashboard:** KPIs (clientes/tier, referidos activos, créditos emitidos, tasa de conversión),
    distribución por nivel, leaderboard de embajadores, "cómo funciona el programa".
  - **Niveles:** las 4 tarjetas de tier con umbral, beneficios y conteo de clientes.
  - **Referidos:** tabla filtrable por estado + drawer con timeline (invitado→registrado→primer
    embarque→acreditado) y montos de recompensa.
  - **Clientes:** tabla loyalty con tier, facturado, barra de progreso al siguiente nivel, créditos y referidos.

**Archivos viejos modificados:**
- `erp/shell.jsx` · MODULES grupo COMERCIAL · agregado `fidelizacion` (icono `star`) tras CRM · Leads.
- `DTD Studio · ERP.html` · `<script>` de fidelizacion-data + fidelizacion; entrada `fidelizacion: window.ModuleFidelizacion` al moduleMap.
- `Portal del Cliente.html` · `<script>` de fidelizacion-data.jsx (reúso de la misma fuente de verdad).
- `portal/app.jsx` · nav **Referidos** (icono `star`) + router + componente `PortalReferidos`:
  código de referido del cliente (copiar + compartir por WhatsApp), tarjeta de créditos
  (acreditados + en camino), nivel actual con beneficios y progreso al siguiente, lista de "tus referidos".

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Tagline oficial en el mensaje de compartir.
Único gradiente permitido (navy→ink) reusado en el hero del portal. Sin AI slop.

**Pendiente (backend):** acreditación real del crédito a factura, generación/validación de códigos,
atribución del referido al registrarse (link código→nuevo cliente), tier recalculado por job nocturno.

---

## 2026-05-31 · Conversaciones · Bandeja unificada (rama de diferenciación → v2)

Rama de diferenciación alineada con la filosofía "construir confianza cliente a cliente":
una bandeja única que junta WhatsApp + email + portal en un solo hilo por cliente. Cubre
también reclamos/incidencias vía el **tipo** de conversación → un solo módulo en vez de dos
solapados (coherente con la recomendación anti-sprawl).

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/conversaciones-data.jsx` · canales (WhatsApp/Email/Portal), tipos
  (consulta/cotización/seguimiento/incidencia/reclamo), estados (abierto/pendiente/resuelto),
  8 conversaciones seed con hilos realistas CN→VE, quick replies. Helpers de conteo
  (abiertas, sin asignar, reclamos). Expuesto en `window.ConversacionesData`.
- `nuevo/modules/conversaciones.jsx` · bandeja de 2 paneles:
  - **Lista** (360px): buscador + filtros de estado (tabs) + canal (chips), tarjetas con
    canal, no-leídos, último mensaje, tipo, Shipping Mark, agente asignado.
  - **Hilo**: header con cliente + badges + links a cliente/embarque + selects de asignación
    y estado; burbujas in/out estilo chat; quick replies desplegables; composer con textarea
    (⌘↵ envía) que agrega la respuesta al hilo en vivo (demo, estado local).
  - KPIs: abiertas, sin asignar, reclamos abiertos, resueltas.

**Archivos viejos modificados:**
- `erp/icons.jsx` · agregado icono `chat` (burbuja, mismo estilo de trazo del set).
- `erp/shell.jsx` · MODULES grupo COMERCIAL · agregado `conversaciones` (icono `chat`, badge 5) tras Clientes.
- `DTD Studio · ERP.html` · `<script>` de conversaciones-data + conversaciones; `conversaciones: window.ModuleConversaciones` al moduleMap.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Tagline oficial usado en el cierre de quick replies. Sin AI slop. (Los emoji 🙏/👍/👍 aparecen dentro de mensajes *del cliente* citados, no en UI de producto.)

**Pendiente (backend):** integración real WhatsApp Business API + IMAP/SMTP + mensajes del portal,
webhooks de entrada, notificaciones push, SLA de tiempo de respuesta, plantillas aprobadas por Meta.

---

## 2026-05-31 · Portal · Reclamos formales (cierra el loop con Conversaciones)

El portal del cliente tenía solo un **chat de Soporte** genérico, sin reclamos formales. Se agregó
una sección **Reclamos** con número de caso, tipo, estado con seguimiento y conversación — la
contraparte cliente del módulo Conversaciones del ERP (tipo reclamo).

**Archivos viejos modificados:**
- `portal/app.jsx`:
  - `PortalTopbar` · nuevo ítem de nav **Reclamos** (icono `shield`) entre Documentos y Soporte.
  - Router · `{view === 'reclamos' && <PortalReclamos />}`.
  - Componentes nuevos: `PortalReclamos` (lista de reclamos del cliente con tipo/estado/embarque +
    botón "Nuevo reclamo"), `NewReclamoForm` (tipo, embarque, asunto, descripción → genera
    REC-2026-XXXX en estado "recibido"), `ReclamoDetail` (línea de tiempo recibido→en revisión→
    resuelto + hilo de conversación + caja de respuesta + bloque de resolución). Tipos: faltante,
    daño, demora, facturación, otro. Seed de 2 reclamos para el cliente demo.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema. Verbos directos ("Enviar reclamo", "Nuevo reclamo"). Sin AI slop.

**Pendiente (backend):** persistencia real del reclamo, ruteo automático al agente/CX en el ERP
(crear conversación tipo reclamo), adjuntar fotos/archivos, notificación al cliente al cambiar de estado.

---

## 2026-05-31 · v1.9.1 · Naviera & Consolidación + consolidación de Portal a v2

> **Versión a lanzar: v1.9.1.** Próximo gran salto → v2. Footer del sidebar y title del ERP bumpeados a v1.9.1.

### Naviera & Consolidación (módulo nuevo · cierra el círculo logístico)

Hasta ahora la naviera no existía como entidad: el flete estaba implícito. Este módulo la
modela y suma el corazón de la operación LCL→FCL.

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/naviera-data.jsx` · navieras (COSCO/Maersk/MSC/Evergreen), puertos CN/VE,
  tipos de contenedor con capacidad útil (CBM/kg), itinerarios (sailings con cut-off),
  bookings (reservas con BL marítimo), contenedores con items consolidados, carga suelta
  en CN. Helpers `containerStats` (utilización CBM/peso), `openSailings`, `consolidating`.
  Expuesto en `window.NavieraData`.
- `nuevo/modules/naviera.jsx` · 4 tabs:
  - **Dashboard:** KPIs (salidas con espacio, contenedores consolidando, carga suelta,
    próximo cut-off), barras de ocupación de cada contenedor, próximas salidas, carga suelta CN.
  - **Itinerarios:** tabla de sailings filtrable por naviera (ruta, ETD, cut-off, tránsito, espacio).
  - **Reservas:** bookings con BL marítimo + drawer con mapa de ruta POL→POD, embarques vinculados.
  - **Consolidación:** master-detail · selector de contenedor + ocupación CBM/peso con barras,
    tabla de carga consolidada por cliente (Shipping Mark, proveedor, piezas, CBM, % del contenedor),
    hint de CBM libre antes del cut-off. **El núcleo LCL→FCL.**

**Archivos viejos modificados:**
- `erp/shell.jsx` · MODULES grupo OPERACIÓN · agregado `naviera` (icono `ship`) tras Tracking. Footer v1.9 → v1.9.1.
- `DTD Studio · ERP.html` · `<script>` de naviera-data + naviera; `naviera: window.ModuleNaviera` al moduleMap; title → v1.9.1.

### Consolidación Portal + Registro a v2 (limpieza)

Se eliminó la versión vieja del Portal del Cliente y del Registro de cliente; nos quedamos
solo con v2, renombrada a los nombres canónicos.

- **Borrados:** `portal/app.jsx` (v1), `portal/registro.jsx` (v1), `Portal del Cliente.html` (v1), `Registro Cliente.html` (v1).
- **Renombrados (v2 → canónico):** `portal/app-v2.jsx`→`portal/app.jsx` · `portal/registro-v2.jsx`→`portal/registro.jsx` · `Portal del Cliente · V2.html`→`Portal del Cliente.html` · `Registro de cliente · V2.html`→`Registro Cliente.html`.
- **Referencias actualizadas:** `src` internos de ambos HTML, link "Ir al portal" en `registro.jsx`, constante `PORTAL` en `Modo Cliente.html`, titles. Los docs/CLAUDE.md ya apuntaban a los nombres canónicos → quedaron correctos.

**Brand-check:** solo tokens + ERPUI + fuentes del sistema (Noto Sans SC para nombres CN). Sin AI slop.

### Reorganización del sidebar (recomendación #3 · menos sprawl)

El sidebar tenía ~32 ítems planos con clusters solapados. Se introdujo **un nivel de anidación**
(parent → hijos expandibles) sin tocar el routing ni los módulos: los hijos siguen siendo módulos
normales, solo cambia su presentación.

- **Nuevos sub-grupos** (`PARENTS` en `erp/shell.jsx`):
  - **Almacenes** (icono warehouse) ← Almacén CN, Cola de QR, Etiquetas CN, Almacén VE
  - **Despacho** (icono truck) ← Despacho, Reglas, Métricas
  - **Contable** (icono invoice) ← Contabilidad, Tesorería, Conciliación, Costing & margen
- OPERACIÓN baja de 14 a 9 filas visibles; FINANZAS de 8 a 5. El resto quedó plano.
- Comportamiento: el parent se expande al click; si un hijo está activo, el parent se fuerza
  abierto (el ítem activo siempre visible). Estado de expansión persistido en `localStorage`
  (`dtd-sidebar-groups`, claves `__p_<id>`). En modo colapsado (sólo iconos) los hijos se
  muestran planos. El ⌘K command palette sigue navegando directo a cualquier módulo.

**Archivos modificados:** `erp/shell.jsx` · MODULES (campo `parent` en 11 ítems) + const `PARENTS`
+ `grouped` useMemo (produce unidades leaf/parent) + helpers `renderLeaf`/`renderParent` + render del nav.

**Pendiente (backend):** scraping real de itinerarios de naviera, emisión real de BL, algoritmo de
optimización de consolidación (bin-packing), asignación drag&drop de carga suelta a contenedor.

---

## 2026-05-31 · Tesorería · Pagos a proveedores CN (módulo nuevo)

Cierra el círculo financiero: hasta ahora el ERP modelaba lo que se **cobra** (CxC,
conciliación, contabilidad) pero no lo que se **paga**. Tesorería suma la otra mitad
del libro: caja multi-moneda + cuentas por pagar + remesas a China.

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/tesoreria-data.jsx` · cuentas de caja multi-moneda (USD/VES/USDT/CNY),
  beneficiarios (proveedores CN, navieras, agente aduanal, transporte, servicios),
  CxP con pipeline de estados, órdenes de pago/remesas, helpers (posición de caja por
  moneda, proyección de salidas 4 semanas, vencidos, próximos). Formatter `fmtCny` +
  conversiones `usdToCny`/`cnyToUsd`. Expuesto en `window.TesoreriaData`.
- `nuevo/modules/tesoreria.jsx` · módulo con 4 tabs:
  - **Dashboard:** KPIs (caja total, por pagar, vencido, vence en 7d), posición de caja
    por moneda, CxP por beneficiario, proyección de salidas a 4 semanas (bar chart),
    acciones rápidas, próximos vencimientos.
  - **Cuentas por pagar:** tabla filtrable (tipo/estado/búsqueda) con drawer de detalle
    + "Programar pago" inline (cuenta origen, método, monto, fecha) y link a proveedor/embarque.
  - **Pagos & remesas:** órdenes de pago ejecutadas con método (Wire USD, USDT, Alipay CNY,
    Transfer VES), drawer de comprobante.
  - **Cuentas:** tarjetas de cada cuenta de caja con saldo en USD + moneda original.

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · MODULES, grupo FINANZAS · agregado ítem `tesoreria` (icono `cn`) entre Contabilidad y Conciliación.
- `DTD Studio · ERP.html` · agregados `<script>` de `tesoreria-data.jsx` + `tesoreria.jsx` (después de contabilidad) y entrada `tesoreria: window.ModuleTesoreria` al `moduleMap`.

**Brand-check:** solo tokens CSS, componentes ERPUI, fuentes del sistema (Archivo + JetBrains Mono;
Noto Sans SC vía `var(--f-cn)` para nombres de proveedores en chino). Sin AI slop. Reusa `ERPRates` para tasas BCV/CNY.

**Pendiente (necesita backend):** ejecución real de wire/USDT, aprobación multi-firma, generación
automática del asiento contable de salida, conciliación con los movimientos bancarios reales.

---

## 2026-05-31 · v1.9.2 · Pulido completo (mailing, persistencia, drag, skeletons, TMS)

Continuación. Completados los pendientes de pulido (#3) y persistencia (#6) que NO necesitan backend.

**Mailing · adjuntos + cola de programados:**
- `erp/modules/mailing-compose.jsx` · adjuntos ahora se guardan en estado (`attachments`), se muestran como chips removibles, badge con contador en el botón Adjuntar. "Programar" pushea a `window.__scheduledEmails` (con evento `dtd-scheduled-changed`) + pantalla de confirmación.
- `erp/modules/mailing.jsx` · nueva pestaña **Programados** (count en vivo).
- `nuevo/modules/mailing-scheduled.jsx` (NUEVO) · `window.MailingScheduled`: cola con KPIs, cancelar / "Enviar ya", estados (en cola / enviado). Cargado en `DTD Studio · ERP.html`.

**Persistencia de perfil / preferencias:**
- `nuevo/modules/wiring.jsx` · ProfileModal: "Guardar cambios" ahora actualiza `window.__currentUser` + `D.USERS` + `localStorage('dtd_user_override_{id}')` + evento `dtd-user-updated`. Tab Preferencias: idioma/densidad/notificaciones controlados + persistidos en `localStorage('dtd_prefs')`.
- `DTD Studio · ERP.html` · al iniciar aplica los overrides guardados a USERS; escucha `dtd-user-updated` para re-renderizar con el perfil actualizado.

**Pulido visual:**
- `erp/components.jsx` · `useFirstLoad(key, ms)` (skeleton solo la 1ª vez por sesión, no ralentiza navegaciones repetidas).
- `erp/modules/shipments.jsx` + `erp/modules/invoices.jsx` · skeleton (`LoadingRows`) en la primera carga de la tabla.
- `erp/modules/despacho.jsx` · drag de reordenamiento animado: fila arrastrada se levanta (scale + `--shadow-pop`), la fila destino hace lugar (translateY), transición spring.

**TMS · editor de incidencias (antes read-only):**
- `erp/modules/tms.jsx` · `IncidentsTab` ahora editable: botón "Registrar incidencia", filas clickeables, nuevo `IncidentEditor` (Drawer) con tipo/severidad/camión/fecha/descripción/costo/estado. Store en `window.__tmsIncidents`. Crear / editar / eliminar.

**⚠️ Servicios externos (#8) — NO se pueden hacer en mock:** geocoding real, push notifications, WhatsApp API del CRM, OAuth callbacks reales → requieren backend + cuentas externas. La UI/stub ya existe; Claude Code los conecta.

---

## 2026-05-31 · v1.9.1 · Pulido: HideValues global + OAuth completa

Continuación de v1.9. Avance en pendientes de Email (#2) y Pulido (#3).

**HideValues (👁) global y reactivo:**
- `erp/components.jsx` · nuevo en ERPUI: `useHideValues()` (hook reactivo), `setHideValues(v)` (setter que persiste en `dtd_dashboard_hide` + dispara evento `dtd-hide-values`), `getHideValues()`, `maskVal()`. El flag ahora es global y vive entre módulos.
- `nuevo/modules/dashboard.jsx` · el ojo ahora usa `U.setHideValues`/`U.useHideValues` (antes era estado local) → al togglear, las tablas reaccionan en vivo.
- `erp/modules/shipments.jsx` · columna "Valor" enmascara (`•••`) cuando hideValues activo.
- `erp/modules/invoices.jsx` · columnas "Monto" y "Saldo" enmascaran cuando hideValues activo.

**OAuth SMTP · callback completa (mock persistente):**
- `nuevo/modules/wiring.jsx` · al llegar al paso 3 del OAuth, ahora configura el proveedor de verdad: `SMTP_PROVIDERS[provider]` → `configured:true, active:true, account` = email del usuario actual. Antes solo mostraba el mensaje de éxito sin persistir.

**Sigue pendiente en #2/#3 (no bloqueante):** envío SMTP real (necesita backend), skeletons de carga, drag&drop animado en Despacho, cola "Programados" en Mailing, persistencia de adjuntos en draft.

---

## 2026-05-31 · v1.9 · 5 pantallas nuevas + wiring al ERP

Sesión Claude Design. Construcción de las 5 visuales que faltaban (perfil de usuario, Tu día, Modo cliente, hilo de comentario, AI Copilot) + cableado de entradas en el ERP.

**Archivos nuevos en `nuevo/pantallas/`:**
- `usuario-perfil.html` + `usuario-perfil.jsx` + `usuario-perfil-data.jsx` — Perfil de usuario interno. Hero con presencia (online/away/offline), asignados por rol, actividad reciente (timeline), contacto corporativo (líneas por depto. con los teléfonos reales del cliente), acceso por rol (deriva de ROLE_MODULES), notas, acciones admin. Selector entre los 8 USERS. Param `?id=u-00X`.
- `tu-dia.html` + `tu-dia.jsx` — Bandeja personal cross-módulo, **consciente del rol**. Genera tareas desde datos reales (SHIPMENTS por estado, INVOICES vencidas, QUOTES del agente, NOTIFS) agrupadas y priorizadas. Check para marcar hecho + progreso. Rail: resumen, agenda, accesos rápidos por rol. Param `?id=u-00X`.
- `hilo-comentario.html` + `hilo-comentario.jsx` — Vista expandida de un hilo: contexto del registro, comentario raíz prominente, **respuestas anidadas con líneas conectoras**, @menciones resaltadas, reacciones interactivas, composer, rail con info + participantes (linkeados a usuario-perfil). Param `?t=t-472816|t-0418`.
- `copilot.html` + `copilot.jsx` — AI Copilot conversacional. Usa `window.claude.complete` (claude-haiku-4-5) con un snapshot compacto de SHIPMENTS/INVOICES/CLIENTS/QUOTES como contexto para fundamentar respuestas. Sugerencias, typing indicator, mini-markdown, aviso de verificación.

**Archivo nuevo en raíz:**
- `Modo Cliente.html` — Barra de impersonación admin (navy + wine) sobre un iframe del Portal del Cliente V2 real. Selector de cliente + "Salir del modo". Param `?as=DTD-XXXX`.

**Archivos viejos modificados (wiring · línea + razón):**
- `portal/app-v2.jsx` · ~8 · soporte `?as=DTD-XXXX` (impersonación): DEMO_MARKBOX lee el param; `logged` inicia en true cuando hay `?as=` (salta login). Sin el param, el portal funciona idéntico.
- `erp/shell.jsx` · ~305 (Topbar) · botones nuevos **Tu día** + **AI Copilot** (abren las pantallas en pestaña nueva). · ~445 (user menu) · ítems **Ver mi perfil completo** + **Modo cliente** (admin).
- `erp/modules/users.jsx` · ~136 · `onRowClick` en la tabla → abre `usuario-perfil.html?id={u.id}`.
- `erp/modules/comments.jsx` · ~120 · link **Expandir hilo** en el header → abre `hilo-comentario.html?t={mapeado}`.

**Notas para Claude Code:**
- Las 5 pantallas son standalone (review-friendly) y se abren con `window.open(..., '_blank')`. Al consolidar, evaluar montarlas como drawers/rutas dentro del ERP en vez de pestañas.
- USER_PROFILES (usuario-perfil-data.jsx) y THREADS (hilo-comentario.jsx) son mock local — al consolidar mover a `erp/data.jsx` y exponer en `window.ERPData`.
- El Copilot corre bajo la cuota del visor (haiku, 1024 tokens out). Para producción, conectar al backend con el modelo/quota propios.

---

## 2026-05-31 · v1.8 · Config de columnas reutilizable + fix render global + permisos por rol

Sesión Claude Design. Tres frentes: branding (Logo Oficial), UX de tablas (gestor de columnas), y un bug crítico de renderizado.

**Archivos viejos modificados (línea + razón):**
- `erp/components.jsx` · ~626 · **NUEVO en ERPUI**: `useColumns(storageKey, defaultCfg)` (hook que persiste orden+visibilidad por tabla en localStorage), `applyColumns(columns, cfg)` (proyecta cfg sobre definición de columnas), `ColumnManager` (dropdown ▲▼ + checkboxes + Restablecer). Componente reutilizable, respeta tokens.
- `erp/modules/ve.jsx` · gestor de columnas aplicado · default oculta ID interno, lleva "Recibido" (fecha) al frente. `notes={{ id: 'dato interno' }}`.
- `erp/modules/shipments.jsx` · `SHIP_COLS_DEFAULT` + ColumnManager en toolbar (junto a Exportar CSV).
- `erp/modules/invoices.jsx` · `INV_COLS_DEFAULT` + ColumnManager.
- `erp/modules/clients.jsx` · `CLI_COLS_DEFAULT` + ColumnManager (columna de acción `_action` queda fija fuera del gestor).
- `erp/modules/documents.jsx` · `DOC_COLS_DEFAULT` + ColumnManager (columna `_a` fija).
- `erp/data.jsx` · ~199 · **ROLE_MODULES completado**: Comercial +suppliers; Operaciones +qrqueue/labels/despacho/despacho-rules/despacho-dashboard/seniat/tms/operarios; Contabilidad +contab/reconcile/costing; Almacén CN +qrqueue/labels; Almacén VE +despacho/tracking. Roles ahora ven los módulos que les construimos.
- `nuevo/feature-flags.jsx` · ~75 · **fix referencia rota**: `MODULE_FLAG_MAP` tenía clave `auditlog` pero el nav usa `audit-log` (con guion). El flag `audit_log` nunca aplicaba. Corregido.
- `DTD Studio · ERP.html` · ~38 · **FIX CRÍTICO de render**: la animación de entrada `.erp-route` (`@keyframes erp-route-in`, fade opacity 0→1) se congelaba en `opacity:0` en algunos entornos → TODO el contenido de cada módulo quedaba invisible aunque estaba en el DOM. Reescrita para animar solo `translateY` (sin opacity) con `fill-mode: both`. Contenido siempre visible. Mismo fix aplicado a `Portal del Cliente.html` y `Portal del Cliente · V2.html`.
- `erp/shell.jsx` · ~61 · footer "ERP · v1.0" → "ERP · v1.8" (estaba desactualizado vs CHANGELOG).
- `DTD Studio · ERP.html` · ~5 · title → v1.8.

**Branding (Logo Oficial.html):**
- Carrusel reestructurado en 2 grupos: **A · Logo completo** (4 variantes, isólogo + wordmark) y **B · Solo isólogo** (3 variantes, sin wordmark). El wordmark "DTD Cargo" se oculta cuando es solo isólogo.
- Descarga consistente: logo completo se **renderiza a canvas** (isólogo + wordmark Archivo Black, colores por variante, ~2388×1017 para imprenta) → `DTDCargo-Logo-{Variante}.png`. Solo isólogo → `DTDCargo-SoloIsologo-{Variante}.png`.
- Botones de descarga por variante en las cards de "regla de contraste" (solo las válidas).

**Portal / Registro (registro-v2.jsx, app.jsx):**
- Guía "Nomenclatura · cómo funciona" reescrita: diagrama del código, explicación de código-de-proveedor + compra correlativa, formato de etiqueta (sin numeración manual de cajas).
- Caja de acceso (Usuario/Contraseña Shipping Mark) y botón "Ir al portal" → verde (`var(--success)`), por pedido de revisión.

**Operario CN (operario/app.jsx):**
- Botón "Imprimir códigos QR": subtítulos aclarados (elegir cliente → cola de impresión local u oficina).
- Botón "🖨 Imprimir códigos QR" agregado dentro del seguimiento (TrackSheet) → cierra seguimiento y abre menú de impresión.

**Notas:**
- El gestor de columnas guarda por navegador (localStorage, keys `dtd-{modulo}-cols-v1`). Listo para multi-tenant: cada cliente futuro ajusta sus columnas sin tocar código.
- El fix de `.erp-route` es importante para Claude Code: no reintroducir fade de opacity en animaciones de entrada de contenedores que puedan quedar montados sin reflow.

---

## 2026-05-25 · 🌅 RESUMEN DEL DÍA · sesión Claude Design

En una sola sesión de diseño se cerraron 4 releases:

| Release | Qué hace | Archivos |
|---|---|---|
| **v1.4** | Generador de etiquetas PDF bilingüe ES/中文 para suppliers CN (Shipping Mark + Box X/Y + QR mock + 4 formatos de papel + print stylesheet) | `nuevo/modules/label-generator.jsx` |
| **v1.4.1** | Control "Etiquetas por caja" (×1 a ×4) para trazabilidad redundante | `label-generator.jsx` |
| **v1.5** | **CRÍTICO**: validación Shipping Mark server-side (`validateMarkboxFormat`/`isMarkboxUnique`/`nextMarkbox`) + email bienvenida real (template m-05 → log al bridge + audit) + 2 cross-links nuevos en drawer Cliente (Estado de cuenta / Etiquetas) + storage listener en Cola QR para refresh real-time | `data-bridge.jsx`, `clients.jsx`, `qr-queue.jsx`, `portal/registro.jsx` |
| **v1.6** | 9 conexiones rotas wireadas en un módulo único `wiring.jsx`: Adjuntar archivo · Programar envío · Mi perfil · Cambiar contraseña · Atajos de teclado · Generar BL · OAuth Google/Microsoft · HS/AES sync persistente · Actividad reciente Dashboard clickeable · Mailing Logs leyendo bridge | `wiring.jsx`, `mailing-compose.jsx`, `documents.jsx`, `mailing-config.jsx`, `shell.jsx`, `admin.jsx`, `dashboard.jsx`, `mailing-logs.jsx` |

**Pendientes para próxima sesión** (ver detalle al final de este CHANGELOG):
- Adjuntar archivo: persistir lista en el draft del Compose
- Programar envío: cola visible en Mailing → Logs (hoy solo cierra modal)
- ProfileModal: persistencia real al user
- OAuthFlow: actualizar `provider.account` del SMTP_PROVIDERS al completar
- Mover seed `WAREHOUSES_CN` de `label-generator.jsx` a `erp/data.jsx`
- Pulido visual (drag&drop animado Despacho V1, skeletons consistentes, hideValues a tablas, multi-tenant real, etc.)

---

## 2026-05-25 · v1.6 · Conexiones rotas reparadas (sprint quick)

Sprint de 9 conexiones rotas que existían visuales pero no funcionales.

### Archivos nuevos en `nuevo/`

- **`nuevo/modules/wiring.jsx`** — Módulo único que expone modals globales en `window.DTDWiring`:
  - `openAttachModal({ onSelect })` — drag-and-drop + file input multi-file con preview de archivos seleccionados, soporte para PDF/DOCX/XLSX/imágenes hasta 25 MB, quitar individual.
  - `openScheduleModal({ onSchedule })` — date/time picker con 3 atajos (En 1 hora · Mañana 9:00 · Lunes 9:00) + selector de zona horaria (Caracas/Shanghai/NY/Madrid) + nota explicativa.
  - `openProfileModal({ tab })` — modal de "Mi perfil" con 3 tabs: Datos personales (nombre/email/teléfono + avatar) · Contraseña (validación 12+ chars + confirmación + feedback) · Preferencias (idioma/densidad/notificaciones).
  - `openShortcutsModal()` — 2-col grid con 5 grupos de atajos (Navegación, Acciones, Embarques, Email/Compose, General) y kbd visuales.
  - `openGenerateBLModal()` — flow de generación de Bill of Lading: 2 pasos (selección embarque + tipo BL Original/Copy/SWB) → vista preview con número generado `DTDU{N}-{OR|CP|SW}` + acciones Descargar/Enviar al cliente.
  - `openOAuthFlow(provider)` — flow mock de OAuth en 3 pasos (redirección → autorizando con spinner → conectado) para `gmail` o `outlook`.
  - Patrón singleton: un solo `<MountHost />` en el `<App>` que renderiza el modal activo. Cada `show()` lo pisa.

### Archivos viejos modificados

- **`DTD Studio · ERP.html`** · línea ~107 · `<script type="text/babel" src="nuevo/modules/wiring.jsx">` · línea ~287 · `<window.DTDWiring.MountHost />` junto a QuickEmailModal.
- **`erp/modules/mailing-compose.jsx`** · línea ~141-142 · wireados onClick de "Programar" → `openScheduleModal` y "Adjuntar" → `openAttachModal`.
- **`erp/modules/documents.jsx`** · línea ~62 · wireado onClick de "Generar BL" → `openGenerateBLModal`.
- **`erp/modules/mailing-config.jsx`** · línea ~148 · wireado onClick de "Conectar con Google/Microsoft" → `openOAuthFlow(p.id)`.
- **`erp/shell.jsx`** · línea ~400 · reemplazado array de strings por array de objetos con `action` para cada ítem del user menu (Mi perfil/Cambiar contraseña/Preferencias/Atajos) abriendo el ProfileModal o ShortcutsModal con el tab correcto. Línea ~436 · "Cerrar sesión" ahora tiene confirm + reload.
- **`erp/modules/admin.jsx`** · líneas ~1226-1240 · `CodesSyncHeader` ahora persiste `lastSync` en `localStorage` (key `dtd_codes_lastsync_${source}`) y muestra "ÚLTIMA / PRÓXIMA SYNC" con timestamp relativo (`recién` / `hace N min` / `hace N h` / `hace N d`) actualizado cada 30s. Antes solo flippeaba el spinner sin persistencia.
- **`erp/modules/dashboard.jsx`** + **`nuevo/modules/dashboard.jsx`** (override) · `RecentActivityWidget` ahora recibe `goTo` y cada notificación es un button clickeable que navega al módulo según el tipo (tracking/sales/finance/alert/crm/warehouse → tracking/quotes/invoices/tracking/leads/cn) con hover state.
- **`erp/modules/mailing-logs.jsx`** · línea ~5 · ahora suscribe al store `window.DTDData.emailsSent` del bridge y mergea esos logs con los seed mock. Los emails de bienvenida disparados desde `portal/registro.jsx` aparecen al tope con `recién` / `hace N min`. Re-render automático via `useEffect`.

### Notas

- El icon set no tiene `download`/`mail`/`upload` mejorados — usé los existentes (`upload`/`mail`/`doc`/`clock`/`link`/`shield`/`check`/`info`/`refresh`).
- `OAuthFlow` usa `setTimeout` de 1.8s para simular el callback OAuth. En prod real va a ser un popup `window.open` al endpoint del proveedor con redirect URI.
- El BL generado tiene formato `DTDU{7-dígitos}-{tipo}` siguiendo la convención `DTDU-XXXXXX` del HANDOFF (campo `id` del shipment se sanitiza a dígitos). Mock — el PDF real necesita un generador server-side.
- ProfileModal está auto-contenido — el "Cambiar avatar", "Notificaciones por email" y demás controles son placeholders visuales sin persistencia. Listo para wirearse a un endpoint cuando se conecte el backend.
- `lastSync` de HS/AES se persiste por separado (key incluye `source`) para que el contador no se mezcle entre la tab HS y la tab AES.

### TODOs pendientes

- Wirear el `onSelect` del AttachModal en mailing-compose para mostrar la lista de adjuntos en el draft.
- Wirear el `onSchedule` para que el envío programado quede en una cola visible en Mailing → Logs (hoy solo cierra modal + setSentOk).
- ProfileModal: persistir cambios al user (hoy solo muestra "Guardado" toast).
- OAuthFlow: actualizar el `provider.account` del SMTP_PROVIDERS al completar.

---

## 2026-05-25 · v1.5 · Críticos + quick wins · conexiones reparadas

Cuatro mejoras de wiring en una sola pasada después de v1.4.1:

### 1 · Drawer Cliente · cross-links nuevos (quick win #11+#12)

Agregado en `erp/modules/clients.jsx` (línea ~131, `actions` del drawer detalle) dos botones `ghost` antes de "Email":
- **Estado de cuenta** → `window.open('nuevo/pantallas/estado-cuenta.html?id=${markbox}', '_blank')` (abre la vista detallada en una pestaña nueva)
- **Etiquetas** → `goTo('labels', markbox)` (cambia al módulo Etiquetas CN con el cliente preseleccionado · approvecha que `ModuleLabelGenerator` ya lee `selectedId`)

### 2 · Cola QR · listener real-time (quick win #10)

En `nuevo/modules/qr-queue.jsx` (hook `useQrOrders`) agregado segundo `useEffect` que escucha el evento `storage` del navegador. Cuando otro tab (la app Operario CN) escribe al key `dtd_qrqueue_v1`, el ERP detecta el cambio y re-lee el state automáticamente — sin refresh manual. El evento `storage` no dispara en el tab que escribió, así que no genera loops con el `useEffect` de persistencia.

### 3 · Shipping Mark · validación server-side (crítico #2)

Agregado en `erp/data-bridge.jsx` (window.DTDData):
- `MARKBOX_REGEX = /^DTD-\d{4,5}$/` — formato oficial (4 o 5 dígitos)
- `validateMarkboxFormat(code)` — boolean
- `allKnownMarkboxes()` — Set con codes del bridge + seed `ERPData.CLIENTS`
- `isMarkboxUnique(code)` — boolean (valida formato + no existe ya)
- `nextMarkbox()` — genera secuencial defensivo: encuentra max de todos los conocidos, prueba +1 con retry de hasta 10 candidatos si alguno colisiona (race condition). Fallback a `max+1` solo en caso extremo.

Wireado en `portal/registro.jsx` `submit()` (línea ~52): reemplazado el código inline de generación por `window.DTDData.nextMarkbox()` con doble check de formato. Si el bridge no está disponible, fallback al random anterior.

### 4 · Email de bienvenida real (crítico #3)

Agregado en `erp/data-bridge.jsx`:
- Store `emailsSent` (key `dtd-emails-sent`)
- `renderTemplate(body, vars)` — substituye `{{var}}` por valores
- `sendWelcomeEmail(client)`:
  - Lee template **m-05 'Bienvenida Shipping Mark'** de `window.ERPData.MAIL_TEMPLATES`
  - Substituye `{{client_name}}`, `{{markbox}}`, `{{portal_link}}` (este último: `https://portal.dtdcargo.com/{markbox.lower}`)
  - Pushea entrada `{id, to, toName, template, templateName, subject, body, sentAt, status: 'sent', markbox, channel: 'email'}` al log
  - Pushea entrada `auto` al audit log (`dtd_audit_log_v1` localStorage)
  - Cap del log a 500 entradas para no crecer infinito

Wireado en `portal/registro.jsx` `submit()`: después de persistir el cliente, llama `window.DTDData.sendWelcomeEmail(newClient)`. Setea `emailSent` state.

UI en `StepSuccess`: la card de "te enviamos un email" ahora cambia visualmente según `emailSent`:
- **Éxito** → fondo `var(--success-bg)`, border verde, icon check, texto "Email enviado a {email} … Revisá la bandeja de entrada o spam."
- **Pendiente** → fondo neutro, icon mail, texto "Te enviaremos un email a …"

Sacado el emoji 📨 (brand-check: prohibido emoji decorativo en UI de producto).

### Archivos viejos modificados

- `erp/modules/clients.jsx` · línea ~131 · agregados 2 botones cross-link al drawer detalle
- `nuevo/modules/qr-queue.jsx` · línea ~34 · agregado `useEffect` con `storage` listener
- `erp/data-bridge.jsx` · línea ~60 · agregado store `emailsSent`, helpers Shipping Mark, helper sendWelcomeEmail, expuestos en `window.DTDData`
- `portal/registro.jsx` · líneas ~42 (state) + ~52 (submit) + ~110 (render) + ~410 (StepSuccess email card) · usa nextMarkbox() + sendWelcomeEmail() + UI con feedback de envío

### Quick win descartado

**#9 Bell de notificaciones** estaba marcado como "no clickeable" en HANDOFF.md, pero verificado en `erp/shell.jsx` línea ~317 ya tiene `onClick={() => setNotifOpen(v => !v)}` con dropdown completo poblado por `notifications` prop (que recibe `ERPData.NOTIFS` desde `DTD Studio · ERP.html` línea ~244). Sin trabajo necesario.

### TODOs pendientes para próximas sesiones

- Mostrar los emails de `emailsSent` en el módulo Mailing → Logs (hoy solo se persisten en localStorage, el módulo Logs sigue mostrando data mock hardcodeada).
- Validar Shipping Mark format en el form mismo (Step1 muestra el campo cédula/RIF, pero el Shipping Mark no se ingresa — se genera. Si en algún momento el admin quiere asignar uno manual, el `validateMarkboxFormat` está listo).
- Mover los seed `WAREHOUSES_CN` de `nuevo/modules/label-generator.jsx` a `erp/data.jsx` al consolidar v1.5.

---

## 2026-05-25 · v1.4.1 · Etiquetas CN · copias por caja (1-4)

**Cambio en `nuevo/modules/label-generator.jsx`:**
- Agregado control "Etiquetas por caja" (×1 / ×2 / ×3 / ×4) en la card "CAJAS · BOX X/Y". Default: ×2 (recomendado).
- El generador ahora duplica la misma etiqueta N veces consecutivas. Las copias son **idénticas** (mismo Shipping Mark, mismo Box X/Y, mismo QR) — no se marcan como "copia 1 de 3" porque las cajas se descargan en orden arbitrario.
- **Razón operativa:** durante la descarga del contenedor en VE, una sola etiqueta por caja se puede tapar con otra caja, romperse al manipular o mancharse. Pegando 2-4 copias en distintas caras de la misma caja se garantiza la trazabilidad.
- Helper `boxesInRange` calculado aparte para mostrar el desglose "N cajas × M copias = X etiquetas".
- El resumen del preview ahora muestra una segunda línea con "N cajas × M copias".
- El mensaje al supplier (modal ES/中文) menciona el conteo: "${totalLabels} etiquetas para ${totalBoxes} cajas (${copiesPerBox} etiquetas por caja, pegá una en cada cara…)".
- Fix técnico: la key del `.map` en Sheet ahora usa `${pageIndex}-${labelIndex}` en vez del boxIndex (que ya no es único). `totalBoxes` se pasa como prop a Sheet en vez de inferirse de `labels.length`.

**Archivos viejos modificados:** ninguno.

---

## 2026-05-25 · v1.4 · Generador de etiquetas PDF para suppliers CN

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/label-generator.jsx` — Nuevo módulo `window.ModuleLabelGenerator`. Genera planchas PDF bilingües ES / 中文 para que el cliente (o el admin) las mande al supplier chino antes del despacho a almacén CN.

**Estructura del módulo:**
- Layout 2 columnas: panel config (360px sticky) + preview escalado a tamaño real (mm).
- **Config panel:**
  - Cliente: selector de `D.CLIENTS` · muestra card wine con Shipping Mark grande, nombre, empresa.
  - Supplier (opcional): selector de `D.SUPPLIERS` · al elegir, auto-sugiere almacén CN destino según ciudad del supplier (Yiwu→YIW-A1, Guangzhou/Shanghai→GZ-B2, Shenzhen→SZ-C1).
  - Almacén CN destino: dropdown de 3 hubs (YIW-A1, GZ-B2, SZ-C1) — editable.
  - Cajas: Box inicial (X) + Total cajas (Y) con preview de rango "X/Y hasta Y/Y".
  - Formato de papel: 4 opciones (A4 8-up, A4 4-up, térmico 100×150, térmico 100×100) — cada una con cards seleccionables wine.
  - Toggle "Incluir código QR".
  - Aviso info sobre cómo guardar como PDF desde el diálogo de impresión.
- **Preview:**
  - Header con conteo de etiquetas + páginas + badge del formato seleccionado.
  - Sheet escalado en `mm` reales (CSS `width: ${w}mm; height: ${h}mm`) con grid del layout exacto del formato, sombra para simular papel, paginación visual.
  - Scroll vertical contenido en card `bg-elevated`.

**Diseño de la etiqueta (componente Label):**
- Border navy 1.2px, padding adaptativo según tamaño (compacto vs full).
- Header bilingüe: "SHIPPING TO · DTD-CARGO" + "寄至：DTD-Cargo 国际货运" + chip wine con código del almacén (YIW-A1/GZ-B2/SZ-C1).
- Cuerpo: 2 cols → izquierda eyebrow "Shipping Mark · 货主代码" + código mono grande wine (36px full, 26px compacto) + nombre + empresa. Derecha: QR mock 78px / 54px.
- Banner dark navy con "BOX · 箱号" + número X/Y grande mono.
- Footer bilingüe con dirección china del almacén + contacto chino (王亮 Wang Liang, etc.) + WeChat. En formato compacto solo ciudad CN + WeChat.

**QR mock:**
- Generado deterministicamente del string `DTD:{markbox}|{boxIndex}/{totalBoxes}` con PRNG seedeada por hash djb2.
- 21×21 cells con 3 finder patterns en esquinas (TL, TR, BL) — visual de QR real (NO escaneable). Suficiente para mockup y demos.
- Renderizado en SVG con `shape-rendering: crispEdges`.

**Print → PDF:**
- Botón "Imprimir / Guardar PDF" en header → `window.print()`.
- `<style>` con `@media print`: `@page { size: ${w}mm ${h}mm; margin: 0 }`, esconde todo excepto `#dtd-print-target`, lo posiciona absoluto, quita sombras y page-break después de cada sheet.
- Funciona end-to-end: el usuario abre el diálogo del navegador → elige "Guardar como PDF" como destino → sale el PDF con el tamaño y layout exacto de la etiqueta seleccionada.

**Mensaje al supplier (modal):**
- Botón "Mensaje al supplier" en header → modal con 2 bloques: ES + 中文.
- Cada bloque renderea texto en mono cn (`Noto Sans SC`) o sans · botón "Copiar" que usa `navigator.clipboard` con feedback "Copiado" 1.8s.
- Botón "Abrir en Compose" llama a `window.openQuickEmail` (si existe) con `to`, `subject` (`DTD-Cargo · {N} etiquetas · Shipping Mark {markbox}`), `body` con ES + CN concatenados.

**Mock data inlined (debería moverse a `erp/data.jsx` al consolidar):**
- `WAREHOUSES_CN`: 3 hubs CN con dirección china real, contacto chino bilingüe, teléfono, WeChat.

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~15 · agregado `{ id: 'labels', group: 'OPERACIÓN', label: 'Etiquetas CN', icon: 'tag' }` debajo de "Cola de QR".
- `DTD Studio · ERP.html` · línea ~106 · agregado `<script type="text/babel" src="nuevo/modules/label-generator.jsx">` al final de overrides.
- `DTD Studio · ERP.html` · línea ~222 · agregado `labels: window.ModuleLabelGenerator` al `moduleMap`.

**Brand-check OK:**
- Solo tokens CSS (`var(--*)`) excepto en el componente `Label` que usa hex literales `#0F1E3D`, `#7F0F1A`, `#fff`, `#6B6B6B`, `#E8E6E2` — esto es **intencional**: la etiqueta tiene que renderearse en blanco/papel siempre, sin verse afectada por dark mode. Son los mismos valores que los tokens en light mode (`--ink`, `--wine`, `--bg-surface`, `--ink-soft`, `--border`).
- Tipografía: `Archivo`, `Archivo Black`, `JetBrains Mono`, `Noto Sans SC` — todo dentro del sistema.
- Sin emojis, sin gradientes, sin glassmorphism.

**TODOs pendientes para próximas sesiones:**
- Soporte para imprimir etiquetas para varios Shipping Mark en la misma plancha (split LCL).
- Generar QR escaneable real (necesita librería externa — `qrcode.js` o similar). Hoy es mock visual.
- Vincular al detalle de Cliente (`erp/modules/clients.jsx` drawer) con botón "Generar etiquetas para este cliente" que abra el módulo con el Shipping Mark preseleccionado vía `goTo('labels', markbox)`.
- Vincular al portal del cliente — que el cliente pueda autogenerar sus etiquetas sin pedirlas al admin.
- Persistir en bridge cuántas etiquetas se generaron y para qué supplier (audit log).

---

## 2026-05-24 · v1.3.1 · Fix dark mode · cards siempre oscuras

**Bug:** 9 lugares usaban `background: var(--ink)` con texto `#fff`. En dark mode `--ink` se invierte a `#F2F0EC` (claro) → texto blanco sobre fondo claro = invisible.

**Fix:** reemplazado por `var(--bg-sidebar)` que se mantiene oscuro en ambos temas (light `#0F1E3D` · dark `#060D1C`).

**Archivos modificados (todos en `nuevo/`):**
- `nuevo/modules/audit-log.jsx` · Mini map ubicación (drill-down tab Actor) + JSON pre block (drill-down tab JSON)
- `nuevo/modules/conciliacion.jsx` · Balance strip (Saldo inicial/Créditos/Débitos/Saldo final/Diferencia)
- `nuevo/modules/contabilidad.jsx` · Card "Total caja+bancos" en Dashboard + Footer "Utilidad neta" en P&L + Footer "Pasivo+Patrimonio" en Balance General
- `nuevo/pantallas/estado-cuenta.jsx` · RatesBanner (BCV/Paralelo/Spread)
- `nuevo/pantallas/agente-perfil.jsx` · Card "Habilitación SENIAT" (número grande)
- `nuevo/pantallas/chofer-perfil.jsx` · Pills A/B/C/D/E de categorías de licencia

**No bugs:** los botones primarios (`var(--wine)` + `#fff`) están OK · `var(--wine)` se ajusta a `#A8323E` en dark, mantiene contraste con blanco. Top bar mobile y travel banner también dark-mode-safe.

---

## 2026-05-24 · v1.3 · Mobile ERP · vista móvil para usuario ERP

**Archivos nuevos:**
- `Mobile ERP.html` (en raíz, igual que Operario CN/VE) — Shell mobile-first. Carga `erp/icons.jsx`, `erp/data.jsx`, `nuevo/rates.jsx` y el app JSX.
- `nuevo/mobile/app.jsx` — App completa con 5 pantallas + bottom nav:
  - **Top bar** sticky con logo, contexto del usuario, ícono mail con badge, avatar
  - **Bottom nav** de 5 ítems: Inicio · Tracking · Clientes · Gastos · Más
  - **HomeScreen**:
    - Saludo personalizado + status del día
    - **Travel banner** si el usuario está en viaje (CN): "Yiwu · 4to día" + botón directo "Cargar gasto del viaje"
    - 4 KPIs en grid 2×2 (embarques activos, facturas vencidas, leads, gastos hoy)
    - 4 quick actions (Cargar gasto, Clientes cerca, Tracking, Aprobar)
    - Feed de actividad reciente
  - **TrackingScreen**:
    - Search bar + lista de embarques activos como cards
    - Cada card: ID + cliente + ruta (CN → VE) + progreso + ETA + status badge + alert tone si aplica
    - Tap → sheet con **mapa mock SVG** (origen→destino con punto del barco en curva animable), 6 fields, botones "Compartir status" (deeplink WhatsApp) y "Ver completo"
  - **ClientsScreen** ("Cerca tuyo"):
    - Toggle `📍 Cerca tuyo · Todos · 187`
    - Banner de geo-permission mock con ubicación del user
    - Search bar
    - Lista de clientes con avatar + Shipping Mark + ciudad + **distancia mock** (m/km, tone "cerca/lejos") + chip de embarques/facturado + 3 botones de acción: Llamar (tel:), WhatsApp (deeplink con texto pre-armado), Visitar
  - **ExpensesScreen** + **NewExpenseModal**:
    - Botón flotante `+` en el header
    - 2 summary cards: Total (USD + Bs. ref) · Cobrable al cliente
    - Toggle "Míos · Equipo"
    - Lista de gastos con icono emoji por categoría (taxi, comida, hotel, vuelo, peaje, combustible, aduana, visita, otro), monto en moneda original + equiv USD si no es USD, chip COBRABLE
    - **NewExpenseModal** (full-screen sheet desde abajo):
      - Placeholder de foto de recibo
      - Input grande de monto + selector USD/VES/CNY
      - Chips de 9 categorías (con tone por tipo)
      - Selector de método (Efectivo/Tarjeta/Transfer/USDT)
      - Selector de embarque asociado (opcional, lista de activos)
      - Textarea de nota
      - Toggle "Cobrable al cliente" con feedback visual
      - Guarda a localStorage (`dtd_mobile_v1_expenses`) con auto-numeración EXP-2026-NNNN, asocia ubicación del usuario
  - **MoreScreen**:
    - Card de usuario con avatar grande, rol, ubicación
    - **Demo · cambiar usuario** (Carlos Admin · Martina Comercial en viaje CN · Yusneidy Ops)
    - Menú herramientas (Notificaciones [12], Aprobaciones [3], Documentos, Audit log, Cotizador rápido, Reportes)
    - Menú ajustes (Mi perfil, Preferencias, Cambiar contraseña, Cerrar sesión)
    - Footer build

**Personas mock** (switchables desde Más):
- `u-001` Carlos Vargas · Admin · Dueño · Valencia VE
- `u-002` Martina Acuña · Comercial · En viaje · Yiwu CN (dispara el Travel banner)
- `u-003` Yusneidy Pérez · Operaciones · Maracaibo VE

**6 gastos seed** incluyendo USD, VES y CNY · cubren peaje VE, comida CN, hotel CN, vuelo internacional, taxi CN, aduana VE — todos con location asociada.

**Diseño:**
- max-width 480px centrado, con shadow + radius en viewports anchos para preview tipo phone
- viewport-fit cover + safe-area-inset-* para iPhone notch
- Theme color navy DTD para PWA-ready
- Toda la paleta y typo del Brand Book (Archivo / Archivo Black / JetBrains Mono)
- Sin emoji decorativo en UI · solo en categorías de gasto (que es contextualmente correcto)

**Asset registrado:** "Mobile ERP".

**TODOs pendientes:**
- Wirear cámara real (getUserMedia) para foto del recibo
- Geolocation API real en Clientes cerca
- Aprobaciones en línea desde Más → Aprobaciones
- Push notifications (mock por ahora)
- Sync de gastos cargados con el módulo Contabilidad (auto-asiento como `5.1.20 Combustible` o `6.1.10 Gastos de viaje CN` según categoría)

---

## 2026-05-24 · v1.2 · Módulo Contabilidad QuickBooks-like

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/contabilidad-data.jsx` — Plan de cuentas + asientos + helpers:
  - **CHART_OF_ACCOUNTS** · 52 cuentas en 4 niveles, freight-forwarder VE editable:
    - Activo Corriente/No Corriente (bancos USD/VES/USDT, caja chica, CxC, IVA crédito, inventario en tránsito CN, flota propia)
    - Pasivo Corriente/No Corriente (CxP, anticipos, IVA débito, retenciones IVA/ISLR, sueldos, préstamos)
    - Patrimonio (capital, utilidades retenidas, resultado del ejercicio, ajuste cambiario)
    - Ingresos (flete marítimo/aéreo/DDP/seguro/almacenaje/otros)
    - Costos Directos (CGS · flete naviero/aéreo, agente aduanal, aranceles, transporte VE, almacenaje, combustible, salarios choferes)
    - Gastos Operativos (sueldos admin, alquiler, servicios, marketing, viaje a China, viáticos, comisiones bancarias, software, depreciación)
    - Otros Resultados (diferencia cambiaria ganancia/pérdida, intereses)
  - **JOURNAL_ENTRIES** · 16 asientos seed cubriendo 30 días: 3 facturas emitidas (con IVA débito separado), 2 pagos USD recibidos, 1 pago VES (con conversión + tasa registrada), 4 gastos directos (naviera, agente, salarios choferes, combustible), 4 gastos operativos, 1 asiento flagged (por clasificar)
  - **Helpers**: `getAccount`, `accountBalance` (recursivo para agregadas), `calculatePL`, `calculateBS`, `accountMovements` (libro mayor)
  - **Lock state**: `readLock`/`writeLock`/`isUnlocked` con persistencia en `localStorage` (`dtd_contab_v1`) y custom event `dtd-contab-lock`

- `nuevo/modules/contabilidad.jsx` — Módulo principal con 6 tabs estilo QuickBooks Online:
  - **Dashboard**: 4 KPIs (Ingresos / Costos / Gastos / Utilidad), grid de 6 acciones rápidas, columnas de saldos bancarios + CxC/CxP, feed de últimos 5 asientos
  - **Libro diario**: tabla filtrable por tipo (factura/pago USD/pago VES/gasto/por clasificar), drawer detalle con líneas, totales débito/crédito, banner de conversión VES→USD si aplica, badge "modo seguro" si está locked
  - **Plan de cuentas**: árbol jerárquico (level 1 en wine bold uppercase, level 2 bold, level 3 con indent), tone badge por tipo, balance actual por cuenta hoja
  - **Libro mayor**: selector de cuenta, header con tipo/movimientos/saldo, tabla con balance corrido por movimiento
  - **Reportes**: 4 sub-tabs:
    - **Estado de Resultados** (P&L) con header dark, líneas indentadas, totales por sección, equivalente VES en el footer
    - **Balance General** (BS) con check de cuadre Activo = Pasivo + Patrimonio, resultado del ejercicio inyectado automáticamente
    - **Flujo de caja** por cuenta bancaria · entradas/salidas/neto
    - **Margen por embarque** cruzado con datos de Costing (5 embarques mock con % margen tone-coded)
  - **Configuración**: panel seguridad con estado del lock (locked/unlocked-by-X-hasta-Y), ejercicio fiscal, numeración automática
  - **LockButton**: en el header del módulo, abre prompt de contraseña (mock · acepta cualquier 4+ chars), desbloquea por 30 min, persistencia + evento global

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~24 (`MODULES`) · agregado `{ id: 'contab', group: 'FINANZAS', label: 'Contabilidad', icon: 'invoice' }` entre Facturación y Conciliación
- `DTD Studio · ERP.html` · líneas ~94-95 · agregados `<script src="nuevo/modules/contabilidad-data.jsx">` y `<script src="nuevo/modules/contabilidad.jsx">` en overrides
- `DTD Studio · ERP.html` · línea ~194 · agregado `contab: window.ModuleContabilidad` al moduleMap

**Lógica contable implementada (siguiendo QuickBooks):**
- **Factura emitida** → Db CxC / Cr Ingreso por flete + Cr IVA Débito Fiscal (16%)
- **Pago recibido USD** → Db Banco USD / Cr CxC
- **Pago recibido VES** → Db Banco VES (en USD equivalente @ tasa del día) / Cr CxC · con `forex { originalAmount, originalCurrency, rate, rateSource }` adjuntado al asiento
- **Gasto operativo** → Db cuenta de gasto / Cr Banco
- **Costos directos** → Db cuenta CGS / Cr Banco (alimentan margen por embarque)

**Seguridad / Doble filtro de edición:**
- **Modo seguro** (default ON): asientos contabilizados son read-only · botones Editar/Eliminar disabled
- **Edición abierta** (30 min): requiere contraseña en un prompt · sesión auto-expira · cada cambio queda en audit (TODO wirear)
- **Eliminación total**: visible solo en sesión abierta, con confirmación + log (mock por ahora)

**TODOs pendientes para v1.3:**
- Conectar "Nueva factura"/"Registrar pago"/"Registrar gasto" del dashboard con sus respectivos flujos del ERP
- Wirear cada acción (crear/editar/eliminar asiento) al `window.ModuleAuditLog` (push a `dtd_audit_log_v1`)
- Form de nuevo asiento manual (drawer con líneas dinámicas y verificación de cuadre)
- Diferencia cambiaria automática al cierre mensual (job manual hoy)
- Vincular pagos del módulo Conciliación bancaria a asientos automáticos (hoy se hace en localStorage por separado)
- Mover JOURNAL_ENTRIES y CHART_OF_ACCOUNTS a `erp/data.jsx` al consolidar

---

## 2026-05-24 · v1.1.1 · Bolívares en estado de cuenta + brand rule

**Cambios en Brand Book (regla de moneda extendida):**
- `Brand Book DTD v2.4.html` · línea ~5286 (panel "Formato de datos · Cómo se escriben") · expandida la regla de Moneda. Ahora son **4 entradas**:
  - **Moneda USD** — `USD 4.820` (sin decimales · . miles)
  - **Moneda VES** — `Bs. 175.640` (sin decimales · . miles · prefijo Bs.)
  - **Conversión** — `USD 4.820 · Bs. 175.640 @ BCV 36,45`
  - **Tasa** — `BCV 36,45 · Paralelo 37,20` (1 USD = X Bs.)

**Archivos nuevos en `nuevo/`:**
- `nuevo/rates.jsx` — Helper global `window.ERPRates` con:
  - `read()` / `write()` — persistencia en `localStorage` (`dtd_rates_v1`)
  - `rateOf(source)` — devuelve la tasa según fuente (`bcv` | `parallel` | `avg`)
  - `usdToVes(amount, source?)` / `vesToUsd(amount, source?)` — conversores
  - `fmtUsd(n)` / `fmtBs(n)` — formatters siguiendo Brand Book v2.4 (sin decimales · prefijo · separador miles)
  - `useRates()` — hook con event listener para re-render al cambiar
  - Defaults: BCV 36.45 · Paralelo 37.20 · CNY 7.18 (igual que Admin → Tasas de cambio)

**Cambios en Estado de Cuenta (`nuevo/pantallas/estado-cuenta.jsx`):**
- Carga `../rates.jsx` antes del JSX
- **RatesBanner** nuevo (card dark debajo del hero) — muestra BCV, Paralelo, spread % y badge "Asientos contables · @ BCV"
- **KPIs hero** — Saldo actual y Deuda vencida muestran su equivalente en Bs. en el delta usando `R.fmtBs(R.usdToVes(...))`
- **Cuenta corriente** — cada balance corrido ahora muestra una segunda línea con el equivalente Bs. en mono pequeña gris
- **VESMovementsCard** nuevo (debajo de Cuenta Corriente) — tabla dedicada de pagos recibidos en Bs. con: fecha, ref, descripción, monto Bs., **tasa usada al momento + fuente** (BCV/paralelo), equivalente USD, factura linkeada. Header con totales Bs. + USD + tasa promedio. Footer con nota fiscal: cada pago se asienta con la tasa vigente al día y queda en libros.
- ACCOUNT_PROFILES extendido para 3 clientes con movimientos VES realistas:
  - **DTD-5452 Acindar** · 3 transfers en Bs. (BCV + paralelo) por F-2026-0382, ND, F-2026-0312
  - **DTD-5340 Distribuidora Andina** · 3 transfers en Bs. histórico de pagos a F-388, F-367, F-298
  - **DTD-5321 Salazar Trading** · 2 anticipos en Bs.

**Archivos viejos modificados:**
- `DTD Studio · ERP.html` · línea ~55 · agregado `<script src="nuevo/rates.jsx">` entre feature-flags y shell para exponer `window.ERPRates` a todo el ERP
- `nuevo/pantallas/estado-cuenta.html` · agregado `<script src="../rates.jsx">` antes del estado-cuenta.jsx

**Notas:**
- Las tasas son por ahora estáticas (defaults). **TODO consolidación:** wirear `Admin → Tasas de cambio` (`SectionRates`) para que escriba a `window.ERPRates.write()` cuando se haga override manual o cuando termine el scrape BCV. Hoy el panel solo muestra valores; el utility provee el storage para cuando se conecte.
- Los rate inputs en Admin tienen un placeholder visual (`value="36.45"`); cambio futuro: hacerlos controlados via `useRates()`.
- Brand-check: la regla de Moneda en Brand Book quedó alineada con lo que usa la implementación · sin decimales, separador de miles `.`, prefijo `Bs.` antes del número en VES (no después).

---

## 2026-05-24 · C3 · Audit log con drill-down · SPRINT C COMPLETO ✅

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/audit-log.jsx — Nuevo módulo `window.ModuleAuditLog`. Incluye:
  - 4 KPIs: Eventos hoy, Actores únicos, Acciones sensibles (DELETE/CONFIG), Retención (180d)
  - Toolbar con search + filter por acción (create/edit/delete/config/login/auto) y por usuario
  - Tabla con 12 entradas mock enriquecidas (no solo el `time/user/target/detail` del SectionAudit, sino payload completo)
  - Cada fila muestra: cuando, acción badge, actor con avatar+rol, target con badge "SENSIBLE" si aplica, IP+ciudad, chevron de drill-down
  - **AuditDrillDown** — Drawer 720px con 5 tabs:
    - **Resumen** — headline color-coded por acción, fields rápidos, chip de campos modificados
    - **Diff de campos** — tabla campo-por-campo con valor antes (tachado, fondo rojo) → después (fondo verde), formateo por tipo (money/pct/number/date/text), filas "unchanged" en gris
    - **Actor & origen** — card con avatar + rol + email, datos de IP/ciudad/navegador, mini card dark con ubicación
    - **Relacionados** — historial de otros eventos sobre el mismo target, navegable (click reabre el drawer con el otro evento)
    - **JSON** — payload crudo en monoespaciada sobre fondo dark
  - 12 entradas seed cubren todos los tipos: CREATE cliente, EDIT cotización/embarque/factura, DELETE borrador, CONFIG sistema, LOGIN, AUTO (cron). 2 entradas marcadas como `sensitive: true`.

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~31 · agregado `{ id: 'auditlog', group: 'SISTEMA', label: 'Audit log', icon: 'eye' }` después de Vault
- `DTD Studio · ERP.html` · línea ~93 · agregado `<script src="nuevo/modules/audit-log.jsx">` en overrides
- `DTD Studio · ERP.html` · línea ~192 · agregado `auditlog: window.ModuleAuditLog` al moduleMap
- `nuevo/feature-flags.jsx` · línea ~73 (`MODULE_FLAG_MAP`) · agregado `auditlog: 'audit_log'` para que el flag `audit_log` realmente esconda el módulo

**Notas:**
- El `SectionAudit` viejo dentro de Admin queda intacto (tiene una vista resumida sin drill-down). El módulo nuevo es la "vista profunda" como dice el HANDOFF.
- Feature flag `audit_log` está ON por default, así que el módulo aparece de entrada. Toggleándolo OFF en Admin → Casos de uso lo esconde del sidebar (y auto-vuelve a dashboard si estás parado en él).
- `AUDIT_ENTRIES` inlined — al consolidar mover a `erp/data.jsx`.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1–A5)
- **Sprint B · Conexiones funcionales** ✅ COMPLETO (B1, B2, B3)
- **Sprint C · Profundidad** ✅ COMPLETO (C1, C2, C3)

🎉 **v1.1 completo.** Todos los pendientes priorizados del HANDOFF (Sprint A/B/C) están entregados.

---

## 2026-05-24 · C2 · Conciliación bancaria (módulo ERP)

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/conciliacion.jsx — Nuevo módulo `window.ModuleConciliacion`. Incluye:
  - 4 KPIs: Movs importados, Conciliados, Pendientes revisión, Total reconciliado
  - 5 tabs: A revisar / Conciliados / Sin sugerencia / Rechazados / Todo
  - **Balance strip** (card dark) — Saldo inicial · Créditos · Débitos · Saldo final · Diferencia
  - **MovementRow** — cada movimiento muestra: fecha + ref bancaria, descripción + tag crédito/débito, sugerencia automática con confidence (high/medium/high), monto, acciones inline (Confirmar / Buscar match)
  - **MovementDetail** lateral — descripción bancaria, sugerencia con score de confianza, búsqueda manual entre facturas (`D.INVOICES`), botones Confirmar / Marcar manual / Rechazar
  - Mock seed: extracto Banesco USD del 8–22 mayo con 14 movimientos (7 créditos de clientes, 7 débitos operativos: naviera, aduanal, combustible, nómina, etc.)
  - Match confidence levels: `high` (monto + cliente identificado en descripción + fecha 7d), `medium` (parcial), `low` (sugerencia débil)
  - Persistencia de decisiones en `localStorage` (`dtd_reconcile_v1`)
  - "Movimientos flagged" (cargo sospechoso · TRX-INET) marcados en rojo

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~24 · agregado `{ id: 'reconcile', group: 'FINANZAS', label: 'Conciliación bancaria', icon: 'check' }` después de Facturación
- `DTD Studio · ERP.html` · línea ~92 · agregado `<script src="nuevo/modules/conciliacion.jsx">` en sección de overrides
- `DTD Studio · ERP.html` · línea ~191 · agregado `reconcile: window.ModuleConciliacion` al moduleMap

**Notas:**
- Aparece como ítem nuevo del sidebar bajo FINANZAS (debajo de Facturación). No requiere feature flag.
- El "subir extracto" del header es placeholder visual — implementar flujo real (drag-drop CSV/PDF + parser) en una iteración futura.
- BANK_STATEMENTS debería moverse a `erp/data.jsx` al consolidar; hoy está inlined como SEED_STATEMENT.

---

## 2026-05-24 · C1 · Estado de cuenta detallado del cliente (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/estado-cuenta.html — Shell HTML.
- nuevo/pantallas/estado-cuenta.jsx — Vista profunda de la cuenta corriente del cliente. Incluye:
  - Top bar sticky con breadcrumb ERP / Clientes / Estado de cuenta + selector (6 clientes con data detallada)
  - Hero card con avatar, badges (status, segmento, alerta de mora), Shipping Mark, RIF, embarques, facturado total. CTAs: Generar PDF · Registrar pago · Enviar recordatorio
  - 4 KPIs: Saldo actual, Deuda vencida, Crédito disponible, DPP (días promedio de pago vs meta SLA)
  - **Aging chart** — distribución por bucket (0-30, 31-60, 61-90, 90+) con stacked bar + 4 boxes de detalle
  - Columna izquierda (2/3):
    - **Resumen mensual 6m** — bars dobles (facturado vs cobrado) + footer con totales y % efectividad de cobro
    - **Cuenta corriente** — tabla de movimientos con filtros tab-style (Todos / Facturas / Pagos / NC-ND / Recordatorios) y balance corrido
    - **Métodos de pago históricos** — stacked bar + breakdown por tipo (Transfer USD, Zelle, USDT TRC20, Efectivo USD)
  - Columna derecha (1/3):
    - **Contacto de facturación** — nombre, rol, email, teléfono, dirección fiscal
    - **Condiciones de crédito** — banner con límite, plazo, descuento pronto pago, términos
    - **Seguimiento** — último recordatorio + próximo vencimiento con badge de días restantes/vencidos
    - **Acciones admin** — cambiar límite, editar términos, marcar moroso, suspender línea
  - ACCOUNT_PROFILES inlined para 6 clientes con perfiles muy distintos:
    - DTD-5392 Industrias Polar · cliente A, pagos limpios, efectividad 92%
    - DTD-5452 Acindar Comercial · tiene F-2026-0418 vencida hace 10d
    - DTD-5354 Castro Hermanos · sólido, pagos en término
    - DTD-5371 Tech Solutions · chico, Zelle, sin mora
    - DTD-5340 Distribuidora Andina · slow payer, 2do recordatorio enviado
    - DTD-5321 Salazar Trading · status pending, solo pago anticipado

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear botón "Estado de cuenta" en el detalle de cliente del módulo `erp/modules/clients.jsx` que abra `nuevo/pantallas/estado-cuenta.html?id={markbox}` en nueva pestaña.

**Notas:**
- Asset registrado: "Estado de Cuenta del Cliente".
- Solo 6 clientes tienen ACCOUNT_PROFILE rico — el selector filtra automáticamente. Al consolidar, completar los 12 clientes restantes o usar un generador.
- Aging buckets se calculan en runtime a partir de `creditDays` del cliente + fecha de la factura abierta.
- Balance corrido calculado forward-in-time desde el movimiento más antiguo.

---

## 2026-05-24 · B2 · Cola QR conectada móvil ↔ ERP · SPRINT B COMPLETO ✅

**Archivos viejos modificados (línea + razón):**
- `operario/app.jsx` · línea ~793 (`PrintQRSheet`, botón "Enviar a oficina") · agregada lógica en el `onClick`: si `target === 'office'`, hace `unshift` de un nuevo objeto orden al `localStorage` key `dtd_qrqueue_v1` antes de mostrar la pantalla de éxito.

**Cómo funciona el push:**
- Lee el array existente de `localStorage` (`dtd_qrqueue_v1` — el mismo key que usa el módulo Cola de QR del ERP)
- Genera un ID secuencial `QR-2026-NNNN` (continúa desde donde está)
- Resuelve el nombre del cliente vía `window.ERPData.byMarkbox(client)`
- Setea `warehouse: 'cn-yiwu'`, `priority: 'normal'`, `status: 'pendiente'`, `sentBy: 'Liu Wei'` por default
- Setea `sentAt` con el timestamp real del navegador (formato `YYYY-MM-DD HH:MM`)
- `supplier` queda como "Pendiente · taggear en oficina" (la app móvil no captura supplier en este sheet)

**Verificación end-to-end:**
1. Abrir `Operario CN.html` → menú "Imprimir códigos QR" → seleccionar cliente → elegir "Enviar a oficina" → Confirmar
2. Abrir `DTD Studio · ERP.html` → asegurar que feature flag `mobile_operator` está ON (Admin → Casos de uso) → sidebar "Cola de QR" → la nueva orden aparece arriba de todo, status "pendiente"

**Notas:**
- Como simulamos el push con localStorage compartido entre tabs (mismo origen), el ERP necesita un refresh para ver la nueva orden (el módulo Cola de QR carga el state en `useState` lazy). Para tiempo real verdadero habría que sumar un listener `window.addEventListener('storage', ...)` en el módulo de Cola de QR.
- `sentBy` y `sentByPhone` están hardcodeados a "Liu Wei" porque la PrintQRSheet no recibe `user` como prop. Cuando se consolide, pasar `user` desde `OperarioApp` y popular esos campos dinámicamente.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1–A5)
- **Sprint B · Conexiones funcionales** ✅ COMPLETO (B1, B2, B3)
- **Sprint C · Profundidad** — pendiente:
  - C1: Estado de cuenta detallado del cliente
  - C2: Conciliación bancaria
  - C3: Audit log con drill-down

---

## 2026-05-24 · B1 · Feature flags realmente ocultan módulos

**Archivos nuevos en `nuevo/`:**
- nuevo/feature-flags.jsx — Estado global de feature flags:
  - `window.FEATURE_FLAG_DEFAULTS` — defaults (mismos 20 flags que tenía SectionFeatures)
  - `window.DTDFlags.getFlags()` / `setFlags()` / `toggleFlag(k)` — read/write con persistencia en `localStorage` (`dtd_feature_flags_v1`)
  - `window.DTDFlags.useFeatureFlags()` — hook React que re-renderiza cuando cambian (vía `CustomEvent 'dtd-flags-changed'` + listener `storage`)
  - `window.MODULE_FLAG_MAP` — diccionario `{ moduleId: flagKey }` para mapear sidebar items a flags:
    - `seniat` ← `customs_seniat`
    - `vault` ← `vault`
    - `qrqueue` ← `mobile_operator`
  - `window.DTDFlags.isModuleEnabled(id, flags?)` — helper para chequear

**Archivos viejos modificados (línea + razón):**
- `DTD Studio · ERP.html` · línea ~54 · agregado `<script src="nuevo/feature-flags.jsx">` entre `components.jsx` y `shell.jsx` (carga antes que cualquier consumidor)
- `DTD Studio · ERP.html` · línea ~131 · agregado `useEffect` que escucha el evento `dtd-flags-changed` y auto-navega a `dashboard` si el módulo activo queda escondido
- `erp/modules/admin.jsx` · línea ~975 (`SectionFeatures`) · reemplazado el `useState` local + `setFlags` por `window.DTDFlags.useFeatureFlags()` para que los toggles realmente persistan y propaguen
- `erp/shell.jsx` · línea ~63 (`Sidebar`) · agregado `useFeatureFlags()` + extendido `isAllowed()` para filtrar también por flag (además de role). `useMemo` ahora depende de `[currentUser, flags]`

**Notas:**
- Solo 3 módulos están atados a flags hoy. El resto siempre se muestra (son core).
- Para esconder otros módulos basta con extender `window.MODULE_FLAG_MAP` (no requiere tocar shell.jsx).
- Otros flags (`hs_autodetect`, `cn_translation`, `ai_copilot`, `audit_log`, `consolidation_partial`, `portal_cliente`, `comments`, etc.) controlan **features internas** dentro de módulos — eso queda como follow-up cuando se quiera atar feature-por-feature.
- `vault` está ON por default, `customs_seniat` y `mobile_operator` están OFF. Por eso al abrir el ERP de cero, **SENIAT y Cola de QR no aparecen en el sidebar hasta activarlos en Admin → Casos de uso**.

---

## 2026-05-24 · B3 · Wiring de cards → perfiles standalone

**Archivos viejos modificados (línea + razón):**
- `erp/modules/tms.jsx` · línea ~262 (`FleetTab`) · agregado `onRowClick` a la tabla que abre `nuevo/pantallas/camion-perfil.html?id={truck.id}` en nueva pestaña.
- `erp/modules/tms.jsx` · línea ~268 (`DriversTab`) · agregado `hoverable + onClick` a cada `<U.Card>` de chofer → abre `nuevo/pantallas/chofer-perfil.html?id={d.id}` en nueva pestaña.
- `erp/modules/seniat.jsx` · línea ~285 (`AgentsTab`) · agregado `hoverable + onClick` a cada `<U.Card>` de agente → abre `nuevo/pantallas/agente-perfil.html?id={a.id}` en nueva pestaña.

**Notas:**
- Cambios mínimos. Uso `window.open(..., '_blank')` para no perder el contexto del ERP.
- Cuando se consolide v1.1: evaluar si los perfiles deberían vivir adentro del ERP como un drawer/full-page en vez de standalone.

---

## 2026-05-24 · A5 · Perfil de Agente Aduanal (standalone) · SPRINT A COMPLETO ✅

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/agente-perfil.html — Shell HTML.
- nuevo/pantallas/agente-perfil.jsx — Perfil completo del agente. Incluye:
  - Top bar sticky con breadcrumb ERP / Aduana SENIAT / Agentes + selector (4 agentes)
  - Hero card con avatar, badge "Habilitado", rating, nombre empresa, puerto, contacto persona + rol, RIF y SENIAT en mono. CTAs Email / Llamar / WhatsApp
  - 4 KPIs: Embarques YTD, Tiempo liberación (vs SLA), On-time clearance, Honorarios YTD
  - Columna izquierda (2/3):
    - **En trámite ahora** — tabla con embarques activos (DUA, días en trámite, status, fee)
    - **Tiempo de liberación · 6 meses** — bars con línea de referencia del SLA del agente (barras amarillas si superan SLA)
    - **Honorarios · 6 meses** — bars verdes con total semestre y promedio mensual
    - **Historial** — tabla con shipments + DUA + status + días para liberar + puerto + fee
  - Columna derecha (1/3):
    - **Contacto principal** — nombre, rol, email, WhatsApp, sitio web
    - **Empresa** — razón social, RIF, fundación, empleados, dirección, email corporativo, inicio contrato DTD, clientes exclusivos (chips)
    - **Habilitación SENIAT** — card dark con número grande + puertos habilitados con vencimientos color-coded
    - **Certificaciones & pólizas** — OEA, ISO, seguros con vencimientos
    - **Comunicaciones recientes** — timeline con iconos por tipo (WhatsApp/Email/Llamada)
    - **Notas internas** + **Acciones admin** (editar, reporte performance, suspender, baja)
  - AGENT_PROFILES inlined con 4 agentes (a-001 Aduanas Carabobo, a-002 Logística Aduanal VE, a-003 Zulia Aduanas, a-004 Falcón Customs).

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear onClick en `erp/modules/seniat.jsx` `AgentsTab` para abrir `nuevo/pantallas/agente-perfil.html?id={a.id}` en nueva pestaña.

**Notas:**
- Asset registrado: "Perfil de Agente Aduanal".
- AGENTS_BASE espejado del `_seniatData.agents` (variable interna del módulo SENIAT, no expuesta a `window.ERPData`). Al consolidar, exponerla globalmente.
- AGENT_SHIPMENTS también espejado — al consolidar usar la fuente única.

---

## 📍 Estado de sprints

- **Sprint A · Visuales nuevas** ✅ COMPLETO (A1 a A5)
- **Sprint B · Conexiones funcionales** — pendiente:
  - B1: Feature flags realmente ocultan módulos
  - B2: Cola QR conectada Operario CN ↔ ERP en tiempo real
  - B3: Wirear los onClick de las cards (TMS chofer + TMS camión + SENIAT agente) para abrir los perfiles nuevos
- **Sprint C · Profundidad** — pendiente (estado de cuenta cliente, conciliación bancaria, audit log drill-down)

---

## 2026-05-24 · A4 · Perfil de Camión (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/camion-perfil.html — Shell HTML (copia de chofer-perfil.html).
- nuevo/pantallas/camion-perfil.jsx — Perfil completo del vehículo. Incluye:
  - Top bar sticky con breadcrumb ERP / TMS / Flota + selector con plate (7 camiones)
  - Hero card con placeholder de foto (160×110), patente en mono 36px, brand + type, status, ownership (Propio/Contratado), hub, capacidad, año
  - CTAs: Asignar a ruta · Reportar incidencia · Editar
  - 4 KPIs: Km totales, Viajes 30d, Costo por km, Próximo service (con tone warning si <3000 km)
  - Columna izquierda (2/3):
    - **En ruta ahora** (sólo si tiene ruta activa)
    - **Especificaciones técnicas** — 12 fields: año, tipo, ejes, motor, combustible, rendimiento, capacidad, volumen, tara, dimensiones, VIN, compra
    - **Costos · últimos 30 días** — stacked bar + breakdown por categoría (combustible / mantenimiento / salario chofer / peajes / otros) con % y monto
    - **Historial de servicios** — tabla con fecha, tipo (preventivo/correctivo), descripción, km, costo + total YTD
    - **Viajes recientes** — tabla con fecha, ruta, chofer, km, on-time
  - Columna derecha (1/3):
    - **Chofer asignado** — card con cross-link a `chofer-perfil.html?id={driver.id}`
    - **Documentación** — Circulación, SOAT, RTV, Seguro flota, RIF vehicular con vencimientos color-coded
    - **Próximo service** — banner con km restantes + checklist de tareas (aceite, filtros, frenos, neumáticos, niveles)
    - **Incidencias** — empty state OK / lista con severity color y costo
    - **Notas internas** + **Acciones admin** (reasignar, taller, fuera de servicio, baja)
  - TRUCK_PROFILES inlined con 7 camiones completos (T-001 hasta T-007).

**Archivos viejos modificados:**
- Ninguno. **TODO:** wirear onClick en `erp/modules/tms.jsx` `FleetTab` para abrir `nuevo/pantallas/camion-perfil.html?id={truck.id}` en nueva pestaña.

**Notas:**
- Asset registrado: "Perfil de Camión".
- Cross-link bidireccional con perfil de chofer (cada lado tiene un botón "Ver perfil" al otro).
- TRUCK_PROFILES debería moverse a `erp/data.jsx` al consolidar.

---

## 2026-05-24 · A3 · Perfil de Chofer (standalone)

**Archivos nuevos en `nuevo/`:**
- nuevo/pantallas/chofer-perfil.html — Shell HTML que carga tokens.css, fuentes, React/Babel y los scripts del ERP (icons, data, components) + el JSX del perfil.
- nuevo/pantallas/chofer-perfil.jsx — Componente completo del perfil. Incluye:
  - Top bar sticky con breadcrumb ERP / TMS / Choferes y selector de chofer (cambia URL `?id=`)
  - Hero card con avatar, status, rating, licencia, hub, y CTAs Email · Llamar · WhatsApp
  - 4 KPIs: Viajes 30d, On-time %, Km totales, Antigüedad
  - Columna izquierda (2/3):
    - **En ruta ahora** (sólo si tiene ruta activa) — embarque, camión, distancia, ETA, paradas con timeline + barra de progreso
    - **Performance 6 meses** — barras de viajes/mes con total y promedio
    - **Camión asignado** — link cruzado al perfil del camión (`camion-perfil.html?id=`)
    - **Viajes recientes** — tabla con fecha, ruta, embarque, km, on-time, rating
    - **Incidencias** — empty state OK / lista con severity color
  - Columna derecha (1/3):
    - **Licencia & salud** — categorías A/B/C/D/E como pills + vencimientos con tone (verde/amarillo/rojo según días restantes)
    - **Datos de contacto** — teléfono, email, RIF, DOB, ingreso, dirección, contacto emergencia
    - **Capacitaciones** — IMDG, manejo defensivo, primeros auxilios con vencimientos
    - **Notas internas** — textarea libre con "autoguardado hace 2 min · solo Admin"
    - **Acciones admin** — editar, reasignar camión, marcar de licencia, dar de baja
  - DRIVER_PROFILES inlined con 7 choferes completos (matchea con `D.DRIVERS`).

**Archivos viejos modificados:**
- Ninguno por ahora. **TODO:** wirear el onClick de las cards en `erp/modules/tms.jsx` (línea ~268, `DriversTab`) para abrir `nuevo/pantallas/chofer-perfil.html?id={d.id}` en nueva pestaña.

**Notas:**
- Asset registrado en review pane: "Perfil de Chofer".
- DRIVER_PROFILES debería moverse a `erp/data.jsx` cuando se consolide.
- Cross-link al perfil de camión (A4) ya está hardcodeado: `camion-perfil.html?id={truck.id}`.
- Helper `daysUntil()` calcula días restantes contra fecha fija 2026-05-24 (sin "hoy real").

---

## 2026-05-24 · A2 · Cola de impresión QR (vista oficina)

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/qr-queue.jsx — Nuevo módulo `window.ModuleQrQueue`. Incluye:
  - Vista doble: "Cola activa" (pendientes + imprimiendo) y "Historial" (impreso/entregado/cancelado)
  - 4 KPIs: Pendientes, Imprimiendo, Bultos en cola, Impresos hoy
  - Toolbar con filtros por almacén CN (Yiwu/Guangzhou) y prioridad
  - Cards de orden con checkbox de selección, badge de prioridad y status, contador de etiquetas
  - Sticky bulk-action bar al seleccionar múltiples órdenes
  - Modal de impresión por lote con selector de impresora (3 opciones, una offline) + toggle WhatsApp
  - Panel detalle lateral con QR preview SVG, timeline de 4 pasos, link al cliente
  - Estados ciclo de vida: pendiente → imprimiendo → impreso → entregado (más cancelado)
  - Persistencia en `localStorage` (`dtd_qrqueue_v1`) para simular el push del móvil al ERP

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~13 · agregado `{ id: 'qrqueue', group: 'OPERACIÓN', label: 'Cola de QR', icon: 'tag' }` al array `MODULES` (debajo de Almacén CN)
- `DTD Studio · ERP.html` · línea ~91 · agregado `<script src="nuevo/modules/qr-queue.jsx">` después del dashboard override
- `DTD Studio · ERP.html` · línea ~188 · agregado `qrqueue: window.ModuleQrQueue` al `moduleMap`

**Notas:**
- 10 órdenes mock seed (DTD-7842 Polar, DTD-9104 Acindar, DTD-5621 Tech Solutions, etc.) con mix de estados.
- QR preview es SVG procedural — placeholder visual, no es un QR escaneable real.
- Pendiente conexión con Operario CN (B2 del backlog): hoy el móvil hace `console.log` cuando se manda; falta postear al mismo localStorage key.

---

## 2026-05-24 · A1 · Editor de Dashboard

**Archivos nuevos en `nuevo/`:**
- nuevo/modules/dashboard.jsx — Reemplaza `window.ModuleDashboard` del v1.0. Agrega:
  - Botón "Configurar" en el header que abre un drawer
  - Catálogo de 14 KPIs (Operación · Finanzas · Comercial)
  - Drag-to-reorder de KPIs activos
  - Toggle de 7 widgets (chart, embarques, alerts, actividad, acciones rápidas, TMS, próximos ETA)
  - Período del gráfico configurable (1M/3M/1A/YTD)
  - Persistencia en `localStorage` (`dtd_dashboard_config_v1`) + reset
  - Persistencia del ojo "ocultar valores" en `localStorage` (`dtd_dashboard_hide`)

**Archivos viejos modificados (línea + razón):**
- `DTD Studio · ERP.html` · línea ~85 · agregado `<script src="nuevo/modules/dashboard.jsx">` al final de los modules para overridear `window.ModuleDashboard`

**Notas:**
- El módulo viejo `erp/modules/dashboard.jsx` sigue intacto (queda como referencia v1.0). Se carga primero y luego el nuevo override gana.
- Los valores extra de KPIs (avgTransit, marginYTD, etc.) están inlined en el módulo nuevo como `EXTRA_KPI_VALUES`. **TODO al consolidar:** moverlos a `erp/data.jsx` → KPIS.
- Dos nuevos widgets que no existían: "Estado de flota TMS" (usa `D.TRUCKS`) y "Próximos ETA" (calendar-style).

---

## 2026-05-24 · Setup de continuidad

**Archivos nuevos en `nuevo/`:**
- nuevo/README.md
- nuevo/CHANGELOG.md

**Archivos viejos modificados:**
- HANDOFF.md · agregado bloque "v1.1 · CONTINUIDAD DEL PROYECTO" y "Workflow de continuidad con Claude Code"

**Notas:** Setup inicial. Todavía sin pantallas nuevas. El próximo trabajo arranca en Claude Code con el prompt de continuación.


---
---

# 📎 ANEXO · changelogs consolidados (antes sueltos en la raíz)

> Fusionados el 2026-05-31. Los archivos `CHANGELOG-sesion.md` y
> `CHANGELOG-calendario-ferias.md` se eliminaron; su contenido íntegro queda acá.

---

## 📦 ANEXO A · DTD-Cargo · Changelog de la sesión

Resumen completo de todo lo construido en esta sesión sobre el ERP DTD-Cargo.

---

## 🧱 Módulos construidos

### 1 · Despacho admin (Vista 1)
`erp/modules/despacho.jsx` · standalone `Despacho · Vista 1.html`

- Cola priorizada de paquetes pendientes con drag & drop manual
- 5 KPIs: pendientes · listos · atrasados · días promedio · sin coordenadas
- 5 filtros: ciudad · barrio (dependiente) · pago · días · ruta
- Score 0–100 con motor de reglas; badges de prioridad por color
- Badge Tier (Gold/Platinum) inline en cada paquete
- Columna "Descripción mercancía" con HS + weight + volume para SENIAT
- Modal de asignación al bodeguero: ruta + camión + chofer + validador de capacidad (peso/volumen) + resumen SENIAT por HS code
- Panel "Órdenes activas hoy" con status pills, progreso, capacity bars
- Botón **Cancelar OD** por orden
- Modal contactar camionero (Llamar / WhatsApp / Push)
- Job de geocoding sintético al hacer click en KPI "Sin coordenadas"

### 2 · Reglas de prioridad (Vista 2)
`erp/modules/despacho-rules.jsx` · standalone `Despacho · Vista 2.html`

- Patrón Stripe/Linear · cards plegables con header siempre visible (icono + nombre + tag + resumen + switch + chevron)
- Política maestra **Pago primero anclada** (no se puede apagar; 3 modos: Estricto · Hold · Crédito con whitelist)
- Card opcional **Tier · Gold/Platinum** con lista de clientes elegibles
- Card opcional **Rutas** placeholder con link a Admin
- "Puntos por regla" (renombrado de "Pesos del motor") con sliders y vista previa en vivo
- 2 presets: Equilibrado · FIFO estricto
- Validación de suma ≤ 100
- Selector de tenant per-tenant
- Renames: "Pesos" → **Puntos** · "Pago parcial" → **Abono** · "Carga parcial" → **Carga fraccionada**

### 3 · Bodeguero móvil (Vista 3)
`operario/bodeguero-despacho.jsx` · standalone `Despacho · Vista 3.html`

- **Role picker** al login (Bodeguero / Camionero)
- **Home del bodeguero** post-cierre con resumen de última OD + 2 sub-modos
- **Modo Despachar al camión** (LIFO): banner ruta + timeline de ciudades + cola priorizada por ciudad
- **Modo Recibir mercancía**: selector tipo (mono-cliente / LCL) → lista de contenedores ordenada (sin abrir → en curso → completado) → detalle del contenedor seleccionado
- **Demo escáner**: cámara mock con reticle, animación scan, detección de Shipping Mark a los ~2.4s, actualiza packing list, auto-cierra
- Card de paquete actual con bloque SENIAT (HS + AES + descripción)
- Carga fraccionada (P1/P2) con modal de split, badges, sección "Próximo viaje" en bodega
- Botón "Cerrar carga · entregar al camionero" cuando termina el viaje
- Toggle light/dark + modo "Comparar light + dark" en wrapper
- Banner "OD recibida desde admin" cuando el bridge está activo

### 4 · Transportista móvil
`operario/camionero.jsx` · standalone `Camionero.html`

- Banner ruta del día asignada + camión + chofer
- GPS block con switch + animación pulse + push notification overlay si se apaga
- Card de entrega actual con foto fachada (SVG stylized), datos completos, coords, dirección + referencia
- **Bloque SENIAT** con HS + AES + descripción por paquete
- Botones Llamar (tel:) + WhatsApp (wa.me)
- Modal POD bottom-sheet con foto + firma; confirmar entrega habilitado solo cuando ambos completos
- Lista de próximas entregas + entregadas
- Banner "OD recibida desde bodeguero" cuando el bridge está activo

### 5 · Admin → Administrar rutas (módulo nuevo)
`erp/modules/admin-routes.jsx` · standalone `Admin · Rutas.html`

- Nueva sección en Admin (nivel BÁSICO)
- 4 KPIs · toolbar · listado de rutas
- Drawer editor con CRUD completo: tipo (Directa / Con ciudades intermedias) · origen (selector multi-hub prep) · destino · ciudades intermedias con radio km
- **CityPicker custom** con buscador + "Agregar ciudad nueva al catálogo" inline
- Sub-tab **"Configurable por ciudad"**: catálogo per-tenant con Estado · Municipio · CP IPOSTEL · radio default · HQ · activa · uso
- Selector de tenant
- Renames: "Paradas" → **Ciudades intermedias** en todo el flujo

### 6 · Catálogo Venezuela
`erp/modules/venezuela-catalog.jsx`

- 24 estados + Distrito Capital + Dependencias Federales
- ~85 municipios y ~95 ciudades con códigos postales IPOSTEL reales
- Parroquias y barrios para ciudades operativas
- API `window.VECatalog`: `STATES`, `allCities()`, `findCity()`, `findByPostal()`, `searchCities()`, `getRegions()`, `statesByRegion()`, `stats()`

### 7 · OD Bridge (pipeline localStorage)
`erp/od-bridge.jsx`

- Helper `window.DTDBridge` con `publish()` · `advance()` · `cancel()` · `reassign()` · `subscribe()` · `reset()`
- Pipeline localStorage compartido entre Admin · Bodeguero · Camionero
- Polling 1.5s como fallback al evento `storage` (que no dispara en mismo tab)
- Sincronización del ciclo: creada → cargando → lista → en-ruta → entregada → cerrada · más cancelada

---

## 🧩 Cambios en módulos existentes

### Almacén CN (`erp/modules/cn.jsx`)
- Nueva columna **"Descripción mercancía"** en la tabla con truncado a 2 líneas + tooltip
- Campo **"Descripción de la mercancía interna"** obligatorio en ReceptionForm (oficina CN lo llena)
- Búsqueda incluye descripción
- 7 recepciones mock enriquecidas con descripción real

### Admin (`erp/modules/admin.jsx`)
- Nueva sección "Administrar rutas" en nivel BÁSICO
- Nuevo feature toggle "Ubicación en bodega · pasillo · zona · estante" (default OFF)

### Datos (`erp/data.jsx`)
- WAREHOUSE_CN enriquecido con campo `description` en cada recepción

---

## 🔌 Estado del pipeline OD

Bridge construido + integrado en Vista 1 admin (publish + cancel). Falta cerrar:

- ⚠ Cargar `od-bridge.jsx` en los 3 HTML standalone (path con `·` dio problemas en script automático)
- ⚠ Wire subscribe en bodeguero + camionero (parcial · banner agregado pero no consumo de OD real)

Estos 3 puntos se cierran en 5 minutos manualmente o en próxima sesión.

---

## 🎨 Renames y consolidaciones

| Antes | Ahora | Motivo |
|---|---|---|
| Pesos del motor | Puntos por regla | Más obvio para no-técnicos |
| Pago parcial | Abono | No confundir con Carga parcial |
| Carga parcial | Carga fraccionada | Diferenciar del pago |
| Paradas (en bodeguero) | Ciudades | Operativo más claro |
| Paradas (en Admin Rutas) | Ciudades intermedias | Consistencia |
| Cargar al camión / Despachar (FIFO) | Despachar / Recibir mercancía | Refleja los 2 sub-modos reales del bodeguero |

---

## 🗂 Archivos nuevos

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/bodeguero-despacho.jsx
operario/camionero.jsx

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Camionero.html
```

---

## 📋 Pendientes para próxima sesión (mi lista)

1. Cerrar pipeline bridge (3 cargas de `<script>` + wire bodeguero/camionero al state real)
2. POD del camionero → marca OD entregada automáticamente en admin (vía bridge)
3. Sidebar del ERP reorganizado en grupos (Comercial / Operaciones / Finanzas / Contenidos / Sistema)
4. Registrar módulo Despacho en `ERPShell.MODULES` para que aparezca en sidebar
5. Carga fraccionada P2 genera 2da OD automática
6. Multi-tenant: filtrado real de datos por tenant
7. Registro de clientes (signup) con Shipping Mark auto-generado + foto cédula + foto fachada
8. Geocoding real (Google Maps / Mapbox)
9. Push notifications reales (FCM/APNs)
10. Reportes / dashboard del módulo despacho

---

## 🎯 Lo más valioso construido en la sesión

1. **Flujo end-to-end del módulo Despacho** desde admin → bodeguero → camionero, con role-aware UIs separadas
2. **Motor de reglas configurable** con presets, anclajes y previsualización en vivo
3. **Datos reales venezolanos** (IPOSTEL, estados, municipios) que estructuran direcciones para geocoding futuro
4. **Carga fraccionada** como mecánica operativa explícita
5. **SENIAT compliance** visible en bodeguero + camionero
6. **Demo del escáner** funcional para reuniones de venta
7. **Patrón de cards plegables** (Stripe/Linear) reutilizable en cualquier futuro módulo de reglas

---

## 📅 Addendum · cierre de sesión

### Críticos completados después del changelog inicial

**1 · POD transportista → OD entregada automática** (`operario/camionero.jsx`)
- Cuando el chofer marca la última entrega como POD, llama `DTDBridge.advance(id, 'entregada')`
- El admin ve la OD pasar a 'entregada' en su panel sin tocar nada

**2 · P2 fraccionada genera 2da OD automática** (`operario/bodeguero-despacho.jsx`)
- Cuando bodeguero cierra carga y hay paquetes en "Próximo viaje", el `BridgeCloseHook` avanza la OD actual a 'lista' y publica una OD-V2 nueva con status 'creada' (sin camión/chofer asignado)
- El admin la ve aparecer en "Órdenes activas" para asignarle recursos cuando esté listo el próximo viaje

**3 · Despacho registrado en sidebar del ERP real**
- `Despacho` y `Reglas de despacho` agregados a `erp/shell.jsx` MODULES (grupo OPERACIÓN)
- Scripts cargados en `DTD Studio · ERP.html`: `despacho.jsx`, `despacho-rules.jsx`, `admin-routes.jsx`, `od-bridge.jsx`
- `moduleMap` enchufado a `window.ModuleDespacho` y `window.ModuleDespachoRules`

### Registro de Cliente (módulo nuevo)
`portal/registro.jsx` · standalone `Registro Cliente.html`

- 3 pasos + confirmación: Datos → Dirección VE → Confirmar → Éxito
- Step 1: tipo persona/empresa · nombre · cédula/RIF · foto identidad · email · teléfono + WhatsApp toggle
- Step 2: Estado → Municipio → Ciudad → Barrio en cascada usando `window.VECatalog`, auto-fill de código postal, dirección detallada, punto de referencia, **foto fachada** (que luego usa el camionero)
- Step 3: review completo de datos
- Step 4 éxito: Shipping Mark generado random (`DTD-XXXX`) en card wine destacada
- Mensaje "Bienvenido a la familia de DoorTuDoor Cargo"
- **Guía visual de codificación Shipping Mark** (1 min) plegable con 4 pasos:
  - Pasale el Shipping Mark al proveedor chino
  - Formato de etiqueta visual (mockup con Shipping Mark real)
  - Numerá las cajas Box X/Y
  - Qué pasa después (almacén CN → consolidación → zarpe → aduana → entrega)
- **Botón "Cómo usar tu Shipping Mark"** con animación pulsante wine + chevron rebotando para captar atención
- Email preview con mención de la guía adjunta

### Pipeline bridge cerrado
- `od-bridge.jsx` cargado en los 3 HTML standalone (Vista 1, Vista 3, Camionero)
- Bodeguero y Camionero suscritos al bridge con `useEffect` + banners verdes "OD recibida"
- Polling 1.5s como fallback al evento `storage`
- Admin: botón **Cancelar OD** en cada card de OD activa con `window.confirm` antes de cancelar

### Instrucciones para Claude Code
- Bloque de comentarios al principio de `portal/registro.jsx` indicando dónde leer la nomenclatura oficial (CLAUDE.md + docs internos + template `m-05`)
- Párrafo agregado al header de `HANDOFF.md` con la misma advertencia

---

## 🗂 Archivos nuevos (actualizado)

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/bodeguero-despacho.jsx
operario/camionero.jsx
portal/registro.jsx               ← NUEVO

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Camionero.html
Registro Cliente.html             ← NUEVO

CHANGELOG-sesion.md
```

---

## 📋 Pendientes para próximas sesiones (actualizado)

✅ Cerrados en esta sesión:
- ~~POD transportista → marca OD entregada en admin~~
- ~~Carga fraccionada P2 genera 2da OD~~
- ~~Cancelar OD desde admin~~
- ~~Registrar Despacho en sidebar del ERP~~
- ~~Registro de clientes con Shipping Mark + foto cédula + foto fachada~~

## 📅 Addendum #2 · cierre final de sesión

### A · Pipeline CN → Despacho
- `erp/data-bridge.jsx` con stores: `cnInbox`, `clients`, `rules`, `routes`, `cities`, `rates`
- Vista 1 despacho suscribe a `cnInbox` y mergea paquetes nuevos a la cola
- Almacén CN tiene helper `liberarADespacho(rec)` que publica al inbox

### B · Registro → Clientes shared
- Registro publica al bridge con Shipping Mark secuencial (no random)
- Transportista lee `photoFachada` por Shipping Mark del bridge clientes

### C · Reglas Vista 2 → persistencia
- `despacho-rules.jsx` guarda pesos/policy/rules en bridge al hacer "Guardar"
- `despacho.jsx` (Vista 1) lee del bridge y aplica al scoring

### D · Rutas Admin → bridge
- `admin-routes.jsx` persiste rutas y catálogo de ciudades al bridge
- `despacho.jsx` lee routes del bridge para el filtro

### E · Tasas BCV
- Scrapers publican al bridge al sincronizar (rates store)
- Datos disponibles para módulos de costing/facturas

### Dashboard de despacho (nuevo)
`erp/modules/despacho-dashboard.jsx`
- 5 KPIs: Total ODs · Completadas · On-time % · Tarde/Canceladas · Tiempo prom.
- Ranking de rutas con on-time % y costo/km
- Top 5 ciudades por volumen con barras
- Registrado en sidebar bajo OPERACIÓN

### Audit log (nuevo)
`erp/modules/audit-log.jsx`
- Historial de cambios en Reglas / OD / Rutas / Despacho / POD / Política / Clientes
- Filtro por módulo
- 8 entradas mock realistas
- Registrado en sidebar bajo SISTEMA

### Sidebar con grupos colapsables
- `erp/shell.jsx` · grupos `OPERACIÓN · COMERCIAL · FINANZAS · SISTEMA` ahora clickeables
- Estado persistido en localStorage por usuario
- Chevron rota al abrir/cerrar

### Tasas BCV · scrapers automáticos
- `erp/modules/admin.jsx` agregó card "Fuentes de scraping · automático"
- 4 fuentes mock: BCV · Monitor Dólar VE · DolarToday · PBOC
- Botón sincronizar individual + global, toggle on/off por fuente
- Banner explicativo sobre scraping server-side

### Renames consolidados
- Camionero → **Transportista** (display only · archivos siguen camionero.jsx)

---

## 🔌 Estado del bridge end-to-end

```
ALMACÉN CN          DESPACHO ADMIN          BODEGUERO          TRANSPORTISTA
────────────         ──────────────          ─────────          ─────────────
liberarADespacho()→  cnInbox subscribe       
                     score + cola
                     publish OD            → subscribe          
                                             cargar LIFO
                                             cerrar carga      → subscribe OD
                                                                 GPS + POD
                                                                 advance entregada → admin ve
```

### Pendientes 8-10 para próxima sesión
8. **Validación Shipping Mark server-side** (secuencial real + check duplicados)
9. **Generación de etiquetas PDF** para suppliers chinos con Shipping Mark + Box X/Y
10. **Email de bienvenida real** (template m-05 ya está en `erp/data.jsx`)
11. **Geocoding API real** (Google Maps / Mapbox)
12. **Push notifications reales** (FCM / APNs)

### Archivos nuevos en esta sesión (addendum)
```
erp/data-bridge.jsx
erp/modules/despacho-dashboard.jsx
erp/modules/audit-log.jsx
```


# DTD-Cargo · Changelog de la sesión

Resumen completo de todo lo construido en esta sesión sobre el ERP DTD-Cargo.

---

## 🧱 Módulos construidos

### 1 · Despacho admin (Vista 1)
`erp/modules/despacho.jsx` · standalone `Despacho · Vista 1.html`

- Cola priorizada de paquetes pendientes con drag & drop manual
- 5 KPIs: pendientes · listos · atrasados · días promedio · sin coordenadas
- 5 filtros: ciudad · barrio (dependiente) · pago · días · ruta
- Score 0–100 con motor de reglas; badges de prioridad por color
- Badge Tier (Gold/Platinum) inline en cada paquete
- Columna "Descripción mercancía" con HS + weight + volume para SENIAT
- Modal de asignación al bodeguero: ruta + camión + chofer + validador de capacidad (peso/volumen) + resumen SENIAT por HS code
- Panel "Órdenes activas hoy" con status pills, progreso, capacity bars
- Botón **Cancelar OD** por orden
- Modal contactar camionero (Llamar / WhatsApp / Push)
- Job de geocoding sintético al hacer click en KPI "Sin coordenadas"

### 2 · Reglas de prioridad (Vista 2)
`erp/modules/despacho-rules.jsx` · standalone `Despacho · Vista 2.html`

- Patrón Stripe/Linear · cards plegables con header siempre visible (icono + nombre + tag + resumen + switch + chevron)
- Política maestra **Pago primero anclada** (no se puede apagar; 3 modos: Estricto · Hold · Crédito con whitelist)
- Card opcional **Tier · Gold/Platinum** con lista de clientes elegibles
- Card opcional **Rutas** placeholder con link a Admin
- "Puntos por regla" (renombrado de "Pesos del motor") con sliders y vista previa en vivo
- 2 presets: Equilibrado · FIFO estricto
- Validación de suma ≤ 100
- Selector de tenant per-tenant
- Renames: "Pesos" → **Puntos** · "Pago parcial" → **Abono** · "Carga parcial" → **Carga fraccionada**

### 3 · Bodeguero móvil (Vista 3)
`operario/bodeguero-despacho.jsx` · standalone `Despacho · Vista 3.html`

- **Role picker** al login (Bodeguero / Camionero)
- **Home del bodeguero** post-cierre con resumen de última OD + 2 sub-modos
- **Modo Despachar al camión** (LIFO): banner ruta + timeline de ciudades + cola priorizada por ciudad
- **Modo Recibir mercancía**: selector tipo (mono-cliente / LCL) → lista de contenedores ordenada (sin abrir → en curso → completado) → detalle del contenedor seleccionado
- **Demo escáner**: cámara mock con reticle, animación scan, detección de Shipping Mark a los ~2.4s, actualiza packing list, auto-cierra
- Card de paquete actual con bloque SENIAT (HS + AES + descripción)
- Carga fraccionada (P1/P2) con modal de split, badges, sección "Próximo viaje" en bodega
- Botón "Cerrar carga · entregar al camionero" cuando termina el viaje
- Toggle light/dark + modo "Comparar light + dark" en wrapper
- Banner "OD recibida desde admin" cuando el bridge está activo

### 4 · Transportista móvil
`operario/camionero.jsx` · standalone `Camionero.html`

- Banner ruta del día asignada + camión + chofer
- GPS block con switch + animación pulse + push notification overlay si se apaga
- Card de entrega actual con foto fachada (SVG stylized), datos completos, coords, dirección + referencia
- **Bloque SENIAT** con HS + AES + descripción por paquete
- Botones Llamar (tel:) + WhatsApp (wa.me)
- Modal POD bottom-sheet con foto + firma; confirmar entrega habilitado solo cuando ambos completos
- Lista de próximas entregas + entregadas
- Banner "OD recibida desde bodeguero" cuando el bridge está activo

### 5 · Admin → Administrar rutas (módulo nuevo)
`erp/modules/admin-routes.jsx` · standalone `Admin · Rutas.html`

- Nueva sección en Admin (nivel BÁSICO)
- 4 KPIs · toolbar · listado de rutas
- Drawer editor con CRUD completo: tipo (Directa / Con ciudades intermedias) · origen (selector multi-hub prep) · destino · ciudades intermedias con radio km
- **CityPicker custom** con buscador + "Agregar ciudad nueva al catálogo" inline
- Sub-tab **"Configurable por ciudad"**: catálogo per-tenant con Estado · Municipio · CP IPOSTEL · radio default · HQ · activa · uso
- Selector de tenant
- Renames: "Paradas" → **Ciudades intermedias** en todo el flujo

### 6 · Catálogo Venezuela
`erp/modules/venezuela-catalog.jsx`

- 24 estados + Distrito Capital + Dependencias Federales
- ~85 municipios y ~95 ciudades con códigos postales IPOSTEL reales
- Parroquias y barrios para ciudades operativas
- API `window.VECatalog`: `STATES`, `allCities()`, `findCity()`, `findByPostal()`, `searchCities()`, `getRegions()`, `statesByRegion()`, `stats()`

### 7 · OD Bridge (pipeline localStorage)
`erp/od-bridge.jsx`

- Helper `window.DTDBridge` con `publish()` · `advance()` · `cancel()` · `reassign()` · `subscribe()` · `reset()`
- Pipeline localStorage compartido entre Admin · Bodeguero · Camionero
- Polling 1.5s como fallback al evento `storage` (que no dispara en mismo tab)
- Sincronización del ciclo: creada → cargando → lista → en-ruta → entregada → cerrada · más cancelada

---

## 🧩 Cambios en módulos existentes

### Almacén CN (`erp/modules/cn.jsx`)
- Nueva columna **"Descripción mercancía"** en la tabla con truncado a 2 líneas + tooltip
- Campo **"Descripción de la mercancía interna"** obligatorio en ReceptionForm (oficina CN lo llena)
- Búsqueda incluye descripción
- 7 recepciones mock enriquecidas con descripción real

### Admin (`erp/modules/admin.jsx`)
- Nueva sección "Administrar rutas" en nivel BÁSICO
- Nuevo feature toggle "Ubicación en bodega · pasillo · zona · estante" (default OFF)

### Datos (`erp/data.jsx`)
- WAREHOUSE_CN enriquecido con campo `description` en cada recepción

---

## 🔌 Estado del pipeline OD

Bridge construido + integrado en Vista 1 admin (publish + cancel). Falta cerrar:

- ⚠ Cargar `od-bridge.jsx` en los 3 HTML standalone (path con `·` dio problemas en script automático)
- ⚠ Wire subscribe en bodeguero + camionero (parcial · banner agregado pero no consumo de OD real)

Estos 3 puntos se cierran en 5 minutos manualmente o en próxima sesión.

---

## 🎨 Renames y consolidaciones

| Antes | Ahora | Motivo |
|---|---|---|
| Pesos del motor | Puntos por regla | Más obvio para no-técnicos |
| Pago parcial | Abono | No confundir con Carga parcial |
| Carga parcial | Carga fraccionada | Diferenciar del pago |
| Paradas (en bodeguero) | Ciudades | Operativo más claro |
| Paradas (en Admin Rutas) | Ciudades intermedias | Consistencia |
| Cargar al camión / Despachar (FIFO) | Despachar / Recibir mercancía | Refleja los 2 sub-modos reales del bodeguero |

---

## 🗂 Archivos nuevos

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/bodeguero-despacho.jsx
operario/camionero.jsx

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Camionero.html
```

---

## 📋 Pendientes para próxima sesión (mi lista)

1. Cerrar pipeline bridge (3 cargas de `<script>` + wire bodeguero/camionero al state real)
2. POD del camionero → marca OD entregada automáticamente en admin (vía bridge)
3. Sidebar del ERP reorganizado en grupos (Comercial / Operaciones / Finanzas / Contenidos / Sistema)
4. Registrar módulo Despacho en `ERPShell.MODULES` para que aparezca en sidebar
5. Carga fraccionada P2 genera 2da OD automática
6. Multi-tenant: filtrado real de datos por tenant
7. Registro de clientes (signup) con Shipping Mark auto-generado + foto cédula + foto fachada
8. Geocoding real (Google Maps / Mapbox)
9. Push notifications reales (FCM/APNs)
10. Reportes / dashboard del módulo despacho

---

## 🎯 Lo más valioso construido en la sesión

1. **Flujo end-to-end del módulo Despacho** desde admin → bodeguero → camionero, con role-aware UIs separadas
2. **Motor de reglas configurable** con presets, anclajes y previsualización en vivo
3. **Datos reales venezolanos** (IPOSTEL, estados, municipios) que estructuran direcciones para geocoding futuro
4. **Carga fraccionada** como mecánica operativa explícita
5. **SENIAT compliance** visible en bodeguero + camionero
6. **Demo del escáner** funcional para reuniones de venta
7. **Patrón de cards plegables** (Stripe/Linear) reutilizable en cualquier futuro módulo de reglas

---

## 📅 Addendum · cierre de sesión

### Críticos completados después del changelog inicial

**1 · POD transportista → OD entregada automática** (`operario/camionero.jsx`)
- Cuando el chofer marca la última entrega como POD, llama `DTDBridge.advance(id, 'entregada')`
- El admin ve la OD pasar a 'entregada' en su panel sin tocar nada

**2 · P2 fraccionada genera 2da OD automática** (`operario/bodeguero-despacho.jsx`)
- Cuando bodeguero cierra carga y hay paquetes en "Próximo viaje", el `BridgeCloseHook` avanza la OD actual a 'lista' y publica una OD-V2 nueva con status 'creada' (sin camión/chofer asignado)
- El admin la ve aparecer en "Órdenes activas" para asignarle recursos cuando esté listo el próximo viaje

**3 · Despacho registrado en sidebar del ERP real**
- `Despacho` y `Reglas de despacho` agregados a `erp/shell.jsx` MODULES (grupo OPERACIÓN)
- Scripts cargados en `DTD Studio · ERP.html`: `despacho.jsx`, `despacho-rules.jsx`, `admin-routes.jsx`, `od-bridge.jsx`
- `moduleMap` enchufado a `window.ModuleDespacho` y `window.ModuleDespachoRules`

### Registro de Cliente (módulo nuevo)
`portal/registro.jsx` · standalone `Registro Cliente.html`

- 3 pasos + confirmación: Datos → Dirección VE → Confirmar → Éxito
- Step 1: tipo persona/empresa · nombre · cédula/RIF · foto identidad · email · teléfono + WhatsApp toggle
- Step 2: Estado → Municipio → Ciudad → Barrio en cascada usando `window.VECatalog`, auto-fill de código postal, dirección detallada, punto de referencia, **foto fachada** (que luego usa el camionero)
- Step 3: review completo de datos
- Step 4 éxito: Shipping Mark generado random (`DTD-XXXX`) en card wine destacada
- Mensaje "Bienvenido a la familia de DoorTuDoor Cargo"
- **Guía visual de codificación Shipping Mark** (1 min) plegable con 4 pasos:
  - Pasale el Shipping Mark al proveedor chino
  - Formato de etiqueta visual (mockup con Shipping Mark real)
  - Numerá las cajas Box X/Y
  - Qué pasa después (almacén CN → consolidación → zarpe → aduana → entrega)
- **Botón "Cómo usar tu Shipping Mark"** con animación pulsante wine + chevron rebotando para captar atención
- Email preview con mención de la guía adjunta

### Pipeline bridge cerrado
- `od-bridge.jsx` cargado en los 3 HTML standalone (Vista 1, Vista 3, Camionero)
- Bodeguero y Camionero suscritos al bridge con `useEffect` + banners verdes "OD recibida"
- Polling 1.5s como fallback al evento `storage`
- Admin: botón **Cancelar OD** en cada card de OD activa con `window.confirm` antes de cancelar

### Instrucciones para Claude Code
- Bloque de comentarios al principio de `portal/registro.jsx` indicando dónde leer la nomenclatura oficial (CLAUDE.md + docs internos + template `m-05`)
- Párrafo agregado al header de `HANDOFF.md` con la misma advertencia

---

## 🗂 Archivos nuevos (actualizado)

```
erp/modules/despacho.jsx
erp/modules/despacho-rules.jsx
erp/modules/admin-routes.jsx
erp/modules/venezuela-catalog.jsx
erp/od-bridge.jsx
operario/bodeguero-despacho.jsx
operario/camionero.jsx
portal/registro.jsx               ← NUEVO

Despacho · Vista 1.html
Despacho · Vista 2.html
Despacho · Vista 3.html
Admin · Rutas.html
Camionero.html
Registro Cliente.html             ← NUEVO

CHANGELOG-sesion.md
```

---

## 📋 Pendientes para próximas sesiones (actualizado)

✅ Cerrados en esta sesión:
- ~~POD transportista → marca OD entregada en admin~~
- ~~Carga fraccionada P2 genera 2da OD~~
- ~~Cancelar OD desde admin~~
- ~~Registrar Despacho en sidebar del ERP~~
- ~~Registro de clientes con Shipping Mark + foto cédula + foto fachada~~

## 📅 Addendum #2 · cierre final de sesión

### A · Pipeline CN → Despacho
- `erp/data-bridge.jsx` con stores: `cnInbox`, `clients`, `rules`, `routes`, `cities`, `rates`
- Vista 1 despacho suscribe a `cnInbox` y mergea paquetes nuevos a la cola
- Almacén CN tiene helper `liberarADespacho(rec)` que publica al inbox

### B · Registro → Clientes shared
- Registro publica al bridge con Shipping Mark secuencial (no random)
- Transportista lee `photoFachada` por Shipping Mark del bridge clientes

### C · Reglas Vista 2 → persistencia
- `despacho-rules.jsx` guarda pesos/policy/rules en bridge al hacer "Guardar"
- `despacho.jsx` (Vista 1) lee del bridge y aplica al scoring

### D · Rutas Admin → bridge
- `admin-routes.jsx` persiste rutas y catálogo de ciudades al bridge
- `despacho.jsx` lee routes del bridge para el filtro

### E · Tasas BCV
- Scrapers publican al bridge al sincronizar (rates store)
- Datos disponibles para módulos de costing/facturas

### Dashboard de despacho (nuevo)
`erp/modules/despacho-dashboard.jsx`
- 5 KPIs: Total ODs · Completadas · On-time % · Tarde/Canceladas · Tiempo prom.
- Ranking de rutas con on-time % y costo/km
- Top 5 ciudades por volumen con barras
- Registrado en sidebar bajo OPERACIÓN

### Audit log (nuevo)
`erp/modules/audit-log.jsx`
- Historial de cambios en Reglas / OD / Rutas / Despacho / POD / Política / Clientes
- Filtro por módulo
- 8 entradas mock realistas
- Registrado en sidebar bajo SISTEMA

### Sidebar con grupos colapsables
- `erp/shell.jsx` · grupos `OPERACIÓN · COMERCIAL · FINANZAS · SISTEMA` ahora clickeables
- Estado persistido en localStorage por usuario
- Chevron rota al abrir/cerrar

### Tasas BCV · scrapers automáticos
- `erp/modules/admin.jsx` agregó card "Fuentes de scraping · automático"
- 4 fuentes mock: BCV · Monitor Dólar VE · DolarToday · PBOC
- Botón sincronizar individual + global, toggle on/off por fuente
- Banner explicativo sobre scraping server-side

### Renames consolidados
- Camionero → **Transportista** (display only · archivos siguen camionero.jsx)

---

## 🔌 Estado del bridge end-to-end

```
ALMACÉN CN          DESPACHO ADMIN          BODEGUERO          TRANSPORTISTA
────────────         ──────────────          ─────────          ─────────────
liberarADespacho()→  cnInbox subscribe       
                     score + cola
                     publish OD            → subscribe          
                                             cargar LIFO
                                             cerrar carga      → subscribe OD
                                                                 GPS + POD
                                                                 advance entregada → admin ve
```

### Pendientes 8-10 para próxima sesión
8. **Validación Shipping Mark server-side** (secuencial real + check duplicados)
9. **Generación de etiquetas PDF** para suppliers chinos con Shipping Mark + Box X/Y
10. **Email de bienvenida real** (template m-05 ya está en `erp/data.jsx`)
11. **Geocoding API real** (Google Maps / Mapbox)
12. **Push notifications reales** (FCM / APNs)

### Archivos nuevos en esta sesión (addendum)
```
erp/data-bridge.jsx
erp/modules/despacho-dashboard.jsx
erp/modules/audit-log.jsx
```


---
---

## 📅 ANEXO B · Changelog · Calendario operativo + Detección de ferias/feriados con IA

Módulo afectado: **Calendario** (`erp/modules/calendar.jsx`)
Módulo nuevo: **`erp/modules/fairs-detection.jsx`** (motor de detección + panel)
Carga en: `DTD Studio · ERP.html` (script agregado antes de `calendar.jsx`)

Todo dentro del sistema de marca: solo tokens `var(--*)`, componentes existentes
(`Tabs`, `Card`, `Badge`, `Btn`, `Input`, `Modal`), íconos de `window.Icon`,
fuentes oficiales. Cero colores/fuentes inventados.

---

## 1 · Filtros del calendario (comentario de Sam)

Panel de filtros reorganizado en **5 categorías**:
1. **Contenedores** (con subtoggles ETD · zarpes / ETA · arribos / POD · entregas)
2. **Feriados de China**
3. **Feriados de Venezuela**
4. **Ferias internacionales**
5. **Otros requerimientos pendientes** (deadlines operativos)

- Chips nuevos en el calendario: ferias (pill azul con globo) y requerimientos
  (pill punteada con reloj), más sus entradas en la leyenda.
- Mock data agregada: `FAIRS_CN`, `FAIRS_VE`, `PENDING_REQS` y fuentes.

## 2 · Pestañas de ferias (comentario de Sam)

Sobre el calendario: tabs **Calendario · Ferias China · Ferias Venezuela**.
Cada pestaña de país muestra tabla de ferias (feria, ciudad, sector, fechas,
estado: próxima/en curso/finalizada) + barra lateral de fuentes.

## 3 · Detección con IA (real, vía `window.claude.complete`)

Mismo motor para las dos pestañas. Flujo **Detectar → Revisar → Aprobar**:
- Botón **"Buscar ferias (IA)"** → propone candidatas estructuradas (nombre,
  ciudad, sector, fechas, fuente, evidencia y **nivel de confianza** alta/media/baja).
- **Bandeja de revisión** con filtros para no inundar el calendario: confianza
  (segmentado con conteos), sector y búsqueda por texto.
- **Aprobación** por tarjeta (Aprobar / Editar / Descartar) o masiva
  ("Aprobar N visibles", respeta filtros). Nada se publica solo.
- Aprobadas → entran al calendario con badge **"IA"** (se pueden quitar).
- Descartadas → **historial** con "Restaurar"; no se vuelven a sugerir.
- Dedup por firma (nombre + mes) contra calendario y descartadas.

## 4 · Sincronización + fuentes + auditoría

- **Sincronización automática** · cada **domingo** + botón discreto "actualizar
  ahora"; indicador de **última sincronización**.
- **Fuentes de la IA**: lista por país, alta sutil de nuevas fuentes (nombre +
  dominio).
- **Auditoría**: cada acción (aprobar/descartar/restaurar/quitar) queda registrada
  con estructura `{ usuario, rol, acción, feria, origen (IA/manual), confianza, fecha }`,
  usando el **usuario activo** del ERP. Visible en tarjeta "Auditoría".

## 5 · Exportar ICS

El botón **"Exportar ICS"** genera y descarga un `.ics` válido con todos los
eventos (zarpes, arribos, entregas, feriados, ferias y pendientes), importable a
Google/Outlook. La vista por día/semana ya la cubren las pestañas Agenda y Semana.

## 6 · Feriados por IA (switch Ferias | Feriados)

Dentro de cada pestaña de país, switch **`Ferias | Feriados`** que reusa el motor:
- "Buscar feriados (IA)" propone feriados oficiales (incluye períodos largos:
  Año Nuevo Chino, Golden Week) con confianza graduada.
- Bandeja adaptada: tarjetas sin ciudad/sector, sin filtro de sector, con
  evidencia + fuente oficial (gov.cn, gacetaoficial.gob.ve, etc.).
- Aprobar suma el feriado al calendario (badge "IA"), respeta los filtros
  "Feriados de China/Venezuela", auditoría e historial independientes de las ferias.
- Store namespaced por `(tipo: feria|feriado) × país`.

### Fix incluido
- Desfase de zona horaria: `new Date('YYYY-MM-DD')` se parseaba como UTC y mostraba
  los feriados un día antes. Corregido parseando como fecha local (`_fdPD`).

---

## Pendientes (decisiones / producción)

1. **Scraping real** — sin decidir el "cómo" (scraping directo vs. búsqueda
   asistida + fetch de confirmación). Hoy la IA descubre y normaliza; conviene
   verificar fechas de confianza media/baja antes de confiar.
2. **Persistencia compartida** — estructura de datos lista, pero compartir entre
   usuarios requiere backend (hoy es por navegador / localStorage).

## Notas técnicas

- Las llamadas a la IA en el prototipo usan `claude-haiku-4-5` (cuota del usuario,
  tardan unos segundos). Es una demo funcional del concepto, no el scraping de
  producción.
- Persistencia local en `localStorage` clave `dtd-fair-store`.


# Changelog · Calendario operativo + Detección de ferias/feriados con IA

Módulo afectado: **Calendario** (`erp/modules/calendar.jsx`)
Módulo nuevo: **`erp/modules/fairs-detection.jsx`** (motor de detección + panel)
Carga en: `DTD Studio · ERP.html` (script agregado antes de `calendar.jsx`)

Todo dentro del sistema de marca: solo tokens `var(--*)`, componentes existentes
(`Tabs`, `Card`, `Badge`, `Btn`, `Input`, `Modal`), íconos de `window.Icon`,
fuentes oficiales. Cero colores/fuentes inventados.

---

## 1 · Filtros del calendario (comentario de Sam)

Panel de filtros reorganizado en **5 categorías**:
1. **Contenedores** (con subtoggles ETD · zarpes / ETA · arribos / POD · entregas)
2. **Feriados de China**
3. **Feriados de Venezuela**
4. **Ferias internacionales**
5. **Otros requerimientos pendientes** (deadlines operativos)

- Chips nuevos en el calendario: ferias (pill azul con globo) y requerimientos
  (pill punteada con reloj), más sus entradas en la leyenda.
- Mock data agregada: `FAIRS_CN`, `FAIRS_VE`, `PENDING_REQS` y fuentes.

## 2 · Pestañas de ferias (comentario de Sam)

Sobre el calendario: tabs **Calendario · Ferias China · Ferias Venezuela**.
Cada pestaña de país muestra tabla de ferias (feria, ciudad, sector, fechas,
estado: próxima/en curso/finalizada) + barra lateral de fuentes.

## 3 · Detección con IA (real, vía `window.claude.complete`)

Mismo motor para las dos pestañas. Flujo **Detectar → Revisar → Aprobar**:
- Botón **"Buscar ferias (IA)"** → propone candidatas estructuradas (nombre,
  ciudad, sector, fechas, fuente, evidencia y **nivel de confianza** alta/media/baja).
- **Bandeja de revisión** con filtros para no inundar el calendario: confianza
  (segmentado con conteos), sector y búsqueda por texto.
- **Aprobación** por tarjeta (Aprobar / Editar / Descartar) o masiva
  ("Aprobar N visibles", respeta filtros). Nada se publica solo.
- Aprobadas → entran al calendario con badge **"IA"** (se pueden quitar).
- Descartadas → **historial** con "Restaurar"; no se vuelven a sugerir.
- Dedup por firma (nombre + mes) contra calendario y descartadas.

## 4 · Sincronización + fuentes + auditoría

- **Sincronización automática** · cada **domingo** + botón discreto "actualizar
  ahora"; indicador de **última sincronización**.
- **Fuentes de la IA**: lista por país, alta sutil de nuevas fuentes (nombre +
  dominio).
- **Auditoría**: cada acción (aprobar/descartar/restaurar/quitar) queda registrada
  con estructura `{ usuario, rol, acción, feria, origen (IA/manual), confianza, fecha }`,
  usando el **usuario activo** del ERP. Visible en tarjeta "Auditoría".

## 5 · Exportar ICS

El botón **"Exportar ICS"** genera y descarga un `.ics` válido con todos los
eventos (zarpes, arribos, entregas, feriados, ferias y pendientes), importable a
Google/Outlook. La vista por día/semana ya la cubren las pestañas Agenda y Semana.

## 6 · Feriados por IA (switch Ferias | Feriados)

Dentro de cada pestaña de país, switch **`Ferias | Feriados`** que reusa el motor:
- "Buscar feriados (IA)" propone feriados oficiales (incluye períodos largos:
  Año Nuevo Chino, Golden Week) con confianza graduada.
- Bandeja adaptada: tarjetas sin ciudad/sector, sin filtro de sector, con
  evidencia + fuente oficial (gov.cn, gacetaoficial.gob.ve, etc.).
- Aprobar suma el feriado al calendario (badge "IA"), respeta los filtros
  "Feriados de China/Venezuela", auditoría e historial independientes de las ferias.
- Store namespaced por `(tipo: feria|feriado) × país`.

### Fix incluido
- Desfase de zona horaria: `new Date('YYYY-MM-DD')` se parseaba como UTC y mostraba
  los feriados un día antes. Corregido parseando como fecha local (`_fdPD`).

---

## Pendientes (decisiones / producción)

1. **Scraping real** — sin decidir el "cómo" (scraping directo vs. búsqueda
   asistida + fetch de confirmación). Hoy la IA descubre y normaliza; conviene
   verificar fechas de confianza media/baja antes de confiar.
2. **Persistencia compartida** — estructura de datos lista, pero compartir entre
   usuarios requiere backend (hoy es por navegador / localStorage).

## Notas técnicas

- Las llamadas a la IA en el prototipo usan `claude-haiku-4-5` (cuota del usuario,
  tardan unos segundos). Es una demo funcional del concepto, no el scraping de
  producción.
- Persistencia local en `localStorage` clave `dtd-fair-store`.

