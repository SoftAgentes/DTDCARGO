# Handoff 0539 · Transportistas: lote sin ids en la URL, escrituras honestas y auditoría

- Fecha: 2026-10-16 (Caracas = UTC − 4)
- Owner/sesión: `suspicious-mestorf-43ae11` (Claude Code, Worker). Claim del harness tomado al
  empezar y liberado al cerrar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/suspicious-mestorf-43ae11`
- Rama: `claude/suspicious-mestorf-43ae11`, base `main` `6da8aebc`
- SDD: [0539](../../docs/specs/0539-transportistas-lote-y-auditoria/spec.md), `in-progress`. El
  número lo asignó el Director.
- Migración: **0491** `0491_freight_carriers_auditoria.sql`, **NO APLICADA**. Al empezar, ninguna
  ref ni worktree tenía migraciones 0491–0499.
- Permisos usados: commits locales, push de mi rama a sí misma y la PR en borrador contra `main`
  (el encargo pide PR sin fusionar; el Director pidió borrador porque `main` está congelado).
- No hice merge, no toqué producción, no leí filas y no apliqué migraciones. Tampoco corrí
  `pnpm verify` ni Docker.

## Reserva de la SDD (y la 0541 liberada)

- `sdd:next` sin reservar decía 0539.
- Otra sesión reservó la 0540 (`entorno-prueba-staging`) a las 03:06:52 −04:00, y mi
  `sdd:next --reserve` de las 03:07:38 −04:00 sacó la **0541**. El script reserva el máximo + 1,
  no el primer hueco.
- El Director confirmó la 0539. La reservé con `prepareReservation('0539', …)` del mismo script:
  commit `8d2b96ed`, lock `refs/dtd/reservations/0539`, rama
  `codex/sdd-reserve-0539-transportistas-lote-y-auditoria`. Está local y sin publicar.
- **Descarte de la 0541, autorizado por el Director** («Libera tú la reserva 0541; […] autorizo
  descartarla porque fue un error de reserva»). Hice las tres comprobaciones que pidió antes de
  borrar:
  1. `git ls-remote origin | grep 0541`: sin coincidencias, así que no estaba publicada.
  2. `git diff --stat adf9c26f^ adf9c26f`: sólo
     `docs/specs/0541-transportistas-lote-y-auditoria/spec.md`, 16 inserciones. Era el stub, sin
     trabajo.
  3. Ningún worktree tenía `docs/specs/0541-*`. Recorrí los 50 y el mismo bucle sí encontró la
     0539 en este worktree, como control.
- Borré `codex/sdd-reserve-0541-transportistas-lote-y-auditoria` y `refs/dtd/reservations/0541`,
  los dos en el **SHA `adf9c26f`**, a las 2026-10-16T07:09:32Z.
- Después, `sdd:next` volvió a dar `spec siguiente: 0541`.

## OBJETIVO ORIGINAL

Cerrar los tres pendientes de la SDD-0537 (Studio › Administración › Calculadora pública ›
Transportistas):

1. **El lote no puede mandar los ids en la URL.** Con 300 ids medía unos 11,7 KB, y tiene que
   seguir siendo todo o nada.
2. **`saveCarrierAction` no puede responder `ok` sin guardar.**
3. **Evaluar con AUD-01 la auditoría de `freight_carriers`.** Si hace falta, la migración queda NO
   APLICADA y declarada como espera.

## COMPLETADO

**1. El lote** (`bulkUpdateTariffPricesAction`)
- La lectura trae `id, city_slug` de todas las tarifas vivas del transportista, sin lista en la
  URL, y exige que estén todas las elegidas. Si falta una, no cambia ninguna.
- El UPDATE es una sola sentencia con `city_slug=in.(…)` dentro de tenant + transportista + vivas.
  El índice único vivo de 0330 garantiza una tarifa por ciudad.
- `bytesFiltroIn()` mide el filtro igual que supabase-js. Si pasa de `MAX_BYTES_FILTRO_LOTE` =
  6.000 bytes, no se escribe nada y la pantalla dice «Son demasiadas ciudades… divide la
  selección».
- Medido: las 178 ciudades del catálogo dan un filtro de 2.214 bytes, y las 169 rutas de Benito,
  un UPDATE de menos de 2.600.

**2. Escrituras honestas en `freight_carriers`**
- `saveCarrierAction`:
  - edita sólo fila viva del tenant, con `.select("id")`, y no reescribe `tenant_id`;
  - con cero filas responde «Ese transportista ya no está activo…»;
  - en el alta con «predeterminado», si no vuelve el id, lo dice.
- `setDefaultCarrier`:
  - comprueba que el nuevo esté vivo **antes** de bajar al anterior;
  - el UPDATE que lo marca exige `deleted_at is null` y devuelve la fila.
  - Antes, con un id borrado, la web se quedaba sin transportista y la acción decía `ok`.
- `deleteCarrierAction`: el mismo arreglo. Lo incluí porque es el mismo defecto, y
  `setDefaultCarrier` es el segundo paso de `saveCarrierAction`.

**3. AUD-01 → migración 0491 (NO APLICADA)**
- La evaluación da que sí hace falta: `is_default` decide qué transportista cotiza la web
  (`0330:300`). Es «configuración sensible» (`aud-01.md:27`), y quitar y restaurar son eventos
  obligatorios (`aud-01.md:25`).
- Trigger `audit_freight_carriers` AFTER INSERT/UPDATE/DELETE, que llama al writer real en la
  misma transacción, con los eventos:
  - `freight_carrier_created`, `_updated` y `_default_changed`;
  - `_deleted` y `_restored`, con motivo fijo.
- Antes y después llevan **sólo banderas**, y `payload.changed_fields` nombra las columnas que
  cambiaron. No copia nombre, razón social, RIF, contacto ni notas (AUD-01 §5). El contacto de un
  proveedor es dato personal (revisar-datos-ve, punto 12) y la bitácora es de solo agregar.
- Queda declarada como espera en `supabase/migrations-baseline.json`.

**El doble que mide la URL** (`app/studio/(app)/admin/__tests__/postgrest-offline.ts`)
- Un PostgREST en memoria detrás del cliente **real** de supabase-js, con un `fetch` propio.
- Mide cada petición, responde 414 por encima de 8.000 caracteres y aplica `eq`, `neq`, `is.null` e
  `in` también en las escrituras.
- Simula la RLS por tabla, revierte las violaciones de índice (409/23505) y rechaza los operadores
  que no conoce.

## VALIDACIÓN

Corrió sobre esta rama, con los commits de abajo. El commit de cierre sólo agrega este handoff y la
spec.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `carrier-lote-url.test.ts` (cliente real + URL) | PASÓ | 9/9 |
| `carrier-actions-escrituras.test.ts` | PASÓ | 22/22 |
| `carrier-tariff-actions.test.ts` (con la carrera nueva) | PASÓ | 32/32 |
| `carrier-actions-usuario-suspendido.test.ts` (SDD-0498, sin cambios) | PASÓ | 8/8 |
| `freight-carriers-types.test.ts` | PASÓ | 37/37 (6 nuevas de `bytesFiltroIn`, comparadas con la URL real de supabase-js) |
| Área admin + tipos + las dos migraciones PGlite + `rbac-action-scan` + `rbac-guard-gates-con-tenant` | PASÓ | 15 archivos, 266/266 |
| RBAC `rbac-actions-guard`, `rbac-action-scan`, `rbac-guard-gates-con-tenant` | PASÓ | 502/502; el inventario sigue en 433 |
| PGlite `freight-carriers-auditoria.migration.test.ts` | PASÓ | 19/19: «TEST 0491 GREEN: 35 aserciones», control rojo, 13 mutantes, 2 drifts y la espera declarada |
| PGlite `carrier-tariffs-auditoria.migration.test.ts` (0490) | PASÓ | 15/15 |
| Control rojo de la app contra `main` `6da8aebc` | PASÓ | Con las acciones y queries de main caen: lote 5/9, escrituras 15/22 y carreras 1/32. El de SDD-0498 queda 8/8, que es el control. |
| Mutantes de las líneas del diff de la app | PASÓ | 25/25 muertos (acciones 15, queries 6, tipos 4). Sólo cuenta como muerto un mutante con `Tests N failed`. El control verde (108/108) corrió antes y después. |
| `tsc --noEmit` | PASÓ | exit 0 |
| `eslint` de los 9 archivos tocados | PASÓ | exit 0 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ | `0 ROJO · 0 AMARILLO`, exit 0: la app no usa símbolos de la 0491 |
| `pnpm docs:check` | PASÓ | 525 specs sincronizadas |
| `pnpm sdd:check` | PASÓ | `numbering: sin números repetidos` (sólo choques históricos ya aplicados) |
| `pnpm governance:check` | PASÓ | 28 políticas, cápsula vigente |
| `spec-migration-refs.test.ts` | PASÓ | 5/5: toda migración citada en la spec existe |
| `git diff --check` | PASÓ | sin espacios sobrantes ni conflictos |
| `pnpm knowledge:status` | NO DISPONIBLE (INVALID) | el worktree no tiene `graphify-out/`, así que estructura y semántica salen INVALID por falta de derivados, no por este cambio. Ninguno de los 40 `missing-link-target` es de la 0539 o la 0491. |
| `pnpm verify` completo | NO EJECUTADO | el encargo pide no correrlo sin turno del Director |
| `run-sql-tests` (Docker) del contrato 0491 | NO EJECUTADO | sin turno para Docker; el mismo `.test.sql` pasó en PGlite |
| Revisión en navegador | NO APLICA | no hay cambios de pantalla |
| `migrations-applied` | NO EJECUTADO | consulta el ledger de producción; 0491 es una espera declarada |

## COMMITS

- `0c4f4572` chore(sdd): la reserva de SDD-0539 (cherry-pick del stub `8d2b96ed`)
- `e2bc78e5` fix(studio): el lote de precios ya no manda los ids en la URL (con el doble que la mide)
- `69d1a4b6` fix(studio): las escrituras de transportistas no dicen ok sin guardar
- `ecca9adb` feat(db): la migración 0491, con su contrato SQL y el envoltorio PGlite
- El commit que contiene este documento: la spec, el índice y este handoff

`carrier-actions.ts` se partió entre `e2bc78e5` (sólo el lote) y `69d1a4b6` (transportistas). La
versión intermedia pasó sola sus pruebas: 86/86 (lote, carreras, SDD-0498 y tipos).

## PR / BRANCH

- Rama `claude/suspicious-mestorf-43ae11` contra `main`, PR **en borrador** y sin fusionar. El
  enlace va en el informe al Director: lo agrego aquí cuando haga falta otro commit, para no
  gastar un push sólo en eso.

## PENDIENTES DE ESTA TAREA

1. **Aplicar 0491.** Requiere el OK nominal de Sam (`0491_freight_carriers_auditoria`) y el runbook
   `docs/runbooks/aplicar-migraciones-prod.md`, en el servidor propio.
   - Antes, el Director hace el preflight de solo lectura del catálogo: `append_audit_event`
     SECURITY DEFINER con `search_path` vacío, las 10 columnas de `freight_carriers`, y que no
     existan ni la función ni el trigger.
   - Es migrate-first compatible.
   - Al aplicarla se retira su entrada de `pendingBelowCutoff`. La cabecera «NO APLICADA» no se
     corrige: el ledger guarda el texto exacto.
2. Correr el contrato 0491 en Docker (`run-sql-tests`) cuando el Director dé turno, o dejar que lo
   cubra el CI.
3. Hacer el smoke de Sam (abajo) después del deploy.
4. Pasar la SDD a `done` cuando 0491 esté aplicada y el smoke salga bien (criterio 6).

## Smoke para Sam

- Rol: **admin** activo del tenant DTD.
- Pantalla: **Studio › Administración › PRO › Calculadora pública › pestaña Transportistas**
  (`/studio/admin?section=calculadora&tab=transportistas`).

⚠️ El lote pone **un mismo valor** en todas las ciudades elegidas. No lo pruebes en producción con
todas las ciudades marcadas: borraría los costos o ventas distintos de cada ciudad. El lote grande
(169) se prueba en el entorno de prueba (SDD-0540) o con una decisión tuya aparte.

1. **Lote sin cambiar datos:**
   - busca dos ciudades que tengan el **mismo costo** hoy (por ejemplo, dos de $80,00);
   - márcalas, pulsa «Cambiar precios», escribe ese mismo costo en «Costo nuevo» y pulsa
     «Aplicar a 2 ciudades».
   - Tiene que salir un solo toast «Precios actualizados en 2 ciudades de Benito» y la selección
     se limpia. Es falla si sale un error o si cambia otra ciudad.
2. **La web sigue cotizando:** en una pestaña privada abre `https://dtdcargo.com/tarifas` y cotiza
   una de esas dos ciudades. El precio de venta es el mismo de antes y el costo no se ve.
