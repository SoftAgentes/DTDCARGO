# Handoff 0537 · Tarifario de transportistas editable por ciudad

- Fecha: 2026-10-15 (cierre 18:55Z = 14:55 Caracas)
- Owner/sesión: `claude-worker-ad23b4a6a6176276d` (Claude Code, Worker subagente)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-ad23b4a6a6176276d`
- Rama: `worktree-agent-ad23b4a6a6176276d` (la asignó el lanzador; no la renombré)
- Base: `main` `5d98ef62`
- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/241 (borrador, contra `main`, sin fusionar)
- SDD: [0537](../../docs/specs/0537-transportistas-tarifas-editables/spec.md), `in-progress`. La
  reservé en local con `sdd:next --reserve` (ref `codex/sdd-reserve-0537-transportistas-tarifas-editables`,
  commit `198190f6`, sin publicar) y la traje con cherry-pick. `sdd:next` propuso **0537** y la
  migración **0490**, igual que el encargo. No toqué la 0536.
- Migración: **0490** `0490_carrier_tariffs_auditoria.sql`, **NO APLICADA**. Las 0483–0489 están
  en la PR #239. Revisé todas las refs y worktrees, y ninguno usa 0490 como migración. El
  `handoffs/0490-reversion-credito-referido.md` es de la SDD-0490, no de una migración.
- Estado de la tarea: lista para revisión.
- Permisos usados: commits locales, push de mi rama a sí misma y la PR en borrador. No hice
  merge, no toqué producción, no leí filas, no corrí migraciones y no corrí suites pesadas.

## Aviso al Director: AUD-01 exige auditoría

Sam pidió que se le avisara con la política y la línea. No tengo una herramienta para mandarle
mensajes al coordinador, así que el aviso quedó en el cuerpo de la PR #241 desde el primer push
(commit `4eb9b5dd`):

- `docs/governance/policies/aud-01.md:27`: son eventos obligatorios los «cambios de permisos,
  roles, acceso, **configuración sensible** y credenciales».
- `aud-01.md:15`: «Una mutación sensible y su evento obligatorio de auditoría son una sola
  operación».
- `aud-01.md:115-116`: «cada flujo nuevo o modificado vuelve a pasar el contrato de esta política».
- El precedente está en la misma pantalla: `0293:48-49` y `0293:511` auditan
  `calculator_settings` y `calculator_cities` como `configuration`. `carrier_tariffs` (0330)
  quedó sin trigger.

## OBJETIVO ORIGINAL

El pedido de Sam: en Studio › Administración › Calculadora pública › Transportistas, editar los
precios y las ciudades del transportista seleccionado (costo 80 / venta 123,60), porque cambiaron
rutas y precios. Por fases: la fase 1 primero (editar por ciudad, agregar una ciudad, quitar una
ruta con confirmación) y la fase 2 si no la retrasa (cambio en lote).

## COMPLETADO

**Fase 1**
- En la tabla del transportista seleccionado, «Editar <ciudad>» abre un panel lateral con:
  - costo /m³ y venta /m³, con el margen en vivo (es una resta);
  - cada cuántos días sale y los días de salida;
  - tránsito, mínimo, venta en ft³ de referencia (avisa si quedó desfasada), condiciones y vigencia.
- «+ Agregar ciudad» sólo ofrece las ciudades de `calculator_cities` que ese transportista todavía
  no tiene. El servidor vuelve a comprobar que la ciudad exista, esté viva y sea del tenant.
- «Quitar <ciudad>» pide confirmación en un `ConfirmDialog` y hace un borrado en blando.
- Las acciones ya no dicen ok cuando no guardaron nada:
  - editar y quitar van acotados a tenant + transportista + fila viva, con `.select("id")`;
  - si tocan cero filas, devuelven error;
  - editar no cambia el transportista, la ciudad ni el tenant;
  - quitar exige el transportista.
- Otros cambios de la pantalla:
  - buscador por ciudad;
  - toast y resaltado de la fila;
  - `?tab=transportistas`;
  - los tokens inexistentes del panel original pasan a los del Studio.

**Fase 2**
- Hay una casilla por fila y una en el encabezado, que marca sólo lo visible con la búsqueda.
- La barra «N ciudades seleccionadas» abre «Cambiar precios en lote»:
  - recibe un costo y/o una venta nuevos, en valor absoluto;
  - muestra el antes y el después de cada ciudad con su margen;
  - avisa cuántas ciudades quedarían con la venta por debajo del costo.
- Es todo o nada. Si alguna de las elegidas ya no está viva, no cambia ninguna. Si hay una carrera
  entre la comprobación y el UPDATE, la pantalla dice cuántas cambiaron.
- No hay multiplicador.

**Migración 0490 (NO APLICADA)**
- Registra `carrier_tariff` en el dominio `configuration`.
- Crea el trigger `audit_carrier_tariffs` (AFTER INSERT/UPDATE/DELETE), que llama a
  `append_audit_event` en la misma transacción.
- Cada evento lleva antes, después, actor del JWT y un motivo fijo cuando se quita o se restaura.
- No cambia filas ni la RLS.
- Queda declarada como espera en `supabase/migrations-baseline.json`.

**Ajustes de `/ui-check`** (los apliqué)
- El margen positivo va en `--ink`. `--success` como texto da 4,33:1 sobre blanco y no pasa AA.
- Los botones de ícono usan las clases del sistema.
- Las casillas tienen un área de toque de 32 px.

## VALIDACIÓN

Todo corrió sobre esta rama, con cabeza `1ab5b76c` más el commit de cierre (spec y handoff).

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `vitest` acciones `carrier-tariff-actions.test.ts` | PASÓ | 31/31 |
| `vitest` pantalla `TransportistasPanel.test.tsx` | PASÓ | 20/20 |
| `vitest` helpers `freight-carriers-types.test.ts` | PASÓ | 31/31 |
| `vitest` área admin (6 archivos, incluye SDD-0498 y CityDrawer) | PASÓ | 112/112 |
| `vitest` PGlite `carrier-tariffs-auditoria.migration.test.ts` | PASÓ | 15/15: el contrato da «TEST 0490 GREEN: 29 aserciones», con control rojo, 9 mutantes, 2 drifts y la espera declarada |
| `vitest` RBAC `rbac-action-scan`, `rbac-actions-guard`, `rbac-guard-gates-con-tenant` | PASÓ | 502/502; el inventario pasa de 432 a 433 con su justificación |
| Control rojo de la app | PASÓ | las pruebas nuevas contra `carrier-actions.ts` de `main` fallan 22/31; contra `TransportistasPanel.tsx` de `main`, 19/20 |
| Mutantes de las líneas del diff de la app | PASÓ | 36/36 muertos; sólo cuenta como muerto un mutante con la línea `Tests N failed` |
| `tsc --noEmit` | PASÓ | exit 0 |
| `eslint` de los archivos tocados | PASÓ | exit 0 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ | `0 ROJO · 0 AMARILLO`, exit 0 |
| `pnpm docs:check` | PASÓ | 520 specs sincronizadas |
| `pnpm sdd:check` | PASÓ | `numbering: sin números repetidos`, exit 0 (sólo choques históricos ya aplicados) |
| `pnpm components:check` | PASÓ | CMP-01 válido |
| `pnpm governance:check` | PASÓ | 28 políticas aprobadas, cápsula vigente |
| `/ui-check` (rúbrica de `.claude/commands/ui-check.md` sobre los 3 archivos de UI) | PASÓ con ajustes | 3 hallazgos corregidos en `1ab5b76c` |
| `pnpm verify` completo | NO EJECUTADO | el encargo prohíbe corridas pesadas mientras corre otro CI |
| `node scripts/run-sql-tests.mjs` (Docker) del contrato 0490 | NO EJECUTADO | no hubo turno para Docker; el mismo `.test.sql` pasó en PGlite |
| Revisión visual en navegador | NO DISPONIBLE | el worktree no tiene `.env` ni base local, y el encargo prohíbe copiarlos |
| `pnpm knowledge:status` | NO DISPONIBLE (INVALID) | el worktree nuevo no tiene `graphify-out/`: estructura y semántica salen INVALID porque faltan los derivados, no por este cambio |
| `migrations-applied` | NO EJECUTADO | consulta el ledger de producción; 0490 es una espera declarada |

## COMMITS

- `5f967a62` chore(sdd): la reserva de SDD-0537 (cherry-pick del stub)
- `4eb9b5dd` docs: la spec y el aviso AUD-01
- `b4c9a64e` feat: las acciones del tarifario dejan de decir ok cuando no guardan, y los helpers
- `457b5a90` feat: editar, agregar y quitar ciudades (pantalla)
- `bfd28235` feat(db): la migración 0490 con su contrato SQL y el wrapper PGlite
- `1bd6c06a` feat: el cambio en lote
- `08dc2ffb` test: se cierran los mutantes vivos
- `1ab5b76c` fix: los ajustes de ui-check
- El commit que contiene este documento: la spec final y este handoff

## PR / BRANCH

- PR #241: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/241
- Base `main`, rama `worktree-agent-ad23b4a6a6176276d`, worktree indicado arriba.

## PENDIENTES DE ESTA TAREA

1. **Aplicar 0490** con OK nominal de Sam (`0490_carrier_tariffs_auditoria`) y el runbook
   `docs/runbooks/aplicar-migraciones-prod.md`, en el servidor propio. Antes, el Director hace un
   preflight de sólo lectura del catálogo:
   - `append_audit_event(...)` es SECURITY DEFINER con `search_path` vacío;
   - existen las 15 columnas de `carrier_tariffs`;
   - no existen ni `audit_carrier_tariff_change()` ni el trigger `audit_carrier_tariffs`.

   Es migrate-first compatible. Al aplicarla se retira su entrada de `pendingBelowCutoff`.
2. Correr el contrato `0490` en Docker (`run-sql-tests`) cuando el Director dé turno, o dejar que
   lo cubra el CI.
3. Hacer el smoke de Sam (abajo) en producción después del deploy.
4. Pasar la SDD a `done` sólo cuando 0490 esté aplicada y el smoke salga bien (criterio 5).

## Smoke para Sam

Rol: **admin** (un usuario con rol `admin` activo del tenant DTD). Pantalla:
**Studio › Administración › PRO › Calculadora pública › pestaña Transportistas**
(`/studio/admin?section=calculadora&tab=transportistas`).

1. La tarjeta «Benito · cotiza la web» queda seleccionada. Arriba de la tabla dice «Tarifario de
   Benito · N ciudades con tarifa».
2. Escribe una ciudad en «Buscar ciudad…» y abre «Editar <ciudad>» (el ícono del lápiz):
   - cambia el costo o la venta y mira que «Margen /m³» cambie mientras escribes;
   - guarda;
   - la fila se resalta en verde con el valor nuevo y sale el toast «Tarifa de <ciudad> actualizada».
3. En una pestaña privada, abre `https://dtdcargo.com/tarifas` y cotiza esa ciudad: tiene que
   salir el precio de venta nuevo. El costo no se ve nunca.
