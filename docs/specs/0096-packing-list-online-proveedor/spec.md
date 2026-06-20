---
sdd: "0096"
title: "Packing list online del proveedor + adjuntos por el link"
status: in-progress
author: "Claude (DTD)"
created: 2026-06-19
updated: 2026-06-19
supersedes: null
superseded_by: null
related: ["0057"]
confidencialidad: interna
---

# SDD-0096 — Packing list online del proveedor + adjuntos por el link

## 1. Resumen en una línea

El proveedor chino abre `/p/{token}`, **llena el packing list/factura online y lo envía** (guardado append-only + versionado por orden), puede **descargar y resubir** el Excel, y **sube fotos del producto** + cualquier otro documento — todo sin login, con la marca DTD Cargo, bilingüe ZH/ES. Extiende SDD-0057.

## 2. Problema

Cuando el cliente le compra a su proveedor chino, el proveedor manda la mercancía a la bodega de Yiwu **bien marcada** + un **packing list/factura** + idealmente **fotos del producto** (a veces el detalle dice "lamps" y no sabemos cómo es). El método viejo (grupo WeChat + Excel devuelto por el grupo) ya no se usa.

Hoy `/p/{token}` (SDD-0057, migr 0105/0117/0118/0119) ya da: dirección de la bodega CN con el Shipping Mark, etiquetas con QR, y **descarga** de un Excel pre-llenado. Pero el proveedor **solo puede descargar** — no hay forma de que llene y **envíe** los datos, ni de que suba fotos.

Tres gaps:

1. **Form online versionado** — el proveedor llena y **envía** el packing list; "graba 1, 2, 3 veces" (ilimitado + historial), atado a la orden.
2. **Re-subida del Excel** — si tiene problemas online, descarga el Excel, lo llena y lo **vuelve a subir** en el mismo link.
3. **Fotos + documentos** — sección para subir **fotos del producto** + cualquier otro documento (Excel/PDF/etc.), para entender qué es la mercancía.

## 3. Decisiones del founder (2026-06-19)

| Tema | Decisión |
|---|---|
| Enfoque | **Extender `/p/{token}`** — reusa token, plantilla, dirección y bucket existentes. |
| Guardados del form | **Ilimitado + historial** — append-only versionado por **orden (prealerta)**. Anti-abuso por IP. |
| Adjuntos | Proveedor sube **Excel llenado + fotos + otros docs** por el link → reusa `prealerta_documents`. |
| Contacto instructivo | **吴小姐 (Srta. Wu) + WeChat DTDLogistic**; teléfono **186-0689-1419 SIEMPRE** (canónico; corrige el 180 del repo). |
| Idioma | Form + adjuntos **bilingües ZH/ES**; instructivo copy-paste del registro solo 中文. |
| Identificación | Por **token de la orden** (`/p/{token}`) — el token es la capability. |
| Formato imprimible | **1 página A4** horizontal (compacto); auto-totales + agregar **1 o 5** filas + lógica por fila. |
| Plantilla Excel | **Regenerada branded** (wine `#7F0F1A` / navy `#0F1E3D` / cream), reemplaza la off-brand; fit a **1 página**; moneda **USD/RMB/EUR** editable. |
| Notas del Excel | **Tuteo venezolano, método nuevo** — sin grupo WeChat obligatorio: marca cada caja con el Shipping Mark + declara la marca real. |
| Export / formato (reconciliación 2026-06-19) | **Excel (SheetJS) es el canónico** (confirmado founder). El prototipo del Norte v4.4 traía además export **PDF/imprimir + etiquetas Shipping Mark por cartón**; el **PDF queda superseded por el Excel**, y las **etiquetas por cartón = mejora futura** (no shippeada). El `_norte/packlist` se realinea a Excel en el próximo NORTE-SYNC (no se edita el prototipo a mano — gobernanza). |

## 4. Modelo de datos (migr `0147_supplier_packing_uploads.sql` — NO a prod desde acá)

**(a) `packing_list_submissions`** — append-only, versionada por `prealerta_id`:
- Identidad: `tenant_id`, `prealerta_id` (FK), `client_markbox`, `version_no`, `is_current`.
- Snapshot del proveedor: `supplier_company/contact/email/wechat/phone` (NO muta `suppliers_cn`).
- Documento: `currency` (enum `packing_list_currency` = USD/RMB/EUR, default USD), `doc_date`, `folio`, `supplier_note`, `rows` (jsonb).
- Totales re-sumados: `total_ctns/qty/amount/weight/cbm`.
- Auditoría: `submit_ip`, `user_agent`, `created_at`, `deleted_at`.
- Índices: único parcial `(prealerta_id) where is_current and deleted_at is null` + `(prealerta_id, version_no)`.
- RLS: `authenticated` por `tenant_id = get_user_tenant_id()` + `service_role all`; sin policy anon.

**(b) RPCs `security definer set search_path = public`** (grants hardened):
- `next_packing_list_folio(uuid) → text` — `DTD-PL-YYYY-NNNN` (calca `next_estimate_code`). `authenticated + service_role`.
- `submit_packing_list(p_prealerta_id, p_tenant_id, p_client_markbox, p_currency, p_doc_date, p_supplier_*, p_supplier_note, p_rows, p_total_*, p_submit_ip, p_user_agent) → row` — versionado atómico (`pg_advisory_xact_lock` por `prealerta_id` → `version_no = max+1` → flip `is_current=false` → insert vigente). **Solo `service_role`** (path servidor de confianza).

**(c) Adjuntos del proveedor — extender `prealerta_documents` (SDD-0057):**
- `alter type prealerta_doc_type add value 'otro'` (cualquier otro documento).
- `add column source text not null default 'client'` (client/supplier/team).
- Bucket `prealerta-docs`: `allowed_mime_types` ampliado a Office (xlsx/xls/csv/docx/doc) + imágenes + pdf; `file_size_limit = 15 MB`.

