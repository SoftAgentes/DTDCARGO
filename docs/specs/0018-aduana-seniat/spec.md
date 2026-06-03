---
sdd: "0018"
title: "DoorTuDoor — Aduana SENIAT (workflow aduanal VE)"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0017"]
confidencialidad: interno
---

# DTD-0018 — Aduana SENIAT

> **Workflow aduanal venezolano** del container que ya arribó al puerto.
> 4 tabs: Cola activa · Liberados · Agentes aduanales · Aranceles & impuestos.
> Drawer detalle con cost breakdown (Arancel + IGTF + IVA + Agente) +
> checklist documental + timeline SENIAT. Lazy create de filings por
> shipment cuando entra a `in_customs`. Reusa shipment_status para sync
> con tracking.

---

## 1. Resumen en una línea

`/studio/seniat` muestra 4 tabs con los trámites aduanales del tenant:
cola activa, liberados YTD, agentes y aranceles. El detalle por trámite
incluye cost breakdown, checklist de 7 documentos, HS codes, agente
asignado y timeline 6-step.

---

## 2. Scope

### Incluye

#### Schema (migración 0010)

- 2 enums nuevos:
  - `customs_status`: `en_revision` / `observacion` / `liberacion` / `pagado` / `liberado`
  - `customs_doc_type`: `commercial` / `packing` / `bl` / `cert_origin` / `sanitary` / `dua` / `payment`
- 3 tablas nuevas:
  - **`customs_agents`** (catálogo): id, code text unique (a-001), name, rif, port_code, contact_name, phone, email, rating numeric(2,1), shipments_count int (denorm), active bool, notes, created_at. Sin tenant_id (los agentes son del mundo real, compartidos).
  - **`customs_filings`** (1 trámite = 1 FK a shipment, RLS por tenant): id, tenant_id, shipment_id (UNIQUE — 1 filing por shipment), dua_code text (DUA-VE-YYYY-NNNNNN), port_code text snapshot, agent_id FK customs_agents, status customs_status, hs_codes text[], total_duty numeric, igtf numeric, iva numeric, agent_fee numeric, observations text, alert text nullable, arrived_at date, cleared_at date nullable, deleted_at, created_at, updated_at
  - **`customs_documents`** (N por filing, RLS por tenant cascade): id, tenant_id, filing_id FK, doc_type customs_doc_type, uploaded bool default false, uploaded_at timestamptz nullable, uploaded_by uuid nullable, file_url text nullable (placeholder hasta Storage SDD), notes text, created_at, updated_at. UNIQUE (filing_id, doc_type).
- Función `public.next_dua_code(tenant_id)` → `DUA-VE-YYYY-NNNNNN` (6 dígitos para más rango)
- Trigger: cuando se crea `customs_filing`, auto-insert 7 rows en `customs_documents` (1 por cada doc_type, uploaded=false) para que el checklist exista desde el inicio
- Seed 4 agentes del JSX de referencia (mismo data que `_seniatData.agents`)
- RLS por tenant en filings y documents (agents abierto a authenticated)

#### Lib

- `lib/studio/customs-types.ts`:
  - Types: `CustomsStatus`, `CustomsDocType`, `CustomsAgent`, `CustomsFiling`, `CustomsDocument`, `CustomsFilingRow` (con agent joined + docs count)
  - `CUSTOMS_STATUS_LABELS` / `CUSTOMS_STATUS_TONES` (mismo patrón que VE/CN status badges)
  - `CUSTOMS_DOC_LABELS` (factura comercial, packing list, BL, etc.) + `CUSTOMS_DOC_REQUIRED` (boolean: factura/packing/BL/cert origen/DUA/payment son required, sanitario opcional)
  - `VE_PORT_OPTIONS` (catálogo de los 4 puertos VE: PBL / LGU / MAR / PFI) — hardcoded V1, suficiente para SENIAT
  - Helper `computeFilingDocsProgress(docs)` → `{done, total, pct, missing[]}`
  - `validateFilingInput()` (patrón sin zod del proyecto)
- `lib/studio/customs-queries.ts`:
  - `listFilings(supabase, filters)` — filters: q, port, status (one or array), agent_id. Join con agents + count de documents uploaded
  - `getFilingById(supabase, id)` — full detail con agent + all documents + shipment basic
  - `listAgents(supabase, filters?)` — todos los activos, con stats agregadas
  - `computeCustomsKpis(supabase)` — 4 counts: inProcess (status != liberado), clearedYtd, totalPaid (suma duty+igtf+iva+fee), withAlert (alert != null)
  - `computeTaxBreakdownYtd(supabase)` — 4 totales: duty, igtf, iva, agentFee
  - `listShipmentsEligibleForFiling(supabase)` — shipments con status=in_customs sin filing aún (para el form "Crear trámite")
  - `parseCustomsFiltersFromSearchParams(sp)`

