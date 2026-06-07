# DTD-Cargo · Documentos legales

Carpeta de documentos legales del negocio. **Fuente de verdad** para textos legales.
Cada documento existe en **dos formatos**:
- `.md` — versión canónica en texto plano (Claude Code la lee directo, sin abrir Word).
- `.docx` — original editable, el que se **sube a la web / se firma**.

| Documento | Versión / vigencia | Ámbito | Archivos |
|---|---|---|---|
| **Términos y Condiciones de DTD** | v2.1 · 1 may 2026 | **Cliente** (Portal/app · aceptación obligatoria por cotización) | `Terminos-Condiciones-DTD-v2.1.md` · `DTDCARGO_Terminos_Condiciones_DTD_v2.1.docx` |
| **Acuerdo de Servicios de Consolidación y Embarque** | borrador · ES/中文 | **Interno** (contrato B2B con el operador de consolidación en China) | `Acuerdo-Operador-Consolidacion-ES-ZH.md` · `DTDCARGO_Acuerdo_Operador_Consolidacion_ES_ZH.docx` |
| **Brief de seguro de carga** | ES/中文 | **Interno** (encargo al operador para estimar póliza con aseguradoras CN) | `Brief-Seguro-Operador-ES-ZH.md` · `DTDCARGO_Brief_Seguro_Operador_ES_ZH.docx` |

## Reglas de uso
- **De cara al cliente** solo va la **T&C v2.1** (y, cuando exista, las Condiciones del Operador
  de Consolidación que ya viven en `erp/modules/admin-legal.jsx`). El cliente nunca ve el
  Acuerdo B2B ni el Brief de seguro.
- **Nombre del proveedor:** en material de cara al cliente, siempre "el Operador de
  Consolidación" (sin nombre). En los documentos **internos** de esta carpeta, los nombres
  reales del proveedor van entre `[corchetes]` como campos de borrador a completar.
- **Sincronía con el sistema:** la T&C v2.1 de cara al cliente está embebida en
  `erp/modules/admin-legal.jsx` (`LEGAL_BODY.tyc`) y en el modal de aceptación del Portal.
  Si cambia el texto legal, actualizar **ambos**: este `.md`/`.docx` y `admin-legal.jsx`
  (subiendo la versión: v2.1 → v2.2…) para que el repositorio versionado y el registro de
  aceptaciones queden consistentes.
- **Avisos legales pendientes** (marcados `[…]` en los textos): foro/jurisdicción de la T&C,
  ley aplicable y prevalencia de idioma del Acuerdo. Validar con abogado antes de publicar.
