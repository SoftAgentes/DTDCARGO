# Embudo de ventas — DTD Cargo (diseño operativo + mapa de etapas MARKBOX)

> **Qué es:** el embudo comercial simple que sostiene el norte de [`ventas.md`](ventas.md) (**2 contenedores/mes**
> vía mayoristas recurrentes + aliados white-label) y el **mapa de etapas** que alimenta la config de
> SDD-0084 (`kommo_connections.stage_map`). El *por qué* y el perfil objetivo están en [`ventas.md`](ventas.md) /
> [`estrategia.md`](estrategia.md).
>
> **Método (2026-06-15):** análisis triangulado por 3 voces independientes (2 agentes de análisis + Codex
> gpt-5.5) sobre el embudo **real** de prod. Convergieron; Codex afinó de 6 → **5 etapas**. Esto es la
> recomendación sintetizada, lista para configurar.
>
> **Importante:** reestructurar el embudo en Kommo es **configuración (vía navegador), no código.** El código
> que lo ACTIVA (write-back de etapa/valor/MARKBOX) ya existe (SDD-0083/0084/0086, hoy dormido — ver
> [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md)).

## 1. Qué tenemos hoy

**Servicios (4 productos + add-ons).** Puerta a Puerta **DDP** (principal: DTD compra, consolida, embarca,
nacionaliza a su nombre y entrega; el cliente "paga al llegar") · **LCL consolidado** (BL propio) · **FCL en
bodega** · **FCL directo de fábrica**. Add-ons: compra asistida/sourcing, validación de proveedores,
verificación de mercancía, visa China.

**Pipeline operacional del ERP (la fuente de verdad):**
`Lead → Cliente (id = MARKBOX, DTD-NNNN) → Estimado (draft → sent → accepted/rejected → convertir) →
Embarque (in_warehouse_cn → in_transit → in_port_ve → customs_clearance → delivered)`.

**Embudo real en Kommo hoy (leído de prod):** un **cementerio**, no un embudo.
- **11 embudos** (sprawl). El principal "Embudo de ventas" tiene **3 etapas reales**: Incoming(0) → **Atención al
  cliente (2.118 atascados)** → asesoría personalizada(36) → won(0)/lost(2).
- Un **"Embudo Carga"** que mete OPERACIONES en el CRM (trae próximamente → carga en china → carga en camino →
  proceso de despacho) — eso ya es el `Shipment` del ERP.
- 8 embudos más de servicios/ruido: Compra asistida(231), Cursos(95), Validación proveedores, Verificación
  mercancía, VISA China, "Sam", Investigación productos, Ofidoc.
- **Diagnóstico:** 86% de leads >180 días sin moverse (mediana **349 días**); **valor $0 en el 100%** (Kommo
  ciego al dinero que ya vive en `estimado.total_usd`); conversión **0,04%**; solo **5,5% con email**; **99,9%
  de leads en 1 solo asesor**.

**La causa raíz:** el embudo mezcla 3 cosas que no deben convivir — **calificar prospectos**, **mover una
cotización** y **trackear carga física**. Lo último ya lo hace el ERP. El embudo de ventas solo debe responder:
*¿esta persona va a comprar, ya compró, y va a recomprar?*

## 2. El embudo simple recomendado — 5 etapas ⭐

Un **único** embudo de ventas. Es un **círculo** (la recompra), no una línea. Las etapas son de VENTA, no de
logística. **AUTO** = la mueve sola el write-back del ERP (SDD-0084); **manual** = la mueve el asesor.

| # | Etapa | Qué significa | Entra cuando… | Avanza / sale cuando… | Mov. |
|---|---|---|---|---|---|
| 1 | **Nuevo** | Lead crudo, sin filtrar (bandeja de entrada). | Mensaje WhatsApp CRM, form `/contacto` o `/cotizar`, o referido de aliado. | El asesor lo califica (→2) o lo descarta como ruido. **SLA 2 días.** | manual |
| 2 | **Calificado** | Confirmado **mayorista recurrente o aliado** (no comprador puntual). Acá se llenan Tipo comercial + Volumen + Cadencia. | El asesor confirma perfil + producto + volumen aprox. | Se arma y **envía** el estimado (el ERP lo salta solo a →3). **SLA 5 días.** | manual |
| 3 | **Cotización enviada** | Hay una **cotización real con monto** sobre la mesa (fin de la ceguera del $0). | `estimado.status = sent` → el `total_usd` se escribe como **valor del lead**. | Acepta (→4) · Rechaza (→5) · 14 días sin respuesta → auto-perdido. **SLA 7 días.** | **AUTO** |
| 4 | **Cliente activo / Recompra** | El motor del negocio. Aceptó → nace MARKBOX + 1er embarque, y queda como **relación activa** en ventana de recompra (30/45 días). | `estimado.status = accepted` (→ convertir → MARKBOX + Shipment). | **Recompra:** se abre un nuevo estimado sobre la MISMA tarjeta → vuelve a pasar por 3→4. **No tiene SLA de estancamiento**: se rige por la fecha de recompra. | **AUTO** |
| 5 | **Perdido** ⛔ | Terminal. Sale del pipeline activo (no se pudre en "Atención al cliente"). | `estimado.status = rejected`, o auto-perdido por SLA. | — (con **Motivo de pérdida** obligatorio). | **AUTO** + SLA |

