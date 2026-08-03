# Runbook — Consolidar Kommo en UN embudo único ("DTD — Ventas")

> Colapsar los **12 embudos** actuales de Kommo en **uno solo** + un campo "Tipo de servicio".
> Operación sobre el **CRM vivo (2.877 leads reales)** → mover/borrar es **destructivo**: se ejecuta
> con el founder delante, paso a paso, NUNCA desatendida.
>
> Cuenta: `https://dtdcargo.kommo.com`. Diseñado para **1-2 personas** operando el CRM.
> Estado y decisiones: **2026-08-03** (reemplaza el plan del 2026-06-29, que quedó a medias).

## Estado real (espejo Supabase, sync 2026-08-03 07:00 UTC)

| Embudo | id | Leads | Principal |
|---|---|---|---|
| Embudo de ventas | 7225379 | **2.277** | no |
| Embudo Carga | 8690912 | 240 | no |
| Compra asistida | 8691440 | 232 | no |
| Cursos | 8699404 | 95 | no |
| Verificación de mercancía | 8699388 | 15 | no |
| Validación de proveedores | 8691468 | 13 | no |
| VISA China | 11074568 | 5 | no |
| **Prueba** | **14036567** | **0** | ✅ **sí** |
| Atencion a leeds | 13967120 | 0 | no |
| Sam · Carga China VZLA Ofidoc · Investigación productos | 10079836 · 11074572 · 11337468 | 0 | no |

### Los 4 hallazgos que justifican el cambio

1. **Los leads no llegan al ERP.** De los que aceptaron, 290 de 291 (90 días) cayeron en
   `Embudo de ventas → Atencion al cliente`; el principal ("Prueba") está vacío. Pero el problema mayor
   es que **la mayoría ni se acepta**: quedan en la bandeja de chat, invisibles para el ERP (ver Fase 0).
   **Arreglar el embudo sin arreglar por dónde entran no resuelve nada.**
2. **El embudo único ya se construyó dos veces y ninguna se usó:** "Atencion a leeds" (29-jun) y
   "Prueba". Ambos vacíos. No hay que crear nada.
3. **Cementerio:** 2.562 leads fríos (>90 d) = 89%. 2.239 muertos (>1 año) = 78%. Solo 16 tocados en
   30 días. **5 cerrados de 2.877** (0,17%). **0 leads con monto** → el CRM no dice cuánto vale el pipeline.
4. **Los 7 embudos de servicio son un campo, no embudos** — todos tienen las mismas etapas de venta.

## Decisiones tomadas (founder, 2026-08-03)

- **Embudo base:** reusar **"Prueba" (14036567)** → renombrar a **"DTD — Ventas"**. Ya es el principal.
- **Leads con +90 días → PERDIDO**, motivo `limpieza 2026-08`. No se borran: siguen buscables.
- **Excepción Embudo Carga (240) → GANADO.** Compraron; marcarlos perdidos falsea la conversión.
- **Los 291 vivos** se dividen por **conversación previa**, no por días (las dos cohortes promedian
  55 días — el corte por tiempo no separa nada).
- **Etapa `Recontacto` en posición 3** como *puerta de entrada* que se vacía, **no** una etapa
  "Cliente" donde reposen los tratos.
- **GANADO = registrado** (Shipping Mark emitido). Kommo mide conversión; el ERP mide el dinero.

## El target — "DTD — Ventas", 5 columnas + 2 cierres

```
1 Leads entrantes ──┐
2 Contacto inicial ─┤
                    ├──→ 4 Estimado enviado → 5 Negociación → 🟩 GANADO / 🟥 PERDIDO
3 RECONTACTO ───────┘          ↑ el ERP escribe aquí
      ↑ el cliente conocido entra acá, saltándose 1 y 2
```