#### Componentes (`app/studio/(app)/seniat/_components/`)

- `CustomsKpis.tsx` (server) — 4 KPI cards reutilizando KpiCard
- `CustomsStatusBadge.tsx` (server, puro) — Badge con tones del enum
- `SeniatClient.tsx` (client orquestador) — manage tabs URL state + filters
- `CustomsFilingsList.tsx` (server, recibe rows) — lista con doc progress bar inline (similar JSX)
- `CustomsAgentsTab.tsx` (server) — grid de cards de agentes read-only
- `CustomsTaxTab.tsx` (server) — resumen YTD con bars proportional
- `CreateFilingDrawer.tsx` (client) — drawer con form mínimo:
  - Select shipment eligible (de los in_customs sin filing)
  - Select agente
  - DUA code (auto-suggest next + permitir override)
  - Port (auto desde shipment.destination matching o select)
  - HS codes input (chips, agregar con Enter)
  - Cost inputs con helpers (Arancel + IGTF 3% + IVA 16% + Fee)
  - Observations textarea
  - Botón submit
- `FilingDetailDrawer.tsx` (client) — drawer con 6 secciones:
  1. Alert banner si filing.alert
  2. **Cost breakdown card ink** (4 CostMini + total)
  3. **Checklist documental** (7 docs con tone success/danger según uploaded + boton "Marcar OK" para togglear, "Subir" disabled con tooltip "próximamente")
  4. **HS codes** badges wine
  5. **Agente aduanal** card con avatar + datos + boton "Llamar" (tel:) y "Email" (mailto:)
  6. **Timeline SENIAT** 6 pasos derivados del status + cleared_at + docs.payment
  - Action footer: "Imprimir DUA" (disabled, soon) + "Contactar agente" (mailto) + "Marcar liberado" (primary, solo si status != liberado y todos required docs OK)
- `CostHelpers.tsx` (client) — sub-componente del CreateFilingDrawer con:
  - Input "Valor mercadería" + botones "Aplicar IGTF 3%" / "Aplicar IVA 16%" que llenan los inputs correspondientes

#### Page

- `app/studio/(app)/seniat/page.tsx` (reemplaza placeholder):
  - Server. Lee searchParams → llama queries en paralelo.
  - Layout: header + CustomsKpis + SeniatClient (con tabs)

#### Server actions

- `app/studio/(app)/seniat/actions.ts`:
  - `createFilingAction(formData)` — valida + insert filing + trigger auto-insertea docs + insert event en shipment_events (status_change a in_customs si no estaba)
  - `updateFilingAction(id, formData)` — edit costos/observations/HS codes/agent
  - `markDocumentUploadedAction(documentId, uploaded boolean)` — toggle del checkbox del checklist
  - `markFilingClearedAction(filingId)` — valida required docs OK → status=liberado + cleared_at=now + sync shipment.status='arrived_destination' + event note
  - `changeFilingStatusAction(filingId, newStatus)` — state machine validation entre estados

### NO incluye (diferidos)

- **Upload real de documentos** (Supabase Storage) → SDD-0018.1
- **Auto-cálculo aranceles desde HS code** (tabla `customs_duty_rates` con tasa por HS) → SDD-0018.2
- **Sync con AES SENIAT** (API real de declaración electrónica) → SDD-0018.3 cuando tengamos integración
- **UI CRUD de agentes** (alta / edición / desactivación) → SDD-0018.4. V1 = mantenimiento via SQL
- **Generación de DUA PDF** → SDD-0018.5
- **Reporte SENIAT exportable** (Excel/PDF para auditoría tributaria) → SDD-0018.6
- **Pago integrado banco** (link BCV/banca privada) → SDD futuro
- **Multi-agente por filing** (caso raro de cambio de agente) → V1 1 agente fijo por filing
- **HS codes auto-link a receipt_items** (CN SDD-0016) → SDD-0018.7. V1 = input manual de HS codes (operario puede copiar/pegar)

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0018-aduana-seniat/
└── spec.md                                              ← este

