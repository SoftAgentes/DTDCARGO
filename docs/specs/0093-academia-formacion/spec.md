---
sdd: "0093"
title: "Academia DTD — módulo de formación (catálogo on-demand + cohortes + diplomas + portal + facturas)"
status: draft
author: "Claude Code (ventana academia) + founder"
created: 2026-06-17
updated: 2026-06-17
supersedes: null
superseded_by: null
related: ["0090", "0076", "0085", "0051", "0042", "0049", "0077", "0079", "0026"]
confidencialidad: interno
---

# SDD-0093 — Academia DTD

> La **Academia DTD** es el **brazo de captación** (no un negocio de cursos): educa → capta leads →
> los convierte en clientes del **servicio logístico DTD** (DDP + recompra) y en comunidad. Los cursos
> son el anzuelo; el dinero es la logística + la comunidad recurrente.

> **Plan de trabajo completo (fuente de verdad, no se re-litiga acá):**
> `~/.claude/plans/foamy-baking-riddle.md` (estrategia, equipo, principio rector, los 4 cursos guionizados,
> el funnel, CENTECPRO, candidatos a "caras"). Esta spec implementa la **pieza ERP**.

## Principio rector (que guía cada decisión)

1. **La ganancia oculta = la comunidad que importa CON DTD.** Optimizar por **clientes-contenedor (LTV)**,
   nunca por venta de cursos.
2. **Marca sobre cara.** La comunidad, la data y la relación son **de DTD**, no de la persona-cara. Canales,
   CRM, inscripciones, diplomas y servicio pasan por DTD → si una cara se va, la audiencia no se la lleva.
3. **Mensaje del curso:** "hazlo tú mismo — no nos necesitas para aprender; pero nosotros te traemos la carga
   y verificamos que nuestro servicio te encaje."

## Decisiones cerradas

- **Marca:** Academia DTD (sub-marca de DTD Cargo). Viaje "Viaja a Yiwu" = PARKED (futuro).
- **Cursos:** ambas capas — **catálogo on-demand** (video/info) + **cohortes en vivo** (facilitador,
  asistencia ≥75%, diploma).
- **Director = socia** (revenue-share), rol por reclutar. Facilitadores formados por DTD + creadores ("caras").
- **Precios = en $0 ahora.** El curso se registra como **servicio** (`service_configs`); **Administración
  (rol `accounting`)** fija precio + cuenta de ingresos; el Director solo el contenido (gate por campo,
  patrón SDD-0085).
- **Miembro (portal) = tiene ≥1 inscripción o diploma** (orgánico).
- **Club DTD** (membresía recurrente, el motor de dinero vía compra grupal) = arquitectura ya, **build fase 2**.
- **Anonimización:** referentes investigados = "Referente A/B", nunca por nombre en docs del equipo.

## Catálogo — los 4 cursos DTD

Mismo espinazo de 9 módulos, distinta profundidad. Módulo-foso transversal: **"Tu equipo de importación: DTD"**
(bodega real, consolidación, puerta-a-puerta — el referente no puede copiarlo).

| Curso | Título | Para quién |
|---|---|---|
| **Curso 0** (GRATIS) | "Importar desde China: Guía Rápida para Venezolanos" | Lead magnet (~12 lec) |
| **Curso 1** (Inicial) | "Domina Yiwu: De la Pantalla al Contenedor" | El que nunca ha importado |
| **Curso 2** (Core) | "De 0 a Contenedor en 4 Semanas" | + cohorte y sesiones en vivo |
| **Complemento** | "MasterClass 1688: Compra como los chinos" | Sourcing directo en 1688 |

*Ventajas vs el referente:* **lecciones preview gratis** (1-2/curso) + **testimonios reales desde el día 1**
(el referente no tiene ninguna reseña pública).

## Arquitectura (3 frentes + el hilo)

### A · Academia (Studio/ERP) — dos capas
- **Catálogo on-demand:** `academy_courses` → `academy_modules` → `academy_lessons` (kind: video/texto/descarga,
  `free_preview`, duración, recurso). Estado del curso: `proximamente | publicado`. Editor para crear/ordenar
  y subir video.
- **Cohortes en vivo** (port del Norte `academia.js`): `academy_cohorts` → `academy_enrollments` →
  `academy_attendance` (≥75% aprueba) → emisión de **diplomas** (`academy_diplomas`, port del generador del
  Norte: 4 variantes + sello + QR a `/verificar`).

### B · Portal del cliente · Academia (SDD-0042, lado portal)
- Sección **"Academia"** en `/portal`. Scope por `client_markbox` (`get_portal_client_markbox()`); RLS portal.
- **Gate de miembro:** sin inscripción/diploma → **"Aún no eres miembro de la Academia DTD"** + CTA. Con
  inscripción/diploma → **Mis cursos** (progreso) + **Mis diplomas** (ver/descargar PDF, bucket
  `academy-diplomas`, signed URL — patrón `app/portal/(app)/documentos`).