| # | Etapa | Regla de una línea | id actual en "Prueba" |
|---|---|---|---|
| 1 | **Leads entrantes** (entrante, `type=1`) | Cayó, nadie lo tocó | 108343827 |
| 2 | **Contacto inicial** | Ya le escribiste, esperas respuesta | 108343831 |
| 3 | **Recontacto** | Cliente con Shipping Mark que volvió | **crear** |
| 4 | **Estimado enviado** | Le pasaste números. *El ERP mueve aquí solo* | 108343839 ⚠️ hoy se llama "Tomar decisión" y va **después** de Negociación |
| 5 | **Negociación** | Discute precio o condiciones | 108343835 ⚠️ hoy va **antes** |
| ✅ | **GANADO** | **= registrado.** Shipping Mark emitido → sigue en el ERP | 142 |
| ❌ | **PERDIDO** | Dijo que no, o murió | 143 |

⚠️ **En "Prueba" el orden está invertido**: hoy es `Negociación (30) → Tomar decisión (40)`. Hay que
dejar **Estimado enviado antes de Negociación** para que calce con el flujo del ERP (estimado → cotización).

⚠️ **La regla que mantiene sana la etapa 3:** Recontacto **se vacía**. Si se acumulan tratos ahí, se
volvió un cuarto — es exactamente como nació el cementerio de 2.237.

**Los dos caminos de registro caben sin etapa nueva:** *(a)* solo se registra → salta de la 2 (o la 3)
**directo a GANADO**; *(b)* camino largo → 4 → 5 → GANADO.

**Campos nuevos:** **"Tipo de servicio"** (lista): `Carga · Compra asistida · Cursos · Verificación de
mercancía · Validación de proveedores · Visa China · Otro` — reemplaza los 7 embudos.
**"Tipo de trato"** (lista): `Nuevo · Recompra`.

**Lo que NO va en Kommo:** el seguimiento de carga (*trae próximamente / carga en china / en camino* —
239 leads del Embudo Carga). Eso vive en el Studio. Kommo termina en GANADO.

## Ejecución (orden seguro — no destructivo primero)

> **Regla de oro:** nunca borrar un embudo con leads adentro (Kommo los orfana). Vaciar → verificar 0 → borrar.

### Fase 0 · ✅ RESUELTA (2026-08-03) — la captación NO se detuvo: el ERP está ciego

> ⚠️ **Corrección.** Una versión anterior de este runbook afirmaba que *"la captación se detuvo"*.
> **Era falso.** Los leads entran todo el día; lo que pasa es que **no llegan al ERP**.

**Prueba (captura del Inbox de chat, 2026-08-03):** de 11 leads visibles con actividad de hoy,
**8 no existen en el espejo**. Los 3 que sí están (23276339, 23275787, 23271529) fueron creados el
29-30 jul y viven en *Embudo de ventas* — alguien los aceptó. Los otros 8 nunca se aceptaron.

**Confirmación por el otro lado:** `sync_logs` reporta `ok` todos los días con **exactamente 2.877
leads**, congelado desde el 30-jul, mientras `contacts` sí crece (3.034 → 3.041). El sync funciona;
lo que no ve es la bandeja.

**Causa:** los leads de WhatsApp/formularios caen en la bandeja de entrada y **`/api/v4/leads` no los
devuelve** hasta que alguien los acepta. El sync sólo consulta ese endpoint (`unsorted` no aparece en
ningún archivo del repo).

**🔴 Estado operativo al momento de medir: 626 conversaciones sin leer · 3.304 chats abiertos**
contra 2.877 leads en el espejo. El bot responde el saludo automático, pero nadie retoma.

**Consecuencias para este plan:**

1. La **Fase 2 (redirigir la captación) sube a máxima prioridad**: no es cosmética, es lo que hace que
   los leads existan para el ERP. Es exactamente lo que pidió el founder desde el inicio — *"que no
   entren a la sección general de leads, sino directo al embudo"*.
2. **Sumar `/api/v4/leads/unsorted` al sync deja de ser "punto ciego" y pasa a ser deuda crítica**:
   mientras no esté, el ERP mide sobre una fracción del embudo. Spec aparte.
3. Antes de confiar en cualquier conteo de este runbook, recordar que **el espejo subestima**: los
   2.877 son sólo los leads aceptados.

