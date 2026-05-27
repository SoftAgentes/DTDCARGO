# AUDIT cross-módulo · prod Next.js vs Claude Design v1.7

> **Fecha**: 2026-05-27
> **Source**: `docs/design/studio/v1.7-claude-design/project/`
> **Target**: `app/studio/(app)/`
>
> Objetivo: identificar gap entre lo diseñado por Claude Design y lo
> implementado en producción. Output priorizado para portar lo faltante.
>
> Leyenda:
> - ✅ **alineado** — implementado + visualmente coherente con handoff
> - 🟡 **divergente** — implementado pero diverge del handoff (rework parcial)
> - 🔴 **falta portar** — diseñado, NO implementado en prod
> - ⚪ **N/A** — feature cross-módulo o sin equivalente directo
> - ➕ **extra prod** — implementado sin diseño en handoff (SDD propio)

---

## 1. ERP modules (v1.0 + nuevo/ overrides)

| Módulo handoff | JSX handoff | Path prod | Estado | Notas / siguiente acción |
|---|---|---|---|---|
| **admin** | `erp/modules/admin.jsx` (98KB) | `app/studio/(app)/admin/` | 🟡 divergente | Handoff tiene 11 secciones (BÁSICO/AVANZADO + scrapers BCV). Prod tiene admin pero parcial. Auditar secciones. |
| **admin-brand** | `erp/modules/admin-brand.jsx` (21KB) | — | 🔴 falta portar | Nuevo en v1.7. Gestión visual de marca desde admin. |
| **admin-routes** | `erp/modules/admin-routes.jsx` (56KB) | — | 🔴 falta portar | CRUD rutas + catálogo ciudades IPOSTEL. Vital para Despacho. |
| **audit-log** (v1.0) | `erp/modules/audit-log.jsx` (4KB) | — | 🔴 falta portar | Básico legacy. Mejor portar la versión `nuevo/` |
| **audit-log** (nuevo) | `nuevo/modules/audit-log.jsx` (29KB) | — | 🔴 falta portar | Drill-down con 5 tabs (Resumen/Diff/Actor/Relacionados/JSON). |
| **calendar** | `erp/modules/calendar.jsx` (29KB) | `app/studio/(app)/calendario/` | 🟡 verificar | Mes/semana/agenda + feriados CN/VE. Auditar tabs. |
| **clients** | `erp/modules/clients.jsx` (15KB) | `app/studio/(app)/clientes/` | 🟡 verificar | Tabla + drawer con cross-links Estado de cuenta + Etiquetas. |
| **cn** (almacén) | `erp/modules/cn.jsx` (69KB) | `app/studio/(app)/cn/` | 🟡 verificar | Descripción mercancía + scope + traductor. v1.7 tiene `liberarADespacho()`. |
| **comments** | `erp/modules/comments.jsx` (13KB) | — | ⚪ N/A | Feature cross-módulo (@menciones) — probablemente inline en cada módulo |
| **costing** | `erp/modules/costing.jsx` (40KB) | `app/studio/(app)/costing/` | 🟡 verificar | Editor + templates por ruta + USD/VES + forecast. |
| **dashboard** (v1.0) | `erp/modules/dashboard.jsx` (14KB) | `app/studio/(app)/dashboard/` + `resumen/` | 🟡 verificar | Hay 2 paths en prod. Reconciliar. |
| **dashboard** (nuevo override) | `nuevo/modules/dashboard.jsx` (39KB) | mismo path | 🔴 falta portar | Editor de KPIs/widgets + 14 KPIs catálogo + 7 widgets + drag-to-reorder + persistencia |
| **despacho** | `erp/modules/despacho.jsx` (84KB) | `app/studio/(app)/despacho/` | 🟡 verificar | Cola priorizada + scoring + asignación. Auditar contra handoff. |
| **despacho-rules** | `erp/modules/despacho-rules.jsx` (59KB) | `app/studio/(app)/despacho/reglas/` | 🟡 verificar | Stripe/Linear cards plegables + Pago primero anclado + presets |
| **despacho-dashboard** | `erp/modules/despacho-dashboard.jsx` (7KB) | — | 🔴 falta portar | 5 KPIs + ranking rutas + top ciudades |
| **documents** | `erp/modules/documents.jsx` (5KB) | `app/studio/(app)/documentos/` | 🟡 verificar | Wireado a `openGenerateBLModal` en v1.6 |
| **invoices** | `erp/modules/invoices.jsx` (11KB) | `app/studio/(app)/facturacion/` | 🟡 verificar | Auditar contra handoff |
| **leads** | `erp/modules/leads.jsx` (29KB) | `app/studio/(app)/leads/` | 🟡 verificar | Kanban + Tabla + Timeline + drawer |
| **mailing** (orquestador) | `erp/modules/mailing.jsx` (3KB) | `app/studio/(app)/mailing/` | ✅ alineado | 6 tabs (Logs/Templates/Reglas/Config/Blacklist) — implementadas |
| **mailing-templates** | `erp/modules/mailing-templates.jsx` (25KB) | mailing tab | 🟡 verificar | UI implementada hoy. Verificar match. |
| **mailing-signatures** | `erp/modules/mailing-signatures.jsx` (16KB) | — | 🔴 falta portar | Firmas por usuario · 5 layouts · NO existe en prod |
| **mailing-compose** | `erp/modules/mailing-compose.jsx` (12KB) | — | 🔴 falta portar | Envío manual desde compose tab · NO existe |
| **mailing-rules** | `erp/modules/mailing-rules.jsx` (8KB) | mailing tab Reglas | ✅ alineado | Runtime engine activo (SDD-0026) |
| **mailing-config** | `erp/modules/mailing-config.jsx` (20KB) | mailing tab Config | ✅ alineado | UI + toggle test_mode |
| **mailing-logs** | `erp/modules/mailing-logs.jsx` (7KB) | mailing tab Logs | ✅ alineado | Filtros + StatusBadge tonal |
| **quick-email** | `erp/modules/quick-email.jsx` (14KB) | — | ⚪ N/A | Modal global · puede ir en wiring |
| **quotes** | `erp/modules/quotes.jsx` (14KB) | `app/studio/(app)/cotizador/` | 🟡 verificar | Calculadora en vivo |
| **rates** | `erp/modules/rates.jsx` (5KB) | `app/studio/(app)/tarifas/` | 🟡 verificar | |
| **reports** | `erp/modules/reports.jsx` (36KB) | `app/studio/(app)/reportes/` | 🟡 verificar | 7 tabs por área |
| **seniat** | `erp/modules/seniat.jsx` (23KB) | `app/studio/(app)/seniat/` | 🟡 verificar | Workflow aduana |
| **shipments** | `erp/modules/shipments.jsx` (33KB) | `app/studio/(app)/embarques/` + `tracking/` | 🟡 verificar | Tabla + Kanban + drawer detalle |
| **suppliers** | `erp/modules/suppliers.jsx` (19KB) | `app/studio/(app)/proveedores/` | 🟡 verificar | Contactos WeChat + ratings |
| **tms** | `erp/modules/tms.jsx` (33KB) | `app/studio/(app)/tms/` | 🟡 verificar | Flota + choferes + rutas + GPS + incidencias |
| **tracking** | `erp/modules/tracking.jsx` (11KB) | `app/studio/(app)/tracking/` | 🟡 verificar | Mapa + timeline |
| **users** | `erp/modules/users.jsx` (15KB) | `app/studio/(app)/usuarios/` | 🟡 70% | Hoy hicimos Fase A + C alineadas. Falta Fase B (schema team/2FA/scope) + posible refinamiento del handoff v1.7. |
| **vault** | `erp/modules/vault.jsx` (42KB) | `app/studio/(app)/no-olvidar/` | 🟡 verificar | Renombrado a No-Olvidar. Schema implementado (SDD-0025) pero UI puede divergir. |
| **ve** (almacén) | `erp/modules/ve.jsx` (5KB) | `app/studio/(app)/ve/` | 🟡 verificar | Scope por almacén |
| **venezuela-catalog** | `erp/modules/venezuela-catalog.jsx` (23KB) | — | 🔴 falta portar (como data) | 24 estados + IPOSTEL. NO es UI, es data + helpers `window.VECatalog` |