3. **Cambiar el que cotiza la web.**
   - Si hay más de un transportista, en la tarjeta del otro pulsa «Que este cotice la web»: queda
     marcado y Benito deja de cotizar. Repite en la tarjeta de Benito para volver.
   - Si sólo existe Benito, el botón no aparece y este paso es NO APLICA.
4. **Con 0491 aplicada,** en Administración › Auditoría filtra la entidad `freight_carrier`.
   - El paso 3 deja un `freight_carrier_default_changed` por cada tarjeta que cambió, con tu
     usuario.
   - Las tarifas del paso 1 siguen dejando sus `carrier_tariff_updated` (0490).
   - Es falla si un evento de `freight_carrier` muestra el contacto, el RIF o la razón social.

Es falla, en general, si el lote cambia una ciudad que no marcaste, si una acción responde «ok» y
la tabla no cambió, o si un usuario que no es admin ve las casillas o el botón de la tarjeta.

## Impacto documental y conocimiento

- Documentos canónicos: la spec SDD-0539, el índice `docs/specs/README.md` (generado) y este
  handoff.
- No modifiqué la spec ni el handoff de la 0537. Los pendientes que quedaron ahí se resuelven
  aquí; el Director puede anotar el enlace a la 0539 en el cierre de la 0537.
- No toqué fuentes de `semanticPilot` ni del mapa Archify: no aplica recibo semántico ni
  `knowledge:visual`.
