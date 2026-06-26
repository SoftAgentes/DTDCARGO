# Specs — DTDCargo

SDD (Specification-Driven Development) propio de DTDCargo. **No mezclar con el SDD del ERP HailuWay** — este repo tiene su propio correlativo desde 0001.

## Regla

No hay código sin spec aprobada.

## Estados

```
draft → proposed → approved → in-progress → done → superseded
```

Una spec no puede pasar a `in-progress` sin estar `approved`.

## Estructura

```
docs/specs/
├── README.md
└── NNNN-slug-corto/
    └── spec.md
```

`NNNN` es el siguiente correlativo (0001, 0002, …). Slug en `kebab-case`, corto.

## Commits

Cada PR referencia su spec:

```
feat(DTD-0001): scaffold inicial Next.js + branding
```

<!-- AUTO-INDEX:START (generado por scripts/build-docs-index.mjs · no editar a mano) -->
### Índice de specs (generado · 103 specs)

| # | Spec | Estado | Conf. |
|---|---|---|---|
| 0001 | Sitio web público MVP de DTD·CARGO | done | interno |
| 0002 | Calculadora de Flete Terrestre Venezuela | done | interno |
| 0003 | DoorTuDoor — Arquitectura MVP del ERP interno (multi-tenant r… | approved | interno |
| 0004 | DoorTuDoor — Fase 1: Studio shell + Auth | done | interno |
| 0005 | DoorTuDoor — Fase 2: Módulo Tracking (envíos + estados + dash… | done | interno |
| 0006 | DoorTuDoor — Fase 3: Tracking edición + detalle + timeline + … | done | interno |
| 0007 | DoorTuDoor — Sprint 0.1: Studio Shell v1 (sidebar agrupado + … | done | interno |
| 0008 | DoorTuDoor — Tarifas (módulo rates) · primer módulo real del … | done | interno |
| 0009 | DoorTuDoor — Cambio de destino (feature en Tracking) | done | interno |
| 0010 | DoorTuDoor — Clientes + MARKBOX (catálogo comercial) | done | interno |
| 0011 | DoorTuDoor — Cotizador (Sprint 1 completo) | done | interno |
| 0012 | DoorTuDoor — Embarques (vista comercial agrupada por cliente) | done | interno |
| 0013 | DoorTuDoor — Tracking operativo (mapa + timeline) | done | interno |
| 0014 | DoorTuDoor — Dashboard real (KPIs operativos + comerciales) | done | interno |
| 0015 | DoorTuDoor — Calendario operativo (vista mes + feriados CN/VE) | done | interno |
| 0016 | DoorTuDoor — Almacén CN (recepción + scope + traductor) | done | interno |
| 0017 | DoorTuDoor — Almacén VE (vista derivada + 4 acciones operativas) | done | interno |
| 0018 | DoorTuDoor — Aduana SENIAT (workflow aduanal VE) | done | interno |
| 0019 | DoorTuDoor — TMS · Transporte interno VE | done | interno |
| 0020 | DoorTuDoor — Agentes y Skills · infraestructura + Tracking Co… | done | interno |
| 0021 | Facturación — Invoice + estados + pago (Bloque 1.1 financiero) | done | interno |
| 0024 | DoorTuDoor — Usuarios & Roles V1 simple (invitaciones + 6 rol… | done | interno |
| 0025 | DoorTuDoor — No-Olvidar interno DTD-CARGO · envelope encrypti… | approved | interno |
| 0026 | DoorTuDoor — Mailing & Notificaciones (Resend + templates + s… | done | interno |
| 0029 | DTD Studio — Módulo de Despacho · cola priorizada + motor de … | done | interno |
| 0030 | Despacho · Apps móviles bodeguero VE + camionero VE (PWAs) | done | interno |
| 0031 | Etiquetas suppliers CN · PDF bilingüe ES/中文 + QR mock + copia… | done | interno |
| 0032 | Críticos v1.5 + cross-links cliente · MARKBOX validation + em… | done | interno |
| 0033 | Cola de impresión QR · oficina + push del operario CN | done | interno |
| 0034 | Wiring 9 conexiones rotas · modals globales (DTDWiring) | done | interno |
| 0035 | Dashboard · RecentActivity widget clickeable + CodesSync defe… | done | interno |
| 0036 | Bug Reporter · módulo interno de bug tracking con auto-captur… | done | interno |
| 0038 | i18n CN · región como fuente de verdad + chrome bilingüe es-V… | done | interno |
| 0039 | Gastos CN · scope contenedor/operativo + moneda dual CNY/USD … | done | interno |
| 0040 | Contabilidad — plan de cuentas + diario/mayor + P&L/Balance +… | done | interno |
| 0041 | Cobranzas — recibos de pago + asiento del cobro + cola CxC (B… | done | interno |
| 0042 | Portal del Cliente — auth de cliente + mis envíos (V1) | in-progress | interno |
| 0043 | Conector Kommo CRM — Alcance A (espejo read-only) + Alcance B… | in-progress | interno |
| 0044 | Tesorería — Proveedores + CxP + órdenes de pago + asiento del… | done | interno |
| 0045 | Comentarios + @menciones transversales — hilo embebible en cu… | done | interno |
| 0046 | Verificación de identidad de clientes — motor 2 vías (CNE céd… | done | interno |
| 0047 | Naviera & Consolidación — carriers + itinerarios + bookings/B… | done | interno |
| 0048 | Dirección · Tablero ejecutivo — vista consolidada read-only, … | done | interno |
| 0049 | Documentos · Hub DMS — adjuntos polimórficos embebibles + car… | done | interno |
| 0050 | Torre de control en /studio/debug — Estado + Bugs + Norte + R… | done | interno |
| 0051 | Fidelización & Referidos — niveles por facturación (derivados… | done | interno |
| 0052 | Reportes & Analytics — capa de presentación sobre agregados e… | done | interno |
| 0053 | Costing & Margen — costo editable por embarque (7 categorías)… | done | interno |
| 0054 | Capa legal — documentos versionados + aceptaciones inmutables… | done | interno |
| 0055 | Calculadora — configuración desde el Studio (Fase 3): ciudade… | done | interno |
| 0056 | Conversaciones · bandeja unificada (WhatsApp + email + portal) | in-progress | interno |
| 0057 | Portal — Compras/Prealertas + Proveedores del cliente (cierra… | done | interno |
| 0058 | Kommo lead → cliente — puente CRM↔ERP (convertir un lead del … | done | interno |
| 0059 | Financiero con el Socio Logístico China — libro mayor bilater… | in-progress | confidencial |
| 0060 | Documentos · Versionado — revisiones append-only sobre el Hub… | done | interno |
| 0061 | Estimado → Orden de venta (modelo QuickBooks): retira 'cotiza… | in-progress | interno |
| 0062 | Reestructuración CRM (Kommo) para cierres automáticos + integ… | proposed | interno |
| 0063 | Servicios a fondo (sitio público) — fichas incluye/no-incluye… | in-progress | interno |
| 0064 | Reestructuración de mensaje, UX, SEO/GEO y confianza del siti… | in-progress | interno |
| 0065 | Rename de marca MARKBOX → \"Shipping Mark\" (solo nombre visi… | done | interno |
| 0066 | Generador de reportes de inspección en el ERP (white-label · … | done | interno |
| 0067 | Aceptación con evidencia reforzada (SDD-B del handoff legal) … | done | interno |
| 0068 | Recibos de cobranza con mandato (SDD-C del handoff legal) — l… | done | interno |
| 0068 | Registro self-service — entrega real del correo de bienvenida… | done | interno |
| 0069 | Rendición quincenal a la Operadora (SDD-D del handoff legal) … | done | interno |
| 0070 | Expediente de defensa legal (SDD-E del handoff) — cadena de e… | done | interno |
| 0071 | Orden de compra (Purchase Order · compra asistida → Bill): el… | done | interno |
| 0072 | Orden de venta (Sales Order · modelo QuickBooks): el estimado… | in-progress | interno |
| 0073 | Fiscal · SENIAT — módulo configurable: Configuración fiscal (… | in-progress | interno |
| 0074 | Onboarding — sync del alta de cliente a Kommo (push del lead) | in-progress | interno |
| 0075 | Portal del cliente — alineación con el Norte (estimado, sopor… | proposed | interno |
| 0076 | Configuración canónica de servicios | in-progress | interno |
| 0077 | Contabilidad estilo QuickBooks — proveedor→cuenta por defecto… | in-progress | interno |
| 0078 | Tablero CRM (Kommo ↔ ERP) read-only — Dirección + Asesor | in-progress | interno |
| 0079 | Asiento automático del gasto — expenses → journal_entries (ci… | in-progress | interno |
| 0080 | Cierre de período contable — bloquear asientos de períodos ce… | in-progress | interno |
| 0081 | Inventario de Consolidación (WMS) — stock real CN/VE por Ship… | approved | interno |
| 0082 | Captura de email + consentimiento de marketing (implementa SD… | in-progress | interno |
| 0083 | Write-back de valor a Kommo — outbox + value-sync (implementa… | in-progress | interno |
| 0084 | Mapa de etapas + write-back de etapa a Kommo (cierra SDD-0062… | in-progress | interno |
| 0085 | RBAC por módulo del Studio — matriz rol×módulo + gate de vist… | in-progress | interno |
| 0086 | MARKBOX → Kommo al convertir (patch_lead) — cierra el loop le… | in-progress | interno |
| 0087 | Espejo de usuarios de Kommo — nombres de asesor en el tablero | in-progress | interno |
| 0088 | Motor de contenido de marketing — cerebro de ruteo (Test de N… | proposed | interno |
| 0089 | Clasificador de contenido + output multicanal (idea → noticia… | in-progress | interno |
| 0090 | Motor de oferta al cliente — wizard de intención + matriz de … | proposed | interno |
| 0091 | Motor de flujo interno por servicio (N8N-lite) — implementaci… | in-progress | interno |
| 0092 | Integración SeaRates Logistics Explorer — fletes marítimos FC… | in-progress | interno |
| 0093 | Academia DTD — módulo de formación (catálogo on-demand + coho… | in-progress | interno |
| 0094 | Acceso al portal solo por email (magic-link) — retira el logi… | in-progress | interno |
| 0095 | Cotizador público de fletes marítimos (SeaRates · caché anti-… | in-progress | interno |
| 0096 | Packing list online del proveedor + adjuntos por el link | in-progress | interna |
| 0097 | Packing list Norte v4.4 — propagación a producción (editor de… | in-progress | interna |
| 0098 | Prealertas — menú de servicios de recepción (add-ons) + video… | in-progress | interno |
| 0099 | Curso de bienvenida gratuito — Cómo comprar en Alibaba (guion… | in-progress | interno |
| 0100 | Etiquetas CN reales: QR escaneable + datos de bodega (cierra … | in-progress | interna |
| 0101 | Naviera Tier 1: tracking real del embarque (deep-link SeaRate… | draft | interna |
| 0102 | Reclamos y siniestros del cliente — gestión de incidencias de… | in-progress | interno |
| 0103 | Nómina / RRHH — empleados y prestadores (Slice A) + roadmap L… | in-progress | interno |
| 0104 | Libros fiscales persistidos — asentar Libro de Ventas / Compr… | in-progress | interno |
| 0105 | Conciliación bancaria + Activos fijos — sub-pestañas de Conta… | in-progress | interno |
| 0106 | Identidad por persona (cédula) — tabla persons + Shipping Mar… | in-progress | interno |
| 0107 | Academia ligada a la persona (cédula) — academy_enrollments.p… | done | interno |

> **Huecos en el correlativo:** 0022, 0023, 0027, 0028, 0037 — código sin spec o renumerado, auditar caso por caso.
<!-- AUTO-INDEX:END -->
