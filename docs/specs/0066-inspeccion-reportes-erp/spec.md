---
sdd: "0066"
title: "Generador de reportes de inspección en el ERP (white-label · marca DTD)"
status: done
author: "Claude Code (session context) + founder"
created: 2026-06-09
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0049", "0052", "0063"]
confidencialidad: interno
---

# DTD-0066 — Generador de reportes de inspección (Studio ERP)

> Un módulo del Studio donde DTD **rellena los datos** de una inspección (que ejecuta una empresa
> tercera en China) y **emite un reporte con marca DTD** (white-label) para enviar al cliente. Hoy
> se arma a mano; este módulo lo productiza sobre las plantillas que ya diseñó Cloud Design.

## Contexto

La **inspección de calidad** es un servicio que DTD **revende** (ver [SDD-0063](../0063-servicios-detalle-publico/spec.md) y `lib/inspeccion.ts`): la
ejecuta una empresa tercera en China (V-Trust, QIMA, SGS, CIS, WEINSPECTION, HQTS) que genera **su
reporte crudo**. DTD toma esos datos, los **re-captura** y emite un **reporte propio, con su marca**,
en español, para el cliente. El proveedor tercero y la entidad china de DTD (**"Canopy"**) **nunca**
se nombran — igual que la compra asistida.

**Hoy** ese reporte se arma manualmente. Las **plantillas finales ya existen** (diseñadas por Cloud
Design, en `docs/design/studio/_norte/`):

- `Inspección de Fábrica · DTD.html` — Auditoría de fábrica con puntaje **/100**.
- `Inspección de Producto · DTD.html` + `… · Baterías · DTD.html` — Inspección pre-embarque (**PSI**)
  con muestreo **AQL** y desglose de defectos.
- `Plantilla · Inspección de Fábrica/Producto.html` + `reportes/report.css` + `reportes/report-data.js`.

Falta el **backend + la pantalla** del Studio que rellena esas plantillas con datos reales y exporta
el PDF. Es la **"Fase 2"** que `lib/inspeccion.ts` ya anticipaba.

## Alcance

**Entra:**
- Módulo nuevo del Studio (propuesto: **`/studio/inspecciones`**) para crear, listar y editar
  reportes de inspección, con **2 tipos**: Auditoría de Fábrica (/100) y Producto/PSI (AQL).
- Migración: tabla `inspection_reports` + fotos en Storage + RPC de correlativo, todo multi-tenant
  con RLS (patrón [SDD-0049](../0049-documentos-hub/spec.md)).
- **Renderizador** de las 2 plantillas (porta `reportes/report.css` del Norte) → **preview + export
  a PDF**.
- **Reglas white-label** forzadas: el proveedor tercero y "Canopy" se guardan **internos** y **no se
  renderizan nunca**; modo "sample" que redacta cliente/fábrica para usar como ejemplo público.

**No entra:**
- Integración automática con las APIs de los proveedores (los datos se transcriben a mano en V1).
- Cobro / pasarela de pago del servicio de inspección (cotiza el asesor; ver 0063).
- El catálogo público y el copy de `/servicios/inspeccion` (ya hecho en 0063).
- El "ver ejemplo de reporte" público — la muestra **ya está editada por diseño**; solo se enlaza
  (tarea chica, fuera de este módulo).

## Diseño

### Datos (migración nueva — asignar próximo número libre)

- **`inspection_reports`** — `tenant_id`, `id`, `report_no` (`DTD-FA-NNNN` / `DTD-QC-NNNN`),
  `type` (`factory_audit` | `product_psi`), `client_id` (FK `clients`, nullable),
  `title`, `product`, `inspection_date`, `duration_mandays`,
  `score` (int, solo factory_audit), `conclusion` (`approved` | `rejected` | `observations`),
  `status` (`draft` | `final`), `payload` jsonb (sub-puntajes, AQL, defectos, pruebas, medidas…),
  `provider_internal` (text, **INTERNO** — el tercero; nunca se renderiza),
  `created_by`, `created_at`, `updated_at`. RLS tenant-scoped (patrón 0033/0049).
