# SYNC NORTE · 2026-06-14 · Brand Book v4.2

> **Para Claude Code:** este documento resume TODO lo que debes aplicar en Norte desde este
> proyecto (la fuente de verdad de la marca — ver CLAUDE.md §Sincronización). Aplica en orden.
> Ante conflicto entre Norte y este proyecto, **gana este proyecto**.

> **Versión vigente: v4.2 (2026-06-14).** Reemplaza el sync anterior (v3.7 · 2026-06-10), que
> queda como historial.

---

## 0 · Versión única visible → **v4.2**

Toda etiqueta de versión visible dice **v4.2**. Ya aplicado en este proyecto; espejar en Norte:
- **Brand Book renombrado:** `Brand Book DTD v3.7.html` → **`Brand Book DTD v4.2.html`**. Eliminá el v3.7 (y cualquier book anterior) de Norte; el vigente es único. Actualizá TODO puntero al nombre nuevo.
- Sidebar ERP (`erp/shell.jsx`): `ERP · v4.2`.
- Badges de módulo: Scorecard, Academia, Dashboard ejecutivo → `v4.2`.
- Títulos de apps: Bodeguero VE, Camionero (y demás apps de operario/Portal) → `v4.2`.
- Tokens (`erp/tokens.css`) y pointers (Brand Hub, `admin.jsx`, `admin-brand.jsx`, `CLAUDE.md`, `HANDOFF.md`) → `v4.2` / nombre nuevo.
- Lo histórico (CHANGELOG, comentarios que fechan features) NO se reescribe.

---

## 1 · Eliminar en Norte (reemplazado o archivado)

> **Terminología · MARKBOX vs Shipping Mark (decisión 2026-06-14, split confirmado):**
> El **sitio público / marketing** (`www.dtdcargo.com`) usa **"MARKBOX"** de cara al visitante —
> es el término comercial que el público reconoce. El **producto interno (ERP, Portal, apps de
> operario) y el lenguaje con proveedor chino** usan **"Shipping Mark" (唛头)**. NO unificar: es
> un split intencional por audiencia (igual que Compra/Orden/Prealerta). El **valor** del código
> (`DTD-XXXX`) y las claves (`markbox:`) no cambian en ningún caso.

| Qué | Por qué |
|---|---|
| **`Brand Book DTD v3.7.html`** y cualquier book anterior | El vigente es ÚNICO: `Brand Book DTD v4.2.html`. Historial en su changelog interno. |
| `portal-cotizador/` (cotizador self-service viejo) | Descartado — el cotizador del cliente es la **Calculadora CBM** (única). |
| Toda referencia visual a **"MARKBOX"** | Término eliminado del lenguaje visual (única etiqueta: Shipping Mark / 唛头). |

## 2 · Estructura: Marca vs. Producto (decisión v4.2)

> **Favicon (decisión 2026-06-14):** el set canónico es **`favicon-pack/`** de este proyecto
> (favicon.ico, 16/32/48, apple-touch-icon, android-chrome 192/512, maskable-512, site.webmanifest)
> — cuadrado navy redondeado con el isólogo. En Norte, **reemplazá los favicons del sitio
> (`public/brand/favicon*`) por los de `favicon-pack/`** (hoy difieren). Es el único cambio de
> favicon de este ciclo.


- **Brand Hub** (`Brand Hub · DTD-Cargo.html`) = índice **solo de marca** (Fundamentos, Generadores, Operativo, Impreso, Mensajería). Servir como `/marca` o `/brand-hub` interno.
- **DTD Apps · Launcher** (`DTD Apps · Launcher.html`) = índice de **producto/apps** (ERP, Portales, módulos, apps de operario, plantillas de inspección, Inventario, Reclamos). Servir como `/apps`.
- No mezclar: el Portal/ERP/módulos NO van en el Brand Hub; los assets de marca NO van en el Launcher. Ambos se enlazan mutuamente y desde el sidebar del ERP (grupo Sistema: "Apps · Launcher" + "Brand Hub · marca").

## 3 · Va al BRANDING (Brand Hub / Brand Book §08)

Herramientas y colateral de marca — copiar completas, enlazadas en el Brand Hub:

