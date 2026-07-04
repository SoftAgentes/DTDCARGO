-- ─────────────────────────────────────────────────────────────
-- SDD-0054 / SDD-A · Publicación del Acuerdo de Servicios v3.0
--
-- Monta el documento ÚNICO "Acuerdo de Servicios y Políticas Generales" v3.0
-- (key `acuerdo-servicios`) que FUSIONA los dos docs de cara al cliente
-- (Términos y Condiciones + Condiciones del Operador) en uno solo con Anexos
-- A/B/C. Texto VERBATIM de docs/legal/acuerdo-servicios-v3.mdx (fuente única
-- congelada — Claude Code no modifica la redacción, solo la renderiza).
--
-- ⚠️ DECISIÓN DEL FOUNDER (2026-07-04): se publica como VIGENTE aun SIN la
-- validación final del abogado. El texto conserva ~11 placeholders `[…]` sin
-- definir (RIF, no-competencia, DEG, días de reclamo, prima de seguro, arts.
-- del Código de Comercio, arbitraje) — la card "Pendiente de revisión legal"
-- del repositorio los lista. Cuando el abogado entregue el texto final se
-- publica v3.1 (nueva migración) y v3.0 pasa a `archivada`.
--
-- Efectos:
--   1. INSERT acuerdo-servicios v3.0 (vigente, audience=cliente).
--   2. ARCHIVA tyc v2.1 + operador v1.4 (v3 los reemplaza). El índice parcial
--      legal_docs_current_uniq (≤1 vigente por tenant,key) no se viola: la key
--      nueva no colisiona y las viejas dejan de ser vigentes.
--   3. Automático (sin tocar código): el modal del Portal cambia al copy
--      unificado (buildAcceptanceCopy detecta la key `acuerdo-servicios`), y
--      currentClientDocs pasa a devolver 1 solo doc → el cliente acepta el
--      Acuerdo único. El gate AUT-04 exige aceptación de v3.0.
--
-- Idempotente: on conflict (tenant,key,version) do nothing + el archive filtra
-- por status. ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

insert into public.legal_docs
  (tenant_id, key, name, audience, version, effective_date, status, sections, change_note, body)