4. Pulsa «+ Agregar ciudad»:
   - la lista sólo muestra ciudades que Benito no tiene;
   - escoge una, pon costo y venta y guarda;
   - aparece en la tabla resaltada en amarillo.
5. Abre «Quitar <esa ciudad>» (el ícono de la papelera):
   - primero pulsa «Cancelar» y la fila sigue ahí;
   - repite, confirma «Quitar ruta» y la fila desaparece.
6. Lote:
   - marca 2 ciudades y pulsa «Cambiar precios»;
   - escribe sólo «Costo nuevo» y revisa el antes → después y el margen de cada una;
   - pulsa «Aplicar a 2 ciudades»; sale un solo toast y la selección se limpia.
7. Con 0490 aplicada: en Administración › Auditoría tienen que aparecer eventos
   `carrier_tariff_updated`, `carrier_tariff_created` y `carrier_tariff_deleted` con tu usuario.

Es falla si una ciudad que quitaste sigue cotizando en `/tarifas`, si el lote cambia una ciudad que
no marcaste o si un usuario que no es admin ve los lápices, las papeleras o las casillas.

## Impacto documental y conocimiento

- Documentos canónicos actualizados: la spec SDD-0537, el índice `docs/specs/README.md` (generado)
  y este handoff.
- No toqué fuentes de `semanticPilot` ni del mapa Archify, así que no aplica un recibo semántico ni
  `knowledge:visual`.