### Fase 1 · Preparar (sin riesgo, embudos vacíos)

- [ ] **1.** Renombrar "Prueba" → **"DTD — Ventas"**. `Leads → Configurar embudos`.
- [ ] **2.** Ajustar etapas: renombrar `Tomar decisión` → **Estimado enviado** y moverla **antes** de
      Negociación. Confirmar que **Leads entrantes** sigue marcada como etapa entrante.
- [ ] **3.** **Crear la etapa `Recontacto`** en posición 3, entre Contacto inicial y Estimado enviado.
- [ ] **4.** Crear campo **"Tipo de servicio"** (Lista, 7 opciones) y **"Tipo de trato"**
      (Lista: `Nuevo · Recompra`). `Leads → Configurar → Campos → + Añadir campo`.
- [ ] **5.** Crear etiqueta **`Cliente`** para contactos + campo **"Shipping Mark" en CONTACTOS**
      (hoy sólo existe en leads, id 1570535 — y el lead se cierra y se lleva la marca).
- [ ] **6.** Montar la alerta: disparador *"conversación iniciada por mensaje entrante"* → 🔔 notificar.
      *(El enrutado a Recontacto lo hace el ERP, no Salesbot — ver §Enrutado automático.)*

### Fase 1b · Vincular a los clientes que ya existen (backfill) — código

> Requiere SDD propio. Sin esto el enrutador falla en silencio.

- [ ] **7.** ~~Rellenar `clients.phone` en los 186 clientes sin teléfono~~ → ❌ **DESCARTADO, medido
      2026-08-03.** De los 186 sólo 77 tienen email y **apenas 8** son recuperables desde Kommo;
      desde `persons` (vía `legacy_client_id`) son **0**. Ese teléfono no existe en el ERP.
      **En su lugar: auto-sanado al contacto** — cuando escriba alguien no reconocido y el asesor lo
      vincule a su cliente, el ERP guarda el teléfono y el `kommo_contact_id` en ese momento.
- [ ] **8.** Migración: columna **`kommo_contact_id` en `clients`** (+ índice).
- [ ] **9.** Cruzar los 428 clientes contra los 3.041 contactos de Kommo por teléfono **una sola vez**
      y guardar el `kommo_contact_id`. Reusar `phonesMatch` de `lib/studio/estimado-linking.ts`.
- [ ] **10.** Al convertir lead→cliente (SDD-0058), guardar el `kommo_contact_id` desde
      `_embedded.contacts` → de ahí en adelante, cobertura 100% sin cruces.
- [ ] **11.** Escribir en el **contacto** de Kommo: etiqueta `Cliente` + Shipping Mark.
- [ ] **12.** Invitar al portal a los **292 clientes con email** (sólo 50 de 428 lo tienen hoy).

### Fase 2 · 🔧 Redirigir la captación — *el paso que resuelve el dolor*

- [ ] **13.** Revisar cada fuente y apuntarla a **DTD — Ventas → Leads entrantes**: WhatsApp, formularios
      web, chat del sitio, Facebook/Instagram, y cualquier integración que cree leads.
      `Ajustes → Comunicaciones / Fuentes` + `Leads entrantes`.
- [ ] **14.** Verificar con un lead de prueba real que cae en DTD — Ventas y no en Embudo de ventas.

### Fase 3 · Vaciar embudos, uno a la vez (de menor a mayor)

Para cada uno: abrir → seleccionar todos → editar en lote → setear **Tipo de servicio** → mover a
**DTD — Ventas** en la etapa destino → **verificar que quede en 0**.

> ⭐ **Los 6 embudos secundarios están 100% vencidos** (todos sus leads tienen +90 días) → se
> seleccionan completos y se mueven de un golpe, **sin triage lead por lead**. Los únicos 291 leads
> vivos están todos en Embudo de ventas.

