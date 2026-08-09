# Brief para la revisión transversal (Codex) — CRM + agente de IA

> **Para qué:** Sam pidió que el trabajo de esta noche pase por Codex. Yo no puedo correr Codex —es
> su herramienta—, así que dejo aquí lo que hay que revisar, con las afirmaciones separadas por
> cuánto las respalda la evidencia. **Lo primero que conviene atacar es lo marcado 🟡: son las que yo
> no pude cerrar.**
>
> Rama: `feat/crm-agentes-por-etapa` · **sin push** · worktree `Claude/DTDCargo/IA3`.

## Lo que quedó cambiado en producción esta noche

Sólo una cosa se tocó fuera del repo, y es en Kommo, no en la DB ni en el código:

| Cambio | Dónde | Verificado |
|---|---|---|
| Persona del agente → identidad de **Manuel** (1.457 car.) | Kommo, agente #326244 | ✅ recargando desde el servidor |
| Pauta "¿eres una persona?" → dice Manuel | mismo agente | ✅ ídem |
| 10 pautas vacías creadas por error → borradas | mismo agente | ✅ 24 pautas, 0 vacías |

**Nada más se modificó.** No se prendió el write-back, no se aplicó ninguna migración, no se escribió
en Supabase (el MCP es de sólo lectura).

## 🔴 Lo que yo había afirmado y resultó FALSO

Esto es lo más importante de revisar, porque muestra cómo se coló el error.

**Afirmé que el `stage_map` de producción apuntaba al embudo borrado `13967120`**, y sobre esa base le
dije a Sam que prender el write-back sería contraproducente. **Es falso.** El mapa estaba correcto y
completo, con las cuatro claves apuntando a `Ventas DTD (14036567)`.

El error no fue de lectura: fue **no leer**. El runbook lo *infería* del plan viejo, y yo repetí la
inferencia como si fuera medición. El propio runbook llevaba el aviso —*"el valor exacto no se releyó
de la DB"*— y lo pasé por alto. Costó dos consultas SQL desmentirlo.

**Qué revisar:** ¿hay más afirmaciones de estado de producción en `docs/` que sean inferencias
presentadas como hechos? El patrón a buscar es un dato de prod sin la consulta que lo respalde.

## 🟢 Hallazgos que sí están medidos

### 1. El write-back no arranca por el primer eslabón, no por el último

```
convertir lead → cliente     ← 0 de 432 clientes tienen kommo_lead_id. NADIE lo ha hecho nunca
  → enqueue_kommo_writeback  ← nunca se dispara (ningún trigger lo llama; lo llama la app)
  → drenar la outbox         ← no existe el cron (cron.job sólo tiene kommo-sync-dtd y la tarifa)
  → dry_run = false          ← el único paso que estaba en la lista
```

`kommo_writeback_outbox` = **0 filas en toda su historia**. Prender `dry_run=false` hoy no haría nada
—ni bien ni mal—, y el riesgo real es **dar por funcionando algo que nunca corrió**.

**Qué revisar:** ¿el diseño de SDD-0058 esperaba que `convertLead()` fuera manual? Si el negocio
necesita que todo lead ganado se convierta, falta el automatismo, y eso es una spec, no un bug.

### 2. El tablero `/studio/kommo` miente por truncamiento

Muestra **1000 leads** y **1000 contactos** — dos tablas distintas con el mismo número redondo, firma
del `db-max-rows` de PostgREST. El código pide 5.000 (`lib/studio/kommo-analytics.ts:321`).

| | Tablero | Verdad (SQL) |
|---|---|---|
| Contacto inicial | 208 | **372** |
| Ventas Perdidos | 724 | **2.402** |
| Logrado con éxito | 40 | **243** |
| Conversión | "76%" | **9,2%** |

El "76%" ni siquiera es conversión: es (ganados+perdidos)/1000 de la muestra truncada.
*(Ya quedó como tarea aparte; no se arregló en esta rama.)*

### 3. El desplegable de embudos ofrece 11 embudos muertos

`kommo_pipelines` conserva **12 filas** porque el sync no purga lo borrado, pero la API viva devuelve
**1**. La pantalla de Mapa de etapas te deja elegir un embudo que ya no existe, sin avisar.

## 🟡 Lo que NO pude cerrar — revisar con prioridad

1. **Las 11 pautas del arquetipo de Entrada no se pudieron cargar.** Kommo guarda en blanco las filas
   creadas por script; exigen tecleo real. Están listas para copiar en
   `docs/marketing/agentes-ia-configuracion.md`. **Revisar que ninguna contradiga las 24 vigentes** —
   yo las comparé una por una, pero es exactamente el tipo de cosa que conviene que mire otro.
2. **La cadena de traspaso a humano sigue sin construirse.** Está bloqueada por una decisión de
   negocio, no técnica: en Kommo hay **dos usuarios activos** y uno es un consultor externo. Sin
   asesores dados de alta, `Cambiar responsable` sólo puede apuntar a la cuenta `DTD CARGO`.
3. **Nadie ha probado al agente contra la batería de 7 casos** (precio · restricción · pedir humano ·
   dirección de China · casillero/DDP · pérdida · pregunta fuera de fuentes). La CAPA 1 cambió el
   comportamiento: hay que volver a correrla. **Ojo, cuesta créditos: quedan ~757 de 2.250.**
4. **La cifra que Sam mencionó no cuadra.** Dijo "escribir sobre 1860"; lo medido son **3.046 leads**
   en el espejo y **432 clientes**. Puede ser otro alcance del que yo entendí.

## Lo que conviene atacar primero, en orden

1. Teclear las 11 pautas y correr la batería de 7 casos. Es lo único que mejora hoy la conversación
   con clientes reales.
2. Decidir **quién recibe** los traspasos, y recién ahí armar la cadena.
3. Convertir **un** lead de prueba a cliente y mirar la outbox. Con eso se sabe si la cadena del
   write-back respira, sin prender nada.
4. El cron del drain, por el runbook de migraciones a producción.

**Lo que NO conviene tocar todavía:** `writeback_dry_run`. Mientras `kommo_lead_id` sea 0 de 432, ese
interruptor no controla nada.
