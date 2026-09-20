# Handoff 0473 — Encender el cotizador: cadencia del cron y alcance de la bandera

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión**, sin publicar (ver PR / BRANCH).
  Encender en producción **bloqueado por la compuerta de privacidad** (decisión de Sam).
- Owner/sesión: `worker-encender-cotizador-0473-claude-20260918` (Claude Code).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/encender-cotizador-0473`.
- Rama: `codex/encender-cotizador-0473`, creada con `harness-worktree start` desde `origin/main` =
  `78410913`. Guard OK y claim adquirido antes de editar.
- SDD: [0473](../../docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md),
  `in-progress`, con la ampliación del 2026-09-18 y su allowlist. No se reservó número nuevo.
- Permisos del encargo (`$worker`, Sam): implementar, probar, commits locales. Nada de producción:
  ni variables de Vercel, ni datos, ni migraciones. Supervisión: dtdcargo-53; integración y
  producción: dtdcargo-18.
- **Publicación (2026-09-18):** Sam la autorizó por el chat de dtdcargo-53, y esta sesión se la
  confirmó en su propio chat. Texto transmitido por dtdcargo-53, literal: «autorizo Autorizar que se
  suban las cinco ramas y se abran sus PR, sin merge. Son: […] codex/encender-cotizador-0473: el
  cotizador. […]». Confirmación de Sam en este chat, literal: «sí, confirmo: súbela y abre la PR en
  draft». Alcance: push de la rama a sí misma y PR **draft** contra `main`. **Sin merge, sin
  variables y sin producción.** Esta sesión se comprometió a no subir con `verify` en rojo sin
  volver a avisarle a Sam.

## OBJETIVO ORIGINAL

«Encender el cotizador desde la proforma (bandera `DOCUMENT_IMPORT_ENABLED` de 0473): antes hay
que revisar de nuevo la cadencia del cron».

## LA CADENCIA, REVISADA: vuelve a cada minuto

PR #133 la bajó a `*/5` el 2026-09-17 **porque la bandera estaba apagada** (el handler corta antes
de abrir la base). Su handoff dejó como pendiente reevaluarla antes de encender. Reevaluada:

| Qué depende del tick | Con `* * * * *` | Con `*/5 * * * *` |
|---|---|---|
| Reintento tras fallo pasajero (`available_at = attempts × 60 s`) | 1–2 min, luego 2–3 min | 1–6 min, luego 2–7 min |
| Visitante esperando el error final (3 intentos fallidos) | hasta ~5 min | hasta ~13 min |
| Rescate de un proceso muerto (lease 3 min) | ≤ 4 min | ≤ 8 min |
| Caudal del cron (1 job por tick) | 60/h | 12/h |

El caudal **no** es el problema: el camino feliz lee en el acto (`after()` en `http.ts`) y el tope
diario por defecto es de 100 lecturas (`DOCUMENT_IMPORT_DAILY_JOBS`). Lo que importa es la
**espera del visitante**, que mira «En cola» en la pantalla (sondea cada 2,5 s). Con `*/5` el
escalón de reintento deja de escalonar y la espera se triplica. Por eso: `* * * * *`.

No se cambió el drenaje a varios jobs por tick: con el tope diario y el `after()` como camino
principal no hace falta, y meter un bucle con presupuesto de tiempo contra `maxDuration = 180`
añade riesgo sin ganancia medible hoy. Queda anotado para cuando haya volumen.

Para que las dos mitades no se vuelvan a desalinear sin decidirlo: el escalón se llama
`RETRY_STEP_MS` en `jobs.ts`, y `cron-cadence.test.ts` exige que `vercel.json` dispare al menos una
vez por escalón y que el lease de la 0457 (3 min) cubra el `maxDuration` de las dos rutas que
procesan (cron y API).

Costo: con la bandera encendida son ~43.200 invocaciones/mes (cada una: limpieza + un claim).
Mismo orden que `push-drain` y `client-notifications-drain`, que ya corren cada minuto. Con la
bandera **apagada**, el drenaje es **inerte**: corta antes de `createAdminClient()`, sin conexión a
la base (idéntico al de `main`, la garantía con que se integró la #130).

### La retención, aparte (corrección pedida por el Director, 2026-09-18)

Un primer arreglo (`f988f83f`) movió `cleanupImports` antes del corte de la bandera para que
apagar no dejara archivos sin borrar. dtdcargo-18 lo objetó con razón: con `* * * * *` eran
**1.440 conexiones diarias a producción con la bandera apagada**, y la cadencia de un minuto sólo se
justifica por los reintentos, que sólo existen encendida. Opciones evaluadas:

1. **Un cron de retención aparte, cada hora — elegida.** `/api/cron/document-import-cleanup`
   (`17 * * * *`, lejos de los crons que corren en punto) limpia con cualquier bandera. El drenaje
   vuelve a ser byte a byte el de `main`. Apagado: 24 conexiones al día.
2. Un solo cron que limpie apagado sólo en el minuto 0: una invocación que Vercel atrase al minuto 1
   se salta la hora entera. Descartada.
3. Dejar la limpieza cada minuto y justificarla: nada la justifica para un vencimiento de 24 h.

El documento deja de ser accesible exactamente al vencer (`authorizeWorkspace`); el borrado físico
llega como mucho una hora después. Encendida, el drenaje sigue limpiando en cada tick y la pasada
horaria es idempotente. `cron-cadence.test.ts` exige que la retención exista, corra al menos cada
hora y no lea la bandera; `document-import-drain/route.test.ts` exige que apagado no se cree ni el
cliente de la base.

## LO QUE APARECIÓ AL REVISAR: la bandera enciende más que el cotizador

`DOCUMENT_IMPORT_ENABLED` también enciende la carga de documentos en el **paso 2 de la compra del
portal** (`PurchaseStepDetalle` → `DocumentImportEntry`). Comprobado en el código:

1. El cliente sube un archivo → `DocumentImportPanel.ensureWorkspace()` abre con
   `{ purchaseCode }` → `openWorkspace` crea un `document_workspaces` **ligado a la prealerta**.
2. El proveedor abre su enlace, ve el formulario precargado y lo envía por el POST de siempre
   (`PackingListFormSection.tsx:554`, `/p/${token}/packlist`).
3. La ruta encuentra el documento compartido y responde **409 `shared_document_required`**
   (`app/p/[token]/packlist/route.ts`, control del Director en 0473, se conserva).
4. El formulario trata el 409 como error genérico: «No pudimos confirmar el envío…». La vía
   alternativa —confirmar desde el documento con `x-supplier-token`— **no la usa ningún
   componente**: `createDocumentClient({ supplierToken })` no se llama con ese parámetro en ningún
   lado.

Resultado: encender la bandera como estaba dejaba **sin vía de envío al proveedor** de toda compra
donde el cliente usara la carga de documentos. Es exactamente el aviso que ya tenía `.env.example`.

**Decisión de esta tarea (reversible, en código):** la bandera se parte en dos.

- `DOCUMENT_IMPORT_ENABLED=true` sola → el cotizador anónimo, su sitemap, su enlace del footer y el
  cron. Nada ligado a una compra.
- `DOCUMENT_IMPORT_PORTAL_ENABLED=true` además → documentos de compra. **No se enciende** hasta que
  exista la confirmación del proveedor desde el documento.

La negación vive en el servidor, no en la UI: `authorizeWorkspace` (todo actor no anónimo),
`openWorkspace` (proveedor, compra o sesión, antes de tocar la base), `purchases`, el estimado
combinado o guardado (antes de calcular), la pantalla `documento` (404) y la ruta del proveedor
(una lectura caída sólo falla cerrada con el portal encendido). `capabilities` publica `portal` y
`DocumentImportEntry` pide las dos llaves.

## PRIVACIDAD: compuerta antes de encender en producción

Encender es el momento en que el flujo empieza a recibir documentos reales de visitantes sin cuenta
y a mandar los PDF a un tercero. Por AGENTS eso pasa por `revisar-datos-ve`. Se aplicó **acotada al
flujo anónimo de `/cotizador`** (no es una auditoría del repo) con un subagente de solo lectura, y
se comprobaron a mano los hallazgos que tocaban esta tarea. No es asesoría legal.

Comprobados en el código por esta sesión:

- **ENCONTRADO — no hay aviso antes de subir.** Ni `app/cotizador/*` ni `components/document-import/*`
  mencionan la privacidad ni enlazan `/privacidad` (grep sin resultados). La subida arranca al
  elegir el archivo; el aviso de las 24 h sale después (`CotizadorClient.tsx`, bloque `ws?.expiresAt`).
- **ENCONTRADO — `/privacidad` no cubre este flujo:** no hay fila del cotizador, no figura un
  proveedor de IA entre los destinatarios, y lo más cercano es «Los documentos que subes se guardan
  en almacenamiento seguro» (`app/privacidad/page.tsx:304`), escrito para el portal con sesión.
- **ENCONTRADO — texto del portal dentro del cotizador:** el panel dice «antes de enviarle el enlace a
  tu proveedor», «el resto de la compra» y «el original queda como adjunto»
  (`DocumentImportPanel.tsx:143,376,436`). En el cotizador el original se borra a las 24 h y no hay
  compra. Y el aviso de las 24 h invita a «seguir desde el portal», donde la carga de documentos
  queda apagada.
- **ENCONTRADO y CORREGIDO — el borrado dependía de la bandera** (ver COMPLETADO).

Del subagente, sin re-comprobar uno por uno (etiquetados así a propósito):

- CORRECTO en parte: la instrucción a la IA excluye comprador, cuentas y firmas, y el esquema de
  salida es cerrado. Pero el PDF viaja **completo** (y dos veces por intento: conteo de tokens y
  lectura). La exclusión aplica a lo que vuelve, no a lo que se envía.
- CORRECTO: el token anónimo (256 bits, sólo su hash en la base, viaja por cabecera), la IP sólo como
  HMAC, sin grants a `anon`/`authenticated` en las tablas.
- NO VERIFICABLE desde el repo: retención y uso en Anthropic (DPA, cero retención, entrenamiento,
  región); backups/PITR de Supabase; retención de logs de Vercel/Supabase.
- Sugerido y NO aplicado (decisión de producto): no guardar el contacto del proveedor en los
  documentos anónimos. Comprobado por esta sesión: `CotizadorClient.tsx` no ofrece descarga ni
  enlace al proveedor; el contacto sólo se muestra en el paso «revisar». Dentro del cotizador su
  finalidad no es evidente, pero quitarlo cambia lo que el visitante ve: se decide, no se asume.

**Lo que Sam (con su abogado) decide antes de la Fase 3:**

1. Texto en `/privacidad`: el cotizador, la lectura con IA, Anthropic como destinatario, la
   transferencia fuera de Venezuela y el borrado a las 24 h.
2. Un aviso corto **antes** de «Elegir archivos», con enlace a `/privacidad`; si basta el aviso o
   hace falta una casilla.
3. Condiciones con Anthropic (DPA, retención, no entrenamiento) y si esta función usa una key propia.
4. Si se corrige ya el texto heredado del portal dentro del cotizador (es copia, va con `/ui-check`).

Esta sesión **no** redactó texto legal ni el aviso: el aviso tiene que enlazar a una política que
diga lo que el aviso resume, y esa política es de Sam.

## CÓMO SE ENCIENDE (para Sam y el Director)

**Antes de cualquier paso en producción:** confirmar con dtdcargo-18 que no hay otra aplicación en
curso (pedido del supervisor; el runbook exige una a la vez).

1. **Compuerta de privacidad** (sección anterior). Sin ella, encender en producción es capturar
   documentos reales sin aviso.
2. **Publicar esta rama y abrir la PR:** hecho, PR #143 en draft (ver PR / BRANCH).
3. **Prueba en Preview (recomendada, sigue pendiente de la Fase 2 de 0473):** en Vercel, variables
   con alcance **Preview** y, mejor, **sólo para la rama** `codex/encender-cotizador-0473` (si no,
   se encienden en todas las previews):
   - `DOCUMENT_IMPORT_ENABLED=true`
   - `DOCUMENT_IMPORT_RATE_SECRET` = 64 caracteres
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Menos de 32 y
     toda la API responde 503** (`access.ts`, `reserveRequest`).
   - `DOCUMENT_IMPORT_MODEL=claude-sonnet-5` y `ANTHROPIC_API_KEY` (sólo para PDF; XLSX/CSV no
     gastan nada).
   - **No** `DOCUMENT_IMPORT_PORTAL_ENABLED`.
   Redesplegar la preview y subir en `/cotizador` una XLSX y una proforma PDF reales.
   **Ojo, ya documentado en 0473:** Preview escribe en la **base y el bucket de producción**
   (inferencia del repo: el MCP de Vercel da 403 y no se miró el panel), y en Preview no corre el
   cron. Lo que se suba ahí se borra con el cron de retención de producción, que corre cada hora
   con la bandera encendida o apagada, en cuanto esta rama esté en `main`.
4. **Producción:** las mismas variables con alcance **Production** (un `RATE_SECRET` distinto al de
   Preview). **No** `DOCUMENT_IMPORT_PORTAL_ENABLED`. Opcionales con sus defaults:
   `DOCUMENT_IMPORT_DAILY_JOBS` (100), `DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET` (2.000.000).
   Confirmar que `CRON_SECRET` existe en Production (sin él el cron responde 403 y no borra nada).
5. **Mergear la PR** (Director; un merge a `main` despliega a producción). El orden importa:
   **variables primero, merge después**, y el merge es el interruptor: el deploy nace con la bandera
   encendida y el cron a cada minuto. Al revés, el cotizador sigue 404 hasta un redeploy manual.
6. **Sondas después del deploy**, sin leer filas de negocio:
   - `GET /api/document-import?action=capabilities` → `{"available":true,"portal":false,…}`
   - `/cotizador` → 200; `/sitemap.xml` contiene `/cotizador`; el footer muestra «Cotiza con tu
     proforma» y el menú principal «Cotizador» después de «Tarifas».
   - `/portal/compras/<código>/documento` → 404, y el paso 2 de una compra nueva **sin** la carga de
     documentos.
   - Logs de `/api/cron/document-import-drain`: 200 con `cleanup` cada minuto; y de
     `/api/cron/document-import-cleanup`: 200 con `cleanup` una vez por hora.
7. **Apagar:** Vercel Instant Rollback al deploy anterior, o quitar la variable y redesplegar
   (cambiar una variable no afecta un deploy ya hecho). El drenaje vuelve a ser inerte y el cron de
   retención sigue borrando lo vencido cada hora.

## COMPLETADO

1. **Cadencia revisada y decidida:** `vercel.json` vuelve a `* * * * *` para
   `/api/cron/document-import-drain`. `RETRY_STEP_MS` en `jobs.ts` (mismo valor, ahora con nombre) y
   `lib/studio/document-import/cron-cadence.test.ts` atan cadencia, escalón y lease.
2. **La bandera, partida en dos**, con la negación en el servidor: `access.ts` (`portalEnabled`,
   `requirePortalScope`, y `authorizeWorkspace` niega todo lo no anónimo), `service.ts`
   (`openWorkspace`), `http.ts` (`capabilities` publica `portal`; `purchases`), `estimate.ts`
   (combinar o guardar), la pantalla `documento` (404), la ruta del proveedor
   (`app/p/[token]/packlist/route.ts`: una lectura caída sólo falla cerrada con el portal) y
   `DocumentImportEntry` (pide las dos llaves). El 409 ante un documento que ya existe **se
   conserva** con cualquier bandera. `.env.example` documenta `DOCUMENT_IMPORT_PORTAL_ENABLED`.
3. **El borrado deja de depender de la bandera, sin romper la inercia del drenaje:** cron de
   retención propio (`/api/cron/document-import-cleanup`, cada hora, sin leer la bandera) y el
   drenaje idéntico al de `main`. Sin esto, apagar después de encender dejaba sin borrar lo subido
   en las últimas 24 h, igual que el residuo del Preview.
4. **Descubrimiento del cotizador:** `/cotizador` deja de declararse excluida (apagada ya es 404);
   `app/sitemap.ts` y el footer («Cotiza con tu proforma», en «Enlaces rápidos») la muestran sólo con
   la bandera encendida. Se corrigió el comentario que decía que `force-dynamic` ahorraba el
   redeploy.
7. **Cotizador en el menú principal** (Sam, en este chat, 2026-09-18: «agrega el cotizador al menú
   principal»): «Cotizador» después de «Tarifas», en la barra y en el menú móvil, sólo con la
   bandera. `components/Nav.tsx` pasa a ser un envoltorio de servidor que lee la bandera y renderiza
   `components/NavClient.tsx` (el componente de siempre, movido con `git mv`); los 30 importadores
   de `Nav` son componentes de servidor, comprobado archivo por archivo. La fila de escritorio no
   entraba a 1024 px y se ajustó el espaciado sólo en ese tramo y sólo con el cotizador (sección
   «Menú principal», abajo).
8. **Borradores de privacidad para el abogado** (pedido de Sam): página privada
   https://claude.ai/artifact/XZYfyu5M1MWJzPonyRV9ep y un Word con control de cambios contra el texto
   vigente de `/privacidad`. Viven **fuera del repo**: son insumo para la decisión legal, no texto
   aprobado.
5. **SDD-0473** ampliada (2026-09-18) con su allowlist; índice sincronizado.
6. **Revisión de datos personales acotada** al flujo anónimo (sección PRIVACIDAD).

Criterios de aceptación de 0473 que esta tarea mueve: cron/lease/retry (cadencia y contrato),
permisos cruzados (el portal no se abre por accidente), expiración (borrado independiente de la
bandera). Siguen abiertos los de 0473 que no son de esta tarea: el recorrido completo contra la base
real, PDF reales, `/ui-check` y 375/390 px del cotizador, chino y WeChat reales.

## VALIDACIÓN

SHAs medidos: `ccf9c1a6` (verify completo y primera tanda) y `6f2d3193` (tras separar la retención:
pruebas de los crons, mutantes C1–C4, tsc, eslint, docs:check y la segunda corrida limpia de e2e).
Base `78410913` = `origin/main` en los dos momentos.

| Comprobación | Veredicto | Evidencia |
|---|---|---|
| Guard, rama y claim antes de editar y de commitear | **PASÓ** | `Guard OK`; rama `codex/encender-cotizador-0473` |
| Módulo document-import + cotizador + portal compras (vitest) | **PASÓ** | 18 archivos, 339 pruebas, 1 skip por diseño |
| Pruebas nuevas (cadencia, cron, footer, sitemap, ruta del proveedor, pantalla documento) | **PASÓ** | todas verdes corridas por archivo |
| Contrato de cobertura del sitemap | **PASÓ** | 3/3, tras reescribir un comentario que contenía la palabra que el contrato busca |
| Control rojo: 14 mutantes, uno por puerta (`ccf9c1a6`) | **PASÓ** | los 14 mueren; cada archivo restaurado y comprobado por sha256 |
| Control rojo de la retención (`6f2d3193`) | **PASÓ** | C1 drenaje que abre la base antes del corte, C2 retención que lee la bandera, C3 retención cada 2 h, C4 retención ausente: los 4 mueren, restaurados por sha256 |
| Pruebas de los dos crons + contrato de cadencias (`6f2d3193`) | **PASÓ** | 3 archivos, 9 pruebas; `route.ts` del drenaje sin diff contra `78410913` |
| `tsc`, `eslint`, `docs:check` (`6f2d3193`) | **PASÓ** | exit 0 los tres |
| `build` sobre `6f2d3193` | **NO EJECUTADO** | medido en verde sobre `ccf9c1a6`; el cambio posterior es una ruta nueva validada por tsc, eslint y pruebas. No se relanzó para no saturar la máquina mientras otra sesión corría su `verify` |
| `tsc --noEmit` | **PASÓ** | exit 0 sin tubería |
| `eslint` sobre lo tocado | **PASÓ** | 0 errores; 4 warnings preexistentes de `DocumentCalculator.tsx` (no tocado) |
| `git diff --check` | **PASÓ** | sin salida |
| `docs:check` / índice de specs | **PASÓ** | 464 specs, sin cambios en el índice |
| `pnpm verify` completo sobre `ccf9c1a6` | **FALLÓ (exit 1)** | leído del propio proceso (`rc` a archivo, sin tubería). 16 de 17 pasos corrieron |
| └ harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | **PASÓ** | `[OK]` en el log |
| └ `sql-tests`, `schema-rebuild` | **PASÓ** | esta vez Docker estaba disponible |
| └ `build` | **PASÓ** | `[OK] build`, build de producción |
| └ `test` | **FALLÓ** | 1 falla, 7.815 pasan y 1 se omite (7.817): `PackingListProductsStep.test.tsx` → «adds another group…», la inestable conocida (FUERA DE ALCANCE de la PR #133). **Aislada sobre `ccf9c1a6`: 9/9 en verde** |
| └ `e2e` | **FALLÓ, cobertura PARCIAL** | 1.ª vuelta: `Timed out waiting 120000ms from config.webServer`. Reintento: 144 pasan, 7 inestables que pasan al reintento, 33 omitidas y 2 fallan (ver la tabla de corridas abajo). 15 omitidas sin Supabase público |
| └ `migrations-applied` | **NO EJECUTADO** | `[SKIP]` sin `.env.local`; no se copiaron credenciales. Esta tarea no trae migraciones |
| Causa de los rojos de `verify` | **PASÓ (comprobada)** | durante la corrida la CPU estaba al **100 %** y otra sesión (`DTD-worktrees/tarifa-programada-a-futuro`) corría su vitest con ~20 workers. Con la máquina en 20 % las 4 pruebas rojas pasaron |
| e2e de los 2 caídos, repetidos en condiciones limpias | **PASÓ** | dos corridas, abajo |
| Estado encendido en un Next real (`next dev`, `DOCUMENT_IMPORT_ENABLED=true`) | **PASÓ** | `capabilities` → `{"available":true,"portal":false,…}`; `/cotizador` 200 con `robots: index, follow`; enlace del footer en `/cotizador` y en `/tarifas`; `sitemap.xml` con `/cotizador` |
| `/portal/compras/<código>/documento` en ese mismo servidor | **NO DISPONIBLE** | 500 del `proxy.ts` (middleware), que exige Supabase en `/portal` antes de llegar a la página. La puerta de la página está cubierta por `page.test.tsx` y su mutante |
| `/ui-check` (menú y footer) | **PASÓ** | «OK para commit»; 3 hallazgos de prioridad baja y sin corrección necesaria (pills pegadas al pasar el mouse entre 1024 y 1279 con el cotizador; 6 px fuera de la escala de 4, ya usado en la barra; dos nombres para el mismo destino, con precedente) |
| Variables en Vercel, deploy, producción | **NO EJECUTADO** | fuera de autorización: los pasos están en «CÓMO SE ENCIENDE» |
| Graphify estructural | **PENDIENTE** | `graphify update .` corrió (34.856 nodos); `structural: PENDING` |
| Graphify semántico | **NO APLICA a esta tarea** | ninguna de las 16 fuentes del piloto cambió; global 0/1.091, preexistente |
| Archify | **NO DISPONIBLE** | `ARCHIFY_RUNTIME_MISSING`: hay que descargar `archify.zip` y no está autorizado |
| Vista previa de Obsidian | **PASÓ (local)** | `knowledge-sync publish --preview` → `graphify-out/obsidian-preview`, 1.090 documentos; no toca la bóveda compartida |

### Los 2 e2e que cayeron en `verify`, y sus corridas

- `e2e/calculadora-hidratacion.spec.ts:61` — «hidratación · tocar la calculadora antes de que React
  llegue › el toggle tocado antes del JS igual abre el consolidado».
- `e2e/attachments-gastos-pilot-network.spec.ts:4` — «SDD-0224 · contrato Network › el plano de
  control recibe JSON, nunca bytes del archivo».

Se corrió el archivo completo de cada uno (incluye también `calculadora-hidratacion.spec.ts:42`, que
había caído como inestable), en Chromium y con puerto propio:

| Corrida | SHA | Condiciones | Resultado |
|---|---|---|---|
| Dentro de `verify` | `ccf9c1a6` | CPU al 100 %; otra sesión con vitest de ~20 workers | 2 fallan (tras el reintento del arnés) |
| Limpia 1 | `ccf9c1a6` | CPU al 20 %, ninguna otra suite de pruebas corriendo | **3/3 en verde** (45 s) |
| Limpia 2 | `6f2d3193` | carga muestreada cada 3 s durante la corrida: 52, 35, 38, 48, 54, 66, 56, 65, 26, 34, 3, 43, 4 %. Había un `pnpm verify` de otra sesión todavía en su fase liviana | **3/3 en verde** (1,1 min) |

Ninguno de los dos archivos toca lo que cambia esta rama (footer, sitemap, cotizador, crons,
importación documental).

### `verify` sobre la rama con `main` fusionado (`2575ac5e`)

Antes del merge: `git merge-tree --write-tree HEAD origin/main` dio exit 0, sin conflictos y sin
archivos en común. `main` era `b43a39a5` (#138), no el `56fa2ae0` que se había indicado primero.
Merge `2575ac5e`; `docs:check` verde; `drain/route.ts` sin diff contra `main`.

| Paso | Veredicto | Evidencia |
|---|---|---|
| `pnpm verify` completo | **FALLÓ (exit 1)** | leído del propio proceso; único paso rojo: `test` |
| └ harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | **PASÓ** | `[OK]` |
| └ `e2e` | **PASÓ, cobertura PARCIAL** | 153 pasan, 0 fallan, 33 omitidas (15 sin Supabase público) |
| └ `build` | **PASÓ** | `[OK] build` |
| └ `test` | **FALLÓ** | 1.ª vuelta: 1 falla (`PackingListProductsStep`, la inestable conocida). En el reintento del arnés, 3 fallas: `PackingListProductsStep` (timeout de 20 s), `scripts/__tests__/invoice-read-boundary.test.mjs` (timeout de 60 s en un contrato que recorre el árbol de archivos) y `app/p/[token]/supplier-flow.test.tsx` (espera agotada por un texto). Ninguna fue una aserción sobre lo que cambia esta rama |
| └ `sql-tests`, `schema-rebuild` | **NO EJECUTADO** | `[SKIP]`: «Docker Desktop is unable to start». Pasaron en el `verify` sobre `ccf9c1a6`; nada posterior toca SQL |
| └ `migrations-applied` | **NO EJECUTADO** | sin `.env.local`, a propósito |
| Carga durante el `verify` | medida | muestras cada 30 s: CPU hasta 100 % en la fase de vitest, con **9 a 23 procesos de prueba de otra sesión** corriendo a la vez |
| Las 3 pruebas rojas, aisladas sobre `2575ac5e` | **PASÓ** | 3 archivos, 35 pruebas, 55 s |

### `verify` sobre la rama con `main` `a48d304f` (`2172e596`), con la máquina libre

Merge con el driver `dtd-generated-records` instalado, previo `merge-tree` exit 0; `docs:index`
regenerado sin cambios (465 specs). El lanzador esperó a que terminara un `verify` ajeno y arrancó
con **cero suites ajenas**; en las 41 muestras cada 30 s durante la corrida no hubo ningún proceso
de prueba de otra sesión.

| Paso | Veredicto | Evidencia |
|---|---|---|
| `pnpm verify` completo | **FALLÓ (exit 1)** | único paso rojo: `test`. 14 de 17 pasos corrieron |
| └ `e2e` | **PASÓ, cobertura PARCIAL** | **167 pasan, 0 fallan**, 18 omitidas, 1 inestable que pasó al reintento (`calculadora-semantic-colors:53`: el combobox recibió «Valencia (sede)mara» por «mara») |
| └ `build` | **PASÓ** | `[OK] build` |
| └ `test` | **FALLÓ** | 1.ª vuelta: `invoice-read-boundary` (timeout 60 s) y `PackingListProductsStep`. Reintento: `PackingListProductsStep` y `ClientDrawer.confirm-delete` (no encontró «Eliminar cliente»; SDD-0469, ya anotada como intermitente). **Aisladas sobre `2172e596`: 21/21 verdes** |
| └ `sql-tests`, `schema-rebuild` | **NO EJECUTADO** | Docker Desktop no levanta |
| └ `migrations-applied` | **NO EJECUTADO** | sin `.env.local` |

**Corrección de lo que se venía diciendo:** con la máquina libre el paso `test` falló igual, así que
estas intermitentes **no** las causa sólo la carga de otras sesiones: fallan bajo el paralelismo de
la propia suite completa.

**Las omitidas de e2e bajaron de 33 a 18.** Las 15 que esperaban «Supabase público»
(`requiereSupabase`, SDD-0470) ahora corren contra el Supabase sintético deny-only de la #141. Las
18 que quedan son 6 pruebas × 3 proyectos, cada una con su guardia: `global-search` (2, Tier 3,
`STUDIO_E2E_EMAIL/PASSWORD` y seed), `gastos-expense-void` (2, más `STUDIO_E2E_EXPENSE_CODE`),
`nomina-settlement-void` (1, más `STUDIO_E2E_PAYROLL_SETTLEMENT_CODE`) y `comments-lifecycle` (1,
`E2E_SUPABASE_*` con service role). Necesitan sesión y datos sembrados reales: un Supabase deny-only
no puede servirlas por diseño.

### Menú principal (`f7eafe9a`)

Medido en el navegador integrado con `next dev`, primero con la bandera encendida:

| Ancho | Espaciado de siempre | Con el ajuste (hueco 0, relleno 6 px entre lg y xl) |
|---|---|---|
| 1024 | **desborda**: `scrollWidth` 1021 contra 1009 | sin scroll; no invade el margen; 17 px entre el logo y el primer enlace |
| 1024, sólo bajando el hueco a 2 px | sin scroll, pero **24 px comidos del margen derecho** y el logo pegado | — |
| 1100 / 1279 / 1280 | 1280 cabía (botón en 1214 de 1265) | sin scroll, margen intacto (87 / 252 / 83 px al logo) |
| 320 / 360 / 375 | sin scroll | sin scroll; menú móvil: Tarifas, Cotizador, Servicios, Pre-alertas, Actualidad |

Con la bandera **apagada** (el estado real de producción): `/cotizador` 404, la barra con las clases
de siempre (`gap-x-1.5`, `px-2`), los 4 enlaces de siempre y ningún enlace a `/cotizador` en la
página. Sin errores de hidratación en la consola (sólo los «Faltan NEXT_PUBLIC_SUPABASE_URL» del
entorno local, preexistentes).

`components/Nav.cotizador.test.tsx` fija el orden, el menú móvil, las clases con la bandera apagada
y el ajuste con ella encendida. Mutantes, los 5 mueren: `Nav` siempre con cotizador, relleno
apretado siempre, hueco 0 siempre, cotizador fuera de la lista, cotizador al final.

#### `verify` sobre `07f14e14` (menú incluido) y la prueba que rompió

Máquina libre: 32 de 35 muestras sin procesos de prueba ajenos (3 con 1 o 2, breves).

| Paso | Veredicto | Evidencia |
|---|---|---|
| `pnpm verify` completo | **FALLÓ (exit 1)** | único paso rojo: `test` |
| └ `rsc-boundary`, `typecheck`, `lint` | **PASÓ** | el envoltorio de servidor no cruza valores a cliente |
| └ `e2e` | **PASÓ, cobertura PARCIAL** | **166 pasan, 0 fallan**, 18 omitidas, 2 inestables que pasaron al reintento (`calculadora-semantic-colors:53` light y dark en mobile-chrome). `sin-scroll-horizontal` en verde (con la bandera apagada, como corre el e2e) |
| └ `build` | **PASÓ** | `[OK] build` |
| └ `test` | **FALLÓ** | `PackingListProductsStep` (intermitente conocida) y **`__tests__/seo-remates.test.ts`, rota por este cambio**: leía `components/Nav.tsx` como texto para confirmar que el menú apunta a `/tarifas`, y la lista pasó a `NavClient.tsx` |
| Arreglo `85e3c4af` | **PASÓ** | la prueba lee `NavClient.tsx`; la aserción no cambia. Control rojo: con el menú sin `/tarifas` vuelve a fallar |
| Suite unitaria completa sobre `85e3c4af` (`pnpm test`), sin suites ajenas | **PASÓ** | **exit 0**: 599 archivos, 7.833 pruebas, 1 omitida. Esta vez pasaron también las intermitentes |
| `sql-tests`, `schema-rebuild`, `migrations-applied` | **NO EJECUTADO** | Docker no levanta; sin `.env.local` |

`e2e` y `build` no se repitieron sobre `85e3c4af`: el arreglo toca sólo un archivo de prueba.

### Merge final con `main` `91d20e3f` (`ae9cac7b`), antes del push único

Entraron en `main` #137, #144, #146 y #140. `git merge-tree` exit 0 (fusión automática de
`vercel.json` y `.env.example`); merge con el driver `dtd-generated-records`; `docs:index` sin
diferencias (467 specs); `docs:check` verde.

`vercel.json` comprobado después del merge: JSON válido, **19 crons, ninguno duplicado**.
`document-import-drain` en `* * * * *`, `document-import-cleanup` en `17 * * * *` y el
`portal-revoked-retention` de la #140 en `30 4 * * *`. La indicación de dejar el drenaje en `*/5`
**no se aplicó**: `*/5` es lo que había en `main` con la bandera apagada, y volver a cada minuto es la
decisión de esta rama (sección de la cadencia), fijada por `cron-cadence.test.ts`.

| Comprobación sobre `ae9cac7b` | Veredicto | Evidencia |
|---|---|---|
| `tsc --noEmit` | **PASÓ** | exit 0 |
| Suite unitaria completa (`pnpm test`), sin suites ajenas | **FALLÓ (exit 1)** | 1 falla de 7.898: `PackingListProductsStep`, la intermitente conocida. **Aislada: 9/9** |
| `pnpm harness:test` | **PASÓ** | 191/191 |
| Dependencias | sin cambios | ni `package.json` ni el lockfile cambiaron desde `6e71565a` |

`e2e` y `build` no se repitieron sobre el merge: se midieron en verde sobre `07f14e14` y lo que entró
de `main` no toca las rutas de esta rama. El check obligatorio de la PR corre sobre la cabeza
publicada.

## COMMITS

- `f988f83f` — fix(import): el cron borra lo vencido aunque la bandera esté apagada.
- `64e02b09` — fix(import): los documentos de compra, detrás de su propia llave.
- `c2853a30` — chore(studio): el cron vuelve a cada minuto, atado al escalón de reintento.
- `2cdbcc87` — feat(cotizador): indexable, y en el sitemap y el footer sólo con la bandera.
- `ccf9c1a6` — docs(SDD-0473): la ampliación de la spec.
- `5f1002c8` — docs(handoff): primera versión de este documento.
- `fd097dc5` — fix(import): la retención en su propio cron, y el drenaje otra vez inerte apagado.
- `6f2d3193` — docs(SDD-0473): la retención aparte, con las tres opciones evaluadas.
- `21f89ef1` — docs(handoff): la retención aparte y las dos corridas limpias de e2e.
- `2575ac5e` — merge de `origin/main` (`b43a39a5`) en la rama.
- `d9105d6e` y `6e71565a` — docs(handoff): autorización de publicación y decisión de Sam.
- `2172e596` — merge de `origin/main` (`a48d304f`).
- `f7eafe9a` — feat(cotizador): en el menú principal, sólo con la bandera.
- `07f14e14` — docs(SDD-0473): el cotizador en el menú principal, con lo medido.
- `85e3c4af` — test(web): seo-remates lee la lista del menú donde ahora vive.
- `a931aad9` — docs(handoff): el menú principal y el verify con la máquina libre.
- `ae9cac7b` — merge de `origin/main` (`91d20e3f`).
- Commit que contiene esta versión del documento: el handoff del merge final, publicado en el push único.

Todos con `git add` selectivo; sin reset, sin force push, sin tocar otras ramas ni worktrees.

## PR / BRANCH

- Rama `codex/encender-cotizador-0473`. **PR #143** (draft): https://github.com/hailuwaycom-sketch/DTDCARGO/pull/143. SHA publicado por primera vez: `6e71565a`.
- **Merge autorizado por Sam** en el chat de dtdcargo-18, literal: «autorizo integrar la #143». Lo ejecuta dtdcargo-18; esta sesión pone la rama al día, la valida y hace **un solo push** cuando el Director pase el SHA final de `main` (después de #144 y #146).
- Publicación autorizada (ver encabezado). Comando: `git push -u origin
  codex/encender-cotizador-0473:codex/encender-cotizador-0473` y PR **draft** contra `main`, draft
  mientras siga abierta la compuerta de privacidad. La URL y el SHA publicado se registran en la PR
  y se reportan a dtdcargo-53; el orden de merge lo decide dtdcargo-18.
- `verify` sobre la cabeza fusionada salió en rojo sólo por `test` bajo carga: la decisión de
  publicar igual se le devolvió a Sam antes del push. **Respuesta de Sam en este chat, literal:
  «Subir ahora en draft (Recommended)».**
- Al momento de publicar, `main` ya estaba en `a48d304f` (#139, #141, #142). `git merge-tree` con la
  rama: exit 0, sin conflictos. **No se fusionó**: se publica lo verificado (`2575ac5e` + este
  handoff) y la actualización a la base nueva, con su `verify`, queda para cuando dtdcargo-18 ordene
  el merge. La #141 cambia el e2e (Supabase sintético), así que esa actualización tiene que volver
  a correr `e2e`.

## PENDIENTES DE ESTA TAREA

1. **Compuerta de privacidad** (Sam y su abogado): `/privacidad`, aviso antes de subir, Anthropic.
   Sin eso no se enciende en producción.
2. **Push único** hecho con `main` `91d20e3f` fusionado (ver PR / BRANCH); falta que dtdcargo-18
   integre cuando cierre el check.
3. **Encender** según «CÓMO SE ENCIENDE»: variables (Sam, en Vercel), merge (Director), sondas.
4. `verify` sin cierre verde: el paso `test` falla por intermitentes preexistentes aun con la máquina
   libre (ver arriba); cada una pasa aislada. El check obligatorio de la PR es la otra evidencia.
5. Capa de conocimiento: Archify sin runtime y estructural en PENDING (ver tabla).

## FUERA DE ALCANCE DETECTADO

1. **La confirmación del proveedor desde el documento no existe.** Es lo que falta para encender
   `DOCUMENT_IMPORT_PORTAL_ENABLED`: un componente del enlace del proveedor que use `x-supplier-token`
   (acciones `workspace`, `save`, `confirm`), o que el formulario viejo entienda el 409. Tarea propia
   de 0473.
2. **Texto del portal dentro del cotizador** (`DocumentImportPanel.tsx:143,376,436`) y el aviso de
   las 24 h que invita a «seguir desde el portal» (`CotizadorClient.tsx`). Va con la compuerta de
   privacidad y con `/ui-check`.
3. **El visitante no puede borrar su documento antes de las 24 h** (no hay acción para eso).
4. **Pruebas intermitentes preexistentes**, que fallan aun con la máquina libre bajo el paralelismo de
   la suite completa: `PackingListProductsStep`, `invoice-read-boundary`, `ClientDrawer.confirm-delete`,
   `supplier-flow`; en e2e, `calculadora-semantic-colors`, y bajo carga ajena también
   `calculadora-hidratacion`, `attachments-gastos-pilot-network`, `auth` y `calc-event`. Mientras
   existan, `verify` no sale verde en esta máquina. Merecen su propia tarea.
5. **Avisos preexistentes de conocimiento**: `missing-link-target` (specs 0148, 0288, 0366, entre
   otras) y `SEMANTIC_GLOBAL_PENDING 0/1091`.

## HANDOFF AL DIRECTOR

- **Qué revisar:** que partir la bandera respeta el control del 409 (se conserva con cualquier
  bandera, `route.test.ts`) y que ninguna puerta del portal queda abierta con sólo la primera llave
  (14 mutantes, uno por puerta).
- **Cambios compartidos:** `Nav.tsx` → `NavClient.tsx` y `Footer.tsx` (todas las páginas públicas),
  `app/sitemap.ts`, `vercel.json` (un cron nuevo: 18 en total) y la ruta pública del proveedor. Nada de esquema ni migraciones.
- **Orden:** variables en Production primero, merge después. El merge es el interruptor y despliega a
  producción. Un merge sin las variables deja el drenaje inerte (no abre la base) y el cron de
  retención limpiando una vez por hora: 24 conexiones al día.
- **Tu objeción de la cadencia:** resuelta con la opción 1 (sección «La retención, aparte»).
- **Antes de cualquier paso en producción:** confirmar con dtdcargo-18 que no hay otra aplicación en
  curso.
- **Ownership:** claim liberado al cerrar esta escritura (ver abajo). Worktree y rama se conservan.
