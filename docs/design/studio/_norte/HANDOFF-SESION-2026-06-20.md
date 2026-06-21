# Handoff a Norte (Claude Code) · v4.4 → v4.5 · 2026-06-20

> **Fuente de verdad = este proyecto** (prototipo/diseño). Aplicar sobre el repo de
> producción ("Norte") respetando `CLAUDE.md` (tokens, fuentes, sin AI slop) y el protocolo
> §SYNC-Norte. Ante conflicto entre algo viejo de Norte y este proyecto, **gana este proyecto**.
> Detalle largo en `CHANGELOG.md` (entrada 2026-06-20). Decisión registrada: `BRAND-DECISIONS.md` **BD-015**.

---

## 1. Versión única → v4.5
Marca y producto comparten número visible. Bumpear **v4.4 → v4.5** en todo lo visible de Norte:
- Brand Book **renombrado**: `Brand Book DTD v4.4.html` → **`Brand Book DTD v4.5.html`** (portada, cover, sidebar, footer, cierre; **fila v4.5 nueva** en el changelog interno, se conserva la fila v4.4 como historia).
- Sidebar ERP (`erp/shell.jsx`), títulos de ERP/Portal/Registro/Mobile ERP, apps de operario (CN/VE/Bodeguero/Camionero), comentario `erp/tokens.css`, microsites de marca, Brand Hub, Launcher, Vistas Móviles, notas de generadores.
- **Actualizar todo puntero** al Brand Book a `…v4.5.html` (Brand Hub, Arquitectura, `erp/modules/admin.jsx`, `admin-brand.jsx`). **Eliminar** copias de brand books anteriores (v4.4 y previas) en Norte.
- Los CHANGELOG y comentarios históricos **no** se reescriben.

## 2. Portal del Cliente · rediseño (`portal/app.jsx`)
- **Nav**: Inicio · **Alertas mis envíos** · Finanzas · Referidos · Academia · Soporte. Proveedores y Documentos viven **dentro** del flujo, no como menú.
- **Alertas mis envíos**: ciclo **Pre-alerta → Alerta → Envío**. Botón **Seguimiento total** (agrupa por contenedor; consolidados = un solo seguimiento).
- **Nueva compra** (= prealerta) en **pantalla completa**, asistente **1-2-3**, **combobox de proveedor** (busca interno; Enter en inexistente → alta con teléfono **+86** por defecto y **captura de WeChat** obligatoria, ID/QR como imagen, no texto). Es un **prellenado**: el detalle veraz lo cierra el proveedor.
- **Packing List + Factura embebido** (responsive: móvil inline / escritorio pantalla completa). Link con datos del cliente (`?mb=` Shipping Mark · `?order=` · `?cliente=`). Permisos: **Shipping Mark bloqueado** (readonly), **Nombre/empresa editable** (placeholder de ejemplo), resto lo completa el proveedor. Las **etiquetas se generan dentro del Packing List** (no en el Portal).
- **Finanzas**: facturas como tarjetas (con indicador de adjuntos) + chips Estimados / Cotizaciones·próximamente; "Ver tabla completa" alterna a tabla densa.
- **Inicio**: bloque **"Datos para tu proveedor"** (Shipping Mark + bodega CN + "Copiar texto para WeChat"). Acceso a **Nueva compra** y **Calculadora**.
- **Calculadora flotante** (FAB arrastrable + redimensionable, pestañas **CBM / Normal**, contenedor "pronto"); no saca de la vista.
- **Academia desktop**: catálogo en grid + "Continúa donde quedaste" + cohortes + diplomas (reproductor móvil embebido al abrir un curso). Datos en `portal/academia-data.jsx` (`window.AcademiaData`).
- **Mis proveedores → Re-comprar / Agregar** entran a "Nueva compra". Código muerto del label-generator viejo **eliminado**.

## 3. Calculadora CBM (`calc/cbm-variants.jsx`)
- Header sin logo; badge **"Calculadora de CBM · LCL · DDP"** centrado; hero compacto colapsable.
- "Tarifa **actual** de CBM" editable. Multiplicador **baterías 1.5 → 1.4** (sin badge en el toggle).
- Hero: "Puerta a puerta, pagas cuando llegue*" (sin "financiamiento 100%").

## 4. Marca / Brand Book (`Brand Book DTD v4.5.html`, microsites)
- **Sistema de Movimiento** (nuevo): `Sistema de Movimiento · DTD-Cargo.html` — una curva (`--ease`) + tres duraciones (`--dur-fast/--dur/--dur-slow`), principios sí/nunca, respeto a `prefers-reduced-motion`.
- **Brand Hub** reestructurado en **tres ejes**: Sistema · Producto · Herramientas. Capa **Producto** (Portal, ERP, Operario) + doc **Portal · Rediseño 2026-06**.
- Brand Book §05: **changelog por pestañas** (Serie v4 / Serie v3 / Reset v2.4) + bloque **"Descargar tipografías"** (links a Google Fonts oficiales + ficha .txt). **"← Brand Hub · empieza aquí"** al inicio del libro.
- **Paquete de envío** (`paquete-drive/DTD-Cargo · Marca v4.5/`): carpeta **"10 · Sistema (fundamentos)"** con Hub + 6 satélites + deps relativas. Standalone regenerados (`para-enviar/`, `01 · Brand Book`).

## 5. Tuteo
Voz de IA y copy de cliente unificados a **tuteo venezolano** (Copilot ERP `pantallas/copilot.jsx`, detección de ferias `erp/modules/fairs-detection.jsx`, correo de bienvenida `erp/data.jsx`, portal). Cero voseo en superficies vivas. Directivas de handoff corregidas para no reintroducirlo.

---

## Archivos a sincronizar (baseline completo, no diff por diff)
```
portal/app.jsx
portal/academia-data.jsx
calc/cbm-variants.jsx
packlist/Packing List + Factura · DTD-Cargo.html
Brand Book DTD v4.5.html        (renombrado desde v4.4)
Brand Hub · DTD-Cargo.html
Sistema de Movimiento · DTD-Cargo.html   (nuevo)
Portal del Cliente · Rediseño · DTD-Cargo.html   (nuevo · doc)
erp/shell.jsx · erp/tokens.css · erp/modules/admin.jsx · erp/modules/admin-brand.jsx
CLAUDE.md · CHANGELOG.md · BRAND-DECISIONS.md
```
Los seams (`window.ERPData`, `?mb/order/cliente` del Packing List) siguen mock en navegador;
en producción se reescribe el cuerpo de cada seam contra la API (`backend/API-CONTRACT.md`).

## Pendientes conocidos (no bloqueantes)
- **A1** (CTA único en Inicio): **no aplicado a propósito** — el Inicio con 2 CTAs (Solicitar servicio + Calculadora) es mejor.
- Snapshots `design_handoff_mobile_app/` y `handoff-enlaces/` son congelados; se regeneran, no se editan a mano.

_Registrar en Norte: "marca sincronizada a Brand Book v4.5"._