- [ ] **15.** VISA China (5) → `Visa China` → **4 a PERDIDO · 1 a Leads entrantes**
- [ ] **16.** Validación de proveedores (13) → `Validación de proveedores` → **PERDIDO**
- [ ] **17.** Verificación de mercancía (15) → `Verificación de mercancía` → **PERDIDO**
- [ ] **18.** Cursos (95) → `Cursos` → **PERDIDO**
- [ ] **19.** Compra asistida (232) → `Compra asistida` → **PERDIDO**
- [ ] **20.** Embudo Carga (240) → `Carga` → **GANADO** *(compraron: son cierres, no pérdidas. El
       detalle logístico lo lleva el ERP)*
- [ ] **21.** Embudo de ventas (2.277), en **tres tandas** — filtrar por **fecha de creación**:
       - creados hace **+90 días** (1.987) → **PERDIDO**, motivo `limpieza 2026-08`
       - de los 290 restantes: **169 con movimiento → Contacto inicial** · **121 sin tocar → Leads entrantes**
       - ⚠️ el criterio "modificado después de creado" **no es un filtro nativo de Kommo**. Si no se
         puede filtrar: mover los 291 juntos a Leads entrantes y trabajar los 169 como worklist de
         prioridad desde el espejo (patrón de tandas de SDD-0157).

**Reparto final esperado:** PERDIDO 2.346 · GANADO 240 · Contacto inicial 169 · Leads entrantes 122
(suma 2.877 ✅).

### Fase 4 · Borrar lo vacío

- [ ] **22.** Borrar los 6 embudos ya vaciados **solo tras verificar 0**.
- [ ] **23.** Borrar los que ya están vacíos hoy: Sam (10079836), Carga China VZLA Ofidoc (11074572),
       Investigación productos (11337468), **Atencion a leeds (13967120)**.

### Fase 5 · Re-mapear el ERP — ⚠️ OBLIGATORIO

**Hoy el `stage_map` apunta al embudo equivocado** (`Atencion a leeds`, 13967120), que va a ser borrado:

```json
{"sent":     {"pipeline_id": 13967120, "status_id": 107792068},
 "accepted": {"pipeline_id": 13967120, "status_id": 142},
 "rejected": {"pipeline_id": 13967120, "status_id": 143}}
```

- [ ] **24.** Forzar sync en `/studio/kommo` (o esperar el cron 07:00 UTC) para que el espejo traiga
       los nombres/IDs nuevos.
- [ ] **25.** `/studio/kommo → Dirección → Mapa de etapas`: re-mapear a **DTD — Ventas (14036567)** —
       `enviado → Estimado enviado` · `aceptado → GANADO (142)` · `rechazado → PERDIDO (143)`.
- [ ] **26.** Confirmar el campo **Shipping Mark** (id 1570535) en `Dirección → MARKBOX en Kommo`.

## Enrutado automático a Recontacto — lo hace el ERP, no Salesbot

Cuando un cliente vuelve a escribir, su trato debe caer en **Recontacto** con su Shipping Mark al lado.
**No hace falta Salesbot**: el ERP es quien sabe quién es cliente, y todas las piezas ya existen.

| Pieza | Dónde | Estado |
|---|---|---|
| Webhook `leads[add]` | `supabase/functions/kommo-webhook/` | ✅ desplegado |
| Mover de etapa (`patch_stage`) | `enqueueKommoStageWriteback` · `lib/studio/kommo-writeback.ts` | ✅ |
| Escribir Shipping Mark (`patch_lead`) | `enqueueKommoMarkboxWriteback` · mismo archivo | ✅ |
| Cruce por teléfono | `phonesMatch` · `lib/studio/estimado-linking.ts` | ✅ |

**Flujo:** cliente escribe → Kommo crea el trato → webhook avisa al ERP → el ERP resuelve el contacto
contra `clients` → encola *mover a Recontacto + estampar Shipping Mark + marcar Recompra*.

### Cobertura real del enrutador (medido 2026-08-03)

| Grupo | Clientes | Altas | Con portal | ¿Ruteable? |
|---|---|---|---|---|
| **Con teléfono** | **243** | 24-may → **hoy** | **51** | ✅ sí |
| Sin teléfono (base heredada) | 186 | 24-may → **12-jun**, y paró | **0** | ❌ no |