---

## 2. Módulos NUEVOS en `nuevo/modules/` (v1.1+)

| Módulo | JSX | Path prod | Estado | Notas |
|---|---|---|---|---|
| **conciliacion** | `nuevo/modules/conciliacion.jsx` (23KB) | — | 🔴 falta portar | Subir extracto bancario + auto-matching con facturas + confidence |
| **contabilidad** | `nuevo/modules/contabilidad.jsx` (53KB) | — | 🔴 falta portar | Plan cuentas freight-forwarder VE (52 cuentas 4 niveles) + libro diario + P&L + Balance + Flujo caja + Margen por embarque + lock password |
| **contabilidad-data** | `nuevo/modules/contabilidad-data.jsx` (21KB) | — | 🔴 falta portar | Data + helpers contabilidad |
| **label-generator** | `nuevo/modules/label-generator.jsx` (32KB) | `app/studio/(app)/etiquetas/` | 🟡 verificar | Plancha PDF bilingüe ES/中文 + 4 formatos + ×1-×4 copias |
| **qr-queue** | `nuevo/modules/qr-queue.jsx` (34KB) | `app/studio/(app)/cola-qr/` | 🟡 verificar | Vista oficina cola QR + storage listener |
| **wiring** | `nuevo/modules/wiring.jsx` (31KB) | `app/studio/_components/wiring/` | ✅ alineado | 6 modals globales (Profile/Shortcuts/GenerateBL/OAuth/Attach/Schedule). Implementado hoy. |

