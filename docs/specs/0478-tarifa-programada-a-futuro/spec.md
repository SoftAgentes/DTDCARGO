---
sdd: "0478"
title: "Programar la próxima tarifa pública sin dejar el sitio sin tarifa"
status: done
author: "founder + Claude Opus 5"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0255", "0336", "0382", "0458", "0475", "0476"]
confidencialidad: interno
---

# DTD-0478 — Programar la próxima tarifa pública sin dejar el sitio sin tarifa

> Hoy, para dejar cargada la tarifa que rija después del 2026-11-29 hay que
> despublicar la vigente, y hasta el día de arranque el sitio cotiza con una
> constante del código. Con esto, el founder carga la próxima como
> **programada**: el sitio sigue con la actual y, a las 00:05 de Venezuela del
> día de arranque, la base hace el relevo en una sola transacción.

## Contexto

### El hueco

El índice `rates_one_public_cbm_per_tenant_modo` (migración 0255) admite **una**
tarifa pública con precio por modalidad del calculador:

```sql
unique (tenant_id, public_calc_modo)
where is_public and deleted_at is null and per_cbm is not null
```

`public.public_cbm_rate(p_modo)` —la RPC anon de `/tarifas`, `/tarifas/embed` y
`/api/public/cbm-rate`— filtra además `valid_from <= current_date`. Entonces, para
dejar lista la próxima tarifa:

1. marcarla pública choca con el índice («Ya hay otra tarifa marcada como pública
   del calculador»);
2. el único camino es desmarcar la vigente, y desde ese instante hasta el
   `valid_from` de la nueva la RPC no tiene fila. `lib/public/rates-queries.ts`
   devuelve null y el sitio cotiza con `CONFIG.tarifaBaseCBM` de
   `lib/calculadora.ts`: una constante del código, no la base.

Es el mismo tipo de hueco que la SDD-0476 cerró por el lado del vencimiento, pero
en el otro extremo del ciclo. Quedó registrado como FUERA DE ALCANCE nº 1 del
handoff de 0476.

### Lo que hay en producción (2026-09-18)

- La **0458 está aplicada** (ledger `20260918040814 · 0458_tarifa_lectura_sin_vigencia`,
  verificado por el Director y visible en `list_migrations`): la RPC ya no filtra
  por `valid_until`, pero sigue filtrando `valid_from <= current_date` y
  `per_cbm is not null`.
- La tarifa DDP pública es `$850` y vale hasta el **2026-11-29** (datos que el
  Director verificó el 2026-09-17; esta tarea no leyó filas de negocio).
- `pg_cron` está instalado: la 0336 (ledger `20260805215529`) programó con él el
  relevo `$800 → $850` del 2026-09-04, y funcionó.

### La fecha que lo vuelve urgente

La siguiente tarifa tiene que poder cargarse **antes** del 2026-11-29 sin abrir el
hueco. Con la 0458 aplicada el sitio ya no cae al respaldo el día 30 —sigue con
$850 vencida—, pero cualquier cambio de precio preparado con anticipación sigue
exigiendo despublicar.

### Criterio del founder (2026-09-17, textual)

> «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior. Lo
> que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza o no se
> actualiza es un tema del back-end, no tuyo.»

## Alcance

**Entra:**

- La migración `0459_tarifa_programada_a_futuro.sql` (número asignado por el
  Director) y su espera en `supabase/migrations-baseline.json`.
- El Studio: `/studio/tarifas` (drawer, lista, acciones, página) y los tipos y
  consultas de `lib/studio/rate-*`.
- La degradación declarada en `supabase/pending-migration-symbol-declarations.json`.
- Pruebas, esta spec, el índice generado y el handoff.
- **Aplicar la 0459 a producción**, con autorización aparte. Sam la dio nombrándola
  («autorizo aplicar la 0459_tarifa_programada_a_futuro», 2026-09-18) y se aplicó
  con `docs/runbooks/aplicar-migraciones-prod.md` (ver Evidencia). Al quedar
  aplicada, en esta misma rama salen su espera y su degradación: el diff neto
  contra `main` de esos dos archivos queda en cero.

**No entra:**

- El índice singleton de 0255, `public_cbm_rate` (0458), `rates_guard_price_book`
  (0382): no se tocan.
- `lib/calculadora.ts` y `__tests__/calculadora-respaldo-alineado.test.ts`: los
  está corrigiendo otra sesión (`dtdcargo-c9`) por orden del Director.