- `docs/governance/README.md` no cambia: ninguna política cambió de estado ni de alcance.
- Graphify estructural no se ejecutó: es pesado y el worktree no tiene derivados. El Director
  actualiza desde main después de integrar.

## FUERA DE ALCANCE DETECTADO

1. **`--success` como color de texto no pasa AA en el tema claro**: da 4,33:1 sobre `#FFFFFF`
   (medido con la fórmula WCAG). Aparece 54 veces en 47 archivos de `app/studio`. Hace falta un
   token de texto verde, como ya existen `--wine-text` y `--danger-text`.
2. **`freight_carriers` tampoco está auditada.** Cambiar cuál transportista cotiza la web
   (`setDefaultCarrierAction`) también es configuración sensible según AUD-01 §2. Haría falta el
   mismo patrón que la 0490, en su propia spec.
3. `saveCarrierAction` (`carrier-actions.ts:104`) hace `update().eq("id").select().maybeSingle()`
   sin revisar si tocó una fila. Es el mismo defecto que esta tarea arregló en las tarifas, pero
   para transportistas.
4. La 0293 audita `calculator_cities` sólo con `slug` y `active`. Un cambio de `casco` (entrega
   incluida, que fija $0 en la web) no deja antes ni después.
5. `slugify` en `lib/studio/calculator-cities-types.ts` lleva caracteres combinantes literales
   dentro de su regex. Funciona, pero no se ven en el fuente. En el panel nuevo lo escribí con
   escapes.
