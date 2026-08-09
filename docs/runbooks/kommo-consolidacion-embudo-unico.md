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

### ✅ Medido de verdad (2026-08-03, tras aplicar SDD-0245)

Con la migración 0343 aplicada y `kommo-sync` v7 desplegada, la bandeja ya se espeja. Primera corrida:
**7/7 entidades ok · 148 entradas en `kommo_unsorted`**, y la reconciliación da **148 de 148
genuinamente ausentes** de `kommo_leads` (cero falsos positivos).

| Fuente | Leads sin aceptar | Desde | Hasta |
|---|---|---|---|
| **WhatsApp `waba:974617042407664`** | **118** | **2026-07-01** | hoy |
| Instagram Business | 21 | **2025-06-23** | 2026-08-01 |
| WhatsApp `waba:253896374482910` | 5 | 2026-01-23 | 2026-01-26 |
| Comentarios de Instagram | 4 | 2026-07-26 | 2026-07-29 |

**Los 118 de WhatsApp desde el 1-jul son exactamente el hueco** que hacía ver el embudo congelado.
17 llevan más de 30 días esperando; el más viejo es de **junio de 2025**.

⚠️ Hay **dos números de WhatsApp** conectados: el segundo (`…482910`) dejó de recibir en enero.
Vale confirmar si sigue publicado en algún lado.

**Consecuencias para este plan:**

1. La **Fase 2 (redirigir la captación) sube a máxima prioridad**: no es cosmética, es lo que hace que
   los leads existan para el ERP. Es exactamente lo que pidió el founder desde el inicio — *"que no
   entren a la sección general de leads, sino directo al embudo"*.
2. **Sumar `/api/v4/leads/unsorted` al sync** → especificado en
   [SDD-0245](../specs/0245-kommo-espejo-unsorted/spec.md) (migración 0343 + entidad `unsorted` en el
   sync). Mientras no esté aplicado, el ERP mide sobre una fracción del embudo.
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

### Fase 2 · ✅ CASI COMPLETA (2026-08-04) — la captación ya entra en Ventas DTD

- [x] **13.** Fuentes apuntadas a **Ventas DTD → Leads entrantes**.
      **WhatsApp ✅ · Instagram ✅** (reconectado el 2026-08-03; Instagram no tiene selector de
      embudo — hay que desconectar y volver a agregar desde el embudo destino).
- [x] **14.** Verificado con leads reales, no de prueba: el 2026-08-04 cayeron **2 por WhatsApp**
      (`23287603`) y **1 por Instagram** (`23287637`) en **Ventas DTD → Leads Entrantes**.
      Antes de eso, el último lead nuevo del embudo viejo es del 2026-07-30.
- [ ] **13b.** **Facebook Messenger + Comentarios** — siguen en el embudo viejo. Mismo patrón que
      Instagram: desconectar la página y volver a agregarla desde Ventas DTD (requiere clic en Meta).
      **Bloquea la Fase 4:** no se puede borrar un embudo que todavía tiene fuentes atadas.
- [ ] **13c.** Verificar los **comentarios de Instagram** (`instagram_business_comments`): los mensajes
      directos ya migraron, pero el último comentario (2026-08-03) cayó al embudo viejo.
- [ ] **13d.** Decidir el **segundo WhatsApp** `waba:253896374482910`: sus únicos 5 mensajes son de
      enero 2026 y ninguno fue respondido. O se conecta a Ventas DTD, o se retira.

### Fase 2b · 🔴 Vaciar la bandeja de "sin clasificar" — *el paso que faltaba*

**Por qué existe esta fase.** La bandeja Unsorted no es una etapa: es una **cola previa**, y cada
entrada nace **atada al embudo que tenía la fuente cuando entró el mensaje**. Redirigir la fuente
(Fase 2) **no re-apunta lo que ya está en la cola**.

Medido el 2026-08-04: de **152** entradas, **149 apuntan al embudo viejo**. Aceptar cualquiera de
ellas crea el trato en `Embudo de ventas`, no en Ventas DTD — y vuelve a llenar justo el embudo que
la Fase 4 quiere borrar. **Ya pasó**: el lead `23235815` se aceptó el 2026-08-04 12:52 UTC y quedó
en el embudo viejo.

⚠️ **Esta fase va ANTES de la Fase 3.** Si se vacía el embudo viejo primero, las aceptaciones
posteriores lo vuelven a poblar.

Clasificación de las 149 (cruce por teléfono contra `clients`):

| Grupo | Leads | Edad | Destino |
|---|---:|---|---|
| Cliente registrado | **14** | 6–26 d | Aceptar → **Ventas DTD · Recontacto** |
| Desconocido reciente | **118** | 1–30 d | Aceptar → **Ventas DTD · Leads entrantes** |
| Desconocido | **9** | 31–34 d | Aceptar → **Ventas DTD · Leads entrantes** |
| Desconocido viejo | **8** | 188–407 d | **Rechazar** |

