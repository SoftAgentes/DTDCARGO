# Handoff: DTD-Cargo · ERP + Portal (freight forwarding CN→VE)

## Overview
DTD-Cargo es un ERP vertical para un freight forwarder que importa de China a Venezuela (DDP),
más un Portal del Cliente externo y apps móviles de operario. Esta sesión amplió la cobertura
financiera, logística, comercial y de cumplimiento, y dejó el sistema con una capa ejecutiva,
documental y fiscal completa.

**Estado:** prototipo funcional de alta fidelidad (React in-HTML, sin build). Todo "anda" con
mock data realista persistida en `localStorage`. **No hay backend.** El trabajo para Claude Code
es **portar a un proyecto real (build + backend)** respetando los patrones ya establecidos, o
wirear los servicios reales detrás de las interfaces ya construidas.

## About the Design Files
Los archivos del proyecto **NO son mocks estáticos**: son una app React de alta fidelidad escrita
con JSX inline transpilado por Babel en el navegador (sin bundler), con estado y persistencia reales
en `localStorage`. Funcionan como **referencia de diseño Y de comportamiento** a la vez.

La tarea **no** es "recrear HTML": es **(a)** portar esta app a un entorno productivo (Vite/Next +
React, o el stack que el equipo elija) y **(b)** reemplazar la capa de datos mock (`window.ERPData`,
`window.*Data`) y las acciones mock por APIs reales — manteniendo exactamente la UI, los tokens y los
patrones de componentes que ya existen.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales y provienen de
un sistema de tokens único (`erp/tokens.css`). Recrear pixel-perfect usando esos tokens. El Brand Book
(`Brand Book DTD v3.0.html`) y `CLAUDE.md` son la fuente de verdad de identidad y guardrails — **leer
`CLAUDE.md` primero**, define reglas absolutas de marca (paleta wine/navy, fuentes Archivo + JetBrains
Mono + Noto Sans SC, prohibición de AI slop, etc.).

## Arquitectura (cómo está armado hoy)
- **Sin build.** `DTD Studio · ERP.html` carga, en orden, vía `<script type="text/babel" src=...>`:
  React 18 + ReactDOM + Babel standalone → fundaciones (`erp/icons.jsx`, `erp/i18n-cn.jsx`,
  `erp/data.jsx`, `erp/components.jsx`, `nuevo/rates.jsx`, `erp/shell.jsx`) → módulos `erp/modules/*`
  → overrides `nuevo/modules/*` (reemplazan `window.Module*` con versiones nuevas) → bootstrap inline.
- **Registro de módulos:** el sidebar se define en `erp/shell.jsx` (`MODULES[]`, con `group`, `parent`
  para sub-grupos anidados, `badge`). El router vive en el bootstrap de `DTD Studio · ERP.html`
  (`moduleMap`), que mapea cada `id` a un `window.Module*`. Permisos por rol en `erp/data.jsx`
  (`ROLE_MODULES`).
- **Cada módulo** es una función `function ModuleXxx({ goTo, currentUser, ... })` que se autoexpone
  en `window.ModuleXxx`. Navegación global vía `window.__erpGoTo(moduleId, recordId?, view?)`.
- **Datos** viven en globals: `window.ERPData` (clientes, embarques, facturas, usuarios, proveedores…)
  y data-modules por feature (`window.TesoreriaData`, `NavieraData`, `FidelizacionData`,
  `ConversacionesData`, `ContabilidadData`, `FiscalData`, `DocumentosData`, `CobranzasData`).
  Helpers de tasas en `window.ERPRates` (BCV/paralelo/CNY, `fmtUsd`/`fmtBs`).
- **Config de negocio:** `window.DTDConfig` (localStorage + evento `dtd-cfg-changed`); export CSV en
  `window.DTDExport.csv()`.
- **Componentes compartidos:** `window.ERPUI` (`Btn, Input, Select, Badge, Card, Table, KPI, Drawer,
  Modal, Tabs, Avatar, Progress, Toolbar, Field, EmptyState, PageHeader`, columnas configurables).

## Qué se construyó en esta sesión (cada uno = candidato a endpoint real)
> Detalle completo con archivo+línea+razón en **`nuevo/CHANGELOG.md`** (leerlo entero).

1. **Tesorería** (`nuevo/modules/tesoreria*.jsx`) — caja multi-moneda (USD/VES/USDT/CNY), cuentas por
   pagar (CxP), órdenes de pago/remesas a China. → backend: ejecución wire/USDT, aprobación multi-firma.
2. **Naviera & Consolidación** (`nuevo/modules/naviera*.jsx`) — itinerarios (sailings con cut-off),
   reservas (booking + BL marítimo), consolidación LCL→FCL con ocupación de CBM/peso.
   → backend: scraping de itinerarios, emisión de BL, bin-packing de consolidación.
3. **Conversaciones** (`nuevo/modules/conversaciones*.jsx`) — bandeja unificada WhatsApp/email/portal.
   → backend: WhatsApp Business API, IMAP/SMTP, webhooks, SLA.
4. **Portal · Reclamos** (`portal/app.jsx` `PortalReclamos`) + **Fidelización & Referidos**
   (`nuevo/modules/fidelizacion*.jsx` + `portal/app.jsx` `PortalReferidos`) — tickets formales, niveles
   por facturación, programa de referidos con créditos.
5. **Dirección · Tablero ejecutivo** (`nuevo/modules/direccion.jsx`) — cabina del dueño que cruza todos
   los módulos (solo lectura, defensiva). Admin-only por `ROLE_MODULES`.
