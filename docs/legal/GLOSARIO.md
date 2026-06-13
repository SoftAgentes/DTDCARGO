# GLOSARIO.md — Glosario oficial DTD Cargo (ES / EN / 中文)
> Fuente única de terminología para: ERP, web, documentos legales, WeChat, marketing y corpus RAG · 10-jun-2026
> Regla: si un término no está aquí y se va a usar en más de una pieza, se agrega aquí PRIMERO.

| Término oficial | EN | 中文 | Definición operativa DTD | Notas de uso |
|---|---|---|---|---|
| **Shipping Mark** | Shipping Mark | 唛头 (màitóu) | Código único del cliente (DTD-XXXXX) y de cada compra (DTD-XXXXX-N). Identificador de la carga en cajas, sistema y documentos | ⚠️ Reemplaza a "MarkBox" (término ELIMINADO, 10-jun-2026). Término estándar de la industria china |
| **CBM** | Cubic Meter | 立方米 / 方 | Metro cúbico; unidad de cobro del flete consolidado | Se cobra por CBM o fracción |
| **ETD** | Estimated Time of Departure | 预计离港时间 | Fecha ESTIMADA de zarpe del buque desde puerto de origen | Siempre comunicar como estimado, nunca garantizado (Anexo A.4) |
| **ETA** | Estimated Time of Arrival | 预计到港时间 | Fecha ESTIMADA de llegada a puerto de destino | Ídem ETD |
| **DDP** | Delivered Duty Paid | 完税后交货 | Modalidad puerta a puerta: aduana e impuestos gestionados en la cadena; el cliente recibe en su puerta | Es LA modalidad bandera de DTD Cargo |
| **LCL** | Less than Container Load | 拼箱 | Carga consolidada: varios clientes comparten contenedor | Producto principal (motor 2 contenedores/mes) |
| **FCL** | Full Container Load | 整柜 | Contenedor completo de un solo cliente | |
| **B/L** | Bill of Lading | 提单 | Conocimiento de embarque emitido por la naviera; puede ir a nombre del Operador de Consolidación | Nunca a nombre del cliente ni del Agente Local (cláusula 1.3) |
| **POD** | Proof of Delivery | 签收证明 | Comprobante de entrega: foto + nombre/CI del receptor + firma | Pieza clave del expediente de defensa (SDD-E) |
| **Pre-alerta** | Pre-alert | 预报 | Notificación obligatoria del cliente ANTES de que su carga llegue al almacén de origen (tracking + PI/factura + packing list) | Anexo C |
| **Packing List** | Packing List | 装箱单 | Detalle de piezas, dimensiones, CBM y peso por envío | |
| **La Operadora** | The Operator | 运营方 | La operadora internacional que vende el flete puerta a puerta bajo la marca DTD Cargo | En documentos de cliente NUNCA se usa el nombre legal del socio chino |
| **El Agente Local** | Local Agent | 代理方 | Inversiones DTD Services, C.A.: entrega local y gestión de cobranza en Venezuela | Factura fiscalmente SOLO servicios locales |
| **El Operador de Consolidación** | Consolidation Operator | 拼箱操作方 | Tercero que consolida/importa; figura genérica en documentos de cliente | Término escudo: sin nombres propios |
| **Gestión de cobranza** | Collection management | 代收款 | Recepción de pagos del flete internacional EN NOMBRE de la Operadora | Leyenda obligatoria en recibos (cláusula 7.2) |
| **Fondos de terceros** | Third-party funds | 第三方资金 | Dinero recaudado que pertenece a la Operadora; NO es ingreso del Agente Local | Contabilidad separada SIEMPRE (María) |
| **Rendición de cuentas** | Settlement report | 账目报告 / 对账单 | Reporte quincenal (días 15 y último) de lo recaudado, con neteo de servicios locales | Generado automático por el ERP (SDD-D) |
| **PCE** | Cash on delivery (COD) | 货到付款 | Pago contra entrega: la carga viaja bajo derecho de retención hasta pago íntegro | No es crédito comercial |
| **Derecho de retención** | Lien / right of retention | 留置权 | Garantía: la mercancía no se entrega sin pago completo | La única garantía real de DTD — protegerla |
| **HOLD de despacho** | Dispatch hold | 发货冻结 | Bloqueo automático del despacho por pago incompleto | Filtro previo, no score (regla AGENTS.md) |
| **Override** | Override | 例外放行 | Liberación excepcional sin pago completo: solo Sam + justificación registrada + plan de pago confirmado | Bitácora de auditoría obligatoria |
| **Plan de pago** | Payment plan | 付款计划 | Compromiso escrito (confirmación digital válida) que habilita entrega con saldo pendiente | "ACEPTO" del cliente queda registrado |
| **Imputación retroactiva** | Retroactive application | 追溯入账 | Pago sin referencia que, al identificarse, se aplica a la fecha real de recepción de fondos, reversando cargos del limbo | Cláusula 7.3 |
| **Liquidación** | Liquidation (lien sale) | 留置物变卖 | Venta de mercancía a los 60 días del arribo por incumplimiento, para cubrir deuda y costos | Remanente a disposición del cliente conforme a ley (4.3) |
| **Bodegaje** | Storage fee | 仓储费 | Cargo por ocupación de capacidad tras la gracia: 3/6/10 USD por CBM/día calendario según tramo | Cláusula 4.2 |
| **Expediente de defensa** | Defense file | 证据档案 | PDF de un click: aceptación + packing list + fotos + eventos + POD de una operación | SDD-E; práctica interna, no prometida en contrato |
| **Aceptación electrónica** | Electronic acceptance | 电子确认 | Checkbox + registro de versión, fecha/hora, IP y hash que vincula al cliente con el Acuerdo | Ley de Mensajes de Datos y Firmas Electrónicas |