supabase/migrations/
└── 0010_customs_seniat.sql                              ← 3 tablas + enums + functions + seed

lib/studio/
├── customs-types.ts                                     ← tipos + labels + tones + validate
└── customs-queries.ts                                   ← queries + filters + KPIs

app/studio/(app)/seniat/
├── page.tsx                                             ← reemplaza placeholder
├── actions.ts                                           ← server actions
└── _components/
    ├── SeniatClient.tsx                                 ← client orquestador + tabs
    ├── CustomsKpis.tsx                                  ← 4 KPI cards
    ├── CustomsStatusBadge.tsx                           ← badge wrapper
    ├── CustomsFilingsList.tsx                           ← lista con progress docs
    ├── CustomsAgentsTab.tsx                             ← grid cards agentes
    ├── CustomsTaxTab.tsx                                ← resumen YTD
    ├── CreateFilingDrawer.tsx                           ← form crear trámite
    ├── FilingDetailDrawer.tsx                           ← drawer 6 secciones
    └── CostHelpers.tsx                                  ← helper IVA/IGTF
```

### Editados

```
app/studio/(app)/seniat/page.tsx                         ← era placeholder
docs/design/v1-studio/module-map.md                      ← marcar SENIAT ✅
```

---

## 4. Decisiones de diseño

### 4.1 3 tablas (catálogo + filings + documents)

**Por qué:** ver caso de uso del JSX:
- Operario consulta agente "Aduanas Carabobo CA" en muchos filings → catálogo evita duplicar nombre/RIF/teléfono y permite UI de "trámites de este agente"
- Reportes futuros piden % filings con cada doc completo → tabla `customs_documents` lo permite con un GROUP BY simple
- JSONB en filings sería más simple V1 pero deuda técnica al primer reporte real

Trade-off aceptado: 3 migrations, 3 RLS policies, 3 grant statements vs alternativa más simple. La complejidad se paga 1 vez y se amortiza en cada feature futura.

### 4.2 Lazy create de filings (no auto-trigger)

**Por qué:** trigger DB que auto-crea filing cuando shipment cambia a `in_customs` parece útil pero rompe varios casos:
- Shipment que entró a in_customs por error y se rolea de vuelta → quedó filing huérfano
- Shipments terrestres (transporte_terrestre service) que no pasan por aduana → tendrían filing innecesario
- Sam quiere control sobre cuándo arrancar el papeleo

Lazy create: operario hace click "Crear trámite SENIAT" cuando está listo. El módulo VE (SDD-0017) puede sumar shortcut en su menú "···" → "Iniciar trámite SENIAT" → abre el drawer con shipment pre-seleccionado. (futuro nice-to-have).

### 4.3 Cálculo manual de impuestos con helpers UI

**Por qué:** auto-calc real requiere:
- Tabla de aranceles por HS code (8-dígito mínimo) → no existe
- Tasa cambiaria BCV día — externa
- Valor declarado de mercadería — puede no ser linear (descuentos, fletes incluidos/no, etc.)

V1 honest: operario ya tiene los valores (los calculó con el agente o sale del SENIAT.gob.ve). Solo necesita ingresarlos rápido. Helper UI:
- "Calcular IVA 16% sobre [$X]" → al click llena el campo IVA con X * 0.16
- "Calcular IGTF 3% sobre [$Y]" → idem
- Total = suma de los 4 inputs (no editable, se computa)

### 4.4 Tabla customs_documents con auto-insert al crear filing

**Por qué:** el checklist tiene 7 docs predefinidos. El JSX los muestra TODOS por filing (presentes o ausentes). Si la tabla solo tiene rows cuando uploaded=true, no podemos saber "cuáles faltan".

Solución: trigger inserta los 7 rows automáticamente al crear filing (uploaded=false). UI marca OK / falta. Si futuros docs aparecen (ej. permiso de drones), se agrega valor al enum + trigger los suma para nuevos filings.

### 4.5 V1 sin upload real — botón "Subir" disabled

**Por qué:** Storage requiere bucket + signed URLs + UI uploader + size validation. Es 1 SDD entero (SDD-0018.1).

Mientras tanto:
- "Marcar OK" (toggle uploaded boolean): el operario confirma que el doc físico/escaneado existe en otro sistema (Drive, email, etc.). UI tiene checkbox simple.
- "Subir" (action que requiere Storage): button disabled con tooltip "próximamente · SDD-0018.1"

Es honest: el módulo trackea el ESTADO del doc, no almacena el doc. Cuando Storage llegue, se enchufa sin refactor del modelo.

### 4.6 Status SENIAT separado del shipment.status

**Por qué:** semántica diferente:
- `shipment.status = in_customs` significa "el shipment está siendo procesado en aduana" (alto nivel)
- `customs_filing.status` es el sub-estado del trámite específico: `en_revision` / `observacion` / `liberacion` / `pagado` / `liberado`

Cuando `customs_filing.status` pasa a `liberado` (todos pagos y firmas OK), la action `markFilingClearedAction` también cambia `shipment.status` → `arrived_destination` (consistente con SDD-0017 VE que asume liberación cuando arriba a "Listo retiro").

### 4.7 Timeline derivada del status + flags (no tabla events nueva)

**Por qué:** los 6 pasos del timeline del JSX son determinísticos:
1. Arribo a puerto — flag desde `arrived_at`
2. DUA presentada — siempre done si filing existe
3. Revisión documental — done si status != observacion
4. Inspección física — done si status IN (liberacion, liberado)
5. Pago aranceles — done si docs.payment.uploaded=true
6. Liberación — done si status = liberado

No requiere tabla `customs_events` con un row por evento. Si futuros pasos no-determinísticos aparecen (ej. nota del inspector), se agrega tabla. V1 con derivación funciona.

### 4.8 4 Puertos VE hardcoded

**Por qué:** PBL/LGU/MAR/PFI son los principales puertos de VE. Catálogo formal en tabla → over-engineering V1. Constante en TS suficiente. Cuando se agreguen Guanta, La Ceiba, etc., 1 línea más.

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/seniat` muestra 4 KPIs + 4 tabs
- [ ] Tab "Cola activa" lista filings con status != liberado, fila con doc progress bar
- [ ] Tab "Liberados" lista filings con status = liberado
- [ ] Tab "Agentes" muestra cards read-only de los 4 agentes seeded
- [ ] Tab "Aranceles" muestra YTD breakdown con bars proportional
- [ ] Click en row de filing → abre FilingDetailDrawer con 6 secciones del JSX
- [ ] "+ Nuevo trámite" abre CreateFilingDrawer con select de shipments eligibles (in_customs sin filing existente)
- [ ] Crear filing genera 7 rows en customs_documents automáticamente (trigger)
- [ ] DUA code se auto-genera DUA-VE-YYYY-NNNNNN
- [ ] Helpers IVA/IGTF en CreateFilingDrawer llenan correctamente los campos
- [ ] Marcar OK en checklist toggle el doc uploaded boolean
- [ ] "Marcar liberado" valida que required docs estén OK → cambia status + sync shipment + cleared_at
- [ ] Alert banner aparece en drawer cuando filing.alert no es null
- [ ] Timeline muestra checkmarks según status real (no hardcoded)

