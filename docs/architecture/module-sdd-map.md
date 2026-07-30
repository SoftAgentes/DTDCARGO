# Mapa de trazabilidad · módulo ↔ SDD ↔ código

> **Qué hacíamos por módulo y por SDD, de un vistazo** (criterio ISO 9001 · trazabilidad).
> Cableado módulo→código mantenido a mano; se actualiza al cerrar cada SDD. El índice de specs
> con estado vive (generado) en [`docs/specs/README.md`](../specs/README.md).
> ⚠️ Tabla parcial — alta confianza en las filas listadas; completar las que falten al tocarlas.

## Sitio público

| Módulo | SDD | Código (app) | Código (lib) |
|---|---|---|---|
| Sitio público MVP | 0001 | `app/{page,servicios,contacto,noticias,glosario}` + `components/` | `lib/public`, `lib/news` |
| Calculadora flete terrestre | 0002 | `app/calculadora/` | `lib/calculadora.ts`, `lib/data/tarifas-terrestres-vzla.ts` |
| Cotizar (form público) | 0001/0011 | `app/cotizar/` | `lib/calc` |
| Tracking público | 0005/0013 | `app/track/[code]/` | `lib/public/tracking-queries.ts` + `lib/shared/shipment-public.ts` |

## Studio ERP

| Módulo | SDD | Código (app) | Código (lib) |
|---|---|---|---|
| Shell + Auth | 0004, 0007 | `app/studio/(app)/` shell, `(auth)/login` | `lib/auth/session.ts`, `proxy.ts` |
| Administración · Audit log | 0123, 0166, 0172, 0174 | `app/studio/(app)/admin/` | `lib/studio/audit-*` · `entity_audit_log` · `scripts/{seed-e2e,verify-e2e-teardown}.ts` · migraciones por corte |
| Gobernanza ejecutable | 0178, 0183 | entrypoints de agentes + scaffold local read-only sin instalación | `docs/governance/` como fuente normativa · `.agents/plugins/plugins/erp-studio-governance/` como derivado validado |
| Tipografía transversal · VIS-02 | 0175 | `app/{layout,globals}.tsx` · `app/studio/` | `next/font` · tokens de voz · renderers email/PDF |
| Fiscal/SENIAT · tabs accesibles | 0073, 0104, 0180 | `app/studio/(app)/fiscal/` | `lib/studio/fiscal/` |
| Selectores canónicos accesibles | 0108, 0181 | `app/studio/_components/ui/{ClientCombobox,SplitActionButton}.tsx` | `lib/studio/client-search-action.ts` |
| Club DTD · validación de identidad | 0106, 0116, 0182 | `app/studio/(app)/club/` | `lib/studio/club/` |
| Tracking / Embarques | 0005, 0006, 0012, 0013 | `app/studio/(app)/{tracking,embarques}/` | `lib/studio/shipment-*`, `tracking-progress` |
| Cambio de destino | 0009 | (dentro de tracking) | `lib/studio/destination-change.ts` |
| Tarifas (+ config calculadora pública) | 0008, 0055 | `app/studio/(app)/tarifas/` | `lib/studio/rate-*`, `calculator-cities-*` · `supabase/migrations/{0103,0104}` |
| Clientes + MARKBOX | 0010 | `app/studio/(app)/clientes/` | `lib/studio/client-*` |
| Cotizador | 0011 | `app/studio/(app)/cotizador/` | `lib/studio/quote-*` |
| Dashboard | 0014 | `app/studio/(app)/resumen/` | `lib/studio/dashboard-queries.ts` |
| Calendario | 0015 | `app/studio/(app)/calendario/` | `lib/studio/calendar-*` |
| Almacén CN | 0016 | `app/studio/(app)/cn/` + `app/m/cn/` | `lib/studio/warehouse-cn-*` |
| Almacén VE | 0017 | `app/studio/(app)/ve/` + `app/m/ve/` | `lib/studio/warehouse-ve-*`, `warehouse-receipt-ve-*` |
| Aduana SENIAT | 0018 | `app/studio/(app)/seniat/` | `lib/studio/customs-*` |
| TMS · transporte VE | 0019 | `app/studio/(app)/tms/` | `lib/studio/tms-*` |
| Agentes y Skills | 0020 | `app/studio/(app)/admin/agentes/` + `app/api/studio/agents/` | `lib/studio/agents/`, `agent-*` |
| Usuarios & Roles | 0024 | `app/studio/(app)/usuarios/` + `app/invitar/[token]/` | `lib/studio/user-*` |
| No-Olvidar | 0025 | `app/studio/(app)/no-olvidar/` | `lib/studio/no-olvidar-*` |
| Mailing & Notif | 0026 | `app/studio/(app)/mailing/` | `lib/studio/mail/`, `mail-*` |
| Facturación | 0021 | `app/studio/(app)/facturacion/` | `lib/studio/invoice-*` |
| Contabilidad | 0040 | `app/studio/(app)/contabilidad/` | `lib/studio/account-*`, `journal-*`, `accounting/` |
| Cobranzas | 0041 | `app/studio/(app)/cobranzas/` | `lib/studio/payment-*`, `collections-actions`, `accounting/receipt-posting` |
| Tesorería | 0044 | `app/studio/(app)/tesoreria/` | `lib/studio/treasury/` (types, supplier-queries, bill-queries, treasury-actions), `accounting/{bill-posting,supplier-payment-posting}` · `supabase/migrations/0088_tesoreria.sql` |
| Despacho | 0029, 0030 | `app/studio/(app)/despacho/` + `app/m/ve/{bodeguero,camionero}/` | `lib/studio/dispatch-*`, `notify/` |
| Naviera & Consolidación | 0047 | `app/studio/(app)/naviera/` | `lib/studio/naviera/` |
| Proveedores CN & Prealertas (operador) | 0057, 0098, 0163 | `app/studio/(app)/proveedores/` (+ `ServiceRequestsTab`) + dropdown en `app/studio/(app)/etiquetas/` | `lib/studio/prealertas/` · `supabase/migrations/{0105,0118,0119,0150}` · **0163 (`proposed`): orden al operario — eje de ejecución en `prealerta_service_requests` + modalidad en `prealertas`** |
| Etiquetas suppliers CN | 0031 | `app/studio/(app)/etiquetas/` | (labels) |
| QR print queue | 0033 | `app/studio/(app)/cola-qr/` | `lib/studio/qr-queue-*` |
| Wiring modals globales | 0034 | `app/studio/_components/wiring/` | — |
| Bug Reporter | 0036 | `app/studio/(app)/{bugs,mis-bugs}/` + `_components/bug-reporter/` | `lib/studio/bug-*` |
| Comentarios + @menciones | 0045, 0168 (`approved`) | `app/studio/(app)/menciones/` + `_components/comments/` + `_actions/comments.ts` (embed en `tracking/[id]`) | `lib/studio/comments/` · `supabase/migrations/0090_comments.sql` · 0168 aprueba permanencia/restauración sin implementación |
| Dirección · Tablero ejecutivo | 0048 | app/studio/(app)/direccion/ | lib/studio/direccion/ |
| Documentos · Hub (DMS) | 0049 | app/studio/(app)/documentos/ + _components/documents/DocsPanel | lib/studio/documents/ · supabase/migrations/0097 |
| Inventario de Consolidación (WMS) | 0081 | `app/studio/(app)/inventario/` *(propuesto)* | `lib/studio/inventory/` *(propuesto)* — derivación sobre warehouse_receipts_* + consolidations (SDD-0047) |
| Nómina / RRHH (empleados + prestadores) | 0103 | `app/studio/(app)/nomina/` | `lib/studio/nomina/` · `supabase/migrations/{0160,0161}` (Slice A; cálculo LOTTT → Slice B) |
| Bitácora (actas IA + tareas del equipo) | 0146 | `app/studio/(app)/bitacora/` + `app/m/erp/bitacora/` *(propuesto)* | `lib/studio/bitacora/` · `supabase/migrations/{0214,0215,0216}` *(propuesto)* |

