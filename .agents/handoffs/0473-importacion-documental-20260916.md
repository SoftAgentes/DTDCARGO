# Handoff 0473 — Importación documental

- Fecha: 2026-09-16. Estado: en-progreso.
- Owner/sesión: `worker-importacion-0473-claude-20260916` (Claude Code).
- **Adopción:** la sesión previa `worker-importacion-0473-20260916` (Codex) se cortó al agotar su
  límite el 2026-09-16 ~15:58, dejando todo sin commitear. Claim liberado con su propio owner y
  reclamado por esta sesión con el guard del harness; sin reset, sin mover su trabajo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/importacion-documental-0473`.
- Rama: `codex/importacion-documental-0473`. Base main `30a9f890`, stub `069d9e417c06b749cb0749a780187a9c358e3edd`.
- SDD: [0473](../../docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md).
- Migración reservada: `0457_document_import_workspaces.sql` (**no aplicada**).
- Permisos: producto, dependencias, DB efímera, commits. Push propio y PR draft pendientes de pedir.
  No main, no producción, no aplicar migración.
- Dependencia: **SDD-0468 ya está en `main` y en producción**. PR #129 mergeada como `747637e6`
  el 2026-09-17, con despliegue `Production` en estado `success`. Esta rama la integró en `2038dadb`.

## OBJETIVO ORIGINAL

Importar documentos en prealerta y calculadora, revisar documento único, compartir con proveedor,
confirmar despacho, imprimir documento completo/etiquetas y reutilizar logística en estimado DTD.

## COMPLETADO

Backend terminado por la sesión Codex y preservado íntegro en `cce43a9b`:

- Migración 0457: 7 tablas, 4 funciones, bucket privado `document-imports` (15 MB).
  RLS deny-by-default (`revoke all`, cero policies a propósito; el acceso va por funciones).
  `versions` y `commands` append-only real. Incluye
  `alter table packing_list_submissions alter column total_qty drop not null`.
- `lib/shared/document-import.ts`: modelo puro con parser de frontera cerrada.
  `computeDocumentTotals` devuelve `null` antes que sumar parcialmente.
- `extract.ts`: valida el directorio central del ZIP antes de inflar XML (anti zip-bomb, rechaza
  cifrado, `vbaProject` y `externalLinks`) y re-verifica el stream real; CSV RFC4180 propio;
  `.xls` se rechaza pidiendo conversión; no evalúa fórmulas.
- `anthropic.ts`: esquema JSON cerrado; rechaza al modelo si inventa una celda inexistente, si
  emite un número sin evidencia o si se auto-resuelve una incidencia. Sin credenciales no hay mock.
- `estimate.ts`: reutiliza `calcularEnvioLCL` y aplica el mínimo una sola vez sobre el conjunto.
- Cableado: `GET /p/[token]/packlist` exporta desde el workspace; el `POST` legacy devuelve
  `409 shared_document_required`; `etiquetas/page.tsx` monta `documentLabelGate`.

Corregido por esta sesión en `bff39cac`: `formatPackingQuantity` en la capa pura y sus tres
consumidores, que muestran «30 m · 100 pcs» en vez de un total escalar imposible.

## MIGRACIÓN 0457 — APLICADA A PRODUCCIÓN (2026-09-17)

**OK nominal de Sam nombrando la migración**, como exige el runbook: «Sí: aplicá
`0457_document_import_workspaces`». Aplicada sola, con `name` exacto igual al basename, por el
conector Supabase contra `xpfuzqombmjmxvprjgmi`. Respuesta `{"success": true}`.

### Preflight (leído de producción ANTES de aplicar, no del repo)

| Sonda | Antes |
|---|---|
| Las 7 tablas | ninguna existía |
| Las 4 funciones | 0 |
| Bucket `document-imports` | no existía |
| `document_import_content_idx` | no existía |
| Rastro de 0457 en el ledger | 0 |
| `packing_list_submissions.total_qty` | `is_nullable = NO` |
| Filas en `packing_list_submissions` | **6**, ninguna con `total_qty` nulo |

**La dependencia que podía morder en runtime y no al aplicar:** `save_document_workspace` llama a
`submit_packing_list` con 21 parámetros NOMBRADOS. plpgsql no valida el cuerpo al crear la función,
así que un nombre distinto habría reventado recién cuando un proveedor real confirmara. Se leyó la
firma real de producción: **los 21 coinciden uno a uno**, el retorno es `packing_list_submissions`
(compatible con el `%rowtype` del declare) y es `security definer` (llamarla desde una
`security invoker` es correcto). Cuerpo md5 `c96fe398b5a33804b62a9fba8d58ffe2`.

También verificados contra producción: el tipo `packing_list_currency`, las 7 columnas de
`warehouse_boxes`, las 8 de `packing_list_submissions`, y `tenants`/`clients`/`prealertas` con las
columnas que la migración usa.

### Postflight (catálogo, sin leer filas de negocio)

| Sonda | Después |
|---|---|
| Tablas | **7/7** |
| Funciones | **4/4** |
| Bucket privado, 15 MB | **sí** (`public=false`) |
| `total_qty` | `is_nullable = YES` |
| Índice único de contenido | **existe** |
| En el ledger con basename exacto | **sí** |
| RLS en las 7 | **7/7 habilitada** |
| **Policies en las 7** | **0 — a propósito**; el acceso va por funciones |
| `GRANT` a `anon` en las 7 | **ninguno** |
| `GRANT` a `authenticated` en las 7 | **ninguno** |

Nota de lectura: una sonda con `like 'document\_%'` devuelve 11 tablas con RLS y 6 policies. **No
son las nuestras**: pertenecen a `document_backup_outbox`, `document_restore_outbox`,
`document_scan_outbox` y `document_upload_intents`, que ya existían. Contadas contra la lista
explícita de las 7, las policies son **0**.

**Advisors de seguridad:** 4 en todo el proyecto (1 INFO + 3 WARN). **Uno solo toca la 0457**:
`rls_enabled_no_policy`, nivel INFO — que es exactamente el diseño declarado. **Cero ERROR o WARN
nuevos.**

### Lo que NO se hizo, y por qué

- **`migrations-baseline.json` no se tocó.** La 0457 nunca estuvo en `pendingBelowCutoff` y se
  aplicó con su basename exacto, que es la regla hacia adelante: el check la valida sin ruido.
  Subir el `cutoff` sólo la sacaría de la vigilancia a cambio de nada.
- **El archivo `.sql` no se editó**, aunque su primera línea dice «NOT applied to production». Una
  migración aplicada es inmutable; el registro de que se aplicó vive acá, no dentro del archivo.
- `scripts/check-migrations-applied.mjs` en este worktree da **SKIP** por falta de `.env.local` —
  el pitfall que el propio runbook documenta. La verificación se hizo contra el ledger y el
  catálogo directamente, que es evidencia más fuerte que el gate.

## EL COTIZADOR (2026-09-17)

Sam acotó el alcance: «no vamos a cambiar la calculadora pública, solo vamos a hacer algo que se
llama **cotizador**… cotizador arrojando un archivo PI y packing list».

Eso **saca de la allowlist a `TarifasTabs.tsx` y `CalculadoraForm.tsx`**, que seguían listados.
`/tarifas` queda intacta. Entra `app/cotizador/`: tres pasos —cargar, revisar, cotizar— sobre un
workspace **anónimo** (sin `openParams`) que expira en 24 h, detrás de `DOCUMENT_IMPORT_ENABLED`
con `dynamic = "force-dynamic"` para que apagar la bandera no exija redeploy.

No se funden en una porque `/tarifas` se define por **no guardar nada** y el cotizador necesita
que el documento sobreviva hasta el enlace del proveedor. El precio sale del mismo motor en las
dos: `DocumentCalculator` no calcula, manda `estimate` al servidor, que corre `calcularEnvioLCL`.

Decisiones tomadas por la sesión, para que Sam las revise:

- **Ir al paso 3 guarda primero** si hay correcciones. El servidor cotiza sobre lo guardado;
  saltarse el guardado mostraría el precio de la carga vieja.
- **Mercancía sólo con UNA moneda.** Con dos va `null`: convertir sería inventar una tasa y
  elegir una escondería la otra. Y nunca se suma al flete — la suma sería un «costo de importar»
  sin aranceles.
- **Caducidad desde el servidor** (`expiresAt`). Si no viene, no se promete ningún plazo.
- **Salidas fijas en los tres pasos:** `/tarifas` y WhatsApp, como anclas de verdad. Siguen ahí
  aunque todo funcione.

### Pendientes del cotizador

- **El token anónimo vive sólo en memoria.** Si el visitante recarga, pierde el acceso al
  documento (que sigue en el servidor 24 h). Meterlo en `sessionStorage` es decisión de
  privacidad, no sólo de código.
- **Nadie enlaza `/cotizador`.** No está en `app/sitemap.ts` ni en Nav/Footer. Apagada la bandera
  eso es correcto; **al encenderla alguien tiene que enlazarla**.
- **Nombre solapado** con `/studio/cotizador`, el cotizador interno del asesor.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Guard/identidad de worktree y claim | **PASÓ** |
| `tsc --noEmit -p tsconfig.json` | **PASÓ** — exit 0, salida vacía, sin tubería |
| `eslint` sobre lo nuevo y lo corregido | **PASÓ** — exit 0 |
| `vitest` document-import completo | **PASÓ** — 256 pruebas, 7 `it.fails` que documentan defectos, 1 skip |
| `vitest` SUITE COMPLETA del repo | **PASÓ archivo por archivo**; en la suite completa esta máquina da 3 rojos intermitentes por saturación de CPU — ver abajo |
| `/ui-check` | **PASÓ** con 3 ajustes menores, los tres aplicados |
| Harness de QA visual, comprobado en navegador | **PASÓ** — «Pendiente kg» y no cero; 5 cajas con dos productos; 375 px sin desbordamiento (scrollWidth 358 = clientWidth 358) |
| `vitest` corpus real (3 XLSX de proveedor) | **PASÓ** — 4 pruebas, con `DOCUMENT_IMPORT_CORPUS` |
| `vitest` panel de carga | **PASÓ** — 9 pruebas, 2 verificadas por mutación |
| `vitest` suite completa | **PASÓ** — 570 archivos, 7.463 pruebas |
| `vitest` módulo completo tras la tanda del 17-09 | **PASÓ** — 341 pruebas, 1 skip por diseño, **0 `it.fails`** |
| `tsc --noEmit` tras la tanda | **PASÓ** — exit 0 leído sin tubería |
| `eslint components app` tras la tanda | **PASÓ** — 0 errores, 12 warnings preexistentes |
| Mutación de los arreglos del recibo | **PASÓ** — los 2 mutantes mueren con el defecto exacto, archivo restaurado byte a byte |
| `/cotizador` en navegador real, 375/390 px, claro/oscuro | **NO EJECUTADO** — sólo jsdom, tsc y eslint |
| PDF reales (2 proformas) | **NO EJECUTADO** — exige `ANTHROPIC_API_KEY` y modelo |
| `vitest` packlist-form | **PASÓ** — 27 pruebas (6 nuevas del helper) |
| Migración 0457 contra Postgres efímero (PGlite) | **PASÓ** — 8 casos |
| `pnpm verify` completo (2026-09-17) | **14 de 17 pasos corrieron, 0 fallos.** `build` de producción incluido. **3 NO MEDIDOS**: `migrations-applied` (sin `.env.local` en el worktree), `sql-tests` y `schema-rebuild` (sin Docker). `e2e` **PARCIAL**: 153 verdes, 15 omitidas sin Supabase público. El propio gate lo dice: «exit 0 NO equivale a cierre verde completo» |
| Suite completa del repo (2026-09-17) | **PASÓ** — 7.718 pruebas, 582/584 archivos. El único rojo fue el contrato del sitemap, arreglado: `/cotizador` quedaba fuera del sitemap **y** de la lista de `noindex`, «el estado que nadie eligió» |
| Migración aplicada / lectura de producción | **NO EJECUTADO** (fuera de autorización) |
| Llamadas reales a la IA con documentos del cliente | **NO EJECUTADO** |
| UI, `/ui-check`, 375/390 px, claro/oscuro, impresión | **NO EJECUTADO** — no existe UI montada |
| Chino operativo y WeChat real | **NO EJECUTADO** |

> Nota de método: en esta sesión se cantaron dos verdes falsos antes de corregirlos.
> `vitest --reporter=basic` no existe en vitest 4 y sale 0 sin correr nada; y `tsc | head`
> devuelve el exit de `head`. El exit code solo acredita algo si viene del proceso que trabaja
> y sin tubería en el medio.

## COMMITS

- `cce43a9b` — rescate íntegro del trabajo de la sesión Codex (punto de retorno).
- `bff39cac` — cantidades por unidad; deja `tsc` en verde.
- `8714f1d1` — `DOCUMENT_IMPORT_*` en `.env.example` y registro de la adopción.
- `6140d606` — `DocumentImportPanel`: la carga de archivos como primer paso.
- `e7937ccb` — tres defectos que sólo aparecieron con proformas reales, y `corpus.test.ts`.
- `e29d800a`, `d2860361` — handoff al día.
- `32c27dd8` — las 6 suites de backend (2.902 líneas), cada una verificada por mutación.
- `dd7078bf` — `DocumentImportEntry`, el envoltorio que apaga todo cuando el flag está apagado.
- `2038dadb` — merge de `origin/main` con SDD-0468 ya integrada.
- `410efb9c` — la carga de documentos abre el paso 2 del portal, y `DOCUMENT_IMPORT_CORPUS`
  documentada en `.env.example` (lo cazó el gate de variables del repo).
- `02e25f72` — pantalla donde el cliente revisa su documento, y el arreglo del checkbox
  de incidencias que las borraba sin vuelta atrás.
- `1bc8330e` — el enlace del proveedor llega precargado, el harness de QA visual y el
  runbook de importación sin IA.
- `954c84b9` — `DocumentCalculator`: del documento leído al precio de traerlo.
- `7c105d54` — el cotizador público, los 7 `it.fails` cerrados y el recibo que se hacía
  pasar por workspace.

Stub heredado `069d9e417c06b749cb0749a780187a9c358e3edd`.

## PR / BRANCH

Rama `codex/importacion-documental-0473`, **no publicada**. PR pendiente; publicar requiere pedirlo.

## CONTROLES DEL DIRECTOR — verificados contra el código

Los cuatro que `0473-review/review-tracker.md` dejó como «Worker implementando/cambiará» están
implementados. Se comprobó uno por uno, no por lo que declara el tracker:

| Control | Evidencia |
|---|---|
| Contenido de grupo no atribuido entero a cada caja | `0457…sql:217` escribe `jsonb_build_object('scope','group_total',…)`; `migration.test.ts:76` lo afirma |
| Inicialización conserva submission anterior e historial | `create_document_workspace` inserta la versión 0 con `actor_id='legacy-submission:<id>'` y aborta con `legacy_submission_changed` (40001) si la submission dejó de ser vigente |
| Rutas legacy no eluden la revisión confirmada | `app/p/[token]/packlist/route.ts:168` → 409 `shared_document_required` |
| URL firmada no sobrevive a la limpieza anónima | `service.ts:123` rechaza la reserva con menos de `125*60000` ms (2 h 05) de vida útil |

## PENDIENTES DE ESTA TAREA

1. `DocumentCalculator` y su conexión con `TarifasTabs`. El recorrido del cliente y el del
   proveedor ya están completos; falta sólo la calculadora pública.
2. Publicar la rama y abrir su PR.
3. `pnpm verify` reportando cada SKIP.
4. Probar los PDF reales: exige credenciales y presupuesto de IA.
5. El contrato de compra chino (`PO-…`) deriva a IA por no tener fila de encabezados
   detectable. Es derivación legítima; evaluar si conviene un mapeo por posición.

## LOS 3 ROJOS INTERMITENTES NO SON DE ESTA TAREA

La suite completa da 3 fallos que cambian de corrida en corrida, todos por
**timeout de 20 s**, no por lógica. Comprobado, no supuesto:

- Cada archivo, corrido solo, pasa entero.
- El commit `dc0c7401` —el que el CI aprobó en verde con 566 archivos y 7.388
  pruebas— **también falla en esta máquina**, con la misma prueba
  (`PackingListProductsStep`).
- Uno de los rojos es `ClientDrawer.confirm-delete` (SDD-0469), ajeno a este trabajo.

Causa: 22 núcleos ⇒ vitest lanza ~21 workers, y encima corrían el servidor de QA y
el navegador. El CI de GitHub tiene mucha menos concurrencia y pasa.

**FUERA DE ALCANCE DETECTADO:** `PackingListProductsStep.test.tsx` es frágil bajo
carga de CPU. Falla igual en `main`. No se toca desde esta tarea.

## DEFECTOS: 8 encontrados, **8 cerrados** (2026-09-17)

Las 6 suites nuevas encontraron 8 defectos. El primero se cerró al escribirlas
(`combinedLogistics` sumaba `totals.cartons ?? 0` y reportaba cajas que ningún documento
declaró). Los otros 7 quedaron con `it.fails` — una prueba que se pone roja el día que alguien
los arregla, para que nadie los cierre sin enterarse. **Se cerraron los 7 en la tanda del
2026-09-17**, cada uno con cambio de producción detrás y cada prueba verificada por mutación:

| Dónde | Qué pasaba | Cómo se cerró |
|---|---|---|
| `access.ts:42` | Un `expires_at` ilegible no negaba: `Date.parse` da NaN y la comparación es falsa | Helper `noVigente(unknown)`: sólo `null` significa «no vence». `undefined` tampoco acredita vigencia. 6 formas ilegibles cubiertas |
| `access.ts:74` | Sin IP resoluble todos compartían un solo cupo: bastaba mandar 9 saltos de XFF para quemarle la cuota a los demás | Dos niveles: cupo propio por cadena (el proxy raro honesto) + techo común de la clase (el que rota su cadena a propósito). Las IP resolubles no cambian |
| `service.ts:74` | Ante un 23505 se llamaba a sí misma sin tope | `MAX_WORKSPACE_RACE_ATTEMPTS=3`, y la profundidad queda privada: ningún payload puede fijarla. Alcanzado el tope, `503 workspace_unavailable` |
| `jobs.ts` | Un archivo cuya lectura falló no se podía reintentar | El arreglo obvio no servía: filtrar los `failed` del SELECT chocaba contra el índice único de la 0457 y devolvía `409` en vez de dejar reintentar. Hay que **cancelar** el intento muerto (único estado que el índice ignora) y borrar su copia del bucket, conservando su `error_code` |
| `export.ts` (×4) | Redondeo del importe «Sin asignar», cajas de un grupo llamado «Sin asignar», id interno publicado como número de caja, pie que no cuadraba con sus filas | Una sola `productRow()` escribe las dos filas que antes estaban duplicadas, y el pie acumula **lo que realmente escribe** en vez de recalcular |

### Los dos que quedaban anotados — CERRADOS el 2026-09-17

**`extract.ts` · el centinela por etiqueta.** La lectura reconoce el cajón de sobrantes por su
etiqueta (`s(row[0]) === "Sin asignar"`), no por identidad. La exportación ya esquivaba el choque
entrecomillando la etiqueta que colisiona (`groupLabel`), y eso salvó las cajas — pero cerraba
**media vuelta**: sin desentrecomillar al leer, el grupo volvía etiquetado `«Sin asignar»` y
dejaba de llamarse como el proveedor lo llamó. Ahora existe la otra mitad (`unquoteLabel`), y hay
una prueba de round-trip con un grupo bautizado así por el proveedor.

Queda dicho para quien venga: el formato distingue centinela de etiqueta **por comillas**, no por
identidad de grupo. Es una convención del archivo, no una propiedad del modelo. Las dos mitades
—`groupLabel` al escribir, `unquoteLabel` al leer— tienen que moverse juntas.

**`jobs.ts` · el fail-open que costaba dinero.** La consulta de deduplicación descartaba su
`error`. Si esa lectura se caía (RLS, timeout), `duplicate` quedaba en null, el archivo se
encolaba igual y la lectura asistida se pagaba **dos veces** por el mismo contenido. Es el único
punto del módulo donde un fallo cuesta plata, así que ahora falla cerrado: `503 dedup_unavailable`,
el archivo se conserva y el cliente reintenta.

Las dos pruebas se escribieron **rojas primero**. Mutantes: los 2 mueren con el modo de falla
exacto — la etiqueta con guillemets, y `promise resolved {status: queued} instead of rejecting`.

## EL RECIBO QUE SE HACÍA PASAR POR WORKSPACE (2026-09-17)

`save` y `apply` **no devuelven el workspace**: devuelven un recibo —`save_document_workspace` en
la 0457 hace `return receipt`—, con `revision`, `confirmed`, `folio`, `versionNo` y
`submissionId`. Sin `id` y sin `draft`.

Dos llamadores lo tipaban `DocumentWorkspace` y lo adoptaban entero. TypeScript creyó la
anotación. Las pruebas no lo vieron porque **el doble de `apply` devolvía un workspace completo**:
una fixture más amable que el servidor real. Dos fallas que sólo se ven usando la pantalla:

- `DocumentImportPanel` — aplicar una extracción subía un objeto sin `draft`; el editor de arriba
  se quedaba vacío justo después de aplicar. Ahora relee (`GET action=workspace`), porque el
  borrador fusionado sólo existe en el servidor.
- `DocumentReviewClient` — tras **un** guardado el `id` se perdía; el siguiente salía con
  `workspaceId: undefined` → 404 hasta recargar. Ahora fusiona sólo la revisión sobre el
  workspace que ya tiene.

Los dos dobles responden ahora como el servidor. Revertir cualquiera de los dos arreglos deja
`expected undefined to be '0000…0001'`, que es el defecto mismo.

Lo encontró el agente que escribió el cotizador, porque su doble respondía como el servidor de
verdad en vez de como convenía a la prueba.

## CORPUS REAL — lo que reveló

Sam entregó 5 documentos de proveedores de Yiwu (3 XLSX, 2 PDF). Viven fuera de Git y se
apuntan con `DOCUMENT_IMPORT_CORPUS`. **Los tres XLSX fallaban con el código heredado.**
Tres defectos corregidos en `e7937ccb`:

1. El guard de dimensiones medía columnas con **formato** (16.382) en vez de con datos (7),
   y rechazaba proformas de 74 celdas.
2. Faltaban `ITEM` y `DESCRIPCIONES` en el mapa de encabezados: las proformas derivaban a IA
   pudiendo leerse gratis y exactas. Ahora se leen sin IA.
3. Se guardaba la **comisión** como importe declarado del documento — un dato falso.

Cerrado en esta sesión: `DOCUMENT_IMPORT_*` documentadas en `.env.example`
(`ENABLED`, `MODEL`, `RATE_SECRET`, `ALLOWED_ORIGINS`), con el aviso de no encender el flag
antes de que exista la UI.

Riesgos abiertos anotados en el código: recursión sin guarda en `service.ts:74`; el checkbox de
incidencia resuelta en `DocumentEditor` nunca se ve marcado porque `confirmationIssues` ya filtra
`!resolved`; `document_group_boxes` sin `on delete cascade`; el cron drena 1 job por invocación.

**No encender `DOCUMENT_IMPORT_ENABLED` antes de cablear la UI (pendiente 2)**: el 409 dejaría al proveedor sin
ninguna vía para enviar su packing list.

## FUERA DE ALCANCE DETECTADO

Ninguno nuevo. El handoff de 0468 ya registra 11 warnings de lint preexistentes que no se tocaron
y la capa de conocimiento en PENDING/STALE, diferida a después de la integración autorizada.

## HANDOFF AL DIRECTOR

Trabajo activo, claim de esta sesión. Impacto documental: SDD y handoff al día; runbook operativo
por escribir. Graphify/Archify/preview Obsidian pendientes; sin publicación de conocimiento
compartido. PR #129 (SDD-0468) en revisión para integrarse antes que esta rama.
