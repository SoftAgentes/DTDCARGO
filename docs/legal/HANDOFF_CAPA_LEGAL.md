# HANDOFF_CAPA_LEGAL.md
> Handoff de Claude Chat → Claude Code · 10-jun-2026 · rama destino: `feat/capa-legal`
> Propósito: implementar la capa legal del ERP/portal DTD Cargo. El CONTENIDO legal se redacta y decide en Claude Chat; este documento trae las decisiones cerradas y las specs a implementar. Al terminar, registrar en AGENTS.md vía `/in`.

---

## 1. CONTEXTO CERRADO (no rediscutir, no modificar sin Sam)

**Arquitectura legal de 3 patas (decidida 10-jun-2026):**
1. **Operadora internacional** ("DTD Cargo China" = Canopy bajo licencia de marca): vende el flete internacional (CBM). En documentos de cliente NUNCA aparece el nombre Canopy — solo "la Operadora" o la marca DTD Cargo.
2. **Importador de registro**: tercero independiente ("el Operador de Consolidación"). Sin cambios.
3. **Inversiones DTD Services, C.A.** (RM 2º Carabobo Nº 3, Tomo 3-A, 13-01-2025, Exp. 315-108031; Presidente y accionista único: José M. Méndez): agente local de ENTREGA y GESTIÓN DE COBRANZA. Factura fiscalmente SOLO servicios locales (flete terrestre, manejo, almacenaje).

**Reglas absolutas:**
- `DoorTuDoor Trading C.A. (RIF J-50220185-8)` está FUERA: prohibido en cualquier documento, membrete, footer, recibo o metadato del sistema.
- El nombre `Canopy` solo existe en el contrato privado bilateral (no en el producto).
- TERMINOLOGÍA (decisión 10-jun-2026): el término `MarkBox` queda ELIMINADO de todo el sistema, documentos y glosario de la empresa. Se reemplaza por **`Shipping Mark`** (término estándar de la industria). Aplica a: UI, documentos legales, plantillas de recibos, nombres en código nuevo y copys. El formato del código no cambia (DTD-XXXXX-N).
- Correo oficial único: **info@dtdcargo.com** (privacidad → asunto "Privacidad"; controversias → asunto "Gerencia").
- Todo dinero de flete internacional recaudado = FONDOS DE TERCEROS de la Operadora; el ingreso propio de DTD Services = servicios locales facturados.

**Documentos fuente (versiones vigentes, en /docs/legal/ del repo):**
| Documento | Versión | Estado |
|---|---|---|
| Acuerdo de Servicios y Políticas Generales (cliente) | v3.0 BORRADOR | Pendiente abogado; ESTE es el que implementa el portal |
| Contrato Gestión de Cobranza Canopy↔DTD Services (ES/ZH) | v2 BORRADOR | Pendiente firma; define la leyenda de recibos y la rendición |
| Dossier de Protección Legal | v0.1 | Vivo; fichas 01–03 hechas, backlog 04–09 |
| T&C v2.1, Acuerdo HTML feb-2025, Política Reembolso v1.0 | — | RETIRADOS: solo referencia histórica, no implementar |

---

## 1-BIS. DECISIONES DE NEGOCIO CERRADAS (Q&A Sam, 10-jun-2026) — implementar tal cual

| # | Tema | Decisión |
|---|---|---|
| 1 | Cancelación (A.3) | Escalonado: 5% sin gestiones / 10% con gestiones iniciadas; mínimo USD 30. Causa: gestión administrativa + reserva de capacidad |
| 2 | Reembolsos (A.6) | Respuesta: 5 días hábiles desde solicitud COMPLETA. Procesamiento: 15 días hábiles desde aprobación. Mismo medio de pago u otro acordado por escrito |
| 3 | Bodegaje VE (4.2) | 15 días hábiles de gracia; luego por día CALENDARIO y CBM: USD 3 (d16–30), USD 6 (d31–45), USD 10 (d46–60) |
| 4 | Excedente liquidación (4.3) | Cláusula mínima: producto se aplica a deuda+costos; remanente "a disposición del Cliente conforme a la ley". SIN procedimientos prometidos. Venta documentada = práctica interna vía SDD-E (no contractual) |
| 5 | Rendición a Operadora | QUINCENAL: días 15 y último de cada mes (SDD-D) |
| 6 | Pago sin referencia (7.3) | No libera ni suspende plazos; al identificarse → imputación RETROACTIVA a fecha de recepción de fondos + reverso de cargos del limbo |
| 7 | Pagos de terceros (7.4) | Aceptados con registro del pagador (nombre + relación) + declaración de licitud + referencia. No reportado = tratamiento 7.3 |
| 8 | Override de despacho | HOLD automático por pago incompleto. Liberación: SOLO rol Sam + justificación obligatoria + plan de pago confirmado digitalmente por el cliente ("ACEPTO" registrado) + bitácora |

**Principio rector acordado:** "En el contrato, los derechos; en el ERP, los procedimientos. Prometer poco, documentar todo." No agregar al texto legal procedimientos operativos no prometidos.

