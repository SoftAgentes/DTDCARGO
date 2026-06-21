---
sdd: "0100"
title: "QR real escaneable en etiquetas CN (cierra el mock de SDD-0031)"
status: in-progress
author: "Claude (DTD)"
created: 2026-06-20
updated: 2026-06-20
supersedes: null
superseded_by: null
related: ["0031", "0097", "0096"]
confidencialidad: interna
---

# SDD-0100 — QR real en etiquetas CN

## 1. Resumen en una línea

El generador de etiquetas por cartón `/studio/etiquetas` (SDD-0031) ya existe y es completo, pero su
QR era un **mock visual no escaneable** (`Label.tsx · QrMock`, djb2). Este SDD lo reemplaza por un
**QR real** (`qrcode.react`) que codifica `…/verificar?c=<MARKBOX>&n=<caja>/<total>` → escaneable,
**único por cartón**, cae en `/verificar` (SDD-0097, ya en prod). **Sin migración.**

## 2. Contexto

`/studio/etiquetas` (SDD-0031, en prod desde NORTE-SYNC v3.7) genera planchas A4 + térmico con Box
X/Y, almacén CN y mensaje al supplier. El único hueco era el QR: visual y no escaneable (el checkbox
lo admitía: *"mock visual · no escaneable"*). El QR del proveedor en `/p/[token]` (SDD-0097) ya usa
`qrcode.react` apuntando a `/verificar` — este SDD alinea el generador del Studio al mismo patrón.

## 3. Alcance (decisión founder · 2026-06-20)

**Solo el QR real.** Fuera de este SDD (deuda anotada, §6): que `/verificar` muestre la caja del
`&n=`, QR por-cartón en `/p/[token]`, y los datos inventados de bodega en `Label.tsx`.

## 4. Cambios

- **`lib/studio/etiquetas-qr.ts`** (nuevo): `labelVerifyUrl(markbox, box, total)` puro + `VERIFY_BASE`.
- **`Label.tsx`**: `QrMock`/`hashStr` (mock) → `<QRCodeSVG>` (qrcode.react), `value = labelVerifyUrl(…)`,
  navy de marca (`#0F1E3D`), `aria-label` con caja/total.
- **`LabelGeneratorClient.tsx`**: copy del checkbox ("mock visual · no escaneable" → "escaneable · lleva a /verificar").
- **Test**: `lib/studio/__tests__/etiquetas-qr.test.ts` (formato de URL · saneo · único por cartón).

## 5. Verificación

`node scripts/verify.mjs` VERDE + `pnpm build`. Unit: `labelVerifyUrl`. Visual: `ui-ux-designer`
sobre la etiqueta (cambia el QR). Sin preview en navegador: ruta del Studio autenticada y `dev`
apunta a prod → se valida por build + revisión de código.

## 6. Deuda anotada (NO en este SDD)

- **`HUB_DATA` inventado** en `Label.tsx`: contactos/teléfonos/WeChat **falsos** + códigos (`GZ-B2`,
  `SZ-C1`) que **no existen** en `warehouses_cn` (reales: `CAN-C1`, `SZX-A2`, `SHA-A1`) → esas
  etiquetas caen al fallback y muestran `—`. Debería usar `CONTACT.cn` real (Lin Guan / Candy Wu).
- **`/p/[token]`** QR genérico (mismo markbox en todas las cajas) — falta `&n=` por caja.
- **`/verificar`** ignora `&n=` — podría acusar "caja X de Y".

## 7. Estado

**in-progress** en `feat/etiquetas-carton` (worktree secundario). **Sin push, sin merge** — el commit
queda en la rama para coordinación. Sin migración.