6. **Flujo de trabajo** (`nuevo/modules/flujo-trabajo.jsx`) — "workflow map" estilo QuickBooks (diseño
   propio): pantalla de bienvenida por rol + tab en Contabilidad, nodos clickeables con badges en vivo.
7. **Documentos · Hub** (`nuevo/modules/documentos*.jsx`) — DMS por carpetas
   (Operacionales/Logísticas/Contables/Aduaneras·SENIAT/Otras), cada doc adjunto a su transacción.
   Componente embebible `window.DocsForTransaction({kind,id})` usado en detalle de embarque, CxP,
   cliente y factura. → backend: subida real, preview, OCR/auto-clasificación, versionado.
8. **Fiscal · SENIAT** (`nuevo/modules/fiscal*.jsx`) — Libro de Ventas/Compras, Retenciones IVA/ISLR,
   Declaración IVA (USD + VES @ BCV). **Opcional**, controlado por toggle (ver abajo).
   → backend: TXT/XML para portal SENIAT, calendario de contribuyentes especiales.
9. **Reportes** (`erp/modules/reports.jsx`) — 2 niveles: categorías (Operacionales/Comerciales/
   Contables/Combinados/Constructor). Contables leen la fuente real (P&L de `ContabilidadData`, aging
   de `INVOICES`+`TesoreriaData`, IVA de `FiscalData`). **Constructor** = report builder interactivo
   (fuente→agrupar→métrica→filtro→barras/tabla→guardar/exportar CSV).
10. **Cobranzas** (`nuevo/modules/cobranzas*.jsx`) — cola de CxC vencidas con seguimiento (contacto,
    promesa de pago, recordatorio, marcar pagado) + bitácora persistida. → backend: envío real de
    recordatorios, escalamiento automático, registrar pago que baje el saldo.
11. **Facturación IVA-aware** (`erp/modules/invoices.jsx`) — discrimina base+IVA cuando el toggle está ON.

## Feature toggle clave: IVA/SENIAT (OFF por defecto)
`window.DTDConfig.get('iva')` controla toda la capa fiscal. **Apagado por defecto** (DTD hoy no maneja
IVA). Se activa en **Administración → "Impuestos · IVA/SENIAT"** (`nuevo/modules/dtd-config.jsx`,
`AdminFiscalConfig`). Cuando está OFF: se ocultan el tab "Fiscal · SENIAT" de Contabilidad, el reporte
"Posición IVA" y el desglose de IVA en Facturación. Reactivo vía evento `dtd-cfg-changed`. En el backend
esto debe ser una preferencia de tenant.

## Consolidación de versiones
El Portal del Cliente y el Registro se consolidaron a una sola versión (la v2, renombrada a nombres
canónicos `Portal del Cliente.html` / `Registro Cliente.html` / `portal/app.jsx` / `portal/registro.jsx`).
No quedan v1.

## Design Tokens
**No re-derivar.** Están todos en **`erp/tokens.css`** (light + dark + densidad compacta/espaciosa):
- Color: `--wine #7F0F1A` (+ deep/soft/tint/bg), `--bg-base #FBFAF7`, `--bg-sidebar #0F1E3D` (navy),
  `--ink #0F1E3D`, semánticos `--success #1F8A5B` / `--warning #B8893A` / `--danger #A8323E` /
  `--info #2A6FDB` (cada uno con su `-bg`). **Importante:** `--wine-bg` existe (= `--wine-tint`);
  todos los tonos semánticos tienen `-bg`.
- Tipografía: `--f-sans` Archivo, `--f-display` Archivo Black, `--f-mono` JetBrains Mono,
  `--f-cn` Noto Sans SC (solo chino).
- Spacing escala 4px (`--s-1..--s-16`), radios (`--r-xs..--r-pill`), sombras (`--shadow-xs..--shadow-pop`),
  motion (`--ease`, `--dur*`).

## Assets
- Logos/isólogos en `assets/` — sistema de 4 variantes (primary/reverse/mono-light/mono-dark). Ver
  `CLAUDE.md` y `BRAND-MIGRATION-2026-05.md`. Componente `ERPUI.Lockup`.
- Iconos: set propio SVG en `erp/icons.jsx` (`window.Icon.*`), trazo consistente. Esta sesión sumó
  `chat`, `flow`.

## Files (entrypoints)
- `DTD Studio · ERP.html` — ERP admin (entry).
- `Portal del Cliente.html` + `portal/app.jsx` — portal externo del cliente.
- `Registro Cliente.html` + `portal/registro.jsx` — alta de cliente.
- `Modo Cliente.html` — impersonación admin (iframe del portal).
- `Brand Book DTD v3.0.html`, `Logo Oficial.html` — identidad.
- `CLAUDE.md` — **guardrails de marca (LEER PRIMERO)**.
- `nuevo/CHANGELOG.md` — bitácora detallada (archivo+línea+razón) de todo lo construido.
- `HANDOFF.md` / `BACKEND-BRIEF.md` — handoffs previos.

## Recomendación de implementación
1. Leer `CLAUDE.md` (reglas) + `nuevo/CHANGELOG.md` (qué hay).
2. Portar tokens (`erp/tokens.css`) y componentes (`erp/components.jsx`) 1:1 a componentes del stack elegido.
3. Modelar el backend a partir de los data-modules (`window.*Data`) — cada uno es prácticamente el shape
   de una tabla/endpoint.
4. Respetar el patrón de permisos (`ROLE_MODULES`) y el toggle de IVA como preferencia de tenant.
5. Mantener la navegación `goTo` y los embeds (`DocsForTransaction`) como contrato entre módulos.
