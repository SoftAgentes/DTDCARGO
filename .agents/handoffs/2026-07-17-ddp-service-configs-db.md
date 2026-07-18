# Handoff · 2026-07-17 · Barrido DDP en la DB publicada (service_configs)

**Ventana:** `wonderful-cray-933580` · rama `claude/wonderful-cray-933580`
**Tarea:** quitar "DDP" del nombre del servicio principal en la capa DB del sitio
(`title_public`) y corregir el typo `"...la carga llegar*."` en `description_public`
(fila `puerta-a-puerta-ddp`, tenant `dtd`, tabla `public.service_configs`, prod
`xpfuzqombmjmxvprjgmi`). Complemento del barrido de copy `954eaadc` (rama
`claude/jolly-proskuriakova-3da0aa`, aún sin merge a main al cierre).

## Resultado — ✅ CERRADO (actualizado al final de la sesión)

- ✅ **AMBAS filas aplicadas en prod y verificadas** por re-lectura:
  - `puerta-a-puerta-ddp`: `title_public = "Puerta a puerta · Pagas al llegar"`
    (sin DDP, sin el `*` literal) + `description_public` termina en "…la carga
    **llega**." (typo `llegar*` corregido).
  - `transito-aduana`: quitado " DDP" en `description_public` ("en el puerta a
    puerta ya va incluido") y `note_public` ("Incluido en el servicio puerta a
    puerta;…").
  - Único "DDP" que queda en la tabla publicada = aclaración entre paréntesis
    permitida ("(DDP)" en descripción + includes de la ficha principal).
- ⚠️ **Claude NO pudo escribir a prod**: el clasificador de permisos del modo auto
  bloqueó los 2 canales (script node vía PostgREST con service role, y MCP Supabase
  `execute_sql`). **Lo aplicó el founder** pegando el SQL en el SQL editor del
  dashboard. Para escribir a prod con esta config: dashboard, o sesión interactiva
  aprobando el prompt.
- ✅ Lectura completa de prod hecha (20 filas del catálogo, snapshot en scratchpad
  de la sesión) — skills de Supabase invocados antes de tocar la DB.
- ✅ SQL final con guard anti-drift + valores exactos + hallazgos guardados en
  memoria persistente: `project_ddp_service_configs_db_pendiente.md`.

## Evidencia (leído de prod 2026-07-17)

- `title_public` = `"Puerta a puerta DDP · Pagas al llegar*"` — el `*` es literal
  (apuntaba a la nota "*pueden aplicar restricciones" de los includes).
- `description_public` = igual al estático salvo el final: `"...pagas cuando la
  carga llegar*."` (typo confirmado).
- La columna real es `description_public` — **no existe** `summary_public`.
- ⚠️ `includes_public` de esa fila tiene ediciones del founder hechas en el Studio
  ("casco central Valencia, Maracay, Caracas*", "(*pueden aplicar restricciones)")
  que NO están en el estático → **NUNCA correr `scripts/sync-servicios-detalle.ts
  --apply` completo**: las pisaría. Solo updates quirúrgicos.
- Otra fila publicada con "DDP" como nombre: `transito-aduana` — **también
  corregida** (ver arriba).

## SQL aplicado (por el founder, en el SQL editor del dashboard)

Fila principal (guard incluido — toca 0 filas si ya está):

```sql
UPDATE public.service_configs sc
SET title_public = 'Puerta a puerta · Pagas al llegar',
    description_public = 'Nuestro servicio principal: traemos tu mercancía de China hasta tu puerta en Venezuela, todo incluido (DDP). Consolidamos, embarcamos, nacionalizamos a nuestro nombre y entregamos — tú solo recibes y pagas cuando la carga llega.'
FROM public.tenants t
WHERE t.id = sc.tenant_id AND t.slug = 'dtd'
  AND sc.service_key = 'puerta-a-puerta-ddp'
  AND sc.title_public = 'Puerta a puerta DDP · Pagas al llegar*'
RETURNING sc.service_key, sc.title_public;
```

`transito-aduana`:

```sql
UPDATE public.service_configs sc
SET description_public = replace(description_public, 'puerta a puerta DDP', 'puerta a puerta'),
    note_public        = replace(note_public,        'puerta a puerta DDP', 'puerta a puerta')
FROM public.tenants t
WHERE t.id = sc.tenant_id AND t.slug = 'dtd'
  AND sc.service_key = 'transito-aduana'
RETURNING sc.service_key, sc.description_public, sc.note_public;
```

Verificar en https://dtdcargo.com/servicios (ficha destacada + tránsito de aduana).

## Git

- Sin cambios de código: el trabajo fue DB (aplicado por el founder) + memoria +
  este handoff.
- Commits de esta ventana: solo este archivo del handoff.