### C · Precio + facturación (servicios + contabilidad)
- El curso se registra como entrada en `service_configs` (`/studio/servicios`); precio en `price_text` +
  `service_price_history`; **`mapeo_contable`** → cuenta de ingresos (default `4.5 "Otros ingresos por
  servicios"`). Gate por campo: contenido = `commercial` (Director); precio + cuenta = `accounting` (Admin).
- **Venta → factura:** línea de factura referencia el `service_key` del curso → asiento automático
  (`postInvoiceJournalEntry`, `lib/studio/accounting/invoice-posting.ts`) usa su `mapeo_contable`. DR 1.1.2
  Cuentas por cobrar / CR ingresos del curso. Pago flexible (USD + bolívares/Zelle/cuotas) en el checkout.

### El hilo (end-to-end)
catálogo → inscripción/compra → **factura** → acceso en **portal (mis cursos)** → completar → **diploma**
(portal + `/verificar` público) → CTA al **servicio DTD / Club**.

## Modelo de datos (migración — próxima libre, confirmar al construir; otra ventana puede tomar 0144)

Patrón estándar: `tenant_id` → `tenants`, RLS por tenant, `revoke from anon` + grant authenticated, enums
`text`+check, soft-delete `deleted_at`, trigger `touch_updated_at`.

- `academy_courses` — `id, tenant_id, slug, title, tier(check), summary, level, service_key (→ service_configs:
  precio+contabilidad), status(check: borrador|proximamente|publicado), sort, cover_path, …`.
- `academy_modules` — `id, tenant_id, course_id, title, sort, …`.
- `academy_lessons` — `id, tenant_id, module_id, course_id, title, sort, kind(check), video_url, asset_path,
  duration_min, free_preview bool, status, …`.
- `academy_cohorts` — `id, tenant_id, course_id null, name, hours, sessions, modality, place, starts_at,
  facilitator_name, status(check: proximamente|en_curso|completado), …`.
- `academy_enrollments` — `id, tenant_id, cohort_id, client_markbox, student_name, student_ci, student_email,
  progress_pct, completed_at, created_at, deleted_at`.
- `academy_attendance` — `id, tenant_id, cohort_id, enrollment_id, session_num, attended`; unique(enrollment, session).
- `academy_diplomas` — `id, tenant_id, enrollment_id, client_markbox, folio unique, course_title, hours, place,
  issued_at, storage_path` → verificación pública + descarga en portal.
- **RPC** `academy_verify_diploma(folio)` security-definer, `grant execute to anon` (revoke del resto), para
  `/verificar`.

## RBAC (SDD-0085)
- Módulo `academia` en `lib/studio/modules.ts` (grupo COMERCIAL) + `lib/studio/rbac.ts`
  (`["commercial","accounting","support"]`). `requireModuleView("academia")` en la page; `moduleEditDenial`
  en actions. **Gate por campo** en el drawer de servicios: contenido = `commercial`, precio+cuenta = `accounting`.

## Slices
- **A — Catálogo** (academy_courses/modules/lessons) + seed con los 4 títulos + RBAC + sidebar + vista
  "Próximos cursos".
- **B — Cohortes + asistencia + diplomas** (port del Norte: `academia.js` + generador de diplomas).
- **C — Verificación pública** `/verificar?c=folio` (RPC anon).
- **D — Portal del cliente · Academia** (gate miembro + mis cursos + mis diplomas).
- (Fase 2: Club DTD; landing pública `/academia`.)

## Diseño
- **Brief enviado a Cloud Design:** `docs/design/academia/cloud-design-brief.md` (proyecto único que unifica
  Academia + Diplomas del Norte y agrega catálogo, portal y facturas).
- Al volver el diseño → importar al Norte (`docs/design/studio/_norte/`) y construir.
- Reusar: Norte `academia/academia.js`, `diplomas/diploma.js` + `Diploma · DTD-Cargo.html`.

## Verificación
- `node scripts/verify.mjs` (typecheck + lint frontera + tests + build). Antes de pushear `main`, `pnpm build`.
- Migración vía Supabase MCP (`apply_migration`); `get_advisors` tras aplicar; SQL a prod **espera OK del founder**.
- Manual: `/studio/academia` (catálogo → cohorte → asistencia → diploma) + `/verificar` + `/portal` Academia
  (gate + cursos + diplomas).
- UI por `ui-ux-designer` antes del commit de UI. Gate anonimización (grep 0 hits de referentes).

## Notas
- ⚠️ El número **0092** lo tomó otra ventana (SeaRates) → esta spec es **0093**.
- Migración: confirmar el número libre al construir (otra ventana puede tomar 0144).
