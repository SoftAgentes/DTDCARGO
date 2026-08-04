---
sdd: "0244"
title: "Enrutado a Recontacto — el ERP reconoce al cliente que vuelve y le estampa su Shipping Mark"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0043", "0058", "0083", "0084", "0086", "0157"]
confidencialidad: interno
---

# SDD-0244 — Enrutado a Recontacto

> Cuando un cliente que ya compró vuelve a escribir, su trato nuevo debe caer en la etapa
> **Recontacto** con su **Shipping Mark a la vista**, en vez de verse igual que un desconocido.
> Lo resuelve el ERP con el webhook y la outbox que ya existen. **No usa Salesbot.**

## 1. El problema, medido

Espejo Supabase, sync 2026-08-03:

| Medición | Resultado |
|---|---|
| Clientes en el ERP | **428** |
| Clientes marcados en Kommo (`clients.kommo_lead_id`) | **0** |
| Leads con Shipping Mark escrito | **0** de 2.877 |
| Campos de contacto en Kommo | Cédula · Dirección · Email · Posición · Teléfono · Términos — **sin Shipping Mark** |
| Leads cerrados y **reabiertos** | **0** desde feb-2024 |

**Kommo no tiene una sola marca que diga que alguien ya compró.** Por eso, cuando un cliente vuelve, su
trato nuevo se ve idéntico al de un desconocido y el asesor lo trata como tal.

**No es un bug de Kommo.** Los 0 reabiertos confirman que crear un trato nuevo es su comportamiento, y
es el correcto: el trato ganado viejo es el histórico y no se toca. Lo que falta es la marca.

### 1.1 · Por qué el ERP y no Salesbot

Las *condiciones* documentadas de Salesbot son a nivel **lead** (etiquetas, etapa, responsable, fuente,
UTM). La doc **no confirma** que una condición pueda leer un campo del **contacto** — que es donde la
marca tiene que vivir para sobrevivir al cierre del trato.

El ERP no tiene esa ambigüedad: **es quien sabe quién es cliente**. Y las cuatro piezas ya existen:

| Pieza | Dónde | Estado |
|---|---|---|
| Webhook `leads[add]` | `supabase/functions/kommo-webhook/` | ✅ desplegado (SDD-0043 Fase B) |
| Outbox + gate + drain | `kommo_writeback_outbox` (migr 0136) · `kommo-writeback` | ✅ (SDD-0083) |
| `patch_stage` | `enqueueKommoStageWriteback` · `lib/studio/kommo-writeback.ts` | ✅ (SDD-0084) |
| Cruce por teléfono | `phonesMatch` / `normalizePhone` · `lib/studio/estimado-linking.ts` | ✅ |

### 1.2 · Cobertura real (y por qué el backfill de teléfonos se descarta)

| Grupo | Clientes | Altas | Con portal | ¿Ruteable? |
|---|---|---|---|---|
| **Con teléfono** | **243** | 24-may → hoy | **51** | ✅ |
| Sin teléfono (base heredada) | 186 | 24-may → **12-jun**, y paró | **0** | ❌ |

Los 186 sin teléfono son el bloque importado de la base vieja: se cortan en seco el 12-jun y **ninguno
tiene portal**. Los 243 ruteables son los clientes vivos.

**Rellenar esos 186 no es viable — medido:** sólo 77 tienen email, de esos **8** aparecen en Kommo por
email, y desde `persons` (vía `legacy_client_id`) son **0**. Ese teléfono no existe en el ERP.
→ **No se hace backfill. Se auto-sanan al contacto** (§3.3).

## 2. Objetivo

1. Que un trato creado por un **cliente conocido** caiga solo en **Recontacto**, marcado `Recompra`.
2. Que su **Shipping Mark** quede visible en el **contacto** de Kommo — permanente, sobrevive al cierre.
3. Que la cobertura **crezca sola** con el uso, sin un backfill que no se puede hacer.

## 3. Diseño

### 3.1 · Migración 0342 — el vínculo con la persona

Hoy `clients` sólo tiene `kommo_lead_id`: **apunta a la venta, no a la persona.** El lead se cierra y
se lleva la marca. Se agrega el vínculo estable:

```sql
alter table public.clients add column if not exists kommo_contact_id bigint;

create index if not exists clients_kommo_contact_idx
  on public.clients (tenant_id, kommo_contact_id)
  where kommo_contact_id is not null;

-- Búsqueda por teléfono normalizado (últimos 10 dígitos VE) SIN escanear la tabla.
create index if not exists clients_phone_last10_idx
  on public.clients (tenant_id, right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10))
  where phone is not null and phone <> '';
```

⚠️ `regexp_replace` va calificado por esquema si la migración fija `search_path` (ver
`docs/runbooks/aplicar-migraciones-prod.md`).

### 3.2 · Nueva op de outbox: `patch_contact`