- **Fotos** → **Supabase Storage** (bucket privado, `{tenant_id}/inspection/{report_id}/…`), con
  registro `inspection_report_photos` (`category`, `caption`, `path`, `redacted` bool, `sort`).
  **Nunca en git.** Signed URLs de corta vida (patrón 0049).
- **RPC `next_inspection_report_no(type)`** → correlativo por tenant (`DTD-FA-NNNN` / `DTD-QC-NNNN`).

### UI (Studio)

- `/studio/inspecciones` — listado (filtro por tipo/estado/cliente) + KPI (este mes, aprobados/observados).
- Drawer/builder que refleja los campos de la plantilla (cabecera, secciones con puntaje en fábrica;
  AQL + tabla de defectos + pruebas en producto). Usa `NumericInput` y los componentes estándar del
  Studio.
- **Preview** que renderiza la plantilla (porta `report.css`) + botón **Export PDF** (ver pregunta
  abierta) + modo **"sample"** (redacta cliente/fábrica para ejemplo).
- Patrón del módulo: `page.tsx` + `actions.ts` + `_components/` + `lib/studio/inspecciones/` (≥3
  archivos → carpeta).

### White-label + confidencialidad (reglas duras)

- El **proveedor tercero** y **"Canopy"** se guardan en `provider_internal` / interno → **jamás** en
  el render del reporte ni en el front. Igual que compra asistida (red propia DTD, nunca se revela).
- El **RIF del reporte = `J-50648869-8`** (canónico). *(Los samples del Norte ya fueron corregidos en
  esta sesión; el origen de Cloud Design tiene el RIF viejo `J-410322887` → avisarles.)*
- El **PDF crudo del tercero** (con fábrica/banco/IDs reales) **no va a git**; si se adjunta para
  trazabilidad, va a **Storage privado** (no público).
- Data de clientes → Supabase + RLS (nunca en seeds/git).

### Salida (PDF)

Las plantillas ya traen CSS de impresión (`window.print()`). V1 puede usar **print-to-PDF** del
navegador; a evaluar un render server-side (Playwright/Chromium) si se quiere PDF determinista.

## Proceso / fases

0. **Este spec** (scope).
1. **Migración** + `lib/studio/inspecciones/` (types + queries + validators) + RPC correlativo +
   bucket Storage.
2. **Builder Producto/PSI** (el más simple) → preview → export PDF. Vía harness `/feature`.
3. **Builder Auditoría de Fábrica /100** → preview → export.
4. **Enlazar** el ejemplo ya diseñado en `/servicios/inspeccion` (tarea chica, fuera del módulo).

UI/UX review (`ui-ux-designer`) antes de cada commit; gate `node scripts/verify.mjs` verde.

## Preguntas abiertas (para el founder)

1. **Nombre del módulo:** `/studio/inspecciones` ¿o `/studio/calidad`? (no chocar con `/studio/reportes`,
   que es analítica — SDD-0052).
2. **PDF:** ¿print-to-PDF del navegador (V1 simple) o render server-side determinista?
3. **Reporte crudo del tercero:** ¿se adjunta a cada reporte (Storage privado, trazabilidad) o solo
   se transcribe sin guardarlo?
4. **Numeración:** ¿`DTD-FA-NNNN` / `DTD-QC-NNNN` por tenant, correlativo propio?
5. **Quién llena:** ¿un rol específico (QC Account Manager) o cualquier usuario del Studio?
6. **Tipos de plantilla:** ¿solo Fábrica + Producto, o también una variante por rubro (ej. Baterías ya
   tiene su sample)?

## Adjuntos

- Plantillas de diseño: `docs/design/studio/_norte/` (`Inspección de *.html`, `reportes/`).
- Investigación de proveedores + estrategia: referida en `docs/runbooks/kommo-reconfig.md` y la
  entrevista de servicios (`docs/specs/0063-.../assets/entrevista-servicios.md`).
- Copy público de la línea: `lib/inspeccion.ts` + `/servicios/inspeccion`.
