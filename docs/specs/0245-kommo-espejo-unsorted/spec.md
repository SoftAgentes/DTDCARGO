---
sdd: "0245"
title: "Espejo de la bandeja de entrada de Kommo — el ERP deja de medir sobre una fracción del embudo"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0043", "0195", "0244"]
confidencialidad: interno
---

# SDD-0245 — Espejo de la bandeja de entrada (unsorted)

> El ERP no ve los leads que llegan por WhatsApp hasta que alguien los acepta a mano. Mientras tanto,
> **todo número del ERP subestima el embudo** y el sync reporta `ok` como si no faltara nada.

## 1. El hueco, medido

Captura del Inbox de chat de Kommo, **2026-08-03**, cruzada contra el espejo:

| Lead visible en la bandeja | ¿En el espejo? |
|---|---|
| 23285339 · 23284205 · 23283491 · 23282063 | ❌ **no** |
| 23276339 · 23275787 · 23271529 | ✅ sí — creados 29-30 jul, en *Embudo de ventas* |
| 23274143 · 23256017 · 23235815 · 23233725 | ❌ **no** |

**8 de 11 leads con actividad de hoy no existen en el ERP.** Los 3 que sí están son justamente los que
alguien aceptó y quedaron en un embudo real.

Confirmación por el otro lado — `sync_logs`, tres días seguidos:

| Día | leads | contacts |
|---|---|---|
| 2026-08-01 | 2.877 | 3.034 |
| 2026-08-02 | 2.877 | 3.034 |
| 2026-08-03 | **2.877** | 3.041 |

**Los leads llevan congelados desde el 30-jul** mientras los contactos siguen creciendo. El sync no está
roto: `/api/v4/leads` sencillamente **no devuelve los leads sin aceptar**, y `unsorted` no aparece en
ningún archivo del repo.

**Estado operativo al medir: 626 conversaciones sin leer · 3.304 chats abiertos** contra 2.877 leads
espejados.

### 1.1 · Por qué importa más de lo que parece

Toda métrica que el ERP calcula hoy sobre `kommo_leads` está sesgada:

- La "tasa de cierre de 5 sobre 2.877" (0,17%) usa un denominador incompleto.
- El *cementerio* de 2.586 leads fríos no incluye a los que nunca llegaron a ser leads.
- El enrutado de [SDD-0244](../0244-kommo-recontacto-enrutado/spec.md) se dispara con `leads[add]`:
  **si el lead nunca se acepta, el webhook no llega y el cliente que vuelve no se reconoce.**

## 2. Objetivo

1. Espejar la bandeja en una tabla propia para poder **contar y medir** lo que está esperando.
2. Que el sync **deje de decir `ok` cuando está ciego** — el conteo de la bandeja es parte del resultado.
3. **No cambiar el comportamiento de Kommo.** Este SDD es read-only: no acepta, no rechaza, no escribe.

## 3. Diseño

### 3.1 · Migración 0343 — tabla `kommo_unsorted`

Espejo de `GET /api/v4/leads/unsorted`. Campos que responden las preguntas que importan
(*¿cuántos esperan? ¿desde cuándo? ¿por dónde entraron? ¿a qué embudo irían?*):

```sql
create table public.kommo_unsorted (
  tenant_id        uuid   not null references public.tenants(id) on delete cascade,
  uid              text   not null,          -- id de la entidad unsorted
  category         text,                     -- chats · mail · forms · sip
  source_name      text,
  pipeline_id      bigint,
  lead_id          bigint,                   -- el lead pendiente (aún no en /leads)
  contact_id       bigint,
  kommo_created_at timestamptz,
  raw              jsonb  not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  primary key (tenant_id, uid)
);
```

RLS tenant-scoped, idéntica al resto del espejo (SELECT a `authenticated` del tenant, ALL a
`service_role`). **Nunca `USING(true)`.**

### 3.2 · ⚠️ La bandeja es una COLA, no un registro

Diferencia clave con `kommo_leads`: una entrada de unsorted **desaparece** cuando alguien la acepta o
la rechaza. Un upsert puro dejaría filas fantasma acumulándose para siempre y el conteo mentiría al
alza — justo el error opuesto al de hoy.

