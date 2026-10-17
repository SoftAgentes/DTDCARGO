---
sdd: "0539"
title: "Transportistas: lote sin ids en la URL, escrituras honestas y auditoría del registro"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-16
updated: 2026-10-16
supersedes: null
superseded_by: null
related: ["0537", "0236", "0498", "0174"]
confidencialidad: interno
---

# SDD-0539 · Transportistas: lote sin ids en la URL, escrituras honestas y auditoría

## Pedido

Encargo de Sam del 2026-10-16 a un Worker: cerrar los tres pendientes que dejó la
[SDD-0537](../0537-transportistas-tarifas-editables/spec.md) (PR #241, merge `3e0368e0`) en
Studio › Administración › Calculadora pública › Transportistas.

1. **El tamaño de la URL en el cambio en lote.** La corrección tiene que seguir siendo todo o
   nada y probarse con un doble que mida la URL.
2. **`saveCarrierAction` responde `ok` sin guardar.** Es el mismo defecto que la 0537 corrigió
   en las tarifas.
3. **Cambiar el transportista que cotiza la web no deja auditoría.** Hay que evaluarlo con
   AUD-01 y, si hace falta, escribir la migración, que queda NO APLICADA.

El Director asignó el número 0539 y la migración 0491 (2026-10-16).

## Estado medido antes del cambio (`main` `6da8aebc`)

- **Lote.** `bulkUpdateTariffPricesAction` filtra la cuenta previa y el UPDATE con
  `.in("id", ids)`. PostgREST lleva los filtros en la URL. Medido con `URLSearchParams`, que es
  como lo arma supabase-js: 169 uuids miden 6.600 bytes y 300 (`MAX_LOTE`) miden 11.709. Un
  proxy nginx con la configuración por defecto corta la línea de petición en 8 KB y responde 414.
  supabase-js avisa desde 8.000 caracteres (`urlLengthLimit`).
- **`saveCarrierAction`.** La edición hace `update(fila).eq("id", id).select("id").maybeSingle()`.
  Con cero filas, por la RLS o por un borrado previo, `data` es `null` sin error y la acción
  responde `ok`. Además reescribe `tenant_id`.
- **`setDefaultCarrier`**, el segundo paso de `saveCarrierAction` y todo lo que hace
  `setDefaultCarrierAction`:
  - primero baja al predeterminado y después marca el nuevo con `.eq("id")`, sin `deleted_at` ni
    `.select()`;
  - con el id de un transportista borrado, baja a Benito y marca uno que `getDefaultCarrier` no
    ve;
  - la web se queda sin transportista y deriva todo al asesor, y la acción responde `ok`.
- **`deleteCarrierAction`.** Tiene el mismo defecto de `saveCarrierAction`.
- **Auditoría.** `freight_carriers` (0330) no tiene trigger. La 0490 auditó `carrier_tariffs`.
- **Qué se usa desde la pantalla.** Hoy sólo `setDefaultCarrierAction`, en la tarjeta de cada
  transportista. `saveCarrierAction` y `deleteCarrierAction` no tienen pantalla, pero son Server
  Actions: cualquier sesión de admin las puede invocar con un POST.

## Decisión

### 1. El lote ya no manda los ids en la URL

- La lectura trae `id, city_slug` de **todas** las tarifas vivas del transportista, filtradas
  por tenant, transportista y `deleted_at` y sin lista. Su URL mide lo mismo con 1 o con 300
  ciudades (menos de 250 bytes).
- Todo o nada: cada id elegido tiene que estar en esa lectura. Si falta uno, no cambia ninguna,
  igual que antes.
- El UPDATE es una sola sentencia con los mismos filtros, más `city_slug=in.(…)`. El índice
  único vivo de 0330 (`carrier_tariffs_one_live_per_city`) garantiza que cada ciudad es una sola
  tarifa viva del transportista. Un slug pesa un tercio de lo que pesa un uuid: las 169 rutas sembradas
  (0332) dan un UPDATE de menos de 2.600 bytes.
- **Tope de bytes.** `bytesFiltroIn()` mide el filtro igual que supabase-js (sin repetidos,
  comillas para `,()` y codificación de URL). Si pasa de `MAX_BYTES_FILTRO_LOTE` = 6.000 bytes, no
  se escribe nada y la pantalla lo dice. Con slugs del largo real, 300 ciudades caben.
  `MAX_LOTE` sigue en 300.
- **Carreras.**
  - Si otra pestaña quita una ruta entre la lectura y el UPDATE, esa no se toca y la pantalla
    dice «N de M», como antes.
  - Si la quita y la vuelve a agregar, la ciudad sigue elegida y su tarifa nueva recibe el precio.
    Con `in(id)` no se tocaba. Es la ciudad que el admin marcó, con el mismo transportista.
- **Lo que se descartó.**
  - Partir el lote: rompe el todo o nada.
  - Una RPC con el arreglo en el cuerpo, que es lo que sugiere supabase-js: haría que la app
    dependa de una migración pendiente para un caso que hoy no existe, porque el tarifario entero
    mide 2,2 KB.

### 2. Las escrituras de `freight_carriers` dejan de decir `ok` sin guardar

- **Editar** (`saveCarrierAction`):
  - el UPDATE va a `id` + tenant + vivo, con `.select("id")`; con cero filas responde
    «Ese transportista ya no está activo…»;
  - no reescribe `tenant_id`.
- **Alta con «predeterminado»:** si el alta no devuelve el id, lo dice en vez de saltarse el paso
  y responder `ok`.
- **`setDefaultCarrier`:**
  - antes de bajar al anterior, lee que el nuevo exista vivo (la RLS acota al tenant);
  - si no existe, no toca a nadie y devuelve error;
  - el UPDATE que lo marca exige `deleted_at is null` y devuelve la fila; con cero filas es un
    error.
- **Quitar** (`deleteCarrierAction`): va acotado a tenant + vivo, con `.select("id")`.
- **Por qué entran `setDefaultCarrier` y `deleteCarrierAction`.** Tienen el mismo defecto que el
  punto 2, y el primero es el segundo paso de `saveCarrierAction`. Sin eso, `saveCarrierAction`
  con «predeterminado» seguía pudiendo responder `ok` con la web sin transportista.
- **Riesgo residual.** Si borran al transportista nuevo entre la lectura previa y el UPDATE que lo
  marca, el anterior ya quedó bajado. La acción responde error, no `ok`, y el mensaje pide revisar
  cuál cotiza la web. Cerrarlo del todo exige una sola sentencia (una RPC): queda fuera de
  alcance.

### 3. AUD-01 exige auditar `freight_carriers` → migración 0491

`freight_carriers.is_default` decide qué transportista cotiza la web pública:
`public_carrier_tariffs` sólo devuelve las tarifas del predeterminado (0330:300). Cambiarlo es
«configuración sensible» (`aud-01.md:27`). Quitar y restaurar un transportista también son
eventos obligatorios (`aud-01.md:25`).

La 0491 crea un trigger `AFTER INSERT OR UPDATE OR DELETE` que llama al writer real
(`append_audit_event`, 0294) en la misma transacción, igual que la 0490.

- **Eventos.**
  - `freight_carrier_created`, `freight_carrier_updated` y `freight_carrier_default_changed`;
  - `freight_carrier_deleted` y `freight_carrier_restored`, con motivo fijo;
  - quitar al que cotiza la web lo dice en el motivo.
- **Minimización (AUD-01 §5).**
  - Antes y después llevan sólo banderas: `is_default`, `active`, `deleted` y si hay razón social,
    RIF, contacto y notas.
  - `payload.changed_fields` nombra las columnas que cambiaron, sin valores.
  - No copia nombre, razón social, RIF, contacto ni notas. El contacto de un proveedor es dato
    personal de alguien que no es usuario, y la bitácora es de solo agregar desde 0267: una copia
    ahí no se podría borrar. El `entity_id` identifica al transportista.
  - Es el mismo criterio que `client_contact_updated` en 0293 (`email_present`/`phone_present`).
- **Sin evento.** Un UPDATE que no cambia ninguna de esas columnas, como volver a marcar al que ya
  cotiza o tocar sólo `updated_at`, no escribe nada.

### Lo que NO cambia

- La pantalla: no hay cambios de UI. El error nuevo del lote sale en el `role="alert"` que ya
  tiene `BulkPriceDrawer`, y el de `setDefaultCarrierAction`, en el de la tarjeta.
- La RLS de 0330, el gate `tenantAdminGate` (SDD-0498) y la RPC anon `public_carrier_tariffs`.
- La regla de SDD-0236: la venta no se deriva del costo.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 | **no conformidad** en el estado actual → se corrige con 0491 | §2 (`aud-01.md:25`, `:27`): eliminar/restaurar y configuración sensible. §1 (`:15`) atomicidad, §5 (`:75-78`) minimización, §7 (`:115-116`) flujo modificado. Hasta aplicar 0491, cambiar cuál cotiza la web no deja evento (igual que hoy). |
| AUD-02 | no aplica | No cambia quién consulta, retiene ni exporta la bitácora. |
| ERR-01 | cumplimiento | Una escritura que no tocó filas devuelve error con qué pasó y qué hacer; el lote que no cabe dice que no cambió ninguna y que se divida. |
| MP-01 | cumplimiento | Quitar un transportista sigue siendo borrado en blando; ahora sólo si está vivo y es del tenant. |
| SGE-00 | cumplimiento | El permiso sigue en servidor (gate) y en la base (RLS); los filtros nuevos repiten el tenant. |
| BTN-01, TBL-01, FRM-01, A11Y-01, CMP-01 | no aplica | Sin cambios de pantalla ni de componentes. |
| Resto | no aplica | Sin creación contextual, arrastre, fechas, progreso, pasos, archivos, IA, enlaces ni movimiento. |

Datos personales (`.claude/skills/revisar-datos-ve/SKILL.md`, punto 12: el contacto de un
proveedor): la 0491 **no** copia datos del proveedor a la bitácora. La prueba
`sin_copias` del contrato busca las marcas de los textos sembrados en payload, antes, después y
motivo.

## Migración 0491 — NO APLICADA

`supabase/migrations/0491_freight_carriers_auditoria.sql`.

- **Orden:** migrate-first compatible. El código desplegado hoy no lee nada de la 0491 y sus
  escrituras quedan auditadas igual. Se puede aplicar antes o después del merge.
- **Preflight de solo lectura en producción**, sólo de catálogo:
  - `append_audit_event(...)` es SECURITY DEFINER con `search_path` vacío;
  - existen las 10 columnas de `freight_carriers` que lee el trigger;
  - no existen `audit_freight_carrier_change()` ni el trigger `audit_freight_carriers`.
- **Locks:** `CREATE TRIGGER` toma ShareRowExclusiveLock sobre `freight_carriers` hasta el COMMIT.
  Bloquea escrituras, no lecturas: la web sigue cotizando. Usa `lock_timeout` 5 s y
  `statement_timeout` 30 s.
- **Aplicar exige OK nominal de Sam** nombrando `0491_freight_carriers_auditoria` y el runbook
  `docs/runbooks/aplicar-migraciones-prod.md`. Fusionar la PR no autoriza aplicarla. La espera
  está declarada en `supabase/migrations-baseline.json`.

## Allowlist

- `app/studio/(app)/admin/carrier-actions.ts`
- `lib/studio/freight-carriers/queries.ts` (sólo `setDefaultCarrier` y su mensaje)
- `lib/studio/freight-carriers/types.ts` (`MAX_BYTES_FILTRO_LOTE` y `bytesFiltroIn`)
- `app/studio/(app)/admin/__tests__/postgrest-offline.ts` (nuevo: el doble que mide la URL)
- `app/studio/(app)/admin/__tests__/carrier-lote-url.test.ts` (nuevo)
- `app/studio/(app)/admin/__tests__/carrier-actions-escrituras.test.ts` (nuevo)
- `app/studio/(app)/admin/__tests__/carrier-tariff-actions.test.ts` (una carrera nueva)
- `lib/studio/__tests__/freight-carriers-types.test.ts`
- `supabase/migrations/0491_freight_carriers_auditoria.sql` (nuevo, NO APLICADA)
- `supabase/tests/0491_freight_carriers_auditoria.test.sql` (nuevo)
- `lib/studio/__tests__/freight-carriers-auditoria.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (espera declarada de 0491)
- `docs/specs/0539-transportistas-lote-y-auditoria/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0539-transportistas-lote-y-auditoria.md`

## Aceptación

1. Con las 169 rutas de Benito elegidas a la vez, el lote las cambia todas y ninguna petición
   lleva ids. Con 300 ciudades de largo real, ninguna petición pasa de 8.000 caracteres.
2. Si el filtro por ciudad pasa de 6.000 bytes, no cambia ninguna ciudad y la pantalla lo dice.
3. Sigue siendo todo o nada: si una elegida no está viva con ese transportista, no cambia ninguna.
   Las ciudades que no se eligieron no cambian.
4. Editar o quitar un transportista borrado, de otro tenant o inexistente devuelve error y no
   `ok`.
5. Marcar como predeterminado uno borrado, de otro tenant o inexistente devuelve error, y el que
   cotiza la web sigue siendo el mismo.
6. Con 0491 aplicada:
   - cada alta, edición, cambio del que cotiza, retiro y restauración deja un evento AUD-01 con
     banderas, columnas cambiadas y actor;
   - ningún texto del proveedor llega a la bitácora;
   - si el writer falla, la escritura se revierte.

## Verificación (2026-10-16, en el worktree; sin producción)

- **Lote con el cliente real** (`carrier-lote-url.test.ts`, 9 casos). Usa supabase-js de verdad
  con un PostgREST en memoria que mide cada URL y responde 414 por encima de 8.000. Los casos:
  - el doble dispara: 300 uuids reciben el 414;
  - las 169 rutas reales de la 0332 sin ids en la URL;
  - sólo cambian las elegidas;
  - 300 ciudades caben;
  - el borde exacto de 6.000 bytes pasa y 6.001 no escribe nada;
  - todo o nada con una ruta ajena.
- **Escrituras de transportistas** (`carrier-actions-escrituras.test.ts`, 22 casos), con la RLS
  por tenant y el índice de un predeterminado simulados.
- **Carrera nueva** en `carrier-tariff-actions.test.ts`: quitada y vuelta a agregar (32 casos en
  total).
- **`bytesFiltroIn`** comparado byte a byte con la URL que arma supabase-js, con comas, paréntesis,
  acentos, espacios y repetidos (`freight-carriers-types.test.ts`, 37).
- **Control rojo contra `main` `6da8aebc`.** Con las acciones y queries de main:
  - lote: caen 5 de 9;
  - escrituras: caen 15 de 22;
  - carreras: cae 1 de 32;
  - el archivo de SDD-0498 sigue en 8 de 8 y sirve de control.
- **Mutantes del diff de aplicación:** 25 de 25 muertos. Sólo cuenta como muerto un mutante con la
  línea `Tests N failed`. El control verde (108/108) corre antes y después.
- **Migración** (`supabase/tests/0491_freight_carriers_auditoria.test.sql`, 35 aserciones en
  PGlite). Usa el writer real (0267 + 0294), la 0330 real y la 0490 montada. Lo envuelve
  `lib/studio/__tests__/freight-carriers-auditoria.migration.test.ts`, con 19 casos:
  - control rojo;
  - 13 mutantes;
  - 2 drifts del preflight;
  - la espera declarada.

## Estado

- Puntos 1 y 2: implementados en la PR de esta spec, sin fusionar.
- **0491: NO APLICADA.** Hasta que se aplique, el registro de transportistas no deja evento AUD-01
  (igual que hoy). El criterio 6 depende de su aplicación.

## Decisiones de criterio para Sam

1. **Aplicar 0491.** Recomendación: aplicarla con el preflight de catálogo. Es migrate-first
   compatible, así que el orden respecto del merge no importa.
2. **Quitada y vuelta a agregar durante el lote:** la ciudad elegida recibe el precio en su
   tarifa nueva. Si se prefiere que no se toque, hace falta volver al filtro por id, con el límite
   de URL que eso trae.
3. **Tope de 6.000 bytes en vez de partir el lote en varios.** Partirlo rompe el todo o nada.
4. **La bitácora no guarda el nombre del transportista**, sólo su id (AUD-01 §5). Si Sam quiere el
   nombre en el evento, es una decisión de privacidad, no de esta spec.

## Registro de integración (2026-10-16)

- **PR:** #247 (`claude/suspicious-mestorf-43ae11`). Cabeza `814fae85` fusionada con `--match-head-commit`; merge `8761618d` a las 08:16:19Z, con la autorización de Sam, literal: «Ya tienes mi autorización para fusionar la 247 del tarifario».
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38868912939), con la suite y el build. `pnpm verify` local: NO EJECUTADO, porque el CI corre la suite completa.
- **Migración `0491_freight_carriers_auditoria`: APLICADA** en el servidor propio (`dtd-cargo-db-1`), migrate-first, con el OK nominal de Sam, literal: «autorizo aplicar 0491_freight_carriers_auditoria en el servidor propio».
  - Lecturas previas READ ONLY a las ~08:00Z y justo antes de aplicar: «PREFLIGHT 0491 OK».
  - `psql` con la migración y la fila del ledger en una transacción. COMMIT a las 08:16:16Z. Ledger `20261016081616 · 0491_freight_carriers_auditoria`, una sentencia, md5 `22c72cb6…` y 12175 bytes, igual al blob de la cabeza fusionada. Ledger en 495 filas.
  - La PR se fusionó 3 s después del COMMIT, con la espera todavía declarada. La espera se retira en el cierre del Director (PR #245). La cabecera «NO APLICADA» no se corrige.
  - Evidencia: `/srv/ops/evidencias/apply-0491-dtd-cargo-20261016T081616Z/` con `SHA256SUMS`.
- **Publicación:** fue la primera sin Vercel. Vercel está pausado y sin Git desde la madrugada del 2026-10-16.
  - `build-image.yml` construyó `sha-8761618d…` (run 38872581793).
  - La sesión de Contabo la publicó en el VPS con `/srv/ops/web/publicar-web.sh` a las 08:20:24Z: healthy a las 08:20:48Z, 0 reinicios y `smoke-web.sh` 14 PASÓ · 0 FALLÓ.
  - La imagen para volver atrás, `sha-3e0368e0`, queda en el servidor.
  - Evidencia: `/srv/ops/evidencias/publicar-web-8761618d-20261016T082024Z.txt`.
- **Smoke de Sam: PENDIENTE.** Guion en el handoff. El lote se prueba con una o dos ciudades, devueltas después a su precio, nunca con todas: pone el mismo valor en todas las elegidas.
- **Estado:** integrada y publicada. La spec sigue en `in-progress` hasta el smoke.