---

## 3. Pantallas standalone (`nuevo/pantallas/`)

| Pantalla | JSX | Estado | Notas |
|---|---|---|---|
| **Perfil chofer** | `chofer-perfil.jsx` (34KB) | 🔴 falta portar | 7 perfiles · al click en card TMS · standalone HTML |
| **Perfil camión** | `camion-perfil.jsx` (36KB) | 🔴 falta portar | 7 perfiles · al click en patente · standalone HTML |
| **Perfil agente aduanal** | `agente-perfil.jsx` (37KB) | 🔴 falta portar | 4 perfiles · al click en card SENIAT · standalone HTML |
| **Estado de cuenta cliente** | `estado-cuenta.jsx` (48KB) | 🔴 falta portar | Cuenta corriente + aging + mensual + métodos de pago + condiciones crédito + transacciones en Bolívares + tasas BCV/Paralelo |

---

## 4. Mobile ERP

| Pantalla | JSX | Estado | Notas |
|---|---|---|---|
| **Mobile ERP** | `nuevo/mobile/app.jsx` (56KB) | 🔴 falta portar | 5 pantallas: Inicio · Tracking · Clientes cerca · Gastos rápidos · Más. Travel banner + modal nuevo gasto USD/VES/CNY |

---

## 5. Apps móviles operario (v1.0)

| App | JSX handoff | Path prod | Estado |
|---|---|---|---|
| Operario CN | `operario/app.jsx` | `app/m/cn/` | ✅ portado (SDD-0027) |
| Operario VE (chofer) | `operario/ve.jsx` | `app/m/ve/` (camionero) | ✅ portado |
| Bodeguero VE | `operario/bodeguero.jsx` | `app/m/ve/` (bodeguero) | ✅ portado |
| Operario Multi (picker) | — | `app/m/` (picker) | ✅ |
| Bodeguero despacho | `operario/bodeguero-despacho.jsx` | — | 🔴 falta integrar (Vista 3 del módulo Despacho) |
| Transportista (camionero) | `operario/camionero.jsx` | — | 🔴 falta integrar (POD + GPS + bridge) |

---

## 6. Portal cliente

| Pantalla | JSX handoff | Path prod | Estado |
|---|---|---|---|
| Portal app | `portal/app.jsx` | `app/` (sitio público) | 🟡 verificar |
| Registro cliente | `portal/registro.jsx` (29KB) | — | 🔴 falta portar | 3 pasos + confirmación + MARKBOX gen + foto cédula + foto fachada + guía visual codificación |

---

## 7. Sistemas globales (no-módulos)

| Sistema | Archivo | Estado | Notas |
|---|---|---|---|
| **Feature flags** | `nuevo/feature-flags.jsx` (3KB) | 🔴 falta portar | `window.DTDFlags` · ocultan módulos del sidebar + persistencia localStorage |
| **Rates BCV** | `nuevo/rates.jsx` (NA) | 🔴 falta portar | `window.ERPRates` · helper global tasas USD/VES/CNY + write desde scrapers |
| **OD Bridge** | `erp/od-bridge.jsx` (3KB) | 🔴 falta portar | Pipeline localStorage CN→Despacho→Bodeguero→Transportista |
| **Data Bridge** | `erp/data-bridge.jsx` (6KB) | 🔴 falta portar | Stores cnInbox + clients + rules + routes + cities + rates |
| **Tweaks panel** | `erp/tweaks-panel.jsx` (24KB) | ⚪ N/A | Solo sandbox dev mode (theme/density toggle) |
| **Sidebar grupos colapsables** | `erp/shell.jsx` | 🟡 divergente | Handoff tiene OPERACIÓN/COMERCIAL/FINANZAS/SISTEMA con persistencia. Prod tiene sidebar pero auditar grupos. |