select
  t.id,
  'acuerdo-servicios',
  'Acuerdo de Servicios y Políticas Generales',
  'cliente',
  'v3.0',
  '2026-07-04'::date,
  'vigente',
  16,
  'Documento único que fusiona Términos y Condiciones + Condiciones del Operador (Anexos A/B/C). Montado como vigente sin validación final del abogado — pendiente v3.1.',
  jsonb_build_array(
    jsonb_build_array(
      '1. Partes y naturaleza del servicio',
      '1.1. El servicio de carga consolidada puerta a puerta China–Venezuela bajo la marca DTD Cargo es prestado por la operadora internacional del servicio ("la Operadora"), quien vende el flete internacional y coordina la cadena logística desde el almacén de origen en China. 1.2. INVERSIONES DTD SERVICES, C.A., inscrita en el Registro Mercantil Segundo del Estado Carabobo bajo el Nº 3, Tomo 3-A, de fecha 13-01-2025, RIF [J-________] ("el Agente Local"), actúa exclusivamente como agente local de entrega y gestión de cobranza de la Operadora en Venezuela, conforme a su objeto social de mensajería internacional puerta a puerta. El Agente Local NO es transportista marítimo ni aéreo, NO es importador de registro y NO es parte del contrato de transporte internacional. 1.3. La nacionalización de la mercancía es realizada por operadores de consolidación e importadores independientes ("el Operador de Consolidación"). El Conocimiento de Embarque (B/L) puede emitirse a nombre del Operador de Consolidación, no del Cliente ni del Agente Local. La mercancía puede consolidarse con carga de otros clientes. 1.4. DECLARACIÓN DEL CLIENTE: el Cliente declara que actúa como comerciante, empresa o emprendedor con fines de lucro. La relación es mercantil entre comerciantes y se rige por el Código de Comercio venezolano, no por la legislación de protección al consumidor. Fundamento legal: Código de Comercio, arts. [__] y normas concordantes (comerciantes y actos de comercio).'
    ),
    jsonb_build_array(
      '2. Registro, Shipping Mark y pre-alerta',
      '2.1. Registro único: el Cliente se registra una sola vez en la plataforma de DTD Cargo con datos reales y documento de identidad. El registro genera su código SHIPPING MARK único (formato DTD-XXXXX), identificador permanente de su carga en todo el sistema y la documentación de DTD Cargo. 2.2. Identificación de cajas: cada caja debe llevar ÚNICAMENTE el código Shipping Mark visible e impreso (DTD-XXXXX-N por proveedor). Prohibido escribir nombre, dirección o teléfono del Cliente en el empaque. DTD Cargo no responde por extravíos, decomisos o retrasos de cajas sin código Shipping Mark correcto. 2.3. Pre-alerta obligatoria: antes de que la carga llegue al almacén de origen, el Cliente debe notificar por los canales oficiales: tracking del proveedor, descripción de la mercancía (PI o factura comercial) y packing list (piezas, dimensiones, CBM, peso). La omisión puede generar retrasos, costos de bodegaje y mercancía sin identificar. Checklist completo en el Anexo C.'
    ),
    jsonb_build_array(
      '3. Tarifas y cotizaciones',
      '3.1. La tarifa cotizada es válida por 7 días corridos desde su emisión y está sujeta a confirmación de volumen y peso reales en el almacén de origen. Las diferencias de CBM/peso se reliquidan al cierre del contenedor. 3.2. La aceptación de una cotización constituye orden de servicio en firme sujeta a este Acuerdo.'
    ),
    jsonb_build_array(
      '4. Almacenaje y tolerancias',
      '4.1. Fase China: 15 días continuos de almacenaje gratuito desde la recepción en el almacén de origen, para verificación (servicio con costo adicional), consolidación y coordinación de despacho. Extensión: solicitarla con 5 días de antelación al vencimiento. Permanencia máxima: 60 días. Cumplidos los 60 días sin instrucciones, la carga se considera en abandono y podrá disponerse de ella conforme a la ley aplicable. 4.2. Fase Venezuela: 15 días hábiles de almacenaje gratuito desde el arribo al almacén de destino. Vencida la gracia, el bodegaje se causa por día CALENDARIO y por CBM o fracción (o su equivalente por peso): días 16–30: USD 3 · días 31–45: USD 6 · días 46–60: USD 10. Este cargo compensa la ocupación de capacidad operativa del almacén de destino. 4.3. Liquidación por incumplimiento: si transcurridos 60 días calendario desde la llegada a Venezuela el Cliente no ha pagado el flete total, no ha retirado la mercancía y no ha formalizado plan de pago por escrito, el Agente Local podrá ejecutar el derecho de retención y proceder a la venta de la mercancía conforme al Código de Comercio, aplicando el producto al pago del flete adeudado, bodegaje, costos de la liquidación e intereses. De existir remanente, quedará a disposición del Cliente conforme a la ley. El saldo deudor no cubierto seguirá siendo exigible. Fundamento legal: Código de Comercio, arts. [__] y normas concordantes (derecho de retención y venta por cuenta del deudor). 4.4. Pre-aviso de liquidación: se notificará por cualquier canal registrado del Cliente (email, WhatsApp, SMS, llamada con registro). El Cliente es responsable de mantener sus datos de contacto actualizados. La falta de lectura o respuesta no suspende los plazos.'
    ),
    jsonb_build_array(
      '5. Responsabilidad',
      '5.1. Ni la Operadora ni el Agente Local responden por pérdida, daño, hurto, demora o retención imputables a terceros (Operador de Consolidación, navieras, autoridades aduaneras, almacenes portuarios). Tales reclamos deben dirigirse al transportista efectivo o a la aseguradora de la carga; DTD Cargo facilitará la documentación disponible. 5.2. Límites legales del transportista: el Cliente declara conocer que la responsabilidad del transportista marítimo está limitada por los convenios internacionales y la ley aplicable al contrato de transporte (valores de referencia: aprox. 666,67 DEG por bulto o 2 DEG por kilogramo, lo que resulte mayor — cifras referenciales según el régimen aplicable [validar con abogado]), por lo que dichos límites pueden resultar muy inferiores al valor de la mercancía. El seguro de carga (cláusula 6) es el único mecanismo de cobertura del valor real. 5.3. Constancia de daños y plazos de reclamo: el Cliente (o quien reciba en su nombre) debe dejar constancia escrita de todo daño o faltante VISIBLE en el comprobante de entrega (POD) al momento de recibir, y notificar los daños NO aparentes dentro de los [3] días hábiles siguientes a la entrega. La recepción sin observación hace presumir la entrega conforme. Los reclamos contra el transportista marítimo prescriben, por regla general, en un (1) año desde la entrega; el Cliente es responsable de accionar oportunamente. 5.4. En caso de negligencia grave o dolo propio comprobado, la responsabilidad se limita al VALOR DEL FLETE PAGADO por el envío afectado, nunca al valor de la mercancía. No cubre lucro cesante ni daños indirectos. 5.5. La responsabilidad del Agente Local se limita, en todo caso, al tramo de entrega terrestre nacional y al valor del flete terrestre del envío afectado.'
    ),
    jsonb_build_array(
      '6. Seguro',
      '6.1. El flete NO incluye seguro de carga. La responsabilidad limitada del transportista no equivale a un seguro de la mercancía. 6.2. Seguro opcional bajo solicitud anticipada: el seguro de carga es prestado por aseguradoras terceras e independientes; DTD Cargo actúa únicamente como gestor de la solicitud, no como asegurador. El Cliente que desee asegurar su carga debe solicitarlo CON ANTELACIÓN, antes de la llegada de la mercancía al almacén de origen, declarando su valor real. La contratación está sujeta a las condiciones, aprobación y emisión de la aseguradora; la prima referencial es del [1]% del valor declarado y se confirma en cada caso antes de la emisión. La prima no es reembolsable una vez emitido el certificado. 6.3. Renuncia: si el Cliente no contrata seguro, declara que asume todo el riesgo del transporte y renuncia a reclamos contra DTD Cargo por pérdida, daño o avería. La renuncia queda registrada electrónicamente con la aceptación de la cotización.'
    ),
    jsonb_build_array(
      '7. Pagos y cobranza',
      '7.1. Modalidades: pago anticipado (100% antes del embarque) o pago contra entrega (PCE). En PCE, la mercancía viaja bajo derecho de retención hasta el pago íntegro; no se entrega sin pago completo. Si el Cliente no paga dentro de 15 días hábiles desde la notificación de arribo: retención, bodegaje desde el día 16 y liquidación conforme a la cláusula 4.3. 7.2. Gestión de cobranza: los pagos del flete internacional son recibidos por el Agente Local EN NOMBRE Y POR CUENTA DE LA OPERADORA. Los recibos llevarán la leyenda: "Gestión de cobranza por cuenta de DTD Cargo (operadora internacional) — Ref. [código de envío]". Los servicios locales (flete terrestre, manejo, almacenaje) podrán facturarse fiscalmente por el Agente Local. 7.3. Toda transferencia o pago debe incluir la referencia del envío (Shipping Mark + número de operación). El pago sin referencia no libera mercancía ni suspende plazos mientras no sea identificado; una vez identificado, se imputará retroactivamente a la fecha de recepción de los fondos, reversándose los cargos causados durante el período de identificación. 7.4. Pagos de terceros: se aceptan pagos realizados por terceros por cuenta del Cliente, siempre que al reportarlos se identifique al pagador (nombre y relación con el Cliente) y la referencia del envío. El Cliente declara que dichos fondos corresponden a su operación y son de origen lícito. Los pagos de terceros no reportados se tratan conforme a la cláusula 7.3.'
    ),
    jsonb_build_array(
      '8. Compra asistida (sourcing)',
      '8.1. El Cliente debe entregar por escrito especificaciones completas (modelos, tallas, colores, materiales, estándares). Si el producto coincide con lo especificado pero no con las expectativas no comunicadas, no hay responsabilidad de DTD Cargo. 8.2. Inspección previa al embarque disponible con costo adicional. Si el Cliente no la contrata, acepta la mercancía "tal cual" del proveedor y renuncia a reclamos por defectos de fábrica no detectables en fotografías.'
    ),
    jsonb_build_array(
      '9. Aduana y cumplimiento',
      '9.1. El Cliente es responsable de la veracidad y completitud de la documentación (facturas, packing list, certificados) y de la licitud de su mercancía. Declara que no envía artículos prohibidos, mercancía peligrosa no declarada, ni réplicas o falsificaciones (lista en Anexo B). La omisión o falsedad traslada al Cliente toda responsabilidad legal y económica, quien indemnizará a DTD Cargo por todo daño, multa o gasto resultante. 9.2. DTD Cargo no responde por retenciones, decomisos o multas derivadas de mercancía prohibida, restringida o mal declarada por el Cliente.'
    ),
    jsonb_build_array(
      '10. Fuerza mayor',
      '10.1. Quedan suspendidas las obligaciones, sin penalización, ante eventos fuera del control razonable: guerras, pandemias, huelgas, cierres de puertos o fronteras, sanciones internacionales que afecten navieras o banca corresponsal, cambios regulatorios abruptos, interrupción de servicios bancarios internacionales y fenómenos naturales. Si el evento persiste más de 60 días continuos, cualquiera de las partes podrá rescindir sin indemnización.'
    ),
    jsonb_build_array(
      '11. Confidencialidad, propiedad intelectual y datos',
      '11.1. DTD Cargo mantiene confidencialidad sobre los datos del Cliente y sus proveedores, salvo requerimiento judicial o administrativo. 11.2. El Cliente garantiza que su mercancía no infringe propiedad intelectual de terceros y exime a DTD Cargo de reclamos por contrafacción. 11.3. Datos personales: tratamiento exclusivo para fines logísticos, administrativos y de comunicación comercial, con consentimiento expreso para almacenamiento y transferencia internacional. Derechos ARCO: solicitud escrita a info@dtdcargo.com con asunto "Privacidad". Fundamento legal: Constitución de la República Bolivariana de Venezuela, art. 28 (habeas data) y normas concordantes. 11.4. Compromiso de no competencia con el Cliente. DTD Cargo presta exclusivamente el servicio logístico de carga, consolidación y entrega. DTD Cargo se obliga a NO utilizar la información comercial del Cliente —en particular la identidad de sus proveedores, sus diseños, modelos, especificaciones, listas de productos o volúmenes— para adquirir, importar o comercializar esos mismos productos en competencia con el Cliente, sea por cuenta propia o de terceros. DTD Cargo no contacta a los proveedores identificados por el Cliente con el fin de revender la mercancía que el Cliente importa a través de la plataforma. Esta obligación se mantiene durante la relación comercial y por [__] meses posteriores a su finalización. Quedan excluidos los productos genéricos o de catálogo que DTD Cargo o terceros ya comercializaban con independencia de la información del Cliente. [Validar con abogado: plazo de subsistencia ([__] meses), definición de "mismos productos", alcance de la excepción de productos genéricos/de catálogo y mecanismo de reclamo por incumplimiento. Esta cláusula es adición posterior al bloqueo de decisiones 1-8; confirmar su numeración e integración al publicar.]'
    ),
    jsonb_build_array(
      '12. Controversias',
      '12.1. Mediación previa obligatoria de 15 días hábiles, mediante notificación escrita a info@dtdcargo.com con asunto "Gerencia". Esta etapa no suspende los plazos de las cláusulas 4.3 y 7.1. 12.2. Ley aplicable: República Bolivariana de Venezuela. Jurisdicción: tribunales competentes de Valencia, Estado Carabobo, con renuncia a cualquier otro fuero. [Confirmar con abogado si se prefiere arbitraje.] Fundamento legal: Código de Procedimiento Civil y Código de Comercio, arts. [__] (elección de domicilio y foro).'
    ),
    jsonb_build_array(
      '13. Aceptación electrónica y versiones',
      '13.1. Este Acuerdo se acepta electrónicamente mediante casilla de aceptación previa y obligatoria al confirmar cada cotización, conforme a la Ley de Mensajes de Datos y Firmas Electrónicas. Se registra como evidencia: identificación del Cliente, cotización, versión del documento, fecha y hora, dirección IP y huella de integridad (hash). 13.2. Cada operación queda vinculada a la versión vigente al momento de la aceptación. Las modificaciones se publican en dtdcargo.com/terminos y entran en vigencia 72 horas hábiles después; cambios de tarifas, con 5 días hábiles de antelación. Fundamento legal: Ley sobre Mensajes de Datos y Firmas Electrónicas, arts. [__] (eficacia probatoria de la aceptación electrónica).'
    ),
    jsonb_build_array(
      'Anexo A — Política de reembolso y cancelación',
      'A.1. Cancelación antes de la llegada al almacén de origen: reembolso de lo pagado MENOS gastos ya incurridos (servicios prestados, gestiones, anticipos no recuperables) y el cargo de A.3. A.2. Carga recibida, consolidada o embarcada: NO procede reembolso, salvo incumplimiento comprobado de DTD Cargo; los servicios se consideran prestados y los costos comprometidos. A.3. Cargo por cancelación: sin gestiones iniciadas, 5% del flete cotizado; con gestiones iniciadas (pre-alerta procesada, coordinación con proveedor o reserva de cupo), 10%. En ambos casos, mínimo USD 30. Este cargo compensa la gestión administrativa y la reserva de capacidad de carga, y es independiente de los gastos ya incurridos frente a terceros (A.1). A.4. Demoras: no generan reembolso. Las fechas ETD (Estimated Time of Departure: fecha ESTIMADA de zarpe o salida del buque desde el puerto de origen) y ETA (Estimated Time of Arrival: fecha ESTIMADA de llegada al puerto de destino) son referenciales, no garantizadas, y dependen de itinerarios navieros, congestión portuaria y liberación aduanera, factores ajenos al control de DTD Cargo. A.5. Pérdida o daño imputable a terceros: el reclamo se dirige al transportista efectivo o a la aseguradora (cláusula 5.1). A.6. Procedimiento: solicitud escrita por canal oficial. Respuesta en 5 días hábiles desde la recepción de la solicitud COMPLETA; el reembolso aprobado se procesa en 15 días hábiles desde la aprobación, por el mismo medio de pago utilizado u otro acordado por escrito entre las partes.'
    ),
    jsonb_build_array(
      'Anexo B — Mercancía prohibida y peligrosa (resumen)',
      'Prohibido enviar sin autorización expresa y documentación regulatoria completa: baterías de litio sin certificación UN38.3; líquidos inflamables y aerosoles; gases comprimidos; sustancias tóxicas; armas, municiones y réplicas; medicamentos sin registro y psicotrópicos; alimentos perecederos; divisas, valores y metales preciosos; réplicas de marcas y productos pirata; pirotecnia y explosivos. Consecuencias del incumplimiento: retención, decomiso, multas y sanciones a cargo exclusivo del Cliente, e inclusión en lista de restricción interna.'
    ),
    jsonb_build_array(
      'Anexo C — Checklist de pre-alerta (obligatorio)',
      'Datos del Cliente verificados (razón social, RIF/cédula, contacto, dirección de entrega) · Cada caja con código Shipping Mark único, impreso y visible (DTD-XXXXX-N) · Sin datos personales en el empaque · Pre-alerta enviada por canal oficial con: tracking del proveedor, PI o factura comercial, packing list (piezas, dimensiones, CBM, peso) · Mercancía fuera de la lista del Anexo B · Valor declarado real, sin subfacturación · Plazos de almacenaje y liquidación conocidos y aceptados · Aceptación digital registrada.'
    )
  )
from public.tenants t
where t.slug = 'dtd'
on conflict (tenant_id, key, version) do nothing;

-- Archiva los dos docs que v3 reemplaza (dejan de ser vigentes de cara al cliente).
update public.legal_docs d
  set status = 'archivada'
  from public.tenants t
  where d.tenant_id = t.id
    and t.slug = 'dtd'
    and d.key in ('tyc', 'operador')
    and d.status = 'vigente';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0213_acuerdo_servicios_v3.sql
-- Aplicar con: MCP apply_migration · o supabase migration apply 0213
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