El `CHECK` de `kommo_writeback_outbox.op` hoy admite `patch_price · patch_stage · patch_lead` — las tres
apuntan a leads. Se suma **`patch_contact`** y la edge function `kommo-writeback` aprende a pegarle a
`PATCH /api/v4/contacts`. Es op-agnóstica (manda `row.payload` tal cual), así que el cambio es el
endpoint, no la lógica.

**Requiere en Kommo** (config, Fase 1 del runbook): campo **"Shipping Mark" en contactos** + etiqueta
`Cliente`. El id del campo se guarda junto al de leads (`getKommoMarkboxFieldId` se extiende).

### 3.3 · El enrutador, en el webhook `leads[add]`

```
llega leads[add]
  └─ resolver el contacto del lead (_embedded.contacts[0].id)
      ├─ 1. buscar clients por kommo_contact_id .............. hit → CLIENTE
      ├─ 2. si no: buscar clients por teléfono normalizado ... hit → CLIENTE
      │      └─ AUTO-SANADO: guardar kommo_contact_id en ese cliente
      └─ 3. si no: es un desconocido → no se hace nada (queda en Leads entrantes)

si CLIENTE → encolar:
   patch_stage    → etapa Recontacto
   patch_lead     → Tipo de trato = Recompra
   patch_contact  → Shipping Mark + etiqueta Cliente   (idempotente: sólo si falta)
```

**El paso 2 es lo que hace crecer la cobertura sola.** Cada cliente heredado que escriba una vez queda
vinculado para siempre — sin backfill, sin trabajo manual.

⚠️ **`findKommoContactsByPhone` NO se reusa como enrutador**: sólo revisa los 500 contactos más
recientes de 3.041 y su propio comentario advierte *"es una ayuda, no una garantía"*. El enrutador va
contra `clients` con el índice de §3.1, que es exacto.

### 3.4 · Configuración de la etapa destino

Se reusa `kommo_connections.stage_map` (jsonb, SDD-0084) sumando la clave `recontacto`:

```json
{ "sent": {...}, "accepted": {...}, "rejected": {...},
  "recontacto": { "pipeline_id": 14036567, "status_id": <id de Recontacto> } }
```

Sin esa clave, **el enrutador queda inerte** (no encola nada) — mismo patrón que `patch_stage` hoy.
Se configura en `/studio/kommo → Dirección → Mapa de etapas`.

### 3.5 · Gate

Hereda el gate existente (`writebackGate`): `writeback_enabled=true AND writeback_dry_run=false` para
escribir de verdad. Hoy está en `dry_run=true` → **el enrutador se puede desplegar y observar en seco**
antes de dejarlo escribir.

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| La marca vive en el **contacto**, no en el lead | El lead se cierra y se la lleva. El contacto es permanente |
| El enrutado lo hace el **ERP**, no Salesbot | El ERP sabe quién es cliente; evita la duda de condiciones sobre contacto |
| **Sin backfill de teléfonos** | Medido: 8 recuperables de 186. Se auto-sana al contacto |
| Vínculo por `kommo_contact_id`, no por teléfono | El cruce por teléfono es caro y aproximado; el id es exacto e indexado |
| `Recontacto` es **puerta de entrada**, no reposo | Una etapa donde reposan tratos recrea el cementerio de 2.237 |

## 5. Fuera de alcance

- La bandeja **Unsorted** (`/api/v4/leads/unsorted`): el espejo sigue ciego a ella. Spec aparte.
- Clasificar **qué quiere** el que escribe (pedido nuevo vs consulta de carga). El enrutador va por
  **quién** escribe; la intención la decide el asesor.
- Reabrir o modificar tratos ganados. Nunca.

## 6. Verificación

1. **Contrato SQL** (`supabase/tests/0342_*.test.sql`): la columna y los dos índices existen; el
   `CHECK` de `op` admite `patch_contact`; RLS intacta sobre `clients`.
2. **Unit** (Vitest): el resolvedor devuelve `CLIENTE` por id, `CLIENTE` + auto-sanado por teléfono, y
   `desconocido` cuando no hay match. Idempotencia: dos `leads[add]` del mismo lead encolan una sola vez.
3. **Dry-run en prod**: con `writeback_dry_run=true`, escribir desde un número de cliente conocido y
   confirmar que la outbox registra los tres `patch_*` con el `status_id` de Recontacto — **sin** que
   Kommo cambie.
4. **E2E**: apagar `dry_run`, repetir, y verificar en Kommo que el trato quedó en Recontacto con el
   Shipping Mark en el contacto.
5. **Cobertura** (semanal, espejo):

```sql
select count(*) filter (where kommo_contact_id is not null) as vinculados, count(*) as total
from clients;
```
Esperado: arranca en ~243 y **sube solo** con cada cliente heredado que escribe.

## 7. Dependencias

- **Runbook `kommo-consolidacion-embudo-unico.md`, Fases 1 y 5**: la etapa `Recontacto`, el campo
  "Shipping Mark" en contactos y la etiqueta `Cliente` **deben existir en Kommo** antes de desplegar.
- `stage_map` re-mapeado al embudo nuevo (14036567) — hoy apunta a `Atencion a leeds`, que se borra.