- El sitio público: no cambia ni una línea. La RPC ya sirve lo que la base diga.
- Auditar las tarifas (ver Gobernanza › AUD-01) y avisar por Telegram cuando un
  relevo no corre (ver Seguimiento).

### Allowlist exacta

| Archivo | Qué |
|---|---|
| `supabase/migrations/0459_tarifa_programada_a_futuro.sql` | nuevo — la migración |
| `supabase/migrations-baseline.json` | sólo la espera `0459_tarifa_programada_a_futuro` |
| `supabase/pending-migration-symbol-declarations.json` | sólo la degradación `sdd-0478-tarifa-programada` |
| `lib/studio/rate-types.ts` | `hoyCaracas`, `programadaBadge`, `programadaErrorMessage`, `publicRateConflictMessage`, `RateInput.publica_programada` y la regla en `validateRateInput` |
| `lib/studio/rate-queries.ts` | `listRateSchedules` y su tipo |
| `app/studio/(app)/tarifas/page.tsx` | lee la ranura en paralelo con la lista |
| `app/studio/(app)/tarifas/actions.ts` | la marca de control, la columna condicional y los mensajes |
| `app/studio/(app)/tarifas/_components/TarifasClient.tsx` | el badge de la programada y las props del drawer |
| `app/studio/(app)/tarifas/_components/RateDrawer.tsx` | la casilla «Programada» y la exclusión con «Pública» |
| `lib/studio/tarifa-programada.migration.test.ts` | nuevo — la 0459 sobre PGlite |
| `lib/studio/__tests__/tarifa-programada.test.ts` | nuevo — tipos, mensajes y consulta |
| `app/studio/(app)/tarifas/actions.programada.test.ts` | nuevo — contrato de las acciones |
| `app/studio/(app)/tarifas/_components/RateDrawer.test.tsx` | los casos de la casilla nueva |
| `docs/specs/0478-tarifa-programada-a-futuro/spec.md`, `docs/specs/README.md` | esta spec y el índice regenerado |
| `.agents/handoffs/0478-tarifa-programada-a-futuro.md` | el handoff |

## Diseño

### Alternativas evaluadas

**(A) Indexar también la fecha de arranque** —
`unique (tenant_id, public_calc_modo, coalesce(valid_from, '-infinity'))`— y
dejar que la RPC elija la de `valid_from` más reciente que ya arrancó.
**DESCARTADA.** No necesita job, pero:

- apaga el aviso de SEGUNDA pública para cualquier par de fechas distintas. Es
  justo lo que el Director pidió preservar, y lo que la 0336 se negó a relajar;
- una segunda pública con fecha **pasada** anterior a la vigente quedaría ignorada
  en silencio, sin error;
- las relevadas seguirían marcadas públicas para siempre: el Studio, el cron de
  vencimiento y el `rateExpiryBadge` tendrían que aprender a distinguir «pública
  que sirve» de «pública que ya no sirve», o el cron avisaría de vencimientos de
  tarifas que el sitio ya no usa;
- el relevo ocurriría a las 00:00 **UTC** (20:00 de Venezuela del día anterior),
  porque lo decidiría `current_date` dentro de la RPC.

**(B) Una ranura PROGRAMADA al lado de la pública, y un relevo atómico.**
**ELEGIDA.** Generaliza lo que la 0336 hizo a mano una vez:

- `rates.publica_programada` marca la tarifa que va a reemplazar a la pública de
  su modalidad el día de su `valid_from`. Mientras espera **no es pública**: la
  RPC no la ve y el sitio sigue con la vigente;
- el singleton queda idéntico: sigue habiendo una sola pública viva por
  modalidad, y el aviso de segunda pública sigue saliendo igual;
- el relevo es una función de la base que despublica la vigente y publica la
  programada **en una transacción**: un lector ve el antes o el después, nunca el
  medio;
- si el job no corre, el sitio sigue con el precio anterior: exactamente el
  criterio del founder.

**(C) No programar: editar el precio el día.** DESCARTADA: exige que alguien lo
haga a medianoche, y es lo que la reserva pidió resolver.

### La migración 0459

1. `set lock_timeout = '5s'` y `set statement_timeout = '60s'`.
2. **Preflight** que aborta si faltan `rates`, `price_books`, el índice de 0255,
   `public_cbm_rate(text)` o `cron.schedule(text,text,text)`.
3. `rates.publica_programada boolean not null default false`: nace en false para
   todas las filas; ninguna fila cambia.