**Por qué 5 y no 6 (lo que afinó Codex):** se cortaron 2 etapas que duplicaban el ERP. **"En cotización"
(draft)** no va: el borrador vive en el ERP; la tarjeta se queda en *Calificado* hasta que se ENVÍA. **"Ganado /
primer pedido"** no es una etapa aparte: al aceptar, el cliente ya es **activo** — el pedido físico lo trackea
el `Shipment`, no Kommo. Kommo debe mostrar *"qué tengo que vender o reactivar"*, no espejar estados del ERP.
*(Trade-off honesto: pierdes una columna explícita de "recién ganado / onboarding del 1er embarque". Para 1
asesor sobra; si algún día hay un rol de Customer Success, se parte la etapa 4 en "Ganado" + "Recurrente".)*

## 3. Campos de la tarjeta (Kanban)

Pocos y duros. Cada uno tapa un agujero medido hoy. **AUTO** = lo llena el ERP; el resto, disciplina del asesor.

**Imprescindibles:**

| Campo | Por qué | Cómo se llena |
|---|---|---|
| **Responsable** | Hoy 99,9% en 1 asesor; sin dueño no hay accountability ni reparto. | nativo Kommo |
| **Valor USD** | Hoy $0 en el 100%. Sin valor no hay forecast ni prioridad. | **AUTO** `estimado.total_usd → price` (SDD-0083) |
| **Tipo comercial** ⭐ | El norte son **mayoristas + aliados**. Separa quién entra al ciclo de recompra de quién es one-shot. Es tu scoring A/B/C. | manual · lista: `Mayorista recurrente` / `Aliado white-label` / `No-fit` |
| **Cadencia esperada** ⭐ | El reloj de la recompra (el corazón del negocio). | manual · `30` / `45` / `60` días |
| **Volumen estimado** ⭐ | Para 2 contenedores/mes, **el volumen importa más que la cantidad de leads.** | manual · CBM o nº de contenedores |
| **Producto** | DDP/LCL/FCL tienen ciclo y margen distintos. | manual · lista de los 4 |
| **MARKBOX** | La llave Kommo↔ERP; sin ella el cliente ganado queda huérfano para la recompra. | **AUTO** al convertir (SDD-0086) |
| **Canal de origen** | Hoy 0 atribución → no sabes qué inversión trae a los que cierran (Ads está pausado, decisión inminente). | manual · `WhatsApp` / `Web` / `Referido` / `Aliado` |