→ El sync hace **reemplazo total por tenant**: upsert de lo visto + `delete` de lo que ya no está.
Esto es correcto porque la bandeja se lee completa en cada corrida (son cientos, no cientos de miles).

### 3.3 · El sync aprende una entidad más

Se suma una sexta entidad `unsorted` en `syncAll` (`supabase/functions/kommo-sync/sync.ts`), después de
leads. Reusa `kommoFetch` y el manejo 204/401/429/5xx que ya existe.

Paginación **de una sola pasada** (`/api/v4/leads/unsorted?limit=250&page=N`): a diferencia de leads y
contactos, acá no hay dos órdenes que reconciliar — se lee la cola entera.

⚠️ **Tope de páginas:** se reusa `MAX_PAGES = 20` (5.000 entradas). Con 3.304 chats abiertos hay margen,
pero si la bandeja creciera por encima de eso el sync truncaría **en silencio**. El paso de verificación
de §5 lo detecta.

### 3.4 · Que el `ok` deje de mentir

Hoy `sync_logs` marca `ok` por entidad sin decir nada de lo que no mira. Con la entidad `unsorted`
espejada, una corrida sana registra su conteo — y **una bandeja que crece sin drenarse se vuelve
visible** en vez de invisible. Es el mismo defecto que documenta [SDD-0195](../0195-kommo-sync-resiliencia/spec.md):
un `ok` que no distingue *"traje todo"* de *"traje lo que puedo ver"*.

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| Tabla propia, no filas en `kommo_leads` | Un lead sin aceptar **no es** un lead: mezclarlos corrompería todas las métricas actuales |
| Reemplazo total por tenant | La bandeja es una cola que drena; un upsert puro acumula fantasmas |
| Una sola pasada de paginación | No hay dos órdenes que reconciliar: se lee la cola completa |
| Read-only: no acepta ni rechaza | Aceptar es una decisión comercial de una persona, no del sync |

## 5. Verificación

1. **Contrato SQL** (`supabase/tests/0343_*.test.sql`): la tabla existe con su PK compuesta; RLS
   activa y **con política real** (mutación: un tenant no lee filas de otro); `USING(true)` ausente.
2. **Reconciliación contra la realidad** — la prueba que de verdad cierra este SDD:

```sql
-- Los leads de la bandeja NO deben estar en kommo_leads (si estan, ya se aceptaron)
select count(*) as pendientes_reales
from kommo_unsorted u
where u.lead_id is not null
  and not exists (select 1 from kommo_leads l where l.id = u.lead_id and l.tenant_id = u.tenant_id);
```
Esperado tras la primera corrida: un número **cercano a las conversaciones sin leer** de Kommo
(626 al momento de medir). Si da 0, el fetch no está trayendo la bandeja.

3. **Truncamiento silencioso:** si `count(*) = 5000` exacto (20 páginas × 250), el tope se alcanzó y
   el conteo es un piso, no un total. Debe gritar, no pasar como `ok`.
4. **Drenaje:** aceptar una entrada en Kommo y confirmar que tras el próximo sync desaparece de
   `kommo_unsorted` **y** aparece en `kommo_leads`.

## 6. Fuera de alcance

- **Aceptar o rechazar** entradas desde el ERP. Es una decisión comercial de una persona.
- Apagar la bandeja en Kommo (`Leads → Configurar embudo → Leads entrantes`). Es configuración, va en
  el runbook `kommo-consolidacion-embudo-unico.md` Fase 2, y **debe probarse con un lead real**: la doc
  de Kommo advierte que al apagarla los mensajes de un desconocido van al centro de notificaciones, y
  ese comportamiento no está verificado.
- Reprocesar el histórico: lo que ya se perdió no está en la API de unsorted.

## 7. Dependencia con SDD-0244

El enrutado a Recontacto se dispara con `leads[add]`. **Un cliente que vuelve y cae en la bandeja sin
aceptarse no genera ese evento** → no se le reconoce. Este SDD no lo arregla por sí solo; lo hace
visible. El arreglo de fondo es la Fase 2 del runbook: que los leads entren directo al embudo.
