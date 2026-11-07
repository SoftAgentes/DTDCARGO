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
### Índice de specs (generado · 595 specs)

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
| 0152 | Estiba por zonas — identidad por bulto, captura al cargar y v… | superseded | interno |
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
| 0166 | Auditoría gobernada — corrección conjunta AUD-01 y AUD-02 | done | interno |
| 0167 | Actualidad — centro editorial público | in-progress | interno |
| 0168 | MP-01 Slice 1 — Permanencia y restauración de comentarios int… | done | interno |
| 0169 | Portal — gate de verificación de identidad | in-progress | interno |
| 0170 | Portal — ciclo de 5 etapas y Seguimiento total por contenedor | in-progress | interno |
| 0171 | Portal — datos de bodega CN, filtros de Documentos y armazón … | in-progress | interno |
| 0172 | Lifecycle de tenant y fixtures E2E efímeras | done | interno |
| 0173 | Portal — Nueva compra como asistente de 3 pasos | done | interno |
| 0174 | Auditoría — atomicidad por dominios | done | interno |
| 0175 | VIS-02 — tipografía por voz, destinatario e idioma | done | interno |
| 0176 | Portal — el ámbar deja de usarse como texto (barrido AA) | done | interno |
| 0177 | Portal — Estado de cuenta (libro de movimientos) | done | interno |
| 0178 | Plugin read-only de gobernanza ERP Studio | done | interno |
| 0179 | Portal — podar el código pre-Norte inalcanzable | done | interno |
| 0180 | Tabs accesibles en Fiscal | done | interno |
| 0181 | Selectores accesibles y colisión segura | done | interno |
| 0182 | Validación progresiva de identidad en Club | done | interno |
| 0183 | Control plane ejecutable de gobernanza | done | interno |
| 0184 | Plan de carga por volumen · el sistema le dice al operario dó… | in-progress | interno |
| 0185 | NUM-01 v1.1 y expresiones decimales | done | interno |
| 0186 | Fundamento verificable de retención de auditoría | done | interno |
| 0187 | Auditoría D2 — motivos humanos en anulaciones financieras | done | interno |
| 0188 | Auditoría D3 — motivos humanos en cancelaciones comerciales | done | interno |
| 0189 | Auditoría D4 — search_path vacío en RPC logísticas R3 | done | interno |
| 0191 | Integridad documental y derechos del titular | proposed | interno |
| 0192 | POD sellado y aviso al receptor | proposed | interno |
| 0193 | Firma electrónica certificada (PSC · SUSCERTE) | draft | interno |
| 0194 | Almacén CN — menú de acciones de recepción accesible | done | interno |
| 0195 | Resiliencia del sync de Kommo — un hipo de red no apaga la in… | proposed | interno |
| 0196 | Almacén CN — feedback y pending de nueva recepción | done | interno |
| 0197 | Recepción móvil CN — snapshot de fotos y render puro | done | interno |
| 0198 | Realtime transversal — estado de conexión y datos verdaderos | done | interno |
| 0199 | Almacén CN — filtros URL y selección coherentes | done | interno |
| 0200 | Portal backfill — estado de operación coherente | done | interno |
| 0201 | Portal shell — ruta y preferencias como fuentes de verdad | done | interno |
| 0202 | Verificación transversal — contratos sin bindings muertos | done | interno |
| 0203 | Backend — firmas explícitas y consultas mínimas | done | interno |
| 0204 | Frontend — errores visibles y props consumidas | done | interno |
| 0205 | Cliente web — entorno del navegador como fuente de verdad | done | interno |
| 0206 | Formularios — resultados de action manejados una vez | done | interno |
| 0207 | Listados Studio — query como fuente de verdad | done | interno |
| 0208 | Render — referencias temporales estables | done | interno |
| 0209 | Drawers — sugerencias y resultados derivados | done | interno |
| 0210 | Bitácora — estado externo y cargas coherentes | done | interno |
| 0211 | Render — entradas estables y acumuladores puros | done | interno |
| 0212 | Preferencias — hidratación cancelable del navegador | done | interno |
| 0213 | Estado — reconciliación cancelable por frontera | done | interno |
| 0214 | Efectos externos — fronteras cancelables | done | interno |
| 0215 | HTD-01 en anulación de factura R3 | done | interno |
| 0216 | DND-01 accesible y durable en Bitácora | done | interno |
| 0217 | Timezone explícito en eventos del calendario | done | interno |
| 0218 | Runner y reinstalación reproducible de PLG-01 | done | interno |
| 0219 | Legal holds append-only de auditoría | done | interno |
| 0220 | Exportación gobernada de auditoría | done | interno |
| 0221 | Expiración segura de artefactos de auditoría | done | interno |
| 0222 | Retención de auditoría por lotes controlados | done | interno |
| 0223 | Fechas planificadas de embarques | done | interno |
| 0224 | Adjuntos seguros, reanudables y recuperables | approved | interno |
| 0225 | Registro público: el correo se valida y los errores dicen dón… | done | interno |
| 0226 | Anulación gobernada de finiquito de Nómina | done | interno |
| 0227 | Pago gobernado de cruce en Financiero China | done | interno |
| 0228 | Liberación gobernada de Aduana SENIAT | done | interno |
| 0229 | Pago gobernado de indemnización de Reclamos | done | interno |
| 0230 | Cierre gobernado de ruta TMS | done | interno |
| 0231 | Entrega manual gobernada en Almacén VE | done | interno |
| 0232 | Autorización gobernada de consolidación Naviera | done | interno |
| 0233 | Retiro gobernado de reportes de Inspecciones | done | interno |
| 0234 | Cancelación gobernada de órdenes de despacho | done | interno |
| 0235 | Cierre de auditoría de seguridad, datos y adjuntos | approved | interno |
| 0236 | Transportistas terrestres y su tarifario por CBM | done | interno |
| 0237 | La calculadora pública cobra la entrega nacional por CBM | done | interno |
| 0238 | El brand book se comparte con un link y un código | done | interno |
| 0239 | El POD del camionero cierra el embarque | in-progress | interna |
| 0240 | Feature flags: siembra por tenant y panel que no miente | in-progress | interna |
| 0241 | El catálogo de localidades VE quedó ilegible: RLS encendida s… | done | interna |
| 0242 | Las piezas de producto se abren con un segundo código | in-progress | interno |
| 0243 | Anulación gobernada de gastos | done | interno |
| 0244 | Enrutado a Recontacto — el ERP reconoce al cliente que vuelve… | in-progress | interno |
| 0245 | Espejo de la bandeja de entrada de Kommo — el ERP deja de med… | proposed | interno |
| 0246 | Fusión de cliente duplicado y prevención del Shipping Mark re… | done | interno |
| 0247 | Torre de control externa: un vigía que no vive adentro de lo … | in-progress | interno |
| 0248 | Alerta de correo no entregado | in-progress | interna |
| 0249 | Cliente con Shipping Mark y sin acceso al portal | in-progress | interna |
| 0250 | Acceso y recuperación de contraseña del Studio | in-progress | interna |
| 0251 | Hardening: invitación nominal, RPC con rol (operarios + fusió… | in-progress | interno |
| 0252 | Cierre del carril roles y permisos — superadmin, matriz edita… | in-progress | interna |
| 0253 | Enlace de acceso al portal corto y con marca propia | in-progress | interna |
| 0254 | Guardar el Shipping Mark en el WhatsApp del cliente al regist… | in-progress | interna |
| 0255 | Aliados white-label: entidad, insignia propia jerárquica y ta… | in-progress | interno |
| 0256 | El CRM se opera desde el ERP: la cola de escritura y los verb… | done | interno |
| 0257 | La calculadora da precio sin el peso, y dice hasta cuándo vale | done | interna |
| 0258 | Historial de Shipping Mark (renombrar sin perder nada) y sub-… | draft | interno |
| 0259 | Registrar lo que el cliente calcula en la calculadora pública | in-progress | interna |
| 0260 | El portal avisa que la acción está en curso también a quien n… | in-progress | interna |
| 0261 | En el portal el vino de marca deja de significar "error | proposed | interna |
| 0262 | Confirmar el borrado de una dirección de entrega del cliente | in-progress | interna |
| 0263 | El Studio tiene una primitiva de menú de acciones, y deja de … | in-progress | interna |
| 0264 | La dirección de la bodega en Alibaba, medida contra el formul… | in-progress | interna |
| 0265 | El listado de Clientes dice cuántos hay y deja llegar a los q… | in-progress | interna |
| 0266 | La cabecera de Clientes deja de competir consigo misma | in-progress | interna |
| 0267 | Clientes cierra sus tres huecos de accesibilidad — tabla, car… | in-progress | interna |
| 0268 | En el portal, borrar una dirección también deja de ser un cli… | in-progress | interna |
| 0269 | La tarifa del aliado: listas de precios por aliado, con descu… | in-progress | interno |
| 0270 | El vínculo cliente ↔ contacto de Kommo deja de depender del azar | done | interna |
| 0271 | Rutas de alerta de Telegram: un destino por categoría, y que … | in-progress | interno |
| 0272 | Un admin corrige el correo de un miembro, y el anterior deja … | in-progress | interna |
| 0273 | El rol y el alcance se cambian desde la ficha, con motivo y c… | in-progress | interna |
| 0274 | Usuarios y roles en un solo lugar — la fila se calla, los per… | in-progress | interna |
| 0275 | Los tres pendientes del rediseño de Usuarios, y un cuarto que… | in-progress | interna |
| 0276 | Una sola puerta pública: /entrar unifica acceder y crear cuenta | in-progress | interno |
| 0277 | El replay de un branch efímero deja de morir en la 0355 | done | interno |
| 0278 | El enlace de acceso al portal deja de mentir y de romperse po… | in-progress | interno |
| 0279 | El cliente que ya es cliente deja de pedir un enlace que nadi… | in-progress | interno |
| 0280 | El gate construye la app: 14/14 en verde ya no significa que … | in-progress | interno |
| 0281 | Los documentos del carril comercial: el estimado y la factura… | in-progress | interno |
| 0282 | El aviso de que la carga llegó a Yiwu deja de perderse en sil… | in-progress | interno |
| 0283 | El aviso al cliente puede colgar de una compra, no sólo de un… | in-progress | interno |
| 0284 | La recepción de Yiwu sabe de qué compra es — y por eso conoce… | in-progress | interno |
| 0285 | El cliente ve las fotos de su mercancía en la bodega de Yiwu | in-progress | interno |
| 0286 | Los GET del Studio respetan el alcance por módulo | done | interno |
| 0287 | El estado de cuenta sale en PDF, para el cliente y para el as… | in-progress | interno |
| 0288 | El ERP sabe que el cliente escribió — la alerta de 'sin atend… | in-progress | interno |
| 0289 | Clientes, Cobranzas y Tracking se exportan a CSV — sin trunca… | in-progress | interno |
| 0290 | Todos los modales del ERP atrapan el foco — y uno era invisib… | in-progress | interno |
| 0291 | SeaRates cierra: el ERP avisa cuando el cotizador se queda mu… | in-progress | interna |
| 0292 | El cotizador FCL vuelve con tarifas propias — se desengancha … | in-progress | interna |
| 0293 | El botón de notificaciones vivía donde nadie entra | in-progress | interno |
| 0294 | El vino crudo deja de usarse como texto — y la prioridad esta… | in-progress | interno |
| 0295 | `transition: all` deja de existir — cada sitio anima solo lo … | in-progress | interno |
| 0296 | Voseo en copy que ve el usuario — y la etiqueta rioplatense q… | in-progress | interno |
| 0297 | La factura lleva razón social y RIF del emisor — excepción co… | in-progress | interno |
| 0298 | La factura le sirve al contador: el documento del cliente se … | in-progress | interno |
| 0299 | Datos de la empresa: el error deja de ser mudo — y son DOS ga… | in-progress | interno |
| 0300 | Borrar un estimado desde el listado — y que se pueda borrar e… | in-progress | interno |
| 0302 | El portal y el ERP móvil no refrescaban la sesión — el arregl… | in-progress | interno |
| 0303 | El contrato de JSON-LD miraba sólo app/ — 4 bloques de compon… | in-progress | interno |
| 0304 | La poda del 3-ago nunca llegó a main — 14 archivos muertos, y… | in-progress | interno |
| 0305 | La factura emitida avisa por correo — el evento existía y nad… | in-progress | interno |
| 0306 | Recordatorio de cobranza — y las seis razones para NO mandarlo | in-progress | interno |
| 0307 | El detalle de compra del portal: qué llegó a Yiwu | done | interno |
| 0308 | El packing list del proveedor llega al cliente | in-progress | interno |
| 0309 | B4 ya estaba hecho — y el trigger que reparte dinero no tenía… | in-progress | interno |
| 0310 | Barrido de cables sueltos — y el guard que impide perder una … | done | interno |
| 0311 | «Tu carga llegó a Venezuela» — el aviso que quedó sin disparador | done | interno |
| 0312 | Contratos para la lógica de negocio que corría sin red | done | interno |
| 0313 | Portal — paso 1 de Nueva compra: el alta de proveedor que no … | done | interno |
| 0314 | La segunda puerta de la máquina de estados del Bug Reporter | done | interno |
| 0315 | Las exportaciones CSV no ejecutan fórmulas de terceros | done | interno |
| 0316 | Los logs de email inbound no exponen al remitente | done | interno |
| 0317 | Acceso CBM sin secreto en URL | done | interno |
| 0318 | Presencia documental del Portal en lote | done | interno |
| 0319 | Reloj compartido CRM sin render impuro | done | interno |
| 0320 | E2E local sin secretos alojados | done | interno |
| 0321 | E2E local acotado y con concurrencia estable | done | interno |
| 0322 | Relaciones de órdenes leídas en lote | done | interno |
| 0323 | Fundamentos Web Quality sin barreras críticas | done | interno |
| 0324 | Tabs del Studio con teclado y un solo tab stop | done | interno |
| 0325 | Throttle fail-closed para el acceso CBM interno | done | interno |
| 0326 | Retirar el secreto del webhook Telegram de la URL | in-progress | interno |
| 0327 | Cookie autenticada para sesiones de operario | done | interno |
| 0328 | Cerrar el bypass público del throttle de verificación | in-progress | interno |
| 0329 | Aislar la caché de Next usada por el gate E2E | done | interno |
| 0330 | Retirar el envío de direcciones de clientes a Nominatim | done | interno |
| 0331 | Retirar consultas de identidad por URL insegura | done | interno |
| 0332 | Retener la llave KMS del backup WORM junto con el bucket | done | interno |
| 0333 | Validar la configuración completa de integraciones en Studio | done | interno |
| 0334 | Retirar la configuración activa del Payload CMS descontinuado | done | interno |
| 0335 | Contener el crecimiento de service_role en Portal y ordenar e… | done | interno |
| 0336 | Resolver la marca del Portal por el principal autenticado | done | interno |
| 0337 | Resolver la visibilidad de hitos del Portal por el principal … | done | interno |
| 0338 | Resolver el asesor del Portal por el principal autenticado | done | interno |
| 0339 | Resolver el programa de referidos del Portal por principal | done | interno |
| 0340 | Firmar adjuntos de prealerta desde una lectura autorizada por… | done | interno |
| 0341 | Resolver el contexto privado de Perfil por principal autenticado | done | interno |
| 0342 | Resolver y firmar Documentos del Portal desde el principal | done | interno |
| 0343 | Encapsular el detalle operativo de compras del Portal | done | interno |
| 0344 | Encapsular el contexto privado de Soporte del Portal | done | interno |
| 0345 | Encapsular el contexto privado del detalle de envío del Portal | done | interno |
| 0346 | Encapsular el contexto privado del listado de envíos del Portal | done | interno |
| 0347 | Encapsular el contexto privado del home del Portal | done | interno |
| 0348 | Encapsular la lectura privada de aceptación del Portal | done | interno |
| 0349 | Automatizar calidad local sin secretos en GitHub Actions | done | interno |
| 0350 | Aplicar RBAC de escritura a facturas en la base | done | interno |
| 0351 | Aplicar RBAC admin-only al dominio Mailing | done | interno |
| 0352 | Aplicar RBAC financiero a conciliación bancaria | done | interno |
| 0353 | Minimizar el contexto de correo de Cobranzas | done | interno |
| 0354 | Minimizar la facturación anual para Fidelización y CRM | done | interno |
| 0355 | Minimizar el saldo de cliente en Conversaciones | done | interno |
| 0356 | Minimizar referencias de facturas en Órdenes de venta | done | interno |
| 0357 | Cerrar lectura cruda de facturas por rol y principal Portal | done | interno |
| 0358 | Separar expansión y restricción del release de Mailing | done | interno |
| 0359 | Aislar envíos, documentos e hitos Portal por principal y tenant | done | interno |
| 0360 | Evitar que el foco tardío borre la búsqueda de destino | done | interno |
| 0361 | Aislar proveedores, prealertas y sus documentos por principal… | done | interno |
| 0362 | Aislar el aprendizaje del Portal por principal y tenant | done | interno |
| 0363 | Aislar reclamos y evidencias del Portal por principal y tenant | done | interno |
| 0364 | Aislar reportes de pago del Portal por principal y tenant | done | interno |
| 0365 | Operaciones de reportes de pago con resultado veraz y evidenc… | in-progress | interno |
| 0366 | Renombrar Shipping Mark conservando reportes sobre facturas a… | in-progress | interno |
| 0367 | Webhook Kommo: respetar desactivación sin romper recuperación… | in-progress | interno |
| 0368 | Aislar el principal de Club por vínculo, cliente y persona | in-progress | interno |
| 0369 | Mantener un único proyecto declarado en la preparación E2E | in-progress | interno |
| 0370 | Cerrar worktrees solamente después de verificar su preservación | in-progress | interno |
| 0371 | Analytics fuera de puertas de acceso y URLs con credenciales | in-progress | interno |
| 0372 | Direcciones Portal por principal y tenant | in-progress | interno |
| 0373 | Validación de destinos y suscripciones Web Push | done | interno |
| 0374 | Verificación pública bloqueada ante fallo del throttle | in-progress | interno |
| 0375 | Reserva atómica del verificador público | in-progress | interno |
| 0376 | Comprobaciones Git agrupadas sin relajar el cierre seguro | done | interno |
| 0377 | Borrado logico de direcciones Portal confirmado y auditable | in-progress | interno |
| 0378 | Verificacion local sin falsos verdes y aislamiento de pruebas… | done | interno |
| 0379 | Parche compatible del fflate transitivo y contratos de replay | done | interno |
| 0380 | Lectura de cotizaciones Portal ligada al principal y tenant | in-progress | interno |
| 0381 | Solicitudes de recepción Portal por principal y tenant | in-progress | interno |
| 0382 | Perfil y solicitudes de cambio Portal por principal y tenant | in-progress | interno |
| 0383 | Frontera AST de service_role en componentes Portal | in-progress | interno |
| 0384 | Acciones de Perfil Portal por principal y tenant | in-progress | interno |
| 0385 | Mensajes Portal por principal y tenant coherentes | done | interno |
| 0386 | Web Push Portal por principal y tenant coherentes | done | interno |
| 0387 | Academia Portal en aplicación por principal y tenant | done | interno |
| 0388 | Proveedores Portal en aplicación por principal y tenant | done | interno |
| 0389 | Compras Portal en aplicación por principal y tenant | done | interno |
| 0390 | Lecturas Portal de pagos y eventos por principal y tenant | done | interno |
| 0391 | Lecturas núcleo Portal por principal y tenant | done | interno |
| 0392 | Activación y completitud Portal por principal y tenant | done | interno |
| 0393 | Reclamos Portal por principal y tenant | done | interno |
| 0394 | Mutaciones de direcciones Portal por principal y tenant | done | interno |
| 0395 | Escrituras de cotizaciones Portal por principal y tenant | done | interno |
| 0396 | Acciones elevadas Portal por principal y tenant | done | interno |
| 0397 | Acciones de facturas Portal por principal y tenant | done | interno |
| 0398 | Contextos privados Portal por principal y tenant | done | interno |
| 0399 | Consumidores de compras Portal por principal y tenant | done | interno |
| 0400 | Cajas del Portal por principal y tenant coherentes | done | interno |
| 0401 | Realtime de conversaciones Portal por principal y tenant | done | interno |
| 0402 | Catálogo de servicios Portal por principal y tenant | done | interno |
| 0403 | Documentos de factura con autorización por entidad | done | interno |
| 0404 | Documentos de Tesorería con autorización por entidad | done | interno |
| 0405 | Documentos de asientos con autorización por entidad | done | interno |
| 0406 | Documentos de gastos con autorización por módulo | done | interno |
| 0407 | Documentos de envíos con autorización de Tracking | done | interno |
| 0408 | Documentos de clientes con autorización del módulo Clientes | done | interno |
| 0409 | Documentos de proveedores con autorización del módulo Proveed… | done | interno |
| 0410 | Documentos de Naviera con autorización del módulo Naviera | done | interno |
| 0411 | Adjuntos de Bitácora con autorización del módulo Bitácora | done | interno |
| 0412 | Documentos sin transacción y contrato documental fail-closed | done | interno |
| 0413 | CSP con nonce para superficies privadas | done | interno |
| 0414 | Logs estructurados y correlacionados para crons | done | interno |
| 0415 | Observabilidad estructurada de workers drain | done | interno |
| 0416 | Observabilidad estructurada de jobs programados | done | interno |
| 0417 | Observabilidad estructurada de salud e integraciones | done | interno |
| 0418 | Observabilidad estructurada de Edge Functions Kommo | done | interno |
| 0419 | Observabilidad estructurada en internals de salud | done | interno |
| 0420 | Observabilidad estructurada en internals de workers | done | interno |
| 0421 | Observabilidad estructurada en notificaciones de bugs | done | interno |
| 0422 | Observabilidad estructurada en primitivas de notificación | done | interno |
| 0423 | Observabilidad estructurada en agenda de avisos del Portal | done | interno |
| 0424 | Observabilidad estructurada en consultas de avisos del Portal | done | interno |
| 0425 | Observabilidad estructurada en Web Push del Portal | done | interno |
| 0426 | Observabilidad estructurada en acciones de Perfil Portal | done | interno |
| 0427 | Observabilidad estructurada en Proveedores y Prealertas Portal | done | interno |
| 0428 | Cierre de observabilidad estructurada del Portal | done | interno |
| 0429 | Observabilidad estructurada en productores internos de avisos | done | interno |
| 0430 | Observabilidad estructurada en avisos de entrada | done | interno |
| 0431 | Correlación y logs estructurados en rutas móviles | done | interno |
| 0432 | Observabilidad estructurada en internals de conversaciones | done | interno |
| 0433 | Observabilidad estructurada en el flujo de bugs | done | interno |
| 0434 | Baseline web y accesibilidad de shells de entrada | done | interno |
| 0436 | Observabilidad estructurada en contabilidad de Cobranzas | done | interno |
| 0437 | Observabilidad estructurada en el motor de reglas de correo | done | interno |
| 0438 | Remediación funcional del cupo y la evidencia de perfil | in-progress | interno |
| 0439 | Portal cliente — edición controlada y contención de fotos de … | in-progress | interna |
| 0440 | Harness E2E general determinista en Supabase efímero | in-progress | interna |
| 0441 | Colores semánticos de marca y avisos de calculadora | in-progress | interna |
| 0442 | Portal del cliente - claridad de botones y mensajes | in-progress | interna |
| 0443 | Prealertas: proveedor, etiquetas y recepción por lote | in-progress | interno |
| 0444 | Harness Codex con Director, Workers y PR como frontera | done | interno |
| 0448 | Replay del estado final de 0222/0223 en calculator_settings | in-progress | interno |
| 0449 | Observabilidad estructurada en acciones de Usuarios | done | interno |
| 0450 | Código contra símbolos de migraciones pendientes | done | interno |
| 0451 | Resolución de H1 y sonda reutilizable de navegación móvil ERP | done | interno |
| 0452 | Sanitizador: formatos actuales de claves y descubrimiento de … | done | interno |
| 0453 | Mailing — guard admin en el envío de prueba de plantillas | done | interno |
| 0454 | Watchdog del e2e de verify: un cuelgue es FALLÓ con motivo, n… | done | interno |
| 0455 | Retención de public_verify_throttle en el cron purge-throttle | done | interno |
| 0456 | Un cliente sólo cuelga de un aliado de su tenant | done | interno |
| 0457 | ENOBUFS y errores tapados en el harness: un subproceso que no… | done | interno |
| 0458 | finish miraba medio universo: los worktrees de .claude/worktr… | done | interno |
| 0459 | No hay respuesta para «no sé»: el harness elegía un checkout … | done | interno |
| 0460 | `finish` informa lo que git sabe del candidato: locked y prun… | done | interno |
| 0461 | La cadena de aliados no cruza tenants | done | interno |
| 0462 | Las facturas del Portal quedan ligadas al tenant del principal | done | interno |
| 0463 | Por RLS, el Portal sólo lee facturas del tenant de su vínculo | done | interno |
| 0464 | Gate de símbolos pendientes por relación y deudas de arnés de… | done | interno |
| 0465 | Facturas borradas fuera de los lectores financieros | done | interno |
| 0466 | Helpers del Portal por principal, deterministas y sin cruce d… | done | interno |
| 0467 | Borrar un cliente revoca su acceso al Portal | in-progress | interno |
| 0468 | Portal: rediseño del enlace del proveedor (Factura + Packing … | in-progress | interno |
| 0469 | Borrar un cliente deja un evento de auditoría atómico y se co… | in-progress | interno |
| 0470 | El e2e de verify sin Supabase público: omite con motivo lo qu… | done | interno |
| 0471 | Conocimiento verificable con Director, Graphify, Archify y Ob… | in-progress | interno |
| 0472 | Clientes: escritura gobernada por RBAC efectivo | in-progress | interno |
| 0473 | Importación documental, borrador compartido y calculadora pue… | in-progress | interno |
| 0474 | Guía de Alibaba — Shipping Mark conectado, costo real con tar… | done | interno |
| 0475 | El respaldo del calculador vuelve a espejar el ERP ($800 → $850) | done | interno |
| 0476 | La tarifa pública se lee de la base, vencida o no | done | interno |
| 0477 | Un vínculo del Portal revocado conserva su correo y sus fecha… | in-progress | interno |
| 0478 | Programar la próxima tarifa pública sin dejar el sitio sin ta… | done | interno |
| 0479 | Supabase sintético deny-only para el e2e local: las pruebas q… | in-progress | interno |
| 0480 | El recargo de baterías del respaldo vuelve a espejar el ERP (… | done | interno |
| 0481 | Portal cliente — cambiar la foto de cédula/RIF dentro del cup… | done | interna |
| 0482 | Portal cliente — editar nombre, cédula/RIF y teléfono al inst… | done | interna |
| 0484 | Los comandos de reportes de pago frente a una factura ya pagada | in-progress | interno |
| 0485 | anon y authenticated pierden los privilegios residuales sobre… | done | interno |
| 0486 | Las pruebas intermitentes de la suite dejan de dar rojos falsos | done | interno |
| 0487 | Portal cliente — foto visible, empresa propia y «Facturar a n… | done | interna |
| 0488 | El registro de cobros en facturas pasa a ser atómico | done | interno |
| 0489 | Los pagos a proveedores en Tesorería pasan a ser atómicos | done | interno |
| 0490 | El crédito de referido no pisa el pagado ni el estado de la f… | in-progress | interno |
| 0491 | La recepción de bodega China creada en el Studio vuelve a num… | in-progress | interno |
| 0492 | Escribir cobros y cuentas por pagar queda para accounting y a… | in-progress | interno |
| 0493 | Las pruebas que no tocan el DOM corren en el entorno node | in-progress | interno |
| 0494 | Cobros y órdenes de pago anulados fuera de los lectores de Co… | in-progress | interno |
| 0495 | Una reversión de crédito que falla deja de ser invisible | in-progress | interno |
| 0496 | El crédito de referido se aplica y se revierte en una sola tr… | in-progress | interno |
| 0497 | Gates de RBAC en ocho server actions del Studio que no los te… | done | interno |
| 0498 | Cinco puertas del Studio que se saltaban el fail-closed por d… | in-progress | interno |
| 0499 | Secretos que viajan mal y gates que faltan en app/api | in-progress | interno |
| 0500 | El anti-drift de RBAC mide por acción, no por archivo | in-progress | interno |
| 0501 | Detectar el desfase de encabezados del grafo que el sello AST… | done | interno |
| 0502 | Mínimo facturable con batería según el multiplicador configur… | in-progress | interno |
| 0503 | Carrusel de fotos de la empresa en la web pública | in-progress | interno |
| 0504 | Entrega incluida desde Editar ciudad | done | interno |
| 0505 | Dockerizar DTD Cargo para el servidor propio en Contabo (Fase 0) | in-progress | interno |
| 0506 | Los adjuntos de Bitácora vuelven a pasar la validación de ent… | done | interno |
| 0507 | Adjuntos visibles en el Studio: conteo por fila en Clientes, … | done | interno |
| 0508 | El objeto de un documento se firma y se borra en el bucket qu… | done | interno |
| 0509 | Clientes y embarques eliminados fuera de los listados del Studio | done | interno |
| 0510 | El selector de «Generar Bill of Lading» filtra con las etique… | done | interno |
| 0511 | Envíos y clientes eliminados fuera de los avisos, Kommo y el … | in-progress | interno |
| 0512 | /back fuera de los buscadores: noindex en todo el back de con… | done | interno |
| 0513 | Restablecer el PIN de un operario con uno generado y mostrarl… | done | interno |
| 0514 | Portal: aviso de seguimiento en construcción | done | interno |
| 0515 | PIN de operarios endurecido: matriz de módulos, «Ver PIN» con… | done | interno |
| 0516 | Portal: el detalle de compra no promete avisos mientras el se… | done | interno |
| 0517 | Registro público: sin promesa de aviso de bodega mientras el … | done | interno |
| 0518 | Google Analytics y la etiqueta de Ads cargan aunque NEXT_PUBL… | done | interno |
| 0519 | Servicios y marketing: sin promesa de aviso de bodega mientra… | done | interno |
| 0520 | Operarios: columnas ajustables y botones compactos | done | interno |
| 0521 | Tracking en construcción: «Te avisaremos apenas esté activo» … | done | interno |
| 0522 | Borrado auditado de embarques y recepciones de prueba | in-progress | interno |
| 0523 | Secretos de firma vacíos cuentan como ausentes: baja de corre… | in-progress | interno |
| 0524 | Avisos de bodega confiables para el cliente | in-progress | interno |
| 0525 | Modelos de Anthropic vacíos caen a su respaldo: acta, Escucha… | in-progress | interno |
| 0526 | Portal: bandeja de avisos del cliente | in-progress | interno |
| 0527 | Salud de Resend: una llave borrada deja de salir verde en /st… | in-progress | interno |
| 0528 | Textos públicos de rastreo que quedan: /entrar, glosario, /se… | in-progress | interno |
| 0529 | Editar operarios de Venezuela: rol de su región, sin almacén,… | in-progress | interno |
| 0530 | Naviera: al zarpar el contenedor, los envíos de los clientes … | in-progress | interno |
| 0531 | Ocultar nombres de clientes al equipo de China en Tracking y … | in-progress | interno |
| 0532 | Autorizar una consolidación de Naviera deja de fallar siempre… | in-progress | interno |
| 0533 | Salud del webhook de Resend: una llave borrada deja de salir … | in-progress | interno |
| 0534 | Siete acciones R3 del Studio dejan de fallar siempre: correla… | in-progress | interno |
| 0535 | Kommo: el cliente que vuelve a escribir llega a Recontacto, c… | in-progress | interno |
| 0536 | Contrato 0480: el último evento se elige por guardado, no por… | in-progress | interno |
| 0537 | Tarifario de transportistas editable por ciudad, con rutas y … | in-progress | interno |
| 0538 | Contrato 0475: el bloque 5 lee el último restablecimiento por… | in-progress | interno |
| 0539 | Transportistas: lote sin ids en la URL, escrituras honestas y… | in-progress | interno |
| 0540 | Entorno de prueba de DTD Cargo con base separada en el VPS (d… | approved | interno |
| 0541 | Publicación automática de la web en el servidor propio | in-progress | interno |
| 0542 | Dashboard: los enlaces internos llevan a una pantalla que existe | in-progress | interno |
| 0543 | Consolidados en camino: carga de contenedores desde el packin… | in-progress | interno |
| 0544 | Producto mínimo para el entorno de prueba: GA apagable, aviso… | proposed | interno |
| 0545 | sdd:next --reserve: --expect, --number y aviso de hueco reciente | in-progress | interno |
| 0546 | Aplicar migraciones en la base del servidor propio: scripts p… | in-progress | interno |
| 0547 | Panel de publicaciones del Studio: el estado del servidor pro… | in-progress | interno |
| 0548 | El gate migrations-applied mide solo en producción y dice dón… | in-progress | interno |
| 0549 | Portal: lecturas restantes por principal de sesión y tenant | done | interno |
| 0550 | Pruebas que vencen bajo carga, pruebas bash en el CI y sha256… | in-progress | interno |
| 0551 | Retirar el botón «Publicar» (bot de deploy) del Studio local | done | interno |
| 0552 | Portal: relecturas de tenant con el admin, por principal de s… | in-progress | interno |
| 0553 | Portal: avanzar estimado a cotización por principal y tenant | in-progress | interno |
| 0554 | Portal: lecturas de compras por tenant del principal | in-progress | interno |
| 0555 | El borrador de factura conserva el embarque de cada línea | in-progress | interno |
| 0556 | El portal dice la verdad: las facturas anuladas no son deuda | in-progress | interno |
| 0557 | Reportes contables sin migración: una cifra de ingreso, compr… | in-progress | interno |
| 0558 | Saldo único por cliente y cabecera del perfil v1 | in-progress | interno |
| 0559 | Radiografía de integridad contable repetible | in-progress | interno |
| 0560 | Asistente de borrado de embarques: pasos en orden para poder … | in-progress | interno |
| 0561 | Candado de las migraciones aplicadas: una migración en produc… | in-progress | interno |
| 0562 | «Por contabilizar» cuenta los recibos como la radiografía | in-progress | interno |
| 0563 | La factura en bolívares o yuanes no se convierte para cuadrar… | in-progress | interno |
| 0564 | Instalación piloto de Paperclip y Hermes en un VPS aislado | approved | interno |
| 0565 | Ninguna cuenta del plan queda huérfana | in-progress | interno |
| 0566 | Cierre contable con superclave y reporte de excepciones | in-progress | interno |
| 0567 | El crédito de referido no nace sin venta ni se aplica dos veces | in-progress | interno |
| 0568 | La ficha de un cliente eliminado dice que está eliminado y no… | in-progress | interno |
| 0569 | Un solo conversor a USD, que falla cerrado, y una tabla de ta… | in-progress | interno |
| 0570 | Pruebas PGlite sin initdb por caso: plantilla del cluster rec… | in-progress | interno |
| 0571 | Tarifa congelada por embarque: el precio por CBM queda guarda… | in-progress | interno |
| 0573 | Anular una factura revierte su asiento de venta, en la misma … | in-progress | interno |
| 0574 | Embarques sin facturar: el reporte y las tarjetas en Dirección | in-progress | interno |
| 0577 | Reintento de borrado disponible y consultas de archivos del P… | in-progress | interno |
| 0579 | Promesas de seguimiento coherentes en FAQ y fuentes locales | done | interno |
| 0580 | Shipping Mark CTA: altura intrínseca y recorrido móvil | done | interno |
| 0581 | Diagnóstico local de medición Ads y CSP | done | interno |
| 0582 | Programa Kommo → Chatwoot dentro de Studio, con checklist y a… | proposed | interno |
| 0583 | Chatwoot CE en el VPS del ERP (etapa E1 del programa SDD-0582) | in-progress | interno |
| 0584 | Protección de /register y /deregister de WhatsApp en Chatwoot… | in-progress | interno |
| 0585 | Bandeja de Chatwoot dentro de Studio, usuarios y permisos (et… | in-progress | interno |
| 0586 | Enrutamiento por segmento desde el ERP (etapa E10 del program… | in-progress | interno |
| 0587 | Contrato de sistema maestro por objeto y fase: Studio, Chatwo… | approved | interno |
| 0588 | Actualizaciones de Chatwoot desde Studio (etapa E3 del progra… | in-progress | interno |
| 0589 | Motor de guía propio y liviano en Studio (E9 del programa SDD… | in-progress | interno |
| 0590 | Historial de Kommo: respaldo cifrado fuera de Git y medición … | in-progress | interno |
| 0591 | Cambiar el plan de cuentas queda para accounting y admin | in-progress | interno |
| 0592 | El foco no se sale del modal durante el envío ni con errores … | in-progress | interno |
| 0593 | Escribir asientos queda para accounting y admin; las cuentas … | in-progress | interno |
| 0594 | restore.sh recrea ensure_rls y compara los event triggers con… | in-progress | interno |
| 0595 | El primer error recibe el foco: primer tramo en Nómina y flota | in-progress | interno |
| 0596 | Un error no borra lo que la persona escribió | in-progress | interno |
| 0597 | /entrar no dice que salió un correo que no salió | in-progress | interno |
| 0598 | Un corte de red no borra el formulario | in-progress | interno |
| 0599 | Reintentar un envío del portal no lo duplica | in-progress | interno |
| 0600 | Un correo no se compara como patrón: correo entrante, invitac… | in-progress | interno |
| 0601 | Aviso del cobro no registrado: por qué y a quién acudir | in-progress | interno |
| 0602 | Las redirecciones propias no mandan a la dirección donde escu… | in-progress | interno |
| 0604 | SEO, GEO y AEO: fase A, mejoras estáticas del sitio público | in-progress | interno |
| 0605 | Reestructura de la oficina de agentes: 13 agentes, marketing … | proposed | interno |
| 0606 | Avisos del Studio: de Telegram a Discord | in-progress | interno |
| 0607 | Puente de ALFRED en el repositorio y corte de la oficina a Di… | proposed | interno |
| 0609 | Avisos del servidor: de Telegram a Discord | in-progress | interno |
| 0610 | Resumen semanal agregado del CRM para marketing, sin datos pe… | proposed | interno |
| 0611 | Publicación automática de noticias en /noticias, con filtros | approved | interno |
| 0612 | Avisos de Paperclip a #actividad-oficina y resumen diario de … | proposed | interno |
| 0613 | SEO, GEO y AEO: fase B, revisión en servidor, Search Console … | proposed | interno |
| 0614 | Reemplazos de Kommo en el ERP: vista CRM nueva, ficha desde l… | draft | interno |

> **Huecos en el correlativo:** 0022, 0023, 0027, 0028, 0037, 0112, 0190, 0301, 0435, 0445, 0446, 0447, 0483, 0572, 0575, 0576, 0578, 0603, 0608 — código sin spec o renumerado, auditar caso por caso.
<!-- AUTO-INDEX:END -->
