---
sdd: 0348
title: Encapsular la lectura privada de aceptación del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0054
  - SDD-0067
  - SDD-0075
  - SDD-0335
confidencialidad: interno
---

# SDD-0348 — Lectura privada de aceptación del Portal acotada

## Estado real

`/portal/facturas/[code]/aceptar` era el último RSC del Portal que construía
`service_role`. La página resolvía tenant, factura DDP pendiente, documentos
vigentes y la última aceptación previa directamente con ese cliente.

## Decisión

1. Crear un facade `server-only` que reciba sólo el cliente de sesión y el código
   de factura de la URL.
2. Volver a resolver el cliente Portal por sesión antes de elevar.
3. Derivar tenant y Shipping Mark dentro del facade; no devolver el tenant.
4. Leer la orden pendiente antes de documentos o evidencia previa, manteniendo
   el scope exacto tenant + Shipping Mark + código.
5. Distinguir sin sesión, no disponible/ajena y lista para mostrar; cualquier
   fallo de elevación o del set legal queda cerrado.

## Gobernanza

- `cumplimiento`: el único input no confiable es el código y se acota con la
  identidad de sesión antes de leer borradores ocultos.
- `cumplimiento` ERR-01: fallo privado no devuelve orden ni documentos.
- `cumplimiento`: acción, sello, hash, evidencia e idempotencia no cambian.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/facturas/[code]/aceptar/page.tsx`
- `lib/portal/portal-acceptance-private-context.ts`
- `lib/portal/__tests__/portal-acceptance-private-context.test.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0348-contexto-aceptacion-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-acceptance-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Sin cliente Portal no se crea admin y la página conserva `/entrar`.
- Código vacío, orden ajena/no pendiente o tenant ausente redirigen a facturas.
- Documentos vigentes y evidencia previa sólo se leen después de validar orden.
- La Server Action y sus contratos legales quedan sin cambios.
- El inventario RSC llega a 0 rutas / 0 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Cambiar copy, UI, dos checkboxes, evidencia, hash o semántica de reaceptación.
- Modificar `LEGAL_GATE_HARD_BLOCK` o aplicar migraciones.
- Desplegar o escribir en Cloud/Producción.