6. `.claude/commands/ui-check.md` tiene voseo («Corré», «usalo», «Marcá») y dice que el Studio
   usa Nunito+Sora, cuando project-rules dice Archivo y JetBrains Mono.
7. `.studio-icon-btn` (`studio.css:808`) sólo sirve sobre fondo oscuro: usa rgba blancos. No hay
   un botón de ícono del sistema para tablas claras.
8. NUM: `validateTariffInput` acepta montos con más de 2 decimales y la base los redondea sin
   avisar (`numeric(10,2)`).

## HANDOFF AL DIRECTOR

- Siguiente acción:
  1. revisar la PR #241;
  2. pedirle a Sam el OK nominal de `0490_carrier_tariffs_auditoria`;
  3. hacer el preflight de catálogo y aplicar;
  4. retirar la espera del baseline;
  5. fusionar antes de la congelación de las 21:00 (01:00Z);
  6. hacer el smoke.
- Si Sam no autoriza la 0490 a tiempo, la PR se puede fusionar sin ella, porque la app no depende
  del trigger. En ese caso hace falta su aceptación explícita de que, hasta aplicarla, las
  ediciones del tarifario no dejan evento AUD-01 (es una excepción temporal).
- Contratos compartidos:
  - `lib/studio/rbac-actions-guard.test.ts` (el total queda en 433). Otra PR que agregue acciones
    choca en ese número; hay que sumar las dos.
  - `supabase/migrations-baseline.json` (una entrada nueva).
- No hay sesiones consumidoras de este worktree. Libero el claim al terminar la escritura.