- Graphify estructural: no lo corrí en el worktree. El Director lo actualiza desde `main` después
  de integrar. El resultado de `knowledge:status` va en la tabla del cierre.

## FUERA DE ALCANCE DETECTADO

1. **`sdd:next --reserve` reserva el máximo + 1, no el primer hueco, y dos sesiones que reservan
   casi juntas se pisan.**
   - La 0540 se reservó a las 03:06:52 −04:00 y la mía, a las 03:07:38 −04:00, salió 0541. La
     0539 quedó de hueco.
   - Está en `scripts/next-number.mjs`: `nextFree` hace `Math.max(...taken) + 1`.
   - Nada avisa que el número que mostró la corrida anterior ya no es el que se reserva.
2. **`setDefaultCarrier` sigue siendo dos sentencias.** Si borran al transportista nuevo entre la
   lectura y el UPDATE que lo marca, el anterior queda bajado y la web sin transportista. Ahora la
   acción lo dice con un error, pero no lo evita. Cerrarlo exige una RPC que haga las dos cosas en
   una transacción.
3. **`bulkUpdateTariffPricesAction` lee todas las tarifas vivas del transportista.** PostgREST
   corta en `db-max-rows = 1000` sin avisar (medido en
   `.agents/handoffs/2026-08-17-tope-mil-filas-y-gate-honesto-close.md:22`). Con más de 1.000
   rutas vivas, un lote que incluya las de más allá de ese corte falla cerrado («No se cambió
   ninguna»). Hoy hay 169.
