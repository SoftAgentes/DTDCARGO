# Legacy · Portal/Registro del Cliente V1 (superseded por V2)

Estos 4 archivos son la **V1** del Portal del Cliente y del Registro. **No usar para lo nuevo.**
Decisión del founder (2026-05-31): la **V2 es la canónica** y la que debe quedar como pantalla-meta.

| Archivado acá (V1) | Reemplazado por (V2, vigente en raíz) |
|---|---|
| `Portal del Cliente.html` + `portal/app.jsx` (809 líneas) | `Portal del Cliente · V2.html` + `portal/app-v2.jsx` (1034 líneas) |
| `Registro Cliente.html` + `portal/registro.jsx` (469 líneas) | `Registro de cliente · V2.html` + `portal/registro-v2.jsx` (638 líneas) |

La V2 es superset (más completa). `Modo Cliente.html` (v1.9) ya hace iframe de la **V2**. Ningún `.jsx` ejecutable
referencia la V1 — solo se la menciona en docs/changelogs históricos. Por eso archivar la V1 no rompe nada.

## ✅ Resuelto en origen (2026-05-31)

El founder **unificó en Cloud Design**: eliminó el archivo "· V2" y dejó el **nombre base**
(`Portal del Cliente.html` / `Registro Cliente.html`) con el **contenido bueno (ex-V2)**.

Por eso, **desde la carga v1.91 en adelante** el ZIP trae UN solo archivo por concepto, con nombre base
y el contenido correcto. Los de esta carpeta son los **V1 reales, pre-unificación** — histórico.

> ⚠️ **Al cargar v1.91 NO confundir:** el `Portal del Cliente.html` que venga en v1.91 **es el bueno**
> (contenido ex-V2), no el V1 de acá. No archivar/borrar a ciegas. En `scripts/norte.mjs`, los `file:`
> del grupo "Portal del Cliente" deben volver al **nombre base** (sacar el "· V2.html"). Ver memoria
> del protocolo NORTE-SYNC (`project_norte_visual_sync`).

> Nota: los shells `.html` de acá NO corren standalone desde `_legacy/` (las rutas `erp/…` son relativas a la
> raíz del `_norte/`). Esto es **archivo de referencia de código**, no una demo navegable. El código completo
> también vive en el historial de git.