---

## 8. Prod sin handoff explícito (SDDs propios)

| Path prod | Origen | Estado |
|---|---|---|
| `bugs/` + `mis-bugs/` | SDD-0036 Bug Reporter | ✅ implementado + Fase 4.5 + Fase 5 hoy |
| `operarios/` | SDD-0024 admin operarios | ✅ implementado |
| `ajustes/` | ? | Verificar qué es |
| `no-olvidar/` | SDD-0025 (renombrado de Vault) | ✅ schema + UI parcial |

---

## 🎯 Prioridades sugeridas para portar

### Tier 1 — alto valor operativo, bajo esfuerzo
1. **Sidebar grupos colapsables** (OPERACIÓN/COMERCIAL/FINANZAS/SISTEMA + persistencia)
   — mejora navegación inmediata, ~1h
2. **Feature flags reales** (`DTDFlags`) — esconder módulos no usados, ~1h
3. **venezuela-catalog** como data + helpers — habilita CityPicker, geocoding, registro
   ~30 min porting puro

### Tier 2 — flow operativo core
4. **admin-routes** (CRUD rutas + ciudades IPOSTEL) — bloquea despacho ~3-4h
5. **despacho-rules** (motor scoring + pago primero) — bloquea operación despacho ~3-4h
6. **despacho-dashboard** (KPIs) — visibilidad operativa ~1-2h
7. **OD Bridge + Data Bridge** (pipeline CN→Despacho→Bodeguero→Transportista)
   ~2-3h (parte va a Supabase realtime en lugar de localStorage)

### Tier 3 — completitud comercial
8. **Estado de cuenta cliente** — vista profunda + Bs. + tasas ~4-5h (grande)
9. **Perfiles standalone** (chofer, camión, agente) — al click en cards
   ~3-4h cada uno
10. **Registro cliente** (3 pasos + MARKBOX + foto cédula + foto fachada)
    ~3-4h (incluye storage de fotos)

### Tier 4 — finanzas (SDD futuros)
11. **Conciliación bancaria** ~6-8h
12. **Contabilidad QBO-like** ~10-15h (módulo grande)
13. **Audit log con drill-down** ~3-4h

### Tier 5 — mobile + completitud admin
14. **Mobile ERP** (5 pantallas) ~6-8h
15. **admin-brand** (gestión visual marca) ~2-3h
16. **Dashboard editor** (KPIs/widgets configurables + persistencia) ~3-4h

### Tier 6 — features cross-módulo
17. **Mailing signatures** (5 layouts firma por usuario) ~2-3h
18. **Mailing compose** (envío manual con template + adjunto) ~3-4h
19. **Quick email modal** (modal global) ~1-2h

---

## ⚠ Auditorías pendientes (módulos 🟡 verificar)

Cada uno necesita un read del JSX handoff + screenshot prod + identificación
de gaps específicos. Estimación: ~20-30 min por módulo. Hacer cuando se
toque cada uno por feature request o por sprint dedicado.

Lista: admin, calendar, clients, cn, costing, dashboard, despacho,
despacho-rules, documents, invoices, leads, mailing-templates, quotes,
rates, reports, seniat, shipments, suppliers, tms, tracking, users, vault,
ve, label-generator, qr-queue.

---

## 📊 Resumen ejecutivo

- **✅ Alineado** (4): mailing tabs (Logs/Reglas/Config/orquestador) + wiring modals
- **🟡 Divergente** (24): mayoría de módulos prod — necesitan audit detallado
- **🔴 Falta portar** (24): módulos nuevos, pantallas standalone, mobile ERP,
  sistemas globales (bridges, feature flags, rates)
- **⚪ N/A** (3): comments, quick-email (modal global), tweaks-panel (sandbox only)
- **➕ Extra prod** (4): bugs/, mis-bugs/, operarios/, no-olvidar/

**Top valor por hora invertida**:
1. Sidebar grupos colapsables (~1h)
2. Feature flags reales (~1h)
3. venezuela-catalog data (~30min)
4. despacho-rules + despacho-dashboard (~5h combinado, desbloquea flow operativo)

**Bloqueador conceptual**: el bridge end-to-end (CN → Despacho → Bodeguero
→ Transportista) está diseñado con localStorage. Para Next.js + Supabase
hay que decidir: ¿lo hacemos con Supabase Realtime (mejor) o emulamos
localStorage cross-tab? Decidir antes de portar.