**El 57% de cobertura no es el problema que parece:** los 186 sin teléfono son el bloque de la base
heredada que se importó — se cortan en seco el 12-jun y **ninguno tiene portal**. Los 243 ruteables
son los clientes vivos: llegan hasta hoy e incluyen los 51 con portal activo.

**Para los 186 no se hace backfill** (no hay de dónde sacar el teléfono). Se **auto-sanan al contacto**:
la primera vez que uno escriba y el asesor lo vincule, el ERP guarda su teléfono y `kommo_contact_id`.

⚠️ **Límite técnico:** `findKommoContactsByPhone` sólo revisa los **500 contactos más recientes** de
3.041 y el propio código advierte *"es una ayuda, no una garantía"* → **no sirve como enrutador**.
Por eso la Fase 1b guarda `kommo_contact_id` una vez y después se busca por id indexado.

⚠️ **Duda sin verificar** (sin acceso a Kommo): si una *condición* de Salesbot puede leer un campo del
**contacto**. Las documentadas son a nivel lead. Por eso el enrutado va por el ERP y Salesbot queda
sólo para la alerta — así la duda no bloquea nada.

## Seguridad y rollback

- **El write-back está en `dry_run=true`** (con `writeback_enabled=true`): el ERP **loguea pero no
  escribe** en Kommo. Es la ventana ideal para reestructurar. La outbox está en **0 pendientes** →
  no hay escrituras encoladas esperando salir hacia etapas muertas.
- ⚠️ **No apagar `dry_run` hasta terminar la Fase 5.** Si se apaga antes, el ERP escribe hacia etapas
  de un embudo borrado.
- **Rollback:** Kommo guarda el historial de embudo/etapa de cada lead. Un movimiento en lote mal hecho
  se revierte seleccionando los leads y moviéndolos de vuelta. Por eso: **un embudo a la vez**, y
  verificar el conteo **antes** de borrar nada.
- **No borrar nada** hasta que el embudo nuevo esté poblado y el ERP re-mapeado y verificado en dry-run.
- ⚠️ **No tocar la "Clave secreta"** de la integración de Kommo: regenerarla invalida el token de larga
  duración y tumba el sync (ver `activar-crm-kommo.md`).

## Verificación final (query del espejo, tras el sync)

**1. Un solo embudo, con el reparto correcto por etapa:**

```sql
select p.name, p.is_main, s.name as etapa, count(l.id) as leads
from kommo_pipelines p
left join kommo_statuses s on s.pipeline_id = p.id and s.tenant_id = p.tenant_id
left join kommo_leads l on l.status_id = s.id and l.pipeline_id = p.id and l.tenant_id = p.tenant_id
group by p.name, p.is_main, s.name, s.sort order by p.name, s.sort;
```
Esperado: **un solo embudo** ("DTD — Ventas", `is_main=true`) con
PERDIDO 2.346 · GANADO 240 · Contacto inicial 169 · Leads entrantes 122.

**2. Que la captación revivió** — el indicador que de verdad importa:

```sql
select date_trunc('week', kommo_created_at)::date as semana, count(*)
from kommo_leads where kommo_created_at > now() - interval '30 days'
group by 1 order by 1;
```
Esperado: leads entrando otra vez. Si sigue en 0, la Fase 2 no funcionó.

**3. Que Recontacto se vacía** — correr semanalmente. Si crece, se volvió un cuarto:

```sql
select count(*) from kommo_leads l
join kommo_statuses s on s.id = l.status_id and s.pipeline_id = l.pipeline_id
where s.name = 'Recontacto' and l.kommo_updated_at < now() - interval '3 days';
```
Esperado: **0**.

## Nota de ejecución

Las Fases 0-4 son configuración en la interfaz de Kommo → **las ejecuta el founder** con esta guía
(el navegador de la herramienta es un contexto aislado y cae en el login de Kommo). La Fase 1b es
código (SDD propio) y la Fase 5 se hace desde el Studio: esas sí las ejecuta el agente.
