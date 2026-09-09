---
sdd: 0340
title: Firmar adjuntos de prealerta desde una lectura autorizada por sesión
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0057
  - SDD-0096
  - SDD-0335
confidencialidad: interno
---

# SDD-0340 — Firmador acotado de adjuntos de prealerta

## Estado real

La página de Etiquetas consultaba metadatos con la sesión y luego construía un
`service_role` dentro del RSC para firmar cada path de Storage.

## Decisión

1. Encapsular la firma en un módulo `server-only`.
2. Recibir sólo prealerta id y Shipping Mark, nunca un storage path.
3. Releer primero los documentos mediante la consulta existente, sujeta a RLS y
   a ambos filtros.
4. Construir el cliente elevado únicamente si esa lectura devuelve documentos.
5. Firmar sólo los paths recién autorizados y degradar cada lote a metadatos sin
   URL ante cualquier fallo.

## Gobernanza

- `cumplimiento`: el RSC deja de administrar directamente `service_role`.
- `cumplimiento` ERR-01: sin autorización RLS o sin Storage no se emite URL.
- `cumplimiento`: no se agregan rutas, capturas ni persistencia de PII.
- `no aplica`: migración, escritura de datos, borrado o cambio visual.

## Allowlist exacta

- `lib/portal/prealerta-document-signing.ts`
- `lib/portal/__tests__/prealerta-document-signing.test.ts`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0340-firmar-adjuntos-prealerta-por-sesion/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-prealerta-signing-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- El caller no puede proporcionar un path para firmar.
- Sin documentos RLS-visibles no se construye `service_role`.
- Una falla de Storage devuelve metadatos con URL nula.
- Etiquetas sale del inventario RSC; baseline: 8 rutas / 16 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Cambiar policies o contenido del bucket `prealerta-docs`.
- Subir, borrar o transformar adjuntos.
- Aplicar Cloud, Producción o deploy.