### Sistema

- [ ] `pnpm typecheck` pasa
- [ ] Migration 0010 corre limpia
- [ ] RLS funciona en filings/documents (agents abierto a authenticated)
- [ ] Trigger de auto-insert documents funciona al crear filing
- [ ] Sidebar marca "Aduana SENIAT" como active
- [ ] Light + dark themes OK
- [ ] Componentes pasan ui-ux-designer review

---

## 6. Out of scope / open questions

### Out V1 (ya cubierto en sección 2)

Upload real, auto-calc aranceles HS, sync AES, UI CRUD agentes, DUA PDF,
reporte exportable, pago banco, multi-agente, HS auto-link receipts.

### Open questions resueltas

- ✅ **Schema** → 3 tablas
- ✅ **Lazy create** vs auto-trigger → lazy con botón
- ✅ **Cálculo impuestos** → manual + helpers UI
- ✅ **Checklist docs** → tabla con auto-insert al crear filing

### Open questions diferidas

- **¿Multiple HS codes por filing pueden tener tasas distintas?** Sí en realidad. V1 calcula 1 totalDuty global. Cuando llegue auto-calc (SDD-0018.2), se desglosa por HS code.
- **¿"Reporte SENIAT" del header debe ser PDF / Excel?** V1 botón visible disabled. Cuando llegue SDD-0018.6, se decide formato según necesidad operativa.
- **¿"Imprimir DUA" debería generar PDF estilo SENIAT oficial?** Sí. Out V1 (PDF rendering library = otra dependency). SDD-0018.5.
- **¿Soft-delete de filings?** V1 schema tiene `deleted_at` pero UI no expone delete. Para errores graves, SQL manual.