4. **Check** `rates_publica_programada_check`: una programada tiene `per_cbm`
   (la RPC descarta `per_cbm` null), `valid_from` (sin fecha el job no sabría
   cuándo) y no es pública a la vez.
5. **Índice** `rates_one_programada_per_tenant_modo`: una programada por tenant y
   modalidad, para que el job nunca tenga que elegir. Su 23505 es el aviso
   «Ya hay otra tarifa programada».
6. **Guard** `rates_guard_publica_programada_t`:
   - archivar o borrar (`status = 'archived'` o `deleted_at`) **suelta** la
     programación: lo que salió del catálogo no entra solo al sitio;
   - un borrador no se programa: el job sólo promueve publicadas, y un borrador
     programado sería una promesa que nunca se cumple;
   - sólo la lista de la casa, la regla de 0382 aplicada **antes** de que el job
     choque con ella a medianoche.
   Corre después de `rates_guard_price_book_t` (orden alfabético), que ya rellenó
   `price_book_id`.
7. **Relevo** `promover_tarifas_programadas()`: `security definer`,
   `search_path` vacío, EXECUTE sólo para `service_role`. Para cada programada
   publicada, viva y con `valid_from <=` **día de Caracas**: despublica la
   pública **con precio** de su modalidad (las públicas con `per_cbm` null no
   ocupan el singleton y no se tocan) y publica la programada, soltando la marca
   en la misma sentencia. `for update` sobre la programada: si dos corridas se
   cruzan, la segunda la relee ya promovida. Devuelve un resumen jsonb que queda
   en `cron.job_run_details`. No cierra el `valid_until` de la relevada: queda
   como histórico, igual que la 0336 dejó la de $800.
8. **Job** `tarifas-programadas-relevo`, cada hora al minuto 5. La de las 04:05
   UTC es la de las 00:05 de Caracas: la primera del día de arranque. Las demás
   son la red si una corrida falla. `cron.schedule` con nombre actualiza el job
   existente: reaplicar no lo duplica.

**Locks.** `add column` con default constante sólo toca el catálogo. `add
constraint check` toma `ACCESS EXCLUSIVE` breve y escanea `rates` (tabla chica).
`create unique index` no concurrente toma `SHARE` breve. `lock_timeout` de 5 s:
si hay contención, aborta entera en vez de esperar.

**Vuelta atrás.** `cron.unschedule('tarifas-programadas-relevo')`; drop del
trigger, de las dos funciones, del índice y del check; drop de la columna. No hay
datos que restaurar salvo programaciones cargadas después de aplicar.

### El día es el de Caracas

La función decide con `(now() at time zone 'America/Caracas')::date`, no con
`current_date`: `pg_cron` no fija zona de sesión y en Supabase es UTC, así que
`current_date` haría el relevo a las 20:00 de Venezuela del día anterior. El
Studio usa el mismo día (`hoyCaracas`) para validar y para el badge.

Después del relevo la RPC (que sí usa `current_date` en UTC) sirve la nueva sin
hueco: el día de Caracas nunca va por delante del de UTC.

### El Studio

- **Drawer** (`RateDrawer.tsx`). Debajo de «Tarifa pública del calculador», una
  casilla «Programada: reemplaza a la pública en su fecha», con la ayuda «Entra
  sola el día de «Válida desde», a las 00:05 de Venezuela, y reemplaza a la
  pública actual. Hasta ese día el sitio sigue cotizando con la actual.» Las dos
  casillas se excluyen **al marcar**, no al guardar. Sólo aparece para tarifas por
  CBM y, al crear, sólo en la lista de la casa.
- **Validación** (`validateRateInput`, repetida en el servidor): una programada no
  puede ser pública a la vez, tiene que ser por CBM y su «Válida desde» tiene que
  ser **futura** («Para cambiar el precio hoy, edita la tarifa pública.»).
- **Lista** (`TarifasClient.tsx`). La programada lleva «Programada · 30/11» (el
  día en que entra); el día de arranque, «Programada · hoy»; si su día pasó y
  sigue marcada, «Programada · no entró» en rojo: el relevo no corrió y el sitio
  sigue con la anterior. Los textos van en la columna «Servicio» de 170px y se
  **midieron** en Nunito Sans 700 a 10,5px: el más largo, «Programada · sin
  fecha», ocupa 146px. La primera versión («Programada · entra el 30/11», 173px)
  desbordaba y la corrigió `/ui-check`.
