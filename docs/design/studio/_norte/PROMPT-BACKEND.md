# PROMPT · Arranque de Backend · DTD-Cargo (desde v1.9.1)

> Pegá esto al iniciar la nueva sesión (Claude Code) sobre el repo de DTD-Cargo.

---

Soy DTD-Cargo, un freight forwarder que importa de China a Venezuela (DDP). Tengo un **frontend
funcional de alta fidelidad** (React in-HTML, sin build, mock data en `localStorage`).
Quiero **construir el backend real** y portar el front a un build productivo, **sin cambiar la UI,
los tokens ni los patrones**.

## ✅ Arranque YA hecho (2026-05-31) — no lo rehagas, partís de acá

El contrato y el esquema ya están escritos. Tu trabajo es **levantarlos**, no diseñarlos:

- **`backend/prisma/schema.prisma`** — esquema **multi-tenant completo**, derivado 1:1 de los
  shapes mock. 18 modelos con `tenantId` en toda tabla operativa, MARKBOX único por tenant,
  `seq` por proveedor, `DTDU-`/`F-2026-` server-side, `tenant.ivaEnabled` OFF por defecto,
  `markboxSeq` como contador. Enums de estado por entidad. **Revisalo y ajustá** lo que falte,
  pero respetá la estructura.
- **`backend/API-CONTRACT.md`** — contrato REST endpoint→store-mock, con la **regla de oro**
  (`tenantId` siempre del JWT, nunca del body) + paginación/filtros estándar + integraciones externas.
- **`nuevo/api/client.jsx`** — el **seam de front** (`window.DTDApi` / `window.DTDAuth`).
  `window.ERPData` es LA interfaz; el front ya consume por acá en modo `mock`. Cuando tu API
  responda, el front pasa a `rest` con un flip: `DTDApi.config({ mode:'rest', baseUrl:'…' })` y
  `DTDApi.hydrate()` rellena `ERPData` desde la API. **No cambies la firma del seam**, implementá
  los endpoints que ya espera.

## Antes de tocar nada
1. Leé `CLAUDE.md` (guardrails de marca, son reglas absolutas).
2. Leé `BACKEND-BRIEF.md` (arquitectura multi-tenant · regla de oro · orden de implementación).
3. Leé `backend/prisma/schema.prisma` + `backend/API-CONTRACT.md` (tu punto de partida real).
4. Leé `nuevo/CHANGELOG.md` entero (bitácora con archivo+línea+razón de todo lo construido).
5. Leé `design_handoff_dtd_cargo/README.md` (arquitectura + mapa de módulos + pendientes de backend).
6. Mirá cómo está cableado: `DTD Studio · ERP.html` (orden de carga + `moduleMap` + bootstrap),
   `erp/shell.jsx` (`MODULES`, sub-grupos, permisos), `erp/data.jsx` (`ROLE_MODULES`),
   `nuevo/api/client.jsx` (el seam que vas a alimentar).

## Stack sugerido (proponé alternativa si tenés mejor criterio)
- **Front:** Vite + React + TypeScript. Portar `erp/tokens.css` 1:1 y `erp/components.jsx` a componentes
  tipados. Conservar el contrato de navegación `goTo(moduleId, recordId?, view?)`.
- **Back:** API REST (o tRPC) + Postgres + Prisma. **Multi-tenant** (DTD podría ofrecerlo a otros forwarders).
- **Auth:** sesión por rol (los roles ya existen: Admin, Comercial, Operaciones, Contabilidad,
  Almacén CN, Almacén VE, Soporte). Validar permisos por endpoint usando `ROLE_MODULES` como matriz.

## Modelo de datos = los globals `window.*Data`
Cada data-module del front es prácticamente el shape de una tabla/endpoint. Modelar a partir de:
- `window.ERPData` → clientes (MARKBOX `DTD-XXXX`), embarques (`DTDU-XXXXXX`), facturas (`F-2026-XXXX`),
  usuarios, proveedores CN, leads, rutas/puertos.
