---
sdd: "0100"
title: "Etiquetas CN reales: QR escaneable + datos de bodega (cierra mocks de SDD-0031)"
status: in-progress
author: "Claude (DTD)"
created: 2026-06-20
updated: 2026-06-20
supersedes: null
superseded_by: null
related: ["0031", "0097", "0096", "0008"]
confidencialidad: interna
---

# SDD-0100 — Etiquetas CN reales (QR + datos de bodega)

## 1. Resumen en una línea

El generador de etiquetas por cartón `/studio/etiquetas` (SDD-0031) ya existe y es completo, pero
traía **dos mocks** que se mandaban impresos al proveedor: (a) el **QR** era visual **no escaneable**,
y (b) los **datos de la bodega CN estaban inventados** (contactos/teléfonos/WeChat falsos + códigos
`GZ-B2`/`SZ-C1` que **no existen** en `warehouses_cn` → caían a `—`). Este SDD los reemplaza por
**reales**: QR escaneable (`qrcode.react` → `/verificar`) + contacto/dirección de la bodega desde
**`CONTACT.cn`** (fuente única). **Sin migración.**

## 2. Contexto

`/studio/etiquetas` (SDD-0031, en prod desde NORTE-SYNC v3.7) genera planchas A4 + térmico con Box
X/Y, almacén CN y mensaje al supplier. Dos huecos eran mocks: el QR (`Label.tsx · QrMock`, djb2) y el
`HUB_DATA` hardcodeado con datos de bodega falsos. El QR del proveedor en `/p/[token]` (SDD-0097) ya
usa `qrcode.react`, y la NAP real de la bodega CN ya vive en `CONTACT.cn` — este SDD alinea el
generador del Studio a ambas fuentes reales.

## 3. Alcance (decisión founder · 2026-06-20)

- **QR real** → `/verificar?c=<MARKBOX>&n=<caja>/<total>` (escaneable, único por cartón). ✓
- **Datos de bodega reales** desde `CONTACT.cn`. **Decisión:** DTD opera **una** bodega real (Yiwu)
  → todas las etiquetas usan el **contacto único** de `CONTACT.cn`; **sin migración**. El selector
  multi-hub queda como futuro (los otros hubs son catálogo, sin contacto propio).
- **Fuera** (deuda, §6): `/verificar` mostrar el `&n=`, QR por-cartón en `/p/[token]`.

## 4. Cambios

- **`lib/studio/etiquetas-qr.ts`** (nuevo): `labelVerifyUrl(markbox, box, total)` puro + `VERIFY_BASE`.
- **`Label.tsx`**: (1) `QrMock`/`hashStr` (mock) → `<QRCodeSVG>` (qrcode.react) con quiet-zone
  (`marginSize=4`) + nivel L en compacto; (2) `HUB_DATA` inventado → `warehouseAddress()` lee
  `CONTACT.cn` (林冠 Lin Guan, móvil +86 186 0689 1419, WeChat DTDLogistic, 浙江省义乌市义乌港二期直通仓2栋2号).
- **`LabelGeneratorClient.tsx`**: copy del checkbox del QR.
- **Test**: `lib/studio/__tests__/etiquetas-qr.test.ts` (formato de URL · saneo · único por cartón).

## 5. Verificación

`node scripts/verify.mjs` VERDE + `pnpm build`. Unit: `labelVerifyUrl`. Visual: `ui-ux-designer`.
Sin preview en navegador: ruta del Studio autenticada y `dev` apunta a prod → se valida por build +
revisión de código.

## 6. Deuda anotada (NO en este SDD)

- **`/p/[token]`** QR genérico (mismo markbox en todas las cajas) — falta `&n=` por caja.
- **`/verificar`** ignora `&n=` — podría acusar "caja X de Y".
- **Selector multi-hub:** hoy 1 bodega real (Yiwu); el selector ofrece 5 hubs del catálogo
  `warehouses_cn` que DTD no opera. A futuro: limitar el selector a almacenes activos, o agregar
  contacto por hub a `warehouses_cn` (micro-migración) si se abren más bodegas.

## 7. Estado

**in-progress** en `feat/etiquetas-carton` (worktree secundario). **Sin push, sin merge** — el commit
queda en la rama para coordinación. Sin migración.