- **Mensajes.** El aviso de segunda pública sigue y, con la ranura disponible,
  dice cómo cargar la próxima sin quitar la vigente. Los rechazos de la 0459
  (índice, check, borrador, aliado) se traducen a qué hacer. El aviso viejo pasa
  de voseo («Desmarcá») a tuteo («Desmárcala»).

### Degradación y orden: migrate-first

`publica_programada` nace con la 0459. Si el Studio la nombrara en
`RATE_COLUMNS`, desplegarlo antes que la migración rompería `/studio/tarifas`
entera (el mismo riesgo que ya documenta `rate-queries.ts` para 0257). Por eso:

- la ranura se lee en **una consulta aparte** (`listRateSchedules`); si falla, la
  pantalla carga igual y esconde la opción (`disponible: false`);
- el drawer sólo dibuja la casilla y la marca oculta `publica_programada_control`
  con la ranura disponible;
- sin esa marca, `createRate` y `updateRate` **no nombran** la columna.

Está declarado para el gate `pending-migration-symbols` (AMARILLO, con evidencia
en los tres sitios) y probado en `actions.programada.test.ts`. Aun así el orden
previsto es **migrate-first**: aplicar la 0459 y después integrar, para que la
ventana no exista.

## Criterios de aceptación

- [x] Con la 0459, una tarifa **programada** convive con la pública vigente y el
      sitio sigue sirviendo la vigente hasta el día de arranque.
- [x] El día de arranque (día de Caracas) el relevo es atómico: la RPC pasa de la
      vigente a la programada sin un instante sin fila.
- [x] El aviso de SEGUNDA pública sigue funcionando igual (mismo índice, mismo
      23505 que reconoce `isPublicRateConflict`).
- [x] Una sola programada por modalidad; programada ⇒ por CBM, con fecha y no
      pública; borrador y aliado rechazados; archivar o borrar suelta la
      programación.
- [x] Las públicas sin precio de producción no se tocan; las modalidades no se
      cruzan; sin pública vigente, la programada entra igual.
- [x] El Studio permite programar, marca la programada y su atraso, y traduce los
      rechazos. Sin la 0459 no se cae ni ofrece programar.
- [x] La 0459 aplicada en producción con autorización nominal de Sam y verificada
      (ledger, columna, índice, trigger, función y job `tarifas-programadas-relevo`).
      Aplicada el 2026-09-18: ledger `20260918155832`, identidad md5 igual al blob
      revisado. Primera corrida real del job: 2026-09-18 16:05 UTC, `succeeded`, sin
      nada que promover (0 programadas antes y después; la tarifa pública no cambió).

La integración de la PR y el primer relevo real se registran aparte (ver
Seguimiento). No son criterios de esta spec.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| FRM-01 | **cumplimiento** en lo nuevo | Casilla con label persistente y ayuda enlazada (`aria-describedby`); la regla entre campos se valida en el servidor (`validateRateInput`) y en la base (check y guard). La exclusión se previene al marcar en vez de informarse al guardar. El foco al primer error y el resumen son del drawer entero: adopción pendiente de la política, preexistente |
| ERR-01 | **cumplimiento** | Error de campo debajo del campo en edición (`FieldError`); rechazos de la base traducidos a qué pasó y qué hacer, sin SQL (`programadaErrorMessage`) |
| VIS-02 | **cumplimiento** | Copy en tuteo; se corrige el voseo del aviso de segunda pública |
| A11Y-01 | **cumplimiento** | `label htmlFor` + `aria-describedby`; los badges llevan texto, no sólo color |
| MP-01 | **no aplica** | No cambia la permanencia ni la fricción de archivar o borrar tarifas. El guard sólo suelta la programación al archivar o borrar |
| BTN-01 | **no aplica** | No hay botón nuevo: se guarda con el de siempre |
| CMP-01 | **cumplimiento** | Sin componentes nuevos: `Badge` y el patrón de casilla del propio drawer |
| AUD-01 §2 | **no conformidad preexistente**, extendida | `rates` no es entidad de auditoría: ni la edición del Studio ni el relevo de la 0336 dejan evento. El relevo nuevo tampoco: deja su resumen en `cron.job_run_details`, que **no** es un evento AUD-01. Registrarlo exige dar de alta la entidad `rate` en el catálogo y auditar también las ediciones del Studio: tarea propia (ver Seguimiento) |

## Evidencia

Todo en el worktree `codex/tarifa-programada-a-futuro`, sin leer filas de
negocio de producción. Detalle y SHA en el handoff.

