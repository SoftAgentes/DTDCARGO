# SYNC NORTE · 2026-06-10

> **Para Claude Code:** este documento resume TODO lo que debes aplicar en Norte desde este
> proyecto (la fuente de verdad de la marca — ver CLAUDE.md §Sincronización). Aplica en orden.
> Ante conflicto entre Norte y este proyecto, **gana este proyecto**.

---

## 1 · Eliminar en Norte (reemplazado o archivado)

| Qué | Por qué |
|---|---|
| Brand books **anteriores a v3.7** (v3.5, v3.6…) | El vigente es ÚNICO: `Brand Book DTD v3.7.html`. Historial en su changelog interno. |
| `Sticker Pack` viejos (pack de 12 redondos, comparaciones) | El pack oficial es **17 piezas con texto**: `Sticker Pack · DTD-Cargo.html`. |
| `Aceptación T&C · Cotización.html` | Archivado — la lógica vive en ERP (`admin-legal.jsx`) y el modal del Portal. |
| `Modo Cliente.html` | Archivado — reemplazado por el overlay "modo cliente" del ERP. |
| `Reporte DTD-Cargo.html` | Archivado — reporte de sesión vieja. |
| `_icons-partial.html` | Archivo de trabajo, eliminado. |
| Toda referencia visual a **"MARKBOX"** | Término eliminado del lenguaje visual (ver §3). |

## 2 · Tokens y reglas (CLAUDE.md)

- `CLAUDE.md` completo es la versión vigente — reemplaza el de Norte. Cambios clave:
  - **§Terminología · Shipping Mark**: término único en TODOS los contextos. Claves de código `markbox` NO se renombran.
  - **§Terminología · Compra / Orden / Prealerta**: mismo registro, etiqueta por audiencia (Portal="Compra", ERP="Orden", concepto="Prealerta").
  - **§Sincronización con Claude Code · "Norte"**: protocolo de este mismo documento.
  - Colateral impreso ya no figura como pendiente.
- `erp/tokens.css` — sin cambios de tokens este ciclo (verificar igual por diff).

## 3 · Cambios de lenguaje (masivos)

1. **MARKBOX → Shipping Mark** en TODO el lenguaje visual (≈56 archivos tocados aquí).
   - Solo etiquetas visibles. Identificadores de código intactos: `markbox:`, `c.markbox`, `MARKBOX_REGEX`, `DEMO_MARKBOX`, `PM_MARKBOX`.
   - De cara a proveedor chino: "Shipping Mark (唛头)".
2. **Voseo → tuteo venezolano** (≈95 archivos): "Escanea", "Cotiza", "Escríbenos", "tienes", "puedes"…
   - EXCEPCIÓN intencional: los ejemplos ❌ del Voice & tone del Brand Book (muestran lo prohibido).
3. **Timeline 2026 del book**: "12+ modalidades · plataforma digital" (se eliminó "ERP propio" — no revelar desarrollo interno).

## 4 · Piezas nuevas (copiar completas)

| Archivo | Qué es |
|---|---|
| `Sticker Pack · DTD-Cargo.html` | Pack oficial WhatsApp · 17 stickers con texto, PNG 512 transparente. |
| `Colateral Impreso · DTD-Cargo.html` | Membrete A4 + credencial CR-80 + vinilo camión 6.0×2.4 + roll-up 85×200, con spec de imprenta. |
| `Banco de Fotos · DTD-Cargo.html` | Banco de fotos aprobadas (slots por categoría; se llena con el foto-shoot). |
| `erp/modules/estudio-redes.jsx` | Estudio de Redes: calendario de contenido + registro pieza→campaña + Etiquetas de contenido (seam `dtd-etiquetas-contenido`). |

## 5 · Piezas actualizadas (diff completo)

- **`Generador Redes · DTD-Cargo.html`** — flujo red-primero (chips de plataforma, formatos filtrados, persistencia), QR multidestino (YouTube/IG/TikTok/WA/WeChat/Google/enlace), generador YouTube, copiar arreglado, pill editable + tonos de badge, tag de contenido en el log de piezas (`pz_tag`).
- **`Aplicaciones de Marca.html`** — pieza 12 = 17 stickers (redondos eliminados); §04 firma de email **interactiva** (nombre/cargo/tel/correo actualizan el preview); imprimir SOLO factura demo; watermark silencioso (rgba 0.3, MARKBOX→Shipping Mark en JetBrains Mono).
- **`Brand Book DTD v3.7.html`** — §08 hub con Póster Reseñas + generadores; §09 WhatsApp interactivo + stickers 17 + WeChat QR placeholder; §14 link al App Icon; §15 gobernanza; watermark spec.
- **`Logo Oficial.html`** — descargas PNG por tamaño de uso (48/80/120/200/320 px, retina ×4).
- **ERP** — prealertas (nodo en flujo + tab "Prealertas · en camino" + escáner caja→orden); Master data → **Etiquetas de contenido** (estado del flujo + tipo, editables); Estudio de Redes en Administración → Marca; mapa de proceso integrado (sin salir a otra pestaña).
- **Portal** — botón "Nueva compra" anclado a prealerta; pill Calculadora CBM en el dashboard; tuteo.
- **`Reportes de Inspección · DTD.html`** — card de Inspección de Baterías; logos de fotos retocados (borroso/distorsión sutil).
- **Datos**: Almacenista y Transportista = misma persona, **+58 424 950 8848** (Iconos de Perfil, admin-brand, data.jsx).

## 6 · Seams → API (sin cambios de contrato, hay claves nuevas)

- `localStorage['dtd-piezas-log']` — items ahora llevan `tag` y `state` (etiquetas de contenido).
- `localStorage['dtd-etiquetas-contenido']` — NUEVO seam (flow + types). En producción: endpoint propio (ver `backend/API-CONTRACT.md`, patrón Master data).
- Escáner de prealertas: lookup mock → endpoint de órdenes.

## 7 · Al terminar

1. Registrar en la bitácora de Norte: **"marca sincronizada a Brand Book v3.7 · sync 2026-06-10"**.
2. Confirmar cero referencias a: MARKBOX (visual), v3.5/v3.6, pack de 12, voseo.
3. `design_handoff_mobile_app/` de este proyecto ya está re-sincronizado — úsalo como paquete móvil.