## Móvil PWA (operario)

| App | SDD | Código |
|---|---|---|
| CN (recepción) | 0016, 0030, 0154, 0162, 0163 | `app/m/cn/` (`nueva`, `recibir`, `estibar`) — 0163 (`proposed`) suma el checklist de servicios de la llegada al recibir |
| VE bodeguero | 0017, 0030 | `app/m/ve/bodeguero/` |
| VE camionero | 0030 | `app/m/ve/camionero/` |
| ERP móvil (staff) | varios | `app/m/erp/` |

## Back (CMS del sitio público)

| Superficie | Código |
|---|---|
| CMS contenido (noticias/servicios/glosario) | `app/back/(app)/` · `lib/back/` |

## Portal del Cliente (5ª superficie · Supabase-backed)

| Módulo | SDD | Código (app) | Código (lib) |
|---|---|---|---|
| Portal cliente (login magic-link + mis envíos) | 0042 | `app/portal/` (auth/callback/mis-envíos) + admin "Acceso al portal" en `app/studio/(app)/clientes/` (PortalAccessCard) + link "Acceder" en `components/{Nav,Footer}` | `lib/portal/` · `supabase/migrations/0080_portal_cliente.sql` + `0081` |
| Compras/prealertas + proveedores del cliente + link al proveedor | 0057 | `app/portal/(app)/{proveedores,compras}` + `app/p/[token]/` (pública) + CTA del dashboard | `lib/studio/prealertas/` (types/queries/packlist) · `public/templates/dtd-packing-list-invoice.xlsx` |

> Huecos del correlativo (0022-0023, 0027-0028): ver `docs/specs/README.md` — código sin spec o renumerado, auditar. (0021 = Facturación ✅ y 0040 = Contabilidad ✅, ambos construidos.)
