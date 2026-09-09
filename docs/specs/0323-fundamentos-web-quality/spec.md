---
sdd: 0323
title: Fundamentos Web Quality sin barreras críticas
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0164
  - SDD-0288
confidencialidad: interno
---

# SDD-0323 — Fundamentos Web Quality sin barreras críticas

## Problema

La auditoría Web Quality posterior al saneamiento confirmó fallos locales que
no requieren Cloud para corregirse: zoom bloqueado en la PWA, identificadores
duplicados en las dos calculadoras de `/tarifas`, copy de bajo contraste en el
dashboard, selectores de período con semántica de tabs incompleta, idioma chino
sin `lang`, estado CRM dependiente del color, ausencia de skip-link, cobertura
incompleta del sitemap y una página indexable sin encabezado.

## Contrato

1. La PWA permite zoom y reflow del navegador.
2. Cada instancia de la calculadora genera un id propio para la tarifa y su
   label conserva la asociación.
3. Las tabs de `/tarifas` usan roving tabindex y flechas/Home/End. El selector
   de período del dashboard se expone como grupo de botones con `aria-pressed`.
4. El dashboard no usa `--ink-mute` para texto informativo pequeño.
5. El login CN anuncia `zh-CN` cuando el usuario selecciona chino.
6. El estado de conversación CRM tiene una señal textual visible además del
   color y conserva el rótulo completo para tecnologías de asistencia.
7. La navegación pública ofrece un primer tab stop que enfoca el `<main>` real.
8. Cookies y Privacidad entran al sitemap; Términos entra solo cuando su bandera
   jurídica lo vuelve indexable. El contrato ignora menciones en comentarios.
9. `/enlaces` conserva su diseño y expone un `h1` real.

## Gobernanza

- `cumplimiento`: A11Y-01 (zoom, foco, nombre, semántica y no depender del color).
- `cumplimiento`: SEO local sin afirmar indexación real en buscadores.
- `cumplimiento`: BRAND.md; sólo tokens existentes y sin rediseño.
- `no aplica`: datos personales, Supabase, migraciones y proveedores alojados.

## Allowlist exacta

- `app/m/layout.tsx`
- `app/m/cn/login/page.tsx`
- `app/enlaces/page.tsx`
- `app/sitemap.ts`
- `app/__tests__/sitemap-cobertura-contract.test.ts`
- `app/__tests__/web-quality-foundations-contract.test.ts`
- `app/studio/(app)/crm/_components/PuntoConversacion.tsx`
- `app/studio/(app)/dashboard/_components/DashboardWidgets.tsx`
- `components/CalculadoraForm.tsx`
- `components/Nav.tsx`
- `components/TarifasTabs.tsx`
- `docs/specs/0323-fundamentos-web-quality/spec.md`
- `docs/specs/README.md`

## Fuera de alcance

- Completar en esta rebanada la adopción de roving tabindex en todas las tabs
  históricas del ERP; se inventaría una migración transversal sin revisar cada
  flujo y cada panel.
- Cambiar CSP a nonce/hash, medir Core Web Vitals alojados o tocar Producción.
- Alterar contenido jurídico o encender `TERMINOS_LIVE`.

## Aceptación

- Los contratos focales, typecheck, lint, gobernanza, componentes y docs pasan.
- Una revisión runtime de teclado confirma skip-link y tabs de `/tarifas`.
- No hay ids duplicados de tarifa al montar ambos paneles.
