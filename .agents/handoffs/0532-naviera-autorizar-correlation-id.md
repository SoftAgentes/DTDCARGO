# Handoff · SDD-0532 · Autorizar consolidación Naviera: correlation_id dentro de 128

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 |
| Task ID | naviera-autorizar-correlation-id |
| Owner | Worker Claude (claim `claude-nervous-leakey-ff74c7`, se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\nervous-leakey-ff74c7` |
| Rama | `claude/nervous-leakey-ff74c7` |
| Base | `origin/main@a8d99acf` (#223) |
| SDD | [0532](../../docs/specs/0532-naviera-autorizar-correlation-id/spec.md) · `in-progress` · reserva `codex/sdd-reserve-0532-naviera-autorizar-correlation-id` (local, sin publicar; cherry-pick `923ccaca`) |
| Migración | `0482_naviera_autorizar_correlation_id.sql` · **NO APLICADA** · espera en `pendingBelowCutoff` |
| PR | __PR__ |
| Estado de tarea | lista-para-revisión (PR draft, sin fusionar) |

## OBJETIVO ORIGINAL

El hallazgo venía sin verificar, anotado por el Worker de la SDD-0530 el 2026-10-15: autorizar una
solicitud de consolidación de Naviera (SDD-0232) podría fallar siempre en producción, porque el
correlation_id que arma la 0322 con la referencia de la pantalla pasa los 128 caracteres que admite
el writer de auditoría. Se pidió:

1. Reproducirlo con el contrato SQL real (PGlite o Docker, con `append_audit_event` y su CHECK de
   verdad) y medir los largos.
2. Si se confirma, corregir en el lugar correcto y justificarlo en la spec. Si es SQL, en una
   migración nueva con el siguiente número libre después de 0476–0481.
3. Leer producción sólo de catálogo, sólo si hace falta y con OK del Director. Sin filas de negocio.
4. Pruebas con control rojo y mutantes; spec y handoff con FUERA DE ALCANCE DETECTADO.
5. PR contra main sin fusionar (merges congelados hasta el corte de Vercel al servidor propio). Sin
   `pnpm verify` completo sin turno del Director.

## COMPLETADO

### 1. Reproducción: CONFIRMADO

- **La referencia de la pantalla mide 109 siempre.**
  - Se arma en `NavieraClient.tsx:706-707` como
    `naviera-consolidation-authorization:${c.id}:${crypto.randomUUID()}`.
  - No interviene el código de contenedor ni otro dato variable: las tres partes tienen largo fijo
    (36 + 36 + 1 + 36).
  - Por eso «el código de contenedor más largo posible» no cambia la medida.
- **Con la 0322 el correlation_id mide 174.** Lo arma `0322:232-234`: 28 + 36 + 1 + 109.
- **El writer real lo rechaza.** La cadena es `append_audit_event` (0294) →
  `append_audit_event_v1` (0267). La regex en `0267:542-545` y el CHECK en `0267:318-322` admiten
  128.
- **Ningún cambio posterior lo arregla.** Ninguna migración redefine el writer ni la RPC. Lo revisé
  en `supabase/migrations` y en todas las ramas `origin/codex/*` y `origin/claude/*`.
- **Medido en PGlite 0.5.8** con el preludio del contrato 0267, las migraciones reales 0267, 0294 y
  0322, y la fixture Naviera del contrato 0322 sin su writer simulado:
  - con la referencia corta `naviera-auth-0001` (17 caracteres, correlation de 82): autoriza;
  - con la referencia de la pantalla (109, correlation de 174): `22023 audit: correlation_id
    inválido`;
  - después del fallo, la solicitud sigue `solicitada`, sin `ref`, sin `authorized_by` y sin AUD-01:
    la reversión es completa.
- **El umbral es 64.** Cualquier referencia de 64 caracteres o más falla, aunque la RPC acepte hasta
  128.
- **Por qué no lo vio el contrato 0232:** su `append_audit_event` es un doble sin validación
  (`supabase/tests/0322_…test.sql:55-78`) y usa referencias de 17 caracteres.

### 2. Corrección: migración 0482 en la RPC

La decisión y las alternativas descartadas están en spec §2.

- **El cambio:** `v_correlation` pasa a ser
  `consolidation-authorization:<id>:<md5(request_ref)>`, que mide 97 siempre.
- **Lo que no cambia:** el resto del cuerpo es el de 0322 byte a byte, lo mide una prueba de texto.
  También se conservan la firma, `DEFINER`, el `search_path` vacío, el owner y la ACL, porque
  `CREATE OR REPLACE` los mantiene.
- **La app no cambia.** El orden respecto del despliegue es indiferente.
- **Preflight:**
  - exige el md5 de `prosrc` de 0322: `e65455c17974c8b3ec78044085bca67e` (CRLF→LF) o
    `18176835d747fcf8fb49a639579b27f3` (sin `\s`);
  - exige `prosecdef` y `proconfig = {search_path=""}`.
- **Postflight:** exige el cuerpo `0f32f8450b38871530ae75e388f04c00`, `DEFINER`, el `search_path`,
  owner `postgres` y EXECUTE sólo para `authenticated`.
- Queda declarada como espera en `supabase/migrations-baseline.json`, con el texto que el operador
  tiene que leer antes de aplicar.

### 3. Pruebas

- `supabase/tests/0482_naviera_autorizar_correlation_id.test.sql`: contrato con el writer real.
  - Monta la plataforma mínima que exige el preflight de 0267, más 0267, 0294, 0322 y 0482.
  - Escenarios:
    1. el writer rechaza un correlation de 129;
    2. la referencia de la pantalla (109) autoriza;
    3. el replay no escribe otro AUD-01;
    4. la referencia de 64 autoriza;
    5. la de 128 autoriza;
    6. el comentario de la RPC nombra la SDD-0532.
  - Cierra con `TEST 0482 GREEN: 26 aserciones`.
- `app/studio/(app)/naviera/__tests__/autorizar-correlation-id.migration.test.ts`: envoltorio Vitest
  que corre ese contrato en PGlite. Son 26 casos:
  - **Texto:**
    - el cuerpo es el de 0322 salvo `v_correlation`;
    - las huellas son las de esos cuerpos;
    - la fixture es la del contrato 0322;
    - la referencia es la de la pantalla y mide 109;
    - los timeouts están;
    - la espera está en el baseline.
  - **Verde** con 0482.
  - **Control rojo:** sin 0482 cae con `audit: correlation_id inválido`.
  - **Mutantes coherentes**, cada uno con el md5 de su propio cuerpo en el postflight:
    - la referencia cruda (como la 0322) y sha256 (129 caracteres) caen con
      `audit: correlation_id inválido`;
    - truncar a 128, quitar el id y hacer md5 de todo el correlation caen en la aserción del valor
      esperado;
    - md5 en `payload.request_ref` cae en la aserción del payload;
    - sin el comentario cae en la aserción del catálogo.
  - **Deriva en producción**, simulada sobre 0322:
    - otro cuerpo, sin `DEFINER` o sin `search_path`: aborta el preflight;
    - EXECUTE para anon o service_role, authenticated sin EXECUTE, u otro owner: aborta el
      postflight;
    - una deriva sólo de espacios se acepta.
  - **0482 alterada en tránsito** (otro cuerpo sin recalcular su md5, sin `DEFINER` o sin
    `search_path`): aborta el postflight.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Reproducción PGlite con writer real (script del scratchpad, sin commit) | PASÓ: 109 → 174 → 22023, reversión completa; la referencia corta autoriza |
| `vitest run app/studio/(app)/naviera/__tests__/autorizar-correlation-id.migration.test.ts --reporter=verbose` | PASÓ: 26/26, ninguno omitido |
| Barrido de mutantes externos sobre los guardas de 0482 (archivo en disco, envoltorio completo por mutante) | PASÓ: control sin mutar 26/26; 15/15 mutantes MUERTOS (preflight: md5, alternativa sin espacios, prosecdef, proconfig, aborto por ausencia; postflight: prosecdef, proconfig, owner, md5, authenticated, anon, service_role; sin timeouts; sin comentario; referencia cruda sin recalcular md5). Se invocó `node node_modules/vitest/vitest.mjs` sin shell: la primera corrida con `shell: true` dio exit 255 sin línea `Tests` en los 15 por el `(app)` sin comillas y no se contó como muerte. Script en el scratchpad de la sesión, sin commit |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado con 508 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos (los ⏸ son choques históricos ya aplicados) |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO. La 0482 no crea símbolos nuevos |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ: 28 políticas, cápsula vigente |
| `eslint` y `tsc` sobre el archivo nuevo | PASÓ: `eslint` del archivo nuevo, exit 0; `tsc --noEmit -p tsconfig.json`, exit 0, con el archivo nuevo incluido (`--listFilesOnly`) |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el encargo lo prohíbe sin turno del Director. El diff no toca código de producto: son SQL, prueba, baseline y docs |
| `sql-tests` en Docker (`postgres:17`) del contrato 0482 | NO EJECUTADO: sin turno de Docker. Lo cubre el envoltorio PGlite, que corre el mismo `.sql` |
| `schema-rebuild` | NO EJECUTADO: es parte de `verify` |
| Lectura de catálogo en producción | NO EJECUTADO: no hizo falta para reproducir y requiere OK del Director. Es necesaria antes de aplicar (ver abajo) |

Lección registrada: el md5 «sin espacios» que medí primero (`3730b203…`) estaba mal. El heredoc del
shell se comió la barra de `'\s'`, así que la consulta auxiliar quitó la letra `s` en vez de los
espacios. Lo detectó la prueba de texto, que compara contra el md5 calculado en TypeScript, y la
prueba «deriva sólo de espacios». Desde ahí, los scripts se escriben con Write.

## COMMITS

| SHA | Mensaje |
|---|---|
| `923ccaca` | chore(sdd): reserva SDD-0532 — naviera-autorizar-correlation-id |
| `55542444` | feat(studio): SDD-0532 — migración 0482: correlation_id de la autorización Naviera con md5 de la referencia |
| `9f511ddc` | test(studio): SDD-0532 — contrato 0482 con el writer AUD-01 real y envoltorio PGlite |
| __DOCS_SHA__ | docs: SDD-0532 — spec, índice y handoff |

## PR / BRANCH

- Rama `claude/nervous-leakey-ff74c7` publicada a sí misma.
- __PR__, draft contra `main`, **sin fusionar**: los merges están congelados hasta después del corte
  de Vercel al servidor propio.

## PENDIENTES DE ESTA TAREA

1. **Lectura de catálogo en producción, READ ONLY, por el Director, antes de aplicar.** Sólo
   catálogo, sin filas:

   ```sql
   select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) as md5,
          pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g')) as md5_sin_espacios,
          p.prosecdef, p.proconfig, pg_catalog.pg_get_userbyid(p.proowner) as owner,
          p.proacl::text as acl
   from pg_catalog.pg_proc p
   where p.oid = 'public.authorize_consolidation_governed(uuid,text,text)'::regprocedure;
   ```

   Lo esperado:
   - `md5 = e65455c17974c8b3ec78044085bca67e` (o el sin espacios
     `18176835d747fcf8fb49a639579b27f3`);
   - `prosecdef = t` y `proconfig = {search_path=""}`;
   - owner `postgres`;
   - EXECUTE sólo para `authenticated`. Con el owner `postgres` la ACL esperada es
     `{postgres=X/postgres,authenticated=X/postgres}`.

   Opcional, para confirmar que el writer vivo tiene el tope de 128: el md5 del `prosrc` de
   `append_audit_event_v1` y la definición de `entity_audit_log_correlation_id_check`. En PGlite,
   el cuerpo de 0267 da `4b123fd01f9b6c78b040bedb090df4bf`.
2. **Aplicar `0482_naviera_autorizar_correlation_id` con OK nominal de Sam**, siguiendo
   `docs/runbooks/aplicar-migraciones-prod.md`. Después, retirar la espera del baseline.
3. **Smoke después de aplicar:** en `/studio/naviera`, autorizar una solicitud `solicitada` real con
   motivo. Lo esperado:
   - toast «Contenedor autorizado · DTD-CONSOL-NNNN»;
   - el contenedor queda `consolidando`;
   - un evento `consolidation_authorized` en la auditoría.
4. Marcar la SDD-0532 como `done` cuando se apliquen la 0482 y el smoke.

## FUERA DE ALCANCE DETECTADO

1. **Las otras siete RPC del lote R3 tienen el mismo defecto.** El detalle está en spec §7.
   - **INFERENCIA por aritmética sobre el código, NO REPRODUCIDA.** Es la misma aritmética que
     reproduje para la 0322.
   - Todas arman `<prefijo>:<id>:<request_ref>`, validan la referencia con la regex de 128 y pasan el
     resultado al writer real.
   - Con la referencia de cada pantalla, el correlation_id mide entre 146 y 168:

     | Migración · RPC | Correlation |
     |---|---|
     | 0317 · `mark_claim_offset_paid_in_china_governed` | 154 |
     | 0318 · `clear_customs_filing_governed` | 146 |
     | 0319 · `pay_claim_indemnity_governed` | 158 |
     | 0320 · `complete_tms_route_governed` | 152 |
     | 0321 · `complete_ve_delivery_governed` | 154 |
     | 0323 · `retire_inspection_report_governed` | 168 |
     | 0324 · `cancel_dispatch_order_governed` | 166 |

   - Según REV-SGE-048, las siete están aplicadas desde el 2026-08-01. Si producción corre esos
     cuerpos, siete acciones del Studio fallan siempre desde su pantalla: pagar un claim en China,
     liberar aduana, pagar una indemnización, completar una ruta TMS, entregar en Almacén VE,
     retirar un reporte de inspección y cancelar una OD.
   - La corrección es el mismo patrón de la 0482, con un contrato sobre el writer real.
   - La 0336 (`camionero_pod_v2`) arma el mismo patrón, pero la app no la llama: usa
     `camionero_pod`.
2. **Las Server Actions no reconocen 22023.** El fallo se muestra como «No se pudo autorizar.
   Referencia: …», igual que un error transitorio.
3. **El contrato de la 0322 sigue con su writer simulado.** El nuevo cubre la RPC con el writer
   real. El viejo se conserva como estaba.
4. **La reserva SDD `codex/sdd-reserve-0532-…` es local.** El stub viaja en esta PR. Si se descarta
   la PR, hay que borrar la reserva (ver memoria «borrar reservas SDD cumplidas»).

## Datos personales y credenciales

No aplica `/revisar-datos-ve`: no se capturan, mueven ni borran datos personales. El payload del
AUD-01 no cambia; sólo cambia la forma del `correlation_id`, que ahora lleva un md5 en vez de la
referencia. No se leyó producción. No hay secretos en el diff.

## Impacto documental y conocimiento

- **Canónico actualizado:** spec 0532 nueva e índice `docs/specs/README.md` regenerado.
- **Sin cambios:** AGENTS, runbooks y gobernanza.
- **Graphify, Archify y Obsidian:** NO EJECUTADO en el worktree. `knowledge:status` da `structural: INVALID` (4577 pendientes, 3368 missing) y `semantic: INVALID` (1209 pendientes), porque este worktree no tiene los derivados generados; no es efecto de este diff. La spec y el handoff nuevos entran como fuentes pendientes. Construir el grafo completo aquí sería una corrida pesada sin turno: lo publica el Director desde main integrado, según el runbook de conocimiento.

## HANDOFF AL DIRECTOR

- Defecto confirmado y corregido en una migración que queda en espera.
- La 0482 no necesita despliegue de app: basta aplicarla, con la lectura de catálogo previa del
  pendiente 1.
- **Lo urgente es el FUERA DE ALCANCE 1.** El mismo patrón probablemente rompe siete acciones más del
  Studio en producción desde el 2026-08-01. Propuse una sesión aparte para reproducirlas y
  corregirlas.
- PR draft sin fusionar. No se tocó producción.