## 5. Endpoints (rutas públicas Supabase-backed, fuera de la frontera ESLint)

- **`POST /p/{token}/packlist`** (`app/p/[token]/packlist/route.ts`, junto al GET de descarga): resuelve token→prealerta con admin client; honeypot `empresa_web`; throttle `portal_registro_throttle` prefijo `packing:`; `validatePackingListInput`; `submit_packing_list` (totales **re-sumados server-side** vía `computeTotals`); aviso al equipo (`packing-list-notify`, best-effort). Devuelve `{ ok, folio, versionNo }`.
- **`POST /p/{token}/upload`** (`app/p/[token]/upload/route.ts`, multipart): resuelve token→prealerta; honeypot + throttle prefijo `upload:` + tope de archivos; calca `uploadPrealertaDoc` con admin client (`source: 'supplier'`, `uploaded_by: null`); `doc_type` por MIME (imagen→`foto`, hoja de cálculo→`packing`, resto→`otro`); rollback del object si falla el insert. Devuelve `{ ok, uploaded }`.

## 6. Lógica pura y UI

- **`lib/studio/prealertas/packlist-form.ts`** — `validatePackingListInput` (≥1 fila con nombre, ≥1 contacto, cap ~500 filas, largo de strings) + `computeTotals` (re-suma autoritativa; NO confía en el cliente; no evalúa "32+1"). Se importa en el form (totales en vivo) y en el POST (re-suma).
- **`app/p/[token]/PackingListFormSection.tsx`** (`"use client"`) — cabecera editable (empresa/contacto/email/WeChat/teléfono/fecha/moneda) + tabla de mercancía bilingüe (filas estilo-calculadora, totales en vivo, +1/+5 filas + quitar), submit → POST. Éxito: folio + "可多次修改并重新提交 / puedes corregir y reenviar". Print CSS propio → 1 página A4.
- **`app/p/[token]/SupplierUploadSection.tsx`** (`"use client"`) — input multi-archivo (imágenes + Excel + PDF/doc), POST `/upload`, muestra lo subido.
- **`ProviderShareClient.tsx`** — la sección "packing list" pasa a 3 partes: (a) form online, (b) descarga del Excel (GET, se mantiene), (c) subida de fotos/documentos.

## 7. Formato imprimible: Excel branded (1 página A4)

- `scripts/build-packlist-template.mjs` (exceljs, **devDependency**) genera `public/templates/dtd-packing-list-invoice.xlsx` branded (wine/navy/cream, header DTD Cargo, título bilingüe, grilla de proveedor, tabla de mercancía, fila de totales con fórmulas SUM, notas en tuteo, tarjeta Shipping Mark, firmas, celda de moneda con validación de lista). `pageSetup` landscape A4 `fitToWidth:1 fitToHeight:0` + `printArea` → 1 página.
- Las 5 celdas pre-llenadas por el GET viven en posiciones fijas: **C5** proveedor · **C6** markbox · **C7** cliente · **C8** WeChat · **I3** folio. exceljs las emite como sharedString (`<c r="C6" s="N" t="s">`), que `setInlineCell` (fflate) ya maneja → `fillPacklist` **sigue en fflate** (runtime liviano, no carga exceljs en la serverless del GET).
- Comando: `pnpm build:packlist-template` (binario committeado en la rama).

## 8. Alcance

- **Slice A (este SDD, V1):** form online + adjuntos + Excel branded + tokens de contacto (tel 186) + `ChinaSupplierClip` en el registro + migr 0147 (archivo). V1 **notifica al equipo** por email + Telegram al recibir.
- **Slice B (fast-follow, NO este SDD):** visor en el Studio (cola de prealertas) para leer envíos + adjuntos por orden (último + historial).

## 9. Landmines

1. Bucket MIME: `prealerta-docs` rechazaba xlsx → ampliado en 0147 **y** en `PREALERTA_DOC_ALLOWED_MIME` (`types.ts`).
2. `ALTER TYPE … ADD VALUE 'otro'` fuera de transacción con uso inmediato (la migr solo lo agrega → ok; si `apply_migration` se queja, split a 0148).
3. RPCs anon-executable: `revoke execute from public, anon`; `submit_packing_list` solo `service_role`; `search_path = public`.
4. Enum `currency` validado ∈ {USD,RMB,EUR} antes de la RPC (default USD).
5. Carrera 1ª versión → 23505: advisory lock por `prealerta_id`.
6. Throttle reusa `portal_registro_throttle` (prefijos `packing:` / `upload:`); no crea tabla.
7. Notify ≠ pérdida: fila/archivo ya guardado → fallo de aviso = warning + `ok`.
8. No muta `suppliers_cn` desde el público (snapshot del contacto en `packing_list_submissions`).
9. `ChinaSupplierClip` retrocompatible (sin prop = comportamiento actual en `/contacto`).
10. Rollback de storage si el insert de `prealerta_documents` falla.

## 10. Lo que le queda a la coordinación / founder

- **Aplicar `0147`** a prod (queda como archivo); ojo con `ALTER TYPE ADD VALUE` (¿split a 0148?).
- **Merge** `feat/packing-list-online` → `main` + **push** (= deploy) — lo hace la coordinación.
- **Teléfono 186:** el cambio 180→186 en `CONTACT.cn` propaga a `/p/[token]`, `/contacto` clip, FAQ, AlibabaGuide.
- **Persona del receptor:** el bloque de recepción de `/p/[token]` muestra `仓库联系人 林冠`; el instructivo nuevo usa 吴小姐 — decidir si el receptor físico sigue siendo 林冠.
- **Slice B** (visor Studio) si se activa.