- **`lib/studio/tarifa-programada.migration.test.ts`**: el `.sql` real sobre PGlite,
  con el índice de 0255, el guard de 0382, la RPC de 0458 y los privilegios por
  defecto de Supabase. 19 casos, incluido un **control rojo** sin la 0459 (la
  próxima pública choca con el singleton y despublicar la vigente deja la RPC sin
  fila).
- **Mutantes del `.sql`**: 23, 21 muertos con PGlite. Sobrevive el `grant` a
  `service_role`, que es equivalente (los defaults de Supabase ya se lo dan; se
  conserva explícito como en la 0336). También sobrevive el `for update`, que es
  **lo único que impide que el relevo pise una cancelación del founder**. PGlite
  tiene una sola conexión y no lo puede medir. **Ningún test del repo lo cubre.**
- **Reproducción manual de esa carrera** (2026-09-18, `postgres:17` desechable, dos
  sesiones): el founder desprograma la tarifa mientras corre el relevo. Con el
  `.sql` real, el relevo espera el bloqueo y respeta la cancelación: el sitio
  sigue en $850. Con el mutante sin `for update`, publica la cancelada: $900.
  Los scripts y la tabla están en el anexo del handoff 0478.
- **Studio**: `tarifa-programada.test.ts`, `actions.programada.test.ts` y los casos
  nuevos de `RateDrawer.test.tsx`. **Mutantes**: 13, 13 muertos.
- **Gate** `pending-migration-symbols`: 0 ROJO · 1 AMARILLO declarado mientras la
  0459 estuvo pendiente; con la 0459 aplicada, 0 ROJO · 0 AMARILLO.
- **Aplicación en producción (2026-09-18)**, con OK nominal de Sam y ventana
  exclusiva confirmada por el Director. El preflight de catálogo mostró las
  dependencias presentes y ningún objeto nuevo existente. `apply_migration`
  devolvió `success`. El ledger quedó en `20260918155832`, con 1 sentencia de
  13.483 bytes, md5 `ed65e847…` igual al blob. El postflight de catálogo coincide
  con el archivo, sin ninguna fila programada. La lectura del cliente no cambió
  (`public_cbm_rate('ddp')` = 850/50/2026-11-29, consolidado 580, `/tarifas`
  cotiza 850) y los advisors quedaron idénticos a la foto previa.

## Riesgos

- **El job no corre** (pg_cron caído o deshabilitado): el sitio sigue con el
  precio anterior —el criterio del founder— y el Studio marca «Programada · no
  entró». Nadie avisa fuera del Studio hasta que exista el aviso de Seguimiento.
- **Una hora de retraso como máximo** si falla la corrida de las 00:05: la
  siguiente lo repite.
- **La modalidad Consolidado** no se puede crear desde el drawer (el alta nace
  `ddp`, como hoy): programar el consolidado exige editar una tarifa existente de
  esa modalidad. Hoy nunca vence (`valid_until` null). Sin cambio respecto de hoy.

## Fuera de alcance

- Auditar tarifas (AUD-01): entidad `rate` en el catálogo y eventos para
  ediciones del Studio y relevos del job.
- Avisar por Telegram/correo cuando una programada no entró, dentro del cron
  `rate-expiry-alert` que ya existe.
- `CONFIG.tarifaBaseCBM` y sus tests: de otra sesión.

## Seguimiento

1. ✅ **0459 aplicada** (2026-09-18, ledger `20260918155832`) y verificada. En la
   misma rama salen la espera de `migrations-baseline.json` y la degradación de
   `pending-migration-symbol-declarations.json`. La cabecera del `.sql` sigue
   diciendo «NO APLICADA» y **no se edita**: rompería la identidad md5 contra el
   ledger, igual que en la 0255 y la 0473.
2. ⬜ **Integrar la PR** — Director.
3. ⬜ **PENDIENTE: test automático de concurrencia del `for update`.** Es la única
   defensa contra que el relevo pise una cancelación del founder, y hoy solo está
   probada a mano. Hace falta una prueba de dos sesiones contra Postgres real que
   mate al mutante sin `for update`. Queda a nombre del Worker de esta spec y se
   formaliza como tarea aparte. Base: los scripts del anexo del handoff 0478. Que
   esta spec diga `done` no cierra este hueco.
4. ⬜ Cargar la tarifa que rija después del 2026-11-29 como **programada** antes de
   esa fecha, y verificar el primer relevo real en `/api/public/cbm-rate`.