## 1-TER. ARCHIVOS FUENTE QUE ACOMPAÑAN ESTE HANDOFF

| Archivo | Rol | Regla |
|---|---|---|
| `acuerdo-servicios-v3.mdx` | Texto legal CONGELADO (sirve a /terminos, Starlight y RAG) | Claude Code lo renderiza, JAMÁS edita su redacción |
| `COPY_LEGAL_UI.md` | Copy literal de UI: modal (2 checkboxes), recibo, formulario de pago, notificación de arribo, pre-avisos d30/45/55, flujo override, estados de pago | Pegar literal; cambios solo vía Claude Chat |
| `GLOSARIO.md` | Terminología oficial ES/EN/中文 | Fuente de verdad para naming de UI y copys |

## 2. SPECS A IMPLEMENTAR (proponer como SDD siguiendo numeración del proyecto)

### SDD-A · Documentos legales versionados
- Tabla `legal_documents`: id, slug ('acuerdo-servicios'), version ('3.0'), title, body_md o body_html, sha256_hash (del contenido publicado), published_at, effective_at (publicación + 72h hábiles), status (draft|published|superseded).
- Página pública `/terminos` (y `/terminos/v/[version]`): renderiza la versión vigente; las anteriores quedan accesibles por URL versionada.
- Regla: un documento publicado es INMUTABLE; cambios = nueva versión.

### SDD-B · Flujo de aceptación con evidencia (la pieza crítica)
- Bloqueo duro: ninguna cotización se puede confirmar sin aceptación registrada de la versión vigente.
- Modal de aceptación: checkbox previo y obligatorio + link al documento completo.
- Tabla `legal_acceptances`: id, user_id, quotation_id, document_id+version, accepted_at (UTC), ip, user_agent, content_hash (sha256 del documento aceptado). Append-only (sin UPDATE/DELETE; RLS).
- Si hay nueva versión vigente y el cliente confirma nueva cotización → debe re-aceptar.
- Export de evidencia: función que genera PDF/JSON del registro de aceptación de un cliente/operación (para abogado en caso de reclamo).

### SDD-C · Recibos de cobranza (mandato)
- Todo recibo de pago de flete internacional lleva OBLIGATORIO:
  - Leyenda: "Gestión de cobranza por cuenta de DTD Cargo (operadora internacional) — Servicio puerta a puerta — Ref. {codigo_envio}"
  - Referencia de envío (Shipping Mark + nº de operación), monto, fecha, canal de pago.
  - NO es factura fiscal. Sin RIF de DoorTuDoor Trading en ninguna parte.
- Pagos sin referencia → estado "no aplicado" hasta identificación (cláusula 7.3 del Acuerdo).
- Separación contable en el modelo de datos: `third_party_funds` (recaudado para la Operadora) vs `local_revenue` (servicios locales facturables por DTD Services). Nunca mezclar en un mismo asiento.

### SDD-D · Rendición de cuentas a la Operadora
- Reporte automático (corte [quincenal|mensual] — pendiente decisión Sam): recaudado por cliente y referencia, neteo de servicios locales facturados, saldo a favor de la Operadora. Export XLSX/PDF. Usuario: María.

### SDD-E · Cadena de evidencia operativa (defensa legal = feature)
- Por envío: fotos en almacén origen (upload del equipo Yiwu), eventos de tracking timestamped, y POD (comprobante de entrega: foto + nombre/CI receptor + firma digital o foto de firma) en last mile.
- Función "expediente de defensa": un click → PDF con aceptación de términos + packing list + fotos + eventos + POD de una operación.

### Prioridad sugerida: B → C → A → E → D (B y C desbloquean operar protegido YA; E es el módulo más grande y se alinea con tracking del MVP).

---

## 3. LO QUE NO ES DE CLAUDE CODE (queda en chat / humanos)
- Confirmación de placeholders del Acuerdo v3.0: cargo cancelación [10]%, plazos [5]/[10] días, bodegaje [10 USD/CBM/día], excedente [90] días, foro (cláusula 12.2).
- Validación por abogado venezolano (Acuerdo v3.0 + Contrato Canopy v2 + preguntas de renta presunta/PT a contador).
- Firma del contrato Canopy↔DTD Services (negociación: reciprocidad de exclusividad, idioma prevalente, carve-outs de clientes).
- Registro de marca: CNIPA (China, urgente, first-to-file) y SAPI (Venezuela).
- Papel de protección Sam↔José (opción de compra / venta 50% / poder + sucesión).
- Fichas 04–09 del Dossier (UNIF/bancos, laboral, aduana, continuidad).

## 4. DEFINITION OF DONE (capa legal MVP)
- [ ] Imposible confirmar cotización sin aceptación registrada (con hash/IP/versión)
- [ ] /terminos publica v3.0 versionada e inmutable
- [ ] Recibos con leyenda de cobranza + referencia en el 100% de los pagos
- [ ] Fondos de terceros y revenue local separados en datos y reportes
- [ ] Export de expediente de defensa por operación
- [ ] `/in` ejecutado: decisiones de este handoff registradas en AGENTS.md
