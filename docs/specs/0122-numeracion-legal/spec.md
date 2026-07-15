---
sdd: "0122"
title: "Numeración & legal — formatos de correlativo (read-only) + leyendas legales de factura"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0120", "0073", "0021", "0011"]
confidencialidad: interno
---

# SDD-0122 · Numeración & legal

> **Tercera sección real de Administración** (tras [[0120]] Datos de la empresa y
> [[0121]] Apariencia). V1 deliberadamente **conservadora** en lo fiscal: los
> correlativos son legales y no se tocan; lo editable es solo texto.

## Contexto y frontera

Los correlativos del Studio (`F-YYYY-NNNN` facturas, `Q-YYYY-NNNN` estimados,
`DTD-NNNN` Shipping Mark, `S-…` embarques, `R-…` rutas) se generan en **RPCs**
(`next_invoice_code`, `next_quote_code`, `next_markbox`…). Son **correlativos
legales/secuenciales** (SENIAT). Hacerlos "editables" (prefijo/padding)
implicaría reescribir esos RPCs → **fuera de alcance** de una sesión secundaria:
es terreno del módulo Fiscal (SDD-0073) con **gate contador**.

Por eso esta spec parte el diseño del Norte (`admin.jsx · SectionNumbering`) en:

1. **Formatos de numeración → READ-ONLY.** Tabla de referencia con formato +
   origen (RPC). Para **Facturas** y **Estimados** se muestra el "próximo" en
   vivo — seguro, porque `next_invoice_code`/`next_quote_code` son `SELECT
   max+1` y **NO consumen** correlativo. El resto muestra "fijo por diseño"
   (sus RPCs sí consumen o no aplica preview).
2. **Leyendas legales en facturas → EDITABLE.** Pie de página + T&C que se
   imprimen en la factura. Solo texto.

## Modelo de datos (migración 0191)

`tenants += invoice_footer_text text, invoice_terms_text text`. Aditivas, solo
texto — **cero lógica de numeración, cero cálculo fiscal**. Se guardan en
`tenants` (dominio company/admin, junto a `legal_name`/`rif` del 0120) y **no**
en `fiscal_settings`, para no entrar en las tablas/tipos del módulo Fiscal.

## Superficie de código

- `lib/studio/numbering-types.ts` — `NUMBERING_CATALOG` (formatos fijos) +
  types + `validateLegalLegendsInput`.
- `lib/studio/numbering-queries.ts` — `getNumberingOverview(supabase)`:
  previews en vivo (RPCs read-only) + leyendas del tenant.
- `app/studio/(app)/admin/numbering-actions.ts` — `updateLegalLegendsAction`
  (admin-gated vía `moduleEditDenial`).
- `app/studio/(app)/admin/_components/NumberingSection.tsx` — sección.
- `app/studio/(app)/admin/page.tsx` — fetch condicional + render.

## Seguridad

- Formatos: solo lectura; no se expone ninguna vía de mutar correlativos.
- Leyendas: escritura admin-only (`moduleEditDenial("admin")`); RLS de `tenants`
  como aislamiento.

## Follow-ups (fuera de alcance)

- **Consumir** las leyendas en el renderer/PDF de facturación (módulo
  facturación).
- Numeración **editable** de verdad (prefijo/padding configurable, notas de
  débito/crédito, número de control SENIAT) → spec fiscal con gate contador.

## Estado

- Código listo; `pnpm typecheck` + `pnpm lint` + build en verde.
- Migración `0191_invoice_legal_legends.sql` en la rama, **no aplicada a prod**
  (la aplica coordinación / founder).