| Archivo | Qué es |
|---|---|
| `packlist/Packing List + Factura · DTD-Cargo.html` (+ `packlist.js`) | Documento 2-en-1 bilingüe 中文/Español que el proveedor llena (Shipping Mark, mercancía, totales auto, reglas de bodega). Reemplaza el Excel manual. |
| `firmas/Firma de Email · DTD-Cargo.html` (+ `firma.js`) | Generador de firmas del equipo · 3 formatos · isólogo base64 · copia a Gmail/Outlook. Alinear con `erp/modules/mailing-signatures.jsx`. |
| `packaging/Packaging Logístico · DTD-Cargo.html` | Cinta de embalaje, sellos/stickers de caja (Frágil 易碎 · Este lado arriba · Shipping Mark con QR) y precinto de contenedor. Spec de imprenta. |
| `cotizacion/Cotización DDP · DTD-Cargo.html` (+ `cotizacion.js`) | Documento comercial editable A4 + **cotizador interno rápido** (lee la tarifa del ERP). |
| `plantilla-deck/Plantilla de Presentación · DTD-Cargo.html` (+ `deck-stage.js`) | Deck maestro de marca · 9 layouts. Para propuestas, cursos de Alibaba, ferias. |
| `marca/Asistente de Contenido · DTD-Cargo.html` | Generador de copy on-brand (IA) con la voz de DTD baked-in. En prod apuntar a la API de Claude propia. |
| `diplomas/Diploma · DTD-Cargo.html` (+ `diploma.js`) | Generador de diplomas A4 · 4 diseños · sello + QR + doble firma. Conecta con Academia/LMS. |
| `Kit de Bienvenida · DTD-Cargo.html` | Onboarding del cliente nuevo (Shipping Mark, ciclo 4 pasos, reglas de oro). 1 página, PDF/email. |
| `Tarjeta de Presentación.html` | Ahora **editable por empleado** ("+ Tu tarjeta": nombre/cargo/tel/email → tarjeta + QR vCard + .vcf en vivo). |
| `Reels y Logo Sonoro · DTD-Cargo.html` | Plantillas verticales 9:16 (reels/stories) + **logo sonoro** (firma de audio Web Audio, de referencia para el productor). |
| `Uniformes · DTD-Cargo.html` | Configurador de indumentaria (hombre): camiseta/camisa ejecutiva M/L, tamaño de logo en mm, posición, palabra. |
| `ciclo/Ciclo DTD · Variantes de marca.html` (+ `cycles-themed.jsx`) | 3 conceptos del ciclo × navy/blanco. Activo de marca para slides/cursos. |
| `fondos/`, `Piezas 3D · Aviso de Fachada · DTD-Cargo.html` | Fondos de pantalla (Windows/teléfono/Trello/videollamada) y piezas 3D del aviso — enlazados en Hub/Book. |

**Hero web `www.dtdcargo.com`:** rediseño del **Ciclo del Cliente** reemplaza el badge "360°" — ver `ciclo/HANDOFF-NORTE-ciclo-cliente-2026-06-13.md` (versión final SIN contenedor de fondo).

## 4 · Va al ERP / PRODUCTO (Launcher + módulos)

| Archivo / cambio | Qué es |
|---|---|
| `Inventario de Consolidación · DTD-Cargo.html` (+ `inventario/inventario.jsx`) | **WMS**: stock real CN/VE por Shipping Mark, ocupación de contenedor, cola de consolidación. Nuevo módulo de Operación. En prod: alimentar del escaneo en bodega + API. |
| `Reclamos y Siniestros · DTD-Cargo.html` (+ `reclamos/reclamos.jsx`) | **Incidencias + seguro**: daño/faltante/retraso atados a la orden, flujo Reportado→Evaluación→Resolución, cobertura. Brief de seguro en `legal/`. |
| `academia/Academia DTD · Módulo.html` (+ `academia.js`) | LMS: cursos, inscritos, asistencia → emite diplomas (precarga el generador). |
| `proveedores/Scorecard de Proveedores · DTD-Cargo.html` (+ `scorecard.js`) | KPIs por proveedor (puntualidad/calidad/rechazos, rating A–D) + reclamos. |
| `direccion/Dashboard Ejecutivo · DTD-Cargo.html` | KPIs de Dirección: ingresos, margen, embarques, DSO, ocupación, top rutas por margen. |
| **Calculadora CBM** (`calc/cbm-variants.jsx`) | Botón WhatsApp **genera estimado `E-2026-XXXX`**: logueado→ligado al Shipping Mark; no logueado→mini-form (nombre/email/tel) y se liga al registrarse (`linkEstimadosByContact` en `erp/data-bridge.jsx`, llamado desde `portal/registro.jsx` y `portal/mobile.jsx`). |
| **Puente de tarifa** (`dtd-tarifa-cbm` en `data-bridge.jsx`) | El módulo Tarifas del ERP (`rates.jsx`, tarjeta "Tarifa base · calculadora pública") escribe `{rate, validUntil}`; la calculadora, el cotizador rápido y el Estimador (`estimados.jsx`) lo leen. Una sola fuente de verdad del $/CBM con vigencia. |
| **Ciclo comercial** | Franja Estimado→Aprobado→Facturado en Facturas del Portal (`portal/app.jsx`) y en Facturación del ERP (`invoices.jsx`). |
| **Portal** | "Nueva cotización" → **"Solicitar un servicio"** (menú de servicios, todo termina en estimado); "Calculadora CBM" con sub-rótulo "Generar estimado". Sidebar ERP: toggle del logo colapsa/expande. |

## 5 · Tokens y reglas (CLAUDE.md)

- `CLAUDE.md` vigente reemplaza el de Norte. Sin cambios de tokens este ciclo (verificar por diff). Reglas de Shipping Mark / Compra-Orden-Prealerta intactas.

## 6 · Al terminar

1. Registrar en bitácora de Norte: **"marca sincronizada a Brand Book v4.2 · sync 2026-06-14"**.
2. Confirmar: book único v4.2 (cero v3.x/v2.x visibles), Brand Hub solo-marca + Launcher solo-producto, cero "MARKBOX" visual, cero voseo.
3. RIF oficial `J-50648869-8` en todo Norte. Datos: info@dtdcargo.com · +58 241 414 7886 · Av. Bolívar Norte 14, Valencia.
4. Backend: cada seam nuevo (`dtd-tarifa-cbm`, estimados con contacto, inventario, reclamos) se mapea en `backend/API-CONTRACT.md`.