- `window.TesoreriaData` → cuentas de caja multi-moneda (USD/VES/USDT/CNY), CxP, órdenes de pago.
- `window.NavieraData` → navieras, sailings, bookings/BL, contenedores, consolidación.
- `window.ContabilidadData` → plan de cuentas, asientos, P&L/Balance.
- `window.FiscalData` → libros de venta/compra, retenciones, declaración IVA.
- `window.CobranzasData` → gestión de cobranza (estado, promesa, bitácora).
- `window.FidelizacionData`, `ConversacionesData`, `DocumentosData` → lealtad/referidos, mensajería, DMS.
- Tasas: `window.ERPRates` (BCV/paralelo/CNY).

## Reglas de negocio que NO se negocian
- **Moneda funcional USD**, pero VES @ BCV para lo fiscal (la declaración SENIAT es en bolívares).
- **Toggle IVA/SENIAT = preferencia de tenant, OFF por defecto** (`window.DTDConfig.get('iva')`).
  Con OFF: sin capa fiscal (tab Fiscal, reporte IVA y desglose de factura ocultos). Implementarlo como
  flag de tenant en el backend; el front ya reacciona vía evento `dtd-cfg-changed`.
- **MARKBOX** y numeraciones (`F-`, `DTDU-`, `CXP-`, `REF-`, `REC-`, `DOC-`) son secuenciales server-side.

## Orden de implementación sugerido (de mayor a menor valor)
1. **Núcleo:** auth + tenants + clientes + embarques + facturas (CRUD + estados). Esto enciende medio sistema.
2. **Finanzas:** Facturación → asientos automáticos; Cobranzas (registrar pago baja el saldo real);
   Tesorería (CxP + ejecución de pagos/remesas con aprobación multi-firma).
3. **Fiscal (si IVA ON):** alimentar Libro de Ventas desde facturas emitidas; generar TXT/XML SENIAT.
4. **Logística:** Naviera (scraping de itinerarios reales o carga manual), emisión de BL, motor de
   consolidación LCL→FCL (bin-packing por CBM/peso).
5. **Documentos:** subida real (S3/R2), preview (PDF/imagen), versionado; mantener el vínculo
   doc↔transacción (el front ya lo consume vía `DocsForTransaction({kind,id})`).
6. **Comunicación:** Conversaciones (WhatsApp Business API + IMAP/SMTP + webhooks), recordatorios de
   Cobranzas, emails de Fidelización/Referidos.
7. **BI:** que Dirección (tablero ejecutivo) y Reportes lean datos en vivo; export real .xlsx/PDF.

## Convenciones a respetar
- Persistencia que hoy está en `localStorage` (gestión de cobranza, config IVA, reportes guardados,
  estado del sidebar) → migrar a la DB / preferencias de usuario.
- No inventar colores/fuentes: usar `erp/tokens.css`. No AI slop (ver `CLAUDE.md`).
- Auditoría: ya existe el patrón de audit log; cada acción sensible (crear/editar/eliminar asiento,
  pago, cambio de config) debe registrarse.

## Primer entregable que te pido
El esquema ya existe (`backend/prisma/schema.prisma`) — **no lo rehagas**. Arrancá por:
1. **`prisma migrate`** sobre Postgres + **seed** mínimo (1 tenant DTD + usuarios por rol) desde los mocks.
2. **Auth/tenant/roles**: `/auth/login`, `/auth/refresh`, `/me`. JWT con `{ userId, tenantId, role }`
   (`tenantId = null` ⇒ Plataforma). Validar permisos por endpoint con `ROLE_MODULES`.
3. **CRUD de clientes, embarques y facturas** según `backend/API-CONTRACT.md`, con MARKBOX/`DTDU-`/`F-`
   secuenciales server-side y `tenantId` resuelto del token en TODA query.
4. **Conectar el seam**: el front ya consume vía `window.DTDApi` en modo `mock`. Cambialo a `rest`
   (`DTDApi.config({mode:'rest',baseUrl})`) y verificá que `DTDApi.hydrate()` llena `window.ERPData`
   con datos del tenant logueado. **No rompas la UI** — andá módulo por módulo.