**No son campos:**
- **Próximo paso + fecha** = una **tarea** obligatoria de Kommo, no un campo. **Regla dura: ninguna tarjeta sin
  tarea abierta** (es el antídoto #1 contra el cementerio).
- **Días sin moverse** = lo **calcula** Kommo (reporting/SLA), no se escribe.
- **Motivo de pérdida** = obligatorio **solo** en *Perdido* (precio / tiempo / no responde / compró a otro). Es
  la inteligencia que hoy no existe y explica la conversión 0,04%.

> **Email NO es requisito para calificar.** El 94,5% no tiene email; el canal real es WhatsApp. El email
> importa solo para **reactivar el cementerio** (los muertos >180d a los que ya no alcanzas por WhatsApp) — esa
> es otra pista (SDD-0082 captura de email), no el embudo vivo.

## 4. El mapa de etapas de MARKBOX (config de SDD-0084)

El write-back ERP→Kommo dispara en **3 transiciones** del estimado, cada una a **una** etapa. Estas 3 filas son
exactamente lo que se carga en `/studio/kommo → Dirección → "Mapa de etapas"`:

```
sent      →  "Cotización enviada"          (etapa 3)
accepted  →  "Cliente activo / Recompra"   (etapa 4)   ← el lead se vuelve cliente activo
rejected  →  "Perdido"                      (etapa 5)   ← LIMPIA EL CEMENTERIO de aquí en adelante
```

- La fila **`rejected → Perdido`** es la que evita el cementerio futuro: rechazar el estimado saca la tarjeta
  del flujo activo automáticamente. En Kommo, *Perdido* debe estar marcada como etapa de **cierre/perdido** (no
  como etapa abierta) para que salga del conteo de pipeline activo.
- **Las 2.118 tarjetas viejas NO las arregla el mapa** (solo actúa sobre estimados nuevos). Esas se limpian
  **una vez**, a mano/bulk: las que tengan >180d sin tarea y sin estimado vivo → *Perdido*, motivo "depuración
  inicial". Es saneamiento puntual, no parte del flujo.

## 5. SLA + el loop de recompra

**SLA (pocas reglas, días = sin movimiento):** Nuevo **2d** · Calificado **5d** · Cotización enviada **7d**
(→ a los **14d**, auto-perdido "no responde"). Etapas 4 y 5 sin SLA de estancamiento. **Seguro global:** tarjeta
abierta sin tarea pendiente = bandera roja.

**Recompra (sin embudo aparte):** la tarjeta = **la relación comercial**, no el pedido. Cada pedido vive como
estimado/embarque en el ERP (no ensucia la tarjeta). Al aceptar → cae en *Cliente activo* + **tarea fechada a
+30/45d**. Al vencer la tarea, el asesor reactiva: abre un nuevo estimado sobre la MISMA tarjeta → `sent`/
`accepted` la mueven solas. **"Clientes con recompra vencida" = tu fuga #1**, y es justo la cola de reactivación
que hay que mirar (no un lead frío). *No* hagas un embudo de retención aparte hoy (1 asesor): se justifica solo
con un equipo de Customer Success dedicado.

## 6. Limpieza del sprawl: de 11 embudos → 1

**Principio:** un embudo = una pregunta de negocio con dueño y métrica. Los servicios **no son embudos**, son un
**campo "Producto/interés"** dentro del embudo único.

| Embudo actual | Acción | Por qué |
|---|---|---|
| **Embudo de ventas** (3 etapas) | ⭐ **REFUNDAR** como el único (5 etapas) | Es el tronco; el cuello de 2.118 se vacía recalificando. |
| **Embudo Carga** | **ARCHIVAR** | Es el `Shipment` del ERP (operaciones, no venta). |
| Compra asistida / Validación / Verificación / VISA / Investigación / Ofidoc | **FUSIONAR** → campo "Producto/interés" | Add-ons del servicio, no pipelines de venta. |
| **Cursos** | **SACAR del cómputo comercial** (embudo aparte no-comercial, o archivar) | No es el negocio núcleo (2 cont./mes). Ensucia la conversión. |
| **"Sam"** | **ARCHIVAR** | Embudo-persona = anti-patrón. La asignación va en "Responsable"; el reparto del 99,9% se hace por owner, no creando embudos. |

## 7. El KPI correcto: volumen, no conversión

La meta **no** es "% de conversión" (hoy 0,04% es basura estadística porque mezcla cursos, visas y carga). La
meta es **pipeline de VOLUMEN suficiente para llenar 2 contenedores/mes.** Tablero mínimo (varias de estas ya
las calcula el de SDD-0078; falta sumarle volumen/CBM y recompra-vencida):
- USD cotizado (en *Cotización enviada*) · USD aceptado.
- **CBM/contenedores estimados en pipeline** (¿alcanza para 2/mes?).
- Clientes en ventana de recompra (30/45d) · **clientes con recompra vencida** (fuga).
- Aliados white-label activos.

## 8. Cómo se conecta con lo ya construido + qué decide el founder

**Ya existe (código):** tablero de salud (SDD-0078, live) · write-back de **valor** (SDD-0083), **etapa**
(SDD-0084) y **MARKBOX** (SDD-0086) — los 3 **dormidos** hasta deploy + flip · espejo de **nombres de asesor**
(SDD-0087, en rama). El cómo encenderlos: [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md).

**Decisiones / config del founder (en Kommo, vía navegador — no código):**
1. **Refundar el embudo** a las 5 etapas; archivar *Embudo Carga* + *Sam*; sacar *Cursos*; fusionar los embudos
   de servicios en el campo "Producto".
2. **Crear los custom fields** de la tarjeta: Tipo comercial, Cadencia esperada, Volumen estimado, Canal de
   origen, Motivo de pérdida. *(MARKBOX y Valor los llena el ERP; ver SDD-0086/0083.)*
3. **Limpieza única del cementerio** (2.118 → recalificar o cerrar "depuración inicial").
4. **Repartir la cartera** del único asesor (round-robin / owner en Kommo).
5. **Cargar el `stage_map`** de la sección 4 en `/studio/kommo → Dirección` y **activar** el write-back (runbook).

## Apéndice — las 3 voces

- **Voz A (análisis de ventas):** embudo como círculo de recompra; separar ventas de operaciones; 11→1.
- **Voz B (RevOps):** campos de tarjeta + el `stage_map` de 3 filas + SLA; recompra = misma tarjeta.
- **Voz C (Codex gpt-5.5, challenge):** cortar a **5 etapas** (fuera "En cotización" y "Ganado"); elevar **Tipo
  comercial + Cadencia + Volumen** a imprescindibles; email no es gate (canal = WhatsApp); el KPI es volumen, no
  conversión; *"sin Tipo comercial + Cadencia + tarea, tendrás un cementerio más ordenado, no un sistema de
  recompra."*