⭐ **El corte NO son 90 días: son 34.** Los datos saltan de 34 a 188 sin nada en el medio. Ese hueco
es la línea natural — y explica por qué "rechazar el resto en bloque" habría sido un error: los 118
recientes son **118 personas distintas** (cero duplicados), **96 de ellas con teléfono**. Es la
demanda de un mes sin responder, no cola muerta.

- [ ] **14a.** Rechazar los **8** de +188 días. 5 de ellos vienen del segundo WhatsApp (ver 13d).
- [ ] **14b.** Aceptar los **14 clientes** y moverlos a **Recontacto**. Lista con nombres y Shipping
      Mark: worklist local, **no va a git** (lleva PII).
- [ ] **14c.** Aceptar los **127 desconocidos** restantes → **Leads entrantes**.
- [ ] **14d.** Verificar que la bandeja quede **solo** con entradas atadas a Ventas DTD.

> ⚠️ **Instagram no se puede enrutar automáticamente.** Sus contactos entran **sin teléfono**
> (verificado en `23287637`), y el enrutador cruza por teléfono. Solo WhatsApp cae solo en
> Recontacto; a los de Instagram hay que reconocerlos a mano.

### Fase 3 · Vaciar embudos, uno a la vez (de menor a mayor)

Para cada uno: abrir → seleccionar todos → editar en lote → setear **Tipo de servicio** → mover a
**DTD — Ventas** en la etapa destino → **verificar que quede en 0**.

> ⭐ **Los 6 embudos secundarios están 100% vencidos** (todos sus leads tienen +90 días) → se
> seleccionan completos y se mueven de un golpe, **sin triage lead por lead**. Los únicos 291 leads
> vivos están todos en Embudo de ventas.

- [ ] **15.** VISA China (5) → `Visa China` → **4 a PERDIDO · 1 a Leads entrantes**
- [x] **16.** ✅ Validación de proveedores (13) → 12 a **Ventas DTD · Ventas Perdidos** (motivo
       "Limpieza 2026-08") · 1 preservado (`Logrado con éxito`, ya es cliente ganado — no bloquea nada)
- [ ] **17.** Verificación de mercancía (15) → `Verificación de mercancía` → **PERDIDO**
- [ ] **18.** Cursos (95) → `Cursos` → **PERDIDO**
- [ ] **19.** Compra asistida (232) → `Compra asistida` → **PERDIDO**
- [ ] **20.** Embudo Carga (240) → `Carga` → **GANADO** *(compraron: son cierres, no pérdidas. El
       detalle logístico lo lleva el ERP)*
- [ ] **21.** Embudo de ventas (**2.281** al 2026-08-04 — sube con cada aceptación de la bandeja
       vieja, por eso la Fase 2b va primero), en **tres tandas** — filtrar por **fecha de creación**:
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

### Fase 5 · ✅ COMPLETA (2026-08-03/04) — el ERP ya apunta a Ventas DTD

Antes apuntaba al embudo equivocado (`Atencion a leeds`, 13967120), que va a ser borrado. Estado
verificado el 2026-08-04:

```json
{"sent":       {"pipeline_id": 14036567, "status_id": 108343839},
 "accepted":   {"pipeline_id": 14036567, "status_id": 142},
 "rejected":   {"pipeline_id": 14036567, "status_id": 143},
 "recontacto": {"pipeline_id": 14036567, "status_id": 108343835}}
```

- [x] **24.** Sync corriendo: cron 07:00 UTC **+ webhook en vivo** (9 disparos el 2026-08-04, todos
       `ok`). Antes del 2026-08-04 el webhook **nunca había funcionado**: no tenía secreto ni estaba
       registrado en Kommo, así que el espejo dependía solo del cron.
- [x] **25.** Mapa re-mapeado a **Ventas DTD (14036567)**, con la clave `recontacto` del enrutador.
- [x] **26.** Campo Shipping Mark del **lead** confirmado (`1570535`) y del **contacto** (`1570723`,
       SDD-0244 rebanada B — el del lead se lo lleva el trato al cerrarse; el del contacto es el
       permanente).

**Falta para cerrar el circuito:**

- [ ] **27.** Probar el enrutador en ensayo con un cliente registrado que escriba por WhatsApp, y
       verificar las 3 filas `skipped` en la outbox: `patch_stage` · `patch_lead` · `patch_contact`.
- [ ] **28.** 🔴 **Antes de apagar `writeback_dry_run`**: borrar la ficha `DTD-1007`, que guarda el
       teléfono de China y el correo corporativo de DTD en vez de los de la clienta. Es un match
       **único** (no ambiguo), así que el enrutador **sí actuaría** y estamparía ese Shipping Mark a
       cualquier mensaje que entre desde ese número. Ya entró uno (lead `23286997`, 2026-08-03).
       Borrado **suave** (`deleted_at`), nunca destructivo: SDD-0246 usa esas filas como alias.
- [ ] **29.** Apagar `writeback_dry_run`.

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
