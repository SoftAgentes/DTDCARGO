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
### Índice de specs (generado · 176 specs)

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
| 0042 | Portal del Cliente — auth de cliente + mis envíos (V1) | done | interno |
| 0043 | Conector Kommo CRM — Alcance A (espejo read-only) + Alcance B… | done | interno |
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
| 0056 | Conversaciones · bandeja unificada (WhatsApp + email + portal) | done | interno |
| 0057 | Portal — Compras/Prealertas + Proveedores del cliente (cierra… | done | interno |
| 0058 | Kommo lead → cliente — puente CRM↔ERP (convertir un lead del … | done | interno |
| 0059 | Financiero con el Socio Logístico China — libro mayor bilater… | in-progress | confidencial |
| 0060 | Documentos · Versionado — revisiones append-only sobre el Hub… | done | interno |
| 0061 | Estimado → Orden de venta (modelo QuickBooks): retira 'cotiza… | done | interno |
| 0062 | Reestructuración CRM (Kommo) para cierres automáticos + integ… | proposed | interno |
| 0063 | Servicios a fondo (sitio público) — fichas incluye/no-incluye… | done | interno |
| 0064 | Reestructuración de mensaje, UX, SEO/GEO y confianza del siti… | in-progress | interno |
| 0065 | Rename de marca MARKBOX → \"Shipping Mark\" (solo nombre visi… | done | interno |
| 0066 | Generador de reportes de inspección en el ERP (white-label · … | done | interno |
| 0067 | Aceptación con evidencia reforzada (SDD-B del handoff legal) … | done | interno |
| 0068 | Recibos de cobranza con mandato (SDD-C del handoff legal) — l… | done | interno |
| 0069 | Rendición quincenal a la Operadora (SDD-D del handoff legal) … | done | interno |
| 0070 | Expediente de defensa legal (SDD-E del handoff) — cadena de e… | done | interno |
| 0071 | Orden de compra (Purchase Order · compra asistida → Bill): el… | done | interno |
| 0072 | Orden de venta (Sales Order · modelo QuickBooks): el estimado… | done | interno |
| 0073 | Fiscal · SENIAT — módulo configurable: Configuración fiscal (… | done | interno |
| 0074 | Onboarding — sync del alta de cliente a Kommo (push del lead) | done | interno |
| 0075 | Portal del cliente — alineación con el Norte (estimado, sopor… | in-progress | interno |
| 0076 | Configuración canónica de servicios | done | interno |
| 0077 | Contabilidad estilo QuickBooks — proveedor→cuenta por defecto… | done | interno |
| 0078 | Tablero CRM (Kommo ↔ ERP) read-only — Dirección + Asesor | done | interno |
| 0079 | Asiento automático del gasto — expenses → journal_entries (ci… | done | interno |
| 0080 | Cierre de período contable — bloquear asientos de períodos ce… | done | interno |
| 0081 | Inventario de Consolidación (WMS) — stock real CN/VE por Ship… | done | interno |
| 0082 | Captura de email + consentimiento de marketing (implementa SD… | done | interno |
| 0083 | Write-back de valor a Kommo — outbox + value-sync (implementa… | done | interno |
| 0084 | Mapa de etapas + write-back de etapa a Kommo (cierra SDD-0062… | done | interno |
| 0085 | RBAC por módulo del Studio — matriz rol×módulo + gate de vist… | done | interno |
| 0086 | MARKBOX → Kommo al convertir (patch_lead) — cierra el loop le… | done | interno |
| 0087 | Espejo de usuarios de Kommo — nombres de asesor en el tablero | done | interno |
| 0088 | Motor de contenido de marketing — cerebro de ruteo (Test de N… | proposed | interno |
| 0089 | Clasificador de contenido + output multicanal (idea → noticia… | in-progress | interno |
| 0090 | Motor de oferta al cliente — wizard de intención + matriz de … | done | interno |
| 0091 | Motor de flujo interno por servicio (N8N-lite) — implementaci… | done | interno |
| 0092 | Integración SeaRates Logistics Explorer — fletes marítimos FC… | done | interno |
| 0093 | Academia DTD — módulo de formación (catálogo on-demand + coho… | done | interno |
| 0094 | Acceso al portal solo por email (magic-link) — retira el logi… | done | interno |
| 0095 | Cotizador público de fletes marítimos (SeaRates · caché anti-… | done | interno |
| 0096 | Packing list online del proveedor + adjuntos por el link | done | interna |
| 0097 | Packing list Norte v4.4 — propagación a producción (editor de… | done | interna |
| 0098 | Prealertas — menú de servicios de recepción (add-ons) + video… | done | interno |
| 0099 | Curso de bienvenida gratuito — Cómo comprar en Alibaba (guion… | done | interno |
| 0100 | Etiquetas CN reales: QR escaneable + datos de bodega (cierra … | done | interna |
| 0101 | Naviera Tier 1: tracking real del embarque (deep-link SeaRate… | draft | interna |
| 0102 | Reclamos y siniestros del cliente — gestión de incidencias de… | done | interno |
| 0103 | Nómina / RRHH — empleados y prestadores (Slice A) + roadmap L… | done | interno |
| 0104 | Libros fiscales persistidos — asentar Libro de Ventas / Compr… | done | interno |
| 0105 | Conciliación bancaria + Activos fijos — sub-pestañas de Conta… | done | interno |
| 0106 | Identidad por persona (cédula) — tabla persons + Shipping Mar… | done | interno |
| 0107 | Academia ligada a la persona (cédula) — academy_enrollments.p… | done | interno |
| 0108 | Combobox de cliente cédula-first (cotizador/tracking/embarques) | done | interno |
| 0109 | Liquidación y finiquito de nómina (LOTTT) — prestaciones, vac… | done | interno |
| 0110 | Cablear el posting contable del Financiero con el Socio Logís… | done | confidencial |
| 0111 | Scorecard de proveedores — captura de desempeño + reclamo al … | done | interno |
| 0113 | Onboarding y app self-service del empleado — invites + regist… | done | interno |
| 0114 | Dashboard configurable + persistencia de preferencias por usu… | done | interno |
| 0115 | Financiero China Slice C — forex como revenue · claim offsets… | done | confidencial |
| 0116 | Club DTD — membresía recurrente + compra grupal (consolidació… | done | interno |
| 0117 | Recibo y finiquito en PDF server-side (@react-pdf/renderer) —… | done | interno |
| 0118 | Historial reproducible — habilitar validación en branch efíme… | done | interno |
| 0119 | Módulo de Marketing en el ERP — Dashboard de Marketing (salud… | done | interno |
| 0120 | Datos de la empresa — primera sección real de Administración … | done | interno |
| 0121 | Apariencia — preferencias de Studio (tema + densidad) + mater… | done | interno |
| 0122 | Numeración & legal — formatos de correlativo (read-only) + le… | done | interno |
| 0123 | Audit log — viewer read-only del entity_audit_log en Administ… | done | interno |
| 0124 | Permisos por rol — matriz read-only rol × módulo (visualiza l… | done | interno |
| 0125 | Master data — hub read-only de catálogos (tiers + punteros a … | done | interno |
| 0126 | Tasas de cambio — gestión de tenant_fx_history desde Administ… | done | interno |
| 0127 | Feriados & ferias — calendario operativo CN/VE (feriados + fe… | done | interno |
| 0128 | API keys & webhooks — gestión de credenciales de integración … | done | interno |
| 0129 | Workflows custom — puntero al motor de flujo existente (SDD-0… | done | interno |
| 0130 | Importar / Exportar — export CSV del dominio admin (import po… | done | interno |
| 0131 | Registro de cliente interno — persona/empresa (cédula vs RIF)… | done | interno |
| 0132 | Hitos del envío + notificación de estado al cliente | done | interno |
| 0133 | Cut-off / calendario de zarpes en el portal | done | interno |
| 0134 | Reportar pago + comprobante en el portal | done | interno |
| 0135 | Buscador global ⌘K del Studio — permission-aware, gating por … | done | interno |
| 0136 | Gestión de usuarios del ERP — alta por rol, reasignación y ba… | done | interno |
| 0137 | Crédito de referido auto-aplicado — aplicar el bono del refer… | done | interno |
| 0138 | Mi Perfil del cliente — identidad + direcciones de entrega mú… | done | interno |
| 0139 | RBAC: metodología definitiva — matriz en código + capabilitie… | done | interno |
| 0140 | Perfiles de puesto en nómina + alta unificada (empleado + usu… | done | interno |
| 0141 | Calendario al Norte — vistas + eventos operativos de embarques | done | interno |
| 0142 | Reportes al Norte — reporte Por agente + reporte IVA | done | interno |
| 0143 | Mailing al Norte — Firmas, Envío manual y Programados (+ cron) | done | interno |
| 0144 | Compra asistida — renombre, filtros y reglas propias del módulo | done | interno |
| 0145 | Mi perfil unificado del portal — una sola pantalla espejando … | done | interno |
| 0146 | Bitácora — actas de reunión con IA + gestor de tareas del equ… | done | interno |
| 0147 | Soporte del portal a Norte — fusión de Reclamos + chat con el… | done | interno |
| 0148 | Aviso al equipo de mensajes entrantes del portal — activar el… | done | interno |
| 0149 | Resumen mensual de conversaciones con IA — histórico navegabl… | in-progress | interno |
| 0150 | Secretarias de reunión v2 — default rica + Escucha Activa + t… | in-progress | interno |
| 0151 | Perfil cliente — aviso de pendientes in-page + solicitud de c… | done | interno |
| 0152 | Estiba por zonas — identidad por bulto, captura al cargar y v… | in-progress | interno |
| 0153 | Etiqueta pre-declarada · la caja nace con el aviso, no con la… | in-progress | interno |
| 0154 | Recibir por escaneo · la etiqueta pre-declarada materializa l… | in-progress | interno |
| 0155 | Estiba por lotes · escanear una caja monta el lote; posición … | in-progress | interno |
| 0156 | Notificaciones al cliente configurables — journey China→Venez… | done | interno |
| 0157 | Campaña de recuperación Kommo — contactos con WhatsApp por ta… | in-progress | interno |
| 0158 | Documentos de Marketing en el Studio — lector read-only de do… | done | interno |
| 0159 | Configurar referidos — montos del programa editables desde el… | in-progress | interno |
| 0160 | Modo consolidación del operario · pedir contenedor → oficina … | in-progress | interno |
| 0161 | Registro self-service — entrega real del correo de bienvenida… | done | interno |
| 0162 | Aviso de recepción al cliente — cablear la recepción del oper… | done | interno |
| 0163 | Orden accionable al operario · el operario ve y ejecuta los s… | proposed | interno |
| 0164 | Unificación de nombres de servicios: un servicio, un nombre, … | in-progress | interno |
| 0165 | Sistema de Gobernanza de Experiencia ERP_Studio — AVS-01 | done | interno |
| 0166 | Auditoría gobernada — corrección conjunta AUD-01 y AUD-02 | in-progress | interno |
| 0167 | Actualidad — centro editorial público | in-progress | interno |
| 0168 | MP-01 Slice 1 — Permanencia y restauración de comentarios int… | done | interno |
| 0169 | Portal — gate de verificación de identidad | in-progress | interno |
| 0170 | Portal — ciclo de 5 etapas y Seguimiento total por contenedor | in-progress | interno |
| 0171 | Portal — datos de bodega CN, filtros de Documentos y armazón … | in-progress | interno |
| 0172 | Lifecycle de tenant y fixtures E2E efímeras | done | interno |
| 0173 | Portal — Nueva compra como asistente de 3 pasos | done | interno |
| 0174 | Auditoría — atomicidad por dominios | in-progress | interno |
| 0175 | VIS-02 — tipografía por voz, destinatario e idioma | in-progress | interno |
| 0176 | Portal — el ámbar deja de usarse como texto (barrido AA) | done | interno |
| 0177 | Portal — Estado de cuenta (libro de movimientos) | done | interno |
| 0178 | Plugin read-only de gobernanza ERP Studio | in-progress | interno |
| 0180 | Tabs accesibles en Fiscal | done | interno |
| 0181 | Selectores accesibles y colisión segura | done | interno |
| 0182 | Validación progresiva de identidad en Club | done | interno |
| 0183 | Control plane ejecutable de gobernanza | done | interno |

> **Huecos en el correlativo:** 0022, 0023, 0027, 0028, 0037, 0112, 0179 — código sin spec o renumerado, auditar caso por caso.
<!-- AUTO-INDEX:END -->
