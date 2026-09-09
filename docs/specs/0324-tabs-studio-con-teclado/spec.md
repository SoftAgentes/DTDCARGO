---
sdd: 0324
title: Tabs del Studio con teclado y un solo tab stop
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0323
  - SDD-0164
confidencialidad: interno
---

# SDD-0324 — Tabs del Studio con teclado y un solo tab stop

## Problema

El barrido Web Quality encontró 32 tablists ARIA entre el Studio y la web
pública. `/tarifas` ya quedó cerrado en SDD-0323; los otros 31 estaban en el
Studio: 29 tablists interactivos con implementaciones distintas y dos selectores
SSR construidos con enlaces normales, pero disfrazados de tabs. Sólo Fiscal y
Club tenían flechas, varias implementaciones ni siquiera mantenían un único tab
stop y no existía una solución canónica para el resto de los módulos.

## Contrato

1. Todo tablist interactivo del Studio usa `RovingTabList` como primitiva única.
2. Al montar, sólo la tab seleccionada es alcanzable con `Tab`; si no existe una
   selección válida, la primera opción habilitada recibe el tab stop.
3. `ArrowRight`/`ArrowDown` avanzan, `ArrowLeft`/`ArrowUp` retroceden y el foco
   cicla. `Home` y `End` saltan a los extremos.
4. La opción enfocada se activa mediante el mismo `click` del componente
   existente, sin duplicar estado ni lógica de navegación.
5. Tabs `disabled` o con `aria-disabled="true"` se omiten y quedan con
   `tabIndex=-1`.
6. Cada tablist tiene nombre accesible.
7. Los selectores SSR construidos con `Link` se exponen como `<nav>` y usan
   `aria-current="page"`; no declaran `role="tab"`.
8. No se alteran estilos, permisos, datos, queries ni rutas.

## Diseño

`RovingTabList` usa delegación de eventos para abarcar botones directos y tabs
encapsuladas en componentes hijos. Sincroniza `tabIndex` al montar y cuando
cambia `aria-selected`, incluyendo drawers y listas que reemplazan hijos. Los
consumidores conservan su `onClick`; la primitiva sólo enfoca y activa.

## Gobernanza

- `cumplimiento`: A11Y-01, teclado, foco y semántica ARIA.
- `cumplimiento`: componente canónico antes de repetir lógica por módulo.
- `cumplimiento`: BRAND.md; cero cambios visuales.
- `no aplica`: Supabase, datos personales, migraciones, Cloud y Producción.

## Allowlist exacta

- `app/studio/_components/ui/RovingTabList.tsx`
- `app/studio/_components/ui/RovingTabList.test.tsx`
- `app/studio/_components/ui/RovingTabList.adoption.test.ts`
- `app/studio/_components/wiring/ProfileModal.tsx`
- `app/studio/(app)/academia/_components/AcademiaClient.tsx`
- `app/studio/(app)/admin/_components/PortalBackfillSection.tsx`
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/agentes/page.tsx`
- `app/studio/(app)/admin/rutas/_components/RoutesClient.tsx`
- `app/studio/(app)/bitacora/_components/BitacoraClient.tsx`
- `app/studio/(app)/bitacora/_components/BoardList.tsx`
- `app/studio/(app)/bitacora/nueva/_components/NuevaReunionClient.tsx`
- `app/studio/(app)/bugs/_components/BugDrawer.tsx`
- `app/studio/(app)/bugs/_components/BugsAdminClient.tsx`
- `app/studio/(app)/calendario/_components/CalendarClient.tsx`
- `app/studio/(app)/club/_components/ClubClient.tsx`
- `app/studio/(app)/cola-qr/_components/QrQueueClient.tsx`
- `app/studio/(app)/costing/_components/CostingClient.tsx`
- `app/studio/(app)/crm/_components/KommoBoardView.tsx`
- `app/studio/(app)/crm/_components/KommoClient.tsx`
- `app/studio/(app)/crm/_components/LeadDrawer.tsx`
- `app/studio/(app)/debug/_components/DebugTabs.tsx`
- `app/studio/(app)/financiero-china/_components/FinancieroChinaClient.tsx`
- `app/studio/(app)/financiero-china/_components/StatementDetail.tsx`
- `app/studio/(app)/fiscal/_components/FiscalClient.tsx`
- `app/studio/(app)/mailing/_components/MailingClient.tsx`
- `app/studio/(app)/mailing/_components/TemplateEditorDrawer.tsx`
- `app/studio/(app)/reportes/_components/ReportesClient.tsx`
- `app/studio/(app)/seniat/_components/SeniatClient.tsx`
- `app/studio/(app)/servicios/_components/ServicioDrawer.tsx`
- `app/studio/(app)/tms/_components/TmsClient.tsx`
- `app/studio/(app)/usuarios/_components/UsersClient.tsx`
- `docs/specs/0324-tabs-studio-con-teclado/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Fuera de alcance

- Convertir selectores que no usan semántica ARIA de tabs.
- Rediseñar barras, colores, espaciado o contenido de los módulos.
- Medir accesibilidad o comportamiento con cuentas reales alojadas.

## Aceptación

- Contratos de comportamiento y adopción pasan.
- TypeScript y ESLint de todo Studio pasan.
- El barrido encuentra 29 usos canónicos y cero tablists históricos directos.
- `node scripts/verify.mjs` no presenta regresiones locales.