4. **El lote de Almacén CN también pasa la selección por la URL.**
   `app/studio/(app)/cn/actions.ts:821` y `:886` filtran con `.in("id", receiptIds)`, con
   `MAX_BULK_RECEIPTS = 100` (`:783`). Son unos 3,9 KB, por debajo del techo: hoy no es un
   defecto, pero quien suba ese tope choca con el mismo límite. El borrado de embarques no tiene
   el problema: va por la RPC de la 0476, con la lista en el cuerpo.

## HANDOFF AL DIRECTOR

- Siguiente acción:
  1. revisar la PR en borrador;
  2. pedirle a Sam el OK nominal de `0491_freight_carriers_auditoria`;
  3. hacer el preflight de catálogo y aplicar;
  4. retirar la espera del baseline;
  5. fusionar cuando se levante la congelación de `main`;
  6. hacer el smoke.
- La PR se puede fusionar sin la 0491, porque la app no depende del trigger. Hasta aplicarla, el
  registro de transportistas sigue sin evento AUD-01, igual que hoy.
- Contratos compartidos:
  - `supabase/migrations-baseline.json` (una entrada nueva);
  - `docs/specs/README.md` (índice generado: si choca con otra PR, se regenera).
- No hay sesiones consumidoras de este worktree. Libero el claim al terminar la escritura.
